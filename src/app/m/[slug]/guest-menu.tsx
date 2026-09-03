'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ALLERGENS } from '@/lib/allergens';
import { DIETARY } from '@/lib/dietary';
import { formatPrice } from '@/lib/currency';
import { customFontFaceCss, hexToRgba, menuBackgroundStyle, normalizeMenuDesign, type MenuDesignSettings } from '@/lib/themes';
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
  /** Açılır menü başlığı — `mainMenus` iki nokta ile bitiyor, başlıkta olmaz. */
  mainMenusTitle: string;
  switchMenu: string;
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
  allergenFiltersHint: string;
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
  /* ── Mekan kartı (müşteri talebi A2–A6) ── */
  today: string;
  openNow: string;
  closedNow: string;
  closedToday: string;
  weekHours: string;
  rateOnGoogle: string;
  callVenue: string;
  getDirections: string;
  venuePhotos: string;
  browseCategories: string;
  advertisement: string;
};

const UI_TR: UiStrings = {
  mainMenus: 'Ana menüler:',
  mainMenusTitle: 'Ana menüler',
  switchMenu: 'Menü değiştir',
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
  allergenFiltersHint: 'Kaçınmak istediğiniz alerjenleri seçin; ilgili ürünleri menüden gizleyelim.',
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
  preparedWith: 'RotaMenu ile hazırlandı',
  address: 'Adres',
  openingHours: 'Çalışma saatleri',
  phone: 'Telefon',
  wifi: 'Wi-Fi',
  today: 'Bugün',
  openNow: 'Şu an açık',
  closedNow: 'Şu an kapalı',
  closedToday: 'Bugün kapalı',
  weekHours: 'Tüm hafta',
  rateOnGoogle: 'Google’da değerlendir',
  callVenue: 'Ara',
  getDirections: 'Yol tarifi',
  venuePhotos: 'Mekandan kareler',
  browseCategories: 'Kategoriler',
  advertisement: 'Reklam',
};

const UI_EN: UiStrings = {
  mainMenus: 'Main menus:',
  mainMenusTitle: 'Main menus',
  switchMenu: 'Switch menu',
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
  allergenFiltersHint: 'Select allergens you want to avoid and we will hide matching items.',
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
  preparedWith: 'Made with RotaMenu',
  address: 'Address',
  openingHours: 'Opening hours',
  phone: 'Phone',
  wifi: 'Wi-Fi',
  today: 'Today',
  openNow: 'Open now',
  closedNow: 'Closed now',
  closedToday: 'Closed today',
  weekHours: 'Full week',
  rateOnGoogle: 'Rate us on Google',
  callVenue: 'Call',
  getDirections: 'Directions',
  venuePhotos: 'Photos',
  browseCategories: 'Categories',
  advertisement: 'Ad',
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

/**
 * Çalışma saatleri misafire HAZIR gelir: "bugün" hesabı mekanın saat dilimine
 * göre SUNUCUDA yapılır (bkz. lib/opening-hours.ts). Böylece misafirin cihaz
 * saati yanlışsa ya da başka ülkedeyse bile doğru günü görürüz ve Intl mantığı
 * istemci paketine girmez.
 */
export type GuestHours = {
  today: { range: string | null; closed: boolean; openNow: boolean | null } | null;
  week: { name: string; text: string; closed: boolean }[];
  /** Yapısal saat girilmemişse eski serbest metin ("Her gün 12:00–24:00"). */
  fallback: string | null;
};

export type GuestPhoto = { url: string; caption: string | null };

/** Açılış ekranındaki reklam. Seçim sunucuda yapılır (bkz. lib/ads.ts). */
export type GuestAd = {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  durationSeconds: number;
  clickUrl: string | null;
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
  /** Ücretsiz planda "RotaMenu ile hazırlandı" rozeti gösterilir. */
  showBadge: boolean;
  design: MenuDesignSettings;
  /** Karşılama/promosyon popup'ı (Stüdyo → Ayarlar). Başlık yoksa null. */
  announcement: GuestAnnouncement | null;
  /** Alt bilgi / marka hikayesi bloğu — footer'dan önce gösterilir. Boşsa null. */
  story: string | null;
  /** "Bizi Google'da değerlendirin" bağlantısı (A4). */
  googleReviewUrl: string | null;
  /** Çalışma saatleri — sunucuda hesaplanmış (A3). */
  hours: GuestHours | null;
  /** Mekan fotoğrafları galerisi (B7). Boşsa galeri düğmesi çıkmaz. */
  photos: GuestPhoto[];
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
 * Dil sözlükleri — locale → { kategori adı, ürün alanları }. Sunucu TÜM
 * dilleri tek seferde gönderir; dil düğmesi sayfayı yeniden yüklemeden
 * (referans menüdeki gibi ANINDA) bu sözlükten geçiş yapar. Kaynak dil (tr)
 * sözlükte YOKTUR — kategori/ürün props'ları zaten ham Türkçe metni taşır.
 */
export type GuestTranslations = Record<
  string,
  {
    categories: Record<string, string>;
    items: Record<string, { name: string; description: string | null; ingredients: string | null }>;
  }
>;

/** Kategorileri seçili dile çevirir; kaynak dilde (veya sözlük yoksa) aynen döner. */
function localizeCategories(
  categories: GuestCategory[],
  locale: string,
  translations: GuestTranslations
): GuestCategory[] {
  const bundle = translations[locale];
  if (!bundle) return categories;
  return categories.map((c) => ({
    ...c,
    name: bundle.categories[c.id] ?? c.name,
    items: c.items.map((it) => {
      const tr = bundle.items[it.id];
      if (!tr) return it;
      return {
        ...it,
        name: tr.name || it.name,
        description: tr.description ?? it.description,
        ingredients: tr.ingredients ?? it.ingredients,
      };
    }),
  }));
}

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
        className="gm-allergen-chip mt-2 inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-[3px]"
        style={{
          backgroundColor: hexToRgba(design.dividerColor, 22),
          borderColor: hexToRgba(design.dividerColor, 60),
          color: design.mutedTextColor,
        }}
      >
        <span aria-hidden>⚠</span> {t.allergensUnverified}
      </span>
    );
  }
  if (item.allergenCodes.length === 0) return null;
  return (
    <span className="mt-2 flex flex-wrap gap-1">
      {item.allergenCodes.map((code) => (
        <span
          key={code}
          className="gm-allergen-chip rounded-[5px] border px-1.5 py-[3px]"
          style={{
            backgroundColor: hexToRgba(design.primaryColor, 8),
            borderColor: hexToRgba(design.primaryColor, 24),
            color: design.primaryColor,
          }}
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

/**
 * Üst şeritteki "Ana menüler" seçicisi — iki görünümü var ve aralarında
 * ÖLÇEREK geçer:
 *
 *  • Yer varsa  → menüler yan yana sekme olarak (referans tasarımdaki şerit).
 *  • Sıkışırsa  → tek bir "Menü değiştir" düğmesi + açılır liste.
 *
 * NEDEN görünmez bir ölçüm kopyası: doğrudan `scrollWidth > clientWidth`
 * bakmak SALINIM yaratır — açılır menüye düşünce şeridin içeriği daralır,
 * ölçüm "artık sığıyor" der, sekmelere geri döner, yine taşar, tekrar
 * düşer… Kopya HER ZAMAN doğal genişlikte (görünmez) çizildiği için karar
 * o an hangi görünümde olduğumuzdan bağımsız kalır ve kararlıdır.
 *
 * Ölçüm çalışmazsa (ResizeObserver yok) sekmeler yatay kaydırılabilir
 * kalır — yani eski davranış hâlâ emniyet ağı.
 */
function MenuSwitcher({
  menus,
  activeMenuId,
  counts,
  onSelect,
  design,
  t,
}: {
  menus: GuestMenuSummary[];
  activeMenuId: string | null;
  counts: Map<string, number>;
  onSelect: (id: string) => void;
  design: MenuDesignSettings;
  t: UiStrings;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [inline, setInline] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const slot = slotRef.current;
    const probe = probeRef.current;
    if (!slot || !probe || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const available = slot.clientWidth;
      const needed = probe.scrollWidth;
      // 8px pay: kenarlık/yuvarlama farkları yüzünden tam sınırda titremesin.
      if (available > 0 && needed > 0) setInline(needed + 8 <= available);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(slot);
    ro.observe(probe);
    return () => ro.disconnect();
  }, [menus, counts, t]);

  // Ekran genişleyip sekmelere dönülünce açık liste havada asılı kalmasın.
  useEffect(() => {
    if (inline) setOpen(false);
  }, [inline]);

  // Dışarı tıklama ve Esc ile kapanma.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (slotRef.current && !slotRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Sekme ve ölçüm kopyası BİREBİR aynı kutuyu üretmeli, yoksa ölçüm yanılır.
  const chipBase =
    'shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold';
  const badgeBase = 'rounded-full px-1.5 py-0.5 text-[10px] font-bold';
  const chipStyle = (isActive: boolean) =>
    isActive
      ? { backgroundColor: design.primaryColor, borderColor: design.primaryColor, color: design.surfaceColor }
      : {
          backgroundColor: hexToRgba(design.cardColor, design.cardOpacity),
          borderColor: hexToRgba(design.dividerColor, design.dividerOpacity),
          color: design.textColor,
        };
  const badgeStyle = (isActive: boolean) =>
    isActive
      ? { backgroundColor: hexToRgba(design.surfaceColor, 25), color: design.surfaceColor }
      : { backgroundColor: hexToRgba(design.primaryColor, 12), color: design.primaryColor };

  const activeMenu = menus.find((m) => m.id === activeMenuId) ?? menus[0];

  return (
    <div ref={slotRef} className="relative flex min-w-0 flex-1 items-center">
      {/* ÖLÇÜM KOPYASI — doğal genişliği ölçülür ama sıfır boyutlu dış kap
          tarafından kırpılır. Tek başına absolute bırakıldığında görünmez
          içerik mobil document.scrollWidth'i büyütüp sağda boş alan açıyordu. */}
      <div aria-hidden className="pointer-events-none invisible absolute left-0 top-0 h-0 w-0 overflow-hidden">
        <div ref={probeRef} className="flex w-max items-center gap-2">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide">{t.mainMenus}</span>
          {menus.map((m) => (
            <span key={m.id} className={`inline-flex ${chipBase}`} style={chipStyle(m.id === activeMenuId)}>
              {m.icon && <span aria-hidden>{m.icon}</span>}
              {m.name}
              <span className={badgeBase} style={badgeStyle(m.id === activeMenuId)}>
                {counts.get(m.id) ?? 0}
              </span>
            </span>
          ))}
        </div>
      </div>

      {inline ? (
        <div
          role="tablist"
          aria-label={t.mainMenusTitle}
          className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <span
            className="shrink-0 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: design.mutedTextColor }}
          >
            {t.mainMenus}
          </span>
          {menus.map((m) => {
            const isActive = m.id === activeMenuId;
            return (
              <Pressable
                key={m.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelect(m.id)}
                className={`flex ${chipBase}`}
                style={chipStyle(isActive)}
              >
                {m.icon && <span aria-hidden>{m.icon}</span>}
                {m.name}
                <span className={badgeBase} style={badgeStyle(isActive)}>
                  {counts.get(m.id) ?? 0}
                </span>
              </Pressable>
            );
          })}
        </div>
      ) : (
        <>
          <Pressable
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border px-3 py-1.5 text-left"
            style={{
              backgroundColor: hexToRgba(design.cardColor, design.cardOpacity),
              borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 55)),
              color: design.textColor,
            }}
          >
            <span className="min-w-0">
              <span
                className="block text-[9px] font-semibold uppercase leading-tight tracking-wide"
                style={{ color: design.mutedTextColor }}
              >
                {t.switchMenu}
              </span>
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold leading-tight">
                {activeMenu?.icon && <span aria-hidden>{activeMenu.icon}</span>}
                <span className="truncate">{activeMenu?.name}</span>
              </span>
            </span>
            <span aria-hidden className="ml-1 shrink-0 text-[10px] opacity-60">
              ▼
            </span>
          </Pressable>

          {open && (
            <div
              role="menu"
              aria-label={t.mainMenusTitle}
              className="absolute left-0 top-full z-50 mt-2 w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border shadow-xl"
              style={{
                backgroundColor: design.surfaceColor,
                borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 45)),
              }}
            >
              <p
                className="border-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{
                  borderColor: hexToRgba(design.dividerColor, design.dividerOpacity),
                  color: design.mutedTextColor,
                }}
              >
                {t.mainMenusTitle}
              </p>
              <div className="max-h-[60vh] overflow-y-auto py-1">
                {menus.map((m) => {
                  const isActive = m.id === activeMenuId;
                  return (
                    <Pressable
                      key={m.id}
                      variant="dim"
                      role="menuitemradio"
                      aria-checked={isActive}
                      onClick={() => {
                        onSelect(m.id);
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
                      style={isActive ? { backgroundColor: hexToRgba(design.primaryColor, 10) } : undefined}
                    >
                      <span aria-hidden className="shrink-0 text-xl leading-none">
                        {m.icon || '📋'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-medium leading-tight" style={{ color: design.mutedTextColor }}>
                          {t.digitalMenu}
                        </span>
                        <span className="block truncate text-sm font-semibold leading-snug" style={{ color: design.textColor }}>
                          {m.name}
                        </span>
                      </span>
                      <span
                        className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold"
                        style={{ backgroundColor: hexToRgba(design.primaryColor, 12), color: design.primaryColor }}
                      >
                        {t.itemCount(counts.get(m.id) ?? 0)}
                      </span>
                    </Pressable>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Dil seçici, pencere genişliğine kör bir breakpoint ile değil üst çubukta
 * GERÇEKTEN kalan alanı ölçerek görünüm değiştirir:
 *
 *  • Yan yana dil düğmeleri sığıyorsa eski bölmeli anahtar korunur.
 *  • Logo + menü seçici + diller artık sığmıyorsa menü seçiciyle aynı özel
 *    açılır listeye düşer.
 *
 * Görünmez ölçüm kopyası her zaman bütün dilleri doğal genişliğinde tutar;
 * böylece açılır görünüme geçince genişlik küçülüp kararın ileri geri
 * salınmasına yol açmaz.
 */
function LanguageSwitcher({
  languages,
  locale,
  onSelect,
  design,
  t,
  reserveMenuSpace,
}: {
  languages: { code: string; name: string }[];
  locale: string;
  onSelect: (code: string) => void;
  design: MenuDesignSettings;
  t: UiStrings;
  reserveMenuSpace: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [inline, setInline] = useState(true);
  const [open, setOpen] = useState(false);
  const current = languages.find((language) => language.code === locale) ?? languages[0];

  useEffect(() => {
    const root = rootRef.current;
    const probe = probeRef.current;
    const bar = root?.parentElement;
    if (!root || !probe || !bar || typeof ResizeObserver === 'undefined') return;

    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const barStyle = window.getComputedStyle(bar);
      const horizontalPadding =
        (Number.parseFloat(barStyle.paddingLeft) || 0) + (Number.parseFloat(barStyle.paddingRight) || 0);
      const gap = Number.parseFloat(barStyle.columnGap === 'normal' ? '0' : barStyle.columnGap) || 0;
      const innerWidth = bar.clientWidth - horizontalPadding;
      const brand = bar.querySelector<HTMLElement>('[data-gm-brand]');
      const brandWidth = brand?.getBoundingClientRect().width ?? 0;

      // Çoklu menü varsa sol seçicinin okunabilir/truncate edilebilir bir
      // düğme olarak kalması için en az 112px ayır. MenuSwitcher kalan gerçek
      // alanda kendi sekme/açılır görünüm kararını ayrıca ölçüyor.
      const menuFloor = reserveMenuSpace ? 112 : 0;
      const gaps = reserveMenuSpace ? 2 : 1;
      const needed = brandWidth + probe.scrollWidth + menuFloor + gap * gaps + 10;
      setInline(needed <= innerWidth);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    observer.observe(probe);
    const brand = bar.querySelector<HTMLElement>('[data-gm-brand]');
    if (brand) observer.observe(brand);
    void document.fonts?.ready.then(measure);

    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [languages, reserveMenuSpace]);

  useEffect(() => {
    if (inline) setOpen(false);
  }, [inline]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (languages.length <= 1 || !current) return null;

  const choose = (code: string) => {
    onSelect(code);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative ml-auto shrink-0">
      {/* Ölçüm kopyası görünmezdir ve mevcut görünümden bağımsız olarak bütün
          dil düğmelerinin doğal genişliğini verir. */}
      <div aria-hidden className="pointer-events-none invisible absolute right-0 top-0 h-0 w-0 overflow-hidden">
        <div
          ref={probeRef}
          className="flex w-max overflow-hidden rounded-xl border"
          style={{ borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 55)) }}
        >
          {languages.map((language) => (
            <span key={language.code} className="flex min-w-[46px] flex-col items-center px-2.5 py-1 leading-tight">
              <span className="gm-lang-code">{language.code}</span>
              <span className="gm-lang-name mt-0.5 opacity-80">{language.name}</span>
            </span>
          ))}
        </div>
      </div>

      {inline ? (
        <div
          className="flex overflow-hidden rounded-xl border"
          style={{ borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 55)) }}
          role="group"
          aria-label={t.menuLanguage}
        >
          {languages.map((language) => {
            const isCurrent = language.code === locale;
            return (
              <button
                key={language.code}
                type="button"
                onClick={() => choose(language.code)}
                aria-current={isCurrent ? 'true' : undefined}
                className="flex min-w-[46px] flex-col items-center px-2.5 py-1 leading-tight transition"
                style={isCurrent
                  ? { backgroundColor: design.primaryColor, color: design.surfaceColor }
                  : { color: design.mutedTextColor }}
              >
                <span className="gm-lang-code">{language.code}</span>
                <span className="gm-lang-name mt-0.5 opacity-80">{language.name}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <Pressable
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left"
          style={{
            backgroundColor: hexToRgba(design.cardColor, design.cardOpacity),
            borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 55)),
            color: design.textColor,
          }}
        >
          <span aria-hidden>🌐</span>
          <span className="min-w-0 leading-tight">
            <span className="block text-[9px] font-semibold uppercase tracking-wide" style={{ color: design.mutedTextColor }}>
              {t.menuLanguage}
            </span>
            <span className="block text-xs font-bold uppercase">{current.code}</span>
          </span>
          <span aria-hidden className="text-[9px] opacity-60">▼</span>
        </Pressable>
      )}

      {!inline && open && (
        <div
          role="menu"
          aria-label={t.menuLanguage}
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border shadow-xl"
          style={{
            backgroundColor: design.surfaceColor,
            borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 45)),
          }}
        >
          <p
            className="border-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
            style={{ borderColor: hexToRgba(design.dividerColor, design.dividerOpacity), color: design.mutedTextColor }}
          >
            {t.menuLanguage}
          </p>
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {languages.map((language) => {
              const isCurrent = language.code === locale;
              return (
                <Pressable
                  key={language.code}
                  variant="dim"
                  role="menuitemradio"
                  aria-checked={isCurrent}
                  onClick={() => choose(language.code)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
                  style={isCurrent ? { backgroundColor: hexToRgba(design.primaryColor, 10) } : undefined}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase"
                    style={{ backgroundColor: hexToRgba(design.primaryColor, 12), color: design.primaryColor }}
                  >
                    {language.code}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold" style={{ color: design.textColor }}>
                    {language.name}
                  </span>
                  {isCurrent && <span aria-hidden style={{ color: design.primaryColor }}>✓</span>}
                </Pressable>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function GuestMenu({
  venue: initialVenue,
  categories: initialCategories,
  menus = [],
  venueId,
  availableLocales,
  currentLocale,
  translations = {},
  ad = null,
}: {
  venue: GuestVenue;
  categories: GuestCategory[];
  menus?: GuestMenuSummary[];
  venueId: string;
  availableLocales: { code: string; name: string }[];
  currentLocale: string;
  translations?: GuestTranslations;
  /** Açılış ekranında gösterilecek reklam (Rota panelinden atanır). Yoksa null. */
  ad?: GuestAd | null;
}) {
  // Tasarım Stüdyosu'ndaki VE Görseller sayfasındaki maket bu bileşeni
  // YALNIZCA bir kez (ilk yüklemede) yükler; sonraki her değişiklik tam
  // sayfa yeniden yükleme yerine postMessage ile buraya iletilir ve
  // doğrudan bu state'leri günceller — network/DB round-trip olmadığı için
  // anında yansır. (bkz. studyo/tasarim/design-studio.tsx ve
  // studyo/gorseller/image-manager.tsx → LivePreview)
  /**
   * Dil değişimi — ANINDA, istemci tarafında (referans menü davranışı).
   *
   * Sunucu artık TÜM dillerin çevirilerini `translations` sözlüğü olarak
   * gönderiyor (bkz. m/[slug]/page.tsx); düğmeye basınca yalnızca `locale`
   * state'i değişir ve içerik network'e çıkmadan yeniden çizilir. Adres
   * çubuğundaki `?lang=` yine güncellenir (replaceState) ki bağlantı
   * paylaşılır/yenilenirse aynı dilde açılsın — ama SAYFA YÜKLENMEZ.
   *
   * (Tarihçe: önce tam gezinme kullanılıyordu — güvenilirdi ama her dil
   * değişimi 1-2 saniyelik beyaz ekran demekti. `router.push` denemesi ise
   * Next'in yönlendirici önbelleği yüzünden içeriği tazelemiyordu. Çözüm,
   * çevirileri baştan istemciye indirmek oldu.)
   */
  const [locale, setLocale] = useState(currentLocale);
  function switchLocale(code: string) {
    setLocale(code);
    try {
      const params = new URLSearchParams(window.location.search);
      if (code === 'tr') params.delete('lang');
      else params.set('lang', code);
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    } catch {
      /* replaceState kısıtlı bir ortamda çalışmazsa dil yine de değişir */
    }
  }

  const t = uiStrings(locale);

  const [design, setDesign] = useState<MenuDesignSettings>(initialVenue.design);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialVenue.logoUrl);
  const venue = useMemo(() => ({ ...initialVenue, design, logoUrl }), [initialVenue, design, logoUrl]);
  const [categories, setCategories] = useState<GuestCategory[]>(initialCategories);

  // Seçili dile çevrilmiş kategoriler — dil değişince yalnızca bu memo
  // yeniden hesaplanır, network'e çıkılmaz. Kaynak dilde (tr) sözlük boş
  // döner ve `categories` olduğu gibi kullanılır.
  const localizedCategories = useMemo(
    () => localizeCategories(categories, locale, translations),
    [categories, locale, translations]
  );

  // Çoklu menü şeridi: yalnızca birden fazla menü varsa anlamlı. Tek menüde
  // (venue'lerin büyük çoğunluğu) `menus.length <= 1` olur, şerit hiç
  // render edilmez ve `visibleCategories === localizedCategories` olduğu için
  // görsel davranış eskisiyle birebir aynı kalır.
  const [activeMenuId, setActiveMenuId] = useState<string | null>(menus[0]?.id ?? null);
  const showMenuSwitcher = menus.length > 1;
  const visibleCategories = useMemo(
    () =>
      showMenuSwitcher && activeMenuId
        ? localizedCategories.filter((c) => c.menuId === activeMenuId)
        : localizedCategories,
    [localizedCategories, showMenuSwitcher, activeMenuId]
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
  /** Mekan kartından açılan paneller: tüm hafta saatleri ve mekan galerisi. */
  const [showWeekHours, setShowWeekHours] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  /** "Tümü" çipi artık ilk kategoriye değil, görselli kategori ızgarasına götürür. */
  const categoryGridRef = useRef<HTMLElement>(null);
  /**
   * Açılış (splash) ekranı — referanstaki gibi menü yüklenirken tam ekran
   * marka kartı. Sıra şudur: splash (~2,2 sn) → kapanır → karşılama popup'ı.
   * İkisi TEK bir "giriş" olarak sayılır ve oturum başına bir kez gösterilir;
   * misafir menüde gezinip geri dönünce tekrar karşılaşmaz.
   */
  // İlk HTML karesinde de splash görünür olmalı. `hidden` ile başlatılırsa
  // useEffect tarayıcıda çalışana kadar menü bir an görünür, ardından splash
  // üstüne gelirdi. Bu ters sıralama özellikle yavaş telefonlarda belirgindi.
  const [splash, setSplash] = useState<'hidden' | 'visible' | 'fading'>('visible');
  useEffect(() => {
    const key = `ros:intro-seen:${venue.name}`;
    try {
      if (window.sessionStorage.getItem(key)) {
        setSplash('hidden');
        return;
      }
      window.sessionStorage.setItem(key, '1');
    } catch {
      /* gizlilik modunda sessionStorage kapalıysa yine göster, sorun değil */
    }
    // Reklam varsa süreyi REKLAM belirler (Rota panelinden ayarlanan saniye);
    // yoksa eski marka açılışının 3,2 sn + 0,8 sn kaybolma ritmi korunur.
    const holdMs = ad ? ad.durationSeconds * 1000 : 3200;
    const fade = window.setTimeout(() => setSplash('fading'), holdMs);
    const done = window.setTimeout(() => {
      setSplash('hidden');
      if (venue.announcement) setShowAnnouncement(true);
    }, holdMs + 800);
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
        <p className="text-stone-500">{t.menuBeingPrepared}</p>
      </main>
    );
  }

  /**
   * Referans tipografi ölçeği (rotamenu.vercel.app / styles.css) — BİREBİR.
   *
   * Bütün boyutlar `--gm-base` (İnce Ayar'daki baseFontSize) üzerinden calc
   * ile türetilir; büyük başlıklar ayrıca `headingScale`'e uyar. Curated
   * temaların varsayılanı (base 16, headingScale 1.3) referansın 1rem
   * ölçeğine denk gelir — yani varsayılan temada boyutlar referansla piksel
   * piksel aynıdır, İnce Ayar kaydırıcıları yine de çalışır.
   *
   * Hover davranışları da referanstan: ürün satırı 1px yukarı kalkar ve
   * kenarlığı vurgu rengine döner; kart görselleri .4s'lik yumuşak bir
   * ölçekle (1.04) büyür. Yalnız gerçek imleçli cihazlarda (hover:hover) —
   * dokunmatikte basış geri bildirimi zaten Pressable'da.
   */
  const hs = design.headingScale / 1.3; // curated varsayılanında 1 → referansla birebir
  const gmCss = `
${customFontFaceCss(design)}
.gm-root{--gm-base:${design.baseFontSize}px}
.gm-hero-eyebrow{font-size:calc(var(--gm-base)*.66);font-weight:700;letter-spacing:.18em;text-transform:uppercase}
.gm-hero-title{font-weight:600;line-height:.88;letter-spacing:-.05em;font-size:clamp(calc(var(--gm-base)*${(2.8 * hs).toFixed(3)}),9vw,calc(var(--gm-base)*${(5.5 * hs).toFixed(3)}))}
.gm-hero-count{font-size:calc(var(--gm-base)*.78);font-weight:600}
.gm-cat-number{font-size:calc(var(--gm-base)*.62);font-weight:700;letter-spacing:.02em}
.gm-cat-title{font-weight:600;line-height:1;letter-spacing:-.035em;font-size:clamp(calc(var(--gm-base)*${(1.9 * hs).toFixed(3)}),5vw,calc(var(--gm-base)*${(3 * hs).toFixed(3)}))}
.gm-cat-count{font-size:calc(var(--gm-base)*.68)}
.gm-item-name{font-weight:600;line-height:1.2;font-size:calc(var(--gm-base)*.92)}
.gm-item-price{font-weight:700;white-space:nowrap;font-size:calc(var(--gm-base)*.67)}
.gm-item-desc{font-size:calc(var(--gm-base)*.72);line-height:1.48}
.gm-thumb{width:92px;height:105px}
.gm-chip{font-size:calc(var(--gm-base)*.76);font-weight:600}
.gm-search{height:56px}
.gm-search input{font-size:var(--gm-base)}
.gm-allergen-chip{font-size:calc(var(--gm-base)*.52);font-weight:700;letter-spacing:.01em}
.gm-feat-name{font-weight:600;line-height:1.2;font-size:calc(var(--gm-base)*1.05)}
.gm-feat-price{font-weight:700;white-space:nowrap;font-size:calc(var(--gm-base)*.78)}
.gm-feat-desc{font-size:calc(var(--gm-base)*.83);line-height:1.4}
.gm-feat-badge{font-size:calc(var(--gm-base)*.6);font-weight:700}
.gm-picks-eyebrow{font-size:calc(var(--gm-base)*.62);font-weight:700;letter-spacing:.15em;text-transform:uppercase}
.gm-picks-title{font-weight:600;line-height:1;letter-spacing:-.02em;font-size:clamp(calc(var(--gm-base)*${(1.8 * hs).toFixed(3)}),5vw,calc(var(--gm-base)*${(2.6 * hs).toFixed(3)}))}
.gm-modal-title{font-weight:600;line-height:1.05;letter-spacing:-.02em;font-size:calc(var(--gm-base)*2)}
.gm-modal-price{font-weight:700;font-size:calc(var(--gm-base)*1.1)}
.gm-modal-desc{font-size:var(--gm-base);line-height:1.55}
.gm-modal-label{font-size:calc(var(--gm-base)*.63);font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.gm-lang-code{font-size:calc(var(--gm-base)*.76);font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.gm-lang-name{font-size:calc(var(--gm-base)*.52);font-weight:600}
@media(min-width:521px){
  .gm-item-name{font-size:var(--gm-base)}
  .gm-item-price{font-size:calc(var(--gm-base)*.78)}
  .gm-thumb{width:108px;height:108px}
}
@media(min-width:760px){
  .gm-hero{min-height:320px}
}
.gm-img-zoom img{transition:transform .4s ease}
@media(hover:hover){
  .gm-card{transition:transform .18s ease,border-color .18s ease}
  .gm-card:hover{transform:translateY(-1px)}
  .gm-card--bordered:hover{border-color:color-mix(in srgb,${design.accentColor},white 55%)!important}
  .gm-card:hover .gm-img-zoom img,.gm-feat:hover .gm-img-zoom img{transform:scale(1.04)}
}
@media(prefers-reduced-motion:reduce){
  .gm-card:hover{transform:none}
  .gm-card:hover .gm-img-zoom img,.gm-feat:hover .gm-img-zoom img{transform:none}
}`;

  return (
    <div
      /* Genişlik: telefon ve tabletlerde ekranın tamamını kullan. `max-w-lg`
         geniş ekranlı/katlanabilir telefonlarda 512px sınırını erken devreye
         sokup sağda boş bir şerit bırakıyordu. Yalnız gerçek masaüstü
         düzeninde genişliği sınırla ve kart görünümüne geç. */
      /* lang: CSS `text-transform: uppercase` büyük harfe çevirirken dil
         kuralına bakar — sayfa kökü lang="tr" olduğu için İngilizce menüde
         "FİLTERS" gibi noktalı İ çıkıyordu. Seçili dili buraya işlemek
         hem bunu düzeltir hem ekran okuyucuya doğru dili söyler. */
      lang={locale}
      className="gm-root mx-auto min-h-screen w-full pb-16 shadow-sm lg:my-4 lg:max-w-6xl lg:rounded-2xl"
      style={{
        ...menuBackgroundStyle(design),
        color: design.textColor,
        fontFamily: design.bodyFont,
        fontSize: `${design.baseFontSize}px`,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: gmCss }} />
      {/* DİKKAT: dış kapsayıcıda overflow-hidden OLMAMALI — position:sticky'nin
          "en yakın scroll ata"sını buraya sabitler ve nav'ı kırar. Yuvarlak
          köşe kırpma bunun yerine header/footer'ın kendi üzerinde yapılır. */}
      {splash !== 'hidden' && (
        <SplashScreen
          venue={venue}
          design={design}
          t={t}
          fading={splash === 'fading'}
          ad={ad}
          venueId={venueId}
        />
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
        <div data-gm-brand className="flex shrink-0 items-center gap-2">
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
          <MenuSwitcher
            menus={menus}
            activeMenuId={activeMenuId}
            counts={menuItemCounts}
            onSelect={setActiveMenuId}
            design={design}
            t={t}
          />
        )}
        <LanguageSwitcher
          languages={availableLocales}
          locale={locale}
          onSelect={switchLocale}
          design={design}
          t={t}
          reserveMenuSpace={showMenuSwitcher}
        />
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
          className="gm-hero relative w-full bg-cover bg-center"
          style={{
            // Referans hero'su geniş bir açılış bloğu: min 260px (masaüstünde
            // 320 — bkz. gmCss'teki .gm-hero medya kuralı). İnce Ayar'daki
            // headerHeight bundan büyükse o kazanır.
            height: `${Math.max(design.headerHeight, 260)}px`,
            ...(venue.coverUrl
              ? { backgroundImage: `url(${venue.coverUrl})` }
              : { background: `linear-gradient(135deg, ${design.primaryColor}, ${design.accentColor})` }),
          }}
        >
          {/* Referanstaki hero tipografisi: üstte küçük harflendirilmiş etiket,
              altında (varsa menü ikonuyla) BÜYÜK serif başlık ve "60 ürün ·
              9 kategori" sayacı — hepsi referanstaki gibi SOL-ALT köşede
              (align-items:end). Çoklu menülü işletmede başlık AKTİF MENÜNÜN
              adıdır (sekme değişince değişir); tek menülüde işletmenin adı
              kalır — tek menüde menü adı çoğu zaman jenerik ("Menü") olduğu
              için işletme adı daha anlamlı. */}
          <div className="absolute inset-0 flex flex-col justify-end px-5 pb-8">
            <span className="gm-hero-eyebrow" style={heroSubStyle}>
              {showMenuSwitcher ? venue.name : t.digitalMenu}
            </span>
            <h1
              className="gm-hero-title mt-1 flex items-center gap-2"
              style={{
                fontFamily: design.headingFont,
                ...heroTextStyle,
              }}
            >
              {showMenuSwitcher && activeMenu?.icon && <span aria-hidden>{activeMenu.icon}</span>}
              {showMenuSwitcher ? activeMenu?.name ?? venue.name : venue.name}
            </h1>
            <span className="gm-hero-count mt-3" style={heroSubStyle}>
              {t.itemsAndCategories(visibleItemTotal, visibleCategories.length)}
            </span>
          </div>
          {/* Logo artık üstteki sabit çubukta duruyor (referanstaki gibi) —
              kapak şeridinde ikinci kez göstermek başlıkla çakışıyordu. */}
        </div>

        {/* Mekan kartı: tanıtım + iletişim/sosyal ikonları + bugünün saati.
            Müşteri talebi A2–A6 — hepsi ilk açılış ekranında görünür. */}
        <VenueInfoCard
          venue={venue}
          design={design}
          t={t}
          onOpenWeek={() => setShowWeekHours(true)}
          onOpenPhotos={() => setShowPhotos(true)}
        />
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
          className="gm-search flex items-center gap-2.5 rounded-xl border px-4"
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
            className="min-w-0 flex-1 bg-transparent outline-none"
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
              // Müşteri talebi A1: "Tümü"ye basınca görselli kategori ızgarası
              // görünsün. Izgara sayfada duruyor; buraya kaydırmak hem talebi
              // karşılıyor hem de ilk kategoriye atlamaktan daha anlaşılır.
              if (categoryGridRef.current) {
                categoryGridRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
              }
              const first = renderedCategories[0]?.id;
              if (first) goTo(first);
            }}
            className="gm-chip whitespace-nowrap rounded-full border px-4 py-[9px]"
            style={{
              backgroundColor: hexToRgba(design.cardColor, design.cardOpacity),
              borderColor: hexToRgba(design.dividerColor, design.dividerOpacity),
              color: design.mutedTextColor,
            }}
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
                className="gm-chip flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-[9px]"
                style={isActive
                  ? { backgroundColor: design.primaryColor, borderColor: design.primaryColor, color: design.surfaceColor }
                  : {
                      backgroundColor: hexToRgba(design.cardColor, design.cardOpacity),
                      borderColor: hexToRgba(design.dividerColor, design.dividerOpacity),
                      color: design.mutedTextColor,
                    }}
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

      {showWeekHours && venue.hours && (venue.hours.week.length > 0) && (
        <WeekHoursSheet hours={venue.hours} design={design} t={t} onClose={() => setShowWeekHours(false)} />
      )}

      {showPhotos && venue.photos.length > 0 && (
        <PhotoGallerySheet photos={venue.photos} design={design} t={t} onClose={() => setShowPhotos(false)} />
      )}

      {availableAllergenCodes.length > 0 && (
        <div className="relative z-10 px-4 pt-4">
          <section
            aria-labelledby="allergen-filters-title"
            className="rounded-2xl border p-3.5 sm:p-4"
            style={{
              background: `linear-gradient(135deg, ${hexToRgba(design.primaryColor, 10)}, ${hexToRgba(design.surfaceColor, 98)})`,
              borderColor: hexToRgba(design.primaryColor, 34),
              boxShadow: `0 8px 24px ${hexToRgba(design.primaryColor, 9)}`,
            }}
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                style={{
                  backgroundColor: hexToRgba(design.primaryColor, 14),
                  borderColor: hexToRgba(design.primaryColor, 30),
                  color: design.primaryColor,
                }}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3.5 19 6v5.2c0 4.5-2.8 7.8-7 9.3-4.2-1.5-7-4.8-7-9.3V6l7-2.5Z" strokeLinejoin="round" />
                  <path d="M12 8v4.5M12 16h.01" strokeLinecap="round" />
                </svg>
              </span>
              <div className="min-w-0">
                <h2
                  id="allergen-filters-title"
                  className="text-sm font-extrabold uppercase tracking-[0.12em]"
                  style={{ fontFamily: design.headingFont, color: design.textColor }}
                >
                  {t.allergenFilters}
                </h2>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: design.mutedTextColor }}>
                  {t.allergenFiltersHint}
                </p>
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {availableAllergenCodes.map((code) => {
                const hidden = hiddenAllergens.has(code);
                return (
                  <Pressable
                    key={code}
                    onClick={() => toggleAllergen(code)}
                    aria-pressed={hidden}
                    className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold"
                    style={hidden
                      ? {
                          backgroundColor: design.primaryColor,
                          borderColor: design.primaryColor,
                          color: design.surfaceColor,
                          boxShadow: `0 4px 12px ${hexToRgba(design.primaryColor, 22)}`,
                        }
                      : {
                          backgroundColor: hexToRgba(design.surfaceColor, 94),
                          borderColor: hexToRgba(design.primaryColor, 28),
                          color: design.textColor,
                        }}
                  >
                    {allergenLabel(code, locale)}
                    <span className="font-medium opacity-70">{hidden ? t.hidden : t.hideContaining}</span>
                  </Pressable>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {featuredItems.length > 0 && (
        <div ref={featuredRef} className="relative z-10 scroll-mt-28 px-4 pt-6">
          <p className="gm-picks-eyebrow px-0.5" style={{ color: design.accentColor }}>
            {venue.name}
          </p>
          <div className="mt-1 flex items-end justify-between gap-3 px-0.5">
            <h2
              className="gm-picks-title flex items-center gap-2"
              style={{ fontFamily: design.headingFont, color: design.textColor }}
            >
              <span style={{ color: design.accentColor }} aria-hidden>★</span>
              {t.chefPicks}
            </h2>
            <span className="gm-cat-count shrink-0 pb-1" style={{ color: design.mutedTextColor }}>
              {t.chefPicksNote}
            </span>
          </div>
          {/* Telefonda referanstaki gibi GENİŞ (82vw), kaydırma kilitli
              (scroll-snap) kartlar; masaüstünde yan yana ızgara. */}
          <div className="mt-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-2 [scrollbar-width:none] lg:grid lg:grid-cols-4 lg:snap-none lg:overflow-visible [&::-webkit-scrollbar]:hidden">
            {featuredItems.map((it) => (
              <Pressable
                key={it.id}
                onClick={() => openItem(it)}
                className="gm-feat w-[min(82vw,330px)] shrink-0 snap-start overflow-hidden border text-left lg:w-auto"
                style={{
                  borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 55)),
                  borderRadius: `${Math.min(design.cardRadius, 17)}px`,
                  backgroundColor: hexToRgba(design.cardColor, design.cardOpacity),
                  boxShadow: `${hexToRgba(design.primaryColor, 8)} 0 8px 24px`,
                }}
              >
                {/* Referans: 4/3 oranlı görsel; kart hover'ında .4s'de 1.04'e
                    büyür (gm-img-zoom). Rozet SAĞ üstte. */}
                <div className="gm-img-zoom relative aspect-[4/3] w-full overflow-hidden">
                  <ItemThumb item={it} design={design} className="h-full w-full" showCaption t={t} />
                  <span
                    className="gm-feat-badge absolute right-3 top-3 rounded-[7px] px-2 py-1.5"
                    style={{ backgroundColor: design.primaryColor, color: design.surfaceColor }}
                  >
                    {t.chefPick}
                  </span>
                </div>
                <div className="p-[15px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="gm-feat-name min-w-0 truncate" style={{ color: design.textColor, fontFamily: design.headingFont }}>{it.name}</p>
                    {it.price != null && (
                      <p className="gm-feat-price shrink-0" style={{ color: design.priceColor ?? design.primaryColor }}>
                        {formatPrice(it.price, venue.currency)}
                      </p>
                    )}
                  </div>
                  {it.description && (
                    <p className="gm-feat-desc mt-1.5 line-clamp-2" style={{ color: design.mutedTextColor }}>
                      {it.description}
                    </p>
                  )}
                  <AllergenLine item={it} design={design} t={t} locale={locale} />
                </div>
              </Pressable>
            ))}
          </div>
        </div>
      )}

      {/* Görselli kategori butonları (A1/A7): Şefin Seçtikleri'nden HEMEN
          sonra, yan yana ikili ızgara. Yalnız "Tümü" seçiliyken ve arama/
          filtre yokken gösterilir — tek bir kategoriye süzülmüşken kategori
          ızgarası göstermek anlamsız olur. */}
      {!needle && (
        <CategoryGrid
          sectionRef={categoryGridRef}
          categories={renderedCategories}
          design={design}
          t={t}
          onPick={goTo}
        />
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
                      className={`flex w-full items-start text-left ${
                        design.layout === 'single' ? 'gm-card gm-card--bordered gap-3.5 border p-2.5' : 'gm-card gap-3 py-2'
                      }`}
                      style={{
                        backgroundColor: design.layout === 'single' ? hexToRgba(design.cardColor, design.cardOpacity) : 'transparent',
                        // Referans ürün kartı: radius 13, ince kenarlık, çok
                        // hafif renkli gölge (0 4px 15px, ~%2.5).
                        borderRadius: design.layout === 'single' ? `${Math.min(design.cardRadius, 13)}px` : 0,
                        borderColor: design.layout === 'single' ? hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 45)) : 'transparent',
                        borderBottom: design.layout === 'two-column' ? `1px dashed ${hexToRgba(design.dividerColor, design.dividerOpacity)}` : undefined,
                        boxShadow: design.layout === 'single' ? `${hexToRgba(design.primaryColor, 4)} 0 4px 15px` : undefined,
                      }}
                    >
                      {design.layout === 'single' && (
                        <div className="gm-thumb gm-img-zoom shrink-0 overflow-hidden" style={{ borderRadius: '9px' }}>
                          <ItemThumb item={it} design={design} className="h-full w-full" t={t} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 py-0.5">
                        <div className="flex items-baseline justify-between gap-2.5">
                          <h3 className="gm-item-name" style={{ color: design.textColor, fontFamily: design.headingFont }}>{it.name}</h3>
                          {it.price != null && (
                            <span className="gm-item-price shrink-0" style={{ color: design.priceColor ?? design.primaryColor }}>
                              {formatPrice(it.price, venue.currency)}
                            </span>
                          )}
                        </div>
                        {it.description && (
                          <p className="gm-item-desc mt-1.5 line-clamp-2" style={{ color: design.mutedTextColor }}>
                            {it.description}
                          </p>
                        )}
                        <AllergenLine item={it} design={design} t={t} locale={locale} />
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
                              <AllergenLine item={it} design={design} t={t} locale={locale} />
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
          locale={locale}
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
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {numberLabel && (
            <span className="gm-cat-number mb-1 block" style={{ color: design.accentColor }}>
              {numberLabel}
            </span>
          )}
          <h2 className="gm-cat-title" style={{ color: design.textColor, fontFamily: design.headingFont }}>
            {name}
          </h2>
        </div>
        {itemCount != null && (
          <span className="gm-cat-count shrink-0 pb-1" style={{ color: design.mutedTextColor }}>
            {t.itemCount(itemCount)}
          </span>
        )}
      </div>
      {/* Referansta bu çizgi ince gri değil, metin rengiyle basılmış KALIN
          bir ayraç — kategoriyi bir dergi bölüm başlığı gibi ayırıyor. */}
      <div className="mt-[17px] h-[2px] w-full" style={{ backgroundColor: hexToRgba(design.textColor, 88) }} />
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
/**
 * Dışarıya açılan bağlantılar için son savunma katmanı.
 *
 * NEDEN render tarafında da süzüyoruz: `/api/venue` artık http/https zorunlu
 * kılıyor, ama `venues` tablosuna PostgREST üzerinden DOĞRUDAN da yazılabiliyor
 * (RLS sütun kısıtı yok — bkz. güvenlik raporu). Yani API'deki doğrulama
 * atlanabilir; misafire basılan `href` burada bir kez daha süzülmeli.
 */
function safeHref(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^(tel:|mailto:)/i.test(v)) return v;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
}

/** Mekan kartındaki yuvarlak eylem düğmesi (ikon + altında etiket). */
function VenueAction({
  href,
  onClick,
  label,
  children,
  design,
}: {
  href?: string | null;
  onClick?: () => void;
  label: string;
  children: React.ReactNode;
  design: MenuDesignSettings;
}) {
  const inner = (
    <>
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full border"
        style={{
          borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 45)),
          backgroundColor: hexToRgba(design.primaryColor, 10),
          color: design.primaryColor,
        }}
      >
        {children}
      </span>
      <span className="mt-1 text-[11px] font-medium leading-tight" style={{ color: design.mutedTextColor }}>
        {label}
      </span>
    </>
  );
  const cls = 'flex w-16 shrink-0 flex-col items-center text-center';
  if (href) {
    return (
      <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/**
 * MEKAN KARTI — müşteri talebi A2–A6.
 *
 * İlk açılış ekranında, kapak şeridinin hemen altında: tanıtım metni, mekanın
 * telefonu (tıklayınca arar), konumu (Maps), sosyal medya hesapları, Google
 * değerlendirme bağlantısı, mekan görselleri ve BUGÜNÜN çalışma saati.
 * "Tüm hafta" ayrı bir panelde açılır — kart kalabalıklaşmasın.
 */
function VenueInfoCard({
  venue,
  design,
  t,
  onOpenWeek,
  onOpenPhotos,
}: {
  venue: GuestVenue;
  design: MenuDesignSettings;
  t: UiStrings;
  onOpenWeek: () => void;
  onOpenPhotos: () => void;
}) {
  const tel = venue.phone ? `tel:${venue.phone.replace(/\s/g, '')}` : null;
  const maps = safeHref(venue.googleMapsUrl);
  const review = safeHref(venue.googleReviewUrl);
  const igHandle = venue.instagram
    ? venue.instagram
        .replace(/^@/, '')
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
        .replace(/\/$/, '')
    : null;
  const ig = igHandle ? `https://instagram.com/${encodeURIComponent(igHandle)}` : null;
  const waDigits = venue.whatsapp?.replace(/[^\d]/g, '') || null;
  const wa = waDigits ? `https://wa.me/${waDigits}` : null;

  const today = venue.hours?.today ?? null;
  const hasWeek = (venue.hours?.week?.length ?? 0) > 0;
  const hoursText = today
    ? today.closed
      ? t.closedToday
      : today.range
    : venue.hours?.fallback ?? null;

  const actions =
    Boolean(tel) || Boolean(maps) || Boolean(ig) || Boolean(wa) || Boolean(review) || venue.photos.length > 0;

  if (!venue.description && !hoursText && !actions) return null;

  return (
    <div className="px-5 pt-3 pb-4">
      {venue.description && (
        <p className="text-sm leading-relaxed" style={{ color: design.mutedTextColor }}>
          {venue.description}
        </p>
      )}

      {hoursText && (
        <button
          type="button"
          onClick={hasWeek ? onOpenWeek : undefined}
          disabled={!hasWeek}
          className="mt-3 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium disabled:cursor-default"
          style={{
            borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 45)),
            color: design.textColor,
          }}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden {...strokeProps}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span style={{ color: design.mutedTextColor }}>{t.today}</span>
          <span>{hoursText}</span>
          {today?.openNow !== null && today?.openNow !== undefined && !today.closed && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              style={
                today.openNow
                  ? { backgroundColor: hexToRgba('#16a34a', 14), color: '#15803d' }
                  : { backgroundColor: hexToRgba(design.mutedTextColor, 14), color: design.mutedTextColor }
              }
            >
              {today.openNow ? t.openNow : t.closedNow}
            </span>
          )}
          {hasWeek && (
            <span className="ml-0.5 underline underline-offset-2" style={{ color: design.primaryColor }}>
              {t.weekHours}
            </span>
          )}
        </button>
      )}

      {actions && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tel && (
            <VenueAction href={tel} label={t.callVenue} design={design}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden {...strokeProps}>
                <path d="M4 5c0-.6.4-1 1-1h2.5c.5 0 .9.3 1 .8l.8 3c.1.4 0 .8-.4 1L7.5 10a12 12 0 0 0 6.5 6.5l1.2-1.4c.3-.3.7-.4 1-.3l3 .8c.5.1.8.5.8 1V19c0 .6-.4 1-1 1A15 15 0 0 1 4 5Z" />
              </svg>
            </VenueAction>
          )}
          {maps && (
            <VenueAction href={maps} label={t.getDirections} design={design}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden {...strokeProps}>
                <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
            </VenueAction>
          )}
          {ig && (
            <VenueAction href={ig} label="Instagram" design={design}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden {...strokeProps}>
                <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
              </svg>
            </VenueAction>
          )}
          {wa && (
            <VenueAction href={wa} label="WhatsApp" design={design}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden {...strokeProps}>
                <path d="M20 12a8 8 0 0 1-11.9 7L4 20l1.1-3.9A8 8 0 1 1 20 12Z" />
                <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5.6 0 1-.5 1-1l-1.4-.7-.9.9a5 5 0 0 1-2.4-2.4l.9-.9L11 9.5c0-.5-.4-1-1-1s-1 .4-1 1Z" />
              </svg>
            </VenueAction>
          )}
          {review && (
            <VenueAction href={review} label={t.rateOnGoogle} design={design}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden {...strokeProps}>
                <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8L12 4Z" />
              </svg>
            </VenueAction>
          )}
          {venue.photos.length > 0 && (
            <VenueAction onClick={onOpenPhotos} label={t.venuePhotos} design={design}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden {...strokeProps}>
                <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
                <circle cx="9" cy="10" r="1.6" />
                <path d="m4.5 17 4.6-4.3 3.2 3 2.5-2.2 4.7 4.2" />
              </svg>
            </VenueAction>
          )}
        </div>
      )}
    </div>
  );
}

/** Tüm hafta çalışma saatleri paneli (A3). */
function WeekHoursSheet({
  hours,
  design,
  t,
  onClose,
}: {
  hours: GuestHours;
  design: MenuDesignSettings;
  t: UiStrings;
  onClose: () => void;
}) {
  const todayIndexName = hours.today && !hours.today.closed ? null : null;
  return (
    <Sheet
      open
      onClose={onClose}
      label={t.openingHours}
      placement="bottom"
      panelClassName="ros-draggable flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl shadow-2xl sm:rounded-3xl"
      panelStyle={{ backgroundColor: design.surfaceColor, color: design.textColor }}
    >
      <>
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: hexToRgba(design.dividerColor, design.dividerOpacity) }}
        >
          <h2 className="text-base font-semibold" style={{ fontFamily: design.headingFont }}>
            {t.openingHours}
          </h2>
          <button type="button" onClick={onClose} aria-label={t.close} style={{ color: design.mutedTextColor }}>
            ✕
          </button>
        </div>
        <ul className="overflow-y-auto px-5 py-3">
          {hours.week.map((row) => (
            <li
              key={row.name}
              className="flex items-center justify-between border-b py-2.5 text-sm last:border-b-0"
              style={{ borderColor: hexToRgba(design.dividerColor, Math.round(design.dividerOpacity / 2)) }}
            >
              <span style={{ color: design.textColor }}>{row.name}</span>
              <span style={{ color: row.closed ? design.mutedTextColor : design.textColor }}>{row.text}</span>
            </li>
          ))}
        </ul>
        {todayIndexName}
      </>
    </Sheet>
  );
}

/** Mekan görselleri galerisi (B7). */
function PhotoGallerySheet({
  photos,
  design,
  t,
  onClose,
}: {
  photos: GuestPhoto[];
  design: MenuDesignSettings;
  t: UiStrings;
  onClose: () => void;
}) {
  return (
    <Sheet
      open
      onClose={onClose}
      label={t.venuePhotos}
      placement="bottom"
      panelClassName="ros-draggable flex max-h-[85vh] w-full max-w-2xl flex-col rounded-t-3xl shadow-2xl sm:rounded-3xl"
      panelStyle={{ backgroundColor: design.surfaceColor, color: design.textColor }}
    >
      <>
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: hexToRgba(design.dividerColor, design.dividerOpacity) }}
        >
          <h2 className="text-base font-semibold" style={{ fontFamily: design.headingFont }}>
            {t.venuePhotos}
          </h2>
          <button type="button" onClick={onClose} aria-label={t.close} style={{ color: design.mutedTextColor }}>
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 overflow-y-auto p-4 sm:grid-cols-3">
          {photos.map((p) => (
            <figure key={p.url} className="overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption ?? ''} loading="lazy" className="h-40 w-full object-cover" />
              {p.caption && (
                <figcaption className="px-1 pt-1 text-[11px]" style={{ color: design.mutedTextColor }}>
                  {p.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </>
    </Sheet>
  );
}

/**
 * GÖRSELLİ KATEGORİ BUTONLARI — müşteri talebi A1 / A7.
 *
 * "Şefin Seçtikleri"nden sonra, yan yana İKİLİ ve aşağı doğru devam eden bir
 * ızgara. Kategorinin kendi görseli (categories.background_url) varsa o
 * kullanılır; yoksa markanın renklerinden türeyen bir gradyan + kategori
 * baş harfi basılır — görsel yüklenmemiş mekanlarda ızgara boş kutulara
 * dönüşmesin diye.
 */
function CategoryGrid({
  categories,
  design,
  t,
  onPick,
  sectionRef,
}: {
  categories: GuestCategory[];
  design: MenuDesignSettings;
  t: UiStrings;
  onPick: (id: string) => void;
  sectionRef?: React.RefObject<HTMLElement>;
}) {
  if (categories.length === 0) return null;
  return (
    <section ref={sectionRef} className="relative z-10 scroll-mt-28 px-4 pt-8">
      <h2
        className="mb-3 text-xs font-semibold uppercase tracking-[0.18em]"
        style={{ color: design.mutedTextColor }}
      >
        {t.browseCategories}
      </h2>
      {/* Buton yüksekliği bilinçli olarak TEK SATIR metne göre: görsel kartın
          konusu değil, adın çerçevesi. Büyük kartlar 28 kategorili menüde
          ekranı doldurup listeyi görünmez kılıyordu. */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Pressable
            key={c.id}
            onClick={() => onPick(c.id)}
            className="group relative flex h-11 items-center overflow-hidden rounded-xl border text-left sm:h-12"
            style={{
              borderColor: hexToRgba(design.dividerColor, design.dividerOpacity),
              backgroundColor: hexToRgba(design.cardColor, design.cardOpacity),
            }}
          >
            {c.backgroundUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.backgroundUrl}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ objectPosition: `center ${c.backgroundPositionY}%` }}
                />
                {/* Bu boyutta okunurluk için düz perde: dikey gradyan tek
                    satırlık metinde yeterli kontrast bırakmıyor. */}
                <div className="absolute inset-0 bg-black/45" />
              </>
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, ${hexToRgba(design.primaryColor, 90)}, ${hexToRgba(
                    design.accentColor,
                    75
                  )})`,
                }}
              />
            )}
            <div className="relative flex min-w-0 flex-1 items-baseline gap-1.5 px-3">
              <span
                className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-none text-white drop-shadow-sm"
                style={{ fontFamily: design.headingFont }}
              >
                {c.name}
              </span>
              <span className="shrink-0 text-[11px] font-medium tabular-nums text-white/75">
                {c.items.length}
              </span>
            </div>
          </Pressable>
        ))}
      </div>
    </section>
  );
}

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
          <img src={item.imageUrl} alt={item.name} className="h-[250px] w-full object-cover" />
        )}
        <div className="p-7">
          <div className="flex items-start justify-between gap-3">
            <h2 className="gm-modal-title" style={{ fontFamily: design.headingFont }}>
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
            <p className="gm-modal-price mt-3.5" style={{ color: design.priceColor ?? design.primaryColor }}>
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
            <p className="gm-modal-desc mt-4" style={{ color: design.mutedTextColor }}>
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
/**
 * REKLAM AÇILIŞI — Rota Menü'nün yönettiği reklam alanı.
 *
 * Açılış ekranı artık ya markanın/mekanın görseli ya da bu menüye atanmış bir
 * reklamdır (bkz. lib/ads.ts). Reklam süresi panelden saniye olarak ayarlanır.
 *
 * GERİ SAYIM: sağ üstte içi boşalan bir halka ve ortasında kalan saniye.
 * Misafir ne kadar bekleyeceğini ilk saniyede anlıyor — süreyi bilmeden
 * bekletmek menüden çıkmaya yol açar. Halka `stroke-dashoffset` üzerinde tek
 * bir lineer geçişle boşalıyor; saniye sayacı ondan bağımsız, bu yüzden
 * yavaş cihazda sayı takılsa bile halka doğru hızda ilerliyor.
 */
function AdSplash({
  ad,
  venueId,
  t,
  fading,
}: {
  ad: GuestAd;
  venueId: string;
  t: UiStrings;
  fading: boolean;
}) {
  const RADIUS = 16;
  const CIRCUM = 2 * Math.PI * RADIUS;

  const [started, setStarted] = useState(false);
  const [left, setLeft] = useState(ad.durationSeconds);

  useEffect(() => {
    // Gösterim ölçümü — sessiz, misafire hiçbir şey göstermez.
    void fetch('/api/ad-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId: ad.id, venueId, kind: 'impression' }),
      keepalive: true,
    }).catch(() => {});

    const frame = window.requestAnimationFrame(() => setStarted(true));
    const tick = window.setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClick() {
    if (!ad.clickUrl) return;
    void fetch('/api/ad-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId: ad.id, venueId, kind: 'click' }),
      keepalive: true,
    }).catch(() => {});
  }

  const media =
    ad.mediaType === 'video' ? (
      <video
        src={ad.mediaUrl}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={ad.mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
    );

  return (
    <div
      className={`fixed inset-0 z-[60] bg-black transition-opacity duration-[800ms] ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {ad.clickUrl ? (
        <a
          href={ad.clickUrl}
          target="_blank"
          rel="noreferrer noopener"
          onClick={handleClick}
          className="absolute inset-0 block"
          aria-label={t.advertisement}
        >
          {media}
        </a>
      ) : (
        media
      )}

      {/* "Reklam" etiketi: misafir ne izlediğini bilmeli. */}
      <span className="absolute left-4 top-4 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90">
        {t.advertisement}
      </span>

      {/* Geri sayım halkası */}
      <div className="absolute right-4 top-4 h-11 w-11">
        <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="20" cy="20" r={RADIUS} fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.28)" strokeWidth="3" />
          <circle
            cx="20"
            cy="20"
            r={RADIUS}
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={CIRCUM}
            style={{
              strokeDashoffset: started ? CIRCUM : 0,
              transition: `stroke-dashoffset ${ad.durationSeconds}s linear`,
            }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-[13px] font-bold tabular-nums text-white"
          aria-live="off"
        >
          {left}
        </span>
      </div>
    </div>
  );
}

function SplashScreen({
  venue,
  design,
  t,
  fading,
  ad,
  venueId,
}: {
  venue: GuestVenue;
  design: MenuDesignSettings;
  t: UiStrings;
  fading: boolean;
  ad?: GuestAd | null;
  venueId: string;
}) {
  // Reklam atanmışsa açılış ekranı odur; yoksa aşağıdaki marka/kapak akışı.
  if (ad) return <AdSplash ad={ad} venueId={venueId} t={t} fading={fading} />;

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

  /**
   * Küçük bir "yerleşme" animasyonu: görsel hafifçe büyük ve yukarıda başlar,
   * yavaşça kendi yerine oturur. Tek karelik bir gecikmeyle tetiklenir —
   * ilk çizimde `false`, hemen ardından `true` olur ki CSS geçişi çalışsın
   * (doğrudan `true` başlarsa tarayıcı geçişi atlar ve hareket görünmez).
   */
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setSettled(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center transition-opacity duration-[800ms] ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      /* Taban katman markanın gradyanı: görsel yüklenemezse ekran boş kalmaz. */
      style={{ background: `linear-gradient(135deg, ${design.primaryColor}, ${design.accentColor})` }}
      aria-hidden
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${venue.coverUrl ?? '/splash.jpg'})`,
          transform: settled ? 'scale(1) translateY(0)' : 'scale(1.09) translateY(-10px)',
          // Uzun ve sona doğru yavaşlayan bir eğri: hareket "duruyor" gibi
          // hissettirsin, mekanik bir kayma gibi değil.
          transition: 'transform 3200ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />

      {/* Yazı basılacaksa okunurluk için perde; marka görselinde yazı yok,
          perde de yok — görsel olduğu gibi, net görünsün. */}
      {!usingBrandSplash && (
        <>
          <div className="absolute inset-0" style={{ backgroundColor: hexToRgba(design.textColor, 55) }} />

          <div
            className="relative flex flex-col items-center px-8 text-center"
            style={{
              opacity: settled ? 1 : 0,
              transform: settled ? 'translateY(0)' : 'translateY(14px)',
              transition: 'opacity 900ms ease-out 200ms, transform 900ms cubic-bezier(0.16, 1, 0.3, 1) 200ms',
            }}
          >
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
      <div className="relative">
        {/* Sağ üst kapatma düğmesi — referanstaki .dialog-close ile birebir:
            13px içeriden, 40px beyaz daire, hafif gölge, görselin ÜZERİNE
            biner. Renkler bilinçli sabit (beyaz zemin + koyu çarpı): düğme
            fotoğrafın üstünde durduğu için temadan bağımsız okunur kalmalı. */}
        <Pressable
          onClick={onClose}
          aria-label={t.close}
          className="absolute right-[13px] top-[13px] z-10 flex h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: '#ffffff', color: '#1c1917', boxShadow: '0 4px 12px rgba(0,0,0,.15)' }}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[18px] w-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="m5 5 14 14M19 5 5 19" />
          </svg>
        </Pressable>
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
      <h3 className="gm-modal-label mb-1.5" style={{ color: design.mutedTextColor }}>
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

  /** Yapısal saat varsa bugünün aralığı, yoksa eski serbest metin. */
  const today = venue.hours?.today ?? null;
  const footerHours = today
    ? today.closed
      ? t.closedToday
      : today.range
    : venue.openingHours;

  const rows = useMemo(
    () =>
      [
        venue.address && {
          label: t.address,
          value: venue.address,
          href: venue.googleMapsUrl ?? undefined,
        },
        // Saat iki yerde yazıyor (mekan kartı + bu alt bilgi). Yapısal saat
        // girildiyse ONA öncelik ver: aksi halde kart "Bugün 09:00 – 23:00",
        // alt bilgi eski serbest metni ("Her gün 11:00 – 23:00") gösteriyor ve
        // aynı sayfada iki farklı saat çıkıyordu.
        footerHours && { label: t.openingHours, value: footerHours },
        venue.phone && { label: t.phone, value: venue.phone, href: `tel:${venue.phone.replace(/\s/g, '')}` },
        waDigits && { label: 'WhatsApp', value: venue.whatsapp!, href: `https://wa.me/${waDigits}` },
        igHandle && { label: 'Instagram', value: `@${igHandle}`, href: `https://instagram.com/${igHandle}` },
        venue.wifiSsid && { label: t.wifi, value: venue.wifiSsid },
      ].filter(Boolean) as { label: string; value: string; href?: string }[],
    [venue, waDigits, igHandle, footerHours, t]
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
