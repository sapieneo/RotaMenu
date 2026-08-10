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

const EDITOR_ROLES = ['owner', 'admin', 'editor'];

/**
 * POST /api/image/generate
 * Ürün (itemId) veya kategori arka planı (categoryId) için AI görseli üretir,
 * venue-media'ya kaydeder, ilgili URL alanını günceller. Üyelik (editor+) şart.
 */
export async function POST(request: NextRequest) {
  if (!isImageConfigured()) {
    return NextResponse.json(
      { error: 'Görsel üretimi yapılandırılmamış. RUNWARE_API_KEY ekleyin.' },
      { status: 501 }
    );
  }

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
  const { itemId, categoryId, prompt: customPrompt } = parsed.data;
  const admin = createAdminClient();

  // Hedefi çöz: ürün mü kategori mi
  let orgId: string;
  let table: 'items' | 'categories';
  let column: 'image_url' | 'background_url';
  let subdir: 'items' | 'categories';
  let targetId: string;
  let prompt: string;
  let dims: { width: number; height: number } | undefined;

  if (itemId) {
    const { data: item } = await admin
      .from('items')
      .select('id, name, description, ingredients, org_id')
      .eq('id', itemId)
      .maybeSingle();
    if (!item) return NextResponse.json({ error: 'Ürün bulunamadı.' }, { status: 404 });
    orgId = item.org_id;
    table = 'items';
    column = 'image_url';
    subdir = 'items';
    targetId = item.id;
    const subject = await describeDishInEnglish(item.name, item.description, item.ingredients);
    prompt = customPrompt ?? buildFoodPrompt(subject);
  } else {
    const { data: cat } = await admin
      .from('categories')
      .select('id, name, org_id')
      .eq('id', categoryId!)
      .maybeSingle();
    if (!cat) return NextResponse.json({ error: 'Kategori bulunamadı.' }, { status: 404 });
    orgId = cat.org_id;
    table = 'categories';
    column = 'background_url';
    subdir = 'categories';
    targetId = cat.id;
    const subject = await describeCategoryBackground(cat.name);
    prompt = customPrompt ?? buildBackgroundPrompt(subject);
    dims = { width: 1024, height: 512 };
  }

  // Üyelik doğrula (editor+)
  const { data: mem } = await admin
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!mem || !EDITOR_ROLES.includes(mem.role)) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 });
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
    isAnonymous: Boolean(user.is_anonymous),
    email: user.email,
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
