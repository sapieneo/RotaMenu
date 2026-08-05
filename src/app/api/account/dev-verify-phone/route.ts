import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isPhoneVerificationConfigured } from '@/lib/sms';
import { isAdminSession } from '@/lib/admin-auth';
import { resolveManagedVenue } from '@/lib/managed-venue';
import { z } from 'zod';

export const runtime = 'nodejs';

/**
 * POST /api/account/dev-verify-phone
 *
 * ⚠️ GEÇİCİ / YALNIZ GELİŞTİRME. Gerçek SMS OTP akışı kurulana kadar kayıtlı
 * telefonu kod göndermeden "doğrulanmış" (`contact_phone_verified_at`)
 * işaretler.
 *
 * GÜVENLİK KİLİDİ: `SMS_PROVIDER_API_KEY` env eklenince
 * (`isPhoneVerificationConfigured()` true) bu uç otomatik 403 döner.
 *
 * KALDIRMA (gerçek SMS entegrasyonu eklenince): bu dosyayı ve
 * account-card.tsx içindeki bypass düğmesini sil; yerine gerçek OTP
 * gönder/doğrula akışı (iki adımlı) eklenir.
 */
const bodySchema = z.object({ venueId: z.string().uuid().nullable().optional() });

export async function POST(request: Request) {
  if (isPhoneVerificationConfigured()) {
    return NextResponse.json({ error: 'SMS doğrulama aktif; bypass kapalı.' }, { status: 403 });
  }
  // İKİNCİ KİLİT: yalnız süper-admin oturumu — normal kullanıcı kendi
  // telefonunu doğrulanmış gösteremesin.
  if (!isAdminSession()) {
    return NextResponse.json({ error: 'Bu işlem için yetkin yok.' }, { status: 403 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz işletme seçimi.' }, { status: 400 });
  const venue = await resolveManagedVenue(supabase, parsed.data.venueId);
  if (!venue) {
    return NextResponse.json({ error: 'İşletme bulunamadı.' }, { status: 404 });
  }
  const admin = createAdminClient();

  const { data: org } = await admin
    .from('organizations')
    .select('contact_phone')
    .eq('id', venue.org_id)
    .maybeSingle();
  if (!org?.contact_phone) {
    return NextResponse.json({ error: 'Önce bir telefon numarası ekle.' }, { status: 400 });
  }

  const { error } = await admin
    .from('organizations')
    .update({ contact_phone_verified_at: new Date().toISOString() })
    .eq('id', venue.org_id);
  if (error) {
    return NextResponse.json({ error: 'Doğrulanamadı.', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
