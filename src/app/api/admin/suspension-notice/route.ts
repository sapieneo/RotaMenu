import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { isAdminSession } from '@/lib/admin-auth';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * POST /api/admin/suspension-notice
 *
 * Platform geneli askıya alma bildirimi (tek görsel + tek metin). Askıya
 * alınan HER menü bu ekranı gösterir; yönetici işletme başına ayrı içerik
 * girmez.
 *
 * multipart/form-data:
 *  - message: string (opsiyonel)
 *  - image: File (opsiyonel; gönderilmezse mevcut görsel korunur)
 *  - clearImage: 'true' → görseli kaldır
 */
export async function POST(request: NextRequest) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: current } = await admin
    .from('platform_settings')
    .select('suspension_image_url')
    .eq('id', true)
    .maybeSingle();

  let imageUrl = (current?.suspension_image_url as string | null) ?? null;

  if (form.get('clearImage') === 'true') {
    imageUrl = null;
  }

  const file = form.get('image');
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
    const path = `platform/suspension-${Date.now().toString(36)}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from('venue-media')
      .upload(path, bytes, { contentType: file.type, upsert: true });
    if (upErr) return NextResponse.json({ error: 'Görsel kaydedilemedi.' }, { status: 500 });
    imageUrl = admin.storage.from('venue-media').getPublicUrl(path).data.publicUrl;
  }

  const messageRaw = form.get('message');
  const message = typeof messageRaw === 'string' ? messageRaw.trim() : '';

  const { error } = await admin
    .from('platform_settings')
    .update({
      suspension_message: message || null,
      suspension_image_url: imageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true);
  if (error) return NextResponse.json({ error: 'Kaydedilemedi.' }, { status: 500 });

  return NextResponse.json({ ok: true, message: message || null, imageUrl });
}
