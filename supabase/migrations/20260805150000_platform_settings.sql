-- Platform geneli ayarlar (süper-admin).
--
-- Askıya alma bildirimi artık işletme başına değil, PLATFORM GENELİNDE tek bir
-- görsel + metinden oluşur. Böylece yönetici her menü için ayrı ayrı içerik
-- girmez; bir kez tanımlar, askıya alınan tüm menüler aynı ekranı gösterir.
--
-- Tek satırlı tablo deseni: `id` daima true, check ile ikinci satır engellenir.
create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  suspension_message text,
  suspension_image_url text,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

-- RLS: okuma/yazma yalnız service-role (policy tanımlanmaz → herkese kapalı).
-- Misafir menüsü bu satırı service-role istemcisiyle okur.
alter table public.platform_settings enable row level security;

comment on table public.platform_settings is
  'Süper-admin platform ayarları (tek satır). Askıya alınan menülerde gösterilen ortak uyarı görseli ve metni.';

-- Artık kullanılmayan işletme başına askıya alma içeriği: sütunlar kalıyor
-- (geçmiş veri kaybolmasın) ama uygulama platform_settings'i okuyor.
comment on column public.venues.suspension_message is
  'KULLANIM DIŞI — ortak metin için platform_settings.suspension_message kullanılır.';
comment on column public.venues.suspension_image_url is
  'KULLANIM DIŞI — ortak görsel için platform_settings.suspension_image_url kullanılır.';
