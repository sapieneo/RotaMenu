'use client';

import { useRef, useState } from 'react';

type Props = {
  venueId: string;
  initialSuspended: boolean;
  initialMessage: string | null;
  initialImageUrl: string | null;
};

/**
 * Süper-admin panelinde satır başına "Menüyü askıya al" kontrolü.
 * İşaretlenince görsel + uyarı metni formu açılır; kaydedince misafir
 * menüsü (/m/[slug]) o görsel + metni gösterir. İşaret kaldırılınca menü
 * kaldığı yerden yayına döner — veri silinmez.
 */
export function SuspendControl({ venueId, initialSuspended, initialMessage, initialImageUrl }: Props) {
  const [isSuspended, setIsSuspended] = useState(initialSuspended);
  const [showForm, setShowForm] = useState(initialSuspended);
  const [message, setMessage] = useState(initialMessage ?? '');
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleCheckbox(next: boolean) {
    setError(null);
    if (next) {
      // Askıya alma niyeti — form açılır, gerçek kayıt "Kaydet" ile olur.
      setShowForm(true);
      return;
    }
    if (!isSuspended) {
      // Henüz kaydedilmemişti, sadece formu kapat.
      setShowForm(false);
      return;
    }
    // Zaten askıdaydı → doğrudan yayına al.
    setSaving(true);
    try {
      const form = new FormData();
      form.set('suspended', 'false');
      const res = await fetch(`/api/admin/venue/${venueId}/suspend`, { method: 'POST', body: form });
      if (!res.ok) throw new Error();
      setIsSuspended(false);
      setShowForm(false);
    } catch {
      setError('Güncellenemedi, tekrar dene.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('suspended', 'true');
      form.set('message', message);
      const file = fileRef.current?.files?.[0];
      if (file) form.set('image', file);
      const res = await fetch(`/api/admin/venue/${venueId}/suspend`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Kaydedilemedi.');
      setIsSuspended(true);
      if (data.imageUrl) setImageUrl(data.imageUrl);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  return (
    <div className="min-w-[220px]">
      <label className="flex items-center gap-2 text-xs font-semibold text-stone-700">
        <input
          type="checkbox"
          checked={showForm}
          disabled={saving}
          onChange={(e) => handleCheckbox(e.target.checked)}
          className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
        />
        Menüyü askıya al
        {isSuspended && (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">ASKIDA</span>
        )}
      </label>

      {showForm && (
        <div className="mt-2 space-y-2 rounded-xl border border-red-200 bg-red-50/60 p-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-stone-500">Uyarı görseli</label>
            {(preview ?? imageUrl) && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={preview ?? imageUrl ?? ''}
                alt="Askıya alma görseli önizleme"
                className="mb-1 h-16 w-28 rounded-lg border border-stone-200 object-cover"
              />
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="block w-full text-xs text-stone-600 file:mr-2 file:rounded-lg file:border-0 file:bg-stone-200 file:px-2 file:py-1 file:text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-stone-500">Uyarı yazısı</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Örn. Bu numarayı arayın: 0555 555 55 55"
              rows={2}
              className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-xs"
            />
          </div>
          {error && <p className="text-[11px] text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? 'Kaydediliyor…' : isSuspended ? 'Güncelle' : 'Askıya al ve kaydet'}
          </button>
        </div>
      )}
    </div>
  );
}
