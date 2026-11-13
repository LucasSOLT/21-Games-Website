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
  getConnect5PuzzleForDate,
  type Connect5Puzzle,
} from "@/data/puzzles/connect-5";
import {
  TWENTY_ONE_THINGS_BOARDS,
  get21ThingsBoardForDate,
  type TwentyOneThingsBoard,
} from "@/data/puzzles/21-things";
import {
  SEVENTEEN_SYLLABLES_PUZZLES,
  get17SyllablesPuzzleForDate,
  validateHaikuStructure,
  type SeventeenSyllablesPuzzle,
} from "@/data/puzzles/17-syllables";
import {
  generateSeededNineRhymesPuzzle,
  getNineRhymesPuzzleForDate,
  isNineRhymesPuzzle,
  type NineRhymesPuzzle,
} from "@/data/puzzles/9-rhymes";
import {
  generateSeededEightfoldEchoPuzzle,
  getEightfoldEchoPuzzleForDate,
  isEightfoldEchoPuzzle,
  type EightfoldEchoPuzzle,
} from "@/data/puzzles/eightfold-echo";
import {
  generateSeededSixPicsPuzzle,
  getSixPicsPuzzleForDate,
  isSixPicsPuzzle,
  type SixPicsPuzzle,
} from "@/data/puzzles/6-pics";
import {
  generateSeededFourScorePuzzle,
  getFourScorePuzzleForDate,
  isFourScorePuzzle,
  type FourScorePuzzle,
} from "@/data/puzzles/four-score";
import {
  MOVE_TWO_PUZZLES,
  generateMoveTwoPuzzle,
  generateSeededMoveTwoPuzzle,
  isMoveTwoPuzzle,
  type MoveTwoPuzzle,
} from "@/data/puzzles/move-2";
import {
  generateSeededOneWinPuzzle,
  getOneWinPuzzleForDate,
  isOneWinPuzzle,
  type OneWinPromptPuzzle,
} from "@/data/puzzles/1-win";
import {
  ROTATION_ANCHOR,
  daysBetweenDateKeys,
  getPuzzleNumberForDate,
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
// Countdown games (21 -> 1)
// ---------------------------------------------------------------------------

const connect5Source: PuzzleSource<Connect5Puzzle> = {
  slug: "connect-5",
  validate: (p): p is Connect5Puzzle => validateConnect5Payload(p).valid,
  fromBank(dateKey) {
    return getConnect5PuzzleForDate(dateKey);
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
    return get21ThingsBoardForDate(dateKey);
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
  if (
    !Array.isArray(o.lines) ||
    o.lines.length !== 3 ||
    !o.lines.every((l) => typeof l === "string" && l.trim().length > 0) ||
    !Array.isArray(o.chunks) ||
    o.chunks.length === 0 ||
    typeof o.theme !== "string"
  ) {
    return false;
  }
  return validateHaikuStructure(o.lines as [string, string, string]).isValid;
}

const seventeenSource: PuzzleSource<SeventeenSyllablesPuzzle> = {
  slug: "17-syllables",
  validate: isSeventeenSyllablesPayload,
  fromBank(dateKey) {
    return get17SyllablesPuzzleForDate(dateKey);
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
    return getNineRhymesPuzzleForDate(dateKey);
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
    return getEightfoldEchoPuzzleForDate(dateKey);
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
    return getSixPicsPuzzleForDate(dateKey);
  },
  generateSeeded: (dateKey) =>
    generateSeededSixPicsPuzzle(dateKey, getPuzzleNumberForDate(dateKey)),
  summarize: (p) => ({
    title: `${p.themeAnswer} — ${p.title}`,
    author: p.author,
    editor: p.editor,
    puzzleNumber: p.puzzleNumber,
  }),
};

const fourScoreSource: PuzzleSource<FourScorePuzzle> = {
  slug: "four-score",
  validate: isFourScorePuzzle,
  fromBank(dateKey) {
    return getFourScorePuzzleForDate(dateKey);
  },
  generateSeeded: (dateKey) =>
    generateSeededFourScorePuzzle(dateKey, getPuzzleNumberForDate(dateKey)),
  summarize: (p) => ({
    title: p.title,
    author: p.author,
    editor: p.editor,
    puzzleNumber: p.puzzleNumber,
  }),
};

const MOVE_TWO_DATE_CACHE = new Map<string, MoveTwoPuzzle>();
const SEEN_MOVE_TWO_SIGNATURES = new Set<string>(
  MOVE_TWO_PUZZLES.map((p) => JSON.stringify(p.faces))
);

const moveTwoSource: PuzzleSource<MoveTwoPuzzle> = {
  slug: "move-2",
  validate: isMoveTwoPuzzle,
  fromBank(dateKey) {
    const puzzleNumber = getPuzzleNumberForDate(dateKey);
    const diff = daysBetweenDateKeys(ROTATION_ANCHOR, dateKey);
    if (diff >= 0 && diff < MOVE_TWO_PUZZLES.length) {
      const base = MOVE_TWO_PUZZLES[diff]!;
      return {
        ...base,
        puzzleNumber,
        customDate: dateKey,
      };
    }
    const cached = MOVE_TWO_DATE_CACHE.get(dateKey);
    if (cached) {
      return {
        ...cached,
        puzzleNumber,
        customDate: dateKey,
      };
    }
    let chosen: MoveTwoPuzzle | null = null;
    for (let attempt = 0; attempt < 32; attempt++) {
      const seed =
        attempt === 0 ? `bank:date:${dateKey}` : `bank:date:${dateKey}:a${attempt}`;
      const candidate = generateMoveTwoPuzzle(seed, {
        id: `m2-bank-${dateKey}`,
        puzzleNumber,
        customDate: dateKey,
      });
      const sig = JSON.stringify(candidate.faces);
      if (!SEEN_MOVE_TWO_SIGNATURES.has(sig)) {
        SEEN_MOVE_TWO_SIGNATURES.add(sig);
        chosen = candidate;
        break;
      }
      if (!chosen) {
        chosen = candidate;
      }
    }
    const finalPuzzle = chosen!;
    MOVE_TWO_DATE_CACHE.set(dateKey, finalPuzzle);
    return finalPuzzle;
  },
  generateSeeded: (dateKey) =>
    generateSeededMoveTwoPuzzle(dateKey, getPuzzleNumberForDate(dateKey)),
  summarize: (p) => ({
    title: `${p.title} (Par ${p.par})`,
    author: p.author,
    editor: p.editor,
    puzzleNumber: p.puzzleNumber,
  }),
};

const oneWinSource: PuzzleSource<OneWinPromptPuzzle> = {
  slug: "1-win",
  validate: isOneWinPuzzle,
  fromBank(dateKey) {
    return getOneWinPuzzleForDate(dateKey);
  },
  generateSeeded: (dateKey) =>
    generateSeededOneWinPuzzle(dateKey, getPuzzleNumberForDate(dateKey)),
  summarize: (p) => ({
    title: p.title,
    author: p.author,
    editor: p.editor,
    puzzleNumber: p.puzzleNumber,
  }),
};

// ---------------------------------------------------------------------------
// Registry (all 9 countdown games registered in 21 -> 1 order)
// ---------------------------------------------------------------------------

export const PUZZLE_SOURCES: Partial<Record<AllGameSlug, PuzzleSource<never>>> = {
  "21-things": twentyOneSource as unknown as PuzzleSource<never>,
  "17-syllables": seventeenSource as unknown as PuzzleSource<never>,
  "9-rhymes": nineRhymesSource as unknown as PuzzleSource<never>,
  "eightfold-echo": eightfoldEchoSource as unknown as PuzzleSource<never>,
  "6-pics": sixPicsSource as unknown as PuzzleSource<never>,
  "connect-5": connect5Source as unknown as PuzzleSource<never>,
  "four-score": fourScoreSource as unknown as PuzzleSource<never>,
  "move-2": moveTwoSource as unknown as PuzzleSource<never>,
  "1-win": oneWinSource as unknown as PuzzleSource<never>,
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
