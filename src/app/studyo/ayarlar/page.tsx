import { createClient } from '@/lib/supabase/server';
import { resolveManagedVenue } from '@/lib/managed-venue';
import { resolvePlanContext } from '@/lib/plans';
import { VenueSettingsForm, type VenueSettings } from './venue-settings-form';
import { emptyWeek, parseWeeklyHours } from '@/lib/opening-hours';

export const dynamic = 'force-dynamic';

/**
 * İşletme ayarları: misafir menüsünün kimlik + iletişim/footer bilgileri,
 * menü adresi (slug) ve yayın durumu (Faz B1).
 * Tek venue modeli — kullanıcının erişebildiği ilk venue düzenlenir (RLS).
 */
export default async function VenueSettingsPage({ searchParams }: { searchParams?: { venue?: string } }) {
  const supabase = createClient();
  const venue = await resolveManagedVenue(supabase, searchParams?.venue);

  if (!venue) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold">Henüz işletmen yok</h1>
        <p className="text-stone-600">Önce bir menü oluştur; ardından ayarları buradan düzenleyebilirsin.</p>
        <a
          href="/studyo"
          className="mt-2 inline-block rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow"
        >
          Menü oluştur
        </a>
      </main>
    );
  }

  // Yayın öncesi uyum durumu: alerjen incelemesi 'confirmed' olmayan ürün
  // sayısı. Yayını bloke etmiyoruz — beyan sorumluluğu işletmede — ama
  // kullanıcıyı bilinçli karar vermeye zorluyoruz.
  const { data: menus } = await supabase
    .from('menus')
    .select('id')
    .eq('venue_id', venue.id)
    .eq('is_active', true);
  const menuIds = (menus ?? []).map((m) => m.id);

  const { data: cats } = menuIds.length
    ? await supabase.from('categories').select('id').in('menu_id', menuIds).eq('is_active', true)
    : { data: [] as { id: string }[] };
  const catIds = (cats ?? []).map((c) => c.id);

  const { data: items } = catIds.length
    ? await supabase.from('items').select('id').in('category_id', catIds)
    : { data: [] as { id: string }[] };
  const itemIds = (items ?? []).map((i) => i.id);

  const { count: confirmedCount } = itemIds.length
    ? await supabase
        .from('item_compliance')
        .select('item_id', { count: 'exact', head: true })
        .in('item_id', itemIds)
        .eq('allergen_review', 'confirmed')
    : { count: 0 };

  const itemCount = itemIds.length;
  const pendingCount = Math.max(0, itemCount - (confirmedCount ?? 0));

  // Plan + hesap durumu → yayın önkoşulları (API'deki kapılarla aynı kaynak).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('plan, contact_phone, trial_ends_at')
    .eq('id', venue.org_id)
    .maybeSingle();
  const planCtx = resolvePlanContext(orgRow?.plan, orgRow?.trial_ends_at as string | null);
  const accountSecured = Boolean(user && !user.is_anonymous && user.email);
  const hasPhone = Boolean(orgRow?.contact_phone);

  // Pano giriş şifresi yalnızca burada, VAR MI diye soruluyor — hash'in
  // kendisi asla forma/istemciye taşınmaz (bkz. lib/pano-auth.ts).
  const { data: panoRow } = await supabase
    .from('venues')
    .select('pano_password_hash')
    .eq('id', venue.id)
    .maybeSingle();
  const hasPanoPassword = Boolean(panoRow?.pano_password_hash);

  const initial: VenueSettings = {
    id: venue.id,
    // Popup görseli Supabase Storage'a `{org_id}/announcements/…` yoluna
    // yüklenir (venue-media kovasındaki diğer görsellerle aynı düzen).
    orgId: venue.org_id,
    slug: venue.slug,
    name: venue.name ?? '',
    description: venue.description ?? '',
    address: venue.address ?? '',
    phone: venue.phone ?? '',
    whatsapp: venue.whatsapp ?? '',
    instagram: venue.instagram ?? '',
    googleMapsUrl: venue.google_maps_url ?? '',
    googleReviewUrl: venue.google_review_url ?? '',
    wifiSsid: venue.wifi_ssid ?? '',
    openingHours: venue.opening_hours ?? '',
    // Yapısal saat yoksa boş bir hafta ile başla — editör 7 satırı gösterir.
    openingHoursWeekly: parseWeeklyHours(venue.opening_hours_json) ?? emptyWeek(),
    aiImagesEnabled: Boolean(venue.ai_images_enabled),
    currencyCode: venue.currency_code ?? 'TRY',
    announcementTitle: venue.announcement_title ?? '',
    announcementBody: venue.announcement_body ?? '',
    announcementButtonText: venue.announcement_button_text ?? '',
    announcementImageUrl: venue.announcement_image_url ?? null,
    story: venue.story ?? '',
  };

  return (
    <VenueSettingsForm
      initial={initial}
      hasPanoPassword={hasPanoPassword}
      publish={{
        isPublished: Boolean(venue.is_published),
        publishedAt: venue.published_at ?? null,
        itemCount,
        pendingCount,
        // Yayın önkoşulları: buton artık boşuna tıklanıp 403 almasın.
        canPublish: planCtx.limits.canPublish,
        trialExpired: planCtx.trial.state === 'expired',
        needsAccount:
          planCtx.limits.requiresVerifiedAccount && (!accountSecured || !hasPhone),
        accountSecured,
        hasPhone,
      }}
    />
  );
}
