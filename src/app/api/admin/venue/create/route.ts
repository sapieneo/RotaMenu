import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isAdminSession } from '@/lib/admin-auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  name: z.string().trim().min(2, 'İşletme adı en az 2 karakter olmalı.').max(120),
});

/**
 * POST /api/admin/venue/create — AJANS MODU: süper-admin bir müşteri için
 * sıfırdan işletme açar.
 *
 * NEDEN AYRI BİR UÇ VAR (ve /api/bootstrap yetmiyor):
 *   1. Plan doğrudan 'pro' kurulur. Ajans müşterisinin 14 günlük deneme
 *      saymasının anlamı yok; görsel üretimi, sınırsız dil ve yayın ilk
 *      saniyeden açık olmalı.
 *   2. İşletme ADI baştan sorulur. bootstrap her yeni kaydı "İşletmem" diye
 *      açıyor; veritabanı bu isimden altı tane biriktirmiş durumda.
 *
 * SAHİPLİK — buradaki kritik nokta:
 * `organizations.created_by` NOT NULL ve `app.grant_owner_on_org` trigger'ı
 * sahipliği o sütundan kuruyor. Yani org'un gerçek bir Supabase kullanıcısına
 * bağlanması ŞART. Buraya admin'in kendi tarayıcısındaki Supabase oturumunu
 * yazıyoruz; böylece admin o işletmenin gerçek 'owner' üyesi olur ve
 * /api/ingest, /api/image/generate gibi RLS'e/üyeliğe bakan uçlar hiçbir
 * değişiklik gerekmeden çalışır.
 *
 * (Admin oturumu imzalı bir çerezdir, Supabase kullanıcısı DEĞİLDİR — tek
 * başına yetmez. Bu yüzden istemci tarafı çağrıdan önce bir Supabase oturumu
 * olduğundan emin olur.)
 */
export async function POST(request: NextRequest) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: 'Yönetici oturumu gerekli.' }, { status: 401 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      {
        error:
          'Önce bir stüdyo oturumu gerekiyor. Sayfayı yenileyip tekrar deneyin.',
        code: 'no_session',
      },
      { status: 409 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri.' },
      { status: 400 }
    );
  }
  const name = parsed.data.name;

  const admin = createAdminClient();

  // Org: plan 'pro'. trial_ends_at varsayılanı dolsa da resolvePlanContext
  // ücretli planda denemeyi zaten yok sayıyor.
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name, plan: 'pro', created_by: user.id })
    .select('id')
    .single();
  if (orgError || !org) {
    return NextResponse.json(
      { error: 'İşletme kaydı oluşturulamadı.', details: orgError?.message },
      { status: 500 }
    );
  }

  // Slug: isimden türet, çakışırsa sonuna kısa ek koy.
  const base = slugify(name) || 'isletme';
  let venue: { id: string; slug: string } | null = null;
  for (let attempt = 0; attempt < 4 && !venue; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${randomSuffix()}`;
    const { data, error } = await admin
      .from('venues')
      .insert({ org_id: org.id, slug, name })
      .select('id, slug')
      .single();
    if (data) venue = data;
    // 23505 = slug zaten kullanımda → yeni ek ile tekrar dene.
    else if (error && error.code !== '23505') {
      await admin.from('organizations').delete().eq('id', org.id);
      return NextResponse.json({ error: 'Menü adresi oluşturulamadı.' }, { status: 500 });
    }
  }
  if (!venue) {
    await admin.from('organizations').delete().eq('id', org.id);
    return NextResponse.json({ error: 'Menü adresi oluşturulamadı.' }, { status: 500 });
  }

  // Trigger created_by'dan owner üyeliğini kurar; yine de garantiye alalım —
  // üyelik olmazsa admin stüdyoda hiçbir şey yapamaz.
  await admin
    .from('organization_members')
    .upsert(
      { org_id: org.id, user_id: user.id, role: 'owner' },
      { onConflict: 'org_id,user_id' }
    );

  return NextResponse.json({ orgId: org.id, venueId: venue.id, slug: venue.slug }, { status: 201 });
}

const TR_MAP: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i', ö: 'o', Ö: 'o',
  ş: 's', Ş: 's', ü: 'u', Ü: 'u',
};

/** Türkçe harfleri düzleştirip menü adresine uygun slug üretir. */
function slugify(input: string): string {
  return input
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TR_MAP[c] ?? c)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}
