/**
 * Eightfold Echo — deterministic parametric SVG shape engine, chain generator, and solver.
 *
 * Game #8 (`GAME_DESIGN_BIBLE.md` Q20–Q26):
 * - A puzzle is a 3×3 grid of 9 distinct shape tiles.
 * - Every tile is described by three visual attributes (`shape`, `fill`, `marks`) plus optional
 *   `customSvgUrl` for `<ImageWithFallback>` custom SVG uploads.
 * - Tiles form a single "echo chain" `0 → 8` starting at the center tile (`gridIndex = 4`):
 *   each next tile differs from the current tile in EXACTLY ONE attribute (`tileDistance === 1`).
 * - The backtracking Hamiltonian solver verifies that EVERY generated puzzle has a UNIQUE
 *   `0 → 8` chain starting at index 4 (`count === 1`), guaranteeing unambiguous logic.
 */

import { getPuzzleNumberForDate } from "@/lib/date-keys";
import { fnv1a32, mulberry32 } from "@/lib/seeded-random";

export const ECHO_GRID_SIZE = 9;
export const ECHO_START_INDEX = 4;

export const ECHO_DIFFICULTIES = ["easy", "hard"] as const;
export type EchoDifficulty = (typeof ECHO_DIFFICULTIES)[number];

export const ECHO_SHAPES = [
  "circle",
  "triangle",
  "square",
  "diamond",
  "pentagon",
  "hexagon",
] as const;

export const ECHO_FILLS = [
  "hollow",
  "solid",
  "left",
  "right",
  "top",
  "bottom",
  "ring",
  "quadrant",
] as const;

export const ECHO_MARKS = [0, 1, 2, 3, 4] as const;

/** Crisp, unmistakable Easy-mode vocabulary (no pentagon/hexagon or left/right ambiguity). */
export const EASY_ECHO_SHAPES = ["circle", "square", "triangle", "diamond"] as const;
export const EASY_ECHO_FILLS = ["hollow", "solid", "top", "bottom", "ring"] as const;
export const EASY_ECHO_MARKS = [0, 1, 2, 3] as const;

export type EchoShape = (typeof ECHO_SHAPES)[number];
export type EchoFill = (typeof ECHO_FILLS)[number];
export type EchoMarks = (typeof ECHO_MARKS)[number];

export type EchoAttribute = "shape" | "fill" | "marks";
export const ECHO_ATTRIBUTES: readonly EchoAttribute[] = ["shape", "fill", "marks"];

export interface EchoTile {
  shape: EchoShape;
  fill: EchoFill;
  marks: EchoMarks;
  /** Optional external/uploaded SVG URL rendered through `<ImageWithFallback>`. */
  customSvgUrl?: string;
}

export interface EightfoldEchoStage {
  difficulty: EchoDifficulty;
  /** Tiles by grid index 0..8 (row-major). */
  tiles: EchoTile[];
  /** Grid indices in chain order; `solution[0]` is always the center (`4`). */
  solution: number[];
  seed?: string;
}

export interface EightfoldEchoPuzzle {
  id: string;
  puzzleNumber: number;
  title: string;
  author: string;
  editor: string;
  /** Primary/Hard tiles by grid index 0..8 (row-major, kept at top-level for compatibility). */
  tiles: EchoTile[];
  /** Grid indices in chain order; `solution[0]` is always the center (`4`). */
  solution: number[];
  /** Daily Easy & Hard boards (`2` games per day). */
  stages?: Record<EchoDifficulty, EightfoldEchoStage>;
  seed?: string;
  customDate?: string;
}

/**
 * Permanent signature color per 3×3 grid position (Q21):
 * Center (`4`) is always Emerald Green (`#2ECC71`); surrounding 8 have curated distinct colors.
 */
export const ECHO_POSITION_COLORS: readonly string[] = [
  "#F9D423", // 0 Gold
  "#9D50BB", // 1 Purple
  "#3B82F6", // 2 Cobalt
  "#F97316", // 3 Tangerine
  "#2ECC71", // 4 Emerald (Center — Starting Tile Step 0)
  "#EC4899", // 5 Rose
  "#14B8A6", // 6 Teal
  "#6366F1", // 7 Indigo
  "#84CC16", // 8 Lime
];

export const ECHO_POSITION_NAMES: readonly string[] = [
  "Top-Left (Gold)",
  "Top-Center (Purple)",
  "Top-Right (Cobalt)",
  "Middle-Left (Tangerine)",
  "Center (Emerald)",
  "Middle-Right (Rose)",
  "Bottom-Left (Teal)",
  "Bottom-Center (Indigo)",
  "Bottom-Right (Lime)",
];

const ECHO_POSITION_EMOJI: readonly string[] = [
  "🟨", // 0
  "🟪", // 1
  "🟦", // 2
  "🟧", // 3
  "🟩", // 4
  "🟥", // 5
  "🟦", // 6
  "🟪", // 7
  "🟩", // 8
];

export function tileKey(t: EchoTile): string {
  return `${t.shape}|${t.fill}|${t.marks}`;
}

export function tileDistance(a: EchoTile, b: EchoTile): number {
  return (
    (a.shape !== b.shape ? 1 : 0) +
    (a.fill !== b.fill ? 1 : 0) +
    (a.marks !== b.marks ? 1 : 0)
  );
}

export function changedAttribute(a: EchoTile, b: EchoTile): EchoAttribute | null {
  if (tileDistance(a, b) !== 1) return null;
  if (a.shape !== b.shape) return "shape";
  if (a.fill !== b.fill) return "fill";
  return "marks";
}

function isValidCustomSvgUrl(url: unknown): boolean {
  if (url === undefined) return true;
  if (typeof url !== "string" || url.trim().length === 0 || url.length > 2048) return false;
  return (
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("data:image/") ||
    url.startsWith("/")
  );
}

export function isEchoTile(value: unknown): value is EchoTile {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return (
    (ECHO_SHAPES as readonly unknown[]).includes(t.shape) &&
    (ECHO_FILLS as readonly unknown[]).includes(t.fill) &&
    (ECHO_MARKS as readonly unknown[]).includes(t.marks) &&
    isValidCustomSvgUrl(t.customSvgUrl)
  );
}

// ---------------------------------------------------------------------------
// Parametric SVG geometry helpers (viewBox 0 0 100 100)
// ---------------------------------------------------------------------------

function regularPolygonPoints(sides: number, cx: number, cy: number, r: number, rotDeg: number): string {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const rad = ((rotDeg + (360 / sides) * i) * Math.PI) / 180;
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

export function echoShapeSvgGeometry(shape: EchoShape, scale = 1): {
  tag: "circle" | "rect" | "polygon";
  attrs: Record<string, string>;
} {
  const r = 30 * scale;
  switch (shape) {
    case "circle":
      return { tag: "circle", attrs: { cx: "50", cy: "44", r: r.toFixed(2) } };
    case "square": {
      const side = 52 * scale;
      const half = side / 2;
      return {
        tag: "rect",
        attrs: {
          x: (50 - half).toFixed(2),
          y: (44 - half).toFixed(2),
          width: side.toFixed(2),
          height: side.toFixed(2),
          rx: (4 * scale).toFixed(2),
        },
      };
    }
    case "diamond":
      return {
        tag: "polygon",
        attrs: { points: regularPolygonPoints(4, 50, 44, 33 * scale, -90) },
      };
    case "triangle":
      return {
        tag: "polygon",
        attrs: { points: regularPolygonPoints(3, 50, 47, 33 * scale, -90) },
      };
    case "pentagon":
      return {
        tag: "polygon",
        attrs: { points: regularPolygonPoints(5, 50, 45, 31 * scale, -90) },
      };
    case "hexagon":
      return {
        tag: "polygon",
        attrs: { points: regularPolygonPoints(6, 50, 44, 31 * scale, -90) },
      };
  }
}

/** Coordinates for 0..4 dot-matrix pips rendered beneath the main shape. */
export function echoDotPositions(marks: EchoMarks): Array<{ cx: number; cy: number }> {
  if (marks === 0) return [];
  const cy = 86;
  const spacing = 11;
  const startX = 50 - ((marks - 1) * spacing) / 2;
  return Array.from({ length: marks }, (_, i) => ({
    cx: Number((startX + i * spacing).toFixed(2)),
    cy,
  }));
}

function serializeShapeTag(
  geom: ReturnType<typeof echoShapeSvgGeometry>,
  extra: Record<string, string>
): string {
  const all = { ...geom.attrs, ...extra };
  const attrStr = Object.entries(all)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  return `<${geom.tag} ${attrStr} />`;
}

/**
 * Pure deterministic inline SVG string for an `EchoTile` (`viewBox="0 0 100 100"`).
 * Usable both on the server/CLI and as a `data:image/svg+xml` source if needed.
 */
export function renderEchoTileSvgString(tile: EchoTile, clipId = "echo-clip"): string {
  const outer = echoShapeSvgGeometry(tile.shape, 1);
  const inner = echoShapeSvgGeometry(tile.shape, 0.54);
  const stroke = "#111111";
  const fillInk = "#18181b";

  let clipRect = "";
  if (tile.fill === "left") clipRect = `<rect x="0" y="0" width="50" height="100" fill="${fillInk}" />`;
  else if (tile.fill === "right") clipRect = `<rect x="50" y="0" width="50" height="100" fill="${fillInk}" />`;
  else if (tile.fill === "top") clipRect = `<rect x="0" y="0" width="100" height="44" fill="${fillInk}" />`;
  else if (tile.fill === "bottom") clipRect = `<rect x="0" y="44" width="100" height="56" fill="${fillInk}" />`;
  else if (tile.fill === "quadrant") clipRect = `<rect x="0" y="0" width="50" height="44" fill="${fillInk}" />`;

  const defs = clipRect
    ? `<defs><clipPath id="${clipId}">${serializeShapeTag(outer, {})}</clipPath></defs>`
    : "";

  const baseFill = tile.fill === "solid" ? fillInk : "#ffffff";
  const baseEl = serializeShapeTag(outer, {
    fill: baseFill,
    stroke,
    "stroke-width": "4.2",
    "stroke-linejoin": "round",
  });
  const halfEl = clipRect ? `<g clip-path="url(#${clipId})">${clipRect}</g>` : "";
  const outlineOverlay = clipRect
    ? serializeShapeTag(outer, {
        fill: "none",
        stroke,
        "stroke-width": "4.2",
        "stroke-linejoin": "round",
      })
    : "";
  const ringEl =
    tile.fill === "ring"
      ? serializeShapeTag(inner, {
          fill: "none",
          stroke,
          "stroke-width": "3.4",
          "stroke-linejoin": "round",
        })
      : "";

  const dots = echoDotPositions(tile.marks)
    .map((d) => `<circle cx="${d.cx}" cy="${d.cy}" r="3.6" fill="${stroke}" />`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${defs}${baseEl}${halfEl}${outlineOverlay}${ringEl}${dots}</svg>`;
}

// ---------------------------------------------------------------------------
// Hamiltonian Backtracking Solver
// ---------------------------------------------------------------------------

export interface EchoSolveResult {
  /** Number of Hamiltonian chains found (capped by `limit`). */
  count: number;
  /** First chain found (grid indices), or null. */
  first: number[] | null;
  /** Steps where more than one unvisited tile was a legal single-change neighbor. */
  ambiguousSteps: number;
}

/**
 * Counts Hamiltonian chains over the 9 tiles starting at `start`, where every hop changes
 * exactly one attribute. Stops after `limit` solutions (use `2` to test uniqueness).
 */
export function solveEightfoldEcho(
  tiles: readonly EchoTile[],
  start: number = ECHO_START_INDEX,
  limit: number = 2
): EchoSolveResult {
  const n = tiles.length;
  const adj: number[][] = tiles.map((a, i) =>
    tiles
      .map((b, j) => (i !== j && tileDistance(a, b) === 1 ? j : -1))
      .filter((j) => j >= 0)
  );
  let count = 0;
  let first: number[] | null = null;
  const path: number[] = [start];
  const visited = new Array<boolean>(n).fill(false);
  visited[start] = true;

  const dfs = () => {
    if (count >= limit) return;
    if (path.length === n) {
      count++;
      if (!first) first = [...path];
      return;
    }
    const cur = path[path.length - 1]!;
    for (const next of adj[cur]!) {
      if (visited[next]) continue;
      visited[next] = true;
      path.push(next);
      dfs();
      path.pop();
      visited[next] = false;
      if (count >= limit) return;
    }
  };
  dfs();

  let ambiguousSteps = 0;
  if (first) {
    const seen = new Set<number>([start]);
    const chain = first as number[];
    for (let k = 0; k < chain.length - 1; k++) {
      const cur = chain[k]!;
      const options = adj[cur]!.filter((j) => !seen.has(j));
      if (options.length > 1) ambiguousSteps++;
      seen.add(chain[k + 1]!);
    }
  }
  return { count, first, ambiguousSteps };
}

// ---------------------------------------------------------------------------
// Candidate-Pulse Hint Selector (Q23)
// ---------------------------------------------------------------------------

/**
 * Returns up to 2 candidate grid indices for the current step:
 * the true next tile `solution[stepIndex + 1]` plus 1 remaining unvisited decoy tile
 * (preferring a plausible neighbor with minimal attribute distance), sorted ascending
 * so position order never reveals which of the 2 pulsing tiles is the true step.
 */
export function pickEchoHintCandidates(
  puzzle: Pick<EightfoldEchoPuzzle, "tiles" | "solution">,
  visitedIndices: readonly number[],
  seed = "hint"
): number[] {
  const stepIndex = visitedIndices.length - 1;
  if (stepIndex < 0 || stepIndex >= puzzle.solution.length - 1) return [];
  const trueNext = puzzle.solution[stepIndex + 1]!;
  const visitedSet = new Set<number>(visitedIndices);
  const currentIdx = visitedIndices[visitedIndices.length - 1]!;
  const currentTile = puzzle.tiles[currentIdx]!;

  const decoys = puzzle.solution
    .filter((idx) => idx !== trueNext && !visitedSet.has(idx))
    .sort((a, b) => {
      const da = tileDistance(currentTile, puzzle.tiles[a]!);
      const db = tileDistance(currentTile, puzzle.tiles[b]!);
      if (da !== db) return da - db;
      return (
        fnv1a32(`${seed}:${stepIndex}:${a}`) - fnv1a32(`${seed}:${stepIndex}:${b}`)
      );
    });

  if (decoys.length === 0) return [trueNext];
  return [trueNext, decoys[0]!].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface EchoValidation {
  valid: boolean;
  errors: string[];
}

function validateEchoStageTilesAndSolution(
  tilesRaw: unknown,
  solRaw: unknown,
  label: string,
  requireZeroAmbiguity = false
): string[] {
  const errors: string[] = [];
  if (
    !Array.isArray(tilesRaw) ||
    tilesRaw.length !== ECHO_GRID_SIZE ||
    !tilesRaw.every(isEchoTile)
  ) {
    errors.push(`${label}: tiles must be exactly 9 valid {shape, fill, marks} objects.`);
    return errors;
  }
  const tiles = tilesRaw as EchoTile[];
  if (new Set(tiles.map(tileKey)).size !== ECHO_GRID_SIZE) {
    errors.push(`${label}: All 9 tiles must be distinct.`);
  }

  if (
    !Array.isArray(solRaw) ||
    solRaw.length !== ECHO_GRID_SIZE ||
    !solRaw.every((v) => Number.isInteger(v) && v >= 0 && v < ECHO_GRID_SIZE) ||
    new Set(solRaw).size !== ECHO_GRID_SIZE
  ) {
    errors.push(`${label}: solution must be a permutation of grid indices 0..8.`);
    return errors;
  }
  const sol = solRaw as number[];
  if (sol[0] !== ECHO_START_INDEX) {
    errors.push(`${label}: solution must start at the center tile (index 4).`);
  }
  for (let k = 0; k < sol.length - 1; k++) {
    if (tileDistance(tiles[sol[k]!]!, tiles[sol[k + 1]!]!) !== 1) {
      errors.push(`${label}: Step ${k + 1} must change exactly one attribute.`);
    }
  }
  if (errors.length === 0) {
    const solved = solveEightfoldEcho(tiles, ECHO_START_INDEX, 2);
    if (solved.count !== 1) {
      errors.push(
        solved.count === 0
          ? `${label}: Puzzle has no valid chain.`
          : `${label}: Puzzle has more than one valid chain.`
      );
    } else if (JSON.stringify(solved.first) !== JSON.stringify(sol)) {
      errors.push(`${label}: solution does not match the unique solved chain.`);
    } else if (requireZeroAmbiguity && solved.ambiguousSteps !== 0) {
      errors.push(`${label}: Easy stage must have zero ambiguous 1-change steps.`);
    }
  }
  return errors;
}

export function validateEightfoldEchoPuzzle(payload: unknown): EchoValidation {
  const errors: string[] = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, errors: ["Payload must be a non-null object."] };
  }
  const p = payload as Record<string, unknown>;
  errors.push(...validateEchoStageTilesAndSolution(p.tiles, p.solution, "puzzle"));

  if (p.stages !== undefined) {
    if (!p.stages || typeof p.stages !== "object" || Array.isArray(p.stages)) {
      errors.push("stages must be an { easy, hard } object when provided.");
    } else {
      const stagesObj = p.stages as Record<string, unknown>;
      for (const diff of ECHO_DIFFICULTIES) {
        const st = stagesObj[diff];
        if (!st || typeof st !== "object" || Array.isArray(st)) {
          errors.push(`stages.${diff} must be a valid stage object.`);
        } else {
          const stRec = st as Record<string, unknown>;
          errors.push(
            ...validateEchoStageTilesAndSolution(
              stRec.tiles,
              stRec.solution,
              `stages.${diff}`,
              diff === "easy"
            )
          );
        }
      }
    }
  }

  if (typeof p.title !== "string" || p.title.trim().length === 0) {
    errors.push("title is required.");
  }
  return { valid: errors.length === 0, errors };
}

export function isEightfoldEchoPuzzle(payload: unknown): payload is EightfoldEchoPuzzle {
  return validateEightfoldEchoPuzzle(payload).valid;
}

/**
 * Counts how many unvisited non-immediate tiles sit at `tileDistance === 2` (2 changes away)
 * from the starting center tile (`index 4`). Easy boards keep `1..3` near-miss decoys.
 */
export function countStartNearMissDecoys(
  stage: Pick<EightfoldEchoStage, "tiles" | "solution">
): number {
  const startTile = stage.tiles[ECHO_START_INDEX]!;
  const trueFirstHop = stage.solution[1];
  let count = 0;
  for (let idx = 0; idx < stage.tiles.length; idx++) {
    if (idx === ECHO_START_INDEX || idx === trueFirstHop) continue;
    if (tileDistance(startTile, stage.tiles[idx]!) === 2) {
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Rule descriptions & victory share formatting (Q24 & Q26)
// ---------------------------------------------------------------------------

const FILL_LABEL: Record<EchoFill, string> = {
  hollow: "hollow",
  solid: "solid",
  left: "left-half filled",
  right: "right-half filled",
  top: "top-half filled",
  bottom: "bottom-half filled",
  ring: "concentric ring",
  quadrant: "top-left quadrant",
};

export function describeEchoTile(tile: EchoTile): string {
  const dots =
    tile.marks === 0 ? "0 dots" : `${tile.marks} dot${tile.marks === 1 ? "" : "s"}`;
  return `${FILL_LABEL[tile.fill]} ${tile.shape} (${dots})`;
}

export function describeEchoStep(a: EchoTile, b: EchoTile): string {
  const attr = changedAttribute(a, b);
  if (attr === "shape") {
    return `Shape morphs: ${a.shape} → ${b.shape} (${FILL_LABEL[a.fill]}, ${a.marks} dot${a.marks === 1 ? "" : "s"} kept).`;
  }
  if (attr === "fill") {
    return `Fill shifts: ${FILL_LABEL[a.fill]} → ${FILL_LABEL[b.fill]} (${a.shape}, ${a.marks} dot${a.marks === 1 ? "" : "s"} kept).`;
  }
  if (attr === "marks") {
    const m = (n: number) => (n === 0 ? "no dots" : `${n} dot${n === 1 ? "" : "s"}`);
    return `Dot matrix steps: ${m(a.marks)} → ${m(b.marks)} (${FILL_LABEL[a.fill]} ${a.shape} kept).`;
  }
  return "Single-attribute step.";
}

export function buildEchoChainRules(
  puzzle: Pick<EightfoldEchoPuzzle, "tiles" | "solution">
): string[] {
  const rules: string[] = [];
  for (let k = 0; k < puzzle.solution.length - 1; k++) {
    rules.push(
      describeEchoStep(
        puzzle.tiles[puzzle.solution[k]!]!,
        puzzle.tiles[puzzle.solution[k + 1]!]!
      )
    );
  }
  return rules;
}

/** Star rating (Q24): 3 = 0 mistakes & <60s, 2 = ≤2 mistakes & <120s, 1 = completed. */
export function echoStars(mistakes: number, elapsedSeconds: number): 1 | 2 | 3 {
  if (mistakes === 0 && elapsedSeconds < 60) return 3;
  if (mistakes <= 2 && elapsedSeconds < 120) return 2;
  return 1;
}

export function formatEchoTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatEchoVictorySummary(
  elapsedSeconds: number,
  mistakes: number,
  stars: 1 | 2 | 3 = echoStars(mistakes, elapsedSeconds)
): string {
  const mistakeWord = mistakes === 1 ? "1 Mistake" : `${mistakes} Mistakes`;
  return `Solved in ${formatEchoTime(elapsedSeconds)} · ${mistakeWord} · ${"⭐".repeat(stars)}`;
}

export function buildEchoShareText(options: {
  puzzleNumber: number;
  elapsedSeconds: number;
  mistakes: number;
  solution?: readonly number[];
  difficulty?: EchoDifficulty;
}): string {
  const stars = echoStars(options.mistakes, options.elapsedSeconds);
  const summary = formatEchoVictorySummary(
    options.elapsedSeconds,
    options.mistakes,
    stars
  );
  const chainEmojis = (options.solution ?? [4, 0, 1, 2, 3, 5, 6, 7, 8])
    .map((pos) => ECHO_POSITION_EMOJI[pos] ?? "🟩")
    .join("");
  const diffSuffix = options.difficulty
    ? ` (${options.difficulty === "easy" ? "Easy" : "Hard"})`
    : "";
  return `Eightfold Echo #${options.puzzleNumber}${diffSuffix}\n${summary}\n${chainEmojis}`;
}

// ---------------------------------------------------------------------------
// Deterministic Generator + Easy/Hard Stages + Monthly Batch Builder
// ---------------------------------------------------------------------------

export interface EchoGenerationMeta {
  id: string;
  puzzleNumber: number;
  title?: string;
  author?: string;
  editor?: string;
  customDate?: string;
}

const ATTR_VALUES: Record<EchoAttribute, readonly (string | number)[]> = {
  shape: ECHO_SHAPES,
  fill: ECHO_FILLS,
  marks: ECHO_MARKS,
};

const EASY_ATTR_VALUES: Record<EchoAttribute, readonly (string | number)[]> = {
  shape: EASY_ECHO_SHAPES,
  fill: EASY_ECHO_FILLS,
  marks: EASY_ECHO_MARKS,
};

const MAX_ATTEMPTS = 4000;

function randomTile(rand: () => number): EchoTile {
  return {
    shape: ECHO_SHAPES[Math.floor(rand() * ECHO_SHAPES.length)]!,
    fill: ECHO_FILLS[Math.floor(rand() * ECHO_FILLS.length)]!,
    marks: ECHO_MARKS[Math.floor(rand() * ECHO_MARKS.length)]!,
  };
}

function randomEasyTile(rand: () => number): EchoTile {
  return {
    shape: EASY_ECHO_SHAPES[Math.floor(rand() * EASY_ECHO_SHAPES.length)]!,
    fill: EASY_ECHO_FILLS[Math.floor(rand() * EASY_ECHO_FILLS.length)]!,
    marks: EASY_ECHO_MARKS[Math.floor(rand() * EASY_ECHO_MARKS.length)]!,
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Random walk of 9 distinct tiles; consecutive hops never reuse the same attribute. */
function randomChain(rand: () => number): EchoTile[] | null {
  const chain: EchoTile[] = [randomTile(rand)];
  const used = new Set<string>([tileKey(chain[0]!)]);
  let lastAttr: EchoAttribute | null = null;
  while (chain.length < ECHO_GRID_SIZE) {
    const cur = chain[chain.length - 1]!;
    let placed = false;
    for (let tries = 0; tries < 24 && !placed; tries++) {
      const choices = ECHO_ATTRIBUTES.filter((a) => a !== lastAttr);
      const attr = choices[Math.floor(rand() * choices.length)]!;
      const values = ATTR_VALUES[attr].filter((v) => v !== cur[attr]);
      const value = values[Math.floor(rand() * values.length)]!;
      const next = { ...cur, [attr]: value } as EchoTile;
      if (used.has(tileKey(next))) continue;
      used.add(tileKey(next));
      chain.push(next);
      lastAttr = attr;
      placed = true;
    }
    if (!placed) return null;
  }
  return chain;
}

/**
 * Constructive induced-path walk for Easy mode:
 * - Every hop changes 1 attribute in the crisp Easy vocabulary.
 * - Every newly added tile `chain[m]` (`m >= 2`) has `tileDistance(chain[i], chain[m]) >= 2`
 *   for ALL earlier non-adjacent tiles `0 <= i <= m - 2`.
 *   This guarantees `ambiguousSteps === 0` AND `solveEightfoldEcho(tiles).count === 1`!
 */
function buildEasyInducedChain(rand: () => number): EchoTile[] | null {
  const start = randomEasyTile(rand);
  const chain: EchoTile[] = [start];
  const used = new Set<string>([tileKey(start)]);
  let lastAttr: EchoAttribute | null = null;

  while (chain.length < ECHO_GRID_SIZE) {
    const cur = chain[chain.length - 1]!;
    const attrChoices = shuffleInPlace(
      ECHO_ATTRIBUTES.filter((a) => a !== lastAttr),
      rand
    );
    let placed = false;
    for (const attr of attrChoices) {
      const valChoices = shuffleInPlace(
        EASY_ATTR_VALUES[attr].filter((v) => v !== cur[attr]),
        rand
      );
      for (const val of valChoices) {
        const next = { ...cur, [attr]: val } as EchoTile;
        const key = tileKey(next);
        if (used.has(key)) continue;
        // Induced-path invariant: zero 1-change shortcuts from any earlier tile!
        let shortcut = false;
        for (let i = 0; i <= chain.length - 2; i++) {
          if (tileDistance(chain[i]!, next) < 2) {
            shortcut = true;
            break;
          }
        }
        if (shortcut) continue;
        used.add(key);
        chain.push(next);
        lastAttr = attr;
        placed = true;
        break;
      }
      if (placed) break;
    }
    if (!placed) return null;
  }
  return chain;
}

function layoutChainOnGrid(
  chain: readonly EchoTile[],
  rand: () => number
): { tiles: EchoTile[]; solution: number[] } {
  const positions = shuffleInPlace([0, 1, 2, 3, 5, 6, 7, 8], rand);
  const tiles = new Array<EchoTile>(ECHO_GRID_SIZE);
  const solution: number[] = [ECHO_START_INDEX];
  tiles[ECHO_START_INDEX] = chain[0]!;
  for (let k = 1; k < chain.length; k++) {
    const pos = positions[k - 1]!;
    tiles[pos] = chain[k]!;
    solution.push(pos);
  }
  return { tiles, solution };
}

/**
 * Deterministically generates an intuitive Easy Eightfold Echo stage:
 * - `solveEightfoldEcho(tiles).count === 1`
 * - `ambiguousSteps === 0` (exact 1 unvisited 1-change match at every step 0..7)
 * - `1..3` tempting 2-change near-miss decoy tiles from the starting center tile (`Step 0`).
 */
export function generateEasyEchoStage(seed: string): EightfoldEchoStage {
  const rand = mulberry32(fnv1a32(`eightfold-echo:easy:${seed}`));
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const chain = buildEasyInducedChain(rand);
    if (!chain) continue;
    const { tiles, solution } = layoutChainOnGrid(chain, rand);
    const nearMisses = countStartNearMissDecoys({ tiles, solution });
    if (nearMisses < 1 || nearMisses > 3) continue;
    const solved = solveEightfoldEcho(tiles, ECHO_START_INDEX, 2);
    if (solved.count !== 1 || solved.ambiguousSteps !== 0) continue;
    return {
      difficulty: "easy",
      tiles,
      solution,
      seed,
    };
  }
  throw new Error(`Easy Eightfold Echo generator exhausted attempts for seed "${seed}"`);
}

/**
 * Deterministically generates a Hard Eightfold Echo stage:
 * - Full 6-shape × 8-fill × 5-dot vocabulary
 * - `solveEightfoldEcho(tiles).count === 1`
 * - `ambiguousSteps >= minAmbiguous` (default `2`, requiring Hamiltonian lookahead).
 */
export function generateHardEchoStage(
  seed: string,
  minAmbiguous = 2
): EightfoldEchoStage {
  const rand = mulberry32(fnv1a32(`eightfold-echo:${seed}`));
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const chain = randomChain(rand);
    if (!chain) continue;
    const { tiles, solution } = layoutChainOnGrid(chain, rand);
    const solved = solveEightfoldEcho(tiles, ECHO_START_INDEX, 2);
    if (solved.count !== 1 || solved.ambiguousSteps < minAmbiguous) continue;
    return {
      difficulty: "hard",
      tiles,
      solution,
      seed,
    };
  }
  if (minAmbiguous > 1) {
    return generateHardEchoStage(`${seed}:r1`, 1);
  }
  if (minAmbiguous > 0) {
    return generateHardEchoStage(`${seed}:relaxed`, 0);
  }
  throw new Error(`Hard Eightfold Echo generator exhausted attempts for seed "${seed}"`);
}

/**
 * Resolves the requested difficulty stage (`easy` or `hard`) for any `EightfoldEchoPuzzle`,
 * seamlessly synthesizing `easy` if a legacy single-board override lacks `stages`.
 */
export function getEchoStage(
  puzzle: EightfoldEchoPuzzle,
  difficulty: EchoDifficulty
): EightfoldEchoStage {
  const fromStages = puzzle.stages?.[difficulty];
  if (fromStages) return fromStages;
  if (difficulty === "hard") {
    return {
      difficulty: "hard",
      tiles: puzzle.tiles,
      solution: puzzle.solution,
      seed: puzzle.seed,
    };
  }
  return generateEasyEchoStage(puzzle.seed ?? puzzle.id);
}

const ECHO_TITLES: readonly string[] = [
  "Harmonic Resonance",
  "Silent Symmetry",
  "Prism Shift",
  "Orbital Drift",
  "Crystalline Step",
  "Mirror Lattice",
  "Geometric Cadence",
  "Lucid Sequence",
  "Tessellation Pulse",
  "Octave Pattern",
  "Radiant Vectors",
  "Counterpoint Grid",
];

/**
 * Deterministically generates a solver-verified dual-stage (`Easy` + `Hard`) puzzle for `seed`.
 * Every returned layout has `solveEightfoldEcho(tiles).count === 1` on both stages.
 */
export function generateEightfoldEchoPuzzle(
  seed: string,
  meta: EchoGenerationMeta,
  minAmbiguous = 2
): EightfoldEchoPuzzle {
  const easy = generateEasyEchoStage(seed);
  const hard = generateHardEchoStage(seed, minAmbiguous);
  const defaultTitle =
    ECHO_TITLES[fnv1a32(`title:${seed}`) % ECHO_TITLES.length]!;
  return {
    id: meta.id,
    puzzleNumber: meta.puzzleNumber,
    title: meta.title ?? defaultTitle,
    author: meta.author ?? "SOL Theory",
    editor: meta.editor ?? "Auto-Generated",
    tiles: hard.tiles,
    solution: hard.solution,
    stages: {
      easy,
      hard,
    },
    seed,
    ...(meta.customDate ? { customDate: meta.customDate } : {}),
  };
}

/** Generates and validates a full calendar month (`month` is 1..12) of Eightfold Echo puzzles. */
export function generateEightfoldEchoMonthlyBatch(
  year: number,
  month: number
): Record<string, EightfoldEchoPuzzle> {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out: Record<string, EightfoldEchoPuzzle> = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const puzzle = generateEightfoldEchoPuzzle(`date:${dateKey}`, {
      id: `8e-${dateKey}`,
      puzzleNumber: getPuzzleNumberForDate(dateKey),
      customDate: dateKey,
    });
    const check = validateEightfoldEchoPuzzle(puzzle);
    if (!check.valid) {
      throw new Error(`Invalid Eightfold Echo batch puzzle for ${dateKey}: ${check.errors.join("; ")}`);
    }
    out[dateKey] = puzzle;
  }
  return out;
}
