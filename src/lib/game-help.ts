import type { AllGameSlug } from "@/lib/games-config";

export interface GameHelpContent {
  /** One-line summary shown under the dialog title. */
  summary: string;
  /** Headline of the highlighted rules card. */
  headline: string;
  /** Rule bullets (plain text; `**bold**` markers are rendered as <strong>). */
  rules: string[];
}

/**
 * How-to-Play copy for every game in the `21 → 1` countdown. 21 Things, 17 Syllables
 * and Connect 5 render richer bespoke dialogs in `game-shell.tsx`; this map covers
 * all 9 slugs so the shell never needs a hard-coded branch for a new game.
 */
export const GAME_HELP: Record<AllGameSlug, GameHelpContent> = {
  "21-things": {
    summary:
      "A gratitude-driven social curation game built around a 21 → 6 → 3 → 1 narrowing funnel.",
    headline: "The 21 → 6 → 3 → 1 Funnel",
    rules: [
      "**Pick 6** favorites from 21 tiles, then **3**, then your single **#1**.",
      "Write a short reflection on why your #1 resonated.",
      "Use the 2-col / 3-col toggle for bigger tiles.",
    ],
  },
  "17-syllables": {
    summary:
      "A daily haiku deduction puzzle where you assemble syllables into a 5-7-5 poem.",
    headline: "Solve the Daily 5-7-5 Haiku",
    rules: [
      "Place syllable chunks into the 3 lines (5, 7 and 5 syllables).",
      "Use Check and Reveal from the Lifesaver menu.",
    ],
  },
  "9-rhymes": {
    summary:
      "Text with Nine: 9 daily clues where each new word rhymes with the word right before it.",
    headline: "Linear 9-Word Rhyme Chain",
    rules: [
      "**Word 1** rhymes with today's **Starter word**, and **Words 2–9** each rhyme directly with the **previous word** you solved.",
      "Each prompt shows the exact **letter count**; you get **1 guess** per word.",
      "**New hint** costs 0.5 pts (1× per round); **Reveal answer** scores 0.",
      "Score out of 9: 🟩 full point · 🟨 half point · ⬜ miss.",
    ],
  },
  "eightfold-echo": {
    summary:
      "Trace an 8-step chain across a 3×3 grid where every move changes exactly 1 visual attribute.",
    headline: "Change Exactly 1 Attribute Per Step",
    rules: [
      "Play **Easy** (intuitive 1-step path with near-miss decoys) or **Hard** (multi-step lookahead) — solving **either** board counts toward your daily streak.",
      "Start at the **center tile** and visit all 9 tiles once (8 steps).",
      "Each next tile must change **exactly 1** attribute (**shape**, **fill**, or **dot count**) while keeping the other 2 identical.",
      "Wrong tap = **+5s**; **Hint** pulses the next valid tile (**+15s**).",
    ],
  },
  "6-pics": {
    summary:
      "Use the overarching theme to name all 6 hidden pictures while uncovering as few puzzle pieces as possible.",
    headline: "Name All 6 Hidden Pictures (36 Pts Max)",
    rules: [
      "Check the **Overarching Theme** at the top — all 6 pictures belong to it.",
      "Each picture starts with **1 of 6 puzzle pieces open** for free (worth **6 pts**). Wrong guesses have **no penalty**!",
      "Need to see more? **Tap any covered puzzle piece** to select it, then press **Confirm? (-1 pt)** to remove that piece (`6 pts → 1 pt`).",
      "Tap **Pass (0 pts)** if stumped, and view all 6 full pictures in a **2×3** gallery at the end.",
    ],
  },
  "connect-5": {
    summary: "A 5-row compound word-chain puzzle inspired by daily crosswords.",
    headline: "Connect All 5 Words in the Chain",
    rules: [
      "Each word forms a compound word or phrase with the word above it.",
      "Fill the board; wrong letters get a diagonal slash.",
    ],
  },
  "four-score": {
    summary:
      "Follow the top-left Formula Guide or find your own path using every tile and operator to reach 80.",
    headline: "Combine Every Tile & Operator to Reach 80",
    rules: [
      "Check the **Formula Guide** at the top-left — your starting number and operator (e.g. `(25 + __)`) are already revealed!",
      "Use **every** number tile and single-use operator (`+ − × ÷ x² xʸ`) once; division must come out whole.",
      "Need another nudge? Tap **+1 #** to reveal another number, or use **Undo / Reset** anytime with no penalty.",
    ],
  },
  "move-2": {
    summary:
      "Roll the 3D 2×1 block across floating 6×6, 8×8, and 10×10 tile islands and drop upright into the green square hole.",
    headline: "Roll Upright Into the 1×1 Green Hole",
    rules: [
      "Pick **Easy (6×6)**, **Medium (8×8)**, or **Hard (10×10)** — solving **any** board counts toward your daily streak.",
      "Move with **Arrow keys / WASD**, swipe, or the **D-Pad**. Stay on the tiles — stepping off an open edge tips the block into the void!",
      "**Red Obstacles** are strictly off-limits — touching a Red Obstacle **at all** (standing or flat) sends you back to Start.",
      "**Circle switches (○)** activate blue bridges on any touch; **Heavy X switches (✕)** activate only when standing **upright (1×1)** directly on them.",
      "Stand **upright (1×1)** directly over the **green square hole** to drop through and win!",
    ],
  },
  "1-win": {
    summary:
      "Share ONE win from your day in 1–4 words and see how many others shared it.",
    headline: "What is 1 win from your day?",
    rules: [
      "Answer blind in **1–4 words** (35 characters max).",
      "One entry per day; then see the Top 100 wins live.",
      "Keep it kind: public wins are moderated.",
    ],
  },
};

export function getGameHelp(slug: AllGameSlug): GameHelpContent {
  return GAME_HELP[slug];
}
