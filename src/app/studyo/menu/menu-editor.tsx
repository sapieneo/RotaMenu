'use client';

import { useState } from 'react';
import { currencySymbol } from '@/lib/currency';

export type EditorItem = {
  id: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  price: number | null;
  caloriesKcal: number | null;
  isFeatured: boolean;
};

export type EditorCategory = { id: string; name: string; items: EditorItem[] };
export type EditorMenu = { id: string; name: string; icon: string | null; categories: EditorCategory[] };

/**
 * MENÜYÜ DÜZENLE — tek tek ürün girişi (müşteri talebi B1) ve ürün başına
 * AI açıklaması (B4).
 *
 * Taslak editöründen (studyo/[id]/draft-editor.tsx) farkı: orası bir YÜKLEME
 * akışının parçası ve "Onayla ve Kaydet" dediğinde o yüklemenin kategorilerini
 * silip yeniden yazıyor. Burası CANLI menüyü satır satır düzenler; her kayıt
 * yalnız o ürüne dokunur.
 *
 * Not: "Menüde göster/gizle" anahtarı bilinçli olarak YOK. Gizlenen ürün şu an
 * RLS'te değil yalnız sorguda süzülüyor (bkz. güvenlik raporu §2), yani
 * "gizli" ürün API'den okunabiliyor. Anahtar, o boşluk kapandıktan sonra
 * eklenmeli — aksi halde kullanıcıya tutmadığımız bir söz vermiş oluruz.
 */
export function MenuEditor({
  menus,
  venueId,
  slug,
  currency,
}: {
  menus: EditorMenu[];
  venueId: string;
  slug: string;
  currency: string;
}) {
  const [data, setData] = useState<EditorMenu[]>(menus);
  const [activeMenuId, setActiveMenuId] = useState(menus[0]?.id ?? '');
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [addingIn, setAddingIn] = useState<string | null>(null);

  const activeMenu = data.find((m) => m.id === activeMenuId) ?? data[0];
  const sym = currencySymbol(currency);

  function replaceItem(categoryId: string, item: EditorItem) {
    setData((ms) =>
      ms.map((m) => ({
        ...m,
        categories: m.categories.map((c) =>
          c.id !== categoryId ? c : { ...c, items: c.items.map((it) => (it.id === item.id ? item : it)) }
        ),
      }))
    );
  }

  function appendItem(categoryId: string, item: EditorItem) {
    setData((ms) =>
      ms.map((m) => ({
        ...m,
        categories: m.categories.map((c) => (c.id !== categoryId ? c : { ...c, items: [...c.items, item] })),
      }))
    );
  }

  function dropItem(categoryId: string, itemId: string) {
    setData((ms) =>
      ms.map((m) => ({
        ...m,
        categories: m.categories.map((c) =>
          c.id !== categoryId ? c : { ...c, items: c.items.filter((it) => it.id !== itemId) }
        ),
      }))
    );
  }

  const totalItems = data.reduce(
    (n, m) => n + m.categories.reduce((k, c) => k + c.items.length, 0),
    0
  );

  if (data.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold">Henüz menün yok</h1>
        <p className="text-stone-600">Önce menü fotoğrafını yükle; sonra buradan tek tek ürün ekleyip düzenleyebilirsin.</p>
        <a href="/studyo" className="mt-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow">
          Menü oluştur
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-600">Menüyü düzenle</p>
          <h1 className="mt-1 text-2xl font-bold">Ürünler</h1>
          <p className="mt-1 text-sm text-stone-500">
            {totalItems} ürün · fiyat, açıklama ve kalori bilgisini buradan tek tek değiştirebilirsin.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={`/m/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
          >
            👁 Misafir menüsünü önizle
          </a>
          <a
            href={`/studyo/pano?venue=${encodeURIComponent(venueId)}`}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            ← Panoya dön
          </a>
        </div>
      </header>

      {data.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {data.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveMenuId(m.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                m.id === activeMenu?.id
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-stone-300 text-stone-700 hover:bg-stone-50'
              }`}
            >
              {m.icon ? `${m.icon} ` : ''}
              {m.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-5">
        {activeMenu?.categories.map((cat) => (
          <section key={cat.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-stone-800">{cat.name}</h2>
                <p className="mt-0.5 text-xs text-stone-500">{cat.items.length} ürün</p>
              </div>
              <button
                type="button"
                onClick={() => setAddingIn(addingIn === cat.id ? null : cat.id)}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
              >
                {addingIn === cat.id ? 'Vazgeç' : '+ Ürün ekle'}
              </button>
            </div>

            {addingIn === cat.id && (
              <NewItemForm
                categoryId={cat.id}
                sym={sym}
                onCancel={() => setAddingIn(null)}
                onCreated={(item) => {
                  appendItem(cat.id, item);
                  setAddingIn(null);
                }}
              />
            )}

            <ul className="divide-y divide-stone-100">
              {cat.items.length === 0 && addingIn !== cat.id && (
                <li className="py-4 text-sm text-stone-500">Bu kategoride henüz ürün yok.</li>
              )}
              {cat.items.map((it) => (
                <ItemRow
                  key={it.id}
                  item={it}
                  sym={sym}
                  open={openItemId === it.id}
                  onToggle={() => setOpenItemId(openItemId === it.id ? null : it.id)}
                  onSaved={(next) => replaceItem(cat.id, next)}
                  onDeleted={() => {
                    dropItem(cat.id, it.id);
                    setOpenItemId(null);
                  }}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

const priceText = (p: number | null) => (p == null ? '' : Number.isInteger(p) ? String(p) : p.toFixed(2));

/** Yeni ürün formu — kategori başlığının hemen altında açılır. */
function NewItemForm({
  categoryId,
  sym,
  onCancel,
  onCreated,
}: {
  categoryId: string;
  sym: string;
  onCancel: () => void;
  onCreated: (item: EditorItem) => void;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError('Ürün adı gerekli.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/menu/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          name: name.trim(),
          description: description.trim() || null,
          price: price.trim() === '' ? null : Number(price.replace(',', '.')),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Ürün eklenemedi.');
      const raw = body.item;
      onCreated({
        id: raw.id,
        name: raw.name,
        description: raw.description ?? null,
        ingredients: raw.ingredients ?? null,
        price: raw.price == null ? null : Number(raw.price),
        caloriesKcal: raw.calories_kcal ?? null,
        isFeatured: Boolean(raw.is_featured),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Beklenmeyen hata.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="my-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
      <div className="flex flex-wrap gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ürün adı"
          className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <label className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2 focus-within:border-brand-500">
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Fiyat"
            className="w-20 bg-transparent py-2 text-right text-sm outline-none"
          />
          <span className="text-xs text-stone-400">{sym}</span>
        </label>
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Açıklama (isteğe bağlı — sonra AI ile de yazdırabilirsin)"
        rows={2}
        className="mt-2 w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? 'Ekleniyor…' : 'Ekle'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-stone-300 px-4 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-white"
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}

/** Tek ürün satırı — tıklayınca düzenleme alanları açılır. */
function ItemRow({
  item,
  sym,
  open,
  onToggle,
  onSaved,
  onDeleted,
}: {
  item: EditorItem;
  sym: string;
  open: boolean;
  onToggle: () => void;
  onSaved: (item: EditorItem) => void;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState<EditorItem>(item);
  const [busy, setBusy] = useState<'save' | 'ai' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    draft.name !== item.name ||
    (draft.description ?? '') !== (item.description ?? '') ||
    (draft.ingredients ?? '') !== (item.ingredients ?? '') ||
    draft.price !== item.price ||
    draft.caloriesKcal !== item.caloriesKcal ||
    draft.isFeatured !== item.isFeatured;

  async function save() {
    setBusy('save');
    setError(null);
    try {
      const res = await fetch('/api/menu/item', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          name: draft.name,
          description: draft.description,
          ingredients: draft.ingredients,
          price: draft.price,
          caloriesKcal: draft.caloriesKcal,
          isFeatured: draft.isFeatured,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Kaydedilemedi.');
      onSaved(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Beklenmeyen hata.');
    } finally {
      setBusy(null);
    }
  }

  /** AI açıklamasını üretir ama KAYDETMEZ — kullanıcı görüp düzenleyebilsin. */
  async function describe() {
    setBusy('ai');
    setError(null);
    try {
      const res = await fetch('/api/menu/item/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Açıklama üretilemedi.');
      setDraft((d) => ({ ...d, description: body.description as string }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Beklenmeyen hata.');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm(`“${item.name}” silinsin mi? Bu işlem geri alınamaz.`)) return;
    setBusy('delete');
    setError(null);
    try {
      const res = await fetch('/api/menu/item', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Silinemedi.');
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Beklenmeyen hata.');
      setBusy(null);
    }
  }

  return (
    <li className="py-3">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-stone-800">
            {item.isFeatured && <span className="mr-1 text-amber-500">★</span>}
            {item.name}
          </span>
          {item.description && (
            <span className="mt-0.5 block truncate text-xs text-stone-500">{item.description}</span>
          )}
        </span>
        <span className="shrink-0 text-sm text-stone-600">
          {item.price != null ? `${priceText(item.price)} ${sym}` : '—'}
        </span>
        <span className="shrink-0 text-stone-400">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              aria-label="Ürün adı"
              className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <label className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2 focus-within:border-brand-500">
              <input
                inputMode="decimal"
                value={priceText(draft.price)}
                onChange={(e) => {
                  const v = e.target.value.replace(',', '.');
                  setDraft((d) => ({
                    ...d,
                    price: v === '' ? null : Number.isNaN(Number(v)) ? d.price : Number(v),
                  }));
                }}
                aria-label="Fiyat"
                className="w-20 bg-transparent py-2 text-right text-sm outline-none"
              />
              <span className="text-xs text-stone-400">{sym}</span>
            </label>
            <label className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2 focus-within:border-brand-500">
              <input
                inputMode="numeric"
                value={draft.caloriesKcal ?? ''}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  setDraft((d) => ({ ...d, caloriesKcal: v === '' ? null : parseInt(v, 10) }));
                }}
                aria-label="Kalori"
                className="w-16 bg-transparent py-2 text-right text-sm outline-none"
              />
              <span className="text-xs text-stone-400">kcal</span>
            </label>
          </div>

          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-stone-500">Açıklama</label>
              <button
                type="button"
                onClick={() => void describe()}
                disabled={busy !== null}
                title="Ürün adına ve içindekilere bakarak kısa bir açıklama yazar. Kaydetmeden önce düzenleyebilirsin."
                className="rounded-lg border border-brand-300 px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
              >
                {busy === 'ai' ? 'Yazılıyor…' : '✨ AI ile yaz'}
              </button>
            </div>
            <textarea
              value={draft.description ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value || null }))}
              rows={2}
              placeholder="Misafirin göreceği kısa açıklama"
              className="w-full resize-none rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>

          <div className="mt-2">
            <label className="mb-1 block text-xs font-medium text-stone-500">İçindekiler</label>
            <textarea
              value={draft.ingredients ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, ingredients: e.target.value || null }))}
              rows={1}
              placeholder="Virgülle: un, süt, yumurta"
              className="w-full resize-none rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <p className="mt-1 text-xs text-stone-500">
              İçindekileri yazmak AI açıklamasını ve alerjen önerisini belirgin biçimde iyileştirir.
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, isFeatured: !d.isFeatured }))}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                draft.isFeatured
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-stone-300 text-stone-600 hover:bg-white'
              }`}
            >
              {draft.isFeatured ? '★ Şefin Seçtikleri’nde' : '☆ Şefin Seçtikleri’ne ekle'}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy !== null || !dirty}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {busy === 'save' ? 'Kaydediliyor…' : dirty ? 'Kaydet' : 'Kaydedildi'}
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy !== null}
              className="ml-auto rounded-lg px-2 py-1.5 text-xs font-medium text-stone-400 transition hover:text-red-600 disabled:opacity-50"
            >
              {busy === 'delete' ? 'Siliniyor…' : 'Ürünü sil'}
            </button>
          </div>

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </li>
  );
}
