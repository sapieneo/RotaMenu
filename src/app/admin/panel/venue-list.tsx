'use client';

import { useMemo, useState } from 'react';
import { Pressable } from '@/components/ui/pressable';
import { Icon } from '@/components/ui/icon';
import { RowMenu } from './row-actions';

export type AdminVenueRow = {
  menuId: string;
  menuName: string;
  venueId: string | null;
  venueName: string;
  slug: string | null;
  ownerEmail: string | null;
  contactPhone: string | null;
  planLabel: string;
  isPaid: boolean;
  itemCount: number;
  categoryCount: number;
  isPublished: boolean;
  isSuspended: boolean;
  createdAt: string;
  /** Denemesi bitmişse veya bitmek üzereyse kalan gün; değilse null. */
  trialDaysLeft: number | null;
};

type Filter = 'all' | 'live' | 'trial' | 'idle' | 'suspended';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'live', label: 'Canlı' },
  { id: 'trial', label: 'Denemesi bitiyor' },
  { id: 'idle', label: 'Boş' },
  { id: 'suspended', label: 'Askıda' },
];

/**
 * Süper-admin işletme listesi.
 *
 * Eskiden 8 sütunlu, 1180px minimum genişlikte bir tabloydu ve arama yoktu —
 * 6 kayıtla sorun değildi ama 60 müşteride kullanılamaz hâle gelirdi. Ajans
 * modunda buradaki asıl iş "müşteriyi bul → panosuna gir" olduğu için ekran
 * o iş etrafında kuruldu: üstte arama, satırda tek birincil eylem, gerisi
 * taşma menüsünde.
 */
export function VenueList({ rows }: { rows: AdminVenueRow[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr');
    return rows.filter((r) => {
      if (filter === 'live' && !r.isPublished) return false;
      if (filter === 'suspended' && !r.isSuspended) return false;
      if (filter === 'idle' && r.itemCount > 0) return false;
      if (filter === 'trial' && !(r.trialDaysLeft !== null && r.trialDaysLeft <= 7)) return false;
      if (!needle) return true;
      return [r.menuName, r.venueName, r.slug, r.ownerEmail, r.contactPhone]
        .filter(Boolean)
        .some((v) => v!.toLocaleLowerCase('tr').includes(needle));
    });
  }, [rows, query, filter]);

  return (
    <div>
      <div className="mb-md flex flex-wrap items-center gap-sm">
        <div className="flex min-w-[240px] flex-1 items-center gap-sm rounded-pill border border-line bg-surface-raised px-md">
          <Icon name="search" size={18} className="shrink-0 text-content-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="İşletme, e-posta, telefon veya menü adresi ara"
            aria-label="İşletme ara"
            className="min-h-touch w-full bg-transparent text-footnote text-content outline-none placeholder:text-content-muted"
          />
          {query && (
            <Pressable
              onClick={() => setQuery('')}
              aria-label="Aramayı temizle"
              className="shrink-0 text-content-muted hover:text-content"
            >
              <Icon name="plus" size={18} className="rotate-45" />
            </Pressable>
          )}
        </div>

        <div className="flex flex-wrap gap-xs">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onClick={() => setFilter(f.id)}
                aria-pressed={active}
                className={`min-h-touch rounded-pill px-md text-footnote font-medium transition ${
                  active
                    ? 'bg-content text-surface-raised'
                    : 'border border-line text-content-secondary hover:text-content'
                }`}
              >
                {f.label}
              </Pressable>
            );
          })}
        </div>
      </div>

      <p className="mb-sm text-caption text-content-muted">
        {shown.length} kayıt{shown.length !== rows.length && ` · toplam ${rows.length}`}
      </p>

      <div className="flex flex-col gap-sm">
        {shown.map((r) => (
          <div
            key={r.menuId}
            className={`flex items-center gap-md rounded-card border border-line bg-surface-raised p-md ${
              r.itemCount === 0 ? 'opacity-70' : ''
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-sm">
                <span className="font-semibold text-content">
                  {r.venueName || r.menuName || 'İsimsiz işletme'}
                </span>
                <StatusDot published={r.isPublished} suspended={r.isSuspended} />
                <span
                  className={`rounded-pill px-sm py-0.5 text-caption font-medium ${
                    r.isPaid
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-100'
                      : 'bg-surface-sunken text-content-secondary'
                  }`}
                >
                  {r.planLabel}
                </span>
                {r.trialDaysLeft !== null && r.trialDaysLeft <= 7 && (
                  <span className="rounded-pill bg-amber-100 px-sm py-0.5 text-caption font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                    {r.trialDaysLeft <= 0 ? 'Deneme bitti' : `Deneme ${r.trialDaysLeft} gün`}
                  </span>
                )}
              </div>
              <p className="mt-xs truncate text-footnote text-content-secondary">
                {r.ownerEmail ?? 'Anonim kullanıcı'}
                {r.contactPhone && ` · ${r.contactPhone}`}
                {' · '}
                {r.itemCount > 0 ? `${r.itemCount} ürün · ${r.categoryCount} kategori` : 'ürün yok'}
                {r.slug && ` · /m/${r.slug}`}
              </p>
            </div>

            {r.venueId && (
              <>
                <a
                  href={`/studyo/pano?venue=${r.venueId}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`ros-pressable inline-flex min-h-touch shrink-0 items-center rounded-pill px-md text-footnote font-semibold transition active:scale-[0.98] ${
                    r.itemCount > 0
                      ? 'bg-brand-600 text-white hover:bg-brand-700'
                      : 'border border-line-strong text-content'
                  }`}
                >
                  Panoya git
                </a>
                <RowMenu
                  venueId={r.venueId}
                  venueName={r.venueName || r.menuName || 'Bu işletme'}
                  slug={r.slug}
                  suspended={r.isSuspended}
                />
              </>
            )}
          </div>
        ))}

        {shown.length === 0 && (
          <div className="rounded-card border border-line bg-surface-raised py-2xl text-center">
            <p className="text-footnote text-content-secondary">
              {rows.length === 0
                ? 'Henüz oluşturulmuş bir menü yok.'
                : 'Aramanla eşleşen kayıt yok.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Durum: renk + metin birlikte — renk körlüğünde tek başına renk yetmez. */
function StatusDot({ published, suspended }: { published: boolean; suspended: boolean }) {
  const [color, label] = suspended
    ? ['bg-red-500', 'Askıda']
    : published
    ? ['bg-emerald-500', 'Canlı']
    : ['bg-line-strong', 'Taslak'];
  return (
    <span className="inline-flex items-center gap-xs text-footnote text-content-secondary">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
