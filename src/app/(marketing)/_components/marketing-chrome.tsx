import Link from 'next/link';

const WHATSAPP =
  'https://wa.me/905549438822?text=Merhaba%2C%20QR%20men%C3%BC%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum.';

const NAV_LINKS = [
  { href: '/#nasil-calisir', label: 'Nasıl çalışır' },
  { href: '/#yonetmelik', label: 'Yönetmelik' },
  { href: '/#fiyat', label: 'Fiyat' },
  { href: '/#sss', label: 'SSS' },
];

/**
 * Pazarlama sayfalarının üst çubuğu.
 *
 * Mobilde bölüm bağlantıları eskiden tamamen gizleniyordu (`hidden md:flex`) ve
 * yerine hiçbir şey gelmiyordu; telefondan gelen ziyaretçi fiyat/SSS'e ancak
 * uzun uzun kaydırarak ulaşabiliyordu. Artık ikinci bir satırda yatay
 * kaydırılabilir şerit olarak duruyorlar — JS gerektirmeyen en sade çözüm.
 *
 * "Giriş yap" bilinçli olarak her boyutta görünür: kayıtlı kullanıcının
 * hesabına dönebileceği tek görünür kapı burasıdır.
 */
export function MarketingHeader() {
  return (
    // §12 Malzeme: opak şerit değil translusent katman — içerik altından akar.
    // Sert 1px çizgi yerine yalnız bulanıklık ayırıyor.
    <header className="ros-material sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-md py-sm">
        <Link
          href="/"
          className="ros-pressable shrink-0 text-lg font-semibold tracking-tight text-content active:scale-[0.98]"
        >
          Restaurant<span className="text-brand-600">OS</span>
        </Link>
        <nav className="hidden items-center gap-lg text-footnote font-medium text-content-secondary md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="ros-pressable inline-flex min-h-touch items-center transition hover:text-content"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-xs">
          <Link
            href="/giris"
            className="ros-pressable inline-flex min-h-touch items-center rounded-pill px-md text-footnote font-semibold text-content-secondary transition hover:text-content active:scale-[0.98]"
          >
            Giriş yap
          </Link>
          <Link
            href="/studyo"
            className="ros-pressable inline-flex min-h-touch items-center rounded-pill bg-brand-600 px-md text-footnote font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]"
          >
            Ücretsiz dene
          </Link>
        </div>
      </div>

      {/* Mobil bölüm şeridi — masaüstünde gizli, nav zaten yukarıda. */}
      <nav className="md:hidden">
        <div className="flex gap-xs overflow-x-auto px-md pb-sm text-footnote font-medium text-content-secondary [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="ros-pressable whitespace-nowrap rounded-pill bg-surface-raised px-md py-sm transition hover:text-content active:scale-[0.98]"
            >
              {link.label}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}

/** Pazarlama sayfalarının alt bilgisi — yasal bağlantılar burada. */
export function MarketingFooter() {
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-bold tracking-tight text-stone-900">
            Restaurant<span className="text-brand-600">OS</span>
          </p>
          <p className="mt-2 max-w-xs text-sm text-stone-500">
            Menünüzü yönetmeliğe uyumlu, çok dilli QR menüye dönüştüren yapay zeka destekli
            platform.
          </p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Ürün</p>
          <ul className="mt-3 space-y-2 text-sm text-stone-600">
            <li>
              <a href="/#nasil-calisir" className="hover:text-stone-900">
                Nasıl çalışır
              </a>
            </li>
            <li>
              <a href="/#yonetmelik" className="hover:text-stone-900">
                Yönetmelik takvimi
              </a>
            </li>
            <li>
              <a href="/#fiyat" className="hover:text-stone-900">
                Fiyatlandırma
              </a>
            </li>
            <li>
              <Link href="/studyo" className="hover:text-stone-900">
                Ücretsiz dene
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Yasal</p>
          <ul className="mt-3 space-y-2 text-sm text-stone-600">
            <li>
              <Link href="/gizlilik" className="hover:text-stone-900">
                Gizlilik ve KVKK
              </Link>
            </li>
            <li>
              <Link href="/kullanim-kosullari" className="hover:text-stone-900">
                Kullanım koşulları
              </Link>
            </li>
            <li>
              <Link href="/mesafeli-satis" className="hover:text-stone-900">
                Mesafeli satış sözleşmesi
              </Link>
            </li>
            <li>
              <Link href="/iade" className="hover:text-stone-900">
                İptal ve iade
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">İletişim</p>
          <ul className="mt-3 space-y-2 text-sm text-stone-600">
            <li>
              <a href={WHATSAPP} target="_blank" rel="noreferrer" className="hover:text-stone-900">
                WhatsApp ile yazın
              </a>
            </li>
            <li>
              <a href="mailto:destek@restaurantos.com.tr" className="hover:text-stone-900">
                destek@restaurantos.com.tr
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-stone-100 px-5 py-4">
        <p className="mx-auto max-w-6xl text-xs text-stone-400">
          © {new Date().getFullYear()} RestaurantOS. Tüm hakları saklıdır. Alerjen ve kalori
          bilgilerinin doğruluğundan işletme sorumludur; RestaurantOS beyanı kaydeder ve sunar.
        </p>
      </div>
    </footer>
  );
}

/** Sağ altta sabit duran WhatsApp düğmesi. */
export function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP}
      target="_blank"
      rel="noreferrer"
      aria-label="WhatsApp ile iletişime geçin"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-95"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.41a8.2 8.2 0 0 1 2.41 5.83c0 4.54-3.7 8.21-8.24 8.21z" />
      </svg>
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
