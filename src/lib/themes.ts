// RestaurantOS — Tema sistemi
// 10 hazır preset: renk paleti + font eşleşmesi + köşe/kart/buton kişiliği.
// theme-factory skill'inin renk paleti mantığından ilham alınmıştır, web
// fontlarıyla (Google Fonts) restoran/kafe dünyasına özgü olarak uyarlanmıştır.

export type ThemeCategory =
  | 'modern-minimal'
  | 'warm-cafe'
  | 'classic-elegant'
  | 'vibrant-fastfood';

export type RadiusScale = 'none' | 'sm' | 'md' | 'lg' | 'full';
export type CardStyle = 'flat' | 'outlined' | 'elevated';
export type DividerStyle = 'none' | 'hairline' | 'bold';
export type ButtonStyle = 'solid' | 'outline' | 'pill' | 'underline';

export interface ThemeColors {
  background: string;
  surface: string;
  primary: string;
  accent: string;
  text: string;
  textMuted: string;
  border: string;
}

export interface ThemeFont {
  heading: string; // Google Font aile adı
  body: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  category: ThemeCategory;
  description: string;
  colors: ThemeColors;
  font: ThemeFont;
  radius: RadiusScale;
  card: CardStyle;
  divider: DividerStyle;
  button: ButtonStyle;
}

export type TextureId = 'none' | 'paper' | 'linen' | 'dots' | 'grid';
export type MenuLayout = 'single' | 'two-column';
export type BackgroundImageMode = 'cover' | 'tile';

export type MenuDesignSettings = {
  templateId: string;
  backgroundColor: string;
  surfaceColor: string;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  mutedTextColor: string;
  headingFont: string;
  bodyFont: string;
  /** İşletmenin yüklediği fontun herkese açık Storage adresi. */
  customFontUrl?: string | null;
  /** Tasarım stüdyosunda gösterilecek özgün dosya adı. */
  customFontName?: string | null;
  baseFontSize: number;
  headingScale: number;
  /**
   * Fiyat rengi. Boşsa (null/undefined) `primaryColor` kullanılır — mevcut
   * davranış birebir korunur. Doluysa ürün fiyatları metnin geri kalanından
   * ayrışan, bağımsız bir tonla (örn. sıcak bronz/altın) gösterilir.
   */
  priceColor?: string | null;
  cardColor: string;
  cardOpacity: number;
  cardRadius: number;
  itemSpacing: number;
  dividerColor: string;
  dividerOpacity: number;
  texture: TextureId;
  textureOpacity: number;
  backgroundImageUrl: string | null;
  backgroundImageOpacity: number;
  backgroundImageMode: BackgroundImageMode;
  layout: MenuLayout;
  /** Üst kapak şeridinin yüksekliği (px) — işletme adı ve logo bu şeridin üzerinde gösterilir. */
  headerHeight: number;
  /** Logonun yüksekliği (px); genişlik oranı korunarak (object-contain) ölçeklenir. */
  logoSize: number;
  /** Logonun şerit üzerindeki yatay konumu: 0 = sol, 50 = orta, 100 = sağ. */
  logoPositionX: number;
  /** 'Hero' stilindeki büyük kategori arka plan resminin köşe yuvarlaklığı (px). */
  heroImageRadius: number;
  /** Kategori çerçevesinin (şerit + ürün listesini saran kart) köşe yuvarlaklığı (px). */
  groupFrameRadius: number;
};

export const FONT_OPTIONS = [
  // Sistem/web-safe — hiçbir font yüklemesi gerektirmez.
  { id: 'modern', label: 'Modern', value: 'Arial, Helvetica, sans-serif' },
  { id: 'friendly', label: 'Samimi', value: 'Trebuchet MS, Arial, sans-serif' },
  { id: 'editorial', label: 'Editoryal', value: 'Georgia, Times New Roman, serif' },
  { id: 'classic', label: 'Klasik', value: 'Times New Roman, Times, serif' },
  { id: 'mono', label: 'Daktilo', value: 'Courier New, Courier, monospace' },
  { id: 'apple', label: 'Apple Sistem', value: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif' },
  // Google Fonts — tek bir <link> ile sitenin tamamında yüklenir
  // (bkz. GOOGLE_FONTS_STYLESHEET_URL, app/layout.tsx). Buradaki `value`
  // dizesindeki aile adı o linkte istenen adla BİREBİR eşleşmeli, aksi
  // hâlde font sessizce sistem yazı tipine düşer.
  { id: 'inter', label: 'Inter', value: "'Inter', sans-serif" },
  { id: 'poppins', label: 'Poppins', value: "'Poppins', sans-serif" },
  { id: 'montserrat', label: 'Montserrat', value: "'Montserrat', sans-serif" },
  { id: 'nunito', label: 'Nunito', value: "'Nunito', sans-serif" },
  { id: 'raleway', label: 'Raleway', value: "'Raleway', sans-serif" },
  { id: 'work-sans', label: 'Work Sans', value: "'Work Sans', sans-serif" },
  { id: 'dm-sans', label: 'DM Sans', value: "'DM Sans', sans-serif" },
  { id: 'space-grotesk', label: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
  { id: 'josefin-sans', label: 'Josefin Sans', value: "'Josefin Sans', sans-serif" },
  { id: 'quicksand', label: 'Quicksand', value: "'Quicksand', sans-serif" },
  { id: 'playfair-display', label: 'Playfair Display', value: "'Playfair Display', serif" },
  { id: 'merriweather', label: 'Merriweather', value: "'Merriweather', serif" },
  { id: 'lora', label: 'Lora', value: "'Lora', serif" },
  { id: 'cormorant-garamond', label: 'Cormorant Garamond', value: "'Cormorant Garamond', serif" },
  { id: 'libre-baskerville', label: 'Libre Baskerville', value: "'Libre Baskerville', serif" },
  { id: 'pt-serif', label: 'PT Serif', value: "'PT Serif', serif" },
  { id: 'crimson-text', label: 'Crimson Text', value: "'Crimson Text', serif" },
  { id: 'bitter', label: 'Bitter', value: "'Bitter', serif" },
  { id: 'roboto-slab', label: 'Roboto Slab', value: "'Roboto Slab', serif" },
  { id: 'oswald', label: 'Oswald', value: "'Oswald', sans-serif" },
  { id: 'bebas-neue', label: 'Bebas Neue', value: "'Bebas Neue', sans-serif" },
  { id: 'abril-fatface', label: 'Abril Fatface', value: "'Abril Fatface', serif" },
  { id: 'dancing-script', label: 'Dancing Script', value: "'Dancing Script', cursive" },
  { id: 'caveat', label: 'Caveat', value: "'Caveat', cursive" },
  { id: 'pacifico', label: 'Pacifico', value: "'Pacifico', cursive" },
  { id: 'ibm-plex-mono', label: 'IBM Plex Mono', value: "'IBM Plex Mono', monospace" },
  { id: 'fraunces', label: 'Fraunces', value: "'Fraunces', Georgia, serif" },
] as const;

/**
 * Yüklenen font her menü sayfasında yalnız bir tane olduğu için sabit ve
 * güvenli bir CSS aile adı kullanılır. Kullanıcının dosya adı hiçbir zaman
 * `font-family` içine yazılmaz; böylece CSS enjeksiyonu mümkün olmaz.
 */
export const CUSTOM_FONT_FAMILY = "'RotaMenu Custom', sans-serif";

/** Yüklenen fontu güvenli bir `@font-face` kuralına dönüştürür. */
export function customFontFaceCss(settings: Pick<MenuDesignSettings, 'customFontUrl'>): string {
  const rawUrl = settings.customFontUrl;
  if (!rawUrl) return '';
  try {
    const url = new URL(rawUrl);
    const allowedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-fonts/`;
    if (!url.toString().startsWith(allowedPrefix)) return '';
    const extension = url.pathname.toLowerCase().match(/\.(woff2|woff|ttf|otf)$/)?.[1];
    if (!extension || !['https:', 'http:'].includes(url.protocol)) return '';
    const format = extension === 'ttf' ? 'truetype' : extension === 'otf' ? 'opentype' : extension;
    return `@font-face{font-family:"RotaMenu Custom";src:url(${JSON.stringify(url.toString())}) format("${format}");font-style:normal;font-weight:100 900;font-display:swap}`;
  } catch {
    return '';
  }
}

/**
 * `FONT_OPTIONS`'taki Google Fonts girişleriyle BİREBİR senkron tutulmalı —
 * buraya bir font eklenip yukarıya eklenmezse (ya da tam tersi), o font
 * seçilebilir görünür ama sessizce sistem yazı tipine düşer.
 */
const GOOGLE_FONT_FAMILIES = [
  'Inter:wght@400;700',
  'Poppins:wght@400;700',
  'Montserrat:wght@400;700',
  'Nunito:wght@400;700',
  'Raleway:wght@400;700',
  'Work+Sans:wght@400;700',
  // Referans menü DM Sans'ı 500/600 ağırlıklarla da kullanıyor (çipler,
  // etiketler) — yüklenmezse tarayıcı 700'e yuvarlıyor ve her şey fazla
  // kalın görünüyordu.
  'DM+Sans:wght@400;500;600;700',
  'Space+Grotesk:wght@400;700',
  'Josefin+Sans:wght@400;700',
  'Quicksand:wght@400;700',
  'Playfair+Display:wght@400;700',
  'Merriweather:wght@400;700',
  'Lora:wght@400;700',
  'Cormorant+Garamond:wght@400;700',
  'Libre+Baskerville:wght@400;700',
  'PT+Serif:wght@400;700',
  'Crimson+Text:wght@400;700',
  'Bitter:wght@400;700',
  'Roboto+Slab:wght@400;700',
  'Oswald:wght@400;700',
  'Bebas+Neue',
  'Abril+Fatface',
  'Dancing+Script:wght@400;700',
  'Caveat:wght@400;700',
  'Pacifico',
  'IBM+Plex+Mono:wght@400;700',
  'Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700',
];

export const GOOGLE_FONTS_STYLESHEET_URL = `https://fonts.googleapis.com/css2?${GOOGLE_FONT_FAMILIES.map(
  (family) => `family=${family}`
).join('&')}&display=swap`;

export const TEXTURE_OPTIONS: { id: TextureId; label: string }[] = [
  { id: 'none', label: 'Düz' },
  { id: 'paper', label: 'Kâğıt' },
  { id: 'linen', label: 'Keten' },
  { id: 'dots', label: 'Nokta' },
  { id: 'grid', label: 'Karo' },
];

export type MenuDesignPreset = MenuDesignSettings & {
  name: string;
  description: string;
  mood: string;
  /** AI stil eşleştirmesi ve etiket gösterimi için serbest metin anahtar kelimeler. */
  keywords: string;
  /**
   * "Hızlı" (curated) preset işareti. Bu presetler kısıtlı bir tasarım
   * sistemine (sabit Fraunces/DM Sans font ikilisi, sabit nötr renkler,
   * yalnızca vurgu rengi değişen) dayanır — amaç, tek tek ayar oynamadan
   * her zaman tutarlı/"tasarlanmış" görünen bir sonuç vermek. Normal
   * presetler (curated olmayan) her alanı bağımsız taşımaya devam eder.
   */
  curated?: boolean;
};

/** Hızlı (curated) presetlerin ortak sabitleri — RotaMenu referans tasarımından. */
const CURATED_BASE = {
  textColor: '#171b20',
  mutedTextColor: '#69716d',
  surfaceColor: '#ffffff',
  cardColor: '#ffffff',
  dividerColor: '#dfe5e1',
  headingFont: "'Fraunces', Georgia, serif",
  bodyFont: "'DM Sans', sans-serif",
  baseFontSize: 16,
  headingScale: 1.3,
  cardOpacity: 100,
  cardRadius: 17,
  itemSpacing: 14,
  dividerOpacity: 100,
  texture: 'none' as const,
  textureOpacity: 0,
  backgroundImageUrl: null,
  backgroundImageOpacity: 100,
  backgroundImageMode: 'cover' as const,
  layout: 'single' as const,
  headerHeight: 160,
  logoSize: 56,
  logoPositionX: 50,
  heroImageRadius: 16,
  groupFrameRadius: 16,
  // RotaMenu referansında fiyatlar gövde metninden ayrı, sıcak bronz bir
  // tonla basılır — vurgu rengi ne olursa olsun bu sabit kalır.
  priceColor: '#9b7857',
};

export const MENU_DESIGN_PRESETS: MenuDesignPreset[] = [
  {
    templateId: 'rota-yesil', name: 'RotaMenu Yeşil', description: 'Sabit tipografi, tek vurgu rengi — her zaman tutarlı ve hızlı.', mood: 'Hızlı · Zarif',
    keywords: 'rotamenu, hızlı, yeşil, zeytin, editoryal, fraunces, sade, tutarlı',
    curated: true, ...CURATED_BASE,
    backgroundColor: '#f1f8f6', primaryColor: '#008c70', accentColor: '#008c70',
  },
  {
    templateId: 'rota-kum', name: 'RotaMenu Kum', description: 'Sabit tipografi, tek vurgu rengi — her zaman tutarlı ve hızlı.', mood: 'Hızlı · Sıcak',
    keywords: 'rotamenu, hızlı, kum, bronz, toprak, editoryal, fraunces, sade, tutarlı',
    curated: true, ...CURATED_BASE,
    backgroundColor: '#faf5ee', primaryColor: '#9b7857', accentColor: '#9b7857',
  },
  {
    templateId: 'rota-gunes', name: 'RotaMenu Güneş', description: 'Sabit tipografi, tek vurgu rengi — her zaman tutarlı ve hızlı.', mood: 'Hızlı · Canlı',
    keywords: 'rotamenu, hızlı, güneş, sarı, canlı, editoryal, fraunces, sade, tutarlı',
    curated: true, ...CURATED_BASE,
    backgroundColor: '#fdfaeb', primaryColor: '#9f8500', accentColor: '#9f8500',
  },
  {
    // Referans menünün (AYANA) birebir tonu: kireç beyazı zemin, koyu deniz-gri
    // vurgu ve altın kenarlı duyuru şeridi. Diğer curated kartlarla aynı
    // tipografiyi (Fraunces başlık + DM Sans gövde) ve bronz fiyat rengini
    // paylaşır — yalnız renk paleti değişir.
    templateId: 'rota-liman', name: 'RotaMenu Liman', description: 'Kireç beyazı zemin, koyu deniz grisi ve altın vurgu — referans menünün tonu.', mood: 'Hızlı · Sahil',
    keywords: 'rotamenu, hızlı, liman, deniz, gri, altın, balık, meyhane, editoryal, fraunces, sade, tutarlı',
    curated: true, ...CURATED_BASE,
    backgroundColor: '#f4f5f3', primaryColor: '#4a5f6b', accentColor: '#c2a15a',
  },
  {
    templateId: 'sade', name: 'Sade', description: 'Temiz, ferah ve hızlı okunur.', mood: 'Modern',
    keywords: 'sade, modern, minimal, temiz, ferah, günlük, hızlı okunur',
    backgroundColor: '#f5f5f4', surfaceColor: '#ffffff', primaryColor: '#ea580c', accentColor: '#fb923c',
    textColor: '#1c1917', mutedTextColor: '#78716c', headingFont: FONT_OPTIONS[0].value,
    bodyFont: FONT_OPTIONS[0].value, baseFontSize: 16, headingScale: 1.2, cardColor: '#ffffff',
    cardOpacity: 25, cardRadius: 16, itemSpacing: 12, dividerColor: '#e7e5e4', dividerOpacity: 100,
    texture: 'none', textureOpacity: 0, backgroundImageUrl: null, backgroundImageOpacity: 100,
    backgroundImageMode: 'cover', layout: 'single', headerHeight: 160, logoSize: 56, logoPositionX: 50, heroImageRadius: 16, groupFrameRadius: 16,
  },
  {
    templateId: 'lokanta', name: 'Anadolu Lokantası', description: 'Sıcak, tanıdık ve iştah açıcı.', mood: 'Samimi',
    keywords: 'lokanta, ev yemeği, sıcak, samimi, geleneksel, esnaf, aile',
    backgroundColor: '#f7efe3', surfaceColor: '#fffaf2', primaryColor: '#9a3412', accentColor: '#d97706',
    textColor: '#3f2d20', mutedTextColor: '#7c6654', headingFont: FONT_OPTIONS[2].value,
    bodyFont: FONT_OPTIONS[1].value, baseFontSize: 16, headingScale: 1.25, cardColor: '#fffaf2',
    cardOpacity: 92, cardRadius: 12, itemSpacing: 14, dividerColor: '#d6c2aa', dividerOpacity: 75,
    texture: 'paper', textureOpacity: 28, backgroundImageUrl: null, backgroundImageOpacity: 100,
    backgroundImageMode: 'cover', layout: 'single', headerHeight: 160, logoSize: 56, logoPositionX: 50, heroImageRadius: 16, groupFrameRadius: 16,
  },
  {
    templateId: 'gece', name: 'Gece', description: 'Bar, pub ve akşam servisi için güçlü.', mood: 'Koyu',
    keywords: 'bar, pub, gece, karanlık, koyu, kokteyl, akşam, güçlü',
    backgroundColor: '#111111', surfaceColor: '#1c1917', primaryColor: '#f59e0b', accentColor: '#fbbf24',
    textColor: '#fafaf9', mutedTextColor: '#a8a29e', headingFont: FONT_OPTIONS[0].value,
    bodyFont: FONT_OPTIONS[0].value, baseFontSize: 16, headingScale: 1.18, cardColor: '#292524',
    cardOpacity: 88, cardRadius: 18, itemSpacing: 12, dividerColor: '#57534e', dividerOpacity: 65,
    texture: 'grid', textureOpacity: 16, backgroundImageUrl: null, backgroundImageOpacity: 100,
    backgroundImageMode: 'cover', layout: 'single', headerHeight: 160, logoSize: 56, logoPositionX: 50, heroImageRadius: 16, groupFrameRadius: 16,
  },
  {
    templateId: 'bistro', name: 'Bistro', description: 'Zarif tipografi ve sakin renkler.', mood: 'Editoryal',
    keywords: 'bistro, editoryal, zarif, sakin, şık, fine dining, tipografi',
    backgroundColor: '#f4f1ea', surfaceColor: '#fcfaf5', primaryColor: '#365314', accentColor: '#a16207',
    textColor: '#292524', mutedTextColor: '#6b665e', headingFont: FONT_OPTIONS[2].value,
    bodyFont: FONT_OPTIONS[2].value, baseFontSize: 17, headingScale: 1.35, cardColor: '#fcfaf5',
    cardOpacity: 94, cardRadius: 4, itemSpacing: 16, dividerColor: '#b9b3a8', dividerOpacity: 70,
    texture: 'linen', textureOpacity: 22, backgroundImageUrl: null, backgroundImageOpacity: 100,
    backgroundImageMode: 'cover', layout: 'single', headerHeight: 160, logoSize: 56, logoPositionX: 50, heroImageRadius: 16, groupFrameRadius: 16,
  },
  {
    templateId: 'enerjik', name: 'Enerjik', description: 'Kafe ve hızlı servis için canlı.', mood: 'Renkli',
    keywords: 'enerjik, renkli, canlı, kafe, hızlı servis, gençlik, eğlenceli',
    backgroundColor: '#fff7ed', surfaceColor: '#ffffff', primaryColor: '#e11d48', accentColor: '#06b6d4',
    textColor: '#27272a', mutedTextColor: '#71717a', headingFont: FONT_OPTIONS[1].value,
    bodyFont: FONT_OPTIONS[0].value, baseFontSize: 16, headingScale: 1.22, cardColor: '#ffffff',
    cardOpacity: 96, cardRadius: 24, itemSpacing: 12, dividerColor: '#fecdd3', dividerOpacity: 80,
    texture: 'dots', textureOpacity: 20, backgroundImageUrl: null, backgroundImageOpacity: 100,
    backgroundImageMode: 'cover', layout: 'single', headerHeight: 160, logoSize: 56, logoPositionX: 50, heroImageRadius: 16, groupFrameRadius: 16,
  },
  {
    templateId: 'cift-kolon', name: 'Çift Kolon', description: 'Yoğun menüler için kompakt iki sütun.', mood: 'Pizzeria',
    keywords: 'pizzeria, italyan, iki sütun, yoğun menü, kompakt, kırmızı',
    backgroundColor: '#c83b2d', surfaceColor: '#fffaf0', primaryColor: '#cf3024', accentColor: '#1f5b3a',
    textColor: '#29251f', mutedTextColor: '#756d61', headingFont: FONT_OPTIONS[2].value,
    bodyFont: FONT_OPTIONS[0].value, baseFontSize: 14, headingScale: 1.28, cardColor: '#fffaf0',
    cardOpacity: 94, cardRadius: 10, itemSpacing: 8, dividerColor: '#b7aa96', dividerOpacity: 65,
    texture: 'grid', textureOpacity: 22, backgroundImageUrl: null, backgroundImageOpacity: 100,
    backgroundImageMode: 'tile', layout: 'two-column', headerHeight: 160, logoSize: 56, logoPositionX: 50, heroImageRadius: 16, groupFrameRadius: 16,
  },
  {
    templateId: 'studyo', name: 'Stüdyo', description: 'Bol boşluk, tek vurgu rengi, kusursuz sadelik.', mood: 'Apple Stili',
    keywords: 'apple, minimal, beyaz, sade, premium, temiz, modern, stüdyo, zarif',
    backgroundColor: '#f5f5f7', surfaceColor: '#ffffff', primaryColor: '#0071e3', accentColor: '#6e6e73',
    textColor: '#1d1d1f', mutedTextColor: '#6e6e73', headingFont: FONT_OPTIONS[5].value,
    bodyFont: FONT_OPTIONS[5].value, baseFontSize: 16, headingScale: 1.2, cardColor: '#ffffff',
    cardOpacity: 97, cardRadius: 20, itemSpacing: 16, dividerColor: '#d2d2d7', dividerOpacity: 60,
    texture: 'none', textureOpacity: 0, backgroundImageUrl: null, backgroundImageOpacity: 100,
    backgroundImageMode: 'cover', layout: 'single', headerHeight: 160, logoSize: 56, logoPositionX: 50, heroImageRadius: 16, groupFrameRadius: 16,
  },
  {
    templateId: 'sahil', name: 'Sahil', description: 'Deniz mavisi ve kireç beyazı — taze ve ferah.', mood: 'Akdeniz',
    keywords: 'sahil, deniz, mavi, akdeniz, balık, yazlık, taze, ferah, beyaz',
    backgroundColor: '#f4f8fa', surfaceColor: '#ffffff', primaryColor: '#0f5f7a', accentColor: '#e07a5f',
    textColor: '#0d2b33', mutedTextColor: '#5b7d87', headingFont: FONT_OPTIONS[2].value,
    bodyFont: FONT_OPTIONS[0].value, baseFontSize: 16, headingScale: 1.24, cardColor: '#ffffff',
    cardOpacity: 95, cardRadius: 18, itemSpacing: 14, dividerColor: '#c7dde3', dividerOpacity: 70,
    texture: 'none', textureOpacity: 0, backgroundImageUrl: null, backgroundImageOpacity: 100,
    backgroundImageMode: 'cover', layout: 'single', headerHeight: 160, logoSize: 56, logoPositionX: 50, heroImageRadius: 16, groupFrameRadius: 16,
  },
  {
    templateId: 'kahve', name: 'Kahve Dükkanı', description: 'Latte tonları ve yumuşak köşeler.', mood: 'Sıcak Kahve',
    keywords: 'kahve, kafe, latte, kahverengi, sıcak, rahat, ahşap, üçüncü nesil kahve',
    backgroundColor: '#f3ece3', surfaceColor: '#fffdf9', primaryColor: '#6f4518', accentColor: '#c68b3d',
    textColor: '#3a2a1a', mutedTextColor: '#8a7562', headingFont: FONT_OPTIONS[1].value,
    bodyFont: FONT_OPTIONS[1].value, baseFontSize: 16, headingScale: 1.22, cardColor: '#fffdf9',
    cardOpacity: 94, cardRadius: 20, itemSpacing: 14, dividerColor: '#ddc9b0', dividerOpacity: 70,
    texture: 'paper', textureOpacity: 20, backgroundImageUrl: null, backgroundImageOpacity: 100,
    backgroundImageMode: 'cover', layout: 'single', headerHeight: 160, logoSize: 56, logoPositionX: 50, heroImageRadius: 16, groupFrameRadius: 16,
  },
  {
    templateId: 'lux-steakhouse', name: 'Steakhouse Lüks', description: 'Antrasit zemin ve altın vurgular.', mood: 'Premium',
    keywords: 'lüks, steakhouse, premium, altın, gece, karanlık, fine dining, şık, et',
    backgroundColor: '#161513', surfaceColor: '#211f1c', primaryColor: '#c8a24a', accentColor: '#8a6d2f',
    textColor: '#f3ede0', mutedTextColor: '#a79c8a', headingFont: FONT_OPTIONS[2].value,
    bodyFont: FONT_OPTIONS[0].value, baseFontSize: 16, headingScale: 1.26, cardColor: '#262420',
    cardOpacity: 90, cardRadius: 14, itemSpacing: 14, dividerColor: '#4a4237', dividerOpacity: 60,
    texture: 'none', textureOpacity: 0, backgroundImageUrl: null, backgroundImageOpacity: 100,
    backgroundImageMode: 'cover', layout: 'single', headerHeight: 160, logoSize: 56, logoPositionX: 50, heroImageRadius: 16, groupFrameRadius: 16,
  },
];

// DİKKAT: "Hızlı" (curated) presetler listenin BAŞINA eklendi (bkz. yukarısı)
// ama varsayılan tema yine de 'sade' kalmalı — indekse değil, id'ye göre
// bulunur ki preset sırası ileride değişirse varsayılan sessizce kaymasın.
const DEFAULT_PRESET = MENU_DESIGN_PRESETS.find((p) => p.templateId === 'sade') ?? MENU_DESIGN_PRESETS[0];
export const DEFAULT_MENU_DESIGN: MenuDesignSettings = stripPresetMeta(DEFAULT_PRESET);

export function stripPresetMeta(preset: MenuDesignPreset): MenuDesignSettings {
  const { name: _name, description: _description, mood: _mood, keywords: _keywords, ...settings } = preset;
  return settings;
}

/**
 * Yönetici tarafından kaydedilmiş kart override'larını (bkz.
 * `design_preset_overrides` tablosu, POST /api/design-presets/[templateId])
 * koddaki 10 sabit preset üzerine uygular. Yalnızca GÖRSEL ayarlar
 * (renk/font/aralık vb.) değişir — ad/açıklama/ruh hali/anahtar kelimeler
 * her zaman koddan gelir, override satırında bu alanlar zaten bulunmuyor.
 * Override'ı olmayan kartlar koddaki hâliyle olduğu gibi döner.
 */
export function applyPresetOverrides(
  overridesByTemplateId: Record<string, MenuDesignSettings>
): MenuDesignPreset[] {
  return MENU_DESIGN_PRESETS.map((preset) => {
    const override = overridesByTemplateId[preset.templateId];
    if (!override) return preset;
    return { ...preset, ...override, templateId: preset.templateId };
  });
}

export function normalizeMenuDesign(value: unknown): MenuDesignSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_MENU_DESIGN, customFontUrl: null, customFontName: null };
  }
  const source = value as Partial<MenuDesignSettings>;
  return { ...DEFAULT_MENU_DESIGN, customFontUrl: null, customFontName: null, ...source };
}

export function hexToRgba(hex: string, opacity: number): string {
  const clean = hex.replace('#', '');
  const value = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean;
  const number = Number.parseInt(value, 16);
  if (!Number.isFinite(number)) return `rgba(255,255,255,${opacity / 100})`;
  return `rgba(${(number >> 16) & 255},${(number >> 8) & 255},${number & 255},${opacity / 100})`;
}

export function textureBackground(texture: TextureId, color: string, opacity: number): string {
  const ink = hexToRgba(color, opacity);
  if (texture === 'paper') return `radial-gradient(circle at 20% 30%, ${ink} 0 0.7px, transparent 0.9px), radial-gradient(circle at 70% 65%, ${ink} 0 0.6px, transparent 0.8px)`;
  if (texture === 'linen') return `linear-gradient(90deg, ${ink} 1px, transparent 1px), linear-gradient(${ink} 1px, transparent 1px)`;
  if (texture === 'dots') return `radial-gradient(${ink} 1px, transparent 1.2px)`;
  if (texture === 'grid') return `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`;
  return 'none';
}

export function textureSize(texture: TextureId): string {
  if (texture === 'paper') return '18px 22px, 24px 20px';
  if (texture === 'linen') return '5px 5px';
  if (texture === 'dots') return '14px 14px';
  if (texture === 'grid') return '24px 24px';
  return 'auto';
}

export function menuBackgroundStyle(settings: MenuDesignSettings) {
  if (settings.backgroundImageUrl) {
    const overlay = hexToRgba(settings.backgroundColor, 100 - settings.backgroundImageOpacity);
    return {
      backgroundColor: settings.backgroundColor,
      backgroundImage: `linear-gradient(${overlay}, ${overlay}), url("${settings.backgroundImageUrl}")`,
      backgroundSize: settings.backgroundImageMode === 'tile' ? 'auto' : 'cover',
      backgroundRepeat: settings.backgroundImageMode === 'tile' ? 'repeat' : 'no-repeat',
      backgroundPosition: 'center top',
      // Doku, kategori görselleri ve kartlar sayfada kayarken en alttaki katman
      // olarak sabit kalır; uzun menülerde ilk ekrandan sonra kaybolmaz.
      backgroundAttachment: 'fixed',
    };
  }
  return {
    backgroundColor: settings.backgroundColor,
    backgroundImage: textureBackground(settings.texture, settings.textColor, settings.textureOpacity),
    backgroundSize: textureSize(settings.texture),
    backgroundRepeat: 'repeat',
    backgroundPosition: 'center top',
  };
}
