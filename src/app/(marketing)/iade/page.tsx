import type { Metadata } from 'next';
import { LegalPage, Section, List } from '../_components/legal-page';
import { PRICING } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'İptal ve İade Koşulları — RotaMenu',
  description: 'RotaMenu aboneliğini iptal etme ve iade alma koşulları.',
};

export default function IadePage() {
  return (
    <LegalPage title="İptal ve İade Koşulları" updated="5 Ağustos 2026">
      <Section title="Önce ücretsiz deneyin">
        <p>
          Ödeme yapmadan önce {PRICING.trialDays} gün boyunca tüm özellikleri ücretsiz
          kullanabilirsiniz. Deneme için kredi kartı bilgisi istemiyoruz; süre bitiminde otomatik
          ücretlendirme yapılmaz.
        </p>
      </Section>

      <Section title="İptal">
        <List
          items={[
            'Aboneliğinizi hesap panelinizden istediğiniz an, gerekçe belirtmeden iptal edebilirsiniz.',
            'İptal sonrası hizmet, ödediğiniz dönemin sonuna kadar açık kalır.',
            'Dönem sonunda yenileme yapılmaz ve karttan çekim gerçekleşmez.',
            'Menünüz, ürünleriniz ve onay kayıtlarınız silinmez; dilediğiniz zaman geri dönebilirsiniz.',
          ]}
        />
      </Section>

      <Section title="İade">
        <p>
          Dijital hizmetlerde yasal cayma hakkı bulunmamakla birlikte, hizmetten memnun
          kalmadıysanız <strong>ilk ödemenizden itibaren 14 gün içinde</strong> talep etmeniz
          halinde ücretin tamamını iade ediyoruz. Talebinizi{' '}
          <a className="text-brand-700 underline" href="mailto:destek@rotamenu.com.tr">
            destek@rotamenu.com.tr
          </a>{' '}
          adresine iletmeniz yeterlidir.
        </p>
        <p>
          İade, ödeme yaptığınız karta yapılır. Bankanıza bağlı olarak hesabınıza yansıması 3–10 iş
          günü sürebilir.
        </p>
      </Section>

      <Section title="Yenileme dönemleri">
        <p>
          Dönem başladıktan sonra kullanılmış aylar için kısmi iade yapılmaz. Yıllık abonelikte,
          ilk 14 gün dışındaki iptal taleplerinde kalan dönem için iade uygulanmaz; hizmet dönem
          sonuna kadar açık kalır.
        </p>
      </Section>
    </LegalPage>
  );
}
