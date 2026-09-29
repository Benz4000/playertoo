-- Player Too database schema.
-- Run this once in your Supabase project: Dashboard > SQL Editor > New query > paste > Run.

-- ============================================================
-- Tables
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  birthdate date not null,
  gender text not null check (gender in ('man', 'woman', 'nonbinary')),
  interested_in text[] not null default '{}',
  looking_for text not null default 'both' check (looking_for in ('date', 'duo', 'both')),
  bio text check (char_length(bio) <= 300),
  avatar_url text,
  platforms text[] not null default '{}',
  region text,
  play_times text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_games (
  profile_id uuid not null references public.profiles on delete cascade,
  game text not null,
  rank text,
  primary key (profile_id, game)
);

create table public.swipes (
  swiper uuid not null references public.profiles on delete cascade,
  swiped uuid not null references public.profiles on delete cascade,
  liked boolean not null,
  created_at timestamptz not null default now(),
  primary key (swiper, swiped),
  check (swiper <> swiped)
);

create table public.matches (
  id bigint generated always as identity primary key,
  user_a uuid not null references public.profiles on delete cascade,
  user_b uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

create table public.messages (
  id bigint generated always as identity primary key,
  match_id bigint not null references public.matches on delete cascade,
  sender uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_match_idx on public.messages (match_id, created_at);

create table public.blocks (
  blocker uuid not null references public.profiles on delete cascade,
  blocked uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

create table public.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references public.profiles on delete cascade,
  reported uuid not null references public.profiles on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Triggers
-- ============================================================

-- Adults only, and keep updated_at fresh.
create function public.check_profile() returns trigger
language plpgsql as $$
begin
  if new.birthdate > current_date - interval '18 years' then
    raise exception 'You must be 18 or older to use Player Too';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_check
  before insert or update on public.profiles
  for each row execute function public.check_profile();

-- A like that is returned creates a match.
create function public.handle_swipe() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.liked and exists (
    select 1 from swipes s
    where s.swiper = new.swiped and s.swiped = new.swiper and s.liked
  ) then
    insert into matches (user_a, user_b)
    values (least(new.swiper, new.swiped), greatest(new.swiper, new.swiped))
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger on_swipe
  after insert or update on public.swipes
  for each row execute function public.handle_swipe();

-- Blocking someone removes any match (and its chat) with them.
create function public.handle_block() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from matches
  where user_a = least(new.blocker, new.blocked)
    and user_b = greatest(new.blocker, new.blocked);
  return new;
end $$;

create trigger on_block
  after insert on public.blocks
  for each row execute function public.handle_block();

-- ============================================================
-- Row level security
-- Other people's profiles are only readable through the functions below,
-- which show an age instead of the exact birthdate.
-- ============================================================

alter table public.profiles enable row level security;
alter table public.profile_games enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "create own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "delete own profile" on public.profiles
  for delete to authenticated using (id = auth.uid());

create policy "read own games" on public.profile_games
  for select to authenticated using (profile_id = auth.uid());
create policy "add own games" on public.profile_games
  for insert to authenticated with check (profile_id = auth.uid());
create policy "update own games" on public.profile_games
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "remove own games" on public.profile_games
  for delete to authenticated using (profile_id = auth.uid());

create policy "read own swipes" on public.swipes
  for select to authenticated using (swiper = auth.uid());
create policy "swipe as self" on public.swipes
  for insert to authenticated with check (swiper = auth.uid());
create policy "change own swipe" on public.swipes
  for update to authenticated using (swiper = auth.uid()) with check (swiper = auth.uid());

create policy "read own matches" on public.matches
  for select to authenticated using (auth.uid() in (user_a, user_b));
create policy "unmatch" on public.matches
  for delete to authenticated using (auth.uid() in (user_a, user_b));

create policy "read messages in own matches" on public.messages
  for select to authenticated using (
    exists (select 1 from public.matches m
            where m.id = match_id and auth.uid() in (m.user_a, m.user_b))
  );
create policy "send messages in own matches" on public.messages
  for insert to authenticated with check (
    sender = auth.uid() and
    exists (select 1 from public.matches m
            where m.id = match_id and auth.uid() in (m.user_a, m.user_b))
  );

create policy "read own blocks" on public.blocks
  for select to authenticated using (blocker = auth.uid());
create policy "block as self" on public.blocks
  for insert to authenticated with check (blocker = auth.uid());
create policy "unblock" on public.blocks
  for delete to authenticated using (blocker = auth.uid());

create policy "report as self" on public.reports
  for insert to authenticated with check (reporter = auth.uid());

-- ============================================================
-- Functions the app calls
-- ============================================================

-- What other players see about someone.
create function public.public_profile(p public.profiles) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'age', date_part('year', age(p.birthdate))::int,
    'gender', p.gender,
    'interested_in', p.interested_in,
    'looking_for', p.looking_for,
    'bio', p.bio,
    'avatar_url', p.avatar_url,
    'platforms', p.platforms,
    'region', p.region,
    'play_times', p.play_times,
    'games', coalesce((
      select jsonb_agg(jsonb_build_object('game', g.game, 'rank', g.rank) order by g.game)
      from profile_games g where g.profile_id = p.id
    ), '[]'::jsonb)
  )
$$;

-- People to swipe on: not yourself, not already swiped, no blocks either way.
-- Ordered by shared games; the app does the finer scoring.
create function public.get_candidates(max_results int default 100) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select public_profile(p)
  from profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and not exists (select 1 from swipes s where s.swiper = auth.uid() and s.swiped = p.id)
    and not exists (
      select 1 from blocks b
      where (b.blocker = auth.uid() and b.blocked = p.id)
         or (b.blocker = p.id and b.blocked = auth.uid())
    )
  order by (
    select count(*) from profile_games mine
    join profile_games theirs on theirs.game = mine.game
    where mine.profile_id = auth.uid() and theirs.profile_id = p.id
  ) desc, p.updated_at desc
  limit least(max_results, 200)
$$;

-- Your matches, newest conversation first.
create function public.get_matches() returns table (
  match_id bigint,
  matched_at timestamptz,
  profile jsonb,
  last_message text,
  last_message_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select m.id, m.created_at, public_profile(p), lm.body, lm.created_at
  from matches m
  join profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  left join lateral (
    select body, created_at from messages
    where match_id = m.id order by created_at desc limit 1
  ) lm on true
  where auth.uid() in (m.user_a, m.user_b)
  order by coalesce(lm.created_at, m.created_at) desc
$$;

revoke execute on function public.public_profile(public.profiles) from public, anon, authenticated;
revoke execute on function public.get_candidates(int) from public, anon;
revoke execute on function public.get_matches() from public, anon;
grant execute on function public.get_candidates(int) to authenticated;
grant execute on function public.get_matches() to authenticated;

-- ============================================================
-- Profile photos (public bucket; each user writes only to their own folder)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "see own avatars" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replace own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- Live chat
-- ============================================================

alter publication supabase_realtime add table public.messages;
