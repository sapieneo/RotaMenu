import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { isAdminSession } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Reklam yönetimi — YALNIZCA Rota Menü yöneticisi (süper-admin oturumu).
 *
 * Reklamlar platform düzeyindedir: bir işletmeye ait değildir, işletme
 * panelinden ne görülür ne değiştirilir. `ads`, `ad_placements` ve `ad_events`
 * tablolarında RLS açık ve hiç politika yok — yani service_role dışında hiçbir
 * yol erişemiyor. Bu uç da her istekte `isAdminSession()` istiyor.
 *
 * POST      multipart/form-data ile yeni reklam (medya dosyası + alanlar)
 * PATCH     JSON ile alan güncelleme ve/veya hedef menü listesi
 * DELETE    reklamı ve medyasını siler
 */

const MAX_BYTES = 15 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4'];

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
};

function guard() {
  if (!isAdminSession()) {
    return NextResponse.json({ error: 'Bu sayfaya erişim yetkin yok.' }, { status: 401 });
  }
  return null;
}

const patchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  durationSeconds: z.number().int().min(2).max(30).optional(),
  clickUrl: z.string().trim().max(500).nullish(),
  allVenues: z.boolean().optional(),
  isActive: z.boolean().optional(),
  weight: z.number().int().min(1).max(10).optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  /** Verilirse hedef menü listesi TAMAMEN bununla değiştirilir. */
  venueIds: z.array(z.string().uuid()).max(500).optional(),
});

/** Reklam tıklama bağlantısı misafirin tarayıcısında açılıyor: http/https şart. */
function safeClickUrl(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const denied = guard();
  if (denied) return denied;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Reklam görseli veya videosu gerekli.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Dosya 15 MB sınırını aşıyor.' }, { status: 400 });
  }
  const isImage = IMAGE_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: 'JPG, PNG, WebP, GIF veya MP4 yükleyebilirsin.' }, { status: 400 });
  }

  const name = String(form.get('name') ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Reklam adı gerekli.' }, { status: 400 });

  const duration = Number(form.get('durationSeconds') ?? 5);
  if (!Number.isInteger(duration) || duration < 2 || duration > 30) {
    return NextResponse.json({ error: 'Süre 2 ile 30 saniye arasında olmalı.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const path = `${crypto.randomUUID()}.${EXT[file.type]}`;
  const { error: upErr } = await admin.storage
    .from('ad-media')
    .upload(path, file, { contentType: file.type });
  if (upErr) {
    console.error('[api/admin/ads] upload failed', { message: upErr.message });
    return NextResponse.json({ error: 'Dosya yüklenemedi.' }, { status: 500 });
  }
  const {
    data: { publicUrl },
  } = admin.storage.from('ad-media').getPublicUrl(path);

  const { data: ad, error } = await admin
    .from('ads')
    .insert({
      name,
      media_url: publicUrl,
      media_type: isVideo ? 'video' : 'image',
      duration_seconds: duration,
      click_url: safeClickUrl(String(form.get('clickUrl') ?? '')),
      all_venues: String(form.get('allVenues') ?? '') === 'true',
      is_active: true,
    })
    .select('*')
    .single();

  if (error || !ad) {
    // Kayıt açılmadıysa yüklenen dosyayı bırakma.
    await admin.storage.from('ad-media').remove([path]);
    console.error('[api/admin/ads] insert failed', { message: error?.message });
    return NextResponse.json({ error: 'Reklam kaydedilemedi.' }, { status: 500 });
  }

  return NextResponse.json({ ad }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const denied = guard();
  if (denied) return denied;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz veri.' }, { status: 400 });
  }
  const b = parsed.data;
  const admin = createAdminClient();

  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) patch.name = b.name;
  if (b.durationSeconds !== undefined) patch.duration_seconds = b.durationSeconds;
  if (b.clickUrl !== undefined) patch.click_url = safeClickUrl(b.clickUrl);
  if (b.allVenues !== undefined) patch.all_venues = b.allVenues;
  if (b.isActive !== undefined) patch.is_active = b.isActive;
  if (b.weight !== undefined) patch.weight = b.weight;
  if (b.startsOn !== undefined) patch.starts_on = b.startsOn || null;
  if (b.endsOn !== undefined) patch.ends_on = b.endsOn || null;

  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from('ads').update(patch).eq('id', b.id);
    if (error) {
      console.error('[api/admin/ads] update failed', { message: error.message });
      return NextResponse.json({ error: 'Güncellenemedi.' }, { status: 500 });
    }
  }

  // Hedef menüler: gönderildiyse liste komple değiştirilir.
  if (b.venueIds) {
    const { error: delErr } = await admin.from('ad_placements').delete().eq('ad_id', b.id);
    if (delErr) {
      console.error('[api/admin/ads] placement clear failed', { message: delErr.message });
      return NextResponse.json({ error: 'Hedef menüler güncellenemedi.' }, { status: 500 });
    }
    if (b.venueIds.length > 0) {
      const { error: insErr } = await admin
        .from('ad_placements')
        .insert(b.venueIds.map((venueId) => ({ ad_id: b.id, venue_id: venueId })));
      if (insErr) {
        console.error('[api/admin/ads] placement insert failed', { message: insErr.message });
        return NextResponse.json({ error: 'Hedef menüler güncellenemedi.' }, { status: 500 });
      }
    }
  }

  const { data: ad } = await admin.from('ads').select('*').eq('id', b.id).maybeSingle();
  return NextResponse.json({ ad });
}

export async function DELETE(request: NextRequest) {
  const denied = guard();
  if (denied) return denied;

  const parsed = z
    .object({ id: z.string().uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: ad } = await admin.from('ads').select('media_url').eq('id', parsed.data.id).maybeSingle();

  const { error } = await admin.from('ads').delete().eq('id', parsed.data.id);
  if (error) {
    console.error('[api/admin/ads] delete failed', { message: error.message });
    return NextResponse.json({ error: 'Silinemedi.' }, { status: 500 });
  }

  // Depodaki dosyayı da temizle (kayıt gitti, dosya yetim kalmasın).
  const url = (ad?.media_url as string | undefined) ?? '';
  const marker = '/ad-media/';
  const at = url.indexOf(marker);
  if (at >= 0) {
    const objectPath = url.slice(at + marker.length).split('?')[0];
    await admin.storage.from('ad-media').remove([objectPath]);
  }

  return NextResponse.json({ ok: true });
}
