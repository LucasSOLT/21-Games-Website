/**
 * Eightfold Echo (`eightfold-echo`) — 66-day solver-verified puzzle bank + date-seeded fallback.
 *
 * Every puzzle in `EIGHTFOLD_ECHO_PUZZLES` is generated deterministically at module load
 * and verified by `solveEightfoldEcho` to have a unique 0 → 8 Hamiltonian path starting
 * at the center Emerald tile (`gridIndex = 4`).
 */

import {
  EASY_ECHO_FILLS,
  EASY_ECHO_MARKS,
  EASY_ECHO_SHAPES,
  ECHO_ATTRIBUTES,
  ECHO_DIFFICULTIES,
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
  countStartNearMissDecoys,
  describeEchoStep,
  describeEchoTile,
  echoDotPositions,
  echoShapeSvgGeometry,
  echoStars,
  formatEchoTime,
  formatEchoVictorySummary,
  generateEasyEchoStage,
  generateEightfoldEchoMonthlyBatch,
  generateEightfoldEchoPuzzle,
  generateHardEchoStage,
  getEchoStage,
  isEchoTile,
  isEightfoldEchoPuzzle,
  pickEchoHintCandidates,
  renderEchoTileSvgString,
  solveEightfoldEcho,
  tileDistance,
  tileKey,
  validateEightfoldEchoPuzzle,
  type EchoAttribute,
  type EchoDifficulty,
  type EchoFill,
  type EchoMarks,
  type EchoShape,
  type EchoSolveResult,
  type EchoTile,
  type EchoValidation,
  type EightfoldEchoPuzzle,
  type EightfoldEchoStage,
} from "@/lib/generators/eightfold-echo-generator";

export {
  EASY_ECHO_FILLS,
  EASY_ECHO_MARKS,
  EASY_ECHO_SHAPES,
  ECHO_ATTRIBUTES,
  ECHO_DIFFICULTIES,
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
  countStartNearMissDecoys,
  describeEchoStep,
  describeEchoTile,
  echoDotPositions,
  echoShapeSvgGeometry,
  echoStars,
  formatEchoTime,
  formatEchoVictorySummary,
  generateEasyEchoStage,
  generateEightfoldEchoMonthlyBatch,
  generateEightfoldEchoPuzzle,
  generateHardEchoStage,
  getEchoStage,
  isEchoTile,
  isEightfoldEchoPuzzle,
  pickEchoHintCandidates,
  renderEchoTileSvgString,
  solveEightfoldEcho,
  tileDistance,
  tileKey,
  validateEightfoldEchoPuzzle,
  type EchoAttribute,
  type EchoDifficulty,
  type EchoFill,
  type EchoMarks,
  type EchoShape,
  type EchoSolveResult,
  type EchoTile,
  type EchoValidation,
  type EightfoldEchoPuzzle,
  type EightfoldEchoStage,
};

import {
  ROTATION_ANCHOR,
  daysBetweenDateKeys,
  getLocalDateKey,
  getPuzzleNumberForDate,
} from "@/lib/date-keys";

export const EIGHTFOLD_ECHO_BANK_SIZE = 66;

function echoStageSignature(tiles: readonly EchoTile[], solution: readonly number[]): string {
  return `${tiles.map(tileKey).join("|")}::${solution.join(",")}`;
}

function buildEchoBank(): EightfoldEchoPuzzle[] {
  const bank: EightfoldEchoPuzzle[] = [];
  const seenEasy = new Set<string>();
  const seenHard = new Set<string>();
  for (let i = 0; i < EIGHTFOLD_ECHO_BANK_SIZE; i++) {
    let chosen: EightfoldEchoPuzzle | null = null;
    for (let attempt = 0; attempt < 32; attempt++) {
      const seed = attempt === 0 ? `bank:v1:${i}` : `bank:v1:${i}:a${attempt}`;
      const candidate = generateEightfoldEchoPuzzle(seed, {
        id: `8e-bank-${String(i + 1).padStart(2, "0")}`,
        puzzleNumber: i + 1,
      });
      const easyStage = getEchoStage(candidate, "easy");
      const hardStage = getEchoStage(candidate, "hard");
      const easySig = echoStageSignature(easyStage.tiles, easyStage.solution);
      const hardSig = echoStageSignature(hardStage.tiles, hardStage.solution);
      if (!seenEasy.has(easySig) && !seenHard.has(hardSig)) {
        seenEasy.add(easySig);
        seenHard.add(hardSig);
        chosen = candidate;
        break;
      }
      if (!chosen) chosen = candidate;
    }
    bank.push(chosen!);
  }
  return bank;
}

/** 66-day solver-verified Eightfold Echo puzzle bank (Easy + Hard per day). */
export const EIGHTFOLD_ECHO_PUZZLES: EightfoldEchoPuzzle[] = buildEchoBank();

const ECHO_DATE_CACHE = new Map<string, EightfoldEchoPuzzle>();
const SEEN_ECHO_EASY_SIGNATURES = new Set<string>(
  EIGHTFOLD_ECHO_PUZZLES.map((p) => {
    const st = getEchoStage(p, "easy");
    return echoStageSignature(st.tiles, st.solution);
  })
);
const SEEN_ECHO_HARD_SIGNATURES = new Set<string>(
  EIGHTFOLD_ECHO_PUZZLES.map((p) => {
    const st = getEchoStage(p, "hard");
    return echoStageSignature(st.tiles, st.solution);
  })
);

/**
 * Deterministic, cached, non-repeating 2026–2027 bank resolution for Eightfold Echo.
 * - For `0 <= diff < 66`, returns `EIGHTFOLD_ECHO_PUZZLES[diff]`.
 * - For all other dates, generates and caches a Hamiltonian-solver-verified puzzle
 *   (with unique Easy + Hard stages) keyed by `"bank:date:" + dateKey`.
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
    const easyStage = getEchoStage(candidate, "easy");
    const hardStage = getEchoStage(candidate, "hard");
    const easySig = echoStageSignature(easyStage.tiles, easyStage.solution);
    const hardSig = echoStageSignature(hardStage.tiles, hardStage.solution);
    if (
      !SEEN_ECHO_EASY_SIGNATURES.has(easySig) &&
      !SEEN_ECHO_HARD_SIGNATURES.has(hardSig)
    ) {
      SEEN_ECHO_EASY_SIGNATURES.add(easySig);
      SEEN_ECHO_HARD_SIGNATURES.add(hardSig);
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
