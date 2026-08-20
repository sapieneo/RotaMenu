import { z } from 'zod';

/** 0001_init.sql'deki allergens.code seed'iyle birebir aynı liste. */
export const ALLERGEN_CODES = [
  'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soybeans',
  'milk', 'nuts', 'celery', 'mustard', 'sesame', 'sulphites',
  'lupin', 'molluscs', 'alcohol', 'pork',
] as const;

export const allergenSuggestionSchema = z.object({
  code: z.enum(ALLERGEN_CODES),
  confidence: z.number().min(0).max(1),
});

/** 0004_menu_enrichment.sql'deki dietary_tags.code seed'iyle birebir. */
export const DIETARY_CODES = ['halal', 'alcohol_free', 'vegan', 'vegetarian'] as const;

export const dietarySuggestionSchema = z.object({
  code: z.enum(DIETARY_CODES),
  confidence: z.number().min(0).max(1),
});

export const extractedItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  ingredients: z.string().max(2000).nullish(),
  price: z.number().min(0).nullish(),
  calories_kcal: z.number().int().min(0).max(20000).nullish(),
  allergens: z.array(allergenSuggestionSchema).default([]),
  dietary: z.array(dietarySuggestionSchema).default([]),
  /** "Şefin Seçtikleri" — misafir menüsünün üstünde öne çıkan şeritte gösterilir. */
  is_featured: z.boolean().default(false),
});

export const extractedCategorySchema = z.object({
  name: z.string().min(1).max(120),
  items: z.array(extractedItemSchema).default([]),
  /**
   * Bu kategori hangi menüye yazılacak? Taslak editöründeki menü seçicisiyle
   * belirlenir (bkz. studyo/[id]/draft-editor.tsx). Boş/null = işletmenin ana
   * menüsü. AI çıktısında bu alan hiç bulunmaz; onay adımında doldurulur.
   */
  menu_key: z.string().max(40).nullish(),
});

/** AI menü çıkarım çıktısının uygulama tarafındaki doğrulama şeması. */
export const extractedMenuSchema = z.object({
  menu_name: z.string().min(1).max(120).default('Menü'),
  /** İşletme/restoran adı (logo/başlık/üstbilgiden). Bulunamazsa null. */
  venue_name_guess: z.string().max(120).nullish(),
  currency_guess: z.string().length(3).nullish(), // ISO 4217 tahmini
  language_guess: z.string().min(2).max(5).nullish(), // BCP 47 tahmini
  categories: z.array(extractedCategorySchema).min(1),
  warnings: z.array(z.string()).default([]), // okunamayan bölümler vb.
  /**
   * Bu yüklemeden oluşturulacak menülerin listesi. Kullanıcı taslak
   * editöründe "Menü ekle" ile tanımlar; her kategori `menu_key` ile
   * bunlardan birine bağlanır. Boş liste = tek menü (eski davranış).
   */
  menus: z
    .array(
      z.object({
        key: z.string().min(1).max(40),
        name: z.string().trim().min(1).max(60),
        icon: z.string().trim().max(4).nullish(),
      })
    )
    .max(12)
    .default([]),
});

export type ExtractedMenu = z.infer<typeof extractedMenuSchema>;
export type ExtractedCategory = z.infer<typeof extractedCategorySchema>;
export type ExtractedItem = z.infer<typeof extractedItemSchema>;

/** menu_ingestions.raw_result alanının tam şekli. */
export const rawResultSchema = z.object({
  extracted: extractedMenuSchema,
  /** Onay (approve) idempotency'si: yeniden onaylanırsa eski menü silinip yenisi yazılır. */
  created_menu_id: z.string().uuid().nullish(),
  /**
   * Çoklu menü onayında her `menu_key` için oluşturulan menü kimliği.
   * Yeniden onayda AYNI menülere yazılsın diye saklanır — yoksa her
   * "Yeniden Kaydet" yeni menüler çoğaltırdı.
   */
  created_menu_ids: z.record(z.string(), z.string().uuid()).nullish(),
  model: z.string(),
  extracted_at: z.string(),
});

export type RawResult = z.infer<typeof rawResultSchema>;
