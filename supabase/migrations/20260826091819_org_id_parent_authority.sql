-- Çapraz-kiracı (cross-tenant) yazma açığının kapatılması.
--
-- SORUN
-- -----
-- İçerik tablolarının INSERT politikaları yalnız `org_id` sütununa bakıyordu:
--
--   create policy categories_write on public.categories for insert to authenticated
--     with check (app.is_org_member(org_id, 'editor'));
--
-- `org_id` istemciden geldiği ve satırın bağlandığı ÜST KAYIT (menu_id /
-- category_id / item_id / venue_id) hiç doğrulanmadığı için, kendi org'unda
-- editor olan biri şunu yazabiliyordu:
--
--   POST /rest/v1/categories
--   { "org_id": "<KENDİ ORG>", "menu_id": "<BAŞKA İŞLETMENİN MENÜSÜ>", ... }
--
-- `is_org_member(<KENDİ ORG>)` true döndüğü için politika geçiyor, satır ise
-- kurbanın canlı menüsüne düşüyordu. Aynı şey UPDATE ile de mümkündü: kendi
-- org'unda meşru bir satır açıp `menu_id`'yi kurbanın menüsüne çevirmek.
-- Alerjen ve içerik tabloları da aynı desende olduğu için misafire yanlış
-- alerjen bilgisi gösterilmesi mümkündü.
--
-- `app.fill_org_id` trigger'ı bunu engellemiyordu çünkü `org_id`'yi YALNIZCA
-- null olduğunda ebeveynden dolduruyordu; saldırgan değeri kendi verince
-- trigger hiç devreye girmiyordu. Ayrıca trigger yalnız INSERT'te çalışıyordu.
--
-- ÇÖZÜM
-- -----
-- `org_id` artık istemcinin söylediği değil, ÜST KAYDIN söylediği şeydir.
-- Trigger her INSERT ve her UPDATE'te org_id'yi ebeveynden yeniden türetir ve
-- gelen değerin ÜZERİNE YAZAR. Böylece RLS `with check`'i saldırganın kendi
-- org'una değil, kurbanın org'una karşı değerlendirilir ve reddeder.
--
-- Politikalara dokunulmuyor — tek doğruluk kaynağını değiştirmek yeterli ve
-- bütün tabloları aynı anda kapatıyor.
--
-- Meşru akışlar etkilenmez: uygulamadaki her yazma zaten org_id'yi venue/menü
-- üzerinden türetiyor (bkz. api/ingest, api/qr, api/menu/translate,
-- api/ingest/[id]/approve), yani trigger aynı değeri yazar.

create or replace function app.fill_org_id()
returns trigger
language plpgsql
security definer            -- ebeveyn org'u RLS'ten bağımsız, otorite olarak okunur
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_org uuid;
begin
  if tg_table_name in ('menus', 'qr_codes', 'menu_ingestions', 'scan_events') then
    select v.org_id into v_org from public.venues v where v.id = new.venue_id;

  elsif tg_table_name in ('categories', 'menu_translation_jobs') then
    select m.org_id into v_org from public.menus m where m.id = new.menu_id;

  elsif tg_table_name in ('items', 'category_translations') then
    select c.org_id into v_org from public.categories c where c.id = new.category_id;

  elsif tg_table_name in ('item_translations', 'item_allergens', 'item_compliance', 'item_dietary') then
    select i.org_id into v_org from public.items i where i.id = new.item_id;

  else
    -- Trigger tanımlanmamış bir tabloya bağlanırsa sessizce geçme.
    raise exception 'app.fill_org_id: % tablosu icin ust kayit kurali tanimli degil', tg_table_name
      using errcode = 'raise_exception';
  end if;

  if v_org is null then
    -- Ebeveyn yoksa fail-closed. (FK zaten yakalar ama o kontrol trigger'dan
    -- SONRA çalışıyor; buradan net bir mesajla çıkmak daha iyi.)
    raise exception 'app.fill_org_id: % icin ust kayit bulunamadi', tg_table_name
      using errcode = 'foreign_key_violation';
  end if;

  new.org_id := v_org;
  return new;
end
$function$;

comment on function app.fill_org_id() is
  'org_id''yi her INSERT/UPDATE''te ust kayittan turetir ve istemciden geleni ezer. '
  'Caprazi-kiraci yazmayi engelleyen tek dogruluk kaynagi — RLS with check bunun '
  'sonucuna gore calisir. Bkz. 20260826091819_org_id_parent_authority.sql';

-- Trigger'lar: eskiden yalnız BEFORE INSERT idi; UPDATE ile yeniden-ebeveynleme
-- (re-parenting) açık kalıyordu. Hepsi INSERT OR UPDATE'e çevriliyor.
-- qr_codes, menu_ingestions, menu_translation_jobs ve scan_events'te trigger
-- hiç yoktu — ekleniyor.

drop trigger if exists menus_fill_org on public.menus;
create trigger menus_fill_org before insert or update on public.menus
  for each row execute function app.fill_org_id();

drop trigger if exists categories_fill_org on public.categories;
create trigger categories_fill_org before insert or update on public.categories
  for each row execute function app.fill_org_id();

drop trigger if exists items_fill_org on public.items;
create trigger items_fill_org before insert or update on public.items
  for each row execute function app.fill_org_id();

drop trigger if exists category_translations_fill_org on public.category_translations;
create trigger category_translations_fill_org before insert or update on public.category_translations
  for each row execute function app.fill_org_id();

drop trigger if exists item_translations_fill_org on public.item_translations;
create trigger item_translations_fill_org before insert or update on public.item_translations
  for each row execute function app.fill_org_id();

drop trigger if exists item_allergens_fill_org on public.item_allergens;
create trigger item_allergens_fill_org before insert or update on public.item_allergens
  for each row execute function app.fill_org_id();

drop trigger if exists item_dietary_fill_org on public.item_dietary;
create trigger item_dietary_fill_org before insert or update on public.item_dietary
  for each row execute function app.fill_org_id();

drop trigger if exists item_compliance_fill_org on public.item_compliance;
create trigger item_compliance_fill_org before insert or update on public.item_compliance
  for each row execute function app.fill_org_id();

drop trigger if exists qr_codes_fill_org on public.qr_codes;
create trigger qr_codes_fill_org before insert or update on public.qr_codes
  for each row execute function app.fill_org_id();

drop trigger if exists menu_ingestions_fill_org on public.menu_ingestions;
create trigger menu_ingestions_fill_org before insert or update on public.menu_ingestions
  for each row execute function app.fill_org_id();

drop trigger if exists menu_translation_jobs_fill_org on public.menu_translation_jobs;
create trigger menu_translation_jobs_fill_org before insert or update on public.menu_translation_jobs
  for each row execute function app.fill_org_id();

drop trigger if exists scan_events_fill_org on public.scan_events;
create trigger scan_events_fill_org before insert or update on public.scan_events
  for each row execute function app.fill_org_id();
