import { PhoneFrame, PhoneScaledContent } from '@/components/phone-frame';

export type DayBucket = { date: string; scans: number; views: number };

export type PlanInfo = {
  tier: 'free' | 'pro' | 'enterprise';
  label: string;
  /** null = sınırsız */
  itemLimit: number | null;
  images: boolean;
  removeBadge: boolean;
  requiresVerifiedAccount: boolean;
  /** Deneme bitmiş ve abonelik yoksa false — yayın kilitli. */
  canPublish: boolean;
  accountSecured: boolean;
  hasPhone: boolean;
  trial: { state: 'active' | 'expired' | 'none'; endsAt: string | null; daysLeft: number };
};

export type DashboardData = {
  venueId: string;
  venueName: string;
  slug: string;
  isPublished: boolean;
  publishedAt: string | null;
  isAnonymous: boolean;
  itemCount: number;
  itemsWithImage: number;
  pendingCount: number;
  qrActive: number;
  plan: PlanInfo;
  stats: {
    scans: number;
    menuViews: number;
    itemViews: number;
    uniqueVisitors: number;
    totalEvents: number;
  };
  days: DayBucket[];
};

export function Dashboard({ data }: { data: DashboardData }) {
  const hasAnalytics = data.stats.totalEvents > 0;
  const venueHref = (path: string) => `${path}${path.includes('?') ? '&' : '?'}venue=${encodeURIComponent(data.venueId)}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
      <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-600">Pano</p>
          <h1 className="mt-1 text-2xl font-bold">{data.venueName}</h1>
        </div>
        <div className="flex items-center gap-2">
          {data.isPublished ? (
            <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
              CANLI
            </span>
          ) : (
            <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
              TASLAK
            </span>
          )}
          <a
            href={`/m/${data.slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
          >
            👁 Menüyü gör
          </a>
        </div>
      </header>

      <SetupProgress data={data} />

      {/* Durum kartları */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Ürün" value={data.itemCount} href={venueHref('/studyo/ayarlar')} />
        <StatCard
          label="Onaylı ürün"
          value={data.itemCount - data.pendingCount}
          sub={`/ ${data.itemCount}`}
        />
        <StatCard label="Aktif QR" value={data.qrActive} href={venueHref('/studyo/qr')} />
        <StatCard label="30 gün tarama" value={data.stats.scans} />
      </section>

      {/* Görsel kapsamı — özellik kullanılmadan kalmasın diye açık çağrı. */}
      {data.itemCount > 0 && data.itemsWithImage < data.itemCount && (
        <a
          href={venueHref('/studyo/gorseller')}
          className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 transition hover:border-brand-300 hover:bg-brand-50/40"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-800">
              {data.itemsWithImage} / {data.itemCount} üründe görsel var
            </p>
            <p className="mt-0.5 text-xs text-stone-500">
              Görselli ürünler misafirin gözünde belirgin biçimde öne çıkar — eksikleri yapay
              zekâyla tek tek üretebilirsin.
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white">
            Görselleri tamamla →
          </span>
        </a>
      )}

      {/* Plan & kullanım */}
      <PlanCard plan={data.plan} itemCount={data.itemCount} venueId={data.venueId} />

      {/* Analitik */}
      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-stone-400">
            Son 30 gün
          </h2>
          <span className="text-xs text-stone-400">çerezsiz · tekil ziyaretçi tahmini</span>
        </div>

        {hasAnalytics ? (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="QR tarama" value={data.stats.scans} />
              <MiniStat label="Menü görüntüleme" value={data.stats.menuViews} />
              <MiniStat label="Ürün görüntüleme" value={data.stats.itemViews} />
              <MiniStat label="Tekil ziyaretçi" value={data.stats.uniqueVisitors} />
            </div>
            <DayChart days={data.days} />
            <div className="mt-3 flex items-center gap-4 text-xs text-stone-500">
              <Legend className="bg-brand-600" label="Menü görüntüleme" />
              <Legend className="bg-emerald-500" label="QR tarama" />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-stone-50 px-4 py-3">
            <span className="text-2xl">📈</span>
            <div>
              <p className="font-medium text-stone-700">Henüz ziyaret verisi yok</p>
              <p className="text-sm text-stone-500">
                {data.isPublished
                  ? 'QR kodunu masalara koy; misafirler okuttukça veriler burada görünür.'
                  : 'Menünü yayınladığında ziyaret verileri burada birikmeye başlar.'}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Araçlar */}
      <h2 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wide text-stone-400">Araçlar</h2>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <QuickLink href="/studyo" icon="📸" label="Menüye sayfa ekle" />
        <QuickLink href={venueHref('/studyo/uyum')} icon="✅" label="Alerjen / uyum" />
        <QuickLink href={venueHref('/studyo/tasarim')} icon="✦" label="Tasarım" />
        <QuickLink href={venueHref('/studyo/gorseller')} icon="🎨" label="Görseller" />
        <QuickLink href={venueHref('/studyo/diller')} icon="🌍" label="Diller / çeviri" />
        <QuickLink href={venueHref('/studyo/qr')} icon="🔳" label="QR kodları" />
        <QuickLink href={venueHref('/studyo/ayarlar')} icon="⚙️" label="Ayarlar" />
      </section>
      </div>

      <PhonePreview slug={data.slug} />
      </div>
    </main>
  );
}

/**
 * Kurulum ilerlemesi — sihirbazın adım numaralarıyla BİREBİR aynı olmalı.
 * Önceden burada farklı bir dörtlü (Menü/Kontrol/Yayın/QR) vardı; sihirbaz ise
 * 1 Yükle → 2 Düzenle → 3 Uyum → 4 Yayınla diyordu. Menüsünü yayınlayan
 * kullanıcı panoda hâlâ "3/4" görüp neyin eksik olduğunu anlayamıyordu.
 * QR artık yayından SONRAKİ 5. adım olarak ayrı duruyor.
 */
function SetupProgress({ data }: { data: DashboardData }) {
  const venueHref = (path: string) => `${path}?venue=${encodeURIComponent(data.venueId)}`;
  const steps = [
    { label: 'Menüyü yükle', done: data.itemCount > 0, href: '/studyo' },
    { label: 'Düzenle', done: data.itemCount > 0, href: venueHref('/studyo/uyum') },
    {
      label: 'Uyum onayı',
      done: data.itemCount > 0 && data.pendingCount === 0,
      href: venueHref('/studyo/uyum'),
    },
    { label: 'Yayınla', done: data.isPublished, href: venueHref('/studyo/ayarlar') },
    { label: 'QR', done: data.qrActive > 0, href: venueHref('/studyo/qr') },
  ];
  const completed = steps.filter((step) => step.done).length;

  return (
    <section className="mt-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-stone-600">Kurulum ilerlemesi</span>
        <span className="text-stone-400">{completed} / {steps.length}</span>
      </div>
      <ol className="grid grid-cols-5 gap-2">
        {steps.map((step, index) => (
          <li key={step.label} className="min-w-0">
            <a href={step.href} className="block group">
              <div className={`h-1.5 rounded-full transition ${step.done ? 'bg-emerald-500' : 'bg-stone-200 group-hover:bg-stone-300'}`} />
              <p className={`mt-1 truncate text-[11px] ${step.done ? 'font-medium text-emerald-700' : 'text-stone-400'}`}>
                {step.done ? '✓ ' : `${index + 1}. `}{step.label}
              </p>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Sağ kolon: telefon çerçeveli canlı menü önizlemesi (aynı /m/{slug} sayfası). */
function PhonePreview({ slug }: { slug: string }) {
  return (
    <div className="hidden lg:sticky lg:top-8 lg:block">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-400">
        Canlı önizleme
      </p>
      <PhoneFrame>
        {/* iframe gerçek telefon genişliğinde (390px) render edilir, sonra
            çerçeveye sığması için ölçeklenir. Böylece menü sayfası "gerçek
            telefondayım" diye render eder; font boyları ve resim oranları
            birebir mobildeki gibi olur. */}
        <PhoneScaledContent>
          <iframe
            src={`/m/${slug}`}
            title="Menü canlı önizleme"
            className="h-full w-full border-0"
          />
        </PhoneScaledContent>
      </PhoneFrame>
      <p className="mt-3 text-center text-xs text-stone-400">
        Değişiklik yapınca sayfayı yenile — burada da güncellenir.
      </p>
    </div>
  );
}

/** Plan + kullanım kartı (Faz C freemium). */
function PlanCard({ plan, itemCount, venueId }: { plan: PlanInfo; itemCount: number; venueId: string }) {
  const isFree = plan.tier === 'free';
  const limit = plan.itemLimit;
  const atLimit = limit != null && itemCount >= limit;
  const planHref = `/studyo/plan?venue=${encodeURIComponent(venueId)}`;

  // Deneme bitmiş: yayın kilitli — en yüksek öncelikli uyarı.
  if (plan.trial.state === 'expired') {
    return (
      <section className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-4">
        <p className="text-sm font-bold text-red-800">Deneme süreniz doldu</p>
        <p className="mt-1 text-sm text-red-700">
          Menünüz ve tüm verileriniz duruyor, hiçbir şey silinmedi. Yeniden yayına almak için
          aboneliğinizi başlatın.
        </p>
        <a
          href={planHref}
          className="mt-3 inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          Aboneliği başlat
        </a>
      </section>
    );
  }

  // Deneme sürüyor: kalan gün sayacı. Son 3 günde tonu sertleştir.
  if (plan.trial.state === 'active') {
    const urgent = plan.trial.daysLeft <= 3;
    return (
      <section
        className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
          urgent ? 'border-amber-300 bg-amber-50' : 'border-stone-200 bg-white'
        }`}
      >
        <div className="min-w-0 text-sm">
          <span
            className={`mr-2 rounded-full px-3 py-1 text-xs font-semibold ${
              urgent ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
            }`}
          >
            DENEME
          </span>
          <span className={urgent ? 'font-semibold text-amber-900' : 'text-stone-600'}>
            {plan.trial.daysLeft === 0
              ? 'Bugün son gün'
              : `Bitmesine ${plan.trial.daysLeft} gün kaldı`}
          </span>
          <span className="hidden text-stone-400 sm:inline"> · tüm özellikler açık</span>
        </div>
        <a href={planHref} className="text-sm font-semibold text-brand-700 hover:underline">
          Aboneliği başlat
        </a>
      </section>
    );
  }

  return (
    <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isFree ? 'bg-stone-100 text-stone-700' : 'bg-brand-600 text-white'
          }`}
        >
          {plan.label}
        </span>
        <div className="min-w-0 text-sm">
          <span className={atLimit ? 'font-semibold text-red-600' : 'text-stone-600'}>
            {itemCount}{limit != null ? ` / ${limit} ürün` : ' ürün · sınırsız'}
          </span>
          <span className="hidden text-stone-400 sm:inline">
            {isFree ? ' · 5 dile kadar çeviri' : ' · tüm diller ve görseller açık'}
          </span>
        </div>
      </div>
      <a
        href={`/studyo/plan?venue=${encodeURIComponent(venueId)}`}
        className="text-sm font-semibold text-brand-700 hover:underline"
      >
        {isFree ? 'Pro’ya yükselt' : 'Planı yönet'}
      </a>
    </section>
  );
}

/** 30 günlük yığılmış bar grafik — saf SVG, istemci JS yok. */
function DayChart({ days }: { days: DayBucket[] }) {
  const W = 720;
  const H = 160;
  const pad = { top: 8, right: 8, bottom: 18, left: 24 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(1, ...days.map((d) => d.scans + d.views));
  const step = innerW / days.length;
  const barW = Math.max(3, step * 0.7);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  const ticks = [0, Math.ceil(max / 2), max];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Günlük tarama grafiği">
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={pad.left}
            x2={W - pad.right}
            y1={y(t)}
            y2={y(t)}
            stroke="#f1f0ee"
            strokeWidth={1}
          />
          <text x={pad.left - 4} y={y(t) + 3} textAnchor="end" fontSize={8} fill="#a8a29e">
            {t}
          </text>
        </g>
      ))}
      {days.map((d, i) => {
        const x = pad.left + i * step + (step - barW) / 2;
        const viewsH = pad.top + innerH - y(d.views);
        const scansH = pad.top + innerH - y(d.scans);
        const showLabel = i % 5 === 0;
        return (
          <g key={d.date}>
            <rect x={x} y={y(d.views)} width={barW} height={viewsH} rx={1} className="fill-brand-600" />
            <rect
              x={x}
              y={y(d.views) - scansH}
              width={barW}
              height={scansH}
              rx={1}
              fill="#10b981"
            />
            {showLabel && (
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={7.5} fill="#a8a29e">
                {d.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function StatCard({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: number;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-brand-300">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-stone-800">
        {value}
        {sub && <span className="ml-1 text-sm font-normal text-stone-400">{sub}</span>}
      </p>
    </div>
  );
  return href ? <a href={href}>{inner}</a> : inner;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2">
      <p className="text-lg font-bold text-stone-800">{value}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-stone-200 bg-white p-4 text-center shadow-sm transition hover:border-brand-300 hover:bg-brand-50/40"
    >
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <span className="text-sm font-medium text-stone-700">{label}</span>
    </a>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}
