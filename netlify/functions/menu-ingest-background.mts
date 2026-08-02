import type { Context } from '@netlify/functions';

declare const Netlify: {
  env: { get(name: string): string | undefined };
};

type Payload = {
  ingestionId: string;
  pages: Array<{
    storagePath: string;
    mimeType: string;
    sourceType: 'image' | 'pdf';
  }>;
};

export default async function menuIngestBackground(request: Request, _context: Context) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });

  const body = await request.text();
  const serviceRoleKey = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const signature = request.headers.get('x-restaurantos-signature') ?? '';
  if (!serviceRoleKey || !(await verifySignature(body, signature, serviceRoleKey))) {
    return new Response(null, { status: 401 });
  }

  const payload = parsePayload(body);
  if (!payload) return new Response(null, { status: 400 });

  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const claimed = await claimIngestion(supabaseUrl, serviceRoleKey, payload.ingestionId);
  if (!claimed) return new Response(null, { status: 202 });

  try {
    const [{ createClient }, { processMenuIngestion }] = await Promise.all([
      import('@supabase/supabase-js'),
      import('../../src/lib/ai/process-menu-ingestion'),
    ]);
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await processMenuIngestion({
      admin,
      ingestionId: payload.ingestionId,
      pages: payload.pages,
      claimedOrgId: claimed.org_id,
      openAI: {
        apiKey: requireEnv('OPENAI_API_KEY'),
        model: Netlify.env.get('OPENAI_MENU_MODEL'),
      },
    });
  } catch (error) {
    console.error('Background ingestion worker failed to start', {
      type: error instanceof Error ? error.name : 'unknown',
    });
    await markFailed(
      supabaseUrl,
      serviceRoleKey,
      payload.ingestionId,
      'Arka plan menü işleyicisi başlatılamadı. Lütfen tekrar deneyin.'
    );
  }

  return new Response(null, { status: 202 });
}

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const { createHmac, timingSafeEqual } = await import('node:crypto');
  const expected = Buffer.from(
    createHmac('sha256', secret)
      .update('restaurantos-menu-ingestion-v1\0')
      .update(body)
      .digest('hex'),
    'hex'
  );
  const received = Buffer.from(signature, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function parsePayload(body: string): Payload | null {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<Payload>;
  if (typeof candidate.ingestionId !== 'string' || !Array.isArray(candidate.pages)) return null;
  if (candidate.pages.length < 1 || candidate.pages.length > 10) return null;
  const validPages = candidate.pages.every(
    (page) =>
      page &&
      typeof page.storagePath === 'string' &&
      typeof page.mimeType === 'string' &&
      (page.sourceType === 'image' || page.sourceType === 'pdf')
  );
  return validPages ? (candidate as Payload) : null;
}

async function claimIngestion(
  supabaseUrl: string,
  serviceRoleKey: string,
  ingestionId: string
): Promise<{ id: string; org_id: string } | null> {
  const query = new URLSearchParams({
    id: `eq.${ingestionId}`,
    status: 'eq.uploaded',
    select: 'id,org_id',
  });
  const response = await fetch(`${supabaseUrl}/rest/v1/menu_ingestions?${query}`, {
    method: 'PATCH',
    headers: adminHeaders(serviceRoleKey, 'return=representation'),
    body: JSON.stringify({ status: 'processing', error_message: null }),
  });
  if (!response.ok) throw new Error(`Ingestion claim failed (${response.status})`);
  const rows = (await response.json()) as Array<{ id: string; org_id: string }>;
  return rows[0] ?? null;
}

async function markFailed(
  supabaseUrl: string,
  serviceRoleKey: string,
  ingestionId: string,
  message: string
) {
  const query = new URLSearchParams({ id: `eq.${ingestionId}` });
  await fetch(`${supabaseUrl}/rest/v1/menu_ingestions?${query}`, {
    method: 'PATCH',
    headers: adminHeaders(serviceRoleKey),
    body: JSON.stringify({ status: 'failed', error_message: message }),
  });
}

function adminHeaders(serviceRoleKey: string, prefer?: string): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function requireEnv(name: string): string {
  const value = Netlify.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
