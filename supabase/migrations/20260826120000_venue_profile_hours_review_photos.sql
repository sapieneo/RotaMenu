-- Mekan profili: Google değerlendirme linki, yapısal çalışma saatleri, foto galerisi.
--
-- Müşteri talebi (Front Site A3/A4, Mekan Paneli B7):
--  • İlk açılış ekranında sosyal medya + telefon + ÇALIŞMA SAATİ olsun; ekranda
--    "bugünün" saati görünsün, ayrı bir linkte tüm hafta.
--  • Mekanı Google'da değerlendirmeye link olsun.
--  • Mekan görselleri (galeri) mekan panelinden girilip misafire gösterilsin.
--
-- `venues.opening_hours` bugün SERBEST METİN ("Her gün 12:00–24:00"). Bugünün
-- saatini hesaplayabilmek için gün gün veri gerekiyor; eski kolon silinmiyor,
-- yapısal alan boşsa ona düşülüyor (mevcut mekanlar bozulmasın).

-- ── 1) Yeni venue alanları ──────────────────────────────────────────────────
alter table public.venues
  add column if not exists google_review_url text,
  add column if not exists opening_hours_json jsonb;

comment on column public.venues.google_review_url is
  'Mekani Google''da degerlendirme baglantisi (misafir menusunde "Bizi degerlendirin").';

comment on column public.venues.opening_hours_json is
  'Yapisal calisma saatleri. Bicim: [{"day":1..7 (1=Pazartesi, ISO),"closed":bool,'
  '"open":"HH:MM","close":"HH:MM"}]. Bos/null ise venues.opening_hours serbest '
  'metnine dusulur. Bkz. lib/opening-hours.ts';

-- ── 2) Mekan foto galerisi ──────────────────────────────────────────────────
create table if not exists public.venue_photos (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  url         text not null,
  caption     text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists venue_photos_venue_idx on public.venue_photos (venue_id, sort_order);

alter table public.venue_photos enable row level security;

-- ÖNEMLİ: org_id'yi istemci belirlemez — 20260826091819_org_id_parent_authority
-- ile getirilen kural burada da geçerli; trigger org_id'yi venue'dan türetir.
-- Bu yüzden fonksiyona bu tablo TANITILMALI, yoksa insert "ust kayit kurali
-- tanimli degil" hatasiyla reddedilir.
create or replace function app.fill_org_id()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_org uuid;
begin
  if tg_table_name in ('menus', 'qr_codes', 'menu_ingestions', 'scan_events', 'venue_photos') then
    select v.org_id into v_org from public.venues v where v.id = new.venue_id;

  elsif tg_table_name in ('categories', 'menu_translation_jobs') then
    select m.org_id into v_org from public.menus m where m.id = new.menu_id;

  elsif tg_table_name in ('items', 'category_translations') then
    select c.org_id into v_org from public.categories c where c.id = new.category_id;

  elsif tg_table_name in ('item_translations', 'item_allergens', 'item_compliance', 'item_dietary') then
    select i.org_id into v_org from public.items i where i.id = new.item_id;

  else
    raise exception 'app.fill_org_id: % tablosu icin ust kayit kurali tanimli degil', tg_table_name
      using errcode = 'raise_exception';
  end if;

  if v_org is null then
    raise exception 'app.fill_org_id: % icin ust kayit bulunamadi', tg_table_name
      using errcode = 'foreign_key_violation';
  end if;

  new.org_id := v_org;
  return new;
end
$function$;

drop trigger if exists venue_photos_fill_org on public.venue_photos;
create trigger venue_photos_fill_org before insert or update on public.venue_photos
  for each row execute function app.fill_org_id();

drop trigger if exists venue_photos_touch on public.venue_photos;
create trigger venue_photos_touch before update on public.venue_photos
  for each row execute function app.touch_updated_at();

-- RLS: misafir yalnız YAYINDAKİ ve askıya alınmamış mekanın fotoğraflarını görür.
-- (Aktiflik/yayın şartını politikaya koyuyoruz — sorguya bırakmıyoruz.)
drop policy if exists venue_photos_select on public.venue_photos;
create policy venue_photos_select on public.venue_photos for select
  using (
    app.is_org_member(org_id)
    or exists (
      select 1 from public.venues v
      where v.id = venue_id
        and v.is_published
        and coalesce(v.is_suspended, false) = false
    )
  );

drop policy if exists venue_photos_insert on public.venue_photos;
create policy venue_photos_insert on public.venue_photos for insert to authenticated
  with check (app.is_org_member(org_id, 'editor'));

drop policy if exists venue_photos_update on public.venue_photos;
create policy venue_photos_update on public.venue_photos for update
  using (app.is_org_member(org_id, 'editor'))
  with check (app.is_org_member(org_id, 'editor'));

drop policy if exists venue_photos_delete on public.venue_photos;
create policy venue_photos_delete on public.venue_photos for delete
  using (app.is_org_member(org_id, 'editor'));
