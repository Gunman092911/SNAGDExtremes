-- Run this in Supabase Dashboard > SQL Editor to enable staff record removal.
create table if not exists public.snagd_removed_records (
    id bigint generated always as identity primary key,
    level_key text not null,
    username text not null,
    proof_url text not null,
    percent integer not null,
    hz integer not null,
    created_at timestamptz not null default now(),
    unique (level_key, username, proof_url, percent, hz)
);

alter table public.snagd_removed_records enable row level security;

grant select on public.snagd_removed_records to anon, authenticated;
grant insert on public.snagd_removed_records to authenticated;

drop policy if exists "Anyone can read removed record markers" on public.snagd_removed_records;
create policy "Anyone can read removed record markers"
on public.snagd_removed_records for select
to anon, authenticated
using (true);

drop policy if exists "Staff can remove records" on public.snagd_removed_records;
create policy "Staff can remove records"
on public.snagd_removed_records for insert
to authenticated
with check (
    exists (
        select 1 from public.snagd_staff
        where public.snagd_staff.user_id = auth.uid()
    )
);
