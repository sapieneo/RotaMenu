import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveManagedVenue } from '@/lib/managed-venue';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Giriş yap — RotaMenu',
  description: 'E-posta adresine giriş bağlantısı gönderelim; menüne kaldığın yerden devam et.',
  robots: { index: false, follow: false },
};

/**
 * /giris — kayıtlı kullanıcının hesabına DÖNMESİ için tek yol.
 *
 * NEDEN VAR: Bu sayfa yokken kullanıcı çerezini silince ya da başka bir
 * cihaza geçince `/studyo` ona sessizce YENİ bir anonim hesap + boş işletme
 * açıyordu; menüsü duruyor ama kullanıcı onu kaybetmiş sanıyordu. Ödemeli bir
 * SaaS'ta bu kabul edilemez.
 *
 * Şifre yok: Supabase `signInWithOtp` ile tek kullanımlık giriş bağlantısı
 * (magic link) gönderilir, `/auth/callback` oturumu kurar. `shouldCreateUser`
 * false — bu sayfa YENİ hesap açmaz, kayıt akışı `/studyo`'dadır.
 */
export default async function LoginPage() {
  // Zaten giriş yapmış KAYITLI üye buraya düşerse formu göstermenin anlamı
  // yok — istediği şey menüsü. Ana sayfadan kaldırılan otomatik yönlendirme
  // buraya taşındı: artık sıçrama yalnızca kullanıcı "Giriş yap"a BASTIĞINDA
  // oluyor, kendiliğinden değil.
  //
  // Anonim oturum kasten hariç: menüsü olsa bile o kişi henüz üye değil ve
  // buraya gelmişse büyük ihtimalle BAŞKA (kayıtlı) bir hesaba ulaşmak
  // istiyor — ona formu göstermeliyiz.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && !user.is_anonymous && user.email) {
    const venue = await resolveManagedVenue(supabase);
    if (venue) redirect(`/studyo/pano?venue=${venue.id}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div>
        <a href="/" className="text-lg font-bold tracking-tight text-stone-900">
          Rota<span className="text-brand-600">Menu</span>
        </a>
        <h1 className="mt-6 text-2xl font-bold text-stone-900">Giriş yap</h1>
        <p className="mt-1 text-sm text-stone-500">
          Kayıtlı e-postanı yaz; sana tek kullanımlık bir giriş bağlantısı gönderelim. Şifre
          gerekmez.
        </p>
      </div>

      <LoginForm />

      <p className="text-sm text-stone-500">
        Henüz menün yok mu?{' '}
        <a href="/studyo" className="font-semibold text-brand-700 hover:underline">
          Ücretsiz dene
        </a>
      </p>
    </main>
  );
}
