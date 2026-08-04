import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { isAdminSession } from '@/lib/admin-auth';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * POST /api/admin/venue/[id]/suspend
 * Süper-admin kontrol panelinden bir venue'yu askıya alır / yayına geri alır.
 * Askıya alınca misafir menüsü (/m/[slug]) normal içerik yerine buradaki
 * görsel + metni gösterir. Veri SİLİNMEZ, yalnızca `is_suspended` bayrağı
 * kapatılınca menü kaldığı yerden yayına döner.
 *
 * multipart/form-data:
 *  - suspended: 'true' | 'false' (zorunlu)
 *  - message: string (opsiyonel; boşsa mevcut mesaj korunur)
 *  - image: File (opsiyonel; boşsa mevcut görsel korunur)
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: venue } = await admin
    .from('venues')
    .select('id, org_id, suspension_message, suspension_image_url')
    .eq('id', params.id)
    .maybeSingle();
  if (!venue) {
    return NextResponse.json({ error: 'İşletme bulunamadı.' }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  const suspended = form.get('suspended') === 'true';
  const messageRaw = form.get('message');
  const message = typeof messageRaw === 'string' ? messageRaw.trim() : '';
  const file = form.get('image');

  if (!suspended) {
    // Yayına geri al — mesaj/görsel bir sonraki askıya alma için saklı kalır.
    const { error } = await admin
      .from('venues')
      .update({ is_suspended: false })
      .eq('id', venue.id);
    if (error) {
      return NextResponse.json({ error: 'Güncellenemedi.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, isSuspended: false });
  }

  let imageUrl = venue.suspension_image_url as string | null;

  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Yalnızca JPG, PNG veya WebP görsel yükleyebilirsiniz.' },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Görsel en fazla 8 MB olabilir.' }, { status: 400 });
    }
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${venue.org_id}/admin/suspend-${Date.now().toString(36)}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from('venue-media')
      .upload(path, bytes, { contentType: file.type, upsert: true });
    if (upErr) {
      return NextResponse.json({ error: 'Görsel kaydedilemedi.' }, { status: 500 });
    }
    const {
      data: { publicUrl },
    } = admin.storage.from('venue-media').getPublicUrl(path);
    imageUrl = publicUrl;
  }

  const { error } = await admin
    .from('venues')
    .update({
      is_suspended: true,
      suspended_at: new Date().toISOString(),
      suspension_message: message || venue.suspension_message,
      suspension_image_url: imageUrl,
    })
    .eq('id', venue.id);
  if (error) {
    return NextResponse.json({ error: 'Güncellenemedi.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    isSuspended: true,
    message: message || venue.suspension_message || null,
    imageUrl,
  });
}
