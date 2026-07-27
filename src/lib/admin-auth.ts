/**
 * RestaurantOS — Süper-admin kontrol paneli kimlik doğrulaması.
 *
 * Bilinçli olarak Supabase auth'tan AYRI ve BASİT tutuldu: tek bir işletme
 * sahibi (biz) tüm kiracıları görebileceği bir ekrana giriyor, kullanıcı
 * yönetimi/roller gerekmiyor. Tek paylaşılan şifre (`ADMIN_PASSWORD`) +
 * imzalı, süreli bir httpOnly çerez.
 *
 * Çerez sahte üretilemez: değeri `expiresAt.hmac` biçiminde, hmac
 * ADMIN_PASSWORD ile HMAC-SHA256 imzalanır. Şifre bilinmeden geçerli bir
 * imza üretilemez; süresi dolan çerez otomatik geçersiz sayılır.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE_NAME = 'ros_admin';
const SESSION_MS = 12 * 60 * 60 * 1000; // 12 saat

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_SESSION_SECONDS = SESSION_MS / 1000;

export function isAdminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Girilen şifreyi ADMIN_PASSWORD ile sabit-zamanlı karşılaştırır. */
export function checkAdminPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(candidate, expected);
}

function hmac(payload: string): string {
  return createHmac('sha256', process.env.ADMIN_PASSWORD!).update(payload).digest('hex');
}

/** Yeni bir oturum çerez değeri üretir (giriş başarılı olunca kullanılır). */
export function createAdminSessionValue(): string {
  const expiresAt = Date.now() + SESSION_MS;
  return `${expiresAt}.${hmac(String(expiresAt))}`;
}

function verifySessionValue(token: string | undefined): boolean {
  if (!token || !isAdminPasswordConfigured()) return false;
  const [expStr, mac] = token.split('.');
  if (!expStr || !mac) return false;
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  return safeEqual(mac, hmac(expStr));
}

/** Server Component/route içinde: geçerli bir admin oturumu var mı? */
export function isAdminSession(): boolean {
  return verifySessionValue(cookies().get(COOKIE_NAME)?.value);
}

/** Server Component guard'ı — oturum yoksa /admin'e (girişe) yönlendirir. */
export function requireAdmin(): void {
  if (!isAdminSession()) redirect('/admin');
}
