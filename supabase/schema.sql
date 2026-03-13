-- ============================================================
-- Ripple — Supabase Schema
-- Run this in Supabase Dashboard > SQL Editor
-- Prerequisites: enable the pgvector extension first
-- ============================================================

-- 1. Enable pgvector
create extension if not exists vector;

-- ============================================================
-- 2. Tables
-- ============================================================

create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  matric_number   text unique not null,
  display_name    text not null,
  rc              text not null,
  skills          text[] default '{}',
  trust_score     numeric default 5.0,
  trust_tier      text default 'wanderer' check (trust_tier in ('wanderer', 'explorer', 'champion')),
  strikes         integer default 0,
  quests_completed integer default 0,
  avg_rating      numeric default 0,
  streak_count    integer default 0,
  last_active_date date,
  avatar_url      text,
  push_token      text,
  created_at      timestamptz default now()
);

create table if not exists quests (
  id                  uuid primary key default gen_random_uuid(),
  poster_id           uuid references profiles(id) on delete cascade not null,
  acceptor_id         uuid references profiles(id) on delete set null,
  title               text not null,
  description         text not null,
  tag                 text not null check (tag in ('food', 'transport', 'social', 'skills', 'errands')),
  fulfilment_mode     text not null check (fulfilment_mode in ('meetup', 'dropoff')),
  reward_amount       numeric default 0,
  deadline            timestamptz not null,
  location_name       text,
  latitude            numeric,
  longitude           numeric,
  geohash             text,
  status              text default 'open' check (status in ('open', 'in_progress', 'completed', 'expired', 'disputed')),
  drop_off_photo_url  text,
  ai_generated_title  text,
  is_flash            boolean default false,
  flash_expires_at    timestamptz,
  embedding           vector(1536),
  created_at          timestamptz default now()
);

create table if not exists ratings (
  id          uuid primary key default gen_random_uuid(),
  quest_id    uuid references quests(id) on delete cascade,
  rater_id    uuid references profiles(id) on delete cascade,
  ratee_id    uuid references profiles(id) on delete cascade,
  stars       integer not null check (stars between 1 and 5),
  created_at  timestamptz default now(),
  unique(quest_id, rater_id)  -- one rating per rater per quest
);

create table if not exists strikes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  quest_id    uuid references quests(id) on delete cascade,
  reason      text not null check (reason in ('non_payment', 'abandonment')),
  created_at  timestamptz default now()
);

create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  quest_id    uuid references quests(id) on delete cascade,
  sender_id   uuid references profiles(id) on delete cascade,
  content     text not null,
  created_at  timestamptz default now()
);

-- ============================================================
-- 3. Indexes
-- ============================================================

-- Geohash proximity queries
create index if not exists quests_geohash_idx on quests(geohash);
-- Status filter (most queries filter by status = 'open')
create index if not exists quests_status_idx on quests(status);
-- Vector similarity search (ivfflat for approximate, cosine distance)
create index if not exists quests_embedding_idx on quests
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
-- Chat messages per quest
create index if not exists messages_quest_id_idx on messages(quest_id, created_at);

-- ============================================================
-- 4. Row Level Security
-- ============================================================

alter table profiles  enable row level security;
alter table quests    enable row level security;
alter table ratings   enable row level security;
alter table strikes   enable row level security;
alter table messages  enable row level security;

-- profiles
create policy "Profiles are viewable by all authenticated users"
  on profiles for select to authenticated using (true);

create policy "Users can insert their own profile"
  on profiles for insert to authenticated with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update to authenticated using (auth.uid() = id);

-- quests
create policy "Open quests viewable by all authenticated users"
  on quests for select to authenticated using (true);

create policy "Authenticated users can create quests"
  on quests for insert to authenticated with check (auth.uid() = poster_id);

create policy "Poster can update their own quest"
  on quests for update to authenticated
  using (auth.uid() = poster_id or auth.uid() = acceptor_id);

create policy "Poster can delete their own open quest"
  on quests for delete to authenticated
  using (auth.uid() = poster_id and status = 'open');

-- ratings
create policy "Ratings viewable by all authenticated users"
  on ratings for select to authenticated using (true);

create policy "Authenticated users can submit ratings"
  on ratings for insert to authenticated with check (auth.uid() = rater_id);

-- strikes
create policy "Strikes viewable by all authenticated users"
  on strikes for select to authenticated using (true);

create policy "Authenticated users can insert strikes"
  on strikes for insert to authenticated with check (true);

-- messages
create policy "Quest participants can view messages"
  on messages for select to authenticated
  using (
    auth.uid() in (
      select poster_id from quests where id = quest_id
      union
      select acceptor_id from quests where id = quest_id
    )
  );

create policy "Quest participants can send messages"
  on messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and auth.uid() in (
      select poster_id from quests where id = quest_id
      union
      select acceptor_id from quests where id = quest_id
    )
  );

-- ============================================================
-- 5. pgvector Semantic Search RPC
-- ============================================================

create or replace function search_quests(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 20
)
returns table(id uuid, title text, similarity float)
language sql stable as $$
  select
    q.id,
    coalesce(q.ai_generated_title, q.title) as title,
    1 - (q.embedding <=> query_embedding) as similarity
  from quests q
  where
    q.status = 'open'
    and q.embedding is not null
    and 1 - (q.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;

-- ============================================================
-- 6. Trust Tier Update Function
-- (Called after ratings are inserted)
-- ============================================================

create or replace function update_trust_tier(user_id uuid)
returns void language plpgsql as $$
declare
  v_quests_completed integer;
  v_avg_rating numeric;
  v_new_tier text;
begin
  select quests_completed, avg_rating
  into v_quests_completed, v_avg_rating
  from profiles
  where id = user_id;

  if v_quests_completed >= 20 and v_avg_rating >= 4.5 then
    v_new_tier := 'champion';
  elsif v_quests_completed >= 5 and v_avg_rating >= 4.0 then
    v_new_tier := 'explorer';
  else
    v_new_tier := 'wanderer';
  end if;

  update profiles set trust_tier = v_new_tier where id = user_id;
end;
$$;
