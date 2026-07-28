-- ============================================================================
-- RestaurantOS — 0012_category_background_style.sql
-- Kategori arka plan görselinin misafir menüsünde nasıl gösterileceği:
--   'strip' — küçük şerit banner (mevcut/varsayılan davranış, h-28).
--   'hero'  — tam genişlikte büyük arka plan; ürün listesi üzerine yarı
--             saydam bir kart olarak biner (bkz. guest-menu.tsx).
-- ============================================================================

alter table public.categories
  add column if not exists background_style text
    not null default 'strip'
    check (background_style in ('strip', 'hero'));

comment on column public.categories.background_style is
  'Kategori arka plan görselinin misafir menüsündeki gösterim biçimi: strip | hero.';
