import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { TEXTURE_OPTIONS } from '@/lib/themes';

export const runtime = 'nodejs';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Geçersiz renk değeri.');
const settingsSchema = z.object({
  templateId: z.string().trim().min(1).max(40),
  backgroundColor: color,
  surfaceColor: color,
  primaryColor: color,
  accentColor: color,
  textColor: color,
  mutedTextColor: color,
  headingFont: z.string().min(1).max(120),
  bodyFont: z.string().min(1).max(120),
  baseFontSize: z.number().int().min(13).max(20),
  headingScale: z.number().min(1).max(1.6),
  cardColor: color,
  cardOpacity: z.number().int().min(20).max(100),
  cardRadius: z.number().int().min(0).max(32),
  itemSpacing: z.number().int().min(6).max(28),
  dividerColor: color,
  dividerOpacity: z.number().int().min(0).max(100),
  texture: z.enum(TEXTURE_OPTIONS.map((option) => option.id) as ['none', 'paper', 'linen', 'dots', 'grid']),
  textureOpacity: z.number().int().min(0).max(60),
});

const bodySchema = z.object({ venueId: z.string().uuid(), settings: settingsSchema });

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz tasarım ayarı.' }, { status: 400 });
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
