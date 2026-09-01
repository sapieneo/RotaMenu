'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type VenuePhoto = { id: string; url: string; caption: string | null; sortOrder: number };

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS = 24;

/**
 * MEKAN GÖRSELLERİ — müşteri talebi B7.
 *
 * Mekanın kendi fotoğrafları (salon, teras, dış cephe…). Misafir menüsünde
 * mekan kartındaki "Mekandan kareler" ikonundan açılan galeride gösterilir.
 * Ürün görselleriyle karıştırılmasın diye ayrı bir bölüm ve ayrı bir tablo
 * (`venue_photos`) — ürün görseli `items.image_url`'de kalıyor.
 *
 * Yazma doğrudan Supabase istemcisiyle yapılıyor: `venue_photos` RLS'i org
 * üyeliğini (editor+) zorluyor. `org_id` GÖNDERİLMİYOR — veritabanındaki
 * `app.fill_org_id` trigger'ı onu venue'dan türetiyor (bkz.
 * 20260826091819_org_id_parent_authority.sql). İstemcinin org_id yazması
 * çapraz-kiracı açığının ta kendisiydi.
 */
export function VenuePhotosManager({
  orgId,
  venueId,
  initial,
}: {
  orgId: string;
  venueId: string;
  initial: VenuePhoto[];
}) {
  const [photos, setPhotos] = useState<VenuePhoto[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    if (photos.length + files.length > MAX_PHOTOS) {
      setError(`En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsin.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let nextOrder = photos.reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1;
      const added: VenuePhoto[] = [];

      for (const file of files) {
        if (!ACCEPTED.includes(file.type)) throw new Error('JPG, PNG veya WebP yükleyebilirsin.');
        if (file.size > MAX_BYTES) throw new Error('Dosya 10 MB’ı aşamaz.');

        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${orgId}/venue/${crypto.randomUUID()}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from('venue-media')
          .upload(path, file, { contentType: file.type });
        if (upErr) throw new Error('Yükleme başarısız. Bağlantını kontrol et.');

        const {
          data: { publicUrl },
        } = supabase.storage.from('venue-media').getPublicUrl(path);

        const { data: row, error: insErr } = await supabase
          .from('venue_photos')
          .insert({ venue_id: venueId, url: publicUrl, sort_order: nextOrder })
          .select('id, url, caption, sort_order')
          .single();
        if (insErr || !row) throw new Error('Fotoğraf kaydedilemedi.');

        added.push({
          id: row.id as string,
          url: row.url as string,
          caption: (row.caption as string | null) ?? null,
          sortOrder: row.sort_order as number,
        });
        nextOrder += 1;
      }

      setPhotos((p) => [...p, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Beklenmeyen hata.');
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(id: string) {
    setBusy(true);
    setError(null);
    try {
      const { error: delErr } = await supabase.from('venue_photos').delete().eq('id', id);
      if (delErr) throw new Error('Silinemedi.');
      setPhotos((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Beklenmeyen hata.');
    } finally {
      setBusy(false);
    }
  }

  async function saveCaption(id: string, caption: string) {
    const value = caption.trim() || null;
    setPhotos((p) => p.map((x) => (x.id === id ? { ...x, caption: value } : x)));
    await supabase.from('venue_photos').update({ caption: value }).eq('id', id);
  }

  /** Sıra değişimi: iki satırın sort_order'ı takas edilir. */
  async function move(id: string, dir: -1 | 1) {
    const i = photos.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= photos.length) return;
    const a = photos[i];
    const b = photos[j];
    const next = [...photos];
    next[i] = { ...b, sortOrder: a.sortOrder };
    next[j] = { ...a, sortOrder: b.sortOrder };
    setPhotos(next);
    await Promise.all([
      supabase.from('venue_photos').update({ sort_order: b.sortOrder }).eq('id', a.id),
      supabase.from('venue_photos').update({ sort_order: a.sortOrder }).eq('id', b.id),
    ]);
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-3">
        <div>
          <h2 className="text-lg font-bold text-stone-800">Mekan görselleri</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Salon, teras, dış cephe… Misafir menüsünde “Mekandan kareler” galerisinde görünür.
            {photos.length > 0 && ` · ${photos.length} fotoğraf`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? 'Yükleniyor…' : '+ Fotoğraf ekle'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED.join(',')}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) void addFiles(files);
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {photos.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-500">
          Henüz mekan fotoğrafı yok. Eklersen misafir menüsünde bir galeri düğmesi çıkar.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-xl border border-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption ?? ''} className="h-28 w-full object-cover" />
              <div className="p-2">
                <input
                  defaultValue={p.caption ?? ''}
                  onBlur={(e) => void saveCaption(p.id, e.target.value)}
                  placeholder="Açıklama (isteğe bağlı)"
                  maxLength={120}
                  className="w-full rounded border border-transparent px-1 py-0.5 text-xs outline-none placeholder:text-stone-300 focus:border-stone-300"
                />
                <div className="mt-1 flex items-center justify-between">
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => void move(p.id, -1)}
                      disabled={i === 0 || busy}
                      aria-label="Sola al"
                      className="px-1 text-xs text-stone-400 transition hover:text-stone-700 disabled:opacity-30"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => void move(p.id, 1)}
                      disabled={i === photos.length - 1 || busy}
                      aria-label="Sağa al"
                      className="px-1 text-xs text-stone-400 transition hover:text-stone-700 disabled:opacity-30"
                    >
                      →
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removePhoto(p.id)}
                    disabled={busy}
                    className="text-xs font-medium text-stone-400 transition hover:text-red-600 disabled:opacity-50"
                  >
                    Kaldır
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
