// ============================================================================
// RestaurantOS — Yerleşik besin tablosu (offline kalori hesabı)
// Yaygın Türk mutfağı malzemeleri için kcal / 100 g.
// Kaynak: genel besin değeri ortalamaları (yaklaşık). Amaç: menüde kalori
// beyanı için hızlı, internet gerektirmeyen tahmin.
// ============================================================================

export type NutritionEntry = {
  /** Görünen ad (TR). */
  label: string;
  /** 100 gram başına kilokalori. */
  kcalPer100g: number;
  /** Eşleştirme için ek anahtar kelimeler (küçük harf, aksansız). */
  aliases?: string[];
};

/** Anahtar = normalize edilmiş ana ad. */
export const NUTRITION_DB: Record<string, NutritionEntry> = {
  // — Etler —
  'tavuk eti': { label: 'Tavuk eti', kcalPer100g: 165, aliases: ['tavuk', 'piliç', 'pilic', 'tavuk göğsü', 'tavuk gogsu'] },
  'dana eti': { label: 'Dana eti', kcalPer100g: 250, aliases: ['dana', 'sığır', 'sigir', 'biftek'] },
  'kuzu eti': { label: 'Kuzu eti', kcalPer100g: 294, aliases: ['kuzu'] },
  'kıyma': { label: 'Kıyma', kcalPer100g: 260, aliases: ['kiyma', 'köfte', 'kofte'] },
  'sucuk': { label: 'Sucuk', kcalPer100g: 460, aliases: [] },
  'pastırma': { label: 'Pastırma', kcalPer100g: 240, aliases: ['pastirma'] },
  'balık': { label: 'Balık', kcalPer100g: 140, aliases: ['balik', 'levrek', 'çupra', 'cupra', 'somon', 'hamsi'] },
  'ton balığı': { label: 'Ton balığı', kcalPer100g: 130, aliases: ['ton baligi', 'ton'] },
  'karides': { label: 'Karides', kcalPer100g: 99, aliases: [] },

  // — Süt ürünleri —
  'peynir': { label: 'Peynir', kcalPer100g: 290, aliases: ['beyaz peynir', 'kaşar', 'kasar', 'kaşar peyniri'] },
  'kaşar peyniri': { label: 'Kaşar peyniri', kcalPer100g: 350, aliases: ['kasar peyniri'] },
  'yoğurt': { label: 'Yoğurt', kcalPer100g: 61, aliases: ['yogurt'] },
  'süt': { label: 'Süt', kcalPer100g: 64, aliases: ['sut'] },
  'kaymak': { label: 'Kaymak', kcalPer100g: 400, aliases: [] },
  'tereyağı': { label: 'Tereyağı', kcalPer100g: 717, aliases: ['tereyagi', 'tereyağ', 'tereyag'] },
  'krema': { label: 'Krema', kcalPer100g: 340, aliases: [] },

  // — Yağlar —
  'zeytinyağı': { label: 'Zeytinyağı', kcalPer100g: 884, aliases: ['zeytinyagi', 'zeytin yağı'] },
  'ayçiçek yağı': { label: 'Ayçiçek yağı', kcalPer100g: 884, aliases: ['aycicek yagi', 'sıvı yağ', 'sivi yag', 'yağ', 'yag'] },

  // — Tahıllar / hamur —
  'pirinç': { label: 'Pirinç', kcalPer100g: 130, aliases: ['pirinc', 'pilav'] },
  'bulgur': { label: 'Bulgur', kcalPer100g: 83, aliases: [] },
  'makarna': { label: 'Makarna', kcalPer100g: 158, aliases: ['erişte', 'eriste', 'spagetti'] },
  'un': { label: 'Un', kcalPer100g: 364, aliases: [] },
  'ekmek': { label: 'Ekmek', kcalPer100g: 265, aliases: ['lavaş', 'lavas', 'pide', 'somun'] },
  'lavaş': { label: 'Lavaş', kcalPer100g: 275, aliases: ['lavas', 'yufka', 'dürüm', 'durum'] },
  'patates': { label: 'Patates', kcalPer100g: 77, aliases: ['patates kızartması', 'patates kizartmasi'] },
  'nohut': { label: 'Nohut', kcalPer100g: 164, aliases: [] },
  'mercimek': { label: 'Mercimek', kcalPer100g: 116, aliases: [] },
  'fasulye': { label: 'Fasulye', kcalPer100g: 127, aliases: ['kuru fasulye', 'barbunya'] },

  // — Sebzeler —
  'domates': { label: 'Domates', kcalPer100g: 18, aliases: ['domates sosu', 'salça', 'salca'] },
  'soğan': { label: 'Soğan', kcalPer100g: 40, aliases: ['sogan'] },
  'biber': { label: 'Biber', kcalPer100g: 26, aliases: ['sivri biber', 'kapya', 'dolmalık biber'] },
  'patlıcan': { label: 'Patlıcan', kcalPer100g: 25, aliases: ['patlican'] },
  'salatalık': { label: 'Salatalık', kcalPer100g: 15, aliases: ['salatalik', 'hıyar', 'hiyar'] },
  'marul': { label: 'Marul', kcalPer100g: 15, aliases: ['yeşillik', 'yesillik', 'roka', 'ıspanak', 'ispanak'] },
  'mantar': { label: 'Mantar', kcalPer100g: 22, aliases: [] },
  'mısır': { label: 'Mısır', kcalPer100g: 86, aliases: ['misir'] },
  'havuç': { label: 'Havuç', kcalPer100g: 41, aliases: ['havuc'] },
  'zeytin': { label: 'Zeytin', kcalPer100g: 115, aliases: [] },

  // — Meyveler / tatlı —
  'şeker': { label: 'Şeker', kcalPer100g: 387, aliases: ['seker', 'toz şeker', 'toz seker'] },
  'bal': { label: 'Bal', kcalPer100g: 304, aliases: [] },
  'çikolata': { label: 'Çikolata', kcalPer100g: 546, aliases: ['cikolata', 'kakao'] },
  'fındık': { label: 'Fındık', kcalPer100g: 628, aliases: ['findik'] },
  'ceviz': { label: 'Ceviz', kcalPer100g: 654, aliases: [] },
  'fıstık': { label: 'Fıstık', kcalPer100g: 567, aliases: ['fistik', 'antep fıstığı', 'yer fıstığı'] },
  'muz': { label: 'Muz', kcalPer100g: 89, aliases: [] },
  'elma': { label: 'Elma', kcalPer100g: 52, aliases: [] },
  'çilek': { label: 'Çilek', kcalPer100g: 32, aliases: ['cilek'] },

  // — Yumurta / diğer —
  'yumurta': { label: 'Yumurta', kcalPer100g: 155, aliases: [] },
  'baharat': { label: 'Baharat', kcalPer100g: 0, aliases: ['tuz', 'karabiber', 'pul biber', 'kimyon', 'nane', 'kekik'] },
};

/** Türkçe metni eşleştirme için normalize et (küçük harf, aksan sadeleştir, boşluk kırp). */
export function normalizeTr(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Normalize edilmiş arama indeksi (ana ad + alias → entry)
const SEARCH_INDEX: { key: string; entry: NutritionEntry }[] = (() => {
  const rows: { key: string; entry: NutritionEntry }[] = [];
  for (const [main, entry] of Object.entries(NUTRITION_DB)) {
    rows.push({ key: normalizeTr(main), entry });
    for (const a of entry.aliases ?? []) rows.push({ key: normalizeTr(a), entry });
  }
  // Uzun anahtarlar önce (daha spesifik eşleşme öncelikli)
  return rows.sort((a, b) => b.key.length - a.key.length);
})();

/**
 * Bir malzeme adını besin tablosuyla eşleştir.
 * Tam kelime içerme mantığı: "tavuk göğsü" → tavuk eti girdisi.
 * Bulunamazsa null döner (kullanıcı elle kcal/100g girebilir).
 */
export function matchNutrition(ingredientName: string): NutritionEntry | null {
  const q = normalizeTr(ingredientName);
  if (!q) return null;
  // 1) Birebir
  for (const row of SEARCH_INDEX) {
    if (row.key === q) return row.entry;
  }
  // 2) Malzeme adı, tablo anahtarını içeriyor mu (ya da tersi)
  for (const row of SEARCH_INDEX) {
    if (q.includes(row.key) || row.key.includes(q)) return row.entry;
  }
  return null;
}

/** kcal = (gram / 100) * kcalPer100g, yuvarlanmış. */
export function kcalForGrams(kcalPer100g: number, grams: number): number {
  return Math.round((grams / 100) * kcalPer100g);
}
