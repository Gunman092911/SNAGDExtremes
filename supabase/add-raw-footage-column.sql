-- Run once in Supabase SQL Editor to support the raw-footage field on existing installations.
alter table public.snagd_submissions
add column if not exists raw_footage_url text;

comment on column public.snagd_submissions.raw_footage_url is
'Publicly accessible link to the original, unedited raw recording supplied with a record submission.';
