import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isAdminSession } from '@/lib/admin-auth';
import { hashPanoPassword } from '@/lib/pano-auth';

export const runtime = 'nodejs';

const EDITOR_ROLES = ['owner', 'admin', 'editor'];

const bodySchema = z.object({
  venueId: z.string().uuid(),
  // Boş string = pano şifresini kaldır (o venue'ye yalnız hesapla girilebilir).
  newPassword: z.string().max(200),
});

/**
 * POST /api/venue/pano-password
 * İşletmenin pano giriş şifresini belirler, değiştirir veya kaldırır.
 *
 * DEĞİŞTİ:
 *  • Hash artık `venues` tablosunda DEĞİL, `venue_pano_secrets` içinde.
 *    venues'teki her sütun yayındaki işletmeler için anon anahtarla
 *    okunabiliyordu; şifre hash'inin orada durması sözlük saldırısına davetti.
 *    Yeni tabloda RLS açık ve politika yok → yalnız service_role erişir.
 *  • Bu yüzden yazma da service-role ile yapılıyor; org üyeliği artık RLS'e
 *    bırakılmadan BURADA açıkça doğrulanıyor.
 *  • Minimum uzunluk 4 → 8. 4 karakterlik bir şifre çevrimiçi denemeyle
 *    pratikte anında kırılıyor.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz istek.' }, { status: 400 });
  }
  const { venueId, newPassword } = parsed.data;
  const trimmed = newPassword.trim();
  if (trimmed && trimmed.length < 8) {
    return NextResponse.json({ error: 'Pano şifresi en az 8 karakter olmalı.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Yetki: süper-admin oturumu ya da org editörü.
  if (!isAdminSession()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });

    const { data: venue } = await admin.from('venues').select('org_id').eq('id', venueId).maybeSingle();
    if (!venue) return NextResponse.json({ error: 'İşletme bulunamadı.' }, { status: 404 });

    const { data: membership } = await admin
      .from('organization_members')
      .select('role')
      .eq('org_id', venue.org_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership || !EDITOR_ROLES.includes(membership.role)) {
      return NextResponse.json({ error: 'Bu işlem için yetkin yok.' }, { status: 403 });
    }
  }

  if (!trimmed) {
    const { error } = await admin.from('venue_pano_secrets').delete().eq('venue_id', venueId);
    if (error) {
      console.error('[api/venue/pano-password] delete failed', { venueId, message: error.message });
      return NextResponse.json({ error: 'Kaydedilemedi.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, hasPanoPassword: false });
  }

  const { error } = await admin
    .from('venue_pano_secrets')
    .upsert(
      { venue_id: venueId, password_hash: hashPanoPassword(trimmed), updated_at: new Date().toISOString() },
      { onConflict: 'venue_id' }
    );
  if (error) {
    console.error('[api/venue/pano-password] upsert failed', { venueId, message: error.message });
    return NextResponse.json({ error: 'Kaydedilemedi.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, hasPanoPassword: true });
}
