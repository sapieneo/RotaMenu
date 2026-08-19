'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ALLERGENS } from '@/lib/allergens';
import { DIETARY } from '@/lib/dietary';
import { formatPrice } from '@/lib/currency';
import { hexToRgba, menuBackgroundStyle, normalizeMenuDesign, type MenuDesignSettings } from '@/lib/themes';
import { Sheet } from '@/components/ui/sheet';
import { Pressable } from '@/components/ui/pressable';

/**
 * Misafir menüsünün ARAYÜZ metinleri.
 *
 * Menü içeriği (ürün adı, açıklama, kategori) `item_translations` /
 * `category_translations` tablolarından geliyordu; ama "9 ürün", "Alerjen
 * filtreleri", "Tümü" gibi arayüz metinleri koda gömülüydü ve İngilizce
 * menüde bile Türkçe kalıyordu. Yabancı misafir için menünün yarısı çevrilmiş
 * gibi görünüyordu. Türkçe dışındaki tüm diller İngilizce'ye düşer — Rusça
 * ya da Arapça arayüz istenirse buraya bir anahtar eklemek yeterli.
 */
type UiStrings = {
  mainMenus: string;
  digitalMenu: string;
  itemsAndCategories: (items: number, categories: number) => string;
  itemCount: (n: number) => string;
  searchPlaceholder: (menuName: string) => string;
  searchLabel: string;
  clearSearch: string;
  all: string;
  allCategories: string;
  categories: string;
  noCategoryMatch: string;
  allergenFilters: string;
  hideContaining: string;
  hidden: string;
  chefPicks: string;
  chefPick: string;
  chefPicksNote: string;
  noItemsForFilters: string;
  noSearchResults: (query: string) => string;
  allergensUnverified: string;
  allergensUnverifiedLong: string;
  noDeclaredAllergens: string;
  terms: string;
  ingredients: string;
  caloriesPerServing: string;
  allergens: string;
  allergenDisclaimer: string;
  seeMenu: string;
  seeChefPicks: string;
  continueToMenu: string;
  preparingMenu: string;
  imagePending: string;
  menuLanguage: string;
  close: string;
  notPublished: string;
  menuBeingPrepared: string;
  preparedWith: string;
  address: string;
  openingHours: string;
  phone: string;
  wifi: string;
};

const UI_TR: UiStrings = {
  mainMenus: 'Ana menüler:',
  digitalMenu: 'Dijital menü',
  itemsAndCategories: (i, c) => `${i} ürün · ${c} kategori`,
  itemCount: (n) => `${n} ürün`,
  searchPlaceholder: (m) => `${m} menüsünde lezzet ara…`,
  searchLabel: 'Menüde ara',
  clearSearch: 'Aramayı temizle',
  all: 'Tümü',
  allCategories: 'Tüm kategoriler',
  categories: 'Kategoriler',
  noCategoryMatch: 'Eşleşen kategori yok.',
  allergenFilters: 'Alerjen filtreleri',
  hideContaining: '— içerenleri gizle',
  hidden: '— gizli',
  chefPicks: 'Şefin Seçtikleri',
  chefPick: 'Şef Seçimi',
  chefPicksNote: 'Bugün için özenle seçildi',
  noItemsForFilters: 'Seçili alerjen filtreleriyle eşleşen ürün yok.',
  noSearchResults: (q) => `“${q}” için sonuç bulunamadı.`,
  allergensUnverified: 'Alerjen bilgisi doğrulanmadı',
  allergensUnverifiedLong:
    '⚠ Bu ürünün alerjen bilgisi henüz doğrulanmadı. Lütfen sipariş sırasında personele danışın.',
  noDeclaredAllergens: 'İşletme beyanına göre bildirilmesi gereken alerjen içermiyor.',
  terms: 'Bilgilendirme & Şartlar',
  ingredients: 'İÇİNDEKİLER',
  caloriesPerServing: 'KALORİ (PORSİYON)',
  allergens: 'ALERJENLER',
  allergenDisclaimer:
    'Alerjen ve diyet bilgileri işletme beyanına dayanır. Ağır alerjiniz varsa lütfen personele danışın.',
  seeMenu: 'Menüyü gör',
  seeChefPicks: 'Şefin önerilerini gör',
  continueToMenu: 'Menüye devam et',
  preparingMenu: 'Menü hazırlanıyor…',
  imagePending: 'Görsel hazırlanıyor',
  menuLanguage: 'Menü dili',
  close: 'Kapat',
  notPublished: 'Önizleme — bu menü henüz yayınlanmadı. Yalnızca siz görüyorsunuz.',
  menuBeingPrepared: 'Menü henüz hazırlanıyor. Kısa süre sonra tekrar deneyin.',
  preparedWith: 'Rotamenu ile hazırlandı',
  address: 'Adres',
  openingHours: 'Çalışma saatleri',
  phone: 'Telefon',
  wifi: 'Wi-Fi',
};

const UI_EN: UiStrings = {
  mainMenus: 'Main menus:',
  digitalMenu: 'Digital menu',
  itemsAndCategories: (i, c) => `${i} items · ${c} categories`,
  itemCount: (n) => `${n} items`,
  searchPlaceholder: (m) => `Search the ${m} menu…`,
  searchLabel: 'Search the menu',
  clearSearch: 'Clear search',
  all: 'All',
  allCategories: 'All categories',
  categories: 'Categories',
  noCategoryMatch: 'No matching category.',
  allergenFilters: 'Allergen filters',
  hideContaining: '— hide items with this',
  hidden: '— hidden',
  chefPicks: "Chef's Picks",
  chefPick: "Chef's Pick",
  chefPicksNote: 'Specially selected for today',
  noItemsForFilters: 'No items match the selected allergen filters.',
  noSearchResults: (q) => `No results for “${q}”.`,
  allergensUnverified: 'Allergen info not verified',
  allergensUnverifiedLong:
    '⚠ Allergen information for this item has not been verified yet. Please ask our staff when ordering.',
  noDeclaredAllergens: 'Contains no allergens that require declaration, per the venue.',
  terms: 'Information & Terms',
  ingredients: 'INGREDIENTS',
  caloriesPerServing: 'CALORIES (PER SERVING)',
  allergens: 'ALLERGENS',
  allergenDisclaimer:
    'Allergen and dietary information is based on the venue’s declaration. If you have a severe allergy, please ask our staff.',
  seeMenu: 'View menu',
  seeChefPicks: "See the chef's selections",
  continueToMenu: 'Continue to menu',
  preparingMenu: 'Preparing menu…',
  imagePending: 'Image coming soon',
  menuLanguage: 'Menu language',
  close: 'Close',
  notPublished: 'Preview — this menu is not published yet. Only you can see it.',
  menuBeingPrepared: 'The menu is still being prepared. Please try again shortly.',
  preparedWith: 'Made with Rotamenu',
  address: 'Address',
  openingHours: 'Opening hours',
  phone: 'Phone',
  wifi: 'Wi-Fi',
};

/** Türkçe dışındaki her dil İngilizce arayüze düşer. */
function uiStrings(locale: string): UiStrings {
  return locale === 'tr' ? UI_TR : UI_EN;
}

/** Alerjen adı — seçili dile göre. */
function allergenLabel(code: string, locale: string): string {
  const a = (ALLERGENS as Record<string, { tr: string; en: string } | undefined>)[code];
  if (!a) return code;
  return locale === 'tr' ? a.tr : a.en;
}

export type GuestItem = {
  id: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  price: number | null;
  calories: number | null;
  imageUrl: string | null;
  allergenCodes: string[];
  /**
   * Alerjen incelemesi işletme tarafından ONAYLANDI mı? false ise kartta
   * "⚠ Alerjen bilgisi doğrulanmadı" uyarısı gösterilir — boş bir
   * `allergenCodes` listesi "alerjen yok" anlamına gelmez, "henüz kontrol
   * edilmedi" de olabilir (misafire RLS yalnız onaylı satırları verir).
   */
  allergensReviewed: boolean;
  dietaryCodes: string[];
  /** Stüdyo'da "Şefin Seçtikleri"ne eklenmiş mi — menünün üstünde öne çıkan şeritte gösterilir. */
  isFeatured: boolean;
};

export type GuestCategory = {
  id: string;
  /** Hangi menüye ait (bkz. `menus` tablosu). Çoklu menü şeridi bununla filtreler. */
  menuId: string;
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
  /** Ücretsiz planda "Rotamenu ile hazırlandı" rozeti gösterilir. */
  showBadge: boolean;
  design: MenuDesignSettings;
  /** Karşılama/promosyon popup'ı (Stüdyo → Ayarlar). Başlık yoksa null. */
  announcement: GuestAnnouncement | null;
  /** Alt bilgi / marka hikayesi bloğu — footer'dan önce gösterilir. Boşsa null. */
  story: string | null;
};

export type GuestAnnouncement = {
  title: string;
  body: string | null;
  imageUrl: string | null;
  buttonText: string | null;
};

/**
 * Bir venue'nun birden fazla aktif menüsü olduğunda ("Restoran Menüsü",
 * "Şarap Menüsü" gibi) üst şeritte gösterilen sekme. Venue'de tek menü
 * varsa bu liste tek elemanlıdır ve şerit hiç render edilmez — tek-menü
 * davranışı birebir korunur.
 */
export type GuestMenuSummary = {
  id: string;
  name: string;
  icon: string | null;
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

/**
 * RotaMenu referansındaki kartlar saf gri gölge yerine markanın rengine hafif
 * tonlanmış bir gölge kullanıyor (ör. `rgba(0,50,38,.06) 0 8px 24px`) — bu,
 * Tailwind'in düz `shadow-sm`'inden daha "tasarlanmış" hissettiriyor.
 * Aynı efekti burada primaryColor'dan türetiyoruz, ekstra ayar gerektirmez.
 */
function tintedShadow(design: MenuDesignSettings): string {
  return `${hexToRgba(design.primaryColor, 10)} 0 6px 18px`;
}

/**
 * Ürün görseli — görsel YOKSA referanstaki gibi boş gri kare yerine
 * "hazırlanıyor" maketi çizilir: markanın renginde ince çizgili bir kapak
 * (cloche) ikonu, altında ürünün adı ve küçük bir "GÖRSEL HAZIRLANIYOR"
 * notu. Menü görselsizken bile profesyonel ve dolu görünür.
 */
function ItemThumb({
  item,
  design,
  className,
  showCaption = false,
  t,
}: {
  item: GuestItem;
  design: MenuDesignSettings;
  className?: string;
  t: UiStrings;
  /** Büyük kartlarda (Şefin Seçtikleri) ürün adı + "hazırlanıyor" notu da yazılır. */
  showCaption?: boolean;
}) {
  if (item.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.imageUrl} alt={item.name} className={`object-cover ${className ?? ''}`} />;
  }
  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden px-2 text-center ${className ?? ''}`}
      style={{ backgroundColor: hexToRgba(design.primaryColor, 8) }}
      aria-hidden
    >
      {/* Dekoratif köşe yuvarlağı — referanstaki hafif "daire" dokusu */}
      <span
        className="absolute -left-4 -top-4 h-14 w-14 rounded-full"
        style={{ backgroundColor: hexToRgba(design.primaryColor, 7) }}
      />
      <svg viewBox="0 0 48 32" className="relative w-[62%] max-w-[70px]" fill="none" stroke={hexToRgba(design.primaryColor, 55)} strokeWidth="1.6" strokeLinecap="round">
        <path d="M4 27h40" />
        <path d="M7 27a17 17 0 0 1 34 0" />
        <path d="M24 10V6" />
        <circle cx="24" cy="4.5" r="1.8" />
      </svg>
      {showCaption && (
        <>
          <span
            className="relative mt-1.5 line-clamp-2 text-[10px] font-bold uppercase leading-tight"
            style={{ fontFamily: design.headingFont, color: hexToRgba(design.textColor, 70) }}
          >
            {item.name}
          </span>
          <span
            className="relative mt-1 text-[7px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: hexToRgba(design.textColor, 40) }}
          >
            {t.imagePending}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Ürün kartının altındaki alerjen satırı — referanstaki davranışın aynısı:
 * inceleme onaylanmışsa alerjenler çip olarak listelenir (alerjen yoksa hiç
 * bir şey yazılmaz), onaylanmamışsa tek bir uyarı çipi çıkar.
 */
function AllergenLine({ item, design, t, locale }: { item: GuestItem; design: MenuDesignSettings; t: UiStrings; locale: string }) {
  if (!item.allergensReviewed) {
    return (
      <span
        className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
        style={{ backgroundColor: hexToRgba(design.dividerColor, 28), color: design.mutedTextColor }}
      >
        <span aria-hidden>⚠</span> {t.allergensUnverified}
      </span>
    );
  }
  if (item.allergenCodes.length === 0) return null;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {item.allergenCodes.map((code) => (
        <span
          key={code}
          className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: hexToRgba(design.primaryColor, 10), color: design.primaryColor }}
        >
          {allergenLabel(code, locale)}
        </span>
      ))}
    </span>
  );
}

/**
 * Kategori arka plan görselleri bu tasarımda KULLANILMIYOR.
 *
 * Referans menüde kategoriler düz, editoryal başlıklarla ayrılıyor; araya
 * giren büyük fotoğraf şeritleri hem okumayı bölüyor hem de her kategoriye
 * uygun görsel bulunamadığında menüyü ucuz gösteriyordu. Bu yüzden hem
 * 'hero' (tam boy) hem 'strip' (şerit) yolları kapatıldı — ilgili kod
 * (CategoryStrip'in görselli dalı, hero gruplama) ileride geri açılmak
 * istenirse diye duruyor, ama artık hiç çalışmıyor.
 */
function isHeroCategory(_c: GuestCategory): boolean {
  return false;
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
  menus = [],
  venueId,
  availableLocales,
  currentLocale,
}: {
  venue: GuestVenue;
  categories: GuestCategory[];
  menus?: GuestMenuSummary[];
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
  /**
   * Dil değişimi.
   *
   * DİKKAT — burada iki kez tökezlendi, ikisini de tekrarlamayalım:
   *   1. Bağlantı adresi `window` üzerinden üretiliyordu; sunucuda `window`
   *      olmadığı için ilk çizimde adres boş ('#') kalıyor, sayfa
   *      hidrasyonu bitmeden yapılan tıklama hiçbir şey yapmıyordu.
   *   2. Sonra `router.push` (istemci tarafı geçiş) denendi: adres değişti
   *      ama Next'in yönlendirici önbelleği aynı rotayı sunucudan yeniden
   *      çekmediği için İÇERİK Türkçe kaldı — yani dil hiç değişmedi.
   *
   * Çeviriler sunucuda seçiliyor (bkz. m/[slug]/page.tsx → searchParams.lang),
   * bu yüzden tam gezinme yapıyoruz: her zaman doğru sonuç verir. Anında
   * geçiş istenirse tüm dillerin çevirilerini istemciye baştan göndermek
   * gerekir — ayrı ve daha büyük bir iş.
   */
  function switchLocale(code: string) {
    const params = new URLSearchParams(window.location.search);
    if (code === 'tr') params.delete('lang');
    else params.set('lang', code);
    const qs = params.toString();
    window.location.href = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  }

  const t = uiStrings(currentLocale);

  const [design, setDesign] = useState<MenuDesignSettings>(initialVenue.design);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialVenue.logoUrl);
  const venue = useMemo(() => ({ ...initialVenue, design, logoUrl }), [initialVenue, design, logoUrl]);
  const [categories, setCategories] = useState<GuestCategory[]>(initialCategories);

  // Çoklu menü şeridi: yalnızca birden fazla menü varsa anlamlı. Tek menüde
  // (venue'lerin büyük çoğunluğu) `menus.length <= 1` olur, şerit hiç
  // render edilmez ve `visibleCategories === categories` olduğu için görsel
  // davranış eskisiyle birebir aynı kalır.
  const [activeMenuId, setActiveMenuId] = useState<string | null>(menus[0]?.id ?? null);
  const showMenuSwitcher = menus.length > 1;
  const visibleCategories = useMemo(
    () => (showMenuSwitcher && activeMenuId ? categories.filter((c) => c.menuId === activeMenuId) : categories),
    [categories, showMenuSwitcher, activeMenuId]
  );

  // Üst şeritteki menü sekmelerinde her menünün toplam ürün sayısı gösterilir
  // (RotaMenu referansındaki rozet gibi) — tüm kategoriler üzerinden, aktif
  // menü filtresinden BAĞIMSIZ hesaplanır.
  const menuItemCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of categories) {
      map.set(c.menuId, (map.get(c.menuId) ?? 0) + c.items.length);
    }
    return map;
  }, [categories]);

  // Alerjen filtreleri: misafir bir veya daha fazla alerjeni "gizle" olarak
  // işaretleyebilir; o alerjeni içeren ürünler tüm listelerden (öne çıkanlar
  // dahil) elenir. Yalnız şu an görünen menüdeki ürünlerde GERÇEKTEN geçen
  // alerjenler chip olarak gösterilir — boş bir filtre listesi kalabalık
  // yaratmasın diye.
  const [hiddenAllergens, setHiddenAllergens] = useState<Set<string>>(new Set());
  const availableAllergenCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const c of visibleCategories) for (const it of c.items) for (const code of it.allergenCodes) codes.add(code);
    return Array.from(codes).filter((code) => code in ALLERGENS);
  }, [visibleCategories]);
  function toggleAllergen(code: string) {
    setHiddenAllergens((s) => {
      const next = new Set(s);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }
  // Menü içi arama: RotaMenu referansında arama kutusu her zaman görünür ve
  // yazdıkça ürünler süzülür (kategori penceresi ayrı bir şey). Ad, açıklama
  // ve içindekiler alanlarında arar.
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase('tr');

  function visibleItemsOf(c: GuestCategory): GuestItem[] {
    let list = c.items;
    if (hiddenAllergens.size > 0) {
      list = list.filter((it) => !it.allergenCodes.some((code) => hiddenAllergens.has(code)));
    }
    if (needle) {
      list = list.filter(
        (it) =>
          it.name.toLocaleLowerCase('tr').includes(needle) ||
          (it.description ?? '').toLocaleLowerCase('tr').includes(needle) ||
          (it.ingredients ?? '').toLocaleLowerCase('tr').includes(needle)
      );
    }
    return list;
  }

  // Arama/filtre aktifken hiç ürünü kalmayan kategoriler tamamen gizlenir —
  // referanstaki gibi sonuç listesi kısa ve okunur kalsın.
  const renderedCategories = useMemo(
    () => (needle || hiddenAllergens.size > 0 ? visibleCategories.filter((c) => visibleItemsOf(c).length > 0) : visibleCategories),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleCategories, needle, hiddenAllergens]
  );

  // "Şefin Seçtikleri" — yalnızca şu an görünen menüdeki (aktif menü sekmesi)
  // öne çıkarılmış, alerjen filtresinden geçmiş ürünler. Kısa tutulur (ilk 6)
  // — bu bir vitrin, tam liste zaten altta kategorilerde var.
  const featuredItems = useMemo(
    () => {
      const manual = visibleCategories.flatMap((c) => visibleItemsOf(c).filter((it) => it.isFeatured));
      if (manual.length > 0) return manual.slice(0, 6);
      // Hiçbir ürün elle "Şefin Seçtikleri"ne eklenmemişse şerit boş kalmasın:
      // ilk kategorilerden birer ürün seçilir — görseli olan varsa o tercih
      // edilir, çünkü bu şerit menünün vitrini ve boş kart iyi görünmüyor.
      const auto: GuestItem[] = [];
      for (const c of visibleCategories) {
        const items = visibleItemsOf(c);
        const pick = items.find((it) => it.imageUrl) ?? items[0];
        if (pick) auto.push(pick);
        if (auto.length >= 3) break;
      }
      return auto;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleCategories, hiddenAllergens, needle]
  );

  useEffect(() => {
    function handlePreviewMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!event.data) return;
      if (event.data.type === 'ros:design-preview') {
        setDesign(normalizeMenuDesign(event.data.design));
        if (event.data.logoUrl !== undefined) setLogoUrl(event.data.logoUrl);
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

  const [active, setActive] = useState(visibleCategories[0]?.id ?? '');

  // Menü sekmesi değişince aktif kategori sekmesini yeni menünün ilk
  // kategorisine sıfırla (önceki menüdeki bir kategori kimliği kalmasın).
  useEffect(() => {
    setActive(visibleCategories[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenuId]);
  const [selected, setSelected] = useState<GuestItem | null>(null);
  const [categoryListOpen, setCategoryListOpen] = useState(false);

  // Karşılama popup'ı: her sekme oturumunda (tab kapanana kadar) bir kez
  // gösterilir. Stüdyo önizlemesinde (design preview postMessage'ı) hiç
  // görünmesin diye burada değil — venue.announcement zaten owner önizlemesinde
  // de gelir; bu kabul edilebilir çünkü sahibi de gerçek görünümü görmek ister.
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  /**
   * Açılış (splash) ekranı — referanstaki gibi menü yüklenirken tam ekran
   * marka kartı. Sıra şudur: splash (~2,2 sn) → kapanır → karşılama popup'ı.
   * İkisi TEK bir "giriş" olarak sayılır ve oturum başına bir kez gösterilir;
   * misafir menüde gezinip geri dönünce tekrar karşılaşmaz.
   */
  const [splash, setSplash] = useState<'hidden' | 'visible' | 'fading'>('hidden');
  useEffect(() => {
    const key = `ros:intro-seen:${venue.name}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      /* gizlilik modunda sessionStorage kapalıysa yine göster, sorun değil */
    }
    setSplash('visible');
    const fade = window.setTimeout(() => setSplash('fading'), 1900);
    const done = window.setTimeout(() => {
      setSplash('hidden');
      if (venue.announcement) setShowAnnouncement(true);
    }, 2400);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Popup'taki birincil eylem: "Şefin önerilerini gör" — vitrine kaydırır. */
  const featuredRef = useRef<HTMLDivElement | null>(null);
  function goToFeatured() {
    setShowAnnouncement(false);
    window.setTimeout(() => {
      featuredRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }
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
    if (!renderedCategories.length) return;
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
  }, [renderedCategories]);

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

  // Hero başlığı için: aktif menü nesnesi, toplam ürün sayısı ve kapak
  // fotoğrafı olup olmamasına göre metin kontrastı (fotoğraf üzerinde beyaz +
  // gölge, düz gradyan üzerinde yüzey rengi).
  const activeMenu = menus.find((m) => m.id === activeMenuId) ?? null;
  const visibleItemTotal = visibleCategories.reduce((n, c) => n + c.items.length, 0);
  const heroTextStyle: React.CSSProperties = venue.coverUrl
    ? { color: '#ffffff', textShadow: '0 1px 8px rgba(0,0,0,0.5)' }
    : { color: design.surfaceColor };
  const heroSubStyle: React.CSSProperties = venue.coverUrl
    ? { color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 6px rgba(0,0,0,0.5)' }
    : { color: hexToRgba(design.surfaceColor, 80) };

  if (!categories.length) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-bold">{venue.name}</h1>
        <p className="text-stone-500">{uiStrings(currentLocale).menuBeingPrepared}</p>
      </main>
    );
  }

  return (
    <div
      /* Genişlik: telefonda tek dar kolon (max-w-lg), masaüstünde referanstaki
         gibi geniş sayfa (lg:max-w-6xl). Eskiden her ekranda 512px'e
         sıkışıyordu ve masaüstünde ortada duran bir telefon maketi gibi
         görünüyordu — referans ise geniş, iki sütunlu bir sayfa. */
      className="mx-auto min-h-screen max-w-lg pb-16 shadow-sm sm:my-4 sm:rounded-2xl lg:max-w-6xl"
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
      {splash !== 'hidden' && (
        <SplashScreen venue={venue} design={design} t={t} fading={splash === 'fading'} />
      )}

      {venue.announcement && showAnnouncement && (
        <WelcomeAnnouncement
          announcement={venue.announcement}
          design={design}
          t={t}
          onSeeChefPicks={featuredItems.length > 0 ? goToFeatured : null}
          onClose={() => setShowAnnouncement(false)}
        />
      )}

      {/* Üst şerit: RotaMenu referansındaki "ANA MENÜLER" çubuğu. Logo/işletme
          adı solda, çoklu menü varsa ikon+isim+ürün-sayısı sekmeleri ortada,
          dil seçici sağda — üçü de artık kapak fotoğrafının İÇİNDE değil,
          her zaman görünen, sabit (sticky) ince bir çubukta. Tek menülü
          venue'lerde (büyük çoğunluk) yalnız logo + (varsa) dil seçici kalır,
          çubuk yine de görünür — marka her zaman üstte, kapak kaydırılınca
          bile kaybolmaz. */}
      <div
        className="sticky top-0 z-40 flex items-center gap-3 border-b px-4 py-2 backdrop-blur sm:rounded-t-2xl"
        style={{ borderColor: hexToRgba(design.dividerColor, design.dividerOpacity), backgroundColor: hexToRgba(design.surfaceColor, 95) }}
      >
        <div className="flex shrink-0 items-center gap-2">
          {venue.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={venue.logoUrl}
              alt={venue.name}
              className="w-auto object-contain"
              // İnce Ayar'daki logo boyutu burada da geçerli; çubuk taşmasın
              // diye 22–44px arasına sıkıştırılır.
              style={{ height: `${Math.min(Math.max(design.logoSize, 22), 44)}px` }}
            />
          ) : (
            <span className="text-sm font-bold" style={{ fontFamily: design.headingFont, color: design.textColor }}>
              {venue.name}
            </span>
          )}
        </div>
        {showMenuSwitcher && (
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide" style={{ color: design.mutedTextColor }}>
              {t.mainMenus}
            </span>
            {menus.map((m) => {
              const isActive = m.id === activeMenuId;
              return (
                <Pressable
                  key={m.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveMenuId(m.id)}
                  className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold"
                  style={isActive
                    ? { backgroundColor: design.primaryColor, borderColor: design.primaryColor, color: design.surfaceColor }
                    : { backgroundColor: hexToRgba(design.cardColor, design.cardOpacity), borderColor: hexToRgba(design.dividerColor, design.dividerOpacity), color: design.textColor }}
                >
                  {m.icon && <span aria-hidden>{m.icon}</span>}
                  {m.name}
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={isActive
                      ? { backgroundColor: hexToRgba(design.surfaceColor, 25), color: design.surfaceColor }
                      : { backgroundColor: hexToRgba(design.primaryColor, 12), color: design.primaryColor }}
                  >
                    {menuItemCounts.get(m.id) ?? 0}
                  </span>
                </Pressable>
              );
            })}
          </div>
        )}
        {/* Dil seçici. Referansta açılır kutu değil, iki bölmeli bir anahtar
            var: üstte kod (TR / EN), altında dilin adı. 4'e kadar dilde bu
            anahtarı kullanıyoruz; daha fazlasında çubuğa sığmayacağı için
            klasik açılır kutuya düşüyoruz. */}
        {availableLocales.length > 1 && availableLocales.length <= 4 && (
          <div
            className="ml-auto flex shrink-0 overflow-hidden rounded-xl border"
            style={{ borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 55)) }}
            role="group"
            aria-label={t.menuLanguage}
          >
            {availableLocales.map((language) => {
              const isCurrent = language.code === currentLocale;
              return (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => switchLocale(language.code)}
                  aria-current={isCurrent ? 'true' : undefined}
                  className="flex min-w-[46px] flex-col items-center px-2.5 py-1 leading-tight transition"
                  style={isCurrent
                    ? { backgroundColor: design.primaryColor, color: design.surfaceColor }
                    : { color: design.mutedTextColor }}
                >
                  <span className="text-xs font-bold uppercase">{language.code}</span>
                  <span className="text-[9px] font-medium opacity-80">{language.name}</span>
                </button>
              );
            })}
          </div>
        )}
        {availableLocales.length > 4 && (
          <label
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium"
            style={{ borderColor: hexToRgba(design.dividerColor, design.dividerOpacity), color: design.textColor }}
          >
            <span aria-hidden>🌐</span>
            <span className="sr-only">{t.menuLanguage}</span>
            <select
              value={currentLocale}
              onChange={(event) => switchLocale(event.target.value)}
              className="bg-transparent pr-0.5 font-medium outline-none"
              aria-label={t.menuLanguage}
            >
              {availableLocales.map((language) => (
                <option key={language.code} value={language.code}>{language.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {!venue.isPublished && (
        <div className="bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-800">
          {t.notPublished}
        </div>
      )}

      {/* Hero */}
      <header className="relative z-30 sm:rounded-t-2xl" style={{ backgroundColor: design.surfaceColor }}>
        {/* Kapak şeridi — kalınlığı (headerHeight) İnce Ayar'dan ayarlanır.
            İşletme adı şeridin ÜZERİNDE, dikey ortalanmış ve soldan
            başlayacak şekilde gösterilir; fotoğraf/gradyan üzerinde okunur
            kalması için kapak fotoğrafı varsa beyaz + gölge, yoksa (düz
            gradyan) `surfaceColor` kullanılır (bkz. CategoryStrip'teki aynı
            kontrast mantığı). Logo artık burada değil, en üstteki sabit
            çubuktadır; boyutu yine İnce Ayar'daki logoSize ile ayarlanır. */}
        <div
          className="relative w-full bg-cover bg-center"
          style={{
            // Üç satırlı hero tipografisi (etiket + büyük başlık + sayaç) için
            // asgari yükseklik; İnce Ayar'daki headerHeight bundan büyükse o kazanır.
            height: `${Math.max(design.headerHeight, 168)}px`,
            ...(venue.coverUrl
              ? { backgroundImage: `url(${venue.coverUrl})` }
              : { background: `linear-gradient(135deg, ${design.primaryColor}, ${design.accentColor})` }),
          }}
        >
          {/* Referanstaki hero tipografisi: üstte küçük harflendirilmiş etiket,
              ortada (varsa menü ikonuyla) büyük serif başlık, altında
              "60 ürün · 9 kategori" sayacı. Çoklu menülü işletmede başlık
              AKTİF MENÜNÜN adıdır (sekme değişince değişir); tek menülüde
              işletmenin adı kalır — tek menüde menü adı çoğu zaman jenerik
              ("Menü") olduğu için işletme adı daha anlamlı. */}
          <div className="absolute inset-0 flex flex-col justify-center px-5">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.22em]"
              style={heroSubStyle}
            >
              {showMenuSwitcher ? venue.name : t.digitalMenu}
            </span>
            <h1
              className="mt-1 flex items-center gap-2 font-bold leading-none tracking-tight"
              style={{
                fontFamily: design.headingFont,
                fontSize: `${design.baseFontSize * design.headingScale * 1.9}px`,
                ...heroTextStyle,
              }}
            >
              {showMenuSwitcher && activeMenu?.icon && <span aria-hidden>{activeMenu.icon}</span>}
              {showMenuSwitcher ? activeMenu?.name ?? venue.name : venue.name}
            </h1>
            <span className="mt-2 text-xs font-medium" style={heroSubStyle}>
              {t.itemsAndCategories(visibleItemTotal, visibleCategories.length)}
            </span>
          </div>
          {/* Logo artık üstteki sabit çubukta duruyor (referanstaki gibi) —
              kapak şeridinde ikinci kez göstermek başlıkla çakışıyordu. */}
        </div>

        <div className="px-5 pt-3 pb-4">
          {venue.description && (
            <p className="text-sm" style={{ color: design.mutedTextColor }}>{venue.description}</p>
          )}
        </div>
      </header>

      {/* Kalıcı duyuru şeridi — karşılama popup'ı yalnız oturumda bir kez
          gösterilir (yukarıda), ama RotaMenu referansı aynı içeriği popup
          kapandıktan SONRA da bir hatırlatma çubuğu olarak tutuyor. */}
      {venue.announcement && (
        // relative z-10: aşağıdaki 'hero' kategori grubunun sticky fotoğraf
        // katmanı (z-0) ekranın ortasına sabitlendiği için, üstteki bu
        // bloklar konumlandırılmazsa fotoğrafın ALTINDA kalıp kayboluyor.
        <div className="relative z-10 px-4 pt-4">
          <button
            type="button"
            onClick={() => setShowAnnouncement(true)}
            className="flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left"
            style={{ borderColor: hexToRgba(design.accentColor, 60), backgroundColor: design.primaryColor, color: design.surfaceColor }}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base"
              style={{ backgroundColor: hexToRgba(design.surfaceColor, 18) }}
              aria-hidden
            >
              🔔
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{venue.announcement.title}</span>
              {venue.announcement.body && (
                <span className="block truncate text-xs opacity-90">{venue.announcement.body}</span>
              )}
            </span>
            <span className="shrink-0 text-xs font-semibold underline-offset-2 hover:underline">
              {venue.announcement.buttonText || 'Detaylar'} →
            </span>
          </button>
        </div>
      )}

      {/* Her zaman görünen arama kutusu — referanstaki "…menüsünde lezzet ara…"
          alanı. Yazdıkça ürünler süzülür; boş kalan kategoriler gizlenir. */}
      <div className="relative z-10 px-4 pt-4">
        <label
          className="flex items-center gap-2.5 rounded-2xl border px-4 py-3"
          style={{
            borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 55)),
            // OPAK olmalı: 'hero' kategori fotoğrafı bu bloğun arkasından
            // geçtiği için yarı saydam bir zeminde placeholder okunmuyordu.
            backgroundColor: design.surfaceColor,
            boxShadow: tintedShadow(design),
          }}
        >
          <span aria-hidden style={{ color: design.mutedTextColor }}>🔍</span>
          <span className="sr-only">{t.searchLabel}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder(menus.find((m) => m.id === activeMenuId)?.name ?? venue.name)}
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
            style={{ color: design.textColor }}
          />
          {query && (
            <Pressable
              onClick={() => setQuery('')}
              aria-label={t.clearSearch}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs"
              style={{ backgroundColor: hexToRgba(design.dividerColor, 40), color: design.mutedTextColor }}
            >
              ✕
            </Pressable>
          )}
        </label>
      </div>

      {/* Yapışkan kategori sekmeleri — üstteki "Ana menüler" çubuğunun (45px)
          hemen altında sabitlenir, ikisi üst üste binmez. */}
      <nav className="sticky top-[45px] z-20 border-b backdrop-blur" style={{ borderColor: hexToRgba(design.dividerColor, design.dividerOpacity), backgroundColor: hexToRgba(design.surfaceColor, 95) }}>
        <div className="flex items-center gap-1 px-3 py-2">
          <div
            ref={navRef}
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
          {/* "Tümü" — menünün en başına döner.
              DİKKAT: bu çip "aktif" olarak İŞARETLENMEZ. Önce `active ===
              renderedCategories[0]?.id` koşuluyla vurgulanıyordu; ama
              scroll-spy sayfanın tepesindeyken zaten ilk kategoriyi aktif
              sayıyor, dolayısıyla "Tümü" ile ilk kategori çipi AYNI ANDA
              vurgulanıyordu — misafire iki kategori birden seçiliymiş gibi
              görünüyordu. Vurgu artık yalnız gerçek kategori çiplerinde. */}
          <Pressable
            onClick={() => {
              const first = renderedCategories[0]?.id;
              if (first) goTo(first);
            }}
            className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium"
            style={{ backgroundColor: hexToRgba(design.cardColor, design.cardOpacity), color: design.mutedTextColor }}
          >
            {t.all}
          </Pressable>
          {renderedCategories.map((c) => {
            const isActive = c.id === active;
            const count = visibleItemsOf(c).length;
            return (
              <Pressable
                key={c.id}
                ref={(el) => {
                  tabRefs.current[c.id] = el;
                }}
                onClick={() => goTo(c.id)}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium"
                style={isActive
                  ? { backgroundColor: design.primaryColor, color: design.surfaceColor }
                  : { backgroundColor: hexToRgba(design.cardColor, design.cardOpacity), color: design.mutedTextColor }}
              >
                {c.name}
                <span
                  className="rounded-full px-1.5 text-[10px] font-bold"
                  style={isActive
                    ? { backgroundColor: hexToRgba(design.surfaceColor, 25), color: design.surfaceColor }
                    : { backgroundColor: hexToRgba(design.primaryColor, 10), color: design.primaryColor }}
                >
                  {count}
                </span>
              </Pressable>
            );
          })}
          </div>
          {/* Uzun menülerde yatay şerit yetmiyor: 28 kategorili bir menüde
              misafir "Kırmızı Şarap"a ulaşmak için uzun uzun kaydırıyordu.
              8'den fazla kategori varsa tam listeyi açan bir düğme çıkar. */}
          {renderedCategories.length > 8 && (
            <Pressable
              type="button"
              onClick={() => setCategoryListOpen(true)}
              aria-label={t.allCategories}
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
          categories={renderedCategories}
          design={design}
          t={t}
          activeId={active}
          onPick={(id) => {
            setCategoryListOpen(false);
            goTo(id);
          }}
          onClose={() => setCategoryListOpen(false)}
        />
      )}

      {availableAllergenCodes.length > 0 && (
        <div className="relative z-10 px-4 pt-4">
          <h2
            className="px-0.5 text-sm font-bold uppercase tracking-wide"
            style={{ fontFamily: design.headingFont, color: design.textColor }}
          >
            {t.allergenFilters}
          </h2>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {availableAllergenCodes.map((code) => {
              const hidden = hiddenAllergens.has(code);
              return (
                <Pressable
                  key={code}
                  onClick={() => toggleAllergen(code)}
                  aria-pressed={hidden}
                  className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium"
                  style={hidden
                    ? { backgroundColor: design.primaryColor, borderColor: design.primaryColor, color: design.surfaceColor }
                    : { backgroundColor: design.surfaceColor, borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 55)), color: design.textColor }}
                >
                  {allergenLabel(code, currentLocale)}
                  <span className="opacity-70">{hidden ? t.hidden : t.hideContaining}</span>
                </Pressable>
              );
            })}
          </div>
        </div>
      )}

      {featuredItems.length > 0 && (
        <div ref={featuredRef} className="relative z-10 scroll-mt-28 px-4 pt-4">
          <p className="px-0.5 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: design.mutedTextColor }}>
            {venue.name}
          </p>
          <div className="flex items-end justify-between gap-3 px-0.5">
            <h2
              className="flex items-center gap-2 font-bold leading-tight"
              style={{
                fontFamily: design.headingFont,
                color: design.textColor,
                fontSize: `${design.baseFontSize * design.headingScale * 2.05}px`,
              }}
            >
              <span style={{ color: design.accentColor }} aria-hidden>★</span>
              {t.chefPicks}
            </h2>
            <span className="shrink-0 pb-1 text-xs" style={{ color: design.mutedTextColor }}>
              {t.chefPicksNote}
            </span>
          </div>
          {/* Telefonda yatay kaydırmalı şerit, masaüstünde referanstaki gibi
              yan yana dizilen kartlar. */}
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] lg:grid lg:grid-cols-3 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
            {featuredItems.map((it) => (
              <Pressable
                key={it.id}
                onClick={() => openItem(it)}
                className="w-44 shrink-0 overflow-hidden border text-left lg:w-auto"
                style={{
                  borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 55)),
                  borderRadius: `${Math.min(design.cardRadius, 18)}px`,
                  backgroundColor: hexToRgba(design.cardColor, design.cardOpacity),
                  boxShadow: tintedShadow(design),
                }}
              >
                <div className="relative h-28 w-full lg:h-40">
                  <ItemThumb item={it} design={design} className="h-full w-full" showCaption t={t} />
                  <span
                    className="absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ backgroundColor: design.primaryColor, color: design.surfaceColor }}
                  >
                    {t.chefPick}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="truncate text-sm font-semibold" style={{ color: design.textColor, fontFamily: design.headingFont }}>{it.name}</p>
                  {it.price != null && (
                    <p className="mt-0.5 text-xs font-bold" style={{ color: design.priceColor ?? design.primaryColor }}>
                      {formatPrice(it.price, venue.currency)}
                    </p>
                  )}
                  <AllergenLine item={it} design={design} t={t} locale={currentLocale} />
                </div>
              </Pressable>
            ))}
          </div>
        </div>
      )}

      {/* Kategoriler + ürünler */}
      <main className="px-4">
        {renderedCategories.length === 0 && (
          <p className="px-1 py-10 text-center text-sm" style={{ color: design.mutedTextColor }}>
            {needle ? t.noSearchResults(query.trim()) : t.noItemsForFilters}
          </p>
        )}
        {(() => {
          const categoryIndexById = new Map(renderedCategories.map((c, i) => [c.id, i]));
          return groupCategories(renderedCategories).map((group) => {
          if (group.kind === 'plain') {
            const c = group.category;
            const shownItems = visibleItemsOf(c);
            const itemList = shownItems.length === 0 ? (
              <p className="px-1 py-3 text-sm" style={{ color: design.mutedTextColor }}>
                {t.noItemsForFilters}
              </p>
            ) : (
              /* Sütun sayısı: telefonda tasarım ayarındaki düzen (tek ya da
                 iki sütun), masaüstünde her hâlükârda İKİ sütun — referans
                 geniş ekranda ürünleri iki sütunda diziyor, tek sütun geniş
                 sayfada aşırı seyrek kalıyordu. */
              <ul
                className={design.layout === 'two-column' ? 'grid grid-cols-2' : 'grid grid-cols-1 lg:grid-cols-2'}
                style={{ gap: `${design.itemSpacing}px` }}
              >
                {shownItems.map((it) => (
                  <li key={it.id}>
                    <Pressable
                      variant="dim"
                      onClick={() => openItem(it)}
                      className={`flex w-full items-start gap-3 text-left ${design.layout === 'single' ? 'border p-3' : 'py-2'}`}
                      style={{
                        backgroundColor: design.layout === 'single' ? hexToRgba(design.cardColor, design.cardOpacity) : 'transparent',
                        borderRadius: design.layout === 'single' ? `${design.cardRadius}px` : 0,
                        borderColor: design.layout === 'single' ? hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 45)) : 'transparent',
                        borderBottom: design.layout === 'two-column' ? `1px dashed ${hexToRgba(design.dividerColor, design.dividerOpacity)}` : undefined,
                        boxShadow: design.layout === 'single' ? tintedShadow(design) : undefined,
                      }}
                    >
                      {design.layout === 'single' && (
                        <div
                          className="h-16 w-16 shrink-0 overflow-hidden"
                          style={{ borderRadius: `${Math.min(design.cardRadius, 16)}px` }}
                        >
                          <ItemThumb item={it} design={design} className="h-full w-full" t={t} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="font-semibold" style={{ color: design.textColor, fontFamily: design.headingFont }}>{it.name}</h3>
                          {it.price != null && (
                            <span className="shrink-0 font-semibold" style={{ color: design.priceColor ?? design.primaryColor }}>
                              {formatPrice(it.price, venue.currency)}
                            </span>
                          )}
                        </div>
                        {it.description && (
                          <p className="mt-0.5 line-clamp-2 text-sm" style={{ color: design.mutedTextColor }}>
                            {it.description}
                          </p>
                        )}
                        <AllergenLine item={it} design={design} t={t} locale={currentLocale} />
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
                className="scroll-mt-16 pt-12"
              >
                <CategoryFrame design={design} variant="plain">
                  <CategoryStrip
                    name={c.name}
                    design={design}
                    backgroundUrl={null}
                    positionY={c.backgroundPositionY}
                    number={categoryIndexById.get(c.id)}
                    itemCount={shownItems.length}
                    t={t}
                  />
                  <div>{itemList}</div>
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
              {/* DİKKAT (düzeltme): eskiden `top-[50vh] -translate-y-1/2` idi —
                  fotoğraf ekranın DİKEY ORTASINA sabitleniyordu. Transform,
                  katmanı sarmalayıcının üst kenarının ~200px YUKARISINA taşıdığı
                  için sayfanın en başında (henüz bu gruba gelinmemişken bile)
                  arama kutusunun ve alerjen filtrelerinin arkasından sızıyordu.
                  Artık nav'ın hemen altına (top-[110px]) sabitleniyor: sticky,
                  katmanı sarmalayıcının sınırları içinde tuttuğu için taşma
                  olmuyor; gruptaki kategoriler arası crossfade aynen korunuyor. */}
              <div className="sticky top-[110px] z-0 h-[25.2rem] overflow-hidden sm:h-[28rem]" style={{ borderRadius: `${design.heroImageRadius}px` }} aria-hidden>
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
                  const heroShownItems = visibleItemsOf(c);
                  const heroList = heroShownItems.length === 0 ? (
                    <p className="px-1 py-3 text-sm" style={{ color: design.mutedTextColor }}>
                      {t.noItemsForFilters}
                    </p>
                  ) : (
                    /* Hero (tam boy fotoğraflı) kategorilerde de masaüstünde iki
                       sütun — normal kategorilerle aynı düzen. Eskiden burada
                       tek sütunlu bir flex listesi vardı ve geniş ekranda
                       kartlar aşırı uzuyordu. */
                    <ul
                      className="relative grid grid-cols-1 px-0.5 pb-1 lg:grid-cols-2"
                      style={{ gap: `${design.itemSpacing}px` }}
                    >
                      {heroShownItems.map((it) => (
                        <li key={it.id}>
                          <Pressable
                            variant="dim"
                            onClick={() => openItem(it)}
                            className="flex w-full items-start gap-3 px-3.5 py-3 text-left backdrop-blur-[3px]"
                            style={{ backgroundColor: hexToRgba(design.cardColor, design.cardOpacity), borderRadius: `${design.cardRadius}px`, borderBottom: `1px solid ${hexToRgba(design.dividerColor, design.dividerOpacity)}`, boxShadow: tintedShadow(design) }}
                          >
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                              <ItemThumb item={it} design={design} className="h-full w-full" t={t} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <h3 className="font-semibold" style={{ color: design.textColor, fontFamily: design.headingFont }}>{it.name}</h3>
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
                              <AllergenLine item={it} design={design} t={t} locale={currentLocale} />
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
                      className={index === 0 ? 'scroll-mt-16 pt-28 sm:pt-32' : 'scroll-mt-16 pt-12'}
                    >
                      <CategoryFrame design={design}>
                        <CategoryStrip name={c.name} design={design} number={categoryIndexById.get(c.id)} itemCount={heroShownItems.length} t={t} />
                        <div className="p-3">{heroList}</div>
                      </CategoryFrame>
                    </section>
                  );
                })}
              </div>
            </div>
          );
          });
        })()}
      </main>

      {/* "Bilgilendirme & Şartlar" — referanstaki, solunda altın bir şerit olan
          beyaz bilgi kartı. İçeriği Stüdyo → Ayarlar'daki "Marka hikayesi"
          alanından gelir; her paragraf ayrı satır olarak dizilir. */}
      {venue.story && (
        <section className="relative z-10 px-4 pt-8">
          <div
            className="overflow-hidden rounded-2xl border-l-4 px-5 py-5"
            style={{
              borderColor: design.accentColor,
              backgroundColor: hexToRgba(design.cardColor, Math.max(design.cardOpacity, 90)),
              boxShadow: tintedShadow(design),
            }}
          >
            <h2
              className="text-base font-bold"
              style={{ fontFamily: design.headingFont, color: design.textColor }}
            >
              {t.terms}
            </h2>
            <div className="mt-2 space-y-2">
              {venue.story
                .split(/\n{2,}|\n/)
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line, i) => (
                  <p key={i} className="text-sm leading-relaxed" style={{ color: design.mutedTextColor }}>
                    {line}
                  </p>
                ))}
            </div>
          </div>
        </section>
      )}

      <ContactFooter venue={venue} t={t} />

      {selected && (
        <ItemModal
          item={selected}
          currency={venue.currency}
          design={design}
          t={t}
          locale={currentLocale}
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
  number,
  itemCount,
  t,
}: {
  name: string;
  design: MenuDesignSettings;
  backgroundUrl?: string | null;
  positionY?: number;
  /** Kategori sırası (0-tabanlı) — doluysa şeritte "01" gibi bir sıra numarası gösterilir. */
  number?: number;
  /** Kategorideki (filtrelenmiş) ürün sayısı — başlığın sağında "14 ürün" olarak. */
  itemCount?: number;
  t: UiStrings;
}) {
  const numberLabel = number != null ? String(number + 1).padStart(2, '0') : null;
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
        {numberLabel && (
          <span className="absolute left-3 top-2.5 text-xs font-bold text-white/70" style={{ fontFamily: design.headingFont }}>
            {numberLabel}
          </span>
        )}
        {/* Ürün sayısı fotoğraflı şeritte de görünsün — fotoğrafsız (editoryal)
            başlıkta zaten vardı, ikisi arasında tutarsızlık kalmasın. */}
        {itemCount != null && (
          <span className="absolute right-3 top-2.5 text-xs font-medium text-white/70">
            {t.itemCount(itemCount)}
          </span>
        )}
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
          <h2 className="text-xl font-bold text-white drop-shadow-md" style={{ fontFamily: design.headingFont }}>
            {name}
          </h2>
        </div>
      </div>
    );
  }
  // Görselsiz başlık: RotaMenu referansındaki "editoryal" düzen — üstte küçük
  // sıra numarası, altında büyük serif kategori adı, sağda ürün sayısı ve
  // altında ince bir ayraç. Renkli bir bant yerine sayfanın kendi zemininde
  // durur; kategoriler arası geçiş bir dergi sayfası gibi okunur.
  return (
    <div className="px-1 pb-3 pt-1">
      {numberLabel && (
        <span
          className="block text-xs font-bold tracking-[0.2em]"
          style={{ color: hexToRgba(design.primaryColor, 65), fontFamily: design.headingFont }}
        >
          {numberLabel}
        </span>
      )}
      <div className="flex items-end justify-between gap-3">
        <h2
          className="font-bold leading-tight"
          style={{
            color: design.textColor,
            fontFamily: design.headingFont,
            // Referanstaki kategori başlıkları gövde metninin ~2 katı; 1.15
            // çarpanı fazla küçük kalıyordu.
            fontSize: `${design.baseFontSize * design.headingScale * 2.05}px`,
          }}
        >
          {name}
        </h2>
        {itemCount != null && (
          <span className="shrink-0 pb-1 text-xs" style={{ color: design.mutedTextColor }}>
            {t.itemCount(itemCount)}
          </span>
        )}
      </div>
      {/* Referansta bu çizgi ince gri değil, metin rengiyle basılmış KALIN
          bir ayraç — kategoriyi bir dergi bölüm başlığı gibi ayırıyor. */}
      <div className="mt-2.5 h-[2px] w-full" style={{ backgroundColor: hexToRgba(design.textColor, 82) }} />
    </div>
  );
}

/** Her kategoriyi (şerit + ürün listesi) şık, çerçeveli tek bir kart olarak
 * gruplar — kategoriler arası geçiş net görünsün diye kenarlık + gölge kullanılır. */
function CategoryFrame({
  design,
  variant = 'framed',
  children,
}: {
  design: MenuDesignSettings;
  /**
   * 'plain'  — çerçevesiz (referans düzeni): editoryal başlık ve ürün kartları
   *            doğrudan sayfa zemininde durur, dergi sayfası gibi okunur.
   * 'framed' — hero (tam boy fotoğraf) gruplarında kullanılır: başlık
   *            fotoğrafın üzerinde kalacağı için okunur bir yüzey gerekir.
   */
  variant?: 'plain' | 'framed';
  children: React.ReactNode;
}) {
  if (variant === 'plain') return <div>{children}</div>;
  return (
    <div
      className="overflow-hidden backdrop-blur-[2px]"
      style={{
        backgroundColor: hexToRgba(design.surfaceColor, 88),
        borderRadius: `${design.groupFrameRadius}px`,
        boxShadow: `${hexToRgba(design.primaryColor, 12)} 0 8px 24px`,
      }}
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
  t,
  activeId,
  onPick,
  onClose,
}: {
  categories: GuestCategory[];
  design: MenuDesignSettings;
  t: UiStrings;
  activeId: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  // Yalnız kategori adında değil, ürün adı/açıklamasında da arar (RotaMenu'nün
  // "Search menu" davranışına eşdeğer) — bir ürünü arayan misafir, o ürünün
  // olduğu kategoriyi bulup açabilsin.
  const needle = query.trim().toLocaleLowerCase('tr');
  const shown = needle
    ? categories.filter(
        (c) =>
          c.name.toLocaleLowerCase('tr').includes(needle) ||
          c.items.some(
            (it) =>
              it.name.toLocaleLowerCase('tr').includes(needle) ||
              (it.description ?? '').toLocaleLowerCase('tr').includes(needle)
          )
      )
    : categories;

  // Esc, odak tuzağı, odağı ☰ düğmesine geri verme ve sürükleyip kapatma
  // artık ortak Sheet'te (bkz. components/ui/sheet.tsx).
  return (
    <Sheet
      open
      onClose={onClose}
      label={t.categories}
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
            placeholder={`${t.searchLabel}…`}
            aria-label={t.searchLabel}
            className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-base outline-none"
            style={{
              borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 60)),
              backgroundColor: hexToRgba(design.cardColor, design.cardOpacity),
              color: design.textColor,
            }}
          />
          <Pressable
            onClick={onClose}
            aria-label={t.close}
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
              {t.noCategoryMatch}
            </li>
          )}
        </ul>
      </>
    </Sheet>
  );
}

function DietaryChip({ code, locale }: { code: string; locale: string }) {
  const d = (DIETARY as Record<string, { tr: string; en: string; emoji: string } | undefined>)[code];
  if (!d) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <span aria-hidden>{d.emoji}</span>
      {locale === 'tr' ? d.tr : d.en}
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
  t,
  locale,
  onClose,
}: {
  item: GuestItem;
  currency: string;
  design: MenuDesignSettings;
  t: UiStrings;
  locale: string;
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
              aria-label={t.close}
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
            <p className="mt-1 text-lg font-semibold" style={{ color: design.priceColor ?? design.primaryColor }}>
              {formatPrice(item.price, currency)}
            </p>
          )}

          {item.dietaryCodes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.dietaryCodes.map((code) => (
                <DietaryChip key={code} code={code} locale={locale} />
              ))}
            </div>
          )}

          {item.description && (
            <p className="mt-3 text-sm leading-relaxed" style={{ color: design.mutedTextColor }}>
              {item.description}
            </p>
          )}

          {item.ingredients && (
            <ModalSection title={t.ingredients} design={design}>
              <p className="text-sm leading-relaxed" style={{ color: design.mutedTextColor }}>
                {item.ingredients}
              </p>
            </ModalSection>
          )}

          {item.calories != null && (
            <ModalSection title={t.caloriesPerServing} design={design}>
              <p className="text-sm font-medium">{item.calories} kcal</p>
            </ModalSection>
          )}

          <ModalSection title={t.allergens} design={design}>
            {!item.allergensReviewed ? (
              <p className="text-sm" style={{ color: design.mutedTextColor }}>
                {t.allergensUnverifiedLong}
              </p>
            ) : item.allergenCodes.length === 0 ? (
              <p className="text-sm" style={{ color: design.mutedTextColor }}>
                {t.noDeclaredAllergens}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {item.allergenCodes.map((code) => (
                  <span
                    key={code}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium"
                    style={{ backgroundColor: hexToRgba(design.cardColor, design.cardOpacity) }}
                  >
                    {allergenLabel(code, locale)}
                  </span>
                ))}
              </div>
            )}
          </ModalSection>

          <p
            className="mt-5 border-t pt-3 text-xs leading-relaxed"
            style={{
              borderColor: hexToRgba(design.dividerColor, design.dividerOpacity),
              color: design.mutedTextColor,
            }}
          >
            {t.allergenDisclaimer}
          </p>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * Açılış ekranı — referanstaki "menü yükleniyor" karşılaması.
 *
 * Tam ekran kapak fotoğrafı (yoksa markanın gradyanı) üzerinde işletmenin adı
 * ve altında ince bir "hazırlanıyor" satırı. ~2 saniye durur, yumuşakça
 * kaybolur ve arkasından karşılama popup'ı açılır (bkz. GuestMenu'deki
 * intro effect'i). Oturum başına bir kez gösterilir.
 *
 * `aria-hidden` + `pointer-events-none` (fading sırasında): ekran okuyucu
 * için gereksiz gürültü yapmasın ve kaybolurken altındaki menüye yapılan
 * tıklamayı yutmasın.
 */
function SplashScreen({
  venue,
  design,
  t,
  fading,
}: {
  venue: GuestVenue;
  design: MenuDesignSettings;
  t: UiStrings;
  fading: boolean;
}) {
  /**
   * İKİ AYRI DURUM — karıştırılmamalı:
   *
   *  a) İşletmenin KENDİ kapak fotoğrafı varsa: fotoğraf sade bir manzaradır,
   *     üzerine koyu perde + işletme adı + "hazırlanıyor" satırı basarız.
   *
   *  b) Kapak yoksa ortak marka görseli (/splash.jpg) kullanılır. Bu görselin
   *     ÜZERİNDE zaten RotaMenu logosu ve "yükleniyor" yazısı basılıdır; bir de
   *     bizim yazılarımızı üstüne koyunca iki metin üst üste biniyordu. Bu
   *     durumda hiçbir şey yazmayız — görsel kendi başına yeterlidir.
   */
  const usingBrandSplash = !venue.coverUrl;

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center transition-opacity duration-500 ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      /* Taban katman markanın gradyanı: görsel yüklenemezse ekran boş kalmaz. */
      style={{ background: `linear-gradient(135deg, ${design.primaryColor}, ${design.accentColor})` }}
      aria-hidden
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${venue.coverUrl ?? '/splash.jpg'})` }}
      />

      {/* Yazı basılacaksa okunurluk için perde; marka görselinde yazı yok,
          perde de yok — görsel olduğu gibi, net görünsün. */}
      {!usingBrandSplash && (
        <>
          <div className="absolute inset-0" style={{ backgroundColor: hexToRgba(design.textColor, 55) }} />

          <div className="relative flex flex-col items-center px-8 text-center">
            {venue.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={venue.logoUrl} alt="" className="mb-4 h-14 w-auto object-contain drop-shadow" />
            ) : null}
            <h1
              className="text-4xl font-bold leading-none tracking-tight text-white drop-shadow-lg sm:text-5xl"
              style={{ fontFamily: design.headingFont }}
            >
              {venue.name}
            </h1>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/80">
              {t.preparingMenu}
            </p>
          </div>

          <div className="absolute bottom-16 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70"
                style={{ animationDelay: `${i * 180}ms` }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Karşılama/promosyon popup'ı — RotaMenu referansındaki "Bugünün ayrıcalığı"
 * kartına denk gelir. Yalnız Stüdyo → Ayarlar'da başlık girilmişse render
 * edilir; her sekme oturumunda bir kez gösterilir (bkz. sessionStorage kontrolü
 * yukarıda). Yayınlanmamış önizlemede de gösterilir ki sahibi kontrol edebilsin.
 */
function WelcomeAnnouncement({
  announcement,
  design,
  t,
  onSeeChefPicks,
  onClose,
}: {
  announcement: GuestAnnouncement;
  design: MenuDesignSettings;
  t: UiStrings;
  /** "Şefin önerilerini gör" — öne çıkarılmış ürün yoksa null gelir, düğme çıkmaz. */
  onSeeChefPicks: (() => void) | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open
      onClose={onClose}
      label={announcement.title}
      placement="center"
      panelClassName="ros-draggable w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-3xl shadow-2xl"
      panelStyle={{ backgroundColor: design.surfaceColor, color: design.textColor }}
    >
      <div>
        {announcement.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={announcement.imageUrl} alt="" className="h-40 w-full object-cover" />
        )}
        <div className="p-6 text-center">
          <h2 className="text-lg font-bold" style={{ fontFamily: design.headingFont }}>
            {announcement.title}
          </h2>
          {announcement.body && (
            <p className="mt-2 text-sm leading-relaxed" style={{ color: design.mutedTextColor }}>
              {announcement.body}
            </p>
          )}
          {/* Referanstaki iki seçenek: belirgin birincil eylem + sessiz
              "menüye devam et" bağlantısı. */}
          <Pressable
            onClick={onSeeChefPicks ?? onClose}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold"
            style={{ backgroundColor: design.primaryColor, color: design.surfaceColor }}
          >
            {announcement.buttonText || (onSeeChefPicks ? t.seeChefPicks : t.seeMenu)}
          </Pressable>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full text-sm font-medium"
            style={{ color: design.mutedTextColor }}
          >
            {t.continueToMenu}
          </button>
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

function ContactFooter({ venue, t }: { venue: GuestVenue; t: UiStrings }) {
  const waDigits = venue.whatsapp?.replace(/[^\d]/g, '') || null;
  const igHandle = venue.instagram
    ? venue.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
    : null;

  const rows = useMemo(
    () =>
      [
        venue.address && {
          label: t.address,
          value: venue.address,
          href: venue.googleMapsUrl ?? undefined,
        },
        venue.openingHours && { label: t.openingHours, value: venue.openingHours },
        venue.phone && { label: t.phone, value: venue.phone, href: `tel:${venue.phone.replace(/\s/g, '')}` },
        waDigits && { label: 'WhatsApp', value: venue.whatsapp!, href: `https://wa.me/${waDigits}` },
        igHandle && { label: 'Instagram', value: `@${igHandle}`, href: `https://instagram.com/${igHandle}` },
        venue.wifiSsid && { label: t.wifi, value: venue.wifiSsid },
      ].filter(Boolean) as { label: string; value: string; href?: string }[],
    [venue, waDigits, igHandle, t]
  );

  return (
    <footer className="relative z-10 mt-8 border-t px-5 py-6" style={{ borderColor: hexToRgba(venue.design.dividerColor, venue.design.dividerOpacity), backgroundColor: hexToRgba(venue.design.surfaceColor, 75) }}>
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
          {t.preparedWith}
        </p>
      )}
    </footer>
  );
}
