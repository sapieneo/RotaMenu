/**
 * RestaurantOS — AI maliyet koruması.
 *
 * PROBLEM: `/studyo`'ya giren herkes otomatik anonim oturum alır ve
 * `organizations.trial_ends_at` varsayılanı (now + 14 gün) yüzünden
 * `resolvePlanContext` onu 'pro' sayar. Sonuç: e-posta, telefon, captcha
 * olmadan OpenAI (ingest/çeviri/açıklama) ve Runware (görsel) faturası
 * sınırsızca şişirilebiliyordu. Halka açık bir SaaS'ta bu kabul edilemez.
 *
 * ÇÖZÜM İKİ KATMAN:
 *   1. KİMLİK KAPISI — pahalı üretimler (görsel, çeviri, açıklama) yalnız
 *      e-postası doğrulanmış hesaba açıktır. Anonim ziyaretçi menüsünü
 *      yükleyip sonucu görebilir (dönüşüm için gerekli), ama üretemez.
 *   2. GÜNLÜK KOTA — doğrulanmış hesaplarda bile org+gün+tür bazında sayaç.
 *      Sayaç DB'de atomik tüketilir (bkz. consume_ai_quota); serverless'te
 *      bellek içi sayaç örnekler arası paylaşılmadığı için işe yaramaz.
 *
 * Sayaç YALNIZ service-role ile yazılır — istemci sıfırlayamaz.
 */
import { createAdminClient } from '@/lib/supabase/server';
import type { PlanTier } from '@/lib/plans';

export type AiKind = 'ingest' | 'image' | 'translate' | 'description' | 'design_style';

/** Kimlik seviyesi — kota tablosunun satırını seçer. */
export type AiTier = 'anonymous' | 'verified' | 'paid';

/**
 * Günlük limitler (org başına, UTC günü).
 *
 * `ingest` sayfa, `image` görsel, `translate` dil, `description` çalıştırma
 * birimindedir. Anonim satırındaki 0'lar "kimlik kapısı" demektir.
 */
const DAILY_LIMITS: Record<AiTier, Record<AiKind, number>> = {
  // Kaydolmamış ziyaretçi: ürünü denemesi için menü okutabilir, üretemez.
  anonymous: { ingest: 10, image: 0, translate: 0, description: 0, design_style: 0 },
  // Deneme sürümündeki doğrulanmış hesap: gerçek bir menüyü bitirmeye yeter.
  verified: { ingest: 40, image: 80, translate: 25, description: 5, design_style: 20 },
  // Ödeyen müşteri: pratikte engellemez, yalnız kaçak/hata durumunu yakalar.
  paid: { ingest: 200, image: 400, translate: 100, description: 30, design_style: 60 },
};

/**
 * Kullanıcı ve plan durumundan kota seviyesini çıkarır.
 *
 * AJANS MODU: bu artık herkese satılan bir SaaS değil, ajansın kendi
 * müşterileri için kullandığı kapalı bir araç — anonim ziyaretçi/e-posta
 * doğrulama ayrımının bir anlamı yok. Bu yüzden her zaman en yüksek
 * (`paid`) günlük limitler uygulanır. Bu limitler pratikte engellemez,
 * yalnızca gerçek bir hata/kaçak döngüsü olursa faturayı korur — o yüzden
 * tamamen kaldırmak yerine burada tutuldu (bkz. plans.ts'teki AJANS MODU notu).
 */
export function aiTierFor(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  input: { isAnonymous: boolean; email: string | null | undefined; basePlan: PlanTier }
): AiTier {
  return 'paid';
}

export type QuotaResult =
  | { ok: true; remaining: number }
  | { ok: false; reason: 'identity' | 'quota'; message: string; limit: number };

const KIND_LABEL: Record<AiKind, string> = {
  ingest: 'menü okuma',
  image: 'görsel üretimi',
  translate: 'çeviri',
  description: 'açıklama üretimi',
  design_style: 'tasarım önerisi',
};

const IDENTITY_MESSAGE: Record<AiKind, string> = {
  ingest: 'Menü okuma sınırına ulaştın. Ücretsiz hesap açarak devam edebilirsin.',
  image:
    'Görsel üretimi için önce hesabını e-posta ile güvene al (Hesap sayfası). Doğrulanan hesaplarda görsel üretimi açılır.',
  translate:
    'Çeviri için önce hesabını e-posta ile güvene al (Hesap sayfası). Doğrulanan hesaplarda çeviri açılır.',
  description:
    'Açıklama üretimi için önce hesabını e-posta ile güvene al (Hesap sayfası).',
  design_style:
    'AI tasarım önerisi için önce hesabını e-posta ile güvene al (Hesap sayfası).',
};

/**
 * Kotayı tüketir. Başarısızsa HİÇBİR şey harcanmaz — çağıran uç AI'ı
 * çağırmadan ÖNCE bunu çağırmalı.
 *
 * @param units Tüketilecek birim (ör. yüklenen sayfa sayısı, üretilecek görsel).
 */
export async function consumeAiQuota(
  orgId: string,
  kind: AiKind,
  units: number,
  tier: AiTier
): Promise<QuotaResult> {
  const limit = DAILY_LIMITS[tier][kind];

  // Kimlik kapısı: limit 0 ise bu seviye bu işi hiç yapamaz.
  if (limit === 0) {
    return { ok: false, reason: 'identity', message: IDENTITY_MESSAGE[kind], limit: 0 };
  }
  // Tek istek limitin tamamını aşıyorsa DB'ye hiç gitme.
  if (units > limit) {
    return {
      ok: false,
      reason: 'quota',
      message: `Tek seferde en fazla ${limit} birim ${KIND_LABEL[kind]} yapılabilir.`,
      limit,
    };
  }

  const { data, error } = await createAdminClient().rpc('consume_ai_quota', {
    p_org: orgId,
    p_kind: kind,
    p_units: units,
    p_limit: limit,
  });

  // Sayaç yazılamıyorsa (DB hatası) isteği DURDUR — açık bırakmak, korumaya
  // çalıştığımız maliyet riskini geri getirir.
  if (error) {
    return {
      ok: false,
      reason: 'quota',
      message: 'Kullanım sayacı okunamadı, lütfen birazdan tekrar dene.',
      limit,
    };
  }
  if (data === null || data === undefined) {
    return {
      ok: false,
      reason: 'quota',
      message: `Bugünlük ${KIND_LABEL[kind]} sınırına ulaştın (${limit}). Yarın sıfırlanır; daha fazlası için Pro'ya yükselt.`,
      limit,
    };
  }

  return { ok: true, remaining: Number(data) };
}

/**
 * İş başlatılamadığında tüketilen kotayı geri verir (ör. arka plan
 * fonksiyonu enqueue edilemedi). Hata sessizce yutulur: iade edilememesi
 * isteği bozmamalı.
 */
export async function refundAiQuota(orgId: string, kind: AiKind, units: number): Promise<void> {
  if (units <= 0) return;
  try {
    const admin = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await admin
      .from('ai_usage')
      .select('units')
      .eq('org_id', orgId)
      .eq('used_on', today)
      .eq('kind', kind)
      .maybeSingle();
    if (!data) return;
    await admin
      .from('ai_usage')
      .update({ units: Math.max(0, data.units - units) })
      .eq('org_id', orgId)
      .eq('used_on', today)
      .eq('kind', kind);
  } catch {
    /* iade edilemedi — sayaç yarın sıfırlanır */
  }
}

/** HTTP durum kodu: kimlik eksikse 403, kota dolduysa 429. */
export function quotaStatus(result: Extract<QuotaResult, { ok: false }>): number {
  return result.reason === 'identity' ? 403 : 429;
}
