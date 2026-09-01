import { createClient } from '@/lib/supabase/server';
import { resolveManagedVenue } from '@/lib/managed-venue';
import { MenuEditor, type EditorMenu } from './menu-editor';

export const dynamic = 'force-dynamic';

/**
 * Stüdyo → Menüyü düzenle (müşteri talebi B1/B4).
 *
 * Canlı menünün ürünlerini tek tek eklemek, düzenlemek ve silmek için.
 * Yükleme akışının taslak editöründen ayrı: burada yapılan her değişiklik
 * yalnız ilgili ürüne dokunur, kategori silip yeniden yazma yoktur.
 */
export default async function MenuEditorPage({ searchParams }: { searchParams?: { venue?: string } }) {
  const supabase = createClient();
  const venue = await resolveManagedVenue(supabase, searchParams?.venue);

  if (!venue) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold">Henüz menün yok</h1>
        <p className="text-stone-600">Önce bir menü oluştur; sonra ürünleri buradan düzenleyebilirsin.</p>
        <a href="/studyo" className="mt-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow">
          Menü oluştur
        </a>
      </main>
    );
  }

  const { data: menus } = await supabase
    .from('menus')
    .select('id, name, icon, sort_order')
    .eq('venue_id', venue.id)
    .eq('is_active', true)
    .order('sort_order');
  const menuIds = (menus ?? []).map((m) => m.id);

  const { data: categories } = menuIds.length
    ? await supabase
        .from('categories')
        .select('id, name, menu_id, sort_order')
        .in('menu_id', menuIds)
        .eq('is_active', true)
        .order('sort_order')
    : { data: [] as { id: string; name: string; menu_id: string; sort_order: number }[] };
  const catIds = (categories ?? []).map((c) => c.id);

  const { data: items } = catIds.length
    ? await supabase
        .from('items')
        .select('id, name, description, ingredients, price, calories_kcal, is_featured, category_id, sort_order')
        .in('category_id', catIds)
        .order('sort_order')
    : { data: [] as Record<string, unknown>[] };

  const byCat = new Map<string, EditorMenu['categories'][number]['items']>();
  for (const raw of (items ?? []) as unknown as Record<string, unknown>[]) {
    const catId = raw.category_id as string;
    const list = byCat.get(catId) ?? [];
    list.push({
      id: raw.id as string,
      name: raw.name as string,
      description: (raw.description as string | null) ?? null,
      ingredients: (raw.ingredients as string | null) ?? null,
      price: raw.price == null ? null : Number(raw.price),
      caloriesKcal: (raw.calories_kcal as number | null) ?? null,
      isFeatured: Boolean(raw.is_featured),
    });
    byCat.set(catId, list);
  }

  const editorMenus: EditorMenu[] = (menus ?? []).map((m) => ({
    id: m.id as string,
    name: (m.name as string) ?? 'Menü',
    icon: (m.icon as string | null) ?? null,
    categories: (categories ?? [])
      .filter((c) => c.menu_id === m.id)
      .map((c) => ({ id: c.id, name: c.name, items: byCat.get(c.id) ?? [] })),
  }));

  return (
    <MenuEditor
      menus={editorMenus}
      venueId={venue.id}
      slug={venue.slug}
      currency={venue.currency_code ?? 'TRY'}
    />
  );
}
