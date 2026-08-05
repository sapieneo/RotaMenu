import type { Metadata } from 'next';
import { LegalPage, Section, List } from '../_components/legal-page';

export const metadata: Metadata = {
  title: 'Kullanım Koşulları — RestaurantOS',
  description: 'RestaurantOS hizmetinin kullanım koşulları, taraf yükümlülükleri ve sorumluluk sınırları.',
};

export default function KullanimKosullariPage() {
  return (
    <LegalPage title="Kullanım Koşulları" updated="5 Ağustos 2026">
      <p>
        RestaurantOS’a kaydolarak veya hizmeti kullanarak aşağıdaki koşulları kabul etmiş
        sayılırsınız.
      </p>

      <Section title="1. Hizmetin kapsamı">
        <p>
          RestaurantOS; menü içeriklerinin dijitalleştirilmesi, alerjen ve besin bilgilerinin
          düzenlenmesi, çok dilli QR menü yayınlanması ve uyum raporu oluşturulması hizmetlerini
          sunar. Hizmet bir hukuki danışmanlık hizmeti değildir.
        </p>
      </Section>

      <Section title="2. Hesap ve sorumluluk">
        <List
          items={[
            'Hesabınızın güvenliğinden ve hesap üzerinden yapılan işlemlerden siz sorumlusunuz.',
            'Yüklediğiniz içeriklerin size ait olduğunu veya kullanım hakkına sahip olduğunuzu beyan edersiniz.',
            'Üçüncü kişilerin haklarını ihlal eden, yanıltıcı veya hukuka aykırı içerik yükleyemezsiniz.',
          ]}
        />
      </Section>

      <Section title="3. Menü bilgilerinin doğruluğu">
        <p>
          Yapay zeka; alerjen, içerik ve kalori bilgilerini <strong>öneri</strong> olarak üretir.
          Bu öneriler yalnızca işletme onayından sonra yayınlanır. Yayınlanan bilgilerin doğruluğu,
          güncelliği ve ilgili mevzuata uygunluğu işletmenin sorumluluğundadır. RestaurantOS,
          onaylanan bilgileri ve onay zamanını kayıt altına alır; ancak beyanın içeriğinden sorumlu
          değildir.
        </p>
      </Section>

      <Section title="4. Deneme süresi ve abonelik">
        <List
          items={[
            'Yeni hesaplar 14 gün boyunca tüm özellikleri ücretsiz kullanır; kredi kartı istenmez.',
            'Deneme süresi sonunda abonelik başlatılmazsa menünün yayını durur; verileriniz silinmez.',
            'Abonelik başlatıldığında menü, kaldığı yerden yayına döner.',
            'Abonelik dönem sonuna kadar geçerlidir ve istenildiği zaman iptal edilebilir.',
          ]}
        />
      </Section>

      <Section title="5. Hizmetin askıya alınması">
        <p>
          Hukuka aykırı kullanım, ödeme yükümlülüğünün yerine getirilmemesi veya sistem güvenliğini
          tehdit eden davranışlar halinde hizmet askıya alınabilir. Askıya alma durumunda menü
          verileri silinmez.
        </p>
      </Section>

      <Section title="6. Sorumluluk sınırı">
        <p>
          Hizmet “olduğu gibi” sunulur. Kesintisiz veya hatasız çalışacağı garanti edilmez.
          RestaurantOS’un toplam sorumluluğu, ilgili talebe konu olaydan önceki 12 ayda ödenen
          abonelik bedeli ile sınırlıdır.
        </p>
      </Section>

      <Section title="7. Değişiklikler ve uygulanacak hukuk">
        <p>
          Koşullar güncellenebilir; önemli değişiklikler kayıtlı e-posta adresinize bildirilir.
          Uyuşmazlıklarda Türkiye Cumhuriyeti hukuku uygulanır.
        </p>
      </Section>
    </LegalPage>
  );
}
