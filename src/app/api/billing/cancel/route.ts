import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { cancelSubscription, isIyzicoConfigured, IyzicoError } from '@/lib/iyzico';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/billing/cancel
 * Oturumdaki owner'ın Pro aboneliğini iptal eder. iyzico politikası gereği
 * abonelik dönem sonuna kadar aktif kalır; bu yüzden plan HEMEN free'e
 * düşürülmez — durum CANCELED işaretlenir, süre dolumunda webhook free'e çeker.
 */
export async function POST() {
  if (!isIyzicoConfigured()) {
    return NextResponse.json({ error: 'Ödeme altyapısı yapılandırılmamış.' }, { status: 501 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin'])
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'Bu işlem için yetkin yok.' }, { status: 403 });
  }

  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, iyzico_subscription_ref, status')
    .eq('org_id', membership.org_id)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub?.iyzico_subscription_ref) {
    return NextResponse.json({ error: 'Aktif abonelik bulunamadı.' }, { status: 404 });
  }

  try {
    await cancelSubscription(sub.iyzico_subscription_ref);
  } catch (err) {
    const message = err instanceof IyzicoError ? err.message : 'Abonelik iptal edilemedi.';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await admin
    .from('subscriptions')
    .update({ status: 'CANCELED', canceled_at: new Date().toISOString() })
    .eq('id', sub.id);

  return NextResponse.json({ ok: true });
}
