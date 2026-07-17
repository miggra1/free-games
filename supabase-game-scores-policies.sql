alter table public.game_scores enable row level security;

drop policy if exists "Public can read game scores" on public.game_scores;
create policy "Public can read game scores"
on public.game_scores
for select
to anon, authenticated
using (true);

drop policy if exists "Public can insert game scores" on public.game_scores;
create policy "Public can insert game scores"
on public.game_scores
for insert
to anon, authenticated
with check (
  game_key in (
    'angry-birds',
    'link-link-game',
    'speed-fury',
    'fire-basketball',
    'fire-basketball-v2'
  )
  and score >= 0
  and score <= 1000000
);
