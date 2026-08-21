-- İşletmelerin kendi fontlarını menülerinde kullanabilmesi için ayrı, public
-- okunan bir kova. Yükleme/silme yalnız service-role kullanan uygulama API'si
-- üzerinden yapılır; istemci rollerine storage.objects politikası verilmez.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'venue-fonts',
  'venue-fonts',
  true,
  5242880,
  array['font/woff2', 'font/woff', 'font/ttf', 'font/otf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
