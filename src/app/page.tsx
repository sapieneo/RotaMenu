import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveManagedVenue } from '@/lib/managed-venue';

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

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-700">
        RestaurantOS
      </span>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Menünün fotoğrafını çek,
        <br />
        <span className="text-brand-600">5 dakikada QR menün yayında.</span>
      </h1>
      <p className="max-w-md text-lg text-stone-600">
        Yapay zeka menünü çıkarır, alerjen ve kalori bilgisini önerir; sen
        onaylarsın. Yönetmeliğe uyumlu, çok dilli, ışık hızında.
      </p>
      <Link
        href="/studyo"
        className="rounded-xl bg-brand-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-brand-700"
      >
        Menünü Ücretsiz Oluştur
      </Link>
      <p className="text-sm text-stone-400">Kayıt gerekmez — önce dene, beğenirsen kaydol.</p>
    </main>
  );
}
