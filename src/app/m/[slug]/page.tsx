import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { recordEvent } from '@/lib/analytics';
import { showRotaMenuBadge, resolvePlanContext } from '@/lib/plans';
import { CODE_BY_ID } from '@/lib/allergens';
import { DIETARY_CODE_BY_ID } from '@/lib/dietary';
import { MENU_LANGUAGE_BY_CODE, SOURCE_LANGUAGE } from '@/lib/languages';
import {
  GuestMenu,
  type GuestCategory,
  type GuestVenue,
  type GuestMenuSummary,
  type GuestTranslations,
} from './guest-menu';
import { normalizeMenuDesign } from '@/lib/themes';
import { parsePreviewDesign } from '@/lib/schemas/design';

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
    .select('name, description, cover_url, logo_url')
    .eq('slug', params.slug)
    .maybeSingle();
  if (!venue) return { title: 'Menü bulunamadı' };

  const title = `${venue.name} — Menü`;
  const description = venue.description ?? `${venue.name} dijital menüsü.`;
  // İşletmeler menü linkini WhatsApp/Instagram'da paylaşıyor; kapak (yoksa
  // logo) görselini OG olarak vermezsek çıplak bir bağlantı görünüyor.
  const image = venue.cover_url ?? venue.logo_url ?? null;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'tr_TR',
      siteName: venue.name,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function GuestMenuPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { lang?: string; previewDesign?: string };
}) {
  const supabase = createClient();

  const { data: venue } = await supabase
    .from('venues')
    .select('id, org_id, name, description, logo_url, cover_url, currency_code, is_published, address, phone, whatsapp, instagram, google_maps_url, wifi_ssid, opening_hours, design_settings, is_suspended, announcement_title, announcement_body, announcement_image_url, announcement_button_text, story')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!venue) notFound();

  // Süper-admin bu venue'yu askıya almışsa herkese (sahibi dahil) normal menü
  // yerine buradaki görsel + uyarı metni gösterilir. Veri silinmemiştir —
  // admin panelindeki işaret kaldırılınca menü kaldığı yerden yayına döner.
  if (venue.is_suspended) {
    // İçerik platform genelidir: yönetici bir kez tanımlar, askıya alınan tüm
    // menüler aynı ekranı gösterir (bkz. /admin/panel → "Askıya alma ekranı").
    const { data: settings } = await createAdminClient()
      .from('platform_settings')
      .select('suspension_message, suspension_image_url')
      .eq('id', true)
      .maybeSingle();
    return (
      <SuspendedNotice
        venueName={venue.name}
        message={(settings?.suspension_message as string | null) ?? null}
        imageUrl={(settings?.suspension_image_url as string | null) ?? null}
      />
    );
  }

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

  // Tasarım Stüdyosu'ndaki canlı maket: kaydedilmemiş taslak ayarları burada
  // hiçbir şey veritabanına yazmadan, yalnızca bu isteğin render'ında
  // önizleyebilsin diye ?previewDesign=<json> ile gönderiliyor. Yalnız
  // işletme sahibi için geçerli — başkası bu parametreyle menünün
  // görünümünü değiştiremez. Kaydetme yoluyla AYNI zod şemasından geçer.
  const previewDesignOverride = isOwnerViewing
    ? parsePreviewDesign(searchParams?.previewDesign)
    : null;
  // Önizleme modunda tam menüyü çekmek gereksiz: stüdyoda kaydırıcı her
  // oynadığında bu sorgu tekrar koşuyor. Tasarımı değerlendirmek için
  // kategori başına birkaç ürün yeterli.
  const isDesignPreview = previewDesignOverride !== null;

  // Plan → misafir menüsünde "RotaMenu" rozeti yalnız ücretsiz planda görünür.
  // DİKKAT: organizations RLS'i anonim misafire okuma vermez. Plan/deneme
  // durumu misafir ekranını belirlediği için service-role ile okunur —
  // aksi halde org satırı null döner ve YAYINDAKİ her menü kilitli sanılır.
  const { data: org } = await createAdminClient()
    .from('organizations')
    .select('plan, trial_ends_at')
    .eq('id', venue.org_id)
    .maybeSingle();
  const planCtx = resolvePlanContext(org?.plan, org?.trial_ends_at as string | null);
  const showBadge = showRotaMenuBadge(planCtx.effectivePlan);

  // Deneme bitmiş ve abonelik yoksa yayın kilitlenir: misafire nazik bir bilgi
  // ekranı gösterilir. Menü SİLİNMEZ — abonelik başlayınca aynen geri gelir.
  // Sahibi (org üyesi) önizlemeye devam edebilir ki neyin kilitlendiğini görsün.
  if (!planCtx.limits.canPublish && !isOwnerViewing) {
    return <UnavailableNotice venueName={venue.name} phone={venue.phone ?? null} />;
  }

  // Venue'nun aktif menü(leri). Çoğu venue'de tek satır var — bu durumda
  // guest-menu.tsx menü şeridini hiç göstermiyor (davranış RotaMenu ile
  // birebir aynı kalır). Birden fazla aktif menü varsa (örn. "Restoran
  // Menüsü" + "Şarap Menüsü") üstte bir menü şeridi gösterilir.
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
        .select('id, name, sort_order, background_url, background_style, background_position_y, menu_id')
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
          background_position_y: number | null;
          menu_id: string;
        }[],
      };
  const catIds = (categories ?? []).map((c) => c.id);

  const { data: itemRows } = catIds.length
    ? await supabase
        .from('items')
        .select(
          'id, name, description, ingredients, price, image_url, calories_kcal, is_featured, ' +
            'category_id, sort_order, item_allergens(allergen_id, state), ' +
            'item_dietary(tag_id, state)'
        )
        .in('category_id', catIds)
        .eq('is_available', true)
        .order('sort_order')
    : { data: [] as Record<string, unknown>[] };

  const rows = (itemRows ?? []) as unknown as Record<string, unknown>[];

  const itemIds = rows.map((item) => item.id as string);
  const [{ data: categoryTranslations }, { data: itemTranslations }, { data: complianceRows }, { data: completedJobs }] = await Promise.all([
    catIds.length
      ? supabase.from('category_translations').select('category_id, locale, name').in('category_id', catIds)
      : Promise.resolve({ data: [] as { category_id: string; locale: string; name: string }[] }),
    itemIds.length
      ? supabase.from('item_translations').select('item_id, locale, name, description, ingredients').in('item_id', itemIds)
      : Promise.resolve({ data: [] as { item_id: string; locale: string; name: string; description: string | null; ingredients: string | null }[] }),
    itemIds.length
      ? createAdminClient().from('item_compliance').select('item_id, calories_review, allergen_review').in('item_id', itemIds)
      : Promise.resolve({ data: [] as { item_id: string; calories_review: string; allergen_review: string }[] }),
    // Dil seçici, kategori/ürün çevirilerinin tek tek TAM eşleşmesini beklemek
    // yerine (yeni eklenen bir ürün çevrilmeden diğer her şeyi gizlerdi) dil
    // yönetimi ekranındaki "tamamlandı" işaretine bakar — misafir görmesin
    // diye anon RLS bu tabloyu kapatıyor, o yüzden admin client kullanılır.
    menuIds.length
      ? createAdminClient()
          .from('menu_translation_jobs')
          .select('locale')
          .in('menu_id', menuIds)
          .eq('job_type', 'translation')
          .eq('status', 'completed')
      : Promise.resolve({ data: [] as { locale: string }[] }),
  ]);
  const confirmedCalories = new Set(
    (complianceRows ?? [])
      .filter((row) => row.calories_review === 'confirmed')
      .map((row) => row.item_id)
  );
  // Alerjen incelemesi onaylanmış ürünler. Onaylanmamışsa misafir kartında
  // "⚠ Alerjen bilgisi doğrulanmadı" uyarısı çıkar — çünkü boş bir alerjen
  // listesi "alerjen yok" DEĞİL, "henüz kontrol edilmedi" anlamına gelebilir
  // (RLS misafire yalnız 'confirmed' satırları gösterir).
  const confirmedAllergens = new Set(
    (complianceRows ?? [])
      .filter((row) => (row as { allergen_review?: string }).allergen_review === 'confirmed')
      .map((row) => row.item_id)
  );
  const categoryTranslationsList = categoryTranslations ?? [];
  const itemTranslationsList = itemTranslations ?? [];
  const availableLocaleCodes = [...new Set((completedJobs ?? []).map((job) => job.locale))].filter(
    (locale) =>
      MENU_LANGUAGE_BY_CODE.has(locale) &&
      // Tamamlanmış iş var ama hiç çeviri satırı yoksa (silinmiş/boş menü)
      // dil seçiciyi kirletmesin.
      (categoryTranslationsList.some((row) => row.locale === locale) || itemTranslationsList.some((row) => row.locale === locale))
  );
  const requestedLocale = searchParams?.lang ?? SOURCE_LANGUAGE.code;
  const currentLocale = availableLocaleCodes.includes(requestedLocale) ? requestedLocale : SOURCE_LANGUAGE.code;

  // ANINDA dil geçişi (referans davranışı): çeviriler artık sunucuda tek dile
  // indirgenmez — TÜM dillerin sözlüğü istemciye gider ve dil düğmesi sayfayı
  // yeniden yüklemeden, salt istemci state'iyle geçiş yapar. Kategori ve ürün
  // adları props'ta HAM (Türkçe) gönderilir; seçili dile çevirme işini
  // guest-menu.tsx üstlenir (ilk SSR çıktısı da aynı sözlükten geçtiği için
  // hidrasyon uyumsuzluğu olmaz).
  const guestTranslations: GuestTranslations = {};
  for (const code of availableLocaleCodes) {
    guestTranslations[code] = {
      categories: Object.fromEntries(
        categoryTranslationsList.filter((row) => row.locale === code).map((row) => [row.category_id, row.name])
      ),
      items: Object.fromEntries(
        itemTranslationsList
          .filter((row) => row.locale === code)
          .map((row) => [
            row.item_id,
            { name: row.name, description: row.description ?? null, ingredients: row.ingredients ?? null },
          ])
      ),
    };
  }

  // Ürünleri kategoriye grupla
  const byCat = new Map<string, GuestCategory['items']>();
  for (const it of rows) {
    const catId = it.category_id as string;
    // Tasarım önizlemesinde kategori başına birkaç ürün yeter — 168 ürünlük
    // bir menüyü her kaydırıcı hareketinde baştan render etmeyelim.
    if (isDesignPreview && (byCat.get(catId)?.length ?? 0) >= 4) continue;
    const alg = ((it.item_allergens as AllergenRow[]) ?? [])
      .filter((r) => r.state === 'confirmed')
      .map((r) => CODE_BY_ID[r.allergen_id])
      .filter(Boolean) as string[];
    const diet = ((it.item_dietary as DietaryRow[]) ?? [])
      .filter((r) => r.state === 'confirmed')
      .map((r) => DIETARY_CODE_BY_ID[r.tag_id])
      .filter(Boolean) as string[];
    const priceRaw = it.price as number | string | null;
    const list = byCat.get(catId) ?? [];
    list.push({
      id: it.id as string,
      name: it.name as string,
      description: (it.description as string | null) ?? null,
      ingredients: (it.ingredients as string | null) ?? null,
      price: priceRaw == null ? null : Number(priceRaw),
      calories: confirmedCalories.has(it.id as string)
        ? (it.calories_kcal as number | null) ?? null
        : null,
      imageUrl: (it.image_url as string | null) ?? null,
      allergenCodes: alg,
      allergensReviewed: confirmedAllergens.has(it.id as string),
      dietaryCodes: diet,
      isFeatured: Boolean(it.is_featured),
    });
    byCat.set(catId, list);
  }

  const guestCategories: GuestCategory[] = (categories ?? [])
    .map((c) => ({
      id: c.id,
      menuId: c.menu_id,
      name: c.name,
      backgroundUrl: c.background_url ?? null,
      backgroundStyle: (c.background_style as 'strip' | 'hero' | null) ?? 'strip',
      backgroundPositionY: c.background_position_y ?? 50,
      items: byCat.get(c.id) ?? [],
    }))
    .filter((c) => c.items.length > 0);

  // Şerit yalnızca gerçekten birden fazla menü VE her ikisinde de en az bir
  // görünür kategori varsa anlamlı — aksi halde tek menü davranışına düşer.
  const menuIdsWithContent = new Set(guestCategories.map((c) => c.menuId));
  const guestMenus: GuestMenuSummary[] = (menus ?? [])
    .filter((m) => menuIdsWithContent.has(m.id))
    .map((m) => ({ id: m.id, name: m.name, icon: m.icon ?? null }));

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
    design: normalizeMenuDesign(previewDesignOverride ?? venue.design_settings),
    story: venue.story ?? null,
    announcement:
      venue.announcement_title
        ? {
            title: venue.announcement_title,
            body: venue.announcement_body ?? null,
            imageUrl: venue.announcement_image_url ?? null,
            buttonText: venue.announcement_button_text ?? null,
          }
        : null,
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
      menus={guestMenus}
      venueId={venue.id}
      availableLocales={availableLocales}
      currentLocale={currentLocale}
      translations={guestTranslations}
    />
  );
}

/**
 * Deneme süresi dolmuş işletmenin misafir ekranı. Ton bilinçli olarak nötr:
 * misafir müşteridir, işletmenin ödeme durumu onu ilgilendirmez.
 */
function UnavailableNotice({ venueName, phone }: { venueName: string; phone: string | null }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-bold text-stone-900">{venueName}</h1>
        <p className="mt-3 text-stone-600">Dijital menü şu anda görüntülenemiyor.</p>
        {phone && (
          <a
            href={`tel:${phone}`}
            className="mt-5 inline-block rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white"
          >
            İşletmeyi ara
          </a>
        )}
      </div>
    </main>
  );
}

function SuspendedNotice({
  venueName,
  message,
  imageUrl,
}: {
  venueName: string;
  message: string | null;
  imageUrl: string | null;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-sm">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-56 w-full object-cover" />
        )}
        <div className="p-6 text-center">
          <h1 className="text-lg font-bold text-stone-900">{venueName}</h1>
          <p className="mt-3 whitespace-pre-line text-stone-600">
            {message || 'Bu menü şu an geçici olarak kullanılamıyor.'}
          </p>
        </div>
      </div>
    </main>
  );
}
