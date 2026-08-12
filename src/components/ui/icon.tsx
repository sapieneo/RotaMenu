/**
 * RestaurantOS — ikon seti.
 *
 * NEDEN VAR: sayfalarda emoji (📸 🌍 🛡) kullanılıyordu. Emoji her işletim
 * sisteminde farklı çizilir, boyutu ve optik ağırlığı kontrol edilemez,
 * renk alamaz ve ekran okuyucuda gürültü yapar — "sistem fontları, dekoratif
 * font yok" kuralının ihlali. Bunlar çizgi tabanlı SVG: boyutu `size`,
 * rengi `currentColor` ile gelir, koyu modda kendiliğinden döner.
 *
 * Hepsi 24×24 kutuda, 1.75 çizgi kalınlığında, yuvarlak uçlu — tek bir
 * optik aile oluştursun diye.
 */
import type { SVGProps } from 'react';

export type IconName =
  | 'clock'
  | 'globe'
  | 'shield'
  | 'lock'
  | 'camera'
  | 'leaf'
  | 'flame'
  | 'palette'
  | 'image'
  | 'qr'
  | 'chart'
  | 'check'
  | 'plus'
  | 'arrow-right'
  | 'dots'
  | 'trash'
  | 'external'
  | 'search'
  | 'alert';

const PATHS: Record<IconName, React.ReactNode> = {
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18-2.5-2.7-2.5-15.3 0-18Z" />
    </>
  ),
  shield: <path d="M12 3l7 3v5c0 4.4-2.9 8.2-7 10-4.1-1.8-7-5.6-7-10V6l7-3Z" />,
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8h3.5L8 6h8l1.5 2H21v11H3V8Z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  leaf: (
    <>
      <path d="M4 20c0-8 5-13 16-13 0 9-5 13-11 13H4Z" />
      <path d="M4 20c3-4 6.5-6.5 11-8" />
    </>
  ),
  flame: <path d="M12 3c3 4 6 5.5 6 9.5A6 6 0 0 1 6 12.5C6 9 8 8 9 5.5c1.5 1 2 2.5 2 4 .8-1.6 1-4 1-6.5Z" />,
  palette: (
    <>
      <path d="M12 21a9 9 0 1 1 9-9c0 2-1.6 3-3.2 3H16a2 2 0 0 0-1.4 3.4c.4.5.4 1.2 0 1.7-.6.6-1.5.9-2.6.9Z" />
      <circle cx="8" cy="11" r="1" />
      <circle cx="12" cy="8" r="1" />
      <circle cx="16" cy="11" r="1" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M3 17l5-4 4 3 3-2 6 5" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 14h3v3h-3zM20 14v3M14 20h6" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  check: <path d="M4.5 12.5l5 5 10-11" />,
  plus: <path d="M12 5v14M5 12h14" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  dots: (
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5L21 21" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4l9 16H3l9-16Z" />
      <path d="M12 10v4M12 17.5v.01" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  ...rest
}: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
