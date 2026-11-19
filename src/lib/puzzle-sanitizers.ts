/**
 * Lightweight, zero-bank puzzle sanitizers, chunk slicers, and structural schema validators.
 *
 * Kept intentionally free of static puzzle banks (`src/data/puzzles/*`) and procedural solvers
 * (`src/lib/generators/*`) so global root modules (`game-storage.ts`, `user-auth.ts`, `AuthProvider`)
 * never pull 360+ KB of puzzle banks and solvers into every route's initial bundle.
 */

import { getPuzzleNumberForDate } from "@/lib/date-keys";
import type { AllGameSlug } from "@/lib/games-config";

// ============================================================================
// Connect 5 Types & Self-Healing Sanitizer
// ============================================================================

export interface Connect5HintCoordShape {
  row: number; // 1..4
  col: number; // 0-indexed character position
}

export interface Connect5PuzzleShape {
  id: string;
  puzzleNumber: number;
  title: string;
  words: [string, string, string, string, string];
  connections: [string, string, string, string];
  revealedHints: Connect5HintCoordShape[];
  author: string;
  editor: string;
  customDate?: string;
}

const COMMON_COMPOUND_EXPLANATIONS: ReadonlyArray<
  readonly [wordA: string, wordB: string, explanation: string]
> = [
  ["DOG", "HOUSE", "DOGHOUSE — outdoor shelter built for a pet dog"],
  ["HOUSE", "PARTY", "HOUSE PARTY — lively social gathering hosted at home"],
  ["PARTY", "LINE", "PARTY LINE — shared telephone circuit or common group stance"],
  ["LINE", "DANCE", "LINE DANCE — choreographed group dance in synchronized rows"],
  ["TABLE", "TENNIS", "TABLE TENNIS — fast-paced indoor paddle sport (ping-pong)"],
  ["TENNIS", "RACKET", "TENNIS RACKET — strung frame used to serve and volley"],
  ["RACKET", "SPORTS", "RACKET SPORTS — games played with a paddle or strung racket"],
  ["SPORTS", "BAR", "SPORTS BAR — lively pub broadcasting live games on big screens"],
  ["DOG", "TAG", "DOG TAG — stamped metal identification disc"],
  ["DOG", "WOOD", "DOGWOOD — spring-flowering ornamental tree"],
  ["HOUSE", "WORK", "HOUSEWORK — everyday cleaning and upkeep at home"],
  ["HOUSE", "PLANT", "HOUSEPLANT — potted greenery grown indoors"],
  ["PARTY", "HAT", "PARTY HAT — festive paper cone worn at celebrations"],
  ["PARTY", "GAME", "PARTY GAME — group parlor game played with friends"],
  ["DANCE", "FLOOR", "DANCE FLOOR — polished area reserved for dancing"],
  ["FLOOR", "BOARD", "FLOORBOARD — wooden plank laid across floor joists"],
  ["CAT", "NAP", "CATNAP — brief refreshing daytime snooze"],
  ["CAT", "WALK", "CATWALK — narrow elevated runway"],
  ["NAP", "TIME", "NAPTIME — quiet afternoon rest hour"],
  ["COFFEE", "SHOP", "COFFEE SHOP — cozy neighborhood cafe serving espresso"],
  ["BOOK", "CLUB", "BOOK CLUB — group of readers discussing a monthly novel"],
  ["BOOK", "MARK", "BOOKMARK — ribbon or card marking your page"],
  ["BOOK", "CASE", "BOOKCASE — shelved cabinet for storing books"],
  ["HOME", "WORK", "HOMEWORK — after-school study assignment"],
  ["HOME", "TOWN", "HOMETOWN — place where someone grew up"],
  ["HEART", "BEAT", "HEARTBEAT — steady rhythmic pulse"],
  ["BEAT", "BOX", "BEATBOX — vocal percussion mimicking drum machines"],
  ["CAR", "POOL", "CARPOOL — shared daily commute in one vehicle"],
  ["POOL", "SIDE", "POOLSIDE — lounge deck beside the swimming pool"],
  ["GAME", "NIGHT", "GAME NIGHT — evening gathering for cards and board games"],
  ["NIGHT", "FALL", "NIGHTFALL — onset of evening dusk"],
  ["NIGHT", "LIGHT", "NIGHTLIGHT — soft bedside plug-in lamp"],
  ["DAY", "DREAM", "DAYDREAM — pleasant wandering thought while awake"],
  ["DAY", "BREAK", "DAYBREAK — first gleam of morning dawn"],
  ["BREAK", "FAST", "BREAKFAST — morning meal starting the day"],
  ["FAST", "BALL", "FASTBALL — high-velocity pitch straight over the plate"],
  ["FOOT", "BALL", "FOOTBALL — gridiron or pitch team sport"],
  ["BASKET", "BALL", "BASKETBALL — five-on-five court game played with hoops"],
  ["HAND", "SHAKE", "HANDSHAKE — clasped-hand greeting or agreement"],
  ["SNOW", "MAN", "SNOWMAN — three-sphere winter figure with a carrot nose"],
  ["RAIN", "COAT", "RAINCOAT — waterproof outer jacket"],
  ["SEA", "SHELL", "SEASHELL — spiral marine shell washed ashore"],
  ["STAR", "FISH", "STARFISH — five-armed tide-pool echinoderm"],
  ["MOON", "LIGHT", "MOONLIGHT — silvery glow reflected from the moon"],
  ["FIRE", "PLACE", "FIREPLACE — brick or stone indoor hearth"],
  ["AIR", "PORT", "AIRPORT — airfield terminal where flights depart and land"],
  ["KEY", "BOARD", "KEYBOARD — rowed keys for typing or playing music"],
  ["DOOR", "BELL", "DOORBELL — chime button beside the front entrance"],
  ["TREE", "HOUSE", "TREEHOUSE — wooden fort perched among branches"],
  ["CLUB", "HOUSE", "CLUBHOUSE — gathering lodge for members or teammates"],
  ["LIGHT", "HOUSE", "LIGHTHOUSE — coastal beacon tower guiding ships"],
  ["SUN", "SET", "SUNSET — colorful evening sky as the sun dips low"],
  ["SET", "BACK", "SETBACK — temporary reversal or delay"],
  ["BACK", "STAGE", "BACKSTAGE — wings and dressing rooms behind the curtain"],
];

const knownCompoundBridges = new Map<string, string>();
for (const [w1, w2, conn] of COMMON_COMPOUND_EXPLANATIONS) {
  knownCompoundBridges.set(`${w1}|${w2}`, conn);
}

/** Allows `connect-5.ts` to register additional curated compound bridges when loaded. */
export function registerKnownCompoundBridges(
  entries: ReadonlyArray<readonly [string, string, string]>
): void {
  for (const [w1, w2, conn] of entries) {
    const key = `${w1.trim().toUpperCase()}|${w2.trim().toUpperCase()}`;
    if (!knownCompoundBridges.has(key) && conn.trim()) {
      knownCompoundBridges.set(key, conn.trim().replace(/^[.,;:\s]+/, ""));
    }
  }
}

function toTitleWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function doesConnectionMatchWordPair(
  conn: string | undefined | null,
  w1: string,
  w2: string
): boolean {
  const a = (w1 ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  const b = (w2 ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  const cleaned = (conn ?? "").trim().replace(/^[.,;:\s]+/, "");
  if (!cleaned || !a || !b) return false;

  let head: string | null = null;
  if (/[—–]/.test(cleaned)) {
    head = cleaned.split(/[—–]/)[0] ?? null;
  } else if (/\s+-\s+/.test(cleaned)) {
    head = cleaned.split(/\s+-\s+/)[0] ?? null;
  } else if (cleaned.includes(":")) {
    head = cleaned.split(":")[0] ?? null;
  }

  if (head !== null) {
    const headAlpha = head.toUpperCase().replace(/[^A-Z]/g, "");
    const headUpper = head.toUpperCase();
    if (headAlpha === a + b) return true;
    const idxA = headUpper.indexOf(a);
    const idxB = headUpper.lastIndexOf(b);
    return idxA !== -1 && idxB !== -1 && idxA < idxB;
  }

  const upperAlpha = cleaned.toUpperCase().replace(/[^A-Z]/g, "");
  const upperRaw = cleaned.toUpperCase();
  if (upperAlpha.includes(a + b)) return true;
  return upperRaw.includes(a) && upperRaw.includes(b);
}

export function buildDefaultConnect5Connection(w1: string, w2: string): string {
  const a = (w1 ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  const b = (w2 ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (!a || !b) return "";
  const known = knownCompoundBridges.get(`${a}|${b}`);
  if (known) return known;
  return `${a} ${b} — compound phrase linking ${toTitleWord(a)} and ${toTitleWord(b)}`;
}

export function isPlaceholderConnect5Connection(conn: string | undefined | null): boolean {
  return (
    typeof conn === "string" &&
    (/compound phrase linking\s+/i.test(conn) || /^connects\s+\S+\s+to\s+\S+/i.test(conn.trim()))
  );
}

/** Returns any hidden answer word (`words[1..4]`) leaked inside `title`, or `null` if clean. */
export function findConnect5TitleSpoiler(
  title: string,
  words: readonly string[]
): string | null {
  const cleanTitle = (title ?? "").trim().toUpperCase();
  if (!cleanTitle) return null;
  for (let i = 1; i < Math.min(words.length, 5); i++) {
    const hidden = (words[i] ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (hidden.length >= 3 && cleanTitle.includes(hidden)) {
      return hidden;
    }
  }
  return null;
}

export function sanitizeConnect5Puzzle<T extends Connect5PuzzleShape>(puzzle: T): T {
  if (!puzzle || !Array.isArray(puzzle.words) || puzzle.words.length !== 5) {
    return puzzle;
  }

  const normalizedWords = puzzle.words.map((w) =>
    typeof w === "string" ? w.trim().toUpperCase() : ""
  ) as [string, string, string, string, string];
  const wordsChanged = normalizedWords.some((w, idx) => w !== puzzle.words[idx]);

  const rawConns = Array.isArray(puzzle.connections)
    ? puzzle.connections
    : ["", "", "", ""];
  let connsChanged = rawConns.length !== 4;
  const nextConnections = [0, 1, 2, 3].map((idx) => {
    const w1 = normalizedWords[idx] ?? "";
    const w2 = normalizedWords[idx + 1] ?? "";
    const raw = typeof rawConns[idx] === "string" ? rawConns[idx]! : "";
    const trimmed = raw.trim().replace(/^[.,;:\s]+/, "");
    const healed = doesConnectionMatchWordPair(trimmed, w1, w2)
      ? trimmed
      : buildDefaultConnect5Connection(w1, w2);
    if (healed !== raw) {
      connsChanged = true;
    }
    return healed;
  }) as [string, string, string, string];

  const rawHints = Array.isArray(puzzle.revealedHints) ? puzzle.revealedHints : [];
  const validHints = rawHints.filter(
    (h) =>
      h &&
      Number.isInteger(h.row) &&
      Number.isInteger(h.col) &&
      h.row >= 1 &&
      h.row <= 4 &&
      h.col >= 0 &&
      h.col < (normalizedWords[h.row]?.length ?? 0)
  );
  const hintsChanged = validHints.length !== rawHints.length;

  if (!wordsChanged && !connsChanged && !hintsChanged) {
    return puzzle;
  }

  return {
    ...puzzle,
    words: wordsChanged ? normalizedWords : puzzle.words,
    connections: connsChanged ? nextConnections : puzzle.connections,
    revealedHints: hintsChanged ? validHints : puzzle.revealedHints,
  };
}

// ============================================================================
// 17 Syllables Unified Chunk Slicer & Self-Healing Sanitizer
// ============================================================================

export interface HaikuWordShape {
  text: string;
  chunks: string[];
}

export interface HaikuLineInfoShape {
  syllables: number;
  text: string;
  words: HaikuWordShape[];
}

export interface SeventeenSyllablesPuzzleShape {
  id: string;
  puzzleNumber: number;
  dateKey: string;
  theme: string;
  author: string;
  lines: [string, string, string];
  chunks: string[];
  customWordChunks?: Record<string, string[]>;
}

export function sliceSingleWord(word: string, shouldSplit: boolean): string[] {
  const upper = word.toUpperCase().replace(/[^A-Z]/g, "");
  if (!upper) return [];
  if (!shouldSplit || upper.length <= 3) {
    return [upper];
  }
  if (upper.length === 4) {
    return [upper.slice(0, 2), upper.slice(2)];
  }
  if (upper.length === 5) {
    if (upper.endsWith("ASS")) {
      return [upper.slice(0, 3), upper.slice(3)];
    }
    return [upper.slice(0, 2), upper.slice(2)];
  }
  if (upper.length === 6 || upper.length === 7) {
    return [upper.slice(0, 3), upper.slice(3)];
  }
  if (upper.length === 8) {
    return [upper.slice(0, 4), upper.slice(4)];
  }
  return [upper.slice(0, 3), upper.slice(3, 6), upper.slice(6)];
}

/**
 * Single source of truth for building structured 3-line haiku word & chunk layouts.
 * Ensures `/admin`, `sliceHaikuIntoChunks`, `sanitize17SyllablesPuzzle`, and live gameplay
 * produce identical chunk splits across [14..20] chunks.
 */
export function buildStructuredHaikuLines(
  lines: [string, string, string],
  customWordChunks?: Record<string, string[]>,
  targetChunkCount = 16
): HaikuLineInfoShape[] {
  const lineWords = lines.map((l) =>
    l
      .toUpperCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^A-Z]/g, ""))
      .filter((w) => w.length > 0)
  );
  const allWords = lineWords.flat();
  const baseChunks = allWords.map((w) => [w]);
  let totalChunks = baseChunks.length;

  const candidateIndices = allWords
    .map((w, idx) => ({ idx, len: w.length }))
    .filter((item) => item.len >= 4)
    .sort((a, b) => b.len - a.len);

  for (const { idx } of candidateIndices) {
    if (totalChunks >= targetChunkCount) break;
    const sliced = sliceSingleWord(allWords[idx]!, true);
    if (sliced.length > 1) {
      totalChunks += sliced.length - 1;
      baseChunks[idx] = sliced;
    }
  }

  if (totalChunks < 14) {
    for (let i = 0; i < allWords.length && totalChunks < 14; i++) {
      if (baseChunks[i]!.length === 1 && allWords[i]!.length === 3) {
        baseChunks[i] = [allWords[i]!.slice(0, 1), allWords[i]!.slice(1)];
        totalChunks += 1;
      }
    }
  }

  let wordPointer = 0;
  return lines.map((line, lineIdx) => {
    const rawWords = lineWords[lineIdx]!;
    const words: HaikuWordShape[] = rawWords.map((word, wordIdx) => {
      const customKey = `${lineIdx}-${wordIdx}`;
      const override = customWordChunks?.[customKey];
      const overrideClean = override
        ?.map((c) => c.toUpperCase().replace(/[^A-Z]/g, ""))
        .filter(Boolean);
      const defaultChunks = baseChunks[wordPointer] ?? [word];
      wordPointer++;
      const chunks =
        overrideClean && overrideClean.length > 0 && overrideClean.join("") === word
          ? overrideClean
          : defaultChunks;
      return { text: word, chunks };
    });

    return {
      syllables: lineIdx === 1 ? 7 : 5,
      text: line.toUpperCase().trim(),
      words,
    };
  });
}

export function sliceHaikuIntoChunks(
  lines: [string, string, string],
  targetChunkCount = 16
): string[] {
  return buildStructuredHaikuLines(lines, undefined, targetChunkCount).flatMap((l) =>
    l.words.flatMap((w) => w.chunks)
  );
}

/** Prunes any `customWordChunks` entry whose joined letters no longer match `(lineIdx, wordIdx)`. */
export function sanitizeCustomWordChunks(
  lines: [string, string, string],
  customWordChunks?: Record<string, string[]>
): Record<string, string[]> | undefined {
  if (!customWordChunks || typeof customWordChunks !== "object") {
    return undefined;
  }
  const cleaned: Record<string, string[]> = {};
  for (let lineIdx = 0; lineIdx < 3; lineIdx++) {
    const words = (lines[lineIdx] ?? "")
      .toUpperCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^A-Z]/g, ""))
      .filter(Boolean);
    words.forEach((word, wordIdx) => {
      const key = `${lineIdx}-${wordIdx}`;
      const raw = customWordChunks[key];
      if (!Array.isArray(raw)) return;
      const norm = raw
        .map((c) => (typeof c === "string" ? c.toUpperCase().replace(/[^A-Z]/g, "") : ""))
        .filter(Boolean);
      if (norm.length > 0 && norm.join("") === word) {
        cleaned[key] = norm;
      }
    });
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export function sanitize17SyllablesPuzzle<T extends SeventeenSyllablesPuzzleShape>(
  puzzle: T,
  scheduledDateKey?: string
): T {
  if (!puzzle || !Array.isArray(puzzle.lines) || puzzle.lines.length !== 3) {
    return puzzle;
  }

  const sanitizedCustom = sanitizeCustomWordChunks(
    puzzle.lines,
    puzzle.customWordChunks
  );
  const customChanged =
    JSON.stringify(sanitizedCustom ?? null) !==
    JSON.stringify(puzzle.customWordChunks ?? null);

  const linesAlpha = puzzle.lines
    .join("")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const rawChunks = Array.isArray(puzzle.chunks) ? puzzle.chunks : [];
  const chunksAlpha = rawChunks
    .map((c) => (typeof c === "string" ? c : ""))
    .join("")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  const needsChunkHeal = !linesAlpha || chunksAlpha !== linesAlpha || customChanged;
  const healedChunks = needsChunkHeal
    ? buildStructuredHaikuLines(puzzle.lines, sanitizedCustom).flatMap((l) =>
        l.words.flatMap((w) => w.chunks)
      )
    : puzzle.chunks;

  const effectiveDateKey =
    scheduledDateKey && /^\d{4}-\d{2}-\d{2}$/.test(scheduledDateKey)
      ? scheduledDateKey
      : undefined;
  const expectedPuzzleNum =
    effectiveDateKey && puzzle.puzzleNumber !== 0
      ? getPuzzleNumberForDate(effectiveDateKey)
      : puzzle.puzzleNumber;
  const nextDateKey = effectiveDateKey ?? puzzle.dateKey;

  if (
    !needsChunkHeal &&
    !customChanged &&
    expectedPuzzleNum === puzzle.puzzleNumber &&
    nextDateKey === puzzle.dateKey
  ) {
    return puzzle;
  }

  const next: T = {
    ...puzzle,
    dateKey: nextDateKey,
    puzzleNumber: expectedPuzzleNum,
    chunks: healedChunks,
  };
  if (sanitizedCustom) {
    next.customWordChunks = sanitizedCustom;
  } else {
    delete next.customWordChunks;
  }
  return next;
}

// ============================================================================
// Lightweight Override Schema Validation (All 9 Countdown Games)
// ============================================================================

const GENERIC_OVERRIDE_SLUGS: ReadonlySet<string> = new Set([
  "9-rhymes",
  "eightfold-echo",
  "6-pics",
  "four-score",
  "move-2",
  "1-win",
]);

export function isGenericOverrideSlugLight(slug: unknown): slug is AllGameSlug {
  return typeof slug === "string" && GENERIC_OVERRIDE_SLUGS.has(slug);
}

export function validateLightOverridePayload(
  gameSlug: string,
  payload: unknown
): boolean {
  if (!payload || typeof payload !== "object") return false;
  const o = payload as Record<string, unknown>;

  switch (gameSlug) {
    case "connect-5":
      return (
        Array.isArray(o.words) &&
        o.words.length === 5 &&
        o.words.every((w) => typeof w === "string" && w.trim().length >= 2)
      );
    case "21-things":
      return (
        Array.isArray(o.items) &&
        o.items.length === 21 &&
        o.items.every((s) => typeof s === "string" && s.trim().length > 0)
      );
    case "17-syllables":
      return (
        Array.isArray(o.lines) &&
        o.lines.length === 3 &&
        o.lines.every((l) => typeof l === "string" && l.trim().length > 0) &&
        typeof o.theme === "string"
      );
    case "9-rhymes":
      return (
        typeof o.starterWord === "string" &&
        o.starterWord.trim().length >= 2 &&
        Array.isArray(o.clues) &&
        o.clues.length === 9
      );
    case "eightfold-echo":
      return (
        Array.isArray(o.tiles) &&
        o.tiles.length === 9 &&
        Array.isArray(o.solutionPath) &&
        o.solutionPath.length === 9
      );
    case "6-pics":
      return (
        typeof o.themeAnswer === "string" &&
        o.themeAnswer.trim().length > 0 &&
        Array.isArray(o.items) &&
        o.items.length === 6
      );
    case "four-score":
      return (
        o.target === 80 &&
        Array.isArray(o.numbers) &&
        o.numbers.length >= 4 &&
        o.numbers.length <= 6
      );
    case "move-2": {
      if (o.version !== 3 || !o.stages || typeof o.stages !== "object") {
        return false;
      }
      const stages = o.stages as Record<string, Record<string, unknown> | undefined>;
      return (
        stages.easy?.rows === 6 &&
        stages.easy?.cols === 6 &&
        Array.isArray(stages.easy?.grid) &&
        stages.medium?.rows === 8 &&
        stages.medium?.cols === 8 &&
        Array.isArray(stages.medium?.grid) &&
        stages.hard?.rows === 10 &&
        stages.hard?.cols === 10 &&
        Array.isArray(stages.hard?.grid)
      );
    }
    case "1-win":
      return (
        typeof o.prompt === "string" &&
        o.prompt.trim().length > 0 &&
        typeof o.title === "string"
      );
    default:
      return false;
  }
}
