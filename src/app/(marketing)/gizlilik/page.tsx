import type { Metadata } from 'next';
import { LegalPage, Section, List } from '../_components/legal-page';

export const metadata: Metadata = {
  title: 'Gizlilik Politikası ve KVKK Aydınlatma Metni — RotaMenu',
  description:
    'RotaMenu kişisel verilerinizi nasıl işler, saklar ve korur. KVKK kapsamındaki haklarınız.',
};

export default function GizlilikPage() {
  return (
    <LegalPage title="Gizlilik Politikası ve KVKK Aydınlatma Metni" updated="5 Ağustos 2026">
      <p>
        Bu metin, RotaMenu hizmetini kullanan işletmelerin ve menülerini görüntüleyen
        misafirlerin kişisel verilerinin 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK)
        kapsamında nasıl işlendiğini açıklar.
      </p>

      <Section title="1. Veri sorumlusu">
        <p>
          Hizmet kapsamında toplanan veriler bakımından veri sorumlusu RotaMenu’dür. İletişim:{' '}
          <a className="text-brand-700 underline" href="mailto:destek@rotamenu.com.tr">
            destek@rotamenu.com.tr
          </a>
        </p>
      </Section>

      <Section title="2. İşlenen kişisel veriler">
        <p>İşletme hesabı sahiplerine ait olarak:</p>
        <List
          items={[
            'Kimlik ve iletişim bilgisi: e-posta adresi, iletişim telefonu, işletme adı',
            'İşlem güvenliği: oturum bilgileri, IP adresi, tarayıcı bilgisi',
            'Müşteri işlem: abonelik durumu, ödeme sağlayıcısından dönen işlem referansları',
            'İçerik verisi: yüklediğiniz menü görselleri ve menü içerikleri',
          ]}
        />
        <p>
          Menüyü görüntüleyen misafirlere ait olarak: <strong>doğrudan kimlik verisi
          toplanmaz.</strong> Ziyaret istatistikleri, her gün yeniden üretilen ve hiçbir yerde
          saklanmayan bir gizli anahtarla üretilmiş, geri döndürülemez bir oturum kısaltması
          üzerinden tutulur. Bu yöntem kişiyi tanımlamaya elverişli değildir ve çerez
          kullanılmadığı için ayrıca çerez izni alınmasını gerektirmez.
        </p>
      </Section>

      <Section title="3. İşleme amaçları">
        <List
          items={[
            'Hizmetin sunulması: menü oluşturma, yayınlama, QR kod üretimi',
            'Yasal yükümlülüklerin yerine getirilmesi ve uyum kayıtlarının tutulması',
            'Abonelik ve faturalandırma süreçlerinin yürütülmesi',
            'Hizmet güvenliğinin sağlanması ve kötüye kullanımın önlenmesi',
            'Talep etmeniz halinde kurulum desteği için sizinle iletişime geçilmesi',
          ]}
        />
      </Section>

      <Section title="4. Hukuki sebepler">
        <p>
          Veriler; sözleşmenin kurulması ve ifası, veri sorumlusunun hukuki yükümlülüğünü yerine
          getirmesi ve meşru menfaat hukuki sebeplerine dayanılarak işlenir. Kurulum desteği talep
          formunda verdiğiniz iletişim bilgileri açık rızanıza dayanır.
        </p>
      </Section>

      <Section title="5. Aktarım">
        <p>
          Veriler; barındırma (Netlify), veritabanı ve kimlik doğrulama (Supabase), yapay zeka
          işleme (OpenAI), görsel üretimi (Runware) ve ödeme (iyzico) hizmet sağlayıcılarıyla
          hizmetin gerektirdiği ölçüde paylaşılır. Menü içerikleri yapay zeka sağlayıcısına
          model eğitiminde kullanılmayacak şekilde iletilir.
        </p>
      </Section>

      <Section title="6. Saklama süresi">
        <p>
          Hesabınız aktif olduğu sürece ve ilgili mevzuatın öngördüğü zamanaşımı süreleri boyunca
          saklanır. Hesabınızı kapatmak istediğinizde verilerinizin silinmesini talep edebilirsiniz.
        </p>
      </Section>

      <Section title="7. KVKK kapsamındaki haklarınız">
        <p>KVKK m.11 uyarınca; kişisel verilerinizin işlenip işlenmediğini öğrenme, bilgi talep
        etme, düzeltilmesini veya silinmesini isteme, işlemeye itiraz etme ve zararın giderilmesini
        talep etme haklarına sahipsiniz. Taleplerinizi yukarıdaki e-posta adresine iletebilirsiniz.</p>
      </Section>

      <Section title="8. Menü içeriğinin doğruluğu">
        <p>
          Alerjen, kalori ve içerik bilgileri yapay zeka tarafından önerilir ancak yalnızca
          işletmenin onayından sonra yayınlanır. Bu bilgilerin doğruluğundan ilgili mevzuat
          uyarınca işletme sorumludur. RotaMenu, onay kayıtlarını tutar ve talep halinde
          işletmeye sunar.
        </p>
      </Section>
    </LegalPage>
  );
}
