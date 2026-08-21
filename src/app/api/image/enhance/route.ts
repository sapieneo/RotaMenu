import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { upscaleImage, ImageError, isImageConfigured } from '@/lib/ai/image';
import { UPGRADE_MESSAGES, normalizePlan, resolvePlanContext } from '@/lib/plans';
import { aiTierFor, consumeAiQuota, quotaStatus, refundAiQuota } from '@/lib/ai-quota';
import { authorizeImageTarget } from '@/lib/image-access';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z
  .object({
    itemId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    /** Kullanıcının yüklediği (geçici) kaynak görselin public URL'i. */
    sourceUrl: z.string().url(),
  })
  .refine((b) => Boolean(b.itemId) !== Boolean(b.categoryId), {
    message: 'itemId veya categoryId (yalnızca biri) gerekli.',
  });

/**
 * POST /api/image/enhance
 * Yüklenen görseli içeriğini değiştirmeden yükseltir/keskinleştirir (Runware
 * upscale), venue-media'ya kalıcı kaydeder, ürün image_url veya kategori
 * background_url'ini günceller, geçici kaynağı siler. Görsel üretimiyle aynı
 * org editörü / süper-admin / hedef işletme pano oturumu kuralını kullanır.
 */
export async function POST(request: NextRequest) {
  if (!isImageConfigured()) {
    return NextResponse.json(
      { error: 'Görsel iyileştirme yapılandırılmamış. RUNWARE_API_KEY ekleyin.' },
      { status: 501 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  const { itemId, categoryId, sourceUrl } = parsed.data;
  const supabase = createClient();
  const access = await authorizeImageTarget(supabase, { itemId, categoryId });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { target, user } = access;

  const publicPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-media/`;
  if (!sourceUrl.startsWith(publicPrefix)) {
    return NextResponse.json({ error: 'Geçersiz görsel adresi.' }, { status: 400 });
  }
  const sourcePath = sourceUrl.slice(publicPrefix.length).split('?')[0];

  const admin = createAdminClient();
  const { table, column, subdir, id, orgId } = target;
  if (!sourcePath.startsWith(`${orgId}/`)) {
    return NextResponse.json({ error: 'Geçersiz görsel adresi.' }, { status: 400 });
  }

  // Plan kapısı: görsel iyileştirme yalnız Pro+ planlarda.
  const { data: orgRow } = await admin
    .from('organizations')
    .select('plan, trial_ends_at')
    .eq('id', orgId)
    .maybeSingle();
  if (!resolvePlanContext(orgRow?.plan, orgRow?.trial_ends_at).limits.images) {
    return NextResponse.json(
      { error: UPGRADE_MESSAGES.images, code: 'upgrade_required' },
      { status: 402 }
    );
  }

  // ── AI maliyet koruması ── (bkz. lib/ai-quota.ts; plan kapısı tek başına
  // yetmez, deneme sürerken anonim kullanıcı da 'pro' sayılıyor)
  const enhTier = aiTierFor({
    isAnonymous: Boolean(user?.is_anonymous),
    email: user?.email,
    basePlan: normalizePlan(orgRow?.plan),
  });
  const enhQuota = await consumeAiQuota(orgId, 'image', 1, enhTier);
  if (!enhQuota.ok) {
    return NextResponse.json(
      { error: enhQuota.message, code: enhQuota.reason === 'identity' ? 'account_required' : 'quota_exceeded' },
      { status: quotaStatus(enhQuota) }
    );
  }

  try {
    const bytes = await upscaleImage(sourceUrl);
    const path = `${orgId}/${subdir}/${id}-${Date.now().toString(36)}.webp`;
    const { error: upErr } = await admin.storage
      .from('venue-media')
      .upload(path, bytes, { contentType: 'image/webp', upsert: true });
    if (upErr) return NextResponse.json({ error: 'Görsel kaydedilemedi.' }, { status: 500 });

    const {
      data: { publicUrl },
    } = admin.storage.from('venue-media').getPublicUrl(path);

    const { error: updErr } = await admin.from(table).update({ [column]: publicUrl }).eq('id', id);
    if (updErr) return NextResponse.json({ error: 'Görsel bağlanamadı.' }, { status: 500 });

    if (sourcePath !== path) {
      await admin.storage.from('venue-media').remove([sourcePath]);
    }

    return NextResponse.json({ imageUrl: publicUrl });
  } catch (err) {
    await refundAiQuota(orgId, 'image', 1);
    const message = err instanceof ImageError ? err.message : 'Görsel iyileştirilemedi.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
