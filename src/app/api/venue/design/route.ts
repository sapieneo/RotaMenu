import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { menuDesignSchema, isAllowedBackgroundImageUrl } from '@/lib/schemas/design';
import { isAdminSession } from '@/lib/admin-auth';
import { hasPanoSession } from '@/lib/pano-auth';

export const runtime = 'nodejs';

const bodySchema = z.object({ venueId: z.string().uuid(), settings: menuDesignSchema });

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz tasarım ayarı.' }, { status: 400 });
  }

  // Ayrıcalıklı erişim: süper-admin paneli (tek sahip tüm kiracıları yönetir)
  // ya da bu işletmeye özel pano şifresiyle açılmış oturum. `resolveManagedVenue`
  // tasarım sayfasını bu iki yolla zaten AÇIYORDU; kaydetme rotası ise yalnız
  // org üyeliğine bakıyordu — sonuç: admin panelinden tema seçilebiliyor ama
  // kaydedilemiyordu ("İşletme bulunamadı veya yetkin yok" → RLS 0 satır).
  const privileged = isAdminSession() || hasPanoSession(parsed.data.venueId);
  if (!user && !privileged) {
    return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });
  }

  if (!isAllowedBackgroundImageUrl(parsed.data.settings.backgroundImageUrl)) {
    return NextResponse.json({ error: 'Geçersiz arka plan görseli.' }, { status: 400 });
  }

  // Ayrıcalıklı yolda RLS'i aşmak için service-role; normal kullanıcıda
  // kendi istemcisi kullanılır ki RLS üyelik kontrolünü yapsın.
  const db = privileged ? createAdminClient() : supabase;
  const { data, error } = await db
    .from('venues')
    .update({ design_settings: parsed.data.settings })
    .eq('id', parsed.data.venueId)
    .select('id, design_settings')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Tasarım kaydedilemedi.', details: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'İşletme bulunamadı veya yetkin yok.' }, { status: 403 });
  return NextResponse.json({ ok: true, settings: data.design_settings });
}
