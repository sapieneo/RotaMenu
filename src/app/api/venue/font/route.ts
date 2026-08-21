import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAdminSession } from '@/lib/admin-auth';
import { hasPanoSession } from '@/lib/pano-auth';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024;
const EDITOR_ROLES = ['owner', 'admin', 'editor'];
const CONTENT_TYPES = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
} as const;
type FontExtension = keyof typeof CONTENT_TYPES;

type VenueAccess =
  | { ok: true; orgId: string }
  | { ok: false; status: 401 | 403 | 404; error: string };

async function authorizeVenue(venueId: string): Promise<VenueAccess> {
  const supabase = createClient();
  const admin = createAdminClient();
  const [{ data: { user } }, { data: venue }] = await Promise.all([
    supabase.auth.getUser(),
    admin.from('venues').select('id, org_id').eq('id', venueId).maybeSingle(),
  ]);

  if (!venue) return { ok: false, status: 404, error: 'İşletme bulunamadı.' };
  if (isAdminSession() || hasPanoSession(venueId)) return { ok: true, orgId: venue.org_id };
  if (!user) return { ok: false, status: 401, error: 'Oturum bulunamadı.' };

  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('org_id', venue.org_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !EDITOR_ROLES.includes(membership.role)) {
    return { ok: false, status: 403, error: 'Bu işlem için yetkiniz yok.' };
  }
  return { ok: true, orgId: venue.org_id };
}

/** Dosya uzantısına/MIME beyanına güvenmeden gerçek font imzasını denetler. */
function detectFont(bytes: Uint8Array): FontExtension | null {
  if (bytes.length < 4) return null;
  const signature = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  if (signature === 'wOF2') return 'woff2';
  if (signature === 'wOFF') return 'woff';
  if (signature === 'OTTO') return 'otf';
  if (signature === 'true' || signature === 'typ1') return 'ttf';
  if (bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) return 'ttf';
  return null;
}

function safeDisplayName(name: string, extension: FontExtension): string {
  const cleaned = name.replace(/[^\p{L}\p{N} ._()-]/gu, '').trim().slice(0, 120);
  return cleaned || `Özel font.${extension}`;
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const venueId = form?.get('venueId');

  if (!(file instanceof File) || typeof venueId !== 'string' || !z.string().uuid().safeParse(venueId).success) {
    return NextResponse.json({ error: 'Font dosyası ve işletme gerekli.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Font 5 MB sınırını aşıyor.' }, { status: 400 });
  }

  const access = await authorizeVenue(venueId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = detectFont(bytes);
  if (!extension) {
    return NextResponse.json({ error: 'Geçerli bir WOFF2, WOFF, TTF veya OTF fontu yükleyin.' }, { status: 400 });
  }

  const path = `${access.orgId}/${venueId}/${crypto.randomUUID()}.${extension}`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from('venue-fonts')
    .upload(path, bytes, { contentType: CONTENT_TYPES[extension], upsert: false });
  if (error) {
    return NextResponse.json({ error: 'Font yüklenemedi.', details: error.message }, { status: 500 });
  }

  const { data } = admin.storage.from('venue-fonts').getPublicUrl(path);
  return NextResponse.json({ fontUrl: data.publicUrl, fontName: safeDisplayName(file.name, extension) });
}

const deleteSchema = z.object({ venueId: z.string().uuid(), fontUrl: z.string().url() });

export async function DELETE(request: NextRequest) {
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  const access = await authorizeVenue(parsed.data.venueId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-fonts/`;
  if (!parsed.data.fontUrl.startsWith(prefix)) {
    return NextResponse.json({ error: 'Geçersiz font adresi.' }, { status: 400 });
  }
  let path: string;
  try {
    path = decodeURIComponent(parsed.data.fontUrl.slice(prefix.length));
  } catch {
    return NextResponse.json({ error: 'Geçersiz font adresi.' }, { status: 400 });
  }
  const segments = path.split('/');
  if (
    segments.length !== 3 ||
    segments[0] !== access.orgId ||
    segments[1] !== parsed.data.venueId ||
    !/^[0-9a-f-]{36}\.(woff2|woff|ttf|otf)$/i.test(segments[2]!)
  ) {
    return NextResponse.json({ error: 'Bu font silinemez.' }, { status: 403 });
  }

  const { error } = await createAdminClient().storage.from('venue-fonts').remove([path]);
  if (error) return NextResponse.json({ error: 'Font silinemedi.', details: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
