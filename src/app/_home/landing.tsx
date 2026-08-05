import Link from 'next/link';
import { PRICING } from '@/lib/plans';
import { PhoneFrame, PhoneScaledContent } from '@/components/phone-frame';
import {
  MarketingHeader,
  MarketingFooter,
  WhatsAppButton,
} from '@/app/(marketing)/_components/marketing-chrome';
import { SetupRequestForm } from './setup-request-form';

/** Landing page'den gösterilen örnek menü. */
const DEMO_SLUG = 'demo';

/**
 * Pazarlama ana sayfası.
 *
 * Konumlandırma: yönetmelik uyumu birincil, hız/çok dillilik/tasarım ikincil.
 * Rakiplerden ayrışma noktası "AI önerir → işletme onaylar → denetim dosyası"
 * akışıdır; sayfa boyunca bu vurgulanır.
 */
export function Landing() {
  return (
    <>
      <MarketingHeader />
      <main>
        <Hero />
        <TrustBar />
        <RegulationTimeline />
        <HowItWorks />
        <AuditFile />
        <Features />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <MarketingFooter />
      <WhatsAppButton />
    </>
  );
}

/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-stone-200 bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 lg:grid-cols-[1.1fr_1fr] lg:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            31 Aralık 2026 · alerjen bildirimi zorunlu
          </span>

          <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-stone-900 sm:text-5xl">
            Menünüzün fotoğrafını çekin,
            <br />
            <span className="text-brand-600">yönetmeliğe uyumlu QR menünüz hazır.</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone-600">
            Yapay zeka menünüzü okur; alerjen, kalori ve içerik bilgisini önerir.{' '}
            <strong className="font-semibold text-stone-800">Siz onaylarsınız</strong> — ve
            denetimde gösterebileceğiniz uyum dosyanız hazır olur.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/studyo"
              className="rounded-xl bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700"
            >
              {PRICING.trialDays} gün ücretsiz dene
            </Link>
            <a
              href={`/m/${DEMO_SLUG}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-stone-300 bg-white px-6 py-3.5 text-base font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              Örnek menüyü gör
            </a>
          </div>

          <p className="mt-3 text-sm text-stone-500">
            Kredi kartı istemiyoruz · Kurulum ücreti yok · İstediğiniz an bırakın
          </p>
        </div>

        <PhoneMockup />
      </div>
    </section>
  );
}

/**
 * Gerçek telefon çerçevesi + örnek menünün canlı iframe'i — pano'daki
 * "Canlı önizleme" ile birebir aynı bileşen/boyut. Sahte statik maket değil;
 * gerçekten /m/demo'yu render eder, oran ve fontlar gerçek mobil görünümle
 * birebir eşleşir.
 */
function PhoneMockup() {
  return (
    <div className="mx-auto">
      <PhoneFrame>
        <PhoneScaledContent>
          <iframe
            src={`/m/${DEMO_SLUG}`}
            title="Örnek menü önizleme"
            className="h-full w-full border-0"
          />
        </PhoneScaledContent>
      </PhoneFrame>
    </div>
  );
}

function TrustBar() {
  const points = [
    { icon: '⏱', label: '5 dakikada kurulum' },
    { icon: '🌍', label: '10+ dile otomatik çeviri' },
    { icon: '🛡', label: 'Denetime hazır uyum dosyası' },
    { icon: '🍪', label: 'Çerezsiz analitik · KVKK dostu' },
  ];
  return (
    <section className="border-b border-stone-200 bg-stone-50">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-5 py-6 lg:grid-cols-4">
        {points.map((p) => (
          <div key={p.label} className="flex items-center gap-2.5">
            <span className="text-xl" aria-hidden>
              {p.icon}
            </span>
            <span className="text-sm font-medium text-stone-700">{p.label}</span>
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
    <section id="yonetmelik" className="scroll-mt-16 border-b border-stone-200 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <p className="text-sm font-semibold text-brand-600">Yönetmelik</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
          Menünüzde alerjen ve kalori bilgisi artık zorunlu
        </h2>
        <p className="mt-3 max-w-2xl text-stone-600">
          Tarım ve Orman Bakanlığı düzenlemesiyle işletmeler; 14 majör alerjen, alkol ve domuz
          türevi bileşen ile enerji bilgisini misafire sunmak zorunda. Karekod (QR) bu bilgiyi
          sunmanın yönetmelikçe kabul edilen yollarından biri.
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-stone-200">
          {rows.map((r, i) => (
            <div
              key={r.date}
              className={`flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 ${
                i > 0 ? 'border-t border-stone-100' : ''
              } ${r.status === 'yakin' ? 'bg-amber-50' : 'bg-white'}`}
            >
              <div className="w-36 shrink-0 font-bold text-stone-900">{r.date}</div>
              <div className="min-w-[200px] flex-1 text-sm text-stone-700">{r.who}</div>
              <div className="text-sm text-stone-500">{r.what}</div>
              {r.status === 'yururlukte' && (
                <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-semibold text-stone-700">
                  Yürürlükte
                </span>
              )}
              {r.status === 'yakin' && (
                <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                  Yaklaşıyor
                </span>
              )}
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm text-stone-500">
          Uymayan işletmelere idari para cezası uygulanabiliyor. RestaurantOS ile hazırlık birkaç
          dakika sürüyor.
        </p>
      </div>
    </section>
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
    <section id="nasil-calisir" className="scroll-mt-16 border-b border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <p className="text-sm font-semibold text-brand-600">Nasıl çalışır</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
          Üç adım, yaklaşık beş dakika
        </h2>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-stone-200 bg-white p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {s.n}
              </span>
              <h3 className="mt-4 font-bold text-stone-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{s.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-brand-200 bg-brand-50/50 p-6">
          <h3 className="font-bold text-stone-900">Uğraşmak istemiyor musunuz?</h3>
          <p className="mt-1 max-w-lg text-sm text-stone-600">
            Numaranızı bırakın, sizi arayalım ve menünüzü <strong>biz kuralım</strong>. Ücretsiz.
          </p>
          <SetupRequestForm />
        </div>
      </div>
    </section>
  );
}

function AuditFile() {
  return (
    <section className="border-b border-stone-200 bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-brand-600">Farkımız</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
            Sadece menü değil, denetim dosyası
          </h2>
          <p className="mt-4 leading-relaxed text-stone-600">
            Diğer sistemler “yapay zeka otomatik tespit eder” der. Ama yönetmelik karşısında
            sorumluluk işletmededir. Bu yüzden RestaurantOS’ta her bilgi{' '}
            <strong className="text-stone-800">önce önerilir, sonra sizin onayınızla</strong>{' '}
            yayınlanır — ve bu onay kayıt altına alınır.
          </p>
          <ul className="mt-5 space-y-2.5 text-sm text-stone-700">
            {[
              'Tüm ürünlerin alerjen, içerik ve kalori tablosu',
              'Hangi bilgiyi ne zaman onayladığınızın kaydı',
              'İşletme beyanı notu ve yönetmelik referansı',
              'Tek tuşla indirilebilir PDF',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-0.5 text-emerald-600">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6 shadow-sm">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Uyum Raporu
            </p>
            <p className="mt-1 font-bold text-stone-900">Sofra Lokantası</p>
            <p className="text-xs text-stone-500">Düzenlenme: 05.08.2026</p>
            <div className="mt-4 space-y-2 text-xs">
              {[
                ['Mercimek Çorbası', 'Glüten · Kereviz', '220 kcal'],
                ['Adana Kebap', 'Beyan edilen alerjen yok', '640 kcal'],
                ['İçli Köfte', 'Glüten · Yumurta', '310 kcal'],
              ].map(([n, a, k]) => (
                <div
                  key={n}
                  className="flex items-center justify-between gap-3 border-b border-stone-100 pb-2"
                >
                  <span className="font-medium text-stone-800">{n}</span>
                  <span className="text-stone-500">{a}</span>
                  <span className="shrink-0 text-stone-500">{k}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[10px] leading-relaxed text-stone-400">
              Bu bilgiler işletme beyanına dayanır. Onay tarihleri sistemde kayıtlıdır.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    { icon: '📸', title: 'Fotoğraftan menü', text: 'Kağıt menü, PDF veya fotoğraf; AI okur, kategorilere ayırır.' },
    { icon: '🥗', title: '14 alerjen + alkol/domuz', text: 'Türkiye yönetmeliğine özel beyan alanlarıyla birlikte.' },
    { icon: '🔥', title: 'Porsiyon kalorisi', text: 'AI tahmin eder, siz düzeltir ve onaylarsınız.' },
    { icon: '🌍', title: 'Otomatik çeviri', text: 'Arapça, Rusça, İngilizce, Almanca ve daha fazlası.' },
    { icon: '🎨', title: 'Tasarım stüdyosu', text: 'Hazır temalar, renkler, düzen; markanıza uyarlayın.' },
    { icon: '🖼', title: 'AI ürün görselleri', text: 'Fotoğrafı olmayan ürünler için görsel üretin veya mevcut fotoğrafı iyileştirin.' },
    { icon: '📱', title: 'Masaya özel QR', text: 'Her masaya ayrı kod; hangi masanın kaç kez tarandığını görün.' },
    { icon: '📊', title: 'Çerezsiz analitik', text: 'Ziyaret verisi toplanır ama çerez izni bandına gerek kalmaz.' },
  ];

  return (
    <section className="border-b border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-3xl font-bold tracking-tight text-stone-900">Kutudan çıkan her şey</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-stone-200 bg-white p-5">
              <span className="text-2xl" aria-hidden>
                {f.icon}
              </span>
              <h3 className="mt-3 text-sm font-bold text-stone-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="fiyat" className="scroll-mt-16 border-b border-stone-200 bg-white">
      <div className="mx-auto max-w-4xl px-5 py-14">
        <div className="text-center">
          <p className="text-sm font-semibold text-brand-600">Fiyatlandırma</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
            Tek plan, gizli maliyet yok
          </h2>
          <p className="mt-3 text-stone-600">
            {PRICING.trialDays} gün boyunca her şey açık. Beğenmezseniz hiçbir ücret ödemezsiniz.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6">
            <p className="text-sm font-semibold text-stone-500">Deneme</p>
            <p className="mt-2 text-4xl font-bold text-stone-900">0 ₺</p>
            <p className="mt-1 text-sm text-stone-500">{PRICING.trialDays} gün · kart istemiyoruz</p>
            <ul className="mt-5 space-y-2 text-sm text-stone-600">
              {[
                'Tüm özellikler açık',
                'Menünüzü kurun ve yayınlayın',
                'Süre bitince verileriniz durur',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="text-stone-400">•</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative rounded-2xl border-2 border-brand-500 bg-white p-6 shadow-lg shadow-brand-600/10">
            <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">
              EN ÇOK TERCİH EDİLEN
            </span>
            <p className="text-sm font-semibold text-stone-500">Abonelik</p>
            <p className="mt-2 text-4xl font-bold text-stone-900">
              {PRICING.monthly} ₺
              <span className="ml-1 text-base font-medium text-stone-500">/ay</span>
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              Yıllık {PRICING.yearly.toLocaleString('tr-TR')} ₺ ·{' '}
              <strong>{PRICING.freeMonthsOnYearly} ay bedava</strong>
            </p>
            <ul className="mt-5 space-y-2 text-sm text-stone-700">
              {[
                'Sınırsız ürün ve kategori',
                'Tüm diller · otomatik çeviri',
                'Denetime hazır uyum raporu (PDF)',
                'AI ürün ve kategori görselleri',
                'Sınırsız QR kod ve masa kartı',
                'RestaurantOS rozeti kalkar',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="text-emerald-600">✓</span>
                  {t}
                </li>
              ))}
            </ul>
            <Link
              href="/studyo"
              className="mt-6 block rounded-xl bg-brand-600 px-6 py-3 text-center font-semibold text-white transition hover:bg-brand-700"
            >
              Ücretsiz denemeye başla
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const faqs = [
    {
      q: 'Alerjen bilgisinden kim sorumlu?',
      a: 'Yönetmelik gereği beyandan işletme sorumludur. RestaurantOS yapay zekayla öneri üretir; yayınlanan bilgi yalnızca sizin onayladığınız bilgidir. Onay tarihleriniz sistemde kayıtlı tutulur ve uyum raporunda gösterilir.',
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
      q: 'Deneme bitince verilerim silinir mi?',
      a: 'Hayır. Deneme bitince yalnızca menünüzün yayını durur; ürünleriniz, onaylarınız ve QR kodlarınız olduğu gibi kalır. Abonelik başlattığınızda kaldığınız yerden devam edersiniz.',
    },
    {
      q: 'Kaç dile çeviri yapabilirim?',
      a: 'Abonelikte sınır yok. Arapça, Rusça, İngilizce, Almanca, Farsça gibi Türkiye’de en çok ihtiyaç duyulan diller dahil 10’dan fazla dil destekleniyor.',
    },
    {
      q: 'Sipariş alabiliyor muyum?',
      a: 'Şu an menü, uyum ve QR odaklıyız. Masadan sipariş ve AI garson özellikleri yol haritamızda; hazır olduğunda mevcut menünüzle çalışacak.',
    },
  ];

  return (
    <section id="sss" className="scroll-mt-16 border-b border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-3xl px-5 py-14">
        <h2 className="text-3xl font-bold tracking-tight text-stone-900">Sık sorulan sorular</h2>
        <div className="mt-8 space-y-3">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-xl border border-stone-200 bg-white px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-stone-900">
                {f.q}
                <span className="shrink-0 text-stone-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-stone-900">
      <div className="mx-auto max-w-4xl px-5 py-16 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          31 Aralık’a az kaldı. Menünüz hazır mı?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-stone-300">
          Bugün menünüzün fotoğrafını çekin; yönetmeliğe uyumlu QR menünüz ve denetim dosyanız
          bu akşam hazır olsun.
        </p>
        <Link
          href="/studyo"
          className="mt-8 inline-block rounded-xl bg-brand-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-brand-700"
        >
          {PRICING.trialDays} gün ücretsiz dene
        </Link>
        <p className="mt-3 text-sm text-stone-400">Kredi kartı gerekmez</p>
      </div>
    </section>
  );
}
