import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isIyzicoConfigured } from '@/lib/iyzico';

export const runtime = 'nodejs';

/**
 * POST /api/billing/dev-downgrade
 *
 * ⚠️ GEÇİCİ / YALNIZ GELİŞTİRME. `dev-upgrade`'in tersi — bypass ile açılmış
 * Pro'yu free'e döndürür (free-plan kısıtlarını tekrar test edebilmek için).
 * Aynı güvenlik kilidi: iyzico bağlanınca (`isIyzicoConfigured()`) 403 döner.
 *
 * KALDIRMA: dev-upgrade/route.ts ile birlikte, bkz. o dosyadaki not.
 */
export async function POST() {
  if (isIyzicoConfigured()) {
    return NextResponse.json({ error: 'iyzico aktif; bypass kapalı.' }, { status: 403 });
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

  const { error: planErr } = await admin
    .from('organizations')
    .update({ plan: 'free' })
    .eq('id', membership.org_id);
  if (planErr) {
    return NextResponse.json({ error: 'Plan güncellenemedi.', details: planErr.message }, { status: 500 });
  }

  await admin
    .from('subscriptions')
    .update({ status: 'CANCELED', canceled_at: new Date().toISOString() })
    .eq('org_id', membership.org_id)
    .eq('provider', 'manual_bypass')
    .eq('status', 'ACTIVE');

  return NextResponse.json({ ok: true });
}
