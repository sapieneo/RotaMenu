/**
 * RotaMenu — iyzico entegrasyon sarmalayıcısı (Faz C · Faturalama).
 *
 * Yalnız sunucu tarafında. Resmi `iyzipay` SDK'sını promise'lere sarar,
 * yapılandırmayı env'den okur ve SDK'da eksik olan abonelik-checkout `retrieve`
 * metodunu çalışma anında güvenle bağlar.
 *
 * Fiyat/periyot BURADA yoktur: iyzico panelindeki "pricing plan"da tanımlıdır;
 * yalnız referans kodu (IYZICO_PRO_PRICING_PLAN_REF) kullanılır.
 *
 * Gerekli env:
 *   IYZICO_API_KEY, IYZICO_SECRET_KEY
 *   IYZICO_URI               (varsayılan: https://sandbox-api.iyzipay.com)
 *   IYZICO_PRO_PRICING_PLAN_REF
 */
import Iyzipay from 'iyzipay';

export class IyzicoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IyzicoError';
  }
}

export function isIyzicoConfigured(): boolean {
  return Boolean(
    process.env.IYZICO_API_KEY &&
      process.env.IYZICO_SECRET_KEY &&
      process.env.IYZICO_PRO_PRICING_PLAN_REF
  );
}

export function iyzicoBaseUri(): string {
  return process.env.IYZICO_URI?.trim().replace(/\/+$/, '') || 'https://sandbox-api.iyzipay.com';
}

let client: Iyzipay | null = null;

function getClient(): Iyzipay {
  if (!isIyzicoConfigured()) {
    throw new IyzicoError('iyzico yapılandırılmamış. IYZICO_* env değişkenlerini ekleyin.');
  }
  if (!client) {
    client = new Iyzipay({
      apiKey: process.env.IYZICO_API_KEY!,
      secretKey: process.env.IYZICO_SECRET_KEY!,
      uri: iyzicoBaseUri(),
    });
    // SDK'nın SubscriptionCheckoutForm._api.retrieve tanımı VAR ama prototipe
    // metod eklenmemiş (bilinen eksik). Aynı auth pipeline'ını kullanarak
    // çalışma anında bağlıyoruz.
    const scf = client.subscriptionCheckoutForm as unknown as {
      retrieve?: unknown;
      _config: { body?: unknown };
      _request: (name: string, cb: (e: unknown, r: unknown, b: unknown) => void) => void;
    };
    if (typeof scf.retrieve !== 'function') {
      scf.retrieve = function (
        this: typeof scf,
        params: Record<string, unknown>,
        cb: (e: unknown, b: unknown) => void
      ) {
        this._config.body = params;
        this._request('retrieve', (err, _res, body) => cb(err, body));
      };
    }
  }
  return client;
}

/** iyzico yanıtı: status alanı 'success' | 'failure'. */
export type IyzicoResult = {
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  [k: string]: unknown;
};

function isSuccess(r: IyzicoResult): boolean {
  return (r?.status ?? '').toLowerCase() === 'success';
}

// ─── Adres / müşteri girdisi (fatura formundan) ──────────────────────────────
export type BillingCustomer = {
  name: string;
  surname: string;
  identityNumber: string; // TC kimlik / vergi no (iyzico abonelik zorunlu)
  email: string;
  gsmNumber: string;
  city: string;
  address: string;
  zipCode?: string;
};

function customerBody(c: BillingCustomer) {
  const addr = {
    contactName: `${c.name} ${c.surname}`.trim(),
    city: c.city,
    country: 'Turkey',
    address: c.address,
    zipCode: c.zipCode || undefined,
  };
  return {
    name: c.name,
    surname: c.surname,
    identityNumber: c.identityNumber,
    email: c.email,
    gsmNumber: c.gsmNumber,
    billingAddress: addr,
    shippingAddress: addr,
  };
}

/**
 * Abonelik Checkout Form başlatır. Başarılıysa `checkoutFormContent` (script) +
 * `token` döner; UI bu script'i sayfaya enjekte ederek iyzico formunu açar.
 */
export async function initSubscriptionCheckout(opts: {
  conversationId: string;
  callbackUrl: string;
  customer: BillingCustomer;
}): Promise<{ token: string; checkoutFormContent: string; tokenExpireTime?: number }> {
  const iyzipay = getClient();
  const params = {
    locale: Iyzipay.LOCALE.TR,
    conversationId: opts.conversationId,
    callbackUrl: opts.callbackUrl,
    pricingPlanReferenceCode: process.env.IYZICO_PRO_PRICING_PLAN_REF!,
    subscriptionInitialStatus: Iyzipay.SUBSCRIPTION_INITIAL_STATUS.ACTIVE,
    customer: customerBody(opts.customer),
  };
  const body = await new Promise<IyzicoResult>((resolve, reject) => {
    iyzipay.subscriptionCheckoutForm.initialize(params, (err, res) => {
      if (err) reject(new IyzicoError(String((err as Error)?.message ?? err)));
      else resolve(res as IyzicoResult);
    });
  });
  if (!isSuccess(body)) {
    throw new IyzicoError(body.errorMessage || 'iyzico checkout başlatılamadı.');
  }
  return {
    token: String(body.token),
    checkoutFormContent: String(body.checkoutFormContent),
    tokenExpireTime: typeof body.tokenExpireTime === 'number' ? body.tokenExpireTime : undefined,
  };
}

/** Checkout tamamlandıktan sonra token ile abonelik sonucunu sorgular. */
export async function retrieveSubscriptionCheckout(token: string): Promise<IyzicoResult> {
  const iyzipay = getClient();
  const retrieve = iyzipay.subscriptionCheckoutForm.retrieve;
  if (typeof retrieve !== 'function') {
    throw new IyzicoError('iyzico retrieve metodu kullanılamıyor.');
  }
  return new Promise<IyzicoResult>((resolve, reject) => {
    retrieve({ checkoutFormToken: token }, (err, res) => {
      if (err) reject(new IyzicoError(String((err as Error)?.message ?? err)));
      else resolve(res as IyzicoResult);
    });
  });
}

/** Aboneliği iptal eder (dönem sonuna kadar aktif kalır; iyzico politikası). */
export async function cancelSubscription(subscriptionReferenceCode: string): Promise<IyzicoResult> {
  const iyzipay = getClient();
  return new Promise<IyzicoResult>((resolve, reject) => {
    iyzipay.subscription.cancel({ subscriptionReferenceCode }, (err, res) => {
      if (err) reject(new IyzicoError(String((err as Error)?.message ?? err)));
      else resolve(res as IyzicoResult);
    });
  });
}

/** Abonelik referansıyla güncel durumu getirir (webhook doğrulaması için). */
export async function retrieveSubscription(subscriptionReferenceCode: string): Promise<IyzicoResult> {
  const iyzipay = getClient();
  return new Promise<IyzicoResult>((resolve, reject) => {
    iyzipay.subscription.retrieve({ subscriptionReferenceCode }, (err, res) => {
      if (err) reject(new IyzicoError(String((err as Error)?.message ?? err)));
      else resolve(res as IyzicoResult);
    });
  });
}
