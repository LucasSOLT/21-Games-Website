# SOL GaMES (`21-Games-Website`) — Master Game Design Bible (21 → 1)

> [!IMPORTANT]
> **Living Canonical Reference (Never Delete or Ignore)**
> This document is the authoritative source of truth for the vision, mechanics, scoring, UI/UX feel, admin studio authoring, and Supabase data model of every game in **SOL GaMES (21 Games)**.
> - **Codebase Path**: `/Users/lucashuff/.gemini/antigravity/scratch/21-Games-Website/GAME_DESIGN_BIBLE.md` (referenced in `AGENTS.md`)
> - **Brain Artifact Mirror**: `/Users/lucashuff/.gemini/antigravity/brain/dbbaad6f-e60d-4513-9d8d-e17e75b32882/game_design_bible.md`
> Every time Lucas answers design questions or refines a game's rules, this file must be updated before writing or executing any implementation plan.

---

## 1. The Core "21 → 1" Countdown Concept

Every game in the **21 Games** universe corresponds to a number counting down from **21 to 1**:

| # | Game Title | Route Slug | Current Status | Core Genre / Hook |
| :--- | :--- | :--- | :--- | :--- |
| **21** | **21 Things** | `/games/21-things` | **LIVE** | Gratitude & curation funnel (`21 → 6 → 3 → 1`) + voice/text reflection + Creator Mode |
| **20** | *?20? (TBD)* | — | Concept Slot | Reserved for #20 game |
| **19** | *?19? (TBD)* | — | Concept Slot | Reserved for #19 game |
| **18** | *?18? (TBD)* | — | Concept Slot | Reserved for #18 game |
| **17** | **17 Syllables** | `/games/17-syllables` | **Specifying** | 5-7-5 Haiku reconstruction puzzle (drag-and-drop multi-letter fragments into Wheel-of-Fortune style blanks) |
| **16** | *?16? (TBD)* | — | Concept Slot | Reserved for #16 game |
| **15** | *?15? (TBD)* | — | Concept Slot | Reserved for #15 game |
| **14** | *?14? (TBD)* | — | Concept Slot | Reserved for #14 game |
| **13** | *?13? (TBD)* | — | Concept Slot | Reserved for #13 game |
| **12** | *?12? (TBD)* | — | Concept Slot | Reserved for #12 game |
| **11** | **The 11th Hour** | `/games/the-11th-hour` | **Coming Soon (TBD)** | Concept open — keep as "Coming Soon" on homepage |
| **10** | *?10? (TBD)* | — | Concept Slot | Reserved for #10 game |
| **9** | **9 Rhymes** | `/games/9-rhymes` | **Specifying** | iMessage-style text chat with **"Nine"**: 1 starter word + 9 fill-in-the-blank rhymes, scored `x/9` |
| **8** | **Eightfold Echo** | `/games/eightfold-echo` | **Specifying** | 3×3 IQ/pattern-recognition shape sequence (`0 [center] → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8`) |
| **7** | *?7? (TBD)* | — | Concept Slot | Reserved for #7 game |
| **6** | **6 Pics** | `/games/6-pics` | **Specifying** | 6 progressively revealed photos/illustrations pointing to 1 overarching theme |
| **5** | **Connect 5** | `/games/connect-5` | **LIVE** | 5-row compound word-chain puzzle (`Row 1 → Row 2 → Row 3 → Row 4 → Row 5`) |
| **4** | **Four Score** | `/games/four-score` | **Specifying** | Math puzzle reaching **80** ("Four Score" = `4 × 20 = 80`) using numbers & operators (`+`, `−`, `×`, `÷`, `x²`, `xʸ`) |
| **3** | *?3? (TBD)* | — | Concept Slot | Reserved for #3 game |
| **2** | **Move Two** (`Move 2`) | `/games/move-2` | **Specifying** | 2-square domino rolling across a 6-faced 3×3 cube (`Face 1 → Face 6`) onto red target square(s) (Bloxorz meets Rubik's Cube) |
| **1** | **1 Win** | `/games/1-win` | **Specifying** | Daily gratitude check-in: enter 1 authentic win from today (locked once submitted) + live Supabase Top 100 leaderboard |

---

## 2. Detailed Specifications by Game

### Game #21 — `21 Things` (LIVE)
- **Route**: `/games/21-things` (Archive: `/games/21-things/archive`)
- **Component**: `src/components/games/twenty-one-things.tsx`
- **Puzzle Data**: `src/data/puzzles/21-things.ts` (66 daily boards) + Supabase `daily_puzzles` & `twenty_one_things_submissions`
- **How It Works**:
  1. **Single-Screen `3×7` Grid**: Displays 21 concise gratitude/life prompts (`≤ 5 words`, `≤ 30 chars` per tile) curated by a daily creator (with creator avatar, `@handle`, and theme title).
  2. **In-Place Narrowing Funnel (`21 → 6 → 3 → 1`)**:
     - **Phase 1 (`Pick 6`)**: Player taps their **top 6** items on the lavender (`#e5d5e3`) grid. Selected tiles turn **SOL Yellow (`#F9D423`)**.
     - **Phase 2 (`Pick 3`)**: Unpicked tiles dim in place (`opacity-35 grayscale`) so spatial context is never lost. Player taps **3** of their 6 yellow tiles to advance them (turning **Purple (`#9D50BB`)**).
     - **Phase 3 (`Pick #1`)**: From the 3 purple finalists, player selects their single **#1 item** (turning **Green (`#2ECC71`)** with a `#1` crown badge).
  3. **The Payoff (Voice or Text Reflection + Community Journey Feed)**:
     - Player records a voice note (via `MediaRecorder` + Web Speech API transcription) or writes a short reflection on why their `#1` item resonated today, and submits with their name (auto-filled from their SOL Theory Account if signed in).
     - Below the board, the **Friend `6 → 3 → 1` Journeys & Reflections Feed** shows each player's individual narrowing path (`#1 Winner` badge, `Top 3 Finalists`, `Other Top 6 Picks`, and their written/audio note).
  4. **Creator Mode ("Create & Share Your Own 21 Things")**:
     - Players or admins can tap the microphone to speak a stream of consciousness or paste a list; the smart parser splits and compresses thoughts into 21 concise tiles (`≤ 5 words / ≤ 30 chars`, preserving the head noun), saves to Supabase, and generates a shareable `?board=<id>` URL.

### Game #17 — `17 Syllables` (Haiku Reconstruction Puzzle)
- **Route**: `/games/17-syllables`
- **Creator's Brain Dump**:
  - A daily **5-7-5 Haiku puzzle** created by the admin.
  - **Splash / Loading Screen**: Shows an overarching **Theme** for today's Haiku (modeled after NYT Games' pre-game title/splash screen with a "Play" button) and optional hints.
  - **Board Structure (Wheel-of-Fortune Style Blank Grid)**:
    - Every letter and grammar/punctuation mark (commas, apostrophes, etc.) in the admin's haiku becomes its own individual fillable blank box on a 3-row (`5-7-5` syllable) stage, preserving exact word spacing and line breaks.
    - Example Haiku:
      - Line 1 (5 syllables): `The rain fell among`
      - Line 2 (7 syllables): `silent slaughters, brave soldiers`
      - Line 3 (5 syllables): `never do they come`
  - **Shuffled Multi-Character "Letter Tiles" Tray**:
    - The program slices the haiku into an assortment of variable-length letter/punctuation chunks (fragments of words, whole short words, or cross-space/punctuation chunks) and shuffles them into a draggable tray.
    - Example shuffled chunks: `|me|`, `|never|`, `|co|`, `|hey|`, `|t|`, `|do|`, `|T|`, `|rain|`, `|he|`, `|fell|`, `|a|`, `|lent|`, `|mong|`, `|ters|`, `|si|`, `|, bra|`, `|slaugh|`, `|ve|`, `|soldiers|`.
  - **Drag-and-Drop Interaction**:
    - Players drag these multi-character tiles and drop them into the matching blank letter boxes of the haiku board (given the target slot range fits the chunk).
    - Once dropped into a valid span of blanks, the tile stays there (and can be dragged back out or swapped).
  - **Win & Error Feedback**:
    - Once all letter boxes are filled with the exact right letters/punctuation in the right positions, the game is won!
    - If all boxes are filled (or checked) and the arrangement is off, show a `"Not quite, try again"` message (like `Connect 5`) and flash red on either the misplaced multi-letter tiles or the individual boxes containing wrong letters/punctuation.

### Game #11 — `The 11th Hour` (Coming Soon — Concept TBD)
- **Route**: `/games/the-11th-hour`
- **Current Status**: Leave as **Coming Soon** on the homepage while mechanics are finalized.

### Game #9 — `9 Rhymes` (iMessage-Style Text Chat Rhyming Game)
- **Route**: `/games/9-rhymes`
- **Creator's Brain Dump**:
  - **Visual Vibe**: First-person text-messaging interface (heavily inspired by Apple iMessage + NYT Games' clean typography/vibe).
  - **The Character ("Nine")**:
    - Incoming messages (left-aligned grey chat bubbles) come from a sender named **"Nine"**.
    - Outgoing messages (right-aligned Apple-blue chat bubbles) come from the player.
  - **Core Loop (10 Total Words = 1 Starter Word + 9 Rhyme Rounds)**:
    1. **Starter Message**: Nine texts: `"Here's today's word: [STARTER WORD]"` (e.g., `"Time"`).
    2. **Clue 1 (Fill-in-the-Blank Sentence — Worth `1.0` pt)**: Immediately after, Nine sends a second text with a fill-in-the-blank sentence where the missing word rhymes with the starter/previous word.
       - Example: `"Finish the sentence: 'Wow, this guy split on a ______.'"` (Target answer: `"Dime"`).
    3. **Optional Action — `"New hint"` Button (Reduces round value to `0.5` pts)**:
       - If the player taps `"New hint"`, the player sends a blue outgoing text bubble (e.g., `"Can I get another hint?"`), and Nine immediately replies with a **definition/description** of the target word (e.g., `"A small denominative currency"`).
    4. **Optional Action — `"Reveal answer"` Button (Reduces round value to `0` pts)**:
       - If the player is still stuck and taps `"Reveal answer"`, a blue outgoing text automatically sends the correct word, scoring `0` points for that round and advancing to the next rhyme.
    5. **Guessing & Keyboard Rules (`1` Guess Only Per Round)**:
       - The player types their guess using our **custom on-screen visual QWERTY keyboard** (just like `Connect 5` / NYT Games — **never trigger the native mobile OS popup keyboard**) or their physical computer keyboard on desktop (with the visual keyboard still shown on screen).
       - The player gets **only ONE guess** per round:
         - **If Correct**: Nine replies with a randomized encouraging/motivating message, awards `1.0` pt (no hint used) or `0.5` pts (description hint used), and sends the next fill-in-the-blank sentence.
         - **If Wrong**: Nine replies with a randomized gentle miss message (e.g., `"Ah, not quite.. on to the next"`), awards `0` points for that word, and moves to the next round.
  - **Scoring (`x / 9`)**:
    - Scored out of `9` (`0/9` lowest to `9/9` flawless — all 9 guessed on the first clue without pressing `"New hint"` or `"Reveal answer"`). Half-points (`e.g., 7.5/9`) are possible when description hints are used.

### Game #8 — `Eightfold Echo` (3×3 Pattern-Recognition & Logic Sequence)
- **Route**: `/games/eightfold-echo`
- **Creator's Brain Dump**:
  - **Visual & Cognitive Vibe**: Logic and intuition puzzle inspired by visual pattern-recognition matrix puzzles (like Raven's Progressive Matrices / IQ test shape sequences).
  - **3×3 Grid (9 Total Tiles: `0` [Center Start] → `1` → `2` → `3` → `4` → `5` → `6` → `7` → `8`)**:
    - Each of the 9 tiles contains a unique geometric shape composition.
    - The **Center Tile (Tile 0)** is always the active **starting shape**.
    - The goal is to deduce and click which of the 8 surrounding tiles is logically **"next"** (`Step 1`), then from `Step 1` find `Step 2`, and so on through all 8 outer tiles in a single predetermined valid chain (`0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8`).
  - **Example Logical Transition**:
    - Suppose the center starting tile has three parallel circles: left is solid black, middle is hollow/outline, right is `"?"` → the player deduces the missing/next concept is a **half-filled circle**, and clicks the tile containing the half-filled circle (say, right-half filled).
    - Once clicked correctly, the previous tile is **blacked out / marked completed**, and the newly clicked tile becomes the **current active tile**.
    - From the right-half-filled circle, the player spots a complementary left-half-filled circle in another tile, clicks it next, and continues until all 8 surrounding tiles are completed in order.
  - **Wrong Clicks & Timer / Penalty Mechanics**:
    - Clicking the wrong next tile shakes the tile, flashes red, and shows `"Incorrect guess"`, deducting from the player's score and/or subtracting time from a countdown timer at the top (configurable per puzzle by the creator).

### Game #6 — `6 Pics` (Progressive 6-Image Theme Deduction)
- **Route**: `/games/6-pics`
- **Creator's Brain Dump**:
  - **Objective**: Guess the single **overarching theme** connecting 6 daily images.
  - **Example**:
    - Image 1: Ocean
    - Image 2: Volcano
    - Image 3: Island
    - Image 4: Surfing
    - Image 5: Luau
    - Image 6: Hula Dancing
    - **Overarching Theme Answer**: `"Hawaii"`
  - **Progressive Reveal & Scoring**:
    - Players start with the first image (or initial state) and can press a button to progressively reveal the remaining images one by one.
    - Each extra image revealed counts against the player's score (fewer images needed = higher score).
    - An input box at the top lets the player type and submit their guess for the overarching theme.

### Game #5 — `Connect 5` (LIVE)
- **Route**: `/games/connect-5` (Archive: `/games/connect-5/archive`)
- **Component**: `src/components/games/connect-five.tsx`
- **Puzzle Data**: `src/data/puzzles/connect-5.ts` (66 daily puzzles) + Supabase `daily_puzzles`
- **How It Works**:
  1. **5-Row Variable-Length Compound Word Chain**:
     - Row 1 is fully shown and locked (e.g., `MOUSE`).
     - Rows 2–5 are variable-length words where each row forms a compound word or two-word phrase with the row directly above it (`MOUSE` → `PAD` → `LOCK` → `DOWN` → `WIND`).
     - Certain rows start with pre-revealed locked hint letters (green indicator dot) configured by the puzzle author.
  2. **NYT Crossword-Style Navigation & Visual Keyboard**:
     - Active row has a crisp black rectangular outline; active cell is highlighted in **SOL Yellow (`#F9D423`)**.
     - Typing advances automatically through open cells and jumps down to the next row when a word is completed.
     - **Smart Backspace**: If the player clicked a specific box, Backspace deletes from that cursor leftward; if auto-advanced, Backspace deletes from the rightmost user-typed letter leftward (skipping locked hint letters and jumping up to the row above when emptied).
     - Uses a custom on-screen QWERTY keyboard (plus physical keyboard support on desktop) so mobile never pops up the native OS keyboard.
  3. **Instant Check & Diagonal Slashes (`/`)**:
     - Filling the last open box on the board automatically checks the solution:
       - **All Correct**: `1.0s` celebratory pause on the completed green board before opening the Results & Share modal.
       - **Any Wrong Letters**: Shows a `"Not quite"` toast and marks every wrong letter box with a red diagonal slash (`/`). Clicking or navigating to any slashed box and typing a letter overwrites it directly without needing Backspace.
  4. **Timer & Hints**:
     - Live elapsed `MM:SS` timer in the header, plus a `"Hint"` button that reveals the next unrevealed letter.

### Game #4 — `Four Score` (Reach 80 Math Puzzle)
- **Route**: `/games/four-score`
- **Creator's Brain Dump**:
  - **Name & Target**: **"Four Score"** means `4 × 20 = 80`. The objective of every puzzle is to reach the exact number **`80`**.
  - **Core Mechanics**:
    - Players use an assortment of numbers and mathematical operators (**addition `+`**, **subtraction `−`**, **multiplication `×`**, **division `÷`**, **square `x²`**, and/or **exponent `xʸ`**) to transform the given numbers into **`80`**.
  - **Design Exploration (Segmented vs. Curated Pool)**:
    - Because raw pools of numbers/operators can have many accidental solutions, we are exploring either:
      - **Option A (Staged / Segmented Steps)**: Revealing numbers/operators in logical stages as conditions are met, OR
      - **Option B (Curated Tile & Operator Pool)**: Showing a curated set of number tiles and a limited set of operator tiles (authored/verified with AI assistance in `/admin`) where the player chains steps together to hit `80`.

### Game #2 — `Move Two` (`Move 2` — 3×3 Cube Domino Spatial Puzzle)
- **Route**: `/games/move-2`
- **Creator's Brain Dump**:
  - **Inspiration**: Classic spatial flash games like *Bloxorz* (CoolMathGames / Friv) combined with a **6-faced 3×3 Rubik's-style Cube**.
  - **The Player Entity ("The Domino")**:
    - A `1×1×2` block (or 2 connected unit squares) that can stand vertically on `1` square or lie flat horizontally/vertically across `2` adjacent squares as it tumbles/rolls step by step.
  - **The 6-Faced 3×3 Cube World (`Face 1 → Face 2 → Face 3 → Face 4 → Face 5 → Face 6`)**:
    - Each face of the cube is a `3×3` grid explored one face at a time (or with smooth cube rotation transitions when crossing an edge from one face to the next).
    - The player navigates sequentially from the starting position on **Face 1** → **Face 2** → **Face 3** → **Face 4** → **Face 5** → **Face 6**.
  - **Winning Condition on Face 6**:
    - On **Face 6**, the domino must land in the exact **red target zone** in the required orientation:
      - If the red target is **1 square**, the domino must land **standing vertically upright** on that exact single square.
      - If the red target is **2 squares**, the domino must land **lying flat** across those exact two squares.

### Game #1 — `1 Win` (Real-Time Community Gratitude Leaderboard)
- **Route**: `/games/1-win`
- **Creator's Brain Dump**:
  - **Concept**: A beautifully simple daily gratitude ritual where every visitor enters **one "win" from today** (must genuinely come from today's 24-hour cycle).
  - **Strict 1-Submission Lock**:
    - Once a player submits their win for today, they **cannot resubmit** or change it for the rest of the day.
  - **Real-Time Top 100 Aggregate Leaderboard (Supabase Realtime)**:
    - Immediately after submitting, the player sees their own win highlighted alongside a live, real-time aggregated ranking of **all wins entered by players today, ranked `#1` (most common) to `#100` (100th most common)**.
    - Example: If 100 players today entered `"Deep sleep"` and that is the highest count, `"Deep sleep"` sits at `#1` at the top of the leaderboard, updating live via Supabase as more players submit!
