# Ripple — Build Plan

**Small actions. Big community.**
**Stack:** React Native (Expo) · Supabase · Mapbox · OpenAI GPT-4o · pgvector · NativeWind v4

Each stage produces a working, testable checkpoint. Complete and verify each stage before moving on.

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
- `profiles` — extends auth.users; includes trust_tier, skills, streak_count, push_token
- `quests` — title, description, tag, fulfilment_mode, reward_amount, deadline, geohash, status, is_flash, embedding (vector 1536)
- `ratings`, `strikes`, `messages`

### Key additions
- `pgvector` extension for semantic search
- `search_quests` RPC (cosine similarity)
- `update_trust_tier` function
- RLS policies on all tables
- Geohash index for proximity queries

### Checkpoint
- Can insert and select a test quest row.

---

## Stage 2 — Auth Flow ✅

**Goal:** Sign-up, sign-in, and student pass verification fully wired to Supabase Auth.

### Screens
- `app/(auth)/index.tsx` — welcome/landing
- `app/(auth)/sign-up.tsx` — email, password, display name, RC, matric number
- `app/(auth)/verify.tsx` — student pass photo upload (mock verification)
- `app/(auth)/sign-in.tsx` — returning user login

### Auth flow
```
Sign-up → supabase.auth.signUp (metadata) → Verify screen
  → profiles.insert (creates row) → Feed
Sign-in → supabase.auth.signInWithPassword → Feed
Cold start → useSession → Feed (if session) or Auth (if not)
```

### Note
Supabase email confirmation must be disabled in Dashboard → Authentication → Providers → Email.

### Checkpoint
- New user can sign up, upload photo, land on feed.
- Refresh keeps user logged in.
- Unauthenticated users redirected to auth.

---

## Stage 3 — Quest Creation ✅

**Goal:** Two-path quest creation — AI natural language (primary) and manual form (fallback).

### Screens
- `app/(tabs)/post-quest.tsx` — mode toggle at top

### Path A: AI Mode (primary)
1. User types free-text: *"need someone to grab chicken rice from The Deck, $3, drop at Tembusu 7-12 by 1pm"*
2. App calls `parse-quest` Edge Function → GPT-4o function calling extracts:
   - title, description, tag, fulfilment_mode, reward_amount, deadline_label, location_name
3. User sees a **review/edit form** pre-filled with parsed fields — all editable
4. User taps "Post Quest" → inserts to Supabase, fires `process-quest` (embedding) fire-and-forget

### Path B: Manual Mode (fallback)
3-step form: Details (title, description, category, mode) → Location → Reward & Deadline

### Edge Functions
- `supabase/functions/parse-quest/index.ts` — NL parsing via GPT-4o function calling
- `supabase/functions/process-quest/index.ts` — auto-tagging + embedding (fires after insert)

### Checkpoint
- Posting via AI mode pre-fills all fields from a natural language prompt.
- Posting via manual mode works as before.
- Quest row appears in Supabase with tag + embedding populated.

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
- Expired quest filtering (client-side)

### Components
- `components/QuestCard.tsx` — tag badge, title (AI or raw), reward, countdown, mode, flash badge, ineligibility notice
- `hooks/useProfile.ts` — fetches current user's profile

### Checkpoint
- Feed shows real quests.
- New quest appears in real time after posting.
- Filter chips correctly filter the list.

---

## Stage 5 — Map View

**Goal:** Live Mapbox map with quest pins, clustering, Fog of War, and fulfilment mode indicators.

### Screen
- `app/(tabs)/map.tsx`

### Steps
1. Initialise `@rnmapbox/maps` with Mapbox public token from `.env`.
2. Load active quests and render as `SymbolLayer` pins, coloured by tag.
3. Enable Mapbox clustering: quests collapse into count bubble when zoomed out.
4. Tap pin → bottom sheet with QuestCard preview and "View Quest" button.
5. Request GPS via `expo-location`; centre map on user.
6. **Fog of War:**
   - Dark `FillLayer` polygon covers UTown bounds.
   - `expo-location` watch position; subtract 50m-radius circles using Turf.js `difference`.
   - On entering new fog cell, check for hidden quests and show discovery toast.
   - Fog of War is opt-in (battery consideration).

### Checkpoint
- Map renders with quest pins at correct positions.
- Clustering works.
- Fog of War clears as user walks.

---

## Stage 6 — Quest Detail & Acceptance

**Goal:** Full quest detail screen; users can accept quests and chat.

### Screen
- `app/quest/[id].tsx`

### Steps
1. Fetch full quest + poster profile (display name, RC, trust score, strikes).
2. Show all quest fields, including mini-map for location.
3. Trust-tier gate on Accept button (food quests blocked for Wanderers).
4. Accept → update quest to `in_progress`, set `acceptor_id`.
5. Real-time chat via `supabase.channel('messages:quest_id')`.
6. Cancel within 30-min grace window (no strike); warning shown after.

### Checkpoint
- Quest status updates to `in_progress` on accept.
- Both parties can chat in real time.

---

## Stage 7 — Quest Completion & Ratings

**Goal:** Both fulfilment modes flow end-to-end; ratings and trust score updates work.

### Drop-Off flow
1. Acceptor taps "Submit Drop-Off Photo" → `expo-image-picker` → upload to Supabase Storage.
2. Photo URL stored in `quests.drop_off_photo_url`.
3. Poster receives real-time update → taps "Confirm Receipt" → quest → `completed`.

### Meet-Up flow
1. Poster taps "Mark Complete" → quest → `completed`.

### Post-completion (both modes)
- Both parties see rating prompt (1–5 stars).
- Recalculate `avg_rating`, `quests_completed`, `trust_tier`.
- App shows "Payment reminder" screen.

### Strike system
- "Payment not received" → strike on poster.
- Expired `in_progress` quest (no completion) → abandonment strike on acceptor via Supabase cron Edge Function.

### Checkpoint
- End-to-end: post → accept → complete (both modes) → rate → trust score updates.

---

## Stage 8 — Push Notifications & Profile Screen

**Goal:** Key notification moments work; full profile screen.

### Push Notifications
- Register Expo push token on launch; store in `profiles.push_token`.
- Notify poster: quest accepted, drop-off photo submitted, quest completed.
- Notify both: new message in chat.

### Profile Screen (`app/(tabs)/profile.tsx`)
- Avatar, display name, RC, trust tier badge, trust score, streak count.
- Stats: quests posted, quests completed, avg rating.
- Skill tags (editable inline).
- Strike count (warning if > 0).
- Quest history: Posted / Completed / In Progress tabs.

### Checkpoint
- Push notification received on poster's device when quest accepted.
- Profile screen shows accurate live stats.

---

## Stage 9 — RC Leaderboard & Gamification

**Goal:** RC leaderboard, quest streaks, and Flash Quests live.

### Leaderboard
- Aggregate completed quests by RC for current week.
- Ranked list with quest count and top contributor.

### Quest Streaks
- On completion: check `last_active_date`. If yesterday → increment `streak_count`. Else reset to 1.
- Display streak on profile and quest cards.

### Flash Quests
- `is_flash` boolean + `flash_expires_at` (30 min after posting).
- Countdown timer on flash quest cards.
- "Post Flash Quest" shortcut button on post screen.

### Checkpoint
- Leaderboard shows correct RC rankings.
- Streak increments on consecutive-day completions.
- Flash quest countdown visible.

---

## Stage 10 — AI Semantic Search

**Goal:** Natural language quest search using pgvector.

### Steps
1. `search_quests` RPC already in schema (cosine similarity on embeddings).
2. Search bar in Feed screen.
3. On submit: embed query via `text-embedding-3-small` Edge Function → call RPC → render results sorted by similarity.
4. Debounce 300ms.

### Checkpoint
- "need help moving furniture" returns physical help quests without exact keywords.

---

## Stage 11 — AI Push Matching

**Goal:** Proactive push notifications matching the right quest to the right user.

### Steps
1. When a new quest is inserted, invoke a `match-users` Edge Function.
2. Edge Function fetches active users with nearby geohash + `push_token`.
3. For each candidate: compute relevance score using GPT-4o (quest embedding vs user skill profile + quest history embeddings).
4. Send Expo Push Notification to top matches above confidence threshold.
5. Notification deep-links to quest detail screen.

### Checkpoint
- Posting a food quest near The Deck pushes a notification to nearby users with food-related history.

---

## Stage 12 — Polish & Deployment

**Goal:** Demo-ready app deployable via Expo Go / EAS Build.

### Steps
1. UI Polish: loading skeletons, empty states, error handling.
2. Seed database with 15–20 realistic sample quests; 4–5 demo accounts.
3. Confirm all `.env` keys are set.
4. Test on physical iOS and Android device via Expo Go.
5. EAS Build for standalone APK/IPA.
6. Configure `eas update` for OTA JS updates during demo day.

### Checkpoint
- App runs without crashes on a physical device.
- All features accessible in live demo flow.
- EAS build link shareable with judges.

---

## Summary Table

| Stage | Focus | Key Deliverable | Status |
|-------|-------|-----------------|--------|
| 0 | Scaffold | Expo app boots, folder structure ready | ✅ |
| 1 | Supabase Schema | DB tables, RLS, Auth configured | ✅ |
| 2 | Auth & Verification | Sign-up / login with student pass gate | ✅ |
| 3 | Quest Creation | NL quest creation (AI) + manual form fallback | ✅ |
| 4 | Quest Feed | Real-time scrollable feed with filters | ✅ |
| 5 | Map View | Mapbox map with clustering + Fog of War | 🔲 |
| 6 | Acceptance & Chat | Accept quest, real-time in-app chat | 🔲 |
| 7 | Completion & Ratings | End-to-end quest lifecycle, trust scores | 🔲 |
| 8 | Notifications & Profile | Push notifications, full profile screen | 🔲 |
| 9 | Leaderboard & Gamification | RC rankings, streaks, flash quests | 🔲 |
| 10 | Semantic Search | pgvector natural language search | 🔲 |
| 11 | AI Push Matching | Proactive quest-to-user push notifications | 🔲 |
| 12 | Polish & Deploy | Demo-ready, EAS build, seeded data | 🔲 |

---

## Development Tips

- **Work mobile-first.** Test on a physical device from Stage 2 onwards.
- **Keep AI calls in Edge Functions.** Never expose `OPENAI_API_KEY` in the client bundle.
- **Stub before you ship.** If an AI feature isn't working, stub it so the rest of the flow isn't blocked.
- **Use Supabase Realtime sparingly.** Subscribe on mount; unsubscribe on unmount.
- **geohash precision.** Use precision 6 (≈1.2km × 0.6km cells) for proximity queries.
- **NL quest creation is the primary path.** The manual form is the fallback. Optimise the AI mode UX first.
