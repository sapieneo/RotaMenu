import type { SupabaseClient } from '@supabase/supabase-js';
import { isAdminSession } from '@/lib/admin-auth';
import { hasPanoSession } from '@/lib/pano-auth';
import {
  resolveManagedVenue,
  resolveVenueByIdAsAdmin,
  type ManagedVenue,
} from '@/lib/managed-venue';
import { createAdminClient, createClient } from '@/lib/supabase/server';

type ServerClient = ReturnType<typeof createClient>;

export type ComplianceVenueAccess = {
  venue: ManagedVenue;
  db: SupabaseClient;
  privileged: boolean;
};

/** Org üyeliği, süper-admin veya işletmeye özel pano oturumunu çözer. */
export async function resolveComplianceVenueAccess(
  supabase: ServerClient,
  requestedVenueId: string | null | undefined
): Promise<ComplianceVenueAccess | null> {
  const venue = await resolveManagedVenue(supabase, requestedVenueId);
  if (venue) {
    const privileged = Boolean(requestedVenueId && isAdminSession());
    return {
      venue,
      db: privileged ? createAdminClient() : supabase,
      privileged,
    };
  }

  if (!requestedVenueId || !hasPanoSession(requestedVenueId)) return null;
  const panoVenue = await resolveVenueByIdAsAdmin(requestedVenueId);
  if (!panoVenue) return null;
  return { venue: panoVenue, db: createAdminClient(), privileged: true };
}

export type ComplianceIngestion = {
  id: string;
  status: string;
  raw_result: unknown;
  venue_id: string;
};

/** URL'deki ingestion kimliğini bağlı olduğu venue üzerinden yetkilendirir. */
export async function resolveComplianceIngestionAccess(
  supabase: ServerClient,
  ingestionId: string
): Promise<{ ingestion: ComplianceIngestion; db: SupabaseClient; privileged: boolean } | null> {
  const { data: candidate } = await createAdminClient()
    .from('menu_ingestions')
    .select('id, status, raw_result, venue_id')
    .eq('id', ingestionId)
    .maybeSingle();
  if (!candidate) return null;

  const access = await resolveComplianceVenueAccess(supabase, candidate.venue_id);
  if (!access || access.venue.id !== candidate.venue_id) return null;
  return {
    ingestion: candidate as ComplianceIngestion,
    db: access.db,
    privileged: access.privileged,
  };
}

/** Onay isteğindeki ürünün gerçek venue zincirini bulup editor yetkisini doğrular. */
export async function resolveComplianceItemAccess(
  supabase: ServerClient,
  itemId: string
): Promise<
  | { ok: true; privileged: boolean }
  | { ok: false; status: 401 | 403 | 404; error: string }
> {
  const admin = createAdminClient();
  const { data: item } = await admin
    .from('items')
    .select('id, org_id, category_id')
    .eq('id', itemId)
    .maybeSingle();
  if (!item) return { ok: false, status: 404, error: 'Ürün bulunamadı.' };

  const { data: category } = await admin
    .from('categories')
    .select('menu_id')
    .eq('id', item.category_id)
    .maybeSingle();
  const { data: menu } = category
    ? await admin.from('menus').select('venue_id').eq('id', category.menu_id).maybeSingle()
    : { data: null };
  if (!menu) return { ok: false, status: 404, error: 'Ürün bulunamadı.' };

  if (isAdminSession() || hasPanoSession(menu.venue_id)) {
    return { ok: true, privileged: true };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: 'Oturum bulunamadı.' };

  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('org_id', item.org_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !['owner', 'admin', 'editor'].includes(membership.role)) {
    return { ok: false, status: 403, error: 'Bu işlem için yetkiniz yok.' };
  }
  return { ok: true, privileged: false };
}
