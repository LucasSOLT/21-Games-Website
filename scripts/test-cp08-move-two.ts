/**
 * Checkpoint 8 — Move Two (Bloxorz 3D Overhaul: `6×6` Easy · `8×8` Medium · `10×10` Hard):
 * - 3-difficulty floating 3D island stages (`easy: 6×6`, `medium: 8×8`, `hard: 10×10`)
 * - Classic Bloxorz 1×1×2 cuboid rolling kinematics, open void cliff-tumbles (`fall_void`),
 *   terracotta fragile flat-safe vs upright-shatter (`fall_fragile`), ○ soft switch (any touch)
 *   vs ✕ heavy switch (upright-only), retractable bridges (`fall_bridge` when closed), and
 *   1×1 emerald goal shaft (`UPRIGHT` only)
 * - State-Space BFS shortest-path solver (`solveBloxorzStage`) + switch necessity (`verifySwitchNecessity`)
 * - Pure 3D trimetric projection & 90° bottom-edge hinge rigid-body physics (`move-two-renderer-3d.ts`)
 * - 66-day static bank + 426-day (`2026-11-01..2027-12-31` = `1,278` stages) zero-duplicate solver gate
 * - SSR-safe Web Audio API SFX + multi-difficulty UI + `/admin` 3-difficulty Bloxorz Studio
 *
 * Run: node --experimental-strip-types scripts/test-cp08-move-two.ts
 */
import fs from "node:fs";
import { register } from "node:module";
import { createKit } from "./test-kit.mjs";

register("./test-resolver.mjs", import.meta.url);
const kit = createKit("CP8: Move Two (Bloxorz 6×6 / 8×8 / 10×10 3D Overhaul)");

const m2 = await import("@/data/puzzles/move-2");
const r3d = await import("@/lib/move-two-renderer-3d");
const sfx = await import("@/lib/move-two-audio");
const daily = await import("@/lib/daily-engine");
const cfg = await import("@/lib/games-config");

// ---- 1. Board Sizes & Difficulty Metadata -----------------------------------
kit.eq(
  m2.MOVE_TWO_DIFFICULTIES,
  ["easy", "medium", "hard"],
  "MOVE_TWO_DIFFICULTIES defines easy, medium, hard"
);
kit.eq(
  m2.MOVE_TWO_BOARD_SIZES,
  { easy: 6, medium: 8, hard: 10 },
  "MOVE_TWO_BOARD_SIZES maps easy=6×6, medium=8×8, hard=10×10"
);

// ---- 2. 66-Day 3-Difficulty Bank (`198` Stages) + Canonical Replay ----------
kit.eq(m2.MOVE_TWO_PUZZLES.length, 66, "bank has 66 daily Bloxorz bundles");

let allBankValid = true;
let mediumHeavyCount = 0;
let hardHeavyCount = 0;

for (const p of m2.MOVE_TWO_PUZZLES) {
  const v = m2.validateMoveTwoPuzzle(p);
  if (!v.valid || p.version !== 3) {
    allBankValid = false;
    console.error("Invalid Move Two puzzle:", p.id, v.errors);
    continue;
  }

  for (const diff of m2.MOVE_TWO_DIFFICULTIES) {
    const stage = p.stages[diff];
    const expectedSize = m2.MOVE_TWO_BOARD_SIZES[diff];
    if (
      stage.size !== expectedSize ||
      stage.grid.length !== expectedSize ||
      stage.grid.some((row) => row.length !== expectedSize)
    ) {
      allBankValid = false;
    }

    // Must have real void sculpting (floating island, not a solid square)
    const voidCount = stage.grid
      .flat()
      .filter((t) => t === "void").length;
    if (voidCount < 4) {
      allBankValid = false;
    }

    if (diff === "medium") {
      if (stage.bridges.length < 1 || !m2.verifySwitchNecessity(stage)) {
        allBankValid = false;
      }
      if (stage.switches.some((sw) => sw.kind === "heavy")) {
        mediumHeavyCount++;
      }
    }
    if (diff === "hard") {
      if (stage.bridges.length < 2 || !m2.verifySwitchNecessity(stage)) {
        allBankValid = false;
      }
      if (stage.switches.some((sw) => sw.kind === "heavy")) {
        hardHeavyCount++;
      }
    }

    // Replay canonicalMoves from initial state -> must end in `won` on exact last move
    let state = m2.getInitialBlockState(stage);
    let wonExactly = false;
    for (let i = 0; i < stage.canonicalMoves.length; i++) {
      const step = m2.stepBloxorzBlock(stage, state, stage.canonicalMoves[i]!);
      if (i < stage.canonicalMoves.length - 1) {
        if (step.kind !== "moved") {
          allBankValid = false;
          break;
        }
        state = step.next;
      } else {
        if (
          step.kind === "won" &&
          step.next.posture === "UPRIGHT" &&
          step.next.r === stage.goal.r &&
          step.next.c === stage.goal.c
        ) {
          wonExactly = true;
        }
      }
    }
    if (!wonExactly || stage.canonicalMoves.length !== stage.par) {
      allBankValid = false;
    }
  }
}

kit.assert(
  allBankValid,
  "all 66 bank bundles (198 Easy/Medium/Hard floating islands) validate, require switches across chasms, and win on canonicalMoves replay"
);
kit.assert(
  mediumHeavyCount > 0 && hardHeavyCount === 66,
  "Medium mixes ○ soft & ✕ heavy switches, and all 66 Hard (10×10) stages feature ✕ upright-only heavy switches"
);

// ---- 3. Synthetic Bloxorz Physics: Void, Fragile, ○ Soft, ✕ Heavy, Bridge & 1×1 Goal ----
const synthGrid = m2.createMoveTwoGrid(8, "floor");
synthGrid[0]![4] = "void"; // Interior void hole
synthGrid[2]![2] = "fragile"; // Terracotta fragile tile
synthGrid[3]![4] = "bridge"; // Retractable Bridge A
synthGrid[1]![1] = "soft_switch"; // ○ Soft Switch -> toggles A
synthGrid[4]![1] = "heavy_switch"; // ✕ Heavy Switch -> toggles A

const synthStage: import("@/data/puzzles/move-2").MoveTwoStage = {
  difficulty: "medium",
  size: 8,
  grid: synthGrid,
  start: { r: 0, c: 0 },
  goal: { r: 5, c: 5 },
  bridges: [{ id: "A", cells: [{ r: 3, c: 4 }], initiallyOpen: false }],
  switches: [
    { r: 1, c: 1, kind: "soft", bridgeId: "A", behavior: "toggle" },
    { r: 4, c: 1, kind: "heavy", bridgeId: "A", behavior: "toggle" },
  ],
  par: 10,
  canonicalMoves: [],
};

// 3a. Open void cliff falls on all 4 borders + partial overhang onto interior void
kit.eq(
  m2.stepBloxorzBlock(synthStage, { posture: "UPRIGHT", r: 0, c: 2, bridgeMask: 0 }, "up").kind,
  "fall_void",
  "Stepping off top island border tips into void (fall_void)"
);
kit.eq(
  m2.stepBloxorzBlock(synthStage, { posture: "UPRIGHT", r: 7, c: 2, bridgeMask: 0 }, "down").kind,
  "fall_void",
  "Stepping off bottom island border tips into void (fall_void)"
);
kit.eq(
  m2.stepBloxorzBlock(synthStage, { posture: "UPRIGHT", r: 2, c: 0, bridgeMask: 0 }, "left").kind,
  "fall_void",
  "Stepping off left island border tips into void (fall_void)"
);
kit.eq(
  m2.stepBloxorzBlock(synthStage, { posture: "UPRIGHT", r: 2, c: 7, bridgeMask: 0 }, "right").kind,
  "fall_void",
  "Stepping off right island border tips into void (fall_void)"
);
// Partial overhang: UPRIGHT at (0,2) rolling right -> FLAT_H on (0,3)-(0,4), where (0,4) is void!
kit.eq(
  m2.stepBloxorzBlock(synthStage, { posture: "UPRIGHT", r: 0, c: 2, bridgeMask: 0 }, "right").kind,
  "fall_void",
  "Partial 1-cell overhang onto interior void cell triggers cliff tumble (fall_void)"
);

// 3b. Fragile Terracotta Tile: SAFE when FLAT, BREAKS when UPRIGHT!
const flatOnFragile = m2.stepBloxorzBlock(
  synthStage,
  { posture: "UPRIGHT", r: 2, c: 0, bridgeMask: 0 },
  "right" // lands FLAT_H on (2,1)-(2,2), covering fragile (2,2)
);
kit.eq(
  flatOnFragile.kind,
  "moved",
  "Fragile terracotta tile safely supports FLAT_H block"
);
const uprightOnFragile = m2.stepBloxorzBlock(
  synthStage,
  { posture: "FLAT_H", r: 2, c: 0, bridgeMask: 0 },
  "right" // stands UPRIGHT on fragile (2,2)
);
kit.eq(
  uprightOnFragile.kind,
  "fall_fragile",
  "Fragile terracotta tile shatters when block stands UPRIGHT on it (fall_fragile)"
);

// 3c. Soft Switch (○) vs Heavy Switch (✕) + Closed vs Open Bridge
// Flat roll across ○ soft switch at (1,1): UPRIGHT at (1,3) -> left -> FLAT_H on (1,1)-(1,2)
const flatSoftSwitch = m2.stepBloxorzBlock(
  synthStage,
  { posture: "UPRIGHT", r: 1, c: 3, bridgeMask: 0 },
  "left"
);
kit.assert(
  flatSoftSwitch.kind === "moved" && flatSoftSwitch.next.bridgeMask === 1,
  "○ Soft Switch triggers when touched FLAT, opening Bridge A (bridgeMask 0 -> 1)"
);

// Flat roll across ✕ heavy switch at (4,1): UPRIGHT at (4,3) -> left -> FLAT_H on (4,1)-(4,2)
const flatHeavySwitch = m2.stepBloxorzBlock(
  synthStage,
  { posture: "UPRIGHT", r: 4, c: 3, bridgeMask: 0 },
  "left"
);
kit.assert(
  flatHeavySwitch.kind === "moved" && flatHeavySwitch.next.bridgeMask === 0,
  "✕ Heavy Switch does NOT trigger when touched FLAT (bridgeMask stays 0)"
);

// Upright landing on ✕ heavy switch at (4,1): FLAT_H at (4,2)-(4,3) -> left -> UPRIGHT at (4,1)
const uprightHeavySwitch = m2.stepBloxorzBlock(
  synthStage,
  { posture: "FLAT_H", r: 4, c: 2, bridgeMask: 0 },
  "left"
);
kit.assert(
  uprightHeavySwitch.kind === "moved" && uprightHeavySwitch.next.bridgeMask === 1,
  "✕ Heavy Switch triggers when standing UPRIGHT (1×1), opening Bridge A (bridgeMask 0 -> 1)"
);

// Closed Bridge A at (3,4) vs Open Bridge A
kit.eq(
  m2.stepBloxorzBlock(synthStage, { posture: "UPRIGHT", r: 3, c: 2, bridgeMask: 0 }, "right").kind,
  "fall_bridge",
  "Stepping onto retracted Bridge A (bridgeMask=0) triggers fall_bridge"
);
kit.eq(
  m2.stepBloxorzBlock(synthStage, { posture: "UPRIGHT", r: 3, c: 2, bridgeMask: 1 }, "right").kind,
  "moved",
  "Stepping onto extended Bridge A (bridgeMask=1) safely crosses"
);

// 3d. Classic 1×1 Emerald Goal Shaft: flat bridges across, upright drops in to win!
kit.eq(
  m2.stepBloxorzBlock(synthStage, { posture: "UPRIGHT", r: 5, c: 3, bridgeMask: 0 }, "right").kind,
  "moved",
  "Rolling FLAT_H across 1×1 goal hole at (5,5) bridges safely without winning"
);
kit.eq(
  m2.stepBloxorzBlock(synthStage, { posture: "FLAT_H", r: 5, c: 3, bridgeMask: 0 }, "right").kind,
  "won",
  "Standing UPRIGHT (1×1) directly on goal hole at (5,5) drops through to win"
);

// ---- 4. 3D Trimetric Projection & Rigid-Body Edge-Hinge Math ----------------
for (const size of [6, 8, 10] as const) {
  for (const [w, h] of [
    [320, 260],
    [560, 440],
  ] as const) {
    const fit = r3d.computeBoardViewportFit(size, w, h);
    const unitsMidRoll = r3d.computeHingedCuboidUnits(
      {
        mode: "rolling",
        from: { posture: "UPRIGHT", r: 2, c: 2 },
        dir: "right",
        progress: 0.5,
      },
      fit
    );
    const allFinite = unitsMidRoll.every(
      (u) =>
        u.faces.length >= 2 &&
        u.faces.every((f) =>
          f.vertices2D.every(
            (pt) =>
              Number.isFinite(pt.x) &&
              Number.isFinite(pt.y) &&
              pt.x >= 0 &&
              pt.x <= w &&
              pt.y >= 0 &&
              pt.y <= h
          )
        )
    );
    kit.assert(
      allFinite,
      `3D trimetric projection & 45° mid-roll cuboid faces stay finite & bounded for ${size}×${size} @ ${w}×${h}`
    );
  }
}

kit.assert(
  r3d.resolveTrimetricSwipeDirection(60, 0) === "right" &&
    r3d.resolveTrimetricSwipeDirection(-60, 0) === "left" &&
    r3d.resolveTrimetricSwipeDirection(0, 60) === "down" &&
    r3d.resolveTrimetricSwipeDirection(0, -60) === "up" &&
    r3d.resolveTrimetricSwipeDirection(5, 5) === null,
  "resolveTrimetricSwipeDirection maps 4-way swipes cleanly and ignores micro-taps"
);

// ---- 5. 426-Day × 3-Difficulty (`1,278` Stages) Zero-Duplicate & Solver Gate -
function buildDateRange(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  const cur = new Date(Date.UTC(sy!, sm! - 1, sd!));
  const end = new Date(Date.UTC(ey!, em! - 1, ed!));
  while (cur <= end) {
    out.push(
      `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(
        2,
        "0"
      )}-${String(cur.getUTCDate()).padStart(2, "0")}`
    );
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

const ALL_DATES = buildDateRange("2026-11-01", "2027-12-31");
const seenEasy = new Set<string>();
const seenMedium = new Set<string>();
const seenHard = new Set<string>();
let all426Valid = true;

for (const d of ALL_DATES) {
  const res = daily.getDailyPuzzleForGame<import("@/data/puzzles/move-2").MoveTwoPuzzle>(
    "move-2",
    d
  );
  if (!res || res.origin !== "bank" || !m2.isMoveTwoPuzzle(res.puzzle)) {
    all426Valid = false;
    break;
  }
  const { easy, medium, hard } = res.puzzle.stages;
  seenEasy.add(JSON.stringify({ g: easy.grid, s: easy.start, e: easy.goal }));
  seenMedium.add(JSON.stringify({ g: medium.grid, s: medium.start, e: medium.goal }));
  seenHard.add(JSON.stringify({ g: hard.grid, s: hard.start, e: hard.goal }));
}

kit.assert(
  all426Valid &&
    seenEasy.size === 426 &&
    seenMedium.size === 426 &&
    seenHard.size === 426,
  `All 1,278 stages across 426 days (2026-11-01..2027-12-31) are valid & 100% unique (Easy=${seenEasy.size}, Medium=${seenMedium.size}, Hard=${seenHard.size})`
);

// ---- 6. Stale Legacy 3×3 / 5×5 Override Rejection & Self-Healing -------------
const stale5x5 = {
  id: "legacy-5x5",
  puzzleNumber: 12,
  title: "Old Cube",
  faces: Array.from({ length: 6 }, () => ({ grid: [] })),
  par: 30,
};
const healed = daily.getDailyPuzzleForGame<import("@/data/puzzles/move-2").MoveTwoPuzzle>(
  "move-2",
  "2027-03-10",
  { "2027-03-10": stale5x5 }
);
kit.assert(
  Boolean(healed && healed.origin === "bank" && healed.puzzle.version === 3),
  "getDailyPuzzleForGame rejects stale 5×5 override and self-heals to v3 Bloxorz bundle"
);

// ---- 7. Web Audio API SFX & UI / Studio Wiring -------------------------------
let audioSafe = true;
try {
  sfx.setMoveTwoMuted(false);
  sfx.playMoveTwoRollSfx("UPRIGHT");
  sfx.playMoveTwoSwitchSfx("soft", true);
  sfx.playMoveTwoSwitchSfx("heavy", false);
  sfx.playMoveTwoFragileCrackSfx();
  sfx.playMoveTwoFallSfx();
  sfx.playMoveTwoHoleDropSfx();
  sfx.playMoveTwoVictorySfx();
  sfx.setMoveTwoMuted(true);
  kit.eq(sfx.isMoveTwoMuted(), true, "mute state persists true");
  sfx.setMoveTwoMuted(false);
  kit.eq(sfx.isMoveTwoMuted(), false, "mute state resets false");
} catch {
  audioSafe = false;
}
kit.assert(audioSafe, "all Bloxorz Web Audio SFX execute safely in headless Node");

kit.assert(cfg.isPlayableGameSlug("move-2"), "move-2 is playable");
kit.eq(
  cfg.getGameBySlug("move-2")?.showCreate,
  false,
  "move-2 has showCreate: false"
);

const gameSrc = fs.readFileSync(
  new URL("../src/components/games/move-two.tsx", import.meta.url),
  "utf8"
);
const canvasSrc = fs.readFileSync(
  new URL("../src/components/games/move-two-canvas.tsx", import.meta.url),
  "utf8"
);
const studioSrc = fs.readFileSync(
  new URL("../src/components/admin/move-two-studio-tab.tsx", import.meta.url),
  "utf8"
);

kit.assert(
  gameSrc.includes('data-testid="move-two-difficulty-tabs"') &&
    gameSrc.includes("move-two-diff-") &&
    gameSrc.includes('data-testid="move-two-mute-toggle"') &&
    gameSrc.includes("ResultShareButtons") &&
    canvasSrc.includes('data-testid="move-two-3d-block"'),
  "move-two.tsx & move-two-canvas.tsx wire difficulty tabs, 3D Bloxorz canvas, mute toggle, and ResultShareButtons"
);

kit.assert(
  studioSrc.includes("admin-move-two-clear-all") &&
    studioSrc.includes("admin-move-two-revert-default") &&
    studioSrc.includes("admin-move-two-reroll") &&
    studioSrc.includes("MoveTwoBloxorzCanvas"),
  "move-two-studio-tab.tsx wires Clear All, Revert to Default, Reroll Seed, and live 3D Bloxorz preview"
);

kit.finish();
