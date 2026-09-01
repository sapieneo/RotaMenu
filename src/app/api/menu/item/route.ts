import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { authorizeImageTarget } from '@/lib/image-access';

export const runtime = 'nodejs';

/**
 * Tek tek ürün girişi (müşteri talebi B1).
 *
 * Bugüne kadar ürün eklemenin TEK yolu bir yükleme akışının taslak editörüydü;
 * menüsü yayında olan bir mekan tek bir yeni ürün ekleyemiyordu. Bu uç canlı
 * menüye doğrudan ürün ekler/günceller/siler.
 *
 * YETKİ: `authorizeImageTarget` yeniden kullanılıyor (adı görselden geliyor ama
 * yaptığı iş tam olarak "bu kullanıcı bu ürünü/kategoriyi yönetebilir mi"):
 * Supabase org editörü, süper-admin oturumu VEYA hedef işletmenin pano
 * oturumu. Böylece ajans çalışanı ve pano şifresiyle giren müşteri de ürün
 * ekleyebiliyor — bu üç yolu tanımayan uçlar 401 döndürüyordu.
 *
 * `org_id` GÖNDERİLMİYOR: veritabanındaki `app.fill_org_id` trigger'ı onu
 * kategoriden türetiyor (bkz. 20260826091819_org_id_parent_authority.sql).
 */

const createSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1, 'Ürün adı boş olamaz.').max(200),
  description: z.string().trim().max(2000).nullish(),
  ingredients: z.string().trim().max(2000).nullish(),
  price: z.number().min(0).max(1_000_000).nullish(),
  caloriesKcal: z.number().int().min(0).max(20000).nullish(),
  isFeatured: z.boolean().optional(),
});

const updateSchema = z.object({
  itemId: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullish(),
  ingredients: z.string().trim().max(2000).nullish(),
  price: z.number().min(0).max(1_000_000).nullish(),
  caloriesKcal: z.number().int().min(0).max(20000).nullish(),
  isFeatured: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
});

const deleteSchema = z.object({ itemId: z.string().uuid() });

const norm = (v: string | null | undefined) => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

export async function POST(request: NextRequest) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz veri.' }, { status: 400 });
  }
  const b = parsed.data;

  const access = await authorizeImageTarget(createClient(), { categoryId: b.categoryId });
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const admin = createAdminClient();

  // Yeni ürün kategorinin SONUNA eklenir.
  const { data: last } = await admin
    .from('items')
    .select('sort_order')
    .eq('category_id', b.categoryId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? -1) + 1;

  const { data: item, error } = await admin
    .from('items')
    .insert({
      category_id: b.categoryId,
      name: b.name,
      description: norm(b.description),
      ingredients: norm(b.ingredients),
      price: b.price ?? null,
      calories_kcal: b.caloriesKcal ?? null,
      calories_source: b.caloriesKcal != null ? 'manual' : null,
      is_featured: b.isFeatured ?? false,
      sort_order: sortOrder,
      allergens_confirmed: false,
    })
    .select('id, name, description, ingredients, price, calories_kcal, is_featured, sort_order')
    .single();

  if (error || !item) {
    console.error('[api/menu/item] insert failed', { code: error?.code, message: error?.message });
    return NextResponse.json({ error: 'Ürün eklenemedi.' }, { status: 500 });
  }

  // Uyum kaydı: elle eklenen üründe alerjen ve kalori İNCELENMEMİŞTİR.
  // Misafir menüsü onaysız alerjeni göstermiyor; bu satır olmadan ürün
  // uyum ekranında hiç görünmez ve sessizce denetim dışı kalırdı.
  const { error: compErr } = await admin.from('item_compliance').insert({
    item_id: item.id,
    allergen_review: 'pending',
    calories_review: 'pending',
  });
  if (compErr) {
    console.error('[api/menu/item] compliance row failed', { itemId: item.id, message: compErr.message });
  }

  return NextResponse.json({ item }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz veri.' }, { status: 400 });
  }
  const b = parsed.data;

  const access = await authorizeImageTarget(createClient(), { itemId: b.itemId });
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) patch.name = b.name;
  if (b.description !== undefined) patch.description = norm(b.description);
  if (b.ingredients !== undefined) patch.ingredients = norm(b.ingredients);
  if (b.price !== undefined) patch.price = b.price ?? null;
  if (b.caloriesKcal !== undefined) {
    patch.calories_kcal = b.caloriesKcal ?? null;
    patch.calories_source = b.caloriesKcal != null ? 'manual' : null;
  }
  if (b.isFeatured !== undefined) patch.is_featured = b.isFeatured;
  if (b.isAvailable !== undefined) patch.is_available = b.isAvailable;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Güncellenecek alan yok.' }, { status: 400 });
  }

  const { data: item, error } = await createAdminClient()
    .from('items')
    .update(patch)
    .eq('id', b.itemId)
    .select('id, name, description, ingredients, price, calories_kcal, is_featured, sort_order')
    .single();

  if (error || !item) {
    console.error('[api/menu/item] update failed', { code: error?.code, message: error?.message });
    return NextResponse.json({ error: 'Ürün güncellenemedi.' }, { status: 500 });
  }
  return NextResponse.json({ item });
}

export async function DELETE(request: NextRequest) {
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  const access = await authorizeImageTarget(createClient(), { itemId: parsed.data.itemId });
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { error } = await createAdminClient().from('items').delete().eq('id', parsed.data.itemId);
  if (error) {
    console.error('[api/menu/item] delete failed', { code: error.code, message: error.message });
    return NextResponse.json({ error: 'Ürün silinemedi.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
