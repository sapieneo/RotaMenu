import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { extractMenuFromFiles, MenuExtractionError, type MenuPage } from '@/lib/ai/extract';
import { aiTierFor, consumeAiQuota, quotaStatus, refundAiQuota } from '@/lib/ai-quota';
import { normalizePlan } from '@/lib/plans';

const EDITOR_ROLES = ['owner', 'admin', 'editor'];

export const runtime = 'nodejs';
export const maxDuration = 120;

const bodySchema = z.object({
  venueId: z.string().uuid(),
  pages: z
    .array(
      z.object({
        storagePath: z.string().min(3),
        mimeType: z.string(),
        sourceType: z.enum(['image', 'pdf']),
      })
    )
    .min(1)
    .max(10),
});

/**
 * POST /api/menu/extract-pages
 * Ek sayfaları OCR eder ve çıkarılan menüyü döner — DURUM DEĞİŞTİRMEZ
 * (ingestion oluşturmaz/güncellemez). Taslak editöründe "Sayfa ekle" akışı,
 * dönen kategorileri mevcut taslağa istemci tarafında ekler.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  const { venueId, pages } = parsed.data;

  const { data: venue } = await supabase
    .from('venues')
    .select('id, org_id')
    .eq('id', venueId)
    .maybeSingle();
  if (!venue) {
    return NextResponse.json({ error: 'Mekân bulunamadı.' }, { status: 404 });
  }
  if (pages.some((p) => !p.storagePath.startsWith(`${venue.org_id}/`))) {
    return NextResponse.json({ error: 'Geçersiz dosya yolu.' }, { status: 403 });
  }

  const admin = createAdminClient();

  // ── Üyelik kontrolü ──────────────────────────────────────────────────────
  // Yukarıdaki `if (!venue)` bir YETKİ kapısı DEĞİL: venues_select politikası
  // yayındaki her işletmeyi herkese gösteriyor, dolayısıyla başka bir org'un
  // venue kimliği verildiğinde de sorgu satır döndürüyordu. Tek gerçek engel
  // storage yolundaki UUID'nin gizliliğiydi — yetkilendirmenin bir sırra
  // dayanması yanlış (güvenlik raporu §1.7).
  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('org_id', venue.org_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !EDITOR_ROLES.includes(membership.role)) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 });
  }

  // ── AI maliyet koruması ──────────────────────────────────────────────────
  // Bu uç sayfa başına vision çağrısı yapıyor ama hiç kota tüketmiyordu:
  // /api/ingest, image/generate, menu/translate hepsi tüketirken burası
  // sınırsız döngüye açıktı (güvenlik raporu §1.7).
  const { data: orgRow } = await admin
    .from('organizations')
    .select('plan')
    .eq('id', venue.org_id)
    .maybeSingle();
  const tier = aiTierFor({
    isAnonymous: Boolean(user.is_anonymous),
    email: user.email,
    basePlan: normalizePlan(orgRow?.plan),
  });
  const quota = await consumeAiQuota(venue.org_id, 'ingest', pages.length, tier);
  if (!quota.ok) {
    return NextResponse.json(
      { error: quota.message, code: quota.reason === 'identity' ? 'account_required' : 'quota_exceeded' },
      { status: quotaStatus(quota) }
    );
  }

  const menuPages: MenuPage[] = [];
  for (const p of pages) {
    const { data: blob, error: dlErr } = await admin.storage.from('menu-uploads').download(p.storagePath);
    if (dlErr || !blob) {
      await refundAiQuota(venue.org_id, 'ingest', pages.length);
      return NextResponse.json({ error: 'Dosya okunamadı. Lütfen yeniden yükleyin.' }, { status: 400 });
    }
    menuPages.push({ buffer: Buffer.from(await blob.arrayBuffer()), mimeType: p.mimeType });
  }

  try {
    const { extracted } = await extractMenuFromFiles(menuPages);
    return NextResponse.json({ categories: extracted.categories, warnings: extracted.warnings });
  } catch (err) {
    // OCR başarısızsa kullanıcıdan kota düşmesin.
    await refundAiQuota(venue.org_id, 'ingest', pages.length);
    const message =
      err instanceof MenuExtractionError ? err.message : 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
    console.error(
      'Menu page extraction failed',
      err instanceof MenuExtractionError
        ? (err.diagnostic ?? { type: err.name })
        : { type: err instanceof Error ? err.name : 'unknown' }
    );
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
