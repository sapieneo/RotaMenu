import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { planLimits, normalizePlan } from '@/lib/plans';

export const dynamic = 'force-dynamic';

/**
 * Süper-admin salt-okunur işletme panosu. `/studyo/pano` ile aynı ruhta ama:
 *  - venueId URL'den gelir (oturum sahibinden değil),
 *  - tamamen service-role okur (RLS atlanır, admin her venue'yu görür),
 *  - yazma işlemi YOK — yalnız gözlem.
 */
export default async function AdminVenuePage({ params }: { params: { id: string } }) {
  requireAdmin();
  const admin = createAdminClient();

  const { data: venue } = await admin
    .from('venues')
    .select('id, org_id, name, slug, is_published, published_at, created_at')
    .eq('id', params.id)
    .maybeSingle();
  if (!venue) notFound();

  const { data: org } = await admin
    .from('organizations')
    .select('name, plan, contact_phone, contact_phone_verified_at, created_by')
    .eq('id', venue.org_id)
    .maybeSingle();

  let ownerEmail: string | null = null;
  if (org?.created_by) {
    try {
      const { data } = await admin.auth.admin.getUserById(org.created_by as string);
      ownerEmail = data?.user?.email ?? null;
    } catch {
      ownerEmail = null;
    }
  }

  const { data: menus } = await admin
    .from('menus')
    .select('id')
    .eq('venue_id', venue.id)
    .eq('is_active', true);
  const menuIds = (menus ?? []).map((m) => m.id);

  const { data: cats } = menuIds.length
    ? await admin.from('categories').select('id').in('menu_id', menuIds).eq('is_active', true)
    : { data: [] as { id: string }[] };
  const catIds = (cats ?? []).map((c) => c.id);

  const { count: itemCount } = catIds.length
    ? await admin.from('items').select('id', { count: 'exact', head: true }).in('category_id', catIds)
    : { count: 0 };

  const { count: qrActive } = await admin
    .from('qr_codes')
    .select('id', { count: 'exact', head: true })
    .eq('venue_id', venue.id)
    .eq('is_active', true);

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const { data: events } = await admin
    .from('scan_events')
    .select('event_type')
    .eq('venue_id', venue.id)
    .gte('occurred_at', since.toISOString());
  const rows = (events ?? []) as { event_type: string }[];
  const scans = rows.filter((e) => e.event_type === 'scan').length;
  const menuViews = rows.filter((e) => e.event_type === 'menu_view').length;
  const itemViews = rows.filter((e) => e.event_type === 'item_view').length;

  const plan = normalizePlan(org?.plan);
  const limits = planLimits(plan);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <a href="/admin/panel" className="text-sm text-brand-600 hover:underline">
        ← Kontrol paneli
      </a>

      <header className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{venue.name}</h1>
          <p className="text-sm text-stone-500">{ownerEmail ?? 'sahip e-postası yok (anonim hesap)'}</p>
        </div>
        <div className="flex items-center gap-2">
          {venue.is_published ? (
            <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
              CANLI
            </span>
          ) : (
            <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
              TASLAK
            </span>
          )}
          <a
            href={`/m/${venue.slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
          >
            👁 Menüyü gör
          </a>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Plan" value={limits.label} />
        <StatCard label="Ürün" value={itemCount ?? 0} />
        <StatCard label="Aktif QR" value={qrActive ?? 0} />
        <StatCard label="30 gün tarama" value={scans} />
      </section>

      <section className="mt-4 grid grid-cols-3 gap-3">
        <MiniStat label="Menü görüntüleme" value={menuViews} />
        <MiniStat label="Ürün görüntüleme" value={itemViews} />
        <MiniStat label="QR tarama" value={scans} />
      </section>

      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 text-sm shadow-sm">
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Row label="Menü adresi" value={`/m/${venue.slug}`} />
          <Row label="Telefon" value={(org?.contact_phone as string | null) ?? '—'} />
          <Row
            label="Telefon doğrulandı mı"
            value={org?.contact_phone_verified_at ? 'Evet' : 'Hayır'}
          />
          <Row label="Oluşturulma" value={new Date(venue.created_at).toLocaleDateString('tr-TR')} />
          <Row
            label="İlk yayın"
            value={venue.published_at ? new Date(venue.published_at).toLocaleDateString('tr-TR') : '—'}
          />
        </dl>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-stone-800">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2 text-center">
      <p className="text-lg font-bold text-stone-800">{value}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-stone-100 py-1.5 last:border-0">
      <dt className="text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-800">{value}</dd>
    </div>
  );
}
