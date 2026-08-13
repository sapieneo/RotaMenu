import { z } from 'zod';
import { TEXTURE_OPTIONS } from '@/lib/themes';

/**
 * Menü tasarım ayarlarının kanonik doğrulaması.
 *
 * Tek yerde durmasının sebebi: bu değerler HEM kaydetme yolunda
 * (`PATCH /api/venue/design`) HEM de tasarım stüdyosunun canlı önizlemesinde
 * (`/m/[slug]?previewDesign=…`) kullanılıyor. Önizleme yolu bir dönem
 * doğrulamasız çalışıyordu; `menuBackgroundStyle` değerleri `url("…")` içine
 * kaçışsız gömdüğü için doğrulanmamış girdi CSS enjeksiyonuna açık kapı
 * bırakıyordu. İki yol da artık aynı şemadan geçiyor.
 */
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Geçersiz renk değeri.');

export const menuDesignSchema = z.object({
  templateId: z.string().trim().min(1).max(40),
  backgroundColor: color,
  surfaceColor: color,
  primaryColor: color,
  accentColor: color,
  textColor: color,
  mutedTextColor: color,
  headingFont: z.string().min(1).max(120),
  bodyFont: z.string().min(1).max(120),
  baseFontSize: z.number().int().min(13).max(20),
  headingScale: z.number().min(1).max(1.6),
  cardColor: color,
  cardOpacity: z.number().int().min(0).max(100),
  cardRadius: z.number().int().min(0).max(32),
  itemSpacing: z.number().int().min(6).max(28),
  dividerColor: color,
  dividerOpacity: z.number().int().min(0).max(100),
  texture: z.enum(
    TEXTURE_OPTIONS.map((option) => option.id) as ['none', 'paper', 'linen', 'dots', 'grid']
  ),
  textureOpacity: z.number().int().min(0).max(60),
  backgroundImageUrl: z.string().url().nullable(),
  backgroundImageOpacity: z.number().int().min(0).max(100),
  backgroundImageMode: z.enum(['cover', 'tile']),
  layout: z.enum(['single', 'two-column']),
  headerHeight: z.number().int().min(60).max(320),
  logoSize: z.number().int().min(24).max(160),
  logoPositionX: z.number().int().min(0).max(100),
});

/**
 * Arka plan görseli yalnızca kendi Supabase depomuzdan gelebilir — hem dış
 * kaynak sızıntısını hem de `url("…")` içine sokulacak keyfi metni engeller.
 */
export function isAllowedBackgroundImageUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  const allowedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-media/`;
  return url.startsWith(allowedPrefix);
}

/**
 * Önizleme (query string) yolu için: geçersizse sessizce null döner —
 * kayıtlı tasarıma düşülür, kullanıcıya hata gösterilmez.
 */
export function parsePreviewDesign(raw: string | undefined): unknown {
  if (!raw) return null;
  try {
    const parsed = menuDesignSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    if (!isAllowedBackgroundImageUrl(parsed.data.backgroundImageUrl)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
