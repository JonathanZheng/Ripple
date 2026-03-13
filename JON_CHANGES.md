# RIPPLE — Updated Hackathon Plan

**Small actions. Big community. Every ripple matters.**

DO NOT EDIT IF YOU ARE NOT JONATHAN!!!
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

Ripple is that mechanism. It turns invisible micro-needs into structured, discoverable, trustworthy requests — and matches them to the right person at the right time using AI. The community-building isn't the pitch; it's the byproduct. When you help a stranger pick up lunch and they help you move a shelf next week, a relationship forms — not because an app told you to socialise, but because you were genuinely useful to each other.

---

## 2. Solution: Ripple

Ripple is a mobile-first peer request platform built specifically for UTown's Residential Colleges. Residents post **quests** — small tasks, errands, event invitations, or skill requests — and nearby residents accept them for a **cash reward** (settled privately between users), reputation, or simply the satisfaction of helping a neighbour.

The core loop: **Post a quest → AI structures and broadcasts it → a neighbour gets matched and notified → they complete it → payment and reputation flow.** Every small act ripples outward into a stronger community.

What makes Ripple different from a group chat or notice board:

- **AI-first quest creation** — don't fill out a form. Just type or voice-record what you need in plain language (*"can someone grab me a kopi from deck, I'll pay $2, leave it outside Tembusu 7-12"*). GPT-4o extracts the item, price, fulfilment mode, location, and deadline automatically. The quest is live in seconds.
- **AI-powered matching and push notifications** — Ripple doesn't wait for someone to browse the map. If you're walking past The Deck and there's a food pickup quest 2 minutes from you, Ripple pings you: *"Food pickup quest near you — $3, 10 min. Accept?"* The right quest reaches the right person at the right moment.
- **Semantic search** — type what you want to help with in natural language (*"anything near Tembusu involving food"*) and AI matches you to the most relevant quests, not just keyword hits.
- **Structured requests** with clear descriptions, deadlines, reward amounts, and fulfilment modes (drop-off vs meet-up) — replacing the noise of group chats with actionable, verifiable interactions.
- **A trust and reputation system** backed by NUS Student Pass verification that makes the platform self-moderating over time.
- **Gamification and inter-RC mechanics** (leaderboards, crew quests, flash quests) that make helping feel fun, not transactional.
- **A live Fog of War map** that turns quest browsing into an explorable, game-like experience — walk around UTown to reveal hidden quests and rewards.

---

## 3. How It Works — Full Pipeline

### Phase A: Account Setup & Quest Creation

0. **First-time setup: Student Pass Verification.** Before accessing Ripple, every user must verify their identity by scanning or uploading their NUS Student Pass. The app validates the student matric number against NUS records. This ensures every account is tied to a real, identifiable student — no anonymous accounts, no duplicates. This is the foundation of Ripple's entire trust and accountability model.

1. **Resident opens Ripple** and taps "Post Quest."
2. **Primary input: conversational AI.** The resident sees a ChatGPT-style interface and types what they need in plain English — e.g., *"can someone grab me chicken rice from The Deck? Drop at RC4 by 1pm, $1."*
3. **GPT-4o extracts structured fields from the message** (title, description, fulfilment mode, deadline, reward, location, tag). If all required fields are present, it immediately shows a **confirmation card**. If any required field is missing, it asks a natural follow-up question (covering at most 2 missing fields at a time) — the conversation continues until all fields are gathered.
4. The AI reply is **typed out character-by-character** in the chat bubble for a polished, animated feel.
5. Once all required fields are collected, a **confirmation card** appears below the chat showing: title, mode, deadline, reward, location, and tag chips. The user taps **"Post Quest"** to confirm or **"Keep editing"** to continue the conversation.
6. A **Manual mode** (3-step form) is available via a pill toggle at the top — unchanged from the original form.
7. The quest description is **embedded** via OpenAI's `text-embedding-3-small` and stored in Supabase's `pgvector` for semantic search.
8. Quest goes **live** on the map and in the feed.

### Phase B: Quest Discovery & AI Matching

7. **AI Push Matching (proactive).** This is the core AI differentiator. Ripple doesn't just wait for someone to browse — it actively pushes quests to the right person at the right time. The matching engine combines:
   - **Real-time location** — the user's current geohash from Expo Location API.
   - **Quest embeddings** — semantic similarity between the user's skill profile / past quest history and active quests.
   - **Contextual signals** — time of day, quest urgency, user's direction of travel (are they walking *toward* The Deck?).

   When a match scores above a confidence threshold, Ripple sends a **push notification**: *"Food pickup quest 2 min from you — $3, chicken rice from The Deck. Accept?"* The user can accept directly from the notification without opening the app. This turns idle walks across campus into opportunities — the supply finds the demand, not the other way around.

8. **Map View** — The live Mapbox map displays quests as category-coded icon pins. Dense areas (e.g., Tembusu, RC4) use **proximity clustering**: zoomed out, quests collapse into a count bubble; tap or zoom to explode into individual pins.
9. **Fog of War** — A dark semi-transparent polygon overlays the map. As the user physically walks around UTown (GPS via Expo Location API), a 50m radius clears around them, revealing **Hidden Bonus Quests** and **Secret Loot Drops** (rare badges, streak boosters). This rewards exploration and makes the app feel like a game.
10. **Feed View** — A scrollable list of active quests, filterable by tag, reward range, RC, fulfilment mode, and deadline.
11. **AI Semantic Search** — Users can type natural language queries like *"I want to help someone with food near Tembusu"* or *"anyone need a ride to Clementi?"*. The query is embedded and matched against quest embeddings via pgvector similarity search, returning the most relevant active quests — not just keyword matches.
12. **Skill-Based Surfacing** — Users declare skills on their profile (cooking, driving, photography, coding). Ripple proactively factors these into the push matching engine and feed ranking.

### Phase C: Quest Acceptance

12. A resident taps a quest and reviews the details: description, reward, deadline, fulfilment mode, poster's trust score.
13. They tap **"Accept Quest."** The quest is now assigned to them. The poster receives a notification.
14. An in-app **chat channel** opens between the poster and acceptor for coordination (e.g., confirming exact drop-off spot, clarifying details, sharing live location).

### Phase D: Quest Completion

**If fulfilment mode = Meet-Up:**

15. The two parties meet in person.
16. After the task is done, the **poster** confirms completion in-app by tapping "Mark Complete."
17. Both parties rate each other (1–5 stars).
18. The app prompts the poster to **settle payment privately** (PayNow, PayLah, cash — whichever they agreed on in chat). The quest is marked complete.

**If fulfilment mode = Drop-Off:**

15. The acceptor travels to the designated drop-off point with the item.
16. Upon arrival, the acceptor **takes a photo of the item at the drop-off location** and submits it in-app.
17. The poster receives a **notification with the photo** and confirms receipt (or flags an issue).
18. Both parties rate each other.
19. The app prompts the poster to **settle payment privately**. Quest marked complete.

**Post-Completion — Building the Social Graph:**

After every completed quest, both parties see a prompt: **"Add [name] as a Ripple contact?"** Contacts can see each other's future quests first, making repeat interactions easy. Over time, this builds an organic social graph of people who've actually helped each other — a genuine community artefact, not a synthetic one.

Additionally, quests completed with someone from a **different RC** earn both parties a small reputation bonus. This directly incentivises the inter-RC connection that UTown's design intended but group chats never delivered.

**Quest Expiry:**

- If neither party acts by the quest deadline, the quest simply **expires** — no penalties, no harm done.
- If an acceptor has been assigned but neither completes nor cancels, the quest returns to "open" status after the deadline so another resident can pick it up.

**Accountability — Strike System:**

Because every account is verified against a real NUS Student Pass, Ripple's accountability system has teeth:

- **Non-payment** — If the acceptor completes a quest but the poster refuses to pay, the acceptor can flag it as "payment not received." This places a **strike** on the poster's profile. At **2 strikes**, the poster is temporarily suspended from posting new quests. At **3 strikes**, the case is escalated to RC management (the poster's student ID is on file). The poster's strike count is visible on their profile as a trust signal.
- **Task abandonment** — Accepting a quest and then ghosting (no completion, no cancellation) earns the acceptor a **strike**. Acceptors can cancel without penalty within a **30-minute grace window** after accepting, but abandoning after that window counts against them. Same 2-strike suspension / 3-strike escalation ladder.
- **Dispute resolution** — Either party can raise a dispute, which flags the quest for manual review. For the hackathon MVP, disputes are resolved by the team; post-launch, an AI-assisted dispute triage layer can be added.

This system works precisely because there are no anonymous accounts. A strike on your profile is a strike tied to your real student identity — that alone is a strong deterrent.

### Phase E: Reputation Update

20. Completion rate, ratings, and response time feed into each user's **Trust Score**.
21. Trust tiers gate access:
    - **Wanderer** (new user) — can only accept/post low-stakes quests (≤ $5 reward).
    - **Explorer** (5+ completed quests, 4.0+ avg rating) — full quest access.
    - **Champion** (20+ completed quests, 4.5+ avg rating) — can accept high-value quests, eligible for Flash Quests, and earns a profile badge.
22. Food-related quests require the acceptor to be **Explorer tier or above** (basic food safety accountability).

---

## 4. Key Features

### 4a. Fulfilment Modes (Drop-Off & Meet-Up)

| Aspect | Meet-Up | Drop-Off |
|--------|---------|----------|
| Use case | Study buddy, event partner, furniture help, skill exchange | Food pickup, package collection, item lending |
| Verification | Poster taps "Mark Complete" after meeting | Acceptor submits photo at drop-off point; poster confirms via notification |
| Poster presence | Required | Not required |
| Expiry | Quest expires at deadline if not completed | Quest expires at deadline if not completed |

### 4b. AI Components

| Component | Technology | What It Does | Why AI Is Essential |
|-----------|-----------|--------------|---------------------|
| Conversational Quest Creation | GPT-4o (function calling) | Multi-turn chat interface: user describes their quest in plain English, GPT-4o extracts structured fields and asks targeted follow-up questions for any missing required fields (title, description, fulfilment mode, deadline). Shows a confirmation card once all fields are gathered. | Replaces a 6-field form with a natural conversation. Handles partial or ambiguous input gracefully through follow-up questions, without dumping the user into a full form. The reply is animated character-by-character for a polished feel. |
| Context-Aware Push Matching | GPT-4o + pgvector + geohash | Combines real-time user location, quest embeddings, skill profile, past history, and contextual signals (time, urgency, travel direction) to proactively push the right quest to the right person via notification. | The core AI differentiator. A filter or search requires the user to actively look; push matching means supply finds demand automatically. This is what makes Ripple fundamentally different from a notice board. |
| Semantic Search | `text-embedding-3-small` + pgvector | Embeds quest descriptions; enables natural language search queries that understand intent and synonyms, not just keywords. | Scales gracefully as the quest database grows. Handles ambiguous queries ("anything chill near me") that keyword search cannot. |
| AI Price Suggestion | GPT-4o | Analyses quest description + historical pricing data to suggest a fair cash reward when the user doesn't specify one. | Reduces decision friction for posters and anchors fair pricing norms across the platform. |

### 4c. Gamification & Community

- **RC Leaderboards** — Which college completed the most quests this week? Drives friendly inter-RC competition.
- **Crew Mode** — Group quests that need 2+ people (e.g., "need 3 people to help move a sofa"). Payment split among crew as agreed.
- **Flash Quests** — 30-minute urgent requests with a suggested premium reward.
- **Skill Profiles** — Declare your skills; Ripple surfaces relevant quests to you automatically.
- **Quest Streaks** — Complete quests on consecutive days to earn streak bonuses and a streak badge on your profile.
- **Fog of War Exploration Rewards** — Walking around UTown clears fog and can reveal hidden bonus quests or loot drops.

### 4d. Trust & Safety

- **Student Pass verification** — every account is tied to a real NUS student identity.
- Trust tiers gate access to high-value and food-related quests.
- **Strike system** with escalation to RC management deters non-payment and task abandonment.
- Report system: flag quests or users for inappropriate content or behaviour.
- In-app chat is logged and reviewable in case of disputes.

---

## 5. Technical Architecture

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend | React Native (Expo) | Cross-platform iOS/Android app. |
| UI | NativeWind v4 (Tailwind) | Consistent dark-theme design system. |
| Backend & DB | Supabase | Auth, PostgreSQL, real-time subscriptions, file storage, Row Level Security. |
| Map | Mapbox GL JS | GPU-rendered SymbolLayer for quest pins. Clustering, Fog of War polygon overlay, geohash proximity queries. |
| Real-time | Supabase Realtime | Streams new quests to client and powers in-app chat. |
| AI: NL Parsing & Matching | OpenAI GPT-4o (function calling) | Parse natural language quest input. Power context-aware push matching. Generate quest titles. Suggest pricing. |
| AI: Search | pgvector (Supabase) | Store quest embeddings for semantic search. |
| Location | Expo Location API + Geohash | GPS tracking for Fog of War, proximity surfacing. |
| Notifications | Expo Push Notifications | Alert on quest accepted, drop-off photo submitted, quest completed. |
| Payments | Off-platform (PayNow / PayLah / cash) | Settled privately; no in-app payment processing. |

---

## 6. Product Roadmap

| Phase | Deliverables |
|-------|-------------|
| **Hackathon Build** | Natural language quest creation, AI context-aware push matching, Mapbox map with clustering + Fog of War, quest acceptance flow (meet-up + drop-off modes), drop-off photo submission, semantic search (pgvector), in-app chat, Student Pass verification, strike system, trust tiers, Crew Mode, Flash Quests, skill profiles, quest streaks, RC leaderboard. |
| **Post-Launch v1** | Stripe Connect for in-app payments, native app store release, RC event calendar integration, push notification tuning, RC admin dashboard, analytics dashboard. |
| **v2 Growth** | Expansion to other NUS residences and campuses, AI-assisted dispute resolution, quest recommendation engine improvements. |

---

## 7. Why This Wins

**The AI isn't a feature — it's the product.** Remove the AI and Ripple becomes a notice board with a map. With it, Ripple does two things no notice board can:

1. **Zero-friction quest creation.** You type what you need in plain English. The AI turns it into a structured, searchable, matchable quest in under 2 seconds. Posting a request is now as easy as sending a text — which is exactly the bar it needs to clear to beat a group chat.

2. **The supply finds the demand.** Instead of hoping someone scrolls past your quest, Ripple's AI matching engine proactively notifies the right person at the right moment — the student who's already walking past the canteen, has a history of food pickup quests, and is available right now. This is the core innovation: turning the idle movement of 4,000 students across a 500m campus into an always-on fulfilment network.

**Small actions. Big community. Every ripple matters.**

---

---

# Ripple — Change Log (Stages 0–4)

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
