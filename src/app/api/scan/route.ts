import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { recordEvent, clientIp } from '@/lib/analytics';

export const runtime = 'nodejs';

/**
 * POST /api/scan — istemciden tetiklenen misafir olayları (şimdilik item_view).
 *
 * 'scan' ve 'menu_view' sunucu tarafında (/q ve /m render'ında) yazılır; onlar
 * için bu uç kullanılmaz. Burası PUBLIC olduğu için korumalar:
 *   1) venue gerçekten YAYINDA mı (yayınlanmamış venue'ya olay yazılamaz),
 *   2) ürün gerçekten o venue'nun org'una mı ait,
 *   3) ASIL koruma — DB günlük tekilliği (0011): aynı ziyaretçi+ürün+gün için
 *      tek 'item_view' satırı; mükerrer istek upsert'te sessizce yok sayılır.
 *      Serverless'te de çalışır (bellek gerektirmez).
 *   4) IP başına bellek içi kayan pencere: örnek-başına en-iyi-çaba ek fren
 *      (gereksiz DB gidiş-dönüşünü kırpar; tek başına güvenlik sınırı DEĞİL).
 */

const bodySchema = z.object({
  venueId: z.string().uuid(),
  itemId: z.string().uuid(),
  eventType: z.literal('item_view'),
  locale: z.string().max(12).nullish(),
});

// Basit bellek içi kayan pencere — örnek-başına en-iyi-çaba fren. Kalıcı
// koruma DB tekilliğidir (0011); bu yalnız sıcak örnekte gereksiz DB
// çağrılarını kısar.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) {
    // bellek koruması: penceresi dolmuş anahtarları temizle
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return list.length > MAX_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  const h = request.headers;
  if (rateLimited(clientIp(h))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const b = parsed.data;

  // Venue yayında mı + org_id ne? Service-role okuma (çağrı anonim).
  const admin = createAdminClient();
  const { data: venue } = await admin
    .from('venues')
    .select('id, org_id, is_published')
    .eq('id', b.venueId)
    .maybeSingle();
  if (!venue?.is_published) return NextResponse.json({ ok: false }, { status: 404 });

  // Ürün gerçekten bu işletmeye mi ait? Aksi halde başkasının sayaçlarına
  // olay yazılabilirdi.
  const { data: item } = await admin
    .from('items')
    .select('id, org_id')
    .eq('id', b.itemId)
    .maybeSingle();
  if (!item || item.org_id !== venue.org_id) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  await recordEvent({
    orgId: venue.org_id,
    venueId: venue.id,
    itemId: b.itemId,
    eventType: 'item_view',
    locale: b.locale ?? null,
    headers: h,
  });

  return NextResponse.json({ ok: true });
}
