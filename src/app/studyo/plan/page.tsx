import { createClient } from '@/lib/supabase/server';
import { planLimits, resolvePlanContext } from '@/lib/plans';
import { isIyzicoConfigured } from '@/lib/iyzico';
import { isAdminSession } from '@/lib/admin-auth';
import { PlanClient, type PlanClientData } from './plan-client';
import { resolveManagedVenue } from '@/lib/managed-venue';

export const dynamic = 'force-dynamic';

/**
 * Plan & yükseltme ekranı (Faz C · Faturalama).
 * Ücretsiz planda: fatura bilgi formu → iyzico abonelik Checkout Form.
 * Pro planda: durum + iptal. Fiyat/periyot iyzico pricing plan'da tanımlıdır.
 */
export default async function PlanPage({ searchParams }: { searchParams?: { venue?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const venue = await resolveManagedVenue(supabase, searchParams?.venue);
  const { data: membership } = venue
    ? await supabase
        .from('organization_members')
        .select('org_id, role')
        .eq('user_id', user.id)
        .eq('org_id', venue.org_id)
        .maybeSingle()
    : { data: null };

  let plan = 'free';
  let contactPhone: string | null = null;
  let orgName = '';
  let subStatus: string | null = null;
  let periodEnd: string | null = null;
  let trial: PlanClientData['trial'] = { state: 'none', endsAt: null, daysLeft: 0 };

  if (membership) {
    const { data: org } = await supabase
      .from('organizations')
      .select('plan, contact_phone, name, trial_ends_at')
      .eq('id', membership.org_id)
      .maybeSingle();
    const ctx = resolvePlanContext(org?.plan, org?.trial_ends_at as string | null);
    trial = ctx.trial;
    plan = ctx.basePlan;
    contactPhone = (org?.contact_phone as string | null) ?? null;
    orgName = (org?.name as string | null) ?? '';

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    subStatus = (sub?.status as string | null) ?? null;
    periodEnd = (sub?.current_period_end as string | null) ?? null;
  }

  const isOwner = membership?.role === 'owner' || membership?.role === 'admin';

  const data: PlanClientData = {
    venueId: venue?.id ?? null,
    dashboardHref: venue?.id ? `/studyo/pano?venue=${venue.id}` : '/studyo/pano',
    plan: plan as 'free' | 'pro' | 'enterprise',
    planLabel: planLimits(plan).label,
    isOwner,
    isSuperAdmin: isAdminSession(),
    billingConfigured: isIyzicoConfigured(),
    subStatus,
    periodEnd,
    trial,
    prefill: {
      email: user.email ?? '',
      gsmNumber: contactPhone ?? '',
      name: orgName,
    },
  };

  return <PlanClient data={data} />;
}
