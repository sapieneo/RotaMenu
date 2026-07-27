import { createClient } from '@/lib/supabase/server';
import { isPhoneVerificationConfigured } from '@/lib/sms';
import { AccountCard } from './account-card';

export const dynamic = 'force-dynamic';

/**
 * Hesap ekranı — aynı zamanda "ücretsiz plan kaydı" akışıdır (Faz C): free
 * planda yayın için hesabın e-posta ile güvende olması + iletişim telefonu
 * şart (bkz. lib/plans.ts requiresVerifiedAccount). Anonim kullanıcının
 * verisi yalnız o tarayıcı oturumuna bağlıdır; çerez kaybolursa menü
 * erişilemez hale gelir — bu ekran o riski de kapatır.
 */
export default async function AccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold">Oturum bulunamadı</h1>
        <p className="text-stone-600">Önce studyoya gir, ardından ücretsiz plana kaydolabilirsin.</p>
        <a href="/studyo" className="mt-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow">
          Studyoya git
        </a>
      </main>
    );
  }

  // is_anonymous JWT claim'i; e-posta bağlanınca false olur.
  const isAnonymous = (user as { is_anonymous?: boolean }).is_anonymous ?? !user.email;

  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  let contactPhone: string | null = null;
  let contactPhoneVerifiedAt: string | null = null;
  if (membership) {
    const { data: org } = await supabase
      .from('organizations')
      .select('contact_phone, contact_phone_verified_at')
      .eq('id', membership.org_id)
      .maybeSingle();
    contactPhone = (org?.contact_phone as string | null) ?? null;
    contactPhoneVerifiedAt = (org?.contact_phone_verified_at as string | null) ?? null;
  }

  return (
    <AccountCard
      email={user.email ?? null}
      isAnonymous={isAnonymous}
      contactPhone={contactPhone}
      contactPhoneVerifiedAt={contactPhoneVerifiedAt}
      phoneVerificationConfigured={isPhoneVerificationConfigured()}
    />
  );
}
