import { createClient } from '@/lib/supabase/server';
import { resolveManagedVenue, withVenue } from '@/lib/managed-venue';
import { applyPresetOverrides, normalizeMenuDesign, type MenuDesignSettings } from '@/lib/themes';
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

  // Yönetici, "Büyük Tasarım Seç" kartlarından birini kendi tasarımıyla
  // güncellemiş olabilir (bkz. POST /api/design-presets/[templateId]) — bu
  // override'ları koddaki 10 sabit presetin üzerine uyguluyoruz. Herkese
  // açık okuma politikası sayesinde normal (RLS'e tabi) istemci yeterli.
  const { data: presetOverrideRows } = await supabase
    .from('design_preset_overrides')
    .select('template_id, settings');
  const overridesByTemplateId = Object.fromEntries(
    (presetOverrideRows ?? []).map((row) => [row.template_id, row.settings as MenuDesignSettings])
  );
  const presets = applyPresetOverrides(overridesByTemplateId);

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
        .select('id, name, sort_order, background_url, background_style, background_position_y')
        .in('menu_id', menuIds)
        .eq('is_active', true)
        .order('sort_order')
    : { data: [] as { id: string; name: string; sort_order: number; background_url: string | null; background_style: string | null; background_position_y: number | null }[] };
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
    .map((category) => ({
      id: category.id,
      name: category.name,
      backgroundUrl: category.background_url ?? null,
      backgroundStyle: (category.background_style as 'strip' | 'hero' | null) ?? 'strip',
      backgroundPositionY: category.background_position_y ?? 50,
      items: byCategory.get(category.id) ?? [],
    }))
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
      initialPresets={presets}
      dashboardHref={withVenue('/studyo/pano', venue.id)}
    />
  );
}
