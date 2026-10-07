-- University → Subjects: attach a "plan de evaluación" to each subject,
-- written (rich text) and/or as photos/scans, with its own previewer.
-- Run this once in the Supabase SQL editor for project dmhlbgdakispkgbucgmq,
-- then it can be deleted.

-- 1. Plan columns on the subject row
alter table grades_subjects
  add column if not exists eval_plan_text text not null default '',
  add column if not exists eval_plan_images jsonb not null default '[]'::jsonb;

-- 2. Public bucket for plan images (and images pasted into the rich text),
--    so they render straight from their URL without re-signing every view.
insert into storage.buckets (id, name, public)
values ('grades-files', 'grades-files', true)
on conflict (id) do nothing;

-- 3. Storage policies. Files are uploaded as "<user_id>/<timestamp>-<name>",
--    so the first path segment is what scopes them to their owner.
create policy "grades-files public read"
  on storage.objects for select
  using (bucket_id = 'grades-files');

create policy "grades-files insert own"
  on storage.objects for insert
  with check (
    bucket_id = 'grades-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "grades-files update own"
  on storage.objects for update
  using (
    bucket_id = 'grades-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "grades-files delete own"
  on storage.objects for delete
  using (
    bucket_id = 'grades-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
