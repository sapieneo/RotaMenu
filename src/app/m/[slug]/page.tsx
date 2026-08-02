import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { recordEvent } from '@/lib/analytics';
import { showRestaurantBadge } from '@/lib/plans';
import { CODE_BY_ID } from '@/lib/allergens';
import { DIETARY_CODE_BY_ID } from '@/lib/dietary';
import { MENU_LANGUAGE_BY_CODE, SOURCE_LANGUAGE } from '@/lib/languages';
import { GuestMenu, type GuestCategory, type GuestVenue } from './guest-menu';

export const dynamic = 'force-dynamic';

/**
 * Misafir menüsü (M3 / A9).
 * QR/link ile açılan herkese açık menü ekranı. Yayınlanmış venue'yu anonim
 * misafir de görür (RLS); yayınlanmamışsa yalnız org üyesi (önizleme) görür.
 *
 * Uyum ilkesi: alerjen ve diyet rozetleri YALNIZCA 'confirmed' durumundaysa
 * gösterilir. RLS anonimde bunu zaten zorlar; org üyesi önizlemede de misafir
 * görünümüyle birebir olsun diye burada da 'confirmed' filtresi uygulanır.
 */

type AllergenRow = { allergen_id: number; state: string };
type DietaryRow = { tag_id: number; state: string };

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const supabase = createClient();
  const { data: venue } = await supabase
    .from('venues')
    .select('name, description')
    .eq('slug', params.slug)
    .maybeSingle();
  if (!venue) return { title: 'Menü bulunamadı' };
  return {
    title: `${venue.name} — Menü`,
    description: venue.description ?? `${venue.name} dijital menüsü.`,
  };
}

export default async function GuestMenuPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { lang?: string };
}) {
  const supabase = createClient();

  const { data: venue } = await supabase
    .from('venues')
    .select('id, org_id, name, description, logo_url, cover_url, currency_code, is_published, address, phone, whatsapp, instagram, google_maps_url, wifi_ssid, opening_hours')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!venue) notFound();

  // Sahibin önizlemesi (örn. /studyo/pano'daki canlı telefon önizlemesi veya
  // "Menüyü gör" linki) analitiği ŞİŞİRMEMELİ. Org üyesiyse sayaç atlanır.
  let isOwnerViewing = false;
  {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('org_id')
        .eq('org_id', venue.org_id)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      isOwnerViewing = Boolean(membership);
    }
  }

  // Plan → misafir menüsünde "RestaurantOS" rozeti yalnız ücretsiz planda görünür.
  const { data: org } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', venue.org_id)
    .maybeSingle();
  const showBadge = showRestaurantBadge(org?.plan);

  // Venue'nun aktif menü(leri) → tek menü modeli olsa da genel davranıyoruz.
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
        .select('id, name, sort_order, background_url, background_style')
        .in('menu_id', menuIds)
        .eq('is_active', true)
        .order('sort_order')
    : {
        data: [] as {
          id: string;
          name: string;
          sort_order: number;
          background_url: string | null;
          background_style: string | null;
        }[],
      };
  const catIds = (categories ?? []).map((c) => c.id);

  const { data: itemRows } = catIds.length
    ? await supabase
        .from('items')
        .select(
          'id, name, description, ingredients, price, image_url, calories_kcal, ' +
            'category_id, sort_order, item_allergens(allergen_id, state), ' +
            'item_dietary(tag_id, state)'
        )
        .in('category_id', catIds)
        .eq('is_available', true)
        .order('sort_order')
    : { data: [] as Record<string, unknown>[] };

  const rows = (itemRows ?? []) as unknown as Record<string, unknown>[];

  const itemIds = rows.map((item) => item.id as string);
  const [{ data: categoryTranslations }, { data: itemTranslations }] = await Promise.all([
    catIds.length
      ? supabase.from('category_translations').select('category_id, locale, name').in('category_id', catIds)
      : Promise.resolve({ data: [] as { category_id: string; locale: string; name: string }[] }),
    itemIds.length
      ? supabase.from('item_translations').select('item_id, locale, name, description, ingredients').in('item_id', itemIds)
      : Promise.resolve({ data: [] as { item_id: string; locale: string; name: string; description: string | null; ingredients: string | null }[] }),
  ]);
  const categoryLocaleCounts = countLocales(categoryTranslations ?? [], 'category_id');
  const itemLocaleCounts = countLocales(itemTranslations ?? [], 'item_id');
  const availableLocaleCodes = [...MENU_LANGUAGE_BY_CODE.keys()].filter(
    (locale) => categoryLocaleCounts.get(locale) === catIds.length && itemLocaleCounts.get(locale) === itemIds.length
  );
  const requestedLocale = searchParams?.lang ?? SOURCE_LANGUAGE.code;
  const currentLocale = availableLocaleCodes.includes(requestedLocale) ? requestedLocale : SOURCE_LANGUAGE.code;
  const categoryTranslationMap = new Map(
    (categoryTranslations ?? [])
      .filter((row) => row.locale === currentLocale)
      .map((row) => [row.category_id, row.name])
  );
  const itemTranslationMap = new Map(
    (itemTranslations ?? [])
      .filter((row) => row.locale === currentLocale)
      .map((row) => [row.item_id, row])
  );

  // Ürünleri kategoriye grupla
  const byCat = new Map<string, GuestCategory['items']>();
  for (const it of rows) {
    const catId = it.category_id as string;
    const alg = ((it.item_allergens as AllergenRow[]) ?? [])
      .filter((r) => r.state === 'confirmed')
      .map((r) => CODE_BY_ID[r.allergen_id])
      .filter(Boolean) as string[];
    const diet = ((it.item_dietary as DietaryRow[]) ?? [])
      .filter((r) => r.state === 'confirmed')
      .map((r) => DIETARY_CODE_BY_ID[r.tag_id])
      .filter(Boolean) as string[];
    const priceRaw = it.price as number | string | null;
    const translation = itemTranslationMap.get(it.id as string);
    const list = byCat.get(catId) ?? [];
    list.push({
      id: it.id as string,
      name: translation?.name ?? (it.name as string),
      description: translation?.description ?? (it.description as string | null) ?? null,
      ingredients: translation?.ingredients ?? (it.ingredients as string | null) ?? null,
      price: priceRaw == null ? null : Number(priceRaw),
      calories: (it.calories_kcal as number | null) ?? null,
      imageUrl: (it.image_url as string | null) ?? null,
      allergenCodes: alg,
      dietaryCodes: diet,
    });
    byCat.set(catId, list);
  }

  const guestCategories: GuestCategory[] = (categories ?? [])
    .map((c) => ({
      id: c.id,
      name: categoryTranslationMap.get(c.id) ?? c.name,
      backgroundUrl: c.background_url ?? null,
      backgroundStyle: (c.background_style as 'strip' | 'hero' | null) ?? 'strip',
      items: byCat.get(c.id) ?? [],
    }))
    .filter((c) => c.items.length > 0);

  const guestVenue: GuestVenue = {
    name: venue.name,
    description: venue.description ?? null,
    logoUrl: venue.logo_url ?? null,
    coverUrl: venue.cover_url ?? null,
    currency: venue.currency_code ?? 'TRY',
    address: venue.address ?? null,
    phone: venue.phone ?? null,
    whatsapp: venue.whatsapp ?? null,
    instagram: venue.instagram ?? null,
    googleMapsUrl: venue.google_maps_url ?? null,
    wifiSsid: venue.wifi_ssid ?? null,
    openingHours: venue.opening_hours ?? null,
    isPublished: Boolean(venue.is_published),
    showBadge,
  };

  // 'menu_view' — yalnız YAYINDAKİ menüde sayılır. Sahibin önizlemesi
  // (ör. pano'daki canlı telefon önizlemesi) sayaçları şişirmemeli.
  if (venue.is_published && !isOwnerViewing) {
    await recordEvent({
      orgId: venue.org_id,
      venueId: venue.id,
      eventType: 'menu_view',
      headers: headers(),
    });
  }

  const availableLocales = [
    SOURCE_LANGUAGE,
    ...availableLocaleCodes.map((code) => MENU_LANGUAGE_BY_CODE.get(code)).filter(Boolean),
  ].map((language) => ({ code: language!.code, name: language!.nativeName }));

  return (
    <GuestMenu
      venue={guestVenue}
      categories={guestCategories}
      venueId={venue.id}
      availableLocales={availableLocales}
      currentLocale={currentLocale}
    />
  );
}

function countLocales(rows: Record<string, unknown>[], idKey: string) {
  const unique = new Map<string, Set<string>>();
  for (const row of rows) {
    const locale = row.locale as string;
    const ids = unique.get(locale) ?? new Set<string>();
    ids.add(row[idKey] as string);
    unique.set(locale, ids);
  }
  return new Map([...unique].map(([locale, ids]) => [locale, ids.size]));
}
