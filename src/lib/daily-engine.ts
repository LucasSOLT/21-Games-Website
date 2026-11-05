import {
  CONNECT_5_PUZZLES,
  type Connect5Puzzle,
} from "@/data/puzzles/connect-5";
import {
  TWENTY_ONE_THINGS_BOARDS,
  type TwentyOneThingsBoard,
} from "@/data/puzzles/21-things";
import type { PlayableGameSlug } from "@/lib/games-config";

const LAUNCH_EPOCH = "2026-09-01";
const ROTATION_ANCHOR = "2026-11-05";

const AUTHORS_ROTATION = [
  { author: "Lucas Huff", editor: "Stephen Huff" },
  { author: "Stephen Huff", editor: "Lucas Huff" },
  { author: "Gerard Rick Jardin", editor: "Lucas Huff" },
  { author: "Lucas Huff", editor: "Gerard Rick Jardin" },
];

/**
 * Formats a Date object as local YYYY-MM-DD (browser timezone).
 */
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into a local Date at noon (avoids DST boundary shifts).
 */
export function parseDateKeyToLocalNoon(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * Computes whole calendar days between two YYYY-MM-DD strings.
 */
export function daysBetweenDateKeys(startKey: string, endKey: string): number {
  const a = parseDateKeyToLocalNoon(startKey);
  const b = parseDateKeyToLocalNoon(endKey);
  const diffMs = b.getTime() - a.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Monotonically increasing daily puzzle number (#1, #2, ...).
 */
export function getPuzzleNumberForDate(dateKey: string = getLocalDateKey()): number {
  const diff = daysBetweenDateKeys(LAUNCH_EPOCH, dateKey);
  return diff >= 0 ? diff + 1 : Math.abs(diff) + 1;
}

/**
 * Returns deterministic rotation index into a bank of length `bankLength`.
 */
export function getRotationIndexForDate(
  dateKey: string,
  bankLength: number
): number {
  const diff = daysBetweenDateKeys(ROTATION_ANCHOR, dateKey);
  return ((diff % bankLength) + bankLength) % bankLength;
}

/**
 * Formats a YYYY-MM-DD date key like "Thursday, November 5" or "Nov. 5, 2026".
 */
export function formatLongDate(dateKey: string): string {
  const d = parseDateKeyToLocalNoon(dateKey);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
}

export function formatShortArchiveDate(dateKey: string): {
  dayName: string;
  dateFormatted: string;
} {
  const d = parseDateKeyToLocalNoon(dateKey);
  const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    d
  );
  const dateFormatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
  return { dayName, dateFormatted };
}

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
 * Generates an array of past N date keys (including today at index 0) for Archive views.
 */
export function getPastDateKeys(
  daysCount: number = 60,
  fromDate: Date = new Date()
): string[] {
  const keys: string[] = [];
  for (let i = 0; i < daysCount; i++) {
    const d = new Date(
      fromDate.getFullYear(),
      fromDate.getMonth(),
      fromDate.getDate() - i,
      12,
      0,
      0
    );
    keys.push(getLocalDateKey(d));
  }
  return keys;
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

export function getArchiveEntriesForGame(
  gameSlug: PlayableGameSlug,
  daysCount: number = 60,
  fromDate: Date = new Date(),
  c5Overrides?: Record<string, Connect5Puzzle>,
  t21Overrides?: Record<string, TwentyOneThingsBoard>
): ArchiveEntrySummary[] {
  const dateKeys = getPastDateKeys(daysCount, fromDate);
  return dateKeys.map((dateKey) => {
    const { dayName, dateFormatted } = formatShortArchiveDate(dateKey);
    if (gameSlug === "connect-5") {
      const p = getConnect5PuzzleForDate(dateKey, c5Overrides);
      return {
        dateKey,
        dayName,
        dateFormatted,
        puzzleNumber: p.puzzleNumber,
        gameSlug,
        title: `${p.title} (${p.words[0]} → …)`,
        author: p.author,
        editor: p.editor,
      };
    } else {
      const b = get21ThingsBoardForDate(dateKey, t21Overrides);
      return {
        dateKey,
        dayName,
        dateFormatted,
        puzzleNumber: b.puzzleNumber,
        gameSlug,
        title: b.title,
        author: b.creatorName,
        editor: "Stephen Huff",
      };
    }
  });
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
