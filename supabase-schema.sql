-- Run this in the Supabase SQL Editor before using the cloud-backed app.
-- This setup is for a shared private scoreboard with no sign-in.

create table if not exists public.sightings (
  id uuid primary key,
  game_id text not null,
  player_id text not null check (player_id in ('dad', 'cameron')),
  action text not null check (action in ('durango', 'cybertruck', 'penalty')),
  points numeric(4, 1) not null check (points in (1, 0.5, -1)),
  game_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists sightings_game_date_idx
  on public.sightings (game_id, game_date, created_at);

alter table public.sightings enable row level security;

drop policy if exists "One shared scoreboard can read sightings" on public.sightings;
drop policy if exists "One shared scoreboard can add sightings" on public.sightings;
drop policy if exists "One shared scoreboard can delete sightings" on public.sightings;

create policy "One shared scoreboard can read sightings"
  on public.sightings
  for select
  to anon
  using (game_id = 'one-family-scoreboard');

create policy "One shared scoreboard can add sightings"
  on public.sightings
  for insert
  to anon
  with check (
    game_id = 'one-family-scoreboard'
    and player_id in ('dad', 'cameron')
    and action in ('durango', 'cybertruck', 'penalty')
    and points in (1, 0.5, -1)
  );

create policy "One shared scoreboard can delete sightings"
  on public.sightings
  for delete
  to anon
  using (game_id = 'one-family-scoreboard');
