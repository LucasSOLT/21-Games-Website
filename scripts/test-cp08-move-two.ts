/**
 * Checkpoint 8 — Move Two: 6-face 5×5 2.5D tilted cube Bloxorz domino rolling kinematics,
 * per-face (`solveMoveTwoFace`) & 6-face (`solveMoveTwo`) BFS shortest-path solvers,
 * recessed 1-tile (`UPRIGHT`) & 2-tile (`FLAT_H`/`FLAT_V`) hole drops, raised outer cube rim bumps,
 * interior dark void hazards, 66-day bank, 2026–2027 zero-duplicate daily coverage,
 * SSR-safe Web Audio API SFX, and 2.5D UI + 5×5 `/admin` Studio wiring.
 * Run: node --experimental-strip-types scripts/test-cp08-move-two.ts
 */
import fs from "node:fs";
import { register } from "node:module";
import { createKit } from "./test-kit.mjs";

register("./test-resolver.mjs", import.meta.url);
const kit = createKit("CP8: Move Two (5×5 2.5D Overhaul)");

const m2 = await import("@/data/puzzles/move-2");
const sfx = await import("@/lib/move-two-audio");
const daily = await import("@/lib/daily-engine");
const cfg = await import("@/lib/games-config");
const seeded = await import("@/lib/seeded-random");

// ---- 1. 5×5 Grid Constants & Bounds Helpers ----------------------------------
kit.eq(m2.MOVE_TWO_GRID_SIZE, 5, "MOVE_TWO_GRID_SIZE is 5 (5×5 per face)");
kit.assert(
  m2.isInBounds5x5(0, 0) &&
    m2.isInBounds5x5(4, 4) &&
    !m2.isInBounds5x5(-1, 0) &&
    !m2.isInBounds5x5(0, 5) &&
    !m2.isInBounds5x5(5, 2),
  "isInBounds5x5 enforces 0..4 row/col bounds"
);

// ---- 2. 66-day 5×5 puzzle bank + per-face & 6-face BFS solver invariants -----
kit.eq(m2.MOVE_TWO_PUZZLES.length, 66, "bank has 66 puzzles");
let allBankValid = true;
const holePosturesSeen = new Set<string>();
const finalTargetPosturesSeen = new Set<string>();

for (const p of m2.MOVE_TWO_PUZZLES) {
  const v = m2.validateMoveTwoPuzzle(p);
  if (!v.valid) {
    allBankValid = false;
    console.error("Invalid Move Two puzzle:", p.id, v.errors);
  }
  if (p.faces.length !== 6) {
    allBankValid = false;
  }
  for (const face of p.faces) {
    if (face.grid.length !== 5 || face.grid.some((row) => row.length !== 5)) {
      allBankValid = false;
    }
    const faceSolved = m2.solveMoveTwoFace(face);
    if (!faceSolved.solvable || faceSolved.minMoves < 4) {
      allBankValid = false;
    }
    holePosturesSeen.add(face.hole.posture);
  }

  const solved = m2.solveMoveTwo(p);
  if (
    !solved.solvable ||
    solved.minMoves !== p.par ||
    p.canonicalMoves.length !== p.par ||
    p.par < 24 ||
    p.par > 52
  ) {
    allBankValid = false;
  }
  finalTargetPosturesSeen.add(p.target.posture);

  // Replay canonicalMoves from start -> must drop into 5 holes (`portal`) and end in `won` on Face 6
  let state = p.start;
  let wonOnFinal = false;
  let portalsCrossed = 0;
  for (let i = 0; i < p.canonicalMoves.length; i++) {
    const step = m2.stepMoveTwoDomino(p, state, p.canonicalMoves[i]!);
    if (i < p.canonicalMoves.length - 1) {
      if (step.kind === "portal") {
        portalsCrossed++;
        const expectedHole = p.faces[step.fromFace]!.hole;
        const expectedNextStart = p.faces[step.toFace]!.start;
        if (
          !m2.matchesFaceHole(step.enteredHole, expectedHole) ||
          step.next.face !== step.toFace ||
          step.next.posture !== expectedNextStart.posture ||
          step.next.r !== expectedNextStart.r ||
          step.next.c !== expectedNextStart.c
        ) {
          allBankValid = false;
        }
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
  "all 66 5×5 bank puzzles pass validateMoveTwoPuzzle, match per-face & 6-face BFS Par, drop into 5 sequential holes, and win on Face 6"
);
kit.assert(
  holePosturesSeen.has("UPRIGHT") &&
    holePosturesSeen.has("FLAT_H") &&
    holePosturesSeen.has("FLAT_V"),
  "bank faces exercise all 3 recessed hole postures (1×1 UPRIGHT, 1×2 FLAT_H, 2×1 FLAT_V)"
);
kit.assert(
  finalTargetPosturesSeen.has("UPRIGHT") &&
    (finalTargetPosturesSeen.has("FLAT_H") || finalTargetPosturesSeen.has("FLAT_V")),
  "bank exercises both 1-tile UPRIGHT and 2-tile FLAT final goal holes on Face 6"
);

// ---- 3. Bloxorz rolling kinematics, Raised Cube Rim & Recessed Hole Drops ----
const upCenter = { face: 0, posture: "UPRIGHT" as const, r: 2, c: 2 };
const tipRight = m2.computeRawRoll(upCenter, "right");
kit.assert(
  tipRight.posture === "FLAT_H" && tipRight.r === 2 && tipRight.c === 3,
  "UPRIGHT at (2,2) rolling right tips to FLAT_H at (2,3)-(2,4)"
);
const tipLeft = m2.computeRawRoll(upCenter, "left");
kit.assert(
  tipLeft.posture === "FLAT_H" && tipLeft.r === 2 && tipLeft.c === 0,
  "UPRIGHT at (2,2) rolling left tips to FLAT_H at (2,0)-(2,1)"
);
const standRight = m2.computeRawRoll(tipLeft, "right");
kit.assert(
  standRight.posture === "UPRIGHT" && standRight.r === 2 && standRight.c === 2,
  "FLAT_H at (2,0)-(2,1) rolling right stands UPRIGHT at (2,2)"
);
const rollBroadsideDown = m2.computeRawRoll(tipLeft, "down");
kit.assert(
  rollBroadsideDown.posture === "FLAT_H" &&
    rollBroadsideDown.r === 3 &&
    rollBroadsideDown.c === 0,
  "FLAT_H at (2,0)-(2,1) rolling down stays FLAT_H at (3,0)-(3,1)"
);

// Synthetic 5×5 fixture testing:
// - Raised outer rim bumps on all 4 borders (top, bottom, left, right)
// - Interior wall bump & dark void hazard fall
// - Partial overlap with 1-tile and 2-tile holes (`moved`, not dropping)
// - Exact posture hole drop on Face 0 (`portal` -> Face 1 coded start) and Face 5 (`won`)
const face0Grid = m2.emptyMoveTwoFloorGrid();
face0Grid[0][1] = "wall";
face0Grid[1][0] = "hazard";

const face1Grid = m2.emptyMoveTwoFloorGrid();
const synthPuzzle = {
  faces: [
    {
      index: 0,
      grid: face0Grid,
      start: { posture: "UPRIGHT" as const, r: 0, c: 0 },
      hole: { posture: "UPRIGHT" as const, r: 2, c: 2 },
      exitEdge: null,
    },
    {
      index: 1,
      grid: face1Grid,
      start: { posture: "FLAT_V" as const, r: 0, c: 4 },
      hole: { posture: "FLAT_H" as const, r: 3, c: 1 },
      exitEdge: null,
    },
    {
      index: 2,
      grid: m2.emptyMoveTwoFloorGrid(),
      start: { posture: "UPRIGHT" as const, r: 0, c: 0 },
      hole: { posture: "UPRIGHT" as const, r: 4, c: 4 },
      exitEdge: null,
    },
    {
      index: 3,
      grid: m2.emptyMoveTwoFloorGrid(),
      start: { posture: "UPRIGHT" as const, r: 0, c: 0 },
      hole: { posture: "UPRIGHT" as const, r: 4, c: 4 },
      exitEdge: null,
    },
    {
      index: 4,
      grid: m2.emptyMoveTwoFloorGrid(),
      start: { posture: "UPRIGHT" as const, r: 0, c: 0 },
      hole: { posture: "UPRIGHT" as const, r: 4, c: 4 },
      exitEdge: null,
    },
    {
      index: 5,
      grid: m2.emptyMoveTwoFloorGrid(),
      start: { posture: "UPRIGHT" as const, r: 0, c: 0 },
      hole: { posture: "FLAT_H" as const, r: 2, c: 2 },
      exitEdge: null,
    },
  ] as typeof m2.MOVE_TWO_PUZZLES[number]["faces"],
  target: { posture: "FLAT_H" as const, r: 2, c: 2 },
};

// Raised outer rim bumps on all 4 borders
kit.eq(
  m2.stepMoveTwoDomino(synthPuzzle, { face: 0, posture: "UPRIGHT", r: 0, c: 2 }, "up").kind,
  "bump",
  "Raised outer rim blocks top border roll (r=0 -> up)"
);
kit.eq(
  m2.stepMoveTwoDomino(synthPuzzle, { face: 0, posture: "UPRIGHT", r: 4, c: 2 }, "down").kind,
  "bump",
  "Raised outer rim blocks bottom border roll (r=4 -> down)"
);
kit.eq(
  m2.stepMoveTwoDomino(synthPuzzle, { face: 0, posture: "UPRIGHT", r: 2, c: 0 }, "left").kind,
  "bump",
  "Raised outer rim blocks left border roll (c=0 -> left)"
);
kit.eq(
  m2.stepMoveTwoDomino(synthPuzzle, { face: 0, posture: "UPRIGHT", r: 2, c: 4 }, "right").kind,
  "bump",
  "Raised outer rim blocks right border roll (c=4 -> right)"
);

// Wall bump and interior dark void hazard
kit.eq(
  m2.stepMoveTwoDomino(synthPuzzle, { face: 0, posture: "UPRIGHT", r: 0, c: 0 }, "right").kind,
  "bump",
  "Wall block at (0,1) blocks tipping right from (0,0)"
);
kit.eq(
  m2.stepMoveTwoDomino(synthPuzzle, { face: 0, posture: "UPRIGHT", r: 0, c: 0 }, "down").kind,
  "hazard",
  "Interior hazard at (1,0) triggers hazard outcome when tipping down from (0,0)"
);

// Partial / non-matching posture over a 1-tile UPRIGHT hole at (2,2) on Face 0:
// Rolling from UPRIGHT at (2,0) right -> lands FLAT_H on (2,1)-(2,2). Should be "moved", NOT "portal"!
const flatOver1TileHole = m2.stepMoveTwoDomino(
  synthPuzzle,
  { face: 0, posture: "UPRIGHT", r: 2, c: 0 },
  "right"
);
kit.eq(
  flatOver1TileHole.kind,
  "moved",
  "Rolling FLAT_H across a 1-tile UPRIGHT hole rests on rim as 'moved' without dropping"
);

// Exact posture match over 1-tile UPRIGHT hole at (2,2) on Face 0:
// Rolling from FLAT_H at (2,0)-(2,1) right -> stands UPRIGHT on (2,2) -> drops into hole (`portal`) and spawns at Face 1 coded start!
const exactDropFace0 = m2.stepMoveTwoDomino(
  synthPuzzle,
  { face: 0, posture: "FLAT_H", r: 2, c: 0 },
  "right"
);
kit.assert(
  exactDropFace0.kind === "portal" &&
    exactDropFace0.fromFace === 0 &&
    exactDropFace0.toFace === 1 &&
    exactDropFace0.enteredHole.posture === "UPRIGHT" &&
    exactDropFace0.enteredHole.r === 2 &&
    exactDropFace0.enteredHole.c === 2 &&
    exactDropFace0.next.face === 1 &&
    exactDropFace0.next.posture === "FLAT_V" &&
    exactDropFace0.next.r === 0 &&
    exactDropFace0.next.c === 4,
  "Standing UPRIGHT onto Face 1's 1×1 hole triggers 'portal' and spawns die at Face 2's coded start (FLAT_V at 0,4)"
);

// Partial / non-matching posture over a 2-tile FLAT_H hole at (3,1)-(3,2) on Face 1:
// Standing UPRIGHT on (3,1) from FLAT_V at (1,1)-(2,1) rolling down -> lands UPRIGHT on (3,1). Should be "moved", NOT "portal"!
const uprightOn2TileHole = m2.stepMoveTwoDomino(
  synthPuzzle,
  { face: 1, posture: "FLAT_V", r: 1, c: 1 },
  "down"
);
kit.eq(
  uprightOn2TileHole.kind,
  "moved",
  "Standing UPRIGHT on 1 cell of a 2-tile FLAT_H hole rests as 'moved' without dropping"
);

// Exact 2-tile FLAT_H drop on Face 5 (Final Face 6):
// Rolling FLAT_H from (1,2)-(1,3) down onto (2,2)-(2,3) -> matches Face 6 hole -> "won"!
const finalHoleWin = m2.stepMoveTwoDomino(
  synthPuzzle,
  { face: 5, posture: "FLAT_H", r: 1, c: 2 },
  "down"
);
kit.assert(
  finalHoleWin.kind === "won" &&
    finalHoleWin.next.posture === "FLAT_H" &&
    finalHoleWin.next.r === 2 &&
    finalHoleWin.next.c === 2,
  "Dropping FLAT_H into Face 6's 1×2 hole triggers 'won'"
);

// ---- 4. Star rating formula (Q45) --------------------------------------------
kit.eq(m2.computeMoveTwoStars(34, 34), 3, "Par -> 3 stars");
kit.eq(m2.computeMoveTwoStars(36, 34), 3, "Par + 2 -> 3 stars");
kit.eq(m2.computeMoveTwoStars(39, 34), 2, "Par + 5 -> 2 stars");
kit.eq(m2.computeMoveTwoStars(44, 34), 1, "Par + 10 -> 1 star");

// ---- 5. Monthly batch generator & 2026–2027 Zero-Duplicate Coverage ----------
const batch = m2.generateMoveTwoMonthlyBatch(2027, 3);
const batchKeys = Object.keys(batch);
kit.eq(batchKeys.length, 31, "March 2027 batch has 31 daily puzzles");
kit.assert(
  batchKeys.every((k) => m2.validateMoveTwoPuzzle(batch[k]).valid),
  "every generated March 2027 5×5 puzzle passes BFS solver & validator"
);

// Verify every date from 2026-11-01 through 2027-12-31 (426 days) via getMoveTwoPuzzleForDate
const seenHashes = new Set<string>();
let all2026To2027Valid = true;
const startMs = Date.UTC(2026, 10, 1); // 2026-11-01
const endMs = Date.UTC(2027, 11, 31); // 2027-12-31
let totalDaysChecked = 0;
for (let ms = startMs; ms <= endMs; ms += 86_400_000) {
  const dateKey = new Date(ms).toISOString().slice(0, 10);
  const p = m2.getMoveTwoPuzzleForDate(dateKey);
  if (!m2.isMoveTwoPuzzle(p)) {
    all2026To2027Valid = false;
  }
  const boardSignature = JSON.stringify({
    faces: p.faces.map((f) => ({
      grid: f.grid,
      start: f.start,
      hole: f.hole,
    })),
  });
  seenHashes.add(seeded.computePuzzleContentHash(boardSignature));
  totalDaysChecked++;
}
kit.eq(totalDaysChecked, 426, "checked all 426 days from 2026-11-01 through 2027-12-31");
kit.assert(all2026To2027Valid, "all 426 daily puzzles across 2026–2027 pass 5×5 BFS validation");
kit.eq(
  seenHashes.size,
  totalDaysChecked,
  "100% unique 5×5 Move Two puzzles across all 426 days of 2026–2027 (zero duplicate cycling)"
);

// ---- 6. SSR-safe Web Audio API SFX module ------------------------------------
sfx.setMoveTwoMuted(true);
kit.eq(sfx.isMoveTwoMuted(), true, "setMoveTwoMuted(true) persists mute state");
sfx.setMoveTwoMuted(false);
kit.eq(sfx.isMoveTwoMuted(), false, "setMoveTwoMuted(false) clears mute state");
sfx.playMoveTwoRollSfx("UPRIGHT");
sfx.playMoveTwoRimBumpSfx();
sfx.playMoveTwoHoleDropSfx();
sfx.playMoveTwoHazardSfx();
sfx.playMoveTwoVictorySfx();
kit.assert(true, "Web Audio SFX helpers execute cleanly in SSR/Node environment");

// ---- 7. Daily engine + config wiring -----------------------------------------
kit.assert(cfg.isPlayableGameSlug("move-2"), "move-2 is playable");
const m2Meta = cfg.getGameBySlug("move-2");
kit.eq(m2Meta?.showCreate, false, "move-2 has showCreate: false (no user creator mode)");
kit.assert(
  Boolean(m2Meta?.tagline.includes("5×5")),
  "games-config tagline references 5×5 3D cube domino puzzle"
);

const resolved = daily.getDailyPuzzleForGame("move-2", "2026-11-15");
kit.assert(
  Boolean(resolved && m2.isMoveTwoPuzzle(resolved.puzzle)),
  "daily engine resolves valid 5×5 Move Two puzzle"
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
  "invalid override rejected in favor of BFS-verified 5×5 puzzle"
);

// ---- 8. Share text + 2.5D UI & 5×5 Studio wiring checks ----------------------
const receipt = m2.buildMoveTwoShareText({
  puzzleNumber: 12,
  title: "Six-Sided Roll",
  moves: 35,
  par: 34,
  stars: 3,
});
kit.assert(
  receipt.includes("Move Two #12") &&
    receipt.includes("Solved in 35 moves · Par: 34 · ⭐⭐⭐"),
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
kit.assert(
  gameSrc.includes("perspective") &&
    gameSrc.includes("rotateX(25deg)") &&
    gameSrc.includes("grid-cols-5") &&
    gameSrc.includes("grid-rows-5") &&
    !gameSrc.includes("ring-2") &&
    gameSrc.includes("move-two-mute-toggle") &&
    gameSrc.includes("move-two-3d-block") &&
    gameSrc.includes('strokeLinejoin="miter"') &&
    gameSrc.includes("320ms") &&
    gameSrc.includes("Blocked by a wall.") &&
    gameSrc.includes("You hit an obstacle! Resetting position.") &&
    gameSrc.includes("Red obstacle hole") &&
    gameSrc.includes("#EF4444") &&
    gameSrc.includes("#2ECC71") &&
    !gameSrc.includes("border-sky-500") &&
    !gameSrc.includes("text-sky-800"),
  "Move Two renders uniform grid-cols-5 grid-rows-5 tiles, sharp-edged 3D two-cube SVG block, green target holes on all 6 faces, recessed red obstacle holes, and generic copy"
);

const studioSrc = fs.readFileSync(
  new URL("../src/components/admin/move-two-studio-tab.tsx", import.meta.url),
  "utf8"
);
kit.assert(
  studioSrc.includes("grid-cols-5") &&
    studioSrc.includes("grid-rows-5") &&
    studioSrc.includes("#DC2626") &&
    studioSrc.includes("#2ECC71") &&
    !studioSrc.includes("bg-sky-600") &&
    studioSrc.includes("admin-move-two-clear-all") &&
    studioSrc.includes("admin-move-two-revert-default") &&
    studioSrc.includes("solveMoveTwoFace"),
  "MoveTwoStudioTab renders interactive 5×5 face grids with green target holes, red obstacle holes, per-face BFS solver, Clear All, and Revert to Default"
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
