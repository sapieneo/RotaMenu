import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const bodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(30),
});

/**
 * POST /api/setup-request
 *
 * "Menünüzü biz kuralım" formu — herkese açık. Kayıt gerektirmez; yalnız
 * işletme adı ve telefon alır, süper-admin panelinden takip edilir.
 *
 * Kötüye kullanıma karşı: IP başına dakikada 5 istek (bellek içi, en-iyi-çaba).
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits: Map<string, number[]> =
  ((globalThis as Record<string, unknown>).__setupReqHits as Map<string, number[]>) ??
  ((globalThis as Record<string, unknown>).__setupReqHits = new Map());

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > MAX_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-nf-client-connection-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Çok fazla istek. Biraz sonra deneyin.' }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'İşletme adı ve telefon gerekli.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('setup_requests').insert({
    business_name: parsed.data.name,
    phone: parsed.data.phone,
  });
  if (error) {
    return NextResponse.json({ error: 'Kaydedilemedi, lütfen tekrar deneyin.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
