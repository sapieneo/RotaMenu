import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { planLimits } from '@/lib/plans';
import { LogoutButton } from '../logout-button';
import { SuspensionNoticeCard } from './suspension-notice-card';
import { SuspendToggle, DeleteVenueButton } from './row-actions';

export const dynamic = 'force-dynamic';

type OrganizationEmbed = {
  name: string;
  plan: string;
  created_by: string;
  contact_phone: string | null;
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
      'id, name, is_active, created_at, updated_at, venue_id, venues!inner(id, name, slug, is_published, org_id, is_suspended, organizations!inner(name, plan, created_by, contact_phone))'
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

  const publishedCount = menus.filter((menu) => {
    const venue = one(menu.venues);
    return menu.is_active && venue?.is_published;
  }).length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-600">RestaurantOS Yönetim</p>
          <h1 className="mt-1 text-2xl font-bold text-stone-900">Tüm menüler</h1>
          <p className="mt-1 text-sm text-stone-500">
            Kullanıcıların oluşturduğu bütün menüleri tek ekrandan görüntüleyin.
          </p>
        </div>
        <LogoutButton />
      </header>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:max-w-xl sm:grid-cols-3">
        <SummaryCard label="Toplam menü" value={menus.length} />
        <SummaryCard label="Canlı menü" value={publishedCount} />
        <SummaryCard label="Toplam ürün" value={items.length} />
      </section>

      <SuspensionNoticeCard
        initialMessage={(settings?.suspension_message as string | null) ?? null}
        initialImageUrl={(settings?.suspension_image_url as string | null) ?? null}
      />

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Menü / İşletme</th>
              <th className="px-4 py-3 font-semibold">Kullanıcı</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">İçerik</th>
              <th className="px-4 py-3 font-semibold">Durum</th>
              <th className="px-4 py-3 font-semibold">Askıya al</th>
              <th className="px-4 py-3 font-semibold">Oluşturulma</th>
              <th className="px-4 py-3 text-right font-semibold">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {menus.map((menu) => {
              const venue = one(menu.venues);
              const organization = one(venue?.organizations ?? null);
              const ownerEmail = organization?.created_by
                ? emailById.get(organization.created_by)
                : undefined;
              const isPublished = Boolean(menu.is_active && venue?.is_published);

              return (
                <tr key={menu.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/70">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-stone-900">{menu.name || 'İsimsiz menü'}</div>
                    <div className="mt-0.5 text-xs text-stone-500">
                      {venue?.name || organization?.name || 'İsimsiz işletme'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    <div>{ownerEmail ?? 'Anonim kullanıcı'}</div>
                    {organization?.contact_phone && (
                      <div className="mt-0.5 text-xs text-stone-400">{organization.contact_phone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        (organization?.plan ?? 'free') === 'free'
                          ? 'bg-stone-200 text-stone-700'
                          : 'bg-brand-600 text-white'
                      }`}
                    >
                      {planLimits(organization?.plan).label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    <span className="font-medium text-stone-800">
                      {itemCountByMenuId.get(menu.id) ?? 0} ürün
                    </span>
                    <span className="ml-2 text-xs text-stone-400">
                      {categoryCountByMenuId.get(menu.id) ?? 0} kategori
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${
                        isPublished ? 'bg-emerald-600' : 'bg-amber-500'
                      }`}
                    >
                      {isPublished ? 'CANLI' : 'TASLAK'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {venue && (
                      <SuspendToggle
                        venueId={venue.id}
                        initialSuspended={Boolean(venue.is_suspended)}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {new Date(menu.created_at).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {venue && (
                        <Link
                          href={`/admin/venue/${venue.id}`}
                          className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-stone-800"
                        >
                          Detay
                        </Link>
                      )}
                      {venue?.slug && (
                        <a
                          href={`/m/${venue.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
                        >
                          Menüyü aç
                        </a>
                      )}
                      {venue && (
                        <a
                          href={`/studyo/pano?venue=${venue.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
                        >
                          Panoya git
                        </a>
                      )}
                      {venue && (
                        <DeleteVenueButton
                          venueId={venue.id}
                          venueName={venue.name || organization?.name || 'Bu işletme'}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {menus.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-stone-400">
                  Henüz oluşturulmuş bir menü yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-stone-900">{value}</p>
    </div>
  );
}
