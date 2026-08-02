create index menu_translation_jobs_requested_by_idx
  on public.menu_translation_jobs (requested_by);

drop policy translation_jobs_insert on public.menu_translation_jobs;
create policy translation_jobs_insert on public.menu_translation_jobs for insert to authenticated
  with check (app.is_org_member(org_id, 'editor') and requested_by = (select auth.uid()));
