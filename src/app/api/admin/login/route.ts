import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_SECONDS,
  checkAdminPassword,
  createAdminSessionValue,
  isAdminPasswordConfigured,
} from '@/lib/admin-auth';

export const runtime = 'nodejs';

const bodySchema = z.object({ password: z.string().min(1) });

/**
 * POST /api/admin/login
 * Süper-admin kontrol paneli girişi. ADMIN_PASSWORD env tanımlı değilse
 * (yapılandırılmamışsa) her koşulda reddeder — varsayılan olarak kapalı.
 */
export async function POST(request: NextRequest) {
  if (!isAdminPasswordConfigured()) {
    return NextResponse.json({ error: 'Kontrol paneli yapılandırılmamış.' }, { status: 501 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Şifre gerekli.' }, { status: 400 });
  }

  if (!checkAdminPassword(parsed.data.password)) {
    // Kaba kuvveti biraz yavaşlat.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Şifre yanlış.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, createAdminSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_SECONDS,
  });
  return res;
}
