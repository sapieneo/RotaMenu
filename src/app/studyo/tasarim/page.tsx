import { createClient } from '@/lib/supabase/server';
import { resolveManagedVenue, withVenue } from '@/lib/managed-venue';
import { normalizeMenuDesign } from '@/lib/themes';
import { DesignStudio, type DesignPreviewCategory } from './design-studio';

export const dynamic = 'force-dynamic';

export default async function DesignPage({ searchParams }: { searchParams?: { venue?: string } }) {
  const supabase = createClient();
  const venue = await resolveManagedVenue(supabase, searchParams?.venue);

  if (!venue) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold">Henüz menün yok</h1>
        <p className="text-stone-600">Önce bir menü oluştur; sonra görünümünü burada tasarla.</p>
        <a href="/studyo" className="mt-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow">Menü oluştur</a>
      </main>
    );
  }

  const { data: designRow } = await supabase
    .from('venues')
    .select('design_settings, logo_url, cover_url')
    .eq('id', venue.id)
    .maybeSingle();

  const { data: menus } = await supabase
    .from('menus')
    .select('id')
    .eq('venue_id', venue.id)
    .eq('is_active', true)
    .order('sort_order');
  const menuIds = (menus ?? []).map((menu) => menu.id);
  const { data: categories } = menuIds.length
    ? await supabase
        .from('categories')
        .select('id, name, sort_order')
        .in('menu_id', menuIds)
        .eq('is_active', true)
        .order('sort_order')
    : { data: [] as { id: string; name: string; sort_order: number }[] };
  const categoryIds = (categories ?? []).map((category) => category.id);
  const { data: items } = categoryIds.length
    ? await supabase
        .from('items')
        .select('id, category_id, name, description, price, image_url, sort_order')
        .in('category_id', categoryIds)
        .eq('is_available', true)
        .order('sort_order')
    : { data: [] as { id: string; category_id: string; name: string; description: string | null; price: number | null; image_url: string | null }[] };

  const byCategory = new Map<string, DesignPreviewCategory['items']>();
  for (const item of items ?? []) {
    const list = byCategory.get(item.category_id) ?? [];
    list.push({
      id: item.id,
      name: item.name,
      description: item.description ?? null,
      price: item.price == null ? null : Number(item.price),
      imageUrl: item.image_url ?? null,
    });
    byCategory.set(item.category_id, list);
  }
  const previewCategories = (categories ?? [])
    .map((category) => ({ id: category.id, name: category.name, items: byCategory.get(category.id) ?? [] }))
    .filter((category) => category.items.length > 0)
    .slice(0, 3);

  return (
    <DesignStudio
      venue={{
        id: venue.id,
        orgId: venue.org_id,
        name: venue.name,
        description: venue.description,
        slug: venue.slug,
        currency: venue.currency_code ?? 'TRY',
        logoUrl: designRow?.logo_url ?? null,
        coverUrl: designRow?.cover_url ?? null,
      }}
      categories={previewCategories}
      initial={normalizeMenuDesign(designRow?.design_settings)}
      dashboardHref={withVenue('/studyo/pano', venue.id)}
    />
  );
}
