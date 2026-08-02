export type MenuLanguage = {
  code: string;
  name: string;
  nativeName: string;
  region: 'neighbor' | 'popular';
};

export const SOURCE_LANGUAGE = { code: 'tr', name: 'Türkçe', nativeName: 'Türkçe' } as const;

/** Türkiye'nin komşu coğrafyası ve dünyada en yaygın kullanılan 20 hedef dil. */
export const MENU_LANGUAGES: readonly MenuLanguage[] = [
  { code: 'en', name: 'İngilizce', nativeName: 'English', region: 'popular' },
  { code: 'de', name: 'Almanca', nativeName: 'Deutsch', region: 'popular' },
  { code: 'ar', name: 'Arapça', nativeName: 'العربية', region: 'neighbor' },
  { code: 'ru', name: 'Rusça', nativeName: 'Русский', region: 'neighbor' },
  { code: 'fa', name: 'Farsça', nativeName: 'فارسی', region: 'neighbor' },
  { code: 'el', name: 'Yunanca', nativeName: 'Ελληνικά', region: 'neighbor' },
  { code: 'bg', name: 'Bulgarca', nativeName: 'Български', region: 'neighbor' },
  { code: 'ka', name: 'Gürcüce', nativeName: 'ქართული', region: 'neighbor' },
  { code: 'hy', name: 'Ermenice', nativeName: 'Հայերեն', region: 'neighbor' },
  { code: 'az', name: 'Azerbaycanca', nativeName: 'Azərbaycanca', region: 'neighbor' },
  { code: 'ku', name: 'Kürtçe', nativeName: 'Kurdî', region: 'neighbor' },
  { code: 'fr', name: 'Fransızca', nativeName: 'Français', region: 'popular' },
  { code: 'es', name: 'İspanyolca', nativeName: 'Español', region: 'popular' },
  { code: 'it', name: 'İtalyanca', nativeName: 'Italiano', region: 'popular' },
  { code: 'nl', name: 'Felemenkçe', nativeName: 'Nederlands', region: 'popular' },
  { code: 'pt', name: 'Portekizce', nativeName: 'Português', region: 'popular' },
  { code: 'zh', name: 'Çince', nativeName: '中文', region: 'popular' },
  { code: 'ja', name: 'Japonca', nativeName: '日本語', region: 'popular' },
  { code: 'ko', name: 'Korece', nativeName: '한국어', region: 'popular' },
  { code: 'uk', name: 'Ukraynaca', nativeName: 'Українська', region: 'popular' },
] as const;

export const MENU_LANGUAGE_BY_CODE = new Map(MENU_LANGUAGES.map((language) => [language.code, language]));

export function isSupportedMenuLanguage(code: string): boolean {
  return MENU_LANGUAGE_BY_CODE.has(code);
}
