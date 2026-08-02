import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNING_CONTEXT = 'restaurantos-menu-ingestion-v1\0';
const TRANSLATION_SIGNING_CONTEXT = 'restaurantos-menu-translation-v1\0';

export function signBackgroundPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(SIGNING_CONTEXT).update(payload).digest('hex');
}

export function verifyBackgroundPayload(payload: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(signBackgroundPayload(payload, secret), 'hex');
  const received = Buffer.from(signature, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function signTranslationBackgroundPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(TRANSLATION_SIGNING_CONTEXT)
    .update(payload)
    .digest('hex');
}
