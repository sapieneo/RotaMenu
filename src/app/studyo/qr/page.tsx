import { createClient, createAdminClient } from '@/lib/supabase/server';
import { QrManager, type QrRow } from './qr-manager';
import { resolveManagedVenue, resolveVenueByIdAsAdmin } from '@/lib/managed-venue';
import { isAdminSession } from '@/lib/admin-auth';
import { hasPanoSession } from '@/lib/pano-auth';
import { qrOrigin } from '@/lib/qr';

export const dynamic = 'force-dynamic';

/**
 * QR yönetimi (Faz B2). Kodlar kalıcıdır: basılan QR'ın hedefi değişebilir
 * ama kodun kendisi asla değişmez, silinmez — yalnız devre dışı bırakılır.
 */
export default async function QrPage({ searchParams }: { searchParams?: { venue?: string } }) {
  const supabase = createClient();
  const requestedVenueId = searchParams?.venue ?? null;
  const privileged = Boolean(
    requestedVenueId && (isAdminSession() || hasPanoSession(requestedVenueId))
  );
  let venue = await resolveManagedVenue(supabase, requestedVenueId);
  if (!venue && requestedVenueId && privileged) {
    venue = await resolveVenueByIdAsAdmin(requestedVenueId);
  }

  if (!venue) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold">Henüz işletmen yok</h1>
        <p className="text-stone-600">Önce bir menü oluştur; QR kodunu sonra buradan üretebilirsin.</p>
        <a
          href="/studyo"
          className="mt-2 inline-block rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow"
        >
          Menü oluştur
        </a>
      </main>
    );
  }

  const db = privileged ? createAdminClient() : supabase;
  const { data: codes } = await db
    .from('qr_codes')
    .select('id, code, label, is_active, created_at')
    .eq('venue_id', venue.id)
    .order('created_at', { ascending: true });

  return (
    <QrManager
      venueId={venue.id}
      venueName={venue.name}
      venueSlug={venue.slug}
      isPublished={Boolean(venue.is_published)}
      initial={(codes ?? []) as QrRow[]}
      qrBaseUrl={qrOrigin()}
    />
  );
}
