// Demo menüye (venue slug='demo') AI kategori arka planları + ürün fotoğrafları üretir.
// Runware (görsel) + OpenAI (İngilizce prompt çevirisi) kullanır, venue-media'ya yükler,
// categories.background_url / items.image_url alanlarını günceller.
//
// Çalıştır:  node scripts/generate-demo-images.mjs [--force] [--only=categories|items]
//   --force        Zaten görseli olanları da yeniden üretir.
//   --only=categories   Yalnızca kategori arka planlarını üretir.
//   --only=items        Yalnızca ürün fotoğraflarını üretir.
//
// Gereken .env.local anahtarları: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// RUNWARE_API_KEY, (opsiyonel) OPENAI_API_KEY, OPENAI_TEXT_MODEL, RUNWARE_MODEL, RUNWARE_STEPS.

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(here, '..', '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY = (args.find((a) => a.startsWith('--only='))?.split('=')[1]) ?? null; // 'categories' | 'items' | null

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Eksik: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local)');
  process.exit(1);
}
if (!env.RUNWARE_API_KEY) {
  console.error('Eksik: RUNWARE_API_KEY (.env.local). Runware panelinden anahtarı alıp yapıştır.');
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUNWARE_URL = 'https://api.runware.ai/v1';
const RUNWARE_MODEL = env.RUNWARE_MODEL ?? 'runware:100@1';
const RUNWARE_STEPS = Number(env.RUNWARE_STEPS ?? '4');
const OPENAI_URL = 'https://api.openai.com/v1/responses';
const OPENAI_MODEL = env.OPENAI_TEXT_MODEL ?? 'gpt-5.6-luna';

const NEGATIVE_PROMPT =
  'text, letters, watermark, logo, blurry, low quality, deformed, cartoon, illustration, cgi, extra objects, wrong food';

const DESCRIBE_SYSTEM = `Bir restoran menüsü için görsel üretim öznesi yazıyorsun.
Sana bir menü ürünü verilecek (adı Türkçe olabilir). Görevin: ürünün FİZİKSEL
olarak nasıl göründüğünü anlatan KISA, İngilizce, gerçekçi bir ifade üret —
tek bir fotoğrafın öznesi olacak şekilde. Yemekse tabakta, içecekse uygun
bardak/kadeh içinde. Türkçe adı olduğu gibi bırakabilirsin ama İngilizce
görsel betimleme ekle.
SADECE ifadeyi yaz; tırnak, açıklama, ekstra kelime yok.
Örnekler:
"Su" -> a clear glass of still water on a table
"Ayran" -> a glass of ayran, a white frothy Turkish yogurt drink
"Izgara Köfte" -> grilled Turkish meatballs (kofte) on a plate with garnish`;

const CATEGORY_SYSTEM = `Bir restoran menüsünde kategori başlığının ARKASINDA
gösterilecek atmosferik arka plan sahnesini betimliyorsun. Sana kategori adı
verilecek (Türkçe olabilir). Görevin: kategoriye uygun, İngilizce, KISA bir
ortam/atmosfer betimlemesi üret — yumuşak odaklı, banner arka planı olacak;
belirgin tek bir ürün ya da yazı olmasın.
SADECE ifadeyi yaz; tırnak, açıklama, ekstra kelime yok.
Örnekler:
"Tatlılar" -> an elegant dessert table with soft pastel tones and blurred lights
"Izgaralar" -> a warm restaurant kitchen grill scene with gentle steam`;

async function describeWithOpenAI(system, input, maxTokens) {
  if (!env.OPENAI_API_KEY) return null;
  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions: system,
        input,
        reasoning: { effort: 'none' },
        max_output_tokens: maxTokens,
        text: { verbosity: 'low' },
        store: false,
      }),
    });
    const json = await res.json();
    if (!res.ok || json.error) return null;
    const text = (json.output ?? [])
      .filter((i) => i.type === 'message')
      .flatMap((i) => i.content ?? [])
      .filter((c) => c.type === 'output_text')
      .map((c) => c.text ?? '')
      .join('')
      .trim();
    return text ? text.replace(/^['"]|['"]$/g, '').trim() : null;
  } catch {
    return null;
  }
}

function buildFoodPrompt(subject) {
  return (
    `Professional food and beverage photography of ${subject}. ` +
    `Appetizing, realistic, restaurant menu style, freshly served and plated on a table, ` +
    `soft natural lighting, shallow depth of field, high detail, photorealistic. ` +
    `No text, no watermark, no extra dishes.`
  );
}

function buildBackgroundPrompt(subject) {
  return (
    `Atmospheric wide background photograph of ${subject}. ` +
    `Soft focus, shallow depth of field, warm ambient lighting, cinematic, ` +
    `restaurant menu banner background. No text, no watermark, no prominent single object.`
  );
}

async function runwareGenerate(prompt, width = 768, height = 768) {
  const task = {
    taskType: 'imageInference',
    taskUUID: randomUUID(),
    positivePrompt: prompt.slice(0, 2000),
    negativePrompt: NEGATIVE_PROMPT,
    width,
    height,
    model: RUNWARE_MODEL,
    steps: RUNWARE_STEPS,
    numberResults: 1,
    outputType: 'URL',
    outputFormat: 'WEBP',
  };
  const res = await fetch(RUNWARE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RUNWARE_API_KEY}` },
    body: JSON.stringify([task]),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.error || json.errors) {
    const msg = json?.errors?.[0]?.message ?? json?.error ?? `Runware hata (${res.status})`;
    throw new Error(msg);
  }
  const imageURL = json.data?.find((d) => d.taskType === 'imageInference')?.imageURL;
  if (!imageURL) throw new Error('Runware görsel döndürmedi.');
  const imgRes = await fetch(imageURL);
  if (!imgRes.ok) throw new Error('Üretilen görsel indirilemedi.');
  return Buffer.from(await imgRes.arrayBuffer());
}

async function main() {
  const { data: venue, error: vErr } = await admin
    .from('venues')
    .select('id, org_id, slug, name')
    .eq('slug', 'demo')
    .maybeSingle();
  if (vErr || !venue) {
    console.error('Demo venue bulunamadı:', vErr?.message ?? '(kayıt yok)');
    process.exit(1);
  }
  console.log(`Demo venue: ${venue.name} (${venue.id})`);

  const { data: menus } = await admin.from('menus').select('id, name').eq('venue_id', venue.id);
  if (!menus?.length) {
    console.error('Demo venue için menü bulunamadı.');
    process.exit(1);
  }

  let catCount = 0;
  let itemCount = 0;
  let errCount = 0;

  for (const menu of menus) {
    const { data: categories } = await admin
      .from('categories')
      .select('id, name, background_url')
      .eq('menu_id', menu.id);

    for (const cat of categories ?? []) {
      if (ONLY === 'items') continue;
      if (cat.background_url && !FORCE) {
        console.log(`[kategori] "${cat.name}" zaten görsele sahip, atlanıyor (--force ile yenile).`);
        continue;
      }
      try {
        const subject = (await describeWithOpenAI(CATEGORY_SYSTEM, `Kategori: ${cat.name}`, 100)) ?? cat.name;
        const prompt = buildBackgroundPrompt(subject);
        console.log(`[kategori] "${cat.name}" üretiliyor...`);
        const bytes = await runwareGenerate(prompt, 1024, 512);
        const path = `${venue.org_id}/categories/${cat.id}-${Date.now().toString(36)}.webp`;
        const { error: upErr } = await admin.storage
          .from('venue-media')
          .upload(path, bytes, { contentType: 'image/webp', upsert: true });
        if (upErr) throw new Error(upErr.message);
        const { data: pub } = admin.storage.from('venue-media').getPublicUrl(path);
        const { error: updErr } = await admin
          .from('categories')
          .update({ background_url: pub.publicUrl })
          .eq('id', cat.id);
        if (updErr) throw new Error(updErr.message);
        console.log(`  ✓ ${pub.publicUrl}`);
        catCount++;
      } catch (err) {
        console.error(`  ✗ "${cat.name}" başarısız: ${err.message}`);
        errCount++;
      }

      const { data: items } = await admin
        .from('items')
        .select('id, name, description, ingredients, image_url')
        .eq('category_id', cat.id);

      if (ONLY === 'categories') continue;

      for (const item of items ?? []) {
        if (item.image_url && !FORCE) {
          console.log(`  [ürün] "${item.name}" zaten görsele sahip, atlanıyor.`);
          continue;
        }
        try {
          const parts = [`Ürün: ${item.name}`];
          if (item.description) parts.push(`Açıklama: ${item.description}`);
          if (item.ingredients) parts.push(`İçindekiler: ${item.ingredients}`);
          const subject = (await describeWithOpenAI(DESCRIBE_SYSTEM, parts.join('\n'), 120)) ?? item.name;
          const prompt = buildFoodPrompt(subject);
          console.log(`  [ürün] "${item.name}" üretiliyor...`);
          const bytes = await runwareGenerate(prompt, 768, 768);
          const path = `${venue.org_id}/items/${item.id}-${Date.now().toString(36)}.webp`;
          const { error: upErr } = await admin.storage
            .from('venue-media')
            .upload(path, bytes, { contentType: 'image/webp', upsert: true });
          if (upErr) throw new Error(upErr.message);
          const { data: pub } = admin.storage.from('venue-media').getPublicUrl(path);
          const { error: updErr } = await admin.from('items').update({ image_url: pub.publicUrl }).eq('id', item.id);
          if (updErr) throw new Error(updErr.message);
          console.log(`    ✓ ${pub.publicUrl}`);
          itemCount++;
        } catch (err) {
          console.error(`    ✗ "${item.name}" başarısız: ${err.message}`);
          errCount++;
        }
      }
    }
  }

  console.log(`\nTamam. Kategori: ${catCount}, Ürün: ${itemCount}, Hata: ${errCount}`);
}

main().catch((err) => {
  console.error('Beklenmeyen hata:', err);
  process.exit(1);
});
