import { createOpenAIResponse, getOpenAIOutputText, OpenAIRequestError } from '@/lib/ai/openai';
import { extractedMenuSchema, ALLERGEN_CODES, DIETARY_CODES, type ExtractedMenu } from '@/lib/schemas/menu';

const DEFAULT_MODEL = 'gpt-5.6-terra';

const SYSTEM_PROMPT = `Sen bir restoran menüsü sayısallaştırma uzmanısın.
Sana bir menünün fotoğrafı veya PDF'i verilecek. Görevin:

0. İşletmenin/restoranın adını oku (logo, başlık, üstbilgi veya alt bilgide
   olur) → venue_name_guess. Bu bir ürün ya da kategori adı DEĞİL, mekânın
   kendi adıdır (ör. "Kardeşler Lokantası", "Cafe Nero"). Menüde işletme adı
   hiç görünmüyorsa null bırak; uydurma.
1. TÜM kategorileri ve ürünleri eksiksiz çıkar. Emin olamadığın bölümleri
   atlama; en iyi tahminini yap ve "warnings" listesine not düş.
2. Fiyatları sayı olarak çıkar (para birimi simgelerini sayıya dahil etme).
   Fiyat okunamıyorsa null bırak.
3. Her ürün için içerik adından ve açıklamasından yola çıkarak olası
   alerjenleri tahmin et. Yalnız şu kodları kullan: ${ALLERGEN_CODES.join(', ')}.
   Her tahmine 0-1 arası güven skoru ver. Emin değilsen düşük skor ver;
   uydurma. Bu tahminler işletme sahibi tarafından tek tek onaylanacak.
4. Her ürün için tipik bir porsiyonun kalorisini (calories_kcal) elinden
   gelen EN İYİ tahminle doldur — Türkiye mevzuatı menüde kalori ister ve bu
   değer işletme tarafından onaylanacaktır. Ürünün ne olduğu (ör. "cips",
   "çay", "köfte") kaba bir tahmin için yeterlidir; tam sayı kcal ver.
   Yalnızca gerçekten hiçbir tahmin mümkün değilse (ör. ne olduğu tümüyle
   belirsiz bir ürün) null bırak.
5. Ürünün olası içindekilerini (ingredients) ad ve açıklamadan yola çıkarak
   kısa, virgülle ayrılmış bir liste olarak yaz (ör. "kıyma, soğan, domates,
   baharat"). Emin değilsen null bırak; uydurma.
6. Uygunsa diyet etiketleri öner (dietary). Yalnız şu kodları kullan:
   ${DIETARY_CODES.join(', ')}. Kurallar: alcohol_free = içeriğinde alkol
   olmayan içecek/ürün; vegan = hiç hayvansal ürün yok; vegetarian = et/balık
   yok (süt/yumurta olabilir); halal = domuz ve alkol içermeyen, bariz helal
   ürün (emin değilsen düşük skor veya hiç önerme). Her öneriye 0-1 güven skoru
   ver. Bu etiketler de işletme tarafından onaylanacak; şüphede kal, uydurma.
7. Menünün dilini (language_guess, BCP 47) ve para birimini
   (currency_guess, ISO 4217) tahmin et.

Yalnızca verilen JSON şemasına uygun, tek bir yapılandırılmış menü üret.`;

const MENU_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'menu_name',
    'venue_name_guess',
    'currency_guess',
    'language_guess',
    'warnings',
    'categories',
  ],
  properties: {
    menu_name: { type: 'string' },
    venue_name_guess: { type: ['string', 'null'] },
    currency_guess: { type: ['string', 'null'] },
    language_guess: { type: ['string', 'null'] },
    warnings: { type: 'array', items: { type: 'string' } },
    categories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'items'],
        properties: {
          name: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'name',
                'description',
                'ingredients',
                'price',
                'calories_kcal',
                'allergens',
                'dietary',
              ],
              properties: {
                name: { type: 'string' },
                description: { type: ['string', 'null'] },
                ingredients: { type: ['string', 'null'] },
                price: { type: ['number', 'null'], minimum: 0 },
                calories_kcal: { type: ['integer', 'null'], minimum: 0, maximum: 20000 },
                allergens: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['code', 'confidence'],
                    properties: {
                      code: { type: 'string', enum: [...ALLERGEN_CODES] },
                      confidence: { type: 'number', minimum: 0, maximum: 1 },
                    },
                  },
                },
                dietary: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['code', 'confidence'],
                    properties: {
                      code: { type: 'string', enum: [...DIETARY_CODES] },
                      confidence: { type: 'number', minimum: 0, maximum: 1 },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

type OpenAIInputContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail: 'high' }
  | { type: 'input_file'; filename: string; file_data: string };

export type MenuExtractionDiagnostic = {
  provider: 'openai';
  status?: number;
  code?: string;
  requestId?: string;
};

export class MenuExtractionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly diagnostic?: MenuExtractionDiagnostic
  ) {
    super(message);
    this.name = 'MenuExtractionError';
  }
}

function openAIErrorMessage(error: OpenAIRequestError, model: string): string {
  if (error.status === 401) {
    return 'OpenAI API anahtarı geçersiz veya iptal edilmiş. Lütfen API anahtarını kontrol edin.';
  }
  if (error.status === 403) {
    return 'OpenAI projesinin seçilen modele erişimi yok. Lütfen proje ve model yetkisini kontrol edin.';
  }
  if (error.status === 404) {
    return `OpenAI modeli bulunamadı veya kullanılamıyor: ${model}.`;
  }
  if (error.status === 429) {
    return error.code?.toLowerCase().includes('quota')
      ? 'OpenAI API bakiyesi veya harcama limiti yetersiz. Lütfen OpenAI faturalandırmasını kontrol edin.'
      : 'OpenAI kullanım limiti aşıldı. Lütfen kısa süre sonra tekrar deneyin.';
  }
  if (error.status === 400) {
    return `OpenAI isteği reddetti (${error.code ?? 'invalid_request'}).`;
  }
  if (error.message.includes('OPENAI_API_KEY')) {
    return 'OpenAI API anahtarı sunucu ortamında kullanılamıyor.';
  }
  if (error.message.includes('zaman aşımına')) {
    return 'OpenAI isteği zaman aşımına uğradı. Lütfen tekrar deneyin.';
  }
  if (error.status) {
    return `OpenAI servisi hata verdi (HTTP ${error.status}${error.code ? `, ${error.code}` : ''}).`;
  }
  return 'OpenAI servisine ulaşılamadı. Lütfen tekrar deneyin.';
}

function asMenuExtractionError(error: unknown, model: string): MenuExtractionError {
  if (error instanceof OpenAIRequestError) {
    return new MenuExtractionError(openAIErrorMessage(error, model), error, {
      provider: 'openai',
      status: error.status,
      code: error.code,
      requestId: error.requestId,
    });
  }
  return new MenuExtractionError('AI servisi yanıt vermedi. Lütfen tekrar deneyin.', error);
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type MenuPage = { buffer: Buffer; mimeType: string };

function toInputContent(page: MenuPage, index: number): OpenAIInputContent {
  const base64 = page.buffer.toString('base64');
  if (page.mimeType === 'application/pdf') {
    return {
      type: 'input_file',
      filename: `menu-${index + 1}.pdf`,
      file_data: `data:application/pdf;base64,${base64}`,
    };
  }
  if (IMAGE_TYPES.has(page.mimeType)) {
    return {
      type: 'input_image',
      image_url: `data:${page.mimeType};base64,${base64}`,
      detail: 'high',
    };
  }
  throw new MenuExtractionError(`Desteklenmeyen dosya türü: ${page.mimeType}`);
}

/**
 * Bir veya daha fazla menü sayfasından (görsel/PDF) tek yapılandırılmış menü
 * çıkarır. Tüm sayfalar aynı OpenAI çağrısında birleştirilir ve çıktı Zod ile
 * ikinci kez doğrulanır.
 */
export async function extractMenuFromFiles(
  pages: MenuPage[],
  options?: { apiKey?: string; model?: string }
): Promise<{ extracted: ExtractedMenu; model: string }> {
  if (pages.length === 0) throw new MenuExtractionError('Hiç sayfa verilmedi.');
  const model = options?.model ?? process.env.OPENAI_MENU_MODEL ?? DEFAULT_MODEL;

  const content: OpenAIInputContent[] = pages.map(toInputContent);
  content.push({
    type: 'input_text',
    text:
      pages.length > 1
        ? `Bunlar aynı menünün ${pages.length} sayfası. Hepsini tek menü olarak, sayfa sırasına göre eksiksiz çıkar. Sayfalar arasında kategori tekrarlanıyorsa birleştir.`
        : 'Bu menüyü eksiksiz çıkar.',
  });

  let outputText: string;
  try {
    const response = await createOpenAIResponse(
      {
        model,
        instructions: SYSTEM_PROMPT,
        input: [{ role: 'user', content }],
        reasoning: { effort: 'low' },
        max_output_tokens: 32_768,
        text: {
          verbosity: 'low',
          format: {
            type: 'json_schema',
            name: 'restaurant_menu',
            description: 'Menü fotoğrafı veya PDF dosyalarından çıkarılan yapılandırılmış restoran menüsü.',
            schema: MENU_JSON_SCHEMA,
            strict: true,
          },
        },
      },
      { timeoutMs: 120_000, apiKey: options?.apiKey }
    );
    outputText = getOpenAIOutputText(response);
  } catch (error) {
    throw asMenuExtractionError(error, model);
  }

  if (!outputText) {
    throw new MenuExtractionError('AI yapılandırılmış çıktı üretmedi. Lütfen tekrar deneyin.');
  }

  let json: unknown;
  try {
    json = JSON.parse(outputText);
  } catch (error) {
    throw new MenuExtractionError('AI çıktısı okunamadı. Lütfen tekrar deneyin.', error);
  }

  const parsed = extractedMenuSchema.safeParse(json);
  if (!parsed.success) {
    throw new MenuExtractionError(
      'AI çıktısı doğrulanamadı. Daha net bir fotoğrafla tekrar deneyin.',
      parsed.error.flatten()
    );
  }

  return { extracted: parsed.data, model };
}
