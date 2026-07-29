-- ============================================================================
-- RestaurantOS — 0013_editable_calories_ingredients.sql
-- Uyum onayı sırasında kalori ve içindekilerin de düzenlenip kaydedilmesi.
-- 0004'teki 4-parametreli confirm_item_compliance imzasını temel alır;
-- sonuna p_calories + p_ingredients ekler (DEFAULT NULL → dokunma).
-- Uygulama: Supabase SQL Editor'da çalıştır.
-- ============================================================================

-- Overload çakışmasını önlemek için eski imzaları kaldırıyoruz.
-- 0003'teki 3-parametreli SQL sarmalayıcı, 0004'teki 4-parametreli fonksiyona
-- bağımlı olduğundan önce 3-arg, sonra 4-arg düşürülür. Route artık yalnızca
-- yeni 6-parametreli imzayı çağıracak.
drop function if exists public.confirm_item_compliance(uuid, text[], boolean);
drop function if exists public.confirm_item_compliance(uuid, text[], text[], boolean);

create or replace function public.confirm_item_compliance(
  p_item            uuid,
  p_allergen_codes  text[]  default '{}',
  p_dietary_codes   text[]  default '{}',
  p_calories_ok     boolean default false,
  p_calories        int     default null,
  p_ingredients     text    default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_uid uuid := auth.uid();
begin
  select org_id into v_org from public.items where id = p_item;
  if v_org is null then
    raise exception 'Ürün bulunamadı' using errcode = 'no_data_found';
  end if;
  if not app.is_org_member(v_org, 'editor') then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = 'insufficient_privilege';
  end if;

  -- Alerjenler
  delete from public.item_allergens ia
   where ia.item_id = p_item
     and ia.allergen_id not in (select a.id from public.allergens a where a.code = any(p_allergen_codes));
  insert into public.item_allergens
    (item_id, org_id, allergen_id, state, source, confidence, confirmed_by, confirmed_at)
  select p_item, v_org, a.id, 'confirmed', 'verified', null, v_uid, now()
    from public.allergens a where a.code = any(p_allergen_codes)
  on conflict (item_id, allergen_id) do update
    set state='confirmed', source='verified', confirmed_by=v_uid, confirmed_at=now();

  -- Diyet etiketleri
  delete from public.item_dietary d
   where d.item_id = p_item
     and d.tag_id not in (select t.id from public.dietary_tags t where t.code = any(p_dietary_codes));
  insert into public.item_dietary
    (item_id, org_id, tag_id, state, source, confidence, confirmed_by, confirmed_at)
  select p_item, v_org, t.id, 'confirmed', 'verified', null, v_uid, now()
    from public.dietary_tags t where t.code = any(p_dietary_codes)
  on conflict (item_id, tag_id) do update
    set state='confirmed', source='verified', confirmed_by=v_uid, confirmed_at=now();

  -- Kalori ve içindekiler: NULL ise dokunma, doluysa güncelle.
  update public.items
     set calories    = coalesce(p_calories, calories),
         ingredients = coalesce(p_ingredients, ingredients)
   where id = p_item;

  -- İnceleme durumu
  insert into public.item_compliance
    (item_id, org_id, allergen_review, calories_review, reviewed_by, reviewed_at)
  values
    (p_item, v_org, 'confirmed',
     (case when p_calories_ok then 'confirmed' else 'pending' end)::public.compliance_state,
     v_uid, now())
  on conflict (item_id) do update
    set allergen_review = 'confirmed',
        calories_review = case when p_calories_ok then 'confirmed'::public.compliance_state
                               else public.item_compliance.calories_review end,
        reviewed_by = v_uid, reviewed_at = now();

  update public.items set allergens_confirmed = true where id = p_item;
end $$;

-- Yeni 6-parametreli imzaya yetki
revoke all on function public.confirm_item_compliance(uuid, text[], text[], boolean, int, text) from public;
grant execute on function public.confirm_item_compliance(uuid, text[], text[], boolean, int, text) to authenticated;

-- ----------------------------------------------------------------------------
-- NOT: 0004'teki 4-parametreli imza (uuid, text[], text[], boolean) duruyor,
-- silinmiyor. Route artık her zaman 6 parametrenin adını da göndererek çağırır
-- (p_calories / p_ingredients NULL olabilir), böylece PostgREST doğru overload'u
-- adlandırılmış parametrelerle seçer ve çakışma olmaz.
-- ----------------------------------------------------------------------------
