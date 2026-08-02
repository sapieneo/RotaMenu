import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isIyzicoConfigured } from '@/lib/iyzico';

export const runtime = 'nodejs';

const bodySchema = z.object({ venueId: z.string().uuid().nullable().optional() });

/**
 * POST /api/billing/dev-downgrade
 *
 * ⚠️ GEÇİCİ / YALNIZ GELİŞTİRME. `dev-upgrade`'in tersi — bypass ile açılmış
 * Pro'yu free'e döndürür (free-plan kısıtlarını tekrar test edebilmek için).
 * Aynı güvenlik kilidi: iyzico bağlanınca (`isIyzicoConfigured()`) 403 döner.
 *
 * KALDIRMA: dev-upgrade/route.ts ile birlikte, bkz. o dosyadaki not.
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

  return NextResponse.json({
    ok: true,
    redirectTo: selectedVenue ? `/studyo/pano?venue=${selectedVenue.id}` : '/studyo/pano',
  });
}
