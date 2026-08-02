import type { SupabaseClient } from '@supabase/supabase-js';
import { extractMenuFromFiles, MenuExtractionError, type MenuPage } from './extract';
import type { RawResult } from '../schemas/menu';

export type StoredMenuPage = {
  storagePath: string;
  mimeType: string;
  sourceType: 'image' | 'pdf';
};

type ProcessingResult =
  | { status: 'review' }
  | { status: 'processing' }
  | { status: 'failed'; error: string };

export async function processMenuIngestion(options: {
  admin: SupabaseClient;
  ingestionId: string;
  pages: StoredMenuPage[];
  claimedOrgId?: string;
  preloadedPages?: MenuPage[];
  openAI?: { apiKey?: string; model?: string };
}): Promise<ProcessingResult> {
  const { admin, ingestionId, pages } = options;

  let claimed: { id: string; org_id: string } | null = options.claimedOrgId
    ? { id: ingestionId, org_id: options.claimedOrgId }
    : null;
  let claimError: unknown = null;

  if (!claimed) {
    const claim = await admin
      .from('menu_ingestions')
      .update({ status: 'processing', error_message: null })
      .eq('id', ingestionId)
      .eq('status', 'uploaded')
      .select('id, org_id')
      .maybeSingle();
    claimed = claim.data;
    claimError = claim.error;
  }

  if (claimError) {
    return fail(admin, ingestionId, 'İçe aktarma işi başlatılamadı.', claimError);
  }

  if (!claimed) {
    const { data: existing } = await admin
      .from('menu_ingestions')
      .select('status')
      .eq('id', ingestionId)
      .maybeSingle();
    if (existing?.status === 'review' || existing?.status === 'approved') return { status: 'review' };
    if (existing?.status === 'processing') return { status: 'processing' };
    return fail(admin, ingestionId, 'İçe aktarma kaydı bulunamadı.');
  }

  try {
    if (pages.some((page) => !page.storagePath.startsWith(`${claimed.org_id}/`))) {
      throw new MenuExtractionError('Geçersiz dosya yolu.');
    }

    const menuPages = options.preloadedPages ?? (await downloadPages(admin, pages));
    const { extracted, model } = await extractMenuFromFiles(menuPages, options.openAI);
    const rawResult: RawResult = {
      extracted,
      created_menu_id: null,
      model,
      extracted_at: new Date().toISOString(),
    };
    const { error: updateError } = await admin
      .from('menu_ingestions')
      .update({ status: 'review', raw_result: rawResult, error_message: null })
      .eq('id', ingestionId);
    if (updateError) throw updateError;
    return { status: 'review' };
  } catch (error) {
    const message =
      error instanceof MenuExtractionError
        ? error.message
        : 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
    const diagnostic =
      error instanceof MenuExtractionError
        ? (error.diagnostic ?? { type: error.name })
        : { type: error instanceof Error ? error.name : 'unknown' };
    return fail(admin, ingestionId, message, diagnostic);
  }
}

async function downloadPages(admin: SupabaseClient, pages: StoredMenuPage[]): Promise<MenuPage[]> {
  const downloaded: MenuPage[] = [];
  for (const page of pages) {
    const { data: blob, error } = await admin.storage.from('menu-uploads').download(page.storagePath);
    if (error || !blob) {
      throw new MenuExtractionError('Dosya okunamadı. Lütfen yeniden yükleyin.', error);
    }
    downloaded.push({ buffer: Buffer.from(await blob.arrayBuffer()), mimeType: page.mimeType });
  }
  return downloaded;
}

async function fail(
  admin: SupabaseClient,
  ingestionId: string,
  message: string,
  diagnostic?: unknown
): Promise<{ status: 'failed'; error: string }> {
  console.error('Menu extraction failed', diagnostic ?? { type: 'unknown' });
  await admin
    .from('menu_ingestions')
    .update({ status: 'failed', error_message: message })
    .eq('id', ingestionId);
  return { status: 'failed', error: message };
}
