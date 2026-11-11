-- SNAGD player accounts and private record history.
-- Run this once in Supabase Dashboard > SQL Editor.

alter table public.snagd_submissions
    add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Replace the old anonymous submission rule: every new record must belong to
-- the account that is currently signed in.
drop policy if exists anyone_submit_pending on public.snagd_submissions;
drop policy if exists players_submit_own_pending on public.snagd_submissions;
create policy players_submit_own_pending
on public.snagd_submissions
for insert
to authenticated
with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_at is null
);

drop policy if exists players_read_own_submissions on public.snagd_submissions;
create policy players_read_own_submissions
on public.snagd_submissions
for select
to authenticated
using (user_id = (select auth.uid()));

grant insert on public.snagd_submissions to authenticated;
revoke insert on public.snagd_submissions from anon;
grant select on public.snagd_submissions to authenticated;
