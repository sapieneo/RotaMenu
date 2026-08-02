alter table public.item_translations
  add column if not exists ingredients text;

create table public.menu_translation_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  menu_id uuid not null references public.menus(id) on delete cascade,
  job_type text not null check (job_type in ('description', 'translation')),
  locale text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  total_items integer not null default 0 check (total_items >= 0),
  model text,
  error_message text,
  requested_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (menu_id, job_type, locale)
);

create index menu_translation_jobs_org_status_idx
  on public.menu_translation_jobs (org_id, status, updated_at desc);

create trigger menu_translation_jobs_touch
  before update on public.menu_translation_jobs
  for each row execute function app.touch_updated_at();

alter table public.menu_translation_jobs enable row level security;

create policy translation_jobs_select on public.menu_translation_jobs for select
  using (app.is_org_member(org_id));

create policy translation_jobs_insert on public.menu_translation_jobs for insert to authenticated
  with check (app.is_org_member(org_id, 'editor') and requested_by = auth.uid());

create policy translation_jobs_update on public.menu_translation_jobs for update to authenticated
  using (app.is_org_member(org_id, 'editor'))
  with check (app.is_org_member(org_id, 'editor'));

create policy translation_jobs_delete on public.menu_translation_jobs for delete to authenticated
  using (app.is_org_member(org_id, 'editor'));

grant select, insert, update, delete on table public.menu_translation_jobs to authenticated;
grant all on table public.menu_translation_jobs to service_role;
grant select on table public.category_translations to anon, authenticated;
grant select on table public.item_translations to anon, authenticated;
grant insert, update, delete on table public.category_translations to authenticated;
grant insert, update, delete on table public.item_translations to authenticated;
