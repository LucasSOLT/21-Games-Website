# Project: 21 Games (SOL GaMES) Platform Modernization

## Architecture
- **Framework & Deployment**: Next.js 16 App Router, React 19, Tailwind CSS. Static export architecture (`output: 'export'`), basePath `/solgames` for production deployment on `https://www.solworld.ai/solgames/` (and local root build for domain roots).
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

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Branding, Vector Logo, Favicon & Content Sanitization | R1 (Logo, Favicon, Metadata), R5 (Text Sanitization), R4 (Real 21 Things Comments) | None | DONE |
| M2 | RBAC, Puzzle Studio Permissions & Global State Persistence | R2 (Roles, GM Init, Studio Guarding, User Management), R3 (Global Persistence) | None | DONE |
| M3 | Custom Game Creation, Short Links, Native Sharing & Direct Routing | R6 (Auth Guard, Short Links, Redirect Prevention, Native Sharing) | M2 | DONE |
| M4 | Final E2E Test Suite & Adversarial Hardening | Dual Track Phase 1 (100% E2E test pass) & Phase 2 (Adversarial Coverage Hardening) | M1, M2, M3 | DONE |


## Interface Contracts

### User Roles & Permissions (`src/lib/user-auth.ts`)
```typescript
export type UserRole = "game_master" | "admin" | "user";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  handle: string;
  avatarColor: AvatarColor;
  role: UserRole;
  isBanned: boolean;
  bannedAt?: string | null;
  bannedReason?: string | null;
  memberSince: string;
  connect5Stats: GameStats;
  twentyOneStats: GameStats;
  boardsCreatedCount: number;
  createdBoardIds: string[];
  recentPicks: RecentResonancePick[];
  authMode: "supabase" | "local";
  lastSyncedAt: string;
}

export function isGameMaster(profile: UserProfile | null): boolean;
export function isAdmin(profile: UserProfile | null): boolean;
export function canAccessPuzzleStudio(profile: UserProfile | null): boolean;
export function checkDateEditPermission(
  profile: UserProfile | null,
  targetDateKey: string,
  todayDateKey?: string
): { canEdit: boolean; reason?: string; isPast: boolean; isToday: boolean; isFuture: boolean };
```

### Global Persistence & Storage (`src/lib/game-storage.ts`)
```typescript
export async function syncAllRemoteDailyPuzzles(): Promise<void>;
export async function saveAdminConnect5Override(
  dateKey: string,
  puzzle: Connect5Puzzle
): Promise<{ ok: boolean; remotePersisted: boolean; error?: string }>;
export async function saveAdmin21ThingsOverride(
  dateKey: string,
  board: TwentyOneThingsBoard
): Promise<{ ok: boolean; remotePersisted: boolean; error?: string }>;
```

### Custom Game Sharing & Routing (`src/lib/custom-game-share.ts` or `daily-engine.ts`)
```typescript
export function generateShortGameId(): string;
export async function shareCustomGame(options: {
  title: string;
  creatorHandle: string;
  shareUrl: string;
}): Promise<{ shared: boolean; copied: boolean }>;
```

## Code Layout
- `public/`: Static assets (`logo.svg`, `favicon.svg`, `og-image.png`)
- `src/app/layout.tsx`: Root metadata, favicon references, OpenGraph/Twitter tags
- `src/app/page.tsx`: Homepage featured cards and footer copy
- `src/app/admin/page.tsx`: Admin Puzzle Studio with RBAC gating, date-locking, user management
- `src/components/hero.tsx` & `hero.css`: Top navbar logo mark
- `src/components/game-shell.tsx`: Subpage header brand mark
- `src/components/games/twenty-one-things.tsx`: 21 Things gameplay, custom creator auth guard, direct routing, real comments
- `src/components/account/profile-viewer-modal.tsx`: Profile modal & sanitized placeholders
- `src/lib/user-auth.ts`: Authentication, user roles, permission checks
- `src/lib/game-storage.ts`: Persistence engine, remote puzzle sync, journey submissions
- `src/lib/daily-engine.ts`: Date difference logic, short link encoding
- `supabase/schema.sql`: Postgres schema, table migrations, and RLS policies
