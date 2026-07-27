/**
 * `iyzipay` resmi Node SDK'sı için tip bildirimi (paket kendi tiplerini
 * yayınlamıyor). Yalnız kullandığımız yüzeyi kapsar; SDK'nın tüm API'si değil.
 */
declare module 'iyzipay' {
  interface IyzipayConfig {
    apiKey: string;
    secretKey: string;
    uri: string;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type IyzipayCallback = (err: unknown, result: any) => void;

  interface SubscriptionCheckoutFormResource {
    initialize(params: Record<string, unknown>, cb: IyzipayCallback): void;
    /** SDK prototipinde eksik; çalışma anında bağlanır (bkz. lib/iyzico.ts). */
    retrieve?(params: Record<string, unknown>, cb: IyzipayCallback): void;
  }

  interface SubscriptionResource {
    initialize(params: Record<string, unknown>, cb: IyzipayCallback): void;
    cancel(params: Record<string, unknown>, cb: IyzipayCallback): void;
    activate(params: Record<string, unknown>, cb: IyzipayCallback): void;
    retrieve(params: Record<string, unknown>, cb: IyzipayCallback): void;
    search(params: Record<string, unknown>, cb: IyzipayCallback): void;
  }

  class Iyzipay {
    constructor(config: IyzipayConfig);
    subscriptionCheckoutForm: SubscriptionCheckoutFormResource;
    subscription: SubscriptionResource;
    static LOCALE: { TR: string; EN: string };
    static CURRENCY: { TRY: string; EUR: string; USD: string; GBP: string };
    static SUBSCRIPTION_INITIAL_STATUS: { ACTIVE: string; PENDING: string };
    static SUBSCRIPTION_STATUS: {
      EXPIRED: string;
      UNPAID: string;
      CANCELED: string;
      ACTIVE: string;
      PENDING: string;
      UPGRADED: string;
    };
  }

  export = Iyzipay;
}
