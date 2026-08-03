-- Misafir menüsünün görsel ayarları. JSONB tercih edildi çünkü şablon kataloğu
-- büyürken her yeni görsel seçenek için şema değişikliği gerektirmemeli.
alter table public.venues
  add column if not exists design_settings jsonb not null default '{}'::jsonb
  check (jsonb_typeof(design_settings) = 'object');

comment on column public.venues.design_settings is
  'Menü şablonu, renk, tipografi, doku, kart ve aralık tercihleri.';
