import type { Metadata } from 'next';
import { LegalPage, Section, List } from '../_components/legal-page';
import { PRICING } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Mesafeli Satış Sözleşmesi — RestaurantOS',
  description: 'RestaurantOS abonelik hizmetine ilişkin mesafeli satış sözleşmesi.',
};

export default function MesafeliSatisPage() {
  return (
    <LegalPage title="Mesafeli Satış Sözleşmesi" updated="5 Ağustos 2026">
      <Section title="1. Taraflar">
        <p>
          <strong>Satıcı:</strong> RestaurantOS —{' '}
          <a className="text-brand-700 underline" href="mailto:destek@restaurantos.com.tr">
            destek@restaurantos.com.tr
          </a>
          <br />
          <strong>Alıcı:</strong> Abonelik işlemini gerçekleştiren işletme / hesap sahibi.
        </p>
      </Section>

      <Section title="2. Sözleşmenin konusu">
        <p>
          İşbu sözleşme, Alıcı’nın RestaurantOS internet sitesi üzerinden elektronik ortamda
          sipariş verdiği dijital menü ve uyum yönetimi abonelik hizmetinin satışı ve ifasına
          ilişkin tarafların hak ve yükümlülüklerini düzenler. 6502 sayılı Tüketicinin Korunması
          Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri uygulanır.
        </p>
      </Section>

      <Section title="3. Hizmet ve bedel">
        <List
          items={[
            `Aylık abonelik: ${PRICING.monthly} ₺ (KDV dahil), her ay otomatik yenilenir.`,
            `Yıllık abonelik: ${PRICING.yearly.toLocaleString('tr-TR')} ₺ (KDV dahil), her yıl otomatik yenilenir.`,
            `Abonelik öncesi ${PRICING.trialDays} günlük ücretsiz deneme sunulur; deneme süresinde ödeme alınmaz.`,
            'Kurulum ücreti veya gizli maliyet bulunmamaktadır.',
          ]}
        />
      </Section>

      <Section title="4. Ödeme">
        <p>
          Ödemeler, lisanslı ödeme kuruluşu iyzico altyapısı üzerinden kredi/banka kartı ile
          alınır. Kart bilgileri RestaurantOS tarafından görülmez ve saklanmaz.
        </p>
      </Section>

      <Section title="5. İfa">
        <p>
          Hizmet dijitaldir ve ödemenin onaylanmasının ardından <strong>anında</strong> kullanıma
          açılır. Ayrı bir teslimat süreci yoktur.
        </p>
      </Section>

      <Section title="6. Cayma hakkı">
        <p>
          Mesafeli Sözleşmeler Yönetmeliği m.15/1-(ğ) uyarınca, elektronik ortamda anında ifa
          edilen hizmetlerde cayma hakkı bulunmamaktadır. Bununla birlikte RestaurantOS,
          aboneliğinizin ilk 14 günü içinde talep etmeniz halinde koşulsuz iade uygular; ayrıntı
          için iptal ve iade sayfasına bakınız.
        </p>
      </Section>

      <Section title="7. İptal">
        <p>
          Abonelik hesap panelinden istenildiği an iptal edilebilir. İptal halinde hizmet, ödenmiş
          dönemin sonuna kadar devam eder ve sonrasında yenilenmez. Menü verileri silinmez.
        </p>
      </Section>

      <Section title="8. Uyuşmazlık">
        <p>
          Uyuşmazlıklarda Alıcı’nın yerleşim yerindeki Tüketici Hakem Heyetleri ve Tüketici
          Mahkemeleri yetkilidir.
        </p>
      </Section>
    </LegalPage>
  );
}
