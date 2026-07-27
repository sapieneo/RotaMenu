import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { planLimits } from '@/lib/plans';
import { LogoutButton } from '../logout-button';

export const dynamic = 'force-dynamic';

type OrgEmbed = {
  name: string;
  plan: string;
  created_by: string;
  contact_phone: string | null;
};

type VenueRow = {
  id: string;
  name: string;
  slug: string;
  is_published: boolean;
  created_at: string;
  org_id: string;
  organizations: OrgEmbed | OrgEmbed[] | null;
};

/** PostgREST embed'i bazen dizi bazen tekil obje döner; ikisini de tolere et. */
function orgOf(raw: VenueRow['organizations']): OrgEmbed | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

/**
 * Süper-admin kontrol paneli — tüm işletmelerin (venue) listesi. Yalnız
 * ADMIN_PASSWORD ile giren görebilir (requireAdmin). Service-role ile RLS
 * atlanır: normal kullanıcı hiçbir zaman bu görünümü elde edemez.
 */
export default async function AdminPanelPage() {
  requireAdmin();
  const admin = createAdminClient();

  const { data: venues } = await admin
    .from('venues')
    .select('id, name, slug, is_published, created_at, org_id, organizations(name, plan, created_by, contact_phone)')
    .order('created_at', { ascending: false });

  const rows = (venues ?? []) as unknown as VenueRow[];

  // Sahip e-postalarını topla (dedup) — auth.users PostgREST'ten görünmez,
  // GoTrue admin API ile (service-role) tek tek çekilir.
  const ownerIds = Array.from(
    new Set(rows.map((r) => orgOf(r.organizations)?.created_by).filter((x): x is string => Boolean(x)))
  );
  const emailById = new Map<string, string>();
  await Promise.all(
    ownerIds.map(async (id) => {
      try {
        const { data } = await admin.auth.admin.getUserById(id);
        if (data?.user?.email) emailById.set(id, data.user.email);
      } catch {
        // sessiz geç — e-posta bulunamazsa '—' gösterilir
      }
    })
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-600">RestaurantOS</p>
          <h1 className="mt-1 text-2xl font-bold">Kontrol paneli</h1>
          <p className="mt-1 text-sm text-stone-500">{rows.length} işletme</p>
        </div>
        <LogoutButton />
      </header>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3 font-semibold">İşletme</th>
              <th className="px-4 py-3 font-semibold">Sahip</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Durum</th>
              <th className="px-4 py-3 font-semibold">Oluşturulma</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const org = orgOf(v.organizations);
              const ownerEmail = org?.created_by ? emailById.get(org.created_by) : undefined;
              return (
                <tr key={v.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-stone-800">{v.name || org?.name || 'İsimsiz'}</div>
                    <a
                      href={`/m/${v.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand-600 underline underline-offset-2"
                    >
                      /m/{v.slug}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{ownerEmail ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        (org?.plan ?? 'free') === 'free'
                          ? 'bg-stone-200 text-stone-700'
                          : 'bg-brand-600 text-white'
                      }`}
                    >
                      {planLimits(org?.plan).label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {v.is_published ? (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                        CANLI
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
                        TASLAK
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {new Date(v.created_at).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/admin/venue/${v.id}`}
                      className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-stone-800"
                    >
                      Panoya git
                    </a>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-stone-400">
                  Henüz işletme yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
