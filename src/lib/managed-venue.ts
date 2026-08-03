import { createClient } from '@/lib/supabase/server';

type ServerClient = ReturnType<typeof createClient>;

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
  wifi_ssid: string | null;
  opening_hours: string | null;
  currency_code: string | null;
  is_published: boolean;
  published_at: string | null;
};

/**
 * Yalnızca oturum sahibinin üye olduğu organizasyonlardan bir işletme seçer.
 * `venues_select` yayınlanmış işletmeleri herkese açtığı için yönetim ekranları
 * doğrudan venues tablosundaki "ilk" satırı seçmemelidir.
 */
export async function resolveManagedVenue(
  supabase: ServerClient,
  requestedVenueId?: string | null
): Promise<ManagedVenue | null> {
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
    .select(
      'id, org_id, slug, name, description, address, phone, whatsapp, instagram, google_maps_url, wifi_ssid, opening_hours, currency_code, is_published, published_at'
    )
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
