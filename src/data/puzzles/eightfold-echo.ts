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

import {
  ROTATION_ANCHOR,
  daysBetweenDateKeys,
  getLocalDateKey,
  getPuzzleNumberForDate,
} from "@/lib/date-keys";

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

const ECHO_DATE_CACHE = new Map<string, EightfoldEchoPuzzle>();
const SEEN_ECHO_SIGNATURES = new Set<string>(
  EIGHTFOLD_ECHO_PUZZLES.map(
    (p) => `${p.tiles.map(tileKey).join("|")}::${p.solution.join(",")}`
  )
);

/**
 * Deterministic, cached, non-repeating 2026–2027 bank resolution for Eightfold Echo.
 * - For `0 <= diff < 66`, returns `EIGHTFOLD_ECHO_PUZZLES[diff]`.
 * - For all other dates, generates and caches a Hamiltonian-solver-verified puzzle
 *   keyed by `"bank:date:" + dateKey`.
 */
export function getEightfoldEchoPuzzleForDate(
  dateKey: string = getLocalDateKey()
): EightfoldEchoPuzzle {
  const puzzleNumber = getPuzzleNumberForDate(dateKey);
  const diff = daysBetweenDateKeys(ROTATION_ANCHOR, dateKey);
  if (diff >= 0 && diff < EIGHTFOLD_ECHO_PUZZLES.length) {
    const base = EIGHTFOLD_ECHO_PUZZLES[diff]!;
    return {
      ...base,
      puzzleNumber,
      customDate: dateKey,
    };
  }

  const cached = ECHO_DATE_CACHE.get(dateKey);
  if (cached) {
    return {
      ...cached,
      puzzleNumber,
      customDate: dateKey,
    };
  }

  let chosen: EightfoldEchoPuzzle | null = null;
  for (let attempt = 0; attempt < 32; attempt++) {
    const seed =
      attempt === 0 ? `bank:date:${dateKey}` : `bank:date:${dateKey}:a${attempt}`;
    const candidate = generateEightfoldEchoPuzzle(seed, {
      id: `echo-bank-${dateKey}`,
      puzzleNumber,
      customDate: dateKey,
    });
    const sig = `${candidate.tiles.map(tileKey).join("|")}::${candidate.solution.join(",")}`;
    if (!SEEN_ECHO_SIGNATURES.has(sig)) {
      SEEN_ECHO_SIGNATURES.add(sig);
      chosen = candidate;
      break;
    }
    if (!chosen) {
      chosen = candidate;
    }
  }

  const finalPuzzle = chosen!;
  ECHO_DATE_CACHE.set(dateKey, finalPuzzle);
  return finalPuzzle;
}

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
