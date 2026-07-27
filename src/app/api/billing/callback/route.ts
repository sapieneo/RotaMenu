import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { retrieveSubscriptionCheckout, type IyzicoResult } from '@/lib/iyzico';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * iyzico Checkout Form dönüş adresi. Ödeme tamamlanınca iyzico bu adrese
 * `token` gönderir (POST, form-encoded). Token ile abonelik sonucu sorgulanır;
 * başarılıysa organizations.plan = 'pro' yapılır ve subscription satırı
 * güncellenir. Sonuç kullanıcıya /studyo/plan üzerinden bildirilir.
 *
 * GÜVENLİK: sonuç kullanıcıdan değil, doğrudan iyzico'dan (retrieve) okunur.
 * Yazımlar service-role ile; token ile eşleşen bekleyen satır bulunur.
 */
export async function POST(request: NextRequest) {
  const token = await readToken(request);
  return finalize(request, token);
}

// Bazı akışlarda dönüş GET olabilir (token query'de).
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  return finalize(request, token);
}

async function finalize(request: NextRequest, token: string | null) {
  const origin = siteOrigin(request);
  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/studyo/plan?upgrade=failed&reason=${reason}`, { status: 303 });

  if (!token) return fail('no_token');

  let result: IyzicoResult;
  try {
    result = await retrieveSubscriptionCheckout(token);
  } catch {
    return fail('retrieve_error');
  }

  const apiOk = (result.status ?? '').toLowerCase() === 'success';
  if (!apiOk) return fail('payment_failed');

  const admin = createAdminClient();

  // Bekleyen satırı token ile bul; yoksa conversationId'den org'u çöz.
  const { data: pending } = await admin
    .from('subscriptions')
    .select('id, org_id')
    .eq('checkout_token', token)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let orgId = pending?.org_id as string | undefined;
  if (!orgId) orgId = orgFromConversation(result);
  if (!orgId) return fail('org_not_found');

  const refs = extractRefs(result);

  // organizations.plan = pro (yetki anahtarı).
  const { error: planErr } = await admin
    .from('organizations')
    .update({ plan: 'pro' })
    .eq('id', orgId);
  if (planErr) return fail('plan_update_error');

  // subscription satırını güncelle (veya oluştur).
  const patch = {
    org_id: orgId,
    provider: 'iyzico',
    status: 'ACTIVE',
    plan: 'pro' as const,
    iyzico_subscription_ref: refs.subscriptionRef,
    iyzico_customer_ref: refs.customerRef,
    pricing_plan_ref: refs.pricingPlanRef ?? process.env.IYZICO_PRO_PRICING_PLAN_REF ?? null,
    checkout_token: token,
    raw: result as unknown as Record<string, unknown>,
  };
  if (pending?.id) {
    await admin.from('subscriptions').update(patch).eq('id', pending.id);
  } else {
    await admin.from('subscriptions').insert(patch);
  }

  return NextResponse.redirect(`${origin}/studyo/plan?upgrade=success`, { status: 303 });
}

async function readToken(request: NextRequest): Promise<string | null> {
  const ct = request.headers.get('content-type') ?? '';
  try {
    if (ct.includes('application/json')) {
      const j = (await request.json().catch(() => null)) as { token?: string } | null;
      return j?.token ?? null;
    }
    // form-encoded veya multipart
    const form = await request.formData();
    const t = form.get('token');
    return typeof t === 'string' ? t : null;
  } catch {
    return null;
  }
}

/** iyzico retrieve yanıtından referansları savunmacı biçimde çıkarır. */
function extractRefs(r: IyzicoResult): {
  subscriptionRef: string | null;
  customerRef: string | null;
  pricingPlanRef: string | null;
} {
  const get = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = (r as Record<string, unknown>)[k];
      if (typeof v === 'string' && v) return v;
    }
    return null;
  };
  return {
    subscriptionRef: get('referenceCode', 'subscriptionReferenceCode'),
    customerRef: get('customerReferenceCode', 'parentReferenceCode'),
    pricingPlanRef: get('pricingPlanReferenceCode'),
  };
}

function orgFromConversation(r: IyzicoResult): string | undefined {
  const conv = (r as Record<string, unknown>).conversationId;
  if (typeof conv !== 'string') return undefined;
  const m = conv.match(/^org_([0-9a-f-]{36})_/i);
  return m?.[1];
}

function siteOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const proto = request.headers.get('x-forwarded-proto') ?? 'http';
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    new URL(request.url).host;
  return `${proto}://${host}`;
}
