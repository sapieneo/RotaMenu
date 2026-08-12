'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from '@/components/ui/sheet';
import { Pressable } from '@/components/ui/pressable';
import { Icon } from '@/components/ui/icon';

/**
 * Satır taşma menüsü.
 *
 * NEDEN MENÜ: eskiden her satırda 5 kontrol yan yana duruyordu (Detay,
 * Menüyü aç, Panoya git, Sil, askı anahtarı) ve hepsi eşit görsel ağırlıktaydı.
 * Hiçbiri öne çıkmıyordu ve en tehlikelisi — kalıcı silme — gezinme
 * düğmelerinin yanındaydı. Artık birincil eylem ("Panoya git") satırda kalıyor,
 * gerisi buraya iniyor; yıkıcı işlem menünün en altında ve ayrılmış durumda.
 */
export function RowMenu({
  venueId,
  venueName,
  slug,
  suspended,
}: {
  venueId: string;
  venueName: string;
  slug: string | null;
  suspended: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Dışarı tıklama + Esc ile kapan.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <Pressable
        onClick={() => setOpen((v) => !v)}
        aria-label={`${venueName} için diğer işlemler`}
        aria-expanded={open}
        className="ros-touch flex items-center justify-center rounded-pill text-content-muted transition hover:bg-surface-sunken hover:text-content"
      >
        <Icon name="dots" size={20} />
      </Pressable>

      {open && (
        // §7: menü tetikleyicisinden çıkıyor — transform-origin sağ üstte.
        <div
          className="absolute right-0 top-full z-30 mt-xs w-56 origin-top-right overflow-hidden rounded-card border border-line bg-surface-raised py-xs shadow-lg"
          role="menu"
        >
          <a
            href={`/admin/venue/${venueId}`}
            role="menuitem"
            className="ros-pressable flex min-h-touch items-center gap-sm px-md text-footnote text-content transition hover:bg-surface-sunken"
          >
            <Icon name="chart" size={18} className="text-content-muted" />
            Detay ve istatistik
          </a>
          {slug && (
            <a
              href={`/m/${slug}`}
              target="_blank"
              rel="noreferrer"
              role="menuitem"
              className="ros-pressable flex min-h-touch items-center gap-sm px-md text-footnote text-content transition hover:bg-surface-sunken"
            >
              <Icon name="external" size={18} className="text-content-muted" />
              Misafir menüsünü aç
            </a>
          )}

          <div className="my-xs border-t border-line" />

          <SuspendItem venueId={venueId} initialSuspended={suspended} />

          <div className="my-xs border-t border-line" />

          <Pressable
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setConfirmDelete(true);
            }}
            className="flex w-full min-h-touch items-center gap-sm px-md text-left text-footnote text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <Icon name="trash" size={18} />
            Kalıcı olarak sil
          </Pressable>
        </div>
      )}

      <DeleteDialog
        open={confirmDelete}
        venueId={venueId}
        venueName={venueName}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}

/**
 * Askıya alma — menü içinde bir anahtar satırı. İçerik (görsel + metin)
 * burada DEĞİL; panelin üstündeki ortak "Askıya alma ekranı" kartında.
 */
function SuspendItem({ venueId, initialSuspended }: { venueId: string; initialSuspended: boolean }) {
  const router = useRouter();
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
      router.refresh();
    } catch {
      setSuspended(previous);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="flex min-h-touch cursor-pointer items-center gap-sm px-md text-footnote text-content transition hover:bg-surface-sunken">
      <input
        type="checkbox"
        checked={suspended}
        disabled={busy}
        onChange={(e) => void toggle(e.target.checked)}
        className="h-4 w-4 rounded border-line-strong text-amber-600 focus:ring-amber-500"
      />
      Menüyü askıya al
      {error && <span className="ml-auto text-caption text-red-600">hata</span>}
    </label>
  );
}

/**
 * Kalıcı silme. Onay penceresinde admin şifresi TEKRAR istenir — açık kalmış
 * bir sekmeden yanlışlıkla (ya da başkası tarafından) silinmesin.
 */
function DeleteDialog({
  open,
  venueId,
  venueName,
  onClose,
}: {
  open: boolean;
  venueId: string;
  venueName: string;
  onClose: () => void;
}) {
  const router = useRouter();
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
      setPassword('');
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Silinemedi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        setPassword('');
        setError(null);
        onClose();
      }}
      label="Kalıcı olarak sil"
      placement="center"
      panelClassName="w-full max-w-sm rounded-panel bg-surface-raised p-lg shadow-2xl"
    >
      <h3 className="text-heading font-semibold text-content">Kalıcı olarak sil</h3>
      <p className="mt-sm text-footnote text-content-secondary">
        <strong className="text-content">{venueName}</strong> ve bu işletmeye ait tüm menüler,
        ürünler, QR kodları ve istatistikler kalıcı olarak silinecek.{' '}
        <strong className="text-content">Bu işlem geri alınamaz.</strong>
      </p>
      <label className="mt-md block text-caption font-medium text-content-muted">
        Onaylamak için admin şifresini girin
      </label>
      <input
        type="password"
        value={password}
        autoFocus
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && password && !busy && void remove()}
        className="mt-xs w-full rounded-card border border-line-strong bg-surface px-md py-sm text-footnote text-content outline-none focus:border-brand-500"
      />
      {error && <p className="mt-sm text-caption font-medium text-red-600">{error}</p>}
      <div className="mt-md flex justify-end gap-sm">
        <Pressable
          onClick={() => {
            setPassword('');
            setError(null);
            onClose();
          }}
          disabled={busy}
          className="min-h-touch rounded-pill border border-line-strong px-md text-footnote font-medium text-content"
        >
          Vazgeç
        </Pressable>
        <Pressable
          onClick={() => void remove()}
          disabled={busy || !password}
          className="min-h-touch rounded-pill bg-red-600 px-md text-footnote font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? 'Siliniyor…' : 'Kalıcı olarak sil'}
        </Pressable>
      </div>
    </Sheet>
  );
}
