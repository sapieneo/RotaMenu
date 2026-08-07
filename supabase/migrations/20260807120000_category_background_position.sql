-- ============================================================================
-- RestaurantOS — 20260807120000_category_background_position.sql
-- Kategori arka plan görselinin dikey kadrajı: 0 = üst, 50 = orta, 100 = alt.
-- 'strip' (kısa şerit) ve 'hero' (büyük, tam ekran) görünümlerinde görselin
-- object-position değeri olarak kullanılır — üretilen görselin en önemli
-- kısmı şeridin dar yüksekliğinde kırpılıp kaybolmasın diye ayarlanabilir.
-- ============================================================================

alter table public.categories
  add column if not exists background_position_y smallint
    not null default 50
    check (background_position_y between 0 and 100);

comment on column public.categories.background_position_y is
  'Kategori arka plan görselinin dikey odak noktası (0-100, object-position yüzdesi).';
