import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { initSubscriptionCheckout, isIyzicoConfigured, IyzicoError } from '@/lib/iyzico';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  name: z.string().trim().min(1, 'Ad gerekli.').max(60),
  surname: z.string().trim().min(1, 'Soyad gerekli.').max(60),
  identityNumber: z
    .string()
    .trim()
    .regex(/^\d{10,11}$/, 'TC kimlik veya vergi numarası (10-11 hane) gerekli.'),
  email: z.string().trim().email('Geçerli bir e-posta gir.'),
  gsmNumber: z.string().trim().min(7, 'Telefon gerekli.').max(20),
  city: z.string().trim().min(1, 'Şehir gerekli.').max(60),
  address: z.string().trim().min(5, 'Adres gerekli.').max(300),
  zipCode: z.string().trim().max(12).optional(),
});

/**
 * POST /api/billing/checkout
 * Oturumdaki kullanıcının org'u için Pro abonelik Checkout Form'u başlatır.
 * Başarılıysa iyzico'nun `checkoutFormContent` script'ini döner (UI enjekte eder).
 * Bekleyen abonelik satırı token ile kaydedilir; onay callback'te yapılır.
 */
export async function POST(request: NextRequest) {
  if (!isIyzicoConfigured()) {
    return NextResponse.json(
      { error: 'Ödeme altyapısı yapılandırılmamış. Lütfen daha sonra tekrar dene.' },
      { status: 501 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri.' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Org'u ve owner/admin yetkisini doğrula (yükseltme owner işi).
  const { data: membership } = await admin
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin'])
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json(
      { error: 'Yükseltme için işletme sahibi olmalısın.' },
      { status: 403 }
    );
  }
  const orgId = membership.org_id as string;

  const origin = siteOrigin(request);
  const b = parsed.data;

  try {
    const { token, checkoutFormContent } = await initSubscriptionCheckout({
      conversationId: `org_${orgId}_${Date.now().toString(36)}`,
      callbackUrl: `${origin}/api/billing/callback`,
      customer: {
        name: b.name,
        surname: b.surname,
        identityNumber: b.identityNumber,
        email: b.email,
        gsmNumber: b.gsmNumber,
        city: b.city,
        address: b.address,
        zipCode: b.zipCode,
      },
    });

    // Bekleyen abonelik satırı — callback token ile eşleştirir.
    await admin.from('subscriptions').insert({
      org_id: orgId,
      provider: 'iyzico',
      pricing_plan_ref: process.env.IYZICO_PRO_PRICING_PLAN_REF ?? null,
      checkout_token: token,
      status: 'PENDING',
      plan: 'pro',
    });

    return NextResponse.json({ token, checkoutFormContent });
  } catch (err) {
    const message = err instanceof IyzicoError ? err.message : 'Ödeme başlatılamadı.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function siteOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const proto = request.headers.get('x-forwarded-proto') ?? 'http';
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    new URL(request.url).host;
  return `${proto}://${host}`;
}
