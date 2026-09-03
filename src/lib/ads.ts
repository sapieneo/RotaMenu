import { createAdminClient } from '@/lib/supabase/server';

export type GuestAd = {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  durationSeconds: number;
  clickUrl: string | null;
};

type AdRow = {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  duration_seconds: number;
  click_url: string | null;
  weight: number;
};

/**
 * Bu menüde gösterilecek reklamı seçer. Reklam yoksa null → açılış ekranı
 * eskisi gibi (kapak fotoğrafı ya da marka görseli) davranır.
 *
 * NEDEN service-role: `ads` ve `ad_placements` tablolarında RLS açık ve hiç
 * politika yok — misafirin anon anahtarıyla reklam envanterini okuyabilmesini
 * istemiyoruz (hangi markanın hangi mekanda yayında olduğu ticari bilgi).
 * Seçim sunucuda yapılır, misafire yalnız seçilen tek reklam gider.
 *
 * Aynı menüde birden fazla uygun reklam varsa AĞIRLIKLI RASTGELE seçilir:
 * böylece kampanyalar ziyaretler arasında kendiliğinden dönüşümlü gösterilir
 * ve `weight` ile bir kampanyaya daha çok pay verilebilir.
 */
export async function pickAdForVenue(venueId: string): Promise<GuestAd | null> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // Bu menüye özel yerleşimler
  const { data: placements } = await admin
    .from('ad_placements')
    .select('ad_id')
    .eq('venue_id', venueId);
  const targetedIds = (placements ?? []).map((p) => p.ad_id as string);

  const base = admin
    .from('ads')
    .select('id, media_url, media_type, duration_seconds, click_url, weight')
    .eq('is_active', true)
    .or(`starts_on.is.null,starts_on.lte.${today}`)
    .or(`ends_on.is.null,ends_on.gte.${today}`);

  // "Tüm menüler" işaretli olanlar + bu menüye özel atananlar.
  const { data: rows } = targetedIds.length
    ? await base.or(`all_venues.eq.true,id.in.(${targetedIds.join(',')})`)
    : await base.eq('all_venues', true);

  const candidates = (rows ?? []) as AdRow[];
  if (candidates.length === 0) return null;

  const total = candidates.reduce((sum, a) => sum + Math.max(1, a.weight), 0);
  let ticket = Math.random() * total;
  let chosen = candidates[0];
  for (const ad of candidates) {
    ticket -= Math.max(1, ad.weight);
    if (ticket <= 0) {
      chosen = ad;
      break;
    }
  }

  return {
    id: chosen.id,
    mediaUrl: chosen.media_url,
    mediaType: chosen.media_type,
    durationSeconds: chosen.duration_seconds,
    clickUrl: chosen.click_url,
  };
}
