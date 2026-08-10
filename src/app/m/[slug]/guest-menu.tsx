'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ALLERGENS } from '@/lib/allergens';
import { DIETARY } from '@/lib/dietary';
import { formatPrice } from '@/lib/currency';
import { hexToRgba, menuBackgroundStyle, normalizeMenuDesign, type MenuDesignSettings } from '@/lib/themes';
import { Sheet } from '@/components/ui/sheet';
import { Pressable } from '@/components/ui/pressable';

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
  /** Görselin dikey kadrajı: 0 = üst, 50 = orta (varsayılan), 100 = alt. */
  backgroundPositionY: number;
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

/**
 * Ardışık 'hero' arka planlı kategorileri tek bir grupta toplar. Her grup TEK
 * bir sticky arka plan katmanı paylaşır — böylece kategoriler arası geçişte
 * fotoğraf asla yer değiştirmez, yalnızca crossfade ile bir sonrakine geçer.
 * (Önceki tasarımda her kategorinin KENDİ sticky'si vardı; bir kategoriden
 * diğerine geçerken biri "unstick" olup diğeri "stick" olduğu için görsel
 * önce kayıyor sonra kayboluyordu.)
 */
type CategoryGroup =
  | { kind: 'plain'; category: GuestCategory }
  | { kind: 'hero'; categories: GuestCategory[] };

function isHeroCategory(c: GuestCategory): boolean {
  return Boolean(c.backgroundUrl) && c.backgroundStyle === 'hero';
}

function groupCategories(categories: GuestCategory[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  for (const c of categories) {
    const last = groups[groups.length - 1];
    if (isHeroCategory(c)) {
      if (last?.kind === 'hero') last.categories.push(c);
      else groups.push({ kind: 'hero', categories: [c] });
    } else {
      groups.push({ kind: 'plain', category: c });
    }
  }
  return groups;
}

export function GuestMenu({
  venue: initialVenue,
  categories: initialCategories,
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
  // Tasarım Stüdyosu'ndaki VE Görseller sayfasındaki maket bu bileşeni
  // YALNIZCA bir kez (ilk yüklemede) yükler; sonraki her değişiklik tam
  // sayfa yeniden yükleme yerine postMessage ile buraya iletilir ve
  // doğrudan bu state'leri günceller — network/DB round-trip olmadığı için
  // anında yansır. (bkz. studyo/tasarim/design-studio.tsx ve
  // studyo/gorseller/image-manager.tsx → LivePreview)
  const [design, setDesign] = useState<MenuDesignSettings>(initialVenue.design);
  const venue = useMemo(() => ({ ...initialVenue, design }), [initialVenue, design]);
  const [categories, setCategories] = useState<GuestCategory[]>(initialCategories);

  useEffect(() => {
    function handlePreviewMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!event.data) return;
      if (event.data.type === 'ros:design-preview') {
        setDesign(normalizeMenuDesign(event.data.design));
        return;
      }
      if (event.data.type === 'ros:categories-preview') {
        const overrides = event.data.categories as {
          id: string;
          backgroundUrl?: string | null;
          backgroundStyle?: 'strip' | 'hero';
          backgroundPositionY?: number;
          items?: { id: string; imageUrl: string | null }[];
        }[];
        setCategories((current) =>
          current.map((c) => {
            const o = overrides.find((x) => x.id === c.id);
            if (!o) return c;
            return {
              ...c,
              backgroundUrl: o.backgroundUrl !== undefined ? o.backgroundUrl : c.backgroundUrl,
              backgroundStyle: o.backgroundStyle ?? c.backgroundStyle,
              backgroundPositionY: o.backgroundPositionY ?? c.backgroundPositionY,
              items: o.items
                ? c.items.map((it) => {
                    const io = o.items!.find((x) => x.id === it.id);
                    return io ? { ...it, imageUrl: io.imageUrl } : it;
                  })
                : c.items,
            };
          })
        );
      }
    }
    window.addEventListener('message', handlePreviewMessage);
    return () => window.removeEventListener('message', handlePreviewMessage);
  }, []);

  const [active, setActive] = useState(categories[0]?.id ?? '');
  const [selected, setSelected] = useState<GuestItem | null>(null);
  const [categoryListOpen, setCategoryListOpen] = useState(false);
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
      <header className="relative z-30" style={{ backgroundColor: design.surfaceColor }}>
        <div
          className="h-40 w-full bg-cover bg-center sm:rounded-t-2xl"
          style={venue.coverUrl ? { backgroundImage: `url(${venue.coverUrl})` } : { background: `linear-gradient(135deg, ${design.primaryColor}, ${design.accentColor})` }}
        />
        <div className="px-5 pt-4 pb-4">
          <h1 className="font-bold tracking-tight" style={{ fontFamily: design.headingFont, fontSize: `${design.baseFontSize * design.headingScale * 1.35}px` }}>{venue.name}</h1>
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
        <div className="flex items-center gap-1 px-3 py-2">
          <div
            ref={navRef}
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
          {categories.map((c) => {
            const isActive = c.id === active;
            return (
              <Pressable
                key={c.id}
                ref={(el) => {
                  tabRefs.current[c.id] = el;
                }}
                onClick={() => goTo(c.id)}
                className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium"
                style={isActive
                  ? { backgroundColor: design.primaryColor, color: design.surfaceColor }
                  : { backgroundColor: hexToRgba(design.cardColor, design.cardOpacity), color: design.mutedTextColor }}
              >
                {c.name}
              </Pressable>
            );
          })}
          </div>
          {/* Uzun menülerde yatay şerit yetmiyor: 28 kategorili bir menüde
              misafir "Kırmızı Şarap"a ulaşmak için uzun uzun kaydırıyordu.
              8'den fazla kategori varsa tam listeyi açan bir düğme çıkar. */}
          {categories.length > 8 && (
            <Pressable
              type="button"
              onClick={() => setCategoryListOpen(true)}
              aria-label="Tüm kategoriler"
              className="shrink-0 rounded-full px-2.5 py-1.5 text-sm font-medium"
              style={{ backgroundColor: hexToRgba(design.cardColor, design.cardOpacity), color: design.textColor }}
            >
              ☰
            </Pressable>
          )}
        </div>
      </nav>

      {categoryListOpen && (
        <CategoryListSheet
          categories={categories}
          design={design}
          activeId={active}
          onPick={(id) => {
            setCategoryListOpen(false);
            goTo(id);
          }}
          onClose={() => setCategoryListOpen(false)}
        />
      )}

      {/* Kategoriler + ürünler */}
      <main className="px-4">
        {groupCategories(categories).map((group) => {
          if (group.kind === 'plain') {
            const c = group.category;
            const itemList = (
              <ul style={{ display: 'grid', gridTemplateColumns: design.layout === 'two-column' ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: `${design.itemSpacing}px` }}>
                {c.items.map((it) => (
                  <li key={it.id}>
                    <Pressable
                      variant="dim"
                      onClick={() => openItem(it)}
                      className={`flex w-full items-start gap-3 text-left ${design.layout === 'single' ? 'p-3 shadow-sm' : 'py-2'}`}
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
                    </Pressable>
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
                <CategoryFrame design={design}>
                  <CategoryStrip
                    name={c.name}
                    design={design}
                    backgroundUrl={c.backgroundStyle === 'strip' ? c.backgroundUrl : null}
                    positionY={c.backgroundPositionY}
                  />
                  <div className="p-3">{itemList}</div>
                </CategoryFrame>
              </section>
            );
          }

          /**
           * Hero grubu: ardışık tüm 'hero' kategoriler TEK bir sticky fotoğraf
           * katmanını paylaşır. Katman `top-[50vh] -translate-y-1/2` ile ekranın
           * DİKEY ORTASINDA sabitlenir (eskiden nav'ın hemen altındaydı) — grup
           * içinde hangi kategori arasında geçiş yapılırsa yapılsın resim yer
           * değiştirmez, yalnızca aktif kategoriye göre crossfade (yumuşak
           * opaklık geçişi) ile bir sonraki fotoğrafa geçer. Yükseklik eski
           * h-72/h-80'den %40 artırıldı (25.2rem/28rem). Alttaki içerik bloğu
           * bu yüksekliğe eşit negatif üst boşlukla (-mt) yukarı çekilir; ilk
           * kategorinin ürünleri kendi camsı kartlarıyla fotoğrafın üzerine biner.
           */
          const cats = group.categories;
          return (
            <div key={`hero-${cats[0].id}`} className="relative">
              <div className="sticky top-[50vh] z-0 h-[25.2rem] -translate-y-1/2 overflow-hidden rounded-2xl sm:h-[28rem]" aria-hidden>
                {cats.map((c) => (
                  <div
                    key={c.id}
                    className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                      c.id === active ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.backgroundUrl!}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-90"
                      style={{ objectPosition: `center ${c.backgroundPositionY}%` }}
                    />
                    <div className="absolute inset-0 bg-black/20" />
                  </div>
                ))}
              </div>
              <div className="relative z-10 -mt-[25.2rem] sm:-mt-[28rem]">
                {cats.map((c, index) => {
                  const heroList = (
                    <ul className="relative flex flex-col px-0.5 pb-1" style={{ gap: `${design.itemSpacing}px` }}>
                      {c.items.map((it) => (
                        <li key={it.id}>
                          <Pressable
                            variant="dim"
                            onClick={() => openItem(it)}
                            className="flex w-full items-start gap-3 px-3.5 py-3 text-left shadow-sm backdrop-blur-[3px]"
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
                          </Pressable>
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
                      className={index === 0 ? 'scroll-mt-16 pt-28 sm:pt-32' : 'scroll-mt-16 pt-6'}
                    >
                      <CategoryFrame design={design}>
                        <CategoryStrip name={c.name} design={design} />
                        <div className="p-3">{heroList}</div>
                      </CategoryFrame>
                    </section>
                  );
                })}
              </div>
            </div>
          );
        })}
      </main>

      <ContactFooter venue={venue} />

      {selected && (
        <ItemModal
          item={selected}
          currency={venue.currency}
          design={design}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/**
 * Kategori adının her zaman göründüğü, ortalanmış şerit alanı. Ürün grubu
 * geçişlerinde konumu hep aynıdır: bir arka plan görseli varsa (yalnızca
 * 'strip' stilinde) onun üzerine biner; yoksa (ya da 'hero' stilinde —
 * o zaman büyük görsel ayrı, sabit bir alanda gösterilir) düz temalı bir
 * çubuk olarak kalır. Metin her koşulda şeridin tam ortasındadır.
 */
function CategoryStrip({
  name,
  design,
  backgroundUrl,
  positionY = 50,
}: {
  name: string;
  design: MenuDesignSettings;
  backgroundUrl?: string | null;
  positionY?: number;
}) {
  if (backgroundUrl) {
    return (
      <div className="relative h-28 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backgroundUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: `center ${positionY}%` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/25 to-black/25" />
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
          <h2 className="text-xl font-bold text-white drop-shadow-md" style={{ fontFamily: design.headingFont }}>
            {name}
          </h2>
        </div>
      </div>
    );
  }
  // Görselsiz şerit: markanın ana rengiyle dolu, kontrastlı yazılı belirgin
  // bir bant — arka plandaki kart/sayfa renkleriyle karışıp kaybolmasın diye.
  return (
    <div className="flex h-12 items-center justify-center px-4 text-center" style={{ backgroundColor: design.primaryColor }}>
      <h2
        className="font-bold uppercase"
        style={{ color: design.surfaceColor, fontFamily: design.headingFont, fontSize: `${design.baseFontSize * design.headingScale * 0.85}px`, letterSpacing: '0.03em' }}
      >
        {name}
      </h2>
    </div>
  );
}

/** Her kategoriyi (şerit + ürün listesi) şık, çerçeveli tek bir kart olarak
 * gruplar — kategoriler arası geçiş net görünsün diye kenarlık + gölge kullanılır. */
function CategoryFrame({ design, children }: { design: MenuDesignSettings; children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border-2 bg-transparent shadow-sm"
      style={{ borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 55)) }}
    >
      {children}
    </div>
  );
}

/**
 * Uzun menüler için kategori listesi. Yatay şerit 20+ kategoride kullanışsız
 * kalıyor; burada hepsi tek ekranda, aranabilir şekilde listelenir.
 */
function CategoryListSheet({
  categories,
  design,
  activeId,
  onPick,
  onClose,
}: {
  categories: GuestCategory[];
  design: MenuDesignSettings;
  activeId: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  const needle = query.trim().toLocaleLowerCase('tr');
  const shown = needle
    ? categories.filter((c) => c.name.toLocaleLowerCase('tr').includes(needle))
    : categories;

  // Esc, odak tuzağı, odağı ☰ düğmesine geri verme ve sürükleyip kapatma
  // artık ortak Sheet'te (bkz. components/ui/sheet.tsx).
  return (
    <Sheet
      open
      onClose={onClose}
      label="Kategoriler"
      placement="bottom"
      panelClassName="ros-draggable flex max-h-[80vh] w-full max-w-lg flex-col rounded-t-3xl shadow-2xl sm:rounded-3xl"
      // Sabit beyaz yerine menünün kendi yüzey rengi — koyu/markalı
      // tasarımlarda pencere artık menüden görsel olarak kopmuyor.
      panelStyle={{ backgroundColor: design.surfaceColor, color: design.textColor }}
    >
      <>
        <div
          className="flex items-center gap-3 border-b p-4"
          style={{ borderColor: hexToRgba(design.dividerColor, design.dividerOpacity) }}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kategori ara…"
            aria-label="Kategori ara"
            className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-base outline-none"
            style={{
              borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 60)),
              backgroundColor: hexToRgba(design.cardColor, design.cardOpacity),
              color: design.textColor,
            }}
          />
          <Pressable
            onClick={onClose}
            aria-label="Kapat"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: hexToRgba(design.cardColor, design.cardOpacity),
              color: design.mutedTextColor,
            }}
          >
            ✕
          </Pressable>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {shown.map((c) => (
            <li key={c.id}>
              <Pressable
                variant="dim"
                onClick={() => onPick(c.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-base ${
                  c.id === activeId ? 'font-semibold' : ''
                }`}
                style={c.id === activeId ? { color: design.primaryColor } : { color: design.textColor }}
              >
                <span className="min-w-0 truncate">{c.name}</span>
                <span className="shrink-0 text-xs" style={{ color: design.mutedTextColor }}>
                  {c.items.length}
                </span>
              </Pressable>
            </li>
          ))}
          {shown.length === 0 && (
            <li className="px-3 py-6 text-center text-sm" style={{ color: design.mutedTextColor }}>
              Eşleşen kategori yok.
            </li>
          )}
        </ul>
      </>
    </Sheet>
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

/**
 * Ürün detayı. Artık ortak `Sheet` kullanıyor: aşağı sürükleyerek kapanır,
 * kapanırken yakalanıp geri çekilebilir, bırakma hızı yayı besler. Esc, odak
 * tuzağı ve odağı geri verme Sheet'in içinde (bkz. components/ui/sheet.tsx).
 */
function ItemModal({
  item,
  currency,
  design,
  onClose,
}: {
  item: GuestItem;
  currency: string;
  design: MenuDesignSettings;
  onClose: () => void;
}) {
  return (
    <Sheet
      open
      onClose={onClose}
      label={item.name}
      placement="bottom"
      panelClassName="ros-draggable max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl shadow-2xl sm:rounded-3xl"
      panelStyle={{ backgroundColor: design.surfaceColor, color: design.textColor }}
    >
      <div>
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="h-52 w-full object-cover" />
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-bold" style={{ fontFamily: design.headingFont }}>
              {item.name}
            </h2>
            <Pressable
              onClick={onClose}
              aria-label="Kapat"
              className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: hexToRgba(design.cardColor, design.cardOpacity),
                color: design.mutedTextColor,
              }}
            >
              ✕
            </Pressable>
          </div>

          {item.price != null && (
            <p className="mt-1 text-lg font-semibold" style={{ color: design.primaryColor }}>
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
            <p className="mt-3 text-sm leading-relaxed" style={{ color: design.mutedTextColor }}>
              {item.description}
            </p>
          )}

          {item.ingredients && (
            <ModalSection title="İÇİNDEKİLER" design={design}>
              <p className="text-sm leading-relaxed" style={{ color: design.mutedTextColor }}>
                {item.ingredients}
              </p>
            </ModalSection>
          )}

          {item.calories != null && (
            <ModalSection title="KALORİ (PORSİYON)" design={design}>
              <p className="text-sm font-medium">{item.calories} kcal</p>
            </ModalSection>
          )}

          {item.allergenCodes.length > 0 && (
            <ModalSection title="ALERJENLER" design={design}>
              <div className="flex flex-wrap gap-1.5">
                {item.allergenCodes.map((code) => {
                  const a = (ALLERGENS as Record<string, { tr: string } | undefined>)[code];
                  return (
                    <span
                      key={code}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium"
                      style={{ backgroundColor: hexToRgba(design.cardColor, design.cardOpacity) }}
                    >
                      {a?.tr ?? code}
                    </span>
                  );
                })}
              </div>
            </ModalSection>
          )}

          <p
            className="mt-5 border-t pt-3 text-xs leading-relaxed"
            style={{
              borderColor: hexToRgba(design.dividerColor, design.dividerOpacity),
              color: design.mutedTextColor,
            }}
          >
            Alerjen ve diyet bilgileri işletme beyanına dayanır. Ağır alerjiniz varsa lütfen
            personele danışın.
          </p>
        </div>
      </div>
    </Sheet>
  );
}

function ModalSection({
  title,
  design,
  children,
}: {
  title: string;
  design: MenuDesignSettings;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <h3
        className="mb-1.5 text-xs font-bold uppercase tracking-wide"
        style={{ color: design.mutedTextColor }}
      >
        {title}
      </h3>
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
