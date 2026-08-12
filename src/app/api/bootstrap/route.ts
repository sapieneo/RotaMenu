import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/bootstrap
 * Oturumdaki kullanıcı (anonim dahil) için org + venue taslağını hazırlar.
 * İdempotent: mevcutsa yeniden oluşturmaz.
 *
 * Provizyon yazımları SERVICE ROLE ile yapılır ve created_by açıkça
 * doğrulanmış kullanıcı id'sine set edilir (route kullanıcıyı getUser ile
 * doğrular). Böylece anonim ilk-kayıt, RLS+auth.uid() kırılganlığından bağımsız
 * ve güvenli şekilde çalışır.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Belirli bir işletme istendiyse (ör. admin panelindeki "Menü üret"
  // sonrası `/studyo?venue=…`) onu kullan — ama YALNIZ kullanıcı o org'un
  // üyesiyse. Aksi halde "en son işletme" mantığına düşülür ve iki işletme
  // arka arkaya açıldığında yanlış olana girilebilir.
  const requestedVenueId = await readRequestedVenueId(request);

  // Mevcut üyelik? (RLS-bağımsız, kesin sonuç)
  const { data: memberships } = await admin
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const memberOrgIds = (memberships ?? []).map((membership) => membership.org_id as string);

  // İstenen işletme varsa ve kullanıcı onun org'una üyeyse onu seç;
  // değilse her zamanki "en son oluşturulan" davranışı.
  const { data: latestVenue } = memberOrgIds.length
    ? requestedVenueId
      ? await admin
          .from('venues')
          .select('id, org_id, slug, name')
          .eq('id', requestedVenueId)
          .in('org_id', memberOrgIds)
          .maybeSingle()
      : await admin
          .from('venues')
          .select('id, org_id, slug, name')
          .in('org_id', memberOrgIds)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
    : { data: null };

  let orgId = (latestVenue?.org_id ?? memberOrgIds[0]) as string | undefined;

  if (!orgId) {
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .insert({ name: 'İşletmem', created_by: user.id })
      .select('id')
      .single();
    if (orgErr || !org) {
      console.error('BOOTSTRAP org insert error:', orgErr);
      return NextResponse.json(
        { error: 'İşletme kaydı oluşturulamadı.', details: orgErr?.message },
        { status: 500 }
      );
    }
    orgId = org.id;
  }

  // Venue var mı?
  const venue = latestVenue?.org_id === orgId
    ? latestVenue
    : (
        await admin
          .from('venues')
          .select('id, org_id, slug, name')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data;
  if (venue) {
    // Bu venue'da hiç kategori var mı? Varsa dönen kullanıcıdır → studyo
    // girişi panoya bağ gösterir. (menus → categories zinciri, RLS altında.)
    const { data: someCat } = await admin
      .from('categories')
      .select('id, menus!inner(venue_id)')
      .eq('menus.venue_id', venue.id)
      .limit(1)
      .maybeSingle();
    return NextResponse.json({
      orgId,
      venueId: venue.id,
      slug: venue.slug,
      name: venue.name,
      hasMenu: Boolean(someCat),
    });
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 10);
    const { data: created, error: venueErr } = await admin
      .from('venues')
      .insert({ org_id: orgId, slug: `isletme-${suffix}`, name: 'İşletmem' })
      .select('id, slug')
      .single();
    if (created) {
      return NextResponse.json({ orgId, venueId: created.id, slug: created.slug });
    }
    if (venueErr && venueErr.code !== '23505') {
      console.error('BOOTSTRAP venue insert error:', venueErr);
      return NextResponse.json({ error: 'Mekân kaydı oluşturulamadı.' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Mekân kaydı oluşturulamadı.' }, { status: 500 });
}

/** Gövde boş ya da bozuk olabilir — bootstrap parametresiz de çağrılıyor. */
async function readRequestedVenueId(request: Request): Promise<string | null> {
  try {
    const body = (await request.json()) as { venueId?: unknown };
    const id = body?.venueId;
    return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
  } catch {
    return null;
  }
}
