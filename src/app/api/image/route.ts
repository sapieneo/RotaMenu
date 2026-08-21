import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { UPGRADE_MESSAGES, resolvePlanContext } from '@/lib/plans';
import { authorizeImageTarget } from '@/lib/image-access';

export const runtime = 'nodejs';

const bodySchema = z
  .object({
    itemId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    /** Depolanan görsel URL'i; null = kaldır. */
    imageUrl: z.string().url().nullable(),
  })
  .refine((b) => Boolean(b.itemId) !== Boolean(b.categoryId), {
    message: 'itemId veya categoryId (yalnızca biri) gerekli.',
  });

/**
 * PATCH /api/image
 * Elle yüklenen görselin URL'ini ürüne (image_url) veya kategoriye
 * (background_url) bağlar ya da kaldırır (null). Yalnız kendi venue-media
 * public URL'imiz kabul edilir.
 */
export async function PATCH(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  const { itemId, categoryId, imageUrl } = parsed.data;
  const supabase = createClient();
  const access = await authorizeImageTarget(supabase, { itemId, categoryId });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { target } = access;

  if (imageUrl !== null) {
    const allowedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-media/`;
    if (!imageUrl.startsWith(allowedPrefix)) {
      return NextResponse.json({ error: 'Geçersiz görsel adresi.' }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  const { table, column, id, orgId } = target;

  // Plan kapısı: görsel BAĞLAMA yalnız Pro+ planlarda. Kaldırma (null) her
  // planda serbest — plan düşse bile mevcut görsel temizlenebilmeli.
  if (imageUrl !== null) {
    const { data: orgRow } = await admin
      .from('organizations')
      .select('plan, trial_ends_at')
      .eq('id', orgId)
      .maybeSingle();
    if (!resolvePlanContext(orgRow?.plan, orgRow?.trial_ends_at).limits.images) {
      return NextResponse.json(
        { error: UPGRADE_MESSAGES.images, code: 'upgrade_required' },
        { status: 402 }
      );
    }
  }

  const { error } = await admin.from(table).update({ [column]: imageUrl }).eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'Görsel güncellenemedi.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, imageUrl });
}
