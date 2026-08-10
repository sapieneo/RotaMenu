import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Giriş yap — RestaurantOS',
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
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div>
        <a href="/" className="text-lg font-bold tracking-tight text-stone-900">
          Restaurant<span className="text-brand-600">OS</span>
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
