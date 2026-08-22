'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { PRICING } from '@/lib/plans';

export type PlanClientData = {
  venueId: string | null;
  dashboardHref: string;
  plan: 'free' | 'pro' | 'enterprise';
  planLabel: string;
  isOwner: boolean;
  /** Süper-admin oturumu var mı — geliştirme bypass'ı yalnız o zaman görünür. */
  isSuperAdmin: boolean;
  billingConfigured: boolean;
  subStatus: string | null;
  periodEnd: string | null;
  trial: { state: 'active' | 'expired' | 'none'; endsAt: string | null; daysLeft: number };
  prefill: { email: string; gsmNumber: string; name: string };
};

type Form = {
  name: string;
  surname: string;
  identityNumber: string;
  email: string;
  gsmNumber: string;
  city: string;
  address: string;
  zipCode: string;
};

/** iyzico checkoutFormContent (<script> string) — sayfaya çalıştırılabilir enjekte. */
function injectCheckout(content: string) {
  const container = document.getElementById('iyzipay-checkout-form-container');
  if (!container) return;
  container.innerHTML = '<div id="iyzipay-checkout-form" class="responsive"></div>';
  const tmp = document.createElement('div');
  tmp.innerHTML = content;
  tmp.querySelectorAll('script').forEach((old) => {
    const s = document.createElement('script');
    if (old.src) s.src = old.src;
    else s.text = old.textContent ?? '';
    document.body.appendChild(s);
  });
}

export function PlanClient({ data }: { data: PlanClientData }) {
  const isPro = data.plan === 'pro' || data.plan === 'enterprise';
  const [form, setForm] = useState<Form>({
    name: '',
    surname: '',
    identityNumber: '',
    email: data.prefill.email,
    gsmNumber: data.prefill.gsmNumber,
    city: '',
    address: '',
    zipCode: '',
  });
  const [status, setStatus] = useState<'idle' | 'starting' | 'form' | 'canceling'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('upgrade') === 'success') {
      setBanner({ kind: 'ok', text: 'Ödemen alındı — planın Pro’ya yükseltildi. Teşekkürler!' });
    } else if (p.get('upgrade') === 'failed') {
      setBanner({ kind: 'error', text: 'Ödeme tamamlanamadı. Kart bilgilerini kontrol edip tekrar dene.' });
    }
    if (p.get('upgrade')) window.history.replaceState({}, '', '/studyo/plan');
  }, []);

  const set = (k: keyof Form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (error) setError(null);
  };

  async function startCheckout() {
    setError(null);
    setStatus('starting');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Ödeme başlatılamadı.');
      setStatus('form');
      // Formu bir sonraki tick'te enjekte et (container render olsun).
      setTimeout(() => injectCheckout(body.checkoutFormContent), 0);
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Beklenmeyen hata.');
    }
  }

  async function cancel() {
    if (!confirm('Aboneliğini iptal etmek istediğine emin misin? Dönem sonuna kadar Pro açık kalır.')) return;
    setStatus('canceling');
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'İptal başarısız.');
      setBanner({ kind: 'ok', text: 'Aboneliğin iptal edildi. Dönem sonuna kadar Pro açık kalır.' });
    } catch (err) {
      setBanner({ kind: 'error', text: err instanceof Error ? err.message : 'İptal başarısız.' });
    } finally {
      setStatus('idle');
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-brand-600">Plan</p>
          <h1 className="mt-1 text-2xl font-bold">Planın ve yükseltme</h1>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isPro ? 'bg-brand-600 text-white' : 'bg-stone-200 text-stone-700'
          }`}
        >
          {data.planLabel}
        </span>
      </header>

      {banner && (
        <p
          className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
            banner.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {banner.text}
        </p>
      )}

      {/* Deneme durumu */}
      {!isPro && data.trial.state === 'active' && (
        <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <strong>Deneme sürüyor</strong> — bitmesine {data.trial.daysLeft} gün kaldı. Tüm
          özellikler açık; süre dolunca menün yayından kalkar, verilerin durur.
        </p>
      )}
      {!isPro && data.trial.state === 'expired' && (
        <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Deneme süren doldu.</strong> Menün ve tüm verilerin duruyor — abonelik
          başlayınca kaldığın yerden yayına döner.
        </p>
      )}

      {/* Fiyat karşılaştırma */}
      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PlanBox
          title={`${PRICING.trialDays} gün ücretsiz deneme`}
          price="0 TL"
          priceNote="kart bilgisi istenmez"
          active={!isPro}
          features={[
            'Tüm Pro özellikleri açık',
            'Menünü kur, düzenle, yayınla',
            `${PRICING.trialDays} gün sonunda yayın kilitlenir`,
            'Verilerin silinmez',
          ]}
        />
        <PlanBox
          title="Abonelik"
          price={`${PRICING.monthly} TL`}
          priceNote={`aylık · yıllık ${PRICING.yearly.toLocaleString('tr-TR')} TL (${PRICING.freeMonthsOnYearly} ay bedava)`}
          highlight
          active={isPro}
          features={[
            'Sınırsız ürün ve kategori',
            'Tüm diller · otomatik çeviri',
            'Alerjen & kalori uyum raporu (PDF)',
            'AI ürün + kategori görselleri',
            'Sınırsız QR kod ve masa kartı',
            'RotaMenu rozeti kalkar',
          ]}
        />
      </section>

      {isPro ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
          <h2 className="text-base font-bold text-stone-800">Pro aboneliğin aktif</h2>
          <p className="mt-1 text-sm text-stone-600">
            Durum: <strong>{data.subStatus ?? 'ACTIVE'}</strong>
            {data.periodEnd ? ` · Dönem sonu: ${new Date(data.periodEnd).toLocaleDateString('tr-TR')}` : ''}
          </p>
          {data.billingConfigured && data.isOwner && data.subStatus === 'ACTIVE' && (
            <button
              onClick={cancel}
              disabled={status === 'canceling'}
              className="mt-4 rounded-xl border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
            >
              {status === 'canceling' ? 'İptal ediliyor…' : 'Aboneliği iptal et'}
            </button>
          )}
          {!data.billingConfigured && data.isOwner && data.isSuperAdmin && (
            <DevBypass mode="downgrade" venueId={data.venueId} dashboardHref={data.dashboardHref} />
          )}
        </section>
      ) : !data.billingConfigured ? (
        <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-600 shadow-sm">
          <p>Ödeme altyapısı henüz etkin değil. Pro’ya yükseltme çok yakında açılacak.</p>
          {data.isOwner && data.isSuperAdmin && (
            <DevBypass mode="upgrade" venueId={data.venueId} dashboardHref={data.dashboardHref} />
          )}
        </section>
      ) : !data.isOwner ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-sm">
          Pro’ya yükseltme yalnız işletme sahibi tarafından yapılabilir.
        </section>
      ) : (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-base font-bold text-stone-800">Pro’ya yükselt</h2>
          <p className="mb-4 text-sm text-stone-500">
            Fatura bilgilerini gir; güvenli iyzico ödeme formunda kartınla ödeme yaparsın. Abonelik
            aylık yenilenir, istediğin an iptal edebilirsin.
          </p>

          {status !== 'form' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Ad" value={form.name} onChange={set('name')} />
              <Field label="Soyad" value={form.surname} onChange={set('surname')} />
              <Field
                label="TC Kimlik / Vergi No"
                value={form.identityNumber}
                onChange={set('identityNumber')}
                placeholder="11 hane"
              />
              <Field label="E-posta" value={form.email} onChange={set('email')} type="email" />
              <Field label="Telefon" value={form.gsmNumber} onChange={set('gsmNumber')} placeholder="+90 5xx…" />
              <Field label="Şehir" value={form.city} onChange={set('city')} />
              <div className="sm:col-span-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-stone-600">Adres</span>
                  <textarea
                    value={form.address}
                    onChange={set('address')}
                    rows={2}
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                </label>
              </div>
              <Field label="Posta kodu (ops.)" value={form.zipCode} onChange={set('zipCode')} />
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {status !== 'form' && (
            <button
              onClick={startCheckout}
              disabled={status === 'starting'}
              className="mt-5 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-50"
            >
              {status === 'starting' ? 'Hazırlanıyor…' : 'Öde ve Pro’ya geç'}
            </button>
          )}

          {/* iyzico ödeme formu buraya enjekte edilir */}
          <div id="iyzipay-checkout-form-container" className="mt-6" />
        </section>
      )}
    </main>
  );
}

/**
 * ⚠️ GEÇİCİ / YALNIZ GELİŞTİRME — iyzico bağlanana kadar ödemesiz plan
 * değişimi. `data.billingConfigured` false olduğu sürece görünür; iyzico env
 * değişkenleri eklenince hem bu bileşen hem de çağırdığı API rotaları
 * (`/api/billing/dev-upgrade`, `/api/billing/dev-downgrade`) devre dışı kalır
 * (rotalar 403 döner). KALDIRMA: bu bileşeni + iki route dosyasını sil.
 */
function DevBypass({
  mode,
  venueId,
  dashboardHref,
}: {
  mode: 'upgrade' | 'downgrade';
  venueId: string | null;
  dashboardHref: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/billing/dev-${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId }),
      });
      const body = (await res.json()) as { error?: string; redirectTo?: string };
      if (!res.ok) throw new Error(body.error ?? 'İşlem başarısız.');
      window.location.assign(body.redirectTo ?? dashboardHref);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Beklenmeyen hata.');
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
        Geliştirme modu — iyzico bağlanınca kaldırılacak
      </p>
      <p className="mt-1 text-sm text-amber-800">
        {mode === 'upgrade'
          ? 'Ödeme atlanarak bu işletme Pro’ya geçirilir (test amaçlı).'
          : 'Bu işletme test amaçlı tekrar Ücretsiz plana döndürülür.'}
      </p>
      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
      <button
        onClick={run}
        disabled={busy}
        className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-amber-700 disabled:opacity-50"
      >
        {busy
          ? 'İşleniyor…'
          : mode === 'upgrade'
            ? 'Pro’ya geç (iyzico bypass)'
            : 'Ücretsize dön (test)'}
      </button>
    </div>
  );
}

function PlanBox({
  title,
  price,
  priceNote,
  features,
  active,
  highlight,
}: {
  title: string;
  price?: string;
  priceNote?: string;
  features: string[];
  active?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        highlight ? 'border-brand-300 bg-brand-50/40' : 'border-stone-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-stone-800">{title}</h3>
        {active && (
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
            MEVCUT
          </span>
        )}
      </div>
      {price && (
        <p className="mt-1">
          <span className="text-2xl font-bold text-stone-900">{price}</span>
          {priceNote && <span className="ml-1.5 text-xs text-stone-500">{priceNote}</span>}
        </p>
      )}
      <ul className="mt-3 space-y-1 text-sm text-stone-600">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-1.5">
            <span className="text-brand-500" aria-hidden>
              •
            </span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
      />
    </label>
  );
}
