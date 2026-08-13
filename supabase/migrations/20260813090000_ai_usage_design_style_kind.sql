-- RestaurantOS — AI kotası: 'design_style' türünü ekle
--
-- NEDEN: Tasarım stüdyosuna eklenen "Tarzınız" AI önerisi (serbest metinden
-- 10 hazır tasarımdan birini önerme) de diğer AI uçları gibi kimlik + günlük
-- kota korumasından geçmeli (bkz. src/lib/ai-quota.ts). ai_usage.kind
-- kolonundaki check constraint yalnız mevcut 4 türü kabul ediyordu; yeni
-- türü eklemek için constraint'i genişletiyoruz.

alter table public.ai_usage drop constraint if exists ai_usage_kind_check;

alter table public.ai_usage
  add constraint ai_usage_kind_check
  check (kind in ('ingest', 'image', 'translate', 'description', 'design_style'));
