-- Allows staff to hide built-in JSON levels from the public list.
create table if not exists public.snagd_hidden_levels (
    level_key text primary key,
    hidden_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table public.snagd_hidden_levels enable row level security;

drop policy if exists "Staff can manage hidden levels" on public.snagd_hidden_levels;
create policy "Staff can manage hidden levels"
on public.snagd_hidden_levels
for all
to authenticated
using (
    exists (
        select 1
        from public.snagd_staff
        where snagd_staff.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.snagd_staff
        where snagd_staff.user_id = auth.uid()
    )
);
