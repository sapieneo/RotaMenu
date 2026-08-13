import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isAdminSession } from '@/lib/admin-auth';
import { hashPanoPassword } from '@/lib/pano-auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  venueId: z.string().uuid(),
  // Boş string = pano şifresini kaldır (o venue'ye yalnız admin parolasıyla girilebilir).
  newPassword: z.string().max(200),
});

/**
 * POST /api/venue/pano-password
 * Ayarlar sayfasından işletmenin kendi pano giriş şifresini belirler,
 * değiştirir veya kaldırır (bkz. lib/pano-auth.ts). Kimlik doğrulama
 * `resolveManagedVenue` ile aynı iki yol: oturum açmış org üyesi (RLS) ya da
 * süper-admin oturumu — pano şifresinin kendisi burada hiç gerekmez, bu uç
 * nokta zaten "hesabı/yetkisi olana" açık.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz istek.' }, { status: 400 });
  }
  const { venueId, newPassword } = parsed.data;
  const trimmed = newPassword.trim();
  if (trimmed && trimmed.length < 4) {
    return NextResponse.json({ error: 'Pano şifresi en az 4 karakter olmalı.' }, { status: 400 });
  }
  const hash = trimmed ? hashPanoPassword(trimmed) : null;

  if (isAdminSession()) {
    const { data, error } = await createAdminClient()
      .from('venues')
      .update({ pano_password_hash: hash })
      .eq('id', venueId)
      .select('id')
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'Kaydedilemedi.', details: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'İşletme bulunamadı.' }, { status: 404 });
    return NextResponse.json({ ok: true, hasPanoPassword: hash !== null });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });

  const { data, error } = await supabase
    .from('venues')
    .update({ pano_password_hash: hash })
    .eq('id', venueId)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Kaydedilemedi.', details: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'İşletme bulunamadı veya yetkin yok.' }, { status: 403 });
  return NextResponse.json({ ok: true, hasPanoPassword: hash !== null });
}
