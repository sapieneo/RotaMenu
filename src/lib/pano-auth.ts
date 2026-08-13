/**
 * RestaurantOS — İşletmeye özel "pano" (dashboard) giriş şifresi.
 *
 * Amaç: hesabı olmayan bir işletme sahibinin kendi panosunu (istatistik,
 * yayın durumu, QR) hesap oluşturmadan, yalnızca kendisine verilen basit bir
 * şifreyle görebilmesi. Süper-admin (`ADMIN_PASSWORD`, bkz. admin-auth.ts)
 * her zaman TÜM işletmelerin panosuna girebilir — bu modül onunla
 * karıştırılmamalı, admin kontrolü ayrıca `checkAdminPassword` ile yapılır.
 *
 * Şifre veritabanında asla düz metin tutulmaz: tuzlu scrypt hash
 * (`salt:hash`, hex) olarak saklanır (bkz. venues.pano_password_hash).
 * Giriş başarılı olunca venue'ye özel, imzalı ve süreli bir httpOnly çerez
 * yazılır — imza anahtarı olarak SUPABASE_SERVICE_ROLE_KEY kullanılır
 * (zaten sunucuya özel, gizli bir değer; admin-auth.ts'nin ADMIN_PASSWORD'ü
 * kendi HMAC anahtarı olarak kullanmasıyla aynı desen).
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_PREFIX = 'ros_pano_';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün

export const PANO_SESSION_SECONDS = SESSION_MS / 1000;

function signingSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Yeni bir pano şifresi belirlenirken kullanılır — tuzlu scrypt hash üretir. */
export function hashPanoPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

/** Girilen şifreyi saklanan hash ile sabit zamanlı karşılaştırır. */
export function verifyPanoPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const derived = scryptSync(password, salt, expected.length);
    return safeEqual(derived.toString('hex'), expected.toString('hex'));
  } catch {
    return false;
  }
}

function hmac(payload: string): string {
  return createHmac('sha256', signingSecret()).update(payload).digest('hex');
}

export function panoCookieName(venueId: string): string {
  return `${COOKIE_PREFIX}${venueId}`;
}

/** Şifre doğrulaması başarılı olunca çereze yazılacak imzalı, süreli değer. */
export function createPanoSessionValue(venueId: string): string {
  const expiresAt = Date.now() + SESSION_MS;
  return `${expiresAt}.${hmac(`${venueId}.${expiresAt}`)}`;
}

/** Server Component/route içinde: bu venue için geçerli bir pano oturumu var mı? */
export function hasPanoSession(venueId: string): boolean {
  if (!signingSecret()) return false;
  const token = cookies().get(panoCookieName(venueId))?.value;
  if (!token) return false;
  const [expStr, mac] = token.split('.');
  if (!expStr || !mac) return false;
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  return safeEqual(mac, hmac(`${venueId}.${expStr}`));
}
