# Ripple — Product Plan & Build Stages

**Small actions. Big community. Every ripple matters.**

---

## 1. Problem Statement

University Town houses ~4,000 students across 7 Residential Colleges, all within a 500-metre radius of each other. On paper, this density should make exchanging small favours effortless. In practice, it doesn't — because **there is no efficient, trustworthy channel to ask a near-stranger for help.**

Consider what happens every single day in UTown:

- A student in Tembusu wants someone to pick up food from The Deck on the way back. They know *someone* in the 600-person building is probably walking past the canteen right now — but they have no way to find that person.
- A fresher in RC4 needs help assembling IKEA furniture. They'd happily pay $10 for 30 minutes of help, but posting in a 500-person group chat feels awkward, and they don't know anyone well enough to ask directly.
- A CAPT resident is heading to Clementi anyway and could easily pick up a package for someone — but no one knows they're making the trip.

These micro-needs are tiny individually. Collectively, they happen hundreds of times a week across UTown, and almost all of them go unmet. The **supply of goodwill exists** — students are willing to help, especially for a small reward — but the **demand is invisible**. There is no marketplace, no signal, no match.

The existing workarounds fail for specific, identifiable reasons:

- **RC group chats** — high-volume, unstructured, and ephemeral. A request posted at 2pm is buried by 2:15pm. No way to filter, search, or verify who's responding. No accountability if someone flakes.
- **Confession pages / anonymous boards** — designed for entertainment, not action. Zero trust signals. You wouldn't ask an anonymous account to pick up your laptop charger.
- **Personal networks** — effective if you already have one. Useless for the students who need it most: freshmen in their first weeks, introverts, exchange students, and anyone who hasn't yet built a circle in their RC — let alone across RCs.

The result: students default to doing everything themselves, not because they prefer it, but because **asking is harder than just handling it alone.** Willing helpers and unmet needs exist metres apart, with no mechanism to connect them.

Ripple is that mechanism. It turns invisible micro-needs into structured, discoverable, trustworthy requests — and matches them to the right person at the right time using AI.

---

## 2. Solution: Ripple

Ripple is a mobile-first peer request platform built specifically for UTown's Residential Colleges. Residents post **quests** — small tasks, errands, event invitations, or skill requests — and nearby residents accept them for a **cash reward** (settled privately between users), reputation, or simply the satisfaction of helping a neighbour.

The core loop: **Post a quest → AI structures and broadcasts it → a neighbour gets matched and notified → they complete it → payment and reputation flow. Every small act ripples outward into a stronger community.**

What makes Ripple different from a group chat or notice board:

- **AI-first quest creation** — don't fill out a form. Just type what you need in plain language. GPT-4o extracts the item, price, fulfilment mode, location, and deadline automatically via a conversational interface. The quest is live in seconds.
- **AI piggyback matching** — Ripple doesn't wait for someone to browse. It detects users who are already heading toward a quest location based on real-time GPS + movement vector, and pings them. Fulfilment by coincidence, not by hire.
- **Semantic search** — type what you want to help with in natural language and AI matches you to the most relevant quests, not just keyword hits.
- **Structured requests** with clear descriptions, deadlines, reward amounts, and fulfilment modes (drop-off vs meet-up vs social).
- **Social quests** — study buddies, event partners, workout companions. No payment changes hands; the "reward" is the shared experience.
- **Crew mode** — group quests that need 2+ people. Payment split among crew as agreed. Crew members can come from any RC — a natural inter-RC bonding mechanic.
- **Ripple Contacts** — after completing a quest together, both parties can add each other as contacts. Contacts see each other's future quests first, building an organic social graph from genuine interactions.
- **A trust and reputation system** backed by NUS email domain verification, with a composite trust score factoring in completion rate, ratings, response time, and strikes.
- **Gamification and inter-RC mechanics** (leaderboards, streaks, flash quests).
- **AI price suggestion** — when a poster doesn't specify a reward, GPT-4o suggests a fair price based on the quest description and historical data.

---

## 3. How It Works — Full Pipeline

### Phase A: Account Setup

1. **Student Verification.** Registration is gated by NUS email domain (`@u.nus.edu`) via Supabase Auth — verifiable, sufficient to prevent anonymous accounts, and buildable in hours. Post-launch, this upgrades to full Student Pass scanning with matric number validation. Every account is tied to a real, identifiable student.

### Phase B: Quest Creation

2. **Resident opens Ripple** and taps "Post Quest."

3. **Primary input: conversational AI.** The resident sees a ChatGPT-style interface and types what they need in plain English.

4. **GPT-4o extracts structured fields** (title, description, fulfilment mode, deadline, reward, location, tag). If all required fields are present, it shows a **confirmation card**. If any field is missing, it asks a natural follow-up question.

5. **AI price suggestion** — if the user doesn't specify a reward, GPT-4o suggests a fair price based on the quest description and historical pricing data.

6. The AI reply is **typed out character-by-character** for a polished, animated feel.

7. A **Manual mode** (3-step form) is available via a pill toggle at the top.

8. **Quest types:** Standard paid quests, **Social quests** (study buddies, event partners — no payment), and **Crew quests** (need 2+ people).

9. The quest description is **embedded** via OpenAI's `text-embedding-3-small` and stored in Supabase's `pgvector` for semantic search.

10. Quest goes **live** in the feed.

### Phase C: Quest Discovery & AI Matching

11. **AI Piggyback Matching (proactive — the core differentiator).** Ripple's matching engine combines:
    - Real-time location + movement vector — the user's current geohash and direction of travel.
    - Quest embeddings — semantic similarity between the user's skill profile / past quest history and active quests.
    - Contextual signals — time of day, quest urgency, quest category match with user's declared skills.
    - 3-step scoring: (1) geohash proximity filter, (2) cosine similarity on embeddings, (3) GPT-4o micro-call re-ranking top 5 candidates with contextual reasoning.

12. **Feed View** — A scrollable list of active quests, filterable by tag, fulfilment mode, quest type (paid/social/crew), reward range, RC, deadline, and with keyword + semantic search.

13. **AI Semantic Search** — Natural language queries matched against quest embeddings via pgvector.

14. **RC Leaderboard** — Weekly rankings of which college has completed the most quests.

### Phase D: Quest Acceptance

15. A resident taps a quest and reviews the details: description, reward, deadline, fulfilment mode, poster's trust score and strike count. Trust-tier gating applies.

16. They tap **"Accept Quest."** The quest is assigned. The poster receives a push notification. For **Crew quests**, multiple users can accept until `max_acceptors` is reached.

17. An in-app **chat channel** opens between poster and acceptor(s). Chat supports text, photo sharing, and location sharing.

### Phase E: Quest Completion

**Meet-Up:** Poster taps "Mark Complete" after the meetup. Both parties rate each other.

**Drop-Off:** Acceptor uploads a photo at the drop-off point. Poster confirms receipt. Both parties rate each other.

**Social quest (no payment):** Either party taps "Mark Complete." Both parties rate each other. No payment prompt.

**Post-Completion:** Payment reminder shown (for paid quests only). Trust score recalculates. Streak increments.

### Phase F: Post-Completion Social

18. **Ripple Contacts.** After every completed quest, both parties see a prompt: "Add [name] as a Ripple contact?" Contacts can see each other's future quests first, making repeat interactions easy.

### Phase G: Reputation Update

20. **Trust Score** — a composite score from completion rate, average rating, response time, and strike count.
21. Trust tiers: **Wanderer** (new) → **Explorer** (5+ completed, 4.0+ rating) → **Champion** (20+ completed, 4.5+ rating).
22. Food-related quests require the acceptor to be Explorer tier or above.

### Phase H: Safety & Reporting

23. **Report system** — flag quests or users for inappropriate content or behaviour. Flagged items reviewed manually (hackathon); AI-assisted triage post-launch.
24. **Dispute resolution** — either party can raise a dispute, flagging the quest for manual review.

---

## 4. Key Features

### 4a. Quest Types & Fulfilment Modes

| Aspect | Meet-Up | Drop-Off | Social |
|--------|---------|----------|--------|
| Use case | Furniture help, skill exchange | Food pickup, package collection, item lending | Study buddy, event partner, workout companion |
| Verification | Poster taps "Mark Complete" | Acceptor submits photo; poster confirms | Either party taps "Mark Complete" |
| Poster presence | Required | Not required | Required |
| Payment | Cash reward (settled privately) | Cash reward (settled privately) | None — shared experience is the reward |

**Crew Mode:** Group quests that need 2+ people (e.g., "need 3 people to help move a sofa"). Any fulfilment mode. Payment split among crew as agreed. Crew members can come from any RC.

### 4b. AI Components

| Component | Technology | What It Does |
|-----------|-----------|--------------|
| Conversational Quest Creation | GPT-4o (`chat-quest` Edge Function) | Multi-turn chat: user describes quest, GPT-4o extracts structured fields and asks targeted follow-ups |
| AI Piggyback Matching | GPT-4o + pgvector + geohash + movement vector | 3-step scoring: (1) geohash proximity filter, (2) cosine similarity on embeddings, (3) GPT-4o re-ranking micro-call. Detects users already heading toward a quest location and pings them |
| Semantic Search | `text-embedding-3-small` + pgvector | Natural language search over quest embeddings |
| AI Price Suggestion | GPT-4o | Analyses quest description + historical pricing data to suggest a fair cash reward when the user doesn't specify one |

### 4c. Gamification & Community

- **RC Leaderboards** — Which college completed the most quests this week?
- **Flash Quests** — 30-minute urgent requests with a live countdown timer.
- **Skill Profiles** — Declare your skills; Ripple surfaces relevant quests to you.
- **Quest Streaks** — Complete quests on consecutive days to earn a streak badge.
- **Ripple Contacts** — Post-completion prompt to add quest partner as a contact. Contacts see each other's future quests first.

### 4d. Trust & Safety

- **NUS email domain verification** (`@u.nus.edu`) — every account tied to a real NUS student identity. Post-launch: Student Pass scanning with matric validation.
- **Trust Score** — composite score from completion rate, average rating, response time, and strike count.
- Trust tiers gate access to high-value and food-related quests.
- **Strike system** with escalation: 2 strikes = posting suspended, 3 strikes = escalated to RC management.
- "Payment not received" button for acceptors after completion.
- Abandonment strike if acceptor drops out outside 30-min grace window.
- **Report system** — flag quests or users for inappropriate content/behaviour. Manual review (hackathon); AI-assisted triage post-launch.
- **Dispute resolution** — either party can raise a dispute, flagging the quest for review.

### 4e. Communication

- **In-app chat** — real-time chat between poster and acceptor(s), powered by Supabase Realtime. Supports text, photo sharing, and location sharing.
- **Configurable push notifications** — alerts for AI-matched quests, quest accepted, drop-off photo submitted, quest completed, new chat messages. Users can configure notification frequency and categories.

---

## 5. Technical Architecture

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend | React Native (Expo SDK 55) | Cross-platform iOS/Android app |
| Routing | expo-router v5 | File-based routing |
| UI | NativeWind v4 (Tailwind) | Dark-theme design system |
| Backend & DB | Supabase | Auth, PostgreSQL, Realtime, Storage, RLS |
| AI: NL Parsing | OpenAI GPT-4o (function calling) | Conversational quest creation via `chat-quest` Edge Function |
| AI: Search | pgvector (Supabase) | Quest embeddings for semantic search |
| Real-time | Supabase Realtime | Feed updates + in-app chat |
| Notifications | Expo Push Notifications | Quest accepted, completed, new messages, AI matches. Configurable frequency |
| Payments | Off-platform (PayNow / cash) | Settled privately |

---

## 6. Product Roadmap

| Phase | Deliverables |
|-------|-------------|
| **Hackathon Build** | AI chat quest creation, social quests, crew mode, quest feed (expanded filters), acceptance + enhanced chat (photo/location sharing), drop-off + meetup + social completion, ratings + trust score (composite), push notifications (configurable), profile screen, RC leaderboard, streaks, flash quests, semantic search, AI piggyback matching, AI price suggestion, Ripple Contacts, report system, NUS email verification |
| **Post-Launch v1** | Student Pass scanning, Stripe Connect, native app store release, RC admin dashboard, analytics, AI dispute triage |
| **v2 Growth** | Expansion to other NUS residences, Fog of War map, voice input for quest creation |

---

## 7. Why This Wins

**The AI isn't a feature — it's the product.** Remove the AI and Ripple becomes a notice board. With it:

1. **Zero-friction quest creation.** Type what you need in plain English. The AI turns it into a structured, searchable quest in under 2 seconds — and suggests a fair price if you don't set one.

2. **The supply finds the demand.** Ripple's AI piggyback matching detects users already heading toward a quest location and pings them — fulfilment by coincidence, not by hire.

3. **Tasks and socialising in one system.** The student who picks up your lunch today might be your study partner tomorrow. Social quests, crew mode, and Ripple Contacts mean community forms through repeated, genuine usefulness.

**Small actions. Big community. Every ripple matters.**

---

---

# Build Plan

**Stack:** React Native (Expo SDK 55) · expo-router v5 · Supabase · OpenAI GPT-4o · pgvector · NativeWind v4

Each stage produces a working, testable checkpoint.

---

## Stage 0 — Project Scaffold ✅

**Goal:** Runnable Expo app with folder structure and all dependencies installed.

- Expo project with TypeScript, expo-router v5 (file-based routing)
- NativeWind v4, supabase-js, openai, reanimated, gesture-handler, date-fns, ngeohash
- Brand colour palette: `background`, `surface`, `surface-2`, `accent`, tag colours, trust tier colours
- Entry point: `expo-router/entry` (not `index.ts`)

### Checkpoint
- `npx expo start` launches without errors.
- Tab navigator renders placeholder screens.

---

## Stage 1 — Supabase Schema ✅

**Goal:** Full database schema live in Supabase; typed client configured.

### Tables
- `profiles` — extends auth.users; includes trust_tier, skills, streak_count, push_token, last_active_date
- `quests` — title, description, tag, fulfilment_mode, reward_amount, deadline, geohash, status, is_flash, embedding (vector 1536)
- `ratings`, `strikes`, `messages`

### Key additions
- `pgvector` extension for semantic search
- `search_quests` RPC (cosine similarity)
- `update_trust_tier` SQL function
- RLS policies on all tables
- Geohash index for proximity queries

### Checkpoint
- Can insert and select a test quest row.

---

## Stage 2 — Auth Flow ✅

**Goal:** Sign-up, sign-in, and student pass verification fully wired to Supabase Auth.

### Screens
- `app/(auth)/index.tsx` — welcome/landing
- `app/(auth)/sign-up.tsx` — email, password + confirm password, display name, RC, matric number
- `app/(auth)/verify.tsx` — student pass photo upload → uploads to `student-passes` bucket (mock verification)
- `app/(auth)/sign-in.tsx` — sign in via **email or display name**

### Auth flow
```
Sign-up → supabase.auth.signUp (stores metadata) → Verify screen
  → upload photo to student-passes bucket
  → profiles.insert (creates profile row) → Feed
Sign-in (email) → supabase.auth.signInWithPassword → Feed
Sign-in (display name) → get_email_by_display_name RPC → signInWithPassword → Feed
Cold start → useSession → Feed (if session) or Auth (if not)
```

### Required Supabase SQL
```sql
-- Allows display name login
CREATE OR REPLACE FUNCTION get_email_by_display_name(p_display_name text)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT u.email FROM auth.users u
  INNER JOIN profiles p ON p.id = u.id
  WHERE p.display_name ILIKE p_display_name LIMIT 1;
$$;
```

### Notes
- Email confirmation must be **disabled** in Dashboard → Authentication → Providers → Email.
- Create `student-passes` bucket in Supabase Storage (private).

### Checkpoint
- New user can sign up, upload photo, land on feed.
- Returning user can sign in with email or display name.
- Refresh keeps user logged in.

---

## Stage 3 — Quest Creation ✅

**Goal:** AI conversational quest creation (primary) + manual 3-step form (fallback).

### Screen
- `app/(tabs)/post-quest.tsx` — AI / Manual pill toggle at top

### Path A: AI Chat Mode (primary)
1. User types free-text in a ChatGPT-style interface
2. `chat-quest` Edge Function (GPT-4o function calling) extracts fields and asks follow-up questions until all required fields are gathered
3. AI reply is animated character-by-character at 12ms/char
4. **Confirmation card** appears when `complete=true` — shows title, mode, deadline, reward, location, tag
5. "Post Quest" submits; "Keep editing" continues the conversation

### Path B: Manual Mode (fallback)
3-step form: Details (title, description, category, mode) → Location → Reward & Deadline (including Flash Quest toggle)

### Edge Functions
- `supabase/functions/chat-quest/index.ts` — multi-turn GPT-4o conversation, deployed with `--no-verify-jwt`
- `supabase/functions/process-quest/index.ts` — auto-tagging + `text-embedding-3-small` embedding, fired fire-and-forget after insert

### Checkpoint
- AI chat correctly gathers all fields and shows confirmation card.
- Manual mode 3-step form works.
- Quest row appears in Supabase with embedding populated.

---

## Stage 4 — Quest Feed ✅

**Goal:** Real-time scrollable feed with filtering, trust-tier gating, and pull-to-refresh.

### Screen
- `app/(tabs)/feed.tsx`

### Features
- Real-time: Supabase `postgres_changes` INSERT subscription
- `useFocusEffect` re-fetch on tab focus
- Tag filter chips + fulfilment mode toggle + keyword search
- Trust-tier gating: Wanderers cannot accept food quests or rewards > $5
- Pull-to-refresh
- Expired and flash-expired quest filtering (client-side)

### Components
- `components/QuestCard.tsx` — tag badge, AI title, reward, countdown, mode, flash badge + live countdown timer, ineligibility notice
- `hooks/useProfile.ts` — fetches current user's profile (used by feed)

### Checkpoint
- Feed shows real quests.
- New quest appears in real time after posting.
- Filter chips correctly filter the list.

---

## Stage 5 — Map View ⏭ (deferred)

**Goal:** Live Mapbox map with quest pins, clustering, and Fog of War.

> **Status:** Deferred. The map tab (`app/(tabs)/map.tsx`) has been repurposed as the RC Leaderboard screen (Stage 9). The Mapbox map will be restored in a later polish pass.

### When implemented
1. Install `@rnmapbox/maps` and set `EXPO_PUBLIC_MAPBOX_TOKEN` in `.env`
2. Render active quests as `SymbolLayer` pins coloured by tag
3. Mapbox clustering for dense areas
4. Tap pin → QuestCard preview sheet → "View Quest"
5. GPS via `expo-location`; centre on user
6. Fog of War: dark `FillLayer` over UTown bounds; subtract 50m circles as user walks (Turf.js)

---

## Stage 6 — Quest Detail & Acceptance ✅

**Goal:** Full quest detail screen; users can accept quests, chat in real time, and cancel/drop out.

### Screen
- `app/quest/[id].tsx` (full rewrite)

### Implemented
- Parallel fetch: quest, poster profile, acceptor profile, messages, existing rating
- Real-time subscriptions on `quests` and `messages` (Supabase Realtime)
- Context-sensitive action area (8 states based on status × role × fulfilment mode)
- **Accept quest** — trust-tier eligibility check; updates local state immediately (no real-time lag)
- **Cancel quest** (poster) — sets status to `expired`
- **Drop out** (acceptor) — grace window check; inserts abandonment strike if past 30 min; sets status back to `open`
- **Chat UI** — right-aligned (me) / left-aligned (other); auto-scrolls on new messages
- Push notification to poster on accept; to other party on new message
- `router.canGoBack()` guard on all back navigation to prevent GO_BACK crashes

### Required Supabase SQL
```sql
-- Allows non-posters to accept open quests
CREATE POLICY "Users can accept open quests"
  ON quests FOR UPDATE TO authenticated
  USING (status = 'open' AND poster_id != auth.uid())
  WITH CHECK (acceptor_id = auth.uid() AND status = 'in_progress');
```

### Checkpoint
- Quest status updates to `in_progress` on accept; UI updates immediately.
- Both parties can chat in real time.
- Cancel and drop-out flows work correctly.

---

## Stage 7 — Quest Completion & Ratings ✅

**Goal:** Both fulfilment modes complete end-to-end; ratings, trust recalc, and strikes work.

### All within `app/quest/[id].tsx`

### Drop-Off flow
1. Acceptor taps "Submit Drop-Off Photo" → `launchImageLibraryAsync` → upload to `drop-off-photos` Supabase Storage bucket
2. Public URL stored in `quests.drop_off_photo_url`
3. Poster sees photo in real time → taps "Confirm Receipt" → quest → `completed`

### Meet-Up flow
- Poster taps "Mark Complete" → quest → `completed`

### Rating UI (both parties, after completion)
- 5-star row; submit → insert `ratings` row → recalculate `avg_rating` → increment `quests_completed` (acceptor) → call `update_trust_tier` RPC
- Payment reminder text shown after rating
- "Report Non-Payment" button (acceptor only) → inserts strike on poster

### Required: Supabase Storage
- Create `drop-off-photos` bucket (public: yes) with authenticated insert policy

### Checkpoint
- End-to-end: post → accept → complete (both modes) → rate → trust tier updates.
- Non-payment strike inserts correctly.

---

## Stage 8 — Push Notifications & Profile Screen ✅

**Goal:** Key push notification moments work; full profile screen with live stats.

### Push Notifications (`lib/notifications.ts`)
- `sendPushNotification(token, title, body)` — fetch-based, calls Expo push API
- Token registration in `app/_layout.tsx` via `require('expo-notifications')` (safe no-op if not installed)
- Notifies: quest accepted, drop-off photo submitted, quest completed, new chat message

### Installation required
```bash
npx expo install expo-notifications
# Add to app.json plugins: ["expo-notifications", { "icon": "..." }]
# Rebuild dev client: npx eas build --profile development
```

### Profile Screen (`app/(tabs)/profile.tsx`)
- Initials avatar, display name, RC, trust tier badge (tier colour), streak badge
- Stats row: Posts / Completed / Avg Rating — **re-fetched fresh on every tab focus** via `useFocusEffect` from `@react-navigation/native`
- Skills section: inline add + tap-to-remove chips, persisted to Supabase immediately
- Strikes warning banner
- Quest history tabs: Posted / In Progress / Completed (all fetched fresh on focus)

### Checkpoint
- Profile stats are always current after returning from a quest.
- Push notification received when quest accepted (requires dev build).

---

## Stage 9 — RC Leaderboard & Gamification ✅

**Goal:** RC leaderboard, quest streaks, and Flash Quest countdown live.

### Leaderboard (`app/(tabs)/map.tsx` — repurposed)
- Weekly leaderboard (Mon–Sun) aggregating completed quests by acceptor's RC
- Ranked list with medal emojis, quest count, progress bar, top contributor per RC
- Current user's RC highlighted; rank callout at top
- Fetches fresh on component mount

### Quest Streaks
- `updateStreak(userId)` helper in `app/quest/[id].tsx` — checks `last_active_date`; if yesterday → `streak_count + 1`, else reset to 1; no-ops if already updated today
- Called when poster rates the acceptor (alongside `quests_completed` increment)
- Streak badge (🔥 Nd streak) shown on profile header

### Flash Quest Countdown
- `QuestCard.tsx` uses `setInterval(1000)` to update a live `MM:SS` countdown for flash quests
- Timer cleans up on unmount

### Checkpoint
- Leaderboard shows correct RC rankings for the current week.
- Streak badge appears on profile after consecutive-day completions.
- Flash quest countdown ticks in the feed.

---

## Stage 10 — Auth Simplification & Schema Evolution ✅

**Goal:** Switch student verification to NUS email domain gating; add new DB tables and columns for social quests, crew mode, contacts, reports, notifications preferences, and the updated trust score algorithm.

### Auth changes
- Replace Student Pass photo upload with NUS email domain gating (`@u.nus.edu`)
- `app/(auth)/sign-up.tsx` — validate email ends with `@u.nus.edu`; remove matric number field (matric validation deferred to post-launch)
- `app/(auth)/verify.tsx` — remove photo upload step; simplify to profile creation only (or merge into sign-up)
- Remove dependency on `student-passes` Supabase Storage bucket

### Schema additions

**New columns on `quests`:**
- `quest_type` (`text`, default `'standard'`) — values: `'standard'`, `'social'`, `'crew'`
- `max_acceptors` (`integer`, default `1`) — for crew quests, how many people can accept
- `suggested_reward` (`numeric`) — AI-suggested price stored for display

**New columns on `profiles`:**
- `completion_rate` (`numeric`, default `1.0`) — fraction of accepted quests completed
- `avg_response_time` (`interval`) — average time between quest post and first response
- `notification_preferences` (`jsonb`, default `{}`) — per-category notification toggles + frequency

**New tables:**

```sql
-- Ripple Contacts (social graph)
CREATE TABLE contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  contact_id uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, contact_id)
);

-- Crew members (multi-acceptor quests)
CREATE TABLE crew_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quest_id uuid REFERENCES quests(id) NOT NULL,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  joined_at timestamptz DEFAULT now(),
  status text DEFAULT 'active', -- 'active', 'dropped_out'
  UNIQUE(quest_id, user_id)
);

-- Reports & disputes
CREATE TABLE reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES profiles(id) NOT NULL,
  reported_user_id uuid REFERENCES profiles(id),
  quest_id uuid REFERENCES quests(id),
  report_type text NOT NULL, -- 'inappropriate_content', 'harassment', 'dispute', 'other'
  description text,
  status text DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'dismissed'
  created_at timestamptz DEFAULT now()
);
```

**RLS policies** on all new tables. **Indexes** on `contacts(user_id)`, `crew_members(quest_id)`, `reports(status)`.

### Updated trust score algorithm

```sql
CREATE OR REPLACE FUNCTION update_trust_score(p_user_id uuid) RETURNS void AS $$
  -- Composite score from:
  --   completion_rate (weight 0.3)
  --   avg_rating (weight 0.4)
  --   response_time factor (weight 0.1)
  --   strike_penalty (weight 0.2) — each strike reduces score
  -- Trust tiers derived from composite score + quests_completed threshold:
  --   Wanderer: default (new user)
  --   Explorer: 5+ completed, composite >= 0.7
  --   Champion: 20+ completed, composite >= 0.85
$$ LANGUAGE plpgsql;
```

### Checkpoint
- Sign-up with `@u.nus.edu` email succeeds; non-NUS email rejected.
- All new tables exist and accept inserts.
- `update_trust_score` RPC callable.

---

## Stage 11 — Social Quests & Crew Mode ✅

**Goal:** Support social (no-payment) quests and crew (multi-acceptor) quests end-to-end.

### Social Quests
- `app/(tabs)/post-quest.tsx` — add quest type selector: Standard / Social / Crew
  - AI chat mode: `chat-quest` Edge Function updated to recognise social intent (e.g., "looking for a study buddy") and set `quest_type: 'social'`, `reward_amount: 0`
  - Manual mode: quest type toggle added to Step 1
- `components/QuestCard.tsx` — social quest badge; no reward display; show "Social" chip instead of "$0.00"
- `app/quest/[id].tsx` — social completion flow:
  - Either party can tap "Mark Complete" (not just poster)
  - No payment reminder shown after completion
  - Rating UI still shown

### Crew Mode
- `app/(tabs)/post-quest.tsx` — when quest type = Crew, show `max_acceptors` picker (2–5)
- `app/quest/[id].tsx` — crew acceptance flow:
  - Multiple users can accept until `max_acceptors` reached
  - Each acceptance inserts a `crew_members` row and sends notification to poster
  - Quest status stays `open` until all slots filled, then → `in_progress`
  - All crew members visible on quest detail screen
  - Chat includes all crew members + poster
- `components/QuestCard.tsx` — crew badge with slots indicator (e.g., "2/3 joined")
- Completion: poster marks complete for all crew members at once; all parties rate each other

### Study Group (subset of Social + Crew)
- A study group is simply a social quest with crew mode enabled (e.g., quest_type = `'social'`, max_acceptors = 3, tag = `'skills'`)
- No special code path — the combination of social + crew handles this naturally

### Checkpoint
- Can post a social quest; no payment prompt on completion.
- Can post a crew quest; multiple users accept; all appear in chat.
- Study group quest works as social + crew combination.

---

## Stage 12 — Enhanced Feed Filters ✅

**Goal:** Expand feed filtering to support new quest types and additional filter dimensions.

### New filters in `app/(tabs)/feed.tsx`
- **Quest type filter** — chips: All / Standard / Social / Crew
- **Reward range filter** — slider or preset chips: Any / Free / $1–5 / $5–10 / $10+
- **RC filter** — dropdown or chips to filter by poster's RC
- **Deadline filter** — chips: Any / Next Hour / Today / This Week

### Implementation
- Add filter state for each new dimension
- Apply filters client-side (same pattern as existing tag/mode filters)
- Filter bar scrolls horizontally if too wide for screen
- Persist filter selections during session (reset on app restart)
- Update empty state messages for each filter combination

### Checkpoint
- Can filter by quest type, reward range, RC, and deadline.
- Filters combine correctly (e.g., "Social quests in Tembusu this week").
- Empty states are contextual.

---

## Stage 13 — Enhanced In-App Chat ✅

**Goal:** Add photo sharing and location sharing to the in-app chat.

### Photo sharing
- Add camera/gallery button to chat input bar
- `launchImageLibraryAsync` or `launchCameraAsync` via `expo-image-picker`
- Upload photo to `chat-photos` Supabase Storage bucket (private, authenticated insert)
- Store message with `type: 'image'` and `image_url` in `messages` table
- Render image messages as tappable thumbnails in chat (full-screen preview on tap)

### Location sharing
- Add location pin button to chat input bar
- `getCurrentPositionAsync` via `expo-location`
- Store message with `type: 'location'` and `latitude`/`longitude` in `messages` table
- Render location messages as a tappable mini-map or address text
- Tapping opens system maps app with the shared coordinates

### Schema changes
- Add `type` column to `messages` (`text`, default `'text'`) — values: `'text'`, `'image'`, `'location'`
- Add `image_url` column (`text`, nullable)
- Add `latitude` / `longitude` columns (`numeric`, nullable)

### Required: Supabase Storage
- Create `chat-photos` bucket (private) with authenticated insert + select policies

### Checkpoint
- Can send and receive photos in chat.
- Can share current location; recipient can tap to open in maps.
- Regular text messages still work unchanged.

---

## Stage 14 — Ripple Contacts & Report System 🔲

**Goal:** Build the post-completion social graph and user/quest reporting.

### Ripple Contacts
- Post-completion prompt in `app/quest/[id].tsx`:
  - After both parties rate, show: "Add [display_name] as a Ripple contact?"
  - Accept → insert `contacts` row (bidirectional: insert for both user→other and other→user)
  - Dismiss → no action
- `app/(tabs)/feed.tsx` — contacts' quests appear first in feed (sort boost)
- `app/(tabs)/profile.tsx` — contacts count displayed; tappable to see contacts list

### Report System
- **Report button** on quest detail screen (`app/quest/[id].tsx`) and on other user's profile
- Report modal: select type (inappropriate content, harassment, dispute, other) + optional description
- Insert `reports` row
- **Dispute flow:** on completed quests, either party can tap "Raise Dispute" → inserts report with `report_type: 'dispute'`
- Settings screen (`app/(tabs)/settings.tsx`) — show "My Reports" section with status of submitted reports

### Checkpoint
- Post-completion contact prompt appears and works.
- Contacts' quests rank higher in feed.
- Can report a quest or user; report row appears in DB.
- Can raise a dispute on a completed quest.

---

---

## Stage 15 — AI Price Suggestion & Semantic Search 🔲

**Goal:** AI suggests fair pricing for quests; natural language search using pgvector.

### AI Price Suggestion
- New Edge Function: `supabase/functions/suggest-price/index.ts`
  - Input: `{ description, tag, fulfilment_mode }`
  - GPT-4o analyses description + considers category norms (food pickup ~$2–5, furniture help ~$10–20, etc.)
  - Returns: `{ suggested_price: number, reasoning: string }`
- Integration in `app/(tabs)/post-quest.tsx`:
  - AI chat mode: `chat-quest` updated to call suggest-price internally when user doesn't specify reward; includes suggestion in reply
  - Manual mode: after Step 1 (Details), if reward left blank, auto-fill with AI suggestion + "(AI suggested)" label; user can override
- Store `suggested_reward` on quest row for analytics

### AI Semantic Search
- `search_quests` RPC already in schema (cosine similarity on embeddings)
- New Edge Function: `supabase/functions/embed-query/index.ts`
  - Input: `{ query: string }`
  - Embeds via `text-embedding-3-small` → returns embedding vector
- Add semantic search toggle/bar to Feed screen (alongside existing keyword search)
- On submit: call `embed-query` → call `search_quests` RPC → render results sorted by similarity
- Debounce 300ms; fall back to keyword search if query too short (< 5 chars)

### Checkpoint
- Posting a quest without a price shows an AI-suggested price.
- Searching "need help moving furniture" returns physical help quests without exact keyword match.

---

## Stage 16 — AI Piggyback Matching & Configurable Notifications 🔲

**Goal:** Proactive push notifications using 3-step piggyback scoring; user-configurable notification preferences.

### AI Piggyback Matching
- New Edge Function: `supabase/functions/match-users/index.ts`
  - Triggered after quest insert (via Supabase webhook or called from `process-quest`)
  - **Step 1 — Geohash proximity filter:** fetch users with `push_token` whose last known geohash is within 2 adjacent cells of the quest's geohash
  - **Step 2 — Embedding similarity:** compute cosine similarity between quest embedding and each candidate's skill/history embedding; filter candidates below similarity threshold
  - **Step 3 — GPT-4o re-ranking micro-call:** send top 5 candidate-quest pairs to GPT-4o with contextual info (time of day, quest urgency, user's past completion patterns); GPT-4o re-ranks and returns confidence scores
  - Send Expo Push Notification to matches above final confidence threshold
  - Notification deep-links to `/quest/[id]`

### Location tracking for matching
- `app/_layout.tsx` — request background location permission; periodically update user's geohash in `profiles` table
- Use Expo's battery-optimised "balanced" accuracy mode
- Update frequency: every 5 minutes when app is active

### Configurable Push Notifications
- `app/(tabs)/settings.tsx` — notification preferences section:
  - Toggle categories: AI matches, quest accepted, quest completed, chat messages, flash quests
  - Frequency: Instant / Batched (hourly digest) / Off
- Store in `profiles.notification_preferences` (jsonb)
- `lib/notifications.ts` — check user's preferences before sending; respect category toggles
- `match-users` Edge Function — check recipient's notification preferences; skip users who have AI matches disabled

### Checkpoint
- Posting a food quest near The Deck pushes a notification to nearby users with food-related skill/history.
- User can disable AI match notifications in settings; no longer receives them.
- Notification preferences persist across sessions.

---

## Stage 17 — Polish & Deployment 🔲

**Goal:** Demo-ready app deployable via EAS Build.

### Steps
1. UI polish: loading skeletons, empty states, error toasts
2. Seed database with 15–20 realistic sample quests (mix of standard, social, crew); 4–5 demo accounts across different RCs with varying trust tiers
3. Confirm all `.env` keys are set (`SUPABASE_URL`, `SUPABASE_ANON_KEY`)
4. Test on physical iOS and Android device
5. `npx eas build --profile preview` for shareable build link
6. Configure `eas update` for OTA JS updates during demo day

### Checkpoint
- App runs without crashes on a physical device.
- All features accessible in live demo flow.
- EAS build link shareable with judges.

---

## Summary Table

| Stage | Focus | Key Deliverable | Status |
|-------|-------|-----------------|--------|
| 0 | Scaffold | Expo app boots, folder structure ready | ✅ |
| 1 | Supabase Schema | DB tables, RLS, RPCs configured | ✅ |
| 2 | Auth & Verification | Sign-up / login (email or display name) + student pass | ✅ |
| 3 | Quest Creation | AI chat creation + manual form fallback | ✅ |
| 4 | Quest Feed | Real-time scrollable feed with filters | ✅ |
| 5 | Map View | Mapbox map + Fog of War | ⏭ deferred |
| 6 | Acceptance & Chat | Accept quest, real-time in-app chat | ✅ |
| 7 | Completion & Ratings | End-to-end quest lifecycle, trust scores | ✅ |
| 8 | Notifications & Profile | Push notifications, full profile screen | ✅ |
| 9 | Leaderboard & Gamification | RC rankings, streaks, flash countdown | ✅ |
| 10 | Auth Simplification & Schema Evolution | NUS email gating, new tables (contacts, crew_members, reports), trust score algo | ✅ |
| 11 | Social Quests & Crew Mode | Social (no-payment) quests, crew (multi-acceptor) quests, study groups | ✅ |
| 12 | Enhanced Feed Filters | Quest type, reward range, RC, deadline filters | ✅ |
| 13 | Enhanced In-App Chat | Photo sharing, location sharing in chat | ✅ |
| 14 | Ripple Contacts & Report System | Post-completion social graph, report/dispute system | 🔲 |
| 15 | AI Price Suggestion & Semantic Search | GPT-4o price suggestions, pgvector natural language search | 🔲 |
| 16 | AI Piggyback Matching & Configurable Notifications | 3-step scoring (geohash + embedding + GPT-4o re-rank), notification preferences | 🔲 |
| 17 | Polish & Deploy | Demo-ready, EAS build, seeded data | 🔲 |

---

## Development Tips

- **Work mobile-first.** Test on a physical device from Stage 2 onwards.
- **Keep AI calls in Edge Functions.** Never expose `OPENAI_API_KEY` in the client bundle.
- **Stub before you ship.** If an AI feature isn't working, stub it so the rest of the flow isn't blocked.
- **Use Supabase Realtime sparingly.** Subscribe on mount; unsubscribe on unmount.
- **useFocusEffect pattern:** Always inline the async function — `useFocusEffect(useCallback(() => { async function load() {...} load(); }, [deps]))`.
- **geohash precision.** Use precision 6 (≈1.2km × 0.6km cells) for proximity queries.
- **NL quest creation is the primary path.** The manual form is the fallback. Optimise the AI mode UX first.
 