# Ripple

**Small actions. Big community. Every ripple matters.**

A mobile-first peer request platform for NUS UTown residents. Post quests, accept quests, build community — one small act at a time. Check out our vid demo [here](https://youtu.be/RGKiG1W3VHE) or you can [try out the web demo yourself](https://jonathanzheng.github.io/Ripple/)!



---

## Stack

- **Frontend:** React Native (Expo SDK 55) + expo-router v5
- **Styling:** nativewind v4 (Tailwind CSS for RN)
- **Backend:** Supabase (Auth, PostgreSQL, Realtime, Storage, Edge Functions)
- **AI:** OpenAI GPT-4o (conversational quest creation, auto-tagging) + text-embedding-3-small (semantic search via pgvector)
- **Map:** react-native-maps (native) + pigeon-maps (web)

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- [Expo Go](https://expo.dev/go) on your iOS/Android device, or a simulator
- A [Supabase](https://supabase.com) account (free tier is fine)
- An [OpenAI](https://platform.openai.com) API key
- A [Google Maps](https://console.cloud.google.com) API key (for Android native map)

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
GOOGLE_MAPS_API_KEY=<your-google-maps-api-key>
```

Find your Supabase URL and anon key at: **Dashboard → Project Settings → API**.

For the Google Maps key: create a project in [Google Cloud Console](https://console.cloud.google.com), enable the **Maps SDK for Android**, and generate an API key under **APIs & Services → Credentials**. The key is embedded into the Android native build via `app.config.js` — it is only needed for Android native builds (EAS or local prebuild), not for `npm start` web dev.

> The OpenAI API key is **not** needed in `.env` — it runs server-side only and is set as a Supabase secret in step 5.

---

### 4. Set up Supabase Storage and Realtime

In the **Supabase Dashboard**:

**Storage — create two public buckets:**
1. `drop-off-photos` — used for quest drop-off verification photos
2. `chat-photos` — used for photo sharing in quest chat

For each bucket: set **Public** to on, then add an **INSERT** policy for authenticated users.

**Realtime — enable for four tables:**

Go to **Database → Replication** and add `messages`, `quests`, `direct_messages`, and `route_offers` to the `supabase_realtime` publication. This powers the live chat, quest status updates, 1:1 DMs, and route-offer presence updates.

---

### 5. Deploy the AI Edge Functions

Five Edge Functions power the AI and notification features. Deploy all five:

```bash
# Log in to Supabase CLI (no global install needed)
npx supabase login

# Deploy all five functions
npx supabase functions deploy process-quest --project-ref <your-project-ref>
npx supabase functions deploy parse-quest --project-ref <your-project-ref> --no-verify-jwt
npx supabase functions deploy chat-quest --project-ref <your-project-ref> --no-verify-jwt
npx supabase functions deploy embed-query --project-ref <your-project-ref> --no-verify-jwt
npx supabase functions deploy notify-route-offers --project-ref <your-project-ref>
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

Scan the QR code with Expo Go, or press `i` for iOS simulator / `a` for Android emulator. (Press `w` for the demo)

> If you see module resolution errors on first run, clear the Metro cache: `npm start -- --clear`

---

## Project Structure

```
app/                       # Routes (expo-router file-based routing)
  (auth)/                  # Welcome, sign-up, sign-in, verify screens
  (tabs)/                  # Map, feed, post-quest, profile, rank, settings tabs
  quest/[id].tsx           # Quest detail, chat, completion
  route-offer-confirm.tsx  # "Going Out?" broadcast screen
  dm/[userId].tsx          # 1:1 direct message screen
  contacts-graph.tsx       # 3D/2D orbital contacts graph screen
  my-reports.tsx           # User's submitted reports
assets/                    # Images, fonts, icons
docs/                      # Documentation
  PLAN.md                  # Build plan
  JON_CHANGES.md           # Changelog
  VINCENT_CHANGES.md       # Changelog
src/                       # Shared source code
  components/              # Shared UI components
    QuestCard.tsx          # Quest card
    RouteOfferBanner.tsx   # Active broadcast banner in feed
    RouteOfferCard.tsx     # Scout card in Scouts feed tab
    ReportModal.tsx        # Report type picker modal
    map/                   # MapEngine (native + web), MobileBottomSheet, QuestAccordion
    three/                 # ContactsScene (native + web) — orbital contacts graph
    ui/                    # Generic UI primitives (Button, Chip, Input, Badge, …)
  constants/               # RC names, tags, colours, trust tier config, NUS locations
  hooks/                   # useSession, useProfile, useRouteOffer, useContacts
  lib/                     # supabase.ts, geohash, notifications, ranking, ThemeContext
  types/                   # TypeScript types for all DB tables
  global.css               # Tailwind/NativeWind base styles
supabase/                  # Backend
  schema.sql               # Full DB schema — run in Supabase SQL Editor
  functions/
    process-quest/         # Edge Function: GPT-4o auto-tagging + embeddings
    parse-quest/           # Edge Function: NL prompt → structured quest fields
    chat-quest/            # Edge Function: multi-turn conversational quest creation
    embed-query/           # Edge Function: text-embedding-3-small for semantic search
    notify-route-offers/   # Edge Function: push notifications to nearby scouts
```

---

## What is NOT in this repo

The following are excluded by `.gitignore` and must be set up locally:

| Missing | How to get it |
|---------|---------------|
| `node_modules/` | `npm install` |
| `.env` | Create manually — see step 3 above (Supabase keys + Google Maps API key) |
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
| 5 — Map View | ✅ | NUS location markers with quest counts, quest panel |
| 6 — Quest Detail & Chat | ✅ | Acceptance flow, real-time in-app chat |
| 7 — Completion & Ratings | ✅ | Drop-off photo, meet-up confirm, trust scores |
| 8 — Notifications & Profile | ✅ | Push notifications, full profile screen |
| 9 — Leaderboard & Gamification | ✅ | RC rankings, streaks, flash quests |
| 10 — Route Offers | ✅ | "Going Out?" broadcasts, Broadcast feed tab, 1:1 DMs, nearby quest notifications |
| 14 — Contacts & Reports | ✅ | Contacts graph, report system, flag icon on quests |
| 15 — Price Suggestion & Semantic Search | ✅ | Per-tag price hints, pgvector semantic feed search |
| 16 — Notification Preferences | ✅ | Per-category push notification toggles in settings |

---

## Residential Colleges

Ripple is built for NUS UTown's 7++ RCs: **Acacia, CAPT, NUSC, RC4, RVRC, Tembusu, UTR**
 
