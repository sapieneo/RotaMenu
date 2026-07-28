import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const bodySchema = z.object({
  categoryId: z.string().uuid(),
  style: z.enum(['strip', 'hero']),
});

const EDITOR_ROLES = ['owner', 'admin', 'editor'];

/**
 * PATCH /api/category/background-style
 * Kategori arka plan görselinin misafir menüsünde nasıl gösterileceğini
 * ayarlar: 'strip' (küçük şerit, varsayılan) veya 'hero' (büyük arka plan,
 * ürün listesi üzerine biner). Görsel URL'inden bağımsız bir tercih — görsel
 * silinse bile stil tercihi kalır, yeni görsel eklenince tekrar uygulanır.
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
  const { categoryId, style } = parsed.data;

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

  const { error } = await admin
    .from('categories')
    .update({ background_style: style })
    .eq('id', categoryId);
  if (error) {
    return NextResponse.json({ error: 'Güncellenemedi.', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, style });
}
