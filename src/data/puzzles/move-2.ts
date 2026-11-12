/**
 * Move Two (`move-2`) — 66-day BFS-solver-verified puzzle bank + date-seeded fallback.
 */

import {
  MOVE_TWO_DIRECTIONS,
  computeMoveTwoStars,
  computeRawRoll,
  generateMoveTwoMonthlyBatch,
  generateMoveTwoPuzzle,
  getDominoCells,
  isInBounds3x3,
  isMoveTwoPuzzle,
  isStateFootprintInBounds,
  matchesMoveTwoTarget,
  solveMoveTwo,
  stepMoveTwoDomino,
  validateMoveTwoPuzzle,
  type MoveTwoCellType,
  type MoveTwoCoord,
  type MoveTwoDirection,
  type MoveTwoDominoState,
  type MoveTwoFace,
  type MoveTwoPosture,
  type MoveTwoPuzzle,
  type MoveTwoSolveResult,
  type MoveTwoStepOutcome,
  type MoveTwoTarget,
} from "@/lib/generators/move-two-generator";

export {
  MOVE_TWO_DIRECTIONS,
  computeMoveTwoStars,
  computeRawRoll,
  generateMoveTwoMonthlyBatch,
  generateMoveTwoPuzzle,
  getDominoCells,
  isInBounds3x3,
  isMoveTwoPuzzle,
  isStateFootprintInBounds,
  matchesMoveTwoTarget,
  solveMoveTwo,
  stepMoveTwoDomino,
  validateMoveTwoPuzzle,
  type MoveTwoCellType,
  type MoveTwoCoord,
  type MoveTwoDirection,
  type MoveTwoDominoState,
  type MoveTwoFace,
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
      generateMoveTwoPuzzle(`bank:v1:${i}`, {
        id: `m2-bank-${String(i + 1).padStart(2, "0")}`,
        puzzleNumber: i + 1,
      })
    );
  }
  return bank;
}

/** 66-day BFS-verified Move Two puzzle bank. */
export const MOVE_TWO_PUZZLES: MoveTwoPuzzle[] = buildMoveTwoBank();

/** Deterministic date-seeded fallback keyed by `move-2:${dateKey}`. */
export function generateSeededMoveTwoPuzzle(
  dateKey: string,
  puzzleNumber: number
): MoveTwoPuzzle {
  return generateMoveTwoPuzzle(`seed:${dateKey}`, {
    id: `m2-seed-${dateKey}`,
    puzzleNumber,
    customDate: dateKey,
  });
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
