import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveManagedVenue } from '@/lib/managed-venue';
import { Landing } from './_home/landing';

export const dynamic = 'force-dynamic';

/**
 * Ana sayfa. Zaten bir menüsü olan dönen kullanıcı (oturumu var + en az bir
 * kategorisi oluşmuş) pazarlama sayfasını görmez, direkt panosuna düşer.
 * Yeni ziyaretçi (oturum çerezi yok) burada anonim oturum AÇILMAZ — yalnız
 * var olan oturum kontrol edilir; normal pazarlama sayfası render edilir.
 */
export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const venue = await resolveManagedVenue(supabase);
    if (venue) {
      const { data: someCat } = await supabase
        .from('categories')
        .select('id, menus!inner(venue_id)')
        .eq('menus.venue_id', venue.id)
        .limit(1)
        .maybeSingle();
      if (someCat) redirect(`/studyo/pano?venue=${venue.id}`);
    }
  }

  return <Landing />;
}
