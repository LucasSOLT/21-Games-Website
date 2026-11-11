# Project: 21 Games (SOL GaMES `21 → 1`) — Step 2.5 Lockdown & Steps 3 → 5 Countdown Completion

## Architecture
- **Framework & Static Export**: Next.js `16.2.6` App Router, React `19.2.4`, TypeScript `5` (`strict: true`), Tailwind CSS `v4`, ESLint `9`. Production builds use `output: "export"`, `images: { unoptimized: true }`, and root `basePath: ""` (`npm run build`).
  - **Mandatory Next.js 16 Rule (`AGENTS.md`)**: Workers MUST read relevant guides in `node_modules/next/dist/docs/` after `npm install` before editing Next.js code. No Server Actions (`"use server"`) or `/api/*` route handlers (forbidden by `output: "export"`). Dynamic `[slug]` routes MUST export `generateStaticParams()` and await `params: Promise<{ slug: string }>`. `useSearchParams()` consumers MUST be wrapped in `<Suspense>`.
- **Backend, Auth & Real-Time Persistence**: Supabase Pro (`https://trwyrfhicbnfhlbiztau.supabase.co`) via `@supabase/supabase-js` with JWT-verified Supabase Auth (`INITIAL_GAME_MASTERS = ["lucas@soltheory.com", "steve@soltheory.com"]`), strict Postgres Row-Level Security (RLS), `supabase_realtime` (`REPLICA IDENTITY FULL` + WebSocket `broadcast` + `postgres_changes`), and client `BroadcastChannel` + `localStorage` cache invalidation via `content_hash`.
- **Live Production Deployment Topology (`https://21games.ai`)**:
  - Local `origin` is `https://github.com/LucasSOLT/21-Games-Website.git` (fork of `https://github.com/gerardrickjardin/21-Games-Website.git`, which `AGENTS.md` §1 documents as the Vercel source repo for `https://21games.ai` -> `https://www.21games.ai/`). Supabase GitHub Preview/Migration integration runs on `supabase/migrations/*.sql`.
  - Every gated step (`M1` Step 2.5, `M2` Step 3, `M3` Step 4, `M4` Step 5, `M5` Final) MUST:
    1. Ensure `.agents/`, `TEST_INFRA.md`, and `TEST_READY.md` are listed in `.git/info/exclude` and NEVER staged or committed.
    2. Run `git fetch origin && git pull --rebase origin main`.
    3. Pass `npm run lint` (0 errors), `npm run build` (`out/` static export, 0 errors), and all unit/adversarial tests.
    4. Stage explicit project file paths ONLY, commit, push `main` to `origin` (`LucasSOLT/21-Games-Website`) AND sync/push `main` to `gerardrickjardin/21-Games-Website` (`upstream`) if permitted by GitHub credentials, and empirically verify live HTTP deployment on `https://21games.ai` (`https://www.21games.ai/`).

---

## Feature Inventory
Every feature from the 3-agent Phase 0 Survey (`spec_miner_survey_1`, `explorer_survey_2`, `explorer_survey_3`) is assigned to a milestone below. Zero features are unassigned.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | `F1` Git Hygiene & Environment Bootstrap | Append `.agents/`, `TEST_INFRA.md`, `TEST_READY.md` to `.git/info/exclude`; run `npm install`; inspect `node_modules/next/dist/docs/` per `AGENTS.md` | M1 | `explorer_survey_2`, `spec_miner_survey_1` |
| 2 | `F2` Magic Link Unverified Login Lockdown (`AUTH-1`) | Lock `sendMagicLink()` (`user-auth.ts`, `auth-provider.tsx`, `profile-viewer-modal.tsx`) so it ONLY sends OTP email (`profile: null, magicLinkSent: true`) and never activates a session/GM profile before email link click | M1 | `spec_miner_survey_1`, `explorer_survey_2` |
| 3 | `F3` Password Sign-In & Sign-Up Lockdown (`AUTH-2`) | Require password (`>=6` chars on sign-up, non-empty on sign-in); delete predictable `solgames_${email.slice(0,8)}_2026` password; remove `user_profiles` passwordless auto-login & auto-`signUp` fallthrough; do not activate session when `data.session === null` (`mailer_autoconfirm=false`); never fall through to local account on Supabase error | M1 | `spec_miner_survey_1`, `explorer_survey_2` |
| 4 | `F4` Session & `localStorage` Spoof Lockdown (`AUTH-3`) | Require valid Supabase Auth JWT session in `restoreUserSession()` & `subscribeToAuthChanges()` when `isSupabaseConfigured`; purge forged `solgames_v1_active_user` on missing session or `SIGNED_OUT`; block unverified root GM elevation while keeping synchronous `isGameMaster(profile)` compatible with existing unit tests | M1 | `spec_miner_survey_1`, `explorer_survey_2` |
| 5 | `F5` Plaintext Password Purge (`AUTH-4`) | Remove plaintext `password` persistence from `saveActiveUserProfile` / `StoredLocalAccount` (`solgames_v1_accounts_db`) and scrub legacy `password` keys on read | M1 | `spec_miner_survey_1`, `explorer_survey_2` |
| 6 | `F6` Supabase RLS & Grants Lockdown (`RLS-5`) | Create `supabase/migrations/20261111000001_auth_security_lockdown.sql` & sync `supabase/schema.sql`: revoke `anon` write/delete on `daily_puzzles`, `user_profiles`, `twenty_one_boards`, `twenty_one_responses` and `anon` SELECT on `user_profiles`; restrict `daily_puzzles` writes to authenticated GMs (`lucas@soltheory.com`, `steve@soltheory.com`) or future-only `admin`; restrict `user_profiles` read/write to owner (no role/ban self-escalation) or GM; remove stale non-whitelisted GM email; require `authenticated` for `twenty_one_boards` INSERT; fix `ALTER DEFAULT PRIVILEGES` | M1 | `spec_miner_survey_1`, `explorer_survey_2` |
| 7 | `F7` Custom Creator Auth/Moderation & Admin Cleanup (`GATE-6`, `RBAC-7`) | Auth-gate & moderate `17 Syllables` custom creator (`seventeen-syllables.tsx`); fix `21 Things` creator check to `!isAuthenticated` (blocking banned users); add public moderation to `/admin` `handleSave17Syllables`; remove dead `"Make GM"` button in `admin/page.tsx`; update stale `tests/m1-b1-harness.ts` & `scripts/verify-live-supabase-realtime.ts` | M1 | `explorer_survey_2`, `explorer_survey_3` |
| 8 | `F8` Step 2.5 Adversarial Verification & Live Push | Pass `npm run lint`, `npm run build`, M1-B2 + new Step 2.5 auth lockdown stress tests, sync `PROJECT.md`, push live to `https://21games.ai`, and verify live HTTP + Supabase state | M1 | `ORIGINAL_REQUEST.md`, Survey 1–3 |
| 9 | `F9` Multi-Game Hub, Archive & Storage Refactor | Make `src/app/page.tsx` (`X Daily Live · Y Coming Soon` + archive cards), `src/app/games/[slug]/archive/page.tsx` (`generateStaticParams` including `17-syllables` + new games), `game-archive.tsx`, `game-shell.tsx` (switcher + How-to-Play), `game-error-boundary.tsx` (`PlayableGameSlug`), and generic `game-storage.ts` override/Realtime helpers dynamically driven by `ALL_GAMES` / `PLAYABLE_GAMES` | M2 | `explorer_survey_3`, `spec_miner_survey_1` |
| 10 | `F10` Unified AI Helper (`ai-helper.ts`) & `custom_puzzles` Short Links | Create `src/lib/ai-helper.ts` (`gemini-2.5-flash` default `$0` + OpenRouter toggle + zero-key deterministic local fallbacks for rhymes, synonyms, haikus); create `public.custom_puzzles` migration + compact `<75`-char `?b=<prefix>-<8chars>` short-link storage/sharing (`9r-`, `6p-`, `c5-`, `17s-`) | M2 | `spec_miner_survey_1`, `explorer_survey_3` |
| 11 | `F11` Game `#9` — `9 Rhymes` + Creator Mode + `/admin` Tab | `/games/9-rhymes` & `/archive`: `<GameSplashScreen>`, `<GameErrorBoundary>`, NYT-meets-iMessage chat with `"Nine"`, Starter badge + `Word k of 9 · Score`, 1 Starter + 9 perfect-rhyme blanks (`_ _ _ _ (N letters)` + alt spellings), `400ms` `• • •` typing indicator, confirm-gated `New hint (-0.5)` & `Reveal (0)`, custom `readOnly` QWERTY (no OS popup), `🟩🟨⬜` 9-emoji share receipt, 66-day bank + validator + seeded fallback, auth-gated `?b=9r-...` Creator Mode, `/admin` tab, and Q4 stats | M2 | `spec_miner_survey_1`, `explorer_survey_3` |
| 12 | `F12` Game `#8` — `Eightfold Echo` + Parametric SVG Engine + `/admin` Tab | `/games/eightfold-echo` & `/archive`: `<GameSplashScreen>`, `<GameErrorBoundary>`, deterministic parametric SVG `3×3` generator + solver (`0` Emerald `#2ECC71` center → `8` Hamiltonian path), 9 permanent signature tile colors, `3px` dotted active border → `100%` solid completed fill (**no `#1..#8` step badges**), count-up timer, `+5s` wrong-click penalty, confirm-gated `Hint (+15s)` pulsing 2 candidates, single-screen `320px` fit, `Solved in M:SS · N Mistakes · ⭐⭐⭐` + `0→8` rule walkthrough, `/admin` Preview/Reroll Seed, and Q4 stats | M2 | `spec_miner_survey_1`, `explorer_survey_3` |
| 13 | `F13` Step 3 Verification & Live Push (`5 Daily Live`) | Pass `npm run lint`, `npm run build`, Step 3 unit/solver/adversarial tests, push Step 3 live to `https://21games.ai`, and verify `/games/9-rhymes`, `/games/eightfold-echo`, and `/games/17-syllables/archive` live (`HTTP 200`) | M2 | `ORIGINAL_REQUEST.md`, Survey 1–3 |
| 14 | `F14` Game `#6` — `6 Pics` + AI Synonyms + Creator Mode + `/admin` Tab | `/games/6-pics` & `/archive`: `<GameSplashScreen>`, `<GameErrorBoundary>`, Pic `#1` free (`6/6`), 6 attempts or Skip unlocking `#2..#6`, label-free single-image swipe carousel in play → post-game `2×3` captioned grid with bold top-center Theme Answer, aliases + Levenshtein `≤1` typo forgiveness (`>=5` chars only), `/admin` & `?b=6p-...` Creator Mode with `ai-helper.ts` `"✨ Auto-Generate Synonyms/Aliases"`, 66-day illustrated `<ImageWithFallback>` bank + seeded fallback, and Q4 stats | M3 | `spec_miner_survey_1`, `explorer_survey_3` |
| 15 | `F15` Game `#4` — `Four Score` + Backtracking Solver + `/admin` Tab | `/games/four-score` & `/archive`: `<GameSplashScreen>`, `<GameErrorBoundary>`, combine `N>=4` single-use digits & `>=3` single-use ops (`+`, `−`, `×`, `÷`, `x²`, `xʸ`) under **Strict Full-Board Rule** (consume ALL tiles & ops so 1 final tile `=== 80`), whole-number division (`B!==0 && A%B===0`) & `0..10,000` guardrails, Live Equation Banner, unlimited Undo/Reset, win modal with player + canonical equations, deterministic generator + backtracking solver, `/admin` Preview/Reroll Seed, and Q4 stats | M3 | `spec_miner_survey_1`, `explorer_survey_3` |
| 16 | `F16` Existing-Game Bible Parity (`#21`, `#17`, `#5`) | Add `<GameSplashScreen>` to `21 Things` & `Connect 5` (timer starts on splash dismiss; skip on `?b=`/`?mode=create`); add auth-gated `Connect 5` Creator Mode (`?mode=create` & `?b=c5-xxxxxxxx` + Tier 2 moderation + native share); add interactive click-between-letters chunk toggles in `/admin` for `17 Syllables` (Q6) | M3 | `spec_miner_survey_1`, `explorer_survey_3` |
| 17 | `F17` Step 4 Verification & Live Push (`7 Daily Live`) | Pass `npm run lint`, `npm run build`, Step 4 unit/solver/adversarial tests, push Step 4 live to `https://21games.ai`, and verify `/games/6-pics` & `/games/four-score` live (`HTTP 200`) | M3 | `ORIGINAL_REQUEST.md`, Survey 1–3 |
| 18 | `F18` Game `#2` — `Move Two` + BFS Solver + `/admin` Tab | `/games/move-2` & `/archive`: `<GameSplashScreen>`, `<GameErrorBoundary>`, flat 2D `3×3` active face (`Face 1 → 6`) + top-right **mini 3D isometric Rubik's cube HUD**, `1×1×2` Bloxorz rolling physics (`UPRIGHT`, `FLAT_H`, `FLAT_V`), exit portals, solid walls (`⬛` bump/shake), hazard holes (`✕` reset current face), Undo Move & Reset Face, `Face 6` Red Target exact posture check, **BFS state-space solver/generator** computing exact **Par**, Arrow/WASD + swipe + D-Pad (`320px`-safe), `Solved in X moves · Par: Y · ⭐⭐⭐`, `/admin` Preview/Reroll Seed, and Q4 stats | M4 | `spec_miner_survey_1`, `explorer_survey_3` |
| 19 | `F19` Game `#1` — `1 Win` + Realtime Top 100 Leaderboard | `/games/1-win` & `/archive`: `<GameSplashScreen>`, `<GameErrorBoundary>`, blind free-text gratitude input (`<=4` words, `<=35` chars, zero autocomplete spoilers), `normalizeOneWinEntry` canonical grouping + Title Case display, 1/day submission lock (`localStorage` + `public.one_win_submissions` with `supabase_realtime` `REPLICA IDENTITY FULL`), live-updating Top 100 leaderboard highlighting player's win rank & count, Tier 1+2 public moderation, strictly View-Only past archive (`date < today`), `/admin` tab, and Q4 stats | M4 | `spec_miner_survey_1`, `explorer_survey_3` |
| 20 | `F20` Month `M+2` Batch Automation & Postgres Moderation Trigger | Add `"generate-batch"` CLI (`scripts/generate-monthly-batch.ts` in `package.json`) + `/admin` Monthly Batch Automation panel (incomplete-buffer reminder banner + 1-click `"Generate Month M+2 Batch"` persisting solver-validated full month to `daily_puzzles`); add Postgres `BEFORE INSERT OR UPDATE` moderation trigger across user-writable tables (§0.3, §0.5) | M4 | `spec_miner_survey_1`, `explorer_survey_3` |
| 21 | `F21` Unified 9-Game Profile Stats, `"9 Daily Live"` Grid & Step 5 Live Push | Add `all_game_stats jsonb` to `public.user_profiles`; sync/merge all 9 games' Q4 metrics + daily composite score in `game-storage.ts`, `user-auth.ts`, `ProfileViewerModal`, and `/account`; activate all 9 games (`21→17→9→8→6→5→4→2→1` `isPlayable: true`, `"9 Daily Live"`, all 9 `/archive` routes); pass lint/build/tests and push Step 5 live to `https://21games.ai` | M4 | `spec_miner_survey_1`, `explorer_survey_3` |
| 22 | `F22` Opaque-Box 4-Tier E2E Suite & Tier 5 Adversarial Hardening | E2E Track creates `TEST_INFRA.md`, `>=242` opaque-box tests across Tiers 1–4 (`tests/e2e/`), and `TEST_READY.md`; Final Milestone passes 100% of Tiers 1–4 sequentially + Tier 5 white-box Challenger hardening loop + final live `https://21games.ai` verification | E2E, M5 | Project Pattern Dual Track |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Environment Setup & Step 2.5 Auth Security Lockdown | `F1`–`F8`: `.git/info/exclude`, `npm install`, Next.js 16 docs check, client Auth + `localStorage` + plaintext password lockdown, Supabase RLS & grants migration, custom-creator/admin security fixes, adversarial verification, and live push to `https://21games.ai` | none | DONE |
| M2 | Step 3 — Multi-Game Hub, AI/Custom Infra, `#9` `9 Rhymes` & `#8` `Eightfold Echo` | `F9`–`F13`: Dynamic multi-game shell/archive/homepage/storage refactor, `ai-helper.ts`, `public.custom_puzzles`, playable `9 Rhymes` (`#9`) + `Eightfold Echo` (`#8`), studio tabs, verification, and live push to `https://21games.ai` | M1 | PLANNED |
| M3 | Step 4 — `#6` `6 Pics`, `#4` `Four Score` & Existing-Game Bible Parity | `F14`–`F17`: Playable `6 Pics` (`#6`) + `Four Score` (`#4`), `<GameSplashScreen>` on `21 Things` & `Connect 5`, `Connect 5` Creator Mode (`?b=c5-...`), `17 Syllables` `/admin` letter-cut toggles, verification, and live push to `https://21games.ai` | M2 | PLANNED |
| M4 | Step 5 — `#2` `Move Two`, `#1` `1 Win`, Month `M+2` Batch, DB Moderation & 9-Game Launch | `F18`–`F21`: Playable `Move Two` (`#2`) + `1 Win` (`#1` Realtime Top 100), `npm run generate-batch` + `/admin` Month `M+2` batch panel, Postgres moderation trigger, unified 9-game `user_profiles` stats, full `"9 Daily Live"` launch, verification, and live push to `https://21games.ai` | M3 | PLANNED |
| E2E | Dual-Track Opaque-Box E2E Test Suite (`Tiers 1–4`) | `F22` (Test Track): Requirement-driven opaque-box test harness (`TEST_INFRA.md`, `tests/e2e/`, `TEST_READY.md`) with `>=105` Tier 1, `>=105` Tier 2, `>=21` Tier 3, and `>=11` Tier 4 tests (`>=242` total) | none (waits for M1 `npm install` before execution) | IN_PROGRESS (`0a137e9c54895b18475aa79e32ff0a21`) |
| M5 | Final Milestone — 100% E2E Pass (`Tiers 1–4`) + Tier 5 Adversarial Coverage Hardening | `F22` (Impl Track): Phase 1 sequential pass of Tiers 1→2→3→4 E2E suite; Phase 2 white-box Tier 5 Challenger → Worker → Reviewer loop until 0 gaps; final lint/build/audit & live `https://21games.ai` sync | M4, E2E | PLANNED |

---

## Interface Contracts

### 1. Hardened Authentication & RBAC (`src/lib/user-auth.ts`)
```typescript
export const INITIAL_GAME_MASTERS: readonly string[] = [
  "lucas@soltheory.com",
  "steve@soltheory.com",
] as const;

export interface AuthActionResult {
  ok: boolean;
  profile: UserProfile | null;
  error?: string;
  message?: string;
  magicLinkSent?: boolean;
  confirmationRequired?: boolean;
}

// Step 2.5 Invariants:
// 1. sendMagicLink(email) NEVER activates or returns a non-null profile (returns { ok: true, profile: null, magicLinkSent: true }).
// 2. signInWithEmail({ email, password }) REQUIRES non-empty password and valid supabase.auth.signInWithPassword session when isSupabaseConfigured.
// 3. signUpWithEmail({ email, password, ... }) REQUIRES password.length >= 6, NEVER uses a default password, returns profile: null + confirmationRequired: true if data.session === null, and NEVER falls back to local profile creation on Supabase error.
// 4. restoreUserSession() verifies active supabase.auth.getSession() when isSupabaseConfigured; purges ACTIVE_USER_KEY and returns null if no verified JWT session exists.
// 5. Zero plaintext passwords are ever written to localStorage.
export function isGameMaster(profile: UserProfile | null): boolean;
export function isAdmin(profile: UserProfile | null): boolean;
export function canAccessPuzzleStudio(profile: UserProfile | null): boolean;
```

### 2. Unified AI Helper (`src/lib/ai-helper.ts`)
```typescript
export type AIProvider = "gemini" | "openrouter" | "local";

export interface AIHelperConfig {
  preferredProvider?: AIProvider;
  geminiApiKey?: string;
  openRouterApiKey?: string;
}

export async function generate6PicsSynonyms(theme: string, config?: AIHelperConfig): Promise<string[]>;
export async function suggest9RhymesChain(starterWord: string, config?: AIHelperConfig): Promise<{
  starterWord: string;
  clues: Array<{ answer: string; altSpellings?: string[]; sentence: string; hint: string }>;
}>;
export async function generateHaikuDraft(theme: string, config?: AIHelperConfig): Promise<[string, string, string]>;
```

### 3. Custom Puzzles Short-Link Store (`public.custom_puzzles` & `src/lib/custom-game-share.ts`)
```typescript
export type CustomShareGameSlug = "21-things" | "17-syllables" | "9-rhymes" | "6-pics" | "connect-5";

export interface CustomPuzzleRecord<TPayload = unknown> {
  id: string; // e.g. "9r-a1b2c3d4", "6p-a1b2c3d4", "c5-a1b2c3d4", "17s-a1b2c3d4" (< 75 char total URL)
  gameSlug: CustomShareGameSlug;
  title: string;
  creatorId?: string | null;
  creatorName: string;
  creatorHandle: string;
  payload: TPayload;
  createdAt: string;
}
```

### 4. Countdown Game Payloads & Generators (`#9, #8, #6, #4, #2, #1`)
```typescript
// #9 — 9 Rhymes (src/data/puzzles/9-rhymes.ts)
export interface NineRhymesClue {
  answer: string;            // exact target word (letters count drives "_ _ _ _ (N letters)")
  altSpellings?: string[];   // accepted alternative spellings (Q19)
  sentence: string;          // fill-in-the-blank prompt using "____" placeholder
  hint: string;              // description hint (-0.5 pts)
}
export interface NineRhymesPuzzle {
  id: string;
  starterWord: string;
  rhymeFamily: string;
  author: string;
  clues: [
    NineRhymesClue, NineRhymesClue, NineRhymesClue,
    NineRhymesClue, NineRhymesClue, NineRhymesClue,
    NineRhymesClue, NineRhymesClue, NineRhymesClue
  ];
}

// #8 — Eightfold Echo (src/lib/generators/eightfold-echo-generator.ts)
export interface EightfoldEchoTile {
  gridIndex: number;         // 0..8 (4 = Center starting tile, Emerald #2ECC71)
  stepOrder: number;         // 0..8 (Center is stepOrder 0; surrounding 8 tiles are 1..8)
  signatureColor: string;    // permanent position hex color
  svgMarkup: string;         // crisp parametric inline SVG
  ruleExplanation: string;   // 1-line explanation for post-game 0 -> 8 walkthrough
}
export interface EightfoldEchoPuzzle {
  id: string;
  seed: string;
  author: string;
  ruleSummary: string;
  tiles: EightfoldEchoTile[]; // length 9, solver-verified unambiguous 0 -> 8 path
}

// #6 — 6 Pics (src/data/puzzles/6-pics.ts)
export interface SixPicsImageClue {
  imageUrl: string;          // SVG data URI or resilient image URL rendered via <ImageWithFallback>
  caption: string;           // hidden during play; revealed in post-game 2x3 grid
  altText?: string;
}
export interface SixPicsPuzzle {
  id: string;
  themeAnswer: string;       // bold top-center post-game header
  acceptedAliases: string[]; // normalized aliases + Levenshtein <= 1 when length >= 5
  author: string;
  images: [
    SixPicsImageClue, SixPicsImageClue, SixPicsImageClue,
    SixPicsImageClue, SixPicsImageClue, SixPicsImageClue
  ];
}

// #4 — Four Score (src/lib/generators/four-score-generator.ts)
export type FourScoreOperator = "+" | "-" | "*" | "/" | "^2" | "^";
export interface FourScorePuzzle {
  id: string;
  seed: string;
  target: 80;
  numbers: number[];                  // 4..8 single-use integers
  operators: FourScoreOperator[];     // >= 3 single-use operators (binary_ops === numbers.length - 1)
  canonicalEquation: string;          // solver-verified whole-number full-board equation === 80
  author: string;
}

// #2 — Move Two (src/lib/generators/move-two-generator.ts)
export type DominoPosture = "UPRIGHT" | "FLAT_H" | "FLAT_V";
export type MoveTwoCellType = "floor" | "wall" | "hazard" | "portal" | "target";
export interface MoveTwoFace {
  faceNumber: 1 | 2 | 3 | 4 | 5 | 6;
  grid: MoveTwoCellType[][];          // 3x3
  entryCells: Array<[number, number]>;
  entryPosture: DominoPosture;
  exitEdge?: "top" | "right" | "bottom" | "left"; // Faces 1..5
  targetCells?: Array<[number, number]>;         // Face 6
  targetPosture?: DominoPosture;                 // Face 6 exact win posture
}
export interface MoveTwoPuzzle {
  id: string;
  seed: string;
  par: number;                        // exact BFS shortest-path moves across Faces 1 -> 6
  faces: [MoveTwoFace, MoveTwoFace, MoveTwoFace, MoveTwoFace, MoveTwoFace, MoveTwoFace];
  author: string;
}

// #1 — 1 Win (src/data/puzzles/1-win.ts & public.one_win_submissions)
export interface OneWinLeaderboardRow {
  rank: number;
  canonicalKey: string;
  displayText: string;                // Title Case
  count: number;
}
export function normalizeOneWinEntry(raw: string): {
  valid: boolean;
  error?: string;
  canonicalKey: string;
  displayText: string;
  wordCount: number;
};
```

### 5. Unified 9-Game Stats (`src/lib/game-storage.ts` & `src/lib/user-auth.ts`)
```typescript
export type AllGameSlug =
  | "21-things"
  | "17-syllables"
  | "9-rhymes"
  | "eightfold-echo"
  | "6-pics"
  | "connect-5"
  | "four-score"
  | "move-2"
  | "1-win";

export type AllGameStatsMap = Record<AllGameSlug, GameStats>;
```

---

## Code Layout & Write-Ownership Boundaries
- **Implementation Track Exclusive Ownership** (sequential milestones `M1 -> M2 -> M3 -> M4 -> M5`, never concurrent):
  - `src/app/**`: Routes, homepage (`page.tsx`), `/account`, `/admin`, `/games/<slug>/page.tsx`, `/games/[slug]/archive/page.tsx`
  - `src/components/**`: `<GameLogo>`, `<GameSplashScreen>`, `<GameShell>`, `<GameArchiveView>`, `<GameErrorBoundary>`, `<ImageWithFallback>`, `games/*.tsx`, `account/*.tsx`, `admin/*.tsx`
  - `src/lib/**`: `games-config.ts`, `daily-engine.ts`, `game-storage.ts`, `user-auth.ts`, `moderation.ts`, `seeded-random.ts`, `custom-game-share.ts`, `diagnostic-errors.ts`, `supabase.ts`, `ai-helper.ts`, `generators/*.ts`
  - `src/data/puzzles/**`: 66-day puzzle banks for `21-things`, `17-syllables`, `9-rhymes`, `eightfold-echo`, `6-pics`, `connect-5`, `four-score`, `move-2`, `1-win`
  - `supabase/**`: `schema.sql` + `supabase/migrations/*.sql`
  - `scripts/**` & `tests/m1-b1-harness.ts`: Unit/solver/challenger test scripts & `generate-monthly-batch.ts`
  - `package.json`, `PROJECT.md`, `GAME_DESIGN_BIBLE.md`
- **E2E Testing Track Exclusive Ownership** (`e2e_orch_1` in parallel with `M1`–`M4`):
  - `tests/e2e/**`: Opaque-box 4-tier E2E runner and test suites (MUST NOT statically import unimplemented future `src/` modules; MUST keep `npm run lint` and `npm run build` 100% green at all times; MUST NOT touch `package.json`, `src/`, `scripts/`, `supabase/`, or git commits/pushes).
  - `TEST_INFRA.md` & `TEST_READY.md` (at repo root, excluded from git via `.git/info/exclude`).
- **Agent Metadata Exclusive Ownership** (NEVER staged or committed to git):
  - `.agents/teamwork/**`
