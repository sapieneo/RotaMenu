'use client';

import { useState } from 'react';

/**
 * Panonun üst şeridindeki CANLI/TASLAK rozeti + Yayınla düğmesi. Mantık
 * `studyo/ayarlar/venue-settings-form.tsx`'teki PublishCard ile birebir aynı
 * (aynı önkoşullar, aynı `/api/venue` PATCH'i) — kullanıcı artık yayınlamak
 * için Ayarlar'a gitmek zorunda değil, panodan tek tıkla yapabiliyor.
 */
export function PublishControl({
  venueId,
  initialPublished,
  pendingCount,
  trialExpired,
  needsAccount,
}: {
  venueId: string;
  initialPublished: boolean;
  pendingCount: number;
  trialExpired: boolean;
  needsAccount: boolean;
}) {
  const [isPublished, setIsPublished] = useState(initialPublished);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    if (next && pendingCount > 0) {
      const ok = window.confirm(
        `${pendingCount} ürünün alerjen onayı bekliyor. Onaylanmamış ürünlerin alerjen ` +
          'bilgisi misafire GÖSTERİLMEZ.\n\nYine de yayınlamak istiyor musun?'
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/venue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId, isPublished: next }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Güncellenemedi.');
      setIsPublished(Boolean(body.isPublished));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Beklenmeyen hata.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${
          isPublished ? 'bg-emerald-600' : 'bg-amber-500'
        }`}
      >
        {isPublished ? 'CANLI' : 'TASLAK'}
      </span>

      {!isPublished && trialExpired ? (
        <a
          href={`/studyo/plan?venue=${encodeURIComponent(venueId)}`}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
        >
          Aboneliği başlat
        </a>
      ) : !isPublished && needsAccount ? (
        <a
          href="/studyo/hesap"
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
        >
          Önce kaydını tamamla
        </a>
      ) : (
        <button
          type="button"
          onClick={() => void toggle(!isPublished)}
          disabled={busy}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
            isPublished
              ? 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {busy ? '…' : isPublished ? 'Yayından kaldır' : 'Yayınla'}
        </button>
      )}

      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </div>
  );
}
