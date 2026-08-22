'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MenuLanguage } from '@/lib/languages';

export type TranslationJobView = {
  id: string;
  job_type: 'description' | 'translation';
  locale: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  total_items: number;
  error_message: string | null;
  updated_at: string;
};

export function LanguageManager({
  venueId,
  venueName,
  languages,
  jobs,
  missingDescriptions,
  itemCount,
  planLabel,
  maxTargets,
}: {
  venueId: string;
  venueName: string;
  languages: MenuLanguage[];
  jobs: TranslationJobView[];
  missingDescriptions: number;
  itemCount: number;
  planLabel: string;
  maxTargets: number | null;
}) {
  const router = useRouter();
  const latestJobs = useMemo(() => {
    const map = new Map<string, TranslationJobView>();
    for (const job of jobs) if (job.job_type === 'translation' && !map.has(job.locale)) map.set(job.locale, job);
    return map;
  }, [jobs]);
  const completed = useMemo(
    () => languages.filter((language) => latestJobs.get(language.code)?.status === 'completed').map((language) => language.code),
    [languages, latestJobs]
  );
  const translationsDisabled = maxTargets === 0;
  const [selected, setSelected] = useState<string[]>(() => {
    const initial = [...completed];
    const englishIsAvailable = languages.some((language) => language.code === 'en');
    const hasCapacity = maxTargets == null || initial.length < maxTargets;
    if (englishIsAvailable && !initial.includes('en') && hasCapacity) initial.unshift('en');
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [queuedLocales, setQueuedLocales] = useState<string[]>([]);
  const [queuedAt, setQueuedAt] = useState(0);
  const [generatingDescriptions, setGeneratingDescriptions] = useState(false);
  /**
   * AÇIKLAMA ÜRETİMİ ve ÇEVİRİ artık birbirinden tamamen bağımsız iki iştir.
   * Eskiden çeviri düğmesi, eksik açıklama varsa kilitliydi ve ancak bir onay
   * kutusu işaretlenince açılıyordu — kullanıcı sadece çevirmek istediğinde
   * bile önce açıklama üretmek zorunda kalıyordu. Artık her iki düğme de tek
   * başına çalışır; çeviri, açıklaması olmayan ürünleri de olduğu gibi çevirir.
   */
  const [message, setMessage] = useState<string | null>(null);
  const activeTranslationJobs = useMemo(
    () => jobs.filter((job) => job.job_type === 'translation' && (job.status === 'pending' || job.status === 'processing')),
    [jobs]
  );
  const active = jobs.some((job) => job.status === 'pending' || job.status === 'processing') || queuedLocales.length > 0;

  const translatingLanguages = useMemo(() => {
    const localeCodes = new Set([
      ...queuedLocales,
      ...activeTranslationJobs.map((job) => job.locale),
    ]);

    return languages
      .filter((language) => {
        if (!localeCodes.has(language.code)) return false;
        if (queuedLocales.includes(language.code)) return true;
        const status = latestJobs.get(language.code)?.status;
        return status !== 'completed' && status !== 'failed';
      })
      .map((language) => ({ language, job: latestJobs.get(language.code) }));
  }, [activeTranslationJobs, languages, latestJobs, queuedLocales]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [active, router]);

  useEffect(() => {
    if (!queuedLocales.length) return;
    // Başarısız bir işi yeniden başlatırken ilk render hâlâ eski `failed`
    // kaydını taşıyabilir. İlk yenileme turuna kadar bu eski terminal durumu
    // dikkate alma; yeni pending/processing kaydı geldikten sonra karar ver.
    if (Date.now() - queuedAt < 3500) return;
    const allFinished = queuedLocales.every((locale) => {
      const status = latestJobs.get(locale)?.status;
      return status === 'completed' || status === 'failed';
    });
    if (allFinished) setQueuedLocales([]);
  }, [latestJobs, queuedAt, queuedLocales]);

  function toggle(code: string) {
    setMessage(null);
    setSelected((current) => {
      if (current.includes(code)) return current.filter((value) => value !== code);
      if (maxTargets != null && current.length >= maxTargets) {
        setMessage(`${planLabel} planında Türkçe dışında en fazla ${maxTargets} dil seçebilirsiniz.`);
        return current;
      }
      return [...current, code];
    });
  }

  async function start() {
    if (!selected.length) return setMessage('En az bir hedef dil seçin.');
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/menu/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId, locales: selected }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        jobs?: number;
        alreadyCompleted?: boolean;
      };
      if (!response.ok) throw new Error(payload.error ?? 'Çeviri başlatılamadı.');
      const localesToRun = selected.filter((locale) => latestJobs.get(locale)?.status !== 'completed');
      setQueuedLocales(payload.alreadyCompleted || payload.jobs === 0 ? [] : localesToRun);
      setQueuedAt(Date.now());
      setMessage(
        payload.alreadyCompleted || payload.jobs === 0
          ? 'Seçili dillerin çevirileri zaten hazır.'
          : 'İşlem başladı. Bu sayfadan ayrılsanız da çeviriler arka planda devam eder.'
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Çeviri başlatılamadı.');
    } finally {
      setSubmitting(false);
    }
  }

  /** Açıklama üretimini ÇEVİRİDEN AYRI, tek başına başlatır (Adım 1). */
  async function generateDescriptions() {
    setGeneratingDescriptions(true);
    setMessage(null);
    try {
      const response = await fetch('/api/menu/generate-descriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Açıklamalar üretilemedi.');
      setMessage('Açıklamalar üretiliyor. Bu sayfadan ayrılsanız da arka planda devam eder.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Açıklamalar üretilemedi.');
    } finally {
      setGeneratingDescriptions(false);
    }
  }

  const neighborLanguages = languages.filter((language) => language.region === 'neighbor');
  const popularLanguages = languages.filter((language) => language.region === 'popular');
  const descriptionJob = jobs.find((job) => job.job_type === 'description');

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <a href={`/studyo/pano?venue=${encodeURIComponent(venueId)}`} className="text-sm font-medium text-brand-700 hover:underline">← Panoya dön</a>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-600">Dil yönetimi</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-900">{venueName}</h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Ürün adları, açıklamalar, içerikler ve kategori adları seçtiğiniz dillere çevrilir.
          </p>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-700">{planLabel}</span>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <InfoCard label="Ürün" value={String(itemCount)} />
        <InfoCard label="Eksik açıklama" value={String(missingDescriptions)} tone={missingDescriptions ? 'amber' : 'green'} />
        <InfoCard label="Hazır çeviri" value={`${completed.length} dil`} />
      </section>

      {missingDescriptions > 0 && (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-amber-900">Ürün açıklamaları</p>
              <p className="mt-1 text-sm text-amber-800">
                {missingDescriptions} üründe açıklama eksik. Bu isteğe bağlıdır — çeviriyi
                beklemeden başlatabilirsin. Açıklama üretirsen menü daha dolu görünür ve
                çeviriler de bu metinleri kapsar.
              </p>
            </div>
            <button
              onClick={generateDescriptions}
              disabled={generatingDescriptions || active}
              className="shrink-0 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generatingDescriptions ? 'Başlatılıyor…' : '✨ Açıklamaları üret'}
            </button>
          </div>
        </section>
      )}

      {descriptionJob && descriptionJob.status !== 'completed' && (
        <JobBanner label="Ürün açıklamaları" job={descriptionJob} />
      )}

      {translatingLanguages.length > 0 && (
        <TranslationActivity items={translatingLanguages} />
      )}

      <LanguageSection title="Türkiye ve komşu coğrafya için önemli diller" languages={neighborLanguages} selected={selected} jobs={latestJobs} onToggle={toggle} disabled={translationsDisabled} />
      <LanguageSection title="Dünyada yaygın diller" languages={popularLanguages} selected={selected} jobs={latestJobs} onToggle={toggle} disabled={translationsDisabled} />

      <div className="sticky bottom-4 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <div>
          <p className="font-semibold text-stone-800">
            {translationsDisabled ? 'Planınızda çeviri kapalı' : `${selected.length} hedef dil seçildi`}
          </p>
          <p className="text-xs text-stone-500">
            {translationsDisabled ? 'Çeviri özelliğini kullanmak için planınızı yükseltin.' : 'Türkçe kaynak dil olarak korunur; İngilizce başlangıçta seçilidir.'}
          </p>
        </div>
        <button
          onClick={start}
          disabled={submitting || active || translationsDisabled || !selected.length}
          className="rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white shadow transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {translationsDisabled ? 'Çeviri kapalı' : active ? 'Çeviri sürüyor…' : submitting ? 'Başlatılıyor…' : 'Dillere çevir'}
        </button>
      </div>
      {message && <p className="mt-3 rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-700">{message}</p>}
    </main>
  );
}

function LanguageSection({ title, languages, selected, jobs, onToggle, disabled }: {
  title: string;
  languages: MenuLanguage[];
  selected: string[];
  jobs: Map<string, TranslationJobView>;
  onToggle: (code: string) => void;
  disabled: boolean;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-stone-500">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {languages.map((language) => {
          const job = jobs.get(language.code);
          return (
            <button key={language.code} onClick={() => onToggle(language.code)} disabled={disabled} className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${selected.includes(language.code) ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-stone-200 bg-white hover:border-brand-300'}`}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-semibold text-stone-900">{language.name}</p><p className="mt-0.5 text-sm text-stone-500">{language.nativeName}</p></div>
                <span className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${selected.includes(language.code) ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300'}`}>{selected.includes(language.code) ? '✓' : ''}</span>
              </div>
              {job && <JobStatus job={job} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function JobStatus({ job }: { job: TranslationJobView }) {
  const label = job.status === 'completed' ? 'Hazır' : job.status === 'failed' ? 'Başarısız — tekrar deneyin' : job.status === 'processing' ? `%${job.progress} çevriliyor` : 'Sırada';
  return <p className={`mt-3 text-xs font-medium ${job.status === 'completed' ? 'text-emerald-700' : job.status === 'failed' ? 'text-red-600' : 'text-amber-700'}`}>{label}</p>;
}

function JobBanner({ label, job }: { label: string; job: TranslationJobView }) {
  return <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><span className="font-semibold">{label}:</span> {job.status === 'failed' ? job.error_message : job.status === 'processing' ? `%${job.progress} tamamlandı` : 'sırada'}</div>;
}

function TranslationActivity({
  items,
}: {
  items: { language: MenuLanguage; job: TranslationJobView | undefined }[];
}) {
  const title = items.length === 1
    ? `${items[0].language.name} çeviriliyor`
    : `${items.length} dil çevriliyor`;

  return (
    <section
      className="mt-6 overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-amber-50 p-5 shadow-sm"
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="flex items-center gap-4">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center" aria-hidden>
          <span className="absolute inset-0 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600 motion-reduce:animate-none" />
          <span className="absolute inset-2 animate-pulse rounded-full bg-white shadow-inner motion-reduce:animate-none" />
          <span className="relative text-3xl">🌍</span>
          <span className="absolute right-0 top-0 animate-bounce text-lg motion-reduce:animate-none">✨</span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Çeviri devam ediyor</p>
          <h2 className="mt-1 text-xl font-bold text-stone-900">{title}</h2>
          <p className="mt-1 text-sm text-stone-600">Menünüz arka planda hazırlanıyor; bu sayfadan ayrılabilirsiniz.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map(({ language, job }) => {
          const processing = job?.status === 'processing';
          const progress = processing ? Math.max(0, Math.min(100, job.progress)) : 0;
          return (
            <div key={language.code} className="rounded-xl border border-white bg-white/85 px-3 py-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900">
                    {language.name} <span className="font-normal text-stone-500">· {language.nativeName}</span>
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-brand-700">
                    {processing ? `%${progress} çevrildi` : 'Sıraya alındı'}
                  </p>
                </div>
                <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-brand-700">
                  {language.code}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-100">
                {processing ? (
                  <div
                    className="h-full rounded-full bg-brand-600 transition-[width] duration-500"
                    style={{ width: `${Math.max(progress, 4)}%` }}
                  />
                ) : (
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-500 motion-reduce:animate-none" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function InfoCard({ label, value, tone }: { label: string; value: string; tone?: 'amber' | 'green' }) {
  const className = tone === 'amber' ? 'border-amber-200 bg-amber-50' : tone === 'green' ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-white';
  return <div className={`rounded-2xl border p-4 ${className}`}><p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p><p className="mt-1 text-2xl font-bold text-stone-900">{value}</p></div>;
}
