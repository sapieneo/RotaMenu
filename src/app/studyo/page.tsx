'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Phase =
  | { name: 'hazirlaniyor' }
  | { name: 'hazir'; orgId: string; venueId: string }
  | { name: 'yukleniyor'; orgId: string; venueId: string }
  | { name: 'cikariliyor'; orgId: string; venueId: string }
  | { name: 'hata'; message: string; orgId?: string; venueId?: string };

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * "Yeni menü" için hızlı ikon seçenekleri — misafir menüsünün üstündeki
 * menü sekmelerinde (bkz. guest-menu.tsx) adın solunda görünür. Emoji
 * klavyesi açmadan tek tıkla seçilebilsin diye burada sabit bir liste var;
 * kullanıcı isterse yandaki kutuya kendi emojisini de yazabilir.
 */
const MENU_ICONS = ['🍽️', '🐟', '🥩', '🍕', '🍔', '🍷', '🍶', '🍸', '🍺', '☕', '🍵', '🧃', '🍰', '🥐', '🥗', '🏖️'];

/**
 * Studyo giriş ekranı: anonim oturum + org/venue bootstrap + dosya yükleme.
 * Tek altın yol, adım 1: "yükle".
 */
export default function StudyoPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: 'hazirlaniyor' });
  const [dragOver, setDragOver] = useState(false);
  const [isAnon, setIsAnon] = useState(false);
  const [hasMenu, setHasMenu] = useState(false);
  const [venueInfo, setVenueInfo] = useState<{ id: string; name: string; slug: string } | null>(null);
  // Menüsü zaten olan bir işletme yeni sayfa yüklerken, bunu mevcut menüye
  // eklemek yerine AYRI bir menü ("Şarap Menüsü" gibi) olarak da
  // yükleyebilir — misafir tarafında çoklu menü şeridinde ayrı bir sekme
  // olarak çıkar (bkz. guest-menu.tsx `menus` prop'u).
  const [newMenuMode, setNewMenuMode] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuIcon, setNewMenuIcon] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const bootstrapped = useRef(false);

  // Oturum garanti et (anonim dahil), org+venue hazırla
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    (async () => {
      try {
        const supabase = createClient();
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          const { error } = await supabase.auth.signInAnonymously();
          if (error) throw new Error('Oturum başlatılamadı.');
        }
        // Admin panelindeki "Menü üret" buraya `?venue=<id>` ile düşürüyor.
        // Parametreyi bootstrap'a geçmezsek "en son oluşturulan işletme"
        // seçilir ve arka arkaya iki işletme açıldığında yanlış olana girilir.
        const requestedVenue = new URLSearchParams(window.location.search).get('venue');
        const res = await fetch('/api/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestedVenue ? { venueId: requestedVenue } : {}),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Hazırlık başarısız.');
        // Anonim mi? Kalıcılaştırma çağrısı için uyarı bandı göster.
        const { data: userData } = await supabase.auth.getUser();
        const u = userData.user as { is_anonymous?: boolean; email?: string } | null;
        setIsAnon(Boolean(u && (u.is_anonymous ?? !u.email)));
        setHasMenu(Boolean(body.hasMenu));
        if (body.hasMenu && body.slug) {
          setVenueInfo({ id: body.venueId, name: body.name || 'İşletmem', slug: body.slug });
        }
        setPhase({ name: 'hazir', orgId: body.orgId, venueId: body.venueId });
      } catch (err) {
        setPhase({
          name: 'hata',
          message: err instanceof Error ? err.message : 'Beklenmeyen hata.',
        });
      }
    })();
  }, []);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (phase.name !== 'hazir') return;
      const { orgId, venueId } = phase;

      if (files.length > 10) {
        setPhase({ name: 'hata', message: 'Tek seferde en çok 10 sayfa yükleyebilirsin.', orgId, venueId });
        return;
      }
      if (newMenuMode && !newMenuName.trim()) {
        setPhase({ name: 'hata', message: 'Yeni menüye bir isim ver (örn. "Şarap Menüsü").', orgId, venueId });
        return;
      }
      for (const file of files) {
        if (!ACCEPTED.includes(file.type)) {
          setPhase({ name: 'hata', message: 'JPG, PNG, WebP veya PDF yükleyin.', orgId, venueId });
          return;
        }
        if (file.size > MAX_BYTES) {
          setPhase({ name: 'hata', message: `"${file.name}" 20 MB sınırını aşıyor.`, orgId, venueId });
          return;
        }
      }

      setPhase({ name: 'yukleniyor', orgId, venueId });
      try {
        const supabase = createClient();
        const pages: { storagePath: string; mimeType: string; sourceType: 'image' | 'pdf' }[] = [];
        for (const file of files) {
          const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
          const path = `${orgId}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('menu-uploads')
            .upload(path, file, { contentType: file.type });
          if (upErr) throw new Error('Yükleme başarısız. Bağlantınızı kontrol edin.');
          pages.push({
            storagePath: path,
            mimeType: file.type,
            sourceType: file.type === 'application/pdf' ? 'pdf' : 'image',
          });
        }

        setPhase({ name: 'cikariliyor', orgId, venueId });
        const res = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venueId,
            pages,
            ...(newMenuMode && newMenuName.trim()
              ? { newMenu: { name: newMenuName.trim(), icon: newMenuIcon.trim() || undefined } }
              : {}),
          }),
        });
        const contentType = res.headers.get('content-type') ?? '';
        const body = contentType.includes('application/json')
          ? ((await res.json()) as { id?: string; error?: string })
          : null;
        if (!body) {
          throw new Error('Menü çıkarma servisi geçici olarak yanıt veremedi. Lütfen tekrar deneyin.');
        }
        if (!res.ok) throw new Error(body.error ?? 'Menü çıkarılamadı.');
        if (!body.id) throw new Error('Menü çıkarma işi başlatılamadı.');
        router.push(`/studyo/${body.id}`);
      } catch (err) {
        setPhase({
          name: 'hata',
          message: err instanceof Error ? err.message : 'Beklenmeyen hata.',
          orgId,
          venueId,
        });
      }
    },
    [phase, router]
  );

  const busy = phase.name === 'yukleniyor' || phase.name === 'cikariliyor';

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6 py-12">
      {/* Menüsü olan kullanıcı için burası artık bir sihirbaz adımı değil,
          "sayfa ekleme" ekranı — başlık buna göre değişir. */}
      <div>
        <p className="text-sm font-medium text-brand-600">
          {hasMenu ? 'Menüne sayfa ekle' : 'Adım 1 / 5 · Menüyü yükle'}
        </p>
        <h1 className="text-2xl font-bold">{hasMenu ? 'Yeni sayfa yükle' : 'Menünü yükle'}</h1>
        <p className="mt-1 text-stone-600">
          {hasMenu
            ? 'Yüklediğin sayfalar mevcut menüne eklenir; var olan ürünler silinmez.'
            : 'Mevcut menünün fotoğrafını veya PDF’ini yükle; gerisini yapay zeka halletsin.'}
        </p>
      </div>

      {hasMenu && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Menülerin
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-stone-800">{venueInfo?.name ?? 'İşletmem'}</p>
              {venueInfo?.slug && <p className="text-xs text-stone-500">/m/{venueInfo.slug}</p>}
            </div>
            <a
              href={venueInfo?.id ? `/studyo/pano?venue=${encodeURIComponent(venueInfo.id)}` : '/studyo/pano'}
              className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Panoya git
            </a>
          </div>
        </div>
      )}

      {/* Anonim VE henüz menüsü yok → bu kişi ya ilk kez geliyor ya da
          çerezini silmiş kayıtlı bir kullanıcı. İkincisine bir çıkış kapısı
          bırakmazsak burada sessizce YENİ bir boş hesap açmış oluyoruz ve
          kullanıcı menüsünü kaybettiğini sanıyor. */}
      {hasMenu && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Bu sayfalar nereye eklensin?</p>

          {/* İki ayrı düğme yerine tek bir onay kutusu: varsayılan davranış
              (mevcut menüye ekle) işaretsiz hâldir, kullanıcı bilinçli olarak
              işaretlemedikçe menü çoğalmaz. İşaretlenince misafir menüsünün
              üstünde ayrı bir sekme açılır (bkz. guest-menu.tsx → menus). */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3 transition hover:border-stone-300">
            <input
              type="checkbox"
              checked={newMenuMode}
              onChange={(e) => setNewMenuMode(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-stone-800">Ayrı bir menü olarak ekle</span>
              <span className="mt-0.5 block text-xs text-stone-500">
                Şarap, rakı, kokteyl gibi ayrı kartlar için. Misafir menüsünde en üstte kendi
                sekmesiyle çıkar. İşaretlemezsen sayfalar mevcut menüye eklenir, var olan ürünler
                silinmez.
              </span>
            </span>
          </label>

          {newMenuMode && (
            <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
              <div className="flex flex-wrap gap-2">
                <input
                  value={newMenuIcon}
                  onChange={(e) => setNewMenuIcon(e.target.value)}
                  placeholder="🍷"
                  aria-label="Menü ikonu (emoji, opsiyonel)"
                  maxLength={4}
                  className="w-16 rounded-xl border border-stone-200 bg-white px-3 py-2 text-center text-lg outline-none focus:border-brand-500"
                />
                <input
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                  placeholder="Menü adı (örn. Şarap Menüsü)"
                  aria-label="Yeni menü adı"
                  maxLength={60}
                  className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
              </div>
              {/* Hızlı ikon seçimi: emoji klavyesi açmak zorunda kalmadan tek
                  tıkla seçilsin. Seçili olan tekrar tıklanırsa kaldırılır. */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {MENU_ICONS.map((icon) => {
                  const selected = newMenuIcon === icon;
                  return (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setNewMenuIcon(selected ? '' : icon)}
                      aria-pressed={selected}
                      aria-label={`Menü ikonu ${icon}`}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition ${
                        selected ? 'border-brand-600 bg-white' : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                    >
                      {icon}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {isAnon && !hasMenu && (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
          Daha önce menü oluşturduysan{' '}
          <a href="/giris" className="font-semibold text-brand-700 underline">
            e-postanla giriş yap
          </a>{' '}
          — burada yeni bir menü başlatmak yerine kaldığın yerden devam edersin.
        </div>
      )}

      {isAnon && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>
            Menünü yayınlamak için ücretsiz plana kaydolman gerekiyor — hesabın şu an geçici.
          </span>
          <a
            href="/studyo/hesap"
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white transition hover:bg-amber-700"
          >
            Ücretsiz kaydol
          </a>
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-disabled={busy}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const files = Array.from(e.dataTransfer.files ?? []);
          if (files.length && !busy) void handleFiles(files);
        }}
        className={`flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition
          ${dragOver ? 'border-brand-600 bg-brand-50' : 'border-stone-300 bg-white hover:border-brand-500'}
          ${busy ? 'pointer-events-none opacity-70' : ''}`}
      >
        {phase.name === 'hazirlaniyor' && <p className="text-stone-500">Hazırlanıyor…</p>}
        {phase.name === 'hazir' && (
          <>
            <span className="text-4xl">📸</span>
            <p className="font-medium">Fotoğraf ya da PDF&apos;leri buraya bırak</p>
            <p className="text-sm text-stone-500">
              veya tıklayıp seç · birden çok sayfa seçebilirsin · JPG, PNG, WebP, PDF · her biri en çok 20 MB
            </p>
          </>
        )}
        {phase.name === 'yukleniyor' && <Progress label="Dosya yükleniyor…" />}
        {phase.name === 'cikariliyor' && (
          <Progress label="Yapay zeka menünü okuyor… (30-60 sn sürebilir)" />
        )}
        {phase.name === 'hata' && (
          <>
            <p className="font-medium text-red-600">{phase.message}</p>
            {phase.orgId && phase.venueId ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPhase({ name: 'hazir', orgId: phase.orgId!, venueId: phase.venueId! });
                }}
                className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
              >
                Tekrar dene
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.reload();
                }}
                className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
              >
                Sayfayı yenile
              </button>
            )}
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void handleFiles(files);
          e.target.value = '';
        }}
      />

      <p className="text-center text-xs text-stone-400">
        Yüklediğin dosya yalnızca menünü çıkarmak için kullanılır ve hesabına özel saklanır.
      </p>
    </main>
  );
}

function Progress({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      <p className="text-stone-600">{label}</p>
    </div>
  );
}
