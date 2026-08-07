'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatPrice } from '@/lib/currency';
import { createClient } from '@/lib/supabase/client';
import { PhoneFrame, PhoneScaledContent } from '@/components/phone-frame';
import {
  DEFAULT_MENU_DESIGN,
  FONT_OPTIONS,
  MENU_DESIGN_PRESETS,
  TEXTURE_OPTIONS,
  hexToRgba,
  menuBackgroundStyle,
  stripPresetMeta,
  textureBackground,
  textureSize,
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
  dashboardHref,
}: {
  venue: { id: string; orgId: string; name: string; description: string | null; slug: string; currency: string; logoUrl: string | null; coverUrl: string | null };
  categories: DesignPreviewCategory[];
  initial: MenuDesignSettings;
  dashboardHref: string;
}) {
  const [settings, setSettings] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'error'>('idle');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);

  function update<K extends keyof MenuDesignSettings>(key: K, value: MenuDesignSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaveState('idle');
  }

  function applyPreset(index: number) {
    const preset = stripPresetMeta(MENU_DESIGN_PRESETS[index]!);
    setSettings((current) => current.backgroundImageUrl
      ? {
          ...preset,
          backgroundImageUrl: current.backgroundImageUrl,
          backgroundImageOpacity: current.backgroundImageOpacity,
          backgroundImageMode: current.backgroundImageMode,
        }
      : preset);
    setSaveState('idle');
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
            <div className="mb-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Başlangıç noktası</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">Hazır tasarımlar</h1>
              <p className="mt-1 text-sm text-stone-500">Bir şablon seç, sonra bütün ayrıntıları kendi markana göre değiştir.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {MENU_DESIGN_PRESETS.map((preset, index) => {
                const active = settings.templateId === preset.templateId;
                return (
                  <button key={preset.templateId} onClick={() => applyPreset(index)} className={`overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-brand-500 ring-2 ring-brand-100' : 'border-stone-200'}`}>
                    <span className="block h-20 p-3" style={{ backgroundColor: preset.backgroundColor, backgroundImage: textureBackground(preset.texture, preset.textColor, preset.textureOpacity), backgroundSize: textureSize(preset.texture) }}>
                      <span className="block h-3 w-3/4 rounded-full" style={{ backgroundColor: preset.primaryColor }} />
                      <span className="mt-3 block space-y-1.5 rounded-lg p-2" style={{ backgroundColor: hexToRgba(preset.cardColor, preset.cardOpacity) }}>
                        <span className="block h-1.5 w-4/5 rounded" style={{ backgroundColor: preset.textColor }} />
                        <span className="block h-1 w-2/3 rounded opacity-50" style={{ backgroundColor: preset.mutedTextColor }} />
                      </span>
                    </span>
                    <span className="block p-3">
                      <span className="flex items-center justify-between gap-1 text-sm font-semibold text-stone-800">{preset.name}{active && <span className="text-brand-600">✓</span>}</span>
                      <span className="mt-0.5 block text-[11px] text-stone-500">{preset.mood}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <ControlSection title="Menü düzeni" description="Ürünleri geniş tek sütunda veya yoğun menüler için iki sütunda göster.">
            <div className="grid grid-cols-2 gap-3">
              <LayoutChoice title="Tek kolon" description="Fotoğraflı ve ferah" active={settings.layout === 'single'} columns={1} onClick={() => update('layout', 'single')} />
              <LayoutChoice title="Çift kolon" description="Kompakt ve hızlı taranır" active={settings.layout === 'two-column'} columns={2} onClick={() => update('layout', 'two-column')} />
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
            <RangeField label="Ayırıcı görünürlüğü" value={settings.dividerOpacity} min={0} max={100} suffix="%" onChange={(value) => update('dividerOpacity', value)} />
          </ControlSection>

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
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">Canlı önizleme</p><p className="mt-0.5 text-xs text-stone-500">Değişiklikler anında görünür</p></div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Canlı</span>
          </div>
          <PhonePreview venue={venue} categories={categories} settings={settings} />
        </aside>
      </div>
    </main>
  );
}

/** Ölçekleme sabiti — pano'daki iframe tekniğiyle aynı: 260 / 390. */
const PREVIEW_SCALE = 0.6667;

function PhonePreview({ venue, categories, settings }: { venue: { name: string; description: string | null; currency: string; logoUrl: string | null; coverUrl: string | null }; categories: DesignPreviewCategory[]; settings: MenuDesignSettings }) {
  const previewCategories = useMemo(() => categories.length ? categories : [{ id: 'sample', name: 'Menü', backgroundUrl: null, backgroundStyle: 'strip' as const, backgroundPositionY: 50, items: [{ id: '1', name: 'İmza Tabağı', description: 'Mevsim ürünleriyle hazırlanan özel lezzet', price: 320, imageUrl: null }, { id: '2', name: 'Günün Çorbası', description: 'Her gün taze hazırlanır', price: 120, imageUrl: null }] }], [categories]);
  const [activeCategory, setActiveCategory] = useState(previewCategories[0]?.id ?? '');
  const previewNavRef = useRef<HTMLDivElement | null>(null);
  const previewTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const previewSectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    setActiveCategory(previewCategories[0]?.id ?? '');
  }, [previewCategories]);

  useEffect(() => {
    const nav = previewNavRef.current;
    const tab = previewTabRefs.current[activeCategory];
    if (!nav || !tab) return;
    nav.scrollTo({ left: tab.offsetLeft - nav.clientWidth / 2 + tab.clientWidth / 2, behavior: 'smooth' });
  }, [activeCategory]);

  function trackPreviewScroll(event: React.UIEvent<HTMLDivElement>) {
    // rect.top zaten dış scale(0.6667) çerçevesinden geçtiği için görsel
    // (ölçeklenmiş) koordinatta gelir — eşik sabiti de aynı oranda ölçeklenir.
    const viewportTop = event.currentTarget.getBoundingClientRect().top + 80 * PREVIEW_SCALE;
    const visible = previewCategories
      .map((category) => ({ id: category.id, top: previewSectionRefs.current[category.id]?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY }))
      .filter((category) => category.top <= viewportTop)
      .sort((a, b) => b.top - a.top)[0];
    if (visible) setActiveCategory(visible.id);
  }

  return (
    <PhoneFrame>
      <PhoneScaledContent>
        <div onScroll={trackPreviewScroll} className="relative h-full w-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ ...menuBackgroundStyle(settings), color: settings.textColor, fontFamily: settings.bodyFont, fontSize: `${settings.baseFontSize}px` }}>
          <header style={{ backgroundColor: settings.surfaceColor }}>
            <div className="h-28 bg-cover bg-center" style={venue.coverUrl ? { backgroundImage: `linear-gradient(0deg, rgba(0,0,0,.18), rgba(0,0,0,.18)), url(${venue.coverUrl})` } : { background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})` }} />
            <div className="px-5 pb-4">
              <div className="-mt-8 flex h-16 w-16 items-center justify-center overflow-hidden border-4 text-xl font-bold shadow" style={{ borderColor: settings.surfaceColor, backgroundColor: settings.surfaceColor, color: settings.primaryColor, borderRadius: `${Math.min(settings.cardRadius, 20)}px` }}>
                {venue.logoUrl ? <img src={venue.logoUrl} alt="" className="h-full w-full object-cover" /> : venue.name.slice(0, 2).toUpperCase()}
              </div>
              <h2 className="mt-3 font-bold tracking-tight" style={{ fontFamily: settings.headingFont, fontSize: `${settings.baseFontSize * settings.headingScale * 1.35}px` }}>{venue.name}</h2>
              {venue.description && <p className="mt-1 line-clamp-2 text-xs" style={{ color: settings.mutedTextColor }}>{venue.description}</p>}
            </div>
          </header>
          <nav ref={previewNavRef} className="sticky top-0 z-20 flex gap-2 overflow-x-auto px-3 py-2 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ backgroundColor: hexToRgba(settings.surfaceColor, 94) }}>
            {previewCategories.map((category) => <button key={category.id} ref={(element) => { previewTabRefs.current[category.id] = element; }} type="button" onClick={() => previewSectionRefs.current[category.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold" style={category.id === activeCategory ? { backgroundColor: settings.primaryColor, color: settings.surfaceColor } : { backgroundColor: hexToRgba(settings.cardColor, settings.cardOpacity), color: settings.mutedTextColor }}>{category.name}</button>)}
          </nav>
          <div className="space-y-7 px-3 py-5">
            {previewCategories.map((category) => {
              const stripBackground = category.backgroundStyle === 'strip' ? category.backgroundUrl : null;
              return <section
                key={category.id}
                ref={(element) => { previewSectionRefs.current[category.id] = element; }}
                className="overflow-hidden rounded-xl border-2 bg-transparent shadow-sm"
                style={{ borderColor: hexToRgba(settings.dividerColor, Math.max(settings.dividerOpacity, 55)) }}
              >
              {stripBackground ? (
                <div className="relative h-16 overflow-hidden">
                  <img src={stripBackground} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `center ${category.backgroundPositionY}%` }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-black/20" />
                  <div className="absolute inset-0 flex items-center justify-center px-2 text-center">
                    <h3 className="font-bold text-white drop-shadow" style={{ fontFamily: settings.headingFont, fontSize: `${settings.baseFontSize * settings.headingScale}px` }}>{category.name}</h3>
                  </div>
                </div>
              ) : (
                <div className="flex h-9 items-center justify-center px-2 text-center" style={{ backgroundColor: settings.primaryColor }}>
                  <h3 className="font-bold uppercase" style={{ color: settings.surfaceColor, fontFamily: settings.headingFont, fontSize: `${settings.baseFontSize * settings.headingScale * 0.85}px`, letterSpacing: '0.03em' }}>{category.name}</h3>
                </div>
              )}
              <div className="p-3" style={{ display: 'grid', gridTemplateColumns: settings.layout === 'two-column' ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: `${settings.itemSpacing}px` }}>
                {category.items.slice(0, 6).map((item) => <div key={item.id} className={`flex items-start gap-3 ${settings.layout === 'single' ? 'p-3 shadow-sm' : 'py-2'}`} style={{ backgroundColor: settings.layout === 'single' ? hexToRgba(settings.cardColor, settings.cardOpacity) : 'transparent', borderRadius: settings.layout === 'single' ? `${settings.cardRadius}px` : 0, borderBottom: `1px dashed ${hexToRgba(settings.dividerColor, settings.dividerOpacity)}` }}>
                  {item.imageUrl && settings.layout === 'single' && <img src={item.imageUrl} alt="" className="h-14 w-14 shrink-0 object-cover" style={{ borderRadius: `${Math.min(settings.cardRadius, 14)}px` }} />}
                  <div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-2"><p className="font-semibold leading-tight">{item.name}</p>{item.price != null && <span className="shrink-0 text-xs font-bold" style={{ color: settings.primaryColor }}>{formatPrice(item.price, venue.currency)}</span>}</div>{item.description && <p className="mt-1 line-clamp-2 text-[11px] leading-snug" style={{ color: settings.mutedTextColor }}>{item.description}</p>}</div>
                </div>)}
              </div>
            </section>;
            })}
          </div>
        </div>
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
