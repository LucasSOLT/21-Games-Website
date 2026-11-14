/**
 * Move Two (`move-2`) — 66-day 3-Difficulty Bloxorz (`6×6` Easy · `8×8` Medium · `10×10` Hard)
 * BFS-solver-verified puzzle bank + 2026–2027 zero-duplicate daily resolution.
 */

import {
  ROTATION_ANCHOR,
  daysBetweenDateKeys,
  getPuzzleNumberForDate,
} from "@/lib/date-keys";
import {
  MOVE_TWO_BOARD_SIZES,
  MOVE_TWO_DIFFICULTIES,
  MOVE_TWO_DIFFICULTY_META,
  MOVE_TWO_DIRECTIONS,
  MOVE_TWO_POSTURES,
  MOVE_TWO_TILE_TYPES,
  computeMoveTwoStars,
  computeRawRoll,
  createMoveTwoGrid,
  generateBloxorzStage,
  generateMoveTwoMonthlyBatch,
  generateMoveTwoPuzzle,
  getBridgeForCell,
  getDominoCells,
  getInitialBlockState,
  getInitialBridgeMask,
  getSwitchAtCell,
  isBridgeOpen,
  isInBoundsStage,
  isMoveTwoPuzzle,
  solveBloxorzStage,
  solveMoveTwo,
  stepBloxorzBlock,
  validateMoveTwoPuzzle,
  validateMoveTwoStage,
  verifySwitchNecessity,
  type MoveTwoBlockState,
  type MoveTwoBridgeDef,
  type MoveTwoCoord,
  type MoveTwoDifficulty,
  type MoveTwoDirection,
  type MoveTwoPosture,
  type MoveTwoPuzzle,
  type MoveTwoSolveResult,
  type MoveTwoStage,
  type MoveTwoStageSolveResult,
  type MoveTwoStepOutcome,
  type MoveTwoSwitchBehavior,
  type MoveTwoSwitchDef,
  type MoveTwoTileType,
} from "@/lib/generators/move-two-generator";

export {
  MOVE_TWO_BOARD_SIZES,
  MOVE_TWO_DIFFICULTIES,
  MOVE_TWO_DIFFICULTY_META,
  MOVE_TWO_DIRECTIONS,
  MOVE_TWO_POSTURES,
  MOVE_TWO_TILE_TYPES,
  computeMoveTwoStars,
  computeRawRoll,
  createMoveTwoGrid,
  generateBloxorzStage,
  generateMoveTwoMonthlyBatch,
  generateMoveTwoPuzzle,
  getBridgeForCell,
  getDominoCells,
  getInitialBlockState,
  getInitialBridgeMask,
  getSwitchAtCell,
  isBridgeOpen,
  isInBoundsStage,
  isMoveTwoPuzzle,
  solveBloxorzStage,
  solveMoveTwo,
  stepBloxorzBlock,
  validateMoveTwoPuzzle,
  validateMoveTwoStage,
  verifySwitchNecessity,
  type MoveTwoBlockState,
  type MoveTwoBridgeDef,
  type MoveTwoCoord,
  type MoveTwoDifficulty,
  type MoveTwoDirection,
  type MoveTwoPosture,
  type MoveTwoPuzzle,
  type MoveTwoSolveResult,
  type MoveTwoStage,
  type MoveTwoStageSolveResult,
  type MoveTwoStepOutcome,
  type MoveTwoSwitchBehavior,
  type MoveTwoSwitchDef,
  type MoveTwoTileType,
};

export const MOVE_TWO_BANK_SIZE = 66;

function computeStageSignature(stage: MoveTwoStage): string {
  return JSON.stringify({
    grid: stage.grid,
    start: stage.start,
    goal: stage.goal,
    bridges: stage.bridges,
    switches: stage.switches,
  });
}

const SEEN_STAGE_SIGNATURES: Record<MoveTwoDifficulty, Set<string>> = {
  easy: new Set<string>(),
  medium: new Set<string>(),
  hard: new Set<string>(),
};

function generateUniqueStageForPool(
  baseSeed: string,
  difficulty: MoveTwoDifficulty
): MoveTwoStage {
  const seen = SEEN_STAGE_SIGNATURES[difficulty];
  let firstCandidate: MoveTwoStage | null = null;
  for (let attempt = 0; attempt < 64; attempt++) {
    const seed =
      attempt === 0 ? `${baseSeed}:${difficulty}` : `${baseSeed}:${difficulty}:u${attempt}`;
    const candidate = generateBloxorzStage(seed, difficulty);
    if (!firstCandidate) firstCandidate = candidate;
    const sig = computeStageSignature(candidate);
    if (!seen.has(sig)) {
      seen.add(sig);
      return candidate;
    }
  }
  return firstCandidate!;
}

function generateUniqueBundleForPool(
  baseSeed: string,
  meta: {
    id: string;
    puzzleNumber: number;
    customDate?: string;
  }
): MoveTwoPuzzle {
  const baseMeta = generateMoveTwoPuzzle(baseSeed, meta);
  const easy = generateUniqueStageForPool(baseSeed, "easy");
  const medium = generateUniqueStageForPool(baseSeed, "medium");
  const hard = generateUniqueStageForPool(baseSeed, "hard");
  return {
    ...baseMeta,
    stages: { easy, medium, hard },
    par: medium.par,
  };
}

function buildMoveTwoBank(): MoveTwoPuzzle[] {
  const bank: MoveTwoPuzzle[] = [];
  for (let i = 0; i < MOVE_TWO_BANK_SIZE; i++) {
    bank.push(
      generateUniqueBundleForPool(`bank:v3:${i}`, {
        id: `m2-bank-${String(i + 1).padStart(2, "0")}`,
        puzzleNumber: i + 1,
      })
    );
  }
  return bank;
}

/** 66-day BFS-verified 3-difficulty (`6×6` / `8×8` / `10×10`) Bloxorz puzzle bank. */
export const MOVE_TWO_PUZZLES: MoveTwoPuzzle[] = buildMoveTwoBank();

const DATE_PUZZLE_CACHE = new Map<string, MoveTwoPuzzle>();

/** Deterministic date-seeded fallback keyed by `move-2:${dateKey}`. */
export function generateSeededMoveTwoPuzzle(
  dateKey: string,
  puzzleNumber: number = getPuzzleNumberForDate(dateKey)
): MoveTwoPuzzle {
  return generateMoveTwoPuzzle(`seed:v3:${dateKey}`, {
    id: `m2-seed-${dateKey}`,
    puzzleNumber,
    customDate: dateKey,
  });
}

/**
 * Resolves a deterministic, BFS-verified 3-difficulty Bloxorz puzzle for any date
 * across 2026–2027 (and beyond) with zero duplicate stages across all difficulties.
 */
export function getMoveTwoPuzzleForDate(
  dateKey: string,
  overrides?: Record<string, MoveTwoPuzzle>
): MoveTwoPuzzle {
  const override = overrides?.[dateKey];
  if (override && isMoveTwoPuzzle(override)) {
    return override;
  }

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

  const cached = DATE_PUZZLE_CACHE.get(dateKey);
  if (cached) {
    return {
      ...cached,
      puzzleNumber,
      customDate: dateKey,
    };
  }

  const resolved = generateUniqueBundleForPool(`bank:date:v3:${dateKey}`, {
    id: `m2-bank-${dateKey}`,
    puzzleNumber,
    customDate: dateKey,
  });

  DATE_PUZZLE_CACHE.set(dateKey, resolved);
  return resolved;
}

export interface MoveTwoDifficultyScoreSummary {
  moves: number;
  par: number;
  stars: 1 | 2 | 3;
}

/**
 * Formats the share receipt for Move Two:
 * - Supports multi-difficulty daily completions (`Easy 6×6`, `Medium 8×8`, `Hard 10×10`)
 * - Also supports single-difficulty `{ moves, par, stars }` payloads
 */
export function buildMoveTwoShareText(opts: {
  puzzleNumber: number;
  title: string;
  moves?: number;
  par?: number;
  stars?: 1 | 2 | 3;
  results?: Partial<Record<MoveTwoDifficulty, MoveTwoDifficultyScoreSummary>>;
}): string {
  const lines = [`🟨 Move Two #${opts.puzzleNumber} — "${opts.title}"`];

  const solvedDiffs = opts.results
    ? MOVE_TWO_DIFFICULTIES.filter((d) => Boolean(opts.results?.[d]))
    : [];

  if (solvedDiffs.length > 0 && opts.results) {
    for (const diff of solvedDiffs) {
      const entry = opts.results[diff]!;
      const meta = MOVE_TWO_DIFFICULTY_META[diff];
      const starRow = "⭐".repeat(entry.stars);
      lines.push(
        `${meta.label} (${meta.sizeLabel}): ${entry.moves} moves · Par: ${entry.par} · ${starRow}`
      );
    }
  } else {
    const moves = opts.moves ?? 0;
    const par = opts.par ?? 0;
    const stars = opts.stars ?? 3;
    lines.push(`Solved in ${moves} moves · Par: ${par} · ${"⭐".repeat(stars)}`);
  }

  return lines.join("\n");
}
