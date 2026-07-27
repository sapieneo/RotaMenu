import { createClient } from '@/lib/supabase/server';
import { planLimits } from '@/lib/plans';
import { ImageManager, type ImgCategory } from './image-manager';

export const dynamic = 'force-dynamic';

/**
 * Görsel yönetimi (A7): ürün başına AI görseli üret / yeniden üret /
 * elle yükle / kaldır. Görseller misafir menüsünde görünür.
 */
export default async function ImagesPage() {
  const supabase = createClient();

  const { data: venue } = await supabase
    .from('venues')
    .select('id, org_id, slug')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!venue) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold">Henüz menün yok</h1>
        <p className="text-stone-600">Önce bir menü oluştur; sonra ürün görsellerini buradan ekle.</p>
        <a href="/studyo" className="mt-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow">
          Menü oluştur
        </a>
      </main>
    );
  }

  // Plan kapısı: görseller Pro+ özelliğidir. Ücretsiz planda yükseltme ekranı.
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', venue.org_id)
    .maybeSingle();
  if (!planLimits(orgRow?.plan).images) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-4xl" aria-hidden>
          🎨
        </span>
        <h1 className="text-xl font-semibold">Görseller Pro’ya özel</h1>
        <p className="text-stone-600">
          AI ürün görselleri ve kategori arka planları Pro planda açılır. Ücretsiz planda menün
          görselsiz, temiz bir listeyle yayınlanır.
        </p>
        <div className="mt-2 flex gap-3">
          <a
            href="/studyo/plan"
            className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow transition hover:bg-brand-700"
          >
            Pro’ya yükselt
          </a>
          <a
            href="/studyo/pano"
            className="rounded-xl border border-stone-300 px-6 py-3 font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            Panoya dön
          </a>
        </div>
      </main>
    );
  }

  const { data: menus } = await supabase
    .from('menus')
    .select('id, sort_order')
    .eq('venue_id', venue.id)
    .eq('is_active', true)
    .order('sort_order');
  const menuIds = (menus ?? []).map((m) => m.id);

  const { data: categories } = menuIds.length
    ? await supabase
        .from('categories')
        .select('id, name, sort_order, background_url')
        .in('menu_id', menuIds)
        .eq('is_active', true)
        .order('sort_order')
    : { data: [] as { id: string; name: string; sort_order: number; background_url: string | null }[] };
  const catIds = (categories ?? []).map((c) => c.id);

  const { data: items } = catIds.length
    ? await supabase
        .from('items')
        .select('id, name, image_url, category_id, sort_order')
        .in('category_id', catIds)
        .order('sort_order')
    : { data: [] as { id: string; name: string; image_url: string | null; category_id: string }[] };

  const byCat = new Map<string, ImgCategory['items']>();
  for (const it of items ?? []) {
    const list = byCat.get(it.category_id) ?? [];
    list.push({ id: it.id, name: it.name, imageUrl: it.image_url ?? null });
    byCat.set(it.category_id, list);
  }

  const imgCategories: ImgCategory[] = (categories ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      backgroundUrl: c.background_url ?? null,
      items: byCat.get(c.id) ?? [],
    }))
    .filter((c) => c.items.length > 0);

  return <ImageManager orgId={venue.org_id} slug={venue.slug} categories={imgCategories} />;
}
