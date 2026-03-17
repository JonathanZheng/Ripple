# Ripple

**Small actions. Big community.**

A mobile-first peer request platform for NUS UTown residents. Post quests, accept quests, build community — one small act at a time.

---

## Stack

- **Frontend:** React Native (Expo SDK 55) + expo-router v5
- **Styling:** nativewind v4 (Tailwind CSS for RN)
- **Backend:** Supabase (Auth, PostgreSQL, Realtime, Storage, Edge Functions)
- **AI:** OpenAI GPT-4o (conversational quest creation, piggyback matching, price suggestion) + `text-embedding-3-small` (semantic search via pgvector)
- **Map:** Mapbox (deferred)

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- [Expo Go](https://expo.dev/go) on your iOS/Android device, or a simulator
- A [Supabase](https://supabase.com) account (free tier is fine)
- An [OpenAI](https://platform.openai.com) API key

---

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd Ripple
npm install
```

---

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. Go to **Database → Extensions** and enable the `vector` extension (required for semantic search).
3. Go to **SQL Editor**, paste the entire contents of `supabase/schema.sql`, and click **Run**. This creates all tables, indexes, RLS policies, and functions.
4. Go to **Authentication → Providers → Email** and **disable** "Confirm email" — the app uses NUS email domain gating (`@u.nus.edu`) instead of email confirmation.

---

### 3. Set up environment variables

Create a `.env` file in the project root (this file is gitignored — never commit it):

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
EXPO_PUBLIC_MAPBOX_TOKEN=          # leave blank — Mapbox is deferred
```

Find your Supabase URL and anon key at: **Dashboard → Project Settings → API**.

> The OpenAI API key is **not** needed in `.env` — it runs server-side only and is set as a Supabase secret in step 4.

---

### 4. Set up Supabase Storage and Realtime

In the **Supabase Dashboard**:

**Storage — create two public buckets:**
1. `drop-off-photos` — used for quest drop-off verification photos
2. `chat-photos` — used for photo sharing in quest chat

For each bucket: set **Public** to on, then add an **INSERT** policy for authenticated users.

**Realtime — enable for two tables:**

Go to **Database → Replication** and add `messages` and `quests` to the `supabase_realtime` publication. This powers the live chat and quest status updates.

---

### 5. Deploy the AI Edge Functions

Three Edge Functions power the AI features. Deploy all three:

```bash
# Log in to Supabase CLI (no global install needed)
npx supabase login

# Deploy all three functions
npx supabase functions deploy process-quest --project-ref <your-project-ref>
npx supabase functions deploy parse-quest --project-ref <your-project-ref> --no-verify-jwt
npx supabase functions deploy chat-quest --project-ref <your-project-ref> --no-verify-jwt
```

Then set the OpenAI API key as a Supabase secret — go to **Dashboard → Edge Functions → Secrets** and add:

```
OPENAI_API_KEY = <your-openai-key>
```

(The Supabase CLI `secrets set` command has a known issue with some project ref formats; the dashboard is the reliable fallback.)

---

### 6. Run the app

```bash
npm start
```

Scan the QR code with Expo Go, or press `i` for iOS simulator / `a` for Android emulator.

> If you see module resolution errors on first run, clear the Metro cache: `npm start -- --clear`

---

## Project Structure

```
app/                       # Routes (expo-router file-based routing)
  (auth)/                  # Welcome, sign-up, sign-in, verify screens
  (tabs)/                  # Feed, leaderboard, post-quest, profile tabs
  quest/[id].tsx           # Quest detail, chat, completion
assets/                    # Images, fonts, icons
docs/                      # Documentation
  PLAN.md                  # 18-stage build plan
  JON_CHANGES.md           # Changelog
src/                       # Shared source code
  components/              # Shared UI components (QuestCard, etc.)
  constants/               # RC names, tags, colours, trust tier config
  hooks/                   # useSession, useProfile
  lib/                     # supabase.ts client, geohash, notifications
  types/                   # TypeScript types for all DB tables
  global.css               # Tailwind/NativeWind base styles
supabase/                  # Backend
  schema.sql               # Full DB schema — run in Supabase SQL Editor
  functions/
    process-quest/         # Edge Function: GPT-4o tagging + embeddings
    parse-quest/           # Edge Function: NL prompt → structured quest fields
    chat-quest/            # Edge Function: multi-turn conversational quest creation
```

---

## What is NOT in this repo

The following are excluded by `.gitignore` and must be set up locally:

| Missing | How to get it |
|---------|---------------|
| `node_modules/` | `npm install` |
| `.env` | Create manually — see step 3 above |
| `.expo/` | Auto-generated on first `npm start` |
| `dist/` | Build output — generated by `npx expo export` |
| `android/` / `ios/` | Native builds — generated by `eas build` or `npx expo prebuild` |

---

## Build Progress

| Stage | Status | Description |
|-------|--------|-------------|
| 0 — Scaffold | ✅ | Expo app, folder structure, all dependencies |
| 1 — Supabase Schema | ✅ | DB tables, RLS, pgvector, Edge Function |
| 2 — Auth | ✅ | Sign-up, sign-in, NUS email domain gating |
| 3 — Quest Creation | ✅ | AI chat creation + manual form fallback |
| 4 — Quest Feed | ✅ | Real-time feed, filters, trust-tier gating |
| 5 — Map View | ⏭ | Deferred (Mapbox map + Fog of War) |
| 6 — Quest Detail & Chat | ✅ | Acceptance flow, real-time in-app chat |
| 7 — Completion & Ratings | ✅ | Drop-off photo, meet-up confirm, trust scores |
| 8 — Notifications & Profile | ✅ | Push notifications, full profile screen |
| 9 — Leaderboard & Gamification | ✅ | RC rankings, streaks, flash quests |
| 10 — Auth Simplification & Schema Evolution | ✅ | NUS email gating, new tables (contacts, crew_members, reports), composite trust score |
| 11 — Social Quests & Crew Mode | ✅ | Social (no-payment) quests, crew (multi-acceptor) quests, study groups |
| 12 — Enhanced Feed Filters | ✅ | Quest type, reward range, RC, deadline filters |
| 13 — Enhanced In-App Chat | ✅ | Photo sharing, location sharing in chat |
| 14 — Ripple Contacts & Report System | 🔲 | Post-completion social graph, report/dispute system |
| 15 — AI Price Suggestion & Semantic Search | 🔲 | GPT-4o price suggestions, pgvector natural language search |
| 16 — AI Piggyback Matching & Notifications | 🔲 | 3-step scoring (geohash + embedding + GPT-4o), configurable notification preferences |
| 17 — Polish & Deploy | 🔲 | Demo-ready, EAS build, seeded data |

---

## Residential Colleges

Ripple is built for NUS UTown's 7++ RCs: **Acacia, CAPT, NUSC, RC4, RVRC, Tembusu, UTR**
