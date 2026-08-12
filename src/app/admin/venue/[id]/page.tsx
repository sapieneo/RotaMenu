import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { planLimits, normalizePlan, resolvePlanContext } from '@/lib/plans';
import { Icon } from '@/components/ui/icon';

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
    .select('id, org_id, name, slug, is_published, is_suspended, published_at, created_at')
    .eq('id', params.id)
    .maybeSingle();
  if (!venue) notFound();

  const { data: org } = await admin
    .from('organizations')
    .select('name, plan, contact_phone, contact_phone_verified_at, created_by, trial_ends_at')
    .eq('id', venue.org_id)
    .maybeSingle();

  let ownerEmail: string | null = null;
  let ownerIsAnonymous = true;
  if (org?.created_by) {
    try {
      const { data } = await admin.auth.admin.getUserById(org.created_by as string);
      ownerEmail = data?.user?.email ?? null;
      ownerIsAnonymous = Boolean(data?.user?.is_anonymous ?? !data?.user?.email);
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

  // Bugünkü AI tüketimi — kotanın gerçekten çalışıp çalışmadığını buradan görürüz.
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await admin
    .from('ai_usage')
    .select('kind, units')
    .eq('org_id', venue.org_id)
    .eq('used_on', today);
  const usageToday = (usage ?? []) as { kind: string; units: number }[];

  const plan = normalizePlan(org?.plan);
  const limits = planLimits(plan);
  const planCtx = resolvePlanContext(org?.plan, org?.trial_ends_at as string | null);

  return (
    <main className="mx-auto max-w-3xl px-md py-xl">
      <a
        href="/admin/panel"
        className="ros-pressable inline-flex min-h-touch items-center text-footnote font-medium text-brand-600 hover:underline"
      >
        ← Kontrol paneli
      </a>

      <header className="mb-lg mt-sm flex flex-wrap items-start justify-between gap-md">
        <div className="min-w-0">
          <h1 className="text-title font-semibold text-content">{venue.name}</h1>
          <p className="mt-xs text-footnote text-content-secondary">
            {ownerEmail ?? 'Sahip e-postası yok (anonim hesap)'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-sm">
          <StatusChip published={Boolean(venue.is_published)} suspended={Boolean(venue.is_suspended)} />
          {venue.slug && (
            <a
              href={`/m/${venue.slug}`}
              target="_blank"
              rel="noreferrer"
              className="ros-pressable inline-flex min-h-touch items-center gap-xs rounded-pill border border-line-strong px-md text-footnote font-medium text-content transition hover:bg-surface-sunken active:scale-[0.98]"
            >
              <Icon name="external" size={16} />
              Menüyü gör
            </a>
          )}
        </div>
      </header>

      {/* Yayındaki bir menünün sahibi anonim bir hesapsa, o kişi tarayıcı
          verisini sildiği an menüsüne bir daha erişemez — biz admin'den
          görmeye devam ederiz ama o düzenleyemez. Ajans tarafında bunu
          erkenden görmek gerekiyor. */}
      {ownerIsAnonymous && venue.is_published && (
        <p className="mb-md flex items-start gap-sm rounded-card border border-amber-300 bg-amber-50 px-md py-sm text-footnote text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          <span>
            Bu yayındaki menünün sahibi <strong>anonim bir hesap</strong> — e-postası yok.
            Kullanıcı tarayıcı verisini silerse menüsüne erişimini kalıcı olarak kaybeder.
            Hesabı e-postayla güvene almasını istemek gerekiyor.
          </span>
        </p>
      )}

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatCard label="Plan" value={limits.label} />
        <StatCard label="Ürün" value={itemCount ?? 0} />
        <StatCard label="Aktif QR" value={qrActive ?? 0} />
        <StatCard label="30 gün tarama" value={scans} />
      </section>

      <section className="mt-sm grid grid-cols-3 gap-sm">
        <MiniStat label="Menü görüntüleme" value={menuViews} />
        <MiniStat label="Ürün görüntüleme" value={itemViews} />
        <MiniStat label="QR tarama" value={scans} />
      </section>

      <section className="mt-lg rounded-card border border-line bg-surface-raised p-md text-footnote">
        <dl className="grid grid-cols-1 gap-xs sm:grid-cols-2">
          <Row label="Menü adresi" value={venue.slug ? `/m/${venue.slug}` : '—'} />
          <Row label="Telefon" value={(org?.contact_phone as string | null) ?? '—'} />
          <Row
            label="Telefon doğrulandı mı"
            value={org?.contact_phone_verified_at ? 'Evet' : 'Hayır'}
          />
          <Row
            label="Deneme durumu"
            value={
              planCtx.trial.state === 'none'
                ? plan === 'free'
                  ? 'Deneme yok'
                  : 'Ücretli plan'
                : planCtx.trial.state === 'active'
                ? `${planCtx.trial.daysLeft} gün kaldı`
                : 'Süresi doldu'
            }
          />
          <Row label="Oluşturulma" value={new Date(venue.created_at).toLocaleDateString('tr-TR')} />
          <Row
            label="İlk yayın"
            value={venue.published_at ? new Date(venue.published_at).toLocaleDateString('tr-TR') : '—'}
          />
        </dl>
      </section>

      <section className="mt-lg rounded-card border border-line bg-surface-raised p-md">
        <h2 className="text-callout font-semibold text-content">Bugünkü AI kullanımı</h2>
        <p className="mt-xs text-caption text-content-muted">
          Org başına günlük sayaç (UTC). Gece yarısı sıfırlanır.
        </p>
        {usageToday.length === 0 ? (
          <p className="mt-sm text-footnote text-content-secondary">Bugün AI kullanılmadı.</p>
        ) : (
          <ul className="mt-sm space-y-xs text-footnote">
            {usageToday.map((u) => (
              <li key={u.kind} className="flex justify-between">
                <span className="text-content-secondary">{AI_KIND_LABEL[u.kind] ?? u.kind}</span>
                <span className="font-medium text-content">{u.units}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

const AI_KIND_LABEL: Record<string, string> = {
  ingest: 'Menü okuma (sayfa)',
  image: 'Görsel üretimi',
  translate: 'Çeviri (dil)',
  description: 'Açıklama üretimi',
};

function StatusChip({ published, suspended }: { published: boolean; suspended: boolean }) {
  const [color, label] = suspended
    ? ['bg-red-500', 'Askıda']
    : published
    ? ['bg-emerald-500', 'Canlı']
    : ['bg-line-strong', 'Taslak'];
  return (
    <span className="inline-flex items-center gap-xs text-footnote text-content-secondary">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-card bg-surface-sunken p-md">
      <p className="text-caption font-medium text-content-muted">{label}</p>
      <p className="mt-xs text-heading font-semibold text-content">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card bg-surface-sunken px-md py-sm text-center">
      <p className="text-body font-semibold text-content">{value}</p>
      <p className="text-caption text-content-muted">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-md border-b border-line py-xs last:border-0">
      <dt className="text-content-secondary">{label}</dt>
      <dd className="font-medium text-content">{value}</dd>
    </div>
  );
}
