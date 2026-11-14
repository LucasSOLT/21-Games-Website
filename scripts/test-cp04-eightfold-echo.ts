/**
 * Checkpoint 4 — Eightfold Echo: parametric SVG engine, Hamiltonian solver, 66-day bank,
 * monthly batch generator, hint selector, scoring, and UI wiring.
 * Run: node --experimental-strip-types scripts/test-cp04-eightfold-echo.ts
 */
import fs from "node:fs";
import { register } from "node:module";
import { createKit } from "./test-kit.mjs";

register("./test-resolver.mjs", import.meta.url);
const kit = createKit("CP4: Eightfold Echo");

const echo = await import("@/data/puzzles/eightfold-echo");
const daily = await import("@/lib/daily-engine");
const cfg = await import("@/lib/games-config");

// ---- Q21 signature position palette -------------------------------------------
kit.eq(
  [...echo.ECHO_POSITION_COLORS],
  [
    "#F9D423",
    "#9D50BB",
    "#3B82F6",
    "#F97316",
    "#2ECC71",
    "#EC4899",
    "#14B8A6",
    "#6366F1",
    "#84CC16",
  ],
  "exact Q21 signature position colors (center #2ECC71)"
);

// ---- 66-day bank + solver uniqueness (Easy & Hard stages) --------------------
kit.eq(echo.EIGHTFOLD_ECHO_PUZZLES.length, 66, "bank has 66 puzzles");
let allBankValid = true;
let allUnique = true;
let allEasyIntuitive = true;
let allHardLookahead = true;
for (const p of echo.EIGHTFOLD_ECHO_PUZZLES) {
  const v = echo.validateEightfoldEchoPuzzle(p);
  if (!v.valid) {
    allBankValid = false;
    console.error("Invalid Echo puzzle:", p.id, v.errors);
  }
  const easyStage = echo.getEchoStage(p, "easy");
  const hardStage = echo.getEchoStage(p, "hard");
  const easySolved = echo.solveEightfoldEcho(easyStage.tiles, 4, 2);
  const hardSolved = echo.solveEightfoldEcho(hardStage.tiles, 4, 2);
  const nearMisses = echo.countStartNearMissDecoys(easyStage);
  if (
    easySolved.count !== 1 ||
    hardSolved.count !== 1 ||
    easyStage.solution[0] !== 4 ||
    hardStage.solution[0] !== 4
  ) {
    allUnique = false;
  }
  if (easySolved.ambiguousSteps !== 0 || nearMisses < 1 || nearMisses > 3) {
    allEasyIntuitive = false;
    console.error("Easy stage invariant failed:", p.id, {
      ambiguousSteps: easySolved.ambiguousSteps,
      nearMisses,
    });
  }
  if (hardSolved.ambiguousSteps < 1) {
    allHardLookahead = false;
  }
}
kit.assert(allBankValid, "all 66 bank puzzles pass validateEightfoldEchoPuzzle (Easy + Hard)");
kit.assert(allUnique, "all 66 bank puzzles have unique Hamiltonian chains on both Easy and Hard");
kit.assert(
  allEasyIntuitive,
  "all 66 Easy stages have ambiguousSteps === 0 and 1..3 near-miss 2-change decoys from center"
);
kit.assert(allHardLookahead, "all 66 Hard stages require lookahead across multiple 1-change options");

// ---- Solver negative cases (0 solutions & >=2 solutions) ----------------------
const sample = echo.EIGHTFOLD_ECHO_PUZZLES[0]!;
const isolatedTiles = echo.ECHO_SHAPES.slice(0, 5)
  .flatMap((shape, i) => [
    {
      shape,
      fill: echo.ECHO_FILLS[i % echo.ECHO_FILLS.length]!,
      marks: (i % 5) as 0 | 1 | 2 | 3 | 4,
    },
  ])
  .concat([
    { shape: "hexagon", fill: "ring", marks: 4 },
    { shape: "pentagon", fill: "quadrant", marks: 3 },
    { shape: "diamond", fill: "bottom", marks: 2 },
    { shape: "triangle", fill: "right", marks: 1 },
  ]);
kit.eq(echo.solveEightfoldEcho(isolatedTiles, 4, 2).count, 0, "solver detects unsolvable grid");

// Construct a symmetric 9-tile set with >=2 Hamiltonian chains from index 4:
// All 9 tiles have marks=0, shapes in {circle, square, triangle} x fills in {hollow, solid, ring} (3x3 Rook's graph!)
const rookTiles: typeof sample.tiles = [];
for (const shape of ["circle", "square", "triangle"] as const) {
  for (const fill of ["hollow", "solid", "ring"] as const) {
    rookTiles.push({ shape, fill, marks: 0 });
  }
}
const rookSolve = echo.solveEightfoldEcho(rookTiles, 4, 2);
kit.assert(rookSolve.count >= 2, "solver detects multi-solution ambiguous grid");
kit.assert(
  !echo.validateEightfoldEchoPuzzle({
    ...sample,
    tiles: rookTiles,
    solution: rookSolve.first ?? sample.solution,
  }).valid,
  "validator rejects non-unique puzzle"
);

// ---- Parametric SVG rendering -------------------------------------------------
let svgOk = true;
for (const shape of echo.ECHO_SHAPES) {
  for (const fill of echo.ECHO_FILLS) {
    const svg = echo.renderEchoTileSvgString({ shape, fill, marks: 3 }, "t");
    if (!svg.startsWith("<svg") || !svg.endsWith("</svg>")) svgOk = false;
  }
}
kit.assert(svgOk, "renderEchoTileSvgString produces valid SVG for all shape x fill combinations");

// ---- Hint candidate selector --------------------------------------------------
const cands0 = echo.pickEchoHintCandidates(sample, [4], "test");
kit.eq(cands0.length, 2, "hint pulses 2 candidates when >=2 unvisited tiles remain");
kit.assert(cands0.includes(sample.solution[1]!), "hint candidates include true next step");
kit.assert(cands0[0]! < cands0[1]!, "hint candidates are sorted by grid index (no order leak)");
const candsLast = echo.pickEchoHintCandidates(sample, sample.solution.slice(0, 8), "test");
kit.eq(candsLast, [sample.solution[8]!], "final step hint returns remaining tile");

// ---- Scoring, victory summary & share text -----------------------------------
kit.eq(echo.echoStars(0, 42), 3, "0 mistakes & 42s -> 3 stars");
kit.eq(echo.echoStars(1, 42), 2, "1 mistake & 42s -> 2 stars");
kit.eq(echo.echoStars(0, 75), 2, "0 mistakes & 75s -> 2 stars");
kit.eq(echo.echoStars(3, 42), 1, "3 mistakes -> 1 star");
kit.eq(echo.echoStars(0, 125), 1, "125s -> 1 star");
kit.eq(
  echo.formatEchoVictorySummary(42, 0),
  "Solved in 0:42 · 0 Mistakes · ⭐⭐⭐",
  "Q24 exact victory summary format"
);
const shareText = echo.buildEchoShareText({
  puzzleNumber: 18,
  elapsedSeconds: 42,
  mistakes: 0,
  solution: sample.solution,
});
kit.assert(
  shareText.startsWith("Eightfold Echo #18\nSolved in 0:42 · 0 Mistakes · ⭐⭐⭐\n"),
  "share text header + victory line"
);
const shareTextEasy = echo.buildEchoShareText({
  puzzleNumber: 18,
  elapsedSeconds: 42,
  mistakes: 0,
  solution: sample.solution,
  difficulty: "easy",
});
kit.assert(
  shareTextEasy.startsWith("Eightfold Echo #18 (Easy)\nSolved in 0:42 · 0 Mistakes · ⭐⭐⭐\n"),
  "share text includes difficulty badge when provided"
);

// ---- Monthly batch + daily engine --------------------------------------------
const jan = echo.generateEightfoldEchoMonthlyBatch(2027, 1);
kit.eq(Object.keys(jan).length, 31, "monthly batch generates 31 days for Jan 2027");

const dk = "2026-11-12";
const dailyRes = daily.getDailyPuzzleForGame("eightfold-echo", dk);
kit.assert(dailyRes !== null && dailyRes.origin === "bank", "daily engine resolves Eightfold Echo");
const badOverride = daily.getDailyPuzzleForGame("eightfold-echo", dk, { [dk]: { bad: true } });
kit.assert(
  badOverride !== null && echo.validateEightfoldEchoPuzzle(badOverride.puzzle).valid,
  "invalid override falls back to valid Eightfold Echo puzzle"
);

// ---- Config & UI wiring -------------------------------------------------------
kit.assert(cfg.isPlayableGameSlug("eightfold-echo"), "eightfold-echo isPlayable");
kit.eq(cfg.getGameBySlug("eightfold-echo")?.showCreate, false, "eightfold-echo showCreate is false");

const comp = fs.readFileSync("src/components/games/eightfold-echo.tsx", "utf8");
for (const needle of [
  "GameSplashScreen",
  "showCreate={false}",
  "ResultShareButtons",
  "Hint (+15s)",
  "Not quite! +",
  "dashed",
  "ECHO_POSITION_COLORS",
  "!isCompletedTile && (",
  "echo-difficulty-tabs",
  "echo-diff-",
  "min-w-0 min-h-0 overflow-hidden",
]) {
  kit.assert(comp.includes(needle), `eightfold-echo.tsx contains ${needle}`);
}
kit.assert(
  !comp.includes("aspect-square grid grid-cols-3"),
  "outer echo-grid omits conflicting aspect-square height lock"
);
const svgComp = fs.readFileSync("src/components/games/echo-tile-svg.tsx", "utf8");
kit.assert(svgComp.includes("ImageWithFallback"), "EchoTileSvg supports ImageWithFallback");
kit.assert(svgComp.includes('width="100%"') && svgComp.includes('height="100%"'), "PureEchoSvg sets explicit 100% width/height");
const admin = fs.readFileSync("src/app/admin/page.tsx", "utf8");
kit.assert(admin.includes("EightfoldEchoStudioTab"), "/admin includes EightfoldEchoStudioTab");
const archive = await import("@/app/games/[slug]/archive/page");
const params = await archive.generateStaticParams();
kit.assert(
  params.some((p: { slug: string }) => p.slug === "eightfold-echo"),
  "archive static params include eightfold-echo"
);

kit.finish();
