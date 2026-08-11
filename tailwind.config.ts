import type { Config } from 'tailwindcss';

/**
 * RestaurantOS — tasarım token'ları.
 *
 * İki kaynaktan uzlaştırıldı:
 *  · apple-ui-design → ölçekler (tipografi, boşluk, yarıçap), 44px dokunma hedefi
 *  · apple-design    → boyuta özel tracking/leading, hareket süreleri
 *
 * KURAL: bileşenlerde serbest sayı yazılmaz. `text-[13px]`, `p-[18px]`,
 * `rounded-[14px]` gibi keyfi değerler yerine buradaki adlar kullanılır.
 * Ölçeğin dışına çıkmak gerekiyorsa önce ölçek tartışılır.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  // Karanlık mod sınıf tabanlı: kullanıcı tercihi ileride bir anahtarla
  // ezilebilsin diye 'media' değil 'class'. <html> üzerindeki `dark` sınıfı
  // sistem tercihinden bir inline script ile yazılır (bkz. layout.tsx).
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed', 100: '#ffedd5', 500: '#f97316',
          600: '#ea580c', 700: '#c2410c', 900: '#7c2d12',
        },
        /**
         * Anlamsal renkler — CSS değişkenine bağlı, açık/koyu modda
         * kendiliğinden döner. Sayfalarda `bg-white` / `text-stone-900`
         * yerine bunlar kullanılır, aksi halde koyu modda görünmez olurlar.
         */
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',      // sayfa zemini
          raised: 'rgb(var(--surface-raised) / <alpha-value>)', // kart
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)', // girintili alan
        },
        content: {
          DEFAULT: 'rgb(var(--content) / <alpha-value>)',       // ana metin
          secondary: 'rgb(var(--content-secondary) / <alpha-value>)',
          muted: 'rgb(var(--content-muted) / <alpha-value>)',   // ipucu, placeholder
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
        },
      },
      /**
       * Tipografi ölçeği. Her adım boyut + satır yüksekliği + tracking'i
       * BİRLİKTE taşır — tracking boyuta özeldir, tek sabit değer her yerde
       * yanlıştır (büyük metin sıkışmalı, küçük metin açılmalı).
       */
      fontSize: {
        caption: ['0.8125rem', { lineHeight: '1.4', letterSpacing: '0.006em' }],   // 13
        footnote: ['0.875rem', { lineHeight: '1.45', letterSpacing: '0.003em' }],  // 14
        callout: ['0.9375rem', { lineHeight: '1.45', letterSpacing: '0' }],        // 15
        body: ['1.0625rem', { lineHeight: '1.55', letterSpacing: '0' }],           // 17
        lead: ['1.1875rem', { lineHeight: '1.5', letterSpacing: '-0.004em' }],     // 19
        heading: ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.014em' }],    // 24
        title: ['2rem', { lineHeight: '1.18', letterSpacing: '-0.019em' }],        // 32
        hero: ['3rem', { lineHeight: '1.08', letterSpacing: '-0.022em' }],         // 48
        display: ['3.75rem', { lineHeight: '1.04', letterSpacing: '-0.026em' }],   // 60
      },
      /** 4 / 8 / 16 / 24 / 48 / 96 ritmi — adlandırılmış hâli. */
      spacing: {
        xs: '0.25rem',   // 4
        sm: '0.5rem',    // 8
        md: '1rem',      // 16
        lg: '1.5rem',    // 24
        xl: '3rem',      // 48
        '2xl': '6rem',   // 96
        /** Erişilebilir en küçük dokunma hedefi. Buton/ikon min ölçüsü. */
        touch: '2.75rem', // 44
      },
      borderRadius: {
        card: '0.75rem',  // 12 — kart
        panel: '1.125rem', // 18 — büyük yüzey / sheet
        pill: '62.4375rem', // 999 — hap buton
      },
      maxWidth: {
        /** Okunabilir metin sütunu — uzun paragraf bunu aşmamalı. */
        prose: '42.5rem', // 680
      },
      transitionDuration: {
        fast: '100ms',  // basış geri bildirimi
        snap: '200ms',  // çapraz geçiş
        base: '300ms',
      },
    },
  },
  plugins: [],
};
export default config;
