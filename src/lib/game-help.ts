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
      "Text with Nine: 9 daily clues that all share ONE exact perfect rhyme sound.",
    headline: "Nine Rhymes, One Sound",
    rules: [
      "Start from the pinned **Starter word**; every answer rhymes with it.",
      "Each prompt shows the exact **letter count**; you get **1 guess** per word.",
      "**New hint** costs 0.5 pts (1× per round); **Reveal answer** scores 0.",
      "Score out of 9: 🟩 full point · 🟨 half point · ⬜ miss.",
    ],
  },
  "eightfold-echo": {
    summary:
      "Follow the visual logic rules to trace the 8-step sequence across a 3×3 grid.",
    headline: "Trace the Echo from the Center",
    rules: [
      "Start at the **center cell** and visit every cell exactly once (8 moves).",
      "Each hop must obey the shared **shape / color / echo** rule.",
      "Wrong move = **+5s**. A Hint costs **+15s** and pulses two candidates.",
      "Finish fast with few mistakes for ⭐⭐⭐.",
    ],
  },
  "6-pics": {
    summary:
      "Deduce the secret theme connecting six progressively revealed pictures.",
    headline: "One Theme, Six Pictures",
    rules: [
      "Swipe through the pictures; each new one is a stronger clue.",
      "Guess earlier to score higher: **6/6** down to **0/6**.",
      "After the game see all six captioned in a 2×3 grid.",
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
      "Use every digit and a few operators to build an equation that equals 80.",
    headline: "Make 80",
    rules: [
      "Place all digits and operators (`+ − × ÷ x² xʸ`) on the board.",
      "Every digit must be used; division must come out whole.",
      "The live equation banner shows your running total. Undo / Reset anytime.",
    ],
  },
  "move-2": {
    summary:
      "Roll a 1×1×2 block across the six faces of a cube to the red target.",
    headline: "Roll to the Red Target",
    rules: [
      "Move with arrows / WASD / swipe / the D-pad.",
      "⬛ walls bump you back; ✕ hazards reset the face.",
      "Beat **Par** for ⭐⭐⭐.",
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
