import type { Context } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { verifyBackgroundPayload } from '../../src/lib/ai/background-auth';
import { processMenuIngestion } from '../../src/lib/ai/process-menu-ingestion';

declare const Netlify: {
  env: { get(name: string): string | undefined };
};

const payloadSchema = z.object({
  ingestionId: z.string().uuid(),
  pages: z
    .array(
      z.object({
        storagePath: z.string().min(3),
        mimeType: z.string().min(1),
        sourceType: z.enum(['image', 'pdf']),
      })
    )
    .min(1)
    .max(10),
});

export default async function menuIngestBackground(request: Request, _context: Context) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });

  const payload = await request.text();
  const signature = request.headers.get('x-restaurantos-signature') ?? '';
  const serviceRoleKey = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!serviceRoleKey || !verifyBackgroundPayload(payload, signature, serviceRoleKey)) {
    return new Response(null, { status: 401 });
  }

  const parsed = payloadSchema.safeParse(JSON.parse(payload));
  if (!parsed.success) return new Response(null, { status: 400 });

  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await processMenuIngestion({
    admin,
    ingestionId: parsed.data.ingestionId,
    pages: parsed.data.pages,
    openAI: {
      apiKey: requireEnv('OPENAI_API_KEY'),
      model: Netlify.env.get('OPENAI_MENU_MODEL'),
    },
  });

  return new Response(null, { status: 202 });
}

function requireEnv(name: string): string {
  const value = Netlify.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
