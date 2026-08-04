-- Süper-admin: venue askıya alma.
-- Askıya alınan venue'nun misafir menüsü (/m/[slug]) normal menü yerine
-- yönetici tarafından belirlenen bir görsel + uyarı metni gösterir
-- (ör. "Bu numarayı arayın: 555 555 55 55"). Veri SİLİNMEZ — yalnızca
-- görünürlük kapatılır, checkbox kaldırılınca menü kaldığı yerden yayına döner.
alter table public.venues
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspension_message text,
  add column if not exists suspension_image_url text,
  add column if not exists suspended_at timestamptz;

comment on column public.venues.is_suspended is
  'Süper-admin tarafından askıya alındı mı — true ise /m/[slug] normal menü yerine uyarı ekranı gösterir.';
comment on column public.venues.suspension_message is
  'Askıya alma ekranında gösterilen uyarı metni (ör. iletişim numarası).';
comment on column public.venues.suspension_image_url is
  'Askıya alma ekranında gösterilen görsel — venue-media bucket public URL''i.';
