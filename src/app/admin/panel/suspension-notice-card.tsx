'use client';

import { useRef, useState } from 'react';

type Props = {
  initialMessage: string | null;
  initialImageUrl: string | null;
};

/**
 * Platform geneli askıya alma bildirimi — panelin en üstünde TEK kart.
 * Burada tanımlanan görsel + metin, askıya alınan bütün menülerde gösterilir.
 */
export function SuspensionNoticeCard({ initialMessage, initialImageUrl }: Props) {
  const [message, setMessage] = useState(initialMessage ?? '');
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save(clearImage = false) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const form = new FormData();
      form.set('message', message);
      if (clearImage) form.set('clearImage', 'true');
      const file = fileRef.current?.files?.[0];
      if (file && !clearImage) form.set('image', file);
      const res = await fetch('/api/admin/suspension-notice', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Kaydedilemedi.');
      setImageUrl(data.imageUrl ?? null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-5 rounded-2xl border border-stone-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <h2 className="text-sm font-bold text-stone-800">Askıya alma ekranı</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Askıya alınan bütün menülerde gösterilen ortak görsel ve yazı.
            {message ? ` Şu anki mesaj: “${message.slice(0, 60)}${message.length > 60 ? '…' : ''}”` : ' Henüz tanımlanmadı.'}
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-brand-600">
          {open ? 'Kapat' : 'Düzenle'}
        </span>
      </button>

      {open && (
        <div className="grid gap-4 border-t border-stone-100 px-5 py-4 sm:grid-cols-[200px_1fr]">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Uyarı görseli</label>
            {(preview ?? imageUrl) ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview ?? imageUrl ?? ''}
                  alt="Askıya alma görseli"
                  className="mb-2 h-24 w-full rounded-lg border border-stone-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => void save(true)}
                  disabled={saving}
                  className="mb-2 text-xs font-medium text-red-600 hover:underline"
                >
                  Görseli kaldır
                </button>
              </>
            ) : (
              <div className="mb-2 flex h-24 items-center justify-center rounded-lg border border-dashed border-stone-300 text-xs text-stone-400">
                Görsel yok
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPreview(f ? URL.createObjectURL(f) : null);
              }}
              className="block w-full text-xs text-stone-600 file:mr-2 file:rounded-lg file:border-0 file:bg-stone-200 file:px-2 file:py-1 file:text-xs"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Uyarı yazısı</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Örn. Bu numarayı arayın: 0555 454 54 54"
              rows={3}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-stone-800 disabled:opacity-60"
              >
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              {saved && <span className="text-xs font-medium text-emerald-600">✓ Kaydedildi</span>}
              {error && <span className="text-xs font-medium text-red-600">{error}</span>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
