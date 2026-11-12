/**
 * Checkpoint 8 — Move Two: 6-face 3x3 Bloxorz domino rolling kinematics,
 * BFS shortest-path solver & Par calculation, 66-day bank, monthly batch generator,
 * portal seam crossings, wall/hazard collisions, and UI/Admin wiring.
 * Run: node --experimental-strip-types scripts/test-cp08-move-two.ts
 */
import fs from "node:fs";
import { register } from "node:module";
import { createKit } from "./test-kit.mjs";

register("./test-resolver.mjs", import.meta.url);
const kit = createKit("CP8: Move Two");

const m2 = await import("@/data/puzzles/move-2");
const daily = await import("@/lib/daily-engine");
const cfg = await import("@/lib/games-config");

// ---- 66-day puzzle bank + BFS solver invariants ------------------------------
kit.eq(m2.MOVE_TWO_PUZZLES.length, 66, "bank has 66 puzzles");
let allBankValid = true;
const targetPosturesSeen = new Set<string>();
for (const p of m2.MOVE_TWO_PUZZLES) {
  const v = m2.validateMoveTwoPuzzle(p);
  if (!v.valid) {
    allBankValid = false;
    console.error("Invalid Move Two puzzle:", p.id, v.errors);
  }
  const solved = m2.solveMoveTwo(p);
  if (!solved.solvable || solved.minMoves !== p.par || p.canonicalMoves.length !== p.par) {
    allBankValid = false;
  }
  targetPosturesSeen.add(p.target.posture);

  // Replay canonicalMoves from start -> must traverse portals and end in { kind: "won" }
  let state = p.start;
  let wonOnFinal = false;
  let portalsCrossed = 0;
  for (let i = 0; i < p.canonicalMoves.length; i++) {
    const step = m2.stepMoveTwoDomino(p, state, p.canonicalMoves[i]!);
    if (i < p.canonicalMoves.length - 1) {
      if (step.kind === "portal") {
        portalsCrossed++;
        state = step.next;
      } else if (step.kind === "moved") {
        state = step.next;
      } else {
        allBankValid = false;
      }
    } else {
      if (step.kind === "won") {
        wonOnFinal = true;
      } else {
        allBankValid = false;
      }
    }
  }
  if (!wonOnFinal || portalsCrossed !== 5) {
    allBankValid = false;
  }
}
kit.assert(
  allBankValid,
  "all 66 bank puzzles pass validateMoveTwoPuzzle, match BFS Par, cross 5 portals, and reach Face 6 target"
);
kit.assert(
  targetPosturesSeen.has("UPRIGHT") &&
    (targetPosturesSeen.has("FLAT_H") || targetPosturesSeen.has("FLAT_V")),
  "bank exercises both UPRIGHT (1-cell) and FLAT (2-cell) Red Targets on Face 6"
);

// ---- Bloxorz rolling kinematics & collision rules (Q42–Q44) ------------------
const upCenter = { face: 0, posture: "UPRIGHT" as const, r: 1, c: 1 };
const tipRight = m2.computeRawRoll(upCenter, "right");
kit.assert(
  tipRight.posture === "FLAT_H" && tipRight.r === 1 && tipRight.c === 2,
  "UPRIGHT at (1,1) rolling right tips to FLAT_H at (1,2)-(1,3)"
);
const tipLeft = m2.computeRawRoll({ face: 0, posture: "UPRIGHT", r: 1, c: 2 }, "left");
kit.assert(
  tipLeft.posture === "FLAT_H" && tipLeft.r === 1 && tipLeft.c === 0,
  "UPRIGHT at (1,2) rolling left tips to FLAT_H at (1,0)-(1,1)"
);
const standRight = m2.computeRawRoll(tipLeft, "right");
kit.assert(
  standRight.posture === "UPRIGHT" && standRight.r === 1 && standRight.c === 2,
  "FLAT_H at (1,0)-(1,1) rolling right stands UPRIGHT at (1,2)"
);
const rollBroadsideDown = m2.computeRawRoll(tipLeft, "down");
kit.assert(
  rollBroadsideDown.posture === "FLAT_H" &&
    rollBroadsideDown.r === 2 &&
    rollBroadsideDown.c === 0,
  "FLAT_H at (1,0)-(1,1) rolling down stays FLAT_H at (2,0)-(2,1)"
);

// Custom synthetic fixture for wall bump, border bump, hazard fall, and portal seam
const emptyGrid = () =>
  [
    ["floor", "floor", "floor"],
    ["floor", "floor", "floor"],
    ["floor", "floor", "floor"],
  ] as [
    ["floor" | "wall" | "hazard", "floor" | "wall" | "hazard", "floor" | "wall" | "hazard"],
    ["floor" | "wall" | "hazard", "floor" | "wall" | "hazard", "floor" | "wall" | "hazard"],
    ["floor" | "wall" | "hazard", "floor" | "wall" | "hazard", "floor" | "wall" | "hazard"],
  ];

const synthPuzzle = {
  faces: [
    {
      index: 0,
      exitEdge: "right" as const,
      grid: [
        ["floor", "wall", "floor"],
        ["floor", "floor", "floor"],
        ["hazard", "floor", "floor"],
      ] as ReturnType<typeof emptyGrid>,
    },
    { index: 1, exitEdge: "down" as const, grid: emptyGrid() },
    { index: 2, exitEdge: "right" as const, grid: emptyGrid() },
    { index: 3, exitEdge: "up" as const, grid: emptyGrid() },
    { index: 4, exitEdge: "right" as const, grid: emptyGrid() },
    { index: 5, exitEdge: null, grid: emptyGrid() },
  ] as typeof m2.MOVE_TWO_PUZZLES[number]["faces"],
  target: { posture: "UPRIGHT" as const, r: 1, c: 1 },
};

const borderBump = m2.stepMoveTwoDomino(
  synthPuzzle,
  { face: 0, posture: "UPRIGHT", r: 0, c: 0 },
  "up"
);
kit.eq(borderBump.kind, "bump", "non-exit outer border blocks roll cleanly");

const wallBump = m2.stepMoveTwoDomino(
  synthPuzzle,
  { face: 0, posture: "UPRIGHT", r: 0, c: 0 },
  "right"
);
kit.eq(wallBump.kind, "bump", "wall block prevents tipping onto (0,1)-(0,2)");

const hazardFall = m2.stepMoveTwoDomino(
  synthPuzzle,
  { face: 0, posture: "UPRIGHT", r: 0, c: 0 },
  "down"
);
kit.eq(hazardFall.kind, "hazard", "tipping onto hazard cell triggers hazard outcome");

// Straddling exit seam (UPRIGHT at c=2 tipping right -> cells (1,3) & (1,4) -> both >=3 so cleanly crosses!)
// Whereas FLAT_H at (1,1)-(1,2) rolling right -> UPRIGHT at (1,3) -> cleanly crosses to Face 1 (1,0)!
const portalCross = m2.stepMoveTwoDomino(
  synthPuzzle,
  { face: 0, posture: "FLAT_H", r: 1, c: 1 },
  "right"
);
kit.assert(
  portalCross.kind === "portal" &&
    portalCross.toFace === 1 &&
    portalCross.next.posture === "UPRIGHT" &&
    portalCross.next.r === 1 &&
    portalCross.next.c === 0,
  "rolling across exitEdge transitions cleanly onto Face 2 at shifted seam coordinates"
);

// ---- Star rating formula (Q45) -----------------------------------------------
kit.eq(m2.computeMoveTwoStars(14, 14), 3, "Par -> 3 stars");
kit.eq(m2.computeMoveTwoStars(16, 14), 3, "Par + 2 -> 3 stars");
kit.eq(m2.computeMoveTwoStars(18, 14), 2, "Par + 4 -> 2 stars");
kit.eq(m2.computeMoveTwoStars(25, 14), 1, "Par + 11 -> 1 star");

// ---- Monthly batch generator -------------------------------------------------
const batch = m2.generateMoveTwoMonthlyBatch(2027, 3);
const batchKeys = Object.keys(batch);
kit.eq(batchKeys.length, 31, "March 2027 batch has 31 daily puzzles");
kit.assert(
  batchKeys.every((k) => m2.validateMoveTwoPuzzle(batch[k]).valid),
  "every generated March 2027 puzzle passes BFS solver & validator"
);

// ---- Daily engine + config wiring --------------------------------------------
kit.assert(cfg.isPlayableGameSlug("move-2"), "move-2 is playable");
const m2Meta = cfg.getGameBySlug("move-2");
kit.eq(m2Meta?.showCreate, false, "move-2 has showCreate: false (no user creator mode)");

const resolved = daily.getDailyPuzzleForGame("move-2", "2026-11-15");
kit.assert(
  Boolean(resolved && m2.isMoveTwoPuzzle(resolved.puzzle)),
  "daily engine resolves valid Move Two puzzle"
);
const badOverride = daily.getDailyPuzzleForGame("move-2", "2026-11-15", {
  "2026-11-15": { broken: true },
});
kit.assert(
  Boolean(
    badOverride &&
      m2.isMoveTwoPuzzle(badOverride.puzzle) &&
      badOverride.origin !== "override"
  ),
  "invalid override rejected in favor of BFS-verified puzzle"
);

// ---- Share text + UI wiring checks -------------------------------------------
const receipt = m2.buildMoveTwoShareText({
  puzzleNumber: 12,
  title: "Six-Sided Roll",
  moves: 15,
  par: 14,
  stars: 3,
});
kit.assert(
  receipt.includes("Move Two #12") &&
    receipt.includes("Solved in 15 moves · Par: 14 · ⭐⭐⭐"),
  "Move Two share receipt includes moves, Par, and star rating"
);

const gameSrc = fs.readFileSync(
  new URL("../src/components/games/move-two.tsx", import.meta.url),
  "utf8"
);
kit.assert(gameSrc.includes("GameSplashScreen"), "Move Two mounts GameSplashScreen");
kit.assert(gameSrc.includes("showCreate={false}"), "Move Two hides Create button on splash");
kit.assert(gameSrc.includes("IsometricCubeHud"), "Move Two renders mini 3D isometric cube HUD");
kit.assert(gameSrc.includes("ResultShareButtons"), "Move Two mounts decoupled Share + Copy buttons");
kit.assert(
  gameSrc.includes("Undo Move") && gameSrc.includes("Reset Face"),
  "Move Two renders Undo Move and Reset Face controls"
);

const pageSrc = fs.readFileSync(
  new URL("../src/app/games/move-2/page.tsx", import.meta.url),
  "utf8"
);
kit.assert(pageSrc.includes("GameErrorBoundary"), "Move Two page wrapped in GameErrorBoundary");

const adminSrc = fs.readFileSync(
  new URL("../src/app/admin/page.tsx", import.meta.url),
  "utf8"
);
kit.assert(adminSrc.includes("MoveTwoStudioTab"), "/admin mounts MoveTwoStudioTab");

kit.finish();
