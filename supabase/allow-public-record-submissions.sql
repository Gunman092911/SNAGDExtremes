-- Allow visitors to submit records without creating an account.
-- Run this in Supabase Dashboard > SQL Editor.

drop policy if exists players_submit_own_pending on public.snagd_submissions;
drop policy if exists anyone_submit_pending on public.snagd_submissions;
drop policy if exists public_submit_pending on public.snagd_submissions;

create policy public_submit_pending
on public.snagd_submissions
for insert
to anon, authenticated
with check (
    status = 'pending'
    and reviewed_at is null
);

grant insert on public.snagd_submissions to anon, authenticated;
