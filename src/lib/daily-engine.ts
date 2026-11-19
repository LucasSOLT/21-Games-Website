import {
  getConnect5PuzzleForDate,
  type Connect5Puzzle,
} from "@/data/puzzles/connect-5";
import {
  get21ThingsBoardForDate,
  type TwentyOneThingsBoard,
} from "@/data/puzzles/21-things";
import {
  get17SyllablesPuzzleForDate,
  type SeventeenSyllablesPuzzle,
} from "@/data/puzzles/17-syllables";
import type { AllGameSlug, PlayableGameSlug } from "@/lib/games-config";
import { getPuzzleSource, type PuzzleSummary } from "@/lib/puzzle-sources";
import {
  daysBetweenDateKeys,
  formatLongDate,
  formatShortArchiveDate,
  getLocalDateKey,
  getPastDateKeys,
  getPuzzleNumberForDate,
  getRotationIndexForDate,
  parseDateKeyToLocalNoon,
} from "@/lib/date-keys";

export {
  daysBetweenDateKeys,
  formatLongDate,
  formatShortArchiveDate,
  getLocalDateKey,
  getPastDateKeys,
  getPuzzleNumberForDate,
  getRotationIndexForDate,
  parseDateKeyToLocalNoon,
  getConnect5PuzzleForDate,
  get21ThingsBoardForDate,
  get17SyllablesPuzzleForDate,
  type Connect5Puzzle,
  type TwentyOneThingsBoard,
  type SeventeenSyllablesPuzzle,
};

const AUTHORS_ROTATION = [
  { author: "SOL Theory", editor: "Daily Editorial" },
  { author: "Puzzle Master", editor: "SOL Theory" },
  { author: "Daily Games Team", editor: "SOL Theory" },
  { author: "SOL Theory", editor: "Words & Logic Desk" },
];

export function getCreditsForDate(dateKey: string = getLocalDateKey()): {
  author: string;
  editor: string;
} {
  const idx = getRotationIndexForDate(dateKey, AUTHORS_ROTATION.length);
  return AUTHORS_ROTATION[idx];
}

export function getAuthorForDate(date: Date = new Date()): string {
  return getCreditsForDate(getLocalDateKey(date)).author;
}

export interface ArchiveEntrySummary {
  dateKey: string;
  dayName: string;
  dateFormatted: string;
  puzzleNumber: number;
  gameSlug: PlayableGameSlug;
  title: string;
  author: string;
  editor: string;
}

export type DailyPuzzleOrigin = "override" | "bank" | "seeded-fallback";

export interface DailyPuzzleResolution<T = unknown> {
  gameSlug: AllGameSlug;
  dateKey: string;
  puzzle: T;
  origin: DailyPuzzleOrigin;
  summary: PuzzleSummary;
}

/**
 * Resolves the daily puzzle payload for ANY registered game + date with zero-breakage guarantees:
 *   1. `override` (Supabase / admin localStorage) — only when it passes runtime payload validation.
 *   2. `bank`      deterministic rotation through the static bank (validated).
 *   3. `seeded-fallback` deterministic `hash(gameSlug + ":" + dateKey)` generator.
 * Returns `null` only when the game has no registered puzzle source yet.
 */
export function getDailyPuzzleForGame<T = unknown>(
  gameSlug: string,
  dateKey: string = getLocalDateKey(),
  overrides?: Record<string, unknown> | null
): DailyPuzzleResolution<T> | null {
  const source = getPuzzleSource<T>(gameSlug);
  if (!source) return null;

  const make = (puzzle: T, origin: DailyPuzzleOrigin): DailyPuzzleResolution<T> => ({
    gameSlug: source.slug,
    dateKey,
    puzzle,
    origin,
    summary: source.summarize(puzzle, dateKey),
  });

  const override = overrides?.[dateKey];
  if (override !== undefined && override !== null) {
    try {
      if (source.validate(override)) return make(override, "override");
    } catch {
      // Malformed override — fall through to bank
    }
  }

  try {
    const fromBank = source.fromBank(dateKey);
    if (source.validate(fromBank)) return make(fromBank, "bank");
  } catch {
    // Bank failure — fall through to seeded generator
  }

  return make(source.generateSeeded(dateKey), "seeded-fallback");
}

/**
 * Builds the archive rows for any registered game. `overridesForGame` is the per-date
 * override map (admin/Supabase cache) for that single game.
 */
export function getArchiveEntriesForGame(
  gameSlug: PlayableGameSlug,
  daysCount: number = 60,
  fromDate: Date = new Date(),
  overridesForGame?: Record<string, unknown> | null
): ArchiveEntrySummary[] {
  const dateKeys = getPastDateKeys(daysCount, fromDate);
  const out: ArchiveEntrySummary[] = [];
  for (const dateKey of dateKeys) {
    const resolved = getDailyPuzzleForGame(gameSlug, dateKey, overridesForGame);
    if (!resolved) continue;
    const { dayName, dateFormatted } = formatShortArchiveDate(dateKey);
    out.push({
      dateKey,
      dayName,
      dateFormatted,
      puzzleNumber: resolved.summary.puzzleNumber,
      gameSlug,
      title: resolved.summary.title,
      author: resolved.summary.author,
      editor: resolved.summary.editor,
    });
  }
  return out;
}

export { encodeShareable21Board, decodeShareable21Board } from "@/data/puzzles/21-things";
