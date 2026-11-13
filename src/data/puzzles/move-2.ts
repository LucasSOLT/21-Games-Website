/**
 * Move Two (`move-2`) — 66-day 5×5 BFS-solver-verified puzzle bank + 2026–2027 date-keyed daily resolution.
 */

import {
  ROTATION_ANCHOR,
  daysBetweenDateKeys,
  getPuzzleNumberForDate,
} from "@/lib/date-keys";
import {
  MOVE_TWO_DIRECTIONS,
  MOVE_TWO_GRID_SIZE,
  MOVE_TWO_POSTURES,
  computeMoveTwoStars,
  computeRawRoll,
  emptyMoveTwoFloorGrid,
  generateMoveTwoMonthlyBatch,
  generateMoveTwoPuzzle,
  getDominoCells,
  isInBounds3x3,
  isInBounds5x5,
  isMoveTwoPuzzle,
  isStateFootprintInBounds,
  matchesFaceHole,
  matchesMoveTwoTarget,
  solveMoveTwo,
  solveMoveTwoFace,
  stepMoveTwoDomino,
  validateMoveTwoPuzzle,
  type MoveTwoCellType,
  type MoveTwoCoord,
  type MoveTwoDirection,
  type MoveTwoDominoState,
  type MoveTwoFace,
  type MoveTwoGrid,
  type MoveTwoGridRow,
  type MoveTwoPosture,
  type MoveTwoPuzzle,
  type MoveTwoSolveResult,
  type MoveTwoStepOutcome,
  type MoveTwoTarget,
} from "@/lib/generators/move-two-generator";

export {
  MOVE_TWO_DIRECTIONS,
  MOVE_TWO_GRID_SIZE,
  MOVE_TWO_POSTURES,
  computeMoveTwoStars,
  computeRawRoll,
  emptyMoveTwoFloorGrid,
  generateMoveTwoMonthlyBatch,
  generateMoveTwoPuzzle,
  getDominoCells,
  isInBounds3x3,
  isInBounds5x5,
  isMoveTwoPuzzle,
  isStateFootprintInBounds,
  matchesFaceHole,
  matchesMoveTwoTarget,
  solveMoveTwo,
  solveMoveTwoFace,
  stepMoveTwoDomino,
  validateMoveTwoPuzzle,
  type MoveTwoCellType,
  type MoveTwoCoord,
  type MoveTwoDirection,
  type MoveTwoDominoState,
  type MoveTwoFace,
  type MoveTwoGrid,
  type MoveTwoGridRow,
  type MoveTwoPosture,
  type MoveTwoPuzzle,
  type MoveTwoSolveResult,
  type MoveTwoStepOutcome,
  type MoveTwoTarget,
};

export const MOVE_TWO_BANK_SIZE = 66;

function buildMoveTwoBank(): MoveTwoPuzzle[] {
  const bank: MoveTwoPuzzle[] = [];
  for (let i = 0; i < MOVE_TWO_BANK_SIZE; i++) {
    bank.push(
      generateMoveTwoPuzzle(`bank:v2:${i}`, {
        id: `m2-bank-${String(i + 1).padStart(2, "0")}`,
        puzzleNumber: i + 1,
      })
    );
  }
  return bank;
}

/** 66-day BFS-verified 5×5 Move Two puzzle bank. */
export const MOVE_TWO_PUZZLES: MoveTwoPuzzle[] = buildMoveTwoBank();

const DATE_PUZZLE_CACHE = new Map<string, MoveTwoPuzzle>();

/** Deterministic date-seeded fallback keyed by `move-2:${dateKey}`. */
export function generateSeededMoveTwoPuzzle(
  dateKey: string,
  puzzleNumber: number = getPuzzleNumberForDate(dateKey)
): MoveTwoPuzzle {
  return generateMoveTwoPuzzle(`seed:${dateKey}`, {
    id: `m2-seed-${dateKey}`,
    puzzleNumber,
    customDate: dateKey,
  });
}

/**
 * Resolves a deterministic, BFS-verified 5×5 Move Two puzzle for any date across 2026–2027 (and beyond)
 * with zero duplicate modulo cycling.
 */
export function getMoveTwoPuzzleForDate(
  dateKey: string,
  overrides?: Record<string, MoveTwoPuzzle>
): MoveTwoPuzzle {
  const override = overrides?.[dateKey];
  if (override && isMoveTwoPuzzle(override)) {
    return override;
  }

  const cached = DATE_PUZZLE_CACHE.get(dateKey);
  if (cached) {
    return cached;
  }

  const puzzleNumber = getPuzzleNumberForDate(dateKey);
  const diff = daysBetweenDateKeys(ROTATION_ANCHOR, dateKey);
  let resolved: MoveTwoPuzzle;

  if (diff >= 0 && diff < MOVE_TWO_PUZZLES.length) {
    const base = MOVE_TWO_PUZZLES[diff]!;
    resolved = {
      ...base,
      puzzleNumber,
      customDate: dateKey,
    };
  } else {
    resolved = generateMoveTwoPuzzle(`bank:date:${dateKey}`, {
      id: `m2-bank-${dateKey}`,
      puzzleNumber,
      customDate: dateKey,
    });
  }

  DATE_PUZZLE_CACHE.set(dateKey, resolved);
  return resolved;
}

/** Formats the share receipt for Move Two (`Solved in X moves · Par: Y · ⭐⭐⭐`). */
export function buildMoveTwoShareText(opts: {
  puzzleNumber: number;
  title: string;
  moves: number;
  par: number;
  stars: 1 | 2 | 3;
}): string {
  const starRow = "⭐".repeat(opts.stars);
  return [
    `🎲 Move Two #${opts.puzzleNumber} — "${opts.title}"`,
    `Solved in ${opts.moves} moves · Par: ${opts.par} · ${starRow}`,
    `🟩🟩🟩🟩🟩🎯`,
  ].join("\n");
}
