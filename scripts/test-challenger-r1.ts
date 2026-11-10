/**
 * Adversarial Challenger 2 Test Suite: Requirement R1 Stress-Testing & Boundary Analysis
 * Architecture: SOL GaMES (21games.ai) — Milestone M1-B2
 * Location: scripts/test-challenger-r1.ts
 *
 * Runs via: node --experimental-strip-types scripts/test-challenger-r1.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import type { UserProfile, UserRole } from "@/lib/user-auth";

// Register custom ESM resolver for "@/..." project path aliases
register("./test-resolver.mjs", import.meta.url);

const {
  INITIAL_GAME_MASTERS,
  isInitialGameMaster,
  isGameMaster,
  isAdmin,
  canAccessPuzzleStudio,
  checkDateEditPermission,
  normalizeEmail,
  normalizeUserProfile,
  updateUserRole,
} = await import("@/lib/user-auth");

let passedCount = 0;
let failedCount = 0;
const failures: string[] = [];

function runTest(name: string, fn: () => void | Promise<void>): void {
  try {
    const result = fn();
    if (result instanceof Promise) {
      throw new Error(`Test ${name} returned a Promise. Use runAsyncTest instead.`);
    }
    passedCount++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failedCount++;
    failures.push(`${name}: ${(error as Error).message}`);
    console.error(`  ✗ ${name}`);
    console.error(`    ${(error as Error).message}`);
  }
}

async function runAsyncTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passedCount++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failedCount++;
    failures.push(`${name}: ${(error as Error).message}`);
    console.error(`  ✗ ${name}`);
    console.error(`    ${(error as Error).message}`);
  }
}

function createTestProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "usr_test_account",
    email: "player@example.com",
    displayName: "Test Player",
    handle: "@testplayer",
    avatarColor: "#F9D423",
    role: "user",
    isBanned: false,
    bannedAt: null,
    bannedReason: null,
    memberSince: "2026-11-10T00:00:00.000Z",
    connect5Stats: {
      played: 5,
      won: 5,
      wins: 5,
      currentStreak: 5,
      maxStreak: 5,
      lastCompletedDateKey: "2026-11-09",
      lastCompletedDate: "2026-11-09",
      bestTimeSeconds: null,
      totalTimeSeconds: 0,
      completedDates: [],
      distribution: { 0: 0, 1: 1, 2: 2, 3: 1, 4: 1 },
    },
    twentyOneStats: {
      played: 3,
      won: 3,
      wins: 3,
      currentStreak: 3,
      maxStreak: 3,
      lastCompletedDateKey: "2026-11-09",
      lastCompletedDate: "2026-11-09",
      bestTimeSeconds: null,
      totalTimeSeconds: 0,
      completedDates: [],
      distribution: { 0: 0, 1: 1, 2: 1, 3: 1 },
    },
    boardsCreatedCount: 0,
    createdBoardIds: [],
    recentPicks: [],
    authMode: "local",
    lastSyncedAt: "2026-11-10T00:00:00.000Z",
    ...overrides,
  };
}

console.log("=================================================================");
console.log("CHALLENGER 2: Adversarial Stress Test Suite for Requirement R1");
console.log("=================================================================\n");

// ==============================================================================
// Section 1: Email Normalization, Case Variations, and Whitespace Handling
// ==============================================================================
console.log("Section 1: Email Normalization, Case Variations, and Whitespace");

runTest("Exact match for both authorized Game Masters", () => {
  assert.equal(isInitialGameMaster("lucas@soltheory.com"), true);
  assert.equal(isInitialGameMaster("steve@soltheory.com"), true);
  assert.equal(INITIAL_GAME_MASTERS.length, 2);
});

runTest("Uppercase variations of authorized emails", () => {
  assert.equal(isInitialGameMaster("LUCAS@SOLTHEORY.COM"), true);
  assert.equal(isInitialGameMaster("STEVE@SOLTHEORY.COM"), true);
  assert.equal(isInitialGameMaster("Lucas@SolTheory.com"), true);
  assert.equal(isInitialGameMaster("Steve@SolTheory.com"), true);
  assert.equal(isInitialGameMaster("sTeVe@SoLtHeOrY.cOm"), true);
});

runTest("Leading and trailing whitespace, tabs, and newlines in emails", () => {
  assert.equal(isInitialGameMaster(" lucas@soltheory.com "), true);
  assert.equal(isInitialGameMaster("  steve@soltheory.com\t"), true);
  assert.equal(isInitialGameMaster("\n\r lucas@soltheory.com \r\n"), true);
  assert.equal(normalizeEmail("   LUCAS@SOLTHEORY.COM \n"), "lucas@soltheory.com");
});

// ==============================================================================
// Section 2: Boundary, Injection, and Spoofing Attacks on Game Master Check
// ==============================================================================
console.log("\nSection 2: Boundary, Injection, and Spoofing Attacks on Game Master Check");

const injectionAttempts = [
  // Subdomain / evil domain attacks
  "lucas@soltheory.com.attacker.com",
  "steve@soltheory.com.evil.org",
  "lucas@soltheory.com@attacker.com",
  "attacker.com/lucas@soltheory.com",
  // Prefix / Suffix variations
  "attacker@soltheory.com",
  "admin@soltheory.com",
  "root@soltheory.com",
  "fake_lucas@soltheory.com",
  "lucas_huff@soltheory.com",
  "x_steve@soltheory.com",
  "steve_jardin@soltheory.com",
  // Former game master (Luke must be rejected)
  "luke@soltheory.com",
  "LUKE@SOLTHEORY.COM",
  "Luke@SolTheory.com",
  // Domain typos / TLD variations
  "lucas@soltheory.co",
  "lucas@soltheory.net",
  "lucas@soltheory.org",
  "lucas@soltheory.io",
  "lucas@soltheory.community",
  "lucas@soltheory",
  // Plus addressing / sub-addressing (must NOT match root whitelist)
  "lucas+admin@soltheory.com",
  "lucas+test@soltheory.com",
  "steve+gm@soltheory.com",
  // Injection payloads
  "lucas@soltheory.com<script>alert(1)</script>",
  "<script>lucas@soltheory.com</script>",
  "lucas@soltheory.com; DROP TABLE users;",
  "lucas@soltheory.com' OR '1'='1",
  "lucas@soltheory.com\\0",
  "lucas@soltheory.com%00",
  // Non-matching other domains
  "lucas@gmail.com",
  "steve@yahoo.com",
  "lucas@other.com",
];

for (const attempt of injectionAttempts) {
  runTest(`Rejects unauthorized email pattern: "${attempt}"`, () => {
    assert.equal(
      isInitialGameMaster(attempt),
      false,
      `Failed to reject unauthorized email: ${attempt}`
    );
  });
}

// ==============================================================================
// Section 3: Forged Roles and Privilege Escalation via User Profiles
// ==============================================================================
console.log("\nSection 3: Forged Roles and Privilege Escalation via User Profiles");

runTest("Legitimate Game Master profiles are recognized by isGameMaster, isAdmin, and canAccessPuzzleStudio", () => {
  const lucasProfile = createTestProfile({
    email: "lucas@soltheory.com",
    role: "game_master",
    isBanned: false,
  });
  const steveProfile = createTestProfile({
    email: "steve@soltheory.com",
    role: "game_master",
    isBanned: false,
  });

  assert.equal(isGameMaster(lucasProfile), true);
  assert.equal(isAdmin(lucasProfile), true);
  assert.equal(canAccessPuzzleStudio(lucasProfile), true);

  assert.equal(isGameMaster(steveProfile), true);
  assert.equal(isAdmin(steveProfile), true);
  assert.equal(canAccessPuzzleStudio(steveProfile), true);
});

runTest("Legitimate Game Master with uppercase email is recognized", () => {
  const upperLucas = createTestProfile({
    email: "LUCAS@SOLTHEORY.COM",
    role: "game_master",
    isBanned: false,
  });
  assert.equal(isGameMaster(upperLucas), true);
  assert.equal(isAdmin(upperLucas), true);
  assert.equal(canAccessPuzzleStudio(upperLucas), true);
});

runTest("Forged role: non-whitelisted user claiming role 'game_master' is rejected", () => {
  const forgedProfiles = [
    createTestProfile({ email: "attacker@gmail.com", role: "game_master" }),
    createTestProfile({ email: "luke@soltheory.com", role: "game_master" }),
    createTestProfile({ email: "admin@soltheory.com", role: "game_master" }),
    createTestProfile({ email: "lucas@soltheory.com.attacker.com", role: "game_master" }),
    createTestProfile({ email: "lucas+gm@soltheory.com", role: "game_master" }),
  ];

  for (const prof of forgedProfiles) {
    assert.equal(
      isGameMaster(prof),
      false,
      `Forged role 'game_master' for ${prof.email} was not rejected!`
    );
    assert.equal(
      isAdmin(prof),
      false,
      `isAdmin for ${prof.email} was not rejected!`
    );
    assert.equal(
      canAccessPuzzleStudio(prof),
      false,
      `canAccessPuzzleStudio for ${prof.email} was not rejected!`
    );
  }
});

runTest("Forged role: non-whitelisted user claiming role 'admin' is rejected", () => {
  const forgedAdmins = [
    createTestProfile({ email: "hacker@evil.com", role: "admin" }),
    createTestProfile({ email: "admin@soltheory.com", role: "admin" }),
    createTestProfile({ email: "luke@soltheory.com", role: "admin" }),
    createTestProfile({ email: "lucas@other.com", role: "admin" }),
  ];

  for (const prof of forgedAdmins) {
    assert.equal(
      isGameMaster(prof),
      false,
      `isGameMaster for ${prof.email} with admin role was not false!`
    );
    assert.equal(
      isAdmin(prof),
      false,
      `isAdmin for ${prof.email} with admin role was not false!`
    );
    assert.equal(
      canAccessPuzzleStudio(prof),
      false,
      `canAccessPuzzleStudio for ${prof.email} with admin role was not false!`
    );
  }
});

runTest("Arbitrary or spoofed role strings ('superadmin', 'root', 'owner') are rejected", () => {
  const spoofedRoleProfiles = [
    createTestProfile({ email: "hacker@evil.com", role: "superadmin" as unknown as UserRole }),
    createTestProfile({ email: "hacker@evil.com", role: "root" as unknown as UserRole }),
    createTestProfile({ email: "hacker@evil.com", role: "owner" as unknown as UserRole }),
  ];

  for (const prof of spoofedRoleProfiles) {
    assert.equal(isGameMaster(prof), false);
    assert.equal(isAdmin(prof), false);
    assert.equal(canAccessPuzzleStudio(prof), false);
  }
});

// ==============================================================================
// Section 4: Banned Status Enforcement (Revocation)
// ==============================================================================
console.log("\nSection 4: Banned Status Enforcement (Revocation)");

runTest("Banned status strips Game Master privileges from lucas@soltheory.com", () => {
  const bannedLucas = createTestProfile({
    email: "lucas@soltheory.com",
    role: "game_master",
    isBanned: true,
    bannedAt: "2026-11-10T00:00:00.000Z",
    bannedReason: "Security lock testing",
  });

  assert.equal(isGameMaster(bannedLucas), false, "Banned Lucas must NOT be recognized as Game Master");
  assert.equal(isAdmin(bannedLucas), false, "Banned Lucas must NOT be recognized as Admin");
  assert.equal(canAccessPuzzleStudio(bannedLucas), false, "Banned Lucas must NOT access puzzle studio");
});

runTest("Banned status strips Game Master privileges from steve@soltheory.com", () => {
  const bannedSteve = createTestProfile({
    email: "steve@soltheory.com",
    role: "game_master",
    isBanned: true,
    bannedAt: "2026-11-10T00:00:00.000Z",
    bannedReason: "Terms violation test",
  });

  assert.equal(isGameMaster(bannedSteve), false, "Banned Steve must NOT be recognized as Game Master");
  assert.equal(isAdmin(bannedSteve), false, "Banned Steve must NOT be recognized as Admin");
  assert.equal(canAccessPuzzleStudio(bannedSteve), false, "Banned Steve must NOT access puzzle studio");
});

runTest("checkDateEditPermission completely locks banned Game Masters across Past, Today, and Future", () => {
  const bannedLucas = createTestProfile({
    email: "lucas@soltheory.com",
    role: "game_master",
    isBanned: true,
    bannedReason: "Security lock testing",
  });

  const todayKey = "2026-11-10";
  const pastKey = "2026-11-09";
  const futureKey = "2026-11-11";

  const pastPerm = checkDateEditPermission(bannedLucas, pastKey, todayKey);
  const todayPerm = checkDateEditPermission(bannedLucas, todayKey, todayKey);
  const futurePerm = checkDateEditPermission(bannedLucas, futureKey, todayKey);

  assert.equal(pastPerm.canEdit, false, "Banned GM must not edit past games");
  assert.equal(todayPerm.canEdit, false, "Banned GM must not edit today games");
  assert.equal(futurePerm.canEdit, false, "Banned GM must not edit future games");
  assert.match(pastPerm.reason || "", /Account suspended/, "Reason must indicate suspension");
});

// ==============================================================================
// Section 5: Null, Undefined, Corrupted, and Falsy Profile Boundaries
// ==============================================================================
console.log("\nSection 5: Null, Undefined, Corrupted, and Falsy Profile Boundaries");

runTest("Unauthenticated guests (null / undefined profile) are blocked from all studio permissions", () => {
  assert.equal(isGameMaster(null), false);
  assert.equal(isGameMaster(undefined as unknown as UserProfile | null), false);

  assert.equal(isAdmin(null), false);
  assert.equal(isAdmin(undefined as unknown as UserProfile | null), false);

  assert.equal(canAccessPuzzleStudio(null), false);
  assert.equal(canAccessPuzzleStudio(undefined as unknown as UserProfile | null), false);

  const permNull = checkDateEditPermission(null, "2026-11-10", "2026-11-10");
  assert.equal(permNull.canEdit, false);
  assert.match(permNull.reason || "", /must be signed in/);
});

runTest("Profiles with missing, empty, or whitespace email are rejected", () => {
  const emptyEmailProf = createTestProfile({ email: "" });
  const whitespaceEmailProf = createTestProfile({ email: "   " });
  const nullEmailProf = createTestProfile({ email: null as unknown as string });
  const undefinedEmailProf = createTestProfile({ email: undefined as unknown as string });

  assert.equal(isGameMaster(emptyEmailProf), false);
  assert.equal(isGameMaster(whitespaceEmailProf), false);
  assert.equal(isGameMaster(nullEmailProf), false);
  assert.equal(isGameMaster(undefinedEmailProf), false);

  assert.equal(canAccessPuzzleStudio(emptyEmailProf), false);
  assert.equal(canAccessPuzzleStudio(whitespaceEmailProf), false);
});

runTest("Empty or malformed profile objects do not throw unhandled exceptions", () => {
  assert.doesNotThrow(() => isGameMaster({} as unknown as UserProfile));
  assert.doesNotThrow(() => isAdmin({} as unknown as UserProfile));
  assert.doesNotThrow(() => canAccessPuzzleStudio({} as unknown as UserProfile));
  assert.doesNotThrow(() => checkDateEditPermission({} as unknown as UserProfile, "2026-11-10", "2026-11-10"));

  assert.equal(isGameMaster({} as unknown as UserProfile), false);
  assert.equal(isAdmin({} as unknown as UserProfile), false);
  assert.equal(canAccessPuzzleStudio({} as unknown as UserProfile), false);
});

// ==============================================================================
// Section 6: Profile Normalization & Role Tampering Sanitization
// ==============================================================================
console.log("\nSection 6: Profile Normalization & Role Tampering Sanitization");

runTest("normalizeUserProfile strips 'game_master' from non-whitelisted emails and demotes to 'user'", () => {
  const rawAttacker = {
    email: "hacker@evil.com",
    role: "game_master" as const,
  };
  const normalized = normalizeUserProfile(rawAttacker);
  assert.equal(normalized.role, "user", "Role must be demoted to 'user'");
  assert.equal(isGameMaster(normalized), false);
});

runTest("normalizeUserProfile demotes former Game Master 'luke@soltheory.com' from 'game_master' to 'user'", () => {
  const rawLuke = {
    email: "luke@soltheory.com",
    role: "game_master" as const,
  };
  const normalized = normalizeUserProfile(rawLuke);
  assert.equal(normalized.role, "user", "Luke must be demoted to 'user'");
  assert.equal(isGameMaster(normalized), false);
});

runTest("normalizeUserProfile assigns 'game_master' role to authorized emails even if submitted as 'user'", () => {
  const rawLucas = {
    email: "  LUCAS@SOLTHEORY.COM  ",
    role: "user" as const,
  };
  const normalized = normalizeUserProfile(rawLucas);
  assert.equal(normalized.email, "lucas@soltheory.com", "Email must be lowercased and trimmed");
  assert.equal(normalized.role, "game_master", "Authorized email must resolve to 'game_master'");
  assert.equal(isGameMaster(normalized), true);
});

await runAsyncTest("updateUserRole blocks non-GM callers from modifying user roles", async () => {
  const standardPlayer = createTestProfile({ email: "player@example.com", role: "user" });
  const result = await updateUserRole(standardPlayer, "other@example.com", "admin");
  assert.equal(result.ok, false);
  assert.match(result.error || "", /Unauthorized/);
});

await runAsyncTest("updateUserRole blocks promoting non-whitelisted email to 'game_master'", async () => {
  const gmCaller = createTestProfile({ email: "lucas@soltheory.com", role: "game_master" });
  const result = await updateUserRole(gmCaller, "someone@example.com", "game_master");
  assert.equal(result.ok, false);
  assert.match(result.error || "", /Only authorized root Game Masters can hold the Game Master role/);
});

await runAsyncTest("updateUserRole blocks demoting root Game Masters", async () => {
  const gmCaller = createTestProfile({ email: "lucas@soltheory.com", role: "game_master" });
  const result = await updateUserRole(gmCaller, "steve@soltheory.com", "user");
  assert.equal(result.ok, false);
  assert.match(result.error || "", /Root Game Masters cannot be demoted/);
});

// ==============================================================================
// Section 7: Static Export Output Audit (`out/`)
// ==============================================================================
console.log("\nSection 7: Static Export Output Audit (`out/`)");

const outDir = path.resolve(process.cwd(), "out");
runTest("Static export directory 'out/' exists", () => {
  assert.equal(fs.existsSync(outDir), true, "'out/' directory must exist");
});

function getAllHtmlFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files;
}

const htmlFiles = getAllHtmlFiles(outDir);

runTest(`Verified presence of prerendered HTML routes (${htmlFiles.length} files found)`, () => {
  assert.ok(htmlFiles.length >= 8, `Expected at least 8 HTML routes, found ${htmlFiles.length}`);
});

for (const htmlFile of htmlFiles) {
  const relPath = path.relative(outDir, htmlFile);

  runTest(`No leaked 'href="/admin"' link in static HTML: ${relPath}`, () => {
    const content = fs.readFileSync(htmlFile, "utf-8");
    const hasAdminLink = /href=["']\/admin["']/i.test(content);
    assert.equal(
      hasAdminLink,
      false,
      `LEAK DETECTED: Static file ${relPath} contains an href to /admin!`
    );
  });

  runTest(`No leaked 'Admin Puzzle Studio' visible text link in static HTML: ${relPath}`, () => {
    const content = fs.readFileSync(htmlFile, "utf-8");
    // Check if "Admin Puzzle Studio" appears inside an anchor tag
    const anchorMatch = /<a\b[^>]*>([\s\S]*?)Admin Puzzle Studio([\s\S]*?)<\/a>/i.test(content);
    assert.equal(
      anchorMatch,
      false,
      `LEAK DETECTED: Static file ${relPath} renders an anchor tag with 'Admin Puzzle Studio'!`
    );
  });
}

runTest("out/admin.html contains neutral loading/verifying placeholder and NO admin editorial controls", () => {
  const adminHtmlPath = path.join(outDir, "admin.html");
  assert.equal(fs.existsSync(adminHtmlPath), true, "out/admin.html must exist");
  const adminHtml = fs.readFileSync(adminHtmlPath, "utf-8");

  // Must contain neutral credential verification
  assert.match(
    adminHtml,
    /Verifying Editorial Credentials\.\.\./,
    "admin.html must contain neutral loading message"
  );

  // Must NOT contain sensitive admin controls or puzzle edit forms in static markup
  assert.equal(
    /<button[^>]*>Publish [^<]*<\/button>/i.test(adminHtml),
    false,
    "admin.html must NOT contain pre-rendered Publish buttons in static HTML"
  );
  assert.equal(
    /SOL GaMES · <\/span>Admin &amp; Daily Puzzle Studio/i.test(adminHtml),
    false,
    "admin.html must NOT contain pre-rendered studio header in static HTML"
  );
  assert.equal(
    /Manage Accounts &amp; Access Roles/i.test(adminHtml),
    false,
    "admin.html must NOT pre-render the accounts management table in static HTML"
  );
});

// ==============================================================================
// Summary
// ==============================================================================
console.log("\n=================================================================");
console.log(`Results: ${passedCount} passed, ${failedCount} failed`);
console.log("=================================================================");

if (failedCount > 0) {
  console.error("\nFailures summary:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
} else {
  console.log("\nALL ADVERSARIAL STRESS TESTS PASSED CLEANLY!");
  process.exit(0);
}
