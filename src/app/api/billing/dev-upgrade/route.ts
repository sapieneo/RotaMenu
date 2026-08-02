import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isIyzicoConfigured } from '@/lib/iyzico';

export const runtime = 'nodejs';

const bodySchema = z.object({ venueId: z.string().uuid().nullable().optional() });

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
export async function POST(request: NextRequest) {
  if (isIyzicoConfigured()) {
    return NextResponse.json({ error: 'iyzico aktif; bypass kapalı.' }, { status: 403 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });

  const admin = createAdminClient();
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz işletme seçimi.' }, { status: 400 });
  const venueId = parsed.data.venueId ?? null;
  const { data: selectedVenue } = venueId
    ? await admin.from('venues').select('id, org_id').eq('id', venueId).maybeSingle()
    : { data: null };
  if (venueId && !selectedVenue) {
    return NextResponse.json({ error: 'İşletme bulunamadı.' }, { status: 404 });
  }
  let membershipQuery = admin
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin']);
  if (selectedVenue) membershipQuery = membershipQuery.eq('org_id', selectedVenue.org_id);
  const { data: membership } = await membershipQuery
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
  const { data: activeBypass } = await admin
    .from('subscriptions')
    .select('id')
    .eq('org_id', membership.org_id)
    .eq('provider', 'manual_bypass')
    .eq('status', 'ACTIVE')
    .limit(1)
    .maybeSingle();
  if (!activeBypass) {
    await admin.from('subscriptions').insert({
      org_id: membership.org_id,
      provider: 'manual_bypass',
      status: 'ACTIVE',
      plan: 'pro',
      raw: { note: 'Geliştirme bypass (iyzico kurulumu bekleniyor).', by: user.id, at: new Date().toISOString() },
    });
  }

  return NextResponse.json({
    ok: true,
    redirectTo: selectedVenue ? `/studyo/pano?venue=${selectedVenue.id}` : '/studyo/pano',
  });
}
