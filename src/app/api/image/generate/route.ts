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

  const { orgId, table, column, subdir, id: targetId } = target;

  // ── İşletme bazlı AI görsel anahtarı (müşteri talebi B3) ─────────────────
  // Yeni işletmelerde KAPALI. Elle görsel yükleme bundan etkilenmez; yalnız
  // ücretli AI üretimi kapanır.
  const { data: venueRow } = await admin
    .from('venues')
    .select('ai_images_enabled')
    .eq('id', target.venueId)
    .maybeSingle();
  if (!venueRow?.ai_images_enabled) {
    return NextResponse.json(
      {
        error: 'Bu işletmede AI görsel üretimi kapalı. Ayarlar’dan açabilirsin.',
        code: 'ai_images_disabled',
      },
      { status: 403 }
    );
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

  // ── Prompt üretimi ARTIK BURADA ──────────────────────────────────────────
  // Eskiden yetki/plan/kota kontrollerinden ÖNCE çalışıyordu: describeDish...
  // gerçek bir OpenAI çağrısı, yani 403 dönmeden önce fatura üretiliyordu ve
  // kota da tüketilmediği için sınırsız tekrarlanabiliyordu (güvenlik raporu
  // §1.8). Artık tüm kapılar geçildikten sonra çağrılıyor.
  let prompt: string;
  let dims: { width: number; height: number } | undefined;

  try {
    if (itemId) {
      const { data: item } = await admin
        .from('items')
        .select('id, name, description, ingredients, org_id')
        .eq('id', itemId)
        .maybeSingle();
      if (!item) {
        await refundAiQuota(orgId, 'image', 1);
        return NextResponse.json({ error: 'Ürün bulunamadı.' }, { status: 404 });
      }
      const subject = await describeDishInEnglish(item.name, item.description, item.ingredients);
      prompt = customPrompt ?? buildFoodPrompt(subject);
    } else {
      const { data: cat } = await admin
        .from('categories')
        .select('id, name, org_id')
        .eq('id', categoryId!)
        .maybeSingle();
      if (!cat) {
        await refundAiQuota(orgId, 'image', 1);
        return NextResponse.json({ error: 'Kategori bulunamadı.' }, { status: 404 });
      }
      const subject = await describeCategoryBackground(cat.name);
      prompt = customPrompt ?? buildBackgroundPrompt(subject);
      dims = { width: 1024, height: 512 };
    }
  } catch (err) {
    await refundAiQuota(orgId, 'image', 1);
    console.error('[api/image/generate] prompt failed', {
      targetId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Görsel açıklaması üretilemedi.' }, { status: 502 });
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
