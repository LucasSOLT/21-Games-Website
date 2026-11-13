/**
 * 17 Syllables — Master 66-Day Haiku Puzzle Bank & Deterministic Slicer
 * Architecture: SOL GaMES (21games.ai) — Milestone 17
 * Target location: src/data/puzzles/17-syllables.ts
 */

import {
  ROTATION_ANCHOR,
  daysBetweenDateKeys,
  getLocalDateKey,
  getPuzzleNumberForDate,
} from "@/lib/date-keys";

export interface HaikuWord {
  text: string; // Uppercase word, e.g. "AUTUMN"
  chunks: string[]; // e.g. ["AU", "TUMN"]
}

export interface HaikuLineInfo {
  syllables: 5 | 7;
  text: string;
  words: HaikuWord[];
}

export interface SeventeenSyllablesPuzzle {
  id: string;
  puzzleNumber: number;
  dateKey: string;
  theme: string;
  author: string;
  lines: [string, string, string]; // [5-syllable, 7-syllable, 5-syllable]
  chunks: string[]; // Shuffled or ordered uppercase chunks for tray
  /** Optional editor-configured slices keyed by `${lineIdx}-${wordIdx}`. */
  customWordChunks?: Record<string, string[]>;
}

// ============================================================================
// Syllable Counter & Lexicon Engine
// ============================================================================

/**
 * Standard English syllable exceptions dictionary for poetry & haikus.
 */
const KNOWN_SYLLABLES: Record<string, number> = {
  // A
  a: 1, across: 2, afar: 2, again: 2, against: 2, ahead: 2, air: 1, all: 1, alone: 2,
  along: 2, among: 2, amber: 2, ancient: 2, and: 1, anew: 2, apples: 2, are: 1, around: 2, as: 1,
  at: 1, autumn: 2, awake: 2, awakes: 2, away: 2,
  // B
  bamboo: 2, be: 1, beauty: 2, begins: 2, bell: 1, bells: 1, beneath: 2,
  beyond: 2, birds: 1, black: 1, bloom: 1, blooms: 1, blue: 1, bough: 1, boughs: 1, bounce: 1,
  branches: 2, brave: 1, breaks: 1, breeze: 1, bright: 1, buds: 1, burn: 1,
  burning: 2, but: 1, by: 1,
  // C
  call: 1, calling: 2, calls: 1, calm: 1, candle: 2, canyon: 2, cares: 1, carry: 2,
  cedar: 2, cherry: 2, chilled: 1, circles: 2, clear: 1, cliff: 1, closes: 2, clouds: 1, coastal: 2,
  code: 1, cold: 1, come: 1, cool: 1, courage: 2, covering: 3, crash: 1,
  creek: 1, crickets: 2, currents: 2,
  // D
  dance: 1, dark: 1, darkness: 2, dawn: 1, day: 1, deep: 1, deer: 1,
  desert: 2, dew: 1, digital: 3, dipping: 2, distant: 2, do: 1, down: 1, dragonfly: 3,
  dreams: 1, drift: 1, drifting: 2, drops: 1, dunes: 1, dusk: 1,
  // E
  early: 2, earth: 1, east: 1, echo: 2, echoes: 2, endless: 2, evening: 2,
  every: 2, expand: 2,
  // F
  face: 1, fade: 1, fades: 1, fall: 1, falling: 2, far: 1, fear: 1,
  feather: 2, feel: 1, field: 1, fields: 1, fire: 1, firefly: 3, first: 1,
  flame: 1, flakes: 1, flight: 1, floating: 2, flow: 1, flowing: 2, flowers: 2,
  fly: 1, flying: 2, fog: 1, footsteps: 2, forest: 2, forever: 3, forth: 1,
  free: 1, freedom: 2, fresh: 1, from: 1, frost: 1, frozen: 2,
  // G
  garden: 2, gentle: 2, giant: 2, glass: 1, gleam: 1, glow: 1, glowing: 2,
  glows: 1, gold: 1, golden: 2, gone: 1, grass: 1, grasses: 2, gray: 1,
  graze: 1, green: 1, grove: 1, guide: 1,
  // H
  hands: 1, harbor: 2, harvest: 2, hear: 1, heart: 1, hearts: 1, hearth: 1,
  heat: 1, heaven: 2, heavy: 2, here: 1, hidden: 2, high: 1, hill: 1,
  hills: 1, hold: 1, hollows: 2, horizon: 3, hush: 1, hushed: 1,
  // I
  i: 1, ice: 1, in: 1, inner: 2, into: 2, is: 1, island: 2,
  // J
  journey: 2, joy: 1,
  // K
  keep: 1,
  // L
  lagoon: 2, lake: 1, lamp: 1, land: 1, lantern: 2, late: 1, leaves: 1,
  life: 1, light: 1, lightning: 2, like: 1, listen: 2, living: 2, lone: 1,
  lonely: 2, long: 1, look: 1, lost: 1, love: 1, low: 1,
  // M
  makes: 1, meadow: 2, me: 1, memory: 3, midnight: 2, mind: 1, mirror: 2,
  mist: 1, misty: 2, moon: 1, moonlight: 2, moonlit: 2, morning: 2, moss: 1,
  mossy: 2, mountain: 2, mountains: 2, my: 1,
  // N
  nature: 2, near: 1, needles: 2, neon: 2, new: 1, night: 1, no: 1, noon: 1,
  north: 1, not: 1, now: 1,
  // O
  oak: 1, ocean: 2, of: 1, old: 1, on: 1, one: 1, open: 2,
  opening: 3, or: 1, our: 1, out: 1, over: 2,
  // P
  pale: 1, passing: 2, past: 1, path: 1, pathway: 2, peace: 1, pebble: 2, pebbles: 2,
  petals: 2, pine: 1, pines: 1, pink: 1, polished: 2, pool: 1, praise: 1, pulse: 1,
  pure: 1, pull: 1, pulling: 2, purple: 2,
  // Q
  quiet: 2,
  // R
  rain: 1, rainstorm: 2, rays: 1, reach: 1, reaches: 2, red: 1, reflect: 2,
  reflecting: 3, rest: 1, rhythm: 2, ripples: 2, rise: 1, rises: 2,
  rising: 2, river: 2, road: 1, roads: 1, rocks: 1, roof: 1, room: 1,
  roses: 2, rounded: 2, rumble: 2, runs: 1, rushing: 2, rustling: 2,
  // S
  safe: 1, sand: 1, sands: 1, scent: 1, sea: 1, seas: 1, seasons: 2,
  see: 1, seed: 1, serene: 2, shadow: 2, shadows: 2, shall: 1, sheltered: 2, shine: 1,
  shines: 1, shining: 2, ship: 1, shoreline: 2, silent: 2, silver: 2,
  sing: 1, singing: 2, sky: 1, sleep: 1, sleeping: 2, slender: 2, slow: 1, slowly: 2,
  smoke: 1, smooth: 1, snow: 1, soft: 1, softly: 2, soil: 1, solitude: 3, song: 1,
  soon: 1, sound: 1, south: 1, southern: 2, space: 1, sparks: 1, spring: 1, springs: 1,
  stand: 1, stands: 1, star: 1, starlight: 2, stars: 1, step: 1, still: 1,
  stone: 1, stones: 1, storm: 1, stream: 1, streams: 1, streets: 1, summer: 2,
  sun: 1, sunlight: 2, sunset: 2, swaying: 2, sweet: 1,
  // T
  tall: 1, temple: 2, the: 1, their: 1, them: 1, there: 1, these: 1,
  they: 1, through: 1, thunder: 2, tide: 1, tides: 1, time: 1, timeless: 2,
  to: 1, today: 2, tonight: 2, touch: 1, touching: 2, toward: 2, tower: 2,
  trail: 1, traveller: 3, trees: 1, true: 1, tumble: 2, twilight: 2,
  // U
  under: 2, upon: 2, urban: 2,
  // V
  vale: 1, valley: 2, view: 1, voice: 1, voices: 2, voyage: 2,
  // W
  wait: 1, waiting: 2, wake: 1, wakes: 1, walk: 1, wandering: 3, warm: 1,
  warmth: 1, was: 1, wash: 1, washing: 2, water: 2, waters: 2, wave: 1,
  waves: 1, way: 1, we: 1, welcome: 2, whisper: 2, whispers: 2, white: 1,
  who: 1, wide: 1, wild: 1, willow: 2, wind: 1, winds: 1, wings: 1, winter: 2,
  with: 1, without: 2, woods: 1, world: 1,
  // Y
  yield: 1,
};

/**
 * Counts the syllables in an individual word.
 * Uses dictionary lookup first, then fallback algorithmic heuristics.
 */
export function countWordSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!clean) return 0;

  if (KNOWN_SYLLABLES[clean] !== undefined) {
    return KNOWN_SYLLABLES[clean];
  }

  // Heuristic counting for words not in the explicit lexicon
  let count = 0;
  const normalized = clean
    .replace(/(?:[^laeiouy]|ed|es|e)$/, "")
    .replace(/^y/, "");
  const matched = normalized.match(/[aeiouy]{1,2}/g);
  count = matched ? matched.length : 1;
  return Math.max(1, count);
}

/**
 * Counts total syllables across a space-separated line of text.
 */
export function countLineSyllables(line: string): number {
  const words = line.trim().split(/\s+/).filter(Boolean);
  return words.reduce((acc, word) => acc + countWordSyllables(word), 0);
}

/**
 * Validates whether 3 lines form a strict 5-7-5 Haiku.
 */
export function validateHaikuStructure(lines: [string, string, string]): {
  isValid: boolean;
  counts: [number, number, number];
  errors: string[];
} {
  const c1 = countLineSyllables(lines[0]);
  const c2 = countLineSyllables(lines[1]);
  const c3 = countLineSyllables(lines[2]);

  const errors: string[] = [];
  if (c1 !== 5) errors.push(`Line 1 has ${c1} syllables (expected 5).`);
  if (c2 !== 7) errors.push(`Line 2 has ${c2} syllables (expected 7).`);
  if (c3 !== 5) errors.push(`Line 3 has ${c3} syllables (expected 5).`);

  return {
    isValid: errors.length === 0,
    counts: [c1, c2, c3],
    errors,
  };
}

// ============================================================================
// Deterministic Single-Word Uppercase Chunk Slicer
// ============================================================================

/**
 * Slices a single word into 1 to 3 uppercase chunks.
 * Chunks NEVER cross word boundaries.
 */
export function sliceSingleWord(word: string, shouldSplit: boolean): string[] {
  const upper = word.toUpperCase().replace(/[^A-Z]/g, "");
  if (!upper) return [];
  if (!shouldSplit || upper.length <= 3) {
    return [upper];
  }
  if (upper.length === 4) {
    return [upper.slice(0, 2), upper.slice(2)];
  }
  if (upper.length === 5) {
    if (upper.endsWith("ASS")) {
      return [upper.slice(0, 3), upper.slice(3)];
    }
    return [upper.slice(0, 2), upper.slice(2)];
  }
  if (upper.length === 6) {
    return [upper.slice(0, 3), upper.slice(3)];
  }
  if (upper.length === 7) {
    return [upper.slice(0, 3), upper.slice(3)];
  }
  if (upper.length === 8) {
    return [upper.slice(0, 4), upper.slice(4)];
  }
  // 9+ letters
  return [upper.slice(0, 3), upper.slice(3, 6), upper.slice(6)];
}

/**
 * Slices a 3-line 5-7-5 haiku into 14–20 variable-length uppercase chunks.
 * Rules:
 * - Single-word chunks only (never cross word boundaries).
 * - Chunk lengths between 1 and 8 characters.
 * - Total chunk count strictly within [14, 20].
 * - Deterministic output.
 */
export function sliceHaikuIntoChunks(
  lines: [string, string, string],
  targetChunkCount = 16
): string[] {
  const allWords: string[] = [];
  for (const line of lines) {
    const words = line
      .toUpperCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^A-Z]/g, ""))
      .filter((w) => w.length > 0);
    allWords.push(...words);
  }

  // Base: unsplit words
  const currentChunks = allWords.map((w) => [w]);
  let totalChunks = currentChunks.length;

  // Find candidates to split (words with length >= 4)
  // Sort candidate indices by word length descending so longest words split first
  const candidateIndices = allWords
    .map((w, idx) => ({ idx, len: w.length }))
    .filter((item) => item.len >= 4)
    .sort((a, b) => b.len - a.len);

  // Split longest words until we reach targetChunkCount or run out of candidates
  for (const { idx } of candidateIndices) {
    if (totalChunks >= targetChunkCount) break;
    const word = allWords[idx];
    const sliced = sliceSingleWord(word, true);
    if (sliced.length > 1) {
      totalChunks += sliced.length - 1;
      currentChunks[idx] = sliced;
    }
  }

  // If still below minimum 14, split any remaining words of length 3 if needed
  if (totalChunks < 14) {
    for (let i = 0; i < allWords.length && totalChunks < 14; i++) {
      if (currentChunks[i].length === 1 && allWords[i].length === 3) {
        currentChunks[i] = [allWords[i].slice(0, 1), allWords[i].slice(1)];
        totalChunks += 1;
      }
    }
  }

  const flattened = currentChunks.flat();
  return flattened;
}

/**
 * Slices a single uppercase word at sorted 1-based cut positions (`1 .. word.length - 1`).
 */
export function sliceWordByCuts(word: string, cuts: readonly number[]): string[] {
  const clean = word.toUpperCase().replace(/[^A-Z]/g, "");
  if (!clean) return [];
  const validCuts = [...new Set(cuts)]
    .filter((c) => Number.isInteger(c) && c >= 1 && c < clean.length)
    .sort((a, b) => a - b);
  if (validCuts.length === 0) return [clean];
  const out: string[] = [];
  let start = 0;
  for (const cut of validCuts) {
    out.push(clean.slice(start, cut));
    start = cut;
  }
  out.push(clean.slice(start));
  return out;
}

/**
 * Builds structured line info with words and constituent chunks, honoring optional
 * editor-defined `customWordChunks` (`key = "${lineIdx}-${wordIdx}"`) when valid.
 */
export function buildStructuredHaikuLines(
  lines: [string, string, string],
  customWordChunks?: Record<string, string[]>
): HaikuLineInfo[] {
  const allWordsFlat = lines.flatMap((l) =>
    l
      .toUpperCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^A-Z]/g, ""))
      .filter(Boolean)
  );

  const candidateIndices = allWordsFlat
    .map((w, idx) => ({ idx, len: w.length }))
    .filter((item) => item.len >= 4)
    .sort((a, b) => b.len - a.len);

  let totalChunks = allWordsFlat.length;
  const splitSet = new Set<number>();
  for (const { idx } of candidateIndices) {
    if (totalChunks >= 16) break;
    splitSet.add(idx);
    totalChunks += 1;
  }

  let wordPointer = 0;
  return lines.map((line, lineIdx) => {
    const rawWords = line
      .toUpperCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^A-Z]/g, ""))
      .filter(Boolean);

    const words: HaikuWord[] = rawWords.map((word, wordIdx) => {
      const customKey = `${lineIdx}-${wordIdx}`;
      const override = customWordChunks?.[customKey];
      const overrideClean = override
        ?.map((c) => c.toUpperCase().replace(/[^A-Z]/g, ""))
        .filter(Boolean);
      const shouldSplit = splitSet.has(wordPointer);
      const chunks =
        overrideClean && overrideClean.length > 0 && overrideClean.join("") === word
          ? overrideClean
          : sliceSingleWord(word, shouldSplit);
      wordPointer++;
      return { text: word, chunks };
    });

    return {
      syllables: lineIdx === 1 ? 7 : 5,
      text: line.toUpperCase().trim(),
      words,
    };
  });
}

// ============================================================================
// 66 Hand-Crafted 5-7-5 Haiku Bank
// ============================================================================

export const RAW_HAIKU_BANK: Array<{
  theme: string;
  author: string;
  lines: [string, string, string];
}> = [
  // 1. Autumn Leaves
  {
    theme: "Autumn Leaves",
    author: "SOL Theory",
    lines: [
      "OLD GOLD AUTUMN LEAVES",
      "DRIFTING DOWN TO FROZEN SOIL",
      "WINTER REACHES IN",
    ],
  },
  // 2. Ocean Tide
  {
    theme: "Ocean Tide",
    author: "SOL Theory",
    lines: [
      "COASTAL WATERS RISE",
      "WHITE WAVES CRASH AGAINST THE SHORE",
      "PULLING SEAS AWAY",
    ],
  },
  // 3. Morning Light
  {
    theme: "Morning Light",
    author: "Words Desk",
    lines: [
      "SILVER MORNING MIST",
      "SUNLIGHT BREAKS ACROSS THE HILLS",
      "DAY BEGINS ANEW",
    ],
  },
  // 4. Quiet Rain
  {
    theme: "Quiet Rain",
    author: "SOL Theory",
    lines: [
      "SOFT RAIN ON THE ROOF",
      "GENTLE RHYTHM IN THE NIGHT",
      "WASHING CARES AWAY",
    ],
  },
  // 5. Brave Heart
  {
    theme: "Brave Heart",
    author: "SOL Theory",
    lines: [
      "STEP INTO THE WIND",
      "BRAVE HEARTS DO NOT FEAR THE DARK",
      "STAND AGAINST THE STORM",
    ],
  },
  // 6. Forest Solitude
  {
    theme: "Forest Solitude",
    author: "Daily Editorial",
    lines: [
      "TALL PINES STAND IN PEACE",
      "DEEP INTO THE QUIET WOODS",
      "NO ONE HERE BUT ME",
    ],
  },
  // 7. Starlight
  {
    theme: "Cosmic Starlight",
    author: "SOL Theory",
    lines: [
      "STARS ACROSS THE SKY",
      "BURNING BRIGHT IN ENDLESS NIGHT",
      "GUIDE ME ON MY WAY",
    ],
  },
  // 8. Cherry Blossom
  {
    theme: "Cherry Blossom",
    author: "SOL Theory",
    lines: [
      "PINK BUDS ON THE BOUGH",
      "PETALS FALLING IN THE SPRING",
      "EARTH AWAKES AGAIN",
    ],
  },
  // 9. First Snow
  {
    theme: "First Snow",
    author: "Daily Editorial",
    lines: [
      "WHITE FLAKES DRIFTING DOWN",
      "COVERING THE QUIET STREETS",
      "WORLD IS HUSHED IN SLEEP",
    ],
  },
  // 10. Golden Sun
  {
    theme: "Golden Sun",
    author: "SOL Theory",
    lines: [
      "WARM AIR ON MY FACE",
      "GOLDEN RAYS UPON THE LAKE",
      "TIME STANDS STILL TODAY",
    ],
  },
  // 11. High Peaks
  {
    theme: "High Peaks",
    author: "SOL Theory",
    lines: [
      "ROCKS OF ANCIENT STONE",
      "TOUCHING CLOUDS ABOVE THE VALE",
      "SILENT AND SERENE",
    ],
  },
  // 12. Flowing River
  {
    theme: "Flowing River",
    author: "Words Desk",
    lines: [
      "RIVER RUNS AHEAD",
      "CURRENTS CARRY ALL THE DREAMS",
      "TOWARD OCEAN BLUE",
    ],
  },
  // 13. Midnight Moon
  {
    theme: "Midnight Moon",
    author: "SOL Theory",
    lines: [
      "PALE MOON IN THE SKY",
      "SILVER LIGHT UPON THE PATH",
      "NIGHT CALLS ME TO REST",
    ],
  },
  // 14. Gentle Breeze
  {
    theme: "Gentle Breeze",
    author: "Daily Editorial",
    lines: [
      "COOL BREEZE IN THE TREES",
      "WHISPERS FROM A DISTANT LAND",
      "FLYING FAR AWAY",
    ],
  },
  // 15. Blooming Flowers
  {
    theme: "Blooming Flowers",
    author: "SOL Theory",
    lines: [
      "ROSES RED AND BRIGHT",
      "OPENING AT EARLY DAWN",
      "SWEET SCENT IN THE AIR",
    ],
  },
  // 16. Evening Solitude
  {
    theme: "Evening Solitude",
    author: "SOL Theory",
    lines: [
      "LAMP LIGHT GLOWS ALONE",
      "SHADOWS DANCE ABOUT THE ROOM",
      "QUIET IN MY MIND",
    ],
  },
  // 17. Campfire Glow
  {
    theme: "Campfire Glow",
    author: "Words Desk",
    lines: [
      "SPARKS THAT DANCE AND GLOW",
      "RISING UP INTO THE NIGHT",
      "WARMTH IN EVERY HEART",
    ],
  },
  // 18. Flight of Birds
  {
    theme: "Flight of Birds",
    author: "SOL Theory",
    lines: [
      "WINGS ACROSS THE BLUE",
      "FLYING TO THE SOUTHERN WARMTH",
      "FREEDOM IN THE SKY",
    ],
  },
  // 19. Desert Sands
  {
    theme: "Desert Sands",
    author: "Daily Editorial",
    lines: [
      "RED DUNES UNDER SUN",
      "WINDS THAT SHIFT THE GOLDEN SAND",
      "ENDLESS HORIZON",
    ],
  },
  // 20. Code & Signal
  {
    theme: "Code & Signal",
    author: "SOL Theory",
    lines: [
      "PULSE OF LIVING LIGHT",
      "SIGNALS FLOWING THROUGH THE DARK",
      "DREAMS AWAKE IN CODE",
    ],
  },
  // 21. Mirror Lake
  {
    theme: "Mirror Lake",
    author: "SOL Theory",
    lines: [
      "WATER STILL AND DEEP",
      "REFLECTING THE MORNING CLOUDS",
      "GLASS WITHOUT A WAVE",
    ],
  },
  // 22. Candle Flame
  {
    theme: "Candle Flame",
    author: "Words Desk",
    lines: [
      "TINY GOLDEN FLAME",
      "DANCING IN THE SILENT ROOM",
      "MELTING WAX AWAY",
    ],
  },
  // 23. Ancient Stones
  {
    theme: "Ancient Stones",
    author: "SOL Theory",
    lines: [
      "MOSS ON WEATHERED ROCK",
      "STANDING FIRM FOR THOUSAND YEARS",
      "SECRETS IN THE EARTH",
    ],
  },
  // 24. Bamboo Grove
  {
    theme: "Bamboo Grove",
    author: "Daily Editorial",
    lines: [
      "GREEN STALKS IN THE WIND",
      "BENDING LOW BUT NEVER BREAK",
      "PEACE AMONG THE LEAVES",
    ],
  },
  // 25. Temple Bell
  {
    theme: "Temple Bell",
    author: "SOL Theory",
    lines: [
      "DEEP BELL SOUNDS AT DUSK",
      "ECHOES DRIFTING OVER HILLS",
      "MINDS ARE FREE AND STILL",
    ],
  },
  // 26. Wandering Cloud
  {
    theme: "Wandering Cloud",
    author: "SOL Theory",
    lines: [
      "WHITE SHAPES IN THE AIR",
      "FLOATING SLOWLY THROUGH THE BLUE",
      "CHANGE WITH EVERY WIND",
    ],
  },
  // 27. Willow Branches
  {
    theme: "Willow Branches",
    author: "Words Desk",
    lines: [
      "SLENDER WILLOW BOUGHS",
      "SWAYING BY THE WATER STREAM",
      "DIPPING IN THE COOL",
    ],
  },
  // 28. Summer Rainstorm
  {
    theme: "Summer Rainstorm",
    author: "SOL Theory",
    lines: [
      "THUNDER IN THE SKY",
      "HEAVY DROPS UPON THE DUST",
      "EARTH DRINKS IN THE COOL",
    ],
  },
  // 29. Autumn Twilight
  {
    theme: "Autumn Twilight",
    author: "Daily Editorial",
    lines: [
      "ORANGE SKY TURNS RED",
      "CHILLED AIR ROLLS ACROSS THE GRASS",
      "NIGHT DESCENDS IN PEACE",
    ],
  },
  // 30. Dragonfly Wings
  {
    theme: "Dragonfly Wings",
    author: "SOL Theory",
    lines: [
      "CLEAR WINGS IN THE SUN",
      "HOVERING ABOVE THE POND",
      "DARTING OUT OF SIGHT",
    ],
  },
  // 31. Morning Dew
  {
    theme: "Morning Dew",
    author: "Words Desk",
    lines: [
      "PEARLS OF MORNING DEW",
      "SHINING ON THE BLADES OF GRASS",
      "MELTING WITH THE DAWN",
    ],
  },
  // 32. Frozen Pines
  {
    theme: "Frozen Pines",
    author: "SOL Theory",
    lines: [
      "ICE ON EVERGREEN",
      "SILVER NEEDLES IN DEEP COLD",
      "BEAUTY IN THE FROST",
    ],
  },
  // 33. Distant Thunder
  {
    theme: "Distant Thunder",
    author: "SOL Theory",
    lines: [
      "RUMBLE FROM AFAR",
      "PURPLE CLOUDS BEGIN TO FORM",
      "SMELL OF RAIN TO COME",
    ],
  },
  // 34. Silent Whispers
  {
    theme: "Silent Whispers",
    author: "Daily Editorial",
    lines: [
      "VOICES IN THE BREEZE",
      "SPEAKING WORDS FROM LONG AGO",
      "LOST AMONG THE LEAVES",
    ],
  },
  // 35. Mountain Stream
  {
    theme: "Mountain Stream",
    author: "SOL Theory",
    lines: [
      "COLD SPRINGS TUMBLE DOWN",
      "RUSHING OVER SMOOTH GRAY STONES",
      "SINGING TO THE TREES",
    ],
  },
  // 36. Evening Star
  {
    theme: "Evening Star",
    author: "Words Desk",
    lines: [
      "FIRST GEM IN THE WEST",
      "SHINING IN THE TWILIGHT GLOW",
      "BEACON IN THE NIGHT",
    ],
  },
  // 37. Lone Traveller
  {
    theme: "Lone Traveller",
    author: "SOL Theory",
    lines: [
      "LONG ROAD LIES AHEAD",
      "FOOTSTEPS ECHO IN THE COLD",
      "JOURNEY HAS NO END",
    ],
  },
  // 38. Shoreline Pebbles
  {
    theme: "Shoreline Pebbles",
    author: "SOL Theory",
    lines: [
      "SMOOTH STONES BY THE SEA",
      "WASHED BY TIDES A THOUSAND TIMES",
      "ROUNDED BY THE DEEP",
    ],
  },
  // 39. Crickets Singing
  {
    theme: "Crickets Singing",
    author: "Daily Editorial",
    lines: [
      "CHIRPING IN THE GRASS",
      "SONGS THAT FILL THE SUMMER NIGHT",
      "NATURES LULLABY", // Na-tures(2) lul-la-by(3) = 5
    ],
  },
  // 40. Winter Hearth
  {
    theme: "Winter Hearth",
    author: "SOL Theory",
    lines: [
      "LOGS UPON THE HEARTH",
      "CRACKLING IN A WARM EMBRACE",
      "SNOW FLIES IN THE DARK",
    ],
  },
  // 41. Rising Smoke
  {
    theme: "Rising Smoke",
    author: "Words Desk",
    lines: [
      "PALE THREAD IN THE AIR",
      "DRIFTING FROM A CABIN ROOF",
      "LOST IN MORNING SKY",
    ],
  },
  // 42. Deep Reflections
  {
    theme: "Deep Reflections",
    author: "SOL Theory",
    lines: [
      "LOOK INTO YOUR SOUL",
      "FIND THE PEACE BENEATH THE NOISE",
      "TRUTH WILL SET YOU FREE",
    ],
  },
  // 43. Moonlit Garden
  {
    theme: "Moonlit Garden",
    author: "SOL Theory",
    lines: [
      "FLOWERS SLEEP AT NIGHT",
      "SILVER PETALS IN THE MOON",
      "DREAMING OF THE SUN",
    ],
  },
  // 44. First Light
  {
    theme: "First Light",
    author: "Daily Editorial",
    lines: [
      "DARKNESS GIVES A WAY",
      "PINK AND GOLD UPON THE RIM",
      "HOPE AWAKES AGAIN",
    ],
  },
  // 45. Amber Lantern
  {
    theme: "Amber Lantern",
    author: "SOL Theory",
    lines: [
      "PAPER LANTERN GLOWS",
      "FLOATING GENTLY DOWN THE STREAM",
      "HOPE UPON THE NIGHT",
    ],
  },
  // 46. Rustling Grasses
  {
    theme: "Rustling Grasses",
    author: "Words Desk",
    lines: [
      "FIELDS OF GOLDEN HAY",
      "SWAYING AS THE WEST WIND BLOWS",
      "WAVES ACROSS THE LAND",
    ],
  },
  // 47. Hidden Meadow
  {
    theme: "Hidden Meadow",
    author: "SOL Theory",
    lines: [
      "SECRET GRASSY VALE",
      "WHERE THE DEER GRAZE FREE AND CALM",
      "SHELTERED FROM THE WORLD",
    ],
  },
  // 48. Cedar Shadows
  {
    theme: "Cedar Shadows",
    author: "SOL Theory",
    lines: [
      "BRANCHES EXTEND WIDE", // bran-ches(2) ex-tend(2) wide(1) = 5
      "CASTING SHADOWS ON THE GROUND", // cas-ting(2) sha-dows(2) on(1) the(1) ground(1) = 7
      "COOL BENEATH THE HEAT",
    ],
  },
  // 49. Flight of Fireflies
  {
    theme: "Firefly Glow",
    author: "Daily Editorial",
    lines: [
      "LIGHTS AMONG THE WEEDS",
      "TINY LANTERNS IN THE DUSK",
      "MAGIC IN THE AIR",
    ],
  },
  // 50. Still Lagoon
  {
    theme: "Still Lagoon",
    author: "SOL Theory",
    lines: [
      "CALM AND SHIFTING BLUE",
      "MIRROR FOR THE OPEN SKY",
      "SILENT REFUGE HERE",
    ],
  },
  // 51. Passing Season
  {
    theme: "Passing Season",
    author: "Words Desk",
    lines: [
      "DAYS GROW SHORT AND COOL",
      "SHADOWS LENGTHEN ON THE WALL",
      "AUTUMN CLOSES IN",
    ],
  },
  // 52. Sleeping Valley
  {
    theme: "Sleeping Valley",
    author: "SOL Theory",
    lines: [
      "FOG BLANKETS THE FLOOR",
      "VILLAGE SLEEPS BENEATH THE MIST",
      "REST UNTIL THE DAWN",
    ],
  },
  // 53. Neon Lights
  {
    theme: "Neon Lights",
    author: "SOL Theory",
    lines: [
      "GLOW OF URBAN STREETS",
      "LIGHTS REFLECT IN RAINY NIGHT",
      "CITY DOES NOT SLEEP",
    ],
  },
  // 54. Digital Dreams
  {
    theme: "Digital Dreams",
    author: "Daily Editorial",
    lines: [
      "PIXELS DANCE IN LIGHT",
      "WORLDS ARE BORN BEHIND THE GLASS",
      "MIND FLIES UNCONFINED",
    ],
  },
  // 55. Cosmic Voyage
  {
    theme: "Cosmic Voyage",
    author: "SOL Theory",
    lines: [
      "ACROSS VAST SILENCE", // A-cross(2) vast(1) si-lence(2) = 5
      "TRAVELLING BETWEEN THE STARS", // tra-vel-ling(3) be-tween(2) the(1) stars(1) = 7
      "SEARCHING FOR OUR HOME",
    ],
  },
  // 56. Mossy Pathway
  {
    theme: "Mossy Pathway",
    author: "Words Desk",
    lines: [
      "GREEN VELVET CARPET", // Green(1) vel-vet(2) car-pet(2) = 5
      "WINDING THROUGH THE ANCIENT OAKS", // wind-ing(2) through(1) the(1) an-cient(2) oaks(1) = 7
      "INVITING ME IN",
    ],
  },
  // 57. Autumn Harvest
  {
    theme: "Autumn Harvest",
    author: "SOL Theory",
    lines: [
      "APPLES RED AND RIPE",
      "BASKETS FULL OF NATURES GIFTS",
      "THANKFUL FOR THE CROP",
    ],
  },
  // 58. Morning Sunlight
  {
    theme: "Morning Sunlight",
    author: "SOL Theory",
    lines: [
      "FIRST RAYS PEAK THROUGH BLINDS",
      "GOLDEN STREAMS ACROSS THE FLOOR",
      "WAKING UP THE HOME",
    ],
  },
  // 59. Timeless River
  {
    theme: "Timeless River",
    author: "Daily Editorial",
    lines: [
      "WATER NEVER STOPS",
      "CARVING CANYONS IN THE ROCK",
      "PATIENT THROUGH THE YEARS",
    ],
  },
  // 60. Echoing Valley
  {
    theme: "Echoing Valley",
    author: "SOL Theory",
    lines: [
      "CALL INTO THE VOID",
      "VOICES BOUNCE FROM CLIFF TO CLIFF",
      "ANSWERS COME RIGHT BACK",
    ],
  },
  // 61. Silent Footsteps
  {
    theme: "Silent Footsteps",
    author: "Words Desk",
    lines: [
      "WALKING IN FRESH SNOW",
      "PRINTS BEHIND ON FROZEN SOIL",
      "NO SOUND IN THE AIR",
    ],
  },
  // 62. Gentle Ripples
  {
    theme: "Gentle Ripples",
    author: "SOL Theory",
    lines: [
      "PEBBLE DROPS IN POOL",
      "CIRCLES EXPAND TO THE SHORE", // cir-cles(2) ex-pand(2) to(1) the(1) shore(1) = 7
      "CALM RETURNS AGAIN",
    ],
  },
  // 63. Starlight Path
  {
    theme: "Starlight Path",
    author: "SOL Theory",
    lines: [
      "FOLLOW MILKY WAY",
      "BEACONS SHINE FOR MILES AROUND",
      "NIGHT WILL KEEP US SAFE",
    ],
  },
  // 64. Inner Courage
  {
    theme: "Inner Courage",
    author: "Daily Editorial",
    lines: [
      "FEAR MAY GRIP YOUR SOUL",
      "STILL YOU TAKE ANOTHER STEP",
      "LIGHT IS JUST AHEAD",
    ],
  },
  // 65. Moonlit Waters
  {
    theme: "Moonlit Waters",
    author: "SOL Theory",
    lines: [
      "TIDES REFLECT THE PEARL",
      "SILVER GLOW UPON THE DEEP",
      "OCEAN SINGS TO SLEEP",
    ],
  },
  // 66. Dawn of Hope
  {
    theme: "Dawn of Hope",
    author: "SOL Theory",
    lines: [
      "DARK MUST YIELD TO LIGHT",
      "PROMISE OF A BRAND NEW DAY",
      "HOPE IS BORN AGAIN",
    ],
  },
];

/**
 * Pre-computes 66 full SeventeenSyllablesPuzzle objects.
 */
export const SEVENTEEN_SYLLABLES_PUZZLES: SeventeenSyllablesPuzzle[] =
  RAW_HAIKU_BANK.map((item, index) => {
    const puzzleNumber = index + 1;
    const id = `17s-${String(puzzleNumber).padStart(3, "0")}`;
    const chunks = sliceHaikuIntoChunks(item.lines, 16);

    return {
      id,
      puzzleNumber,
      dateKey: `2026-11-${String(index + 1).padStart(2, "0")}`,
      theme: item.theme,
      author: item.author,
      lines: item.lines,
      chunks,
    };
  });

// ============================================================================
// Deterministic 2026–2027 Non-Repeating 5-7-5 Haiku Synthesis & Cache
// Every word in SYNTH_FIVE_OPENERS, SYNTH_SEVEN_MIDDLES, and SYNTH_FIVE_CLOSERS
// is strictly present in KNOWN_SYLLABLES and evaluates to [5, 7, 5] syllables.
// ============================================================================

const SYNTH_FIVE_OPENERS: ReadonlyArray<{ line: string; theme: string }> = [
  { line: "CLEAR BLUE MORNING SKY", theme: "Morning Sky" },
  { line: "PALE MOONLIGHT ON SNOW", theme: "Moonlight on Snow" },
  { line: "GREEN PINES IN THE MIST", theme: "Misty Pines" },
  { line: "WARM BREEZE THROUGH THE TREES", theme: "Woodland Breeze" },
  { line: "WILD WAVES ON THE SAND", theme: "Coastal Surf" },
  { line: "BRIGHT STARS IN THE NIGHT", theme: "Starlit Night" },
  { line: "COOL RAIN ON THE PATH", theme: "Rainy Pathway" },
  { line: "GOLD SUNSET AT DUSK", theme: "Golden Dusk" },
  { line: "SOFT DEW ON THE GRASS", theme: "Morning Dew" },
  { line: "TALL OAK ON THE HILL", theme: "Hilltop Oak" },
  { line: "DEEP LAKE IN THE WOODS", theme: "Forest Lake" },
  { line: "FRESH SNOW ON THE BOUGH", theme: "Winter Bough" },
  { line: "STILL POOL IN THE GROVE", theme: "Hidden Grove" },
  { line: "WHITE CLOUDS IN THE EAST", theme: "Eastern Horizon" },
  { line: "RED LEAVES IN THE WIND", theme: "Autumn Wind" },
  { line: "LONE SHIP ON THE SEA", theme: "Open Sea" },
  { line: "CALM HARBOR AT DAWN", theme: "Harbor Dawn" },
  { line: "SWEET SONG OF THE BIRDS", theme: "Birdsong" },
  { line: "PURE LIGHT OF THE MOON", theme: "Lunar Glow" },
  { line: "DARK CLOUDS OVER LAND", theme: "Passing Storm" },
  { line: "SLOW STREAM IN THE VALE", theme: "Valley Stream" },
  { line: "FIRST FROST ON THE FIELD", theme: "First Frost" },
  { line: "HIGH CLIFF BY THE SEA", theme: "Coastal Cliff" },
  { line: "WARM HEARTH IN THE ROOM", theme: "Evening Hearth" },
  { line: "SMOOTH STONE IN THE CREEK", theme: "Mountain Creek" },
  { line: "PINK BLOOM IN THE SPRING", theme: "Spring Blossom" },
  { line: "LONG ROAD TO THE NORTH", theme: "Northern Road" },
  { line: "WIDE SKY OVER HILLS", theme: "Open Hills" },
  { line: "COLD WIND FROM THE EAST", theme: "East Wind" },
  { line: "GENTLE EVENING BREEZE", theme: "Evening Calm" },
  { line: "SILENT MOUNTAIN TRAIL", theme: "Alpine Trail" },
  { line: "GOLDEN SUMMER DAY", theme: "Summer Warmth" },
  { line: "SILVER WINTER NIGHT", theme: "Winter Stillness" },
  { line: "QUIET FOREST PATH", theme: "Forest Solitude" },
  { line: "DISTANT THUNDER CALLS", theme: "Distant Thunder" },
  { line: "MORNING SUNLIGHT SHINES", theme: "First Sunlight" },
  { line: "CEDAR BRANCHES BLOOM", theme: "Cedar Grove" },
  { line: "AUTUMN GARDEN REST", theme: "Garden Peace" },
  { line: "STARLIGHT ON THE WAVE", theme: "Starlit Tide" },
  { line: "MEADOW IN THE SUN", theme: "Sunlit Meadow" },
];

const SYNTH_SEVEN_MIDDLES: readonly string[] = [
  "SHADOWS DRIFT ACROSS THE LAKE",
  "WATER RUNS INTO THE SEA",
  "SOFT WIND WHISPERS THROUGH THE GROVE",
  "SILVER RIPPLES ON THE POOL",
  "GOLDEN RAYS UPON THE HILL",
  "PETALS FALL UPON THE STONE",
  "STARLIGHT SHINES ACROSS THE DEEP",
  "DISTANT BELLS ACROSS THE VALE",
  "GENTLE WATERS WASH THE SAND",
  "MORNING DEW UPON THE LEAVES",
  "QUIET FOOTSTEPS ON THE TRAIL",
  "COOL WINDS CARRY SCENT OF PINE",
  "MOONLIGHT GLOWS UPON THE SNOW",
  "AUTUMN WINDS ACROSS THE FIELD",
  "BRIGHT SUN RISES IN THE EAST",
  "WILD BIRDS SING AMONG THE TREES",
  "DARK CLOUDS DRIFT BEYOND THE HILL",
  "SOFT LIGHT SHINES BENEATH THE BOUGHS",
  "SNOW IS FALLING ON THE ROAD",
  "GREEN MOSS SLEEPING ON THE ROCKS",
  "CLEAR STREAM RUNS BENEATH THE PINES",
  "WARM SUN SHINES UPON THE EARTH",
  "PALE FOG DRIFTING OVER SEAS",
  "LANTERN GLOWING IN THE DARK",
  "CRICKETS SINGING IN THE NIGHT",
  "FLOWERS OPENING IN SPRING",
  "CURRENTS PULLING TO THE DEEP",
  "ECHOES FLOATING THROUGH THE WOODS",
  "WILLOW SWAYING IN THE BREEZE",
  "CANDLE BURNING IN THE ROOM",
  "HARVEST MOON UPON THE SKY",
  "PEBBLES SHINING IN THE STREAM",
  "SEASONS PASSING ONE BY ONE",
  "VALLEY SLEEPING UNDER MIST",
  "CHERRY PETALS IN THE WIND",
  "COURAGE LIVING IN THE HEART",
];

const SYNTH_FIVE_CLOSERS: readonly string[] = [
  "PEACE IS IN THE HEART",
  "NIGHT IS CALM AND STILL",
  "LIGHT SHALL GUIDE OUR WAY",
  "DREAMS AWAKE TONIGHT",
  "EARTH IS QUIET NOW",
  "TIME IS FLOWING ON",
  "SPRING SHALL COME AGAIN",
  "REST BENEATH THE STARS",
  "DAWN SHALL RISE AGAIN",
  "HEARTS ARE SAFE AND WARM",
  "MIND IS CLEAR AND FREE",
  "JOY IS HERE TODAY",
  "LOVE SHALL NOT BE LOST",
  "SLEEP BENEATH THE MOON",
  "WALK ALONG THE ROAD",
  "LISTEN TO THE WIND",
  "SILENT IS THE NIGHT",
  "WATER SHINES LIKE GLASS",
  "SHADOWS FADE AWAY",
  "MORNING WAKES ANEW",
  "RIVER RUNS TO SEA",
  "OCEAN WAVES ARE STILL",
  "FOREST SHALL KEEP PEACE",
  "WINTER FADES TO SPRING",
  "SUMMER WARMTH IS HERE",
  "TWILIGHT CLOSES IN",
  "STARLIGHT ON THE PATH",
  "VALLEY IS AT REST",
  "MOUNTAINS STAND IN MIST",
  "ISLAND IN THE SUN",
  "CANYON GLOWS IN GOLD",
  "HARBOR LAMP IS BRIGHT",
  "HEAR THE TEMPLE BELL",
  "GARDEN BLOOMS AGAIN",
  "DESERT SKY IS CLEAR",
  "PATHWAY TO THE SEA",
  "ECHO OF THE PAST",
  "JOURNEY NOW BEGINS",
  "BEAUTY ALL AROUND",
  "WORLD IS WIDE AND BRIGHT",
];

const HAIKU_AUTHORS: readonly string[] = [
  "SOL Theory",
  "Daily Editorial",
  "Words Desk",
  "Poetry Curator",
];

const SYNTHESIZED_17_CACHE = new Map<string, SeventeenSyllablesPuzzle>();

/**
 * Returns a deterministic, [5, 7, 5] validated, non-repeating 17 Syllables puzzle for any dateKey.
 * - For `0 <= diff < 66` (`diff = daysBetweenDateKeys(ROTATION_ANCHOR, dateKey)`), returns `SEVENTEEN_SYLLABLES_PUZZLES[diff]`.
 * - For all other dates in 2026–2027 and beyond, deterministically constructs and caches a unique
 *   5-7-5 haiku where every word is in `KNOWN_SYLLABLES` and `chunks` has 14..20 items.
 */
export function get17SyllablesPuzzleForDate(
  dateKey: string = getLocalDateKey(),
  customOverrides?: Record<string, SeventeenSyllablesPuzzle>
): SeventeenSyllablesPuzzle {
  if (customOverrides && customOverrides[dateKey]) {
    return customOverrides[dateKey];
  }

  const puzzleNumber = getPuzzleNumberForDate(dateKey);
  const diff = daysBetweenDateKeys(ROTATION_ANCHOR, dateKey);
  if (diff >= 0 && diff < SEVENTEEN_SYLLABLES_PUZZLES.length) {
    const base = SEVENTEEN_SYLLABLES_PUZZLES[diff]!;
    return {
      ...base,
      puzzleNumber,
      dateKey,
    };
  }

  const cached = SYNTHESIZED_17_CACHE.get(dateKey);
  if (cached) {
    return {
      ...cached,
      puzzleNumber,
      dateKey,
    };
  }

  const seqIdx =
    diff >= SEVENTEEN_SYLLABLES_PUZZLES.length
      ? diff - SEVENTEEN_SYLLABLES_PUZZLES.length
      : 20000 - diff;

  const n1 = SYNTH_FIVE_OPENERS.length; // 40
  const n2 = SYNTH_SEVEN_MIDDLES.length; // 36
  const n3 = SYNTH_FIVE_CLOSERS.length; // 40
  const totalCombos = n1 * n2 * n3; // 57,600
  // 4147 is coprime to 57,600 (57600 = 2^8 * 3^2 * 5^2; 4147 = 11 * 13 * 29)
  const comboIdx = (seqIdx * 4147 + 19) % totalCombos;

  const i1 = comboIdx % n1;
  const i2 = Math.floor(comboIdx / n1) % n2;
  const i3 = Math.floor(comboIdx / (n1 * n2)) % n3;

  const opener = SYNTH_FIVE_OPENERS[i1]!;
  const middle = SYNTH_SEVEN_MIDDLES[i2]!;
  const closer = SYNTH_FIVE_CLOSERS[i3]!;
  const lines: [string, string, string] = [opener.line, middle, closer];
  const chunks = sliceHaikuIntoChunks(lines, 16);

  const synthesized: SeventeenSyllablesPuzzle = {
    id: `17s-bank-${dateKey}`,
    puzzleNumber,
    dateKey,
    theme: opener.theme,
    author: HAIKU_AUTHORS[seqIdx % HAIKU_AUTHORS.length]!,
    lines,
    chunks,
  };

  SYNTHESIZED_17_CACHE.set(dateKey, synthesized);
  return synthesized;
}

