-- Run this once in the Supabase SQL Editor.
-- Creates the saved public list order and seeds it with the current SNAGD order.

create table if not exists public.snagd_list_order (
    level_key text primary key,
    position integer not null
);

alter table public.snagd_list_order enable row level security;

drop policy if exists "Public can read SNAGD list order" on public.snagd_list_order;
create policy "Public can read SNAGD list order"
on public.snagd_list_order for select
to anon, authenticated
using (true);

drop policy if exists "SNAGD staff can insert list order" on public.snagd_list_order;
create policy "SNAGD staff can insert list order"
on public.snagd_list_order for insert
to authenticated
with check (
    exists (
        select 1 from public.snagd_staff
        where user_id = auth.uid()
    )
);

drop policy if exists "SNAGD staff can update list order" on public.snagd_list_order;
create policy "SNAGD staff can update list order"
on public.snagd_list_order for update
to authenticated
using (
    exists (
        select 1 from public.snagd_staff
        where user_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from public.snagd_staff
        where user_id = auth.uid()
    )
);

insert into public.snagd_list_order (level_key, position)
values
    ('heavenlysakupen', 0),
    ('SAMPLELEVEL16', 1),
    ('zodiac', 2),
    ('SAMPLELEVEL15', 3),
    ('superhatemeworld', 4),
    ('congregation', 5),
    ('aquaticauroras', 6),
    ('arcticlights', 7),
    ('hyperparacosm', 8),
    ('wasureta', 9),
    ('erebus', 10),
    ('yatagarasu', 11),
    ('SAMPLELEVEL2', 12),
    ('SAMPLELEVEL5', 13),
    ('SAMPLELEVEL6', 14),
    ('digitaldescent', 15),
    ('stalemateredux', 16),
    ('artificialascent', 17),
    ('blackblizzard', 18),
    ('astraldivinity', 19),
    ('misfire', 20),
    ('dolos', 21),
    ('baushavortex', 22),
    ('quantumprocessing', 23),
    ('phobos', 24),
    ('microsoftdrivethru', 25),
    ('boj', 26),
    ('tenthcircle', 27),
    ('moment', 28),
    ('SAMPLELEVEL988', 29),
    ('SAMPLELEVEL7', 30),
    ('downbass', 31),
    ('prismatichaze', 32),
    ('azuriteroyen', 33),
    ('sakupenjoy', 34),
    ('bloodbat', 35),
    ('aftermath', 36),
    ('shatter', 37),
    ('slaymoment', 38),
    ('heartbeat', 39),
    ('sarthix', 40),
    ('fallingup', 41),
    ('fairmorning', 42),
    ('fexty', 43),
    ('quadraticfunction', 44),
    ('brokensignal', 45),
    ('rwr', 46),
    ('crowdcontrol', 47),
    ('deceptiondive', 48),
    ('elitezrebirth', 49),
    ('bluecrusadercircles', 50),
    ('allegiance', 51),
    ('vertigo', 52),
    ('pointiercrate', 53),
    ('tungtungsahurcles', 54),
    ('hypersonic', 55),
    ('theflawless', 56),
    ('acropolix', 57),
    ('nosurvivors', 58),
    ('torgue', 59),
    ('SAMPLELEVEL8', 60),
    ('wavetrip', 61),
    ('marchingband', 62),
    ('forbiddenisle', 63),
    ('precipitance', 64),
    ('thejoviestphase', 65),
    ('brutal', 66),
    ('throughthedecay', 67),
    ('niwa', 68),
    ('azuritesillow', 69),
    ('sweaterweather', 70),
    ('acu', 71),
    ('blghasburger', 72),
    ('redworld', 73),
    ('SAMPLELEVEL9', 74),
    ('rauchkammer', 75),
    ('SAMPLELEVEL10', 76),
    ('SAMPLELEVEL11', 77),
    ('SAMPLELEVEL12', 78),
    ('SAMPLELEVEL13', 79),
    ('SAMPLELEVEL14', 80),
    ('b', 81)
on conflict (level_key) do nothing;
