import { createClient } from '@/lib/supabase/server';
import { resolveManagedVenue } from '@/lib/managed-venue';
import { Landing } from './_home/landing';

export const dynamic = 'force-dynamic';

/**
 * Ana sayfa — HERKESE pazarlama sayfası gösterilir.
 *
 * Eskiden menüsü olan kullanıcı buradan otomatik olarak panosuna
 * YÖNLENDİRİLİYORDU. Kaldırıldı: sitenin ana adresini yazan kişi ürünü
 * görmek istiyor olabilir (kendi müşterisine göstermek, fiyata bakmak,
 * paylaşmak). Oturumu var diye pazarlama sayfasını hiç görememek yanlıştı.
 *
 * Panoya geçiş artık AÇIK bir eylem: üst çubuktaki düğme. Kayıtlı üye
 * "Panoya git", diğerleri "Giriş yap" görür — otomatik sıçrama yok.
 */
export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let dashboardHref: string | null = null;
  // Yalnız KAYITLI üyeye kısayol gösterilir. Anonim oturumun sahibi henüz
  // "üye" değil; ona kayıt akışı ("Ücretsiz dene") daha doğru hedef.
  if (user && !user.is_anonymous && user.email) {
    const venue = await resolveManagedVenue(supabase);
    if (venue) dashboardHref = `/studyo/pano?venue=${venue.id}`;
  }

  return <Landing dashboardHref={dashboardHref} />;
}
