export type DayBucket = { date: string; scans: number; views: number };

export type PlanInfo = {
  tier: 'free' | 'pro' | 'enterprise';
  label: string;
  /** null = sınırsız */
  itemLimit: number | null;
  images: boolean;
  removeBadge: boolean;
  requiresVerifiedAccount: boolean;
  accountSecured: boolean;
  hasPhone: boolean;
};

export type DashboardData = {
  venueId: string;
  venueName: string;
  slug: string;
  isPublished: boolean;
  publishedAt: string | null;
  isAnonymous: boolean;
  itemCount: number;
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
  const nextAction = getNextAction(data, venueHref);

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

      <NextActionCard action={nextAction} />
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

type NextAction = {
  complete: boolean;
  eyebrow: string;
  title: string;
  text: string;
  href: string;
  label: string;
};

function getNextAction(data: DashboardData, venueHref: (path: string) => string): NextAction {
  if (data.pendingCount > 0) {
    return {
      complete: false,
      eyebrow: 'Sıradaki adım',
      title: 'Alerjen ve kalorileri kontrol et',
      text: `${data.pendingCount} ürün işletme onayı bekliyor. Bilgileri kontrol ederek menünü yayına hazırla.`,
      href: venueHref('/studyo/uyum'),
      label: 'Kontrole başla',
    };
  }

  const needsAccount =
    data.plan.requiresVerifiedAccount && (!data.plan.accountSecured || !data.plan.hasPhone);
  if (needsAccount) {
    return {
      complete: false,
      eyebrow: 'Sıradaki adım',
      title: 'Ücretsiz hesabını tamamla',
      text: 'Menünü güvenle saklamak ve yayınlamak için e-posta ile iletişim telefonunu ekle.',
      href: venueHref('/studyo/hesap'),
      label: 'Hesabı tamamla',
    };
  }

  if (!data.isPublished) {
    return {
      complete: false,
      eyebrow: 'Sıradaki adım',
      title: 'Menünü yayınla',
      text: 'İşletme bilgilerini son kez kontrol et ve menünü misafirlerin erişimine aç.',
      href: venueHref('/studyo/ayarlar'),
      label: 'Bilgileri kontrol et ve yayınla',
    };
  }

  if (data.qrActive === 0) {
    return {
      complete: false,
      eyebrow: 'Son adım',
      title: 'İlk QR kodunu oluştur',
      text: 'Menünü masalara, vitrine veya paket servise taşıyacak kalıcı QR kodunu hazırla.',
      href: venueHref('/studyo/qr'),
      label: 'QR kodu oluştur',
    };
  }

  return {
    complete: true,
    eyebrow: 'Menün hazır',
    title: 'Her şey yolunda',
    text: 'Menün yayında ve QR kodun aktif. Dilersen misafir görünümünü kontrol edebilirsin.',
    href: `/m/${data.slug}`,
    label: 'Menüyü görüntüle',
  };
}

function NextActionCard({ action }: { action: NextAction }) {
  return (
    <section
      className={`rounded-2xl border p-5 shadow-sm ${
        action.complete ? 'border-emerald-200 bg-emerald-50' : 'border-brand-200 bg-brand-50'
      }`}
    >
      <p className={`text-xs font-bold uppercase tracking-wide ${action.complete ? 'text-emerald-700' : 'text-brand-700'}`}>
        {action.eyebrow}
      </p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900">{action.title}</h2>
          <p className="mt-1 max-w-xl text-sm text-stone-600">{action.text}</p>
        </div>
        <a
          href={action.href}
          className={`shrink-0 rounded-xl px-5 py-3 text-center text-sm font-semibold text-white shadow transition ${
            action.complete ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-brand-600 hover:bg-brand-700'
          }`}
        >
          {action.label} →
        </a>
      </div>
    </section>
  );
}

function SetupProgress({ data }: { data: DashboardData }) {
  const steps = [
    { label: 'Menü', done: data.itemCount > 0 },
    { label: 'Kontrol', done: data.itemCount > 0 && data.pendingCount === 0 },
    { label: 'Yayın', done: data.isPublished },
    { label: 'QR', done: data.qrActive > 0 },
  ];
  const completed = steps.filter((step) => step.done).length;

  return (
    <section className="mt-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-stone-600">Kurulum ilerlemesi</span>
        <span className="text-stone-400">{completed} / {steps.length}</span>
      </div>
      <ol className="grid grid-cols-4 gap-2">
        {steps.map((step) => (
          <li key={step.label} className="min-w-0">
            <div className={`h-1.5 rounded-full ${step.done ? 'bg-emerald-500' : 'bg-stone-200'}`} />
            <p className={`mt-1 truncate text-[11px] ${step.done ? 'font-medium text-emerald-700' : 'text-stone-400'}`}>
              {step.done ? '✓ ' : ''}{step.label}
            </p>
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
      <div className="mx-auto w-[280px] rounded-[2.5rem] border-[10px] border-stone-900 bg-stone-900 shadow-xl">
        <div className="relative h-[580px] w-full overflow-hidden rounded-[1.75rem] bg-white">
          {/* Gerçek telefon durum çubuğu: beyaz zemin, ortada çentik,
              solda saat, sağda wifi + pil. Yüksekliği 28px. */}
          <div className="absolute inset-x-0 top-0 z-20 flex h-7 items-center justify-between bg-white px-4 text-[11px] font-semibold text-stone-900">
            <span>9:41</span>
            {/* Ortadaki çentik */}
            <div className="pointer-events-none absolute left-1/2 top-0 h-5 w-20 -translate-x-1/2 rounded-b-xl bg-stone-900" />
            <span className="flex items-center gap-1">
              {/* Sinyal */}
              <svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden>
                <rect x="0" y="7" width="3" height="4" rx="0.5" fill="currentColor" />
                <rect x="4.5" y="5" width="3" height="6" rx="0.5" fill="currentColor" />
                <rect x="9" y="2.5" width="3" height="8.5" rx="0.5" fill="currentColor" />
                <rect x="13" y="0" width="3" height="11" rx="0.5" fill="currentColor" opacity="0.3" />
              </svg>
              {/* Wifi */}
              <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden>
                <path d="M7.5 2C4.6 2 2.1 3.1.3 4.9l1.3 1.3C3 4.7 5.1 3.8 7.5 3.8s4.5.9 5.9 2.4l1.3-1.3C12.9 3.1 10.4 2 7.5 2Z" fill="currentColor" />
                <path d="M7.5 5.6c-1.6 0-3 .6-4.1 1.6l1.4 1.4c.7-.7 1.7-1.1 2.7-1.1s2 .4 2.7 1.1l1.4-1.4C10.5 6.2 9.1 5.6 7.5 5.6Z" fill="currentColor" />
                <circle cx="7.5" cy="9.6" r="1.2" fill="currentColor" />
              </svg>
              {/* Pil */}
              <svg width="26" height="12" viewBox="0 0 26 12" fill="none" aria-hidden>
                <rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="currentColor" opacity="0.4" />
                <rect x="2" y="2" width="17" height="8" rx="1.5" fill="currentColor" />
                <rect x="24" y="4" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.4" />
              </svg>
            </span>
          </div>
          {/* iframe gerçek telefon genişliğinde (390px) render edilir, sonra
              çerçeveye sığması için ölçeklenir. Böylece menü sayfası "gerçek
              telefondayım" diye render eder; font boyları ve resim oranları
              birebir mobildeki gibi olur. Ölçek = 260 / 390 = 0.6667.
              Durum çubuğunun (28px) altından başlar. */}
          <iframe
            src={`/m/${slug}`}
            title="Menü canlı önizleme"
            className="absolute inset-x-0 border-0"
            style={{
              top: '28px',
              width: '390px',
              height: '828px',
              transform: 'scale(0.6667)',
              transformOrigin: 'top left',
            }}
          />
        </div>
      </div>
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
