-- 14 günlük tam deneme süresi (Faz C · fiyatlandırma kararı 2026-08-05).
--
-- Model: yeni işletme kaydolduğunda 14 gün boyunca Pro'nun tüm özellikleri
-- açıktır. Süre dolunca plan 'free' kalır ama YAYIN kilitlenir (bkz.
-- lib/plans.ts → canPublish). Veri asla silinmez; abonelik başlayınca menü
-- kaldığı yerden yayına döner.
alter table public.organizations
  add column if not exists trial_ends_at timestamptz;

-- Mevcut işletmeler migration anında kilitlenmesin: onlara da 14 gün tanı.
update public.organizations
   set trial_ends_at = now() + interval '14 days'
 where trial_ends_at is null;

-- Bundan sonra açılan her işletme otomatik 14 günlük denemeyle başlar.
alter table public.organizations
  alter column trial_ends_at set default (now() + interval '14 days');

comment on column public.organizations.trial_ends_at is
  'Ücretsiz deneme bitiş anı. Bu tarihe kadar free plan Pro gibi davranır; sonrasında yayın kilitlenir.';
