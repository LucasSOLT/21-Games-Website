/**
 * Four Score (`four-score`) — NYT Digits-style full-board combiner to 80,
 * backtracking math solver, deterministic puzzle generator, and monthly batch builder
 * (`GAME_DESIGN_BIBLE.md` Q34–Q40).
 */

import { getPuzzleNumberForDate } from "@/lib/date-keys";
import { fnv1a32, mulberry32 } from "@/lib/seeded-random";

export const FOUR_SCORE_TARGET = 80;
export const FOUR_SCORE_MIN_VALUE = 0;
export const FOUR_SCORE_MAX_VALUE = 10_000;
export const FOUR_SCORE_MIN_DIGITS = 4;
export const FOUR_SCORE_MIN_OPERATORS = 3;

export const FOUR_SCORE_OPERATORS = ["+", "−", "×", "÷", "x²", "xʸ"] as const;
export type FourScoreOperator = (typeof FOUR_SCORE_OPERATORS)[number];

export interface FourScorePuzzle {
  id: string;
  puzzleNumber: number;
  title: string;
  author: string;
  editor: string;
  /** Always 80 ("Four Score"). */
  target: number;
  /** Starting number tiles (`>= 4`). */
  digits: number[];
  /** Single-use operator badges (`>= 3`, with `binaryCount === digits.length - 1`). */
  operators: FourScoreOperator[];
  /** Verified canonical full-board expression evaluating to `80`. */
  canonicalEquation: string;
  seed?: string;
  customDate?: string;
}

export function isUnaryOperator(op: FourScoreOperator): op is "x²" {
  return op === "x²";
}

export function isBinaryOperator(
  op: FourScoreOperator
): op is Exclude<FourScoreOperator, "x²"> {
  return op !== "x²";
}

export function binaryOperatorCount(ops: readonly FourScoreOperator[]): number {
  return ops.filter((op) => isBinaryOperator(op)).length;
}

// ---------------------------------------------------------------------------
// Arithmetic Evaluation & Guardrails (Q37)
// ---------------------------------------------------------------------------

export type FourScoreEvalResult =
  | { ok: true; value: number; expr: string }
  | { ok: false; error: string };

function wrapIfComposite(expr: string): string {
  return /^[\d]+²?$/.test(expr) ? expr : `(${expr})`;
}

export function applyUnaryFourScore(
  value: number,
  expr: string,
  op: "x²" = "x²"
): FourScoreEvalResult {
  void op;
  if (!Number.isInteger(value)) {
    return { ok: false, error: "Values must be whole numbers" };
  }
  const res = value * value;
  if (!Number.isSafeInteger(res) || res < FOUR_SCORE_MIN_VALUE || res > FOUR_SCORE_MAX_VALUE) {
    return { ok: false, error: "Result exceeds 10,000" };
  }
  return {
    ok: true,
    value: res,
    expr: `${wrapIfComposite(expr)}²`,
  };
}

export function applyBinaryFourScore(
  aVal: number,
  aExpr: string,
  op: Exclude<FourScoreOperator, "x²">,
  bVal: number,
  bExpr: string
): FourScoreEvalResult {
  if (!Number.isInteger(aVal) || !Number.isInteger(bVal)) {
    return { ok: false, error: "Values must be whole numbers" };
  }

  let res: number;
  switch (op) {
    case "+":
      res = aVal + bVal;
      break;
    case "−":
      if (aVal < bVal) {
        return { ok: false, error: "Result cannot be negative" };
      }
      res = aVal - bVal;
      break;
    case "×":
      res = aVal * bVal;
      break;
    case "÷":
      if (bVal === 0 || aVal % bVal !== 0) {
        return { ok: false, error: "Must divide evenly into a whole number" };
      }
      res = aVal / bVal;
      break;
    case "xʸ": {
      if (bVal < 0 || (aVal === 0 && bVal === 0)) {
        return { ok: false, error: "Invalid exponent" };
      }
      if (aVal > 1 && bVal > 14) {
        return { ok: false, error: "Result exceeds 10,000" };
      }
      res = Math.pow(aVal, bVal);
      break;
    }
  }

  if (
    !Number.isSafeInteger(res) ||
    res < FOUR_SCORE_MIN_VALUE ||
    res > FOUR_SCORE_MAX_VALUE
  ) {
    return { ok: false, error: "Result exceeds 10,000" };
  }

  const symbol = op === "xʸ" ? "^" : op;
  return {
    ok: true,
    value: res,
    expr: `(${aExpr} ${symbol} ${bExpr})`,
  };
}

// ---------------------------------------------------------------------------
// Backtracking Full-Board Solver (Q35, Q36, Q39, Q40)
// ---------------------------------------------------------------------------

interface ExprTile {
  value: number;
  expr: string;
}

export interface FourScoreSolveResult {
  solvable: boolean;
  canonicalEquation: string | null;
}

/**
 * Exhaustive backtracking solver verifying whether there exists a legal sequence
 * that consumes EVERY tile in `digits` and EVERY badge in `operators` to leave a
 * single final tile equal to `target` (`80`).
 */
export function solveFourScore(
  digits: readonly number[],
  operators: readonly FourScoreOperator[],
  target: number = FOUR_SCORE_TARGET
): FourScoreSolveResult {
  if (
    digits.length < FOUR_SCORE_MIN_DIGITS ||
    operators.length < FOUR_SCORE_MIN_OPERATORS ||
    binaryOperatorCount(operators) !== digits.length - 1
  ) {
    return { solvable: false, canonicalEquation: null };
  }

  let found: string | null = null;
  const visited = new Set<string>();

  const stateSignature = (
    tiles: readonly ExprTile[],
    ops: readonly FourScoreOperator[]
  ): string => {
    const tv = tiles
      .map((t) => t.value)
      .sort((a, b) => a - b)
      .join(",");
    const ov = [...ops].sort().join(",");
    return `${tv}|${ov}`;
  };

  const search = (tiles: ExprTile[], ops: FourScoreOperator[]): boolean => {
    if (ops.length === 0) {
      if (tiles.length === 1 && tiles[0]!.value === target) {
        found = tiles[0]!.expr;
        return true;
      }
      return false;
    }

    const sig = stateSignature(tiles, ops);
    if (visited.has(sig)) return false;
    visited.add(sig);

    // 1. Try unary x² if available
    const unaryIdx = ops.indexOf("x²");
    if (unaryIdx >= 0) {
      const nextOps = ops.filter((_, idx) => idx !== unaryIdx);
      const triedVals = new Set<number>();
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i]!;
        if (triedVals.has(t.value)) continue;
        triedVals.add(t.value);
        const r = applyUnaryFourScore(t.value, t.expr);
        if (!r.ok) continue;
        const nextTiles = tiles.map((item, idx) =>
          idx === i ? { value: r.value, expr: r.expr } : item
        );
        if (search(nextTiles, nextOps)) return true;
      }
    }

    // 2. Try each distinct binary operator
    const seenOps = new Set<FourScoreOperator>();
    for (let opIdx = 0; opIdx < ops.length; opIdx++) {
      const op = ops[opIdx]!;
      if (isUnaryOperator(op) || seenOps.has(op)) continue;
      seenOps.add(op);
      const nextOps = ops.filter((_, idx) => idx !== opIdx);
      const commutative = op === "+" || op === "×";

      const seenPairs = new Set<string>();
      for (let i = 0; i < tiles.length; i++) {
        for (let j = 0; j < tiles.length; j++) {
          if (i === j) continue;
          if (commutative && i > j) continue;
          const a = tiles[i]!;
          const b = tiles[j]!;
          const pairKey = commutative
            ? `${Math.min(a.value, b.value)}:${Math.max(a.value, b.value)}`
            : `${a.value}:${b.value}`;
          if (seenPairs.has(pairKey)) continue;
          seenPairs.add(pairKey);

          const r = applyBinaryFourScore(a.value, a.expr, op, b.value, b.expr);
          if (!r.ok) continue;
          const rest = tiles.filter((_, idx) => idx !== i && idx !== j);
          rest.push({ value: r.value, expr: r.expr });
          if (search(rest, nextOps)) return true;
        }
      }
    }

    return false;
  };

  const initialTiles: ExprTile[] = digits.map((d) => ({
    value: d,
    expr: String(d),
  }));
  search(initialTiles, [...operators]);
  return { solvable: found !== null, canonicalEquation: found };
}

// ---------------------------------------------------------------------------
// Runtime Validation
// ---------------------------------------------------------------------------

export interface FourScoreValidation {
  valid: boolean;
  errors: string[];
}

export function validateFourScorePuzzle(payload: unknown): FourScoreValidation {
  const errors: string[] = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, errors: ["Payload must be a non-null object."] };
  }
  const p = payload as Record<string, unknown>;
  if (p.target !== FOUR_SCORE_TARGET) {
    errors.push(`target must equal ${FOUR_SCORE_TARGET}.`);
  }
  if (
    !Array.isArray(p.digits) ||
    p.digits.length < FOUR_SCORE_MIN_DIGITS ||
    p.digits.length > 8 ||
    !p.digits.every(
      (d) =>
        typeof d === "number" &&
        Number.isInteger(d) &&
        d >= 1 &&
        d <= FOUR_SCORE_MAX_VALUE
    )
  ) {
    errors.push("digits must be 4–8 positive whole numbers.");
    return { valid: false, errors };
  }
  if (
    !Array.isArray(p.operators) ||
    p.operators.length < FOUR_SCORE_MIN_OPERATORS ||
    p.operators.length > 9 ||
    !p.operators.every((o) =>
      (FOUR_SCORE_OPERATORS as readonly unknown[]).includes(o)
    )
  ) {
    errors.push("operators must be 3–9 valid operator badges.");
    return { valid: false, errors };
  }

  const digits = p.digits as number[];
  const operators = p.operators as FourScoreOperator[];
  if (binaryOperatorCount(operators) !== digits.length - 1) {
    errors.push(
      `binary operator count (${binaryOperatorCount(operators)}) must equal digits.length - 1 (${digits.length - 1}).`
    );
  }

  if (errors.length === 0) {
    const solved = solveFourScore(digits, operators, FOUR_SCORE_TARGET);
    if (!solved.solvable) {
      errors.push("Board has no legal full-board solution reaching 80.");
    }
  }

  if (typeof p.title !== "string" || p.title.trim().length === 0) {
    errors.push("title is required.");
  }
  if (typeof p.canonicalEquation !== "string" || p.canonicalEquation.trim().length === 0) {
    errors.push("canonicalEquation is required.");
  }
  return { valid: errors.length === 0, errors };
}

export function isFourScorePuzzle(payload: unknown): payload is FourScorePuzzle {
  return validateFourScorePuzzle(payload).valid;
}

// ---------------------------------------------------------------------------
// Deterministic Generator + Monthly Batch Builder
// ---------------------------------------------------------------------------

export interface FourScoreGenerationMeta {
  id: string;
  puzzleNumber: number;
  title?: string;
  author?: string;
  editor?: string;
  customDate?: string;
}

const BINARY_POOL: readonly Exclude<FourScoreOperator, "x²">[] = [
  "+",
  "−",
  "×",
  "÷",
  "+",
  "−",
  "×",
  "xʸ",
];

const FOUR_SCORE_TITLES: readonly string[] = [
  "Exact Eighty",
  "Full-Board Balance",
  "Arithmetic Arc",
  "Square & Combine",
  "Whole-Number Path",
  "Clean Factors",
  "Target Eighty",
  "Calculated Leap",
];

function shuffleWith<T>(items: readonly T[], rand: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Generates a solver-verified Four Score puzzle for `seed`.
 * Cycles across 4-, 5-, and 6-digit inventories with diverse operators (`+`, `−`, `×`, `÷`, `x²`, `xʸ`).
 */
export function generateFourScorePuzzle(
  seed: string,
  meta: FourScoreGenerationMeta
): FourScorePuzzle {
  const rand = mulberry32(fnv1a32(`four-score:${seed}`));
  const digitChoices = [4, 4, 5, 5, 6] as const;
  const targetDigitCount =
    digitChoices[Math.floor(rand() * digitChoices.length)]!;

  for (let attempt = 0; attempt < 3500; attempt++) {
    const numDigits =
      attempt < 2000 ? targetDigitCount : 4 + (attempt % 2);
    const includeSquare = rand() < 0.42;
    const digits: number[] = [];
    const digitPool = [2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8, 9, 10, 12, 15, 16, 20, 25];
    for (let i = 0; i < numDigits; i++) {
      digits.push(digitPool[Math.floor(rand() * digitPool.length)]!);
    }

    const binaryOps: Exclude<FourScoreOperator, "x²">[] = [];
    let hasExponent = false;
    for (let i = 0; i < numDigits - 1; i++) {
      let op = BINARY_POOL[Math.floor(rand() * BINARY_POOL.length)]!;
      if (op === "xʸ") {
        if (hasExponent || rand() < 0.55) op = "×";
        else hasExponent = true;
      }
      binaryOps.push(op);
    }

    // Encourage varied operators rather than all `+` or all `×`
    if (new Set(binaryOps).size < 2) continue;

    const ops: FourScoreOperator[] = includeSquare
      ? [...binaryOps, "x²"]
      : [...binaryOps];

    const solved = solveFourScore(digits, ops, FOUR_SCORE_TARGET);
    if (!solved.solvable || !solved.canonicalEquation) continue;

    const shuffledDigits = shuffleWith(digits, rand);
    const shuffledOps = shuffleWith(ops, rand);
    const defaultTitle =
      FOUR_SCORE_TITLES[fnv1a32(`title:${seed}`) % FOUR_SCORE_TITLES.length]!;

    return {
      id: meta.id,
      puzzleNumber: meta.puzzleNumber,
      title: meta.title ?? defaultTitle,
      author: meta.author ?? "SOL Theory",
      editor: meta.editor ?? "Auto-Generated",
      target: FOUR_SCORE_TARGET,
      digits: shuffledDigits,
      operators: shuffledOps,
      canonicalEquation: `${solved.canonicalEquation} = ${FOUR_SCORE_TARGET}`,
      seed,
      ...(meta.customDate ? { customDate: meta.customDate } : {}),
    };
  }

  // Deterministic guaranteed fallback (`((3² + 7) × 5) = 80`)
  return {
    id: meta.id,
    puzzleNumber: meta.puzzleNumber,
    title: meta.title ?? "Square & Combine",
    author: meta.author ?? "SOL Theory",
    editor: meta.editor ?? "Auto-Generated",
    target: FOUR_SCORE_TARGET,
    digits: [3, 7, 5, 1],
    operators: ["+", "×", "×", "x²"],
    canonicalEquation: "(((3² + 7) × 5) × 1) = 80",
    seed,
    ...(meta.customDate ? { customDate: meta.customDate } : {}),
  };
}

export function buildFourScoreShareText(options: {
  puzzleNumber: number;
  digitsCount: number;
  operatorsCount: number;
  undoCount: number;
}): string {
  const badge = options.undoCount === 0 ? "🎯 Clean First-Pass" : `🔄 ${options.undoCount} Undo${options.undoCount === 1 ? "" : "s"}`;
  return (
    `Four Score #${options.puzzleNumber}\n` +
    `Reached 80! (${options.digitsCount} tiles · ${options.operatorsCount} ops)\n` +
    `🟨➕✖️🟰8️⃣0️⃣ · ${badge}`
  );
}

/** Generates and validates a full calendar month (`month` is 1..12) of Four Score puzzles. */
export function generateFourScoreMonthlyBatch(
  year: number,
  month: number
): Record<string, FourScorePuzzle> {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out: Record<string, FourScorePuzzle> = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const puzzle = generateFourScorePuzzle(`date:${dateKey}`, {
      id: `4s-${dateKey}`,
      puzzleNumber: getPuzzleNumberForDate(dateKey),
      customDate: dateKey,
    });
    const check = validateFourScorePuzzle(puzzle);
    if (!check.valid) {
      throw new Error(
        `Invalid Four Score batch puzzle for ${dateKey}: ${check.errors.join("; ")}`
      );
    }
    out[dateKey] = puzzle;
  }
  return out;
}
