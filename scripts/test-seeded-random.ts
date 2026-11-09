/**
 * Automated Verification Test Suite for Seeded PRNG & Payload Validation
 * Architecture: SOL GaMES (21games.ai) — Requirement R3 / Batch 1
 * Location: scripts/test-seeded-random.ts
 *
 * Runs via: node --experimental-strip-types scripts/test-seeded-random.ts
 */

import assert from "node:assert/strict";
import {
  createSeededRandom,
  createSeededRng,
  seededShuffle,
  computePuzzleContentHash,
  validateConnect5Payload,
  validate21ThingsPayload,
  fnv1a32,
  mulberry32,
  // @ts-expect-error Node ESM type-stripping requires explicit .ts extension
} from "../src/lib/seeded-random.ts";

let passedCount = 0;
let failedCount = 0;

function runTest(name: string, fn: () => void): void {
  try {
    fn();
    passedCount++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failedCount++;
    console.error(`  ✗ ${name}`);
    console.error(error);
  }
}

console.log("\n=======================================================");
console.log("TEST SUITE: Seeded PRNG & Payload Validation (R3)");
console.log("=======================================================\n");

// ---------------------------------------------------------------------------
// 1. FNV-1a & Mulberry32 Fundamentals
// ---------------------------------------------------------------------------
console.log("Section 1: FNV-1a Hashing & Mulberry32 PRNG Fundamentals");

runTest("fnv1a32 produces deterministic 32-bit unsigned integers", () => {
  const hash1 = fnv1a32("connect-5:2026-11-08");
  const hash2 = fnv1a32("connect-5:2026-11-08");
  assert.equal(hash1, hash2, "Identical inputs must yield identical hash");
  assert.ok(hash1 >= 0 && hash1 <= 4294967295, "Hash must be 32-bit unsigned");
  assert.ok(Number.isInteger(hash1), "Hash must be integer");

  const diffHash = fnv1a32("connect-5:2026-11-09");
  assert.notEqual(hash1, diffHash, "Different dateKey must produce different hash");
});

runTest("mulberry32 produces uniform numbers in [0, 1)", () => {
  const next = mulberry32(123456789);
  const sequence: number[] = [];
  for (let i = 0; i < 500; i++) {
    const val = next();
    assert.ok(val >= 0 && val < 1, `Value ${val} must be in [0, 1)`);
    sequence.push(val);
  }

  // Same seed produces exact same sequence
  const nextAgain = mulberry32(123456789);
  for (let i = 0; i < 500; i++) {
    assert.equal(nextAgain(), sequence[i], `Stream divergence at step ${i}`);
  }
});

// ---------------------------------------------------------------------------
// 2. PRNG Determinism & Distinctness
// ---------------------------------------------------------------------------
console.log("\nSection 2: PRNG Determinism & Cross-Date Distinctness");

runTest("createSeededRandom determinism: same slug + dateKey produces identical stream", () => {
  const rng1 = createSeededRandom("connect-5", "2026-11-08");
  const rng2 = createSeededRandom("connect-5", "2026-11-08");

  const stream1: number[] = [];
  const stream2: number[] = [];

  for (let i = 0; i < 200; i++) {
    stream1.push(rng1());
    stream2.push(rng2());
  }

  assert.deepEqual(stream1, stream2, "Both streams must match completely across 200 samples");
});

runTest("createSeededRng alias matches createSeededRandom", () => {
  const rngA = createSeededRng("alias-test", "2026-11-08");
  const rngB = createSeededRandom("alias-test", "2026-11-08");
  assert.equal(rngA(), rngB(), "createSeededRng and createSeededRandom must produce identical outputs");
});

runTest("PRNG distinctness across different dates for same slug", () => {
  const rngToday = createSeededRandom("connect-5", "2026-11-08");
  const rngTomorrow = createSeededRandom("connect-5", "2026-11-09");

  const todayNums = Array.from({ length: 50 }, () => rngToday());
  const tomorrowNums = Array.from({ length: 50 }, () => rngTomorrow());

  assert.notDeepEqual(todayNums, tomorrowNums, "Consecutive days must produce distinct sequences");
});

runTest("PRNG distinctness across different game slugs on the same date", () => {
  const rngC5 = createSeededRandom("connect-5", "2026-11-08");
  const rng21 = createSeededRandom("21-things", "2026-11-08");

  const c5Nums = Array.from({ length: 50 }, () => rngC5());
  const t21Nums = Array.from({ length: 50 }, () => rng21());

  assert.notDeepEqual(c5Nums, t21Nums, "Different game slugs on same date must produce distinct streams");
});

runTest("SeededRandomGenerator helper methods (nextInt, pick, sample)", () => {
  const rng = createSeededRandom("connect-5", "2026-11-08");

  // nextInt
  for (let i = 0; i < 100; i++) {
    const intVal = rng.nextInt(5, 12);
    assert.ok(intVal >= 5 && intVal <= 12, `nextInt(${intVal}) out of bounds [5, 12]`);
    assert.ok(Number.isInteger(intVal), "nextInt must be integer");
  }

  // pick
  const letters = ["A", "B", "C", "D", "E"];
  const picked = rng.pick(letters);
  assert.ok(letters.includes(picked), "pick must select an item from array");

  // sample
  const sampled = rng.sample(letters, 3);
  assert.equal(sampled.length, 3, "sample count must match requested length");
  sampled.forEach((item) => assert.ok(letters.includes(item), "sample item must exist in source"));
});

// ---------------------------------------------------------------------------
// 3. Seeded Shuffle Permutations
// ---------------------------------------------------------------------------
console.log("\nSection 3: Seeded Fisher-Yates Shuffle Validation");

runTest("seededShuffle preserves all elements without loss or duplication", () => {
  const source = ["ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT", "GOLF"];
  const rng = createSeededRandom("shuffle-test", "2026-11-08");

  const shuffled = seededShuffle(source, rng);

  // Must not mutate source
  assert.equal(source[0], "ALPHA", "Original array must not be mutated");
  assert.equal(source.length, 7, "Original array length preserved");

  // Must have same length and same multiset of elements
  assert.equal(shuffled.length, source.length, "Shuffled array must have identical length");
  assert.deepEqual(
    [...shuffled].sort(),
    [...source].sort(),
    "Shuffled array must contain the exact same elements as source"
  );
});

runTest("seededShuffle is deterministic for the same seed", () => {
  const source = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const rng1 = createSeededRandom("determinism-test", "2026-11-08");
  const rng2 = createSeededRandom("determinism-test", "2026-11-08");

  const shuffle1 = seededShuffle(source, rng1);
  const shuffle2 = seededShuffle(source, rng2);

  assert.deepEqual(shuffle1, shuffle2, "Identical seeds must produce identical permutations");
});

runTest("seededShuffle handles boundary arrays (empty and single element)", () => {
  const rng = createSeededRandom("boundary-test", "2026-11-08");

  const empty = seededShuffle([], rng);
  assert.deepEqual(empty, [], "Empty array shuffle must return empty array");

  const single = seededShuffle(["SOLO"], rng);
  assert.deepEqual(single, ["SOLO"], "Single-element array shuffle must return single element");
});

// ---------------------------------------------------------------------------
// 4. Runtime Payload Validation: Connect 5
// ---------------------------------------------------------------------------
console.log("\nSection 4: Runtime Payload Validation — Connect 5");

const validConnect5Puzzle = {
  id: "c5-test-1",
  puzzleNumber: 1,
  title: "Desk to Breeze",
  words: ["MOUSE", "PAD", "LOCK", "DOWN", "WIND"],
  connections: [
    "MOUSE PAD — surface",
    "PADLOCK — security",
    "LOCKDOWN — containment",
    "DOWNWIND — breeze direction",
  ],
  revealedHints: [
    { row: 1, col: 0 },
    { row: 3, col: 2 },
  ],
  author: "SOL Theory",
  editor: "Daily Editorial",
};

runTest("validateConnect5Payload accepts canonical valid puzzle", () => {
  const result = validateConnect5Payload(validConnect5Puzzle);
  assert.equal(result.valid, true, "Valid puzzle must pass validation");
  assert.equal(result.errors.length, 0, "Errors array must be empty");
  assert.ok(result.puzzle, "Typed puzzle must be returned");
});

runTest("validateConnect5Payload rejects null or non-object payloads", () => {
  assert.equal(validateConnect5Payload(null).valid, false);
  assert.equal(validateConnect5Payload(undefined).valid, false);
  assert.equal(validateConnect5Payload("not a puzzle").valid, false);
  assert.equal(validateConnect5Payload([1, 2, 3]).valid, false);
});

runTest("validateConnect5Payload rejects incorrect word count", () => {
  const badWords4 = {
    ...validConnect5Puzzle,
    words: ["MOUSE", "PAD", "LOCK", "DOWN"], // only 4 words
  };
  const res = validateConnect5Payload(badWords4);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("must contain exactly 5 words")));
});

runTest("validateConnect5Payload rejects lowercase or non-alphabetic words", () => {
  const badWordsAlpha = {
    ...validConnect5Puzzle,
    words: ["MOUSE", "PAD1", "LOCK", "DOWN", "WIND"], // number in PAD1
  };
  const res = validateConnect5Payload(badWordsAlpha);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("contain uppercase letters A-Z only")));
});

runTest("validateConnect5Payload rejects hint coordinates targeting Row 0", () => {
  const badHintRow0 = {
    ...validConnect5Puzzle,
    revealedHints: [{ row: 0, col: 1 }],
  };
  const res = validateConnect5Payload(badHintRow0);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("Row 1 is 100% revealed by definition")));
});

runTest("validateConnect5Payload rejects hint coordinates out of word column bounds", () => {
  const badHintCol = {
    ...validConnect5Puzzle,
    // Row 1 is "PAD" (length 3, valid cols 0..2)
    revealedHints: [{ row: 1, col: 5 }],
  };
  const res = validateConnect5Payload(badHintCol);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("out of range for word 'PAD'")));
});

runTest("validateConnect5Payload rejects incorrect connections count", () => {
  const badConn = {
    ...validConnect5Puzzle,
    connections: ["MOUSE PAD", "PADLOCK"], // only 2
  };
  const res = validateConnect5Payload(badConn);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("must contain exactly 4 bridges")));
});

// ---------------------------------------------------------------------------
// 5. Runtime Payload Validation: 21 Things
// ---------------------------------------------------------------------------
console.log("\nSection 5: Runtime Payload Validation — 21 Things");

const valid21ThingsBoard = {
  id: "21t-test-1",
  puzzleNumber: 1,
  title: "Everyday Magic",
  creatorName: "SOL Theory",
  creatorHandle: "@SOLTheory",
  creatorBio: "Small joys of life.",
  items: [
    "Two-colored dog eyes",
    "Vintage VW Beetles",
    "Morning coffee smell",
    "Warm laundry out of dryer",
    "Rain on a tin roof",
    "Freshly baked sourdough",
    "Green lights all the way",
    "First sip of cold water",
    "Sunlight through pine trees",
    "Vinyl crackle before song",
    "Handwritten thank-you notes",
    "Golden hour ocean breeze",
    "Laughing till stomach hurts",
    "Finding cash in old coat",
    "Crisp autumn leaf crunch",
    "Peeling a Clementine whole",
    "Late-night diner pancakes",
    "Cool side of the pillow",
    "Smell of old books",
    "Waves breaking on shore",
    "Stargazing on a clear night",
  ],
  sampleJourneys: [],
};

runTest("validate21ThingsPayload accepts canonical 21-item board", () => {
  const result = validate21ThingsPayload(valid21ThingsBoard);
  assert.equal(result.valid, true, "Valid 21-things board must pass validation");
  assert.equal(result.errors.length, 0);
  assert.ok(result.board);
});

runTest("validate21ThingsPayload rejects board with fewer or more than 21 items", () => {
  const badCount = {
    ...valid21ThingsBoard,
    items: valid21ThingsBoard.items.slice(0, 20), // 20 items
  };
  const res = validate21ThingsPayload(badCount);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("must contain exactly 21 gratitude items")));
});

runTest("validate21ThingsPayload rejects blank items", () => {
  const itemsWithBlank = [...valid21ThingsBoard.items];
  itemsWithBlank[4] = "   ";
  const res = validate21ThingsPayload({
    ...valid21ThingsBoard,
    items: itemsWithBlank,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("cannot be blank")));
});

runTest("validate21ThingsPayload rejects overly long items (> 50 chars)", () => {
  const itemsWithLong = [...valid21ThingsBoard.items];
  itemsWithLong[0] = "This item is intentionally made ridiculously long so that it exceeds the fifty character limit";
  const res = validate21ThingsPayload({
    ...valid21ThingsBoard,
    items: itemsWithLong,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("too long")));
});

// ---------------------------------------------------------------------------
// 6. Deterministic Content Hash (computePuzzleContentHash)
// ---------------------------------------------------------------------------
console.log("\nSection 6: Deterministic Content Hash Validation");

runTest("computePuzzleContentHash produces identical hash for identical payloads", () => {
  const hash1 = computePuzzleContentHash(validConnect5Puzzle);
  const hash2 = computePuzzleContentHash(validConnect5Puzzle);
  assert.equal(hash1, hash2, "Identical payloads must yield identical content hash");
  assert.ok(hash1.startsWith("c5:h-"), "Connect 5 hash prefix check");
});

runTest("computePuzzleContentHash detects word modification in Connect 5", () => {
  const originalHash = computePuzzleContentHash(validConnect5Puzzle);

  const modifiedPuzzle = {
    ...validConnect5Puzzle,
    words: ["HOUSE", "PAD", "LOCK", "DOWN", "WIND"], // MOUSE -> HOUSE
  };
  const modifiedHash = computePuzzleContentHash(modifiedPuzzle);

  assert.notEqual(
    originalHash,
    modifiedHash,
    "Changing a single word must alter content hash"
  );
});

runTest("computePuzzleContentHash detects item modification in 21 Things", () => {
  const originalHash = computePuzzleContentHash(valid21ThingsBoard);

  const modifiedItems = [...valid21ThingsBoard.items];
  modifiedItems[0] = "Three-colored cat eyes";
  const modifiedBoard = {
    ...valid21ThingsBoard,
    items: modifiedItems,
  };
  const modifiedHash = computePuzzleContentHash(modifiedBoard);

  assert.notEqual(
    originalHash,
    modifiedHash,
    "Changing a 21-things item must alter content hash"
  );
  assert.ok(originalHash.startsWith("21t:h-"), "21 Things hash prefix check");
});

runTest("computePuzzleContentHash ignores transient timestamps like updated_at", () => {
  const base = { ...validConnect5Puzzle };
  const withTimestamp1 = { ...base, updated_at: "2026-11-08T10:00:00Z" };
  const withTimestamp2 = { ...base, updated_at: "2026-11-08T12:00:00Z" };

  const hash1 = computePuzzleContentHash(withTimestamp1);
  const hash2 = computePuzzleContentHash(withTimestamp2);

  assert.equal(
    hash1,
    hash2,
    "Transient updated_at differences must not change puzzle content hash"
  );
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log("\n=======================================================");
console.log(`Results: ${passedCount} passed, ${failedCount} failed`);
console.log("=======================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log("All Seeded PRNG & Payload Validation tests PASSED!\n");
}
