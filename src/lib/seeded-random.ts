/**
 * Deterministic PRNG & Runtime Payload Validation Engine
 * Architecture: SOL GaMES (21games.ai) — Requirement R3 / Batch 1
 * Location: src/lib/seeded-random.ts
 *
 * Implements:
 * 1. 32-bit FNV-1a string hashing
 * 2. Mulberry32 32-bit PRNG generator
 * 3. Seeded array shuffle (Fisher-Yates)
 * 4. Deterministic puzzle content hash generator
 * 5. Runtime payload validation for Connect 5 and 21 Things
 */

import type { Connect5Puzzle } from "@/data/puzzles/connect-5";
import type { TwentyOneThingsBoard } from "@/data/puzzles/21-things";

/**
 * 32-bit FNV-1a (Fowler-Noll-Vo) hash.
 * Maps any string (e.g. `${slug}:${dateKey}`) into a uniform unsigned 32-bit integer seed.
 */
export function fnv1a32(input: string): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Fast, high-quality 32-bit PRNG (Mulberry32).
 * Returns a deterministic float in the half-open range [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Extended seeded RNG interface that can be called directly as () => number
 * or via helper methods for ergonomic consumption.
 */
export interface SeededRandomGenerator {
  (): number;
  seed: number;
  slug: string;
  dateKey: string;
  next(): number;
  nextInt(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  sample<T>(items: readonly T[], count: number): T[];
  shuffle<T>(items: readonly T[]): T[];
}

/**
 * Creates a deterministic PRNG function seeded by `${slug}:${dateKey}`.
 * The returned function produces numbers in [0, 1).
 */
export function createSeededRandom(
  slug: string,
  dateKey: string
): SeededRandomGenerator {
  const seed = fnv1a32(`${slug}:${dateKey}`);
  const nextFloat = mulberry32(seed);

  const rng = function (): number {
    return nextFloat();
  } as SeededRandomGenerator;

  rng.seed = seed;
  rng.slug = slug;
  rng.dateKey = dateKey;

  rng.next = function (): number {
    return nextFloat();
  };

  rng.nextInt = function (min: number, max: number): number {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    if (high < low) return low;
    return Math.floor(nextFloat() * (high - low + 1)) + low;
  };

  rng.pick = function <T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from an empty array");
    }
    const idx = Math.floor(nextFloat() * items.length);
    return items[idx]!;
  };

  rng.shuffle = function <T>(items: readonly T[]): T[] {
    return seededShuffle(items, nextFloat);
  };

  rng.sample = function <T>(items: readonly T[], count: number): T[] {
    if (count <= 0) return [];
    if (count >= items.length) return seededShuffle(items, nextFloat);
    const shuffled = seededShuffle(items, nextFloat);
    return shuffled.slice(0, count);
  };

  return rng;
}

/**
 * Alias for createSeededRandom matching survey conventions.
 */
export const createSeededRng = createSeededRandom;

/**
 * Deterministically shuffles an array using the Fisher-Yates algorithm
 * and a seeded PRNG generator. Does not mutate the source array.
 */
export function seededShuffle<T>(
  array: readonly T[],
  rng: (() => number) | { next(): number }
): T[] {
  const copy = [...array];
  const nextFloat = typeof rng === "function" ? rng : () => rng.next();

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat() * (i + 1));
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }

  return copy;
}

/**
 * Recursively canonicalizes an object by sorting all keys
 * and filtering out non-content / transient timestamps.
 */
function canonicalizeContent(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeContent);
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const canonical: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    // Exclude volatile timestamps or transient UI states from content hash
    if (
      key === "updated_at" ||
      key === "created_at" ||
      key === "syncedAt" ||
      key === "elapsedSeconds" ||
      key === "hintsUsed"
    ) {
      continue;
    }
    canonical[key] = canonicalizeContent(obj[key]);
  }
  return canonical;
}

/**
 * Computes a deterministic content hash of a puzzle payload.
 * Used by client games to detect whether a daily puzzle's content has been
 * updated by an administrator, triggering state reset.
 */
export function computePuzzleContentHash(payload: unknown): string {
  if (payload === null || payload === undefined) {
    return "empty";
  }

  try {
    const canonical = canonicalizeContent(payload);
    const serialized = JSON.stringify(canonical);
    const hashInt = fnv1a32(serialized);
    const hex = hashInt.toString(16).padStart(8, "0");

    if (
      typeof payload === "object" &&
      payload !== null &&
      "words" in payload
    ) {
      return `c5:h-${hex}`;
    }
    if (
      typeof payload === "object" &&
      payload !== null &&
      "items" in payload
    ) {
      return `21t:h-${hex}`;
    }
    return `h-${hex}`;
  } catch {
    return "invalid";
  }
}

export interface ValidationResult<T = unknown> {
  valid: boolean;
  errors: string[];
  puzzle?: T;
  board?: T;
}

/**
 * Runtime schema validator for Connect 5 puzzle payloads.
 * Validates:
 * - 5 uppercase words of 2-15 letters
 * - 4 non-empty compound connections
 * - Valid revealed hint coordinates (Row 1-4, Col within word length, Row 0 never in hints)
 * - Non-empty title
 */
export function validateConnect5Payload(
  puzzle: unknown
): ValidationResult<Connect5Puzzle> {
  const errors: string[] = [];

  if (!puzzle || typeof puzzle !== "object" || Array.isArray(puzzle)) {
    return {
      valid: false,
      errors: ["Payload must be a non-null object."],
    };
  }

  const p = puzzle as Record<string, unknown>;

  // Words validation
  if (!Array.isArray(p.words)) {
    errors.push("Missing or invalid 'words' property: must be an array.");
  } else if (p.words.length !== 5) {
    errors.push(
      `'words' array must contain exactly 5 words (found ${p.words.length}).`
    );
  } else {
    p.words.forEach((w, idx) => {
      if (typeof w !== "string") {
        errors.push(`Word at row ${idx + 1} must be a string.`);
      } else {
        const trimmed = w.trim().toUpperCase();
        if (trimmed.length < 2 || trimmed.length > 15) {
          errors.push(
            `Word at row ${idx + 1} ('${w}') must be between 2 and 15 letters.`
          );
        }
        if (!/^[A-Z]+$/.test(trimmed)) {
          errors.push(
            `Word at row ${idx + 1} ('${w}') must contain uppercase letters A-Z only.`
          );
        }
      }
    });
  }

  // Connections validation
  if (!Array.isArray(p.connections)) {
    errors.push(
      "Missing or invalid 'connections' property: must be an array."
    );
  } else if (p.connections.length !== 4) {
    errors.push(
      `'connections' array must contain exactly 4 bridges (found ${p.connections.length}).`
    );
  } else {
    p.connections.forEach((c, idx) => {
      if (typeof c !== "string" || c.trim().length === 0) {
        errors.push(
          `Connection explanation at index ${idx + 1} must be a non-empty string.`
        );
      }
    });
  }

  // Revealed hints validation
  if (!Array.isArray(p.revealedHints)) {
    errors.push(
      "Missing or invalid 'revealedHints' property: must be an array."
    );
  } else {
    const words = Array.isArray(p.words) ? p.words : [];
    p.revealedHints.forEach((hint, idx) => {
      if (!hint || typeof hint !== "object") {
        errors.push(`Revealed hint at index ${idx} must be an object.`);
        return;
      }
      const h = hint as Record<string, unknown>;
      const row = h.row;
      const col = h.col;

      if (typeof row !== "number" || !Number.isInteger(row)) {
        errors.push(`Revealed hint at index ${idx} has non-integer row.`);
      } else if (row === 0) {
        errors.push(
          `Revealed hint at index ${idx} specifies row 0. Row 1 is 100% revealed by definition.`
        );
      } else if (row < 1 || row > 4) {
        errors.push(
          `Revealed hint at index ${idx} has row ${row} out of bounds (allowed: 1-4).`
        );
      }

      if (typeof col !== "number" || !Number.isInteger(col) || col < 0) {
        errors.push(
          `Revealed hint at index ${idx} has invalid column index '${col}'.`
        );
      } else if (
        typeof row === "number" &&
        row >= 0 &&
        row < words.length &&
        typeof words[row] === "string"
      ) {
        const wordLen = (words[row] as string).trim().length;
        if (col >= wordLen) {
          errors.push(
            `Revealed hint at index ${idx} has col ${col} out of range for word '${words[row]}' (length ${wordLen}).`
          );
        }
      }
    });
  }

  // Title validation
  if (typeof p.title !== "string" || p.title.trim().length === 0) {
    errors.push("Missing or empty 'title' property.");
  }

  return {
    valid: errors.length === 0,
    errors,
    puzzle: errors.length === 0 ? (puzzle as Connect5Puzzle) : undefined,
  };
}

/**
 * Runtime schema validator for 21 Things board payloads.
 * Validates:
 * - Exactly 21 non-empty items
 * - Each item <= 50 characters
 * - Non-empty title
 */
export function validate21ThingsPayload(
  board: unknown
): ValidationResult<TwentyOneThingsBoard> {
  const errors: string[] = [];

  if (!board || typeof board !== "object" || Array.isArray(board)) {
    return {
      valid: false,
      errors: ["Payload must be a non-null object."],
    };
  }

  const b = board as Record<string, unknown>;

  // Items validation
  if (!Array.isArray(b.items)) {
    errors.push("Missing or invalid 'items' property: must be an array.");
  } else if (b.items.length !== 21) {
    errors.push(
      `'items' array must contain exactly 21 gratitude items (found ${b.items.length}).`
    );
  } else {
    b.items.forEach((item, idx) => {
      if (typeof item !== "string") {
        errors.push(`Item at position ${idx + 1} must be a string.`);
      } else {
        const trimmed = item.trim();
        if (trimmed.length === 0) {
          errors.push(`Item at position ${idx + 1} cannot be blank.`);
        } else if (trimmed.length > 50) {
          errors.push(
            `Item at position ${idx + 1} is too long (${trimmed.length} chars, max 50).`
          );
        }
      }
    });
  }

  // Title validation
  if (typeof b.title !== "string" || b.title.trim().length === 0) {
    errors.push("Missing or empty 'title' property.");
  }

  return {
    valid: errors.length === 0,
    errors,
    board: errors.length === 0 ? (board as TwentyOneThingsBoard) : undefined,
  };
}
