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
};

export const PLANS: Record<PlanTier, PlanLimits> = {
  free: {
    label: 'Ücretsiz',
    maxVenues: 1,
    maxItems: 50,
    maxLocales: 5,
    images: false,
    removeBadge: false,
    requiresVerifiedAccount: true,
  },
  pro: {
    label: 'Pro',
    maxVenues: Infinity,
    maxItems: Infinity,
    maxLocales: Infinity,
    images: true,
    removeBadge: true,
    requiresVerifiedAccount: false,
  },
  enterprise: {
    label: 'Enterprise',
    maxVenues: Infinity,
    maxItems: Infinity,
    maxLocales: Infinity,
    images: true,
    removeBadge: true,
    requiresVerifiedAccount: false,
  },
};

/** Bilinmeyen/eksik plan → güvenli varsayılan olarak 'free' limitleri. */
export function planLimits(plan: string | null | undefined): PlanLimits {
  return PLANS[(plan ?? 'free') as PlanTier] ?? PLANS.free;
}

export function normalizePlan(plan: string | null | undefined): PlanTier {
  const p = (plan ?? 'free') as PlanTier;
  return p in PLANS ? p : 'free';
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
} as const;

/**
 * Bir org'un plan durumunu ve kullanımını okur. Yalnız sunucu tarafında,
 * service-role veya org-üyesi user-client ile çağrılır.
 *
 * `client` — @supabase/supabase-js istemcisi (admin ya da user).
 */
export type OrgPlanUsage = {
  plan: PlanTier;
  limits: PlanLimits;
  itemCount: number;
  contactPhone: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadOrgPlanUsage(client: any, orgId: string): Promise<OrgPlanUsage> {
  const [{ data: org }, { count }] = await Promise.all([
    client.from('organizations').select('plan, contact_phone').eq('id', orgId).maybeSingle(),
    client.from('items').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
  ]);
  const plan = normalizePlan(org?.plan);
  return {
    plan,
    limits: planLimits(plan),
    itemCount: count ?? 0,
    contactPhone: (org?.contact_phone as string | null) ?? null,
  };
}
