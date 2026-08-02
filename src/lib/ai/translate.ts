import { z } from 'zod';
import { createOpenAIResponse, getOpenAIOutputText } from '@/lib/ai/openai';

const DEFAULT_TRANSLATION_MODEL = 'gpt-5.6-luna';

export type TranslationCategoryInput = { id: string; name: string };
export type TranslationItemInput = {
  id: string;
  categoryName: string;
  name: string;
  description: string | null;
  ingredients: string | null;
};

const descriptionResultSchema = z.object({
  items: z.array(z.object({ id: z.string(), description: z.string().min(1).max(320) })),
});

const translationResultSchema = z.object({
  categories: z.array(z.object({ id: z.string(), name: z.string().min(1).max(160) })),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(240),
      description: z.string().nullable(),
      ingredients: z.string().nullable(),
    })
  ),
});

const DESCRIPTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'description'],
        properties: { id: { type: 'string' }, description: { type: 'string' } },
      },
    },
  },
} as const;

const TRANSLATION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['categories', 'items'],
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name'],
        properties: { id: { type: 'string' }, name: { type: 'string' } },
      },
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'description', 'ingredients'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
          ingredients: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;

export async function generateMenuDescriptions(
  items: TranslationItemInput[],
  options?: { apiKey?: string; model?: string }
) {
  const model = options?.model ?? process.env.OPENAI_TRANSLATION_MODEL ?? DEFAULT_TRANSLATION_MODEL;
  const response = await createOpenAIResponse(
    {
      model,
      instructions:
        'Türkçe restoran menüsü editörüsün. Her ürün için yalnız verilen ad, kategori ve içeriklere dayanarak iştah açıcı ama kısa (en fazla iki cümle) bir açıklama yaz. Malzeme, alerjen, porsiyon, köken veya sağlık iddiası uydurma. Ürün adı dışında bilgi yoksa nötr bir servis cümlesi yaz. Kimlikleri aynen koru ve her girdiyi bir kez döndür.',
      input: JSON.stringify({ items }),
      reasoning: { effort: 'none' },
      max_output_tokens: 12_000,
      text: {
        verbosity: 'low',
        format: { type: 'json_schema', name: 'menu_descriptions', schema: DESCRIPTION_JSON_SCHEMA, strict: true },
      },
    },
    { timeoutMs: 120_000, apiKey: options?.apiKey }
  );
  const parsed = parseAndValidate(getOpenAIOutputText(response), descriptionResultSchema);
  assertExactIds(items.map((item) => item.id), parsed.items.map((item) => item.id));
  return { items: parsed.items, model };
}

export async function translateMenuContent(
  localeName: string,
  categories: TranslationCategoryInput[],
  items: TranslationItemInput[],
  options?: { apiKey?: string; model?: string }
) {
  const model = options?.model ?? process.env.OPENAI_TRANSLATION_MODEL ?? DEFAULT_TRANSLATION_MODEL;
  const response = await createOpenAIResponse(
    {
      model,
      instructions: `Profesyonel restoran menüsü çevirmenisin. Türkçe içeriği ${localeName} diline doğal, misafirin kolay anlayacağı biçimde çevir. Marka ve özel ürün adlarını gerektiğinde koru. Fiyat, para birimi, miktar ve kimlikleri değiştirme. Null alanları null bırak. Yeni malzeme, alerjen veya sağlık iddiası ekleme. Her girdiyi tam bir kez döndür.`,
      input: JSON.stringify({ categories, items }),
      reasoning: { effort: 'none' },
      max_output_tokens: 20_000,
      text: {
        verbosity: 'low',
        format: { type: 'json_schema', name: 'menu_translation', schema: TRANSLATION_JSON_SCHEMA, strict: true },
      },
    },
    { timeoutMs: 120_000, apiKey: options?.apiKey }
  );
  const parsed = parseAndValidate(getOpenAIOutputText(response), translationResultSchema);
  assertExactIds(categories.map((category) => category.id), parsed.categories.map((category) => category.id));
  assertExactIds(items.map((item) => item.id), parsed.items.map((item) => item.id));
  return { ...parsed, model };
}

function parseAndValidate<T>(text: string, schema: z.ZodType<T>): T {
  if (!text) throw new Error('AI yapılandırılmış çıktı üretmedi.');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error('AI çıktısı okunamadı.', { cause: error });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new Error('AI çıktısı beklenen menü yapısıyla eşleşmedi.');
  return parsed.data;
}

function assertExactIds(expected: string[], actual: string[]) {
  const expectedSorted = [...expected].sort();
  const actualSorted = [...actual].sort();
  if (
    expectedSorted.length !== actualSorted.length ||
    expectedSorted.some((id, index) => id !== actualSorted[index])
  ) {
    throw new Error('AI menü satırlarının tamamını döndürmedi.');
  }
}
