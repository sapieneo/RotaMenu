import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import {
  createPanoSessionValue,
  panoCookieName,
  PANO_SESSION_SECONDS,
  verifyPanoPassword,
} from '@/lib/pano-auth';
import { clientIp, registerAttempt } from '@/lib/auth-throttle';

export const runtime = 'nodejs';

const bodySchema = z.object({
  venueId: z.string().uuid(),
  password: z.string().min(1).max(200),
});

/**
 * POST /api/venue/pano-auth
 * İşletmeye özel pano şifresiyle giriş; başarılıysa `ros_pano_<venueId>`
 * çerezi verilir (bkz. lib/pano-auth.ts).
 *
 * DEĞİŞTİ — burada ARTIK `checkAdminPassword` KABUL EDİLMİYOR.
 * Eskiden `checkAdminPassword(password) || verifyPanoPassword(...)` idi ve bu
 * üç şeyi birleştirince ciddi bir açık oluyordu: uç tamamen public, hız sınırı
 * yok, ve global ADMIN_PASSWORD'ü de kabul ediyor. Yani /admin/login'i hiç
 * dövmeden, buraya sınırsız istek atarak süper-admin parolası kaba kuvvetle
 * bulunabiliyordu — bulunduğunda tüm kiracıların verisi, işletme silme ve
 * platform geneli yazma açılıyordu. Süper-admin'in panoya erişimi için bu
 * kapıya ihtiyacı yok: `isAdminSession()` zaten her yerde tanınıyor
 * (bkz. lib/managed-venue.ts, lib/image-access.ts).
 *
 * Ayrıca kalıcı hız sınırı eklendi (IP + venue başına).
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  const { venueId, password } = parsed.data;

  const ip = clientIp(request.headers);
  const gate = await registerAttempt(`pano:${venueId}:${ip}`, 10, 600);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'Çok fazla hatalı deneme. Birkaç dakika sonra tekrar dene.' },
      { status: 429 }
    );
  }

  const admin = createAdminClient();
  const { data: secret } = await admin
    .from('venue_pano_secrets')
    .select('password_hash')
    .eq('venue_id', venueId)
    .maybeSingle();

  if (!secret?.password_hash) {
    // Şifre tanımlı değil — hangi işletmede şifre olduğunu sızdırmamak için
    // "bulunamadı" değil, doğrudan yanlış şifre yanıtı dönüyoruz.
    return NextResponse.json({ error: 'Şifre yanlış.' }, { status: 401 });
  }

  if (!verifyPanoPassword(password, secret.password_hash as string)) {
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
