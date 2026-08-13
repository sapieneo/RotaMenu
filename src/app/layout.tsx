import type { Metadata } from 'next';
import './globals.css';
import { GOOGLE_FONTS_STYLESHEET_URL } from '@/lib/themes';

export const metadata: Metadata = {
  title: 'RestaurantOS — Menünü dakikalar içinde dijitale taşı',
  description:
    'Menü fotoğrafını yükle; yapay zeka çıkarsın, sen onayla. Alerjen ve kalori uyumlu, çok dilli QR menü.',
};

/**
 * Karanlık mod anahtarı.
 *
 * DİKKAT — şu an sistem tercihi BİLİNÇLİ OLARAK dinlenmiyor. Renk token'ları
 * (globals.css) hazır ama sayfaların çoğu hâlâ `bg-white` / `text-stone-900`
 * gibi sabit renkler kullanıyor; sistem tercihini bugün açsak koyu zeminde
 * siyah metin çıkar. Bu yüzden varsayılan AÇIK moddur ve koyu mod yalnız
 * elle açılır:
 *
 *     localStorage.theme = 'dark'   → koyu
 *     localStorage.removeItem('theme') → açık
 *
 * Tüm sayfalar anlamsal token'lara geçtiğinde bu betik
 * `matchMedia('(prefers-color-scheme: dark)')` sonucunu da dikkate alacak
 * şekilde güncellenir ve mod gerçekten otomatik olur.
 *
 * Betik `beforeInteractive` olarak <head>'e gömülür — React hidrasyondan
 * ÖNCE çalışması şart, aksi halde ilk boyamada açık tema görünüp koyuya
 * atlar ("flash of wrong theme").
 */
const THEME_SCRIPT = `try{if(localStorage.theme==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        {/* Tasarım stüdyosundaki genişletilmiş font listesi (bkz. FONT_OPTIONS,
            lib/themes.ts) buradan tek seferde, tüm sitede yüklenir — menü
            önizlemesi de dahil, çünkü /m/[slug] de bu kök layout'u paylaşır. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={GOOGLE_FONTS_STYLESHEET_URL} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
