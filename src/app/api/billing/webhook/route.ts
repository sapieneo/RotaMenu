import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { retrieveSubscription, isIyzicoConfigured, type IyzicoResult } from '@/lib/iyzico';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/billing/webhook
 * iyzico abonelik bildirimleri (yenileme başarılı/başarısız, iptal, süre dolumu).
 *
 * GÜVENLİK: webhook gövdesine GÜVENMEYİZ. Yalnız `subscriptionReferenceCode`'u
 * alır, durumu doğrudan iyzico'dan (retrieveSubscription) doğrular, ona göre
 * organizations.plan + subscriptions satırını günceller. Böylece sahte webhook
 * bir etki yaratamaz. Her durumda 200 döneriz (gereksiz yeniden denemeyi önler).
 */
export async function POST(request: NextRequest) {
  if (!isIyzicoConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'not_configured' });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const ref = extractSubscriptionRef(payload);
  if (!ref) {
    return NextResponse.json({ ok: true, skipped: 'no_ref' });
  }

  // Gerçek durumu iyzico'dan doğrula.
  let sub: IyzicoResult;
  try {
    sub = await retrieveSubscription(ref);
  } catch {
    return NextResponse.json({ ok: true, skipped: 'retrieve_error' });
  }

  const status = String(
    (sub as Record<string, unknown>).subscriptionStatus ??
      (sub as Record<string, unknown>).status ??
      ''
  ).toUpperCase();

  const admin = createAdminClient();

  const { data: row } = await admin
    .from('subscriptions')
    .select('id, org_id')
    .eq('iyzico_subscription_ref', ref)
    .limit(1)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ ok: true, skipped: 'unknown_subscription' });
  }

  // ACTIVE → pro; CANCELED/EXPIRED/UNPAID → free (dönem sonu takibi yoksa net karar).
  const active = status === 'ACTIVE' || status === 'UPGRADED';
  const nextPlan = active ? 'pro' : 'free';

  await admin.from('organizations').update({ plan: nextPlan }).eq('id', row.org_id);
  await admin
    .from('subscriptions')
    .update({
      status: status || 'UNKNOWN',
      plan: nextPlan,
      canceled_at: active ? null : new Date().toISOString(),
      raw: sub as unknown as Record<string, unknown>,
    })
    .eq('id', row.id);

  return NextResponse.json({ ok: true, status: status || 'UNKNOWN', plan: nextPlan });
}

function extractSubscriptionRef(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const candidates = [
    payload.subscriptionReferenceCode,
    payload.referenceCode,
    (payload.data as Record<string, unknown> | undefined)?.subscriptionReferenceCode,
    (payload.data as Record<string, unknown> | undefined)?.referenceCode,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c) return c;
  }
  return null;
}
