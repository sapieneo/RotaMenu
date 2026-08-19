/**
 * RestaurantOS — Plan modeli (Faz C · Freemium).
 *
 * Tek kaynak: plan limitleri + zorlama yardımcıları. Rotalar ve UI buradan okur;
 * limit sayıları hiçbir yerde elle tekrar edilmez.
 *
 * Ücretsiz plan ilkesi (ROADMAP Faz C):
 *   - Üyelik (e-posta ile güvene alınmış hesap) + iletişim telefonu ŞARTI.
 *   - 1 venue, < 50 ürün, 5 dile çeviri, arka plan/ürün görseli YOK,
 *     misafir menüsünde "RestaurantOS" rozeti.
 * Pro: yüksek/limitsiz ürün, tüm diller, görseller, rozet kaldırma.
 */

export type PlanTier = 'free' | 'pro' | 'enterprise';

export type PlanLimits = {
  /** Kullanıcıya gösterilen ad. */
  label: string;
  /** İzin verilen venue sayısı (Infinity = sınırsız). */
  maxVenues: number;
  /** Org başına toplam ürün sayısı (Infinity = sınırsız). */
  maxItems: number;
  /** Çeviri dili sayısı (varsayılan dil hariç değil — toplam; Infinity = sınırsız). */
  maxLocales: number;
  /** AI görsel üretimi + elle görsel yükleme açık mı? */
  images: boolean;
  /** Misafir menüsündeki "RestaurantOS" rozetini kaldırabilir mi? */
  removeBadge: boolean;
  /** Yayın için hesabın güvene alınmış (e-posta) + telefonlu olması şart mı? */
  requiresVerifiedAccount: boolean;
  /**
   * Menü canlıya alınabilir mi? 14 günlük deneme bitince free plan bu bayrakla
   * kilitlenir — menü ve veriler durur, yalnız yayın kapanır.
   */
  canPublish: boolean;
};

/**
 * AJANS MODU: bu motor artık bir ajansın kendi müşterilerine menü ürettiği
 * kapalı bir ortam — dışarıya satılan bir SaaS değil. Bu yüzden 'free'
 * planın limitleri kasıtlı olarak 'pro' ile BİREBİR aynı: kayıt/deneme
 * süresi/rozet/ürün sayısı gibi hiçbir kısıtlama yok. Plan altyapısı
 * (PlanTier, resolvePlanContext, Stripe route'ları vb.) kodda duruyor —
 * ileride tekrar bir SaaS'a dönüştürülmek istenirse tek satır değişir.
 */
export const PLANS: Record<PlanTier, PlanLimits> = {
  free: {
    label: 'Ücretsiz',
    maxVenues: Infinity,
    maxItems: Infinity,
    maxLocales: Infinity,
    images: true,
    removeBadge: true,
    requiresVerifiedAccount: false,
    canPublish: true,
  },
  pro: {
    label: 'Pro',
    maxVenues: Infinity,
    maxItems: Infinity,
    maxLocales: Infinity,
    images: true,
    removeBadge: true,
    requiresVerifiedAccount: false,
    canPublish: true,
  },
  enterprise: {
    label: 'Enterprise',
    maxVenues: Infinity,
    maxItems: Infinity,
    maxLocales: Infinity,
    images: true,
    removeBadge: true,
    requiresVerifiedAccount: false,
    canPublish: true,
  },
};

/** Fiyatlandırma — tek kaynak. iyzico pricing plan ile aynı tutulmalı. */
export const PRICING = {
  monthly: 249,
  yearly: 2490,
  currency: '₺',
  trialDays: 14,
  /** Yıllık alınca kaç ay bedava gelir (pazarlama metni için). */
  get freeMonthsOnYearly() {
    return Math.round((this.monthly * 12 - this.yearly) / this.monthly);
  },
} as const;

/** Bilinmeyen/eksik plan → güvenli varsayılan olarak 'free' limitleri. */
export function planLimits(plan: string | null | undefined): PlanLimits {
  return PLANS[(plan ?? 'free') as PlanTier] ?? PLANS.free;
}

export function normalizePlan(plan: string | null | undefined): PlanTier {
  const p = (plan ?? 'free') as PlanTier;
  return p in PLANS ? p : 'free';
}

/* ------------------------------------------------------------------ *
 * Deneme süresi (14 gün tam erişim)
 * ------------------------------------------------------------------ */

export type TrialState =
  /** Deneme sürüyor — free plan Pro gibi davranır. */
  | 'active'
  /** Deneme bitti, abonelik yok — yayın kilitli. */
  | 'expired'
  /** Deneme kavramı geçerli değil (zaten ücretli plan). */
  | 'none';

export type PlanContext = {
  /** Veritabanındaki gerçek plan. */
  basePlan: PlanTier;
  /** Yetkilendirmede kullanılan plan — deneme sürerken 'pro'. */
  effectivePlan: PlanTier;
  /** effectivePlan'ın limitleri. Kod her yerde bunu okumalı. */
  limits: PlanLimits;
  trial: {
    state: TrialState;
    endsAt: string | null;
    /** Kalan tam gün (bitmişse 0). */
    daysLeft: number;
  };
};

/**
 * Plan + deneme durumunu tek bir yetki nesnesine indirger.
 *
 * Kural: ücretli bir plan varsa deneme dikkate alınmaz. Free planda ise
 * `trial_ends_at` gelecekteyse kullanıcı 'pro' yetkileriyle çalışır; tarih
 * geçmişse free limitlerine (ve yayın kilidine) düşer.
 */
export function resolvePlanContext(
  plan: string | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  trialEndsAt: string | Date | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  now: Date = new Date()
): PlanContext {
  const basePlan = normalizePlan(plan);
  // AJANS MODU: deneme süresi kavramı devre dışı — 'free' zaten 'pro' ile
  // aynı limitlere sahip (bkz. PLANS), o yüzden trial hesaplaması hiçbir
  // şeyi kilitlemesin diye her zaman 'none' döner. trialEndsAt/now
  // parametreleri geriye dönük uyumluluk için duruyor, kullanılmıyor.
  return {
    basePlan,
    effectivePlan: basePlan,
    limits: planLimits(basePlan),
    trial: { state: 'none', endsAt: null, daysLeft: 0 },
  };
}

/** Misafir menüsünde "RestaurantOS" rozeti gösterilsin mi? */
export function showRestaurantBadge(plan: string | null | undefined): boolean {
  return !planLimits(plan).removeBadge;
}

export const UPGRADE_MESSAGES = {
  images:
    'Görsel özellikleri Pro plana özeldir. AI görseli üretmek ve görsel yüklemek için Pro’ya yükseltin.',
  items: (limit: number) =>
    `Ücretsiz planda en fazla ${limit} ürün ekleyebilirsiniz. Daha fazlası için Pro’ya yükseltin.`,
  publishAccount:
    'Menüyü yayınlamadan önce hesabınızı e-posta ile güvene alın ve bir iletişim telefonu ekleyin (Hesap sayfası).',
  trialExpired:
    'Ücretsiz deneme süreniz doldu. Menünüz ve tüm verileriniz duruyor — yayına almak için aboneliğinizi başlatın.',
} as const;

/**
 * Bir org'un plan durumunu ve kullanımını okur. Yalnız sunucu tarafında,
 * service-role veya org-üyesi user-client ile çağrılır.
 *
 * `client` — @supabase/supabase-js istemcisi (admin ya da user).
 */
export type OrgPlanUsage = {
  /** Yetki planı — deneme sürerken 'pro'. */
  plan: PlanTier;
  limits: PlanLimits;
  itemCount: number;
  contactPhone: string | null;
  /** Deneme durumu (UI mesajları için). */
  trial: PlanContext['trial'];
  /** DB'deki gerçek plan — faturalama ekranları için. */
  basePlan: PlanTier;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadOrgPlanUsage(client: any, orgId: string): Promise<OrgPlanUsage> {
  const [{ data: org }, { count }] = await Promise.all([
    client
      .from('organizations')
      .select('plan, contact_phone, trial_ends_at')
      .eq('id', orgId)
      .maybeSingle(),
    client.from('items').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
  ]);
  const ctx = resolvePlanContext(org?.plan, org?.trial_ends_at as string | null);
  return {
    plan: ctx.effectivePlan,
    limits: ctx.limits,
    itemCount: count ?? 0,
    contactPhone: (org?.contact_phone as string | null) ?? null,
    trial: ctx.trial,
    basePlan: ctx.basePlan,
  };
}
