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

/**
 * Returns the Connect 5 puzzle for a given YYYY-MM-DD date key.
 */
export function getConnect5PuzzleForDate(
  dateKey: string = getLocalDateKey(),
  customOverrides?: Record<string, Connect5Puzzle>
): Connect5Puzzle {
  if (customOverrides && customOverrides[dateKey]) {
    return customOverrides[dateKey];
  }
  const index = getRotationIndexForDate(dateKey, CONNECT_5_PUZZLES.length);
  const base = CONNECT_5_PUZZLES[index];
  return {
    ...base,
    puzzleNumber: getPuzzleNumberForDate(dateKey),
    customDate: dateKey,
  };
}

/**
 * Returns the 21 Things board for a given YYYY-MM-DD date key.
 */
export function get21ThingsBoardForDate(
  dateKey: string = getLocalDateKey(),
  customOverrides?: Record<string, TwentyOneThingsBoard>
): TwentyOneThingsBoard {
  if (customOverrides && customOverrides[dateKey]) {
    return customOverrides[dateKey];
  }
  const index = getRotationIndexForDate(
    dateKey,
    TWENTY_ONE_THINGS_BOARDS.length
  );
  const base = TWENTY_ONE_THINGS_BOARDS[index];
  return {
    ...base,
    puzzleNumber: getPuzzleNumberForDate(dateKey),
    customDate: dateKey,
  };
}

/**
 * Returns the 17 Syllables haiku puzzle for a given YYYY-MM-DD date key.
 */
export function get17SyllablesPuzzleForDate(
  dateKey: string = getLocalDateKey(),
  customOverrides?: Record<string, SeventeenSyllablesPuzzle>
): SeventeenSyllablesPuzzle {
  if (customOverrides && customOverrides[dateKey]) {
    return customOverrides[dateKey];
  }
  const index = getRotationIndexForDate(
    dateKey,
    SEVENTEEN_SYLLABLES_PUZZLES.length
  );
  const base = SEVENTEEN_SYLLABLES_PUZZLES[index];
  return {
    ...base,
    puzzleNumber: getPuzzleNumberForDate(dateKey),
    dateKey,
  };
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

/**
 * Encodes a custom user-created 21 Things board into a compact URL-safe token
 * so friend links work both with and without Supabase configured.
 */
export function encodeShareable21Board(board: {
  id: string;
  title: string;
  creatorName: string;
  creatorBio?: string;
  items: string[];
}): string {
  try {
    const json = JSON.stringify({
      i: board.id,
      t: board.title,
      c: board.creatorName,
      b: board.creatorBio ?? "",
      x: board.items.slice(0, 21),
    });
    if (typeof window !== "undefined") {
      return btoa(encodeURIComponent(json));
    }
    return Buffer.from(encodeURIComponent(json), "utf-8").toString("base64");
  } catch {
    return "";
  }
}

export function decodeShareable21Board(
  token: string
): TwentyOneThingsBoard | null {
  try {
    const raw =
      typeof window !== "undefined"
        ? decodeURIComponent(atob(token))
        : decodeURIComponent(Buffer.from(token, "base64").toString("utf-8"));
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.x) || parsed.x.length !== 21) {
      return null;
    }
    const creatorName = String(parsed.c || "Friend");
    return {
      id: String(parsed.i || `custom-${Date.now()}`),
      puzzleNumber: 0,
      title: String(parsed.t || `${creatorName}'s 21 Things`),
      creatorName,
      creatorHandle: `@${creatorName.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      creatorBio: String(
        parsed.b || "Narrow these 21 things down to the 1 you resonate with most."
      ),
      items: parsed.x.map((s: unknown) => String(s)),
      sampleJourneys: [],
    };
  } catch {
    return null;
  }
}
