import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  buildBackgroundPrompt,
  buildFoodPrompt,
  describeCategoryBackground,
  describeDishInEnglish,
  generateImage,
  ImageError,
  isImageConfigured,
} from '@/lib/ai/image';
import { UPGRADE_MESSAGES, normalizePlan, resolvePlanContext } from '@/lib/plans';
import { aiTierFor, consumeAiQuota, quotaStatus, refundAiQuota } from '@/lib/ai-quota';
import { authorizeImageTarget } from '@/lib/image-access';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z
  .object({
    itemId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    prompt: z.string().trim().min(2).max(2000).optional(),
  })
  .refine((b) => Boolean(b.itemId) !== Boolean(b.categoryId), {
    message: 'itemId veya categoryId (yalnızca biri) gerekli.',
  });

/**
 * POST /api/image/generate
 * Ürün (itemId) veya kategori arka planı (categoryId) için AI görseli üretir,
 * venue-media'ya kaydeder, ilgili URL alanını günceller. Org editörü,
 * süper-admin veya hedef işletmenin pano oturumu şarttır.
 */
export async function POST(request: NextRequest) {
  if (!isImageConfigured()) {
    return NextResponse.json(
      { error: 'Görsel üretimi yapılandırılmamış. RUNWARE_API_KEY ekleyin.' },
      { status: 501 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  const { itemId, categoryId, prompt: customPrompt } = parsed.data;
  const supabase = createClient();
  const access = await authorizeImageTarget(supabase, { itemId, categoryId });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { target, user } = access;
  const admin = createAdminClient();

  // Hedefi çöz: ürün mü kategori mi
  const { orgId, table, column, subdir, id: targetId } = target;
  let prompt: string;
  let dims: { width: number; height: number } | undefined;

  if (itemId) {
    const { data: item } = await admin
      .from('items')
      .select('id, name, description, ingredients, org_id')
      .eq('id', itemId)
      .maybeSingle();
    if (!item) return NextResponse.json({ error: 'Ürün bulunamadı.' }, { status: 404 });
    const subject = await describeDishInEnglish(item.name, item.description, item.ingredients);
    prompt = customPrompt ?? buildFoodPrompt(subject);
  } else {
    const { data: cat } = await admin
      .from('categories')
      .select('id, name, org_id')
      .eq('id', categoryId!)
      .maybeSingle();
    if (!cat) return NextResponse.json({ error: 'Kategori bulunamadı.' }, { status: 404 });
    const subject = await describeCategoryBackground(cat.name);
    prompt = customPrompt ?? buildBackgroundPrompt(subject);
    dims = { width: 1024, height: 512 };
  }

  // Plan kapısı: görsel üretimi yalnız görsele izin veren planlarda (Pro+).
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

  // ── AI maliyet koruması ──────────────────────────────────────────────────
  // Plan kapısı deneme sürerken herkesi 'pro' saydığı için TEK BAŞINA yetmez:
  // anonim ziyaretçi de görsel üretebiliyordu. Kimlik + günlük kota şart.
  const imgTier = aiTierFor({
    isAnonymous: Boolean(user?.is_anonymous),
    email: user?.email,
    basePlan: normalizePlan(orgRow?.plan),
  });
  const imgQuota = await consumeAiQuota(orgId, 'image', 1, imgTier);
  if (!imgQuota.ok) {
    return NextResponse.json(
      { error: imgQuota.message, code: imgQuota.reason === 'identity' ? 'account_required' : 'quota_exceeded' },
      { status: quotaStatus(imgQuota) }
    );
  }

  try {
    const bytes = await generateImage(prompt, dims);
    const path = `${orgId}/${subdir}/${targetId}-${Date.now().toString(36)}.webp`;
    const { error: upErr } = await admin.storage
      .from('venue-media')
      .upload(path, bytes, { contentType: 'image/webp', upsert: true });
    if (upErr) return NextResponse.json({ error: 'Görsel kaydedilemedi.' }, { status: 500 });

    const {
      data: { publicUrl },
    } = admin.storage.from('venue-media').getPublicUrl(path);

    const { error: updErr } = await admin.from(table).update({ [column]: publicUrl }).eq('id', targetId);
    if (updErr) return NextResponse.json({ error: 'Görsel bağlanamadı.' }, { status: 500 });

    return NextResponse.json({ imageUrl: publicUrl });
  } catch (err) {
    // Sağlayıcı görseli üretemediyse kullanıcıdan kota düşmesin.
    await refundAiQuota(orgId, 'image', 1);
    const message = err instanceof ImageError ? err.message : 'Görsel üretilemedi.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
