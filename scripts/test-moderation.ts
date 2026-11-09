/**
 * Automated Verification Test Suite for Content Moderation Engine
 * Architecture: SOL GaMES (21games.ai) — Requirement R2 / Batch 1
 * Location: scripts/test-moderation.ts
 *
 * Runs via: node --experimental-strip-types scripts/test-moderation.ts
 */

import assert from "node:assert/strict";
import {
  checkContentModeration,
  checkMultipleFields,
  check21ThingsBoardModeration,
  checkConnect5PuzzleModeration,
  checkUserProfileModeration,
  normalizeForModeration,
  type ModerationMode,
  // @ts-expect-error Node ESM type-stripping requires explicit .ts extension
} from "../src/lib/moderation.ts";

interface TestCase {
  id: string;
  category: string;
  text: string;
  mode: ModerationMode;
  expectedAllowed: boolean;
  expectedTier?: 1 | 2;
  description: string;
}

const testCases: TestCase[] = [
  // --- Tier 1: Universal Ban (Direct) ---
  {
    id: "T1.1",
    category: "Tier 1 Slur (Direct)",
    text: "You are a nigger",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Universal ban on racial slurs in public mode",
  },
  {
    id: "T1.2",
    category: "Tier 1 Slur (Private)",
    text: "You are a nigger",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Universal ban on racial slurs in private custom mode",
  },
  {
    id: "T1.3",
    category: "Tier 1 Anti-Semitic Slur",
    text: "Shut up kike",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Universal ban on anti-semitic slurs in public mode",
  },
  {
    id: "T1.4",
    category: "Tier 1 LGBTQ+ Slur",
    text: "What a faggot",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Universal ban on LGBTQ+ slurs in private custom mode",
  },
  {
    id: "T1.5",
    category: "Tier 1 Ableist Slur",
    text: "Don't be a retard",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Universal ban on ableist slurs in public mode",
  },

  // --- Tier 2: Public Mode Block vs Private Mode Permitted ---
  {
    id: "T2.1",
    category: "Tier 2 Profanity (Public)",
    text: "Damn good coffee",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 2,
    description: "Block casual profanity in public mode",
  },
  {
    id: "T2.2",
    category: "Tier 2 Profanity (Private)",
    text: "Damn good coffee",
    mode: "private",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "Permit casual profanity in private custom game",
  },
  {
    id: "T2.3",
    category: "Tier 2 Vulgarity (Public)",
    text: "This puzzle is shit",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 2,
    description: "Block vulgarity in public mode",
  },
  {
    id: "T2.4",
    category: "Tier 2 Vulgarity (Private)",
    text: "This puzzle is shit",
    mode: "private",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "Permit vulgarity in private custom game",
  },
  {
    id: "T2.5",
    category: "Tier 2 Vulgarity (Public)",
    text: "What the fuck",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 2,
    description: "Block swearing in public mode",
  },
  {
    id: "T2.6",
    category: "Tier 2 Vulgarity (Private)",
    text: "What the fuck",
    mode: "private",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "Permit swearing in private custom game",
  },

  // --- Obfuscation Evasion ---
  {
    id: "OB.1",
    category: "Obfuscation (Leetspeak Numbers)",
    text: "n1gg3r",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Leetspeak numbers 1->i, 3->e mapped to slur",
  },
  {
    id: "OB.2",
    category: "Obfuscation (Leetspeak Symbols)",
    text: "sh!t happens",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 2,
    description: "Leetspeak symbol !->i in profanity",
  },
  {
    id: "OB.3",
    category: "Obfuscation (Leetspeak Currency)",
    text: "What an a$$hole",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 2,
    description: "Leetspeak currency $$->ss in profanity",
  },
  {
    id: "OB.4",
    category: "Obfuscation (Dotted Separators)",
    text: "n.i.g.g.e.r",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Dotted interleaving blocked in private mode",
  },
  {
    id: "OB.5",
    category: "Obfuscation (Underscore Separators)",
    text: "f_a_g_g_o_t",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Underscore interleaving blocked in private mode",
  },
  {
    id: "OB.6",
    category: "Obfuscation (Space Separators)",
    text: "k i k e",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Spaced single letter slur blocked in public mode",
  },
  {
    id: "OB.7",
    category: "Obfuscation (Cyrillic Homoglyphs)",
    text: "nіggеr",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Cyrillic і and е homoglyphs normalized to slur",
  },
  {
    id: "OB.8",
    category: "Obfuscation (Fullwidth Latin)",
    text: "ｓｈｉｔ",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 2,
    description: "Fullwidth unicode normalized to ASCII profanity",
  },
  {
    id: "OB.9",
    category: "Obfuscation (Circled Letters)",
    text: "ⓕⓤⓒⓚ",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 2,
    description: "Circled unicode normalized to ASCII profanity",
  },
  {
    id: "OB.10",
    category: "Obfuscation (Letter Flooding)",
    text: "fuuuuuuuck",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 2,
    description: "Flooded letters collapsed to match profanity",
  },
  {
    id: "OB.11",
    category: "Obfuscation (Zero-Width Space)",
    text: "n\u200Bi\u200Bg\u200Bg\u200Be\u200Br",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Zero-width characters stripped to reveal slur",
  },

  // --- False Positive Prevention (Scunthorpe Allowlist) ---
  {
    id: "FP.1",
    category: "False Positive (ass substring)",
    text: "Glass of ice water",
    mode: "public",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "'glass' never blocked",
  },
  {
    id: "FP.2",
    category: "False Positive (ass substring)",
    text: "Pass the test easily",
    mode: "public",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "'pass' never blocked",
  },
  {
    id: "FP.3",
    category: "False Positive (ass substring)",
    text: "Classic rock vinyl",
    mode: "public",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "'classic' never blocked",
  },
  {
    id: "FP.4",
    category: "False Positive (ass substring)",
    text: "Fresh green grass",
    mode: "public",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "'grass' never blocked",
  },
  {
    id: "FP.5",
    category: "False Positive (cock substring)",
    text: "Peacock feathers",
    mode: "public",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "'peacock' never blocked",
  },
  {
    id: "FP.6",
    category: "False Positive (cock substring)",
    text: "Evening cocktail hour",
    mode: "public",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "'cocktail' never blocked",
  },
  {
    id: "FP.7",
    category: "False Positive (dick substring)",
    text: "Charles Dickens novel",
    mode: "public",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "'dickens' never blocked",
  },
  {
    id: "FP.8",
    category: "False Positive (cunt substring)",
    text: "Visit Scunthorpe city",
    mode: "public",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "'scunthorpe' never blocked",
  },
  {
    id: "FP.9",
    category: "False Positive (tit substring)",
    text: "Gratitude title",
    mode: "public",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "'title' and 'gratitude' never blocked",
  },
  {
    id: "FP.10",
    category: "False Positive (shit substring)",
    text: "Shiitake mushroom broth",
    mode: "public",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "'shiitake' never blocked",
  },

  // --- Clean Text ---
  {
    id: "CL.1",
    category: "Clean Text (21 Tile)",
    text: "Two-colored dog eyes",
    mode: "public",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "Everyday game tile permitted",
  },
  {
    id: "CL.2",
    category: "Clean Text (Connect 5 Clue)",
    text: "MOUSE PAD — cushioned",
    mode: "public",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "Compound clue permitted",
  },
  {
    id: "CL.3",
    category: "Clean Text (Profile Name)",
    text: "Alex Morgan",
    mode: "public",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "Clean display name permitted",
  },
  {
    id: "CL.4",
    category: "Clean Text (Handle)",
    text: "@solplayer",
    mode: "public",
    expectedAllowed: true,
    expectedTier: undefined,
    description: "Clean handle permitted",
  },
];

console.log("=================================================");
console.log(" 21 Games Content Moderation Engine Test Suite");
console.log("=================================================\n");

let passedCount = 0;
let failedCount = 0;

for (const tc of testCases) {
  const result = checkContentModeration(tc.text, { mode: tc.mode });
  const isAllowedMatch = result.allowed === tc.expectedAllowed;
  const isTierMatch = tc.expectedTier === undefined
    ? result.tier === undefined
    : result.tier === tc.expectedTier;

  if (isAllowedMatch && isTierMatch) {
    passedCount++;
    console.log(`[PASS] ${tc.id.padEnd(6)} | ${tc.category.padEnd(32)} | mode: ${tc.mode.padEnd(7)} | allowed: ${String(result.allowed).padEnd(5)} | tier: ${String(result.tier)}`);
  } else {
    failedCount++;
    console.error(`[FAIL] ${tc.id.padEnd(6)} | ${tc.category.padEnd(32)} | mode: ${tc.mode.padEnd(7)}`);
    console.error(`       Input: "${tc.text}"`);
    console.error(`       Expected: allowed=${tc.expectedAllowed}, tier=${tc.expectedTier}`);
    console.error(`       Actual:   allowed=${result.allowed}, tier=${result.tier}, reason=${result.reason}`);
  }
}

// Additional Batch & Helper Tests
console.log("\n--- Testing Batch & Helper Touchpoints ---");

// Test Batch Moderation
const batchTest = checkMultipleFields(
  [
    { text: "Pass the test easily", field: "Tile 1" },
    { text: "Damn good coffee", field: "Tile 2" },
  ],
  { mode: "public" }
);
assert.equal(batchTest.allowed, false, "Batch should catch second item profanity in public mode");
assert.equal(batchTest.tier, 2, "Batch violation should be tier 2");
console.log("[PASS] checkMultipleFields successfully caught public profanity in batch");

const batchPrivateTest = checkMultipleFields(
  [
    { text: "Pass the test easily", field: "Tile 1" },
    { text: "Damn good coffee", field: "Tile 2" },
  ],
  { mode: "private" }
);
assert.equal(batchPrivateTest.allowed, true, "Batch should permit casual swearing in private mode");
console.log("[PASS] checkMultipleFields permitted casual swearing in private mode");

// Test Connect 5 Helper
const c5Clean = checkConnect5PuzzleModeration({
  title: "Morning Words",
  author: "Sol",
  editor: "Editor",
  words: ["SUN", "LIGHT", "HOUSE", "BOAT", "RACE"],
  connections: ["Sunlight", "Lighthouse", "Houseboat", "Boat race"],
});
assert.equal(c5Clean.allowed, true, "Clean Connect 5 puzzle should be allowed");
console.log("[PASS] checkConnect5PuzzleModeration allowed clean puzzle");

const c5Bad = checkConnect5PuzzleModeration({
  title: "Morning Words",
  author: "Sol",
  editor: "Editor",
  words: ["SUN", "LIGHT", "HOUSE", "BOAT", "SHIT"],
  connections: ["Sunlight", "Lighthouse", "Houseboat", "Boat race"],
});
assert.equal(c5Bad.allowed, false, "Connect 5 puzzle with profanity should be blocked in public mode");
console.log("[PASS] checkConnect5PuzzleModeration blocked profanity in puzzle");

// Test 21 Things Board Helper
const t21Clean = check21ThingsBoardModeration(
  {
    title: "21 Morning Gratitudes",
    creatorName: "Daily Curator",
    creatorBio: "A peaceful morning list",
    items: Array(21).fill("Fresh green grass"),
  },
  { mode: "public" }
);
assert.equal(t21Clean.allowed, true, "Clean 21 Things board should be allowed");
console.log("[PASS] check21ThingsBoardModeration allowed clean board");

// Test User Profile Helper
const profileClean = checkUserProfileModeration({
  displayName: "Alex Morgan",
  handle: "@alex_m",
});
assert.equal(profileClean.allowed, true, "Clean user profile should be allowed");
console.log("[PASS] checkUserProfileModeration allowed clean profile");

const profileBad = checkUserProfileModeration({
  displayName: "Alex Fuck",
  handle: "@alex_f",
});
assert.equal(profileBad.allowed, false, "Profile with profanity should be blocked");
console.log("[PASS] checkUserProfileModeration blocked profane display name");

// Test Normalization Pipeline
const normResult = normalizeForModeration("fuuuuuuuck @solplayer");
assert.equal(normResult.normalized, "fuck solplayer");
console.log("[PASS] normalizeForModeration correctly collapsed flooding and leetspeak");

console.log("\n=================================================");
console.log(` Test Summary: ${passedCount} passed, ${failedCount} failed of ${testCases.length} core test cases.`);
console.log(" All touchpoint helper tests passed successfully.");
console.log("=================================================");

if (failedCount > 0) {
  process.exit(1);
}
