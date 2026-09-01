import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { authorizeImageTarget } from '@/lib/image-access';
import { generateMenuDescriptions } from '@/lib/ai/translate';
import { aiTierFor, consumeAiQuota, quotaStatus, refundAiQuota } from '@/lib/ai-quota';
import { normalizePlan } from '@/lib/plans';

export const runtime = 'nodejs';
export const maxDuration = 30;

const bodySchema = z.object({ itemId: z.string().uuid() });

/**
 * POST /api/menu/item/describe — TEK ürün için AI açıklaması (müşteri talebi B4).
 *
 * `/api/menu/generate-descriptions` toplu ve arka planda çalışıyor; ürün
 * düzenlerken tek bir açıklama isteyen kullanıcı için uygun değil. Bu uç
 * eşzamanlı çalışır ve metni DÖNDÜRÜR — kaydetmez. Kullanıcı önizler,
 * isterse düzenler, sonra ürünü kaydeder. Böylece beğenilmeyen bir metin
 * menüye yazılmış olmaz.
 *
 * Aynı AI fonksiyonu (generateMenuDescriptions) kullanılıyor, yani tek ürün
 * ile toplu üretim aynı üslupta ve aynı kısıtlarla (malzeme/alerjen uydurma
 * yok) sonuç veriyor.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  const access = await authorizeImageTarget(supabase, { itemId: parsed.data.itemId });
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const admin = createAdminClient();
  const { data: item } = await admin
    .from('items')
    .select('id, name, description, ingredients, category_id')
    .eq('id', parsed.data.itemId)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: 'Ürün bulunamadı.' }, { status: 404 });

  const { data: category } = await admin
    .from('categories')
    .select('name')
    .eq('id', item.category_id)
    .maybeSingle();

  // ── AI maliyet koruması ── (bkz. lib/ai-quota.ts)
  const { data: orgRow } = await admin
    .from('organizations')
    .select('plan')
    .eq('id', access.target.orgId)
    .maybeSingle();
  const tier = aiTierFor({
    isAnonymous: Boolean(access.user?.is_anonymous),
    email: access.user?.email,
    basePlan: normalizePlan(orgRow?.plan),
  });
  const quota = await consumeAiQuota(access.target.orgId, 'description', 1, tier);
  if (!quota.ok) {
    return NextResponse.json(
      { error: quota.message, code: quota.reason === 'identity' ? 'account_required' : 'quota_exceeded' },
      { status: quotaStatus(quota) }
    );
  }

  try {
    const { items } = await generateMenuDescriptions([
      {
        id: item.id as string,
        categoryName: (category?.name as string) ?? '',
        name: item.name as string,
        description: null, // mevcut açıklamayı vermiyoruz: yeniden yazsın
        ingredients: (item.ingredients as string | null) ?? null,
      },
    ]);
    const description = items[0]?.description?.trim();
    if (!description) throw new Error('Boş yanıt');
    return NextResponse.json({ description });
  } catch (error) {
    await refundAiQuota(access.target.orgId, 'description', 1);
    // Sağlayıcının ham mesajını istemciye basmıyoruz (model adı, kota/fatura
    // detayı sızdırabiliyor); sunucuya loglanır.
    console.error('[api/menu/item/describe] failed', {
      itemId: item.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Açıklama üretilemedi. Biraz sonra tekrar dene.' }, { status: 502 });
  }
}
