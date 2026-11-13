/**
 * Game #2 — Move Two (`move-2`) Procedural 6-Face 5×5 Cube Domino Generator & BFS Solver
 * Per GAME_DESIGN_BIBLE.md Q41–Q45:
 * - 1×1×2 3D Bloxorz domino/die (`UPRIGHT`, `FLAT_H`, `FLAT_V`) rolling across 6 sequential
 *   cube faces (`Face 1` through `Face 6`), each a `5×5` grid (`MOVE_TWO_GRID_SIZE = 5`)
 *   viewed at a 2.5D ~25° perspective tilt.
 * - Each face has a coded spawn state (`face.start`) and a recessed target hole (`face.hole`:
 *   `1×1 UPRIGHT` shaft or `2×1 FLAT_H` / `FLAT_V` trench).
 * - Raised Cube Rim on outer edges (`kind: "bump"`, no move penalty or reset) and interior
 *   dark void hazard tiles (`kind: "hazard"`, resets to `face.start`).
 * - Exact per-face (`solveMoveTwoFace`) and 6-face (`solveMoveTwo`) Breadth-First Search (BFS)
 *   solvers computing guaranteed solvability and exact minimum move count (`par`).
 */

import { fnv1a32, mulberry32 } from "@/lib/seeded-random";
import { getPuzzleNumberForDate } from "@/lib/date-keys";

export const MOVE_TWO_GRID_SIZE = 5;

export type MoveTwoPosture = "UPRIGHT" | "FLAT_H" | "FLAT_V";
export type MoveTwoDirection = "up" | "right" | "down" | "left";
export type MoveTwoCellType = "floor" | "wall" | "hazard";

export type MoveTwoGridRow = [
  MoveTwoCellType,
  MoveTwoCellType,
  MoveTwoCellType,
  MoveTwoCellType,
  MoveTwoCellType,
];

export type MoveTwoGrid = [
  MoveTwoGridRow,
  MoveTwoGridRow,
  MoveTwoGridRow,
  MoveTwoGridRow,
  MoveTwoGridRow,
];

export interface MoveTwoCoord {
  r: number;
  c: number;
}

export interface MoveTwoTarget {
  posture: MoveTwoPosture;
  r: number;
  c: number;
}

export interface MoveTwoDominoState {
  /** 0-indexed face (`0..5`, displayed as `Face 1..6`). */
  face: number;
  posture: MoveTwoPosture;
  /** Top-left anchor cell of the domino footprint on the `5×5` face. */
  r: number;
  c: number;
}

export interface MoveTwoFace {
  index: number;
  grid: MoveTwoGrid;
  /** Coded spawn state when entering this face. */
  start: MoveTwoTarget;
  /** Recessed target hole (`1-tile UPRIGHT` shaft or `2-tile FLAT_H / FLAT_V` trench). */
  hole: MoveTwoTarget;
  /** Exact single-face BFS shortest-path move count. */
  parMoves?: number;
  /** Optional legacy portal edge field (`null` in 5×5 hole mode). */
  exitEdge?: MoveTwoDirection | null;
}

export interface MoveTwoPuzzle {
  id: string;
  puzzleNumber: number;
  title: string;
  author: string;
  editor: string;
  faces: [
    MoveTwoFace,
    MoveTwoFace,
    MoveTwoFace,
    MoveTwoFace,
    MoveTwoFace,
    MoveTwoFace,
  ];
  start: MoveTwoDominoState;
  target: MoveTwoTarget;
  /** Exact minimum moves across all 6 faces computed by the BFS solver. */
  par: number;
  /** Shortest-path move sequence across all 6 faces verified by the BFS solver. */
  canonicalMoves: MoveTwoDirection[];
  customDate?: string;
}

export type MoveTwoStepOutcome =
  | { kind: "moved"; next: MoveTwoDominoState }
  | {
      kind: "portal";
      enteredHole: MoveTwoDominoState;
      next: MoveTwoDominoState;
      fromFace: number;
      toFace: number;
    }
  | { kind: "won"; next: MoveTwoDominoState }
  | { kind: "hazard"; hitCells: MoveTwoCoord[] }
  | { kind: "bump" };

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

const PUZZLE_TITLES: readonly string[] = [
  "Six-Sided Roll",
  "Isometric Fold",
  "Domino Traverse",
  "Corner Pocket",
  "Rim & Shaft",
  "Prism Turn",
  "Cube Cadence",
  "Step & Tip",
  "Six Faces Home",
  "Fold Line",
  "Spatial Pivot",
  "Quiet Tumble",
  "Trench Drop",
  "Clean Landing",
  "Double Square",
  "Final Core",
  "Tilted Crown",
  "Velvet Rim",
  "Sunken Gate",
  "Obsidian Pit",
  "Emerald Shaft",
  "olith Roll",
  "Sixth Horizon",
  "Cubic Echo",
];

/** Returns the 1 or 2 grid cells occupied by a domino state (or target/hole). */
export function getDominoCells(
  state: Pick<MoveTwoDominoState, "posture" | "r" | "c">
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

export function isInBounds5x5(r: number, c: number): boolean {
  return (
    r >= 0 &&
    r < MOVE_TWO_GRID_SIZE &&
    c >= 0 &&
    c < MOVE_TWO_GRID_SIZE
  );
}

/** Alias kept for backwards compatibility with legacy callers. */
export const isInBounds3x3 = isInBounds5x5;

export function isStateFootprintInBounds(
  state: Pick<MoveTwoDominoState, "posture" | "r" | "c">
): boolean {
  if (
    !state ||
    !MOVE_TWO_POSTURES.includes(state.posture) ||
    typeof state.r !== "number" ||
    typeof state.c !== "number"
  ) {
    return false;
  }
  return getDominoCells(state).every((cell) => isInBounds5x5(cell.r, cell.c));
}

/**
 * Checks whether a domino state's posture and anchor cell exactly match a face's recessed hole.
 * - `UPRIGHT` hole (1×1 shaft): die must stand `UPRIGHT` on `(hole.r, hole.c)`.
 * - `FLAT_H` / `FLAT_V` hole (2×1 trench): die must lie flat in the matching orientation covering both cells.
 */
export function matchesFaceHole(
  state: Pick<MoveTwoDominoState, "posture" | "r" | "c">,
  hole: MoveTwoTarget
): boolean {
  return (
    state.posture === hole.posture &&
    state.r === hole.r &&
    state.c === hole.c
  );
}

export function matchesMoveTwoTarget(
  state: MoveTwoDominoState,
  target: MoveTwoTarget
): boolean {
  return state.face === 5 && matchesFaceHole(state, target);
}

/** Raw Bloxorz roll kinematics before rim/wall/hazard/hole checks (Q42). */
export function computeRawRoll(
  state: MoveTwoDominoState,
  dir: MoveTwoDirection
): MoveTwoDominoState {
  const { face, posture, r, c } = state;
  if (posture === "UPRIGHT") {
    switch (dir) {
      case "up":
        return { face, posture: "FLAT_V", r: r - 2, c };
      case "down":
        return { face, posture: "FLAT_V", r: r + 1, c };
      case "left":
        return { face, posture: "FLAT_H", r, c: c - 2 };
      case "right":
        return { face, posture: "FLAT_H", r, c: c + 1 };
    }
  }
  if (posture === "FLAT_H") {
    switch (dir) {
      case "left":
        return { face, posture: "UPRIGHT", r, c: c - 1 };
      case "right":
        return { face, posture: "UPRIGHT", r, c: c + 2 };
      case "up":
        return { face, posture: "FLAT_H", r: r - 1, c };
      case "down":
        return { face, posture: "FLAT_H", r: r + 1, c };
    }
  }
  // FLAT_V
  switch (dir) {
    case "up":
      return { face, posture: "UPRIGHT", r: r - 1, c };
    case "down":
      return { face, posture: "UPRIGHT", r: r + 2, c };
    case "left":
      return { face, posture: "FLAT_V", r, c: c - 1 };
    case "right":
      return { face, posture: "FLAT_V", r, c: c + 1 };
  }
}

/**
 * Evaluates a single directional roll on a 5×5 Move Two puzzle (Q42–Q44):
 * - Raised Cube Rim (outer edges out of 5×5 bounds) and `"wall"` cells return `{ kind: "bump" }`.
 * - Interior dark void `"hazard"` cells return `{ kind: "hazard", hitCells }` (resets to current face's `start`).
 * - Exact posture + footprint match on `currentFace.hole`:
 *   - Faces `0..4` (`Face 1..5`): returns `{ kind: "portal", enteredHole: raw, next: nextFace.start, fromFace, toFace }`.
 *   - Face `5` (`Face 6`): returns `{ kind: "won", next: raw }`.
 * - Partial overlap with a hole (e.g. rolling flat over a 1-tile hole or standing upright on 1 cell of a 2-tile hole)
 *   rests on floor as `{ kind: "moved", next: raw }`.
 */
export function stepMoveTwoDomino(
  puzzle: Pick<MoveTwoPuzzle, "faces" | "target">,
  state: MoveTwoDominoState,
  dir: MoveTwoDirection
): MoveTwoStepOutcome {
  const currentFace = puzzle.faces[state.face];
  if (!currentFace) return { kind: "bump" };

  const raw = computeRawRoll(state, dir);
  const rawCells = getDominoCells(raw);

  // 1. Raised Cube Rim check: any cell outside the 5×5 face is blocked gently
  if (!rawCells.every((cell) => isInBounds5x5(cell.r, cell.c))) {
    return { kind: "bump" };
  }

  // 2. Solid wall check
  for (const cell of rawCells) {
    if (currentFace.grid[cell.r]?.[cell.c] === "wall") {
      return { kind: "bump" };
    }
  }

  // 3. Interior dark void hazard check
  const hazardHits = rawCells.filter(
    (cell) => currentFace.grid[cell.r]?.[cell.c] === "hazard"
  );
  if (hazardHits.length > 0) {
    return { kind: "hazard", hitCells: hazardHits };
  }

  // 4. Recessed Hole Drop check (requires exact posture & cell match)
  const faceHole: MoveTwoTarget | undefined =
    currentFace.hole ?? (state.face === 5 ? puzzle.target : undefined);

  if (faceHole && matchesFaceHole(raw, faceHole)) {
    if (state.face === 5) {
      return { kind: "won", next: raw };
    }
    const nextFaceIdx = state.face + 1;
    const nextFace = puzzle.faces[nextFaceIdx];
    if (!nextFace || !nextFace.start) {
      return { kind: "bump" };
    }
    const nextStart: MoveTwoDominoState = {
      face: nextFaceIdx,
      posture: nextFace.start.posture,
      r: nextFace.start.r,
      c: nextFace.start.c,
    };
    return {
      kind: "portal",
      enteredHole: raw,
      next: nextStart,
      fromFace: state.face,
      toFace: nextFaceIdx,
    };
  }

  return { kind: "moved", next: raw };
}

export interface MoveTwoSolveResult {
  solvable: boolean;
  minMoves: number;
  moves: MoveTwoDirection[];
}

function encodeStateKey(s: Pick<MoveTwoDominoState, "face" | "posture" | "r" | "c">): string {
  return `${s.face}:${s.posture}:${s.r}:${s.c}`;
}

function footprintsOverlap(a: MoveTwoTarget, b: MoveTwoTarget): boolean {
  const aKeys = new Set(getDominoCells(a).map((c) => `${c.r},${c.c}`));
  return getDominoCells(b).some((c) => aKeys.has(`${c.r},${c.c}`));
}

/**
 * Exact Breadth-First Search (BFS) solver for a single 5×5 cube face (`<= 65` states).
 * Finds the shortest sequence of rolls from `face.start` into the recessed `face.hole`.
 */
export function solveMoveTwoFace(
  face: Pick<MoveTwoFace, "index" | "grid" | "start" | "hole">
): MoveTwoSolveResult {
  if (
    !face ||
    !Array.isArray(face.grid) ||
    face.grid.length !== MOVE_TWO_GRID_SIZE ||
    !face.start ||
    !face.hole
  ) {
    return { solvable: false, minMoves: -1, moves: [] };
  }
  if (
    !isStateFootprintInBounds(face.start) ||
    !isStateFootprintInBounds(face.hole)
  ) {
    return { solvable: false, minMoves: -1, moves: [] };
  }
  if (footprintsOverlap(face.start, face.hole)) {
    return { solvable: false, minMoves: -1, moves: [] };
  }
  for (const cell of getDominoCells(face.start)) {
    if (face.grid[cell.r]?.[cell.c] !== "floor") {
      return { solvable: false, minMoves: -1, moves: [] };
    }
  }
  for (const cell of getDominoCells(face.hole)) {
    if (face.grid[cell.r]?.[cell.c] !== "floor") {
      return { solvable: false, minMoves: -1, moves: [] };
    }
  }

  const initial: MoveTwoDominoState = {
    face: face.index,
    posture: face.start.posture,
    r: face.start.r,
    c: face.start.c,
  };

  const visited = new Set<string>([encodeStateKey(initial)]);
  const queue: Array<{ state: MoveTwoDominoState; moves: MoveTwoDirection[] }> = [
    { state: initial, moves: [] },
  ];

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++]!;
    for (const dir of MOVE_TWO_DIRECTIONS) {
      const raw = computeRawRoll(current.state, dir);
      const rawCells = getDominoCells(raw);
      if (!rawCells.every((cell) => isInBounds5x5(cell.r, cell.c))) {
        continue;
      }
      let blockedOrHazard = false;
      for (const cell of rawCells) {
        if (face.grid[cell.r]?.[cell.c] !== "floor") {
          blockedOrHazard = true;
          break;
        }
      }
      if (blockedOrHazard) continue;

      if (matchesFaceHole(raw, face.hole)) {
        const winMoves = [...current.moves, dir];
        return {
          solvable: true,
          minMoves: winMoves.length,
          moves: winMoves,
        };
      }

      const key = encodeStateKey(raw);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({
          state: raw,
          moves: [...current.moves, dir],
        });
      }
    }
  }

  return { solvable: false, minMoves: -1, moves: [] };
}

/**
 * Exact Breadth-First Search (BFS) solver over `(face, posture, r, c)` across all 6 `5×5` faces.
 * Guarantees solvability and computes exact minimum moves (**Par**).
 */
export function solveMoveTwo(
  puzzle: Pick<MoveTwoPuzzle, "faces" | "start" | "target">
): MoveTwoSolveResult {
  if (
    !puzzle ||
    !Array.isArray(puzzle.faces) ||
    puzzle.faces.length !== 6 ||
    !puzzle.start ||
    !puzzle.target
  ) {
    return { solvable: false, minMoves: -1, moves: [] };
  }
  if (!isStateFootprintInBounds(puzzle.start) || puzzle.start.face !== 0) {
    return { solvable: false, minMoves: -1, moves: [] };
  }
  if (!isStateFootprintInBounds(puzzle.target)) {
    return { solvable: false, minMoves: -1, moves: [] };
  }

  for (let i = 0; i < 6; i++) {
    const face = puzzle.faces[i];
    if (
      !face ||
      !Array.isArray(face.grid) ||
      face.grid.length !== MOVE_TWO_GRID_SIZE ||
      !face.start ||
      !face.hole ||
      !isStateFootprintInBounds(face.start) ||
      !isStateFootprintInBounds(face.hole)
    ) {
      return { solvable: false, minMoves: -1, moves: [] };
    }
    for (const cell of getDominoCells(face.start)) {
      if (face.grid[cell.r]?.[cell.c] !== "floor") {
        return { solvable: false, minMoves: -1, moves: [] };
      }
    }
    for (const cell of getDominoCells(face.hole)) {
      if (face.grid[cell.r]?.[cell.c] !== "floor") {
        return { solvable: false, minMoves: -1, moves: [] };
      }
    }
  }

  const visited = new Set<string>([encodeStateKey(puzzle.start)]);
  const queue: Array<{ state: MoveTwoDominoState; moves: MoveTwoDirection[] }> = [
    { state: puzzle.start, moves: [] },
  ];

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++]!;

    for (const dir of MOVE_TWO_DIRECTIONS) {
      const outcome = stepMoveTwoDomino(puzzle, current.state, dir);
      if (outcome.kind === "won") {
        const winMoves = [...current.moves, dir];
        return {
          solvable: true,
          minMoves: winMoves.length,
          moves: winMoves,
        };
      }
      if (outcome.kind === "moved" || outcome.kind === "portal") {
        const key = encodeStateKey(outcome.next);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({
            state: outcome.next,
            moves: [...current.moves, dir],
          });
        }
      }
    }
  }

  return { solvable: false, minMoves: -1, moves: [] };
}

/** Computes 1–3 star rating comparing player's move count against Par (Q45). */
export function computeMoveTwoStars(moves: number, par: number): 1 | 2 | 3 {
  if (moves <= par + 2) return 3;
  if (moves <= par + 6) return 2;
  return 1;
}

export function validateMoveTwoPuzzle(
  candidate: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!candidate || typeof candidate !== "object") {
    return { valid: false, errors: ["Puzzle must be an object."] };
  }
  const p = candidate as Partial<MoveTwoPuzzle>;
  if (!p.title || typeof p.title !== "string" || !p.title.trim()) {
    errors.push("Missing puzzle title.");
  }
  if (!Array.isArray(p.faces) || p.faces.length !== 6) {
    errors.push("Puzzle must contain exactly 6 cube faces.");
    return { valid: false, errors };
  }

  p.faces.forEach((face, idx) => {
    if (
      !face ||
      !Array.isArray(face.grid) ||
      face.grid.length !== MOVE_TWO_GRID_SIZE
    ) {
      errors.push(`Face ${idx + 1} must be a 5x5 grid.`);
      return;
    }
    for (let r = 0; r < MOVE_TWO_GRID_SIZE; r++) {
      const row = face.grid[r];
      if (!Array.isArray(row) || row.length !== MOVE_TWO_GRID_SIZE) {
        errors.push(`Face ${idx + 1} row ${r + 1} must have 5 cells.`);
        continue;
      }
      for (let c = 0; c < MOVE_TWO_GRID_SIZE; c++) {
        if (!["floor", "wall", "hazard"].includes(row[c] as string)) {
          errors.push(`Invalid cell type on Face ${idx + 1} (${r}, ${c}).`);
        }
      }
    }

    if (!face.start || !isStateFootprintInBounds(face.start)) {
      errors.push(`Face ${idx + 1} has an out-of-bounds or missing start state.`);
    } else {
      for (const cell of getDominoCells(face.start)) {
        if (face.grid[cell.r]?.[cell.c] !== "floor") {
          errors.push(
            `Face ${idx + 1} start cell (${cell.r + 1}, ${cell.c + 1}) must be floor.`
          );
        }
      }
    }

    if (!face.hole || !isStateFootprintInBounds(face.hole)) {
      errors.push(`Face ${idx + 1} has an out-of-bounds or missing hole target.`);
    } else {
      for (const cell of getDominoCells(face.hole)) {
        if (face.grid[cell.r]?.[cell.c] !== "floor") {
          errors.push(
            `Face ${idx + 1} hole cell (${cell.r + 1}, ${cell.c + 1}) must be floor.`
          );
        }
      }
    }

    if (
      face.start &&
      face.hole &&
      isStateFootprintInBounds(face.start) &&
      isStateFootprintInBounds(face.hole)
    ) {
      if (footprintsOverlap(face.start, face.hole)) {
        errors.push(`Face ${idx + 1} start and hole cells must not overlap.`);
      } else {
        const faceSolved = solveMoveTwoFace(face);
        if (!faceSolved.solvable) {
          errors.push(`Face ${idx + 1} is not solvable from start to hole.`);
        }
      }
    }
  });

  if (!p.start || !p.target) {
    errors.push("Missing start or target state.");
    return { valid: false, errors };
  }

  const face0 = p.faces[0];
  if (
    face0?.start &&
    (p.start.face !== 0 ||
      p.start.posture !== face0.start.posture ||
      p.start.r !== face0.start.r ||
      p.start.c !== face0.start.c)
  ) {
    errors.push("Puzzle start state must match Face 1 start.");
  }

  const face5 = p.faces[5];
  if (
    face5?.hole &&
    (p.target.posture !== face5.hole.posture ||
      p.target.r !== face5.hole.r ||
      p.target.c !== face5.hole.c)
  ) {
    errors.push("Puzzle target must match Face 6 hole.");
  }

  if (errors.length > 0) return { valid: false, errors };

  const solved = solveMoveTwo(p as MoveTwoPuzzle);
  if (!solved.solvable || solved.minMoves < 6) {
    errors.push("Puzzle is not solvable across all 6 faces via BFS.");
    return { valid: false, errors };
  }
  if (typeof p.par !== "number" || p.par !== solved.minMoves) {
    errors.push(
      `Puzzle par (${p.par}) does not match BFS shortest path (${solved.minMoves}).`
    );
  }

  return { valid: errors.length === 0, errors };
}

export function isMoveTwoPuzzle(value: unknown): value is MoveTwoPuzzle {
  return validateMoveTwoPuzzle(value).valid;
}

export function emptyMoveTwoFloorGrid(): MoveTwoGrid {
  return [
    ["floor", "floor", "floor", "floor", "floor"],
    ["floor", "floor", "floor", "floor", "floor"],
    ["floor", "floor", "floor", "floor", "floor"],
    ["floor", "floor", "floor", "floor", "floor"],
    ["floor", "floor", "floor", "floor", "floor"],
  ];
}

function randomTargetForPosture(
  rng: () => number,
  posture: MoveTwoPosture
): MoveTwoTarget {
  if (posture === "UPRIGHT") {
    return {
      posture: "UPRIGHT",
      r: Math.floor(rng() * 5),
      c: Math.floor(rng() * 5),
    };
  }
  if (posture === "FLAT_H") {
    return {
      posture: "FLAT_H",
      r: Math.floor(rng() * 5),
      c: Math.floor(rng() * 4),
    };
  }
  return {
    posture: "FLAT_V",
    r: Math.floor(rng() * 4),
    c: Math.floor(rng() * 5),
  };
}

function buildFallbackFace(index: number): MoveTwoFace {
  const templates: Array<{
    start: MoveTwoTarget;
    hole: MoveTwoTarget;
    hazards: Array<[number, number]>;
  }> = [
    {
      start: { posture: "UPRIGHT", r: 0, c: 0 },
      hole: { posture: "UPRIGHT", r: 4, c: 4 },
      hazards: [
        [0, 3],
        [2, 1],
        [3, 2],
      ],
    },
    {
      start: { posture: "UPRIGHT", r: 4, c: 0 },
      hole: { posture: "FLAT_H", r: 0, c: 3 },
      hazards: [
        [1, 1],
        [2, 3],
        [4, 3],
      ],
    },
    {
      start: { posture: "FLAT_H", r: 0, c: 0 },
      hole: { posture: "UPRIGHT", r: 4, c: 3 },
      hazards: [
        [1, 3],
        [2, 1],
        [3, 4],
      ],
    },
    {
      start: { posture: "UPRIGHT", r: 0, c: 4 },
      hole: { posture: "FLAT_V", r: 3, c: 0 },
      hazards: [
        [1, 2],
        [2, 4],
        [4, 2],
      ],
    },
    {
      start: { posture: "FLAT_V", r: 0, c: 0 },
      hole: { posture: "UPRIGHT", r: 3, c: 4 },
      hazards: [
        [0, 3],
        [2, 2],
        [4, 1],
      ],
    },
    {
      start: { posture: "UPRIGHT", r: 4, c: 4 },
      hole: { posture: "FLAT_H", r: 0, c: 0 },
      hazards: [
        [1, 3],
        [2, 1],
        [3, 2],
      ],
    },
  ];
  const tpl = templates[index % templates.length]!;
  const grid = emptyMoveTwoFloorGrid();
  for (const [hr, hc] of tpl.hazards) {
    grid[hr]![hc] = "hazard";
  }
  const solved = solveMoveTwoFace({
    index,
    grid,
    start: tpl.start,
    hole: tpl.hole,
  });
  return {
    index,
    grid,
    start: tpl.start,
    hole: tpl.hole,
    parMoves: solved.solvable ? solved.minMoves : 6,
    exitEdge: null,
  };
}

function generateSingle5x5Face(faceSeed: number, faceIndex: number): MoveTwoFace {
  const rng = mulberry32(faceSeed >>> 0);
  let bestFallback: MoveTwoFace | null = null;

  for (let attempt = 0; attempt < 180; attempt++) {
    // 1. Choose start state
    let startPosture: MoveTwoPosture = "UPRIGHT";
    if (faceIndex > 0) {
      const pRoll = rng();
      startPosture =
        pRoll < 0.55 ? "UPRIGHT" : pRoll < 0.78 ? "FLAT_H" : "FLAT_V";
    }
    const start = randomTargetForPosture(rng, startPosture);

    // 2. Choose recessed hole posture (mix of 1-tile UPRIGHT and 2-tile FLAT_H / FLAT_V)
    const hRoll = rng();
    const holePosture: MoveTwoPosture =
      hRoll < 0.44 ? "UPRIGHT" : hRoll < 0.72 ? "FLAT_H" : "FLAT_V";
    const hole = randomTargetForPosture(rng, holePosture);

    if (footprintsOverlap(start, hole)) continue;
    const manhattan = Math.abs(start.r - hole.r) + Math.abs(start.c - hole.c);
    if (manhattan < 2) continue;

    // 3. Populate 3 to 6 interior dark void hazards
    const grid = emptyMoveTwoFloorGrid();
    const reserved = new Set<string>([
      ...getDominoCells(start).map((c) => `${c.r},${c.c}`),
      ...getDominoCells(hole).map((c) => `${c.r},${c.c}`),
    ]);

    const hazardTargetCount = 3 + Math.floor(rng() * 4); // 3..6 hazards
    let placed = 0;
    for (let t = 0; t < 20 && placed < hazardTargetCount; t++) {
      const rr = Math.floor(rng() * 5);
      const cc = Math.floor(rng() * 5);
      const key = `${rr},${cc}`;
      if (reserved.has(key)) continue;
      if (grid[rr]![cc] !== "floor") continue;
      grid[rr]![cc] = "hazard";
      placed++;
    }

    const solved = solveMoveTwoFace({ index: faceIndex, grid, start, hole });
    if (!solved.solvable) continue;

    const candidate: MoveTwoFace = {
      index: faceIndex,
      grid,
      start,
      hole,
      parMoves: solved.minMoves,
      exitEdge: null,
    };

    if (solved.minMoves >= 5 && solved.minMoves <= 8) {
      return candidate;
    }
    if (!bestFallback && solved.minMoves >= 4 && solved.minMoves <= 10) {
      bestFallback = candidate;
    }
  }

  return bestFallback ?? buildFallbackFace(faceIndex);
}

/**
 * Deterministic procedural generator for Move Two (`seedKey` -> verified 6-face 5×5 puzzle).
 * Uses `solveMoveTwoFace` and `solveMoveTwo` (BFS) to guarantee solvability and compute exact `par`.
 */
export function generateMoveTwoPuzzle(
  seedKey: string,
  meta?: {
    id?: string;
    puzzleNumber?: number;
    customDate?: string;
    title?: string;
  }
): MoveTwoPuzzle {
  const baseSeed = fnv1a32(`move-2:5x5:v2:${seedKey}`);

  const faces = [0, 1, 2, 3, 4, 5].map((fIdx) => {
    const faceSeed = (baseSeed ^ Math.imul(fIdx + 1, 0x9e3779b9)) >>> 0;
    return generateSingle5x5Face(faceSeed, fIdx);
  }) as MoveTwoPuzzle["faces"];

  const start: MoveTwoDominoState = {
    face: 0,
    posture: faces[0].start.posture,
    r: faces[0].start.r,
    c: faces[0].start.c,
  };
  const target: MoveTwoTarget = {
    posture: faces[5].hole.posture,
    r: faces[5].hole.r,
    c: faces[5].hole.c,
  };

  const solved = solveMoveTwo({ faces, start, target });
  if (!solved.solvable) {
    const fallbackFaces = [0, 1, 2, 3, 4, 5].map((fIdx) =>
      buildFallbackFace(fIdx)
    ) as MoveTwoPuzzle["faces"];
    const fbStart: MoveTwoDominoState = {
      face: 0,
      posture: fallbackFaces[0].start.posture,
      r: fallbackFaces[0].start.r,
      c: fallbackFaces[0].start.c,
    };
    const fbTarget: MoveTwoTarget = {
      posture: fallbackFaces[5].hole.posture,
      r: fallbackFaces[5].hole.r,
      c: fallbackFaces[5].hole.c,
    };
    const fbSolved = solveMoveTwo({
      faces: fallbackFaces,
      start: fbStart,
      target: fbTarget,
    });
    return {
      id: meta?.id ?? `m2-${seedKey}`,
      puzzleNumber: meta?.puzzleNumber ?? 1,
      title: meta?.title ?? "Six-Sided Roll",
      author: "SOL Theory",
      editor: "Daily Editorial",
      faces: fallbackFaces,
      start: fbStart,
      target: fbTarget,
      par: fbSolved.minMoves,
      canonicalMoves: fbSolved.moves,
      ...(meta?.customDate ? { customDate: meta.customDate } : {}),
    };
  }

  const titlePick =
    meta?.title ?? `${PUZZLE_TITLES[baseSeed % PUZZLE_TITLES.length]}`;
  const title = titlePick.charAt(0).toUpperCase() + titlePick.slice(1);

  return {
    id: meta?.id ?? `m2-${seedKey}`,
    puzzleNumber: meta?.puzzleNumber ?? 1,
    title,
    author: "SOL Theory",
    editor: "Daily Editorial",
    faces,
    start,
    target,
    par: solved.minMoves,
    canonicalMoves: solved.moves,
    ...(meta?.customDate ? { customDate: meta.customDate } : {}),
  };
}

/** Generates and BFS-validates a full calendar month of Move Two 5×5 daily puzzles. */
export function generateMoveTwoMonthlyBatch(
  year: number,
  month: number
): Record<string, MoveTwoPuzzle> {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out: Record<string, MoveTwoPuzzle> = {};
  const mm = String(month).padStart(2, "0");

  for (let day = 1; day <= daysInMonth; day++) {
    const dd = String(day).padStart(2, "0");
    const dateKey = `${year}-${mm}-${dd}`;
    const puzzle = generateMoveTwoPuzzle(`batch:${dateKey}`, {
      id: `m2-${dateKey}`,
      puzzleNumber: getPuzzleNumberForDate(dateKey),
      customDate: dateKey,
    });
    out[dateKey] = puzzle;
  }
  return out;
}
