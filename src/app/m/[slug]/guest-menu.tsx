'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ALLERGENS } from '@/lib/allergens';
import { DIETARY } from '@/lib/dietary';
import { formatPrice } from '@/lib/currency';
import { hexToRgba, menuBackgroundStyle, type MenuDesignSettings } from '@/lib/themes';

export type GuestItem = {
  id: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  price: number | null;
  calories: number | null;
  imageUrl: string | null;
  allergenCodes: string[];
  dietaryCodes: string[];
};

export type GuestCategory = {
  id: string;
  name: string;
  backgroundUrl: string | null;
  /** 'strip' = küçük şerit banner (varsayılan). 'hero' = tam boy arka plan;
   *  ürün listesi üzerine yarı saydam kart olarak biner. */
  backgroundStyle: 'strip' | 'hero';
  items: GuestItem[];
};

export type GuestVenue = {
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  currency: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  googleMapsUrl: string | null;
  wifiSsid: string | null;
  openingHours: string | null;
  isPublished: boolean;
  /** Ücretsiz planda "RestaurantOS ile hazırlandı" rozeti gösterilir. */
  showBadge: boolean;
  design: MenuDesignSettings;
};

export function GuestMenu({
  venue,
  categories,
  venueId,
  availableLocales,
  currentLocale,
}: {
  venue: GuestVenue;
  categories: GuestCategory[];
  venueId: string;
  availableLocales: { code: string; name: string }[];
  currentLocale: string;
}) {
  const [active, setActive] = useState(categories[0]?.id ?? '');
  const [selected, setSelected] = useState<GuestItem | null>(null);
  const seenItems = useRef<Set<string>>(new Set());

  /**
   * 'item_view' olayı (B3). Aynı oturumda aynı ürün bir kez sayılır — modal
   * açılıp kapanınca sayaç şişmesin. Yayınlanmamış önizlemede hiç yazılmaz.
   * Analitik sessizdir: hata olursa misafir hiçbir şey görmez.
   */
  function openItem(item: GuestItem) {
    setSelected(item);
    if (!venue.isPublished || seenItems.current.has(item.id)) return;
    seenItems.current.add(item.id);
    void fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venueId, itemId: item.id, eventType: 'item_view' }),
      keepalive: true,
    }).catch(() => {});
  }
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const navRef = useRef<HTMLDivElement | null>(null);
  const clickScrolling = useRef(false);

  // Scroll-spy: görünürdeki kategoriye göre aktif sekmeyi işaretle.
  useEffect(() => {
    if (!categories.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (clickScrolling.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.replace('cat-', ''));
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [categories]);

  // Aktif sekmeyi yatay şeritte ortala. ÖNEMLİ: yalnızca nav'ı yatay kaydır;
  // scrollIntoView kullanılırsa sayfayı dikey de kaydırıp "yukarı yaylanma"
  // hatası yapar.
  useEffect(() => {
    const nav = navRef.current;
    const tab = tabRefs.current[active];
    if (!nav || !tab) return;
    const navRect = nav.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const delta = tabRect.left - navRect.left - (nav.clientWidth / 2 - tab.clientWidth / 2);
    nav.scrollTo({ left: nav.scrollLeft + delta, behavior: 'smooth' });
  }, [active]);

  function goTo(id: string) {
    setActive(id);
    clickScrolling.current = true;
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      clickScrolling.current = false;
    }, 700);
  }

  if (!categories.length) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-bold">{venue.name}</h1>
        <p className="text-stone-500">Menü henüz hazırlanıyor. Kısa süre sonra tekrar deneyin.</p>
      </main>
    );
  }

  const design = venue.design;

  return (
    <div
      className="mx-auto min-h-screen max-w-lg pb-16 shadow-sm sm:my-4 sm:rounded-2xl"
      style={{
        ...menuBackgroundStyle(design),
        color: design.textColor,
        fontFamily: design.bodyFont,
        fontSize: `${design.baseFontSize}px`,
      }}
    >
      {/* DİKKAT: dış kapsayıcıda overflow-hidden OLMAMALI — position:sticky'nin
          "en yakın scroll ata"sını buraya sabitler ve nav'ı kırar. Yuvarlak
          köşe kırpma bunun yerine header/footer'ın kendi üzerinde yapılır. */}
      {!venue.isPublished && (
        <div className="bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-800">
          Önizleme — bu menü henüz yayınlanmadı. Yalnızca siz görüyorsunuz.
        </div>
      )}

      {/* Hero */}
      <header className="relative" style={{ backgroundColor: design.surfaceColor }}>
        <div
          className="h-40 w-full bg-cover bg-center sm:rounded-t-2xl"
          style={venue.coverUrl ? { backgroundImage: `url(${venue.coverUrl})` } : { background: `linear-gradient(135deg, ${design.primaryColor}, ${design.accentColor})` }}
        />
        <div className="px-5 pb-4">
          <div className="-mt-10 flex items-end gap-3">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border-4 shadow-md" style={{ borderColor: design.surfaceColor, backgroundColor: design.surfaceColor, borderRadius: `${Math.min(design.cardRadius, 24)}px` }}>
              {venue.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={venue.logoUrl} alt={venue.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold" style={{ color: design.primaryColor }}>
                  {venue.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <h1 className="mt-3 font-bold tracking-tight" style={{ fontFamily: design.headingFont, fontSize: `${design.baseFontSize * design.headingScale * 1.35}px` }}>{venue.name}</h1>
          {venue.description && (
            <p className="mt-1 text-sm" style={{ color: design.mutedTextColor }}>{venue.description}</p>
          )}
          {availableLocales.length > 1 && (
            <label className="mt-4 inline-flex items-center gap-2 border px-3 py-2 text-sm font-medium shadow-sm" style={{ borderColor: hexToRgba(design.dividerColor, design.dividerOpacity), backgroundColor: design.surfaceColor, color: design.textColor, borderRadius: `${Math.min(design.cardRadius, 16)}px` }}>
              <span aria-hidden>🌐</span>
              <span className="sr-only">Menü dili</span>
              <select
                value={currentLocale}
                onChange={(event) => {
                  const url = new URL(window.location.href);
                  if (event.target.value === 'tr') url.searchParams.delete('lang');
                  else url.searchParams.set('lang', event.target.value);
                  window.location.assign(url.toString());
                }}
                className="bg-transparent pr-1 font-medium outline-none"
                aria-label="Menü dili"
              >
                {availableLocales.map((language) => (
                  <option key={language.code} value={language.code}>{language.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </header>

      {/* Yapışkan kategori sekmeleri */}
      <nav className="sticky top-0 z-20 border-b backdrop-blur" style={{ borderColor: hexToRgba(design.dividerColor, design.dividerOpacity), backgroundColor: hexToRgba(design.surfaceColor, 95) }}>
        <div
          ref={navRef}
          className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((c) => {
            const isActive = c.id === active;
            return (
              <button
                key={c.id}
                ref={(el) => {
                  tabRefs.current[c.id] = el;
                }}
                onClick={() => goTo(c.id)}
                className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition"
                style={isActive
                  ? { backgroundColor: design.primaryColor, color: design.surfaceColor }
                  : { backgroundColor: hexToRgba(design.cardColor, design.cardOpacity), color: design.mutedTextColor }}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Kategoriler + ürünler */}
      <main className="px-4">
        {categories.map((c) => {
          const isHero = Boolean(c.backgroundUrl) && c.backgroundStyle === 'hero';
          const itemList = (
            <ul style={{ display: 'grid', gridTemplateColumns: design.layout === 'two-column' ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: `${design.itemSpacing}px` }}>
              {c.items.map((it) => (
                <li key={it.id}>
                  <button
                    onClick={() => openItem(it)}
                    className={`flex w-full items-start gap-3 text-left transition ${design.layout === 'single' ? 'p-3 shadow-sm' : 'py-2'}`}
                    style={{ backgroundColor: design.layout === 'single' ? hexToRgba(design.cardColor, design.cardOpacity) : 'transparent', borderRadius: design.layout === 'single' ? `${design.cardRadius}px` : 0, borderBottom: `1px ${design.layout === 'two-column' ? 'dashed' : 'solid'} ${hexToRgba(design.dividerColor, design.dividerOpacity)}` }}
                  >
                    {it.imageUrl && design.layout === 'single' && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.imageUrl}
                        alt={it.name}
                        className="h-16 w-16 shrink-0 object-cover"
                        style={{ borderRadius: `${Math.min(design.cardRadius, 16)}px` }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-semibold" style={{ color: design.textColor }}>{it.name}</h3>
                        {it.price != null && (
                          <span className="shrink-0 font-semibold" style={{ color: design.primaryColor }}>
                            {formatPrice(it.price, venue.currency)}
                          </span>
                        )}
                      </div>
                      {it.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm" style={{ color: design.mutedTextColor }}>
                          {it.description}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {it.dietaryCodes.map((code) => (
                          <DietaryChip key={code} code={code} />
                        ))}
                        {it.calories != null && (
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                            {it.calories} kcal
                          </span>
                        )}
                        {it.allergenCodes.map((code) => (
                          <AllergenChip key={code} code={code} />
                        ))}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          );

          /** Hero: her ürün fotoğrafın üzerine kendi gri/şeffaf camsı kartıyla
           * biner — kartlar arasında boşluk bırakılır ki fotoğraf aralardan
           * görünsün (tek bir düz beyaz panel DEĞİL). Fotoğraf sabit yükseklikte
           * ve mutlak konumlu; ürünler normal akışta üstüne yığılır, taşan
           * ürünler fotoğrafın altında düz sayfa üzerinde devam eder. */
          const heroList = (
            <ul className="relative space-y-2 px-0.5 pb-1">
              {c.items.map((it) => (
                <li key={it.id}>
                  <button
                    onClick={() => openItem(it)}
                    className="flex w-full items-start gap-3 px-3.5 py-3 text-left shadow-sm backdrop-blur-[3px] transition"
                    style={{ backgroundColor: hexToRgba(design.cardColor, design.cardOpacity), borderRadius: `${design.cardRadius}px`, borderBottom: `1px solid ${hexToRgba(design.dividerColor, design.dividerOpacity)}` }}
                  >
                    {it.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.imageUrl}
                        alt={it.name}
                        className="h-14 w-14 shrink-0 rounded-xl object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-semibold" style={{ color: design.textColor }}>{it.name}</h3>
                        {it.price != null && (
                          <span className="shrink-0 font-semibold" style={{ color: design.primaryColor }}>
                            {formatPrice(it.price, venue.currency)}
                          </span>
                        )}
                      </div>
                      {it.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm" style={{ color: design.mutedTextColor }}>
                          {it.description}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {it.dietaryCodes.map((code) => (
                          <DietaryChip key={code} code={code} />
                        ))}
                        {it.calories != null && (
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: hexToRgba(design.surfaceColor, 68), color: design.textColor }}>
                            {it.calories} kcal
                          </span>
                        )}
                        {it.allergenCodes.map((code) => (
                          <AllergenChip key={code} code={code} />
                        ))}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          );

          return (
            <section
              key={c.id}
              id={`cat-${c.id}`}
              ref={(el) => {
                sectionRefs.current[c.id] = el;
              }}
              className="scroll-mt-16 pt-6"
            >
              {isHero ? (
                <div className="relative overflow-hidden rounded-2xl shadow-sm">
                  {/* Sabit (sticky) arka plan. ÖNEMLİ: resmin kendi kutusu normal
                      akışta KALIR (negatif margin YOK) — sticky'nin "durabileceği"
                      alanı, aşağıdaki içerik bloğunun kendi yüksekliğinden gelir.
                      İçerik bloğu negatif üst-margin ile fotoğrafın üzerine biner;
                      böylece resim, bu kategorinin ürünleri kaydırılırken ekranda
                      GERÇEKTEN sabit kalır (nav'ın hemen altında, top-14) ve ancak
                      bu bölümün sonuna gelinince bırakılır. `active` (scroll-spy)
                      state'i üzerinden opacity geçişiyle bir sonraki kategorinin
                      fotoğrafına yumuşak (crossfade) geçilir. */}
                  <div className="absolute inset-0" aria-hidden>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.backgroundUrl!}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/35" />
                  </div>
                  <div className="relative z-10 p-3">
                    <div className="px-1 pb-4 pt-3 text-center">
                      <h2 className="text-xl font-bold uppercase tracking-wide text-white drop-shadow-lg sm:text-2xl" style={{ fontFamily: design.headingFont }}>
                        {c.name}
                      </h2>
                      <span className="mx-auto mt-1.5 block h-0.5 w-10 bg-white/70" />
                    </div>
                    {heroList}
                  </div>
                </div>
              ) : c.backgroundUrl ? (
                <>
                  <div className="relative mb-3 h-28 overflow-hidden rounded-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.backgroundUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <h2 className="absolute bottom-2 left-3 text-xl font-bold text-white drop-shadow-md" style={{ fontFamily: design.headingFont }}>
                      {c.name}
                    </h2>
                  </div>
                  {itemList}
                </>
              ) : (
                <div className={design.layout === 'two-column' ? 'p-3 shadow-sm' : ''} style={design.layout === 'two-column' ? { backgroundColor: hexToRgba(design.cardColor, design.cardOpacity), borderRadius: `${design.cardRadius}px` } : undefined}>
                  <h2 className="mb-2 px-1 font-bold" style={{ color: design.textColor, fontFamily: design.headingFont, fontSize: `${design.baseFontSize * design.headingScale}px` }}>{c.name}</h2>
                  {itemList}
                </div>
              )}
            </section>
          );
        })}
      </main>

      <ContactFooter venue={venue} />

      {selected && (
        <ItemModal item={selected} currency={venue.currency} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function DietaryChip({ code }: { code: string }) {
  const d = (DIETARY as Record<string, { tr: string; emoji: string } | undefined>)[code];
  if (!d) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <span aria-hidden>{d.emoji}</span>
      {d.tr}
    </span>
  );
}

function AllergenChip({ code }: { code: string }) {
  const a = (ALLERGENS as Record<string, { tr: string; abbr: string } | undefined>)[code];
  if (!a) return null;
  return (
    <span
      title={a.tr}
      className="rounded-full border border-stone-200 px-2 py-0.5 text-xs font-medium text-stone-400"
    >
      {a.abbr}
    </span>
  );
}

function ItemModal({
  item,
  currency,
  onClose,
}: {
  item: GuestItem;
  currency: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
    >
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="h-52 w-full object-cover" />
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-bold text-stone-900">{item.name}</h2>
            <button
              onClick={onClose}
              aria-label="Kapat"
              className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200"
            >
              ✕
            </button>
          </div>

          {item.price != null && (
            <p className="mt-1 text-lg font-semibold text-brand-700">
              {formatPrice(item.price, currency)}
            </p>
          )}

          {item.dietaryCodes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.dietaryCodes.map((code) => (
                <DietaryChip key={code} code={code} />
              ))}
            </div>
          )}

          {item.description && (
            <p className="mt-3 text-sm leading-relaxed text-stone-600">{item.description}</p>
          )}

          {item.ingredients && (
            <ModalSection title="İÇİNDEKİLER">
              <p className="text-sm leading-relaxed text-stone-600">{item.ingredients}</p>
            </ModalSection>
          )}

          {item.calories != null && (
            <ModalSection title="KALORİ (PORSİYON)">
              <p className="text-sm font-medium text-stone-700">{item.calories} kcal</p>
            </ModalSection>
          )}

          {item.allergenCodes.length > 0 && (
            <ModalSection title="ALERJENLER">
              <div className="flex flex-wrap gap-1.5">
                {item.allergenCodes.map((code) => {
                  const a = (ALLERGENS as Record<string, { tr: string } | undefined>)[code];
                  return (
                    <span
                      key={code}
                      className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600"
                    >
                      {a?.tr ?? code}
                    </span>
                  );
                })}
              </div>
            </ModalSection>
          )}

          <p className="mt-5 border-t border-stone-100 pt-3 text-xs leading-relaxed text-stone-400">
            Alerjen ve diyet bilgileri işletme beyanına dayanır. Ağır alerjiniz varsa lütfen
            personele danışın.
          </p>
        </div>
      </div>
    </div>
  );
}

function ModalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-400">{title}</h3>
      {children}
    </div>
  );
}

function ContactFooter({ venue }: { venue: GuestVenue }) {
  const waDigits = venue.whatsapp?.replace(/[^\d]/g, '') || null;
  const igHandle = venue.instagram
    ? venue.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
    : null;

  const rows = useMemo(
    () =>
      [
        venue.address && {
          label: 'Adres',
          value: venue.address,
          href: venue.googleMapsUrl ?? undefined,
        },
        venue.openingHours && { label: 'Çalışma saatleri', value: venue.openingHours },
        venue.phone && { label: 'Telefon', value: venue.phone, href: `tel:${venue.phone.replace(/\s/g, '')}` },
        waDigits && { label: 'WhatsApp', value: venue.whatsapp!, href: `https://wa.me/${waDigits}` },
        igHandle && { label: 'Instagram', value: `@${igHandle}`, href: `https://instagram.com/${igHandle}` },
        venue.wifiSsid && { label: 'Wi-Fi', value: venue.wifiSsid },
      ].filter(Boolean) as { label: string; value: string; href?: string }[],
    [venue, waDigits, igHandle]
  );

  return (
    <footer className="mt-8 border-t px-5 py-6" style={{ borderColor: hexToRgba(venue.design.dividerColor, venue.design.dividerOpacity), backgroundColor: hexToRgba(venue.design.surfaceColor, 75) }}>
      {rows.length > 0 && (
        <dl className="space-y-3">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: venue.design.mutedTextColor }}>
                {r.label}
              </dt>
              <dd className="text-sm" style={{ color: venue.design.textColor }}>
                {r.href ? (
                  <a
                    href={r.href}
                    target={r.href.startsWith('http') ? '_blank' : undefined}
                    rel="noreferrer"
                    className="underline-offset-2 hover:underline"
                    style={{ color: venue.design.primaryColor }}
                  >
                    {r.value}
                  </a>
                ) : (
                  r.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {venue.showBadge && (
        <p className="mt-6 text-center text-xs text-stone-300">
          RestaurantOS ile hazırlandı
        </p>
      )}
    </footer>
  );
}
