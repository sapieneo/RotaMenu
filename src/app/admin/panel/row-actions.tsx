'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Satır başına askıya alma anahtarı. İçerik (görsel + metin) burada DEĞİL;
 * panelin üstündeki ortak "Askıya alma ekranı" kartında tanımlanır.
 */
export function SuspendToggle({
  venueId,
  initialSuspended,
}: {
  venueId: string;
  initialSuspended: boolean;
}) {
  const [suspended, setSuspended] = useState(initialSuspended);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(false);
    const previous = suspended;
    setSuspended(next); // iyimser
    try {
      const res = await fetch(`/api/admin/venue/${venueId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSuspended(previous);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-stone-700">
      <input
        type="checkbox"
        checked={suspended}
        disabled={busy}
        onChange={(e) => void toggle(e.target.checked)}
        className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
      />
      Askıya al
      {suspended && (
        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
          ASKIDA
        </span>
      )}
      {error && <span className="text-[10px] font-medium text-red-600">hata</span>}
    </label>
  );
}

/**
 * Kalıcı silme. Onay penceresinde admin şifresi TEKRAR istenir — açık kalmış
 * bir sekmeden yanlışlıkla (ya da başkası tarafından) silinmesin.
 */
export function DeleteVenueButton({
  venueId,
  venueName,
}: {
  venueId: string;
  venueName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/venue/${venueId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmName: venueName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Silinemedi.');
      setOpen(false);
      setPassword('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Silinemedi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
      >
        Sil
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">Kalıcı olarak sil</h3>
            <p className="mt-2 text-sm text-stone-600">
              <strong>{venueName}</strong> ve bu işletmeye ait tüm menüler, ürünler, QR kodları
              ve istatistikler kalıcı olarak silinecek. <strong>Bu işlem geri alınamaz.</strong>
            </p>
            <label className="mt-4 block text-xs font-medium text-stone-500">
              Onaylamak için admin şifresini girin
            </label>
            <input
              type="password"
              value={password}
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && password && !busy && void remove()}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setPassword('');
                  setError(null);
                }}
                disabled={busy}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy || !password}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? 'Siliniyor…' : 'Kalıcı olarak sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
