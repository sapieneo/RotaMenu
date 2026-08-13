import { MENU_DESIGN_PRESETS } from '@/lib/themes';

/**
 * AI çağrısı çökerse devreye giren yedek: kullanıcının metnini her şablonun
 * anahtar kelimeleri + ruh hali + açıklamasıyla kelime bazında karşılaştırıp
 * en çok örtüşeni döner. AI kadar isabetli değildir ama asla başarısız olmaz.
 *
 * NOT: Bu fonksiyon bilerek route.ts dosyasının DIŞINDA, ayrı bir lib
 * dosyasında tutuluyor — Next.js App Router, route.ts dosyalarından yalnızca
 * HTTP metod handler'ları (GET/POST/…) ve belirli config alanlarının
 * (runtime, dynamic, vb.) export edilmesine izin veriyor; route.ts içinde
 * başka bir named export bulunması build'i "Route does not match the
 * required types of a Next.js Route" hatasıyla düşürüyor.
 */
export function naiveStyleMatch(styleText: string): { templateId: string; reason: string } {
  const normalize = (value: string) =>
    value
      .toLocaleLowerCase('tr')
      .replace(/[^a-zçğıöşü0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter(Boolean);

  const inputWords = new Set(normalize(styleText));
  let best = MENU_DESIGN_PRESETS[0];
  let bestScore = -1;
  for (const preset of MENU_DESIGN_PRESETS) {
    const presetWords = normalize(`${preset.keywords} ${preset.mood} ${preset.description}`);
    const score = presetWords.reduce((total, word) => total + (inputWords.has(word) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = preset;
    }
  }
  return {
    templateId: best.templateId,
    reason:
      bestScore > 0
        ? `Anlattığın tarza en yakın hazır şablon: ${best.name}.`
        : `Şu an AI önerisine ulaşılamadı; en genel geçer şablonu (${best.name}) seçtik, dilediğin gibi değiştirebilirsin.`,
  };
}
