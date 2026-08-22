import type { Context } from '@netlify/functions';

declare const Netlify: { env: { get(name: string): string | undefined } };

type Payload = { jobId: string; followupJobIds: string[] };
type Job = {
  id: string;
  org_id: string;
  menu_id: string;
  job_type: 'description' | 'translation';
  locale: string;
};
type Category = { id: string; name: string };
type Item = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  ingredients: string | null;
};

export default async function menuTranslateBackground(request: Request, _context: Context) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const body = await request.text();
  const serviceRoleKey = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const signature = request.headers.get('x-rotamenu-signature')
    ?? request.headers.get('x-restaurantos-signature')
    ?? '';
  if (!serviceRoleKey || !(await verifySignature(body, signature, serviceRoleKey))) {
    return new Response(null, { status: 401 });
  }

  const payload = parsePayload(body);
  if (!payload) return new Response(null, { status: 400 });
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const job = await claimJob(supabaseUrl, serviceRoleKey, payload.jobId);
  if (!job) return new Response(null, { status: 202 });

  try {
    await processJob(supabaseUrl, serviceRoleKey, job);
    if (job.job_type === 'description' && payload.followupJobIds.length) {
      await enqueueFollowups(request.url, serviceRoleKey, payload.followupJobIds);
    }
  } catch (error) {
    console.error('Background translation worker failed', {
      jobId: job.id,
      type: error instanceof Error ? error.name : 'unknown',
      message: error instanceof Error ? error.message : 'unknown',
    });
    await updateJob(supabaseUrl, serviceRoleKey, job.id, {
      status: 'failed',
      error_message: 'Çeviri servisi geçici olarak yanıt veremedi. Lütfen tekrar deneyin.',
    });
  }
  return new Response(null, { status: 202 });
}

async function processJob(supabaseUrl: string, key: string, job: Job) {
  const [categories, orgItems] = await Promise.all([
    restGet<Category[]>(supabaseUrl, key, 'categories', {
      menu_id: `eq.${job.menu_id}`,
      is_active: 'eq.true',
      select: 'id,name',
      order: 'sort_order.asc',
    }),
    restGet<Item[]>(supabaseUrl, key, 'items', {
      org_id: `eq.${job.org_id}`,
      select: 'id,category_id,name,description,ingredients',
      order: 'sort_order.asc',
    }),
  ]);
  const categoryIds = new Set(categories.map((category) => category.id));
  const items = orgItems.filter((item) => categoryIds.has(item.category_id));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const inputItems = items.map((item) => ({
    id: item.id,
    categoryName: categoryName.get(item.category_id) ?? '',
    name: item.name,
    description: item.description,
    ingredients: item.ingredients,
  }));
  const ai = await import('../../src/lib/ai/translate');
  const options = {
    apiKey: requireEnv('OPENAI_API_KEY'),
    model: Netlify.env.get('OPENAI_TRANSLATION_MODEL'),
  };

  if (job.job_type === 'description') {
    const missing = inputItems.filter((item) => !item.description?.trim());
    await updateJob(supabaseUrl, key, job.id, { total_items: missing.length });
    for (let index = 0; index < missing.length; index += 25) {
      const chunk = missing.slice(index, index + 25);
      const result = await withRetry(() => ai.generateMenuDescriptions(chunk, options));
      await Promise.all(
        result.items.map((item) =>
          restPatch(supabaseUrl, key, 'items', { id: `eq.${item.id}` }, { description: item.description })
        )
      );
      await updateJob(supabaseUrl, key, job.id, {
        progress: progress(index + chunk.length, missing.length),
        model: result.model,
      });
    }
  } else {
    const { MENU_LANGUAGE_BY_CODE } = await import('../../src/lib/languages');
    const language = MENU_LANGUAGE_BY_CODE.get(job.locale);
    if (!language) throw new Error('Unsupported locale');
    const existingTranslations = await restGet<Array<{ item_id: string }>>(
      supabaseUrl,
      key,
      'item_translations',
      { org_id: `eq.${job.org_id}`, locale: `eq.${job.locale}`, select: 'item_id' }
    );
    const translatedItemIds = new Set(existingTranslations.map((translation) => translation.item_id));
    const remainingItems = inputItems.filter((item) => !translatedItemIds.has(item.id));
    await updateJob(supabaseUrl, key, job.id, {
      total_items: items.length,
      progress: progress(inputItems.length - remainingItems.length, inputItems.length),
    });

    const translatedCategories = await withRetry(() =>
      ai.translateMenuContent(language.nativeName, categories, [], options)
    );
    await restUpsert(
      supabaseUrl,
      key,
      'category_translations',
      'category_id,locale',
      translatedCategories.categories.map((category) => ({
        org_id: job.org_id,
        category_id: category.id,
        locale: job.locale,
        name: category.name,
        source: 'ai',
      }))
    );

    const alreadyTranslated = inputItems.length - remainingItems.length;
    for (let index = 0; index < remainingItems.length; index += 25) {
      const chunk = remainingItems.slice(index, index + 25);
      const result = await withRetry(() =>
        ai.translateMenuContent(language.nativeName, [], chunk, options)
      );
      await restUpsert(
        supabaseUrl,
        key,
        'item_translations',
        'item_id,locale',
        result.items.map((item) => ({
          org_id: job.org_id,
          item_id: item.id,
          locale: job.locale,
          name: item.name,
          description: item.description,
          ingredients: item.ingredients,
          source: 'ai',
        }))
      );
      await updateJob(supabaseUrl, key, job.id, {
        progress: progress(alreadyTranslated + index + chunk.length, inputItems.length),
        model: result.model,
      });
    }
  }

  await updateJob(supabaseUrl, key, job.id, {
    status: 'completed',
    progress: 100,
    error_message: null,
  });
}

async function withRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw lastError;
}

async function verifySignature(body: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const { createHmac, timingSafeEqual } = await import('node:crypto');
  const received = Buffer.from(signature, 'hex');
  return ['rotamenu-menu-translation-v1\0', 'restaurantos-menu-translation-v1\0'].some((context) => {
    const expected = Buffer.from(
      createHmac('sha256', secret).update(context).update(body).digest('hex'),
      'hex'
    );
    return expected.length === received.length && timingSafeEqual(expected, received);
  });
}

function parsePayload(body: string): Payload | null {
  try {
    const value = JSON.parse(body) as Partial<Payload>;
    if (typeof value.jobId !== 'string') return null;
    const followupJobIds = Array.isArray(value.followupJobIds)
      ? value.followupJobIds.filter((id): id is string => typeof id === 'string').slice(0, 20)
      : [];
    return { jobId: value.jobId, followupJobIds };
  } catch {
    return null;
  }
}

async function enqueueFollowups(requestUrl: string, secret: string, jobIds: string[]) {
  const endpoint = new URL('/.netlify/functions/menu-translate-background', requestUrl).toString();
  await Promise.all(
    jobIds.map(async (jobId) => {
      const body = JSON.stringify({ jobId, followupJobIds: [] });
      const { createHmac } = await import('node:crypto');
      const signature = createHmac('sha256', secret)
        .update('rotamenu-menu-translation-v1\0')
        .update(body)
        .digest('hex');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-RotaMenu-Signature': signature },
        body,
      });
      if (response.status !== 202) throw new Error(`Follow-up enqueue failed (${response.status})`);
    })
  );
}

async function claimJob(url: string, key: string, jobId: string): Promise<Job | null> {
  const query = new URLSearchParams({ id: `eq.${jobId}`, status: 'eq.pending', select: 'id,org_id,menu_id,job_type,locale' });
  const response = await fetch(`${url}/rest/v1/menu_translation_jobs?${query}`, {
    method: 'PATCH',
    headers: adminHeaders(key, 'return=representation'),
    body: JSON.stringify({ status: 'processing', progress: 0, error_message: null }),
  });
  if (!response.ok) throw new Error(`Job claim failed (${response.status})`);
  return ((await response.json()) as Job[])[0] ?? null;
}

async function updateJob(url: string, key: string, id: string, values: Record<string, unknown>) {
  await restPatch(url, key, 'menu_translation_jobs', { id: `eq.${id}` }, values);
}

async function restGet<T>(url: string, key: string, table: string, queryValues: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(queryValues);
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, { headers: adminHeaders(key) });
  if (!response.ok) throw new Error(`${table} read failed (${response.status})`);
  return (await response.json()) as T;
}

async function restPatch(
  url: string,
  key: string,
  table: string,
  queryValues: Record<string, string>,
  values: Record<string, unknown>
) {
  const query = new URLSearchParams(queryValues);
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: adminHeaders(key),
    body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error(`${table} update failed (${response.status})`);
}

async function restUpsert(
  url: string,
  key: string,
  table: string,
  conflict: string,
  rows: Record<string, unknown>[]
) {
  if (!rows.length) return;
  const query = new URLSearchParams({ on_conflict: conflict });
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: 'POST',
    headers: adminHeaders(key, 'resolution=merge-duplicates'),
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`${table} upsert failed (${response.status})`);
}

function progress(done: number, total: number) {
  return total === 0 ? 100 : Math.min(99, Math.round((done / total) * 100));
}

function adminHeaders(key: string, prefer?: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function requireEnv(name: string) {
  const value = Netlify.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
