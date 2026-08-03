-- Yönetim QA güvenlik düzeltmeleri:
-- 1) Public bucket nesneleri URL ile erişilebilir kalırken dosya listesi kapatılır.
-- 2) SECURITY DEFINER uyum fonksiyonlarının çağrı yetkisi daraltılır.
-- 3) Trigger fonksiyonlarına sabit search_path verilir.

drop policy if exists "venue_media_select" on storage.objects;

drop policy if exists "venue_media_member_select" on storage.objects;
create policy "venue_media_member_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'venue-media'
  and app.is_org_member((split_part(name, '/', 1))::uuid)
);

drop policy if exists "venue_media_update" on storage.objects;
create policy "venue_media_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'venue-media'
  and app.is_org_member((split_part(name, '/', 1))::uuid, 'editor')
)
with check (
  bucket_id = 'venue-media'
  and app.is_org_member((split_part(name, '/', 1))::uuid, 'editor')
);

revoke all on function public.confirm_item_compliance(uuid, text[], text[], boolean, integer, text)
  from public, anon;
grant execute on function public.confirm_item_compliance(uuid, text[], text[], boolean, integer, text)
  to authenticated;

revoke all on function public.unconfirm_item_compliance(uuid)
  from public, anon;
grant execute on function public.unconfirm_item_compliance(uuid)
  to authenticated;

revoke all on function public.rls_auto_enable()
  from public, anon, authenticated;

alter function app.fill_org_id() set search_path = public, pg_temp;
alter function app.touch_updated_at() set search_path = public, pg_temp;
