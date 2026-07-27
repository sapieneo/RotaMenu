-- ============================================================================
-- RestaurantOS — 0010_subscriptions.sql (Faz C · Faturalama / iyzico)
--
-- Pro abonelik kayıtları. Plan bilgisi (fiyat/periyot) iyzico panelindeki
-- "pricing plan"da tanımlıdır; burada yalnız o aboneliğin iyzico referansları,
-- durumu ve dönem sonu tutulur. `organizations.plan` gerçek yetki anahtarıdır;
-- bu tablo onun kaynağı/denetim izidir.
--
-- Yazma YALNIZCA service-role ile yapılır (billing rotaları). RLS: org üyesi
-- kendi aboneliğini OKUR; INSERT/UPDATE policy'si YOK → anon/kullanıcı yazamaz
-- (scan_events ile aynı desen).
-- ============================================================================

create table if not exists public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references public.organizations(id) on delete cascade,
  provider                  text not null default 'iyzico',
  -- iyzico referansları (abonelik oluşunca dolar)
  iyzico_customer_ref       text,
  iyzico_subscription_ref   text unique,
  pricing_plan_ref          text,
  -- checkout başlatınca üretilen token (callback eşleştirmesi için)
  checkout_token            text,
  -- iyzico durumu: ACTIVE / PENDING / UNPAID / CANCELED / EXPIRED / UPGRADED
  status                    text not null default 'PENDING',
  -- yetki verilen plan (organizations.plan ile eşlenir)
  plan                      public.plan_tier not null default 'pro',
  current_period_end        timestamptz,
  canceled_at               timestamptz,
  -- iyzico ham yanıtı (denetim / hata ayıklama)
  raw                       jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists subscriptions_org_idx on public.subscriptions (org_id);
create index if not exists subscriptions_sub_ref_idx on public.subscriptions (iyzico_subscription_ref);
create index if not exists subscriptions_token_idx on public.subscriptions (checkout_token);

-- updated_at otomatik
drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch
  before update on public.subscriptions
  for each row execute function app.touch_updated_at();

alter table public.subscriptions enable row level security;

-- Okuma: org üyesi. Yazma policy'si YOK → yalnız service-role yazar.
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions for select
  using (app.is_org_member(org_id));

comment on table public.subscriptions is
  'Pro abonelik kayıtları (iyzico). Yazma yalnız service-role; organizations.plan yetki anahtarıdır.';
comment on column public.subscriptions.current_period_end is
  'Aboneliğin ödenmiş dönem sonu. Yenileme webhook''unda ileri taşınır; iptal/expire''da plan free''e döner.';
