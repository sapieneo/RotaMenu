import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const bodySchema = z
  .object({
    categoryId: z.string().uuid(),
    style: z.enum(['strip', 'hero']).optional(),
    positionY: z.number().min(0).max(100).optional(),
  })
  .refine((data) => data.style !== undefined || data.positionY !== undefined, {
    message: 'style veya positionY gerekli.',
  });

const EDITOR_ROLES = ['owner', 'admin', 'editor'];

/**
 * PATCH /api/category/background-style
 * Kategori arka plan görselinin misafir menüsünde nasıl gösterileceğini
 * ayarlar: 'strip' (küçük şerit, varsayılan) veya 'hero' (büyük arka plan,
 * ürün listesi üzerine biner). Görsel URL'inden bağımsız bir tercih — görsel
 * silinse bile stil tercihi kalır, yeni görsel eklenince tekrar uygulanır.
 * Ayrıca 'positionY' (0-100) ile görselin dikey kadrajı ayarlanabilir — dar
 * şerit yüksekliğinde görselin önemli kısmı kırpılmasın diye kullanılır.
 * İkisi de opsiyoneldir, en az biri gönderilmelidir.
 */
export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  const { categoryId, style, positionY } = parsed.data;

  const admin = createAdminClient();
  const { data: cat } = await admin
    .from('categories')
    .select('id, org_id')
    .eq('id', categoryId)
    .maybeSingle();
  if (!cat) {
    return NextResponse.json({ error: 'Kategori bulunamadı.' }, { status: 404 });
  }

  const { data: mem } = await admin
    .from('organization_members')
    .select('role')
    .eq('org_id', cat.org_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!mem || !EDITOR_ROLES.includes(mem.role)) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 });
  }

  const update: Record<string, string | number> = {};
  if (style !== undefined) update.background_style = style;
  if (positionY !== undefined) update.background_position_y = Math.round(positionY);

  const { error } = await admin.from('categories').update(update).eq('id', categoryId);
  if (error) {
    return NextResponse.json({ error: 'Güncellenemedi.', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, style, positionY });
}
