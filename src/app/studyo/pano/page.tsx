import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isAdminSession } from '@/lib/admin-auth';
import { resolvePlanContext } from '@/lib/plans';
import { Dashboard, type DashboardData, type DayBucket } from './dashboard';
import { resolveManagedVenue, resolveVenueByIdAsAdmin } from '@/lib/managed-venue';
import { hasPanoSession } from '@/lib/pano-auth';
import { PanoPasswordGate } from './pano-password-gate';

export const dynamic = 'force-dynamic';

/**
 * Studyo panosu (Faz B5). B1–B4'te ürettiğimiz her şeyi tek ekranda toplar:
 * yayın durumu, QR, uyum, hesap ve son 30 günün çerezsiz tarama analitiği.
 * Normal okuma yolu user-client + RLS ile (org üyesi kendi verisini görür).
 *
 * Bunun DIŞINDA hesapsız bir üçüncü giriş yolu var: işletmeye özel pano
 * şifresi (bkz. lib/pano-auth.ts). `resolveManagedVenue` org üyeliği ya da
 * süper-admin oturumuyla venue bulamazsa, `?venue=` verilmiş olması şartıyla
 * geçerli bir pano-şifresi çerezi arıyoruz; o da yoksa şifre giriş ekranını
 * (PanoPasswordGate) gösteriyoruz — hata değil, bir giriş adımı.
 */
export default async function DashboardPage({ searchParams }: { searchParams?: { venue?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const requestedVenueId = searchParams?.venue ?? null;

  let venue = await resolveManagedVenue(supabase, requestedVenueId);
  let viaPanoPassword = false;

  if (!venue && requestedVenueId) {
    if (hasPanoSession(requestedVenueId)) {
      venue = await resolveVenueByIdAsAdmin(requestedVenueId);
      viaPanoPassword = true;
    } else {
      return <PanoPasswordGate venueId={requestedVenueId} />;
    }
  }

  if (!venue) {
    if (!user) {
      return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-xl font-semibold">Oturum bulunamadı</h1>
          <a href="/studyo" className="mt-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow">
            Studyoya git
          </a>
        </main>
      );
    }
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold">Henüz menün yok</h1>
        <p className="text-stone-600">Önce bir menü oluştur; panon burada belirir.</p>
        <a href="/studyo" className="mt-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow">
          Menü oluştur
        </a>
      </main>
    );
  }

  // Pano şifresiyle giren ziyaretçinin Supabase hesabı yok — "hesap
  // güvenceli mi" sorusuna güvenle "hayır" denir; bu yalnızca Plan kartındaki
  // nazik yönlendirme metnini etkiler, panoyu görmesini engellemez.
  const isAnonymous = viaPanoPassword ? true : (user as { is_anonymous?: boolean } | null)?.is_anonymous ?? !user?.email;
  const accountSecured = !isAnonymous && Boolean(user?.email);

  // Süper-admin oturumu ya da pano şifresiyle girildiyse arkadaki kullanıcı
  // org üyesi DEĞİL — normal `supabase` (RLS) istemcisiyle devamdaki tüm
  // sorgular boş dönerdi. Bu iki yolda service-role istemcisine geçiyoruz;
  // kimlik zaten yukarıda (admin parolası ya da venue'ye özel pano şifresi
  // çerezi) doğrulandı.
  const usedPrivilegedFetch = Boolean(requestedVenueId && isAdminSession()) || viaPanoPassword;
  const db = usedPrivilegedFetch ? createAdminClient() : supabase;

  // --- Plan + iletişim telefonu (Faz C freemium) ---
  const { data: orgRow } = await db
    .from('organizations')
    .select('plan, contact_phone, trial_ends_at')
    .eq('id', venue.org_id)
    .maybeSingle();
  const planCtx = resolvePlanContext(orgRow?.plan, orgRow?.trial_ends_at);
  const planTier = planCtx.effectivePlan;
  const limits = planCtx.limits;

  // --- Ürün + bekleyen alerjen onayı sayısı (ayarlar ekranıyla aynı mantık) ---
  const { data: menus } = await db
    .from('menus')
    .select('id')
    .eq('venue_id', venue.id)
    .eq('is_active', true);
  const menuIds = (menus ?? []).map((m) => m.id);

  const { data: cats } = menuIds.length
    ? await db.from('categories').select('id').in('menu_id', menuIds).eq('is_active', true)
    : { data: [] as { id: string }[] };
  const catIds = (cats ?? []).map((c) => c.id);

  const { data: items } = catIds.length
    ? await db.from('items').select('id, image_url').in('category_id', catIds)
    : { data: [] as { id: string; image_url: string | null }[] };
  const itemIds = (items ?? []).map((i) => i.id);
  const itemCount = itemIds.length;
  // Görsel kapsamı: özellik çalışıyor ama kullanıcı ona yönlendirilmiyordu —
  // canlı bir menüde 168 üründen yalnızca 10'unda görsel vardı.
  const itemsWithImage = (items ?? []).filter((i) => i.image_url).length;

  const { count: confirmedCount } = itemIds.length
    ? await db
        .from('item_compliance')
        .select('item_id', { count: 'exact', head: true })
        .in('item_id', itemIds)
        .eq('allergen_review', 'confirmed')
    : { count: 0 };
  const pendingCount = Math.max(0, itemCount - (confirmedCount ?? 0));

  // --- QR sayısı ---
  const { count: qrActive } = await db
    .from('qr_codes')
    .select('id', { count: 'exact', head: true })
    .eq('venue_id', venue.id)
    .eq('is_active', true);

  // --- Son 30 gün tarama olayları ---
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const { data: events } = await db
    .from('scan_events')
    .select('event_type, occurred_at, session_key')
    .eq('venue_id', venue.id)
    .gte('occurred_at', since.toISOString())
    .order('occurred_at', { ascending: true });

  const rows = (events ?? []) as { event_type: string; occurred_at: string; session_key: string | null }[];

  let scans = 0;
  let menuViews = 0;
  let itemViews = 0;
  const uniq = new Set<string>();
  // Günlük kova: son 30 gün, yerel tarihe göre (Europe/Istanbul yaklaşık).
  const days: DayBucket[] = [];
  const dayIndex = new Map<string, number>();
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dayIndex.set(key, days.length);
    days.push({ date: key, scans: 0, views: 0 });
  }

  for (const e of rows) {
    if (e.event_type === 'scan') scans += 1;
    else if (e.event_type === 'menu_view') menuViews += 1;
    else if (e.event_type === 'item_view') itemViews += 1;
    if (e.session_key) uniq.add(e.session_key);
    const key = e.occurred_at.slice(0, 10);
    const idx = dayIndex.get(key);
    if (idx != null) {
      if (e.event_type === 'scan') days[idx]!.scans += 1;
      if (e.event_type === 'menu_view') days[idx]!.views += 1;
    }
  }

  const data: DashboardData = {
    venueId: venue.id,
    venueName: venue.name,
    slug: venue.slug,
    isPublished: Boolean(venue.is_published),
    publishedAt: venue.published_at ?? null,
    isAnonymous,
    itemCount,
    itemsWithImage,
    pendingCount,
    qrActive: qrActive ?? 0,
    plan: {
      tier: planTier,
      label: limits.label,
      itemLimit: Number.isFinite(limits.maxItems) ? limits.maxItems : null,
      images: limits.images,
      removeBadge: limits.removeBadge,
      requiresVerifiedAccount: limits.requiresVerifiedAccount,
      canPublish: limits.canPublish,
      accountSecured,
      hasPhone: Boolean(orgRow?.contact_phone),
      trial: planCtx.trial,
    },
    stats: {
      scans,
      menuViews,
      itemViews,
      uniqueVisitors: uniq.size,
      totalEvents: rows.length,
    },
    days,
  };

  return <Dashboard data={data} />;
}
