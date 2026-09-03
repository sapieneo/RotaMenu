import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { LogoutButton } from '../logout-button';
import { AdManager, type AdRow, type VenueOption, type VenueStat } from './ad-manager';

export const dynamic = 'force-dynamic';

/**
 * Rota Menü → Reklam yönetimi.
 *
 * Açılış (splash) ekranı bir reklam alanıdır ve YALNIZCA Rota Menü yönetir.
 * İşletme panelinde bu ekranın izi yok; `ads` / `ad_placements` tablolarında
 * RLS açık ve hiç politika olmadığı için service_role dışında okunamıyor da.
 *
 * Sayfa üç şeyi bir arada tutuyor: reklam listesi, hangi menüde yayınlanacağı
 * ve menü ziyaret sayıları — reklamı hangi menüye vereceğine karar veren kişi
 * trafiği aynı ekranda görmeli.
 */
export default async function AdsPage() {
  requireAdmin();
  const admin = createAdminClient();

  const [{ data: ads }, { data: placements }, { data: venues }] = await Promise.all([
    admin.from('ads').select('*').order('created_at', { ascending: false }),
    admin.from('ad_placements').select('ad_id, venue_id'),
    admin
      .from('venues')
      .select('id, name, slug, is_published')
      .order('name'),
  ]);

  // ── Ölçümler ────────────────────────────────────────────────────────────
  // Menü ziyareti = scan_events'teki 'menu_view'. Sayım burada, satır satır
  // çekip toplayarak yapılıyor: Postgres tarafında bir görünüm açmak yerine
  // basit tutuldu, hacim bu ölçekte sorun değil.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: views }, { data: adEvents }] = await Promise.all([
    admin
      .from('scan_events')
      .select('venue_id, occurred_at')
      .eq('event_type', 'menu_view')
      .gte('occurred_at', since),
    admin.from('ad_events').select('ad_id, venue_id, kind, occurred_at').gte('occurred_at', since),
  ]);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const viewTotals = new Map<string, { total: number; week: number }>();
  for (const row of views ?? []) {
    const key = row.venue_id as string;
    const cur = viewTotals.get(key) ?? { total: 0, week: 0 };
    cur.total += 1;
    if (new Date(row.occurred_at as string).getTime() >= weekAgo) cur.week += 1;
    viewTotals.set(key, cur);
  }

  const adTotals = new Map<string, { impressions: number; clicks: number }>();
  for (const row of adEvents ?? []) {
    const key = row.ad_id as string;
    const cur = adTotals.get(key) ?? { impressions: 0, clicks: 0 };
    if (row.kind === 'click') cur.clicks += 1;
    else cur.impressions += 1;
    adTotals.set(key, cur);
  }

  const placementsByAd = new Map<string, string[]>();
  for (const p of placements ?? []) {
    const list = placementsByAd.get(p.ad_id as string) ?? [];
    list.push(p.venue_id as string);
    placementsByAd.set(p.ad_id as string, list);
  }

  const adRows: AdRow[] = (ads ?? []).map((a) => ({
    id: a.id as string,
    name: a.name as string,
    mediaUrl: a.media_url as string,
    mediaType: a.media_type as 'image' | 'video',
    durationSeconds: a.duration_seconds as number,
    clickUrl: (a.click_url as string | null) ?? null,
    allVenues: Boolean(a.all_venues),
    startsOn: (a.starts_on as string | null) ?? null,
    endsOn: (a.ends_on as string | null) ?? null,
    isActive: Boolean(a.is_active),
    weight: a.weight as number,
    venueIds: placementsByAd.get(a.id as string) ?? [],
    impressions: adTotals.get(a.id as string)?.impressions ?? 0,
    clicks: adTotals.get(a.id as string)?.clicks ?? 0,
  }));

  const venueOptions: VenueOption[] = (venues ?? []).map((v) => ({
    id: v.id as string,
    name: v.name as string,
    slug: v.slug as string,
    isPublished: Boolean(v.is_published),
  }));

  const venueStats: VenueStat[] = venueOptions
    .map((v) => ({
      ...v,
      views30: viewTotals.get(v.id)?.total ?? 0,
      views7: viewTotals.get(v.id)?.week ?? 0,
    }))
    .sort((a, b) => b.views30 - a.views30);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-600">Rota Menü</p>
          <h1 className="mt-1 text-2xl font-bold">Reklam yönetimi</h1>
          <p className="mt-1 text-sm text-stone-500">
            Açılış ekranında gösterilen reklamlar. Yalnız bu panelden yönetilir.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a
            href="/admin/panel"
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            ← Panele dön
          </a>
          <LogoutButton />
        </div>
      </header>

      <AdManager ads={adRows} venues={venueOptions} venueStats={venueStats} />
    </main>
  );
}
