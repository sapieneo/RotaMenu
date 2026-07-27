import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isIyzicoConfigured } from '@/lib/iyzico';

export const runtime = 'nodejs';

/**
 * POST /api/billing/dev-upgrade
 *
 * ⚠️ GEÇİCİ / YALNIZ GELİŞTİRME. iyzico henüz bağlanmadığı sürece Pro'yu
 * ödeme olmadan açar — sandbox üyelik sorunu çözülene kadar test amaçlı.
 *
 * GÜVENLİK KİLİDİ: `IYZICO_*` env değişkenleri tanımlanır tanımlanmaz
 * (`isIyzicoConfigured()` true olur) bu uç otomatik olarak 403 döner.
 * Yani gerçek ödeme akışı aktifleşince bypass kendiliğinden kapanır; env
 * unutulsa bile production'da ödeme atlanamaz.
 *
 * KALDIRMA (iyzico bağlanınca): bu dosyayı, dev-downgrade/route.ts'i ve
 * plan-client.tsx içindeki "Geliştirme modu" bloğunu sil.
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
    .update({ plan: 'pro' })
    .eq('id', membership.org_id);
  if (planErr) {
    return NextResponse.json({ error: 'Plan güncellenemedi.', details: planErr.message }, { status: 500 });
  }

  // Denetim izi: gerçek abonelik satırlarından ayırt edilsin diye provider
  // 'manual_bypass'. current_period_end YOK — süresiz test, dev-downgrade ile kapanır.
  await admin.from('subscriptions').insert({
    org_id: membership.org_id,
    provider: 'manual_bypass',
    status: 'ACTIVE',
    plan: 'pro',
    raw: { note: 'Geliştirme bypass (iyzico kurulumu bekleniyor).', by: user.id, at: new Date().toISOString() },
  });

  return NextResponse.json({ ok: true });
}
