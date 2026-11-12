/**
 * Eightfold Echo (`eightfold-echo`) — 66-day solver-verified puzzle bank + date-seeded fallback.
 *
 * Every puzzle in `EIGHTFOLD_ECHO_PUZZLES` is generated deterministically at module load
 * and verified by `solveEightfoldEcho` to have a unique 0 → 8 Hamiltonian path starting
 * at the center Emerald tile (`gridIndex = 4`).
 */

import {
  ECHO_ATTRIBUTES,
  ECHO_FILLS,
  ECHO_GRID_SIZE,
  ECHO_MARKS,
  ECHO_POSITION_COLORS,
  ECHO_POSITION_NAMES,
  ECHO_SHAPES,
  ECHO_START_INDEX,
  buildEchoChainRules,
  buildEchoShareText,
  changedAttribute,
  describeEchoStep,
  describeEchoTile,
  echoDotPositions,
  echoShapeSvgGeometry,
  echoStars,
  formatEchoTime,
  formatEchoVictorySummary,
  generateEightfoldEchoMonthlyBatch,
  generateEightfoldEchoPuzzle,
  isEchoTile,
  isEightfoldEchoPuzzle,
  pickEchoHintCandidates,
  renderEchoTileSvgString,
  solveEightfoldEcho,
  tileDistance,
  tileKey,
  validateEightfoldEchoPuzzle,
  type EchoAttribute,
  type EchoFill,
  type EchoMarks,
  type EchoShape,
  type EchoSolveResult,
  type EchoTile,
  type EchoValidation,
  type EightfoldEchoPuzzle,
} from "@/lib/generators/eightfold-echo-generator";

export {
  ECHO_ATTRIBUTES,
  ECHO_FILLS,
  ECHO_GRID_SIZE,
  ECHO_MARKS,
  ECHO_POSITION_COLORS,
  ECHO_POSITION_NAMES,
  ECHO_SHAPES,
  ECHO_START_INDEX,
  buildEchoChainRules,
  buildEchoShareText,
  changedAttribute,
  describeEchoStep,
  describeEchoTile,
  echoDotPositions,
  echoShapeSvgGeometry,
  echoStars,
  formatEchoTime,
  formatEchoVictorySummary,
  generateEightfoldEchoMonthlyBatch,
  generateEightfoldEchoPuzzle,
  isEchoTile,
  isEightfoldEchoPuzzle,
  pickEchoHintCandidates,
  renderEchoTileSvgString,
  solveEightfoldEcho,
  tileDistance,
  tileKey,
  validateEightfoldEchoPuzzle,
  type EchoAttribute,
  type EchoFill,
  type EchoMarks,
  type EchoShape,
  type EchoSolveResult,
  type EchoTile,
  type EchoValidation,
  type EightfoldEchoPuzzle,
};

export const EIGHTFOLD_ECHO_BANK_SIZE = 66;

function buildEchoBank(): EightfoldEchoPuzzle[] {
  const bank: EightfoldEchoPuzzle[] = [];
  for (let i = 0; i < EIGHTFOLD_ECHO_BANK_SIZE; i++) {
    bank.push(
      generateEightfoldEchoPuzzle(`bank:v1:${i}`, {
        id: `8e-bank-${String(i + 1).padStart(2, "0")}`,
        puzzleNumber: i + 1,
      })
    );
  }
  return bank;
}

/** 66-day solver-verified Eightfold Echo puzzle bank. */
export const EIGHTFOLD_ECHO_PUZZLES: EightfoldEchoPuzzle[] = buildEchoBank();

/** Deterministic date-seeded fallback keyed by `eightfold-echo:${dateKey}`. */
export function generateSeededEightfoldEchoPuzzle(
  dateKey: string,
  puzzleNumber: number
): EightfoldEchoPuzzle {
  return generateEightfoldEchoPuzzle(`seed:${dateKey}`, {
    id: `8e-seed-${dateKey}`,
    puzzleNumber,
    customDate: dateKey,
  });
}
