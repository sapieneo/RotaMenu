'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type VenueOption = { id: string; name: string; slug: string; isPublished: boolean };
export type VenueStat = VenueOption & { views30: number; views7: number };

export type AdRow = {
  id: string;
  name: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  durationSeconds: number;
  clickUrl: string | null;
  allVenues: boolean;
  startsOn: string | null;
  endsOn: string | null;
  isActive: boolean;
  weight: number;
  venueIds: string[];
  impressions: number;
  clicks: number;
};

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4';
const MAX_MB = 15;

export function AdManager({
  ads: initialAds,
  venues,
  venueStats,
}: {
  ads: AdRow[];
  venues: VenueOption[];
  venueStats: VenueStat[];
}) {
  const [ads, setAds] = useState<AdRow[]>(initialAds);
  const [preview, setPreview] = useState<AdRow | null>(null);

  function replaceAd(next: AdRow) {
    setAds((list) => list.map((a) => (a.id === next.id ? next : a)));
  }

  return (
    <div className="space-y-8">
      <NewAdForm onCreated={(ad) => setAds((list) => [ad, ...list])} />

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-stone-400">
          Reklamlar {ads.length > 0 && <span className="text-stone-300">· {ads.length}</span>}
        </h2>
        {ads.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-500">
            Henüz reklam yok. Yukarıdan ilk reklamı yükleyebilirsin.
          </p>
        ) : (
          <div className="space-y-4">
            {ads.map((ad) => (
              <AdCard
                key={ad.id}
                ad={ad}
                venues={venues}
                onChange={replaceAd}
                onDeleted={() => setAds((list) => list.filter((a) => a.id !== ad.id))}
                onPreview={() => setPreview(ad)}
              />
            ))}
          </div>
        )}
      </section>

      <VenueTraffic stats={venueStats} />

      {preview && <AdPreview ad={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function NewAdForm({ onCreated }: { onCreated: (ad: AdRow) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(5);
  const [clickUrl, setClickUrl] = useState('');
  const [allVenues, setAllVenues] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const localPreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  async function submit() {
    if (!file) return setError('Reklam dosyası seç.');
    if (!name.trim()) return setError('Reklam adı gerekli.');
    if (file.size > MAX_MB * 1024 * 1024) return setError(`Dosya ${MAX_MB} MB sınırını aşıyor.`);
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('name', name.trim());
      form.set('durationSeconds', String(duration));
      form.set('clickUrl', clickUrl.trim());
      form.set('allVenues', String(allVenues));
      const res = await fetch('/api/admin/ads', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Yüklenemedi.');
      const a = body.ad;
      onCreated({
        id: a.id,
        name: a.name,
        mediaUrl: a.media_url,
        mediaType: a.media_type,
        durationSeconds: a.duration_seconds,
        clickUrl: a.click_url ?? null,
        allVenues: Boolean(a.all_venues),
        startsOn: a.starts_on ?? null,
        endsOn: a.ends_on ?? null,
        isActive: Boolean(a.is_active),
        weight: a.weight,
        venueIds: [],
        impressions: 0,
        clicks: 0,
      });
      setName('');
      setClickUrl('');
      setFile(null);
      setAllVenues(false);
      setDuration(5);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Beklenmeyen hata.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border-2 border-dashed border-stone-300 py-5 text-sm font-semibold text-stone-500 transition hover:border-brand-400 hover:text-brand-600"
      >
        + Yeni reklam yükle
      </button>
    );
  }

  return (
    <section className="rounded-2xl border border-brand-200 bg-brand-50/40 p-5">
      <h2 className="text-base font-bold text-stone-800">Yeni reklam</h2>
      <p className="mt-0.5 text-xs text-stone-500">
        JPG, PNG, WebP, GIF veya MP4 · en fazla {MAX_MB} MB
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-[13rem_minmax(0,1fr)]">
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border border-stone-300 bg-white text-xs text-stone-500 transition hover:border-brand-400"
          >
            {localPreview ? (
              file?.type === 'video/mp4' ? (
                <video src={localPreview} muted className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={localPreview} alt="" className="h-full w-full object-cover" />
              )
            ) : (
              'Dosya seç'
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          {file && <p className="mt-1 truncate text-[11px] text-stone-500">{file.name}</p>}
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-stone-600">Reklam adı</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Efes Yaz Kampanyası"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-stone-600">
              Ekranda kalma süresi: <strong className="tabular-nums">{duration} sn</strong>
            </span>
            <input
              type="range"
              min={2}
              max={30}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1 w-full accent-brand-600"
            />
            <span className="text-[11px] text-stone-500">
              Misafir bu süre boyunca reklamı görür, sonra menü açılır. Sağ üstteki halka
              geri sayımı gösterir.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-stone-600">
              Tıklanınca açılacak adres (isteğe bağlı)
            </span>
            <input
              value={clickUrl}
              onChange={(e) => setClickUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={allVenues}
              onChange={(e) => setAllVenues(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-stone-800">Tüm menülerde göster</span>
              <span className="block text-xs text-stone-500">
                Kapalıysa aşağıdan tek tek menü seçersin.
              </span>
            </span>
          </label>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? 'Yükleniyor…' : 'Reklamı ekle'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-white"
        >
          Vazgeç
        </button>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function AdCard({
  ad,
  venues,
  onChange,
  onDeleted,
  onPreview,
}: {
  ad: AdRow;
  venues: VenueOption[];
  onChange: (ad: AdRow) => void;
  onDeleted: () => void;
  onPreview: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<AdRow>(ad);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: Partial<AdRow>) {
    setBusy(true);
    setError(null);
    const next = { ...draft, ...patch };
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ad.id,
          name: next.name,
          durationSeconds: next.durationSeconds,
          clickUrl: next.clickUrl,
          allVenues: next.allVenues,
          isActive: next.isActive,
          weight: next.weight,
          startsOn: next.startsOn,
          endsOn: next.endsOn,
          venueIds: next.venueIds,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Kaydedilemedi.');
      setDraft(next);
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Beklenmeyen hata.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`“${ad.name}” silinsin mi? Bu işlem geri alınamaz.`)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ad.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Silinemedi.');
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Beklenmeyen hata.');
      setBusy(false);
    }
  }

  const targetLabel = draft.allVenues
    ? 'Tüm menüler'
    : draft.venueIds.length === 0
      ? 'Menü seçilmedi'
      : `${draft.venueIds.length} menü`;

  const ctr = draft.impressions > 0 ? Math.round((draft.clicks / draft.impressions) * 1000) / 10 : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-4 p-4">
        <button
          type="button"
          onClick={onPreview}
          title="Misafirin gördüğü hâliyle önizle"
          className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100"
        >
          {draft.mediaType === 'video' ? (
            <video src={draft.mediaUrl} muted className="h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.mediaUrl} alt="" className="h-full w-full object-cover" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-stone-800">{draft.name}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                draft.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
              }`}
            >
              {draft.isActive ? 'Yayında' : 'Duraklatıldı'}
            </span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
              {draft.durationSeconds} sn
            </span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
              {targetLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500">
            <strong className="tabular-nums text-stone-700">{draft.impressions}</strong> gösterim
            {draft.clickUrl && (
              <>
                {' · '}
                <strong className="tabular-nums text-stone-700">{draft.clicks}</strong> tıklama
                {ctr !== null && <span className="text-stone-400"> (%{ctr})</span>}
              </>
            )}
            <span className="text-stone-400"> · son 30 gün</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void save({ isActive: !draft.isActive })}
            disabled={busy}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
          >
            {draft.isActive ? 'Duraklat' : 'Yayınla'}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
          >
            {expanded ? 'Kapat' : 'Düzenle'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-stone-100 bg-stone-50/60 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-stone-600">Reklam adı</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-stone-600">
                Süre: <strong className="tabular-nums">{draft.durationSeconds} sn</strong>
              </span>
              <input
                type="range"
                min={2}
                max={30}
                value={draft.durationSeconds}
                onChange={(e) => setDraft({ ...draft, durationSeconds: Number(e.target.value) })}
                className="mt-2 w-full accent-brand-600"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-stone-600">Tıklama adresi</span>
              <input
                value={draft.clickUrl ?? ''}
                onChange={(e) => setDraft({ ...draft, clickUrl: e.target.value || null })}
                placeholder="https://…"
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-stone-600">
                Gösterim ağırlığı: <strong className="tabular-nums">{draft.weight}</strong>
              </span>
              <input
                type="range"
                min={1}
                max={10}
                value={draft.weight}
                onChange={(e) => setDraft({ ...draft, weight: Number(e.target.value) })}
                className="mt-2 w-full accent-brand-600"
              />
              <span className="text-[11px] text-stone-500">
                Aynı menüde birden fazla reklam varsa yüksek ağırlık daha sık gösterilir.
              </span>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-stone-600">Başlangıç (isteğe bağlı)</span>
              <input
                type="date"
                value={draft.startsOn ?? ''}
                onChange={(e) => setDraft({ ...draft, startsOn: e.target.value || null })}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-stone-600">Bitiş (isteğe bağlı)</span>
              <input
                type="date"
                value={draft.endsOn ?? ''}
                onChange={(e) => setDraft({ ...draft, endsOn: e.target.value || null })}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </label>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.allVenues}
                onChange={(e) => setDraft({ ...draft, allVenues: e.target.checked })}
              />
              <span className="font-medium text-stone-800">Tüm menülerde göster</span>
            </label>

            {!draft.allVenues && (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-stone-200 bg-white">
                {venues.length === 0 ? (
                  <p className="p-3 text-xs text-stone-500">İşletme yok.</p>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {venues.map((v) => {
                      const on = draft.venueIds.includes(v.id);
                      return (
                        <li key={v.id}>
                          <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-stone-50">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() =>
                                setDraft({
                                  ...draft,
                                  venueIds: on
                                    ? draft.venueIds.filter((id) => id !== v.id)
                                    : [...draft.venueIds, v.id],
                                })
                              }
                            />
                            <span className="min-w-0 flex-1 truncate text-stone-800">{v.name}</span>
                            <span className="shrink-0 text-[11px] text-stone-400">/{v.slug}</span>
                            {!v.isPublished && (
                              <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">
                                yayında değil
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void save({})}
              disabled={busy}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={onPreview}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-white"
            >
              Önizle
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="ml-auto rounded-lg px-3 py-2 text-sm font-medium text-stone-400 transition hover:text-red-600 disabled:opacity-50"
            >
              Reklamı sil
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Misafirin gördüğü açılış ekranının birebir önizlemesi — geri sayım halkası
 * dahil. Reklamı yayına almadan önce süresinin uzun mu kısa mı geldiğini
 * gerçekten görmek gerekiyor; sayı olarak "8 sn" tahmin edilemiyor.
 */
function AdPreview({ ad, onClose }: { ad: AdRow; onClose: () => void }) {
  const RADIUS = 16;
  const CIRCUM = 2 * Math.PI * RADIUS;
  const [started, setStarted] = useState(false);
  const [left, setLeft] = useState(ad.durationSeconds);
  const [done, setDone] = useState(false);

  // Önizleme kendi kendine başlar; bittiğinde kapanmak yerine "bitti" der ki
  // yönetici tekrar tekrar izleyebilsin.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setStarted(true));
    const tick = window.setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    const end = window.setTimeout(() => setDone(true), ad.durationSeconds * 1000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(tick);
      window.clearTimeout(end);
    };
  }, [ad.durationSeconds]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="relative aspect-[9/16] w-full max-w-[22rem] overflow-hidden rounded-3xl bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {ad.mediaType === 'video' ? (
          <video src={ad.mediaUrl} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}

        <span className="absolute left-4 top-4 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90">
          Reklam
        </span>

        <div className="absolute right-4 top-4 h-11 w-11">
          <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="20" cy="20" r={RADIUS} fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.28)" strokeWidth="3" />
            <circle
              cx="20"
              cy="20"
              r={RADIUS}
              fill="none"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={CIRCUM}
              style={{
                strokeDashoffset: started ? CIRCUM : 0,
                transition: `stroke-dashoffset ${ad.durationSeconds}s linear`,
              }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold tabular-nums text-white">
            {left}
          </span>
        </div>

        {done && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5 text-center">
            <p className="text-sm font-medium text-white">Süre doldu — menü açılır.</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Kapat"
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
      >
        ✕
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function VenueTraffic({ stats }: { stats: VenueStat[] }) {
  const max = Math.max(1, ...stats.map((s) => s.views30));
  const total = stats.reduce((n, s) => n + s.views30, 0);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-400">Menü trafiği</h2>
        <p className="text-xs text-stone-500">
          Son 30 günde <strong className="tabular-nums text-stone-700">{total}</strong> menü görüntülemesi
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {stats.length === 0 ? (
          <p className="p-4 text-sm text-stone-500">Henüz işletme yok.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="px-4 py-2.5 font-semibold">Menü</th>
                <th className="px-4 py-2.5 text-right font-semibold">7 gün</th>
                <th className="px-4 py-2.5 text-right font-semibold">30 gün</th>
                <th className="hidden w-40 px-4 py-2.5 font-semibold sm:table-cell">Dağılım</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.id} className="border-b border-stone-50 last:border-b-0">
                  <td className="px-4 py-2.5">
                    <a
                      href={`/m/${s.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-stone-800 hover:text-brand-700 hover:underline"
                    >
                      {s.name}
                    </a>
                    {!s.isPublished && (
                      <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">
                        yayında değil
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-stone-600">{s.views7}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-stone-800">
                    {s.views30}
                  </td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${Math.round((s.views30 / max) * 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
