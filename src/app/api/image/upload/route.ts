import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { authorizeImageTarget } from '@/lib/image-access';

export const runtime = 'nodejs';

const ACCEPTED_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const MAX_BYTES = 10 * 1024 * 1024;

/** Pano/süper-admin oturumlarında da çalışan, yetkili venue-media yüklemesi. */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const itemId = form?.get('itemId');
  const categoryId = form?.get('categoryId');
  const temporary = form?.get('temporary') === 'true';

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Görsel dosyası gerekli.' }, { status: 400 });
  }
  const ext = ACCEPTED_TYPES.get(file.type);
  if (!ext) {
    return NextResponse.json({ error: 'JPG, PNG veya WebP yükleyin.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Görsel 10 MB sınırını aşıyor.' }, { status: 400 });
  }

  const ids = {
    itemId: typeof itemId === 'string' ? itemId : undefined,
    categoryId: typeof categoryId === 'string' ? categoryId : undefined,
  };
  if (Boolean(ids.itemId) === Boolean(ids.categoryId)) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  const access = await authorizeImageTarget(createClient(), ids);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { target } = access;
  const directory = temporary ? 'tmp' : target.subdir;
  const path = `${target.orgId}/${directory}/${temporary ? crypto.randomUUID() : `${target.id}-${crypto.randomUUID()}`}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from('venue-media')
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
  if (error) {
    return NextResponse.json({ error: 'Yükleme başarısız. Bağlantınızı kontrol edin.' }, { status: 500 });
  }

  const { data } = admin.storage.from('venue-media').getPublicUrl(path);
  return NextResponse.json({ imageUrl: data.publicUrl });
}
