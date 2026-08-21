import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { checkAdminPassword } from '@/lib/admin-auth';
import { menuDesignSchema, isAllowedBackgroundImageUrl } from '@/lib/schemas/design';
import { CUSTOM_FONT_FAMILY, DEFAULT_MENU_DESIGN, MENU_DESIGN_PRESETS } from '@/lib/themes';

export const runtime = 'nodejs';

const TEMPLATE_IDS = new Set(MENU_DESIGN_PRESETS.map((preset) => preset.templateId));

const bodySchema = z.object({
  password: z.string().min(1, 'Yönetici parolası gerekli.'),
  settings: menuDesignSchema,
});

/**
 * POST /api/design-presets/[templateId]
 *
 * Tasarım stüdyosunda o an üzerinde çalışılan tasarımı, "Büyük Tasarım Seç"
 * galerisindeki 10 hazır karttan birinin ÜZERİNE yazar (bkz.
 * `design_preset_overrides` tablosu). Bu GLOBAL bir değişikliktir — kartın
 * yeni hâlini o andan sonra platformdaki TÜM işletmeler görür. Bu yüzden
 * normal Supabase oturumu değil, ayrı bir yönetici parolası ile korunuyor
 * (bkz. `lib/admin-auth.ts` — `/admin` süper-admin panelinin kullandığı aynı
 * `ADMIN_PASSWORD` mekanizması, sabit-zamanlı karşılaştırma).
 */
export async function POST(request: NextRequest, { params }: { params: { templateId: string } }) {
  if (!TEMPLATE_IDS.has(params.templateId)) {
    return NextResponse.json({ error: 'Geçersiz şablon.' }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz istek.' }, { status: 400 });
  }

  if (!checkAdminPassword(parsed.data.password)) {
    return NextResponse.json({ error: 'Yönetici parolası yanlış.' }, { status: 401 });
  }

  if (!isAllowedBackgroundImageUrl(parsed.data.settings.backgroundImageUrl)) {
    return NextResponse.json({ error: 'Geçersiz arka plan görseli.' }, { status: 400 });
  }

  const admin = createAdminClient();
  // İşletmeye ait özel fontu global şablona taşımıyoruz. Aksi hâlde başka
  // işletmelerin tema kartları ilk işletmenin dosyasına bağımlı kalır.
  const settings = {
    ...parsed.data.settings,
    templateId: params.templateId,
    customFontUrl: null,
    customFontName: null,
    headingFont: parsed.data.settings.headingFont === CUSTOM_FONT_FAMILY
      ? DEFAULT_MENU_DESIGN.headingFont
      : parsed.data.settings.headingFont,
    bodyFont: parsed.data.settings.bodyFont === CUSTOM_FONT_FAMILY
      ? DEFAULT_MENU_DESIGN.bodyFont
      : parsed.data.settings.bodyFont,
  };
  const { error } = await admin
    .from('design_preset_overrides')
    .upsert({ template_id: params.templateId, settings, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: 'Kaydedilemedi.', details: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, settings });
}
