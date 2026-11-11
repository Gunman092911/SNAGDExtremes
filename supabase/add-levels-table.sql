-- Run this once in the Supabase SQL Editor for the SNAGD project.
create table if not exists public.snagd_levels (
    level_key text primary key,
    id bigint not null unique,
    name text not null,
    verifier text not null,
    verification text not null,
    percent_to_qualify integer not null default 100 check (percent_to_qualify between 1 and 100),
    created_at timestamptz not null default now()
);

alter table public.snagd_levels enable row level security;

drop policy if exists "Anyone can read verified levels" on public.snagd_levels;
create policy "Anyone can read verified levels"
on public.snagd_levels for select
to anon, authenticated
using (true);

drop policy if exists "Staff can add verified levels" on public.snagd_levels;
create policy "Staff can add verified levels"
on public.snagd_levels for insert
to authenticated
with check (
    exists (
        select 1 from public.snagd_staff
        where snagd_staff.user_id = auth.uid()
    )
);

 
-- Allow authorized staff to remove staff-added levels.
drop policy if exists "Staff can delete verified levels" on public.snagd_levels;
create policy "Staff can delete verified levels"
on public.snagd_levels for delete
to authenticated
using (
    exists (
        select 1 from public.snagd_staff
        where snagd_staff.user_id = auth.uid()
    )
);
