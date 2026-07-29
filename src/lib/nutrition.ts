// ============================================================================
// RestaurantOS — Yerleşik besin tablosu (offline kalori hesabı)
// Yaygın Türk mutfağı malzemeleri için kcal / 100 g.
// Kaynak: genel besin değeri ortalamaları (yaklaşık). Amaç: menüde kalori
// beyanı için hızlı, internet gerektirmeyen tahmin.
// Sıfır-kalorili maddeler (su, çay, soda...) 0 olarak tanımlıdır — yanlış
// eşleşme ve saçma kalori değerleri önlenir.
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
  // — Sıfır / çok düşük kalorili (ÖNEMLİ: yanlış eşleşmeyi önler) —
  'su': { label: 'Su', kcalPer100g: 0, aliases: ['içme suyu', 'icme suyu', 'maden suyu', 'soda'] },
  'çay': { label: 'Çay', kcalPer100g: 1, aliases: ['cay', 'siyah çay', 'yeşil çay', 'bitki çayı'] },
  'kahve': { label: 'Kahve (sade)', kcalPer100g: 2, aliases: ['sade kahve', 'americano', 'espresso', 'türk kahvesi'] },
  'buz': { label: 'Buz', kcalPer100g: 0, aliases: [] },
  'sirke': { label: 'Sirke', kcalPer100g: 18, aliases: ['elma sirkesi', 'üzüm sirkesi'] },
  'limon suyu': { label: 'Limon suyu', kcalPer100g: 22, aliases: ['limon'] },
  'tuz': { label: 'Tuz', kcalPer100g: 0, aliases: ['deniz tuzu', 'kaya tuzu'] },
  'karabiber': { label: 'Karabiber', kcalPer100g: 251, aliases: ['biberiye', 'baharat', 'pul biber', 'kimyon', 'kekik', 'nane', 'sumak', 'kırmızı biber'] },

  // — Etler & şarküteri —
  'tavuk eti': { label: 'Tavuk eti', kcalPer100g: 165, aliases: ['tavuk', 'piliç', 'pilic', 'tavuk göğsü', 'tavuk gogsu', 'tavuk but', 'göğüs eti'] },
  'dana eti': { label: 'Dana eti', kcalPer100g: 250, aliases: ['dana', 'sığır', 'sigir', 'biftek', 'antrikot', 'bonfile', 'kontrfile', 'et', 'kırmızı et'] },
  'kuzu eti': { label: 'Kuzu eti', kcalPer100g: 294, aliases: ['kuzu', 'kuzu pirzola', 'pirzola', 'koyun eti'] },
  'hindi eti': { label: 'Hindi eti', kcalPer100g: 189, aliases: ['hindi', 'hindi füme'] },
  'kıyma': { label: 'Kıyma', kcalPer100g: 260, aliases: ['kiyma', 'köfte', 'kofte', 'dana kıyma', 'karışık kıyma'] },
  'sucuk': { label: 'Sucuk', kcalPer100g: 460, aliases: [] },
  'salam': { label: 'Salam', kcalPer100g: 310, aliases: [] },
  'sosis': { label: 'Sosis', kcalPer100g: 300, aliases: ['frankfurter'] },
  'pastırma': { label: 'Pastırma', kcalPer100g: 240, aliases: ['pastirma'] },
  'jambon': { label: 'Jambon', kcalPer100g: 145, aliases: ['dana jambon', 'hindi jambon'] },
  'bacon': { label: 'Bacon', kcalPer100g: 541, aliases: ['beykın'] },
  'ciğer': { label: 'Ciğer', kcalPer100g: 135, aliases: ['ciger', 'karaciğer', 'kuzu ciğeri'] },

  // — Deniz ürünleri —
  'balık': { label: 'Balık', kcalPer100g: 140, aliases: ['balik', 'levrek', 'çupra', 'cupra', 'çipura', 'hamsi', 'palamut', 'lüfer', 'istavrit', 'mezgit', 'barbun'] },
  'somon': { label: 'Somon', kcalPer100g: 208, aliases: ['salmon', 'füme somon'] },
  'ton balığı': { label: 'Ton balığı', kcalPer100g: 130, aliases: ['ton baligi', 'ton', 'tuna'] },
  'karides': { label: 'Karides', kcalPer100g: 99, aliases: [] },
  'kalamar': { label: 'Kalamar', kcalPer100g: 92, aliases: ['mürekkep balığı'] },
  'midye': { label: 'Midye', kcalPer100g: 86, aliases: ['midye dolma', 'midye tava'] },
  'ahtapot': { label: 'Ahtapot', kcalPer100g: 82, aliases: [] },

  // — Süt ürünleri —
  'peynir': { label: 'Peynir', kcalPer100g: 290, aliases: ['beyaz peynir', 'lor peyniri', 'lor', 'çökelek', 'cokelek', 'ezine'] },
  'kaşar peyniri': { label: 'Kaşar peyniri', kcalPer100g: 350, aliases: ['kasar peyniri', 'kaşar', 'kasar', 'eski kaşar'] },
  'tulum peyniri': { label: 'Tulum peyniri', kcalPer100g: 380, aliases: ['tulum'] },
  'mozzarella': { label: 'Mozzarella', kcalPer100g: 280, aliases: ['mozarella'] },
  'labne': { label: 'Labne', kcalPer100g: 235, aliases: ['krem peynir', 'cream cheese'] },
  'yoğurt': { label: 'Yoğurt', kcalPer100g: 61, aliases: ['yogurt', 'süzme yoğurt', 'ayran'] },
  'süt': { label: 'Süt', kcalPer100g: 64, aliases: ['sut', 'tam yağlı süt', 'yarım yağlı süt'] },
  'kaymak': { label: 'Kaymak', kcalPer100g: 400, aliases: [] },
  'tereyağı': { label: 'Tereyağı', kcalPer100g: 717, aliases: ['tereyagi', 'tereyağ', 'tereyag'] },
  'krema': { label: 'Krema', kcalPer100g: 340, aliases: ['sıvı krema', 'süt kreması'] },
  'dondurma': { label: 'Dondurma', kcalPer100g: 207, aliases: ['maraş dondurması'] },

  // — Yağlar —
  'zeytinyağı': { label: 'Zeytinyağı', kcalPer100g: 884, aliases: ['zeytinyagi', 'zeytin yağı', 'sızma zeytinyağı'] },
  'ayçiçek yağı': { label: 'Ayçiçek yağı', kcalPer100g: 884, aliases: ['aycicek yagi', 'sıvı yağ', 'sivi yag', 'yağ', 'yag', 'mısır yağı', 'kanola yağı', 'bitkisel yağ'] },
  'margarin': { label: 'Margarin', kcalPer100g: 717, aliases: [] },

  // — Tahıllar / hamur / bakliyat —
  'pirinç': { label: 'Pirinç (pişmiş)', kcalPer100g: 130, aliases: ['pirinc', 'pilav', 'pirinç pilavı', 'baldo', 'basmati'] },
  'bulgur': { label: 'Bulgur (pişmiş)', kcalPer100g: 83, aliases: ['bulgur pilavı', 'köftelik bulgur'] },
  'makarna': { label: 'Makarna (pişmiş)', kcalPer100g: 158, aliases: ['erişte', 'eriste', 'spagetti', 'penne', 'noodle'] },
  'un': { label: 'Un', kcalPer100g: 364, aliases: ['buğday unu', 'tam buğday unu', 'mısır unu'] },
  'ekmek': { label: 'Ekmek', kcalPer100g: 265, aliases: ['beyaz ekmek', 'somun', 'baget'] },
  'tam buğday ekmeği': { label: 'Tam buğday ekmeği', kcalPer100g: 247, aliases: ['kepekli ekmek', 'çavdar ekmeği'] },
  'lavaş': { label: 'Lavaş', kcalPer100g: 275, aliases: ['lavas', 'yufka', 'dürüm', 'durum', 'tortilla', 'wrap'] },
  'pide': { label: 'Pide', kcalPer100g: 270, aliases: ['ramazan pidesi'] },
  'simit': { label: 'Simit', kcalPer100g: 330, aliases: [] },
  'bazlama': { label: 'Bazlama', kcalPer100g: 280, aliases: ['gözleme'] },
  'patates': { label: 'Patates', kcalPer100g: 77, aliases: ['haşlanmış patates', 'patates püresi'] },
  'patates kızartması': { label: 'Patates kızartması', kcalPer100g: 312, aliases: ['patates kizartmasi', 'french fries', 'parmak patates'] },
  'nohut': { label: 'Nohut (pişmiş)', kcalPer100g: 164, aliases: ['humus', 'nohut pilavı'] },
  'mercimek': { label: 'Mercimek (pişmiş)', kcalPer100g: 116, aliases: ['kırmızı mercimek', 'yeşil mercimek', 'mercimek çorbası'] },
  'fasulye': { label: 'Fasulye (pişmiş)', kcalPer100g: 127, aliases: ['kuru fasulye', 'barbunya', 'taze fasulye'] },
  'yulaf': { label: 'Yulaf', kcalPer100g: 389, aliases: ['yulaf ezmesi', 'granola', 'müsli'] },
  'kuskus': { label: 'Kuskus', kcalPer100g: 112, aliases: ['couscous'] },
  'nişasta': { label: 'Nişasta', kcalPer100g: 381, aliases: ['nisasta', 'mısır nişastası'] },

  // — Sebzeler —
  'domates': { label: 'Domates', kcalPer100g: 18, aliases: ['çeri domates', 'kokteyl domates'] },
  'domates salçası': { label: 'Domates salçası', kcalPer100g: 82, aliases: ['salça', 'salca', 'domates sosu', 'biber salçası'] },
  'soğan': { label: 'Soğan', kcalPer100g: 40, aliases: ['sogan', 'kuru soğan', 'taze soğan', 'yeşil soğan'] },
  'sarımsak': { label: 'Sarımsak', kcalPer100g: 149, aliases: ['sarimsak', 'sarmısak'] },
  'biber': { label: 'Biber', kcalPer100g: 26, aliases: ['sivri biber', 'kapya biber', 'dolmalık biber', 'çarliston', 'yeşil biber', 'kırmızı biber taze'] },
  'patlıcan': { label: 'Patlıcan', kcalPer100g: 25, aliases: ['patlican', 'közlenmiş patlıcan'] },
  'kabak': { label: 'Kabak', kcalPer100g: 17, aliases: ['sakız kabağı', 'balkabağı', 'bal kabağı'] },
  'salatalık': { label: 'Salatalık', kcalPer100g: 15, aliases: ['salatalik', 'hıyar', 'hiyar'] },
  'marul': { label: 'Marul', kcalPer100g: 15, aliases: ['kıvırcık', 'göbek marul', 'yeşillik', 'yesillik'] },
  'roka': { label: 'Roka', kcalPer100g: 25, aliases: ['tere', 'maydanoz', 'dereotu', 'nane taze', 'ıspanak', 'ispanak', 'pazı', 'semizotu'] },
  'lahana': { label: 'Lahana', kcalPer100g: 25, aliases: ['beyaz lahana', 'kırmızı lahana', 'karnabahar', 'brokoli'] },
  'mantar': { label: 'Mantar', kcalPer100g: 22, aliases: ['kültür mantarı', 'kayın mantarı'] },
  'mısır': { label: 'Mısır', kcalPer100g: 86, aliases: ['misir', 'haşlanmış mısır', 'mısır tanesi'] },
  'havuç': { label: 'Havuç', kcalPer100g: 41, aliases: ['havuc'] },
  'bezelye': { label: 'Bezelye', kcalPer100g: 81, aliases: ['yeşil bezelye'] },
  'zeytin': { label: 'Zeytin', kcalPer100g: 115, aliases: ['siyah zeytin', 'yeşil zeytin'] },
  'turşu': { label: 'Turşu', kcalPer100g: 11, aliases: ['tursu', 'salatalık turşusu'] },
  'avokado': { label: 'Avokado', kcalPer100g: 160, aliases: [] },

  // — Meyveler —
  'elma': { label: 'Elma', kcalPer100g: 52, aliases: [] },
  'muz': { label: 'Muz', kcalPer100g: 89, aliases: [] },
  'portakal': { label: 'Portakal', kcalPer100g: 47, aliases: ['mandalina'] },
  'çilek': { label: 'Çilek', kcalPer100g: 32, aliases: ['cilek'] },
  'üzüm': { label: 'Üzüm', kcalPer100g: 69, aliases: ['uzum', 'kuru üzüm'] },
  'karpuz': { label: 'Karpuz', kcalPer100g: 30, aliases: ['kavun'] },
  'şeftali': { label: 'Şeftali', kcalPer100g: 39, aliases: ['seftali', 'kayısı', 'nektarin'] },
  'ananas': { label: 'Ananas', kcalPer100g: 50, aliases: [] },
  'nar': { label: 'Nar', kcalPer100g: 83, aliases: ['nar ekşisi'] },
  'incir': { label: 'İncir', kcalPer100g: 74, aliases: ['kuru incir'] },
  'hurma': { label: 'Hurma', kcalPer100g: 282, aliases: [] },

  // — Kuruyemiş / çekirdek —
  'fındık': { label: 'Fındık', kcalPer100g: 628, aliases: ['findik'] },
  'ceviz': { label: 'Ceviz', kcalPer100g: 654, aliases: [] },
  'badem': { label: 'Badem', kcalPer100g: 579, aliases: [] },
  'antep fıstığı': { label: 'Antep fıstığı', kcalPer100g: 562, aliases: ['antep fistigi', 'fıstık', 'fistik'] },
  'yer fıstığı': { label: 'Yer fıstığı', kcalPer100g: 567, aliases: ['yer fistigi', 'fıstık ezmesi'] },
  'kaju': { label: 'Kaju', kcalPer100g: 553, aliases: [] },
  'ayçekirdeği': { label: 'Ay çekirdeği', kcalPer100g: 584, aliases: ['aycekirdegi', 'kabak çekirdeği', 'çekirdek'] },
  'susam': { label: 'Susam', kcalPer100g: 573, aliases: ['tahin', 'susam ezmesi'] },

  // — Tatlandırıcı / tatlı / çikolata —
  'şeker': { label: 'Toz şeker', kcalPer100g: 387, aliases: ['seker', 'toz şeker', 'toz seker', 'esmer şeker', 'pudra şekeri'] },
  'bal': { label: 'Bal', kcalPer100g: 304, aliases: [] },
  'reçel': { label: 'Reçel', kcalPer100g: 278, aliases: ['recel', 'marmelat'] },
  'pekmez': { label: 'Pekmez', kcalPer100g: 293, aliases: ['üzüm pekmezi'] },
  'çikolata': { label: 'Çikolata', kcalPer100g: 546, aliases: ['cikolata', 'sütlü çikolata', 'bitter çikolata'] },
  'kakao': { label: 'Kakao', kcalPer100g: 228, aliases: ['kakao tozu'] },
  'fındık kreması': { label: 'Fındık kreması', kcalPer100g: 539, aliases: ['nutella', 'çikolata kreması'] },
  'şurup': { label: 'Şurup', kcalPer100g: 260, aliases: ['surup', 'kaymak şurubu', 'sıvı şeker'] },

  // — Yumurta & diğer —
  'yumurta': { label: 'Yumurta', kcalPer100g: 155, aliases: ['haşlanmış yumurta', 'çırpılmış yumurta'] },
  'mayonez': { label: 'Mayonez', kcalPer100g: 680, aliases: [] },
  'ketçap': { label: 'Ketçap', kcalPer100g: 112, aliases: ['ketcap'] },
  'hardal sos': { label: 'Hardal', kcalPer100g: 66, aliases: ['hardal'] },
  'soya sosu': { label: 'Soya sosu', kcalPer100g: 53, aliases: ['soya'] },
  'maya': { label: 'Maya', kcalPer100g: 105, aliases: ['kabartma tozu', 'karbonat'] },
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
  // Uzun (çok kelimeli) anahtarlar önce → daha spesifik eşleşme öncelikli
  return rows.sort((a, b) => b.key.length - a.key.length);
})();

/**
 * Bir malzeme adını besin tablosuyla eşleştir.
 * Kelime-sınırlı eşleşme: "tavuk göğsü" → tavuk eti; ama "su" ASLA "sucuk"a
 * eşleşmez. Bulunamazsa null döner (kullanıcı elle kcal/100g girebilir).
 */
export function matchNutrition(ingredientName: string): NutritionEntry | null {
  const q = normalizeTr(ingredientName);
  if (!q) return null;
  const qWords = q.split(' ').filter(Boolean);

  // 1) Birebir
  for (const row of SEARCH_INDEX) {
    if (row.key === q) return row.entry;
  }
  // 2) Tablo anahtarının TÜM kelimeleri sorguda tam kelime olarak geçiyor mu.
  //    ("tavuk göğsü" içinde "tavuk" tam kelime → eşleşir; "su" içinde
  //    "sucuk" tam kelime değil → eşleşmez.)
  for (const row of SEARCH_INDEX) {
    const keyWords = row.key.split(' ').filter(Boolean);
    if (keyWords.every((kw) => qWords.includes(kw))) return row.entry;
  }
  // 3) Sorgu tek kelime ve bir tablo anahtarının kelimelerinden biriyse.
  //    ("tavuk" → "tavuk eti" girdisi)
  if (qWords.length === 1) {
    for (const row of SEARCH_INDEX) {
      const keyWords = row.key.split(' ').filter(Boolean);
      if (keyWords.includes(qWords[0])) return row.entry;
    }
  }
  return null;
}

/** kcal = (gram / 100) * kcalPer100g, yuvarlanmış. */
export function kcalForGrams(kcalPer100g: number, grams: number): number {
  return Math.round((grams / 100) * kcalPer100g);
}
