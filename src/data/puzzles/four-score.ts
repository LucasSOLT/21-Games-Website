/**
 * Four Score (`four-score`) — 66-day solver-verified puzzle bank + date-seeded fallback.
 */

import {
  FOUR_SCORE_MAX_VALUE,
  FOUR_SCORE_MIN_DIGITS,
  FOUR_SCORE_MIN_OPERATORS,
  FOUR_SCORE_MIN_VALUE,
  FOUR_SCORE_OPERATORS,
  FOUR_SCORE_TARGET,
  applyBinaryFourScore,
  applyUnaryFourScore,
  binaryOperatorCount,
  buildFourScoreShareText,
  generateFourScoreMonthlyBatch,
  generateFourScorePuzzle,
  isBinaryOperator,
  isFourScorePuzzle,
  isUnaryOperator,
  solveFourScore,
  validateFourScorePuzzle,
  type FourScoreEvalResult,
  type FourScoreOperator,
  type FourScorePuzzle,
  type FourScoreSolveResult,
  type FourScoreValidation,
} from "@/lib/generators/four-score-generator";

export {
  FOUR_SCORE_MAX_VALUE,
  FOUR_SCORE_MIN_DIGITS,
  FOUR_SCORE_MIN_OPERATORS,
  FOUR_SCORE_MIN_VALUE,
  FOUR_SCORE_OPERATORS,
  FOUR_SCORE_TARGET,
  applyBinaryFourScore,
  applyUnaryFourScore,
  binaryOperatorCount,
  buildFourScoreShareText,
  generateFourScoreMonthlyBatch,
  generateFourScorePuzzle,
  isBinaryOperator,
  isFourScorePuzzle,
  isUnaryOperator,
  solveFourScore,
  validateFourScorePuzzle,
  type FourScoreEvalResult,
  type FourScoreOperator,
  type FourScorePuzzle,
  type FourScoreSolveResult,
  type FourScoreValidation,
};

export const FOUR_SCORE_BANK_SIZE = 66;

function buildFourScoreBank(): FourScorePuzzle[] {
  const bank: FourScorePuzzle[] = [];
  for (let i = 0; i < FOUR_SCORE_BANK_SIZE; i++) {
    bank.push(
      generateFourScorePuzzle(`bank:v1:${i}`, {
        id: `4s-bank-${String(i + 1).padStart(2, "0")}`,
        puzzleNumber: i + 1,
      })
    );
  }
  return bank;
}

/** 66-day solver-verified Four Score puzzle bank. */
export const FOUR_SCORE_PUZZLES: FourScorePuzzle[] = buildFourScoreBank();

/** Deterministic date-seeded fallback keyed by `four-score:${dateKey}`. */
export function generateSeededFourScorePuzzle(
  dateKey: string,
  puzzleNumber: number
): FourScorePuzzle {
  return generateFourScorePuzzle(`seed:${dateKey}`, {
    id: `4s-seed-${dateKey}`,
    puzzleNumber,
    customDate: dateKey,
  });
}
