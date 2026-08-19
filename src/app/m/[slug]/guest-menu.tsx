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
}: {
  item: GuestItem;
  design: MenuDesignSettings;
  className?: string;
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
            Görsel hazırlanıyor
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
function AllergenLine({ item, design }: { item: GuestItem; design: MenuDesignSettings }) {
  if (!item.allergensReviewed) {
    return (
      <span
        className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
        style={{ backgroundColor: hexToRgba(design.dividerColor, 28), color: design.mutedTextColor }}
      >
        <span aria-hidden>⚠</span> Alerjen bilgisi doğrulanmadı
      </span>
    );
  }
  if (item.allergenCodes.length === 0) return null;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {item.allergenCodes.map((code) => {
        const a = (ALLERGENS as Record<string, { tr: string } | undefined>)[code];
        return (
          <span
            key={code}
            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: hexToRgba(design.primaryColor, 10), color: design.primaryColor }}
          >
            {a?.tr ?? code}
          </span>
        );
      })}
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
    () => visibleCategories.flatMap((c) => visibleItemsOf(c).filter((it) => it.isFeatured)).slice(0, 6),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleCategories, hiddenAllergens]
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
  useEffect(() => {
    if (!venue.announcement) return;
    const key = `ros:announcement-seen:${venue.name}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      /* gizlilik modunda sessionStorage kapalıysa yine göster, sorun değil */
    }
    setShowAnnouncement(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
        <p className="text-stone-500">Menü henüz hazırlanıyor. Kısa süre sonra tekrar deneyin.</p>
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
      {venue.announcement && showAnnouncement && (
        <WelcomeAnnouncement
          announcement={venue.announcement}
          design={design}
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
              Ana menüler:
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
            aria-label="Menü dili"
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
            <span className="sr-only">Menü dili</span>
            <select
              value={currentLocale}
              onChange={(event) => switchLocale(event.target.value)}
              className="bg-transparent pr-0.5 font-medium outline-none"
              aria-label="Menü dili"
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
          Önizleme — bu menü henüz yayınlanmadı. Yalnızca siz görüyorsunuz.
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
              {showMenuSwitcher ? venue.name : 'Dijital menü'}
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
              {visibleItemTotal} ürün · {visibleCategories.length} kategori
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
          <span className="sr-only">Menüde ara</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${menus.find((m) => m.id === activeMenuId)?.name ?? venue.name} menüsünde lezzet ara…`}
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
            style={{ color: design.textColor }}
          />
          {query && (
            <Pressable
              onClick={() => setQuery('')}
              aria-label="Aramayı temizle"
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
            Tümü
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
          categories={renderedCategories}
          design={design}
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
            Alerjen filtreleri
          </h2>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {availableAllergenCodes.map((code) => {
              const a = (ALLERGENS as Record<string, { tr: string; emoji?: string } | undefined>)[code];
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
                  {a?.emoji && <span aria-hidden>{a.emoji}</span>}
                  {a?.tr ?? code}
                  <span className="opacity-70">{hidden ? '— gizli' : '— içerenleri gizle'}</span>
                </Pressable>
              );
            })}
          </div>
        </div>
      )}

      {featuredItems.length > 0 && (
        <div className="relative z-10 px-4 pt-4">
          <h2
            className="px-0.5 text-sm font-bold uppercase tracking-wide"
            style={{ fontFamily: design.headingFont, color: design.textColor }}
          >
            Şefin Seçtikleri
          </h2>
          {/* Telefonda yatay kaydırmalı şerit, masaüstünde referanstaki gibi
              yan yana dizilen kartlar. */}
          <div className="mt-2.5 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] lg:grid lg:grid-cols-4 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
            {featuredItems.map((it) => (
              <Pressable
                key={it.id}
                onClick={() => openItem(it)}
                className="w-40 shrink-0 overflow-hidden border text-left lg:w-auto"
                style={{
                  borderColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 55)),
                  borderRadius: `${Math.min(design.cardRadius, 18)}px`,
                  backgroundColor: hexToRgba(design.cardColor, design.cardOpacity),
                  boxShadow: tintedShadow(design),
                }}
              >
                <div className="relative h-24 w-full">
                  <ItemThumb item={it} design={design} className="h-full w-full" showCaption />
                  <span
                    className="absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ backgroundColor: design.primaryColor, color: design.surfaceColor }}
                  >
                    Şef Seçimi
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="truncate text-sm font-semibold" style={{ color: design.textColor, fontFamily: design.headingFont }}>{it.name}</p>
                  {it.price != null && (
                    <p className="mt-0.5 text-xs font-bold" style={{ color: design.priceColor ?? design.primaryColor }}>
                      {formatPrice(it.price, venue.currency)}
                    </p>
                  )}
                  <AllergenLine item={it} design={design} />
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
            {needle ? `“${query.trim()}” için sonuç bulunamadı.` : 'Seçili alerjen filtreleriyle eşleşen ürün yok.'}
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
                Seçili alerjen filtreleriyle eşleşen ürün yok.
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
                          <ItemThumb item={it} design={design} className="h-full w-full" />
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
                        <AllergenLine item={it} design={design} />
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
                <CategoryFrame design={design} variant="plain">
                  <CategoryStrip
                    name={c.name}
                    design={design}
                    backgroundUrl={null}
                    positionY={c.backgroundPositionY}
                    number={categoryIndexById.get(c.id)}
                    itemCount={shownItems.length}
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
                      Seçili alerjen filtreleriyle eşleşen ürün yok.
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
                              <ItemThumb item={it} design={design} className="h-full w-full" />
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
                              <AllergenLine item={it} design={design} />
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
                        <CategoryStrip name={c.name} design={design} number={categoryIndexById.get(c.id)} itemCount={heroShownItems.length} />
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
              Bilgilendirme &amp; Şartlar
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
  number,
  itemCount,
}: {
  name: string;
  design: MenuDesignSettings;
  backgroundUrl?: string | null;
  positionY?: number;
  /** Kategori sırası (0-tabanlı) — doluysa şeritte "01" gibi bir sıra numarası gösterilir. */
  number?: number;
  /** Kategorideki (filtrelenmiş) ürün sayısı — başlığın sağında "14 ürün" olarak. */
  itemCount?: number;
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
            {itemCount} ürün
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
            fontSize: `${design.baseFontSize * design.headingScale * 1.75}px`,
          }}
        >
          {name}
        </h2>
        {itemCount != null && (
          <span className="shrink-0 pb-1 text-xs" style={{ color: design.mutedTextColor }}>
            {itemCount} ürün
          </span>
        )}
      </div>
      <div
        className="mt-2 h-px w-full"
        style={{ backgroundColor: hexToRgba(design.dividerColor, Math.max(design.dividerOpacity, 45)) }}
      />
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
            placeholder="Menüde ara…"
            aria-label="Menüde ara"
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
            <p className="mt-1 text-lg font-semibold" style={{ color: design.priceColor ?? design.primaryColor }}>
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

          <ModalSection title="ALERJENLER" design={design}>
            {!item.allergensReviewed ? (
              <p className="text-sm" style={{ color: design.mutedTextColor }}>
                ⚠ Bu ürünün alerjen bilgisi henüz doğrulanmadı. Lütfen sipariş sırasında personele
                danışın.
              </p>
            ) : item.allergenCodes.length === 0 ? (
              <p className="text-sm" style={{ color: design.mutedTextColor }}>
                İşletme beyanına göre bildirilmesi gereken alerjen içermiyor.
              </p>
            ) : (
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
            )}
          </ModalSection>

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

/**
 * Karşılama/promosyon popup'ı — RotaMenu referansındaki "Bugünün ayrıcalığı"
 * kartına denk gelir. Yalnız Stüdyo → Ayarlar'da başlık girilmişse render
 * edilir; her sekme oturumunda bir kez gösterilir (bkz. sessionStorage kontrolü
 * yukarıda). Yayınlanmamış önizlemede de gösterilir ki sahibi kontrol edebilsin.
 */
function WelcomeAnnouncement({
  announcement,
  design,
  onClose,
}: {
  announcement: GuestAnnouncement;
  design: MenuDesignSettings;
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
          <Pressable
            onClick={onClose}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold"
            style={{ backgroundColor: design.priceColor ?? design.primaryColor, color: design.surfaceColor }}
          >
            {announcement.buttonText || 'Menüyü gör'}
          </Pressable>
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
          Rotamenu ile hazırlandı
        </p>
      )}
    </footer>
  );
}
