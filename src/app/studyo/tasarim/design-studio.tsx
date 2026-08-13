'use client';

import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '@/lib/currency';
import { createClient } from '@/lib/supabase/client';
import { PhoneFrame, PhoneScaledContent } from '@/components/phone-frame';
import { applyPaletteToDesign, extractPaletteFromImage, type ExtractedPalette } from '@/lib/image-palette';
import {
  DEFAULT_MENU_DESIGN,
  FONT_OPTIONS,
  TEXTURE_OPTIONS,
  hexToRgba,
  menuBackgroundStyle,
  stripPresetMeta,
  textureBackground,
  textureSize,
  type MenuDesignPreset,
  type MenuDesignSettings,
} from '@/lib/themes';

export type DesignPreviewCategory = {
  id: string;
  name: string;
  backgroundUrl: string | null;
  backgroundStyle: 'strip' | 'hero';
  backgroundPositionY: number;
  items: { id: string; name: string; description: string | null; price: number | null; imageUrl: string | null }[];
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function DesignStudio({
  venue,
  categories,
  initial,
  initialPresets,
  dashboardHref,
}: {
  venue: { id: string; orgId: string; name: string; description: string | null; slug: string; currency: string; logoUrl: string | null; coverUrl: string | null };
  categories: DesignPreviewCategory[];
  initial: MenuDesignSettings;
  initialPresets: MenuDesignPreset[];
  dashboardHref: string;
}) {
  const [settings, setSettings] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [presets, setPresets] = useState(initialPresets);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [showDetailed, setShowDetailed] = useState(false);
  const [styleText, setStyleText] = useState('');
  const [suggestState, setSuggestState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [suggestion, setSuggestion] = useState<{ templateId: string; reason: string; fallback: boolean } | null>(null);
  const [styleImageUrl, setStyleImageUrl] = useState<string | null>(null);
  const [stylePalette, setStylePalette] = useState<ExtractedPalette | null>(null);
  const [paletteState, setPaletteState] = useState<'idle' | 'extracting' | 'error'>('idle');
  const [presetSaveTarget, setPresetSaveTarget] = useState<{ templateId: string; name: string } | null>(null);
  const [presetSavePassword, setPresetSavePassword] = useState('');
  const [presetSaveState, setPresetSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [presetSaveError, setPresetSaveError] = useState<string | null>(null);
  const [savedPresetFlashId, setSavedPresetFlashId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState(venue.logoUrl);
  const [logoUploadState, setLogoUploadState] = useState<'idle' | 'uploading' | 'error'>('idle');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const styleImageRef = useRef<HTMLInputElement | null>(null);
  const logoFileRef = useRef<HTMLInputElement | null>(null);
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);

  // Seçilen tarz resmi için oluşturulan yerel önizleme URL'sini (object URL)
  // bileşen kapanınca temizle — hiçbir zaman sunucuya yüklenmiyor.
  useEffect(() => {
    return () => {
      if (styleImageUrl) URL.revokeObjectURL(styleImageUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof MenuDesignSettings>(key: K, value: MenuDesignSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaveState('idle');
  }

  /** Verilen tasarımı uygular — mevcut yüklü JPG dokusu varsa korunur. */
  function applySettings(next: MenuDesignSettings) {
    setSettings((current) => current.backgroundImageUrl
      ? {
          ...next,
          backgroundImageUrl: current.backgroundImageUrl,
          backgroundImageOpacity: current.backgroundImageOpacity,
          backgroundImageMode: current.backgroundImageMode,
        }
      : next);
    setSaveState('idle');
  }

  function applyPreset(index: number) {
    applySettings(stripPresetMeta(presets[index]!));
  }

  /**
   * "Tarzınız" kutusuna eklenen resmi okuyup baskın renk paletini çıkarır
   * (bkz. `lib/image-palette.ts`). Resim yalnızca tarayıcıda işlenir,
   * hiçbir yere yüklenmez.
   */
  async function selectStyleImage(file: File) {
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setPaletteState('error');
      return;
    }
    setPaletteState('extracting');
    try {
      const palette = await extractPaletteFromImage(file);
      if (styleImageUrl) URL.revokeObjectURL(styleImageUrl);
      setStyleImageUrl(URL.createObjectURL(file));
      setStylePalette(palette);
      setPaletteState('idle');
    } catch {
      setPaletteState('error');
    }
  }

  function removeStyleImage() {
    if (styleImageUrl) URL.revokeObjectURL(styleImageUrl);
    setStyleImageUrl(null);
    setStylePalette(null);
    setPaletteState('idle');
  }

  /**
   * Kart üzerindeki küçük kaydet ikonu için — bir preset kartını, o anda
   * stüdyoda üzerinde çalışılan tasarımla (settings) günceller. Kartın
   * kendisine tıklamayla karışmasın diye ayrı bir parola onay adımından
   * geçer (bkz. `confirmPresetSave`).
   */
  function openPresetSave(templateId: string, name: string) {
    setPresetSaveTarget({ templateId, name });
    setPresetSavePassword('');
    setPresetSaveState('idle');
    setPresetSaveError(null);
  }

  function closePresetSave() {
    if (presetSaveState === 'saving') return;
    setPresetSaveTarget(null);
  }

  async function confirmPresetSave() {
    if (!presetSaveTarget || !presetSavePassword.trim()) return;
    setPresetSaveState('saving');
    setPresetSaveError(null);
    try {
      const response = await fetch(`/api/design-presets/${presetSaveTarget.templateId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: presetSavePassword, settings }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Kaydedilemedi.');
      const savedTemplateId = presetSaveTarget.templateId;
      setPresets((current) =>
        current.map((preset) =>
          preset.templateId === savedTemplateId ? { ...preset, ...settings, templateId: savedTemplateId } : preset
        )
      );
      setPresetSaveTarget(null);
      setPresetSavePassword('');
      setPresetSaveState('idle');
      setSavedPresetFlashId(savedTemplateId);
      setTimeout(() => setSavedPresetFlashId((current) => (current === savedTemplateId ? null : current)), 2200);
    } catch (error) {
      setPresetSaveState('error');
      setPresetSaveError(error instanceof Error ? error.message : 'Kaydedilemedi.');
    }
  }

  /**
   * "Tarzınız" metnini AI'a gönderip 10 hazır tasarımdan en uygununu bulur
   * ve otomatik uygular (kaydetmek için kullanıcı hâlâ "Tasarımı kaydet"e
   * basmalı — diğer tüm değişikliklerle aynı akış). AI çağrısı başarısız
   * olursa sunucu anahtar kelime eşleşmesine dayalı bir yedek öneriyle döner,
   * kullanıcı hiçbir zaman boş elle kalmaz.
   *
   * Bir resim de eklenmişse: metin (varsa) hangi şablonun temel alınacağını
   * belirler, ardından o tasarımın renkleri resimden çıkarılan paletle
   * DEĞİŞTİRİLİR (bkz. `applyPaletteToDesign`) — font/düzen/aralık gibi
   * yapısal ayarlar aynı kalır. Yalnızca resim eklenip metin girilmezse,
   * o an ekranda açık olan tasarım temel alınıp yalnızca renklendirilir.
   */
  async function suggestDesign() {
    if ((!styleText.trim() && !stylePalette) || suggestState === 'loading') return;
    setSuggestState('loading');
    try {
      let baseSettings: MenuDesignSettings = settings;
      let suggestionInfo: { templateId: string; reason: string; fallback: boolean } | null = null;

      if (styleText.trim()) {
        const response = await fetch('/api/venue/design/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ venueId: venue.id, styleText: styleText.trim() }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Tasarım önerisi alınamadı.');
        const index = presets.findIndex((preset) => preset.templateId === body.templateId);
        if (index >= 0) baseSettings = stripPresetMeta(presets[index]!);
        suggestionInfo = { templateId: body.templateId, reason: body.reason, fallback: body.source === 'fallback' };
      }

      applySettings(stylePalette ? applyPaletteToDesign(baseSettings, stylePalette) : baseSettings);
      setSuggestion(suggestionInfo);
      setSuggestState('done');
    } catch {
      setSuggestState('error');
    }
  }

  async function save(settingsToSave = settings) {
    setSaveState('saving');
    try {
      const response = await fetch('/api/venue/design', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId: venue.id, settings: settingsToSave }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Tasarım kaydedilemedi.');
      setSaved(settingsToSave);
      setSaveState('saved');
      return true;
    } catch {
      setSaveState('error');
      return false;
    }
  }

  async function openFullscreenMenu() {
    // Yeni sekmeyi kullanıcı tıklaması sırasında açıyoruz; böylece tarayıcı
    // kaydetme isteği sürerken bunu bir pop-up olarak engellemez.
    const menuWindow = window.open('', '_blank');
    const wasSaved = dirty ? await save() : true;
    if (!wasSaved) {
      menuWindow?.close();
      return;
    }
    const menuUrl = `/m/${venue.slug}`;
    if (menuWindow) menuWindow.location.assign(menuUrl);
    else window.open(menuUrl, '_blank', 'noopener,noreferrer');
  }

  async function uploadBackground(file: File) {
    if (!['image/jpeg', 'image/jpg'].includes(file.type)) {
      setUploadState('error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadState('error');
      return;
    }
    setUploadState('uploading');
    const supabase = createClient();
    const path = `${venue.orgId}/design/${venue.id}-${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from('venue-media').upload(path, file, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    if (error) {
      setUploadState('error');
      return;
    }
    const { data } = supabase.storage.from('venue-media').getPublicUrl(path);
    if (settings.backgroundImageUrl) {
      const oldPath = storagePathFromPublicUrl(settings.backgroundImageUrl);
      if (oldPath) await supabase.storage.from('venue-media').remove([oldPath]);
    }
    setSettings((current) => ({ ...current, backgroundImageUrl: data.publicUrl }));
    setSaveState('idle');
    setUploadState('idle');
  }

  async function removeBackground() {
    if (!settings.backgroundImageUrl) return;
    setUploadState('uploading');
    const path = storagePathFromPublicUrl(settings.backgroundImageUrl);
    if (path) {
      const supabase = createClient();
      await supabase.storage.from('venue-media').remove([path]);
    }
    update('backgroundImageUrl', null);
    setUploadState('idle');
  }

  /**
   * Logo, tasarım ayarlarının (settings) parçası DEĞİL — venue tablosundaki
   * ayrı bir sütun (logo_url), "Tasarımı kaydet" akışının dışında. Bu yüzden
   * yüklenir yüklenmez `/api/venue` ile hemen kaydedilir; kullanıcı üst
   * sağdaki kaydet düğmesine basmak zorunda kalmaz.
   */
  async function uploadLogo(file: File) {
    if (file.type !== 'image/png') {
      setLogoUploadState('error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoUploadState('error');
      return;
    }
    setLogoUploadState('uploading');
    const supabase = createClient();
    const path = `${venue.orgId}/logo/${venue.id}-${crypto.randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage.from('venue-media').upload(path, file, {
      contentType: 'image/png',
      upsert: false,
    });
    if (uploadError) {
      setLogoUploadState('error');
      return;
    }
    const { data } = supabase.storage.from('venue-media').getPublicUrl(path);
    try {
      const response = await fetch('/api/venue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId: venue.id, logoUrl: data.publicUrl }),
      });
      if (!response.ok) throw new Error();
      const oldPath = logoUrl ? storagePathFromPublicUrl(logoUrl) : null;
      if (oldPath) await supabase.storage.from('venue-media').remove([oldPath]);
      setLogoUrl(data.publicUrl);
      setLogoUploadState('idle');
    } catch {
      await supabase.storage.from('venue-media').remove([path]);
      setLogoUploadState('error');
    }
  }

  async function removeLogo() {
    if (!logoUrl) return;
    setLogoUploadState('uploading');
    try {
      const response = await fetch('/api/venue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId: venue.id, logoUrl: null }),
      });
      if (!response.ok) throw new Error();
      const path = storagePathFromPublicUrl(logoUrl);
      if (path) {
        const supabase = createClient();
        await supabase.storage.from('venue-media').remove([path]);
      }
      setLogoUrl(null);
      setLogoUploadState('idle');
    } catch {
      setLogoUploadState('error');
    }
  }

  return (
    <main className="min-h-screen bg-stone-100">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3 sm:px-6">
          <a href={dashboardHref} className="rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800">← Panoya dön</a>
          <div className="min-w-0 flex-1 border-l border-stone-200 pl-3">
            <p className="truncate text-sm font-semibold text-stone-900">Tasarım Stüdyosu</p>
            <p className="truncate text-xs text-stone-500">{venue.name}</p>
          </div>
          <span className={`hidden text-xs sm:inline ${dirty ? 'text-amber-600' : 'text-emerald-600'}`}>
            {dirty ? 'Kaydedilmemiş değişiklik' : saveState === 'saved' ? '✓ Kaydedildi' : 'Güncel'}
          </span>
          <button onClick={() => void save()} disabled={!dirty || saveState === 'saving'} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40">
            {saveState === 'saving' ? 'Kaydediliyor…' : 'Tasarımı kaydet'}
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-7 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,840px)_320px] xl:justify-between">
        <div className="min-w-0 space-y-6">
          <section>
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Başlangıç noktası</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">Büyük Tasarım Seç</h1>
              <p className="mt-1 text-sm text-stone-500">10 hazır, şık tasarımdan birini seç — ya da tarzını anlat, senin için AI seçsin.</p>
            </div>

            <div className="mb-5 rounded-[22px] border border-stone-200/70 bg-white/90 p-4 shadow-[0_4px_24px_rgba(0,0,0,0.05)] backdrop-blur sm:p-5">
              <label htmlFor="style-text" className="block text-sm font-semibold text-stone-800">Tarzınız</label>
              <p className="mt-0.5 text-xs text-stone-500">Mekanını birkaç kelimeyle anlat ve/veya bir resim ekle — AI en uygun tasarımı seçsin, resmin tonlarını kullansın.</p>
              <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-end">
                <textarea
                  id="style-text"
                  value={styleText}
                  onChange={(event) => setStyleText(event.target.value)}
                  placeholder="Örn: Sıcak, ahşap dokulu, aile işletmesi hissi veren bir lokanta"
                  rows={2}
                  maxLength={400}
                  className="min-w-0 flex-1 resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="button"
                  onClick={() => void suggestDesign()}
                  disabled={(!styleText.trim() && !stylePalette) || suggestState === 'loading'}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {suggestState === 'loading' ? 'Aranıyor…' : '✨ AI ile öner'}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => styleImageRef.current?.click()}
                  disabled={paletteState === 'extracting'}
                  className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-600 shadow-sm transition hover:border-stone-300 hover:text-stone-900 disabled:opacity-50"
                >
                  {paletteState === 'extracting' ? 'Renkler okunuyor…' : styleImageUrl ? '🖼️ Resmi değiştir' : '🖼️ Resim ekle'}
                </button>
                <input
                  ref={styleImageRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void selectStyleImage(file);
                    event.target.value = '';
                  }}
                />
                {styleImageUrl && (
                  <div className="flex items-center gap-2">
                    <img src={styleImageUrl} alt="Seçilen tarz resmi" className="h-10 w-10 rounded-lg object-cover ring-1 ring-stone-200" />
                    {stylePalette && (
                      <span className="flex overflow-hidden rounded-md ring-1 ring-stone-200">
                        {stylePalette.colors.slice(0, 5).map((color, i) => (
                          <span key={`${color}-${i}`} className="block h-5 w-5" style={{ backgroundColor: color }} />
                        ))}
                      </span>
                    )}
                    <button type="button" onClick={removeStyleImage} className="text-xs font-medium text-red-600 hover:underline">Kaldır</button>
                  </div>
                )}
                {paletteState === 'error' && <span className="text-xs font-medium text-red-600">Resim okunamadı, JPG/PNG/WebP dene.</span>}
              </div>
              <p className="mt-1.5 text-[11px] text-stone-400">Resim eklersen tasarımın renkleri o resmin tonlarından alınır — resim yalnızca tarayıcında işlenir, hiçbir yere yüklenmez.</p>

              {suggestState === 'done' && (suggestion || stylePalette) && (
                <p className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
                  {suggestion ? (
                    <>
                      <span className="font-bold">{presets.find((preset) => preset.templateId === suggestion.templateId)?.name ?? 'Tasarım'}</span> uygulandı — {suggestion.reason}
                      {stylePalette && ' Renkler yüklediğin resimden alındı.'}
                    </>
                  ) : (
                    'Resimdeki tonlar tasarımına uygulandı.'
                  )}
                </p>
              )}
              {suggestState === 'error' && (
                <p className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">Öneri alınamadı. Bağlantını kontrol edip tekrar dene.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-5">
              {presets.map((preset, index) => {
                const active = settings.templateId === preset.templateId;
                const recommended = suggestState === 'done' && suggestion?.templateId === preset.templateId;
                const justSaved = savedPresetFlashId === preset.templateId;
                return (
                  <div
                    key={preset.templateId}
                    role="button"
                    tabIndex={0}
                    onClick={() => applyPreset(index)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        applyPreset(index);
                      }
                    }}
                    className={`group relative cursor-pointer overflow-hidden rounded-[20px] border bg-white text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.09)] ${active ? 'border-brand-500 ring-2 ring-brand-100' : 'border-stone-200/80'}`}
                  >
                    {recommended && (
                      <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-stone-900/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">✨ AI önerisi</span>
                    )}
                    <button
                      type="button"
                      title="Şu anki tasarımı bu karta kaydet (yönetici parolası gerekir)"
                      onClick={(event) => {
                        event.stopPropagation();
                        openPresetSave(preset.templateId, preset.name);
                      }}
                      className={`absolute right-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] shadow-sm backdrop-blur transition ${justSaved ? 'bg-emerald-500 text-white' : 'bg-white/90 text-stone-500 opacity-0 group-hover:opacity-100 hover:bg-white hover:text-stone-900 focus:opacity-100'}`}
                    >
                      {justSaved ? '✓' : '💾'}
                    </button>
                    <span className="block h-24 p-3.5" style={{ backgroundColor: preset.backgroundColor, backgroundImage: textureBackground(preset.texture, preset.textColor, preset.textureOpacity), backgroundSize: textureSize(preset.texture) }}>
                      <span className="block h-3 w-3/4 rounded-full" style={{ backgroundColor: preset.primaryColor }} />
                      <span className="mt-3.5 block space-y-1.5 p-2.5" style={{ backgroundColor: hexToRgba(preset.cardColor, preset.cardOpacity), borderRadius: `${Math.min(preset.cardRadius, 16)}px` }}>
                        <span className="block h-1.5 w-4/5 rounded-full" style={{ backgroundColor: preset.textColor }} />
                        <span className="block h-1 w-2/3 rounded-full opacity-50" style={{ backgroundColor: preset.mutedTextColor }} />
                      </span>
                    </span>
                    <span className="block p-3.5">
                      <span className="flex items-center justify-between gap-1 text-sm font-semibold text-stone-900">{preset.name}{active && <span className="text-brand-600">✓</span>}</span>
                      <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-wide text-stone-400">{preset.mood}</span>
                      <span className="mt-1.5 block text-xs leading-snug text-stone-500">{preset.description}</span>
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowDetailed((current) => !current)}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-600 shadow-sm transition hover:border-stone-300 hover:text-stone-900"
            >
              <span className={`inline-block transition-transform ${showDetailed ? 'rotate-90' : ''}`}>›</span> İnce Ayar
            </button>
          </section>

          {showDetailed && (
            <>
              <ControlSection title="Menü düzeni" description="Ürünleri geniş tek sütunda veya yoğun menüler için iki sütunda göster.">
                <div className="grid grid-cols-2 gap-3">
                  <LayoutChoice title="Tek kolon" description="Fotoğraflı ve ferah" active={settings.layout === 'single'} columns={1} onClick={() => update('layout', 'single')} />
                  <LayoutChoice title="Çift kolon" description="Kompakt ve hızlı taranır" active={settings.layout === 'two-column'} columns={2} onClick={() => update('layout', 'two-column')} />
                </div>
              </ControlSection>

              <ControlSection title="Üst şerit ve logo" description="Menü başlığındaki kapak şeridinin kalınlığını ve logonun yerini/boyutunu ayarla.">
                <RangeField label="Şerit kalınlığı" value={settings.headerHeight} min={60} max={320} suffix=" px" onChange={(value) => update('headerHeight', value)} />
                <div className="border-t border-stone-200 pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="text-sm font-semibold text-stone-800">Logo</p><p className="mt-0.5 text-xs text-stone-500">PNG, en fazla 5 MB. Şeridin üst orta kısmında gösterilir.</p></div>
                    <button type="button" onClick={() => logoFileRef.current?.click()} disabled={logoUploadState === 'uploading'} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">{logoUploadState === 'uploading' ? 'Yükleniyor…' : logoUrl ? 'Logoyu değiştir' : 'Logo yükle'}</button>
                    <input ref={logoFileRef} type="file" accept="image/png" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadLogo(file); event.target.value = ''; }} />
                  </div>
                  {logoUploadState === 'error' && <p className="mt-2 text-xs font-medium text-red-600">Yalnızca 5 MB’den küçük PNG dosyası yükleyebilirsin.</p>}
                  {logoUrl && (
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
                      <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded-lg bg-white object-contain ring-1 ring-stone-200" />
                      <div className="flex-1"><p className="text-sm font-semibold text-stone-700">Yüklü logo</p><button type="button" onClick={() => void removeLogo()} disabled={logoUploadState === 'uploading'} className="mt-1 text-xs font-medium text-red-600 hover:underline disabled:opacity-50">Kaldır</button></div>
                    </div>
                  )}
                  <div className="mt-4 space-y-4">
                    <RangeField label="Logo boyutu" value={settings.logoSize} min={24} max={160} suffix=" px" onChange={(value) => update('logoSize', value)} />
                    <RangeField label="Logo yatay konumu" value={settings.logoPositionX} min={0} max={100} suffix="%" onChange={(value) => update('logoPositionX', value)} />
                  </div>
                </div>
              </ControlSection>

              <ControlSection title="Renkler" description="Menünün ana yüzeylerini ve vurgu renklerini belirle.">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <ColorField label="Sayfa arka planı" value={settings.backgroundColor} onChange={(value) => update('backgroundColor', value)} />
                  <ColorField label="Üst yüzey" value={settings.surfaceColor} onChange={(value) => update('surfaceColor', value)} />
                  <ColorField label="Ana renk" value={settings.primaryColor} onChange={(value) => update('primaryColor', value)} />
                  <ColorField label="Vurgu rengi" value={settings.accentColor} onChange={(value) => update('accentColor', value)} />
                  <ColorField label="Ana yazı" value={settings.textColor} onChange={(value) => update('textColor', value)} />
                  <ColorField label="İkincil yazı" value={settings.mutedTextColor} onChange={(value) => update('mutedTextColor', value)} />
                </div>
              </ControlSection>

              <ControlSection title="Arka plan dokusu" description="Düz renk üzerine hafif bir malzeme hissi ekle.">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {TEXTURE_OPTIONS.map((texture) => (
                    <button key={texture.id} onClick={() => update('texture', texture.id)} className={`h-16 rounded-xl border text-xs font-semibold transition ${settings.texture === texture.id ? 'border-brand-500 text-brand-700 ring-2 ring-brand-100' : 'border-stone-200 text-stone-600'}`} style={{ backgroundColor: settings.backgroundColor, backgroundImage: textureBackground(texture.id, settings.textColor, Math.max(settings.textureOpacity, 18)), backgroundSize: textureSize(texture.id) }}>{texture.label}</button>
                  ))}
                </div>
                <RangeField label="Doku yoğunluğu" value={settings.textureOpacity} min={0} max={60} suffix="%" onChange={(value) => update('textureOpacity', value)} />
                <div className="border-t border-stone-200 pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="text-sm font-semibold text-stone-800">Kendi JPG dokunu yükle</p><p className="mt-0.5 text-xs text-stone-500">En fazla 10 MB. Küçük desenlerde “Döşe”yi kullan.</p></div>
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadState === 'uploading'} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">{uploadState === 'uploading' ? 'Yükleniyor…' : settings.backgroundImageUrl ? 'JPG’yi değiştir' : 'JPG yükle'}</button>
                    <input ref={fileRef} type="file" accept="image/jpeg,.jpg,.jpeg" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadBackground(file); event.target.value = ''; }} />
                  </div>
                  {uploadState === 'error' && <p className="mt-2 text-xs font-medium text-red-600">Yalnızca 10 MB’den küçük JPG dosyası yükleyebilirsin.</p>}
                  {settings.backgroundImageUrl && <div className="mt-4 space-y-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
                    <div className="flex items-center gap-3"><img src={settings.backgroundImageUrl} alt="Yüklenen arka plan dokusu" className="h-16 w-24 rounded-lg object-cover" /><div className="flex-1"><p className="text-sm font-semibold text-stone-700">Özel JPG dokusu</p><button type="button" onClick={() => void removeBackground()} disabled={uploadState === 'uploading'} className="mt-1 text-xs font-medium text-red-600 hover:underline disabled:opacity-50">Kaldır</button></div></div>
                    <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => update('backgroundImageMode', 'cover')} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${settings.backgroundImageMode === 'cover' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-stone-200 bg-white text-stone-600'}`}>Alanı kapla</button><button type="button" onClick={() => update('backgroundImageMode', 'tile')} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${settings.backgroundImageMode === 'tile' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-stone-200 bg-white text-stone-600'}`}>Deseni döşe</button></div>
                    <RangeField label="JPG görünürlüğü" value={settings.backgroundImageOpacity} min={0} max={100} suffix="%" onChange={(value) => update('backgroundImageOpacity', value)} />
                  </div>}
                </div>
              </ControlSection>

              <ControlSection title="Tipografi" description="Başlık ve ürün metinlerinin karakterini ayarla.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Başlık fontu" value={settings.headingFont} onChange={(value) => update('headingFont', value)} />
                  <SelectField label="Gövde fontu" value={settings.bodyFont} onChange={(value) => update('bodyFont', value)} />
                </div>
                <RangeField label="Yazı boyutu" value={settings.baseFontSize} min={13} max={20} suffix=" px" onChange={(value) => update('baseFontSize', value)} />
                <RangeField label="Başlık büyüklüğü" value={Math.round(settings.headingScale * 100)} min={100} max={160} suffix="%" onChange={(value) => update('headingScale', value / 100)} />
              </ControlSection>

              <ControlSection title="Ürün kartları ve aralıklar" description="Ürünlerin birbirinden ne kadar ayrışacağını belirle.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ColorField label="Kart rengi" value={settings.cardColor} onChange={(value) => update('cardColor', value)} />
                  <ColorField label="Ayırıcı rengi" value={settings.dividerColor} onChange={(value) => update('dividerColor', value)} />
                </div>
                <RangeField label="Kart görünürlüğü" value={settings.cardOpacity} min={0} max={100} suffix="%" onChange={(value) => update('cardOpacity', value)} />
                <RangeField label="Köşe yuvarlaklığı" value={settings.cardRadius} min={0} max={32} suffix=" px" onChange={(value) => update('cardRadius', value)} />
                <RangeField label="Ürünler arası boşluk" value={settings.itemSpacing} min={6} max={28} suffix=" px" onChange={(value) => update('itemSpacing', value)} />
                <RangeField label="Büyük resim köşe yuvarlaklığı" value={settings.heroImageRadius} min={0} max={40} suffix=" px" onChange={(value) => update('heroImageRadius', value)} />
                <RangeField label="Ürün grup çerçevesi köşe yuvarlaklığı" value={settings.groupFrameRadius} min={0} max={40} suffix=" px" onChange={(value) => update('groupFrameRadius', value)} />
              </ControlSection>
            </>
          )}

          {saveState === 'error' && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Tasarım kaydedilemedi. Bağlantını kontrol edip tekrar dene.</p>}
          <div className="flex flex-wrap items-center gap-3 pb-10">
            <button onClick={() => setSettings({ ...DEFAULT_MENU_DESIGN })} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">Varsayılana dön</button>
            <button type="button" onClick={() => void openFullscreenMenu()} disabled={saveState === 'saving'} className="text-sm font-semibold text-brand-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50">
              {dirty ? 'Kaydet ve tam ekran menüyü aç ↗' : 'Tam ekran menüyü aç ↗'}
            </button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-3 flex items-center justify-between px-1">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">Canlı önizleme</p><p className="mt-0.5 text-xs text-stone-500">Değişiklikler anında görünür — gerçek misafir menünle birebir aynı</p></div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Canlı</span>
          </div>
          <LivePreview slug={venue.slug} settings={settings} logoUrl={logoUrl} />
        </aside>
      </div>

      {presetSaveTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm"
          onClick={closePresetSave}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-semibold text-stone-900">“{presetSaveTarget.name}” kartını güncelle</p>
            <p className="mt-1 text-xs text-stone-500">
              Şu anda üzerinde çalıştığın tasarım bu karta kaydedilecek — bu andan sonra platformdaki tüm işletmeler bu hazır şablonu bu hâliyle görür.
            </p>
            <input
              type="password"
              autoFocus
              value={presetSavePassword}
              onChange={(event) => setPresetSavePassword(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void confirmPresetSave()}
              placeholder="Yönetici parolası"
              className="mt-4 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500"
            />
            {presetSaveError && <p className="mt-2 text-xs font-medium text-red-600">{presetSaveError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closePresetSave}
                disabled={presetSaveState === 'saving'}
                className="rounded-xl px-3.5 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void confirmPresetSave()}
                disabled={presetSaveState === 'saving' || !presetSavePassword.trim()}
                className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {presetSaveState === 'saving' ? 'Kaydediliyor…' : 'Karta kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * Sağdaki maket — gerçek /m/[slug] misafir menü sayfasını iframe içinde
 * gösterir (pano'daki PhonePreview ile birebir aynı teknik), böylece her
 * zaman gerçek sayfayla senkron kalır (elle ikinci kez yazılan kategori/ürün
 * render kodu artık yok).
 *
 * Iframe yalnızca BİR KEZ, ilk kayıtlı/taslak ayarlarla yüklenir
 * (`?previewDesign=<json>` — sunucu tarafında yalnızca işletme sahibinin
 * isteğinde geçerli, bkz. m/[slug]/page.tsx). Bundan sonraki HER değişiklik
 * iframe'i yeniden yüklemek yerine `postMessage` ile içerideki sayfaya
 * iletilir; guest-menu.tsx bunu dinleyip kendi state'ini güncelliyor —
 * network/DB round-trip olmadığı için gerçekten anında yansıyor (eskiden
 * her değişiklik iframe'i tam sayfa yeniden yüklüyordu, bu da veri
 * çekildikten sonra görünen bir gecikmeye yol açıyordu).
 */
function LivePreview({ slug, settings, logoUrl }: { slug: string; settings: MenuDesignSettings; logoUrl: string | null }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Yalnızca ilk render'da hesaplanır — sonraki `settings` değişiklikleri
  // src'yi GÜNCELLEMEZ (bu da iframe'in yeniden yüklenmesini tetikler).
  const [initialSrc] = useState(
    () => `/m/${slug}?previewDesign=${encodeURIComponent(JSON.stringify(settings))}`
  );

  function sendPreview() {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'ros:design-preview', design: settings, logoUrl },
      window.location.origin
    );
  }

  useEffect(() => {
    sendPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, logoUrl]);

  return (
    <PhoneFrame>
      <PhoneScaledContent>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          title="Menü canlı önizleme"
          className="h-full w-full border-0"
          onLoad={sendPreview}
        />
      </PhoneScaledContent>
    </PhoneFrame>
  );
}

function ControlSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5"><h2 className="text-lg font-bold text-stone-900">{title}</h2><p className="mt-1 text-sm text-stone-500">{description}</p></div><div className="space-y-5">{children}</div></section>;
}

function LayoutChoice({ title, description, active, columns, onClick }: { title: string; description: string; active: boolean; columns: 1 | 2; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-xl border p-3 text-left transition ${active ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-stone-200 bg-stone-50 hover:border-stone-300'}`}><span className="mb-3 grid h-16 gap-2 rounded-lg bg-white p-2 shadow-inner" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{Array.from({ length: columns }).map((_, index) => <span key={index} className="space-y-1.5"><span className="block h-2 w-3/4 rounded bg-stone-400" /><span className="block h-1.5 rounded bg-stone-200" /><span className="block h-1.5 w-4/5 rounded bg-stone-200" /></span>)}</span><span className="block text-sm font-semibold text-stone-800">{title}{active && <span className="float-right text-brand-600">✓</span>}</span><span className="mt-0.5 block text-xs text-stone-500">{description}</span></button>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 p-2.5"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0" /><span className="min-w-0"><span className="block text-xs font-semibold text-stone-700">{label}</span><input value={value.toUpperCase()} onChange={(event) => /^#[0-9A-Fa-f]{0,6}$/.test(event.target.value) && event.target.value.length === 7 && onChange(event.target.value)} className="mt-0.5 w-24 bg-transparent text-xs uppercase text-stone-500 outline-none" /></span></label>;
}

function RangeField({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="block"><span className="mb-2 flex items-center justify-between text-sm font-medium text-stone-700"><span>{label}</span><output className="rounded-lg bg-stone-100 px-2 py-1 text-xs font-bold tabular-nums text-stone-600">{value}{suffix}</output></span><input type="range" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} className="h-2 w-full cursor-pointer accent-orange-600" /></label>;
}

function SelectField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500">{FONT_OPTIONS.map((font) => <option key={font.id} value={font.value}>{font.label}</option>)}</select><span className="mt-2 block truncate text-base" style={{ fontFamily: value }}>İyi yemek, güzel anılar.</span></label>;
}

function storagePathFromPublicUrl(url: string): string | null {
  const marker = '/storage/v1/object/public/venue-media/';
  try {
    const path = new URL(url).pathname;
    const index = path.indexOf(marker);
    return index >= 0 ? decodeURIComponent(path.slice(index + marker.length)) : null;
  } catch {
    return null;
  }
}
