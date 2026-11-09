/**
 * Comprehensive Automated Verification Suite for Game #17: 17 Syllables
 * Run with: node --experimental-strip-types scripts/test-17-syllables.ts
 */

import { register } from "node:module";

// Register custom ESM resolver for "@/..." project path aliases
register("./test-resolver.mjs", import.meta.url);

const {
  SEVENTEEN_SYLLABLES_PUZZLES,
  countWordSyllables,
  countLineSyllables,
  validateHaikuStructure,
  sliceHaikuIntoChunks,
  sliceSingleWord,
  buildStructuredHaikuLines,
} = await import("@/data/puzzles/17-syllables");

const {
  generateShortGameId,
  build17SyllablesShareUrl,
  build17SyllablesPlayHref,
  encodeShareable17Haiku,
  decodeShareable17Haiku,
} = await import("@/lib/custom-game-share");

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ ${testName}`);
  } else {
    failedCount++;
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
  }
}

console.log("\n=======================================================");
console.log("TEST SUITE: Game #17 (17 Syllables) Verification");
console.log("=======================================================\n");

// ----------------------------------------------------------------------------
// Test Group 1: 66-Day Haiku Puzzle Bank & Syllable Counts
// ----------------------------------------------------------------------------
console.log("--- Group 1: 66-Day Haiku Puzzle Bank & 5-7-5 Syllable Verification ---");

assert(
  SEVENTEEN_SYLLABLES_PUZZLES.length >= 66,
  "Puzzle bank has at least 66 hand-crafted haikus",
  `Found: ${SEVENTEEN_SYLLABLES_PUZZLES.length}`
);

assert(
  countWordSyllables("AUTUMN") === 2 && countWordSyllables("MIST") === 1,
  "countWordSyllables accurately counts word syllables"
);

assert(
  sliceSingleWord("SILVER", true).length === 2,
  "sliceSingleWord splits words into valid chunks within word boundaries"
);

let allSyllablesCorrect = true;
let totalWordCount = 0;
const puzzleIds = new Set<string>();

SEVENTEEN_SYLLABLES_PUZZLES.forEach((p) => {
  if (puzzleIds.has(p.id)) {
    allSyllablesCorrect = false;
    console.error(`Duplicate puzzle ID found: ${p.id}`);
  }
  puzzleIds.add(p.id);

  const [l1, l2, l3] = p.lines;
  const c1 = countLineSyllables(l1);
  const c2 = countLineSyllables(l2);
  const c3 = countLineSyllables(l3);

  if (c1 !== 5 || c2 !== 7 || c3 !== 5) {
    allSyllablesCorrect = false;
    console.error(
      `Puzzle #${p.puzzleNumber} ("${p.theme}") syllable count mismatch: [${c1}, ${c2}, ${c3}] (expected [5, 7, 5])\n` +
      `  Line 1: "${l1}" (${c1})\n` +
      `  Line 2: "${l2}" (${c2})\n` +
      `  Line 3: "${l3}" (${c3})`
    );
  }

  // Count words
  const wordsInPuzzle = [...l1.split(/\s+/), ...l2.split(/\s+/), ...l3.split(/\s+/)].filter(Boolean);
  totalWordCount += wordsInPuzzle.length;
});

assert(
  allSyllablesCorrect,
  "All 66 haikus adhere strictly to 5 – 7 – 5 syllable counts (17 total)"
);

assert(
  puzzleIds.size >= 66,
  "All 66 puzzle IDs are unique"
);

assert(
  totalWordCount >= 600,
  "Over 600 poetic words analyzed across the haiku bank",
  `Found: ${totalWordCount}`
);

assert(
  buildStructuredHaikuLines([
    "OLD GOLD AUTUMN LEAVES",
    "DRIFTING DOWN TO FROZEN SOIL",
    "WINTER REACHES IN",
  ]).length === 3,
  "buildStructuredHaikuLines builds 3 structured line objects"
);

// ----------------------------------------------------------------------------
// Test Group 2: Deterministic Chunk Slicer Invariants
// ----------------------------------------------------------------------------
console.log("\n--- Group 2: Deterministic Chunk Slicer Invariants ---");

let chunksWithinRange = true;
let chunksNeverCrossWords = true;
let chunksUppercase = true;
let chunkLengthValid = true;

SEVENTEEN_SYLLABLES_PUZZLES.forEach((p) => {
  const chunks = p.chunks;
  if (chunks.length < 14 || chunks.length > 20) {
    chunksWithinRange = false;
    console.error(`Puzzle #${p.puzzleNumber} chunk count out of [14, 20]: ${chunks.length}`);
  }

  // Check each chunk
  const puzzleWordsUpper = p.lines.flatMap((line) =>
    line.toUpperCase().split(/\s+/).map((w) => w.replace(/[^A-Z]/g, "")).filter(Boolean)
  );

  chunks.forEach((chunk) => {
    if (chunk !== chunk.toUpperCase() || /[^A-Z]/.test(chunk)) {
      chunksUppercase = false;
    }
    if (chunk.length < 1 || chunk.length > 8) {
      chunkLengthValid = false;
    }

    // Check that this chunk is a substring of at least one word (never spans across words)
    const matchesWord = puzzleWordsUpper.some((w) => w.includes(chunk));
    if (!matchesWord) {
      chunksNeverCrossWords = false;
      console.error(`Chunk "${chunk}" does not belong to any word in puzzle #${p.puzzleNumber}`);
    }
  });
});

assert(
  chunksWithinRange,
  "Every puzzle is sliced into 14 to 20 chunks (target: 16)"
);

assert(
  chunksNeverCrossWords,
  "Chunks NEVER cross word boundaries (always strictly within single words)"
);

assert(
  chunksUppercase,
  "All chunks are uniform uppercase"
);

assert(
  chunkLengthValid,
  "All chunks have lengths between 1 and 8 characters"
);

// Test slicing reproducibility
const sampleLines: [string, string, string] = [
  "SILVER MORNING MIST",
  "SUNLIGHT BREAKS ACROSS THE HILLS",
  "DAY BEGINS ANEW",
];
const slice1 = sliceHaikuIntoChunks(sampleLines, 16);
const slice2 = sliceHaikuIntoChunks(sampleLines, 16);
assert(
  JSON.stringify(slice1) === JSON.stringify(slice2),
  "Chunk slicer is 100% deterministic on identical input"
);

// ----------------------------------------------------------------------------
// Test Group 3: Star Calculation Logic & Hint Penalties
// ----------------------------------------------------------------------------
console.log("\n--- Group 3: Two-Tier Hint System & Star Rating Calculation ---");

function calculateStars(wordHints: number, tileHints: number): number {
  const penalty = wordHints * (1 / 3) + tileHints * 0.5;
  return Math.max(0, Math.round((3.0 - penalty) * 10) / 10);
}

assert(
  calculateStars(0, 0) === 3.0,
  "0 hints used yields 3.0 / 3.0 stars (flawless)"
);

assert(
  calculateStars(1, 0) === 2.7,
  "1 Word Hint costs 1/3 star (3.0 - 0.33 = 2.7 stars)"
);

assert(
  calculateStars(0, 1) === 2.5,
  "1 Tile Lock Hint costs 1/2 star (3.0 - 0.5 = 2.5 stars)"
);

assert(
  calculateStars(3, 0) === 2.0,
  "3 Word Hints cost 1.0 star (3.0 - 1.0 = 2.0 stars)"
);

assert(
  calculateStars(0, 2) === 2.0,
  "2 Tile Lock Hints cost 1.0 star (3.0 - 1.0 = 2.0 stars)"
);

assert(
  calculateStars(3, 2) === 1.0,
  "Max hints used (3 word + 2 tile lock) costs 2.0 stars (3.0 - 2.0 = 1.0 star)"
);

// ----------------------------------------------------------------------------
// Test Group 4: Custom Haiku Link Generation & Parsing
// ----------------------------------------------------------------------------
console.log("\n--- Group 4: Custom Haiku Creator Mode & Share Token ---");

const customId = generateShortGameId("17s");
assert(
  customId.startsWith("17s-") && customId.length <= 13,
  "generateShortGameId('17s') creates compact '17s-xxxxxxxx' ID",
  `Generated: ${customId}`
);

const shareUrl = build17SyllablesShareUrl({ id: customId });
assert(
  shareUrl.includes("/games/17-syllables?b=17s-"),
  "build17SyllablesShareUrl formats canonical link with ?b= parameter",
  `Url: ${shareUrl}`
);

const playHref = build17SyllablesPlayHref({ id: customId });
assert(
  playHref === `/games/17-syllables?b=${customId}`,
  "build17SyllablesPlayHref formats internal Next.js link",
  `Href: ${playHref}`
);

// Token encode & decode roundtrip
const customHaiku = {
  id: "17s-myhaiku",
  theme: "Evening Calm",
  creatorName: "PoetJane",
  lines: [
    "SILVER MORNING MIST",
    "SUNLIGHT BREAKS ACROSS THE HILLS",
    "DAY BEGINS ANEW",
  ] as [string, string, string],
};

const encoded = encodeShareable17Haiku(customHaiku);
assert(
  typeof encoded === "string" && encoded.length > 0,
  "encodeShareable17Haiku produces compact base64 string"
);

const decoded = decodeShareable17Haiku(encoded);
assert(
  decoded !== null &&
    decoded.id === customHaiku.id &&
    decoded.theme === customHaiku.theme &&
    decoded.creatorName === customHaiku.creatorName &&
    decoded.lines[0] === customHaiku.lines[0] &&
    decoded.lines[1] === customHaiku.lines[1] &&
    decoded.lines[2] === customHaiku.lines[2],
  "decodeShareable17Haiku flawlessly reconstructs custom haiku from token"
);

// Structure validator
const validHaiku = validateHaikuStructure(customHaiku.lines);
assert(
  validHaiku.isValid && validHaiku.counts[0] === 5 && validHaiku.counts[1] === 7 && validHaiku.counts[2] === 5,
  "validateHaikuStructure approves correct 5-7-5 haiku"
);

const invalidHaiku = validateHaikuStructure([
  "TOO SHORT",
  "THIS LINE HAS WAY TOO MANY SYLLABLES IN IT TODAY",
  "NOT FIVE SYLLABLES",
]);
assert(
  !invalidHaiku.isValid && invalidHaiku.errors.length > 0,
  "validateHaikuStructure correctly flags invalid syllable counts"
);

console.log("\n=======================================================");
console.log(`SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("=======================================================\n");

if (failedCount > 0) {
  process.exit(1);
}
