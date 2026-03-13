# Ripple — Change Log (Stages 0–4)

DO NOT EDIT IF YOU ARE NOT JONATHAN!!!

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
