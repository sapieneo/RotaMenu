-- ============================================================================
-- RestaurantOS — 0011_item_view_daily_dedup.sql (Faz C · rate limit kalıcı çözüm)
--
-- Sorun: /api/scan'daki bellek içi rate limit serverless'te çalışmıyor
-- (Netlify örnekleri Map'i paylaşmaz; canlı testte 70 istekte 0×429).
-- Etki yalnız analitik şişirmesiydi; veri bütünlüğü sorunları yoktu.
--
-- Kalıcı çözüm: sayaç şişirmeyi kaynağında, VERİTABANI tekilliğiyle kes.
-- Aynı ziyaretçi (session_key) + aynı ürün (item_id) + aynı UTC günü için
-- yalnız BİR 'item_view' satırı yazılabilir. Uygulama upsert
-- (ignoreDuplicates) kullanır; mükerrer istek sessizce yok sayılır.
--
-- Tasarım notları:
-- * Kolon listesi tam unique index'tir, KISMİ DEĞİL — PostgREST/supabase-js
--   upsert'ün ON CONFLICT hedefi kısmi index'i çözemez. NULLS DISTINCT
--   (varsayılan) sayesinde item_id'si NULL olan 'scan' ve 'menu_view'
--   satırları HİÇBİR ZAMAN çakışmaz → ham sayımları etkilenmez. Bot
--   satırlarında session_key NULL olabilir → onlar da etkilenmez.
-- * occurred_on ÜRETİLMİŞ kolon (UTC günü). Salt rotasyonu da UTC gününe
--   bağlı (analytics.ts todayKey) → sınırlar tutarlı.
-- * Kabul edilen sınır: günlük salt örnek-başına üretilir (saklanMAZ —
--   gizlilik kararı, bkz. analytics.ts). Çok örnekli dağıtımda aynı ziyaretçi
--   örnek başına farklı session_key alabilir → tekillik örnek sayısı kadar
--   satıra izin verir. Sınırsız şişirme → en çok ~örnek sayısı satır: yeterli.
-- ============================================================================

alter table public.scan_events
  add column if not exists occurred_on date
    generated always as ((occurred_at at time zone 'utc')::date) stored;

-- Var olan mükerrerler index'i engellemesin: eskileri temizle (ilk satır kalır).
delete from public.scan_events se
using public.scan_events dup
where se.event_type = 'item_view'
  and dup.event_type = 'item_view'
  and se.session_key is not null
  and se.item_id is not null
  and dup.session_key = se.session_key
  and dup.item_id = se.item_id
  and dup.occurred_on = se.occurred_on
  and dup.id < se.id;

create unique index if not exists scan_events_item_view_daily_uniq
  on public.scan_events (event_type, session_key, item_id, occurred_on);

comment on column public.scan_events.occurred_on is
  'UTC günü (üretilmiş). item_view günlük tekilliği için; salt rotasyonuyla aynı sınır.';
