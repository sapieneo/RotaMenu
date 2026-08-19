import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isSupportedMenuLanguage } from '@/lib/languages';
import { normalizePlan, resolvePlanContext } from '@/lib/plans';
import { signTranslationBackgroundPayload } from '@/lib/ai/background-auth';
import { resolveManagedVenue } from '@/lib/managed-venue';
import { aiTierFor, consumeAiQuota, quotaStatus, refundAiQuota } from '@/lib/ai-quota';

export const runtime = 'nodejs';

const bodySchema = z.object({
  venueId: z.string().uuid(),
  locales: z.array(z.string().min(2).max(5)).min(1).max(20).transform((values) => [...new Set(values)]),
  /**
   * Eksik ürün açıklamaları bu çeviriyle BİRLİKTE üretilsin mi?
   * Varsayılan false: çeviri ve açıklama üretimi artık iki ayrı iş
   * (bkz. studyo/diller ekranındaki iki ayrı düğme). Eskiden çeviri,
   * eksik açıklama varsa onları da zorla üretiyordu; kullanıcı yalnızca
   * çevirmek istediğinde beklemediği bir AI maliyeti doğuyordu.
   */
  withDescriptions: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.locales.some((locale) => !isSupportedMenuLanguage(locale))) {
    return NextResponse.json({ error: 'Geçersiz dil seçimi.' }, { status: 400 });
  }

  const venue = await resolveManagedVenue(supabase, parsed.data.venueId);
  if (!venue) return NextResponse.json({ error: 'Menü bulunamadı.' }, { status: 404 });

  const { data: menu } = await supabase
    .from('menus')
    .select('id')
    .eq('venue_id', venue.id)
    .eq('is_active', true)
    .order('sort_order')
    .limit(1)
    .maybeSingle();
  if (!menu) return NextResponse.json({ error: 'Aktif menü bulunamadı.' }, { status: 404 });

  const { data: organization } = await supabase
    .from('organizations')
    .select('plan, trial_ends_at')
    .eq('id', venue.org_id)
    .maybeSingle();
  const limits = resolvePlanContext(organization?.plan, organization?.trial_ends_at).limits;
  const maxTargets = Number.isFinite(limits.maxLocales) ? Math.max(0, limits.maxLocales - 1) : Infinity;
  if (parsed.data.locales.length > maxTargets) {
    return NextResponse.json(
      { error: `Planınız Türkçe dahil en fazla ${limits.maxLocales} dili destekliyor.` },
      { status: 403 }
    );
  }

  const { data: categories } = await supabase.from('categories').select('id').eq('menu_id', menu.id);
  const categoryIds = (categories ?? []).map((category) => category.id);
  const { data: items } = categoryIds.length
    ? await supabase.from('items').select('id, description').in('category_id', categoryIds)
    : { data: [] as { id: string; description: string | null }[] };
  const missingDescriptionCount = parsed.data.withDescriptions
    ? (items ?? []).filter((item) => !item.description?.trim()).length
    : 0;

  const { data: existingJobs } = await supabase
    .from('menu_translation_jobs')
    .select('locale, status')
    .eq('menu_id', menu.id)
    .eq('job_type', 'translation')
    .in('locale', parsed.data.locales);
  const completedLocales = new Set(
    (existingJobs ?? []).filter((job) => job.status === 'completed').map((job) => job.locale)
  );
  const localesToRun = parsed.data.locales.filter((locale) => !completedLocales.has(locale));

  // ── AI maliyet koruması ──────────────────────────────────────────────────
  // Birim = gerçekten çalıştırılacak dil sayısı + (varsa) açıklama işi.
  // Zaten tamamlanmış diller sayılmaz. Kota yetmezse OpenAI hiç çağrılmaz.
  const aiTier = aiTierFor({
    isAnonymous: Boolean(user.is_anonymous),
    email: user.email,
    basePlan: normalizePlan(organization?.plan),
  });
  if (localesToRun.length) {
    const quota = await consumeAiQuota(venue.org_id, 'translate', localesToRun.length, aiTier);
    if (!quota.ok) {
      return NextResponse.json(
        { error: quota.message, code: quota.reason === 'identity' ? 'account_required' : 'quota_exceeded' },
        { status: quotaStatus(quota) }
      );
    }
  }
  if (missingDescriptionCount > 0) {
    const descQuota = await consumeAiQuota(venue.org_id, 'description', 1, aiTier);
    if (!descQuota.ok) {
      await refundAiQuota(venue.org_id, 'translate', localesToRun.length);
      return NextResponse.json(
        { error: descQuota.message, code: descQuota.reason === 'identity' ? 'account_required' : 'quota_exceeded' },
        { status: quotaStatus(descQuota) }
      );
    }
  }

  const translationRows = localesToRun.map((locale) => ({
    org_id: venue.org_id,
    menu_id: menu.id,
    job_type: 'translation',
    locale,
    status: 'pending',
    progress: 0,
    total_items: items?.length ?? 0,
    model: null,
    error_message: null,
    requested_by: user.id,
  }));
  const translationResult = translationRows.length
    ? await supabase
        .from('menu_translation_jobs')
        .upsert(translationRows, { onConflict: 'menu_id,job_type,locale' })
        .select('id')
    : { data: [] as { id: string }[], error: null };
  const translationJobs = translationResult.data;

  /** İş başlatılamadıysa tüketilen AI kotasını geri ver. */
  const refundAll = async () => {
    await refundAiQuota(venue.org_id, 'translate', localesToRun.length);
    if (missingDescriptionCount > 0) await refundAiQuota(venue.org_id, 'description', 1);
  };

  if (translationResult.error || !translationJobs) {
    await refundAll();
    return NextResponse.json({ error: 'Çeviri işleri oluşturulamadı.' }, { status: 500 });
  }

  const origin = getNetlifyOrigin();
  if (!origin) {
    await refundAll();
    return NextResponse.json({ error: 'Arka plan servisi yapılandırılmamış.' }, { status: 503 });
  }
  const followupJobIds = translationJobs.map((job) => job.id);

  if (!followupJobIds.length && missingDescriptionCount === 0) {
    return NextResponse.json({ jobs: 0, descriptions: 0, alreadyCompleted: true });
  }

  if (missingDescriptionCount > 0) {
    const { data: descriptionJob, error } = await supabase
      .from('menu_translation_jobs')
      .upsert(
        {
          org_id: venue.org_id,
          menu_id: menu.id,
          job_type: 'description',
          locale: 'tr',
          status: 'pending',
          progress: 0,
          total_items: missingDescriptionCount,
          model: null,
          error_message: null,
          requested_by: user.id,
        },
        { onConflict: 'menu_id,job_type,locale' }
      )
      .select('id')
      .single();
    if (error || !descriptionJob) {
      await refundAll();
      return NextResponse.json({ error: 'Açıklama işi oluşturulamadı.' }, { status: 500 });
    }
    if (!(await enqueue(origin, descriptionJob.id, followupJobIds))) {
      await refundAll();
      return NextResponse.json({ error: 'Açıklama işi başlatılamadı.' }, { status: 502 });
    }
  } else {
    const queued = await Promise.all(followupJobIds.map((jobId) => enqueue(origin, jobId)));
    if (queued.some((success) => !success)) {
      await refundAll();
      return NextResponse.json({ error: 'Bazı çeviri işleri başlatılamadı. Lütfen tekrar deneyin.' }, { status: 502 });
    }
  }

  return NextResponse.json({ jobs: followupJobIds.length, descriptions: missingDescriptionCount }, { status: 202 });
}

type NetlifyRuntimeGlobal = typeof globalThis & { Netlify?: { env: { get(name: string): string | undefined } } };

function getEnv(name: string) {
  return (globalThis as NetlifyRuntimeGlobal).Netlify?.env.get(name) ?? process.env[name];
}

function getNetlifyOrigin() {
  const siteId = getEnv('SITE_ID');
  const origin = getEnv('DEPLOY_PRIME_URL') ?? getEnv('URL');
  return siteId && origin ? origin : null;
}

async function enqueue(origin: string, jobId: string, followupJobIds: string[] = []) {
  const secret = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) return false;
  const payload = JSON.stringify({ jobId, followupJobIds });
  const signature = signTranslationBackgroundPayload(payload, secret);
  try {
    const response = await fetch(`${origin}/.netlify/functions/menu-translate-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-RestaurantOS-Signature': signature },
      body: payload,
    });
    return response.status === 202;
  } catch {
    return false;
  }
}
