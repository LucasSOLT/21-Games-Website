# Project: 21 Games (SOL GaMES) Platform Modernization

## Architecture
- **Framework & Deployment**: Next.js 16 App Router, React 19, Tailwind CSS. Static export architecture (`output: 'export'`), root `basePath` (`""`) for standalone production deployment on `https://21games.ai` from `gerardrickjardin/21-Games-Website` (with legacy `/solgames` subpath redirects).
- **Backend & Persistence**: Supabase PostgreSQL database via `@supabase/supabase-js`. Client-side authentication and direct Supabase database interactions with Postgres RLS policies.
- **State Management**: React state + `localStorage` client caching + global event bus (`"solgames:puzzles-updated"`) synchronized with Supabase tables (`public.daily_puzzles`, `public.user_profiles`, `public.twenty_one_responses`, `public.twenty_one_boards`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1.1 Header Vector Logo | Catchy, professional minimalist vector SVG logo fitting NYT aesthetic in top-left header without negative margin hacks | M1 | Survey Explorer 1 |
| 2 | R1.2 Vector Favicon | Minimalist SVG vector favicon (`favicon.svg`) with fallback icon support | M1 | Survey Explorer 1 |
| 3 | R1.3 Metadata & Social Preview | App layout metadata with `icons`, `openGraph`, `twitter` cards, and `metadataBase` | M1 | Survey Explorer 1 |
| 4 | R5.1 Input Placeholder Sanitization | Replace "Lucas Huff" in input placeholders (`twenty-one-things.tsx`, `profile-viewer-modal.tsx`) with generic names | M1 | Survey Explorer 1 |
| 5 | R5.2 Admin Form Defaults Sanitization | Sanitize Admin Puzzle Studio input defaults, author fallbacks, and rotation in `admin/page.tsx` and `daily-engine.ts` | M1 | Survey Explorer 1 |
| 6 | R5.3 Editorial & Schema Sanitization | Sanitize homepage footer copy (`page.tsx`) and table defaults (`schema.sql`) to generic team attribution | M1 | Survey Explorer 1 |
| 7 | R4.1 Real 21 Things Comments | Remove mock `sampleJourneys` in `src/data/puzzles/21-things.ts` and `game-storage.ts` | M1 | Survey Explorer 3 |
| 8 | R4.2 Supabase Comments Integration | Pure Supabase + local user responses with clean empty-state fallback in `twenty-one-things.tsx` | M1 | Survey Explorer 3 |
| 9 | R2.1 User Role Definitions | Extend `UserProfile` with `role: 'game_master' \| 'admin' \| 'user'`, `isBanned`, `bannedAt`, `bannedReason` | M2 | Survey Explorer 2 |
| 10 | R2.2 Game Master Initialization | Initialize `lucas@soltheory.com` and `steve@soltheory.com` as permanent Game Masters with immunity | M2 | Survey Explorer 2 |
| 11 | R2.3 Studio Access Guarding | Bar unauthenticated guests and standard users from Admin Puzzle Studio with NYT Access Denied card | M2 | Survey Explorer 2 |
| 12 | R2.4 Admin Date Permissions | Admins can only edit future puzzles (`diff > 0`); today and past puzzles are locked in read-only mode | M2 | Survey Explorer 2 |
| 13 | R2.5 Game Master Permissions | Game Masters can edit today, past, and future puzzles across all dates | M2 | Survey Explorer 2 |
| 14 | R2.6 User Management Console | Game Masters can promote users to admins, demote admins to users, and ban/unban user accounts | M2 | Survey Explorer 2 |
| 15 | R3.1 Global Game State Persistence | Implement `syncAllRemoteDailyPuzzles()` to load Supabase `daily_puzzles` across all devices and sessions | M2 | Survey Explorer 2 |
| 16 | R3.2 Studio Global Save Feedback | Persist Connect 5 and 21 Things edits to Supabase with global update event propagation to homepage and archive | M2 | Survey Explorer 2 |
| 17 | R6.1 Custom Game Creation Auth Gate | Require authentication to create custom 21 Things games (header button, URL param, publish action) | M3 | Survey Explorer 3 |
| 18 | R6.2 Compact Custom Game Links | Generate short, compact URLs (`?b=<short_id>`) backed by Supabase `twenty_one_boards`, eliminating parameter blobs | M3 | Survey Explorer 3 |
| 19 | R6.3 Direct Routing & No Redirection | Isolate custom board loading lifecycle so opening shared links loads the custom board directly without falling back to today's game | M3 | Survey Explorer 3 |
| 20 | R6.4 Native Sharing & Creator Blurb | Invoke `navigator.share` (with clipboard copy fallback) with attributed creator username (`@handle`) | M3 | Survey Explorer 3 |
| 21 | E2E Dual Track Verification | Complete 4-tier E2E testing and adversarial verification across all requirements | M4 | Top-level Dual Track |
| 22 | B1.R1.1 Countdown Order Lineup | Order `ALL_GAMES` strictly `21 → 17 → 9 → 8 → 6 → 5 → 4 → 2 → 1` in `src/lib/games-config.ts` | M1-B1 | Survey Explorer 1 |
| 23 | B1.R1.2 Four Score Replacement | Replace "The 11th Hour" with "Four Score" (#4) in `games-config.ts` and `game-logo.tsx` | M1-B1 | Survey Explorer 1 |
| 24 | B1.R1.3 NYT Vector Emblems | Add and refine vector emblems for Four Score, 9 Rhymes, Eightfold Echo, Move Two, 1 Win in `game-logo.tsx` | M1-B1 | Survey Explorer 1 |
| 25 | B1.R2.1 Two-Tier Moderation Engine | Create `src/lib/moderation.ts`: Tier 1 universal slur/hate ban + leetspeak normalization; Tier 2 public profanity ban | M2-B1 | Survey Explorer 2 |
| 26 | B1.R2.2 21 Things Moderation Wiring | Moderate journey submissions and custom board creation in `twenty-one-things.tsx` and `game-storage.ts` | M2-B1 | Survey Explorer 2 |
| 27 | B1.R2.3 Admin Studio Moderation Wiring | Moderate Connect 5 and 21 Things editor inputs on save in `src/app/admin/page.tsx` | M2-B1 | Survey Explorer 2 |
| 28 | B1.R2.4 Profile Moderation Wiring | Moderate display name and handle edits in `profile-viewer-modal.tsx` and `user-auth.ts` | M2-B1 | Survey Explorer 2 |
| 29 | B1.R3.1 Game Error Boundary | Implement `<GameErrorBoundary>` with state-reset recovery button around 21 Things and Connect 5 | M3-B1 | Survey Explorer 3 |
| 30 | B1.R3.2 Image With Fallback | Create `<ImageWithFallback>` with inline SVG fallback to prevent broken images | M3-B1 | Survey Explorer 3 |
| 31 | B1.R3.3 Seeded PRNG & Payload Validation | Create `src/lib/seeded-random.ts` with Mulberry32 PRNG, payload validators, and content hashing | M3-B1 | Survey Explorer 3 |
| 32 | B1.R4.1 Game Master Roles | Add `luke@soltheory.com` alongside `steve@soltheory.com` and `lucas@soltheory.com` in `user-auth.ts` and `schema.sql` | M4-B1 | Survey Explorer 3 |
| 33 | B1.R4.2 Admin vs GM Date Permissions | Restrict Admins to future puzzles only (`diff > 0`); allow Game Masters all dates | M4-B1 | Survey Explorer 3 |
| 34 | B1.R4.3 Admin Confirmation Modal | Add confirmation modal popup before publishing puzzle modifications in `/admin` | M4-B1 | Survey Explorer 3 |
| 35 | B1.R4.4 Global Persistence & Board Re-Sync | Persist puzzle changes to Supabase and re-sync active board state on puzzle content/hash change | M4-B1 | Survey Explorer 3 |
| 36 | B1.R5 Live Deployment & Git Sync | Lint, build, deploy:solworld sync, dual repo git commit/push, and halt for user permission | M5-B1 | Top-level Orchestrator |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Initial Platform Polish (Prior) | R1 (Logo, Favicon), R5 (Sanitization), R4 (Real 21 Things Comments) | None | DONE |
| M2 | RBAC & Persistence (Prior) | R2 (Roles, GM Init, Studio Guarding), R3 (Global Persistence) | None | DONE |
| M3 | Custom Game Sharing (Prior) | R6 (Auth Guard, Short Links, Native Sharing, Direct Routing) | M2 | DONE |
| M4 | Final E2E Suite (Prior) | Dual Track Phase 1 & Phase 2 verification | M1, M2, M3 | DONE |
| M1-B1 | Countdown Lineup & Vector Emblems | R1 (Strict 21 → 1 order, Four Score replaces 11th Hour, 5 NYT-style vector emblems) | None | DONE |
| M2-B1 | Two-Tier Content Moderation Engine | R2 (Moderation engine in `moderation.ts`, wiring into 21 Things, Admin Studio, Profile) | None | DONE |
| M3-B1 | Resilient Infrastructure & Seeded PRNG | R3 (`<GameErrorBoundary>`, `<ImageWithFallback>`, `seeded-random.ts` + payload validation) | None | DONE |
| M4-B1 | Admin Puzzle Studio Persistence & Permissions | R4 (GM roles with Luke, Admin future-only, confirmation modal, Supabase sync & board re-sync) | M2-B1, M3-B1 | DONE |
| M17 | 17 Syllables Playable Countdown Game | Pre-game splash screen, 66-day haiku bank, playable drag/tap UI, route, custom share | M1-B1, M2-B1, M3-B1 | DONE |
| M5-B1 | Full Verification & Live Deployment Sync | R5 (Lint, build, unit test suites, deploy:solworld, git push both repos, halt for permission) | M1-B1, M2-B1, M3-B1, M4-B1, M17 | DONE |

## Interface Contracts

### Content Moderation (`src/lib/moderation.ts`)
```typescript
export type ModerationMode = "public" | "private";

export interface ModerationResult {
  allowed: boolean;
  tier?: 1 | 2;
  flaggedReason?: string;
  flaggedWord?: string;
  sanitizedText?: string;
}

export interface ModerationOptions {
  mode: ModerationMode;
  field?: string;
  allowEmpty?: boolean;
}

export function checkContentModeration(text: string, options: ModerationOptions): ModerationResult;
export function checkMultipleFields(fields: Record<string, string>, options: ModerationOptions): ModerationResult;
export function normalizeForModeration(input: string): string;
```

### Resilient Infrastructure (`src/components/game-error-boundary.tsx`, `src/components/image-with-fallback.tsx`, `src/lib/seeded-random.ts`)
```typescript
// Error Boundary
export interface GameErrorBoundaryProps {
  gameSlug: "21-things" | "connect-5";
  gameTitle: string;
  children: React.ReactNode;
  storageKeysToReset?: string[];
  onReset?: () => void;
}

// Image With Fallback
export interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSvgTitle?: string;
  fallbackIcon?: React.ReactNode;
}

// Deterministic PRNG & Payload Validation
export function createSeededRandom(slug: string, dateKey: string): () => number;
export function seededShuffle<T>(array: readonly T[], rng: () => number): T[];
export function computePuzzleContentHash(payload: unknown): string;
export function validateConnect5Payload(puzzle: unknown): { valid: boolean; errors: string[] };
export function validate21ThingsPayload(board: unknown): { valid: boolean; errors: string[] };
```

### User Roles & Permissions (`src/lib/user-auth.ts`)
```typescript
export const INITIAL_GAME_MASTERS: readonly string[] = [
  "lucas@soltheory.com",
  "steve@soltheory.com",
  "luke@soltheory.com",
] as const;

export function isGameMaster(profile: UserProfile | null): boolean;
export function isAdmin(profile: UserProfile | null): boolean;
export function checkDateEditPermission(
  profile: UserProfile | null,
  targetDateKey: string,
  todayDateKey?: string
): { canEdit: boolean; reason?: string; isPast: boolean; isToday: boolean; isFuture: boolean };
```

## Code Layout
- `public/`: Static assets (`logo.svg`, `favicon.svg`, `og-image.png`, `boxes-bg.png`, `hands.png`)
- `src/lib/games-config.ts`: Countdown order `#21 → #1`, Four Score (#4), game metadata
- `src/components/game-logo.tsx`: NYT-style vector emblems for all 9 games
- `src/lib/moderation.ts`: Two-tier content moderation engine
- `src/components/game-error-boundary.tsx`: React error boundary with state-reset recovery button
- `src/components/image-with-fallback.tsx`: Fallback image component with inline SVG
- `src/lib/seeded-random.ts`: Deterministic Mulberry32 PRNG, payload validators, content hashing
- `src/lib/user-auth.ts`: Authentication, user roles, permission checks
- `src/lib/game-storage.ts`: Persistence engine, remote puzzle sync, board state invalidation
- `src/app/admin/page.tsx`: Admin Puzzle Studio with confirmation modal popup, date gating
- `src/app/games/21-things/page.tsx` & `connect-5/page.tsx`: Error boundary wrapped playable routes
- `src/components/games/twenty-one-things.tsx`: 21 Things gameplay, moderation wiring, board re-sync
- `src/components/games/connect-five.tsx`: Connect 5 gameplay, board re-sync
- `src/components/account/profile-viewer-modal.tsx`: Profile modal & moderation checks
- `supabase/schema.sql`: Postgres schema, table migrations, and RLS policies
