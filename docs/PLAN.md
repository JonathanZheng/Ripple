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

The core loop: **Post a quest → AI structures and broadcasts it → a neighbour gets matched and notified → they complete it → payment and reputation flow.**

What makes Ripple different from a group chat or notice board:

- **AI-first quest creation** — don't fill out a form. Just type what you need in plain language. GPT-4o extracts the item, price, fulfilment mode, location, and deadline automatically via a conversational interface. The quest is live in seconds.
- **AI-powered matching and push notifications** — Ripple doesn't wait for someone to browse. If you're walking past The Deck and there's a food pickup quest 2 minutes from you, Ripple pings you.
- **Semantic search** — type what you want to help with in natural language and AI matches you to the most relevant quests, not just keyword hits.
- **Structured requests** with clear descriptions, deadlines, reward amounts, and fulfilment modes (drop-off vs meet-up).
- **A trust and reputation system** backed by NUS Student Pass verification.
- **Gamification and inter-RC mechanics** (leaderboards, streaks, flash quests).
- **A live Fog of War map** that turns quest browsing into an explorable, game-like experience.

---

## 3. How It Works — Full Pipeline

### Phase A: Account Setup & Quest Creation

1. **First-time setup: Student Pass Verification.** Every user must verify their identity by uploading their NUS Student Pass. This ensures every account is tied to a real, identifiable student.

2. **Resident opens Ripple** and taps "Post Quest."

3. **Primary input: conversational AI.** The resident sees a ChatGPT-style interface and types what they need in plain English.

4. **GPT-4o extracts structured fields** (title, description, fulfilment mode, deadline, reward, location, tag). If all required fields are present, it shows a **confirmation card**. If any field is missing, it asks a natural follow-up question.

5. The AI reply is **typed out character-by-character** for a polished, animated feel.

6. A **Manual mode** (3-step form) is available via a pill toggle at the top.

7. The quest description is **embedded** via OpenAI's `text-embedding-3-small` and stored in Supabase's `pgvector` for semantic search.

8. Quest goes **live** in the feed.

### Phase B: Quest Discovery & AI Matching

9. **AI Push Matching (proactive).** When a new quest is inserted, Ripple's matching engine combines real-time location, quest embeddings, skill profile, and contextual signals to push the right quest to the right person.

10. **Feed View** — A scrollable list of active quests, filterable by tag, fulfilment mode, and with keyword search.

11. **AI Semantic Search** — Natural language queries matched against quest embeddings via pgvector.

12. **RC Leaderboard** — Weekly rankings of which college has completed the most quests.

### Phase C: Quest Acceptance

13. A resident taps a quest and reviews the details. Trust-tier gating applies (Wanderers cannot accept food quests or rewards > $5).

14. They tap **"Accept Quest."** The quest is assigned. The poster receives a push notification.

15. An in-app **chat channel** opens between poster and acceptor.

### Phase D: Quest Completion

**Meet-Up:** Poster taps "Mark Complete" after the meetup. Both parties rate each other.

**Drop-Off:** Acceptor uploads a photo at the drop-off point. Poster confirms receipt. Both parties rate each other.

**Post-Completion:** Payment reminder shown. Trust tier recalculates. Streak increments.

### Phase E: Reputation Update

16. Ratings feed into `avg_rating`, `quests_completed`, and `trust_tier`.
17. Trust tiers: **Wanderer** (new) → **Explorer** (5+ completed, 4.0+ rating) → **Champion** (20+ completed, 4.5+ rating).

---

## 4. Key Features

### 4a. Fulfilment Modes

| Aspect | Meet-Up | Drop-Off |
|--------|---------|----------|
| Use case | Study buddy, furniture help, skill exchange | Food pickup, package collection, item lending |
| Verification | Poster taps "Mark Complete" | Acceptor submits photo; poster confirms |
| Poster presence | Required | Not required |

### 4b. AI Components

| Component | Technology | What It Does |
|-----------|-----------|--------------|
| Conversational Quest Creation | GPT-4o (`chat-quest` Edge Function) | Multi-turn chat: user describes quest, GPT-4o extracts structured fields and asks targeted follow-ups |
| Context-Aware Push Matching | GPT-4o + pgvector + geohash | Combines location, embeddings, skill profile to proactively notify the right person |
| Semantic Search | `text-embedding-3-small` + pgvector | Natural language search over quest embeddings |

### 4c. Gamification & Community

- **RC Leaderboards** — Which college completed the most quests this week?
- **Flash Quests** — 30-minute urgent requests with a live countdown timer.
- **Skill Profiles** — Declare your skills; Ripple surfaces relevant quests to you.
- **Quest Streaks** — Complete quests on consecutive days to earn a streak badge.
- **Fog of War Exploration** — Walk around UTown to reveal hidden quests.

### 4d. Trust & Safety

- **Student Pass verification** — every account tied to a real NUS student identity.
- Trust tiers gate access to high-value and food-related quests.
- **Strike system** with escalation: 2 strikes = posting suspended, 3 strikes = escalated to RC management.
- "Payment not received" button for acceptors after completion.
- Abandonment strike if acceptor drops out outside 30-min grace window.

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
| Notifications | Expo Push Notifications | Quest accepted, completed, new messages |
| Payments | Off-platform (PayNow / cash) | Settled privately |

---

## 6. Product Roadmap

| Phase | Deliverables |
|-------|-------------|
| **Hackathon Build** | AI chat quest creation, quest feed, acceptance + chat, drop-off + meetup completion, ratings + trust tiers, push notifications, profile screen, RC leaderboard, streaks, flash quests, semantic search, AI push matching |
| **Post-Launch v1** | Stripe Connect, native app store release, RC admin dashboard, analytics |
| **v2 Growth** | Expansion to other NUS residences, AI dispute resolution, Fog of War map |

---

## 7. Why This Wins

**The AI isn't a feature — it's the product.** Remove the AI and Ripple becomes a notice board. With it:

1. **Zero-friction quest creation.** Type what you need in plain English. The AI turns it into a structured, searchable quest in under 2 seconds.

2. **The supply finds the demand.** Ripple's AI matching engine proactively notifies the right person at the right moment — turning idle walks across campus into an always-on fulfilment network.

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

## Stage 10 — AI Semantic Search 🔲

**Goal:** Natural language quest search using pgvector.

### Steps
1. `search_quests` RPC already in schema (cosine similarity on embeddings)
2. Add semantic search bar to Feed screen (alongside existing keyword search)
3. On submit: call a new `embed-query` Edge Function → `text-embedding-3-small` → call `search_quests` RPC → render results sorted by similarity
4. Debounce 300ms; fall back to keyword search if query too short

### Checkpoint
- "need help moving furniture" returns physical help quests without exact keywords.

---

## Stage 11 — AI Push Matching 🔲

**Goal:** Proactive push notifications matching the right quest to the right user.

### Steps
1. After quest insert, invoke `match-users` Edge Function (triggered by Supabase webhook or `process-quest`)
2. Edge Function fetches active users with nearby geohash + `push_token`
3. For each candidate: compute relevance score (quest embedding vs user skill profile embeddings)
4. Send Expo Push Notification to top matches above confidence threshold
5. Notification deep-links to `/quest/[id]`

### Checkpoint
- Posting a food quest near The Deck pushes a notification to nearby users with food-related history.

---

## Stage 12 — Polish & Deployment 🔲

**Goal:** Demo-ready app deployable via EAS Build.

### Steps
1. UI polish: loading skeletons, empty states, error toasts
2. Seed database with 15–20 realistic sample quests; 4–5 demo accounts across different RCs
3. Confirm all `.env` keys are set (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MAPBOX_TOKEN`)
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
| 10 | Semantic Search | pgvector natural language search | 🔲 |
| 11 | AI Push Matching | Proactive quest-to-user notifications | 🔲 |
| 12 | Polish & Deploy | Demo-ready, EAS build, seeded data | 🔲 |

---

## Development Tips

- **Work mobile-first.** Test on a physical device from Stage 2 onwards.
- **Keep AI calls in Edge Functions.** Never expose `OPENAI_API_KEY` in the client bundle.
- **Stub before you ship.** If an AI feature isn't working, stub it so the rest of the flow isn't blocked.
- **Use Supabase Realtime sparingly.** Subscribe on mount; unsubscribe on unmount.
- **useFocusEffect pattern:** Always inline the async function — `useFocusEffect(useCallback(() => { async function load() {...} load(); }, [deps]))`.
- **geohash precision.** Use precision 6 (≈1.2km × 0.6km cells) for proximity queries.
- **NL quest creation is the primary path.** The manual form is the fallback. Optimise the AI mode UX first.
