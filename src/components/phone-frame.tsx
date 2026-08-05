/**
 * Paylaşılan telefon çerçevesi — gerçek iOS durum çubuğuyla (saat, sinyal,
 * wifi, pil). Pano'daki canlı önizlemede tanımlanan sistem burada tek yerde
 * toplandı; landing hero ve tasarım stüdyosu da aynı boyut/şekli kullanır.
 *
 * Dış çerçeve sabit 280x580 (pano ile birebir aynı). İçerik durum çubuğunun
 * (28px) altından başlar ve kalan 552px'i doldurur — kendi scroll'unu yönetir.
 */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[280px] rounded-[2.5rem] border-[10px] border-stone-900 bg-stone-900 shadow-xl">
      <div className="relative h-[580px] w-full overflow-hidden rounded-[1.75rem] bg-white">
        <PhoneStatusBar />
        {children}
      </div>
    </div>
  );
}

/** Gerçek telefon durum çubuğu: beyaz zemin, ortada çentik, saat, wifi + pil. */
export function PhoneStatusBar() {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex h-7 items-center justify-between bg-white px-4 text-[11px] font-semibold text-stone-900">
      <span>9:41</span>
      <div className="pointer-events-none absolute left-1/2 top-0 h-5 w-20 -translate-x-1/2 rounded-b-xl bg-stone-900" />
      <span className="flex items-center gap-1">
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden>
          <rect x="0" y="7" width="3" height="4" rx="0.5" fill="currentColor" />
          <rect x="4.5" y="5" width="3" height="6" rx="0.5" fill="currentColor" />
          <rect x="9" y="2.5" width="3" height="8.5" rx="0.5" fill="currentColor" />
          <rect x="13" y="0" width="3" height="11" rx="0.5" fill="currentColor" opacity="0.3" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden>
          <path d="M7.5 2C4.6 2 2.1 3.1.3 4.9l1.3 1.3C3 4.7 5.1 3.8 7.5 3.8s4.5.9 5.9 2.4l1.3-1.3C12.9 3.1 10.4 2 7.5 2Z" fill="currentColor" />
          <path d="M7.5 5.6c-1.6 0-3 .6-4.1 1.6l1.4 1.4c.7-.7 1.7-1.1 2.7-1.1s2 .4 2.7 1.1l1.4-1.4C10.5 6.2 9.1 5.6 7.5 5.6Z" fill="currentColor" />
          <circle cx="7.5" cy="9.6" r="1.2" fill="currentColor" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none" aria-hidden>
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="currentColor" opacity="0.4" />
          <rect x="2" y="2" width="17" height="8" rx="1.5" fill="currentColor" />
          <rect x="24" y="4" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.4" />
        </svg>
      </span>
    </div>
  );
}

/**
 * Durum çubuğunun altındaki içerik alanı: 390px genişliğinde "gerçek telefon"
 * render eder, sonra 260px'e sığması için 0.6667 ölçekler. iframe veya canlı
 * div içerik için ortak — pano'nun kullandığı teknikle birebir aynı.
 */
export function PhoneScaledContent({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-x-0 overflow-hidden"
      style={{ top: '28px', bottom: 0 }}
    >
      <div
        style={{
          width: '390px',
          height: '828px',
          transform: 'scale(0.6667)',
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}
