import type { Metadata } from 'next';
import './globals.css';

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
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
