import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { signTranslationBackgroundPayload } from '@/lib/ai/background-auth';
import { resolveManagedVenue } from '@/lib/managed-venue';

export const runtime = 'nodejs';

const bodySchema = z.object({ venueId: z.string().uuid() });

/**
 * POST /api/menu/generate-descriptions
 * Yalnızca eksik ürün açıklamalarını (Türkçe) AI ile üretir — çeviriden
 * BAĞIMSIZ, ayrı bir adım (Dil yönetimi ekranı → "Açıklamaları üret").
 * /api/menu/translate zaten eksik açıklama varsa çeviriyi bu işe otomatik
 * zincirliyor (bkz. o route) — bu uç yalnızca kullanıcı açıklamaları önce
 * tek başına tamamlamak istediğinde kullanılır.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

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

  const { data: categories } = await supabase.from('categories').select('id').eq('menu_id', menu.id);
  const categoryIds = (categories ?? []).map((category) => category.id);
  const { data: items } = categoryIds.length
    ? await supabase.from('items').select('id, description').in('category_id', categoryIds)
    : { data: [] as { id: string; description: string | null }[] };
  const missingDescriptionCount = (items ?? []).filter((item) => !item.description?.trim()).length;
  if (missingDescriptionCount === 0) {
    return NextResponse.json({ descriptions: 0, alreadyCompleted: true });
  }

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
    return NextResponse.json({ error: 'Açıklama işi oluşturulamadı.' }, { status: 500 });
  }

  const origin = getNetlifyOrigin();
  if (!origin) return NextResponse.json({ error: 'Arka plan servisi yapılandırılmamış.' }, { status: 503 });
  if (!(await enqueue(origin, descriptionJob.id))) {
    return NextResponse.json({ error: 'Açıklama işi başlatılamadı.' }, { status: 502 });
  }

  return NextResponse.json({ descriptions: missingDescriptionCount }, { status: 202 });
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

async function enqueue(origin: string, jobId: string) {
  const secret = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) return false;
  const payload = JSON.stringify({ jobId, followupJobIds: [] });
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
