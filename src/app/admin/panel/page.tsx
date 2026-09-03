import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { normalizePlan, planLimits } from '@/lib/plans';
import { Icon } from '@/components/ui/icon';
import { LogoutButton } from '../logout-button';
import { SuspensionNoticeCard } from './suspension-notice-card';
import { VenueList, type AdminVenueRow } from './venue-list';
import { CreateVenueButton } from './create-venue-button';

export const dynamic = 'force-dynamic';

type OrganizationEmbed = {
  name: string;
  plan: string;
  created_by: string;
  contact_phone: string | null;
  trial_ends_at: string | null;
};

type VenueEmbed = {
  id: string;
  name: string;
  slug: string;
  is_published: boolean;
  org_id: string;
  is_suspended: boolean;
  organizations: OrganizationEmbed | OrganizationEmbed[] | null;
};

type MenuRow = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  venue_id: string;
  venues: VenueEmbed | VenueEmbed[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Süper-admin menü listesi. Service-role sorgusu yalnızca imzalı admin
 * oturumundan sonra çalışır; normal kullanıcılar başka işletmelerin verisini
 * göremez.
 */
export default async function AdminPanelPage() {
  requireAdmin();
  const admin = createAdminClient();

  const { data: menuData, error: menuError } = await admin
    .from('menus')
    .select(
      'id, name, is_active, created_at, updated_at, venue_id, venues!inner(id, name, slug, is_published, org_id, is_suspended, organizations!inner(name, plan, created_by, contact_phone, trial_ends_at))'
    )
    .order('created_at', { ascending: false });

  if (menuError) throw new Error('Menü listesi yüklenemedi.');

  // Platform geneli askıya alma bildirimi (tek görsel + tek metin).
  const { data: settings } = await admin
    .from('platform_settings')
    .select('suspension_message, suspension_image_url')
    .eq('id', true)
    .maybeSingle();

  const menus = (menuData ?? []) as unknown as MenuRow[];
  const menuIds = menus.map((menu) => menu.id);

  const { data: categoryData } = menuIds.length
    ? await admin.from('categories').select('id, menu_id').in('menu_id', menuIds).eq('is_active', true)
    : { data: [] as { id: string; menu_id: string }[] };
  const categories = (categoryData ?? []) as { id: string; menu_id: string }[];
  const categoryIds = categories.map((category) => category.id);

  const { data: itemData } = categoryIds.length
    ? await admin.from('items').select('id, category_id').in('category_id', categoryIds)
    : { data: [] as { id: string; category_id: string }[] };
  const items = (itemData ?? []) as { id: string; category_id: string }[];

  const menuIdByCategoryId = new Map(categories.map((category) => [category.id, category.menu_id]));
  const categoryCountByMenuId = new Map<string, number>();
  const itemCountByMenuId = new Map<string, number>();

  for (const category of categories) {
    categoryCountByMenuId.set(
      category.menu_id,
      (categoryCountByMenuId.get(category.menu_id) ?? 0) + 1
    );
  }
  for (const item of items) {
    const menuId = menuIdByCategoryId.get(item.category_id);
    if (menuId) itemCountByMenuId.set(menuId, (itemCountByMenuId.get(menuId) ?? 0) + 1);
  }

  const ownerIds = Array.from(
    new Set(
      menus
        .map((menu) => one(one(menu.venues)?.organizations)?.created_by)
        .filter((id): id is string => Boolean(id))
    )
  );
  const emailById = new Map<string, string>();
  await Promise.all(
    ownerIds.map(async (id) => {
      try {
        const { data } = await admin.auth.admin.getUserById(id);
        if (data.user?.email) emailById.set(id, data.user.email);
      } catch {
        // Anonim veya silinmiş hesaplarda e-posta yerine kısa kullanıcı kimliği gösterilir.
      }
    })
  );

  // ── Satırlar ────────────────────────────────────────────────────────────
  const now = Date.now();
  const rows: AdminVenueRow[] = menus.map((menu) => {
    const venue = one(menu.venues);
    const organization = one(venue?.organizations ?? null);
    const plan = normalizePlan(organization?.plan);
    // Deneme yalnız ücretsiz planda anlamlı — ücretli planda `trial_ends_at`
    // dolu olsa da yetkilendirmede yok sayılıyor (bkz. resolvePlanContext).
    const trialEnds = plan === 'free' ? organization?.trial_ends_at ?? null : null;
    const trialDaysLeft = trialEnds
      ? Math.ceil((new Date(trialEnds).getTime() - now) / 86_400_000)
      : null;

    return {
      menuId: menu.id,
      menuName: menu.name || '',
      venueId: venue?.id ?? null,
      venueName: venue?.name || organization?.name || '',
      slug: venue?.slug ?? null,
      ownerEmail: organization?.created_by
        ? emailById.get(organization.created_by) ?? null
        : null,
      contactPhone: organization?.contact_phone ?? null,
      planLabel: planLimits(organization?.plan).label,
      isPaid: plan !== 'free',
      itemCount: itemCountByMenuId.get(menu.id) ?? 0,
      categoryCount: categoryCountByMenuId.get(menu.id) ?? 0,
      isPublished: Boolean(menu.is_active && venue?.is_published),
      isSuspended: Boolean(venue?.is_suspended),
      createdAt: menu.created_at,
      trialDaysLeft,
    };
  });

  // ── Özet metrikleri ─────────────────────────────────────────────────────
  // Eskiden "toplam menü / canlı / toplam ürün" vardı; bunlar gurur
  // metrikleriydi. Ajans işletirken karar aldıran sayılar bunlar:
  const liveCount = rows.filter((r) => r.isPublished).length;
  const payingCount = new Set(rows.filter((r) => r.isPaid).map((r) => r.venueId)).size;
  const trialEndingCount = rows.filter(
    (r) => r.trialDaysLeft !== null && r.trialDaysLeft <= 7
  ).length;
  const idleCount = rows.filter((r) => r.itemCount === 0).length;
  const suspendedCount = rows.filter((r) => r.isSuspended).length;

  return (
    <main className="mx-auto max-w-6xl px-md py-xl">
      <header className="mb-lg flex flex-wrap items-start justify-between gap-md">
        <div>
          <p className="text-footnote font-semibold text-brand-600">RotaMenu yönetim</p>
          <h1 className="mt-xs text-title font-semibold text-content">İşletmeler</h1>
          <p className="mt-xs text-footnote text-content-secondary">
            Bütün kiracıları tek ekrandan yönetin. Bir işletmeyi bulup panosuna geçin.
          </p>
        </div>
        <div className="flex items-center gap-sm">
          {/* Reklam yönetimi yalnız Rota Menü'ye ait; işletme panelinde izi yok. */}
          <a
            href="/admin/reklam"
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
          >
            Reklamlar
          </a>
          <CreateVenueButton />
          <LogoutButton />
        </div>
      </header>

      {/* Karar aldıran sayılar. Eskiden "toplam menü / canlı / toplam ürün"
          vardı — bunlar gurur metrikleriydi, hiçbir eylem doğurmuyorlardı. */}
      <section className="mb-lg grid grid-cols-2 gap-sm sm:grid-cols-4">
        <SummaryCard label="Ödeyen müşteri" value={payingCount} tone="good" />
        <SummaryCard label="Canlı menü" value={liveCount} />
        <SummaryCard
          label="Denemesi bitiyor"
          value={trialEndingCount}
          tone={trialEndingCount ? 'warn' : 'plain'}
        />
        <SummaryCard label="Boş hesap" value={idleCount} />
      </section>

      {suspendedCount > 0 && (
        <p className="mb-md flex items-center gap-sm rounded-card border border-amber-300 bg-amber-50 px-md py-sm text-footnote text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <Icon name="alert" size={18} className="shrink-0" />
          {suspendedCount} işletme askıda — misafirlere menü yerine uyarı ekranı gösteriliyor.
        </p>
      )}

      <SuspensionNoticeCard
        initialMessage={(settings?.suspension_message as string | null) ?? null}
        initialImageUrl={(settings?.suspension_image_url as string | null) ?? null}
      />

      <VenueList rows={rows} />
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'plain',
}: {
  label: string;
  value: number;
  tone?: 'plain' | 'good' | 'warn';
}) {
  const accent =
    tone === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warn'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-content';
  return (
    <div className="rounded-card bg-surface-sunken p-md">
      <p className="text-caption font-medium text-content-muted">{label}</p>
      <p className={`mt-xs text-title font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
