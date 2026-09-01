'use client';

import { useRef, useState } from 'react';
import { CURRENCIES } from '@/lib/currency';
import { createClient } from '@/lib/supabase/client';
import { DAY_NAMES_TR, emptyWeek, type WeeklyHours } from '@/lib/opening-hours';

export type VenueSettings = {
  id: string;
  /** Storage yolu için gerekli — bkz. popup görseli yükleme. */
  orgId: string;
  slug: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  googleMapsUrl: string;
  /** "Bizi Google'da değerlendirin" bağlantısı — misafir menüsünde ikon olur. */
  googleReviewUrl: string;
  wifiSsid: string;
  /** Eski serbest metin. Haftalık saatler girildiyse misafire O gösterilir. */
  openingHours: string;
  /** Yapısal haftalık saatler — misafir ekranında "bugün" hesabı buradan çıkar. */
  openingHoursWeekly: WeeklyHours;
  /** AI görsel üretimi açık mı — yeni işletmelerde kapalı gelir. */
  aiImagesEnabled: boolean;
  currencyCode: string;
  announcementTitle: string;
  announcementBody: string;
  announcementButtonText: string;
  /** Popup'ın üst görseli. null = görselsiz popup. */
  announcementImageUrl: string | null;
  story: string;
};

export type PublishState = {
  isPublished: boolean;
  publishedAt: string | null;
  itemCount: number;
  pendingCount: number;
  /** Plan yayına izin veriyor mu (deneme bitmişse false). */
  canPublish: boolean;
  trialExpired: boolean;
  /** Ücretsiz planda e-posta + telefon eksik mi? */
  needsAccount: boolean;
  accountSecured: boolean;
  hasPhone: boolean;
};

type Save = { name: 'idle' } | { name: 'saving' } | { name: 'done' } | { name: 'error'; message: string };

export function VenueSettingsForm({
  initial,
  publish,
  hasPanoPassword,
}: {
  initial: VenueSettings;
  publish: PublishState;
  /** Bu venue için şu an bir pano giriş şifresi tanımlı mı (bkz. PanoPasswordCard). */
  hasPanoPassword: boolean;
}) {
  const [v, setV] = useState<VenueSettings>(initial);
  const [save, setSave] = useState<Save>({ name: 'idle' });
  const [pub, setPub] = useState<PublishState>(publish);
  const [savedSlug, setSavedSlug] = useState(initial.slug);

  function set<K extends keyof VenueSettings>(key: K, value: VenueSettings[K]) {
    setV((s) => ({ ...s, [key]: value }));
    if (save.name !== 'idle') setSave({ name: 'idle' });
  }

  async function submit() {
    if (!v.name.trim()) {
      setSave({ name: 'error', message: 'İşletme adı boş olamaz.' });
      return;
    }
    setSave({ name: 'saving' });
    try {
      const res = await fetch('/api/venue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueId: v.id,
          name: v.name,
          description: v.description,
          address: v.address,
          phone: v.phone,
          whatsapp: v.whatsapp,
          instagram: v.instagram,
          googleMapsUrl: v.googleMapsUrl,
          googleReviewUrl: v.googleReviewUrl,
          wifiSsid: v.wifiSsid,
          openingHours: v.openingHours,
          // Hiçbir günde saat girilmemişse boş dizi gönderiyoruz: sunucu bunu
          // "yapısal saat yok" sayıp serbest metne düşüyor.
          aiImagesEnabled: v.aiImagesEnabled,
          openingHoursWeekly: v.openingHoursWeekly.some((d) => d.closed || (d.open && d.close))
            ? v.openingHoursWeekly
            : [],
          currencyCode: v.currencyCode,
          slug: v.slug.trim().toLowerCase(),
          announcementTitle: v.announcementTitle,
          announcementBody: v.announcementBody,
          announcementButtonText: v.announcementButtonText,
          announcementImageUrl: v.announcementImageUrl,
          story: v.story,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Kaydedilemedi.');
      setSavedSlug(body.slug ?? v.slug);
      setSave({ name: 'done' });
    } catch (err) {
      setSave({ name: 'error', message: err instanceof Error ? err.message : 'Beklenmeyen hata.' });
    }
  }

  /** Yayın anahtarı — tek boolean, tüm misafir erişimini açar/kapatır. */
  async function togglePublish(next: boolean) {
    setSave({ name: 'saving' });
    try {
      const res = await fetch('/api/venue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId: v.id, isPublished: next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Güncellenemedi.');
      setPub((s) => ({ ...s, isPublished: body.isPublished, publishedAt: body.publishedAt }));
      setSave({ name: 'idle' });
    } catch (err) {
      setSave({ name: 'error', message: err instanceof Error ? err.message : 'Beklenmeyen hata.' });
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-600">
            {pub.isPublished ? 'İşletme ayarları' : 'Adım 4 / 5 · Yayınla'}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{v.name || 'İşletmem'}</h1>
          <p className="mt-1 text-sm text-stone-500">
            Bu bilgiler misafir menünün başlığında ve iletişim bölümünde görünür.
          </p>
        </div>
        <a
          href={`/studyo/pano?venue=${v.id}`}
          className="shrink-0 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          📊 Panoya dön
        </a>
      </header>

      <PublishCard
        venueId={v.id}
        state={pub}
        slug={savedSlug}
        busy={save.name === 'saving'}
        onToggle={togglePublish}
      />

      <div className="space-y-6">
        <Section title="İşletme">
          <Field label="İşletme adı" required>
            <input
              value={v.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Örn. Sine Pub"
              className={inputCls}
            />
          </Field>
          <Field label="Kısa açıklama">
            <textarea
              value={v.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Örn. Nostaljik meyhane · canlı müzik"
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </Field>
          <Field label="Menü adresi">
            <div className="flex items-center rounded-lg border border-stone-300 bg-white px-3 py-2 focus-within:border-brand-500">
              <span className="shrink-0 text-sm text-stone-400">/m/</span>
              <input
                value={v.slug}
                onChange={(e) => set('slug', e.target.value.toLowerCase())}
                placeholder="sine-pub"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <span className="mt-1 block text-xs text-stone-500">
              Küçük harf, rakam ve tire. Değiştirirsen eski bağlantı çalışmaz —{' '}
              <a href={`/studyo/qr?venue=${encodeURIComponent(v.id)}`} className="underline">
                basılı QR kodların
              </a>{' '}
              etkilenmez.
            </span>
          </Field>
          <Field label="Para birimi">
            <select
              value={v.currencyCode}
              onChange={(e) => set('currencyCode', e.target.value)}
              className={inputCls}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code} — {c.name}
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <Section title="İletişim & konum">
          <Field label="Adres">
            <textarea
              value={v.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="Açık adres"
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Google Haritalar bağlantısı">
              <input
                value={v.googleMapsUrl}
                onChange={(e) => set('googleMapsUrl', e.target.value)}
                placeholder="https://maps.google.com/…"
                className={inputCls}
              />
            </Field>
            <Field label="Google’da değerlendirme bağlantısı">
              <input
                value={v.googleReviewUrl}
                onChange={(e) => set('googleReviewUrl', e.target.value)}
                placeholder="https://g.page/r/…/review"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Telefon">
              <input
                value={v.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="0212 000 00 00"
                className={inputCls}
              />
            </Field>
            <Field label="WhatsApp">
              <input
                value={v.whatsapp}
                onChange={(e) => set('whatsapp', e.target.value)}
                placeholder="+90 5xx xxx xx xx"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Instagram">
            <input
              value={v.instagram}
              onChange={(e) => set('instagram', e.target.value)}
              placeholder="@kullaniciadi"
              className={inputCls}
            />
          </Field>
        </Section>

        <Section title="Misafir bilgisi">
          <WeeklyHoursEditor
            value={v.openingHoursWeekly}
            onChange={(next) => set('openingHoursWeekly', next)}
          />
          <Field label="Çalışma saatleri (serbest metin)">
            <input
              value={v.openingHours}
              onChange={(e) => set('openingHours', e.target.value)}
              placeholder="Örn. Her gün 12:00 – 24:00"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-stone-500">
              Yukarıda gün gün saat girdiysen misafire o gösterilir; bu alan yalnız yedek olarak kalır.
            </p>
          </Field>
          <Field label="Wi-Fi ağ adı">
            <input
              value={v.wifiSsid}
              onChange={(e) => set('wifiSsid', e.target.value)}
              placeholder="Örn. SinePub_Misafir"
              className={inputCls}
            />
          </Field>
        </Section>

        <Section title="Yapay zeka">
          <label className="flex items-start gap-3 rounded-xl border border-stone-200 p-3">
            <input
              type="checkbox"
              checked={v.aiImagesEnabled}
              onChange={(e) => set('aiImagesEnabled', e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium text-stone-800">AI görsel üretimi</span>
              <span className="mt-0.5 block text-xs text-stone-500">
                Kapalıyken Görseller ekranındaki “AI ile üret” ve “İyileştir” düğmeleri çalışmaz;
                kendi fotoğraflarını yüklemeye devam edebilirsin. Yeni işletmelerde kapalı gelir —
                AI görsel ücretli bir servis ve her mekan istemiyor.
              </span>
            </span>
          </label>
        </Section>

        <Section title="Marka hikayesi">
          <p className="-mt-2 mb-1 text-xs text-stone-500">
            Misafir menünün en altında, iletişim bilgilerinden önce gösterilen serbest metin —
            işletmenin hikayesi, felsefesi ya da kısa bir "bizi tanıyın" yazısı için.
          </p>
          <Field label="Metin">
            <textarea
              value={v.story}
              onChange={(e) => set('story', e.target.value)}
              placeholder="Örn. 1998'den beri aynı tarifle, aynı özenle…"
              rows={4}
              className={`${inputCls} resize-none`}
            />
          </Field>
        </Section>

        <Section title="Karşılama popup'ı">
          <p className="-mt-2 mb-1 text-xs text-stone-500">
            Misafir menüyü açtığında bir kez gösterilen duyuru/promosyon kartı. Başlık boş bırakılırsa
            popup hiç gösterilmez.
          </p>
          <Field label="Başlık">
            <input
              value={v.announcementTitle}
              onChange={(e) => set('announcementTitle', e.target.value)}
              placeholder="Örn. Bugünün ayrıcalığı"
              className={inputCls}
            />
          </Field>
          <Field label="Açıklama">
            <textarea
              value={v.announcementBody}
              onChange={(e) => set('announcementBody', e.target.value)}
              placeholder="Örn. Hafta içi 17:00'e kadar kahvelerde %20 indirim."
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </Field>
          <Field label="Buton metni">
            <input
              value={v.announcementButtonText}
              onChange={(e) => set('announcementButtonText', e.target.value)}
              placeholder="Menüyü gör"
              className={inputCls}
            />
          </Field>
          <Field label="Görsel">
            <AnnouncementImageField
              orgId={v.orgId}
              url={v.announcementImageUrl}
              onChange={(url) => set('announcementImageUrl', url)}
            />
          </Field>
        </Section>

        <PanoPasswordCard venueId={v.id} initialHasPassword={hasPanoPassword} />
      </div>

      {save.name === 'error' && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {save.message}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={submit}
          disabled={save.name === 'saving'}
          className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-50"
        >
          {save.name === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        {save.name === 'done' && (
          <span className="text-sm font-medium text-emerald-600">✓ Kaydedildi</span>
        )}
        <a
          href={`/studyo/qr?venue=${encodeURIComponent(v.id)}`}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          QR kodları
        </a>
        <a
          href={`/m/${savedSlug}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
        >
          👁 Misafir menüsünü önizle
        </a>
      </div>
    </main>
  );
}

/**
 * Yayın kartı. `is_published` tek bir boolean ama 0001'deki tüm public SELECT
 * policy'leri ona bağlı: kapalıyken menüyü yalnız org üyesi görür.
 */
function PublishCard({
  venueId,
  state,
  slug,
  busy,
  onToggle,
}: {
  venueId: string;
  state: PublishState;
  slug: string;
  busy: boolean;
  onToggle: (next: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const livePath = `/m/${slug}`;

  function confirmAndPublish() {
    if (state.pendingCount > 0) {
      const ok = window.confirm(
        `${state.pendingCount} ürünün alerjen onayı bekliyor. Onaylanmamış ürünlerin alerjen ` +
          'bilgisi misafire GÖSTERİLMEZ.\n\nYine de yayınlamak istiyor musun?'
      );
      if (!ok) return;
    }
    onToggle(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${livePath}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* pano erişimi yoksa sessiz geç */
    }
  }

  return (
    <section
      className={`mb-6 rounded-2xl border p-5 shadow-sm ${
        state.isPublished ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                state.isPublished ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
              }`}
            >
              {state.isPublished ? 'CANLI' : 'TASLAK'}
            </span>
            <h2 className="text-base font-bold text-stone-800">
              {state.isPublished ? 'Menün yayında' : 'Menün henüz yayında değil'}
            </h2>
          </div>
          <p className="mt-1 max-w-md text-sm text-stone-600">
            {state.isPublished
              ? 'Bağlantıyı veya QR kodunu bilen herkes menünü görebilir.'
              : 'Şu an menüyü yalnızca sen görebiliyorsun. Yayınladığında bağlantı ve QR herkese açılır.'}
          </p>
          {state.publishedAt && (
            <p className="mt-1 text-xs text-stone-500">
              İlk yayın: {new Date(state.publishedAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}
            </p>
          )}
        </div>

        {/* Önkoşul yoksa buton yerine ne yapılması gerektiğini gösteren link:
            kullanıcı boşuna tıklayıp hata almasın. */}
        {!state.isPublished && state.trialExpired ? (
          <a
            href={`/studyo/plan?venue=${encodeURIComponent(venueId)}`}
            className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white shadow transition hover:bg-red-700"
          >
            Aboneliği başlat
          </a>
        ) : !state.isPublished && state.needsAccount ? (
          <a
            href="/studyo/hesap"
            className="rounded-xl bg-amber-600 px-5 py-2.5 font-semibold text-white shadow transition hover:bg-amber-700"
          >
            Önce kaydını tamamla
          </a>
        ) : (
          <button
            onClick={() => (state.isPublished ? onToggle(false) : confirmAndPublish())}
            disabled={busy}
            className={`rounded-xl px-5 py-2.5 font-semibold shadow transition disabled:opacity-50 ${
              state.isPublished
                ? 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {busy ? '…' : state.isPublished ? 'Yayından kaldır' : 'Yayınla'}
          </button>
        )}
      </div>

      {!state.isPublished && (state.trialExpired || state.needsAccount) && (
        <p className="mt-3 rounded-lg border border-stone-200 bg-white/70 px-3 py-2 text-sm text-stone-700">
          {state.trialExpired
            ? 'Deneme süren doldu. Menün ve verilerin duruyor; abonelik başlayınca kaldığı yerden yayına döner.'
            : `Yayınlamak için ${!state.accountSecured ? 'e-postanı doğrulaman' : ''}${
                !state.accountSecured && !state.hasPhone ? ' ve ' : ''
              }${!state.hasPhone ? 'iletişim telefonu eklemen' : ''} gerekiyor.`}
        </p>
      )}

      {!state.isPublished && state.pendingCount > 0 && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-white/70 px-3 py-2 text-sm text-amber-800">
          {state.pendingCount}/{state.itemCount} ürünün alerjen onayı bekliyor. Onaylanmayan ürünlerde
          misafir alerjen bilgisi göremez.{' '}
          <a href={`/studyo/uyum?venue=${encodeURIComponent(venueId)}`} className="font-semibold underline">
            Uyum ekranına git
          </a>
        </p>
      )}

      {state.isPublished && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600">
            {livePath}
          </code>
          <button
            onClick={copy}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            {copied ? '✓ Kopyalandı' : 'Kopyala'}
          </button>
          <a
            href={`/studyo/qr?venue=${encodeURIComponent(venueId)}`}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Adım 5/5: QR kodu al →
          </a>
        </div>
      )}
    </section>
  );
}

/**
 * İşletmeye özel pano giriş şifresi. Hesabı olmayan bir işletme sahibinin
 * `/studyo/pano?venue=…` bağlantısını, hesap açmadan yalnızca bu şifreyle
 * açabilmesini sağlar (bkz. lib/pano-auth.ts). Yönetici parolası her zaman
 * her işletmenin panosuna girebilir — bu şifre onun YERİNE değil, ONUNLA
 * BİRLİKTE çalışan ikinci bir yol.
 */
/**
 * Haftalık çalışma saati editörü (müşteri talebi A3).
 *
 * Misafir menüsünde "bugün 09:00 – 23:00 · şu an açık" yazabilmek için gün gün
 * veri gerekiyor. Gece yarısını aşan saatler destekleniyor (18:00 – 02:00 gibi):
 * kapanış açılıştan küçükse ertesi güne taşar, misafir tarafı bunu biliyor.
 *
 * "Pazartesiyi tüm haftaya uygula" düğmesi bilinçli: çoğu mekan aynı saatlerle
 * çalışıyor, 7 satırı tek tek doldurtmak gereksiz.
 */
function WeeklyHoursEditor({
  value,
  onChange,
}: {
  value: WeeklyHours;
  onChange: (next: WeeklyHours) => void;
}) {
  const week = value.length === 7 ? value : emptyWeek();

  const patch = (day: number, next: Partial<WeeklyHours[number]>) =>
    onChange(week.map((d) => (d.day === day ? { ...d, ...next } : d)));

  const applyMondayToAll = () => {
    const mon = week.find((d) => d.day === 1);
    if (!mon) return;
    onChange(week.map((d) => (d.day === 1 ? d : { ...d, closed: mon.closed, open: mon.open, close: mon.close })));
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-stone-700">Çalışma saatleri</span>
        <button
          type="button"
          onClick={applyMondayToAll}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Pazartesiyi tüm haftaya uygula
        </button>
      </div>
      <div className="rounded-xl border border-stone-200 divide-y divide-stone-100">
        {week.map((d) => (
          <div key={d.day} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="w-24 shrink-0 text-sm text-stone-700">{DAY_NAMES_TR[d.day]}</span>
            <label className="flex items-center gap-1.5 text-xs text-stone-500">
              <input
                type="checkbox"
                checked={d.closed}
                onChange={(e) => patch(d.day, { closed: e.target.checked })}
              />
              Kapalı
            </label>
            <input
              type="time"
              value={d.open ?? ''}
              disabled={d.closed}
              onChange={(e) => patch(d.day, { open: e.target.value || null })}
              aria-label={`${DAY_NAMES_TR[d.day]} açılış`}
              className="rounded-lg border border-stone-300 px-2 py-1 text-sm outline-none focus:border-brand-500 disabled:bg-stone-50 disabled:text-stone-400"
            />
            <span className="text-stone-400">–</span>
            <input
              type="time"
              value={d.close ?? ''}
              disabled={d.closed}
              onChange={(e) => patch(d.day, { close: e.target.value || null })}
              aria-label={`${DAY_NAMES_TR[d.day]} kapanış`}
              className="rounded-lg border border-stone-300 px-2 py-1 text-sm outline-none focus:border-brand-500 disabled:bg-stone-50 disabled:text-stone-400"
            />
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-stone-500">
        Gece yarısını aşan saatleri olduğu gibi yazabilirsin (örn. 18:00 – 02:00).
      </p>
    </div>
  );
}

function PanoPasswordCard({ venueId, initialHasPassword }: { venueId: string; initialHasPassword: boolean }) {
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [newPassword, setNewPassword] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(nextValue: string) {
    setState('saving');
    setError(null);
    try {
      const res = await fetch('/api/venue/pano-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId, newPassword: nextValue }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Kaydedilemedi.');
      setHasPassword(Boolean(body.hasPanoPassword));
      setNewPassword('');
      setState('done');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Beklenmeyen hata.');
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-stone-400">Pano girişi</h2>
      <p className="mb-4 text-sm text-stone-500">
        Bu işletmenin panosunu (istatistik, yayın durumu, QR) hesap açmadan yalnızca bu şifreyle
        açabilirsin — bağlantıyı işletme sahibine verebilirsin. Yönetici parolası her zaman ayrıca
        çalışır.
      </p>

      <div className="mb-3 flex items-center gap-2 text-sm">
        <span
          className={`h-2 w-2 rounded-full ${hasPassword ? 'bg-emerald-500' : 'bg-stone-300'}`}
          aria-hidden
        />
        <span className={hasPassword ? 'font-medium text-emerald-700' : 'text-stone-500'}>
          {hasPassword ? 'Pano şifresi tanımlı' : 'Pano şifresi henüz tanımlanmadı'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            if (state !== 'idle') setState('idle');
          }}
          placeholder={hasPassword ? 'Yeni pano şifresi' : 'Pano şifresi belirle'}
          className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <button
          type="button"
          onClick={() => void submit(newPassword)}
          disabled={!newPassword.trim() || state === 'saving'}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === 'saving' ? 'Kaydediliyor…' : hasPassword ? 'Değiştir' : 'Belirle'}
        </button>
        {hasPassword && (
          <button
            type="button"
            onClick={() => void submit('')}
            disabled={state === 'saving'}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
          >
            Kaldır
          </button>
        )}
      </div>
      {state === 'done' && <p className="mt-2 text-sm font-medium text-emerald-600">✓ Kaydedildi</p>}
      {state === 'error' && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </section>
  );
}

const inputCls =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500';

const ANNOUNCEMENT_ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const ANNOUNCEMENT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Karşılama popup'ının üst görseli. Dosya doğrudan Supabase Storage'a
 * (`venue-media` kovası, `{orgId}/announcements/…`) yüklenir; forma yalnız
 * ortaya çıkan public URL yazılır ve "Kaydet"e basılınca diğer alanlarla
 * birlikte gönderilir — yani yükleme tek başına bir şeyi değiştirmez,
 * kullanıcı vazgeçerse kaydetmeden çıkabilir.
 */
function AnnouncementImageField({
  orgId,
  url,
  onChange,
}: {
  orgId: string;
  url: string | null;
  onChange: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    if (!ANNOUNCEMENT_ACCEPTED.includes(file.type)) {
      setErr('JPG, PNG veya WebP yükleyin.');
      return;
    }
    if (file.size > ANNOUNCEMENT_MAX_BYTES) {
      setErr('Görsel 5 MB sınırını aşıyor.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClient();
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${orgId}/announcements/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from('venue-media')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw new Error('Yükleme başarısız. Bağlantınızı kontrol edin.');
      const {
        data: { publicUrl },
      } = supabase.storage.from('venue-media').getPublicUrl(path);
      onChange(publicUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Beklenmeyen hata.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Popup görseli" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl text-stone-300" aria-hidden>
              🖼
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
            >
              {busy ? 'Yükleniyor…' : url ? 'Değiştir' : 'Görsel yükle'}
            </button>
            {url && (
              <button
                type="button"
                onClick={() => onChange(null)}
                disabled={busy}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-400 transition hover:text-red-600 disabled:opacity-50"
              >
                Kaldır
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-stone-500">
            JPG, PNG veya WebP · en fazla 5 MB. Popup'ın üstünde geniş bir şerit olarak görünür.
          </p>
          {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ANNOUNCEMENT_ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-stone-400">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-600">
        {label}
        {required && <span className="text-brand-600"> *</span>}
      </span>
      {children}
    </label>
  );
}
