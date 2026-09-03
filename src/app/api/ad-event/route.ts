import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const bodySchema = z.object({
  adId: z.string().uuid(),
  venueId: z.string().uuid().nullish(),
  kind: z.enum(['impression', 'click']),
});

/**
 * POST /api/ad-event — reklam gösterimi / tıklaması.
 *
 * Misafir tarafından çağrılır, oturum gerekmez: bu bir ölçüm ucu, veri
 * OKUMUYOR. `ad_events` tablosunda RLS açık ve politika yok, dolayısıyla
 * yazma yalnız buradan (service_role) yapılabiliyor.
 *
 * Gövde doğrulanıyor ve reklamın gerçekten var olduğu kontrol ediliyor —
 * aksi halde uydurma kimliklerle tablo şişirilebilirdi. Gösterim sayısı
 * ticari bir rakam olduğu için doğruluğu önemli.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  const { adId, venueId, kind } = parsed.data;

  const admin = createAdminClient();
  const { data: ad } = await admin.from('ads').select('id').eq('id', adId).maybeSingle();
  if (!ad) return NextResponse.json({ error: 'Reklam bulunamadı.' }, { status: 404 });

  const { error } = await admin
    .from('ad_events')
    .insert({ ad_id: adId, venue_id: venueId ?? null, kind });
  if (error) {
    console.error('[api/ad-event] insert failed', { adId, kind, message: error.message });
    // Ölçüm yazılamadıysa misafire hata göstermenin anlamı yok.
    return NextResponse.json({ ok: false }, { status: 202 });
  }
  return NextResponse.json({ ok: true });
}
