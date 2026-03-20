DO NOT EDIT IF YOU ARE NOT JONATHAN!!!

---

# Ripple — Change Log (Stages 0–10 + Session Improvements)

---

## Stage 0 — Project Scaffold

**Goal:** Runnable Expo app with correct folder structure and all dependencies installed.

### Files created
| File | Purpose |
|------|---------|
| `package.json` | Full dependency list: expo-router, supabase-js, nativewind v4, openai, reanimated, gesture-handler, date-fns, ngeohash, etc. |
| `app.json` | Expo config — name "Ripple", slug, scheme, dark theme splash, plugin registrations for expo-router/location/camera/image-picker |
| `tsconfig.json` | Strict TypeScript, `@/*` path alias, excludes `supabase/functions` (Deno files) |
| `babel.config.js` | nativewind v4 setup via `jsxImportSource: 'nativewind'` in babel-preset-expo; reanimated plugin |
| `metro.config.js` | `withNativeWind` wrapper pointing at `global.css` |
| `tailwind.config.js` | Brand colour palette: `background`, `surface`, `surface-2`, `accent`, tag colours (food/transport/social/skills/errands), trust tier colours |
| `global.css` | Tailwind `@tailwind base/components/utilities` directives |
| `.env` | Placeholder for `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_MAPBOX_TOKEN`, `OPENAI_API_KEY` |
| `.gitignore` | Replaced Python-only gitignore with proper Expo/Node.js rules (node_modules, .expo, dist, .env, android/, ios/, etc.) |
| `assets/` | Copied default Expo icon/splash assets from blank-typescript template |
| `app/_layout.tsx` | Root layout — imports global.css, renders `<Slot>` |
| `app/index.tsx` | Root index — redirects to `/(auth)` |
| `app/(auth)/_layout.tsx` | Auth stack layout (headerShown: false) |
| `app/(auth)/index.tsx` | Welcome/landing screen with Get Started + Sign In buttons |
| `app/(auth)/sign-in.tsx` | Sign-in form (placeholder auth logic) |
| `app/(auth)/sign-up.tsx` | Sign-up form with RC selector (placeholder auth logic) |
| `app/(auth)/verify.tsx` | Student pass photo upload (placeholder verify logic) |
| `app/(tabs)/_layout.tsx` | Tab navigator — Map, Feed, Post, Profile |
| `app/(tabs)/feed.tsx` | Placeholder feed screen |
| `app/(tabs)/map.tsx` | Placeholder map screen |
| `app/(tabs)/post-quest.tsx` | Placeholder post screen |
| `app/(tabs)/profile.tsx` | Placeholder profile screen |
| `app/quest/[id].tsx` | Placeholder quest detail screen |
| `constants/index.ts` | RC names, quest tags, tag colours, trust tier config, strike thresholds, MATRIC_REGEX |
| `hooks/useSession.ts` | Supabase auth session hook |
| `types/database.ts` | Hand-authored TypeScript types for all DB tables |

### Key decisions
- Entry point is `expo-router/entry` (file-based routing), not `index.ts`
- nativewind v4 does NOT use `nativewind/babel` plugin (that's v2) — uses `jsxImportSource` instead
- `babel-preset-expo` goes in `devDependencies`

---

## Stage 1 — Supabase Schema

**Goal:** Full database schema live in Supabase; typed client configured.

### Files created
| File | Purpose |
|------|---------|
| `supabase/schema.sql` | Complete schema to run in Supabase SQL Editor |
| `lib/supabase.ts` | Supabase client singleton with AsyncStorage session persistence |
| `supabase/functions/process-quest/index.ts` | Edge Function: GPT-4o auto-tagging + adventure title + `text-embedding-3-small` embedding |

### Schema contents (`supabase/schema.sql`)
- `create extension if not exists vector` — enables pgvector
- **Tables:** `profiles`, `quests`, `ratings`, `strikes`, `messages`
- **Indexes:** geohash (proximity), status (feed queries), ivfflat vector cosine (semantic search), messages by quest
- **RLS policies** on all 5 tables
- **`search_quests` RPC** — pgvector cosine similarity search over open quest embeddings
- **`update_trust_tier` function** — recalculates wanderer/explorer/champion based on quests_completed + avg_rating

### Manual steps required
1. Supabase Dashboard → Extensions → enable `vector`
2. Paste `supabase/schema.sql` into SQL Editor and run
3. `npx supabase functions deploy process-quest --project-ref <ref>`
4. Set `OPENAI_API_KEY` secret in Supabase Dashboard → Edge Functions → Secrets

---

## Stage 2 — Auth Flow

**Goal:** Sign-up, sign-in, and student pass verification fully wired to Supabase Auth.

### Files modified
| File | Change |
|------|--------|
| `app/index.tsx` | Added `useSession` hook — redirects to `/(tabs)/feed` if session exists, `/(auth)` if not; shows loading spinner while session resolves |
| `app/(auth)/sign-up.tsx` | Wired to `supabase.auth.signUp()` with email/password; stores `display_name`, `matric_number`, `rc` in `user_metadata`; validates matric number format via `MATRIC_REGEX`; navigates to verify on success |
| `app/(auth)/sign-in.tsx` | Wired to `supabase.auth.signInWithPassword()`; navigates to feed on success |
| `app/(auth)/verify.tsx` | Reads `user.user_metadata` from session; inserts `profiles` row in Supabase; mock verification (any photo upload accepted); navigates to feed |
| `app/(tabs)/_layout.tsx` | Added session guard — redirects to `/(auth)` if no session |

### Auth flow
```
Sign-up form → supabase.auth.signUp (stores metadata) → Verify screen
  → supabase.from('profiles').insert (creates profile row) → Feed
Sign-in form → supabase.auth.signInWithPassword → Feed
Cold start → useSession → Feed (if session) or Auth (if not)
```

### Note
Supabase email confirmation must be **disabled** in Dashboard → Authentication → Providers → Email for this flow to work without an email confirmation step.

---

## Stage 3 — Quest Creation

**Goal:** Multi-step quest form with GPT-4o AI processing on submit.

### Files created
| File | Purpose |
|------|---------|
| `lib/geohash.ts` | Wraps `ngeohash.encode` at precision 6 (≈1.2km × 0.6km cells) |

### Files modified
| File | Change |
|------|--------|
| `app/(tabs)/post-quest.tsx` | Full 3-step form replacing placeholder |

### Post-quest form — 3 steps + AI Review

**Step 1 — Details**
- Quest title (free text, required)
- Description (min 20 chars, required)
- Optional tag pre-selection (AI will auto-tag regardless)
- Fulfilment mode toggle: Meet Up 🤝 / Drop Off 📬

**Step 2 — Location**
- Free-text location input
- Quick-select chips for all RCs + common UTown venues (The Deck, Frontier, Fine Food, etc.)

**Step 3 — Reward & Deadline**
- Optional SGD cash reward (payment note: PayNow/cash only, no in-app payment)
- Deadline quick-picks: 1 hour / 3 hours / Tonight 10 PM / Tomorrow noon
- Flash Quest checkbox (overrides deadline to 30 minutes)

**On submit**
1. Inserts quest row to Supabase with status `open`, computes geohash
2. Invokes `process-quest` Edge Function → GPT-4o returns tag, ai_generated_title, suggested price range
3. Shows **AI Review screen** with the generated adventure title and suggested reward range
4. User taps "View in Feed" → navigates to feed

---

## Stage 4 — Quest Feed

**Goal:** Real-time scrollable feed with filtering, trust-tier gating, and pull-to-refresh.

### Files created
| File | Purpose |
|------|---------|
| `components/QuestCard.tsx` | Quest card component |
| `hooks/useProfile.ts` | Fetches current user's profile from Supabase |

### Files modified
| File | Change |
|------|--------|
| `app/(tabs)/feed.tsx` | Full feed screen replacing placeholder |

### QuestCard (`components/QuestCard.tsx`)
- Tag badge with category colour + emoji
- AI-generated adventure title (falls back to raw title if AI not yet processed)
- Reward display (`$X.XX` or `Favour` for zero-reward quests)
- Countdown: `formatDistanceToNow` from `date-fns`
- Fulfilment mode chip + location
- Flash Quest badge
- Trust-tier lock badge for ineligible quests (greyed out at 50% opacity with explanation)

### Trust-tier gating logic
- Wanderers cannot accept food quests (food safety)
- Wanderers cannot accept quests with reward > $5

### Feed screen (`app/(tabs)/feed.tsx`)
- **Real-time:** Supabase `postgres_changes` INSERT subscription pushes new quests to top of list instantly
- **Filters:** tag chips (All + 5 categories), fulfilment mode toggle (Any / Meet Up / Drop Off)
- **Search:** client-side keyword filter across title + description + ai_generated_title
- **Pull-to-refresh:** RefreshControl re-fetches from Supabase
- **Empty state:** contextual message (no quests vs no filter matches)
- **Safe area:** `useSafeAreaInsets` for correct top padding

---

## Post-Stage 4 Fixes & Improvements

**Goal:** Fix bugs discovered during testing, remove AI story step, remove all emojis, add Settings screen.

### Files modified
| File | Change |
|------|--------|
| `app/(tabs)/feed.tsx` | Added `useFocusEffect` to re-fetch on focus; removed all emojis |
| `app/(tabs)/post-quest.tsx` | Fixed deadline selection bug; removed AI Review step; removed emojis |
| `app/(tabs)/_layout.tsx` | Added Settings tab; removed emoji tab icons (`tabBarShowIcon: false`) |
| `components/QuestCard.tsx` | Removed all emojis from badges, mode labels, location, tag chips |
| `constants/index.ts` | Removed `emoji` fields from `TRUST_TIER_CONFIG` entries |
| `app/_layout.tsx` | Removed non-existent `StyleSheet.setFlag('darkMode', 'class')` call from `react-native-css-interop` (caused runtime crash — `setFlag` doesn't exist in v0.2.2; `darkMode: 'class'` in `tailwind.config.js` is the correct mechanism) |

### Files created
| File | Purpose |
|------|---------|
| `app/(tabs)/settings.tsx` | Settings screen — shows email + trust tier, Sign Out button |

### Bug: Posted quests not visible in feed
**Root cause:** Feed fetched quests once on mount (`useEffect`). If the feed tab was already mounted before a quest was posted, navigating back to it did not re-fetch. Real-time subscription only catches INSERTs while the subscription is active — unreliable if the tab hadn't been opened yet.

**Fix:** Replaced the mount-only fetch with `useFocusEffect` so `fetchQuests()` runs every time the feed tab comes into focus. Real-time subscription kept in a separate `useEffect` for live updates within a session.

### Bug: "1 hour" and "3 hours" deadline options visually unselectable
**Root cause:** `DEADLINE_OPTIONS` was defined inside the render function. For relative options, `isoVal` was computed as `new Date(Date.now() + hours * 3600_000).toISOString()` — a fresh timestamp on every render. After tapping "1 hour": `setDeadline(isoVal_t0)` was called, React re-rendered, `isoVal_t1` was computed (slightly later), and `deadline === isoVal_t1` evaluated to `false` immediately — so the button never appeared selected. "Tonight" and "Tomorrow noon" worked because their Date objects were stable across re-renders.

**Fix:** Changed `deadline` state from storing an ISO string to storing the option label (`'1 hour'`, `'3 hours'`, `'Tonight (10 PM)'`, `'Tomorrow noon'`). Comparison is `deadlineLabel === opt.label` (always stable). ISO string is computed from the label only at submit time via `buildDeadlineFromLabel()`.

### Removed: AI story / Review step
The `process-quest` Edge Function invocation was awaited, making form submission slow. The Review step (showing GPT-4o generated adventure title + suggested reward) was removed. The edge function is now fired as fire-and-forget (no `await`) so tagging and embedding still happen in the background. User navigates straight to the feed after posting.

### Removed: All emojis
Stripped emoji characters from all UI files. Tag categories, fulfilment mode labels, flash/lock badges, location prefixes, tab icons, trust tier config, and empty states are all now plain text.

### Added: Settings screen (`app/(tabs)/settings.tsx`)
Basic settings page accessible as the 5th tab:
- Displays signed-in email and current trust tier (coloured by tier)
- Sign Out button calls `supabase.auth.signOut()` and redirects to `/(auth)`

---

## Bug Fixes (across all stages)

| Bug | File(s) | Fix |
|-----|---------|-----|
| `SafeAreaProvider` missing — content overlapped iOS status bar | `app/_layout.tsx` | Wrapped `<Slot>` in `<SafeAreaProvider>` |
| Expired quests returned `null` from `QuestCard`, leaving blank gaps in FlatList | `app/(tabs)/feed.tsx` | Filter expired + flash-expired quests in feed before passing to `renderItem` |
| Duplicate profile insert used fragile `includes('duplicate')` string match | `app/(auth)/verify.tsx` | Changed to Postgres error code check: `insertError.code !== '23505'` |
| Sign-in "Sign up" link used `router.back()` — could navigate to wrong screen | `app/(auth)/sign-in.tsx` | Changed to `router.push('/(auth)/sign-up')` |
| `fetchQuests` silently ignored Supabase errors | `app/(tabs)/feed.tsx` | Added `error` check before setting state |
| `useSession` had no error handling on `getSession()` failure | `hooks/useSession.ts` | Added error check in `.then()` callback |
| `useProfile` had no error handling or error state | `hooks/useProfile.ts` | Added `error` state, check before setting profile |
| Edge Function crashed entirely on OpenAI API failure | `supabase/functions/process-quest/index.ts` | Wrapped GPT-4o call and embedding call each in separate try-catch; AI failure is non-fatal (quest is still created with defaults) |
| Supabase `createClient<Database>` with v2.99 caused all Insert types to resolve to `never` | `lib/supabase.ts`, `types/database.ts` | Removed `Database` generic from `createClient` (v2.99 requires `__InternalSupabase` shape); type assertions used at query call sites |
| Deno Edge Function files picked up by app TypeScript compiler | `tsconfig.json` | Added `"exclude": ["supabase/functions"]` |
| `nativewind/babel` plugin caused Babel error (v2 API, not v4) | `babel.config.js` | Removed plugin; nativewind v4 only needs `jsxImportSource: 'nativewind'` in preset |
| Python-only `.gitignore` did not cover Node/Expo artifacts | `.gitignore` | Added `node_modules/`, `.expo/`, `dist/`, `.env`, `android/`, `ios/`, etc. |

---

## Stage 3 Update — AI Quest Creation (Natural Language Mode)

**Goal:** Add AI-first quest creation path. User types a plain-English prompt; GPT-4o extracts structured fields; user reviews/edits before posting.

### Files created
| File | Purpose |
|------|---------|
| `supabase/functions/parse-quest/index.ts` | Edge Function: GPT-4o function calling to parse free-text quest prompt into structured fields (title, description, tag, fulfilment_mode, reward_amount, deadline_label, location_name) |

### Files modified
| File | Change |
|------|--------|
| `app/(tabs)/post-quest.tsx` | Added "AI / Manual" pill toggle at top. AI mode: prompt input → "Parse with AI" → pre-filled review/edit form → post. Manual mode: existing 3-step form unchanged. Shared `handleSubmit` used by both modes. |
| `PLAN.md` | Rewritten to reflect updated hackathon plan: NL quest creation as primary, AI push matching promoted to Stage 11, Fog of War moved into hackathon scope. |

### AI Mode flow
```
User types: "need someone to grab chicken rice from The Deck, $3, drop at Tembusu 7-12 by 1pm"
  → supabase.functions.invoke('parse-quest') → GPT-4o function calling
  → returns { title, description, tag: "food", fulfilment_mode: "dropoff",
               reward_amount: 3, deadline_label: "Tonight (10 PM)", location_name: "The Deck" }
  → pre-fills review form (all fields editable)
  → user taps "Post Quest" → same handleSubmit as manual mode → feed
```

### parse-quest Edge Function
- Uses GPT-4o **function calling** (not JSON mode) for typed, validated output
- Returns null for fields that cannot be confidently inferred from the prompt
- Null fields appear blank in the review form — user fills them in before posting
- Deploy: `npx supabase functions deploy parse-quest --project-ref <ref>`

---

## Stage 3 Redesign — AI Chat Quest Interface

**Goal:** Replace the static "prompt → parse → review form" AI flow with a conversational ChatGPT-style interface. `parse-quest` is superseded by `chat-quest`.

### Root cause of original "AI parsing failed" error
The `parse-quest` Edge Function was never deployed, and the `OPENAI_API_KEY` was never set as a Supabase secret. The `.env` file only feeds the Expo client — Edge Functions read secrets via `Deno.env.get()`, set separately with `npx supabase secrets set`.

### Files created
| File | Purpose |
|------|---------|
| `supabase/functions/chat-quest/index.ts` | Multi-turn GPT-4o conversation function. Accepts `{ messages, collected_fields, current_time }`. Returns `{ reply, fields, complete }`. Server-side field merging ensures previously gathered data is never lost. Server-side `isComplete()` check prevents premature `complete=true`. |

### Files modified
| File | Change |
|------|--------|
| `app/(tabs)/post-quest.tsx` | AI mode fully replaced with chat UI. Manual mode unchanged. |

### chat-quest Edge Function
- **Request:** `{ messages: [{role, content}], collected_fields: Partial<QuestFields>, current_time: string }`
- **Response:** `{ reply: string, fields: Partial<QuestFields>, complete: boolean }`
- Uses a single `update_quest` tool that GPT-4o always calls — structured output via function calling
- Tool schema uses simple `type: "string"` / `type: "number"` for optional fields (omitted rather than null) — OpenAI does not support `type: ["string", "null"]` or `null` in enum arrays
- Server merges `collected_fields` from request with newly extracted fields (non-null values only override); ensures fields gathered in prior turns are not lost
- `isComplete()` requires: `title`, `description` (≥20 chars), `fulfilment_mode`, `deadline_label`
- Deployed with `--no-verify-jwt` (function doesn't access user data; JWT check caused 401 errors)
- CORS headers included on all responses

### New AI mode UX (`app/(tabs)/post-quest.tsx`)
- Static greeting on mount — no API call: *"What quest would you like to post? Describe it in plain English — I'll handle the rest."*
- User messages: right-aligned purple bubbles
- AI messages: left-aligned dark grey bubbles, typed out at 12ms/char
- Loading state: `...` bubble shown while waiting for Edge Function response
- Input bar disabled while loading or animating
- Auto-scroll to bottom after each new message
- **Confirmation card** appears after animation completes when `complete=true`:
  - Shows: title, fulfilment mode chip, deadline chip, reward, location (if any), tag (if any)
  - **"Post Quest"** — submits directly from `collectedFields` (no shared-state race condition)
  - **"Keep editing"** — dismisses card, user continues chatting

### Deployment
```bash
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase functions deploy chat-quest --no-verify-jwt
```

---

## Stage 6 — Quest Detail & Chat

**Goal:** Full quest lifecycle from accept through in-progress chat to cancel/drop-out.

### Files created / heavily modified
| File | Purpose |
|------|---------|
| `app/quest/[id].tsx` | Complete quest detail screen |

### Features
- **Accept flow:** Scout taps Accept → status updates to `in_progress`, acceptor_id set; poster sees who accepted
- **Real-time chat:** Supabase `messages` channel subscription — messages appear instantly for both parties; photo sharing in chat
- **Role-based action area:** Different UI shown to poster vs scout vs other users
- **Location sharing in chat:** Users can share their current GPS location as a message
- **Cancel / Drop-out:** Poster can cancel (returns to open); scout can drop out (returns to open, strike risk)
- **Realtime publication:** `messages` table added to `supabase_realtime` publication

---

## Stage 7 — Completion & Ratings

**Goal:** End-to-end completion flow with photo proof, mutual confirmation, ratings, and trust tier recalculation.

### Features
- **Drop-off photo upload:** Scout uploads completion photo to `drop-off-photos` Supabase Storage bucket
- **Meet-up confirmation:** Both parties confirm via in-app prompt
- **Mark complete:** Quest status → `completed`; `quests_completed` counter incremented on profile
- **Mutual ratings:** Both poster and scout rate each other (1–5 stars); `avg_rating` updated on profiles
- **Trust tier recalc:** `update_trust_tier()` DB function called after rating — automatically promotes wanderer → explorer → champion based on `quests_completed` + `avg_rating` thresholds
- **Strikes:** Scout receives strike if they drop out within grace window; `STRIKE_THRESHOLDS` enforced

---

## Stage 8 — Push Notifications & Profile

**Goal:** Expo push notifications for key quest events; full profile screen with stats and skills.

### Files created / heavily modified
| File | Purpose |
|------|---------|
| `src/lib/notifications.ts` | `sendPushNotification()` helper — fetch-based POST to Expo push API (no native dependency) |
| `app/(tabs)/profile.tsx` | Full profile screen replacing placeholder |

### Notifications
- Token registered on app start in `app/_layout.tsx` via `expo-notifications`; stored in `profiles.expo_push_token`
- Triggered for: new quest acceptance, new chat message, quest completion, rating received

### Profile screen
- Avatar with trust-tier ring colour
- Stats row: quests posted, quests completed, average rating
- Skill tags: add/remove free-text skill chips (persisted to `profiles.skills` array)
- Quest history tabs: Posted / In Progress / Completed

---

## Stage 9 — Leaderboard & Gamification

**Goal:** RC leaderboard, quest streaks, and flash quest countdown.

### Features
- **RC Leaderboard:** Map tab repurposed as leaderboard — ranks all 7 RCs by total quests completed by residents; shows top contributor per RC
- **Quest streaks:** `streak_count` on profile — increments if user completes a quest within 24h of last; shown as flame badge on profile
- **Flash Quest countdown:** `FlashCountdown` component in `QuestCard` — live mm:ss timer with `ProgressBar`; turns red when under 5 minutes; flash quests expire after 30 minutes

---

## Stage 10 — Route Offers (Broadcast / Piggybacking)

**Goal:** Allow users heading out to broadcast their route; nearby quest posters can DM them to piggyback on their trip.

### New DB tables & functions
| Object | Purpose |
|--------|---------|
| `route_offers` table | Active broadcasts: `user_id`, `destination_name`, `latitude`, `longitude`, `tags[]`, `note`, `expires_at`, `is_active` |
| `direct_messages` table | 1:1 DMs between any two users: `sender_id`, `recipient_id`, `content`, `created_at` |
| `find_nearby_route_offers` RPC | Finds active route offers within a radius of a given lat/lon |
| pg_cron job | Automatically sets `is_active = false` on expired route offers |

Both tables added to `supabase_realtime` publication (live presence + DM delivery).

### Files created
| File | Purpose |
|------|---------|
| `src/hooks/useRouteOffer.ts` | Fetch/create/cancel the current user's active route offer; realtime subscription |
| `src/components/RouteOfferBanner.tsx` | Blue banner shown in feed when user has an active broadcast; cancel button |
| `src/components/RouteOfferCard.tsx` | Card shown in Broadcast feed tab; "Chat" button → `/dm/[userId]` |
| `app/route-offer-confirm.tsx` | Broadcast form: NUS location picker (40+ locations), duration selector, tag chips, optional note |
| `app/dm/[userId].tsx` | Simple 1:1 direct message screen between two users |
| `supabase/functions/notify-route-offers/index.ts` | Edge Function: when a quest is posted, finds nearby active broadcasters and sends them a push notification |

### Files modified
| File | Change |
|------|--------|
| `app/(tabs)/feed.tsx` | Added Quests / Broadcast toggle (animated sliding pill); Broadcast tab shows `RouteOfferCard` list with search + tag filter; `RouteOfferBanner` shown above feed when user has active offer |
| `app/(tabs)/map.tsx` | Added "Going out?" FAB (bottom-right) → navigates to `route-offer-confirm` |
| `src/constants/index.ts` | Added `NUS_LOCATIONS` (40+ NUS locations with categories), `ROUTE_OFFER_DURATIONS`, `ROUTE_OFFER_RADIUS_DEG` |

### Broadcast flow
```
User taps "Going out?" FAB on map
  → route-offer-confirm: pick destination, duration, tags, note → inserts route_offer row
  → RouteOfferBanner appears in feed (shows destination + time left)
  → Other users see RouteOfferCard in Broadcast tab → tap "Chat" → /dm/[userId]
  → When a new quest is posted nearby, notify-route-offers Edge Function fires
    → pushes notification to matching broadcasters
```

---

## Map Overhaul — NUS Location Markers + Current Location

**Goal:** Replace raw lat/lon cluster approach with fixed NUS location markers; add live user location features.

### Architecture change
The map was rebuilt around `NUS_LOCATIONS` (40+ fixed campus locations) rather than dynamic lat/lon clustering. Each quest is bucketed into its nearest NUS location; that location's marker shows the quest count.

### Files modified
| File | Change |
|------|---------|
| `app/(tabs)/map.tsx` | Restored to piggybagging-commit version (NUS location markers, `LocationMarker` interface, `QuestAccordion`, `MobileBottomSheet`, Reanimated side panel, collapsible filter chips); added current location features on top |
| `src/components/map/MapEngine.tsx` | Uses `locationMarkers: LocationMarker[]` + `onLocationPress` props; added `showsUserLocation={true}` (native blue dot) + `mapRef` prop for programmatic `animateToRegion` |
| `src/components/map/MapEngine.web.tsx` | Same `LocationMarker` interface with pigeon-maps; added controlled `center`/`zoom` state that auto-pans when `userLocation` prop changes; renders a custom blue dot marker |

### Current location features added
- Auto-requests `Location.requestForegroundPermissionsAsync()` on mount; pans map to user on grant
- `Compass` button in search row → `handleLocateMe()` → `animateToRegion()` (native) / controlled center state (web)
- Map pins made translucent: `rgba(124,58,237,0.65)` fill, `rgba(255,255,255,0.75)` border

---

## Feed & Map — Eligibility, Distance & UX Improvements

### Show all quests (including ineligible)
Previously, the feed filtered out quests the user couldn't accept. Now **all open quests are shown**; ineligible ones are visually distinguished instead of hidden.

- **`feed.tsx`:** Removed `isEligible` filter from `filtered` computation
- **`QuestCard.tsx`:** Already dimmed ineligible quests at `opacity: 0.55` with a red ineligibility banner — unchanged
- **`QuestAccordion.tsx`:** Added eligibility check; ineligible quests get `opacity: 0.55`, red border tint, and a locked Accept button (grey background + `Lock` icon + `"Needs Explorer"` style text)

### Distance display
- **Feed (`QuestCard`):** Added `distance?: number` prop. Feed requests location permission on mount; computes Haversine distance per quest and passes it to `QuestCard`. Displayed inline next to `location_name` with a `Navigation` icon.
- **Map quest list (`QuestAccordion`):** Distance shown inline in the chip row (tag · reward · distance) with a `Navigation` icon. Distance is computed once per cluster (user → NUS location marker) and passed as `clusterDistance` to all quests in that panel — not per individual quest, since they all share the same location marker.

### Files modified
| File | Change |
|------|---------|
| `src/components/QuestCard.tsx` | Added `distance?: number` prop; displayed next to location |
| `src/components/map/QuestAccordion.tsx` | Added `distance?: number` (shown in chip row); added eligibility dimming + locked Accept button |
| `src/components/map/MobileBottomSheet.tsx` | Replaced `distances: Record<string,number>` with `clusterDistance?: number`; forwarded to each `QuestAccordion` |
| `app/(tabs)/map.tsx` | Computes single `clusterDistance` (user → marker) on `openPanel`; threads through web panel + mobile sheet |
| `app/(tabs)/feed.tsx` | Added `expo-location` import + `userLocation` state + location request on mount; passes distance to `QuestCard` |

---

## Profile — Rank Title Display

Added the rank title (`Wanderer` / `Explorer` / `Champion`) as a styled text below the display name in the profile hero card, coloured with the tier's brand colour. Previously only shown as a small badge.

**File:** `app/(tabs)/profile.tsx`

---

## Auth — OTP Length Fix

Supabase was configured to send 8-digit OTPs but the verify screen expected 6 digits. Fixed by changing the OTP length to 6 in **Supabase Dashboard → Authentication → Email → OTP length**. No app code changed.

---

## Stages 14–16 — Contacts, Reports, Price Suggestion, Semantic Search, Notification Preferences

### Stage 14: Ripple Contacts & Report System

#### New files
| File | Purpose |
|------|---------|
| `src/hooks/useContacts.ts` | Fetch/add/remove contacts with profile join; `isContact()` helper |
| `src/components/ReportModal.tsx` | Scrollable report type picker + description form; submits to `reports` table |
| `src/components/three/ContactsScene.web.tsx` | R3F 3D orbital contacts graph (web) — 2 concentric rings, ripple pulse rings, connection lines |
| `src/components/three/ContactsScene.native.tsx` | Reanimated 2D orbital contacts graph (native) — circular layout with animated orbs |
| `app/contacts-graph.tsx` | Full-screen contacts graph screen with 3D/2D scene + flat contacts list |
| `app/my-reports.tsx` | List of user's submitted reports with status badges |

#### Modified files
| File | Change |
|------|--------|
| `app/quest/[id].tsx` | Contact prompt after quest completion; flag icon in header to open ReportModal |
| `app/(tabs)/profile.tsx` | Added "Contacts" section with count + "View Graph" button |
| `app/(tabs)/settings.tsx` | Added My Reports nav row |

### Stage 15: Price Suggestion + Semantic Search

#### New files
| File | Purpose |
|------|---------|
| `supabase/functions/embed-query/index.ts` | Edge Function: calls OpenAI `text-embedding-3-small`, returns embedding vector |

#### Modified files
| File | Change |
|------|--------|
| `app/(tabs)/post-quest.tsx` | `suggestPrice()` helper + inline suggestion chip with "Use" button in Reward step |
| `app/(tabs)/feed.tsx` | AI toggle pill next to search bar; semantic search via `embed-query` → `search_quests` RPC; contacts boost in ranking |

### Stage 16: Configurable Push Notification Preferences

#### Modified files
| File | Change |
|------|--------|
| `supabase/schema.sql` | Updated `notification_preferences` default with new keys (`new_quest`, `quest_complete`, `chat_message`, `route_offer_nearby`, `categories`) |
| `src/types/database.ts` | Updated `NotificationPreferences` interface to match new schema |
| `src/lib/notifications.ts` | `sendPushNotification` now accepts `notifType` + `recipientId`; fetches and enforces notification prefs before sending |
| `app/(tabs)/settings.tsx` | Full notification preferences UI: toggle rows per event type + multi-select category chips; debounced save to Supabase |
 
 