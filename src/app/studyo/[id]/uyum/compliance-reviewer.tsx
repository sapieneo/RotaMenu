'use client';

import { useMemo, useState } from 'react';
import { ALLERGENS, type AllergenCode } from '@/lib/allergens';
import { DIETARY, type DietaryCode } from '@/lib/dietary';
import { ALLERGEN_CODES, DIETARY_CODES } from '@/lib/schemas/menu';
import { matchNutrition, kcalForGrams, suggestGrams } from '@/lib/nutrition';

export type ReviewItem = {
  id: string;
  name: string;
  /** Gruplama kimlikle yapılır — aynı ada sahip iki kategori birleşmesin diye. */
  categoryId: string;
  categoryName: string;
  price: number | null;
  calories: number | null;
  ingredients: string | null;
  allergenCodes: string[];
  dietaryCodes: string[];
  confirmed: boolean;
  caloriesConfirmed: boolean;
};

type ItemState = ReviewItem & {
  selected: Set<string>;
  selectedDietary: Set<string>;
  caloriesInput: string;
  ingredientTokens: string[];
  newIngredient: string;
  showCalc: boolean;
  saving: boolean;
  error: string | null;
};

/** EU (14) ve TR (alkol/domuz) alerjenlerini region'a göre ayır. */
const EU_ALLERGENS = ALLERGEN_CODES.filter(
  (c) => ALLERGENS[c as AllergenCode].region === 'EU'
);
const TR_ALLERGENS = ALLERGEN_CODES.filter(
  (c) => ALLERGENS[c as AllergenCode].region === 'TR'
);

/** "a, b, c" → ["a","b","c"] (boşları at). */
function splitIngredients(s: string | null): string[] {
  if (!s) return [];
  return s
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Yapay zekâ çıkarımının gözden kaçan hataları. Uyum ekranı alerjen/kaloriye
 * odaklandığı için fiyat ve yapı hataları onaydan sessizce geçebiliyordu
 * (canlı bir menüde "Soda 350 TL" — aynı ürün başka kategoride 40 TL — bu
 * şekilde yayına çıkmıştı). Burada üç ucuz sinyal arıyoruz.
 */
type DataIssue = { kind: 'price-missing' | 'price-outlier' | 'duplicate-category'; text: string };

function findDataIssues(items: ReviewItem[]): DataIssue[] {
  const issues: DataIssue[] = [];

  const noPrice = items.filter((item) => item.price == null);
  if (noPrice.length) {
    issues.push({
      kind: 'price-missing',
      text: `${noPrice.length} üründe fiyat yok — misafir menüsünde fiyatsız görünürler: ${noPrice
        .slice(0, 6)
        .map((item) => item.name)
        .join(', ')}${noPrice.length > 6 ? ` ve ${noPrice.length - 6} tane daha` : ''}.`,
    });
  }

  // Aynı ada sahip ürünler arasında 5 kattan fazla fiyat farkı → büyük ihtimalle
  // basamak hatası (35 yerine 350 okunması gibi).
  const byName = new Map<string, ReviewItem[]>();
  for (const item of items) {
    if (item.price == null) continue;
    const key = item.name.trim().toLocaleLowerCase('tr');
    byName.set(key, [...(byName.get(key) ?? []), item]);
  }
  for (const sameName of byName.values()) {
    if (sameName.length < 2) continue;
    const prices = sameName.map((item) => item.price!);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min > 0 && max / min >= 5) {
      issues.push({
        kind: 'price-outlier',
        text: `"${sameName[0]!.name}" iki yerde çok farklı fiyatlarla geçiyor (${min} TL ve ${max} TL). Basamak hatası olabilir.`,
      });
    }
  }

  const catNames = new Map<string, Set<string>>();
  for (const item of items) {
    const key = item.categoryName.trim().toLocaleLowerCase('tr');
    catNames.set(key, new Set([...(catNames.get(key) ?? []), item.categoryId]));
  }
  for (const [name, ids] of catNames) {
    if (ids.size > 1) {
      issues.push({
        kind: 'duplicate-category',
        text: `"${name}" adında ${ids.size} ayrı kategori var — menüde tekrar eden başlık olarak görünür.`,
      });
    }
  }

  return issues;
}

/** Mevzuat takvimi — Tarım ve Orman Bakanlığı, menüde 14 alerjen + kalori. */
const REG_MILESTONES = [
  { dateMs: Date.parse('2026-07-01T00:00:00+03:00'), displayDate: '01.07.2026', label: 'Ulusal zincirler · içerik ve enerji' },
  { dateMs: Date.parse('2026-12-31T00:00:00+03:00'), displayDate: '31.12.2026', label: 'Aynı ilde 3+ şube · içerik ve enerji' },
  { dateMs: Date.parse('2026-12-31T00:00:00+03:00'), displayDate: '31.12.2026', label: 'Diğer işletmeler · içerik bilgisi' },
  { dateMs: Date.parse('2027-12-31T00:00:00+03:00'), displayDate: '31.12.2027', label: 'Diğer işletmeler · enerji bilgisi' },
];

export function ComplianceReviewer({
  ingestionId,
  venueId,
  venueName,
  previewSlug,
  items: initial,
}: {
  ingestionId: string;
  venueId: string;
  venueName: string;
  previewSlug: string | null;
  items: ReviewItem[];
}) {
  const [items, setItems] = useState<ItemState[]>(() =>
    initial.map((it) => ({
      ...it,
      selected: new Set(it.allergenCodes),
      selectedDietary: new Set(it.dietaryCodes),
      caloriesInput: it.calories != null ? String(it.calories) : '',
      ingredientTokens: splitIngredients(it.ingredients),
      newIngredient: '',
      showCalc: false,
      saving: false,
      error: null,
    }))
  );
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Stüdyo bağlantıları işletme kimliğini TAŞIMALI: birden çok işletmesi olan
  // kullanıcı (ve admin panelinden gelen süper-admin) aksi halde yanlış —
  // ya da hiç — işletmeye düşüyor.
  const venueLink = (path: string) => `${path}?venue=${encodeURIComponent(venueId)}`;
  const dataIssues = useMemo(() => findDataIssues(initial), [initial]);
  const confirmedCount = items.filter((i) => i.confirmed).length;
  const total = items.length;
  const pct = total ? Math.round((confirmedCount / total) * 100) : 0;
  const pending = items.filter((i) => !i.confirmed);
  const auditReady = total > 0 && pending.length === 0;

  function patch(id: string, fn: (s: ItemState) => ItemState) {
    setItems((arr) => arr.map((s) => (s.id === id ? fn(s) : s)));
  }

  function toggleAllergen(id: string, code: string) {
    patch(id, (s) => {
      const next = new Set(s.selected);
      next.has(code) ? next.delete(code) : next.add(code);
      return { ...s, selected: next };
    });
  }

  function toggleDietary(id: string, code: string) {
    patch(id, (s) => {
      const next = new Set(s.selectedDietary);
      next.has(code) ? next.delete(code) : next.add(code);
      return { ...s, selectedDietary: next };
    });
  }

  function addIngredient(id: string) {
    patch(id, (s) => {
      const v = s.newIngredient.trim();
      if (!v) return s;
      if (s.ingredientTokens.some((t) => t.toLocaleLowerCase('tr') === v.toLocaleLowerCase('tr')))
        return { ...s, newIngredient: '' };
      return { ...s, ingredientTokens: [...s.ingredientTokens, v], newIngredient: '' };
    });
  }

  function removeIngredient(id: string, idx: number) {
    patch(id, (s) => ({
      ...s,
      ingredientTokens: s.ingredientTokens.filter((_, i) => i !== idx),
    }));
  }

  async function confirm(item: ItemState) {
    patch(item.id, (s) => ({ ...s, saving: true, error: null }));
    // İçindekiler token'larını tek metne çevir; kaloriyi parse et.
    const ingredientsText = item.ingredientTokens.join(', ');
    const caloriesNum =
      item.caloriesInput.trim() === '' ? null : Number(item.caloriesInput.trim());
    const caloriesOk = caloriesNum != null && Number.isFinite(caloriesNum);
    try {
      const res = await fetch('/api/compliance/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          allergenCodes: Array.from(item.selected),
          dietaryCodes: Array.from(item.selectedDietary),
          caloriesOk,
          calories: caloriesOk ? Math.round(caloriesNum!) : null,
          ingredients: ingredientsText || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Onay başarısız.');
      patch(item.id, (s) => ({
        ...s,
        confirmed: true,
        caloriesConfirmed: caloriesOk,
        calories: caloriesOk ? Math.round(caloriesNum!) : s.calories,
        ingredients: ingredientsText || s.ingredients,
        saving: false,
      }));
      return true;
    } catch (err) {
      patch(item.id, (s) => ({
        ...s,
        saving: false,
        error: err instanceof Error ? err.message : 'Beklenmeyen hata.',
      }));
      return false;
    }
  }

  async function confirmAll() {
    const pendingItems = items.filter((item) => !item.confirmed && !item.saving);
    if (!pendingItems.length) return;

    setBulkSaving(true);
    setBulkError(null);
    let failedCount = 0;
    for (const item of pendingItems) {
      const confirmed = await confirm(item);
      if (!confirmed) failedCount += 1;
    }
    setBulkSaving(false);
    if (failedCount) {
      setBulkError(`${failedCount} ürün onaylanamadı. İlgili ürünlerdeki hata mesajını kontrol edip tekrar deneyin.`);
    }
  }

  async function revert(item: ItemState) {
    patch(item.id, (s) => ({ ...s, saving: true, error: null }));
    try {
      const res = await fetch('/api/compliance/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, revert: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Geri alma başarısız.');
      patch(item.id, (s) => ({ ...s, confirmed: false, caloriesConfirmed: false, saving: false }));
    } catch (err) {
      patch(item.id, (s) => ({
        ...s,
        saving: false,
        error: err instanceof Error ? err.message : 'Beklenmeyen hata.',
      }));
    }
  }

  // Gruplama kategori KİMLİĞİyle yapılır. Ada göre gruplanırsa aynı isimli
  // iki farklı kategori (ör. iki ayrı "İçecekler") tek başlıkta birleşiyordu.
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: ItemState[] }>();
    for (const it of items) {
      if (!map.has(it.categoryId)) map.set(it.categoryId, { name: it.categoryName, items: [] });
      map.get(it.categoryId)!.items.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-600">Adım 3 / 5 · Uyum onayı</p>
          <h1 className="mt-1 text-2xl font-bold">{venueName} · Alerjen &amp; kalori onayı</h1>
          <p className="mt-1 text-sm text-stone-500">
            Her ürünün alerjenlerini onayla. Misafir menüsünde <b>yalnızca onayladığın</b> bilgi görünür.
          </p>
        </div>
        <a
          href={venueLink('/studyo/pano')}
          className="shrink-0 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          📊 Panoya git
        </a>
      </header>

      {/* İlerleme + denetim durumu */}
      <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Denetime hazırlık</span>
          <span className={auditReady ? 'font-semibold text-emerald-600' : 'text-stone-500'}>
            {confirmedCount} / {total} ürün onaylı
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-100">
          <div
            className={`h-full rounded-full transition-all ${auditReady ? 'bg-emerald-500' : 'bg-brand-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {auditReady ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              ✓ Menü denetime hazır
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
              {pending.length} ürün henüz incelenmedi
            </span>
          )}
          {pending.length > 0 && (
            <button
              type="button"
              onClick={() => void confirmAll()}
              disabled={bulkSaving || items.some((item) => item.saving)}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkSaving ? `Onaylanıyor…` : `✓ Hepsini onayla (${pending.length})`}
            </button>
          )}
          <a
            href={venueLink('/studyo/gorseller')}
            className="ml-auto rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            🖼 Görseller
          </a>
          <a
            href={venueLink('/studyo/ayarlar')}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            ⚙ İşletme ayarları
          </a>
          {previewSlug && (
            <a
              href={`/m/${previewSlug}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
            >
              👁 Misafir menüsünü önizle
            </a>
          )}
          <a
            href={`/api/compliance/report?venueId=${venueId}`}
            className={`${previewSlug ? '' : 'ml-auto '}rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50`}
          >
            ⬇ Uyum raporunu indir (PDF)
          </a>
        </div>
        {bulkError && <p className="mt-3 text-sm font-medium text-red-600">{bulkError}</p>}
      </div>

      {/* Sıradaki adım — burada olmadan önce kullanıcı "4/4 ne?" diye
          takılıyordu; onay bitince yayınlama adımına açıkça yönlendirir. */}
      {auditReady ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-medium text-emerald-800">
            ✓ Tüm ürünler onaylandı — sıradaki ve son adım menünü yayınlamak.
          </p>
          <a
            href={venueLink('/studyo/ayarlar')}
            className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Adım 4/5: Menüyü yayınla →
          </a>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-dashed border-stone-300 px-4 py-3 text-sm text-stone-500">
          Adım 4/5 (yayınlama) burada açılır — önce yukarıdaki {pending.length} ürünü onayla.
        </div>
      )}

      {/* Yapay zekâ çıkarımında gözden kaçmış olabilecek veri hataları */}
      {dataIssues.length > 0 && (
        <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
          <p className="text-sm font-semibold text-orange-900">
            ⚠ Kontrol etmek isteyebileceğin {dataIssues.length} nokta
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-orange-800">
            {dataIssues.map((issue, index) => (
              <li key={index} className="flex gap-2">
                <span aria-hidden>·</span>
                <span>{issue.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-orange-700">
            Bunlar yapay zekânın menünü okurken yapmış olabileceği hatalar. Düzeltmek için{' '}
            <a href={`/studyo/${ingestionId}`} className="font-semibold underline">
              taslak düzenleme ekranına
            </a>{' '}
            dönebilirsin.
          </p>
        </div>
      )}

      {/* Mevzuat takvimi */}
      <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <p className="font-medium">Yönetmelik takvimi — menüde 14 alerjen + kalori zorunluluğu</p>
        <ul className="mt-1 space-y-0.5">
          {REG_MILESTONES.map((m) => {
            const active = Date.now() >= m.dateMs;
            return (
              <li key={m.label} className="flex items-center gap-2">
                <span className={active ? 'font-semibold text-emerald-700' : 'text-sky-800'}>
                  {m.displayDate}
                </span>
                <span>· {m.label}</span>
                {active && <span className="text-xs text-emerald-600">(yürürlükte)</span>}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Eksik incelemeli ürünler kısayolu */}
      {pending.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">İncelenmesi gereken {pending.length} ürün:</p>
          <p className="mt-1">{pending.map((p) => p.name).join(' · ')}</p>
        </div>
      )}

      {/* Ürün listesi */}
      <div className="space-y-6">
        {grouped.map(([catId, group]) => (
          <section key={catId} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">{group.name}</h2>
            <ul className="mt-3 space-y-3">
              {group.items.map((item: ItemState) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  patch={patch}
                  toggleAllergen={toggleAllergen}
                  toggleDietary={toggleDietary}
                  addIngredient={addIngredient}
                  removeIngredient={removeIngredient}
                  confirm={confirm}
                  revert={revert}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm">
        <a href={`/studyo/${ingestionId}`} className="text-stone-500 hover:text-stone-700">
          ← Taslağa dön
        </a>
        {auditReady && (
          <a
            href={venueLink('/studyo/ayarlar')}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Adım 4/5: Menüyü yayınla →
          </a>
        )}
      </div>
    </main>
  );
}

/** Tek ürün kartı: başlık, kalori (düzenlenebilir + hesaplayıcı), içindekiler,
    alerjenler (EU oval kutu), Alkol/Domuz (ayrı kutu), diyet rozetleri, onay. */
function ItemCard({
  item,
  patch,
  toggleAllergen,
  toggleDietary,
  addIngredient,
  removeIngredient,
  confirm,
  revert,
}: {
  item: ItemState;
  patch: (id: string, fn: (s: ItemState) => ItemState) => void;
  toggleAllergen: (id: string, code: string) => void;
  toggleDietary: (id: string, code: string) => void;
  addIngredient: (id: string) => void;
  removeIngredient: (id: string, idx: number) => void;
  confirm: (item: ItemState) => void;
  revert: (item: ItemState) => void;
}) {
  return (
    <li
      className={`rounded-2xl border p-4 shadow-sm transition ${
        item.confirmed
          ? 'border-emerald-200 bg-emerald-50/40'
          : 'border-stone-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{item.name}</p>
        </div>
        {item.confirmed ? (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            ✓ Onaylı
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-500">
            İncelenmedi
          </span>
        )}
      </div>

      {/* Kalori: düzenlenebilir input + hesaplayıcı butonu */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-stone-500">Kalori</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={item.caloriesInput}
            disabled={item.saving}
            onChange={(e) =>
              patch(item.id, (s) => ({ ...s, caloriesInput: e.target.value }))
            }
            placeholder="—"
            className="w-24 rounded-lg border border-stone-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <span className="text-xs text-stone-400">kcal</span>
        </div>
        <button
          type="button"
          onClick={() => patch(item.id, (s) => ({ ...s, showCalc: !s.showCalc }))}
          disabled={item.saving}
          className="rounded-lg border border-brand-300 px-2.5 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50"
        >
          🧮 Kalori hesaplayıcı
        </button>
      </div>

      {/* Kalori hesaplayıcı (açılır) */}
      {item.showCalc && (
        <CalorieCalculator item={item} patch={patch} />
      )}

      {/* İçindekiler: token chip'leri + ekleme */}
      <div className="mt-3">
        <p className="text-xs font-medium text-stone-500">İçindekiler</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {item.ingredientTokens.map((tok, idx) => (
            <span
              key={`${tok}-${idx}`}
              className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-1 text-xs text-stone-700"
            >
              {tok}
              <button
                type="button"
                onClick={() => removeIngredient(item.id, idx)}
                disabled={item.saving}
                aria-label={`${tok} kaldır`}
                className="text-stone-400 transition hover:text-red-600"
              >
                ✕
              </button>
            </span>
          ))}
          {item.ingredientTokens.length === 0 && (
            <span className="text-xs text-stone-400">Henüz malzeme yok.</span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <input
            type="text"
            value={item.newIngredient}
            disabled={item.saving}
            onChange={(e) =>
              patch(item.id, (s) => ({ ...s, newIngredient: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addIngredient(item.id);
              }
            }}
            placeholder="Malzeme ekle…"
            className="w-40 rounded-lg border border-stone-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={() => addIngredient(item.id)}
            disabled={item.saving}
            className="rounded-lg bg-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 transition hover:bg-stone-300"
          >
            + Ekle
          </button>
        </div>
      </div>

      {/* Alerjenler — EU 14, oval çerçeveli kutu */}
      <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Alerjenler (AB · 14)
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EU_ALLERGENS.map((code) => {
            const on = item.selected.has(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleAllergen(item.id, code)}
                disabled={item.saving}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  on
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-stone-500 ring-1 ring-stone-200 hover:bg-stone-100'
                }`}
              >
                {ALLERGENS[code as AllergenCode].tr}
              </button>
            );
          })}
        </div>
      </div>

      {/* Alkol & Domuz — ayrı kutu, farklı renk (TR mevzuatı / dini hassasiyet) */}
      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">
          Alkol &amp; Domuz
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TR_ALLERGENS.map((code) => {
            const on = item.selected.has(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleAllergen(item.id, code)}
                disabled={item.saving}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  on
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100'
                }`}
              >
                {ALLERGENS[code as AllergenCode].tr}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-1.5 text-xs text-stone-400">
        Seçili = üründe var. Hiçbiri seçili değilse “işletme beyanına göre listelenen alerjen yok” olarak kaydedilir.
      </p>

      {/* Diyet rozetleri */}
      <div className="mt-3">
        <p className="text-xs font-medium text-stone-500">Diyet rozetleri</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {DIETARY_CODES.map((code) => {
            const on = item.selectedDietary.has(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleDietary(item.id, code)}
                disabled={item.saving}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  on ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
              >
                {DIETARY[code as DietaryCode].emoji} {DIETARY[code as DietaryCode].tr}
              </button>
            );
          })}
        </div>
      </div>

      {item.error && <p className="mt-2 text-xs text-red-600">{item.error}</p>}

      <div className="mt-3 flex items-center gap-2">
        {item.confirmed ? (
          <button
            onClick={() => revert(item)}
            disabled={item.saving}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
          >
            {item.saving ? '…' : 'Onayı geri al / düzenle'}
          </button>
        ) : (
          <button
            onClick={() => confirm(item)}
            disabled={item.saving}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {item.saving ? 'Onaylanıyor…' : 'Onayla'}
          </button>
        )}
      </div>
    </li>
  );
}

/** İçindekilerin gramajına göre kalori hesaplayan panel.
    Her malzeme yerleşik besin tablosuyla eşleşir; eşleşmezse kullanıcı
    kcal/100g'ı elle girebilir. Toplam, ürünün kalori alanına uygulanabilir. */
function CalorieCalculator({
  item,
  patch,
}: {
  item: ItemState;
  patch: (id: string, fn: (s: ItemState) => ItemState) => void;
}) {
  const tokens = item.ingredientTokens;

  // Gram state'i eşleşen malzemeler için önden dolar (kullanıcı yalnız
  // farklıysa değiştirir). Eşleşmeyen malzeme boş kalır.
  const [grams, setGrams] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    tokens.forEach((tok, idx) => {
      const m = matchNutrition(tok);
      if (m) init[idx] = String(suggestGrams(m));
    });
    return init;
  });
  const [manualKcal, setManualKcal] = useState<Record<number, string>>({});

  const rows = tokens.map((tok, idx) => {
    const match = matchNutrition(tok);
    const g = Number(grams[idx] ?? '');
    const per100 = match
      ? match.kcalPer100g
      : Number(manualKcal[idx] ?? '');
    const kcal =
      Number.isFinite(g) && g > 0 && Number.isFinite(per100) && per100 >= 0
        ? kcalForGrams(per100, g)
        : 0;
    return { tok, idx, match, per100, kcal };
  });

  const totalKcal = rows.reduce((sum, r) => sum + r.kcal, 0);

  if (tokens.length === 0) {
    return (
      <div className="mt-2 rounded-xl border border-brand-200 bg-brand-50/50 p-3 text-xs text-stone-500">
        Önce yukarıya malzeme ekle; sonra her malzemenin gramını girip kaloriyi
        hesaplayabilirsin.
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
      <p className="mb-2 text-xs font-semibold text-brand-700">
        🧮 Kalori hesaplayıcı — gramlar tahminî dolduruldu, farklıysa düzelt
      </p>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.idx} className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="w-28 truncate text-stone-700" title={r.tok}>
              {r.tok}
            </span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={grams[r.idx] ?? ''}
              onChange={(e) => setGrams((m) => ({ ...m, [r.idx]: e.target.value }))}
              placeholder="gram"
              className="w-16 rounded border border-stone-300 px-1.5 py-0.5 focus:border-brand-500 focus:outline-none"
            />
            <span className="text-stone-400">g ×</span>
            {r.match ? (
              <span className="text-stone-500" title={r.match.label}>
                {r.per100} kcal/100g
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={manualKcal[r.idx] ?? ''}
                  onChange={(e) =>
                    setManualKcal((m) => ({ ...m, [r.idx]: e.target.value }))
                  }
                  placeholder="kcal/100g"
                  className="w-20 rounded border border-amber-300 px-1.5 py-0.5 focus:border-amber-500 focus:outline-none"
                />
                <span className="text-amber-600" title="Tabloda yok, elle gir">
                  ⚠
                </span>
              </span>
            )}
            <span className="ml-auto font-medium text-stone-700">{r.kcal} kcal</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-brand-200 pt-2">
        <span className="text-sm font-semibold text-stone-800">
          Toplam: {totalKcal} kcal
        </span>
        <button
          type="button"
          onClick={() =>
            patch(item.id, (s) => ({
              ...s,
              caloriesInput: String(totalKcal),
              showCalc: false,
            }))
          }
          disabled={totalKcal <= 0}
          className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
        >
          Kaloriye uygula
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-stone-400">
        ⚠ işaretli malzemeler tabloda yok — kcal/100g değerini elle girebilirsin.
        Değerler yaklaşıktır.
      </p>
    </div>
  );
}
