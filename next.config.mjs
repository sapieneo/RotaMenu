/** @type {import('next').NextConfig} */

/**
 * Güvenlik başlıkları.
 *
 * Kod tabanında hiçbir güvenlik başlığı tanımlı değildi: CSP yok, çerçeveleme
 * koruması yok, HSTS yok. Sonuçları:
 *  • /m/[slug], /studyo ve /admin herhangi bir siteye iframe'e gömülebiliyordu
 *    (clickjacking; admin oturumu 12 saat açık kalıyor).
 *  • Misafir menüsü işletmelerin girdiği metni ve renkleri render ettiği için
 *    bir enjeksiyon bulunduğunda hiçbir ikinci savunma katmanı yoktu.
 *
 * CSP notları:
 *  • `'unsafe-inline'` style için ZORUNLU — tasarım ayarları (renk, font,
 *    kapak görseli) satır içi `style` özniteliğiyle uygulanıyor.
 *  • script için `'unsafe-inline'` gerekiyor: Next.js hidratasyon verisini
 *    inline script olarak basıyor. `'unsafe-eval'` YOK.
 *  • img-src'de Supabase Storage (görseller) ve data: (küçük ikonlar) var.
 *  • frame-ancestors 'self': Stüdyo'daki canlı önizleme kendi menümüzü
 *    iframe'e alıyor (bkz. gorseller/image-manager.tsx → LivePreview), bu
 *    yüzden 'none' değil 'self'.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  experimental: {
    // pdfkit'i webpack ile paketleme; node_modules'tan çalışma anında yüklensin
    // (aksi halde kendi .afm font veri dosyalarını bulamayıp 500 verir).
    // iyzipay da çalışma anında resources/ dizinini fs.readdirSync ile okur →
    // bundle edilirse kaynakları bulamaz; harici bırakılır.
    serverComponentsExternalPackages: ['pdfkit', 'iyzipay'],
    // PDF uyum raporu, TTF fontları çalışma anında fs ile okur; serverless
    // bundle'ına dahil edilmeleri için izlenecek dosyalara eklenir.
    outputFileTracingIncludes: {
      '/api/compliance/report': ['./src/server/fonts/**'],
      // QR kartı PDF'i (B2) de aynı TTF fontları çalışma anında okur.
      '/api/qr/[code]': ['./src/server/fonts/**'],
    },
  },
};
export default nextConfig;
