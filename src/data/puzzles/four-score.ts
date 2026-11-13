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

import {
  ROTATION_ANCHOR,
  daysBetweenDateKeys,
  getLocalDateKey,
  getPuzzleNumberForDate,
} from "@/lib/date-keys";

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

const FOUR_SCORE_DATE_CACHE = new Map<string, FourScorePuzzle>();
const SEEN_FOUR_SCORE_SIGNATURES = new Set<string>(
  FOUR_SCORE_PUZZLES.map(
    (p) => `${p.digits.join(",")}|${p.operators.join(",")}|${p.canonicalEquation}`
  )
);

/**
 * Deterministic, cached, non-repeating 2026–2027 bank resolution for Four Score.
 * - For `0 <= diff < 66`, returns `FOUR_SCORE_PUZZLES[diff]`.
 * - For all other dates, generates and caches a solver-verified (`= 80`) puzzle
 *   keyed by `"bank:date:" + dateKey`.
 */
export function getFourScorePuzzleForDate(
  dateKey: string = getLocalDateKey()
): FourScorePuzzle {
  const puzzleNumber = getPuzzleNumberForDate(dateKey);
  const diff = daysBetweenDateKeys(ROTATION_ANCHOR, dateKey);
  if (diff >= 0 && diff < FOUR_SCORE_PUZZLES.length) {
    const base = FOUR_SCORE_PUZZLES[diff]!;
    return {
      ...base,
      puzzleNumber,
      customDate: dateKey,
    };
  }

  const cached = FOUR_SCORE_DATE_CACHE.get(dateKey);
  if (cached) {
    return {
      ...cached,
      puzzleNumber,
      customDate: dateKey,
    };
  }

  let chosen: FourScorePuzzle | null = null;
  for (let attempt = 0; attempt < 32; attempt++) {
    const seed =
      attempt === 0 ? `bank:date:${dateKey}` : `bank:date:${dateKey}:a${attempt}`;
    const candidate = generateFourScorePuzzle(seed, {
      id: `fs-bank-${dateKey}`,
      puzzleNumber,
      customDate: dateKey,
    });
    const sig = `${candidate.digits.join(",")}|${candidate.operators.join(",")}|${candidate.canonicalEquation}`;
    if (!SEEN_FOUR_SCORE_SIGNATURES.has(sig)) {
      SEEN_FOUR_SCORE_SIGNATURES.add(sig);
      chosen = candidate;
      break;
    }
    if (!chosen) {
      chosen = candidate;
    }
  }

  const finalPuzzle = chosen!;
  FOUR_SCORE_DATE_CACHE.set(dateKey, finalPuzzle);
  return finalPuzzle;
}

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
