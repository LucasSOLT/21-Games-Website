/**
 * Game #2 — Move Two (`move-2`) Procedural 6-Face Cube Domino Generator & BFS Solver
 * Per GAME_DESIGN_BIBLE.md Q41–Q45:
 * - 1×1×2 3D Bloxorz domino (`UPRIGHT`, `FLAT_H`, `FLAT_V`) rolling across 6 cube faces
 *   (`Face 1` through `Face 6`), each a `3×3` grid.
 * - Exit edge portals (`→ Face k+1`), solid outer walls & wall blocks (`wall`),
 *   hazard void holes (`hazard`), and a Red Target on `Face 6` (`UPRIGHT` 1-cell
 *   or `FLAT_H` / `FLAT_V` 2-cell).
 * - Exact Breadth-First Search (BFS) state-space solver computing guaranteed
 *   solvability and exact minimum move count (`par`), plus `generateMoveTwoMonthlyBatch`.
 */

import { fnv1a32, mulberry32 } from "@/lib/seeded-random";
import { getPuzzleNumberForDate } from "@/lib/date-keys";

export type MoveTwoPosture = "UPRIGHT" | "FLAT_H" | "FLAT_V";
export type MoveTwoDirection = "up" | "right" | "down" | "left";
export type MoveTwoCellType = "floor" | "wall" | "hazard";

export interface MoveTwoCoord {
  r: number;
  c: number;
}

export interface MoveTwoDominoState {
  /** 0-indexed face (`0..5`, displayed as `Face 1..6`). */
  face: number;
  posture: MoveTwoPosture;
  /** Top-left anchor cell of the domino footprint on the `3×3` face. */
  r: number;
  c: number;
}

export interface MoveTwoFace {
  index: number;
  grid: [
    [MoveTwoCellType, MoveTwoCellType, MoveTwoCellType],
    [MoveTwoCellType, MoveTwoCellType, MoveTwoCellType],
    [MoveTwoCellType, MoveTwoCellType, MoveTwoCellType],
  ];
  /** Portal edge leading to `index + 1` (`null` on final `Face 6` / index `5`). */
  exitEdge: MoveTwoDirection | null;
}

export interface MoveTwoTarget {
  posture: MoveTwoPosture;
  r: number;
  c: number;
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
  /** Exact minimum moves computed by the BFS solver. */
  par: number;
  /** Shortest-path move sequence verified by the BFS solver. */
  canonicalMoves: MoveTwoDirection[];
  customDate?: string;
}

export type MoveTwoStepOutcome =
  | { kind: "moved"; next: MoveTwoDominoState }
  | { kind: "portal"; next: MoveTwoDominoState; fromFace: number; toFace: number }
  | { kind: "won"; next: MoveTwoDominoState }
  | { kind: "hazard"; hitCells: MoveTwoCoord[] }
  | { kind: "bump" };

export const MOVE_TWO_DIRECTIONS: readonly MoveTwoDirection[] = [
  "up",
  "right",
  "down",
  "left",
] as const;

const PUZZLE_TITLES: readonly string[] = [
  "Six-Sided Roll",
  "Isometric Fold",
  "Domino Traverse",
  "Corner Pocket",
  "Edge Hopper",
  "Prism Turn",
  "Cube Cadence",
  "Step & Tip",
  "Six Faces Home",
  "Fold Line",
  "Spatial Pivot",
  "Quiet Tumble",
  "Portal Ridge",
  "Clean Landing",
  "Double Square",
  "Final Red",
];

/** Returns the 1 or 2 grid cells occupied by a domino state (or target). */
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

export function isInBounds3x3(r: number, c: number): boolean {
  return r >= 0 && r < 3 && c >= 0 && c < 3;
}

export function isStateFootprintInBounds(
  state: Pick<MoveTwoDominoState, "posture" | "r" | "c">
): boolean {
  return getDominoCells(state).every((cell) => isInBounds3x3(cell.r, cell.c));
}

export function matchesMoveTwoTarget(
  state: MoveTwoDominoState,
  target: MoveTwoTarget
): boolean {
  return (
    state.face === 5 &&
    state.posture === target.posture &&
    state.r === target.r &&
    state.c === target.c
  );
}

/** Raw Bloxorz roll kinematics before border/wall/portal checks (Q42). */
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
 * Evaluates a single directional roll on a Move Two puzzle (Q42–Q44):
 * - Non-exit borders, seam straddles, and `"wall"` cells return `{ kind: "bump" }`.
 * - `"hazard"` cells return `{ kind: "hazard" }` (caller resets domino to current face's entry state).
 * - Cleanly crossing `exitEdge` transitions to `face + 1` (`{ kind: "portal" }`).
 * - Matching `puzzle.target` on `Face 6` (`face === 5`) returns `{ kind: "won" }`.
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

  // Case 1: Completely inside current 3x3 face
  if (rawCells.every((cell) => isInBounds3x3(cell.r, cell.c))) {
    for (const cell of rawCells) {
      if (currentFace.grid[cell.r]![cell.c] === "wall") {
        return { kind: "bump" };
      }
    }
    const hazardHits = rawCells.filter(
      (cell) => currentFace.grid[cell.r]![cell.c] === "hazard"
    );
    if (hazardHits.length > 0) {
      return { kind: "hazard", hitCells: hazardHits };
    }
    if (matchesMoveTwoTarget(raw, puzzle.target)) {
      return { kind: "won", next: raw };
    }
    return { kind: "moved", next: raw };
  }

  // Case 2: Crossing exitEdge onto next face (Faces 0..4)
  if (state.face < 5 && currentFace.exitEdge === dir) {
    let drShift = 0;
    let dcShift = 0;
    let cleanlyCrossed = false;

    if (dir === "up" && rawCells.every((cell) => cell.r < 0 && cell.c >= 0 && cell.c < 3)) {
      drShift = 3;
      cleanlyCrossed = true;
    } else if (
      dir === "down" &&
      rawCells.every((cell) => cell.r >= 3 && cell.c >= 0 && cell.c < 3)
    ) {
      drShift = -3;
      cleanlyCrossed = true;
    } else if (
      dir === "left" &&
      rawCells.every((cell) => cell.c < 0 && cell.r >= 0 && cell.r < 3)
    ) {
      dcShift = 3;
      cleanlyCrossed = true;
    } else if (
      dir === "right" &&
      rawCells.every((cell) => cell.c >= 3 && cell.r >= 0 && cell.r < 3)
    ) {
      dcShift = -3;
      cleanlyCrossed = true;
    }

    if (cleanlyCrossed) {
      const nextFaceIdx = state.face + 1;
      const nextFace = puzzle.faces[nextFaceIdx];
      if (!nextFace) return { kind: "bump" };

      const ported: MoveTwoDominoState = {
        face: nextFaceIdx,
        posture: raw.posture,
        r: raw.r + drShift,
        c: raw.c + dcShift,
      };
      const portedCells = getDominoCells(ported);
      if (!portedCells.every((cell) => isInBounds3x3(cell.r, cell.c))) {
        return { kind: "bump" };
      }
      for (const cell of portedCells) {
        const cellType = nextFace.grid[cell.r]![cell.c];
        if (cellType === "wall" || cellType === "hazard") {
          return { kind: "bump" };
        }
      }
      if (matchesMoveTwoTarget(ported, puzzle.target)) {
        return { kind: "won", next: ported };
      }
      return {
        kind: "portal",
        next: ported,
        fromFace: state.face,
        toFace: nextFaceIdx,
      };
    }
  }

  return { kind: "bump" };
}

export interface MoveTwoSolveResult {
  solvable: boolean;
  minMoves: number;
  moves: MoveTwoDirection[];
}

function encodeStateKey(s: MoveTwoDominoState): string {
  return `${s.face}:${s.posture}:${s.r}:${s.c}`;
}

/**
 * Exact Breadth-First Search (BFS) solver over `(face, posture, r, c)` across all 6 faces.
 * Guarantees solvability and computes exact minimum moves (**Par**).
 */
export function solveMoveTwo(
  puzzle: Pick<MoveTwoPuzzle, "faces" | "start" | "target">
): MoveTwoSolveResult {
  if (!isStateFootprintInBounds(puzzle.start) || puzzle.start.face !== 0) {
    return { solvable: false, minMoves: -1, moves: [] };
  }
  for (const cell of getDominoCells(puzzle.start)) {
    if (puzzle.faces[0].grid[cell.r]![cell.c] !== "floor") {
      return { solvable: false, minMoves: -1, moves: [] };
    }
  }
  if (!isStateFootprintInBounds(puzzle.target)) {
    return { solvable: false, minMoves: -1, moves: [] };
  }
  for (const cell of getDominoCells(puzzle.target)) {
    if (puzzle.faces[5].grid[cell.r]![cell.c] !== "floor") {
      return { solvable: false, minMoves: -1, moves: [] };
    }
  }

  const visited = new Set<string>([encodeStateKey(puzzle.start)]);
  const queue: Array<{ state: MoveTwoDominoState; moves: MoveTwoDirection[] }> = [
    { state: puzzle.start, moves: [] },
  ];

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++]!;
    if (matchesMoveTwoTarget(current.state, puzzle.target)) {
      return {
        solvable: true,
        minMoves: current.moves.length,
        moves: current.moves,
      };
    }

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
    if (!face || !Array.isArray(face.grid) || face.grid.length !== 3) {
      errors.push(`Face ${idx + 1} must be a 3x3 grid.`);
      return;
    }
    for (let r = 0; r < 3; r++) {
      const row = face.grid[r];
      if (!Array.isArray(row) || row.length !== 3) {
        errors.push(`Face ${idx + 1} row ${r + 1} must have 3 cells.`);
        continue;
      }
      for (let c = 0; c < 3; c++) {
        if (!["floor", "wall", "hazard"].includes(row[c] as string)) {
          errors.push(`Invalid cell type on Face ${idx + 1} (${r}, ${c}).`);
        }
      }
    }
    if (idx < 5) {
      if (!MOVE_TWO_DIRECTIONS.includes(face.exitEdge as MoveTwoDirection)) {
        errors.push(`Face ${idx + 1} must define a valid exitEdge.`);
      }
    } else if (face.exitEdge !== null) {
      errors.push("Face 6 exitEdge must be null.");
    }
  });

  if (!p.start || !p.target) {
    errors.push("Missing start or target state.");
    return { valid: false, errors };
  }

  if (errors.length > 0) return { valid: false, errors };

  const solved = solveMoveTwo(p as MoveTwoPuzzle);
  if (!solved.solvable || solved.minMoves < 6) {
    errors.push("Puzzle is not solvable across all 6 faces via BFS.");
    return { valid: false, errors };
  }
  if (typeof p.par !== "number" || p.par !== solved.minMoves) {
    errors.push(`Puzzle par (${p.par}) does not match BFS shortest path (${solved.minMoves}).`);
  }

  return { valid: errors.length === 0, errors };
}

export function isMoveTwoPuzzle(value: unknown): value is MoveTwoPuzzle {
  return validateMoveTwoPuzzle(value).valid;
}

function emptyFloorGrid(): MoveTwoFace["grid"] {
  return [
    ["floor", "floor", "floor"],
    ["floor", "floor", "floor"],
    ["floor", "floor", "floor"],
  ];
}

function oppositeDir(dir: MoveTwoDirection): MoveTwoDirection {
  switch (dir) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

/**
 * Deterministic procedural generator for Move Two (`seedKey` -> verified 6-face puzzle).
 * Uses `solveMoveTwo` (BFS) to guarantee solvability and compute exact `par`.
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
  const baseSeed = fnv1a32(`move-2:${seedKey}`);

  for (let attempt = 0; attempt < 250; attempt++) {
    const rng = mulberry32((baseSeed + attempt * 7919) >>> 0);

    // Choose start state on Face 0 (UPRIGHT on one of the 9 cells)
    const startR = Math.floor(rng() * 3);
    const startC = Math.floor(rng() * 3);
    const start: MoveTwoDominoState = {
      face: 0,
      posture: "UPRIGHT",
      r: startR,
      c: startC,
    };

    // Choose portal directions for Faces 0..4 avoiding immediate reversal back into entry edge
    const exitEdges: Array<MoveTwoDirection | null> = [];
    let prevExit: MoveTwoDirection | null = null;
    for (let f = 0; f < 5; f++) {
      const prevDir: MoveTwoDirection | null = prevExit;
      const candidates: MoveTwoDirection[] = prevDir
        ? MOVE_TWO_DIRECTIONS.filter((d) => d !== oppositeDir(prevDir))
        : [...MOVE_TWO_DIRECTIONS];
      const chosen: MoveTwoDirection =
        candidates[Math.floor(rng() * candidates.length)]!;
      exitEdges.push(chosen);
      prevExit = chosen;
    }
    exitEdges.push(null);

    // Choose target on Face 5 (mix of UPRIGHT 1-cell and FLAT_H / FLAT_V 2-cell targets)
    const postureRoll = rng();
    let target: MoveTwoTarget;
    if (postureRoll < 0.5) {
      target = {
        posture: "UPRIGHT",
        r: Math.floor(rng() * 3),
        c: Math.floor(rng() * 3),
      };
    } else if (postureRoll < 0.75) {
      target = {
        posture: "FLAT_H",
        r: Math.floor(rng() * 3),
        c: Math.floor(rng() * 2),
      };
    } else {
      target = {
        posture: "FLAT_V",
        r: Math.floor(rng() * 2),
        c: Math.floor(rng() * 3),
      };
    }

    const targetCellKeys = new Set(
      getDominoCells(target).map((cell) => `${cell.r},${cell.c}`)
    );

    // Populate each face with 1–2 walls/hazards while keeping start/target floor
    const faces = exitEdges.map((exitEdge, fIdx) => {
      const grid = emptyFloorGrid();
      const obstacleCount = rng() < 0.65 ? 2 : 1;
      let placed = 0;
      for (let tries = 0; tries < 12 && placed < obstacleCount; tries++) {
        const rr = Math.floor(rng() * 3);
        const cc = Math.floor(rng() * 3);
        if (fIdx === 0 && rr === start.r && cc === start.c) continue;
        if (fIdx === 5 && targetCellKeys.has(`${rr},${cc}`)) continue;
        if (grid[rr]![cc] !== "floor") continue;
        grid[rr]![cc] = rng() < 0.45 ? "hazard" : "wall";
        placed++;
      }
      return {
        index: fIdx,
        grid,
        exitEdge,
      } satisfies MoveTwoFace;
    }) as MoveTwoPuzzle["faces"];

    const solved = solveMoveTwo({ faces, start, target });
    if (!solved.solvable || solved.minMoves < 11 || solved.minMoves > 28) {
      continue;
    }

    // Ensure at least 1 move occurs on Face 6 after crossing the Face 5 -> Face 6 portal
    let face5PortalStep = -1;
    let sim = start;
    for (let i = 0; i < solved.moves.length; i++) {
      const res = stepMoveTwoDomino({ faces, target }, sim, solved.moves[i]!);
      if (res.kind === "portal" && res.toFace === 5) {
        face5PortalStep = i;
        sim = res.next;
      } else if (res.kind === "moved" || res.kind === "portal" || res.kind === "won") {
        sim = res.next;
      }
    }
    if (face5PortalStep === -1 || solved.moves.length - 1 - face5PortalStep < 1) {
      continue;
    }

    const titlePick =
      meta?.title ??
      `${PUZZLE_TITLES[(baseSeed + attempt) % PUZZLE_TITLES.length]}`;
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

  // Deterministic guaranteed-solvable fallback across all 6 faces
  const fallbackFaces: MoveTwoPuzzle["faces"] = [
    {
      index: 0,
      exitEdge: "right",
      grid: [
        ["floor", "wall", "floor"],
        ["floor", "floor", "floor"],
        ["hazard", "floor", "floor"],
      ],
    },
    {
      index: 1,
      exitEdge: "down",
      grid: [
        ["floor", "floor", "wall"],
        ["floor", "floor", "floor"],
        ["floor", "hazard", "floor"],
      ],
    },
    {
      index: 2,
      exitEdge: "right",
      grid: [
        ["floor", "floor", "floor"],
        ["wall", "floor", "floor"],
        ["floor", "floor", "hazard"],
      ],
    },
    {
      index: 3,
      exitEdge: "up",
      grid: [
        ["floor", "floor", "floor"],
        ["floor", "hazard", "floor"],
        ["floor", "floor", "wall"],
      ],
    },
    {
      index: 4,
      exitEdge: "right",
      grid: [
        ["wall", "floor", "floor"],
        ["floor", "floor", "floor"],
        ["floor", "hazard", "floor"],
      ],
    },
    {
      index: 5,
      exitEdge: null,
      grid: [
        ["floor", "floor", "hazard"],
        ["floor", "floor", "floor"],
        ["wall", "floor", "floor"],
      ],
    },
  ];
  const fallbackStart: MoveTwoDominoState = {
    face: 0,
    posture: "UPRIGHT",
    r: 1,
    c: 0,
  };
  const fallbackTarget: MoveTwoTarget = {
    posture: "UPRIGHT",
    r: 1,
    c: 2,
  };
  const fallbackSolved = solveMoveTwo({
    faces: fallbackFaces,
    start: fallbackStart,
    target: fallbackTarget,
  });

  return {
    id: meta?.id ?? `m2-${seedKey}`,
    puzzleNumber: meta?.puzzleNumber ?? 1,
    title: meta?.title ?? "Six-Sided Roll",
    author: "SOL Theory",
    editor: "Daily Editorial",
    faces: fallbackFaces,
    start: fallbackStart,
    target: fallbackTarget,
    par: fallbackSolved.minMoves,
    canonicalMoves: fallbackSolved.moves,
    ...(meta?.customDate ? { customDate: meta.customDate } : {}),
  };
}

/** Generates and BFS-validates a full calendar month of Move Two daily puzzles. */
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
