-- Süper-admin ve işletmeye özel pano oturumları Supabase kullanıcısı değildir.
-- Next.js route hedef venue çerezini doğruladıktan sonra yalnız service_role
-- tarafından çağrılabilen bu atomik RPC'leri kullanır.

create or replace function public.confirm_item_compliance_privileged(
  p_item            uuid,
  p_allergen_codes  text[]  default '{}',
  p_dietary_codes   text[]  default '{}',
  p_calories_ok     boolean default false,
  p_calories        int     default null,
  p_ingredients     text    default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = 'insufficient_privilege';
  end if;

  select org_id into v_org from public.items where id = p_item;
  if v_org is null then
    raise exception 'Ürün bulunamadı' using errcode = 'no_data_found';
  end if;

  delete from public.item_allergens ia
   where ia.item_id = p_item
     and ia.allergen_id not in (
       select a.id from public.allergens a where a.code = any(p_allergen_codes)
     );
  insert into public.item_allergens
    (item_id, org_id, allergen_id, state, source, confidence, confirmed_by, confirmed_at)
  select p_item, v_org, a.id, 'confirmed', 'verified', null, null, now()
    from public.allergens a where a.code = any(p_allergen_codes)
  on conflict (item_id, allergen_id) do update
    set state='confirmed', source='verified', confirmed_by=null, confirmed_at=now();

  delete from public.item_dietary d
   where d.item_id = p_item
     and d.tag_id not in (
       select t.id from public.dietary_tags t where t.code = any(p_dietary_codes)
     );
  insert into public.item_dietary
    (item_id, org_id, tag_id, state, source, confidence, confirmed_by, confirmed_at)
  select p_item, v_org, t.id, 'confirmed', 'verified', null, null, now()
    from public.dietary_tags t where t.code = any(p_dietary_codes)
  on conflict (item_id, tag_id) do update
    set state='confirmed', source='verified', confirmed_by=null, confirmed_at=now();

  update public.items
     set calories_kcal = coalesce(p_calories, calories_kcal),
         ingredients   = coalesce(p_ingredients, ingredients)
   where id = p_item;

  insert into public.item_compliance
    (item_id, org_id, allergen_review, calories_review, reviewed_by, reviewed_at)
  values
    (p_item, v_org, 'confirmed',
     (case when p_calories_ok then 'confirmed' else 'pending' end)::public.compliance_state,
     null, now())
  on conflict (item_id) do update
    set allergen_review = 'confirmed',
        calories_review = case when p_calories_ok then 'confirmed'::public.compliance_state
                               else public.item_compliance.calories_review end,
        reviewed_by = null,
        reviewed_at = now();

  update public.items set allergens_confirmed = true where id = p_item;
end $$;

revoke all on function public.confirm_item_compliance_privileged(uuid, text[], text[], boolean, int, text)
  from public, anon, authenticated;
grant execute on function public.confirm_item_compliance_privileged(uuid, text[], text[], boolean, int, text)
  to service_role;

create or replace function public.unconfirm_item_compliance_privileged(p_item uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.items where id = p_item) then
    raise exception 'Ürün bulunamadı' using errcode = 'no_data_found';
  end if;

  update public.item_allergens
     set state='ai_suggested', confirmed_by=null, confirmed_at=null
   where item_id=p_item;
  update public.item_dietary
     set state='ai_suggested', confirmed_by=null, confirmed_at=null
   where item_id=p_item;
  update public.item_compliance
     set allergen_review='pending', calories_review='pending', reviewed_by=null, reviewed_at=null
   where item_id=p_item;
  update public.items set allergens_confirmed=false where id=p_item;
end $$;

revoke all on function public.unconfirm_item_compliance_privileged(uuid)
  from public, anon, authenticated;
grant execute on function public.unconfirm_item_compliance_privileged(uuid)
  to service_role;
