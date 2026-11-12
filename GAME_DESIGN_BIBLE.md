# SOL GaMES (`21-Games-Website`) — Master Game Design Bible (`21 → 1`)

> [!IMPORTANT]
> **Living Canonical Source of Truth (Never Delete or Ignore)**
> This document locks in **100% of Lucas's finalized game mechanics, UI/UX directives, scoring formulas, AI automation rules, zero-breakage self-healing rules, and two-tier content moderation policies** across all 9 active games in the **21 → 1** countdown.
> - **Brain Artifact Path**: `/Users/lucashuff/.gemini/antigravity/brain/dbbaad6f-e60d-4513-9d8d-e17e75b32882/game_design_bible.md`
> - **Codebase Mirror Path**: `/Users/lucashuff/.gemini/antigravity/scratch/21-Games-Website/GAME_DESIGN_BIBLE.md` (referenced in `AGENTS.md`)

---

## 0. Global Architectural Directives (Platform-Wide Rules)

### 0.1 Strict NYT Games Minimalist Aesthetic
- Every screen, header, modal, keyboard, and transition across the entire platform must feel **smart, creative, flat, and minimalistic—just like NYT Games**.
- Never clutter the UI or overwhelm the user. Keep typography crisp (`Roboto Slab` / editorial serif headlines + `Inter` UI + `JetBrains Mono` counters), spacing generous, and status bars ultra-clean.

### 0.2 Unified AI Integration (Google AI Studio Free Tier + OpenRouter)
- Provide a unified AI helper service (`src/lib/ai-helper.ts` + CLI/script runners for batch generation and client/admin helper hooks) supporting **both**:
  1. **Google AI Studio Free Tier (`gemini-2.5-flash` via `GEMINI_API_KEY` / `NEXT_PUBLIC_GEMINI_API_KEY`)** — **DEFAULT provider (`$0.00` ongoing cost)**.
  2. **OpenRouter (`OPENROUTER_API_KEY` / `NEXT_PUBLIC_OPENROUTER_API_KEY`)** — pre-wired and toggleable in `/admin` or via environment config.
- **Deterministic Local Code Fallbacks**: Every AI helper function must pair with a deterministic algorithmic fallback so the site and `/admin` studio work with zero failures even if no API key is configured or an API is rate-limited.

### 0.3 1-Month Rolling Buffer & Monthly Batch Automation (`Month M+2`)
- At the end of every month (`Month M`), the platform generates and validates a full month's batch of daily games for the month *after* next (`Month M+2`), maintaining a permanent **1-month rolling buffer**.
- **Two Authoring Categories**:
  1. **Human-Editable + AI-Assisted Games (`21 Things`, `17 Syllables`, `9 Rhymes`, `6 Pics`, `Connect 5`)**:
     - Clean `/admin` studio forms where Game Masters / Admins can hand-craft puzzles or click AI helper buttons (e.g., `"Auto-Generate Synonyms/Aliases"` in `6 Pics`, rhyme-chain assistant in `9 Rhymes`, haiku slice previewer in `17 Syllables`, or monthly batch draft generator).
  2. **100% Auto-Generated Games (`Eightfold Echo`, `Four Score`, `Move Two`)**:
     - Do **not** build complex manual `/admin` puzzle editors for these three games.
     - Build deterministic programmatic generators + mathematical/pathfinding solvers (`npm run generate-batch` CLI script + a 1-click **"Generate Month M+2 Batch"** button, monthly reminder banner, and simple per-day **Preview / Reroll Seed** button in `/admin`).

### 0.4 Zero-Day / Zero-Breakage Self-Healing Architecture
- **Per-Game React Error Boundary (`<GameErrorBoundary>`)**: Wrap every individual game component in a dedicated React Error Boundary with an instant **"Reset / Reload Puzzle State"** recovery button so a corrupted `localStorage` state or runtime glitch can never crash the page.
- **Strict Payload Schema Validation**: Validate every puzzle payload (from Supabase, `localStorage`, custom share links, or static banks) with strict runtime schema validators before rendering.
- **Deterministic Date-Seeded Fallback (`seed = YYYY-MM-DD`)**: If a Supabase fetch, override, or scheduled batch is ever missing or malformed for any daily game on any date (`past`, `today`, or `future`), automatically fall back to a deterministic date-seeded generator (`hash(gameSlug + ":" + dateKey)`) in the client so a player **never** sees a blank screen, 404, or missing daily puzzle.
- **Zero Broken Images**: Use inline code-generated SVGs and `<ImageWithFallback>` components so broken image icons are impossible.

### 0.5 Two-Tier Content Moderation & Profanity Filter (`src/lib/moderation.ts` + Supabase Trigger)
- **Tier 1 — Absolute Global Ban (Everywhere, Zero Exceptions)**:
  - Strictly block all racial slurs (including the N-word and all phonetic/leetspeak variants), hate speech, and derogatory slurs across the **entire platform**—including public daily games, private link-shared custom games, user profile names/handles, `21 Things` reflections, `1 Win` submissions, and `/admin` inputs.
- **Tier 2 — Public vs. Private Link-Shared Profanity Rule**:
  - **Public Website / Daily Games / Public Leaderboards (`1 Win`, daily `21 Things` reflections, public profiles, `/admin` daily puzzles)**: Strictly block all R-rated swear words and profanity (`100%` family-friendly/clean public surfaces).
  - **Private Link-Shared Custom Games (Creator Mode links `?b=<id>` shared with friends)**: Allow casual swear words (`"fuck"`, `"shit"`, `"bitch"`, etc.) inside user-created link-shared games and their private friend responses, while still strictly enforcing the **Tier 1** ban on racial slurs and hate speech.

### 0.6 Step 2.5 — Auth & Postgres Security Lockdown (LIVE; migrations `20261111000001` + `20261111000002`)
- **Root Game Masters (hard-coded, server + client)**: exactly `lucas@soltheory.com` and `steve@soltheory.com`. Nobody else can ever hold `game_master` (DB trigger demotes it; `admin_set_user_role` refuses it; client `updateUserRole` refuses it). Root GMs cannot be demoted or banned and their profile email is immutable. There is no `luke@soltheory.com` anywhere.
- **Roles**: `user` (default), `admin` (may create/edit **future-dated** daily puzzles only), `game_master` (full control incl. live/past puzzles, deletes, role & ban management). Roles/ban status are changed **only** by a root GM through the RPCs `admin_set_user_role(target_email, new_role)` / `admin_set_user_banned(target_email, banned, reason)`, which re-check `is_root_game_master()` server-side and return the rows affected (0 rows is reported to the UI as failure, never as success).
- **Sign-in rules**: email + password required (min 6 chars on sign-up/reset, non-empty and non-whitespace-only on sign-in, passed verbatim without silently `.trim()`-mutating valid leading/trailing spaces, and zero auto-generated or default fallback passwords). **Signup** requires email confirmation: with no session returned the UI shows "check your inbox" and activates nothing. **Magic link** only *sends* the OTP email; it never creates a local session — the session exists only after the user follows the emailed link and Supabase returns a verified JWT. No local/offline fallback accounts; passwords are never stored (legacy plaintext `password` fields are scrubbed on load).
- **Trust model (client)**: browser storage is attacker-editable and is never trusted. A session counts only if GoTrue confirms it (`auth.getUser(jwt)`), the profile/ban lookup succeeded (**any lookup error fails closed** — no verified profile, never "not banned"), and the role comes from the server-verified profile (storage role is clamped to `user` unless it is a root-GM email or matches the last verified profile). Banned accounts are signed out immediately and auth storage is cleared. Game-Master UI (`/admin` studio, creator tools) additionally requires the verified JWT email to be on the root roster. UI gating is cosmetic (static export) — **Postgres RLS is the real security boundary**.
- **Custom creator gates**: `17 Syllables` and `21 Things` custom creators (`?mode=create`) require a signed-in, non-banned account; every user-authored field (incl. theme/creator name) passes Tier-1 moderation.
- **Database (Supabase `trwyrfhicbnfhlbiztau`, migrations `20261111000001`, `20261111000002`, `20261112000001`, `20261112000002`)**: RLS on every table (`daily_puzzles`, `user_profiles`, `twenty_one_boards`, `twenty_one_responses`, `twenty_one_journeys`, `custom_puzzles`, `one_win_submissions`); `anon` has SELECT only on public puzzle/community tables (+ bounded moderated INSERT on `twenty_one_responses`, `twenty_one_journeys`, and `one_win_submissions`) and **no access at all to `user_profiles`** (no email enumeration). `authenticated` users read/update only their own profile, and **column-level grants** limit what they can write to `display_name, handle, avatar_color, connect5_stats, twenty_one_stats, all_game_stats, recent_picks, created_board_ids, updated_at` (INSERT additionally `id, email`); `role`, `is_banned`, `banned_*`, `email`, `id`, `created_at` are not API-writable. The `enforce_user_profile_security()` trigger is the second layer: it classifies callers from `auth.role()`, the `request.jwt.claims` JSON GUC, the legacy GUC, `auth.uid()`, and `session_user` — **never `current_user`** (always the owner inside `SECURITY DEFINER`) — and only `service_role` or a JWT-less non-API session (migrations / SQL editor / GoTrue) bypasses it, raising `42501` on any unauthorized `INSERT` or `UPDATE`.
- **New-table rule**: any new table must enable RLS and define explicit grants + policies in the *same* migration — Supabase's default privileges (plus migration `20261111000001`'s `alter default privileges`) hand `anon` SELECT and `authenticated` SELECT/INSERT/UPDATE on every new `public` table, so a table without RLS would be wide open.
- **Universal Completion Share Invariant**: Every completion screen across all 9 countdown games renders two distinct actions: **Share** (`nativeShareResultsOnly` — calls `navigator.share({ title, text: fullTextWithUrl })` with no separate `url` property so iOS/macOS Messages retains emojis + score + link, and never writes to clipboard) and **Copy results** (`copyResultsOnly` — writes to clipboard only with `"Copied!"` feedback for `2000ms`, and never invokes `navigator.share`).
- **Verification (must stay green)**: `scripts/test-step2-5-auth-lockdown.ts`, `scripts/verify-auth-security-lockdown.ts`, `scripts/test-step2-5-escalation.ts`, `npm test` (`CP1–CP10`), and `npm run generate-batch -- --dry-run`.

---

## 1. Platform Vision & The `21 → 1` Countdown Lineup (Part A: Q1–Q4 — ALL 9 LIVE)

### Q1. Homepage 9-Card Countdown Grid (`21 → 17 → 9 → 8 → 6 → 5 → 4 → 2 → 1`)
- Remove *The 11th Hour* from the active 9-card grid and replace it with **Four Score (`#4`)**.
- Order all 9 games on the homepage in strict **countdown order**:

| Countdown # | Game Title | Route Slug | Color Theme | Creator Mode (`showCreate`) | Authoring Mode |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **21** | **21 Things** | `/games/21-things` | `customPurple2` | `true` (Link-shareable) | Human + AI Assisted |
| **17** | **17 Syllables** | `/games/17-syllables` | `green` | `true` (Link-shareable) | Human + AI Assisted |
| **9** | **9 Rhymes** | `/games/9-rhymes` | `customYellow2` | `true` (Link-shareable) | Human + AI Assisted |
| **8** | **Eightfold Echo** | `/games/eightfold-echo` | `customPurple2` | `false` (Daily only) | 100% Auto-Generated + Solver |
| **6** | **6 Pics** | `/games/6-pics` | `customF4D621` | `true` (Link-shareable) | Human + AI Assisted |
| **5** | **Connect 5** | `/games/connect-5` | `grey` | `true` (Link-shareable) | Human + AI Assisted |
| **4** | **Four Score** | `/games/four-score` | `yellow` | `false` (Daily only) | 100% Auto-Generated + Solver |
| **2** | **Move Two** | `/games/move-2` | `green` | `false` (Daily only) | 100% Auto-Generated + BFS Solver |
| **1** | **1 Win** | `/games/1-win` | `grey` | `false` (Daily Live Community) | Daily Live Supabase Aggregation |

*(Reserved future countdown slots: `?20?`, `?19?`, `?18?`, `?16?`, `?15?`, `?14?`, `?13?`, `?12?`, `The 11th Hour (#11)`, `?10?`, `?7?`, `?3?`.)*

### Q2. Universal NYT-Style Pre-Game Splash Screen (`<GameSplashScreen>`)
- **Every game** (`21 Things`, `17 Syllables`, `9 Rhymes`, `Eightfold Echo`, `6 Pics`, `Connect 5`, `Four Score`, `Move Two`, `1 Win`) displays a minimalist, color-coded NYT Games-style splash screen before gameplay begins (or "Continue" if already in progress / "See Results" if completed today):
  - Displays the custom vector `GameLogo` (`variant="featured"`), Game Title, 1-line tagline, today's formatted date, `Puzzle #<N>`, Author/Theme attribution (e.g., today's Haiku theme in `17 Syllables`), a primary **"Play"** pill button, and a secondary **"Create Your Own"** button for the 5 `showCreate: true` games.
  - Dismissing the splash screen starts the game timer (for timed games like `Connect 5` and `Eightfold Echo`).

### Q3. Creator Mode (`Create & Share`)
- Enabled (`showCreate: true`) on **5 games**: `21 Things`, `17 Syllables`, `9 Rhymes`, `6 Pics`, and `Connect 5`.
- Requires authentication to publish; generates compact `?b=<short_id>` links (`< 75` chars) stored in Supabase `custom_puzzles` / `twenty_one_boards`, invokes native `navigator.share` + clipboard copy with `@handle` attribution, applies Tier 2 moderation (allows casual swearing, blocks Tier 1 slurs), and routes directly to the custom game without ever redirecting to today's daily game.
- Disabled (`showCreate: false`) on **4 games**: `Eightfold Echo`, `Four Score`, `Move Two`, and `1 Win`.

### Q4. Unified Daily Score & Profile Viewer Stats (`UnifiedNineGameStats`)
- Expand `GameStats` in `src/lib/game-storage.ts`, `user_profiles.all_game_stats` in Supabase, and the NYT-style `ProfileViewerModal` + `/account` page (`src/components/account/unified-nine-game-stats.tsx`) so every one of the 9 games has its own dedicated stats card in strict `21 → 1` countdown order:
  - **21 Things**: Played, Current/Max Streak, `#1` Picks Logged, Boards Created, Recent `#1` Gratitude Picks log, Created Boards list.
  - **17 Syllables**: Played, Win %, Current/Max Streak, Average Star Rating (`⭐⭐⭐`).
  - **9 Rhymes**: Played, Current/Max Streak, Average Score (`x / 9`), Flawless `9/9` count.
  - **Eightfold Echo**: Played, Win %, Current/Max Streak, Best Time (`MM:SS`), Zero-Mistake solves.
  - **6 Pics**: Played, Win %, Current/Max Streak, Average Score (`x / 36`), Flawless `36/36` count, visual `6 pts → 1 pt` Piece-Efficiency Distribution bars.
  - **Connect 5**: Played, Win %, Current/Max Streak, Best Time (`MM:SS`), Average Time.
  - **Four Score**: Played, Win %, Current/Max Streak, Total `80` Equations Solved.
  - **Move Two**: Played, Win %, Current/Max Streak, Best Moves vs. Par, `⭐⭐⭐` Par count.
  - **1 Win**: Total Daily Wins Logged, Current/Max Streak, Personal Daily Win History Log (`Date → Your Win → Global Rank #`).

---

## 2. Game-by-Game Finalized Specifications (Parts B–H: Q5–Q48)

### Game #21 — `21 Things` (LIVE — Enhanced with 3-Col ↔ 2-Col Zoom, Splash, Moderation & Error Boundary)
- **Route**: `/games/21-things` | **Archive**: `/games/21-things/archive`
- **Core Loop**: Single-screen `3×7` grid narrowing funnel (`21 → 6 [Yellow] → 3 [Purple] → 1 [Green]`), voice/text reflection on the `#1` item, real community journey feed (`twenty_one_responses`), and Creator Mode (`?b=21t-xxxxxxxx`).
- **New Enhancements**:
  - Wrap in `<GameSplashScreen>` and `<GameErrorBoundary>`.
  - **Accessibility Zoom Layout Toggle (`R6`)**: Direct `3 Col` ↔ `2 Col` toggle pill in the top header bar persisted in `localStorage` (`solgames_21t_grid_cols`), enlarging tiles into a square-proportioned 2-column layout with crisp legible typography for mobile and visually impaired players.
  - Enforce Tier 1 + Tier 2 moderation on public daily reflections (strictly clean) vs. private custom boards (Tier 1 slurs blocked, casual swearing allowed).

### Game #17 — `17 Syllables` (Daily 5-7-5 Haiku Reconstruction Puzzle) — Q5 to Q11
- **Route**: `/games/17-syllables` | **Archive**: `/games/17-syllables/archive`
- **Splash Screen**: Shows today's overarching **Haiku Theme** (e.g., *"Autumn Rain & Quiet Courage"*), Puzzle #, Date, Author, and **"Play"** button.
- **Board Structure (Q5 & Q9)**:
  - 3 horizontal lines corresponding to the **5 – 7 – 5** syllable structure of the haiku.
  - **Single-Word Chunks Only (Q5)**: Word gaps are fixed visual spaces on the Wheel-of-Fortune style board. Draggable/tappable chunks only ever split *within* a single word (plus attached trailing/leading punctuation like `|slaugh|` + `|ters,|`), never spanning across whitespace between two words.
  - **Uniform Uppercase Display (Q9)**: All board boxes and tray tiles display in crisp **uniform uppercase** (`THE RAIN FELL AMONG`), and any matching uppercase chunk is accepted in any matching slot.
- **Chunk Slicing & `/admin` Studio (Q6)**:
  - Automatically slices the 3-line haiku into **14–20 variable-length chunks (`1–8` characters each)** within word boundaries.
  - In `/admin`, provide a **"Reshuffle / Preview Slices"** button plus interactive click-between-letters cut toggles so the creator can manually split or merge adjacent chunks within a word.
- **Dual Interaction — Drag-and-Drop + Tap-to-Place (Q7)**:
  - **Pointer Drag-and-Drop**: Drag a multi-letter chunk tile from the tray and drop it onto a word's blank boxes on the board.
  - **Mobile/Desktop Tap-to-Place**: Tap a chunk tile in the tray to select it (highlighted in SOL Yellow), then tap the start box (or empty word span) on the board to place it. Tap any placed chunk on the board to return it to the bottom tray.
- **Strict Collision Rule — Reject Non-Empty Drops (Q8)**:
  - Dropping or tapping a chunk onto a target span of boxes that is **not 100% empty** (or does not match the remaining contiguous empty length of that word) is **rejected**: the chunk returns to the tray and the target word slot performs a subtle horizontal shake.
- **Two-Tier Hints System with Confirmation Modal (Q10)**:
  - Clicking either hint button opens a clean NYT-style confirmation modal so players never spend a hint by mistake:
    1. **Word Hint (max `3x` per game, costs `-1/3` star each)**: Reveals a brief clue/definition or highlights the target word slot and its constituent chunk lengths.
    2. **Tile / Letter Lock Hint (max `2x` per game, costs `-1/2` star each)**: Automatically pulls one unplaced chunk from the tray (or dislodges a wrongly placed chunk) and locks it permanently into its correct board position with a green lock indicator.
  - Star calculation (`0–3` stars): starts at `3.0` stars, minus `1/3` per Word Hint and `1/2` per Tile Reveal Hint.
- **Automatic Full-Board Check & Selective Red Flash (Q11)**:
  - As soon as the final blank box on the haiku board is filled, automatically verify the poem:
    - **If 100% Correct**: Celebratory pause, poem lines glow green, and the Victory & Share modal opens.
    - **If Any Chunks Are Misplaced**: Show a `"Not quite, try again"` toast and **flash ONLY the misplaced chunks red** (leaving correctly placed chunks untouched so the player knows which parts of their haiku are already right).

### Game #9 — `9 Rhymes` (iMessage-Style Text Chat with "Nine") — Q12 to Q19
- **Route**: `/games/9-rhymes` | **Archive**: `/games/9-rhymes/archive`
- **Visual Interface**:
  - Minimalist NYT-meets-Apple-iMessage chat view.
  - **Top Contact Header (Q17)**: Shows **"Nine"** with the `9 Rhymes` mini emblem, the pinned **Starter Word** badge (`Starter: TIME`), and a live uncluttered status pill: `Word 3 of 9 · Score: 2.5 / 9`.
- **Rhyme Family & Word-Length Rules (Q12 & Q13)**:
  - **One Exact Perfect Rhyme Sound (Q12)**: All 10 words in a game (1 Starter Word + 9 target answers) share **one exact Perfect Rhyme sound** (including single- and multi-syllable perfect rhymes like *Time → Dime → Chime → Sublime → Overtime → Paradigm*).
  - **Exact Letter-Count Clue in Every Blank (Q13)**: Nine's fill-in-the-blank prompt always displays spaced underscores matching the exact letter count plus a badge (e.g., `"Finish the sentence: 'Wow, this guy split on a _ _ _ _ (4 letters).'"`) so homophones/near-spellings (`RIME (4)` vs `RHYME (5)`) are 100% unambiguous.
- **Chat Pacing & Typing Indicator (Q16)**:
  - Nine starts the chat with Bubble 1: `"Here's today's word: TIME"` followed immediately by Bubble 2 (Round 1's fill-in-the-blank sentence).
  - Whenever the player sends a guess, requests a hint, or reveals an answer, Nine displays a brief animated iMessage typing indicator bubble (`• • •` for **`400ms`**) before Nine's response bubble pops in, keeping the chat scrolled smoothly to the bottom.
- **Quick-Reply Hint & Reveal Pills with Confirmation Popup (Q15)**:
  - Directly above the iMessage input bar sit two sleek pill buttons:
    1. **`New hint (-0.5 pts)`**: Clicking opens a quick confirmation dialog (*"Use a description hint for this word? Correct guess will be worth 0.5 pts instead of 1.0 pt."*). On confirm, the player sends a blue bubble (`"Can I get a hint?"`), Nine shows `• • •` (`400ms`) and replies with the **description/definition clue**, and the `"New hint"` pill is disabled/hidden for the rest of that round.
    2. **`Reveal answer (0 pts)`**: Clicking opens a confirmation dialog (*"Reveal this word for 0 points and move to the next rhyme?"*). On confirm, a blue bubble sends the answer (`0` pts), Nine acknowledges it, and sends the next round's sentence.
- **Custom On-Screen QWERTY Keyboard & Input Bar (Q14)**:
  - **No native mobile OS keyboard popup (`readOnly` / custom key handler)**.
  - Typing on the custom bottom QWERTY keyboard (or physical desktop keyboard) populates an iMessage-style rounded input bar right above the keyboard with a blue upward arrow (`↑`) submit button (and `Enter` key).
  - **1 Guess Per Word**:
    - **Correct** (matches primary answer or accepted alternative spelling from Q19): Awards `1.0` pt (no hint) or `0.5` pts (after description hint); Nine replies with a randomized motivating phrase and sends the next sentence.
    - **Incorrect**: Awards `0` pts; Nine replies with a randomized gentle miss message and sends the next sentence.
- **End-of-Game Summary & Emoji Share Receipt (Q18)**:
  - After Word 9, Nine texts a final summary bubble (`"That's all 9! You scored 7.5 / 9 today."`) and renders a minimalist NYT-style **Share Results** card that copies a 9-tile emoji receipt (`🟩` = `1.0 pt`, `🟨` = `0.5 pts`, `⬜` = `0.0 pts`).
- **Admin Studio & Accepted Spellings (Q19)**:
  - In `/admin` (and Creator Mode), each of the 9 rows has: `Primary Answer` (determines the letter count), `Accepted Alternative Spellings` (comma-separated optional list), `Fill-in-the-Blank Sentence`, and `Description Hint`.

### Game #8 — `Eightfold Echo` (3×3 Shape Logic Sequence) — Q20 to Q26
- **Route**: `/games/eightfold-echo` | **Archive**: `/games/eightfold-echo/archive`
- **100% Auto-Generated Monthly Batches + Inline Parametric SVG Library (Q20)**:
  - Powered by a deterministic parametric SVG Shape Engine (`src/lib/generators/eightfold-echo-generator.ts`) that renders crisp inline SVGs (circles, polygons, concentric rings, quadrants, half-fills `left/right/top/bottom/solid/hollow`, dot matrices, rotation progressions, complement pairs, and `?` deduction triples) with `<ImageWithFallback>` support for optional custom SVG uploads.
  - Automatically generates and validates full monthly batches (`Month M+2`) and supports deterministic date-seeded fallback (`YYYY-MM-DD`).
- **Signature Position Colors & Dotted-to-Solid Visual Progression (Q21)**:
  - **No `#1, #2, #3` step number badges on completed tiles.**
  - Each of the 9 positions (`row 0..2, col 0..2`) in the `3×3` grid has a **fixed, permanent signature color** that stays consistent every day:
    - Position 4 (Center — Starting Tile `Step 0`): **Emerald Green (`#2ECC71`)**
    - Surrounding 8 Positions (`0, 1, 2, 3, 5, 6, 7, 8`): Distinct curated palette (`#F9D423` Gold, `#9D50BB` Purple, `#3B82F6` Cobalt, `#F97316` Tangerine, `#EC4899` Rose, `#14B8A6` Teal, `#6366F1` Indigo, `#84CC16` Lime).
  - **Active Tile State**: The current tile (starting at Center `Step 0`) shows its crisp SVG shape on a white background inside a **thick dotted border (`3px dashed/dotted`) in that tile's signature color**.
  - **Completed Tile State**: When the player clicks the correct next tile (`Step k`), the previous tile (`Step k-1`) **fills 100% solid with its signature color** (hiding its inner shape completely), and the newly clicked tile (`Step k`) activates with a **dotted border in its own signature color**.
- **Count-Up Stopwatch (`0:00` ↑) & Penalty Rules (Q22)**:
  - Timer starts at `0:00` when the splash screen is dismissed and **counts UP**.
  - Clicking an incorrect tile shakes that tile red, increments the `Mistakes` counter, shows a brief `"Not quite! +5s"` toast, and adds a **`+5s` penalty** to the elapsed time.
- **Zero-Authoring Candidate-Pulse Hint System (Q23)**:
  - Clicking **"Hint (+15s)"** opens a confirmation popup. On confirm, it adds `+15s` to the stopwatch and highlights/pulses **2 candidate tiles** on the board (the true next tile + 1 remaining unvisited decoy tile).
- **Post-Game `0 → 8` Chain & Rule Walkthrough (Q24 & Q26)**:
  - Victory screen displays the final score as **`Solved in 0:42 · 0 Mistakes · ⭐⭐⭐`** (`3 stars` = `0 mistakes & < 60s`, `2 stars` = `≤ 2 mistakes & < 120s`, `1 star` = completed) and reveals the ordered `0 → 8` visual chain with auto-generated 1-line explanations of each step's logic rule.
- **Single-Screen Fit (Q25)**:
  - The `3×3` square grid + compact stopwatch/mistakes bar fits 100% on a single viewport without scrolling on both desktop and `320px` mobile.

### Game #6 — `6 Pics` (6-Piece Jigsaw Image-Naming Game) — Q27 to Q33
- **Route**: `/games/6-pics` | **Archive**: `/games/6-pics/archive`
- **Clean Top Navigation Rule (All Games & Archives)**:
  - Individual game headers (`GameShell`) and archive headers (`GameArchiveView`) **never** render a multi-game horizontal pill switcher bar (which crowds centered titles with 9 live games). Players return to the homepage via the `SOL GaMES` mark or `← All Games` button to switch games.
- **Visible Overarching Theme + 6 Jigsaw-Covered Images (Q27 & Q28)**:
  - The puzzle's **Overarching Theme** (e.g., `Theme: Hawaii`) is **visible at the top** throughout gameplay to guide the player's guesses.
  - Players progress sequentially through **6 focused `4:3` images** (`Pic 1 of 6` → `Pic 6 of 6`), trying to **guess the name of EACH image** while revealing as few puzzle pieces as possible.
  - Each image is covered by **6 interlocking SVG jigsaw puzzle pieces** (`3×2` layout). At the start of each image, **5 pieces cover the artwork** and **1 piece is already open** (`1/6` visible, deterministically chosen over a piece containing visual subject detail).
- **Guessing, Free Wrong Guesses & `Reveal Piece (-1 pt)` (Q29)**:
  - Typing a guess up top checks that image's primary name + accepted synonyms/aliases.
  - **Wrong guesses** shake (`"Not quite!"`) with **zero point penalty** and do **not** auto-remove puzzle pieces.
  - Clicking **`Reveal Piece (-1 pt)`** removes **1 random covered jigsaw piece** from the board (`5` covering → `4` → `3` → `2` → `1` → `0`).
  - Clicking **`Pass / Reveal Word (0 pts)`** (confirmation-gated while pieces remain, or 1-tap once all 6 pieces are open) uncovers the full image, reveals the word for `0` points, and lets the player advance.
  - Whenever an image is solved or passed, all remaining pieces pop off to reveal the full illustration + earned points before advancing to the next image (`Next Picture →` / `Enter`).
- **Fuzzy Per-Image Matching + Free AI Synonym Generator in `/admin` (Q30)**:
  - Answer matcher normalizes case/whitespace/punctuation/articles/plurals, checks the image's primary name + accepted per-image synonyms/aliases (including scene-level synonyms), and grants **1-letter typo forgiveness** (`Levenshtein distance ≤ 1` for candidate answers with `≥ 5` characters).
  - In `/admin` (and Creator Mode), each picture card provides an **"✨ Auto-Aliases"** button powered by `gemini-2.5-flash` (with OpenRouter toggle + local dictionary fallback) that populates accepted per-image synonyms in 1 click.
- **36-Point Scoring (`0–36`) & Post-Game `2×3` Summary Grid (Q31–Q33)**:
  - Per image `i ∈ {1..6}` with `r_i ∈ {0..5}` extra pieces removed: `score_i = 6 - r_i` (`6 pts` at `1/6` shown down to `1 pt` at `6/6` shown) if named correctly, or `0 pts` if passed/missed. Total score: `0` to `36` points (`X / 36 pts · Y / 6 named`).
  - Post-game ending screen transitions into a **`2×3` grid** displaying all 6 uncovered images, their numbered names (`1. Ocean`), per-image score badges (`6/6 pts`, `0/6 pts`), 6-tile emoji receipt (`🟩` `5–6 pts`, `🟨` `3–4 pts`, `🟧` `1–2 pts`, `⬜` `0 pts`), and decoupled **Share** + **Copy results** buttons.
  - Every image renders through `<ImageWithFallback>` supporting external/Supabase URLs AND rich inline SVG illustrated scene cards so broken images are impossible.

### Game #5 — `Connect 5` (LIVE — Enhanced with Splash, Moderation & Error Boundary)
- **Route**: `/games/connect-5` | **Archive**: `/games/connect-5/archive`
- **Core Loop**: 5-row variable-length compound word chain (`Row 1` shown & locked, `Rows 2–5` have pre-revealed hint letters, custom QWERTY keyboard, smart Backspace, automatic check on last box with `"Not quite"` + diagonal slashes `/` on wrong letters and direct type-to-overwrite).
- **New Enhancements**:
  - Wrap in `<GameSplashScreen>` and `<GameErrorBoundary>`.
  - Enable authenticated **Creator Mode (`Create & Share`)** with compact `?b=c5-xxxxxxxx` short links, native share sheet, and Tier 1/Tier 2 moderation.

### Game #4 — `Four Score` (Reach 80 Math Game) — Q34 to Q40
- **Route**: `/games/four-score` | **Archive**: `/games/four-score/archive`
- **Core Loop — NYT *Digits*-Style Full-Board Combiner to `80` (Q34, Q35, Q36)**:
  - **Target**: Always reach the exact number **`80`** (*"Four Score"* = `80`).
  - **Variable Board Inventory (Minimum `≥ 4` Digits & `≥ 3` Operators)**:
    - Each puzzle provides `N` single-use number tiles (`N ≥ 4`, e.g., `4, 5, 6, 7, 8` tiles) and single-use operator badges (`≥ 3` operators, chosen from `+`, `−`, `×`, `÷`, `x²`, `xʸ`).
    - Unary `x²` transforms 1 number tile in place (`a → a²`) and consumes the `x²` badge, whereas binary operators (`+`, `−`, `×`, `÷`, `xʸ`) combine 2 number tiles into 1 new number tile and consume that operator badge (`binary_ops = digits - 1`).
  - **Strict Full-Board Rule (Q35 & Q36)**:
    - Every digit tile and every operator badge on the board **can only be used ONCE** and **ALL of them must be used** so that at the end of the sequence, a single final tile remains on the board—and if that final tile equals **`80`**, the player wins!
- **Mathematical Legality & Guardrails (Q37)**:
  - **Whole-Number Division Only**: `A ÷ B` is only allowed if `B !== 0` and `A % B === 0`. If not evenly divisible, shake and show `"Must divide evenly into a whole number"`.
  - **Non-Negative & Bounded Values**: Intermediate results must stay whole numbers with `|value| ≤ 10,000` (`x²` and `xʸ` are rejected with a shake if the result exceeds `10,000`).
- **Live Equation Builder Display + Unlimited Undo/Reset (Q38)**:
  - Above the tile grid, display a crisp **Live Equation Banner** that dynamically builds the algebraic expression as the player combines tiles (e.g., `((3² + 7) × 5) = 80`), alongside unlimited **"Undo Last Step"** and **"Reset Board"** buttons with zero penalty.
- **Calculator-Style Win Verification & Built-In Solver (Q39 & Q40)**:
  - **Any valid full-board sequence** of the given tiles and operators that legally evaluates to **`80`** is immediately celebrated as a win! The victory modal shows both the player's winning equation and the generator's intended canonical equation.
  - **100% Auto-Generated Monthly Batches**: Built-in deterministic generator + backtracking Math Solver (`src/lib/generators/four-score-generator.ts`) guarantees every generated puzzle has a verified whole-number full-board solution to `80`.

### Game #2 — `Move Two` (`Move 2` — 3×3 Cube Domino Spatial Game) — Q41 to Q45
- **Route**: `/games/move-2` | **Archive**: `/games/move-2/archive`
- **Visual Perspective — NYT Minimalist 2D Active Face + Mini 3D Isometric Cube HUD (Q41)**:
  - Main stage renders the current `3×3` face (`Face 1` through `Face 6`) in a crisp, flat, minimalist **2D top-down grid** with smooth directional slide/fold transitions when crossing onto the next face.
  - Top-right HUD renders a clean **mini 3D isometric Rubik's-style cube diagram** highlighting which face (`Face 1 → Face 6`) is currently active and which faces have been conquered.
- **3D Domino (`1×1×2`) Bloxorz Rolling Physics (Q42)**:
  - The domino occupies either:
    - **`UPRIGHT` (`1×1` footprint on `(r, c)`)**: Moving in direction `(dr, dc)` tips it over into a `FLAT` (`2×1`) state covering `(r + dr, c + dc)` and `(r + 2*dr, c + 2*dc)`.
    - **`FLAT_H` (`1×2` horizontal footprint on `(r, c)` and `(r, c+1)`)**:
      - Moving Left (`←`) stands it `UPRIGHT` on `(r, c-1)`; moving Right (`→`) stands it `UPRIGHT` on `(r, c+2)`.
      - Moving Up (`↑`) or Down (`↓`) rolls it sideways staying `FLAT_H` on `(r-1, c..c+1)` or `(r+1, c..c+1)`.
    - **`FLAT_V` (`2×1` vertical footprint on `(r, c)` and `(r+1, c)`)**:
      - Moving Up (`↑`) stands it `UPRIGHT` on `(r-1, c)`; moving Down (`↓`) stands it `UPRIGHT` on `(r+2, c)`.
      - Moving Left (`←`) or Right (`→`) rolls it sideways staying `FLAT_V` on `(r..r+1, c-1)` or `(r..r+1, c+1)`.
- **Edge Portals (`→ Face k+1`), Solid Outer Walls & Hazard/Blocked Tiles (Q43 & Q44)**:
  - Each face (`Face 1` through `Face 5`) has a clearly marked exit edge portal (`→ Face 2`, `→ Face 3`, ..., `→ Face 6`). Rolling across that exit border transitions the domino onto the entry edge of the next face!
  - Non-exit outer borders act as **solid walls** (if a move would push part of the domino out of bounds on a non-exit edge or onto a solid wall block `⬛`, the domino bumps with a subtle shake and stays put).
  - Internal **hazard/void holes** (`✕` tiles): if any part of the domino lands on a hazard hole, it resets to the entry state of the **current face** (and players also have an `"Undo Move"` and `"Reset Face"` button).
  - **Winning Condition on Face 6**: Land on the **Red Target** on `Face 6` in the required posture (standing `UPRIGHT` on a 1-square red target, or lying `FLAT` across a 2-square red target).
- **100% Auto-Generated Monthly Batches via BFS Pathfinding Solver (Q44 & Q45)**:
  - `src/lib/generators/move-two-generator.ts` uses a **Breadth-First Search (BFS) state-space solver** `(face, posture, r1, c1, r2, c2)` across all 6 faces to procedurally generate obstacle layouts that are 100% guaranteed solvable and to compute the exact minimum move count (**Par**).
  - **Controls & Scoring (Q45)**: Supports Arrow keys / `WASD` on desktop, plus touch swipe gestures AND a minimalist on-screen D-Pad on mobile. Final score compares **Total Moves vs. Par** (`Solved in 18 moves · Par: 16 · ⭐⭐⭐`).

### Game #1 — `1 Win` (Real-Time Community Gratitude Leaderboard) — Q46 to Q48
- **Route**: `/games/1-win` | **Archive**: `/games/1-win/archive`
- **Input Constraints & Smart Normalization (Q46 & Q47)**:
  - **100% Blind Free-Text Before Submission (Q47)**: No autocomplete spoilers before submitting. Prompt reads: *"What is 1 win from your day today? Keep it short (1–4 words) to see how many others shared your win today!"*
  - **Strict Length Limit (Q46)**: Max **4 words** and **35 characters**.
  - **Canonical Normalization for Grouping (Q46)**:
    - Behind the scenes, `normalizeOneWinEntry(raw)` lowercases, strips punctuation/emojis, collapses whitespace, and normalizes basic trailing plural/articles so `"Deep sleep"`, `"deep sleep!"`, and `"  Deep Sleep "` all map to the same canonical key (`"deep sleep"`) while displaying as clean **Title Case (`"Deep Sleep"`)** on the leaderboard.
- **Strict 1-Submission-Per-Day Lock + Live Supabase Top 100 Leaderboard (Q46–Q48)**:
  - Once submitted for today's date, the player's win is locked for the day (`localStorage` + Supabase `one_win_submissions`).
  - Immediately reveals the **Live Top 100 Today's Wins Leaderboard** (`#1` most common down to `#100`), highlighting the player's own win and its current live rank & count, subscribed to **Supabase Realtime** (`postgres_changes` on `one_win_submissions`) so rankings update live on screen!
- **Moderation & View-Only Archive (Q48)**:
  - Enforces the **Tier 1 + Tier 2 Public Moderation Filter** (zero slurs and zero R-rated profanity allowed on `1 Win`).
  - Visiting any past date in `/games/1-win/archive` opens that date's final Top 100 leaderboard in **strictly View-Only mode** (no retroactive submissions allowed for past days).
