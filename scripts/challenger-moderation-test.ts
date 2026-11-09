/**
 * Empirical Challenger Verification Test Harness for Content Moderation Engine
 * Architecture: SOL GaMES (21games.ai) — Requirement R2 / Milestone M2-B1
 * Location: scripts/challenger-moderation-test.ts
 *
 * Runs via: node --experimental-strip-types scripts/challenger-moderation-test.ts
 */

import assert from "node:assert/strict";
// @ts-expect-error Node ESM type-stripping requires explicit .ts extension
import * as ModerationModule from "../src/lib/moderation.ts";

const {
  checkContentModeration,
  checkMultipleFields,
  check21ThingsBoardModeration,
  checkConnect5PuzzleModeration,
  checkUserProfileModeration,
} = ModerationModule;

interface ChallengerTestCase {
  id: string;
  category: string;
  input: string;
  mode: "public" | "private";
  expectedAllowed: boolean;
  expectedTier?: 1 | 2;
  description: string;
  threatModel: "baseline" | "adversarial_evasion" | "scunthorpe" | "boundary";
}

const testCases: ChallengerTestCase[] = [
  // =========================================================================
  // 1. TIER 1 UNIVERSAL BAN (PUBLIC & PRIVATE)
  // =========================================================================
  {
    id: "CH-T1-01",
    category: "Tier 1 Slur Public",
    input: "You are a nigger",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Direct racial slur blocked in public mode",
    threatModel: "baseline",
  },
  {
    id: "CH-T1-02",
    category: "Tier 1 Slur Private",
    input: "You are a nigger",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Direct racial slur blocked in private custom mode",
    threatModel: "baseline",
  },
  {
    id: "CH-T1-03",
    category: "Tier 1 Anti-Semitic Public",
    input: "Dirty kike",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Direct anti-semitic slur blocked in public mode",
    threatModel: "baseline",
  },
  {
    id: "CH-T1-04",
    category: "Tier 1 Anti-Semitic Private",
    input: "Dirty kike",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Direct anti-semitic slur blocked in private custom mode",
    threatModel: "baseline",
  },
  {
    id: "CH-T1-05",
    category: "Tier 1 Homophobic Public",
    input: "He is a faggot",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Direct homophobic slur blocked in public mode",
    threatModel: "baseline",
  },
  {
    id: "CH-T1-06",
    category: "Tier 1 Homophobic Private",
    input: "He is a faggot",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Direct homophobic slur blocked in private custom mode",
    threatModel: "baseline",
  },
  {
    id: "CH-T1-07",
    category: "Tier 1 Ableist Public",
    input: "Total retard",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Direct ableist slur blocked in public mode",
    threatModel: "baseline",
  },
  {
    id: "CH-T1-08",
    category: "Tier 1 Ableist Private",
    input: "Total retard",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Direct ableist slur blocked in private custom mode",
    threatModel: "baseline",
  },

  // =========================================================================
  // 2. TIER 2 GENERAL PROFANITY (PUBLIC BLOCKED VS PRIVATE PERMITTED)
  // =========================================================================
  {
    id: "CH-T2-01",
    category: "Tier 2 Profanity Public",
    input: "What the fuck",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 2,
    description: "Swearing strictly blocked in public mode",
    threatModel: "baseline",
  },
  {
    id: "CH-T2-02",
    category: "Tier 2 Profanity Private",
    input: "What the fuck",
    mode: "private",
    expectedAllowed: true,
    description: "Casual swearing permitted in private custom game links",
    threatModel: "baseline",
  },
  {
    id: "CH-T2-03",
    category: "Tier 2 Vulgarity Public",
    input: "This puzzle is shit",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 2,
    description: "Vulgarity strictly blocked in public mode",
    threatModel: "baseline",
  },
  {
    id: "CH-T2-04",
    category: "Tier 2 Vulgarity Private",
    input: "This puzzle is shit",
    mode: "private",
    expectedAllowed: true,
    description: "Vulgarity permitted in private custom mode",
    threatModel: "baseline",
  },
  {
    id: "CH-T2-05",
    category: "Tier 2 Insult Public",
    input: "You are an asshole",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 2,
    description: "Insulting profanity blocked in public mode",
    threatModel: "baseline",
  },
  {
    id: "CH-T2-06",
    category: "Tier 2 Insult Private",
    input: "You are an asshole",
    mode: "private",
    expectedAllowed: true,
    description: "Casual insult permitted in private custom mode",
    threatModel: "baseline",
  },
  {
    id: "CH-T2-07",
    category: "Tier 2 Mild Public",
    input: "Damn good game",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 2,
    description: "Mild profanity blocked in public mode",
    threatModel: "baseline",
  },
  {
    id: "CH-T2-08",
    category: "Tier 2 Mild Private",
    input: "Damn good game",
    mode: "private",
    expectedAllowed: true,
    description: "Mild profanity permitted in private custom mode",
    threatModel: "baseline",
  },

  // =========================================================================
  // 3. EVASION & OBFUSCATION ATTACKS
  // =========================================================================
  {
    id: "CH-EV-01",
    category: "Evasion (Leetspeak Slur)",
    input: "n1gg3r",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Number substitutions 1->i, 3->e in slur",
    threatModel: "adversarial_evasion",
  },
  {
    id: "CH-EV-02",
    category: "Evasion (Leetspeak Profanity)",
    input: "sh!t happens",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 2,
    description: "Symbol substitution !->i in profanity",
    threatModel: "adversarial_evasion",
  },
  {
    id: "CH-EV-03",
    category: "Evasion (Cyrillic Lowercase Homoglyph)",
    input: "nіggеr", // Cyrillic і (\u0456) and е (\u0435)
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Cyrillic lowercase homoglyphs normalized to slur",
    threatModel: "adversarial_evasion",
  },
  {
    id: "CH-EV-04",
    category: "Evasion (Cyrillic Uppercase Homoglyph Ka)",
    input: "\u041Aike", // Cyrillic capital Ka (\u041A) + ike
    mode: "public",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Cyrillic capital Ka (\u041A) in slur must be blocked",
    threatModel: "adversarial_evasion",
  },
  {
    id: "CH-EV-05",
    category: "Evasion (Cyrillic Uppercase Homoglyph Te)",
    input: "re\u0422ard", // Cyrillic capital Te (\u0422)
    mode: "public",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Cyrillic capital Te (\u0422) in slur must be blocked",
    threatModel: "adversarial_evasion",
  },
  {
    id: "CH-EV-06",
    category: "Evasion (Cyrillic Uppercase Homoglyph Ve)",
    input: "wet\u0412ack", // Cyrillic capital Ve (\u0412)
    mode: "public",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Cyrillic capital Ve (\u0412) in slur must be blocked",
    threatModel: "adversarial_evasion",
  },
  {
    id: "CH-EV-07",
    category: "Evasion (Repeated Letter Flooding 3+)",
    input: "fuuuuck",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 2,
    description: "Flooded letters collapsed and blocked in public mode",
    threatModel: "adversarial_evasion",
  },
  {
    id: "CH-EV-08",
    category: "Evasion (Double Letter Slur - kiike)",
    input: "kiike",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Double letter variation 'kiike' must be blocked as Tier 1",
    threatModel: "adversarial_evasion",
  },
  {
    id: "CH-EV-09",
    category: "Evasion (Double Letter Slur - niigger)",
    input: "niigger",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Double letter variation 'niigger' must be blocked as Tier 1",
    threatModel: "adversarial_evasion",
  },
  {
    id: "CH-EV-10",
    category: "Evasion (Double Letter Slur - reetard)",
    input: "reetard",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Double letter variation 'reetard' must be blocked as Tier 1",
    threatModel: "adversarial_evasion",
  },
  {
    id: "CH-EV-11",
    category: "Evasion (Interleaved Dots Slur)",
    input: "n.i.g.g.e.r",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Interleaved dots in slur blocked in private mode",
    threatModel: "adversarial_evasion",
  },
  {
    id: "CH-EV-12",
    category: "Evasion (Interleaved Underscores Slur)",
    input: "f_a_g_g_o_t",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Interleaved underscores in slur blocked in private mode",
    threatModel: "adversarial_evasion",
  },
  {
    id: "CH-EV-13",
    category: "Evasion (Interleaved Spaces Slur)",
    input: "k i k e",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Interleaved spaces in slur blocked in public mode",
    threatModel: "adversarial_evasion",
  },
  {
    id: "CH-EV-14",
    category: "Evasion (Slash Interleaved Slur - c/h/i/n/k)",
    input: "c/h/i/n/k",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Slash separator interleaved slur must be blocked",
    threatModel: "adversarial_evasion",
  },
  {
    id: "CH-EV-15",
    category: "Evasion (Zero-Width Space Slur)",
    input: "n\u200Bi\u200Bg\u200Bg\u200Be\u200Br",
    mode: "private",
    expectedAllowed: false,
    expectedTier: 1,
    description: "Zero-width spaces stripped and slur blocked",
    threatModel: "adversarial_evasion",
  },
  {
    id: "CH-EV-16",
    category: "Evasion (Spaced Profanity in Public - f u c k)",
    input: "f u c k",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 2,
    description: "Spaced profanity in public mode should be blocked",
    threatModel: "adversarial_evasion",
  },
  {
    id: "CH-EV-17",
    category: "Evasion (Punctuated Profanity in Public - f.u.c.k)",
    input: "f.u.c.k",
    mode: "public",
    expectedAllowed: false,
    expectedTier: 2,
    description: "Dotted profanity in public mode should be blocked",
    threatModel: "adversarial_evasion",
  },

  // =========================================================================
  // 4. SCUNTHORPE WORDS (NEVER BLOCKED IN EITHER MODE)
  // =========================================================================
  {
    id: "CH-SC-01",
    category: "Scunthorpe (glass)",
    input: "A clean glass of fresh water",
    mode: "public",
    expectedAllowed: true,
    description: "'glass' never blocked in public mode",
    threatModel: "scunthorpe",
  },
  {
    id: "CH-SC-02",
    category: "Scunthorpe (glass private)",
    input: "A clean glass of fresh water",
    mode: "private",
    expectedAllowed: true,
    description: "'glass' never blocked in private mode",
    threatModel: "scunthorpe",
  },
  {
    id: "CH-SC-03",
    category: "Scunthorpe (pass)",
    input: "Pass the baton to next player",
    mode: "public",
    expectedAllowed: true,
    description: "'pass' never blocked in public mode",
    threatModel: "scunthorpe",
  },
  {
    id: "CH-SC-04",
    category: "Scunthorpe (pass private)",
    input: "Pass the baton to next player",
    mode: "private",
    expectedAllowed: true,
    description: "'pass' never blocked in private mode",
    threatModel: "scunthorpe",
  },
  {
    id: "CH-SC-05",
    category: "Scunthorpe (classic)",
    input: "Classic puzzle design",
    mode: "public",
    expectedAllowed: true,
    description: "'classic' never blocked in public mode",
    threatModel: "scunthorpe",
  },
  {
    id: "CH-SC-06",
    category: "Scunthorpe (classic private)",
    input: "Classic puzzle design",
    mode: "private",
    expectedAllowed: true,
    description: "'classic' never blocked in private mode",
    threatModel: "scunthorpe",
  },
  {
    id: "CH-SC-07",
    category: "Scunthorpe (peacock)",
    input: "The peacock displayed colorful feathers",
    mode: "public",
    expectedAllowed: true,
    description: "'peacock' never blocked in public mode",
    threatModel: "scunthorpe",
  },
  {
    id: "CH-SC-08",
    category: "Scunthorpe (peacock private)",
    input: "The peacock displayed colorful feathers",
    mode: "private",
    expectedAllowed: true,
    description: "'peacock' never blocked in private mode",
    threatModel: "scunthorpe",
  },
  {
    id: "CH-SC-09",
    category: "Scunthorpe (cocktail)",
    input: "Evening cocktail party",
    mode: "public",
    expectedAllowed: true,
    description: "'cocktail' never blocked in public mode",
    threatModel: "scunthorpe",
  },
  {
    id: "CH-SC-10",
    category: "Scunthorpe (cocktail private)",
    input: "Evening cocktail party",
    mode: "private",
    expectedAllowed: true,
    description: "'cocktail' never blocked in private mode",
    threatModel: "scunthorpe",
  },
  {
    id: "CH-SC-11",
    category: "Scunthorpe (dickens)",
    input: "Charles Dickens literary classic",
    mode: "public",
    expectedAllowed: true,
    description: "'dickens' never blocked in public mode",
    threatModel: "scunthorpe",
  },
  {
    id: "CH-SC-12",
    category: "Scunthorpe (dickens private)",
    input: "Charles Dickens literary classic",
    mode: "private",
    expectedAllowed: true,
    description: "'dickens' never blocked in private mode",
    threatModel: "scunthorpe",
  },
  {
    id: "CH-SC-13",
    category: "Scunthorpe (shiitake)",
    input: "Shiitake mushroom broth and noodles",
    mode: "public",
    expectedAllowed: true,
    description: "'shiitake' never blocked in public mode",
    threatModel: "scunthorpe",
  },
  {
    id: "CH-SC-14",
    category: "Scunthorpe (shiitake private)",
    input: "Shiitake mushroom broth and noodles",
    mode: "private",
    expectedAllowed: true,
    description: "'shiitake' never blocked in private mode",
    threatModel: "scunthorpe",
  },
  {
    id: "CH-SC-15",
    category: "Scunthorpe (title)",
    input: "Board title and gratitude list",
    mode: "public",
    expectedAllowed: true,
    description: "'title' never blocked in public mode",
    threatModel: "scunthorpe",
  },
  {
    id: "CH-SC-16",
    category: "Scunthorpe (title private)",
    input: "Board title and gratitude list",
    mode: "private",
    expectedAllowed: true,
    description: "'title' never blocked in private mode",
    threatModel: "scunthorpe",
  },
  {
    id: "CH-SC-17",
    category: "Scunthorpe (sniggering inflection)",
    input: "They were sniggering in the back row",
    mode: "public",
    expectedAllowed: true,
    description: "Inflected form 'sniggering' should not falsely trigger Tier 1",
    threatModel: "scunthorpe",
  },
];

// =========================================================================
// RUN TEST CASES
// =========================================================================

console.log("===============================================================================");
console.log(" EMPIRICAL CHALLENGER 1: Automated Stress Test Harness (Milestone M2-B1)");
console.log("===============================================================================\n");

let passedCount = 0;
let failedCount = 0;
const failures: Array<{ tc: ChallengerTestCase; actual: ModerationModule.ModerationResult }> = [];

for (const tc of testCases) {
  const result = checkContentModeration(tc.input, { mode: tc.mode });
  const isAllowedMatch = result.allowed === tc.expectedAllowed;
  const isTierMatch =
    tc.expectedTier === undefined
      ? result.tier === undefined
      : result.tier === tc.expectedTier;

  if (isAllowedMatch && isTierMatch) {
    passedCount++;
    console.log(
      `[PASS] ${tc.id.padEnd(10)} | ${tc.category.padEnd(36)} | mode: ${tc.mode.padEnd(7)} | allowed: ${String(result.allowed).padEnd(5)} | tier: ${String(result.tier)}`
    );
  } else {
    failedCount++;
    failures.push({ tc, actual: result });
    console.error(
      `[FAIL] ${tc.id.padEnd(10)} | ${tc.category.padEnd(36)} | mode: ${tc.mode.padEnd(7)}`
    );
    console.error(`       Input:    "${tc.input}"`);
    console.error(`       Expected: allowed=${tc.expectedAllowed}, tier=${tc.expectedTier}`);
    console.error(
      `       Actual:   allowed=${result.allowed}, tier=${result.tier}, reason="${result.reason || ""}"`
    );
  }
}

// =========================================================================
// 5. TOUCHPOINT HELPERS VALIDATION
// =========================================================================
console.log("\n-------------------------------------------------------------------------------");
console.log(" 5. Touchpoint Helpers Empirical Verification");
console.log("-------------------------------------------------------------------------------\n");

// A. checkUserProfileModeration
console.log("Testing checkUserProfileModeration...");
const upClean = checkUserProfileModeration({
  displayName: "Valid Player",
  handle: "@sol_player",
});
assert.equal(upClean.allowed, true, "Clean profile should be allowed");

const upProfane = checkUserProfileModeration({
  displayName: "Fuck You",
  handle: "@hater",
});
assert.equal(upProfane.allowed, false, "Profane profile display name should be blocked");
assert.equal(upProfane.tier, 2, "Profile profanity violation should be Tier 2");

const upSlur = checkUserProfileModeration({
  displayName: "Player",
  handle: "@n1gg3r",
});
assert.equal(upSlur.allowed, false, "Slur in handle should be blocked");
assert.equal(upSlur.tier, 1, "Slur handle violation should be Tier 1");
console.log("[PASS] checkUserProfileModeration behaves as expected.");

// B. checkTwentyOneReflectionModeration (Touchpoint simulation as used in twenty-one-things.tsx)
console.log("\nTesting 21 Things Reflection Moderation Touchpoint...");
function checkTwentyOneReflectionModeration(
  playerName: string,
  reflectionNote: string,
  mode: ModerationModule.ModerationMode
): ModerationModule.ModerationResult {
  return checkMultipleFields(
    [
      { text: playerName, field: "Player Name" },
      { text: reflectionNote, field: "Reflection Note" },
    ],
    { mode }
  );
}

const refCleanPub = checkTwentyOneReflectionModeration(
  "Lucas",
  "I loved the glass puzzle pieces today!",
  "public"
);
assert.equal(refCleanPub.allowed, true, "Clean reflection allowed in public");

const refProfanePub = checkTwentyOneReflectionModeration(
  "Lucas",
  "This daily puzzle is fucking hard",
  "public"
);
assert.equal(refProfanePub.allowed, false, "Profanity in public reflection must be blocked");
assert.equal(refProfanePub.tier, 2, "Should be Tier 2 violation");

const refProfanePriv = checkTwentyOneReflectionModeration(
  "Lucas",
  "This daily puzzle is fucking hard",
  "private"
);
assert.equal(refProfanePriv.allowed, true, "Casual swearing in private custom reflection permitted");

const refSlurPriv = checkTwentyOneReflectionModeration(
  "Lucas",
  "Total nigger",
  "private"
);
assert.equal(refSlurPriv.allowed, false, "Slur in private reflection strictly blocked");
assert.equal(refSlurPriv.tier, 1, "Should be Tier 1 violation");
console.log("[PASS] 21 Things Reflection Moderation touchpoint verified.");

// C. checkCustomBoardModeration (Touchpoint simulation as used in twenty-one-things.tsx & game-storage.ts)
console.log("\nTesting Custom Board Moderation Touchpoint...");
function checkCustomBoardModeration(board: {
  title: string;
  creatorName: string;
  creatorBio?: string;
  items: string[];
}): ModerationModule.ModerationResult {
  return check21ThingsBoardModeration(board, { mode: "private" });
}

const customBoardClean = checkCustomBoardModeration({
  title: "My 21 Classic Movies",
  creatorName: "MovieFan",
  creatorBio: "Damn good cinema",
  items: Array(21).fill("Pulp Fiction"),
});
assert.equal(customBoardClean.allowed, true, "Custom board with casual profanity in bio is allowed");

const customBoardSlur = checkCustomBoardModeration({
  title: "My 21 Classic Movies",
  creatorName: "MovieFan",
  creatorBio: "Curated by a kike",
  items: Array(21).fill("Pulp Fiction"),
});
assert.equal(customBoardSlur.allowed, false, "Custom board with Tier 1 slur is blocked");
assert.equal(customBoardSlur.tier, 1, "Should be Tier 1 violation");
console.log("[PASS] Custom Board Moderation touchpoint verified.");

// D. checkAdminConnect5Moderation (Touchpoint simulation as used in admin/page.tsx)
console.log("\nTesting Admin Connect 5 Moderation Touchpoint...");
function checkAdminConnect5Moderation(puzzle: {
  title: string;
  author: string;
  editor: string;
  words: [string, string, string, string, string] | string[];
  connections: [string, string, string, string] | string[];
}): ModerationModule.ModerationResult {
  return checkConnect5PuzzleModeration(puzzle, { mode: "public" });
}

const c5Clean = checkAdminConnect5Moderation({
  title: "Morning Walk",
  author: "Lucas",
  editor: "Gerard",
  words: ["GLASS", "WATER", "RIVER", "BANK", "NOTE"],
  connections: ["Glass of water", "Water river", "River bank", "Bank note"],
});
assert.equal(c5Clean.allowed, true, "Clean Connect 5 puzzle allowed in admin studio");

const c5Profane = checkAdminConnect5Moderation({
  title: "Morning Walk",
  author: "Lucas",
  editor: "Gerard",
  words: ["FUCK", "WATER", "RIVER", "BANK", "NOTE"],
  connections: ["Fuck water", "Water river", "River bank", "Bank note"],
});
assert.equal(c5Profane.allowed, false, "Profanity in Connect 5 puzzle blocked in admin studio");
assert.equal(c5Profane.tier, 2, "Should be Tier 2 violation");
console.log("[PASS] Admin Connect 5 Moderation touchpoint verified.");

// E. checkAdmin21BoardModeration (Touchpoint simulation as used in admin/page.tsx)
console.log("\nTesting Admin 21 Board Moderation Touchpoint...");
function checkAdmin21BoardModeration(board: {
  title: string;
  creatorName: string;
  creatorBio?: string;
  items: string[];
}): ModerationModule.ModerationResult {
  return check21ThingsBoardModeration(board, { mode: "public" });
}

const admin21Clean = checkAdmin21BoardModeration({
  title: "21 Things We Love",
  creatorName: "SOL GaMES Team",
  creatorBio: "Classic reflections for today",
  items: Array(21).fill("Sunny morning"),
});
assert.equal(admin21Clean.allowed, true, "Clean daily 21 board allowed in admin studio");

const admin21Profane = checkAdmin21BoardModeration({
  title: "21 Shit Things",
  creatorName: "SOL GaMES Team",
  creatorBio: "Classic reflections",
  items: Array(21).fill("Sunny morning"),
});
assert.equal(admin21Profane.allowed, false, "Profanity in daily 21 board blocked in admin studio");
assert.equal(admin21Profane.tier, 2, "Should be Tier 2 violation");
console.log("[PASS] Admin 21 Board Moderation touchpoint verified.");

// F. Check Named Exports from moderation.ts
console.log("\n-------------------------------------------------------------------------------");
console.log(" Checking Named Exports from moderation.ts");
console.log("-------------------------------------------------------------------------------");
const requiredExports = [
  "checkContentModeration",
  "checkMultipleFields",
  "normalizeForModeration",
  "INNOCENT_ALLOWLIST",
  "checkUserProfileModeration",
  "check21ThingsBoardModeration",
  "checkConnect5PuzzleModeration",
];

const dispatchMentionedExports = [
  "checkTwentyOneReflectionModeration",
  "checkCustomBoardModeration",
  "checkAdminConnect5Moderation",
  "checkAdmin21BoardModeration",
  "checkUserProfileModeration",
];

console.log("\nStandard Exports:");
for (const exp of requiredExports) {
  const exists = typeof (ModerationModule as Record<string, unknown>)[exp] !== "undefined";
  console.log(`- ${exp}: ${exists ? "EXISTS (present)" : "MISSING"}`);
}

console.log("\nDispatch-Mentioned Named Exports:");
for (const exp of dispatchMentionedExports) {
  const exists = typeof (ModerationModule as Record<string, unknown>)[exp] !== "undefined";
  console.log(`- ${exp}: ${exists ? "EXISTS" : "NOT DIRECTLY EXPORTED (implemented inline / via wrapper)"}`);
}

// =========================================================================
// SUMMARY
// =========================================================================
console.log("\n===============================================================================");
console.log(` SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED out of ${testCases.length} test cases`);
console.log("===============================================================================");

if (failures.length > 0) {
  console.log("\nAdversarial Failures / Vulnerabilities Detected:");
  failures.forEach(({ tc, actual }, idx) => {
    console.log(`\n${idx + 1}. [${tc.id}] ${tc.category} (${tc.threatModel})`);
    console.log(`   Input: "${tc.input}" | Mode: ${tc.mode}`);
    console.log(`   Expected: allowed=${tc.expectedAllowed}, tier=${tc.expectedTier}`);
    console.log(`   Actual:   allowed=${actual.allowed}, tier=${actual.tier}, reason="${actual.reason || ""}"`);
    console.log(`   Description: ${tc.description}`);
  });
}

// Exit with non-zero code if any test failed
if (failedCount > 0) {
  console.error(`\n[VERDICT REQUIREMENT] Test harness failed with ${failedCount} vulnerabilities.`);
  process.exit(1);
} else {
  console.log("\n[VERDICT REQUIREMENT] All tests passed cleanly.");
  process.exit(0);
}
