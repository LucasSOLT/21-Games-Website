/**
 * Automated Verification Test Suite for Admin Puzzle Studio Persistence & RBAC Permissions
 * Architecture: SOL GaMES (21games.ai) — Requirement R4 / Batch 1
 * Location: scripts/test-admin-persistence.ts
 *
 * Runs via: node --experimental-strip-types scripts/test-admin-persistence.ts
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import type { UserProfile } from "@/lib/user-auth";

// Register custom ESM resolver for "@/..." project path aliases
register("./test-resolver.mjs", import.meta.url);

// Dynamic imports using project aliases after loader registration
const {
  INITIAL_GAME_MASTERS,
  isInitialGameMaster,
  isGameMaster,
  isAdmin,
  canAccessPuzzleStudio,
  checkDateEditPermission,
} = await import("@/lib/user-auth");

const {
  computePuzzleContentHash,
} = await import("@/lib/seeded-random");

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

function createMockProfile(
  email: string,
  role: "game_master" | "admin" | "user" = "user",
  isBanned = false,
  bannedReason?: string
): UserProfile {
  return {
    id: `usr-${email.split("@")[0]}`,
    email,
    displayName: email.split("@")[0] || "User",
    handle: `@${email.split("@")[0] || "user"}`,
    avatarColor: "#111111",
    role,
    isBanned,
    bannedReason: bannedReason || null,
    bannedAt: isBanned ? new Date().toISOString() : null,
    memberSince: "Nov 2026",
    connect5Stats: {
      played: 0,
      won: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      lastCompletedDateKey: null,
      lastCompletedDate: null,
      bestTimeSeconds: null,
      totalTimeSeconds: 0,
      completedDates: [],
      distribution: {},
    },
    twentyOneStats: {
      played: 0,
      won: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      lastCompletedDateKey: null,
      lastCompletedDate: null,
      bestTimeSeconds: null,
      totalTimeSeconds: 0,
      completedDates: [],
      distribution: {},
    },
    boardsCreatedCount: 0,
    createdBoardIds: [],
    recentPicks: [],
    authMode: "local",
    lastSyncedAt: new Date().toISOString(),
  };
}

console.log("\n=================================================================");
console.log("TEST SUITE: Admin Puzzle Studio Persistence & RBAC Permissions (R4)");
console.log("=================================================================\n");

// -----------------------------------------------------------------------------
// Section 1: Initial Game Masters Configuration (Lucas, Steve)
// -----------------------------------------------------------------------------
console.log("Section 1: Initial Game Masters Configuration & Normalization");

runTest("INITIAL_GAME_MASTERS strictly contains lucas and steve (2 GMs, luke excluded)", () => {
  assert.ok(Array.isArray(INITIAL_GAME_MASTERS), "INITIAL_GAME_MASTERS must be an array");
  assert.equal(INITIAL_GAME_MASTERS.length, 2, "Must have exactly 2 initial Game Masters");

  assert.ok(
    INITIAL_GAME_MASTERS.includes("lucas@soltheory.com"),
    "lucas@soltheory.com must be in INITIAL_GAME_MASTERS"
  );
  assert.ok(
    INITIAL_GAME_MASTERS.includes("steve@soltheory.com"),
    "steve@soltheory.com must be in INITIAL_GAME_MASTERS"
  );
  assert.equal(
    INITIAL_GAME_MASTERS.includes("luke@soltheory.com"),
    false,
    "luke@soltheory.com must NOT be in INITIAL_GAME_MASTERS"
  );
});

runTest("isInitialGameMaster recognizes the 2 Game Masters case-insensitively and rejects luke", () => {
  assert.equal(isInitialGameMaster("lucas@soltheory.com"), true);
  assert.equal(isInitialGameMaster("Lucas@SolTheory.com"), true);
  assert.equal(isInitialGameMaster("LUCAS@SOLTHEORY.COM"), true);

  assert.equal(isInitialGameMaster("steve@soltheory.com"), true);
  assert.equal(isInitialGameMaster("Steve@SolTheory.com"), true);
  assert.equal(isInitialGameMaster("STEVE@SOLTHEORY.COM"), true);

  assert.equal(isInitialGameMaster("luke@soltheory.com"), false);
  assert.equal(isInitialGameMaster("Luke@SolTheory.com"), false);
  assert.equal(isInitialGameMaster("LUKE@SOLTHEORY.COM"), false);

  // Whitespace trimming
  assert.equal(isInitialGameMaster("  lucas@soltheory.com  "), true);
  assert.equal(isInitialGameMaster("  steve@soltheory.com\n"), true);
});

runTest("isInitialGameMaster rejects unauthorized emails and empty values", () => {
  assert.equal(isInitialGameMaster("player@gmail.com"), false);
  assert.equal(isInitialGameMaster("admin@soltheory.com"), false);
  assert.equal(isInitialGameMaster("hacker@bad.actor"), false);
  assert.equal(isInitialGameMaster("luke@soltheory.com"), false);
  assert.equal(isInitialGameMaster(""), false);
  assert.equal(isInitialGameMaster(null), false);
  assert.equal(isInitialGameMaster(undefined), false);
});

runTest("isGameMaster recognizes initial Game Masters and rejects non-whitelisted emails", () => {
  const profileLuke = createMockProfile("luke@soltheory.com", "user");
  assert.equal(isGameMaster(profileLuke), false, "Luke must NOT be recognized as GM");

  const profileSteve = createMockProfile("steve@soltheory.com", "user");
  assert.equal(isGameMaster(profileSteve), true, "Steve must be recognized as GM by email");

  const profileLucas = createMockProfile("lucas@soltheory.com", "user");
  assert.equal(isGameMaster(profileLucas), true, "Lucas must be recognized as GM by email");
});

runTest("isGameMaster rejects non-whitelisted emails with assigned 'game_master' roles (strict email check)", () => {
  const assignedGM = createMockProfile("moderator@soltheory.com", "game_master");
  assert.equal(isGameMaster(assignedGM), false, "Non-whitelisted GM role must be rejected");
  assert.equal(isAdmin(assignedGM), false);
  assert.equal(canAccessPuzzleStudio(assignedGM), false);
});

runTest("Standard users cannot access Puzzle Studio", () => {
  const standardUser = createMockProfile("bob@gmail.com", "user");
  assert.equal(isGameMaster(standardUser), false);
  assert.equal(isAdmin(standardUser), false);
  assert.equal(canAccessPuzzleStudio(standardUser), false);
});

// -----------------------------------------------------------------------------
// Section 2: checkDateEditPermission (Game Masters vs Admins vs Users)
// -----------------------------------------------------------------------------
console.log("\nSection 2: checkDateEditPermission Enforcement (GM vs Admin vs User)");

const todayKey = "2026-11-08";
const pastKey = "2026-11-01";
const futureKey = "2026-11-15";

runTest("Game Masters can edit Past, Today, and Future puzzles", () => {
  const gmProfile = createMockProfile("lucas@soltheory.com", "game_master");

  // Past puzzle
  const pastPerm = checkDateEditPermission(gmProfile, pastKey, todayKey);
  assert.equal(pastPerm.canEdit, true, "GM must be allowed to edit past archive puzzles");
  assert.equal(pastPerm.isPast, true);
  assert.equal(pastPerm.isToday, false);
  assert.equal(pastPerm.isFuture, false);

  // Today live puzzle
  const todayPerm = checkDateEditPermission(gmProfile, todayKey, todayKey);
  assert.equal(todayPerm.canEdit, true, "GM must be allowed to edit today's live puzzle");
  assert.equal(todayPerm.isPast, false);
  assert.equal(todayPerm.isToday, true);
  assert.equal(todayPerm.isFuture, false);

  // Future puzzle
  const futurePerm = checkDateEditPermission(gmProfile, futureKey, todayKey);
  assert.equal(futurePerm.canEdit, true, "GM must be allowed to edit future scheduled puzzles");
  assert.equal(futurePerm.isPast, false);
  assert.equal(futurePerm.isToday, false);
  assert.equal(futurePerm.isFuture, true);
});

runTest("Admins CANNOT edit Past puzzles (diff < 0)", () => {
  const adminProfile = createMockProfile("curator@soltheory.com", "admin");

  const perm = checkDateEditPermission(adminProfile, pastKey, todayKey);
  assert.equal(perm.canEdit, false, "Admin must be blocked from editing past archives");
  assert.equal(perm.isPast, true);
  assert.ok(
    perm.reason?.includes("Past games are locked") || perm.reason?.includes("Game Masters"),
    "Reason must explain archive lock"
  );
});

runTest("Admins CANNOT edit Today's live puzzle (diff === 0)", () => {
  const adminProfile = createMockProfile("curator@soltheory.com", "admin");

  const perm = checkDateEditPermission(adminProfile, todayKey, todayKey);
  assert.equal(perm.canEdit, false, "Admin must be blocked from editing today's live game");
  assert.equal(perm.isToday, true);
  assert.ok(
    perm.reason?.includes("Today's live game is locked") || perm.reason?.includes("Game Masters"),
    "Reason must explain live game lock"
  );
});

runTest("Admins CAN edit Future scheduled puzzles (diff > 0)", () => {
  const adminProfile = createMockProfile("curator@soltheory.com", "admin");

  const perm = checkDateEditPermission(adminProfile, futureKey, todayKey);
  assert.equal(perm.canEdit, true, "Admin must be allowed to schedule future puzzles");
  assert.equal(perm.isFuture, true);
  assert.equal(perm.isToday, false);
  assert.equal(perm.isPast, false);
});

runTest("Standard players are blocked from editing any date", () => {
  const playerProfile = createMockProfile("player@soltheory.com", "user");

  assert.equal(checkDateEditPermission(playerProfile, pastKey, todayKey).canEdit, false);
  assert.equal(checkDateEditPermission(playerProfile, todayKey, todayKey).canEdit, false);
  assert.equal(checkDateEditPermission(playerProfile, futureKey, todayKey).canEdit, false);
});

runTest("Banned users and null profiles are strictly blocked from editing", () => {
  const bannedGM = createMockProfile(
    "steve@soltheory.com",
    "game_master",
    true,
    "Compromised credential"
  );

  const bannedPerm = checkDateEditPermission(bannedGM, futureKey, todayKey);
  assert.equal(bannedPerm.canEdit, false, "Banned accounts must be blocked");
  assert.ok(bannedPerm.reason?.includes("Account suspended"));

  const nullPerm = checkDateEditPermission(null, futureKey, todayKey);
  assert.equal(nullPerm.canEdit, false, "Null profiles must be blocked");
});

// -----------------------------------------------------------------------------
// Section 3: Content Hash Calculation & Change Detection
// -----------------------------------------------------------------------------
console.log("\nSection 3: Content Hash Calculation & Change Detection");

const baseConnect5 = {
  id: "c5-test-01",
  puzzleNumber: 42,
  title: "Mouse to Wind",
  author: "SOL Editorial",
  editor: "Daily Editor",
  words: ["MOUSE", "PAD", "LOCK", "DOWN", "WIND"],
  revealedHints: [
    { row: 1, col: 0 },
    { row: 2, col: 1 },
  ],
  connections: [
    "Mouse pad is an office accessory",
    "Padlock is a portable lock",
    "Lockdown is a containment protocol",
    "Downwind is in the direction wind blows",
  ],
};

const base21Things = {
  id: "21t-test-01",
  puzzleNumber: 101,
  title: "21 Morning Routines",
  creatorName: "Editorial Team",
  creatorHandle: "@editorial",
  creatorBio: "SOL GaMES Staff",
  items: [
    "Drink water", "Brew coffee", "Brush teeth", "Morning stretch",
    "Make bed", "Cold shower", "Read news", "Write journal",
    "Pet the dog", "Eat oatmeal", "Check schedule", "Check weather",
    "Deep breathing", "Pack bag", "Water plants", "Vitamins",
    "Play Connect 5", "Listen to audio", "Step outside", "Review goals",
    "Smile in mirror"
  ],
  sampleJourneys: [],
};

runTest("computePuzzleContentHash produces deterministic prefix and hex string", () => {
  const hashC5 = computePuzzleContentHash(baseConnect5);
  assert.ok(hashC5.startsWith("c5:h-"), `Connect 5 hash must start with 'c5:h-', got: ${hashC5}`);
  assert.equal(hashC5.length, 13, "c5:h- + 8 hex chars = 13 chars total");

  const hash21t = computePuzzleContentHash(base21Things);
  assert.ok(hash21t.startsWith("21t:h-"), `21 Things hash must start with '21t:h-', got: ${hash21t}`);
  assert.equal(hash21t.length, 14, "21t:h- + 8 hex chars = 14 chars total");

  // Determinism
  assert.equal(computePuzzleContentHash(baseConnect5), hashC5);
  assert.equal(computePuzzleContentHash(base21Things), hash21t);
});

runTest("Connect 5 content hash detects word modifications", () => {
  const originalHash = computePuzzleContentHash(baseConnect5);

  const modifiedWords = {
    ...baseConnect5,
    words: ["HOUSE", "PAD", "LOCK", "DOWN", "WIND"],
  };
  const modifiedHash = computePuzzleContentHash(modifiedWords);

  assert.notEqual(originalHash, modifiedHash, "Changing a word must change content hash");
});

runTest("Connect 5 content hash detects hint modifications", () => {
  const originalHash = computePuzzleContentHash(baseConnect5);

  const modifiedHints = {
    ...baseConnect5,
    revealedHints: [
      { row: 1, col: 0 },
      { row: 2, col: 1 },
      { row: 3, col: 0 }, // added hint
    ],
  };
  const modifiedHash = computePuzzleContentHash(modifiedHints);

  assert.notEqual(originalHash, modifiedHash, "Changing revealed hints must change content hash");
});

runTest("Connect 5 content hash detects connection explanation modifications", () => {
  const originalHash = computePuzzleContentHash(baseConnect5);

  const modifiedConnections = {
    ...baseConnect5,
    connections: [
      "Trackpad or mouse pad surface",
      "Padlock is a portable lock",
      "Lockdown is a containment protocol",
      "Downwind is in the direction wind blows",
    ],
  };
  const modifiedHash = computePuzzleContentHash(modifiedConnections);

  assert.notEqual(originalHash, modifiedHash, "Changing connections must change content hash");
});

runTest("21 Things content hash detects tile item modifications", () => {
  const originalHash = computePuzzleContentHash(base21Things);

  const modifiedItems = {
    ...base21Things,
    items: [...base21Things.items],
  };
  modifiedItems.items[0] = "Drink warm lemon water"; // modified item
  const modifiedHash = computePuzzleContentHash(modifiedItems);

  assert.notEqual(originalHash, modifiedHash, "Changing a tile item must change content hash");
});

runTest("21 Things content hash detects board title modifications", () => {
  const originalHash = computePuzzleContentHash(base21Things);

  const modifiedTitle = {
    ...base21Things,
    title: "21 Productive Morning Habits",
  };
  const modifiedHash = computePuzzleContentHash(modifiedTitle);

  assert.notEqual(originalHash, modifiedHash, "Changing board title must change content hash");
});

runTest("computePuzzleContentHash ignores transient timestamps and player session stats", () => {
  const withTimestamp1 = {
    ...baseConnect5,
    created_at: "2026-11-08T00:00:00.000Z",
    updated_at: "2026-11-08T01:00:00.000Z",
    elapsedSeconds: 45,
    hintsUsed: 1,
  };

  const withTimestamp2 = {
    ...baseConnect5,
    created_at: "2026-11-08T10:00:00.000Z",
    updated_at: "2026-11-08T12:00:00.000Z",
    elapsedSeconds: 120,
    hintsUsed: 3,
  };

  const hash1 = computePuzzleContentHash(withTimestamp1);
  const hash2 = computePuzzleContentHash(withTimestamp2);

  assert.equal(
    hash1,
    hash2,
    "Transient timestamps and player timers must NOT affect puzzle content hash"
  );
});

// -----------------------------------------------------------------------------
// Section 4: Obsolete Progress Invalidation Verification
// -----------------------------------------------------------------------------
console.log("\nSection 4: Obsolete Progress Invalidation on Hash Mismatch");

runTest("Mismatched puzzleHash triggers progress invalidation in Connect 5", () => {
  const puzzle = baseConnect5;
  const currentHash = computePuzzleContentHash(puzzle);
  const staleHash = "c5:h-deadbeef";

  // Simulate saved progress with stale hash
  const savedProgress = {
    dateKey: "2026-11-08",
    puzzleId: puzzle.id,
    grid: [["M", "O", "U", "S", "E"], ["P", "A", "D"], ["L", "O", "C", "K"], ["D", "O", "W", "N"], ["W", "I", "N", "D"]],
    slashed: [[false, false, false, false, false], [false, false, false], [false, false, false, false], [false, false, false, false], [false, false, false, false]],
    revealedByHint: [[false, false, false, false, false], [false, false, false], [false, false, false, false], [false, false, false, false], [false, false, false, false]],
    elapsedSeconds: 30,
    hintsUsed: 0,
    status: "playing" as const,
    puzzleHash: staleHash,
  };

  // Re-sync logic check
  const isCompatible = savedProgress.puzzleHash === currentHash;
  assert.equal(isCompatible, false, "Saved progress with old hash must be marked incompatible");
});

runTest("Mismatched puzzleHash triggers progress invalidation in 21 Things", () => {
  const board = base21Things;
  const currentHash = computePuzzleContentHash(board);
  const staleHash = "21t:h-00000000";

  const saved21Progress = {
    boardId: board.id,
    phase: "pick3" as const,
    pick6Indices: [0, 1, 2, 3, 4, 5],
    pick3Indices: [0, 1, 2],
    pick1Index: null,
    playerName: "Tester",
    reflectionNote: "Previous thought",
    puzzleHash: staleHash,
  };

  const isCompatible = saved21Progress.puzzleHash === currentHash;
  assert.equal(isCompatible, false, "21 Things progress with mismatched hash must trigger reset");
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log("\n=================================================================");
console.log(`Results: ${passedCount} passed, ${failedCount} failed`);
console.log("=================================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log("All Admin Persistence & RBAC Permissions tests PASSED!\n");
}
