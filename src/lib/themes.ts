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
  baseFontSize: number;
  headingScale: number;
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
};

export const FONT_OPTIONS = [
  { id: 'modern', label: 'Modern', value: 'Arial, Helvetica, sans-serif' },
  { id: 'friendly', label: 'Samimi', value: 'Trebuchet MS, Arial, sans-serif' },
  { id: 'editorial', label: 'Editoryal', value: 'Georgia, Times New Roman, serif' },
  { id: 'classic', label: 'Klasik', value: 'Times New Roman, Times, serif' },
  { id: 'mono', label: 'Daktilo', value: 'Courier New, Courier, monospace' },
] as const;

export const TEXTURE_OPTIONS: { id: TextureId; label: string }[] = [
  { id: 'none', label: 'Düz' },
  { id: 'paper', label: 'Kâğıt' },
  { id: 'linen', label: 'Keten' },
  { id: 'dots', label: 'Nokta' },
  { id: 'grid', label: 'Karo' },
];

export const MENU_DESIGN_PRESETS: (MenuDesignSettings & {
  name: string;
  description: string;
  mood: string;
})[] = [
  {
    templateId: 'sade', name: 'Sade', description: 'Temiz, ferah ve hızlı okunur.', mood: 'Modern',
    backgroundColor: '#f5f5f4', surfaceColor: '#ffffff', primaryColor: '#ea580c', accentColor: '#fb923c',
    textColor: '#1c1917', mutedTextColor: '#78716c', headingFont: FONT_OPTIONS[0].value,
    bodyFont: FONT_OPTIONS[0].value, baseFontSize: 16, headingScale: 1.2, cardColor: '#ffffff',
    cardOpacity: 100, cardRadius: 16, itemSpacing: 12, dividerColor: '#e7e5e4', dividerOpacity: 100,
    texture: 'none', textureOpacity: 0, backgroundImageUrl: null, backgroundImageOpacity: 100,
    backgroundImageMode: 'cover', layout: 'single',
  },
  {
    templateId: 'lokanta', name: 'Anadolu Lokantası', description: 'Sıcak, tanıdık ve iştah açıcı.', mood: 'Samimi',
    backgroundColor: '#f7efe3', surfaceColor: '#fffaf2', primaryColor: '#9a3412', accentColor: '#d97706',
    textColor: '#3f2d20', mutedTextColor: '#7c6654', headingFont: FONT_OPTIONS[2].value,
    bodyFont: FONT_OPTIONS[1].value, baseFontSize: 16, headingScale: 1.25, cardColor: '#fffaf2',
    cardOpacity: 92, cardRadius: 12, itemSpacing: 14, dividerColor: '#d6c2aa', dividerOpacity: 75,
    texture: 'paper', textureOpacity: 28, backgroundImageUrl: null, backgroundImageOpacity: 100,
    backgroundImageMode: 'cover', layout: 'single',
  },
  {
    templateId: 'gece', name: 'Gece', description: 'Bar, pub ve akşam servisi için güçlü.', mood: 'Koyu',
    backgroundColor: '#111111', surfaceColor: '#1c1917', primaryColor: '#f59e0b', accentColor: '#fbbf24',
    textColor: '#fafaf9', mutedTextColor: '#a8a29e', headingFont: FONT_OPTIONS[0].value,
    bodyFont: FONT_OPTIONS[0].value, baseFontSize: 16, headingScale: 1.18, cardColor: '#292524',
    cardOpacity: 88, cardRadius: 18, itemSpacing: 12, dividerColor: '#57534e', dividerOpacity: 65,
    texture: 'grid', textureOpacity: 16, backgroundImageUrl: null, backgroundImageOpacity: 100,
    backgroundImageMode: 'cover', layout: 'single',
  },
  {
    templateId: 'bistro', name: 'Bistro', description: 'Zarif tipografi ve sakin renkler.', mood: 'Editoryal',
    backgroundColor: '#f4f1ea', surfaceColor: '#fcfaf5', primaryColor: '#365314', accentColor: '#a16207',
    textColor: '#292524', mutedTextColor: '#6b665e', headingFont: FONT_OPTIONS[2].value,
    bodyFont: FONT_OPTIONS[2].value, baseFontSize: 17, headingScale: 1.35, cardColor: '#fcfaf5',
    cardOpacity: 94, cardRadius: 4, itemSpacing: 16, dividerColor: '#b9b3a8', dividerOpacity: 70,
    texture: 'linen', textureOpacity: 22, backgroundImageUrl: null, backgroundImageOpacity: 100,
    backgroundImageMode: 'cover', layout: 'single',
  },
  {
    templateId: 'enerjik', name: 'Enerjik', description: 'Kafe ve hızlı servis için canlı.', mood: 'Renkli',
    backgroundColor: '#fff7ed', surfaceColor: '#ffffff', primaryColor: '#e11d48', accentColor: '#06b6d4',
    textColor: '#27272a', mutedTextColor: '#71717a', headingFont: FONT_OPTIONS[1].value,
    bodyFont: FONT_OPTIONS[0].value, baseFontSize: 16, headingScale: 1.22, cardColor: '#ffffff',
    cardOpacity: 96, cardRadius: 24, itemSpacing: 12, dividerColor: '#fecdd3', dividerOpacity: 80,
    texture: 'dots', textureOpacity: 20, backgroundImageUrl: null, backgroundImageOpacity: 100,
    backgroundImageMode: 'cover', layout: 'single',
  },
  {
    templateId: 'cift-kolon', name: 'Çift Kolon', description: 'Yoğun menüler için kompakt iki sütun.', mood: 'Pizzeria',
    backgroundColor: '#c83b2d', surfaceColor: '#fffaf0', primaryColor: '#cf3024', accentColor: '#1f5b3a',
    textColor: '#29251f', mutedTextColor: '#756d61', headingFont: FONT_OPTIONS[2].value,
    bodyFont: FONT_OPTIONS[0].value, baseFontSize: 14, headingScale: 1.28, cardColor: '#fffaf0',
    cardOpacity: 94, cardRadius: 10, itemSpacing: 8, dividerColor: '#b7aa96', dividerOpacity: 65,
    texture: 'grid', textureOpacity: 22, backgroundImageUrl: null, backgroundImageOpacity: 100,
    backgroundImageMode: 'tile', layout: 'two-column',
  },
];

export const DEFAULT_MENU_DESIGN: MenuDesignSettings = stripPresetMeta(MENU_DESIGN_PRESETS[0]);

export function stripPresetMeta(preset: typeof MENU_DESIGN_PRESETS[number]): MenuDesignSettings {
  const { name: _name, description: _description, mood: _mood, ...settings } = preset;
  return settings;
}

export function normalizeMenuDesign(value: unknown): MenuDesignSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_MENU_DESIGN };
  const source = value as Partial<MenuDesignSettings>;
  return { ...DEFAULT_MENU_DESIGN, ...source };
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
