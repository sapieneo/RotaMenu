import type { User } from '@supabase/supabase-js';
import { isAdminSession } from '@/lib/admin-auth';
import { hasPanoSession } from '@/lib/pano-auth';
import { createAdminClient, createClient } from '@/lib/supabase/server';

type ServerClient = ReturnType<typeof createClient>;

const EDITOR_ROLES = ['owner', 'admin', 'editor'];

export type ImageTargetInput = {
  itemId?: string;
  categoryId?: string;
};

export type ImageTarget = {
  id: string;
  orgId: string;
  venueId: string;
  table: 'items' | 'categories';
  column: 'image_url' | 'background_url';
  subdir: 'items' | 'categories';
};

export type ImageAccessResult =
  | { ok: true; target: ImageTarget; user: User | null }
  | { ok: false; status: 401 | 403 | 404; error: string };

/** Ürün/kategorinin bağlı olduğu işletmeyi sunucu tarafında çözer. */
async function resolveTarget(input: ImageTargetInput): Promise<ImageTarget | null> {
  const admin = createAdminClient();
  let id: string;
  let orgId: string;
  let menuId: string;
  let table: ImageTarget['table'];
  let column: ImageTarget['column'];
  let subdir: ImageTarget['subdir'];

  if (input.itemId) {
    const { data: item } = await admin
      .from('items')
      .select('id, org_id, category_id')
      .eq('id', input.itemId)
      .maybeSingle();
    if (!item) return null;
    const { data: category } = await admin
      .from('categories')
      .select('menu_id')
      .eq('id', item.category_id)
      .maybeSingle();
    if (!category) return null;
    id = item.id;
    orgId = item.org_id;
    menuId = category.menu_id;
    table = 'items';
    column = 'image_url';
    subdir = 'items';
  } else if (input.categoryId) {
    const { data: category } = await admin
      .from('categories')
      .select('id, org_id, menu_id')
      .eq('id', input.categoryId)
      .maybeSingle();
    if (!category) return null;
    id = category.id;
    orgId = category.org_id;
    menuId = category.menu_id;
    table = 'categories';
    column = 'background_url';
    subdir = 'categories';
  } else {
    return null;
  }

  const { data: menu } = await admin
    .from('menus')
    .select('venue_id')
    .eq('id', menuId)
    .maybeSingle();
  if (!menu) return null;

  return { id, orgId, venueId: menu.venue_id, table, column, subdir };
}

/**
 * Görsel işlemleri üç giriş yolunu aynı kuralla kabul eder:
 * Supabase org editörü, süper-admin veya hedef işletmeye ait pano oturumu.
 * Pano çerezi hedefin venue kimliği çözüldükten sonra doğrulandığı için başka
 * bir işletmenin item/category kimliği gönderilerek service-role açılamaz.
 */
export async function authorizeImageTarget(
  supabase: ServerClient,
  input: ImageTargetInput
): Promise<ImageAccessResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const target = await resolveTarget(input);
  if (!target) return { ok: false, status: 404, error: 'Kayıt bulunamadı.' };

  if (isAdminSession() || hasPanoSession(target.venueId)) {
    return { ok: true, target, user };
  }
  if (!user) return { ok: false, status: 401, error: 'Oturum bulunamadı.' };

  const { data: membership } = await createAdminClient()
    .from('organization_members')
    .select('role')
    .eq('org_id', target.orgId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !EDITOR_ROLES.includes(membership.role)) {
    return { ok: false, status: 403, error: 'Bu işlem için yetkiniz yok.' };
  }

  return { ok: true, target, user };
}
