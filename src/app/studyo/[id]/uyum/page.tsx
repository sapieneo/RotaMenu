import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { rawResultSchema } from '@/lib/schemas/menu';
import { CODE_BY_ID } from '@/lib/allergens';
import { DIETARY_CODE_BY_ID } from '@/lib/dietary';
import { ComplianceReviewer, type ReviewItem } from './compliance-reviewer';
import { resolveComplianceIngestionAccess } from '@/lib/compliance-access';

export const dynamic = 'force-dynamic';

/**
 * Studyo adım 3: Uyum motoru — alerjen & kalori onayı + denetime hazırlık.
 * Onaylanmış menünün ürünlerini yükler; her ürün için AI önerisi ön-işaretli
 * gelir, işletme onaylar. Misafir yalnız onaylanmış alerjeni görecektir.
 */
export default async function CompliancePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const access = await resolveComplianceIngestionAccess(supabase, params.id);
  if (!access) notFound();
  const { ingestion, db } = access;

  const raw = rawResultSchema.safeParse(ingestion.raw_result);
  const menuId = raw.success ? raw.data.created_menu_id : null;
  if (ingestion.status !== 'approved' || !menuId) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">Önce menünü onayla</h1>
        <p className="mt-2 text-stone-600">
          Alerjen onayına geçmek için menünü kaydetmen gerekiyor.
        </p>
        <a
          href={`/studyo/${params.id}`}
          className="mt-4 inline-block rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
        >
          Taslağa dön
        </a>
      </Centered>
    );
  }

  const { data: venue } = await db
    .from('venues')
    .select('id, name, slug')
    .eq('id', ingestion.venue_id)
    .maybeSingle();

  const { data: categories } = await db
    .from('categories')
    .select('id, name, sort_order')
    .eq('menu_id', menuId)
    .order('sort_order');
  const catIds = (categories ?? []).map((c) => c.id);
  // Kategori sırası: ürünler düz listede `sort_order`'a göre geliyor ve HER
  // kategorinin ürünleri 0'dan başlıyor. Bu yüzden ürünleri kategori sırasına
  // göre yeniden dizmezsek gruplar rastgele sırayla çıkıyor (bkz. aşağıdaki
  // sıralama). İşletme kendi menü sırasını takip edebilsin diye kategori
  // sırasını burada bir haritaya alıp ürünleri ona göre diziyoruz.
  const catOrder = new Map((categories ?? []).map((c, index) => [c.id, index]));

  const { data: itemRows } = catIds.length
    ? await db
        .from('items')
        .select(
          'id, name, category_id, price, calories_kcal, ingredients, allergens_confirmed, sort_order, ' +
            'item_allergens(allergen_id, state), item_dietary(tag_id, state), ' +
            'item_compliance(allergen_review, calories_review, reviewed_at)'
        )
        .in('category_id', catIds)
        .order('sort_order')
    : { data: [] as never[] };

  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));

  const rows = ((itemRows ?? []) as unknown as Record<string, unknown>[]).sort((a, b) => {
    const catDelta =
      (catOrder.get(a.category_id as string) ?? 0) - (catOrder.get(b.category_id as string) ?? 0);
    return catDelta !== 0 ? catDelta : ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0);
  });
  const items: ReviewItem[] = rows.map((it) => {
    const algRows = (it.item_allergens as { allergen_id: number; state: string }[]) ?? [];
    const dietRows = (it.item_dietary as { tag_id: number; state: string }[]) ?? [];
    const compArr = it.item_compliance as
      | { allergen_review: string; calories_review: string; reviewed_at: string | null }[]
      | { allergen_review: string; calories_review: string; reviewed_at: string | null }
      | null;
    const comp = Array.isArray(compArr) ? compArr[0] : compArr;
    return {
      id: it.id as string,
      name: it.name as string,
      categoryId: it.category_id as string,
      categoryName: catName.get(it.category_id as string) ?? '—',
      price: it.price == null ? null : Number(it.price),
      calories: (it.calories_kcal as number | null) ?? null,
      ingredients: (it.ingredients as string | null) ?? null,
      allergenCodes: algRows
        .map((r) => CODE_BY_ID[r.allergen_id])
        .filter(Boolean) as string[],
      dietaryCodes: dietRows
        .map((r) => DIETARY_CODE_BY_ID[r.tag_id])
        .filter(Boolean) as string[],
      confirmed: Boolean(it.allergens_confirmed),
      caloriesConfirmed: comp?.calories_review === 'confirmed',
    };
  });

  return (
    <ComplianceReviewer
      ingestionId={ingestion.id}
      venueId={ingestion.venue_id}
      venueName={venue?.name ?? 'İşletmem'}
      previewSlug={venue?.slug ?? null}
      items={items}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="w-full rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}
