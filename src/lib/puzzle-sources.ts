/**
 * Puzzle source registry — one entry per game that has a daily puzzle.
 *
 * Every source supplies:
 *   - `validate`       strict runtime payload validation (Supabase / localStorage / static banks)
 *   - `fromBank`       deterministic rotation through the static puzzle bank
 *   - `generateSeeded` deterministic date-seeded fallback keyed by hash(`${slug}:${dateKey}`)
 *                      so a player can NEVER see a blank screen / 404 for any date.
 *   - `summarize`      title/author/editor/puzzle number for archive + hub cards.
 *
 * `getDailyPuzzleForGame()` in daily-engine.ts walks: override → bank → seeded fallback.
 * Each countdown game registers itself here when it ships.
 */

import {
  CONNECT_5_PUZZLES,
  type Connect5Puzzle,
} from "@/data/puzzles/connect-5";
import {
  TWENTY_ONE_THINGS_BOARDS,
  type TwentyOneThingsBoard,
} from "@/data/puzzles/21-things";
import {
  SEVENTEEN_SYLLABLES_PUZZLES,
  type SeventeenSyllablesPuzzle,
} from "@/data/puzzles/17-syllables";
import {
  generateSeededNineRhymesPuzzle,
  isNineRhymesPuzzle,
  NINE_RHYMES_PUZZLES,
  type NineRhymesPuzzle,
} from "@/data/puzzles/9-rhymes";
import {
  EIGHTFOLD_ECHO_PUZZLES,
  generateSeededEightfoldEchoPuzzle,
  isEightfoldEchoPuzzle,
  type EightfoldEchoPuzzle,
} from "@/data/puzzles/eightfold-echo";
import {
  SIX_PICS_PUZZLES,
  generateSeededSixPicsPuzzle,
  isSixPicsPuzzle,
  type SixPicsPuzzle,
} from "@/data/puzzles/6-pics";
import {
  getPuzzleNumberForDate,
  getRotationIndexForDate,
} from "@/lib/date-keys";
import type { AllGameSlug } from "@/lib/games-config";
import {
  fnv1a32,
  validate21ThingsPayload,
  validateConnect5Payload,
} from "@/lib/seeded-random";

export interface PuzzleSummary {
  title: string;
  author: string;
  editor: string;
  puzzleNumber: number;
}

export interface PuzzleSource<T = unknown> {
  slug: AllGameSlug;
  validate(payload: unknown): payload is T;
  fromBank(dateKey: string): T;
  generateSeeded(dateKey: string): T;
  summarize(payload: T, dateKey: string): PuzzleSummary;
}

/** Stable index for `hash(gameSlug + ":" + dateKey)` into a bank of `length`. */
export function seededBankIndex(
  gameSlug: string,
  dateKey: string,
  length: number
): number {
  if (length <= 0) return 0;
  return fnv1a32(`${gameSlug}:${dateKey}`) % length;
}

// ---------------------------------------------------------------------------
// Legacy live games
// ---------------------------------------------------------------------------

const connect5Source: PuzzleSource<Connect5Puzzle> = {
  slug: "connect-5",
  validate: (p): p is Connect5Puzzle => validateConnect5Payload(p).valid,
  fromBank(dateKey) {
    const base =
      CONNECT_5_PUZZLES[getRotationIndexForDate(dateKey, CONNECT_5_PUZZLES.length)];
    return {
      ...base,
      puzzleNumber: getPuzzleNumberForDate(dateKey),
      customDate: dateKey,
    };
  },
  generateSeeded(dateKey) {
    const base =
      CONNECT_5_PUZZLES[seededBankIndex("connect-5", dateKey, CONNECT_5_PUZZLES.length)];
    return {
      ...base,
      puzzleNumber: getPuzzleNumberForDate(dateKey),
      customDate: dateKey,
    };
  },
  summarize: (p) => ({
    title: `${p.title} (${p.words[0]} → …)`,
    author: p.author,
    editor: p.editor,
    puzzleNumber: p.puzzleNumber,
  }),
};

const twentyOneSource: PuzzleSource<TwentyOneThingsBoard> = {
  slug: "21-things",
  validate: (p): p is TwentyOneThingsBoard => validate21ThingsPayload(p).valid,
  fromBank(dateKey) {
    const base =
      TWENTY_ONE_THINGS_BOARDS[
        getRotationIndexForDate(dateKey, TWENTY_ONE_THINGS_BOARDS.length)
      ];
    return {
      ...base,
      puzzleNumber: getPuzzleNumberForDate(dateKey),
      customDate: dateKey,
    };
  },
  generateSeeded(dateKey) {
    const base =
      TWENTY_ONE_THINGS_BOARDS[
        seededBankIndex("21-things", dateKey, TWENTY_ONE_THINGS_BOARDS.length)
      ];
    return {
      ...base,
      puzzleNumber: getPuzzleNumberForDate(dateKey),
      customDate: dateKey,
    };
  },
  summarize: (b) => ({
    title: b.title,
    author: b.creatorName,
    editor: "Daily Editorial",
    puzzleNumber: b.puzzleNumber,
  }),
};

function isSeventeenSyllablesPayload(p: unknown): p is SeventeenSyllablesPuzzle {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    Array.isArray(o.lines) &&
    o.lines.length === 3 &&
    o.lines.every((l) => typeof l === "string" && l.trim().length > 0) &&
    Array.isArray(o.chunks) &&
    o.chunks.length > 0 &&
    typeof o.theme === "string"
  );
}

const seventeenSource: PuzzleSource<SeventeenSyllablesPuzzle> = {
  slug: "17-syllables",
  validate: isSeventeenSyllablesPayload,
  fromBank(dateKey) {
    const base =
      SEVENTEEN_SYLLABLES_PUZZLES[
        getRotationIndexForDate(dateKey, SEVENTEEN_SYLLABLES_PUZZLES.length)
      ];
    return { ...base, puzzleNumber: getPuzzleNumberForDate(dateKey), dateKey };
  },
  generateSeeded(dateKey) {
    const base =
      SEVENTEEN_SYLLABLES_PUZZLES[
        seededBankIndex("17-syllables", dateKey, SEVENTEEN_SYLLABLES_PUZZLES.length)
      ];
    return { ...base, puzzleNumber: getPuzzleNumberForDate(dateKey), dateKey };
  },
  summarize: (p) => ({
    title: `${p.theme} — ${p.lines[0]}`,
    author: p.author,
    editor: "Daily Editorial",
    puzzleNumber: p.puzzleNumber,
  }),
};

const nineRhymesSource: PuzzleSource<NineRhymesPuzzle> = {
  slug: "9-rhymes",
  validate: isNineRhymesPuzzle,
  fromBank(dateKey) {
    const base =
      NINE_RHYMES_PUZZLES[getRotationIndexForDate(dateKey, NINE_RHYMES_PUZZLES.length)]!;
    return { ...base, puzzleNumber: getPuzzleNumberForDate(dateKey), customDate: dateKey };
  },
  generateSeeded: (dateKey) =>
    generateSeededNineRhymesPuzzle(dateKey, getPuzzleNumberForDate(dateKey)),
  summarize: (p) => ({
    title: p.title,
    author: p.author,
    editor: p.editor,
    puzzleNumber: p.puzzleNumber,
  }),
};

const eightfoldEchoSource: PuzzleSource<EightfoldEchoPuzzle> = {
  slug: "eightfold-echo",
  validate: isEightfoldEchoPuzzle,
  fromBank(dateKey) {
    const base =
      EIGHTFOLD_ECHO_PUZZLES[
        getRotationIndexForDate(dateKey, EIGHTFOLD_ECHO_PUZZLES.length)
      ]!;
    return {
      ...base,
      puzzleNumber: getPuzzleNumberForDate(dateKey),
      customDate: dateKey,
    };
  },
  generateSeeded: (dateKey) =>
    generateSeededEightfoldEchoPuzzle(dateKey, getPuzzleNumberForDate(dateKey)),
  summarize: (p) => ({
    title: p.title,
    author: p.author,
    editor: p.editor,
    puzzleNumber: p.puzzleNumber,
  }),
};

const sixPicsSource: PuzzleSource<SixPicsPuzzle> = {
  slug: "6-pics",
  validate: isSixPicsPuzzle,
  fromBank(dateKey) {
    const base =
      SIX_PICS_PUZZLES[
        getRotationIndexForDate(dateKey, SIX_PICS_PUZZLES.length)
      ]!;
    return {
      ...base,
      puzzleNumber: getPuzzleNumberForDate(dateKey),
      customDate: dateKey,
    };
  },
  generateSeeded: (dateKey) =>
    generateSeededSixPicsPuzzle(dateKey, getPuzzleNumberForDate(dateKey)),
  summarize: (p) => ({
    title: p.title,
    author: p.author,
    editor: p.editor,
    puzzleNumber: p.puzzleNumber,
  }),
};

// ---------------------------------------------------------------------------
// Registry (new countdown games register below as they ship)
// ---------------------------------------------------------------------------

export const PUZZLE_SOURCES: Partial<Record<AllGameSlug, PuzzleSource<never>>> = {
  "21-things": twentyOneSource as unknown as PuzzleSource<never>,
  "17-syllables": seventeenSource as unknown as PuzzleSource<never>,
  "9-rhymes": nineRhymesSource as unknown as PuzzleSource<never>,
  "eightfold-echo": eightfoldEchoSource as unknown as PuzzleSource<never>,
  "6-pics": sixPicsSource as unknown as PuzzleSource<never>,
  "connect-5": connect5Source as unknown as PuzzleSource<never>,
};

export function getPuzzleSource<T = unknown>(
  slug: string
): PuzzleSource<T> | null {
  return (
    (PUZZLE_SOURCES as Record<string, PuzzleSource<unknown> | undefined>)[slug] as
      | PuzzleSource<T>
      | undefined
  ) ?? null;
}
