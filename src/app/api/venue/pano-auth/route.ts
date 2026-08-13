import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { checkAdminPassword } from '@/lib/admin-auth';
import { createPanoSessionValue, panoCookieName, PANO_SESSION_SECONDS, verifyPanoPassword } from '@/lib/pano-auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  venueId: z.string().uuid(),
  password: z.string().min(1, 'Şifre gerekli.'),
});

/**
 * POST /api/venue/pano-auth
 * Hesap gerektirmeyen pano girişi: işletmenin kendi pano şifresi VEYA
 * süper-admin şifresiyle (ADMIN_PASSWORD) doğrulanır. Başarılıysa yalnızca
 * bu venue için geçerli, imzalı bir çerez yazılır (bkz. lib/pano-auth.ts).
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz istek.' }, { status: 400 });
  }
  const { venueId, password } = parsed.data;

  const admin = createAdminClient();
  const { data: venue } = await admin
    .from('venues')
    .select('id, pano_password_hash')
    .eq('id', venueId)
    .maybeSingle();

  if (!venue) {
    return NextResponse.json({ error: 'İşletme bulunamadı.' }, { status: 404 });
  }

  const ok = checkAdminPassword(password) || verifyPanoPassword(password, venue.pano_password_hash as string | null);
  if (!ok) {
    return NextResponse.json({ error: 'Şifre yanlış.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(panoCookieName(venueId), createPanoSessionValue(venueId), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: PANO_SESSION_SECONDS,
    path: '/',
  });
  return response;
}
