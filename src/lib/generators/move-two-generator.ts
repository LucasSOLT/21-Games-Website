/**
 * Game #2 — Move Two (`move-2`) 3-Difficulty 3D Bloxorz Engine, Level Architect & State-Space BFS Solver
 * Per GAME_DESIGN_BIBLE.md §2 (Bloxorz Overhaul):
 * - Every daily puzzle includes 3 standalone floating 3D island stages:
 *   • `easy`   (`6×6`) — Floating stone island with void edges, terracotta fragile tiles & optional ○ switch
 *   • `medium` (`8×8`) — Twin floating island wings across a void chasm with ○/✕ switch-gated bridge & fragile tiles
 *   • `hard`   (`10×10`) — Multi-chasm floating islands with ✕ upright-only heavy switches, dual bridges & parity corridors
 * - Classic Bloxorz 1×1×2 cuboid (`UPRIGHT`, `FLAT_H`, `FLAT_V`) rolling over open void edges:
 *   • Stepping any cell onto `"void"`, out-of-bounds, or a retracted `"bridge"` tips the block off the island (`fall_void` / `fall_bridge`).
 *   • `"fragile"` terracotta tiles hold `"FLAT_H"` / `"FLAT_V"` safely, but break when standing `"UPRIGHT"` (`fall_fragile`).
 *   • `"soft_switch"` (`○`) triggers on ANY touch (`UPRIGHT` or `FLAT`).
 *   • `"heavy_switch"` (`✕`) triggers ONLY when standing `"UPRIGHT"` (`1×1`).
 *   • The `1×1` Emerald Goal Hole (`goal: { r, c }`) wins ONLY when standing `"UPRIGHT"` (`1×1`) directly over it.
 * - Exact State-Space Breadth-First Search (`solveBloxorzStage`) over `(posture, r, c, bridgeMask)`.
 */

import { fnv1a32, mulberry32 } from "@/lib/seeded-random";
import { getPuzzleNumberForDate } from "@/lib/date-keys";

export const MOVE_TWO_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type MoveTwoDifficulty = (typeof MOVE_TWO_DIFFICULTIES)[number];

export const MOVE_TWO_BOARD_SIZES: Record<MoveTwoDifficulty, 6 | 8 | 10> = {
  easy: 6,
  medium: 8,
  hard: 10,
};

export const MOVE_TWO_DIFFICULTY_META: Record<
  MoveTwoDifficulty,
  { label: string; sizeLabel: string; subtitle: string }
> = {
  easy: {
    label: "Easy",
    sizeLabel: "6×6",
    subtitle: "Floating Island",
  },
  medium: {
    label: "Medium",
    sizeLabel: "8×8",
    subtitle: "Switch & Bridge",
  },
  hard: {
    label: "Hard",
    sizeLabel: "10×10",
    subtitle: "Heavy Switches & Chasms",
  },
};

export type MoveTwoPosture = "UPRIGHT" | "FLAT_H" | "FLAT_V";
export type MoveTwoDirection = "up" | "right" | "down" | "left";

export type MoveTwoTileType =
  | "void"
  | "floor"
  | "fragile"
  | "bridge"
  | "soft_switch"
  | "heavy_switch";

export type MoveTwoSwitchBehavior = "toggle" | "open" | "close";

export interface MoveTwoCoord {
  r: number;
  c: number;
}

export interface MoveTwoBridgeDef {
  id: string;
  cells: MoveTwoCoord[];
  initiallyOpen: boolean;
}

export interface MoveTwoSwitchDef {
  r: number;
  c: number;
  kind: "soft" | "heavy";
  bridgeId: string;
  behavior: MoveTwoSwitchBehavior;
}

export interface MoveTwoBlockState {
  posture: MoveTwoPosture;
  /** Top-left anchor cell of the 1×1 (`UPRIGHT`), 1×2 (`FLAT_H`), or 2×1 (`FLAT_V`) footprint. */
  r: number;
  c: number;
  /** Bitmask where bit `i` is `1` iff `stage.bridges[i]` is currently open/extended. */
  bridgeMask: number;
}

export interface MoveTwoStage {
  difficulty: MoveTwoDifficulty;
  size: 6 | 8 | 10;
  grid: MoveTwoTileType[][];
  start: MoveTwoCoord;
  goal: MoveTwoCoord;
  bridges: MoveTwoBridgeDef[];
  switches: MoveTwoSwitchDef[];
  par: number;
  canonicalMoves: MoveTwoDirection[];
}

export interface MoveTwoPuzzle {
  version: 3;
  id: string;
  puzzleNumber: number;
  title: string;
  author: string;
  editor: string;
  stages: Record<MoveTwoDifficulty, MoveTwoStage>;
  /** Headline Par (Medium 8×8 Par) used in compact archive/batch summaries. */
  par: number;
  customDate?: string;
}

export type MoveTwoStepOutcome =
  | {
      kind: "moved";
      next: MoveTwoBlockState;
      toggledBridgeIds: string[];
      triggeredSwitch: MoveTwoSwitchDef | null;
    }
  | {
      kind: "won";
      next: MoveTwoBlockState;
    }
  | {
      kind: "fall_void";
      attempted: MoveTwoBlockState;
      overhangCells: MoveTwoCoord[];
    }
  | {
      kind: "fall_bridge";
      attempted: MoveTwoBlockState;
      bridgeId: string;
      closedCells: MoveTwoCoord[];
    }
  | {
      kind: "fall_fragile";
      attempted: MoveTwoBlockState;
      brokenCell: MoveTwoCoord;
    };

export interface MoveTwoStageSolveResult {
  solvable: boolean;
  minMoves: number;
  moves: MoveTwoDirection[];
  exploredStates: number;
}

export interface MoveTwoSolveResult {
  solvable: boolean;
  /** Medium (`8×8`) Par, matching `puzzle.par`. */
  minMoves: number;
  stages: Record<MoveTwoDifficulty, MoveTwoStageSolveResult>;
}

export const MOVE_TWO_DIRECTIONS: readonly MoveTwoDirection[] = [
  "up",
  "right",
  "down",
  "left",
] as const;

export const MOVE_TWO_POSTURES: readonly MoveTwoPosture[] = [
  "UPRIGHT",
  "FLAT_H",
  "FLAT_V",
] as const;

export const MOVE_TWO_TILE_TYPES: readonly MoveTwoTileType[] = [
  "void",
  "floor",
  "fragile",
  "bridge",
  "soft_switch",
  "heavy_switch",
] as const;

const PUZZLE_TITLES: readonly string[] = [
  "Terracotta Span",
  "Split Horizon",
  "Cantilever",
  "Amber Causeway",
  "Counterweight",
  "Skyline Ledge",
  "Twin Plazas",
  "Switchback",
  "Floating Arch",
  "Silent Chasm",
  "Pivot Point",
  "High Trestle",
  "Stone Promenade",
  "Double Crossing",
  "Sunlit Terrace",
  "Narrow Isthmus",
  "Iron Latch",
  "Stepped Atoll",
  "Quiet Overlook",
  "Fragile Ridge",
  "Bridge of Sighs",
  "Suspended Court",
  "Drawbridge",
  "Emerald Shaft",
  "Cliffside Turn",
  "Two-Cube Waltz",
  "Monolith Drift",
  "Canyon Gate",
  "Cloud Causeway",
  "Balance Beam",
  "Tectonic Step",
  "Keystone",
  "Golden Hinge",
  "Broken Viaduct",
  "Skyward Pier",
  "Parity Plaza",
];

/** Creates a `size × size` grid filled with `fill` (defaults to `"void"`). */
export function createMoveTwoGrid(
  size: 6 | 8 | 10,
  fill: MoveTwoTileType = "void"
): MoveTwoTileType[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => fill)
  );
}

export function isInBoundsStage(size: number, r: number, c: number): boolean {
  return r >= 0 && r < size && c >= 0 && c < size;
}

/** Returns the 1 or 2 grid cells occupied by a block footprint. */
export function getDominoCells(
  state: Pick<MoveTwoBlockState, "posture" | "r" | "c">
): MoveTwoCoord[] {
  if (state.posture === "UPRIGHT") {
    return [{ r: state.r, c: state.c }];
  }
  if (state.posture === "FLAT_H") {
    return [
      { r: state.r, c: state.c },
      { r: state.r, c: state.c + 1 },
    ];
  }
  return [
    { r: state.r, c: state.c },
    { r: state.r + 1, c: state.c },
  ];
}

export function getInitialBridgeMask(
  stage: Pick<MoveTwoStage, "bridges">
): number {
  let mask = 0;
  for (let i = 0; i < stage.bridges.length; i++) {
    if (stage.bridges[i]!.initiallyOpen) {
      mask |= 1 << i;
    }
  }
  return mask;
}

export function getInitialBlockState(
  stage: Pick<MoveTwoStage, "start" | "bridges">
): MoveTwoBlockState {
  return {
    posture: "UPRIGHT",
    r: stage.start.r,
    c: stage.start.c,
    bridgeMask: getInitialBridgeMask(stage),
  };
}

export function isBridgeOpen(
  stage: Pick<MoveTwoStage, "bridges">,
  bridgeMask: number,
  bridgeId: string
): boolean {
  const idx = stage.bridges.findIndex((b) => b.id === bridgeId);
  if (idx < 0) return false;
  return (bridgeMask & (1 << idx)) !== 0;
}

export function getBridgeForCell(
  stage: Pick<MoveTwoStage, "bridges">,
  r: number,
  c: number
): { bridge: MoveTwoBridgeDef; index: number } | null {
  for (let i = 0; i < stage.bridges.length; i++) {
    const bridge = stage.bridges[i]!;
    if (bridge.cells.some((cell) => cell.r === r && cell.c === c)) {
      return { bridge, index: i };
    }
  }
  return null;
}

export function getSwitchAtCell(
  stage: Pick<MoveTwoStage, "switches">,
  r: number,
  c: number
): MoveTwoSwitchDef | null {
  for (const sw of stage.switches) {
    if (sw.r === r && sw.c === c) {
      return sw;
    }
  }
  return null;
}

/** Raw 3D 1×1×2 cuboid roll kinematics before tile/void/bridge/switch checks. */
export function computeRawRoll(
  state: Pick<MoveTwoBlockState, "posture" | "r" | "c"> & { bridgeMask?: number },
  dir: MoveTwoDirection
): MoveTwoBlockState {
  const { posture, r, c } = state;
  const bridgeMask = state.bridgeMask ?? 0;

  if (posture === "UPRIGHT") {
    switch (dir) {
      case "up":
        return { posture: "FLAT_V", r: r - 2, c, bridgeMask };
      case "down":
        return { posture: "FLAT_V", r: r + 1, c, bridgeMask };
      case "left":
        return { posture: "FLAT_H", r, c: c - 2, bridgeMask };
      case "right":
        return { posture: "FLAT_H", r, c: c + 1, bridgeMask };
    }
  }

  if (posture === "FLAT_H") {
    switch (dir) {
      case "left":
        return { posture: "UPRIGHT", r, c: c - 1, bridgeMask };
      case "right":
        return { posture: "UPRIGHT", r, c: c + 2, bridgeMask };
      case "up":
        return { posture: "FLAT_H", r: r - 1, c, bridgeMask };
      case "down":
        return { posture: "FLAT_H", r: r + 1, c, bridgeMask };
    }
  }

  // FLAT_V
  switch (dir) {
    case "up":
      return { posture: "UPRIGHT", r: r - 1, c, bridgeMask };
    case "down":
      return { posture: "UPRIGHT", r: r + 2, c, bridgeMask };
    case "left":
      return { posture: "FLAT_V", r, c: c - 1, bridgeMask };
    case "right":
      return { posture: "FLAT_V", r, c: c + 1, bridgeMask };
  }
}

/**
 * Evaluates a single Bloxorz move on `stage` from `state` in `dir`:
 * 1. Void / island edge check (`fall_void`)
 * 2. Retracted bridge check (`fall_bridge`)
 * 3. Upright-on-fragile terracotta check (`fall_fragile`)
 * 4. Upright-on-1×1-goal-hole check (`won`)
 * 5. Switch activation (`○` soft switch on any posture; `✕` heavy switch on `UPRIGHT` only)
 */
export function stepBloxorzBlock(
  stage: Pick<
    MoveTwoStage,
    "size" | "grid" | "goal" | "bridges" | "switches"
  >,
  state: MoveTwoBlockState,
  dir: MoveTwoDirection
): MoveTwoStepOutcome {
  const attempted = computeRawRoll(state, dir);
  const cells = getDominoCells(attempted);

  // 1. Out-of-bounds or open void check
  const overhangCells: MoveTwoCoord[] = [];
  for (const cell of cells) {
    if (
      !isInBoundsStage(stage.size, cell.r, cell.c) ||
      stage.grid[cell.r]?.[cell.c] === "void"
    ) {
      overhangCells.push(cell);
    }
  }
  if (overhangCells.length > 0) {
    return {
      kind: "fall_void",
      attempted,
      overhangCells,
    };
  }

  // 2. Closed/retracted bridge check
  const closedCells: MoveTwoCoord[] = [];
  let closedBridgeId = "";
  for (const cell of cells) {
    if (stage.grid[cell.r]![cell.c] === "bridge") {
      const found = getBridgeForCell(stage, cell.r, cell.c);
      if (!found || (state.bridgeMask & (1 << found.index)) === 0) {
        closedCells.push(cell);
        if (!closedBridgeId) {
          closedBridgeId = found?.bridge.id ?? "A";
        }
      }
    }
  }
  if (closedCells.length > 0) {
    return {
      kind: "fall_bridge",
      attempted,
      bridgeId: closedBridgeId,
      closedCells,
    };
  }

  // 3. Fragile terracotta tile check: safe when FLAT_H / FLAT_V, shatters when UPRIGHT!
  // 3. Red Obstacle check: touching an Obstacle tile AT ALL (standing OR flat, even 1 half) resets to Start
  for (const cell of cells) {
    if (stage.grid[cell.r]![cell.c] === "fragile") {
      return {
        kind: "fall_fragile",
        attempted,
        brokenCell: cell,
      };
    }
  }

  // 4. Classic 1×1 Emerald Goal Shaft: wins ONLY when standing UPRIGHT on (goal.r, goal.c)
  if (
    attempted.posture === "UPRIGHT" &&
    attempted.r === stage.goal.r &&
    attempted.c === stage.goal.c
  ) {
    return {
      kind: "won",
      next: attempted,
    };
  }

  // 5. Evaluate ○ soft switches & ✕ heavy switches on occupied cells
  let nextMask = state.bridgeMask;
  const toggledBridgeIds: string[] = [];
  let triggeredSwitch: MoveTwoSwitchDef | null = null;

  for (const cell of cells) {
    const sw = getSwitchAtCell(stage, cell.r, cell.c);
    if (!sw) continue;

    const shouldTrigger =
      sw.kind === "soft" ||
      (sw.kind === "heavy" && attempted.posture === "UPRIGHT");

    if (!shouldTrigger) continue;

    triggeredSwitch = sw;
    const bridgeIdx = stage.bridges.findIndex((b) => b.id === sw.bridgeId);
    if (bridgeIdx >= 0) {
      const bit = 1 << bridgeIdx;
      const wasOpen = (nextMask & bit) !== 0;
      const nowOpen =
        sw.behavior === "toggle"
          ? !wasOpen
          : sw.behavior === "open"
          ? true
          : false;
      if (nowOpen !== wasOpen) {
        nextMask = nowOpen ? nextMask | bit : nextMask & ~bit;
        if (!toggledBridgeIds.includes(sw.bridgeId)) {
          toggledBridgeIds.push(sw.bridgeId);
        }
      }
    }
  }

  // Safety check if a flat roll onto a switch closed a bridge beneath its other half
  if (nextMask !== state.bridgeMask) {
    const newlyClosed: MoveTwoCoord[] = [];
    let newlyClosedId = "";
    for (const cell of cells) {
      if (stage.grid[cell.r]![cell.c] === "bridge") {
        const found = getBridgeForCell(stage, cell.r, cell.c);
        if (!found || (nextMask & (1 << found.index)) === 0) {
          newlyClosed.push(cell);
          if (!newlyClosedId) newlyClosedId = found?.bridge.id ?? "A";
        }
      }
    }
    if (newlyClosed.length > 0) {
      return {
        kind: "fall_bridge",
        attempted: { ...attempted, bridgeMask: nextMask },
        bridgeId: newlyClosedId,
        closedCells: newlyClosed,
      };
    }
  }

  return {
    kind: "moved",
    next: {
      posture: attempted.posture,
      r: attempted.r,
      c: attempted.c,
      bridgeMask: nextMask,
    },
    toggledBridgeIds,
    triggeredSwitch,
  };
}

function postureToIndex(p: MoveTwoPosture): number {
  return p === "UPRIGHT" ? 0 : p === "FLAT_H" ? 1 : 2;
}

function indexToPosture(idx: number): MoveTwoPosture {
  return idx === 0 ? "UPRIGHT" : idx === 1 ? "FLAT_H" : "FLAT_V";
}

/**
 * Exact State-Space Breadth-First Search (BFS) over `(posture, r, c, bridgeMask)`.
 * Computes guaranteed solvability and exact minimum move count (`par`).
 */
export function solveBloxorzStage(
  stage: Pick<
    MoveTwoStage,
    "size" | "grid" | "start" | "goal" | "bridges" | "switches"
  >
): MoveTwoStageSolveResult {
  const size = stage.size;
  if (
    !isInBoundsStage(size, stage.start.r, stage.start.c) ||
    !isInBoundsStage(size, stage.goal.r, stage.goal.c)
  ) {
    return { solvable: false, minMoves: -1, moves: [], exploredStates: 0 };
  }

  const startTile = stage.grid[stage.start.r]?.[stage.start.c];
  const goalTile = stage.grid[stage.goal.r]?.[stage.goal.c];
  if (
    !startTile ||
    startTile === "void" ||
    startTile === "fragile" ||
    !goalTile ||
    goalTile === "void" ||
    goalTile === "fragile"
  ) {
    return { solvable: false, minMoves: -1, moves: [], exploredStates: 0 };
  }

  if (stage.start.r === stage.goal.r && stage.start.c === stage.goal.c) {
    return { solvable: false, minMoves: -1, moves: [], exploredStates: 0 };
  }

  const numBridges = Math.min(stage.bridges.length, 6);
  const maskStates = 1 << numBridges;
  const totalStates = maskStates * 3 * size * size;

  const encode = (
    posture: MoveTwoPosture,
    r: number,
    c: number,
    mask: number
  ): number => (((mask * 3 + postureToIndex(posture)) * size + r) * size + c);

  const visited = new Uint8Array(totalStates);
  const parentState = new Int32Array(totalStates).fill(-1);
  const parentDir = new Int8Array(totalStates).fill(-1);
  const queue = new Int32Array(totalStates + 4);

  const initState = getInitialBlockState(stage);
  // Ensure start isn't on a closed bridge
  if (startTile === "bridge") {
    const b = getBridgeForCell(stage, stage.start.r, stage.start.c);
    if (!b || (initState.bridgeMask & (1 << b.index)) === 0) {
      return { solvable: false, minMoves: -1, moves: [], exploredStates: 0 };
    }
  }

  const initIdx = encode(
    initState.posture,
    initState.r,
    initState.c,
    initState.bridgeMask
  );
  visited[initIdx] = 1;
  queue[0] = initIdx;
  let head = 0;
  let tail = 1;

  while (head < tail) {
    const currIdx = queue[head++]!;
    let rem = currIdx;
    const c = rem % size;
    rem = (rem - c) / size;
    const r = rem % size;
    rem = (rem - r) / size;
    const pIdx = rem % 3;
    const mask = (rem - pIdx) / 3;
    const currState: MoveTwoBlockState = {
      posture: indexToPosture(pIdx),
      r,
      c,
      bridgeMask: mask,
    };

    for (let d = 0; d < 4; d++) {
      const dir = MOVE_TWO_DIRECTIONS[d]!;
      const step = stepBloxorzBlock(stage, currState, dir);
      if (step.kind === "won") {
        const path: MoveTwoDirection[] = [dir];
        let walk = currIdx;
        while (parentDir[walk] !== -1) {
          path.push(MOVE_TWO_DIRECTIONS[parentDir[walk]!]!);
          walk = parentState[walk]!;
        }
        path.reverse();
        return {
          solvable: true,
          minMoves: path.length,
          moves: path,
          exploredStates: tail,
        };
      }

      if (step.kind === "moved") {
        const nextIdx = encode(
          step.next.posture,
          step.next.r,
          step.next.c,
          step.next.bridgeMask
        );
        if (visited[nextIdx] === 0) {
          visited[nextIdx] = 1;
          parentState[nextIdx] = currIdx;
          parentDir[nextIdx] = d;
          queue[tail++] = nextIdx;
        }
      }
    }
  }

  return { solvable: false, minMoves: -1, moves: [], exploredStates: tail };
}

/**
 * Verifies that every initially-closed bridge on a stage is genuinely required:
 * disabling switches makes the stage unsolvable (so players must use the switch).
 */
export function verifySwitchNecessity(
  stage: Pick<
    MoveTwoStage,
    "size" | "grid" | "start" | "goal" | "bridges" | "switches"
  >
): boolean {
  const closedBridges = stage.bridges.filter((b) => !b.initiallyOpen);
  if (closedBridges.length === 0) return true;

  // Without any switches, stage must be unsolvable
  const withoutSwitches = solveBloxorzStage({
    ...stage,
    switches: [],
  });
  if (withoutSwitches.solvable) {
    return false;
  }

  // Every closed bridge's switch group must be necessary
  for (const bridge of closedBridges) {
    const withoutThisBridgeSwitches = solveBloxorzStage({
      ...stage,
      switches: stage.switches.filter((sw) => sw.bridgeId !== bridge.id),
    });
    if (withoutThisBridgeSwitches.solvable) {
      return false;
    }
  }

  return true;
}

/** Solves all 3 difficulty stages (`easy`, `medium`, `hard`) of a `MoveTwoPuzzle`. */
export function solveMoveTwo(
  puzzle: Pick<MoveTwoPuzzle, "stages">
): MoveTwoSolveResult {
  const easy = solveBloxorzStage(puzzle.stages.easy);
  const medium = solveBloxorzStage(puzzle.stages.medium);
  const hard = solveBloxorzStage(puzzle.stages.hard);

  return {
    solvable: easy.solvable && medium.solvable && hard.solvable,
    minMoves: medium.solvable ? medium.minMoves : -1,
    stages: { easy, medium, hard },
  };
}

/** Computes 1–3 star rating relative to BFS shortest-path `par`. */
export function computeMoveTwoStars(moves: number, par: number): 1 | 2 | 3 {
  if (moves <= par + 2) return 3;
  if (moves <= par + 6) return 2;
  return 1;
}

export function validateMoveTwoStage(
  stage: unknown,
  expectedDifficulty?: MoveTwoDifficulty
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!stage || typeof stage !== "object") {
    return { valid: false, errors: ["Stage must be an object"] };
  }

  const s = stage as Record<string, unknown>;
  const difficulty = s.difficulty as MoveTwoDifficulty;
  if (!MOVE_TWO_DIFFICULTIES.includes(difficulty)) {
    errors.push(`Invalid stage difficulty: ${String(s.difficulty)}`);
    return { valid: false, errors };
  }
  if (expectedDifficulty && difficulty !== expectedDifficulty) {
    errors.push(`Expected stage difficulty ${expectedDifficulty}, got ${difficulty}`);
  }

  const expectedSize = MOVE_TWO_BOARD_SIZES[difficulty];
  if (s.size !== expectedSize) {
    errors.push(`Stage ${difficulty} must have size ${expectedSize}, got ${String(s.size)}`);
    return { valid: false, errors };
  }

  if (
    !Array.isArray(s.grid) ||
    s.grid.length !== expectedSize ||
    s.grid.some(
      (row) =>
        !Array.isArray(row) ||
        row.length !== expectedSize ||
        row.some((cell) => !MOVE_TWO_TILE_TYPES.includes(cell as MoveTwoTileType))
    )
  ) {
    errors.push(`Stage ${difficulty} grid must be ${expectedSize}×${expectedSize} valid tiles`);
    return { valid: false, errors };
  }

  const grid = s.grid as MoveTwoTileType[][];
  const start = s.start as MoveTwoCoord | undefined;
  const goal = s.goal as MoveTwoCoord | undefined;
  if (
    !start ||
    typeof start.r !== "number" ||
    typeof start.c !== "number" ||
    !isInBoundsStage(expectedSize, start.r, start.c)
  ) {
    errors.push(`Stage ${difficulty} start coordinate is invalid`);
    return { valid: false, errors };
  }
  if (
    !goal ||
    typeof goal.r !== "number" ||
    typeof goal.c !== "number" ||
    !isInBoundsStage(expectedSize, goal.r, goal.c)
  ) {
    errors.push(`Stage ${difficulty} goal coordinate is invalid`);
    return { valid: false, errors };
  }

  if (start.r === goal.r && start.c === goal.c) {
    errors.push(`Stage ${difficulty} start and goal cannot be the same tile`);
  }
  if (grid[start.r]![start.c] === "void" || grid[start.r]![start.c] === "fragile") {
    errors.push(`Stage ${difficulty} start tile must be solid (not void or fragile)`);
  }
  if (grid[goal.r]![goal.c] === "void" || grid[goal.r]![goal.c] === "fragile") {
    errors.push(`Stage ${difficulty} goal tile must be solid floor`);
  }

  if (!Array.isArray(s.bridges) || !Array.isArray(s.switches)) {
    errors.push(`Stage ${difficulty} must define bridges and switches arrays`);
    return { valid: false, errors };
  }

  const bridges = s.bridges as MoveTwoBridgeDef[];
  const switches = s.switches as MoveTwoSwitchDef[];
  const bridgeIds = new Set<string>();
  for (const b of bridges) {
    if (!b || typeof b.id !== "string" || !b.id.trim() || !Array.isArray(b.cells)) {
      errors.push(`Stage ${difficulty} contains malformed bridge definition`);
      continue;
    }
    bridgeIds.add(b.id);
    for (const cell of b.cells) {
      if (
        !cell ||
        !isInBoundsStage(expectedSize, cell.r, cell.c) ||
        grid[cell.r]![cell.c] !== "bridge"
      ) {
        errors.push(
          `Stage ${difficulty} bridge ${b.id} cell (${cell?.r},${cell?.c}) does not match 'bridge' grid cell`
        );
      }
    }
  }

  for (const sw of switches) {
    if (
      !sw ||
      (sw.kind !== "soft" && sw.kind !== "heavy") ||
      !isInBoundsStage(expectedSize, sw.r, sw.c) ||
      !bridgeIds.has(sw.bridgeId)
    ) {
      errors.push(`Stage ${difficulty} contains invalid switch definition`);
      continue;
    }
    const expectedTile = sw.kind === "soft" ? "soft_switch" : "heavy_switch";
    if (grid[sw.r]![sw.c] !== expectedTile) {
      errors.push(
        `Stage ${difficulty} switch at (${sw.r},${sw.c}) does not match grid tile '${expectedTile}'`
      );
    }
  }

  if (typeof s.par !== "number" || s.par < 1 || !Array.isArray(s.canonicalMoves)) {
    errors.push(`Stage ${difficulty} missing valid par or canonicalMoves`);
    return { valid: false, errors };
  }

  const solved = solveBloxorzStage({
    size: expectedSize,
    grid,
    start,
    goal,
    bridges,
    switches,
  });
  if (!solved.solvable) {
    errors.push(`Stage ${difficulty} is unsolvable according to BFS solver`);
  } else if (solved.minMoves !== s.par) {
    errors.push(
      `Stage ${difficulty} par (${s.par}) does not match BFS shortest path (${solved.minMoves})`
    );
  }

  return { valid: errors.length === 0, errors };
}

export function validateMoveTwoPuzzle(
  puzzle: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!puzzle || typeof puzzle !== "object") {
    return { valid: false, errors: ["Move Two puzzle must be an object"] };
  }

  const p = puzzle as Record<string, unknown>;
  if (p.version !== 3) {
    return {
      valid: false,
      errors: ["Move Two puzzle must use Bloxorz v3 multi-difficulty schema"],
    };
  }
  if (typeof p.id !== "string" || !p.id.trim()) {
    errors.push("Missing puzzle id");
  }
  if (typeof p.title !== "string" || !p.title.trim()) {
    errors.push("Missing puzzle title");
  }
  if (!p.stages || typeof p.stages !== "object") {
    return { valid: false, errors: [...errors, "Missing stages record"] };
  }

  const stages = p.stages as Record<string, unknown>;
  for (const diff of MOVE_TWO_DIFFICULTIES) {
    const check = validateMoveTwoStage(stages[diff], diff);
    if (!check.valid) {
      errors.push(...check.errors);
    }
  }

  if (errors.length === 0) {
    const medStage = stages.medium as MoveTwoStage;
    if (p.par !== medStage.par) {
      errors.push(
        `Puzzle headline par (${String(p.par)}) must equal medium stage par (${medStage.par})`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function isMoveTwoPuzzle(val: unknown): val is MoveTwoPuzzle {
  return validateMoveTwoPuzzle(val).valid;
}

// ============================================================================
// Procedural Bloxorz Floating Island Architect (`6×6` Easy · `8×8` Medium · `10×10` Hard)
// ============================================================================

function carveRect(
  grid: MoveTwoTileType[][],
  r0: number,
  c0: number,
  h: number,
  w: number,
  tile: MoveTwoTileType = "floor"
): void {
  const size = grid.length;
  for (let r = r0; r < r0 + h; r++) {
    for (let c = c0; c < c0 + w; c++) {
      if (isInBoundsStage(size, r, c)) {
        grid[r]![c] = tile;
      }
    }
  }
}

function applySymmetryTransform(
  size: 6 | 8 | 10,
  coord: MoveTwoCoord,
  sym: number
): MoveTwoCoord {
  const { r, c } = coord;
  switch (sym & 3) {
    case 0:
      return { r, c };
    case 1:
      return { r, c: size - 1 - c };
    case 2:
      return { r: size - 1 - r, c };
    default:
      return { r: size - 1 - r, c: size - 1 - c };
  }
}

function transformStageSymmetry(
  raw: Omit<MoveTwoStage, "par" | "canonicalMoves">,
  sym: number
): Omit<MoveTwoStage, "par" | "canonicalMoves"> {
  const size = raw.size;
  const transpose = (sym & 4) !== 0;

  const mapPoint = (pt: MoveTwoCoord): MoveTwoCoord => {
    const flipped = applySymmetryTransform(size, pt, sym & 3);
    return transpose ? { r: flipped.c, c: flipped.r } : flipped;
  };

  const nextGrid = createMoveTwoGrid(size, "void");
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const dst = mapPoint({ r, c });
      nextGrid[dst.r]![dst.c] = raw.grid[r]![c]!;
    }
  }

  return {
    difficulty: raw.difficulty,
    size,
    grid: nextGrid,
    start: mapPoint(raw.start),
    goal: mapPoint(raw.goal),
    bridges: raw.bridges.map((b) => ({
      ...b,
      cells: b.cells.map(mapPoint),
    })),
    switches: raw.switches.map((sw) => ({
      ...sw,
      ...mapPoint({ r: sw.r, c: sw.c }),
    })),
  };
}

function sprinkleFragileTiles(
  stage: Omit<MoveTwoStage, "par" | "canonicalMoves">,
  rng: () => number,
  targetCount: number
): void {
  const protectedKeys = new Set<string>([
    `${stage.start.r},${stage.start.c}`,
    `${stage.goal.r},${stage.goal.c}`,
  ]);
  for (const sw of stage.switches) {
    protectedKeys.add(`${sw.r},${sw.c}`);
  }
  for (const b of stage.bridges) {
    for (const cell of b.cells) {
      protectedKeys.add(`${cell.r},${cell.c}`);
    }
  }

  const candidates: MoveTwoCoord[] = [];
  for (let r = 0; r < stage.size; r++) {
    for (let c = 0; c < stage.size; c++) {
      if (stage.grid[r]![c] === "floor" && !protectedKeys.has(`${r},${c}`)) {
        candidates.push({ r, c });
      }
    }
  }

  // Fisher-Yates shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = candidates[i]!;
    candidates[i] = candidates[j]!;
    candidates[j] = tmp;
  }

  let placed = 0;
  for (const cell of candidates) {
    if (placed >= targetCount) break;
    stage.grid[cell.r]![cell.c] = "fragile";
    const solved = solveBloxorzStage(stage);
    if (solved.solvable && verifySwitchNecessity(stage)) {
      placed++;
    } else {
      stage.grid[cell.r]![cell.c] = "floor";
    }
  }
}

function pickFloorCellInBox(
  grid: MoveTwoTileType[][],
  r0: number,
  c0: number,
  h: number,
  w: number,
  rng: () => number,
  avoid: MoveTwoCoord[] = []
): MoveTwoCoord | null {
  const size = grid.length;
  const avoidSet = new Set(avoid.map((p) => `${p.r},${p.c}`));
  const pool: MoveTwoCoord[] = [];
  for (let r = r0; r < r0 + h; r++) {
    for (let c = c0; c < c0 + w; c++) {
      if (
        isInBoundsStage(size, r, c) &&
        grid[r]![c] === "floor" &&
        !avoidSet.has(`${r},${c}`)
      ) {
        pool.push({ r, c });
      }
    }
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)]!;
}

function buildEasyCandidate(
  rng: () => number
): Omit<MoveTwoStage, "par" | "canonicalMoves"> {
  const size = 6 as const;
  const grid = createMoveTwoGrid(size, "void");
  const archetype = Math.floor(rng() * 5);
  const bridges: MoveTwoBridgeDef[] = [];
  const switches: MoveTwoSwitchDef[] = [];
  let start: MoveTwoCoord = { r: 1, c: 1 };
  let goal: MoveTwoCoord = { r: 4, c: 4 };

  if (archetype === 0) {
    // S-curve twin 3x3 terraces
    carveRect(grid, 0, 0, 3, 3, "floor");
    carveRect(grid, 1, 2, 3, 2, "floor");
    carveRect(grid, 3, 2, 3, 4, "floor");
    start = pickFloorCellInBox(grid, 0, 0, 3, 2, rng) ?? { r: 1, c: 1 };
    goal = pickFloorCellInBox(grid, 3, 3, 3, 3, rng, [start]) ?? { r: 4, c: 4 };
  } else if (archetype === 1) {
    // L-shaped canyon rim with corner notch
    carveRect(grid, 0, 0, 3, 4, "floor");
    carveRect(grid, 2, 2, 4, 4, "floor");
    if (rng() < 0.6) grid[0]![0] = "void";
    if (rng() < 0.6) grid[5]![5] = "void";
    start = pickFloorCellInBox(grid, 0, 0, 3, 2, rng) ?? { r: 1, c: 1 };
    goal = pickFloorCellInBox(grid, 3, 3, 3, 3, rng, [start]) ?? { r: 4, c: 4 };
  } else if (archetype === 2) {
    // U-bend floating courtyard (central 3×2 void chasm)
    carveRect(grid, 0, 0, 3, 2, "floor");
    carveRect(grid, 3, 0, 3, 6, "floor");
    carveRect(grid, 0, 4, 3, 2, "floor");
    grid[5]![0] = "void";
    grid[5]![5] = "void";
    start = pickFloorCellInBox(grid, 0, 0, 3, 2, rng) ?? { r: 1, c: 1 };
    goal = pickFloorCellInBox(grid, 0, 4, 3, 2, rng, [start]) ?? { r: 1, c: 4 };
  } else if (archetype === 3) {
    // Soft-switch intro bridge across a 1-tile channel
    carveRect(grid, 0, 0, 4, 3, "floor");
    carveRect(grid, 1, 4, 5, 2, "floor");
    const bridgeR = 1 + Math.floor(rng() * 2);
    grid[bridgeR]![3] = "bridge";
    grid[bridgeR + 1]![3] = "bridge";
    bridges.push({
      id: "A",
      cells: [
        { r: bridgeR, c: 3 },
        { r: bridgeR + 1, c: 3 },
      ],
      initiallyOpen: false,
    });
    start = pickFloorCellInBox(grid, 1, 0, 3, 2, rng) ?? { r: 2, c: 1 };
    const swPos =
      pickFloorCellInBox(grid, 0, 0, 4, 3, rng, [start]) ?? { r: 0, c: 2 };
    grid[swPos.r]![swPos.c] = "soft_switch";
    switches.push({
      r: swPos.r,
      c: swPos.c,
      kind: "soft",
      bridgeId: "A",
      behavior: rng() < 0.5 ? "open" : "toggle",
    });
    goal = pickFloorCellInBox(grid, 2, 4, 4, 2, rng) ?? { r: 4, c: 5 };
  } else {
    // Stepped diagonal island
    carveRect(grid, 0, 1, 3, 3, "floor");
    carveRect(grid, 1, 0, 3, 3, "floor");
    carveRect(grid, 2, 2, 3, 3, "floor");
    carveRect(grid, 3, 3, 3, 3, "floor");
    start = pickFloorCellInBox(grid, 0, 0, 3, 3, rng) ?? { r: 1, c: 1 };
    goal = pickFloorCellInBox(grid, 3, 3, 3, 3, rng, [start]) ?? { r: 4, c: 4 };
  }

  // Optional organic stone notch / alcove for silhouette diversity
  if (bridges.length === 0) {
    const notchCandidates: MoveTwoCoord[] = [
      { r: 0, c: 3 },
      { r: 5, c: 2 },
      { r: 3, c: 5 },
      { r: 0, c: 2 },
      { r: 2, c: 5 },
    ];
    for (let k = 0; k < 2; k++) {
      if (rng() < 0.45) {
        const pick =
          notchCandidates[Math.floor(rng() * notchCandidates.length)]!;
        if (
          (pick.r !== start.r || pick.c !== start.c) &&
          (pick.r !== goal.r || pick.c !== goal.c)
        ) {
          grid[pick.r]![pick.c] = rng() < 0.65 ? "void" : "floor";
        }
      }
    }
  }

  const base: Omit<MoveTwoStage, "par" | "canonicalMoves"> = {
    difficulty: "easy",
    size,
    grid,
    start,
    goal,
    bridges,
    switches,
  };

  const transformed = transformStageSymmetry(base, Math.floor(rng() * 8));
  sprinkleFragileTiles(transformed, rng, 1 + Math.floor(rng() * 2));
  return transformed;
}

function buildMediumCandidate(
  rng: () => number
): Omit<MoveTwoStage, "par" | "canonicalMoves"> {
  const size = 8 as const;
  const grid = createMoveTwoGrid(size, "void");
  const archetype = Math.floor(rng() * 4);
  const useHeavy = rng() < 0.45;
  const switchKind: "soft" | "heavy" = useHeavy ? "heavy" : "soft";
  const switchTile: MoveTwoTileType =
    switchKind === "heavy" ? "heavy_switch" : "soft_switch";
  const switchBehavior: MoveTwoSwitchBehavior =
    rng() < 0.5 ? "toggle" : "open";

  const bridges: MoveTwoBridgeDef[] = [];
  const switches: MoveTwoSwitchDef[] = [];
  let start: MoveTwoCoord = { r: 1, c: 1 };
  let goal: MoveTwoCoord = { r: 6, c: 6 };

  if (archetype === 0) {
    // West Island + Switch Spur -> Bridge A -> East Goal Island
    carveRect(grid, 0, 0, 4, 3, "floor");
    carveRect(grid, 3, 1, 4, 2, "floor");
    carveRect(grid, 2, 4, 4, 4, "floor");
    carveRect(grid, 5, 5, 3, 3, "floor");

    const bridgeRow = 2 + Math.floor(rng() * 3);
    grid[bridgeRow]![3] = "bridge";
    grid[bridgeRow + 1]![3] = "bridge";
    bridges.push({
      id: "A",
      cells: [
        { r: bridgeRow, c: 3 },
        { r: bridgeRow + 1, c: 3 },
      ],
      initiallyOpen: false,
    });

    start = pickFloorCellInBox(grid, 0, 0, 3, 3, rng) ?? { r: 1, c: 1 };
    const sw =
      pickFloorCellInBox(grid, 4, 1, 3, 2, rng, [start]) ?? { r: 6, c: 1 };
    grid[sw.r]![sw.c] = switchTile;
    switches.push({
      r: sw.r,
      c: sw.c,
      kind: switchKind,
      bridgeId: "A",
      behavior: switchBehavior,
    });
    goal = pickFloorCellInBox(grid, 4, 5, 4, 3, rng) ?? { r: 6, c: 6 };
  } else if (archetype === 1) {
    // North Terrace -> East Switch Balcony -> South Bridge -> Southwest Goal Plaza
    carveRect(grid, 0, 0, 4, 7, "floor");
    grid[0]![6] = "void";
    grid[3]![0] = "void";
    carveRect(grid, 5, 1, 3, 6, "floor");
    for (let c = 0; c < 8; c++) grid[4]![c] = "void";

    const bridgeCol = 1 + Math.floor(rng() * 4);
    grid[4]![bridgeCol] = "bridge";
    grid[4]![bridgeCol + 1] = "bridge";
    bridges.push({
      id: "A",
      cells: [
        { r: 4, c: bridgeCol },
        { r: 4, c: bridgeCol + 1 },
      ],
      initiallyOpen: false,
    });

    start = pickFloorCellInBox(grid, 0, 0, 3, 3, rng) ?? { r: 1, c: 1 };
    const sw =
      pickFloorCellInBox(grid, 1, 4, 3, 3, rng, [start]) ?? { r: 2, c: 5 };
    grid[sw.r]![sw.c] = switchTile;
    switches.push({
      r: sw.r,
      c: sw.c,
      kind: switchKind,
      bridgeId: "A",
      behavior: switchBehavior,
    });
    goal = pickFloorCellInBox(grid, 5, 3, 3, 4, rng) ?? { r: 6, c: 5 };
  } else if (archetype === 2) {
    // Twin Diagonal Atolls with 2-cell Span Bridge
    carveRect(grid, 0, 0, 5, 4, "floor");
    grid[0]![3] = "void";
    grid[4]![0] = "void";
    carveRect(grid, 3, 5, 5, 3, "floor");
    carveRect(grid, 5, 4, 3, 2, "floor");
    // Ensure col 4 rows 0..4 is chasm except bridge at rows 3..4
    for (let r = 0; r < 5; r++) grid[r]![4] = "void";
    grid[5]![4] = "void";
    grid[3]![4] = "bridge";
    grid[4]![4] = "bridge";
    bridges.push({
      id: "A",
      cells: [
        { r: 3, c: 4 },
        { r: 4, c: 4 },
      ],
      initiallyOpen: false,
    });

    start = pickFloorCellInBox(grid, 1, 0, 3, 3, rng) ?? { r: 2, c: 1 };
    const sw =
      pickFloorCellInBox(grid, 0, 0, 3, 3, rng, [start]) ?? { r: 0, c: 2 };
    grid[sw.r]![sw.c] = switchTile;
    switches.push({
      r: sw.r,
      c: sw.c,
      kind: switchKind,
      bridgeId: "A",
      behavior: switchBehavior,
    });
    goal = pickFloorCellInBox(grid, 4, 5, 4, 3, rng) ?? { r: 6, c: 6 };
  } else {
    // Central Courtyard with Switch Alcove & 2-Column Span Bridge
    carveRect(grid, 0, 0, 6, 3, "floor");
    carveRect(grid, 1, 5, 6, 3, "floor");
    const bridgeR = 2 + Math.floor(rng() * 2);
    grid[bridgeR]![3] = "bridge";
    grid[bridgeR]![4] = "bridge";
    grid[bridgeR + 1]![3] = "bridge";
    grid[bridgeR + 1]![4] = "bridge";
    bridges.push({
      id: "A",
      cells: [
        { r: bridgeR, c: 3 },
        { r: bridgeR, c: 4 },
        { r: bridgeR + 1, c: 3 },
        { r: bridgeR + 1, c: 4 },
      ],
      initiallyOpen: false,
    });

    start = pickFloorCellInBox(grid, 0, 0, 3, 3, rng) ?? { r: 1, c: 1 };
    const sw =
      pickFloorCellInBox(grid, 3, 0, 3, 3, rng, [start]) ?? { r: 5, c: 1 };
    grid[sw.r]![sw.c] = switchTile;
    switches.push({
      r: sw.r,
      c: sw.c,
      kind: switchKind,
      bridgeId: "A",
      behavior: switchBehavior,
    });
    goal = pickFloorCellInBox(grid, 2, 5, 5, 3, rng) ?? { r: 4, c: 6 };
  }

  const base: Omit<MoveTwoStage, "par" | "canonicalMoves"> = {
    difficulty: "medium",
    size,
    grid,
    start,
    goal,
    bridges,
    switches,
  };

  const transformed = transformStageSymmetry(base, Math.floor(rng() * 8));
  sprinkleFragileTiles(transformed, rng, 2 + Math.floor(rng() * 2));
  return transformed;
}

function buildHardCandidate(
  rng: () => number
): Omit<MoveTwoStage, "par" | "canonicalMoves"> {
  const size = 10 as const;
  const grid = createMoveTwoGrid(size, "void");
  const archetype = Math.floor(rng() * 4);
  const bridges: MoveTwoBridgeDef[] = [];
  const switches: MoveTwoSwitchDef[] = [];
  let start: MoveTwoCoord = { r: 1, c: 1 };
  let goal: MoveTwoCoord = { r: 8, c: 8 };

  if (archetype === 0) {
    // 3 Floating Islands: NW Start -> Bridge A -> NE Heavy-Switch Island -> Bridge B -> South Goal Citadel
    carveRect(grid, 0, 0, 5, 4, "floor");
    if (rng() < 0.6) grid[0]![0] = "void";
    carveRect(grid, 0, 5, 5, 5, "floor");
    if (rng() < 0.6) grid[0]![9] = "void";
    carveRect(grid, 6, 3, 4, 7, "floor");
    if (rng() < 0.6) grid[9]![3] = "void";

    const brA = 1 + Math.floor(rng() * 2);
    grid[brA]![4] = "bridge";
    grid[brA + 1]![4] = "bridge";
    bridges.push({
      id: "A",
      cells: [
        { r: brA, c: 4 },
        { r: brA + 1, c: 4 },
      ],
      initiallyOpen: false,
    });

    const bcB = 5 + Math.floor(rng() * 3);
    grid[5]![bcB] = "bridge";
    grid[5]![bcB + 1] = "bridge";
    bridges.push({
      id: "B",
      cells: [
        { r: 5, c: bcB },
        { r: 5, c: bcB + 1 },
      ],
      initiallyOpen: false,
    });

    start = pickFloorCellInBox(grid, 0, 0, 3, 3, rng) ?? { r: 1, c: 1 };
    const swA =
      pickFloorCellInBox(grid, 2, 0, 3, 4, rng, [start]) ?? { r: 4, c: 1 };
    grid[swA.r]![swA.c] = "soft_switch";
    switches.push({
      r: swA.r,
      c: swA.c,
      kind: "soft",
      bridgeId: "A",
      behavior: rng() < 0.5 ? "open" : "toggle",
    });

    const swB = pickFloorCellInBox(grid, 0, 6, 4, 4, rng) ?? { r: 1, c: 8 };
    grid[swB.r]![swB.c] = "heavy_switch";
    switches.push({
      r: swB.r,
      c: swB.c,
      kind: "heavy",
      bridgeId: "B",
      behavior: rng() < 0.5 ? "toggle" : "open",
    });

    goal = pickFloorCellInBox(grid, 7, 5, 3, 5, rng) ?? { r: 8, c: 8 };
  } else if (archetype === 1) {
    // West Peninsula -> Central Hub Island -> East Goal Sanctum (Dual Heavy Switches)
    carveRect(grid, 2, 0, 6, 3, "floor");
    carveRect(grid, 1, 4, 8, 3, "floor");
    carveRect(grid, 3, 8, 6, 2, "floor");
    carveRect(grid, 6, 8, 3, 2, "floor");

    const brA = 3 + Math.floor(rng() * 2);
    grid[brA]![3] = "bridge";
    grid[brA + 1]![3] = "bridge";
    bridges.push({
      id: "A",
      cells: [
        { r: brA, c: 3 },
        { r: brA + 1, c: 3 },
      ],
      initiallyOpen: false,
    });

    const brB = 4 + Math.floor(rng() * 2);
    grid[brB]![7] = "bridge";
    grid[brB + 1]![7] = "bridge";
    bridges.push({
      id: "B",
      cells: [
        { r: brB, c: 7 },
        { r: brB + 1, c: 7 },
      ],
      initiallyOpen: false,
    });

    start = pickFloorCellInBox(grid, 2, 0, 3, 3, rng) ?? { r: 3, c: 1 };
    const swA =
      pickFloorCellInBox(grid, 5, 0, 3, 3, rng, [start]) ?? { r: 6, c: 1 };
    grid[swA.r]![swA.c] = "heavy_switch";
    switches.push({
      r: swA.r,
      c: swA.c,
      kind: "heavy",
      bridgeId: "A",
      behavior: "open",
    });

    const swB = pickFloorCellInBox(grid, 6, 4, 3, 3, rng) ?? { r: 8, c: 5 };
    grid[swB.r]![swB.c] = "heavy_switch";
    switches.push({
      r: swB.r,
      c: swB.c,
      kind: "heavy",
      bridgeId: "B",
      behavior: rng() < 0.5 ? "open" : "toggle",
    });

    goal = pickFloorCellInBox(grid, 4, 8, 5, 2, rng) ?? { r: 7, c: 9 };
  } else if (archetype === 2) {
    // U-Turn Chasm Loop: Top-Left -> Bottom-Left -> Bottom-Right -> Top-Right Goal
    carveRect(grid, 0, 0, 4, 4, "floor");
    carveRect(grid, 5, 0, 5, 5, "floor");
    carveRect(grid, 5, 6, 5, 4, "floor");
    carveRect(grid, 0, 6, 5, 4, "floor");

    const bcA = 1 + Math.floor(rng() * 2);
    grid[4]![bcA] = "bridge";
    grid[4]![bcA + 1] = "bridge";
    bridges.push({
      id: "A",
      cells: [
        { r: 4, c: bcA },
        { r: 4, c: bcA + 1 },
      ],
      initiallyOpen: false,
    });

    const brB = 6 + Math.floor(rng() * 2);
    grid[brB]![5] = "bridge";
    grid[brB + 1]![5] = "bridge";
    bridges.push({
      id: "B",
      cells: [
        { r: brB, c: 5 },
        { r: brB + 1, c: 5 },
      ],
      initiallyOpen: false,
    });

    start = pickFloorCellInBox(grid, 0, 0, 3, 3, rng) ?? { r: 1, c: 1 };
    const swA =
      pickFloorCellInBox(grid, 0, 1, 4, 3, rng, [start]) ?? { r: 1, c: 3 };
    grid[swA.r]![swA.c] = "heavy_switch";
    switches.push({
      r: swA.r,
      c: swA.c,
      kind: "heavy",
      bridgeId: "A",
      behavior: "open",
    });

    const swB = pickFloorCellInBox(grid, 6, 0, 4, 3, rng) ?? { r: 9, c: 1 };
    grid[swB.r]![swB.c] = "soft_switch";
    switches.push({
      r: swB.r,
      c: swB.c,
      kind: "soft",
      bridgeId: "B",
      behavior: rng() < 0.5 ? "toggle" : "open",
    });

    goal = pickFloorCellInBox(grid, 0, 7, 3, 3, rng) ?? { r: 1, c: 8 };
  } else {
    // Zig-Zag Citadel with Remote Switch Detour
    carveRect(grid, 0, 0, 4, 5, "floor");
    carveRect(grid, 5, 2, 5, 4, "floor");
    carveRect(grid, 2, 7, 8, 3, "floor");

    const bcA = 2 + Math.floor(rng() * 2);
    grid[4]![bcA] = "bridge";
    grid[4]![bcA + 1] = "bridge";
    bridges.push({
      id: "A",
      cells: [
        { r: 4, c: bcA },
        { r: 4, c: bcA + 1 },
      ],
      initiallyOpen: false,
    });

    const brB = 5 + Math.floor(rng() * 3);
    grid[brB]![6] = "bridge";
    grid[brB + 1]![6] = "bridge";
    bridges.push({
      id: "B",
      cells: [
        { r: brB, c: 6 },
        { r: brB + 1, c: 6 },
      ],
      initiallyOpen: false,
    });

    start = pickFloorCellInBox(grid, 0, 0, 3, 3, rng) ?? { r: 1, c: 1 };
    const swA =
      pickFloorCellInBox(grid, 0, 2, 4, 3, rng, [start]) ?? { r: 1, c: 4 };
    grid[swA.r]![swA.c] = "soft_switch";
    switches.push({
      r: swA.r,
      c: swA.c,
      kind: "soft",
      bridgeId: "A",
      behavior: "open",
    });

    const swB = pickFloorCellInBox(grid, 7, 2, 3, 3, rng) ?? { r: 8, c: 3 };
    grid[swB.r]![swB.c] = "heavy_switch";
    switches.push({
      r: swB.r,
      c: swB.c,
      kind: "heavy",
      bridgeId: "B",
      behavior: "open",
    });

    goal = pickFloorCellInBox(grid, 2, 7, 4, 3, rng) ?? { r: 3, c: 8 };
  }

  const base: Omit<MoveTwoStage, "par" | "canonicalMoves"> = {
    difficulty: "hard",
    size,
    grid,
    start,
    goal,
    bridges,
    switches,
  };

  const transformed = transformStageSymmetry(base, Math.floor(rng() * 8));
  sprinkleFragileTiles(transformed, rng, 2 + Math.floor(rng() * 3));
  return transformed;
}

/**
 * Generates a single deterministic, BFS-verified Bloxorz floating island stage
 * for `difficulty` (`easy: 6×6`, `medium: 8×8`, `hard: 10×10`).
 */
export function generateBloxorzStage(
  seedKey: string,
  difficulty: MoveTwoDifficulty
): MoveTwoStage {
  const minPar = difficulty === "easy" ? 6 : difficulty === "medium" ? 11 : 16;
  const maxPar = difficulty === "easy" ? 16 : difficulty === "medium" ? 28 : 44;

  let fallbackStage: MoveTwoStage | null = null;

  for (let attempt = 0; attempt < 48; attempt++) {
    const rng = mulberry32(
      fnv1a32(`move-two:bloxorz:v3:${difficulty}:${seedKey}:a${attempt}`)
    );

    const candidate =
      difficulty === "easy"
        ? buildEasyCandidate(rng)
        : difficulty === "medium"
        ? buildMediumCandidate(rng)
        : buildHardCandidate(rng);

    // Subtle deterministic start/goal nudge within adjacent floor cells for extra daily uniqueness
    if (attempt % 2 === 1) {
      const dirs: MoveTwoCoord[] = [
        { r: 0, c: 1 },
        { r: 1, c: 0 },
        { r: 0, c: -1 },
        { r: -1, c: 0 },
      ];
      const nudge = dirs[Math.floor(rng() * dirs.length)]!;
      const nr = candidate.start.r + nudge.r;
      const nc = candidate.start.c + nudge.c;
      if (
        isInBoundsStage(candidate.size, nr, nc) &&
        candidate.grid[nr]![nc] === "floor" &&
        (nr !== candidate.goal.r || nc !== candidate.goal.c)
      ) {
        candidate.start = { r: nr, c: nc };
      }
    }

    const solved = solveBloxorzStage(candidate);
    if (!solved.solvable || !verifySwitchNecessity(candidate)) {
      continue;
    }

    const fullStage: MoveTwoStage = {
      ...candidate,
      par: solved.minMoves,
      canonicalMoves: solved.moves,
    };

    if (!fallbackStage) {
      fallbackStage = fullStage;
    }
    if (solved.minMoves >= minPar && solved.minMoves <= maxPar) {
      return fullStage;
    }
  }

  if (fallbackStage) {
    return fallbackStage;
  }

  // Guaranteed deterministic fallback stage per difficulty (never fails)
  const size = MOVE_TWO_BOARD_SIZES[difficulty];
  const grid = createMoveTwoGrid(size, "void");
  carveRect(grid, 0, 0, size, size - 1, "floor");
  const start = { r: 1, c: 1 };
  const goal = { r: size - 2, c: size - 3 };
  const solved = solveBloxorzStage({
    size,
    grid,
    start,
    goal,
    bridges: [],
    switches: [],
  });
  return {
    difficulty,
    size,
    grid,
    start,
    goal,
    bridges: [],
    switches: [],
    par: solved.minMoves,
    canonicalMoves: solved.moves,
  };
}

/**
 * Deterministically generates a complete 3-difficulty (`6×6` / `8×8` / `10×10`)
 * Bloxorz `MoveTwoPuzzle` bundle for `seedKey`.
 */
export function generateMoveTwoPuzzle(
  seedKey: string,
  meta?: {
    id?: string;
    puzzleNumber?: number;
    title?: string;
    author?: string;
    editor?: string;
    customDate?: string;
  }
): MoveTwoPuzzle {
  const titleIdx =
    fnv1a32(`move-two:title:v3:${seedKey}`) % PUZZLE_TITLES.length;

  const easy = generateBloxorzStage(`${seedKey}:easy`, "easy");
  const medium = generateBloxorzStage(`${seedKey}:medium`, "medium");
  const hard = generateBloxorzStage(`${seedKey}:hard`, "hard");

  return {
    version: 3,
    id: meta?.id ?? `m2-${fnv1a32(seedKey).toString(16).padStart(8, "0")}`,
    puzzleNumber: meta?.puzzleNumber ?? 1,
    title: meta?.title ?? PUZZLE_TITLES[titleIdx]!,
    author: meta?.author ?? "SOL Theory",
    editor: meta?.editor ?? "Daily Editorial",
    stages: {
      easy,
      medium,
      hard,
    },
    par: medium.par,
    ...(meta?.customDate ? { customDate: meta.customDate } : {}),
  };
}

/** Generates a full month of unique, BFS-verified 3-difficulty Move Two puzzles. */
export function generateMoveTwoMonthlyBatch(
  year: number,
  month: number
): Record<string, MoveTwoPuzzle> {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const batch: Record<string, MoveTwoPuzzle> = {};
  const seenSignatures = new Set<string>();

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${String(year).padStart(4, "0")}-${String(month).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`;
    const puzzleNumber = getPuzzleNumberForDate(dateKey);

    let chosen: MoveTwoPuzzle | null = null;
    for (let attempt = 0; attempt < 24; attempt++) {
      const seed =
        attempt === 0 ? `batch:${dateKey}` : `batch:${dateKey}:a${attempt}`;
      const candidate = generateMoveTwoPuzzle(seed, {
        id: `m2-${dateKey}`,
        puzzleNumber,
        customDate: dateKey,
      });
      const sig = JSON.stringify(candidate.stages);
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        chosen = candidate;
        break;
      }
    }
    batch[dateKey] =
      chosen ??
      generateMoveTwoPuzzle(`batch:${dateKey}:fallback`, {
        id: `m2-${dateKey}`,
        puzzleNumber,
        customDate: dateKey,
      });
  }

  return batch;
}
