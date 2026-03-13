# Ripple — Build Plan

**Goal:** A deployable Expo app for hackathon demo.
**Stack:** React Native (Expo) · Supabase · Mapbox · OpenAI GPT-4o · pgvector

Each stage produces a working, testable checkpoint. Complete and verify each stage before moving on.

---

## Stage 0 — Project Scaffold

**Goal:** Runnable Expo app with folder structure and all dependencies installed.

### Steps
1. Initialise Expo project with TypeScript template:
   ```bash
   npx create-expo-app ripple --template expo-template-blank-typescript
   ```
2. Install core dependencies:
   ```bash
   npx expo install expo-router expo-location expo-image-picker expo-camera
   npx expo install @supabase/supabase-js @react-native-async-storage/async-storage
   npx expo install react-native-maps  # fallback; Mapbox installed separately
   npm install @rnmapbox/maps
   npm install openai
   npm install nativewind tailwindcss
   npm install react-native-reanimated react-native-gesture-handler
   npm install date-fns
   ```
3. Set up folder structure:
   ```
   /app              ← expo-router screens (file-based routing)
     /(auth)         ← login, verify-student-pass
     /(tabs)         ← map, feed, post-quest, profile
     /quest/[id]     ← quest detail, chat, completion
   /components       ← shared UI components
   /lib              ← supabase client, openai client, helpers
   /hooks            ← custom hooks (useSession, useQuests, useLocation)
   /types            ← TypeScript interfaces
   /constants        ← colours, tags, trust tier thresholds
   ```
4. Configure `nativewind` (Tailwind for RN) and `babel.config.js`.
5. Set up `.env` with placeholder keys:
   ```
   EXPO_PUBLIC_SUPABASE_URL=
   EXPO_PUBLIC_SUPABASE_ANON_KEY=
   EXPO_PUBLIC_MAPBOX_TOKEN=
   OPENAI_API_KEY=
   ```

### Checkpoint
- `npx expo start` launches without errors.
- Tab navigator renders 4 placeholder screens.

---

## Stage 1 — Supabase Schema & Auth

**Goal:** Full database schema in place; Supabase Auth configured.

### Database Tables

```sql
-- Users (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id),
  matric_number text unique not null,
  display_name text not null,
  rc text not null,                       -- e.g. "Tembusu", "RC4", "CAPT"
  skills text[] default '{}',
  trust_score numeric default 5.0,
  trust_tier text default 'wanderer',     -- wanderer | explorer | champion
  strikes integer default 0,
  quests_completed integer default 0,
  avg_rating numeric default 0,
  streak_count integer default 0,
  last_active_date date,
  avatar_url text,
  created_at timestamptz default now()
);

-- Quests
create table quests (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid references profiles(id) not null,
  acceptor_id uuid references profiles(id),
  title text not null,
  description text not null,
  tag text not null,                      -- food | transport | social | skills | errands
  fulfilment_mode text not null,          -- meetup | dropoff
  reward_amount numeric default 0,
  deadline timestamptz not null,
  location_name text,
  latitude numeric,
  longitude numeric,
  geohash text,                           -- for proximity queries
  status text default 'open',            -- open | in_progress | completed | expired | disputed
  drop_off_photo_url text,
  ai_generated_title text,
  embedding vector(1536),                 -- pgvector for semantic search
  created_at timestamptz default now()
);

-- Ratings
create table ratings (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid references quests(id),
  rater_id uuid references profiles(id),
  ratee_id uuid references profiles(id),
  stars integer check (stars between 1 and 5),
  created_at timestamptz default now()
);

-- Strikes
create table strikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  quest_id uuid references quests(id),
  reason text,                            -- non_payment | abandonment
  created_at timestamptz default now()
);

-- Chat messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid references quests(id),
  sender_id uuid references profiles(id),
  content text not null,
  created_at timestamptz default now()
);
```

### Steps
1. Enable `pgvector` extension in Supabase dashboard → Extensions.
2. Run schema SQL in Supabase SQL Editor.
3. Enable Row Level Security on all tables; write policies:
   - Profiles: owner can update own row; all authenticated users can read.
   - Quests: authenticated users can read all open quests; only poster can update/delete own quest.
   - Messages: only poster or acceptor of that quest can read/write.
   - Ratings/Strikes: insert by authenticated users; read by anyone.
4. Set up Supabase Auth with email/password (Student Pass verification layer added in Stage 2).
5. Create `lib/supabase.ts` client singleton.
6. Create `types/database.ts` with generated TypeScript types (use Supabase CLI: `supabase gen types`).

### Checkpoint
- Can `insert` and `select` a test quest row from a Supabase client test script.
- Auth sign-up/sign-in works via Supabase dashboard.

---

## Stage 2 — Auth Flow & Student Pass Verification

**Goal:** Working login/sign-up screens with student identity gate.

### Screens
- `app/(auth)/index.tsx` — welcome/landing screen.
- `app/(auth)/sign-up.tsx` — email + password + matric number entry.
- `app/(auth)/verify.tsx` — student pass photo upload + mock verification.
- `app/(auth)/sign-in.tsx` — returning user login.

### Steps
1. Build sign-up form: email, password, display name, RC selection, matric number.
2. **Student Pass verification (MVP approach):** User uploads a photo of their student pass via `expo-image-picker`. For the hackathon demo, implement a **mock verification** that:
   - Accepts any image upload.
   - Validates that the entered matric number matches the regex `^[AaBb]\d{7}[A-Za-z]$`.
   - Marks the profile as `verified = true`.
   - *(Post-hackathon: replace with OCR via GPT-4o vision to extract and validate matric number from photo.)*
3. On successful verification, create `profiles` row via Supabase.
4. Protect all `(tabs)` routes: redirect to `/(auth)` if no session (use `expo-router` middleware or `useSession` hook).
5. Build sign-in screen with Supabase `signInWithPassword`.
6. Persist session via AsyncStorage (Supabase client handles this automatically).

### Checkpoint
- New user can sign up, upload a photo, and land on the tab navigator.
- Refreshing the app keeps the user logged in.
- Unauthenticated users are redirected to auth screens.

---

## Stage 3 — Quest Creation

**Goal:** Users can post quests; AI auto-tagging runs on submission.

### Screen
- `app/(tabs)/post-quest.tsx` — multi-step form.

### Form Fields
1. Title (free text)
2. Description (multi-line)
3. Fulfilment mode toggle: **Meet-Up** / **Drop-Off**
4. Cash reward (numeric input, optional)
5. Deadline (date/time picker)
6. Location (map pin selector or RC dropdown)

### AI Processing (Supabase Edge Function)
Create `supabase/functions/process-quest/index.ts`:
```typescript
// Called after quest insert via database trigger or direct invocation
// 1. Call GPT-4o with quest title + description
//    → returns: { tag, suggested_price_range, ai_generated_title }
// 2. Call text-embedding-3-small with description
//    → returns: embedding vector (1536 dims)
// 3. Update quest row with tag, ai_generated_title, embedding
```

### Steps
1. Build the multi-step form UI with progress indicator.
2. Add map pin picker using Mapbox (or `react-native-maps` for Stage 3, swap to Mapbox in Stage 5).
3. On submit: insert quest row to Supabase, then invoke `process-quest` Edge Function.
4. Compute geohash from lat/lng using a lightweight library (e.g. `ngeohash`) and store it.
5. Show a loading state while AI processes; display the AI-generated title for user confirmation.
6. On completion, redirect to the quest detail screen.

### Checkpoint
- Posting a quest creates a row in Supabase with tag + ai_generated_title populated.
- Embedding is stored in the `embedding` column (verify via `select id, embedding is not null from quests`).

---

## Stage 4 — Quest Feed

**Goal:** Scrollable list of active quests with filtering.

### Screen
- `app/(tabs)/feed.tsx`

### Steps
1. Fetch open quests from Supabase, ordered by `created_at desc`.
2. Subscribe to real-time inserts via `supabase.channel('quests').on('postgres_changes', ...)` to push new quests to the top without refresh.
3. Build `QuestCard` component showing: AI title, tag badge, reward, deadline, fulfilment mode icon, poster RC, poster trust tier badge.
4. Add filter bar: tag chips (All / Food / Transport / Social / Skills / Errands), fulfilment mode toggle, reward range slider.
5. Implement trust-tier gating display: grey out quests the current user is not eligible to accept (e.g. food quests for Wanderers) with a tooltip explaining why.
6. Add pull-to-refresh.

### Checkpoint
- Feed shows real quests posted in Stage 3.
- New quest appears in feed in real time after posting (without refresh).
- Filter chips correctly filter the list.

---

## Stage 5 — Map View

**Goal:** Live Mapbox map with quest pins, clustering, and fulfilment mode indicators.

### Screen
- `app/(tabs)/map.tsx`

### Steps
1. Initialise `@rnmapbox/maps` with Mapbox public token from `.env`.
2. Load active quests and render as `SymbolLayer` pins, coloured by tag:
   - Food → orange, Transport → blue, Social → purple, Skills → green, Errands → yellow.
3. Enable Mapbox's built-in clustering: quests within 50px radius collapse into a count bubble; tap to zoom and explode.
4. Tap a single pin → show a bottom sheet with the `QuestCard` preview and "View Quest" button.
5. Request user GPS via `expo-location` (ask permission on first load); centre map on user.
6. Show user's current position as a distinct marker.
7. Add a toggle button to switch between Map and Feed views (or implement as tabs).

### Checkpoint
- Map renders with quest pins at correct lat/lng.
- Clustering works: zoomed-out shows bubbles; zoomed-in shows individual pins.
- Tapping a pin shows quest preview bottom sheet.

---

## Stage 6 — Quest Detail & Acceptance

**Goal:** Full quest detail screen; users can accept quests.

### Screen
- `app/quest/[id].tsx`

### Steps
1. Fetch full quest details including poster profile (display name, RC, trust score, strikes).
2. Display all quest fields: description, reward, deadline, fulfilment mode, location on mini-map.
3. Show poster's trust score + strike count as a trust badge.
4. **Accept Quest** button:
   - Check current user's trust tier against quest requirements (gate food quests).
   - Update quest status to `in_progress`, set `acceptor_id`.
   - Notify poster (Expo Push Notification — implemented in Stage 8; for now, Supabase Realtime update is sufficient).
5. After acceptance, open in-app chat panel (below quest details or separate tab).
6. Build real-time chat using `supabase.channel('messages:quest_id')`:
   - Message list with sender name + timestamp.
   - Text input + send button.
7. Allow acceptor to **cancel** within 30-minute grace window (no strike). After 30 minutes, show a warning that cancellation earns a strike.

### Checkpoint
- User can accept a quest; quest status updates to `in_progress` in Supabase.
- Both poster and acceptor can see and send messages in real time.
- Cancellation within grace window works without penalty; after grace window shows warning.

---

## Stage 7 — Quest Completion & Ratings

**Goal:** Both fulfilment modes flow end-to-end; ratings and trust score updates work.

### Steps

**Drop-Off flow:**
1. Acceptor taps "Submit Drop-Off Photo" on quest detail screen.
2. `expo-image-picker` or `expo-camera` opens; user takes/picks photo.
3. Upload to Supabase Storage bucket `drop-off-photos`; store public URL in `quests.drop_off_photo_url`.
4. Poster receives real-time update (and push notification in Stage 8); sees photo in quest detail.
5. Poster taps "Confirm Receipt" → quest moves to `completed`.

**Meet-Up flow:**
1. Poster taps "Mark Complete" on quest detail screen.
2. Quest moves to `completed`.

**Post-completion (both modes):**
3. Both parties see a rating prompt (1–5 stars, optional comment).
4. Insert rating rows; recalculate `avg_rating` and `quests_completed` on `profiles`.
5. Recalculate `trust_tier`:
   - Wanderer → Explorer: 5+ completed, 4.0+ avg rating.
   - Explorer → Champion: 20+ completed, 4.5+ avg rating.
6. App shows "Payment reminder" screen — displays agreed reward amount and prompts user to settle via PayNow/PayLah/cash.

**Strike system:**
7. After completion, poster can tap "Payment not received" → inserts strike for poster; check threshold (2 = suspend posting, 3 = flag for RC management).
8. If quest expires with `in_progress` status and no completion → insert abandonment strike for acceptor.
   - Implement as a Supabase scheduled Edge Function (cron) that checks every 15 minutes for expired in-progress quests.

### Checkpoint
- End-to-end: post quest → accept → complete (both modes) → rate → trust score updates in DB.
- Strike inserted when "Payment not received" is tapped.
- Trust tier upgrades after thresholds are met.

---

## Stage 8 — Push Notifications & Profile Screen

**Goal:** Key notification moments work; user profile screen is complete.

### Push Notifications
1. Register for Expo push token on app launch; store in `profiles.push_token`.
2. Send notifications via Expo Push API from Supabase Edge Functions for:
   - Quest accepted (notify poster).
   - Drop-off photo submitted (notify poster).
   - Quest completed (notify both).
   - New message in chat (notify other party).

### Profile Screen (`app/(tabs)/profile.tsx`)
1. Display: avatar, display name, RC, trust tier badge, trust score, streak count.
2. Stats: quests posted, quests completed, avg rating.
3. Skill tags (editable inline).
4. Strike count (displayed as warning if > 0).
5. Quest history: tabs for Posted / Completed / In Progress.
6. Settings: edit display name, change password, log out.

### Checkpoint
- Push notification received on poster's device when another device accepts their quest.
- Profile screen shows accurate live stats.

---

## Stage 9 — RC Leaderboard & Gamification

**Goal:** RC leaderboard and quest streaks are live.

### Screen
- `app/(tabs)/leaderboard.tsx` (or a tab within profile/community)

### Steps
1. **RC Leaderboard:**
   - Aggregate query: count completed quests by RC for the current week (Monday–Sunday).
   - Display ranked list of RCs with quest count and top contributor name.
   - Update on page load (real-time not critical here).

2. **Quest Streaks:**
   - On every quest completion, check if `profiles.last_active_date` was yesterday.
   - If yes: increment `streak_count`. If no (gap > 1 day): reset to 1.
   - Update `last_active_date` to today.
   - Display streak flame icon + count on profile and quest cards.

3. **Flash Quests:**
   - Add a `is_flash` boolean and `flash_expires_at` field to quests table.
   - Flash quests expire 30 minutes after posting regardless of `deadline`.
   - Show a countdown timer on flash quest cards.
   - Add "Post Flash Quest" shortcut button on the post screen.

### Checkpoint
- Leaderboard shows correct RC rankings based on completed quests.
- Completing a quest on consecutive days increments streak correctly.
- Flash quest countdown visible on quest card.

---

## Stage 10 — AI Semantic Search

**Goal:** Natural language quest search using pgvector.

### Steps
1. Create a Supabase RPC function:
   ```sql
   create or replace function search_quests(query_embedding vector(1536), match_threshold float, match_count int)
   returns table(id uuid, title text, similarity float)
   language sql stable as $$
     select id, title, 1 - (embedding <=> query_embedding) as similarity
     from quests
     where status = 'open'
       and 1 - (embedding <=> query_embedding) > match_threshold
     order by similarity desc
     limit match_count;
   $$;
   ```
2. Add a search bar to the Feed screen.
3. On search submit:
   - Call OpenAI `text-embedding-3-small` with the query string (from client or via Edge Function to protect API key).
   - Call the Supabase RPC with the resulting embedding.
   - Render matching quests, sorted by similarity.
4. Debounce search input (300ms) to avoid excessive API calls.

### Checkpoint
- Typing "need help moving furniture" returns furniture/physical help quests even if they don't contain those exact words.
- Empty results state shown when no matches above threshold.

---

## Stage 11 — Polish & Deployment

**Goal:** Demo-ready app deployable via Expo Go / EAS Build.

### Steps
1. **UI Polish:**
   - Apply consistent colour scheme (define in `constants/colours.ts`): dark background, neon accent for quest pins and CTAs, trust tier colour coding.
   - Add loading skeletons for quest feed and map.
   - Add empty states for feed (no quests), chat (no messages), profile (no history).
   - Add error handling for network failures with user-friendly messages.

2. **Fog of War (stretch goal — implement if time allows):**
   - Render a dark polygon covering UTown bounds using Mapbox `FillLayer`.
   - Use `expo-location` watch to update user position; subtract a 50m-radius circle from the dark polygon using Turf.js `difference`.
   - On entering a new fog cell (geohash-level), check for hidden quests and show a discovery toast.

3. **Demo data:**
   - Seed the database with 15–20 realistic sample quests across all tags, RCs, and both fulfilment modes.
   - Create 4–5 demo accounts (one per RC) with varied trust tiers and streaks.

4. **Environment:**
   - Confirm all `.env` keys are set correctly.
   - Test on a physical iOS and Android device via Expo Go.
   - Run `npx expo export` to verify the build is clean.

5. **EAS Build (for a standalone APK/IPA):**
   ```bash
   npm install -g eas-cli
   eas login
   eas build:configure
   eas build --platform android --profile preview   # generates APK for demo
   ```

6. **OTA Update:**
   - Configure `eas update` for instant over-the-air JS updates during the demo day without requiring a new build.

### Checkpoint
- App runs without crashes on a physical device.
- All 10 previous stage features are accessible in the live demo flow.
- EAS build link shareable with judges.

---

## Summary Table

| Stage | Focus | Key Deliverable |
|-------|-------|-----------------|
| 0 | Scaffold | Expo app boots, folder structure ready |
| 1 | Supabase Schema | DB tables, RLS, Auth configured |
| 2 | Auth & Verification | Sign-up / login with student pass gate |
| 3 | Quest Creation | Post quest + GPT-4o AI processing |
| 4 | Quest Feed | Real-time scrollable feed with filters |
| 5 | Map View | Mapbox map with clustered pins |
| 6 | Acceptance & Chat | Accept quest, real-time in-app chat |
| 7 | Completion & Ratings | End-to-end quest lifecycle, trust scores |
| 8 | Notifications & Profile | Push notifications, full profile screen |
| 9 | Leaderboard & Gamification | RC rankings, streaks, flash quests |
| 10 | Semantic Search | pgvector natural language search |
| 11 | Polish & Deploy | Demo-ready, EAS build, seeded data |

---

## Development Tips

- **Work mobile-first.** Test on a physical device from Stage 2 onwards — emulators miss GPS, camera, and push notification behaviour.
- **Keep AI calls in Edge Functions.** Never expose `OPENAI_API_KEY` in the client bundle. All OpenAI calls go through Supabase Edge Functions.
- **Stub before you ship.** If an AI feature isn't working, stub it (e.g., return a fixed tag and title) so the rest of the flow isn't blocked.
- **Use Supabase Realtime sparingly.** Subscribe to channels only when a screen is mounted; unsubscribe on unmount to avoid connection leaks.
- **geohash precision.** Use precision 6 (≈1.2km × 0.6km cells) for proximity queries — wide enough to cover UTown in a few cells.
