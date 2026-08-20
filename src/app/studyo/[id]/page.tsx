import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { rawResultSchema, type ExtractedMenu } from '@/lib/schemas/menu';
import { CODE_BY_ID } from '@/lib/allergens';
import { DIETARY_CODE_BY_ID } from '@/lib/dietary';
import { DraftEditor } from './draft-editor';

export const dynamic = 'force-dynamic';

/**
 * Studyo adım 2: AI taslağını incele ve düzenle.
 * Sunucu tarafında ingestion durumu okunur (RLS: yalnız org üyesi).
 *
 * Onaylanmış menü tekrar açıldığında editör CANLI veriyle doldurulur
 * (kalori, sıra, düzenlemeler, onaylı alerjen/diyet). Böylece daha önce
 * kaydedilen/DB'de güncellenen değerler görünür ve "Yeniden Kaydet"
 * bunları sıfırlamaz.
 */
export default async function ReviewPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: ingestion } = await supabase
    .from('menu_ingestions')
    .select('id, status, raw_result, error_message, venue_id, org_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!ingestion) notFound();

  if (ingestion.status === 'failed') {
    return (
      <CenteredCard>
        <h1 className="text-xl font-semibold text-red-600">Menü çıkarılamadı</h1>
        <p className="mt-2 text-stone-600">{ingestion.error_message ?? 'Bilinmeyen hata.'}</p>
        <a
          href="/studyo"
          className="mt-4 inline-block rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
        >
          Yeni dosyayla tekrar dene
        </a>
      </CenteredCard>
    );
  }

  if (ingestion.status === 'uploaded' || ingestion.status === 'processing') {
    return (
      <CenteredCard>
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <h1 className="mt-4 text-xl font-semibold">Yapay zeka menünü okuyor…</h1>
        <p className="mt-2 text-stone-600">Bu sayfa hazır olunca kendini yenileyecek.</p>
        <meta httpEquiv="refresh" content="4" />
      </CenteredCard>
    );
  }

  const raw = rawResultSchema.safeParse(ingestion.raw_result);
  if (!raw.success) {
    return (
      <CenteredCard>
        <h1 className="text-xl font-semibold text-red-600">Taslak verisi bozuk</h1>
        <p className="mt-2 text-stone-600">Lütfen menüyü yeniden yükleyin.</p>
        <a
          href="/studyo"
          className="mt-4 inline-block rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
        >
          Studyoya dön
        </a>
      </CenteredCard>
    );
  }

  const { data: venue } = await supabase
    .from('venues')
    .select('currency_code, name')
    .eq('id', ingestion.venue_id)
    .maybeSingle();

  // Onaylanmışsa canlı veriyle doldur; değilse ham çıkarımı kullan.
  let initialDraft: ExtractedMenu = raw.data.extracted;
  if (ingestion.status === 'approved') {
    const hydrated = await hydrateDraft(
      supabase,
      params.id,
      raw.data.extracted,
      raw.data.created_menu_id ?? null,
      raw.data.created_menu_ids ?? {}
    );
    if (hydrated) initialDraft = hydrated;
  }

  return (
    <DraftEditor
      ingestionId={ingestion.id}
      venueId={ingestion.venue_id}
      orgId={ingestion.org_id}
      initialCurrency={venue?.currency_code ?? raw.data.extracted.currency_guess ?? 'TRY'}
      initialVenueName={venue?.name ?? null}
      initialDraft={initialDraft}
      alreadyApproved={ingestion.status === 'approved'}
    />
  );
}

/**
 * Bu ingestion'ın canlı kategorilerini/ürünlerini ExtractedMenu şekline çevirir.
 *
 * ÇOKLU MENÜ: kategoriler ARTIK `menu_id` ile SÜZÜLMÜYOR, yalnız `ingestion_id`
 * ile. Tek bir yükleme birden fazla menüye kategori yazabiliyor (bkz.
 * api/ingest/[id]/approve). Eski hali yalnız ana menüdekileri getiriyordu;
 * diğer menülerdeki kategoriler taslakta hiç görünmüyor, ardından bir
 * "Yeniden Kaydet" onları veritabanından da siliyordu.
 *
 * Her kategorinin `menu_key`'i `created_menu_ids` haritası TERSTEN çözülerek
 * geri yazılır ki editördeki menü seçicisi doğru menüyü göstersin.
 */
async function hydrateDraft(
  supabase: ReturnType<typeof createClient>,
  ingestionId: string,
  base: ExtractedMenu,
  baseMenuId: string | null,
  createdMenuIds: Record<string, string>
): Promise<ExtractedMenu | null> {
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, sort_order, menu_id')
    .eq('ingestion_id', ingestionId)
    .order('sort_order');
  if (!categories || categories.length === 0) return null;
  const catIds = categories.map((c) => c.id);

  const { data: itemRows } = await supabase
    .from('items')
    .select(
      'id, name, description, ingredients, price, calories_kcal, category_id, sort_order, is_featured, ' +
        'item_allergens(allergen_id, confidence), item_dietary(tag_id, confidence)'
    )
    .in('category_id', catIds)
    .order('sort_order');

  const rows = (itemRows ?? []) as unknown as Record<string, unknown>[];
  const byCat = new Map<string, ExtractedMenu['categories'][number]['items']>();
  for (const it of rows) {
    const catId = it.category_id as string;
    const algRows = (it.item_allergens as { allergen_id: number; confidence: number | null }[]) ?? [];
    const dietRows = (it.item_dietary as { tag_id: number; confidence: number | null }[]) ?? [];
    const priceRaw = it.price as number | string | null;
    const list = byCat.get(catId) ?? [];
    list.push({
      name: it.name as string,
      description: (it.description as string | null) ?? null,
      ingredients: (it.ingredients as string | null) ?? null,
      price: priceRaw == null ? null : Number(priceRaw),
      calories_kcal: (it.calories_kcal as number | null) ?? null,
      allergens: algRows
        .map((r) => ({ code: CODE_BY_ID[r.allergen_id], confidence: r.confidence ?? 1 }))
        .filter((a) => Boolean(a.code)),
      dietary: dietRows
        .map((r) => ({ code: DIETARY_CODE_BY_ID[r.tag_id], confidence: r.confidence ?? 1 }))
        .filter((d) => Boolean(d.code)),
      is_featured: Boolean(it.is_featured),
    });
    byCat.set(catId, list);
  }

  // menü kimliği → taslaktaki menü anahtarı (created_menu_ids'in tersi)
  const keyByMenuId = new Map<string, string>(
    Object.entries(createdMenuIds).map(([key, id]) => [id, key])
  );

  // Sıralama: `sort_order` MENÜ BAŞINA hesaplanıyor, dolayısıyla menüler
  // karışık gelir. Önce ana menü, sonra taslaktaki menü sırası, her grubun
  // içinde kendi sort_order'ı.
  const menuRank = new Map<string, number>();
  if (baseMenuId) menuRank.set(baseMenuId, 0);
  (base.menus ?? []).forEach((m, i) => {
    const id = createdMenuIds[m.key];
    if (id && !menuRank.has(id)) menuRank.set(id, i + 1);
  });
  const rankOf = (menuId: string | null): number => {
    if (!menuId) return 999;
    return menuRank.get(menuId) ?? 999;
  };

  const ordered = [...categories].sort((a, b) => {
    const ra = rankOf((a.menu_id as string | null) ?? null);
    const rb = rankOf((b.menu_id as string | null) ?? null);
    if (ra !== rb) return ra - rb;
    return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
  });

  return {
    menu_name: base.menu_name,
    venue_name_guess: base.venue_name_guess,
    currency_guess: base.currency_guess,
    language_guess: base.language_guess,
    warnings: [],
    menus: base.menus ?? [],
    categories: ordered.map((c) => ({
      name: c.name,
      items: byCat.get(c.id) ?? [],
      menu_key: keyByMenuId.get((c.menu_id as string | null) ?? '') ?? null,
    })),
  };
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="w-full rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}
