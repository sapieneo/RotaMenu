import { createAdminClient } from '@/lib/supabase/server';

/**
 * Kalıcı (veritabanı destekli) deneme sınırlayıcı.
 *
 * NEDEN bellek-içi Map değil: Netlify'da her istek ayrı bir lambda örneğinde
 * çalışabiliyor ve soğuk başlangıçta bellek sıfırlanıyor. `/api/scan` ve
 * `/api/setup-request` içindeki `Map` tabanlı sınırlar bu yüzden pratikte hiç
 * çalışmıyordu. Sayaç Postgres'te tutulunca örnekler arasında paylaşılıyor.
 *
 * Sayaç yalnız service_role tarafından çağrılabilen bir SECURITY DEFINER
 * fonksiyonda; istemci ne okuyabiliyor ne sıfırlayabiliyor.
 */
export async function registerAttempt(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; attempts: number }> {
  try {
    const { data, error } = await createAdminClient()
      .rpc('register_auth_attempt', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds })
      .maybeSingle();
    if (error || !data) {
      // Sayaç çalışmıyorsa isteği ENGELLEME — kimlik doğrulamanın kendisi hâlâ
      // yerinde. Fail-open bilinçli: veritabanı hıçkırığı yüzünden herkesi
      // kilitlemek, kaba kuvvet riskinden daha büyük bir kesinti olurdu.
      console.error('[auth-throttle] sayaç çalışmadı', { key, message: error?.message });
      return { allowed: true, attempts: 0 };
    }
    const row = data as { allowed: boolean; attempts: number };
    return { allowed: row.allowed, attempts: row.attempts };
  } catch (err) {
    console.error('[auth-throttle] beklenmeyen hata', {
      key,
      message: err instanceof Error ? err.message : String(err),
    });
    return { allowed: true, attempts: 0 };
  }
}

/** İstek sahibinin IP'si — Netlify/Vercel proxy başlıklarından. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-nf-client-connection-ip') ?? headers.get('x-forwarded-for');
  return (forwarded ?? '').split(',')[0].trim() || 'unknown';
}
