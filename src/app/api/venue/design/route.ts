import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { menuDesignSchema, isAllowedBackgroundImageUrl } from '@/lib/schemas/design';

export const runtime = 'nodejs';

const bodySchema = z.object({ venueId: z.string().uuid(), settings: menuDesignSchema });

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz tasarım ayarı.' }, { status: 400 });
  }

  if (!isAllowedBackgroundImageUrl(parsed.data.settings.backgroundImageUrl)) {
    return NextResponse.json({ error: 'Geçersiz arka plan görseli.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('venues')
    .update({ design_settings: parsed.data.settings })
    .eq('id', parsed.data.venueId)
    .select('id, design_settings')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Tasarım kaydedilemedi.', details: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'İşletme bulunamadı veya yetkin yok.' }, { status: 403 });
  return NextResponse.json({ ok: true, settings: data.design_settings });
}
