import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { createOpenAIResponse, getOpenAIOutputText, OpenAIRequestError } from '@/lib/ai/openai';
import { MENU_DESIGN_PRESETS } from '@/lib/themes';
import { normalizePlan, resolvePlanContext } from '@/lib/plans';
import { aiTierFor, consumeAiQuota, quotaStatus, refundAiQuota } from '@/lib/ai-quota';
import { naiveStyleMatch } from '@/lib/design-style-match';

export const runtime = 'nodejs';
export const maxDuration = 30;

const DEFAULT_TEXT_MODEL = 'gpt-5.6-luna';
const EDITOR_ROLES = ['owner', 'admin', 'editor'];
const TEMPLATE_IDS = MENU_DESIGN_PRESETS.map((preset) => preset.templateId) as [string, ...string[]];

const bodySchema = z.object({
  venueId: z.string().uuid(),
  styleText: z.string().trim().min(3, 'Tarzını en az birkaç kelimeyle anlat.').max(400),
});

const SUGGESTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['templateId', 'reason'],
  properties: {
    templateId: { type: 'string', enum: TEMPLATE_IDS },
    reason: { type: 'string' },
  },
} as const;

const suggestionResultSchema = z.object({
  templateId: z.enum(TEMPLATE_IDS),
  reason: z.string().min(1).max(220),
});

/**
 * POST /api/venue/design/suggest
 * Kullanıcının serbest metinle anlattığı "tarz"ı (ör. "sıcak, ahşap dokulu,
 * aile işletmesi hissi") 10 hazır tasarımdan birine eşler. AI çağrısı
 * başarısız olursa `naiveStyleMatch` ile anahtar kelime örtüşmesine dayalı
 * bir öneri üretilir — kullanıcı asla boş elle kalmaz.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz istek.' }, { status: 400 });
  }
  const { venueId, styleText } = parsed.data;
  const admin = createAdminClient();

  const { data: venue } = await admin.from('venues').select('id, org_id').eq('id', venueId).maybeSingle();
  if (!venue) return NextResponse.json({ error: 'İşletme bulunamadı.' }, { status: 404 });

  const { data: mem } = await admin
    .from('organization_members')
    .select('role')
    .eq('org_id', venue.org_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!mem || !EDITOR_ROLES.includes(mem.role)) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 });
  }

  const { data: orgRow } = await admin
    .from('organizations')
    .select('plan, trial_ends_at')
    .eq('id', venue.org_id)
    .maybeSingle();

  // ── AI maliyet koruması — diğer AI uçlarıyla aynı desen (bkz. ai-quota.ts) ──
  const tier = aiTierFor({
    isAnonymous: Boolean(user.is_anonymous),
    email: user.email,
    basePlan: normalizePlan(orgRow?.plan),
  });
  const quota = await consumeAiQuota(venue.org_id, 'design_style', 1, tier);
  if (!quota.ok) {
    return NextResponse.json(
      { error: quota.message, code: quota.reason === 'identity' ? 'account_required' : 'quota_exceeded' },
      { status: quotaStatus(quota) }
    );
  }

  try {
    const model = process.env.OPENAI_TEXT_MODEL ?? DEFAULT_TEXT_MODEL;
    const catalog = MENU_DESIGN_PRESETS.map((preset) => ({
      templateId: preset.templateId,
      name: preset.name,
      mood: preset.mood,
      description: preset.description,
      keywords: preset.keywords,
    }));
    const response = await createOpenAIResponse(
      {
        model,
        instructions:
          'Restoranlar için dijital menü tasarımı danışmanısın. Sana verilen 10 hazır tasarım şablonunun ' +
          'kimliği, adı, ruh hali, açıklaması ve anahtar kelimeleri bir JSON listesinde verilecek. Kullanıcının ' +
          'kendi tarzını anlattığı serbest metni oku ve listedeki 10 şablondan RUHUNA en çok uyan TEK birini seç. ' +
          'Yalnızca verilen templateId değerlerinden birini döndür, yeni bir kimlik uydurma. "reason" alanına, ' +
          'kullanıcıya hitap eden, Türkçe, en fazla bir cümlelik kısa bir gerekçe yaz (ör. "Sıcak ve samimi ' +
          'tarifin Anadolu Lokantası şablonuyla birebir örtüşüyor.").',
        input: JSON.stringify({ templates: catalog, userStyleText: styleText }),
        reasoning: { effort: 'none' },
        max_output_tokens: 2000,
        text: {
          verbosity: 'low',
          format: { type: 'json_schema', name: 'design_style_suggestion', schema: SUGGESTION_JSON_SCHEMA, strict: true },
        },
      },
      { timeoutMs: 30_000 }
    );
    const raw = getOpenAIOutputText(response);
    if (!raw) throw new Error('AI yapılandırılmış çıktı üretmedi.');
    const result = suggestionResultSchema.parse(JSON.parse(raw));
    return NextResponse.json({ templateId: result.templateId, reason: result.reason, source: 'ai' as const });
  } catch (error) {
    // AI çağrısı başarısızsa kotayı iade et ve anahtar kelime örtüşmesine
    // dayalı basit, deterministik bir öneriyle devam et — kullanıcı asla
    // "tasarım önerilemedi" ekranına düşmesin.
    await refundAiQuota(venue.org_id, 'design_style', 1);
    const fallback = naiveStyleMatch(styleText);
    const message =
      error instanceof OpenAIRequestError || error instanceof Error ? error.message : 'AI önerisi alınamadı.';
    return NextResponse.json({
      templateId: fallback.templateId,
      reason: fallback.reason,
      source: 'fallback' as const,
      warning: message,
    });
  }
}
