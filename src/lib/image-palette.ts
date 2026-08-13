// RestaurantOS — Yüklenen bir görselden renk paleti çıkarma ve bunu tasarım
// ayarlarına (MenuDesignSettings) uygulama.
//
// NEDEN İSTEMCİ TARAFI: "resmin tonlarını kopyala" isteği gerçek piksel
// analizi gerektiriyor — bu bir AI tahmini değil, deterministik bir
// hesaplama. Tarayıcıda Canvas API ile yapmak sunucuya yükleme, depolama ve
// ek bir AI çağrısı gerektirmez, anında sonuç verir ve görsel hiçbir yere
// gönderilmez (gizlilik açısından da daha iyi — bkz. `apple-ui-design`
// skill'inin "yardımcı programlar kullan" yönergesi: burada yardımcı program
// bu dosyadaki renk bilimi + WCAG kontrast kontrolü).
import type { MenuDesignSettings } from './themes';

export type ExtractedPalette = { dominant: string; colors: string[] };

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const value = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean;
  const num = Number.parseInt(value, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

/** WCAG göreli parlaklık (0–1). */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG kontrast oranı (1–21 arası; 4.5+ normal metin için AA eşiği). */
export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA) + 0.05;
  const lumB = relativeLuminance(hexB) + 0.05;
  return lumA > lumB ? lumA / lumB : lumB / lumA;
}

function mix(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/**
 * Görseli küçük bir canvas'a çizip pikselleri kaba bir ızgaraya (her kanal
 * için ~11 kova) toplayarak en sık görülen renkleri döndürür. Neredeyse
 * beyaz/siyah/gri (düşük doygunluk ya da uç parlaklık) pikseller elenir —
 * bunlar genelde arka plan/gölge/highlight olur, "resmin rengi" değil.
 */
export function extractPaletteFromImage(file: File): Promise<ExtractedPalette> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas desteklenmiyor.');
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]!;
          const g = data[i + 1]!;
          const b = data[i + 2]!;
          const a = data[i + 3]!;
          if (a < 128) continue;
          const [, s, l] = rgbToHsl(r, g, b);
          if (s < 0.12 || l < 0.06 || l > 0.96) continue;
          const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`;
          const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
          bucket.count += 1;
          bucket.r += r;
          bucket.g += g;
          bucket.b += b;
          buckets.set(key, bucket);
        }

        const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
        const colors = sorted
          .slice(0, 8)
          .map((bucket) => rgbToHex(bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count));

        URL.revokeObjectURL(url);
        if (colors.length === 0) {
          resolve({ dominant: '#78716c', colors: ['#78716c'] });
          return;
        }
        resolve({ dominant: colors[0]!, colors });
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error instanceof Error ? error : new Error('Görsel işlenemedi.'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Görsel yüklenemedi.'));
    };
    img.src = url;
  });
}

/**
 * Çıkarılan paleti bir tasarımın ÜZERİNE uygular — font/aralık/doku/düzen
 * gibi yapısal ayarlar `base`'den aynen kalır, yalnızca renkler değişir.
 * Metin renkleri her zaman WCAG AA kontrastını (4.5:1) hedefleyecek şekilde
 * antrasit veya beyaz arasından seçilir — resim ne kadar koyu ya da parlak
 * olursa olsun menü her zaman okunur kalır.
 */
export function applyPaletteToDesign(base: MenuDesignSettings, palette: ExtractedPalette): MenuDesignSettings {
  const [, satDominant, lightDominant] = rgbToHsl(...hexToRgb(palette.dominant));
  const isDarkTheme = lightDominant < 0.35 && satDominant > 0.15;

  // Ana renk: paletteki en canlı (en doygun) ton — düz "arka plan rengi"
  // yerine gerçekten bir "vurgu" hissi versin.
  const vivid = [...palette.colors].sort((a, b) => {
    const [, sa] = rgbToHsl(...hexToRgb(a));
    const [, sb] = rgbToHsl(...hexToRgb(b));
    return sb - sa;
  });
  const primaryColor = vivid[0] ?? palette.dominant;
  const accentColor = vivid.find((color) => color !== primaryColor) ?? mix(primaryColor, '#ffffff', 0.35);

  const backgroundColor = isDarkTheme ? mix(palette.dominant, '#000000', 0.75) : mix(palette.dominant, '#ffffff', 0.94);
  const surfaceColor = isDarkTheme ? mix(palette.dominant, '#000000', 0.65) : '#ffffff';
  const cardColor = surfaceColor;
  const dividerColor = isDarkTheme ? mix(palette.dominant, '#ffffff', 0.25) : mix(palette.dominant, '#000000', 0.12);

  const textColor = contrastRatio('#1c1917', backgroundColor) >= contrastRatio('#fafaf9', backgroundColor) ? '#1c1917' : '#fafaf9';
  const mutedTextColor = textColor === '#1c1917' ? mix('#1c1917', backgroundColor, 0.4) : mix('#fafaf9', backgroundColor, 0.35);

  return {
    ...base,
    backgroundColor,
    surfaceColor,
    primaryColor,
    accentColor,
    textColor,
    mutedTextColor,
    cardColor,
    dividerColor,
  };
}
