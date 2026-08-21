import { createAdminClient, createClient } from '@/lib/supabase/server';
import { isAdminSession } from '@/lib/admin-auth';
import { resolvePlanContext } from '@/lib/plans';
import { MENU_LANGUAGES } from '@/lib/languages';
import { resolveManagedVenue } from '@/lib/managed-venue';
import { LanguageManager, type TranslationJobView } from './language-manager';

export const dynamic = 'force-dynamic';

export default async function LanguagesPage({ searchParams }: { searchParams?: { venue?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <EmptyState title="Oturum bulunamadı" text="Dil yönetimi için Studyoya giriş yapın." />;

  const venue = await resolveManagedVenue(supabase, searchParams?.venue);
  if (!venue) return <EmptyState title="Henüz menünüz yok" text="Önce menünüzü oluşturun." />;

  // Admin oturumunda seçilen işletmenin çeviri durumları normal kullanıcı
  // RLS'iyle görünmez. Venue erişimi doğrulandıktan sonra sunucu istemcisini
  // kullanarak aynı veriyi güvenli biçimde oku.
  const database = isAdminSession() ? createAdminClient() : supabase;

  const [{ data: menu }, { data: org }] = await Promise.all([
    database
      .from('menus')
      .select('id')
      .eq('venue_id', venue.id)
      .eq('is_active', true)
      .order('sort_order')
      .limit(1)
      .maybeSingle(),
    database
      .from('organizations')
      .select('plan, trial_ends_at')
      .eq('id', venue.org_id)
      .maybeSingle(),
  ]);
  if (!menu) return <EmptyState title="Aktif menü bulunamadı" text="Menünüzü tamamlayıp tekrar deneyin." />;

  const { data: categories } = await database.from('categories').select('id').eq('menu_id', menu.id);
  const categoryIds = (categories ?? []).map((category) => category.id);
  const [{ data: items }, { data: jobs }] = await Promise.all([
    categoryIds.length
      ? database.from('items').select('id, description').in('category_id', categoryIds)
      : Promise.resolve({ data: [] as { id: string; description: string | null }[] }),
    database
      .from('menu_translation_jobs')
      .select('id, job_type, locale, status, progress, total_items, error_message, updated_at')
      .eq('menu_id', menu.id)
      .order('updated_at', { ascending: false }),
  ]);
  const limits = resolvePlanContext(org?.plan, org?.trial_ends_at).limits;

  return (
    <LanguageManager
      venueId={venue.id}
      venueName={venue.name}
      languages={[...MENU_LANGUAGES]}
      jobs={(jobs ?? []) as TranslationJobView[]}
      missingDescriptions={(items ?? []).filter((item) => !item.description?.trim()).length}
      itemCount={items?.length ?? 0}
      planLabel={limits.label}
      maxTargets={Number.isFinite(limits.maxLocales) ? Math.max(0, limits.maxLocales - 1) : null}
    />
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-stone-600">{text}</p>
      <a href="/studyo/pano" className="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white">Panoya dön</a>
    </main>
  );
}
