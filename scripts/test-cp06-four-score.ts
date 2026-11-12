/**
 * Checkpoint 6 — Four Score: backtracking full-board math solver, 66-day bank,
 * monthly batch generator, whole-number division & 0..10,000 guardrails, and UI wiring.
 * Run: node --experimental-strip-types scripts/test-cp06-four-score.ts
 */
import fs from "node:fs";
import { register } from "node:module";
import { createKit } from "./test-kit.mjs";

register("./test-resolver.mjs", import.meta.url);
const kit = createKit("CP6: Four Score");

const fsMod = await import("@/data/puzzles/four-score");
const daily = await import("@/lib/daily-engine");
const cfg = await import("@/lib/games-config");

// ---- 66-day puzzle bank + solver invariants ----------------------------------
kit.eq(fsMod.FOUR_SCORE_PUZZLES.length, 66, "bank has 66 puzzles");
let allBankValid = true;
const digitSizesSeen = new Set<number>();
for (const p of fsMod.FOUR_SCORE_PUZZLES) {
  const v = fsMod.validateFourScorePuzzle(p);
  if (!v.valid) {
    allBankValid = false;
    console.error("Invalid Four Score puzzle:", p.id, v.errors);
  }
  digitSizesSeen.add(p.digits.length);
  if (
    p.target !== 80 ||
    p.digits.length < 4 ||
    p.operators.length < 3 ||
    fsMod.binaryOperatorCount(p.operators) !== p.digits.length - 1
  ) {
    allBankValid = false;
  }
}
kit.assert(allBankValid, "all 66 bank puzzles pass validateFourScorePuzzle & full-board invariant");
kit.assert(digitSizesSeen.size >= 2, "bank includes variable board inventories (e.g. 4, 5, 6 digits)");

// ---- Arithmetic guardrails (Q37) ----------------------------------------------
const badDiv = fsMod.applyBinaryFourScore(7, "7", "÷", 2, "2");
kit.assert(
  !badDiv.ok && badDiv.error === "Must divide evenly into a whole number",
  "non-integer division rejected with exact Q37 message"
);
const zeroDiv = fsMod.applyBinaryFourScore(10, "10", "÷", 0, "0");
kit.assert(!zeroDiv.ok, "division by zero rejected");
const goodDiv = fsMod.applyBinaryFourScore(80, "80", "÷", 5, "5");
kit.assert(goodDiv.ok && goodDiv.value === 16, "whole-number division succeeds");

const negSub = fsMod.applyBinaryFourScore(3, "3", "−", 9, "9");
kit.assert(!negSub.ok, "negative subtraction rejected");
const bigSq = fsMod.applyUnaryFourScore(101, "101", "x²");
kit.assert(!bigSq.ok, "x² > 10,000 rejected");
const bigExp = fsMod.applyBinaryFourScore(10, "10", "xʸ", 5, "5");
kit.assert(!bigExp.ok, "xʸ > 10,000 rejected");
const goodSq = fsMod.applyUnaryFourScore(3, "3", "x²");
kit.assert(goodSq.ok && goodSq.value === 9 && goodSq.expr === "3²", "3² -> 9");

// ---- Solver verification (Q39 & Q40) ------------------------------------------
// Bible example: ((3² + 7) × 5) × 1 = 80
const solvedEx = fsMod.solveFourScore([3, 7, 5, 1], ["+", "×", "×", "x²"], 80);
kit.assert(solvedEx.solvable && solvedEx.canonicalEquation !== null, "solver solves 3² + 7 × 5 × 1 = 80");

// Impossible full-board (1 + 1 + 1 + 1 = 4 != 80)
const unsolvable = fsMod.solveFourScore([1, 1, 1, 1], ["+", "+", "+"], 80);
kit.assert(!unsolvable.solvable, "solver rejects unsolvable full-board");

// Wrong binary_ops count rejected
const wrongOps = fsMod.solveFourScore([20, 20, 20, 20], ["+", "+"], 80);
kit.assert(!wrongOps.solvable, "solver enforces binary_ops === digits.length - 1");

// ---- Monthly batch + daily engine --------------------------------------------
const feb = fsMod.generateFourScoreMonthlyBatch(2027, 2);
kit.eq(Object.keys(feb).length, 28, "monthly batch generates & validates 28 days for Feb 2027");

const dk = "2026-11-12";
const dailyRes = daily.getDailyPuzzleForGame("four-score", dk);
kit.assert(dailyRes !== null && dailyRes.origin === "bank", "daily engine resolves four-score");
const badOverride = daily.getDailyPuzzleForGame("four-score", dk, { [dk]: { target: 99 } });
kit.assert(
  badOverride !== null && fsMod.validateFourScorePuzzle(badOverride.puzzle).valid,
  "invalid override falls back cleanly"
);

// ---- Config & UI wiring -------------------------------------------------------
kit.assert(cfg.isPlayableGameSlug("four-score"), "four-score isPlayable");
kit.eq(cfg.getGameBySlug("four-score")?.showCreate, false, "four-score showCreate is false");

const comp = fs.readFileSync("src/components/games/four-score.tsx", "utf8");
for (const needle of [
  "GameSplashScreen",
  "showCreate={false}",
  "ResultShareButtons",
  "Undo Last Step",
  "Reset Board",
  "Your Winning Equation",
  "Canonical Solution",
  "four-score-live-equation",
]) {
  kit.assert(comp.includes(needle), `four-score.tsx contains ${needle}`);
}
const admin = fs.readFileSync("src/app/admin/page.tsx", "utf8");
kit.assert(admin.includes("FourScoreStudioTab"), "/admin includes FourScoreStudioTab");
const archive = await import("@/app/games/[slug]/archive/page");
const params = await archive.generateStaticParams();
kit.assert(
  params.some((p: { slug: string }) => p.slug === "four-score"),
  "archive static params include four-score"
);

kit.finish();
