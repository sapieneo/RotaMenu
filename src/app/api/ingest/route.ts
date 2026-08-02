import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { MenuPage } from '@/lib/ai/extract';
import { signBackgroundPayload } from '@/lib/ai/background-auth';
import { processMenuIngestion, type StoredMenuPage } from '@/lib/ai/process-menu-ingestion';

export const runtime = 'nodejs';
export const maxDuration = 120; // AI çıkarma 60 sn'yi bulabilir

const pageSchema = z.object({
  storagePath: z.string().min(3), // {org_id}/{uuid}.{ext}
  mimeType: z.string(),
  sourceType: z.enum(['image', 'pdf']),
});

const bodySchema = z.object({
  venueId: z.string().uuid(),
  /** Aynı menünün bir veya daha fazla sayfası (tek çıkarmada birleştirilir). */
  pages: z.array(pageSchema).min(1).max(10),
});

/**
 * POST /api/ingest
 * Yüklenmiş bir veya daha fazla sayfa için içe aktarma başlatır ve AI çıkarmayı
 * çalıştırır. Durum makinesi: uploaded → processing → review | failed.
 * İdempotent: aynı venue + aynı sayfa seti (input_hash) için mevcut sonucu döner.
 */
export async function POST(request: NextRequest) {
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
  const { venueId, pages } = parsed.data;

  const { data: venue } = await supabase
    .from('venues')
    .select('id, org_id')
    .eq('id', venueId)
    .maybeSingle();
  if (!venue) {
    return NextResponse.json({ error: 'Mekân bulunamadı.' }, { status: 404 });
  }
  // Her sayfa org klasörüyle başlamalı — başka org'un dosyası işlenemez.
  if (pages.some((p) => !p.storagePath.startsWith(`${venue.org_id}/`))) {
    return NextResponse.json({ error: 'Geçersiz dosya yolu.' }, { status: 403 });
  }

  // Tüm sayfaları indir (admin — kullanıcı yetkisi yukarıda doğrulandı)
  const admin = createAdminClient();
  const menuPages: MenuPage[] = [];
  const hash = createHash('sha256');
  for (const p of pages) {
    const { data: blob, error: dlErr } = await admin.storage.from('menu-uploads').download(p.storagePath);
    if (dlErr || !blob) {
      return NextResponse.json({ error: 'Dosya okunamadı. Lütfen yeniden yükleyin.' }, { status: 400 });
    }
    const buffer = Buffer.from(await blob.arrayBuffer());
    hash.update(buffer);
    menuPages.push({ buffer, mimeType: p.mimeType });
  }
  const inputHash = hash.digest('hex');

  // İdempotency: aynı sayfa seti bu venue için zaten işlendiyse onu döndür
  const { data: existing } = await supabase
    .from('menu_ingestions')
    .select('id, status')
    .eq('venue_id', venueId)
    .eq('input_hash', inputHash)
    .in('status', ['review', 'approved'])
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ id: existing.id, status: existing.status, deduplicated: true });
  }

  const { data: ingestion, error: insErr } = await supabase
    .from('menu_ingestions')
    .insert({
      venue_id: venueId,
      org_id: venue.org_id,
      uploaded_by: user.id,
      source_type: pages.some((p) => p.sourceType === 'pdf') ? 'pdf' : 'image',
      storage_path: pages[0].storagePath,
      input_hash: inputHash,
      status: 'uploaded',
    })
    .select('id')
    .single();
  if (insErr || !ingestion) {
    return NextResponse.json({ error: 'İçe aktarma başlatılamadı.' }, { status: 500 });
  }

  const storedPages = pages as StoredMenuPage[];
  const netlifyOrigin = getNetlifyOrigin();
  if (netlifyOrigin) {
    const queued = await enqueueBackgroundIngestion(netlifyOrigin, ingestion.id, storedPages);
    if (!queued) {
      const message = 'Menü çıkarma işi başlatılamadı. Lütfen tekrar deneyin.';
      await admin
        .from('menu_ingestions')
        .update({ status: 'failed', error_message: message })
        .eq('id', ingestion.id);
      return NextResponse.json({ id: ingestion.id, status: 'failed', error: message }, { status: 502 });
    }
    return NextResponse.json({ id: ingestion.id, status: 'processing' }, { status: 202 });
  }

  const result = await processMenuIngestion({
    admin,
    ingestionId: ingestion.id,
    pages: storedPages,
    preloadedPages: menuPages,
  });
  return NextResponse.json(
    { id: ingestion.id, ...result },
    { status: result.status === 'failed' ? 502 : 200 }
  );
}

type NetlifyRuntimeGlobal = typeof globalThis & {
  Netlify?: { env: { get(name: string): string | undefined } };
};

function getNetlifyEnv(name: string): string | undefined {
  return (globalThis as NetlifyRuntimeGlobal).Netlify?.env.get(name) ?? process.env[name];
}

function getNetlifyOrigin(): string | null {
  const siteId = getNetlifyEnv('SITE_ID');
  const origin = getNetlifyEnv('DEPLOY_PRIME_URL') ?? getNetlifyEnv('URL');
  return siteId && origin ? origin : null;
}

async function enqueueBackgroundIngestion(
  origin: string,
  ingestionId: string,
  pages: StoredMenuPage[]
): Promise<boolean> {
  const secret = getNetlifyEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) return false;

  const payload = JSON.stringify({ ingestionId, pages });
  const signature = signBackgroundPayload(payload, secret);
  try {
    const response = await fetch(`${origin}/.netlify/functions/menu-ingest-background`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RestaurantOS-Signature': signature,
      },
      body: payload,
    });
    return response.status === 202;
  } catch (error) {
    console.error('Background ingestion enqueue failed', {
      type: error instanceof Error ? error.name : 'unknown',
    });
    return false;
  }
}
