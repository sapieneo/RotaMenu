-- RestaurantOS — AI kullanım kotası (maliyet koruması)
--
-- NEDEN: /studyo'ya giren HERKES otomatik anonim oturum + 14 günlük deneme
-- alıyor; deneme sürerken plan 'pro' sayıldığı için görsel/çeviri açılıyordu.
-- Yani e-posta, telefon, captcha olmadan OpenAI ve Runware faturası
-- şişirilebiliyordu. Bu tablo org+gün+tür bazında sayaç tutar; uçlar
-- src/lib/ai-quota.ts üzerinden buradan geçer.
--
-- Sayaç YALNIZ service-role ile yazılır (RLS'te INSERT/UPDATE policy yok) —
-- istemciden sayaç sıfırlanamaz. Org üyesi kendi kullanımını okuyabilir.

create table if not exists public.ai_usage (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  used_on    date not null default (now() at time zone 'utc')::date,
  kind       text not null check (kind in ('ingest', 'image', 'translate', 'description')),
  units      integer not null default 0 check (units >= 0),
  updated_at timestamptz not null default now(),
  primary key (org_id, used_on, kind)
);

comment on table public.ai_usage is
  'Org başına günlük AI kullanım sayacı. units = tüketilen birim (ingest: sayfa, image: görsel, translate: dil, description: çalıştırma). Yalnız service-role yazar.';

create index if not exists ai_usage_day_idx on public.ai_usage (used_on desc);

alter table public.ai_usage enable row level security;

-- Org üyesi kendi org'unun kullanımını görebilir (panoda "bugün 12/60 görsel").
drop policy if exists ai_usage_select on public.ai_usage;
create policy ai_usage_select on public.ai_usage
  for select using (app.is_org_member(org_id, 'viewer'));

-- INSERT/UPDATE/DELETE policy'si BİLİNÇLİ OLARAK YOK: sayaç yalnız sunucudan
-- (service-role) artırılır, istemci sıfırlayamaz.

/**
 * Kotayı atomik olarak tüketir.
 *
 * Yarış koşulu önemli: iki eşzamanlı istek ayrı ayrı "kota var" görüp limiti
 * aşabilirdi. insert ... on conflict do update ... where tek deyimde satırı
 * kilitleyip şartı kontrol eder; başarısızsa hiç satır dönmez.
 *
 * Dönüş: kalan birim (>=0) ya da kota yetmiyorsa null.
 */
create or replace function public.consume_ai_quota(
  p_org   uuid,
  p_kind  text,
  p_units integer,
  p_limit integer
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_used integer;
begin
  if p_units <= 0 then
    raise exception 'units must be positive';
  end if;

  insert into public.ai_usage (org_id, used_on, kind, units)
  values (p_org, (now() at time zone 'utc')::date, p_kind, p_units)
  on conflict (org_id, used_on, kind) do update
     set units = public.ai_usage.units + p_units,
         updated_at = now()
   where public.ai_usage.units + p_units <= p_limit
  returning units into v_used;

  -- Çakışma oldu ve where şartı tutmadıysa hiç satır dönmez → kota dolu.
  if v_used is null then
    return null;
  end if;
  -- Yeni satır limitin üstündeyse (ilk insert'te where çalışmaz) geri al.
  if v_used > p_limit then
    update public.ai_usage
       set units = units - p_units
     where org_id = p_org
       and used_on = (now() at time zone 'utc')::date
       and kind = p_kind;
    return null;
  end if;

  return p_limit - v_used;
end $$;

comment on function public.consume_ai_quota is
  'Org+gün+tür kotasını atomik tüketir. Kalan birimi döner, kota yetmezse null.';

-- Yalnız service-role çağırsın: istemci kendi kotasını "tüketip" başkasının
-- sayacını bozamasın diye authenticated/anon EXECUTE yetkisi verilmez.
revoke all on function public.consume_ai_quota(uuid, text, integer, integer) from public;
revoke all on function public.consume_ai_quota(uuid, text, integer, integer) from anon;
revoke all on function public.consume_ai_quota(uuid, text, integer, integer) from authenticated;
grant execute on function public.consume_ai_quota(uuid, text, integer, integer) to service_role;
