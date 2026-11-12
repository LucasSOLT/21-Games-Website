/**
 * 6 Pics (`6-pics`) — 6-piece interlocking jigsaw reveal engine, per-image fuzzy
 * synonym matcher, 36-point scoring math, creator draft converter, and deterministic
 * illustrated SVG scene engine (`GAME_DESIGN_BIBLE.md` Q27–Q33).
 */

import { fnv1a32 } from "@/lib/seeded-random";

export const SIX_PICS_COUNT = 6;
export const SIX_PICS_PIECES_PER_IMAGE = 6;
export const SIX_PICS_MAX_IMAGE_SCORE = 6;
export const SIX_PICS_MAX_SCORE = SIX_PICS_COUNT * SIX_PICS_MAX_IMAGE_SCORE; // 36

export const SIX_PICS_SCENES = [
  "waves",
  "volcano",
  "palm-island",
  "surfboard",
  "campfire",
  "flower-lei",
  "tent",
  "pine-trees",
  "compass",
  "lantern",
  "backpack",
  "stars-sky",
  "coffee-cup",
  "croissant",
  "beans",
  "book",
  "headphones",
  "cafe-table",
  "sun",
  "planet-ring",
  "rocket",
  "moon-crescent",
  "telescope",
  "meteor",
  "cake-candles",
  "balloons",
  "gift-box",
  "party-hat",
  "confetti",
  "envelope",
  "popcorn",
  "clapperboard",
  "film-reel",
  "ticket",
  "spotlight",
  "red-carpet",
  "snowflake",
  "mittens",
  "mug-steam",
  "pinecone",
  "sled",
  "fireplace",
  "anchor",
  "lighthouse",
  "sailboat",
  "seashell",
  "binoculars",
  "seagull",
  "guitar",
  "piano-keys",
  "vinyl",
  "microphone",
  "music-notes",
  "stage",
  "pizza-slice",
  "tomato",
  "chef-hat",
  "rolling-pin",
  "oven-flame",
  "olive-branch",
  "bicycle",
  "camera",
  "passport",
  "suitcase",
  "airplane",
  "globe",
  "castle",
  "crown",
  "shield",
  "dragon-wing",
  "sword",
  "treasure-key",
  "watering-can",
  "sunflower",
  "seedling",
  "butterfly",
  "wheelbarrow",
  "bee-hive",
  "chess-knight",
  "dice",
  "hourglass",
  "trophy",
  "puzzle-piece",
  "playing-card",
] as const;

export type SixPicsSceneKey = (typeof SIX_PICS_SCENES)[number];

export interface SixPicsClueImage {
  /** Primary target answer name of this picture (e.g. `"Volcano"`, `"Compass"`). */
  caption: string;
  /** Optional accepted alternate names / synonyms for this specific picture. */
  aliases?: string[];
  /** Deterministic vector illustration motif key. */
  scene: SixPicsSceneKey;
  /** Background/accent colors `[bgTop, bgBottom, accent]`. */
  palette?: [string, string, string];
  /** Optional external/Supabase/custom SVG URL rendered via `<ImageWithFallback>`. */
  imageUrl?: string;
  /** Optional deterministic starting open jigsaw piece (`0..5`). */
  initialPiece?: number;
}

export interface SixPicsPuzzle {
  id: string;
  puzzleNumber: number;
  /** Editorial subtitle. */
  title: string;
  /** Visible overarching theme displayed at the top of the board to help players. */
  themeAnswer: string;
  /** Kept for backward compatibility with existing overrides/custom payloads. */
  acceptedAliases: string[];
  /** Exactly 6 hidden pictures covered by 6 jigsaw pieces each (5 covering at start). */
  images: SixPicsClueImage[];
  author: string;
  editor: string;
  customDate?: string;
}

/** Per-image completion record in the 36-point jigsaw reveal game. */
export interface SixPicsImageOutcome {
  /** Jigsaw piece indices (`0..5`) that were revealed prior to solving/passing (includes initial free piece). */
  revealedPieces: number[];
  /** Extra pieces removed via "Reveal Piece" (`0..5`). */
  extraPiecesRemoved: number;
  /** True if the player named this image correctly; false if passed/missed. */
  solved: boolean;
  /** Player's winning guess (if solved). */
  guess?: string;
  /** Earned points (`6 - extraPiecesRemoved` in `1..6` when solved, `0` when missed). */
  points: number;
}

/** Legacy attempt union retained for backward compatibility. */
export type SixPicsAttempt =
  | { kind: "wrong"; guess: string }
  | { kind: "skip" }
  | { kind: "correct"; guess: string };

// ---------------------------------------------------------------------------
// Built-In Scene Synonym Dictionary (when using vector scenes without custom imageUrl)
// ---------------------------------------------------------------------------

export const SCENE_DEFAULT_ALIASES: Record<SixPicsSceneKey, readonly string[]> = {
  waves: ["waves", "wave", "ocean", "sea", "surf", "ocean waves", "water"],
  volcano: ["volcano", "eruption", "lava", "crater", "mount"],
  "palm-island": ["island", "palm island", "palm tree", "palm", "atoll", "tropical island"],
  surfboard: ["surfboard", "surfing", "surf", "board"],
  campfire: ["campfire", "fire", "bonfire", "flames", "luau fire"],
  "flower-lei": ["lei", "flower lei", "hula lei", "garland", "wreath", "flowers"],
  tent: ["tent", "camping tent", "campsite", "pitched tent"],
  "pine-trees": ["pine trees", "trees", "pines", "forest", "woods", "evergreens"],
  compass: ["compass", "navigation"],
  lantern: ["lantern", "lamp", "camp lantern", "light"],
  backpack: ["backpack", "rucksack", "pack", "knapsack", "daypack", "bag"],
  "stars-sky": ["stars", "night sky", "starry sky", "constellations", "sky", "cosmos"],
  "coffee-cup": ["coffee", "coffee cup", "espresso", "mug", "cup", "latte", "hot coffee", "tea"],
  croissant: ["croissant", "pastry", "crescent roll", "bun"],
  beans: ["coffee beans", "beans", "roasted beans", "espresso beans"],
  book: ["book", "open book", "novel", "hardcover", "paperback", "storybook"],
  headphones: ["headphones", "headset", "earphones", "cans"],
  "cafe-table": ["table", "cafe table", "bistro table", "patio table", "desk"],
  sun: ["sun", "sunshine", "sunlight", "sunrise", "sunny"],
  "planet-ring": ["planet", "saturn", "ringed planet"],
  rocket: ["rocket", "spaceship", "rocket ship", "spacecraft", "shuttle"],
  "moon-crescent": ["moon", "crescent moon", "half moon", "lunar crescent"],
  telescope: ["telescope", "observatory", "spyglass"],
  meteor: ["meteor", "comet", "shooting star", "asteroid", "fireball"],
  "cake-candles": ["cake", "birthday cake", "candles", "frosted cake"],
  balloons: ["balloons", "balloon", "party balloons"],
  "gift-box": ["gift", "present", "gift box", "wrapped gift", "wrapped present", "box"],
  "party-hat": ["party hat", "hat", "cone hat", "birthday hat"],
  confetti: ["confetti", "streamers", "sprinkles"],
  envelope: ["envelope", "letter", "invitation", "card", "mail", "diploma"],
  popcorn: ["popcorn", "popcorn bucket", "buttered popcorn"],
  clapperboard: ["clapperboard", "slate", "clapboard", "film slate", "action slate", "clapper"],
  "film-reel": ["film reel", "reel", "movie reel", "film"],
  ticket: ["ticket", "movie ticket", "stub", "ticket stub", "admit one"],
  spotlight: ["spotlight", "stage light", "searchlight", "beam", "light"],
  "red-carpet": ["red carpet", "carpet", "runway", "aisle"],
  snowflake: ["snowflake", "snow", "ice crystal", "frost"],
  mittens: ["mittens", "mitten", "gloves", "glove", "winter gloves"],
  "mug-steam": ["mug", "hot cocoa", "hot chocolate", "tea", "cup", "steaming mug", "cocoa"],
  pinecone: ["pinecone", "pine cone", "acorn"],
  sled: ["sled", "toboggan", "sleigh"],
  fireplace: ["fireplace", "hearth", "chimney", "fire"],
  anchor: ["anchor", "ship anchor"],
  lighthouse: ["lighthouse", "beacon", "watchtower"],
  sailboat: ["sailboat", "boat", "ship", "yacht", "sailing ship", "sails"],
  seashell: ["seashell", "shell", "scallop", "clam"],
  binoculars: ["binoculars", "field glasses", "spyglass"],
  seagull: ["seagull", "gull", "bird", "seabird"],
  guitar: ["guitar", "acoustic guitar", "electric guitar"],
  "piano-keys": ["piano", "piano keys", "keyboard", "keys"],
  vinyl: ["vinyl", "record", "vinyl record", "lp", "album"],
  microphone: ["microphone", "mic", "vocal mic"],
  "music-notes": ["music notes", "notes", "musical notes", "music", "sheet music"],
  stage: ["stage", "curtains", "theater stage", "concert stage"],
  "pizza-slice": ["pizza", "pizza slice", "pepperoni pizza", "slice"],
  tomato: ["tomato", "tomatoes", "red tomato"],
  "chef-hat": ["chef hat", "toque", "baker hat", "chefs hat"],
  "rolling-pin": ["rolling pin", "dough roller", "roller"],
  "oven-flame": ["oven", "brick oven", "pizza oven", "wood oven", "stove"],
  "olive-branch": ["olive", "olives", "olive branch", "branch"],
  bicycle: ["bicycle", "bike", "cycling"],
  camera: ["camera", "photo camera"],
  passport: ["passport", "travel passport"],
  suitcase: ["suitcase", "luggage", "bag", "briefcase", "carry on"],
  airplane: ["airplane", "plane", "jet", "aircraft", "flight", "paper plane"],
  globe: ["globe", "world", "earth", "world globe"],
  castle: ["castle", "fortress", "palace", "tower", "keep"],
  crown: ["crown", "tiara", "royal crown"],
  shield: ["shield", "crest", "coat of arms"],
  "dragon-wing": ["dragon", "dragon wing", "wing", "wyvern"],
  sword: ["sword", "blade", "dagger", "rapier"],
  "treasure-key": ["key", "skeleton key", "golden key", "treasure key"],
  "watering-can": ["watering can", "sprinkler", "pitcher"],
  sunflower: ["sunflower", "flower", "daisy", "blossom"],
  seedling: ["seedling", "sprout", "plant", "sapling", "leaf", "herbs"],
  butterfly: ["butterfly", "moth", "monarch"],
  wheelbarrow: ["wheelbarrow", "barrow", "garden cart", "cart"],
  "bee-hive": ["beehive", "bee hive", "hive", "honeycomb", "bees"],
  "chess-knight": ["knight", "chess knight", "chess piece", "chess", "horse"],
  dice: ["dice", "die", "game dice"],
  hourglass: ["hourglass", "sand timer", "timer", "sandglass"],
  trophy: ["trophy", "cup", "award", "champion cup"],
  "puzzle-piece": ["puzzle piece", "jigsaw", "jigsaw piece", "puzzle"],
  "playing-card": ["playing card", "card", "ace", "diamond card", "cards"],
};

// ---------------------------------------------------------------------------
// 6-Piece Interlocking Jigsaw Geometry (`viewBox="0 0 300 225"`, 3 cols × 2 rows)
// ---------------------------------------------------------------------------

export const SIX_PICS_JIGSAW_VIEWBOX = "0 0 300 225";

/**
 * Generates a horizontal jigsaw edge from `(xA, y)` to `(xB, y)`.
 * `tabSign` is in screen `+y` (`+1` bulges downward, `-1` bulges upward, `0` straight outer border).
 * Because control offsets are symmetric around `0.5`, calling `jigsawHEdge(xB, xA, y, tabSign)`
 * traces the exact mathematical reverse of `jigsawHEdge(xA, xB, y, tabSign)` with zero gap.
 */
function jigsawHEdge(xA: number, xB: number, y: number, tabSign: -1 | 0 | 1): string {
  if (tabSign === 0) return `L ${xB} ${y}`;
  const dx = xB - xA;
  const xm = (xA + xB) / 2;
  const b = tabSign * 19;
  const fmt = (n: number) => Number(n.toFixed(2));
  return [
    `L ${fmt(xA + 0.34 * dx)} ${fmt(y)}`,
    `C ${fmt(xA + 0.38 * dx)} ${fmt(y + 0.14 * b)}, ${fmt(xA + 0.28 * dx)} ${fmt(y + b)}, ${fmt(xm)} ${fmt(y + b)}`,
    `C ${fmt(xA + 0.72 * dx)} ${fmt(y + b)}, ${fmt(xA + 0.62 * dx)} ${fmt(y + 0.14 * b)}, ${fmt(xA + 0.66 * dx)} ${fmt(y)}`,
    `L ${fmt(xB)} ${fmt(y)}`,
  ].join(" ");
}

/**
 * Generates a vertical jigsaw edge from `(x, yA)` to `(x, yB)`.
 * `tabSign` is in screen `+x` (`+1` bulges rightward, `-1` bulges leftward, `0` straight outer border).
 */
function jigsawVEdge(x: number, yA: number, yB: number, tabSign: -1 | 0 | 1): string {
  if (tabSign === 0) return `L ${x} ${yB}`;
  const dy = yB - yA;
  const ym = (yA + yB) / 2;
  const b = tabSign * 19;
  const fmt = (n: number) => Number(n.toFixed(2));
  return [
    `L ${fmt(x)} ${fmt(yA + 0.34 * dy)}`,
    `C ${fmt(x + 0.14 * b)} ${fmt(yA + 0.38 * dy)}, ${fmt(x + b)} ${fmt(yA + 0.28 * dy)}, ${fmt(x + b)} ${fmt(ym)}`,
    `C ${fmt(x + b)} ${fmt(yA + 0.72 * dy)}, ${fmt(x + 0.14 * b)} ${fmt(yA + 0.62 * dy)}, ${fmt(x)} ${fmt(yA + 0.66 * dy)}`,
    `L ${fmt(x)} ${fmt(yB)}`,
  ].join(" ");
}

export interface JigsawPieceSpec {
  index: number;
  row: 0 | 1;
  col: 0 | 1 | 2;
  /** Closed SVG `<path d="...">` contour in `0 0 300 225` space. */
  d: string;
  /** Visual center `[cx, cy]` for piece number emblem. */
  center: [number, number];
}

function buildJigsawPieces(): readonly JigsawPieceSpec[] {
  const xs = [0, 100, 200, 300] as const;
  const ys = [0, 112.5, 225] as const;
  // Shared horizontal interior edges at y = 112.5 for col 0, 1, 2
  const midH: readonly (-1 | 1)[] = [1, -1, 1];
  // Shared vertical interior edges at x = 100 and x = 200 for row 0 and row 1
  const midV: readonly [readonly (-1 | 1)[], readonly (-1 | 1)[]] = [
    [1, -1],
    [-1, 1],
  ];

  const pieces: JigsawPieceSpec[] = [];
  for (let row = 0 as 0 | 1; row < 2; row = (row + 1) as 0 | 1) {
    for (let col = 0 as 0 | 1 | 2; col < 3; col = (col + 1) as 0 | 1 | 2) {
      const index = row * 3 + col;
      const xL = xs[col]!;
      const xR = xs[col + 1]!;
      const yT = ys[row]!;
      const yB = ys[row + 1]!;

      const topSign: -1 | 0 | 1 = row === 0 ? 0 : midH[col]!;
      const bottomSign: -1 | 0 | 1 = row === 1 ? 0 : midH[col]!;
      const leftSign: -1 | 0 | 1 = col === 0 ? 0 : midV[row]![col - 1]!;
      const rightSign: -1 | 0 | 1 = col === 2 ? 0 : midV[row]![col]!;

      const d = [
        `M ${xL} ${yT}`,
        jigsawHEdge(xL, xR, yT, topSign),
        jigsawVEdge(xR, yT, yB, rightSign),
        jigsawHEdge(xR, xL, yB, bottomSign),
        jigsawVEdge(xL, yB, yT, leftSign),
        "Z",
      ].join(" ");

      pieces.push({
        index,
        row,
        col,
        d,
        center: [(xL + xR) / 2, (yT + yB) / 2],
      });
    }
  }
  return pieces;
}

/** Pre-computed 6 interlocking SVG jigsaw piece contours (`Piece 0..5`). */
export const SIX_PICS_JIGSAW_PIECES: readonly JigsawPieceSpec[] = buildJigsawPieces();

/**
 * Pieces guaranteed to intersect meaningful subject artwork for each vector scene
 * (`0,1,2` = top row L/C/R; `3,4,5` = bottom row L/C/R).
 */
const WIDE_SCENES = new Set<SixPicsSceneKey>([
  "waves",
  "tent",
  "pine-trees",
  "stars-sky",
  "book",
  "headphones",
  "cafe-table",
  "planet-ring",
  "balloons",
  "confetti",
  "envelope",
  "clapperboard",
  "ticket",
  "spotlight",
  "red-carpet",
  "sled",
  "fireplace",
  "sailboat",
  "binoculars",
  "seagull",
  "piano-keys",
  "stage",
  "pizza-slice",
  "rolling-pin",
  "olive-branch",
  "bicycle",
  "camera",
  "suitcase",
  "airplane",
  "castle",
  "crown",
  "dragon-wing",
  "sword",
  "treasure-key",
  "watering-can",
  "butterfly",
  "wheelbarrow",
]);

/**
 * Deterministically picks the 1st free open piece (`0..5`) for an image so `5` pieces
 * cover the image at the start (`1/6` visible) and the revealed piece always shows part
 * of the illustration.
 */
export function getInitialRevealedPiece(
  clue: Pick<SixPicsClueImage, "scene" | "initialPiece" | "imageUrl">,
  imageIndex: number,
  puzzleSeed = "daily"
): number {
  if (
    typeof clue.initialPiece === "number" &&
    Number.isInteger(clue.initialPiece) &&
    clue.initialPiece >= 0 &&
    clue.initialPiece < SIX_PICS_PIECES_PER_IMAGE
  ) {
    return clue.initialPiece;
  }
  const pool = clue.imageUrl
    ? [0, 1, 2, 3, 4, 5]
    : WIDE_SCENES.has(clue.scene)
    ? [0, 1, 2, 3, 4, 5]
    : [1, 4];
  const h = fnv1a32(`${puzzleSeed}:pic:${imageIndex}:${clue.scene}`);
  return pool[h % pool.length]!;
}

/**
 * Picks 1 random unrevealed jigsaw piece (`0..5`) to remove when clicking "Reveal Piece".
 * Returns `null` if all 6 pieces are already revealed.
 */
export function pickNextRandomPiece(
  revealedPieces: readonly number[],
  randomFn: () => number = Math.random
): number | null {
  const revealedSet = new Set(revealedPieces);
  const remaining: number[] = [];
  for (let p = 0; p < SIX_PICS_PIECES_PER_IMAGE; p++) {
    if (!revealedSet.has(p)) remaining.push(p);
  }
  if (remaining.length === 0) return null;
  const idx = Math.min(
    remaining.length - 1,
    Math.max(0, Math.floor(randomFn() * remaining.length))
  );
  return remaining[idx]!;
}

// ---------------------------------------------------------------------------
// Normalization & Fuzzy Per-Image Levenshtein Matcher (Q30)
// ---------------------------------------------------------------------------

export function normalizeSixPicsText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(the|a|an)\s+/i, "")
    .trim();
}

/** Converts simple English plurals to singular stem for fair noun matching (`waves` <-> `wave`). */
function singularizeSimple(phrase: string): string {
  return phrase
    .split(" ")
    .map((w) => {
      if (w.length <= 3) return w;
      if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
      if (w.endsWith("ves") && w.length > 4) return `${w.slice(0, -3)}f`;
      if (w.endsWith("oes") && w.length > 4) return w.slice(0, -2);
      if (w.endsWith("ses") || w.endsWith("xes") || w.endsWith("ches") || w.endsWith("shes")) {
        return w.slice(0, -2);
      }
      if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) {
        return w.slice(0, -1);
      }
      return w;
    })
    .join(" ");
}

/** Standard Wagner–Fischer edit distance. */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + cost
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]!;
  }
  return prev[b.length]!;
}

export interface SixPicsMatchResult {
  matched: boolean;
  exact: boolean;
  matchedCandidate?: string;
}

function matchAgainstCandidateList(
  guess: string,
  rawCandidates: readonly string[]
): SixPicsMatchResult {
  const g = normalizeSixPicsText(guess);
  if (!g) return { matched: false, exact: false };
  const gCompact = g.replace(/\s+/g, "");
  const gSing = singularizeSimple(g);

  const candidates = [
    ...new Set(
      rawCandidates
        .map((c) => normalizeSixPicsText(c))
        .filter((c) => c.length > 0)
    ),
  ];

  for (const cand of candidates) {
    const candCompact = cand.replace(/\s+/g, "");
    const candSing = singularizeSimple(cand);
    if (
      g === cand ||
      (gSing.length >= 3 && gSing === candSing) ||
      (candCompact.length >= 4 && gCompact === candCompact)
    ) {
      return { matched: true, exact: true, matchedCandidate: cand };
    }
  }

  for (const cand of candidates) {
    if (cand.length >= 5 && g.length >= 4) {
      if (levenshteinDistance(g, cand) <= 1) {
        return { matched: true, exact: false, matchedCandidate: cand };
      }
      const candCompact = cand.replace(/\s+/g, "");
      if (candCompact.length >= 5 && levenshteinDistance(gCompact, candCompact) <= 1) {
        return { matched: true, exact: false, matchedCandidate: cand };
      }
    }
  }

  return { matched: false, exact: false };
}

/**
 * Checks whether `guess` matches a specific picture's `caption` or `aliases`
 * (plus built-in vector scene synonyms when `imageUrl` is not overriding the scene).
 */
export function matchSixPicsImageGuess(
  guess: string,
  image: Pick<SixPicsClueImage, "caption" | "aliases" | "scene" | "imageUrl">
): SixPicsMatchResult {
  const sceneSyns = image.imageUrl ? [] : SCENE_DEFAULT_ALIASES[image.scene] ?? [];
  return matchAgainstCandidateList(guess, [
    image.caption,
    ...(image.aliases ?? []),
    ...sceneSyns,
  ]);
}

/**
 * Legacy/general matcher checking `themeAnswer` + `acceptedAliases`.
 */
export function matchSixPicsGuess(
  guess: string,
  puzzle: Pick<SixPicsPuzzle, "themeAnswer" | "acceptedAliases">
): SixPicsMatchResult {
  return matchAgainstCandidateList(guess, [
    puzzle.themeAnswer,
    ...(puzzle.acceptedAliases ?? []),
  ]);
}

// ---------------------------------------------------------------------------
// 36-Point Scoring & Share Formatting (Q29, Q31 & Q32)
// ---------------------------------------------------------------------------

/**
 * Scores a single picture (`0..6` points):
 * - `0` extra pieces removed (`1/6` visible) -> `6` pts
 * - `1` extra piece removed (`2/6` visible)  -> `5` pts
 * - `2` extra pieces removed (`3/6` visible) -> `4` pts
 * - `3` extra pieces removed (`4/6` visible) -> `3` pts
 * - `4` extra pieces removed (`5/6` visible) -> `2` pts
 * - `5` extra pieces removed (`6/6` visible) -> `1` pt
 * - Not answered correctly / Passed          -> `0` pts
 */
export function scoreForSixPicsImage(
  solved: boolean,
  extraPiecesRemoved: number
): number {
  if (!solved) return 0;
  const clamped = Math.max(0, Math.min(5, Math.floor(extraPiecesRemoved)));
  return SIX_PICS_MAX_IMAGE_SCORE - clamped;
}

/** Sums total points across all 6 pictures (`0..36`). */
export function totalScoreForSixPics(
  outcomes: readonly Pick<SixPicsImageOutcome, "points">[]
): number {
  let sum = 0;
  for (let i = 0; i < Math.min(SIX_PICS_COUNT, outcomes.length); i++) {
    const pts = outcomes[i]?.points ?? 0;
    sum += Math.max(0, Math.min(SIX_PICS_MAX_IMAGE_SCORE, pts));
  }
  return sum;
}

/** Legacy 1..6 single-solve scorer preserved for backward compatibility. */
export function scoreForSixPics(solvedOnPicNumber: number | null): number {
  if (solvedOnPicNumber === null) return 0;
  if (solvedOnPicNumber < 1 || solvedOnPicNumber > SIX_PICS_COUNT) return 0;
  return SIX_PICS_COUNT - solvedOnPicNumber + 1;
}

function isImageOutcome(
  item: SixPicsImageOutcome | SixPicsAttempt | undefined
): item is SixPicsImageOutcome {
  return Boolean(item && typeof item === "object" && "points" in item);
}

/**
 * Builds a 6-emoji receipt across the 6 pictures:
 * - `🟩` = `5–6` pts (`0–1` extra pieces removed)
 * - `🟨` = `3–4` pts (`2–3` extra pieces removed)
 * - `🟧` = `1–2` pts (`4–5` extra pieces removed)
 * - `⬜` = `0` pts (passed / missed)
 */
export function buildSixPicsEmojiReceipt(
  items: readonly (SixPicsImageOutcome | SixPicsAttempt)[]
): string {
  const tiles: string[] = [];
  for (let i = 0; i < SIX_PICS_COUNT; i++) {
    const entry = items[i];
    if (!entry) {
      tiles.push("⬜");
    } else if (isImageOutcome(entry)) {
      if (!entry.solved || entry.points <= 0) tiles.push("⬜");
      else if (entry.points >= 5) tiles.push("🟩");
      else if (entry.points >= 3) tiles.push("🟨");
      else tiles.push("🟧");
    } else if (entry.kind === "correct") {
      tiles.push("🟩");
    } else if (entry.kind === "skip") {
      tiles.push("🟨");
    } else {
      tiles.push("🟥");
    }
  }
  return tiles.join("");
}

export function buildSixPicsShareText(options: {
  puzzleNumber: number;
  themeAnswer?: string;
  outcomes?: readonly SixPicsImageOutcome[];
  attempts?: readonly SixPicsAttempt[];
  custom?: boolean;
  creatorHandle?: string;
}): string {
  const themeSuffix = options.themeAnswer ? ` — ${options.themeAnswer}` : "";
  const header = options.custom
    ? `6 Pics${options.creatorHandle ? ` by ${options.creatorHandle}` : " (friend puzzle)"}${themeSuffix}`
    : `6 Pics #${options.puzzleNumber}${themeSuffix}`;

  if (options.outcomes) {
    const total = totalScoreForSixPics(options.outcomes);
    const named = options.outcomes.filter((o) => o.solved && o.points > 0).length;
    return `${header}\n${total}/${SIX_PICS_MAX_SCORE} pts · ${named}/${SIX_PICS_COUNT} named\n${buildSixPicsEmojiReceipt(options.outcomes)}`;
  }

  const attempts = options.attempts ?? [];
  const winIdx = attempts.findIndex((a) => a.kind === "correct");
  const score = scoreForSixPics(winIdx >= 0 ? winIdx + 1 : null);
  return `${header}\n${score}/${SIX_PICS_COUNT}\n${buildSixPicsEmojiReceipt(attempts)}`;
}

// ---------------------------------------------------------------------------
// Runtime Validation & Creator Draft Conversion
// ---------------------------------------------------------------------------

export interface SixPicsValidation {
  valid: boolean;
  errors: string[];
}

function isValidImageUrl(url: unknown): boolean {
  if (url === undefined || url === "") return true;
  if (typeof url !== "string" || url.length > 2048) return false;
  return (
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("data:image/") ||
    url.startsWith("/")
  );
}

export function validateSixPicsPuzzle(payload: unknown): SixPicsValidation {
  const errors: string[] = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, errors: ["Payload must be a non-null object."] };
  }
  const p = payload as Record<string, unknown>;
  const theme = typeof p.themeAnswer === "string" ? p.themeAnswer.trim() : "";
  if (theme.length < 2 || theme.length > 48) {
    errors.push("themeAnswer must be 2–48 characters.");
  }
  if (
    p.acceptedAliases !== undefined &&
    (!Array.isArray(p.acceptedAliases) ||
      p.acceptedAliases.length > 24 ||
      !p.acceptedAliases.every((a) => typeof a === "string" && a.trim().length <= 48))
  ) {
    errors.push("acceptedAliases must be an array of up to 24 strings.");
  }
  if (!Array.isArray(p.images) || p.images.length !== SIX_PICS_COUNT) {
    errors.push(`images must contain exactly ${SIX_PICS_COUNT} picture cards.`);
    return { valid: false, errors };
  }
  p.images.forEach((raw, idx) => {
    const n = idx + 1;
    if (!raw || typeof raw !== "object") {
      errors.push(`Picture ${n} must be an object.`);
      return;
    }
    const img = raw as Record<string, unknown>;
    if (
      typeof img.caption !== "string" ||
      img.caption.trim().length < 1 ||
      img.caption.length > 60
    ) {
      errors.push(`Picture ${n}: answer name must be 1–60 characters.`);
    }
    if (
      img.aliases !== undefined &&
      (!Array.isArray(img.aliases) ||
        img.aliases.length > 24 ||
        !img.aliases.every((a) => typeof a === "string" && a.trim().length <= 48))
    ) {
      errors.push(`Picture ${n}: aliases must be an array of up to 24 strings.`);
    }
    if (
      typeof img.scene !== "string" ||
      !(SIX_PICS_SCENES as readonly string[]).includes(img.scene)
    ) {
      errors.push(`Picture ${n}: scene must be a valid scene preset.`);
    }
    if (!isValidImageUrl(img.imageUrl)) {
      errors.push(
        `Picture ${n}: imageUrl must be a valid http(s), data:image, or relative path.`
      );
    }
  });
  if (typeof p.title !== "string" || p.title.trim().length === 0) {
    errors.push("title is required.");
  }
  return { valid: errors.length === 0, errors };
}

export function isSixPicsPuzzle(payload: unknown): payload is SixPicsPuzzle {
  return validateSixPicsPuzzle(payload).valid;
}

export interface SixPicsDraftRow {
  caption: string;
  aliasesCsv?: string;
  scene: SixPicsSceneKey;
  imageUrl: string;
}

export function draftToSixPicsPuzzle(options: {
  id: string;
  title: string;
  themeAnswer: string;
  aliasesCsv?: string;
  rows: SixPicsDraftRow[];
  creatorName: string;
}): { puzzle: SixPicsPuzzle | null; errors: string[] } {
  const theme = options.themeAnswer.trim();
  const themeNorm = normalizeSixPicsText(theme);
  const aliases = [
    ...new Set(
      (options.aliasesCsv ?? "")
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0 && normalizeSixPicsText(a) !== themeNorm)
    ),
  ].slice(0, 20);

  const images: SixPicsClueImage[] = options.rows.map((r) => {
    const cap = r.caption.trim();
    const capNorm = normalizeSixPicsText(cap);
    const rowAliases = [
      ...new Set(
        (r.aliasesCsv ?? "")
          .split(",")
          .map((a) => a.trim())
          .filter((a) => a.length > 0 && normalizeSixPicsText(a) !== capNorm)
      ),
    ].slice(0, 20);
    return {
      caption: cap,
      ...(rowAliases.length > 0 ? { aliases: rowAliases } : {}),
      scene: r.scene,
      ...(r.imageUrl.trim() ? { imageUrl: r.imageUrl.trim() } : {}),
    };
  });

  const puzzle: SixPicsPuzzle = {
    id: options.id,
    puzzleNumber: 0,
    title: options.title.trim() || "Six Hidden Pictures",
    themeAnswer: theme,
    acceptedAliases: aliases,
    images,
    author: options.creatorName.trim() || "Friend",
    editor: "Creator",
  };
  const check = validateSixPicsPuzzle(puzzle);
  return check.valid ? { puzzle, errors: [] } : { puzzle: null, errors: check.errors };
}

// ---------------------------------------------------------------------------
// Label-Free Editorial SVG Scene Renderer (Q28 & Q33)
// ---------------------------------------------------------------------------

const DEFAULT_PALETTES: readonly [string, string, string][] = [
  ["#FEF3C7", "#FDE68A", "#D97706"],
  ["#DBEAFE", "#BFDBFE", "#2563EB"],
  ["#DCFCE7", "#BBF7D0", "#16A34A"],
  ["#FCE7F3", "#FBCFE8", "#DB2777"],
  ["#EDE9FE", "#DDD6FE", "#7C3AED"],
  ["#FFEDD5", "#FED7AA", "#EA580C"],
];

function sceneForegroundSvg(scene: SixPicsSceneKey, accent: string): string {
  const ink = "#18181b";
  switch (scene) {
    case "waves":
      return `<circle cx="150" cy="48" r="18" fill="#FBBF24" stroke="${ink}" stroke-width="3"/><path d="M16 112 Q46 92 76 112 T136 112 T196 112 V160 H16 Z" fill="#38BDF8" stroke="${ink}" stroke-width="3"/><path d="M16 132 Q46 114 76 132 T136 132 T196 132" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
    case "volcano":
      return `<polygon points="36,144 84,62 116,62 164,144" fill="#78716C" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/><path d="M84 62 Q100 82 116 62 L124 82 Q100 94 76 82 Z" fill="#EF4444" stroke="${ink}" stroke-width="2.5"/><circle cx="96" cy="40" r="11" fill="#F97316" stroke="${ink}" stroke-width="2.5"/><circle cx="112" cy="30" r="9" fill="#FBBF24" stroke="${ink}" stroke-width="2.5"/>`;
    case "palm-island":
      return `<ellipse cx="100" cy="136" rx="58" ry="16" fill="#FCD34D" stroke="${ink}" stroke-width="3"/><path d="M98 132 Q92 92 106 58" fill="none" stroke="#92400E" stroke-width="7" stroke-linecap="round"/><path d="M106 58 Q74 48 64 68 M106 58 Q138 46 148 68 M106 58 Q84 34 72 44 M106 58 Q128 34 140 46" fill="none" stroke="#16A34A" stroke-width="6" stroke-linecap="round"/>`;
    case "surfboard":
      return `<ellipse cx="100" cy="84" rx="20" ry="56" transform="rotate(24 100 84)" fill="${accent}" stroke="${ink}" stroke-width="3.5"/><line x1="77" y1="135" x2="123" y2="33" stroke="#fff" stroke-width="4"/><path d="M24 138 Q62 124 100 138 T176 138" fill="none" stroke="#0284C7" stroke-width="4" stroke-linecap="round"/>`;
    case "campfire":
      return `<line x1="62" y1="136" x2="138" y2="116" stroke="#78350F" stroke-width="9" stroke-linecap="round"/><line x1="62" y1="116" x2="138" y2="136" stroke="#92400E" stroke-width="9" stroke-linecap="round"/><path d="M100 42 C126 70 132 104 100 116 C68 104 74 70 100 42 Z" fill="#F97316" stroke="${ink}" stroke-width="3"/><path d="M100 68 C114 84 116 104 100 112 C84 104 86 84 100 68 Z" fill="#FDE047"/>`;
    case "flower-lei":
      return `<circle cx="100" cy="86" r="42" fill="none" stroke="#16A34A" stroke-width="5" stroke-dasharray="6 6"/>` +
        [0, 60, 120, 180, 240, 300]
          .map((deg, i) => {
            const r = (deg * Math.PI) / 180;
            const cx = (100 + 42 * Math.cos(r)).toFixed(1);
            const cy = (86 + 42 * Math.sin(r)).toFixed(1);
            const col = i % 2 === 0 ? "#F43F5E" : "#FBBF24";
            return `<circle cx="${cx}" cy="${cy}" r="12" fill="${col}" stroke="${ink}" stroke-width="2.5"/><circle cx="${cx}" cy="${cy}" r="4" fill="#fff"/>`;
          })
          .join("");
    case "tent":
      return `<polygon points="34,136 100,48 166,136" fill="${accent}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/><polygon points="82,136 100,88 118,136" fill="#1E293B" stroke="${ink}" stroke-width="2.5"/>`;
    case "pine-trees":
      return `<polygon points="68,52 38,118 98,118" fill="#15803D" stroke="${ink}" stroke-width="3"/><rect x="62" y="118" width="12" height="20" fill="#78350F" stroke="${ink}" stroke-width="2.5"/><polygon points="128,38 94,118 162,118" fill="#16A34A" stroke="${ink}" stroke-width="3"/><rect x="122" y="118" width="12" height="22" fill="#78350F" stroke="${ink}" stroke-width="2.5"/>`;
    case "compass":
      return `<circle cx="100" cy="86" r="46" fill="#fff" stroke="${ink}" stroke-width="4"/><polygon points="100,48 112,86 100,78 88,86" fill="#EF4444" stroke="${ink}" stroke-width="2"/><polygon points="100,124 112,86 100,94 88,86" fill="#CBD5E1" stroke="${ink}" stroke-width="2"/>`;
    case "lantern":
      return `<path d="M84 44 A16 12 0 0 1 116 44" fill="none" stroke="${ink}" stroke-width="3.5"/><rect x="74" y="48" width="52" height="72" rx="10" fill="#FEF08A" stroke="${ink}" stroke-width="3.5"/><circle cx="100" cy="86" r="14" fill="#F97316"/>`;
    case "backpack":
      return `<rect x="64" y="50" width="72" height="84" rx="20" fill="${accent}" stroke="${ink}" stroke-width="3.5"/><rect x="76" y="88" width="48" height="34" rx="8" fill="#fff" stroke="${ink}" stroke-width="2.8"/><path d="M86 50 V38 A14 10 0 0 1 114 38 V50" fill="none" stroke="${ink}" stroke-width="3.5"/>`;
    case "stars-sky":
      return `<rect x="30" y="30" width="140" height="110" rx="18" fill="#1E1B4B" stroke="${ink}" stroke-width="3"/><circle cx="66" cy="62" r="5" fill="#FDE047"/><circle cx="132" cy="54" r="6" fill="#FDE047"/><circle cx="106" cy="96" r="7" fill="#FDE047"/><circle cx="62" cy="108" r="4" fill="#fff"/><circle cx="146" cy="106" r="4" fill="#fff"/>`;
    case "coffee-cup":
      return `<rect x="58" y="68" width="72" height="58" rx="12" fill="#fff" stroke="${ink}" stroke-width="3.5"/><path d="M130 78 H144 A14 14 0 0 1 144 108 H130" fill="none" stroke="${ink}" stroke-width="3.5"/><line x1="48" y1="132" x2="142" y2="132" stroke="${ink}" stroke-width="4" stroke-linecap="round"/><path d="M80 56 Q86 44 80 34 M100 56 Q106 44 100 34" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
    case "croissant":
      return `<path d="M46 106 Q62 52 100 52 Q138 52 154 106 Q128 88 100 88 Q72 88 46 106 Z" fill="#F59E0B" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
    case "beans":
      return `<ellipse cx="80" cy="86" rx="20" ry="28" transform="rotate(-18 80 86)" fill="#78350F" stroke="${ink}" stroke-width="3"/><path d="M74 62 Q86 86 76 110" fill="none" stroke="#FEF3C7" stroke-width="2.5"/><ellipse cx="124" cy="90" rx="20" ry="28" transform="rotate(20 124 90)" fill="#92400E" stroke="${ink}" stroke-width="3"/><path d="M128 66 Q116 90 126 114" fill="none" stroke="#FEF3C7" stroke-width="2.5"/>`;
    case "book":
      return `<path d="M44 52 Q72 44 100 54 V128 Q72 118 44 126 Z" fill="#fff" stroke="${ink}" stroke-width="3.5"/><path d="M156 52 Q128 44 100 54 V128 Q128 118 156 126 Z" fill="${accent}" stroke="${ink}" stroke-width="3.5"/>`;
    case "headphones":
      return `<path d="M56 96 V80 A44 44 0 0 1 144 80 V96" fill="none" stroke="${ink}" stroke-width="6"/><rect x="44" y="88" width="20" height="36" rx="8" fill="${accent}" stroke="${ink}" stroke-width="3"/><rect x="136" y="88" width="20" height="36" rx="8" fill="${accent}" stroke="${ink}" stroke-width="3"/>`;
    case "cafe-table":
      return `<ellipse cx="100" cy="80" rx="56" ry="14" fill="#fff" stroke="${ink}" stroke-width="3.5"/><line x1="100" y1="94" x2="100" y2="136" stroke="${ink}" stroke-width="5"/><line x1="72" y1="136" x2="128" y2="136" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`;
    case "sun":
      return `<circle cx="100" cy="86" r="30" fill="#FBBF24" stroke="${ink}" stroke-width="3.5"/>` +
        [0, 45, 90, 135, 180, 225, 270, 315]
          .map((d) => {
            const r = (d * Math.PI) / 180;
            return `<line x1="${(100 + 38 * Math.cos(r)).toFixed(1)}" y1="${(86 + 38 * Math.sin(r)).toFixed(1)}" x2="${(100 + 50 * Math.cos(r)).toFixed(1)}" y2="${(86 + 50 * Math.sin(r)).toFixed(1)}" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`;
          })
          .join("");
    case "planet-ring":
      return `<circle cx="100" cy="86" r="28" fill="${accent}" stroke="${ink}" stroke-width="3.5"/><ellipse cx="100" cy="86" rx="58" ry="14" transform="rotate(-18 100 86)" fill="none" stroke="${ink}" stroke-width="4"/>`;
    case "rocket":
      return `<path d="M100 32 C124 58 124 98 116 118 H84 C76 98 76 58 100 32 Z" fill="#fff" stroke="${ink}" stroke-width="3.5"/><circle cx="100" cy="76" r="10" fill="#38BDF8" stroke="${ink}" stroke-width="2.5"/><polygon points="84,104 66,126 84,118" fill="#EF4444" stroke="${ink}" stroke-width="2.5"/><polygon points="116,104 134,126 116,118" fill="#EF4444" stroke="${ink}" stroke-width="2.5"/>`;
    case "moon-crescent":
      return `<path d="M116 42 A44 44 0 1 0 142 116 A34 34 0 1 1 116 42 Z" fill="#FDE047" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
    case "telescope":
      return `<polygon points="52,86 142,52 150,72 58,100" fill="${accent}" stroke="${ink}" stroke-width="3.5"/><line x1="96" y1="90" x2="74" y2="138" stroke="${ink}" stroke-width="4"/><line x1="96" y1="90" x2="122" y2="138" stroke="${ink}" stroke-width="4"/>`;
    case "meteor":
      return `<line x1="44" y1="42" x2="112" y2="96" stroke="#F97316" stroke-width="8" stroke-linecap="round"/><circle cx="126" cy="106" r="18" fill="#FBBF24" stroke="${ink}" stroke-width="3.5"/>`;
    case "cake-candles":
      return `<rect x="54" y="84" width="92" height="48" rx="10" fill="#FBCFE8" stroke="${ink}" stroke-width="3.5"/><line x1="80" y1="60" x2="80" y2="84" stroke="${ink}" stroke-width="4"/><line x1="100" y1="60" x2="100" y2="84" stroke="${ink}" stroke-width="4"/><line x1="120" y1="60" x2="120" y2="84" stroke="${ink}" stroke-width="4"/><circle cx="80" cy="52" r="5" fill="#F97316"/><circle cx="100" cy="52" r="5" fill="#F97316"/><circle cx="120" cy="52" r="5" fill="#F97316"/>`;
    case "balloons":
      return `<ellipse cx="80" cy="68" rx="22" ry="28" fill="#EF4444" stroke="${ink}" stroke-width="3"/><ellipse cx="122" cy="64" rx="22" ry="28" fill="#3B82F6" stroke="${ink}" stroke-width="3"/><path d="M80 96 Q90 118 96 140 M122 92 Q112 116 104 140" fill="none" stroke="${ink}" stroke-width="2.5"/>`;
    case "gift-box":
      return `<rect x="60" y="70" width="80" height="64" rx="6" fill="${accent}" stroke="${ink}" stroke-width="3.5"/><rect x="54" y="56" width="92" height="18" rx="4" fill="#fff" stroke="${ink}" stroke-width="3.5"/><line x1="100" y1="56" x2="100" y2="134" stroke="#EF4444" stroke-width="8"/>`;
    case "party-hat":
      return `<polygon points="62,132 100,44 138,132" fill="${accent}" stroke="${ink}" stroke-width="3.5"/><circle cx="100" cy="40" r="9" fill="#FDE047" stroke="${ink}" stroke-width="2.5"/>`;
    case "confetti":
      return `<rect x="54" y="54" width="14" height="14" transform="rotate(20 61 61)" fill="#EF4444" stroke="${ink}" stroke-width="2"/><circle cx="132" cy="58" r="9" fill="#3B82F6" stroke="${ink}" stroke-width="2"/><polygon points="96,76 112,102 82,102" fill="#FBBF24" stroke="${ink}" stroke-width="2"/><rect x="128" y="108" width="16" height="12" transform="rotate(-18 136 114)" fill="#10B981" stroke="${ink}" stroke-width="2"/><circle cx="64" cy="114" r="8" fill="#A855F7" stroke="${ink}" stroke-width="2"/>`;
    case "envelope":
      return `<rect x="46" y="56" width="108" height="68" rx="8" fill="#fff" stroke="${ink}" stroke-width="3.5"/><polyline points="48,58 100,96 152,58" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
    case "popcorn":
      return `<circle cx="80" cy="58" r="14" fill="#FEF08A" stroke="${ink}" stroke-width="2.5"/><circle cx="100" cy="52" r="16" fill="#FEF08A" stroke="${ink}" stroke-width="2.5"/><circle cx="120" cy="58" r="14" fill="#FEF08A" stroke="${ink}" stroke-width="2.5"/><polygon points="66,68 134,68 124,136 76,136" fill="#EF4444" stroke="${ink}" stroke-width="3.5"/><line x1="90" y1="68" x2="92" y2="136" stroke="#fff" stroke-width="6"/><line x1="110" y1="68" x2="108" y2="136" stroke="#fff" stroke-width="6"/>`;
    case "clapperboard":
      return `<rect x="48" y="68" width="104" height="66" rx="6" fill="#18181b"/><rect x="48" y="48" width="104" height="20" rx="4" fill="#fff" stroke="${ink}" stroke-width="3"/><line x1="70" y1="48" x2="82" y2="68" stroke="${ink}" stroke-width="5"/><line x1="102" y1="48" x2="114" y2="68" stroke="${ink}" stroke-width="5"/><line x1="134" y1="48" x2="146" y2="68" stroke="${ink}" stroke-width="5"/>`;
    case "film-reel":
      return `<circle cx="100" cy="86" r="44" fill="#E4E4E7" stroke="${ink}" stroke-width="3.5"/><circle cx="100" cy="62" r="9" fill="#18181b"/><circle cx="100" cy="110" r="9" fill="#18181b"/><circle cx="76" cy="86" r="9" fill="#18181b"/><circle cx="124" cy="86" r="9" fill="#18181b"/>`;
    case "ticket":
      return `<path d="M42 62 H158 V78 A10 10 0 0 0 158 98 V114 H42 V98 A10 10 0 0 0 42 78 Z" fill="#FDE047" stroke="${ink}" stroke-width="3.5"/><line x1="122" y1="64" x2="122" y2="112" stroke="${ink}" stroke-width="2.5" stroke-dasharray="5 5"/>`;
    case "spotlight":
      return `<polygon points="62,48 156,96 112,138" fill="#FEF08A" opacity="0.85"/><circle cx="62" cy="48" r="14" fill="#18181b"/>`;
    case "red-carpet":
      return `<polygon points="78,44 122,44 154,140 46,140" fill="#DC2626" stroke="${ink}" stroke-width="3.5"/>`;
    case "snowflake":
      return `<line x1="100" y1="38" x2="100" y2="134" stroke="#0284C7" stroke-width="5" stroke-linecap="round"/><line x1="58" y1="62" x2="142" y2="110" stroke="#0284C7" stroke-width="5" stroke-linecap="round"/><line x1="142" y1="62" x2="58" y2="110" stroke="#0284C7" stroke-width="5" stroke-linecap="round"/>`;
    case "mittens":
      return `<path d="M64 126 V74 A22 22 0 0 1 108 74 V90 L122 80 A10 10 0 0 1 134 94 L108 116 V126 Z" fill="${accent}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
    case "mug-steam":
      return `<rect x="64" y="68" width="64" height="62" rx="10" fill="#EF4444" stroke="${ink}" stroke-width="3.5"/><path d="M128 80 H142 A12 12 0 0 1 142 108 H128" fill="none" stroke="${ink}" stroke-width="3.5"/><path d="M84 56 Q90 42 84 32 M106 56 Q112 42 106 32" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
    case "pinecone":
      return `<ellipse cx="100" cy="90" rx="28" ry="40" fill="#92400E" stroke="${ink}" stroke-width="3.5"/><path d="M76 74 Q100 90 124 74 M74 94 Q100 110 126 94" fill="none" stroke="#FEF3C7" stroke-width="3"/>`;
    case "sled":
      return `<rect x="50" y="76" width="100" height="16" rx="6" fill="#B45309" stroke="${ink}" stroke-width="3"/><path d="M44 114 H146 Q162 114 162 98" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/><line x1="72" y1="92" x2="72" y2="114" stroke="${ink}" stroke-width="4"/><line x1="128" y1="92" x2="128" y2="114" stroke="${ink}" stroke-width="4"/>`;
    case "fireplace":
      return `<rect x="46" y="48" width="108" height="88" rx="6" fill="#B91C1C" stroke="${ink}" stroke-width="3.5"/><path d="M72 136 V92 A28 28 0 0 1 128 92 V136 Z" fill="#18181b"/><path d="M100 84 C114 98 114 122 100 130 C86 122 86 98 100 84 Z" fill="#F97316"/>`;
    case "anchor":
      return `<circle cx="100" cy="48" r="10" fill="none" stroke="${ink}" stroke-width="4"/><line x1="100" y1="58" x2="100" y2="128" stroke="${ink}" stroke-width="5"/><line x1="76" y1="74" x2="124" y2="74" stroke="${ink}" stroke-width="5" stroke-linecap="round"/><path d="M62 104 A38 30 0 0 0 138 104" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`;
    case "lighthouse":
      return `<polygon points="80,138 88,54 112,54 120,138" fill="#fff" stroke="${ink}" stroke-width="3.5"/><rect x="83" y="78" width="34" height="16" fill="#EF4444"/><rect x="88" y="38" width="24" height="16" fill="#FDE047" stroke="${ink}" stroke-width="3"/>`;
    case "sailboat":
      return `<polygon points="98,38 98,108 54,108" fill="#fff" stroke="${ink}" stroke-width="3"/><polygon points="104,50 144,108 104,108" fill="${accent}" stroke="${ink}" stroke-width="3"/><polygon points="48,114 152,114 136,134 64,134" fill="#1E3A8A" stroke="${ink}" stroke-width="3"/>`;
    case "seashell":
      return `<path d="M54 108 A46 46 0 0 1 146 108 L116 130 H84 Z" fill="#FDE68A" stroke="${ink}" stroke-width="3.5"/><line x1="100" y1="62" x2="100" y2="130" stroke="${ink}" stroke-width="2.5"/><line x1="76" y1="70" x2="90" y2="130" stroke="${ink}" stroke-width="2.5"/><line x1="124" y1="70" x2="110" y2="130" stroke="${ink}" stroke-width="2.5"/>`;
    case "binoculars":
      return `<circle cx="72" cy="96" r="24" fill="#334155" stroke="${ink}" stroke-width="4"/><circle cx="128" cy="96" r="24" fill="#334155" stroke="${ink}" stroke-width="4"/><rect x="88" y="78" width="24" height="12" rx="4" fill="${ink}"/>`;
    case "seagull":
      return `<path d="M44 92 Q74 62 100 88 Q126 62 156 92" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`;
    case "guitar":
      return `<circle cx="84" cy="106" r="26" fill="#D97706" stroke="${ink}" stroke-width="3.5"/><circle cx="84" cy="106" r="8" fill="#18181b"/><line x1="102" y1="88" x2="146" y2="44" stroke="#78350F" stroke-width="9" stroke-linecap="round"/>`;
    case "piano-keys":
      return `<rect x="46" y="54" width="108" height="68" rx="6" fill="#fff" stroke="${ink}" stroke-width="3.5"/><line x1="73" y1="54" x2="73" y2="122" stroke="${ink}" stroke-width="2.5"/><line x1="100" y1="54" x2="100" y2="122" stroke="${ink}" stroke-width="2.5"/><line x1="127" y1="54" x2="127" y2="122" stroke="${ink}" stroke-width="2.5"/><rect x="65" y="54" width="14" height="40" fill="${ink}"/><rect x="93" y="54" width="14" height="40" fill="${ink}"/><rect x="120" y="54" width="14" height="40" fill="${ink}"/>`;
    case "vinyl":
      return `<circle cx="100" cy="86" r="46" fill="#18181b"/><circle cx="100" cy="86" r="32" fill="none" stroke="#52525B" stroke-width="2"/><circle cx="100" cy="86" r="16" fill="${accent}" stroke="#fff" stroke-width="2"/><circle cx="100" cy="86" r="4" fill="#18181b"/>`;
    case "microphone":
      return `<rect x="84" y="42" width="32" height="48" rx="16" fill="#CBD5E1" stroke="${ink}" stroke-width="3.5"/><path d="M72 72 A28 28 0 0 0 128 72" fill="none" stroke="${ink}" stroke-width="3.5"/><line x1="100" y1="100" x2="100" y2="134" stroke="${ink}" stroke-width="4"/><line x1="78" y1="134" x2="122" y2="134" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`;
    case "music-notes":
      return `<circle cx="74" cy="112" r="12" fill="${ink}"/><circle cx="122" cy="104" r="12" fill="${ink}"/><polyline points="84,112 84,54 132,46 132,104" fill="none" stroke="${ink}" stroke-width="5" stroke-linejoin="round"/>`;
    case "stage":
      return `<path d="M40 42 H160 V132 H140 Q136 86 160 66 M40 132 H60 Q64 86 40 66" fill="#991B1B" stroke="${ink}" stroke-width="3"/><rect x="40" y="122" width="120" height="16" fill="#78350F" stroke="${ink}" stroke-width="3"/>`;
    case "pizza-slice":
      return `<polygon points="56,52 148,70 88,138" fill="#FBBF24" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/><circle cx="92" cy="82" r="8" fill="#DC2626"/><circle cx="114" cy="88" r="7" fill="#DC2626"/><circle cx="94" cy="108" r="7" fill="#DC2626"/>`;
    case "tomato":
      return `<circle cx="100" cy="92" r="36" fill="#EF4444" stroke="${ink}" stroke-width="3.5"/><path d="M84 58 Q100 44 116 58 Q100 66 84 58 Z" fill="#16A34A" stroke="${ink}" stroke-width="2.5"/>`;
    case "chef-hat":
      return `<path d="M68 92 A22 22 0 1 1 84 54 A24 24 0 0 1 116 54 A22 22 0 1 1 132 92 V124 H68 Z" fill="#fff" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
    case "rolling-pin":
      return `<rect x="64" y="74" width="72" height="24" rx="8" fill="#FDE68A" stroke="${ink}" stroke-width="3.5"/><line x1="42" y1="86" x2="64" y2="86" stroke="#92400E" stroke-width="7" stroke-linecap="round"/><line x1="136" y1="86" x2="158" y2="86" stroke="#92400E" stroke-width="7" stroke-linecap="round"/>`;
    case "oven-flame":
      return `<rect x="52" y="48" width="96" height="84" rx="10" fill="#E4E4E7" stroke="${ink}" stroke-width="3.5"/><rect x="66" y="70" width="68" height="46" rx="6" fill="#18181b"/><path d="M100 80 C112 92 112 108 100 112 C88 108 88 92 100 80 Z" fill="#F97316"/>`;
    case "olive-branch":
      return `<path d="M52 118 Q100 72 148 56" fill="none" stroke="#15803D" stroke-width="4" stroke-linecap="round"/><ellipse cx="84" cy="90" rx="10" ry="6" transform="rotate(-30 84 90)" fill="#16A34A" stroke="${ink}" stroke-width="2"/><ellipse cx="116" cy="72" rx="10" ry="6" transform="rotate(-25 116 72)" fill="#16A34A" stroke="${ink}" stroke-width="2"/><circle cx="102" cy="96" r="7" fill="#3F6212" stroke="${ink}" stroke-width="2"/>`;
    case "bicycle":
      return `<circle cx="66" cy="108" r="22" fill="none" stroke="${ink}" stroke-width="4"/><circle cx="134" cy="108" r="22" fill="none" stroke="${ink}" stroke-width="4"/><polyline points="66,108 92,74 126,74 100,108 66,108" fill="none" stroke="${accent}" stroke-width="4" stroke-linejoin="round"/><line x1="126" y1="74" x2="134" y2="108" stroke="${ink}" stroke-width="4"/>`;
    case "camera":
      return `<rect x="48" y="60" width="104" height="68" rx="12" fill="#334155" stroke="${ink}" stroke-width="3.5"/><rect x="78" y="48" width="32" height="14" rx="4" fill="#334155" stroke="${ink}" stroke-width="3"/><circle cx="100" cy="94" r="20" fill="#BAE6FD" stroke="#fff" stroke-width="3"/>`;
    case "passport":
      return `<rect x="66" y="42" width="68" height="92" rx="8" fill="#1E3A8A" stroke="${ink}" stroke-width="3.5"/><circle cx="100" cy="84" r="18" fill="none" stroke="#FDE047" stroke-width="3"/><line x1="82" y1="84" x2="118" y2="84" stroke="#FDE047" stroke-width="2.5"/>`;
    case "suitcase":
      return `<rect x="52" y="62" width="96" height="70" rx="10" fill="${accent}" stroke="${ink}" stroke-width="3.5"/><path d="M84 62 V48 H116 V62" fill="none" stroke="${ink}" stroke-width="4"/>`;
    case "airplane":
      return `<path d="M44 96 L154 58 L126 122 L100 102 L80 120 V98 Z" fill="#fff" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
    case "globe":
      return `<circle cx="100" cy="84" r="36" fill="#38BDF8" stroke="${ink}" stroke-width="3.5"/><path d="M78 66 Q96 74 90 96 Q82 108 98 114 M114 60 Q128 78 118 98" fill="none" stroke="#16A34A" stroke-width="8" stroke-linecap="round"/>`;
    case "castle":
      return `<path d="M52 134 V64 H66 V76 H80 V64 H94 V86 H106 V64 H120 V76 H134 V64 H148 V134 Z" fill="#D4D4D8" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/><path d="M88 134 V106 A12 12 0 0 1 112 106 V134 Z" fill="#78350F" stroke="${ink}" stroke-width="2.5"/>`;
    case "crown":
      return `<polygon points="48,120 58,62 84,90 100,54 116,90 142,62 152,120" fill="#FBBF24" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
    case "shield":
      return `<path d="M60 46 H140 V88 C140 116 100 136 100 136 C100 136 60 116 60 88 Z" fill="${accent}" stroke="${ink}" stroke-width="3.5"/><line x1="100" y1="48" x2="100" y2="134" stroke="#fff" stroke-width="4"/>`;
    case "dragon-wing":
      return `<path d="M52 126 Q66 52 148 48 Q126 82 140 102 Q108 96 96 122 Q76 108 52 126 Z" fill="#16A34A" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
    case "sword":
      return `<line x1="62" y1="126" x2="138" y2="50" stroke="#CBD5E1" stroke-width="8" stroke-linecap="round"/><line x1="68" y1="98" x2="90" y2="120" stroke="#FBBF24" stroke-width="6" stroke-linecap="round"/>`;
    case "treasure-key":
      return `<circle cx="74" cy="86" r="20" fill="none" stroke="#F59E0B" stroke-width="7"/><line x1="94" y1="86" x2="148" y2="86" stroke="#F59E0B" stroke-width="7" stroke-linecap="round"/><line x1="132" y1="86" x2="132" y2="104" stroke="#F59E0B" stroke-width="7" stroke-linecap="round"/><line x1="146" y1="86" x2="146" y2="100" stroke="#F59E0B" stroke-width="7" stroke-linecap="round"/>`;
    case "watering-can":
      return `<rect x="68" y="76" width="58" height="50" rx="8" fill="#22C55E" stroke="${ink}" stroke-width="3.5"/><line x1="126" y1="92" x2="156" y2="68" stroke="#22C55E" stroke-width="8" stroke-linecap="round"/><path d="M68 84 H52 A14 14 0 0 0 52 114 H68" fill="none" stroke="${ink}" stroke-width="3.5"/>`;
    case "sunflower":
      return [0, 36, 72, 108, 144, 180, 216, 252, 288, 324]
        .map((d) => `<ellipse cx="100" cy="54" rx="9" ry="18" transform="rotate(${d} 100 82)" fill="#FBBF24" stroke="${ink}" stroke-width="2"/>`)
        .join("") + `<circle cx="100" cy="82" r="18" fill="#78350F" stroke="${ink}" stroke-width="3"/><line x1="100" y1="100" x2="100" y2="142" stroke="#16A34A" stroke-width="5"/>`;
    case "seedling":
      return `<line x1="100" y1="134" x2="100" y2="76" stroke="#16A34A" stroke-width="5"/><path d="M100 92 Q68 88 68 62 Q98 62 100 92 Z" fill="#22C55E" stroke="${ink}" stroke-width="3"/><path d="M100 82 Q132 78 132 52 Q102 52 100 82 Z" fill="#4ADE80" stroke="${ink}" stroke-width="3"/>`;
    case "butterfly":
      return `<ellipse cx="76" cy="74" rx="22" ry="18" fill="${accent}" stroke="${ink}" stroke-width="3"/><ellipse cx="124" cy="74" rx="22" ry="18" fill="${accent}" stroke="${ink}" stroke-width="3"/><ellipse cx="80" cy="104" rx="16" ry="14" fill="#FDE047" stroke="${ink}" stroke-width="3"/><ellipse cx="120" cy="104" rx="16" ry="14" fill="#FDE047" stroke="${ink}" stroke-width="3"/><line x1="100" y1="56" x2="100" y2="122" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`;
    case "wheelbarrow":
      return `<polygon points="56,76 134,76 118,112 68,112" fill="#EF4444" stroke="${ink}" stroke-width="3.5"/><circle cx="132" cy="120" r="14" fill="#334155" stroke="${ink}" stroke-width="3"/><line x1="40" y1="76" x2="68" y2="112" stroke="${ink}" stroke-width="4"/>`;
    case "bee-hive":
      return `<ellipse cx="100" cy="62" rx="26" ry="12" fill="#FBBF24" stroke="${ink}" stroke-width="3"/><ellipse cx="100" cy="82" rx="34" ry="13" fill="#F59E0B" stroke="${ink}" stroke-width="3"/><ellipse cx="100" cy="104" rx="28" ry="12" fill="#FBBF24" stroke="${ink}" stroke-width="3"/><circle cx="100" cy="92" r="7" fill="#18181b"/>`;
    case "chess-knight":
      return `<path d="M72 132 H128 V118 H72 Z M80 118 L76 82 L64 76 L76 50 L108 46 L122 68 L112 118 Z" fill="#E4E4E7" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
    case "dice":
      return `<rect x="62" y="50" width="76" height="76" rx="14" fill="#fff" stroke="${ink}" stroke-width="3.5"/><circle cx="82" cy="70" r="6" fill="${ink}"/><circle cx="100" cy="88" r="6" fill="${ink}"/><circle cx="118" cy="106" r="6" fill="${ink}"/>`;
    case "hourglass":
      return `<polygon points="68,46 132,46 100,86 132,126 68,126 100,86" fill="#FDE68A" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
    case "trophy":
      return `<path d="M70 50 H130 V82 A30 30 0 0 1 70 82 Z" fill="#FBBF24" stroke="${ink}" stroke-width="3.5"/><line x1="100" y1="112" x2="100" y2="130" stroke="${ink}" stroke-width="5"/><rect x="78" y="130" width="44" height="10" rx="3" fill="${ink}"/>`;
    case "puzzle-piece":
      return `<path d="M64 58 H92 A10 10 0 1 1 108 58 H136 V86 A10 10 0 1 1 136 102 V126 H64 Z" fill="${accent}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
    case "playing-card":
      return `<rect x="66" y="42" width="68" height="92" rx="8" fill="#fff" stroke="${ink}" stroke-width="3.5"/><polygon points="100,68 116,88 100,108 84,88" fill="#EF4444"/>`;
  }
}

/**
 * Generates a deterministic, label-free SVG illustration string (`viewBox="0 0 200 170"`).
 * Zero text is embedded so pictures remain 100% label-free during gameplay (Q28).
 * Foreground subject is scaled (`1.24x`) so jigsaw cutouts reveal rich visual lines.
 */
export function renderSixPicsSceneSvg(
  clue: Pick<SixPicsClueImage, "scene" | "palette">,
  index = 0
): string {
  const pal =
    clue.palette ??
    DEFAULT_PALETTES[(fnv1a32(clue.scene) + index) % DEFAULT_PALETTES.length]!;
  const [bgTop, bgBottom, accent] = pal;
  const gradId = `spg-${clue.scene}-${index}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 170">` +
    `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${bgTop}"/><stop offset="100%" stop-color="${bgBottom}"/>` +
    `</linearGradient></defs>` +
    `<rect x="0" y="0" width="200" height="170" rx="16" fill="url(#${gradId})"/>` +
    `<circle cx="100" cy="85" r="72" fill="#ffffff" fill-opacity="0.32"/>` +
    `<g transform="translate(100 85) scale(1.24) translate(-100 -85)">` +
    sceneForegroundSvg(clue.scene, accent) +
    `</g>` +
    `</svg>`
  );
}

export function renderSixPicsSceneDataUri(
  clue: Pick<SixPicsClueImage, "scene" | "palette">,
  index = 0
): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    renderSixPicsSceneSvg(clue, index)
  )}`;
}
