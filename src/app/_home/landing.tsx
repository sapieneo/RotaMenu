import Link from 'next/link';
import { PhoneFrame, PhoneScaledContent } from '@/components/phone-frame';
import {
  MarketingHeader,
  MarketingFooter,
  WhatsAppButton,
} from '@/app/(marketing)/_components/marketing-chrome';
import { Icon, type IconName } from '@/components/ui/icon';
import { SetupRequestForm } from './setup-request-form';

/** Landing page'den gösterilen örnek menü. */
const DEMO_SLUG = 'demo';

/**
 * Pazarlama ana sayfası.
 *
 * Konumlandırma: yönetmelik uyumu birincil, hız/çok dillilik/tasarım ikincil.
 * Rakiplerden ayrışma noktası "AI önerir → işletme onaylar → denetim dosyası"
 * akışıdır; sayfa boyunca bu vurgulanır.
 *
 * GÖRSEL SİSTEM (apple-design + apple-ui-design):
 *  · Renkler anlamsal token'lardan gelir (`surface`, `content`, `line`) —
 *    `bg-white`/`text-stone-900` YASAK, koyu modda görünmez olurlar.
 *  · Tipografi tailwind.config'teki ölçekten (`text-hero`, `text-title`…);
 *    tracking her boyuta özel olarak orada tanımlı.
 *  · Bölümler 1px çizgiyle DEĞİL boşlukla ayrılır (48/96px ritmi) — Apple
 *    ayırıcı çizgi yerine nefes kullanır. Yüzey değişimi gerektiği yerde
 *    `bg-surface-sunken` ile yapılır.
 *  · Her bölümde TEK birincil eylem. İkincil eylem sessiz kalır.
 *  · Renkli gölge / parlama yok.
 */
export function Landing({ dashboardHref = null }: { dashboardHref?: string | null }) {
  return (
    <>
      <MarketingHeader dashboardHref={dashboardHref} />
      <main>
        <Hero />
        <TrustBar />
        <RegulationTimeline />
        <HowItWorks />
        <AuditFile />
        <Features />
        {/* AJANS MODU: fiyatlandırma bölümü kaldırıldı — bu kurulum dışarıya
            satılan bir SaaS değil, ajansın kendi müşterileri için menü ürettiği
            kapalı bir ortam. Paket/deneme anlatmak yanıltıcı olurdu. */}
        <Faq />
        <FinalCta />
      </main>
      <MarketingFooter />
      <WhatsAppButton />
    </>
  );
}

/* ------------------------------------------------------------------ */

/** Bölüm sarmalayıcı — dikey ritmi tek yerden yönetir. */
function Section({
  id,
  tone = 'plain',
  children,
  className = '',
}: {
  id?: string;
  tone?: 'plain' | 'sunken';
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`${id ? 'scroll-mt-20 ' : ''}${
        tone === 'sunken' ? 'bg-surface-sunken' : 'bg-surface'
      } py-xl lg:py-2xl ${className}`}
    >
      {children}
    </section>
  );
}

/** Bölüm üstü küçük etiket + başlık — her yerde aynı hiyerarşi. */
function SectionHead({
  eyebrow,
  title,
  lead,
  center = false,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? 'text-center' : ''}>
      {eyebrow && (
        <p className="text-footnote font-semibold text-brand-600">{eyebrow}</p>
      )}
      <h2 className="mt-sm text-heading font-semibold text-content sm:text-title">{title}</h2>
      {lead && (
        <p
          className={`mt-md max-w-prose text-body text-content-secondary ${center ? 'mx-auto' : ''}`}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

/** Birincil eylem — sayfada bölüm başına EN FAZLA bir tane. */
function PrimaryCta({ children, href = '/studyo' }: { children: React.ReactNode; href?: string }) {
  return (
    <Link
      href={href}
      className="ros-pressable inline-flex min-h-touch items-center justify-center rounded-pill bg-brand-600 px-lg text-body font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]"
    >
      {children}
    </Link>
  );
}

function Hero() {
  return (
    <Section className="overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-xl px-md lg:grid-cols-[1.1fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-sm rounded-pill bg-amber-100 px-md py-xs text-caption font-semibold text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            31 Aralık 2026 · alerjen bildirimi zorunlu
          </span>

          <h1 className="mt-md text-title font-semibold text-content sm:text-hero">
            Menünüzün fotoğrafını çekin,
            <br />
            <span className="text-brand-600">yönetmeliğe uyumlu QR menünüz hazır.</span>
          </h1>

          <p className="mt-md max-w-prose text-lead text-content-secondary">
            Yapay zeka menünüzü okur; alerjen, kalori ve içerik bilgisini önerir.{' '}
            <strong className="font-semibold text-content">Siz onaylarsınız</strong> — ve
            denetimde gösterebileceğiniz uyum dosyanız hazır olur.
          </p>

          {/* TEK birincil eylem. "Örnek menüyü gör" eskiden eşit ağırlıkta bir
              kutuydu ve birincil eylemle yarışıyordu; artık sessiz bir bağlantı. */}
          <div className="mt-lg flex flex-wrap items-center gap-md">
            <PrimaryCta>Menüni oluştur</PrimaryCta>
            <a
              href={`/m/${DEMO_SLUG}`}
              target="_blank"
              rel="noreferrer"
              className="ros-pressable inline-flex min-h-touch items-center gap-xs rounded-pill px-md text-body font-medium text-content-secondary transition hover:text-content active:scale-[0.98]"
            >
              Örnek menüyü gör
              <Icon name="arrow-right" size={18} />
            </a>
          </div>

          <p className="mt-md text-footnote text-content-muted">
            Menü fotoğrafından tam menüye · Alerjen ve kalori önerisi · QR kod hazır
          </p>
        </div>

        <PhoneMockup />
      </div>
    </Section>
  );
}

/**
 * Gerçek telefon çerçevesi + örnek menünün canlı iframe'i — pano'daki
 * "Canlı önizleme" ile birebir aynı bileşen/boyut.
 *
 * iframe yüklenene kadar (ölçülen: ~2 sn) çerçeve bembeyaz kalıyordu ve ilk
 * izlenimi bozuyordu. Artık arkada sabit bir iskelet duruyor; iframe onun
 * ÜSTÜNE yükleniyor, boş beyazlık görünmüyor.
 */
function PhoneMockup() {
  return (
    <div className="mx-auto">
      <PhoneFrame>
        <PhoneScaledContent>
          <div className="relative h-full w-full bg-surface-sunken">
            <div aria-hidden className="absolute inset-0 animate-pulse p-3">
              <div className="h-24 w-full rounded-lg bg-line" />
              <div className="mt-3 h-4 w-2/3 rounded bg-line" />
              <div className="mt-2 h-3 w-1/2 rounded bg-line" />
              <div className="mt-4 space-y-2">
                <div className="h-12 w-full rounded-lg bg-line" />
                <div className="h-12 w-full rounded-lg bg-line" />
                <div className="h-12 w-full rounded-lg bg-line" />
              </div>
            </div>
            <iframe
              src={`/m/${DEMO_SLUG}`}
              title="Örnek menü önizleme"
              loading="eager"
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        </PhoneScaledContent>
      </PhoneFrame>
    </div>
  );
}

function TrustBar() {
  const points: { icon: IconName; label: string }[] = [
    { icon: 'clock', label: '5 dakikada kurulum' },
    { icon: 'globe', label: '10+ dile otomatik çeviri' },
    { icon: 'shield', label: 'Denetime hazır uyum dosyası' },
    { icon: 'lock', label: 'Çerezsiz analitik · KVKK dostu' },
  ];
  return (
    <section className="bg-surface-sunken py-lg">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-md px-md lg:grid-cols-4">
        {points.map((p) => (
          <div key={p.label} className="flex items-center gap-sm">
            <Icon name={p.icon} className="shrink-0 text-brand-600" />
            <span className="text-footnote font-medium text-content-secondary">{p.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RegulationTimeline() {
  const rows = [
    {
      date: '1 Temmuz 2026',
      who: 'Ulusal zincir işletmeler',
      what: 'İçerik + enerji bilgisi',
      status: 'yururlukte' as const,
    },
    {
      date: '31 Aralık 2026',
      who: 'Aynı ilde 3+ şubesi olanlar ve standart işletmeler',
      what: 'Alerjen ve içerik bilgisi',
      status: 'yakin' as const,
    },
    {
      date: '31 Aralık 2027',
      who: 'Diğer tüm işletmeler',
      what: 'Enerji (kalori) bilgisi',
      status: 'ileri' as const,
    },
  ];

  return (
    <Section id="yonetmelik">
      <div className="mx-auto max-w-6xl px-md">
        <SectionHead
          eyebrow="Yönetmelik"
          title="Menünüzde alerjen ve kalori bilgisi artık zorunlu"
          lead="Tarım ve Orman Bakanlığı düzenlemesiyle işletmeler; 14 majör alerjen, alkol ve domuz türevi bileşen ile enerji bilgisini misafire sunmak zorunda. Karekod (QR) bu bilgiyi sunmanın yönetmelikçe kabul edilen yollarından biri."
        />

        <div className="mt-lg overflow-hidden rounded-card border border-line">
          {rows.map((r, i) => (
            <div
              key={r.date}
              className={`flex flex-wrap items-center gap-x-lg gap-y-sm px-md py-md ${
                i > 0 ? 'border-t border-line' : ''
              } ${r.status === 'yakin' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-surface-raised'}`}
            >
              <div className="w-36 shrink-0 font-semibold text-content">{r.date}</div>
              <div className="min-w-[200px] flex-1 text-footnote text-content-secondary">{r.who}</div>
              <div className="text-footnote text-content-muted">{r.what}</div>
              {r.status === 'yururlukte' && (
                <span className="rounded-pill bg-surface-sunken px-sm py-0.5 text-caption font-semibold text-content-secondary">
                  Yürürlükte
                </span>
              )}
              {r.status === 'yakin' && (
                <span className="rounded-pill bg-amber-500 px-sm py-0.5 text-caption font-semibold text-white">
                  Yaklaşıyor
                </span>
              )}
            </div>
          ))}
        </div>

        <p className="mt-md text-footnote text-content-muted">
          Uymayan işletmelere idari para cezası uygulanabiliyor. Rotamenu ile hazırlık birkaç
          dakika sürüyor.
        </p>
      </div>
    </Section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: '1',
      title: 'Menünüzün fotoğrafını yükleyin',
      text: 'Kağıt menü, PDF ya da telefonla çekilmiş fotoğraf. Birden çok sayfa olabilir.',
    },
    {
      n: '2',
      title: 'Yapay zeka çıkarır, siz onaylarsınız',
      text: 'Ürünler, fiyatlar, içindekiler, alerjenler ve kaloriler otomatik önerilir. Son söz sizin — onayladığınız bilgi misafire gider.',
    },
    {
      n: '3',
      title: 'QR kodunuzu bastırın',
      text: 'Masa kartı PDF’ini indirin, yapıştırın. Menüyü değiştirdiğinizde QR aynı kalır.',
    },
  ];

  return (
    <Section id="nasil-calisir" tone="sunken">
      <div className="mx-auto max-w-6xl px-md">
        <SectionHead eyebrow="Nasıl çalışır" title="Üç adım, yaklaşık beş dakika" />

        <div className="mt-lg grid gap-md md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-card border border-line bg-surface-raised p-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-footnote font-semibold text-white">
                {s.n}
              </span>
              <h3 className="mt-md font-semibold text-content">{s.title}</h3>
              <p className="mt-sm text-footnote leading-relaxed text-content-secondary">{s.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-lg rounded-card border border-brand-500/30 bg-brand-50 p-lg dark:bg-brand-900/20">
          <h3 className="font-semibold text-content">Uğraşmak istemiyor musunuz?</h3>
          <p className="mt-xs max-w-prose text-footnote text-content-secondary">
            Numaranızı bırakın, sizi arayalım ve menünüzü <strong>biz kuralım</strong>. Ücretsiz.
          </p>
          <SetupRequestForm />
        </div>
      </div>
    </Section>
  );
}

function AuditFile() {
  return (
    <Section>
      <div className="mx-auto grid max-w-6xl items-center gap-xl px-md lg:grid-cols-2">
        <div>
          <SectionHead
            eyebrow="Farkımız"
            title="Sadece menü değil, denetim dosyası"
            lead="Diğer sistemler “yapay zeka otomatik tespit eder” der. Ama yönetmelik karşısında sorumluluk işletmededir. Bu yüzden Rotamenu’de her bilgi önce önerilir, sonra sizin onayınızla yayınlanır — ve bu onay kayıt altına alınır."
          />
          <ul className="mt-lg space-y-sm text-footnote text-content-secondary">
            {[
              'Tüm ürünlerin alerjen, içerik ve kalori tablosu',
              'Hangi bilgiyi ne zaman onayladığınızın kaydı',
              'İşletme beyanı notu ve yönetmelik referansı',
              'Tek tuşla indirilebilir PDF',
            ].map((t) => (
              <li key={t} className="flex items-start gap-sm">
                <Icon name="check" size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-panel border border-line bg-surface-sunken p-lg">
          <div className="rounded-card bg-surface-raised p-md">
            <p className="text-caption font-semibold uppercase tracking-wide text-content-muted">
              Uyum Raporu
            </p>
            <p className="mt-xs font-semibold text-content">Sofra Lokantası</p>
            <p className="text-caption text-content-muted">Düzenlenme: 05.08.2026</p>
            <div className="mt-md space-y-sm text-caption">
              {[
                ['Mercimek Çorbası', 'Glüten · Kereviz', '220 kcal'],
                ['Adana Kebap', 'Beyan edilen alerjen yok', '640 kcal'],
                ['İçli Köfte', 'Glüten · Yumurta', '310 kcal'],
              ].map(([n, a, k]) => (
                <div
                  key={n}
                  className="flex items-center justify-between gap-md border-b border-line pb-sm"
                >
                  <span className="font-medium text-content">{n}</span>
                  <span className="text-content-muted">{a}</span>
                  <span className="shrink-0 text-content-muted">{k}</span>
                </div>
              ))}
            </div>
            <p className="mt-md text-caption leading-relaxed text-content-muted">
              Bu bilgiler işletme beyanına dayanır. Onay tarihleri sistemde kayıtlıdır.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Features() {
  const features: { icon: IconName; title: string; text: string }[] = [
    { icon: 'camera', title: 'Fotoğraftan menü', text: 'Kağıt menü, PDF veya fotoğraf; AI okur, kategorilere ayırır.' },
    { icon: 'leaf', title: '14 alerjen + alkol/domuz', text: 'Türkiye yönetmeliğine özel beyan alanlarıyla birlikte.' },
    { icon: 'flame', title: 'Porsiyon kalorisi', text: 'AI tahmin eder, siz düzeltir ve onaylarsınız.' },
    { icon: 'globe', title: 'Otomatik çeviri', text: 'Arapça, Rusça, İngilizce, Almanca ve daha fazlası.' },
    { icon: 'palette', title: 'Tasarım stüdyosu', text: 'Hazır temalar, renkler, düzen; markanıza uyarlayın.' },
    { icon: 'image', title: 'AI ürün görselleri', text: 'Fotoğrafı olmayan ürünler için görsel üretin veya mevcut fotoğrafı iyileştirin.' },
    { icon: 'qr', title: 'Masaya özel QR', text: 'Her masaya ayrı kod; hangi masanın kaç kez tarandığını görün.' },
    { icon: 'chart', title: 'Çerezsiz analitik', text: 'Ziyaret verisi toplanır ama çerez izni bandına gerek kalmaz.' },
  ];

  return (
    <Section tone="sunken">
      <div className="mx-auto max-w-6xl px-md">
        <SectionHead title="Kutudan çıkan her şey" />
        <div className="mt-lg grid gap-md sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-card border border-line bg-surface-raised p-md">
              <Icon name={f.icon} size={24} className="text-brand-600" />
              <h3 className="mt-md text-callout font-semibold text-content">{f.title}</h3>
              <p className="mt-xs text-footnote leading-relaxed text-content-secondary">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Faq() {
  const faqs = [
    {
      q: 'Alerjen bilgisinden kim sorumlu?',
      a: 'Yönetmelik gereği beyandan işletme sorumludur. Rotamenu yapay zekayla öneri üretir; yayınlanan bilgi yalnızca sizin onayladığınız bilgidir. Onay tarihleriniz sistemde kayıtlı tutulur ve uyum raporunda gösterilir.',
    },
    {
      q: 'Menümü sonradan değiştirebilir miyim?',
      a: 'Evet, istediğiniz zaman. Fiyat, ürün ve kategori değişiklikleri anında canlıya yansır. Basılı QR kodunuz aynı kalır, yeniden bastırmanız gerekmez.',
    },
    {
      q: 'QR kodunu bastırdım, menü adresim değişirse ne olur?',
      a: 'QR kodları kalıcıdır. Menü adresinizi (slug) değiştirseniz bile basılı kodlar çalışmaya devam eder.',
    },
    {
      q: 'Menüm ne kadar süre yayında kalır?',
      a: 'Süre sınırı yok. Menünüz, onaylarınız ve QR kodlarınız siz kaldırana kadar yayında kalır; ürün sayısı ya da dil sayısı için de bir üst sınır uygulanmaz.',
    },
    {
      q: 'Kaç dile çeviri yapabilirim?',
      a: 'Sınır yok. Arapça, Rusça, İngilizce, Almanca, Farsça gibi Türkiye’de en çok ihtiyaç duyulan diller dahil 10’dan fazla dil destekleniyor.',
    },
    {
      q: 'Sipariş alabiliyor muyum?',
      a: 'Şu an menü, uyum ve QR odaklıyız. Masadan sipariş ve AI garson özellikleri yol haritamızda; hazır olduğunda mevcut menünüzle çalışacak.',
    },
  ];

  return (
    <Section id="sss" tone="sunken">
      <div className="mx-auto max-w-3xl px-md">
        <SectionHead title="Sık sorulan sorular" />
        <div className="mt-lg space-y-sm">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-card border border-line bg-surface-raised px-md [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex min-h-touch cursor-pointer items-center justify-between gap-md py-md font-medium text-content">
                {f.q}
                <Icon
                  name="plus"
                  size={18}
                  className="shrink-0 text-content-muted transition group-open:rotate-45"
                />
              </summary>
              <p className="pb-md text-footnote leading-relaxed text-content-secondary">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

function FinalCta() {
  return (
    <section className="bg-stone-900 py-xl lg:py-2xl dark:bg-surface-sunken">
      <div className="mx-auto max-w-4xl px-md text-center">
        <h2 className="text-heading font-semibold text-white sm:text-title">
          31 Aralık’a az kaldı. Menünüz hazır mı?
        </h2>
        <p className="mx-auto mt-md max-w-prose text-body text-stone-300">
          Bugün menünüzün fotoğrafını çekin; yönetmeliğe uyumlu QR menünüz ve denetim dosyanız bu
          akşam hazır olsun.
        </p>
        <div className="mt-lg flex justify-center">
          <PrimaryCta>Menüni oluştur</PrimaryCta>
        </div>
      </div>
    </section>
  );
}
