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
  id                       uuid primary key references auth.users(id) on delete cascade,
  display_name             text not null,
  rc                       text not null,
  matric_number            text unique,                -- optional; used post-launch for Student Pass validation
  skills                   text[] default '{}',
  trust_score              numeric default 5.0,
  trust_tier               text default 'wanderer' check (trust_tier in ('wanderer', 'explorer', 'champion')),
  strikes                  integer default 0,
  quests_completed         integer default 0,
  avg_rating               numeric default 0,
  streak_count             integer default 0,
  last_active_date         date,
  avatar_url               text,
  push_token               text,
  completion_rate          numeric default 1.0,        -- fraction of accepted quests completed (0.0–1.0)
  avg_response_time_mins   numeric,                    -- average minutes from quest post to first action
  notification_preferences jsonb default '{"new_quest":true,"quest_accepted":true,"quest_complete":true,"chat_message":true,"route_offer_nearby":true,"flash_quests":true,"categories":["food","transport","errands","skills","social"]}', -- per-category toggles
  cross_rc_bonus           integer default 0,          -- count of cross-RC quest completions
  created_at               timestamptz default now()
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
  quest_type          text default 'standard' check (quest_type in ('standard', 'social', 'crew')),
  max_acceptors       integer default 1,        -- >1 for crew quests
  suggested_reward    numeric,                  -- AI-suggested price for analytics/display
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
  type        text default 'text' check (type in ('text', 'image', 'location')),
  image_url   text,
  latitude    numeric,
  longitude   numeric,
  created_at  timestamptz default now()
);

-- ============================================================
-- Ripple Contacts (social graph built from completed quests)
-- ============================================================

create table if not exists contacts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade not null,
  contact_id  uuid references profiles(id) on delete cascade not null,
  created_at  timestamptz default now(),
  unique(user_id, contact_id)
);

-- ============================================================
-- Crew Members (multi-acceptor quests)
-- ============================================================

create table if not exists crew_members (
  id          uuid primary key default gen_random_uuid(),
  quest_id    uuid references quests(id) on delete cascade not null,
  user_id     uuid references profiles(id) on delete cascade not null,
  joined_at   timestamptz default now(),
  status      text default 'active' check (status in ('active', 'dropped_out')),
  unique(quest_id, user_id)
);

-- ============================================================
-- Reports & Disputes
-- ============================================================

create table if not exists reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid references profiles(id) on delete cascade not null,
  reported_user_id  uuid references profiles(id) on delete cascade,
  quest_id          uuid references quests(id) on delete cascade,
  report_type       text not null check (report_type in ('inappropriate_content', 'harassment', 'dispute', 'other')),
  description       text,
  status            text default 'pending' check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at        timestamptz default now()
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
-- Contacts by user
create index if not exists contacts_user_id_idx on contacts(user_id);
create index if not exists contacts_contact_id_idx on contacts(contact_id);
-- Crew members by quest
create index if not exists crew_members_quest_id_idx on crew_members(quest_id);
-- Reports by status (for review queue)
create index if not exists reports_status_idx on reports(status);
-- Quest type filter
create index if not exists quests_quest_type_idx on quests(quest_type);

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

-- contacts
alter table contacts enable row level security;

create policy "Users can view their own contacts"
  on contacts for select to authenticated
  using (auth.uid() = user_id or auth.uid() = contact_id);

create policy "Users can add their own contacts"
  on contacts for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can remove their own contacts"
  on contacts for delete to authenticated
  using (auth.uid() = user_id);

-- crew_members
alter table crew_members enable row level security;

create policy "Crew members viewable by authenticated users"
  on crew_members for select to authenticated using (true);

create policy "Authenticated users can join crew"
  on crew_members for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own crew membership"
  on crew_members for update to authenticated
  using (auth.uid() = user_id);

-- reports
alter table reports enable row level security;

create policy "Users can view their own reports"
  on reports for select to authenticated
  using (auth.uid() = reporter_id);

create policy "Users can submit reports"
  on reports for insert to authenticated
  with check (auth.uid() = reporter_id);

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
-- 6. Trust Tier Update Function (composite scoring)
-- (Called after ratings are inserted)
-- ============================================================

-- New composite trust score function
-- Score weights: completion_rate (0.3), avg_rating (0.4), response_time (0.1), strike_penalty (0.2)
create or replace function update_trust_score(p_user_id uuid)
returns void language plpgsql as $$
declare
  v_profile profiles%rowtype;
  v_completion_score numeric;
  v_rating_score numeric;
  v_response_score numeric;
  v_strike_score numeric;
  v_composite numeric;
  v_new_tier text;
begin
  select * into v_profile from profiles where id = p_user_id;
  if not found then return; end if;

  -- Completion rate: 0.0–1.0 → score 0.0–1.0
  v_completion_score := coalesce(v_profile.completion_rate, 1.0);

  -- Rating: normalise 0–5 → 0.0–1.0
  v_rating_score := coalesce(v_profile.avg_rating, 0) / 5.0;

  -- Response time: faster is better; cap at 120 min. null = neutral 0.5
  if v_profile.avg_response_time_mins is not null then
    v_response_score := greatest(0, 1.0 - (v_profile.avg_response_time_mins / 120.0));
  else
    v_response_score := 0.5;
  end if;

  -- Strike penalty: each strike reduces score; cap at 0
  v_strike_score := greatest(0, 1.0 - (coalesce(v_profile.strikes, 0) * 0.25));

  -- Weighted composite (0.0–1.0 range)
  v_composite := (v_completion_score * 0.3)
               + (v_rating_score * 0.4)
               + (v_response_score * 0.1)
               + (v_strike_score * 0.2);

  -- Map to 0–10 scale for storage
  v_composite := round(v_composite * 10, 2);

  -- Determine tier from composite + quests_completed threshold
  if v_profile.quests_completed >= 20 and v_composite >= 8.5 then
    v_new_tier := 'champion';
  elsif v_profile.quests_completed >= 5 and v_composite >= 7.0 then
    v_new_tier := 'explorer';
  else
    v_new_tier := 'wanderer';
  end if;

  update profiles
  set trust_score = v_composite,
      trust_tier  = v_new_tier
  where id = p_user_id;
end;
$$;

-- Backward-compatible wrapper — existing code calls update_trust_tier
create or replace function update_trust_tier(user_id uuid)
returns void language plpgsql as $$
begin
  perform update_trust_score(user_id);
end;
$$;


-- ============================================================
-- Stage 16 migration: update notification_preferences default
-- ============================================================
ALTER TABLE profiles
  ALTER COLUMN notification_preferences
  SET DEFAULT '{"new_quest":true,"quest_accepted":true,"quest_complete":true,"chat_message":true,"route_offer_nearby":true,"flash_quests":true,"categories":["food","transport","errands","skills","social"]}'::jsonb;
