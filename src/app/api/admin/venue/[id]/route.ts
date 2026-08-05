import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { isAdminSession, checkAdminPassword } from '@/lib/admin-auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  password: z.string().min(1),
  /** Yanlışlıkla silmeyi engellemek için işletme adının birebir tekrarı. */
  confirmName: z.string().optional(),
});

/**
 * DELETE /api/admin/venue/[id]
 *
 * İşletmeyi ve tüm menü verisini KALICI olarak siler. Geri alınamaz.
 *
 * İKİ KATMANLI KORUMA:
 *  1) Geçerli süper-admin oturumu (çerez) şart.
 *  2) Admin şifresi istek gövdesinde TEKRAR istenir — açık bir sekmeden
 *     yanlışlıkla ya da başkası tarafından silinemesin.
 *
 * Kaskad: menus → categories → items → (alerjen/diyet/uyum/çeviri) ile
 * qr_codes ve menu_ingestions veritabanı düzeyinde otomatik silinir.
 * scan_events'te FK yoktur; elle temizlenir.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Şifre gerekli.' }, { status: 400 });
  }

  if (!checkAdminPassword(parsed.data.password)) {
    await new Promise((r) => setTimeout(r, 400)); // kaba kuvveti yavaşlat
    return NextResponse.json({ error: 'Şifre yanlış.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: venue } = await admin
    .from('venues')
    .select('id, name, org_id')
    .eq('id', params.id)
    .maybeSingle();
  if (!venue) {
    return NextResponse.json({ error: 'İşletme bulunamadı.' }, { status: 404 });
  }

  if (parsed.data.confirmName && parsed.data.confirmName.trim() !== venue.name) {
    return NextResponse.json({ error: 'İşletme adı eşleşmedi.' }, { status: 400 });
  }

  // FK'sı olmayan analitik kayıtları önce temizle (yetim satır kalmasın).
  await admin.from('scan_events').delete().eq('venue_id', venue.id);

  const { error } = await admin.from('venues').delete().eq('id', venue.id);
  if (error) {
    return NextResponse.json(
      { error: 'Silinemedi.', details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, deleted: venue.name });
}
