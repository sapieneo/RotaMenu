import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { isAdminSession } from '@/lib/admin-auth';

export const runtime = 'nodejs';

const bodySchema = z.object({ suspended: z.boolean() });

/**
 * POST /api/admin/venue/[id]/suspend
 *
 * Süper-admin panelinden bir menüyü askıya alır / yayına geri alır. Askıya
 * alınan menü, PLATFORM GENELİ uyarı ekranını gösterir (görsel + metin
 * `platform_settings`'ten okunur — bkz. /api/admin/suspension-notice).
 *
 * Veri SİLİNMEZ; işaret kaldırılınca menü kaldığı yerden yayına döner.
 * Kalıcı silme için ayrı ve şifre korumalı uç vardır: DELETE /api/admin/venue/[id]
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: venue } = await admin
    .from('venues')
    .select('id')
    .eq('id', params.id)
    .maybeSingle();
  if (!venue) {
    return NextResponse.json({ error: 'İşletme bulunamadı.' }, { status: 404 });
  }

  const suspended = parsed.data.suspended;
  const { error } = await admin
    .from('venues')
    .update(
      suspended
        ? { is_suspended: true, suspended_at: new Date().toISOString() }
        : { is_suspended: false }
    )
    .eq('id', venue.id);
  if (error) {
    return NextResponse.json({ error: 'Güncellenemedi.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, isSuspended: suspended });
}
