import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveComplianceVenueAccess } from '@/lib/compliance-access';

export const dynamic = 'force-dynamic';

/**
 * /studyo/uyum — kanonik uyum ekranı girişi.
 *
 * Asıl uyum ekranı taslağa özeldir (`/studyo/{ingestionId}/uyum`), ama pano ve
 * ayarlar bu id'yi bilmez. Burada kullanıcının en son ONAYLANMIŞ menü
 * çıkarımını bulup oraya yönlendiriyoruz. Böylece tüm "Uyum ekranı" bağları
 * tek sabit adrese işaret edebilir.
 */
export default async function ComplianceEntryPage({ searchParams }: { searchParams?: { venue?: string } }) {
  const supabase = createClient();
  const access = await resolveComplianceVenueAccess(supabase, searchParams?.venue);
  if (!access) redirect('/studyo/pano');
  const { venue, db } = access;

  // En son onaylanmış çıkarım → onun uyum ekranı.
  const { data: ingestion } = await db
    .from('menu_ingestions')
    .select('id')
    .eq('venue_id', venue.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ingestion) redirect(`/studyo/${ingestion.id}/uyum?venue=${encodeURIComponent(venue.id)}`);

  // Onaylı menü yoksa: önce menüyü oluştur/onayla.
  redirect(`/studyo/pano?venue=${encodeURIComponent(venue.id)}`);
}
