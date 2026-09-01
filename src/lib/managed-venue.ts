import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isAdminSession } from '@/lib/admin-auth';

type ServerClient = ReturnType<typeof createClient>;

const VENUE_COLUMNS =
  'id, org_id, slug, name, description, address, phone, whatsapp, instagram, google_maps_url, google_review_url, wifi_ssid, opening_hours, opening_hours_json, ai_images_enabled, currency_code, is_published, published_at, announcement_title, announcement_body, announcement_image_url, announcement_button_text, story';

export type ManagedVenue = {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  google_maps_url: string | null;
  /** "Bizi Google'da değerlendirin" bağlantısı. */
  google_review_url: string | null;
  wifi_ssid: string | null;
  opening_hours: string | null;
  /** Yapısal haftalık saatler — bkz. lib/opening-hours.ts. Boşsa opening_hours kullanılır. */
  opening_hours_json: unknown;
  /** AI görsel üretimi bu işletmede açık mı (yeni işletmelerde kapalı). */
  ai_images_enabled: boolean;
  currency_code: string | null;
  is_published: boolean;
  published_at: string | null;
  announcement_title: string | null;
  announcement_body: string | null;
  announcement_image_url: string | null;
  announcement_button_text: string | null;
  story: string | null;
};

/**
 * Org üyeliğinden tamamen bağımsız, service-role ile doğrudan id'ye göre
 * venue okur. Yalnızca kimlik zaten BAŞKA bir yoldan doğrulanmışken
 * kullanılmalı — süper-admin oturumu (bkz. aşağıdaki admin dalı) veya
 * işletmeye özel pano şifresi oturumu (bkz. `lib/pano-auth.ts`) gibi.
 */
export async function resolveVenueByIdAsAdmin(venueId: string): Promise<ManagedVenue | null> {
  const { data } = await createAdminClient()
    .from('venues')
    .select(VENUE_COLUMNS)
    .eq('id', venueId)
    .maybeSingle();
  return (data as ManagedVenue | null) ?? null;
}

/**
 * Yalnızca oturum sahibinin üye olduğu organizasyonlardan bir işletme seçer.
 * `venues_select` yayınlanmış işletmeleri herkese açtığı için yönetim ekranları
 * doğrudan venues tablosundaki "ilk" satırı seçmemelidir.
 */
export async function resolveManagedVenue(
  supabase: ServerClient,
  requestedVenueId?: string | null
): Promise<ManagedVenue | null> {
  // Süper-admin panelindeki "Panoya git" gibi bağlantılar org üyeliğinden
  // bağımsızdır (tek sahip tüm kiracıları yönetir) — geçerli bir admin
  // oturumu varsa service-role ile doğrudan venue id'sine göre okunur.
  if (requestedVenueId && isAdminSession()) {
    return resolveVenueByIdAsAdmin(requestedVenueId);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id);
  const orgIds = [...new Set((memberships ?? []).map((membership) => membership.org_id))];
  if (orgIds.length === 0) return null;

  let query = supabase
    .from('venues')
    .select(VENUE_COLUMNS)
    .in('org_id', orgIds);

  if (requestedVenueId) {
    query = query.eq('id', requestedVenueId);
  } else {
    query = query.order('created_at', { ascending: false }).limit(1);
  }

  const { data } = await query.maybeSingle();
  return (data as ManagedVenue | null) ?? null;
}

export function withVenue(path: string, venueId: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}venue=${encodeURIComponent(venueId)}`;
}
