/**
 * Adversarial Challenger Stress Test Suite for Milestone M1-B2 (Requirement R1)
 *
 * Focus:
 * 1. Email Case, Whitespace, and Unicode Normalization boundaries.
 * 2. Injection attempts (subdomain spoofing, path injection, plus addressing, non-whitelisted emails).
 * 3. Role spoofing & privilege escalation resistance (arbitrary game_master/admin roles).
 * 4. Banned accounts enforcement (including direct isBanned tampering on GM profiles).
 * 5. Null, undefined, empty, and malformed object boundaries.
 * 6. Admin route and date edit permission boundaries.
 *
 * Execute with: node --experimental-strip-types scripts/challenger-m1-b2-stress-test.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import type { UserProfile } from "@/lib/user-auth";

// Register custom ESM resolver for "@/..." project path aliases
register("./test-resolver.mjs", import.meta.url);

const {
  INITIAL_GAME_MASTERS,
  USER_ROLES,
  normalizeEmail,
  isInitialGameMaster,
  isValidUserRole,
  isGameMaster,
  isAdmin,
  canAccessPuzzleStudio,
  checkDateEditPermission,
  normalizeUserProfile,
  updateUserRole,
  setUserBannedStatus,
} = await import("@/lib/user-auth");

let passedCount = 0;
let failedCount = 0;
const failures: Array<{ name: string; error: unknown }> = [];

function runStressTest(name: string, fn: () => void | Promise<void>): void {
  try {
    const res = fn();
    if (res && typeof (res as Promise<void>).then === "function") {
      throw new Error(`Test "${name}" returned a promise but runStressTest was called synchronously. Use runAsyncStressTest.`);
    }
    passedCount++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failedCount++;
    failures.push({ name, error });
    console.error(`  ✗ ${name}`);
    console.error(`    -> ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runAsyncStressTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passedCount++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failedCount++;
    failures.push({ name, error });
    console.error(`  ✗ ${name}`);
    console.error(`    -> ${error instanceof Error ? error.message : String(error)}`);
  }
}

function makeTestProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "usr_test",
    email: "player@soltheory.com",
    displayName: "Test Player",
    handle: "@testplayer",
    avatarColor: "#F9D423",
    role: "user",
    isBanned: false,
    bannedAt: null,
    bannedReason: null,
    memberSince: new Date().toISOString(),
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
    ...overrides,
  };
}

console.log("\n=================================================================");
console.log("ADVERSARIAL STRESS TEST SUITE: Milestone M1-B2 (Requirement R1)");
console.log("=================================================================\n");

// =============================================================================
// Suite 1: Email Normalization, Case, Whitespace, & Boundary Scenarios
// =============================================================================
console.log("Suite 1: Email Normalization, Case, and Whitespace Handling");

runStressTest("INITIAL_GAME_MASTERS contains strictly lucas and steve", () => {
  assert.equal(INITIAL_GAME_MASTERS.length, 2);
  assert.ok(INITIAL_GAME_MASTERS.includes("lucas@soltheory.com"));
  assert.ok(INITIAL_GAME_MASTERS.includes("steve@soltheory.com"));
  assert.equal(INITIAL_GAME_MASTERS.includes("luke@soltheory.com"), false);
});

runStressTest("USER_ROLES contains game_master, admin, user and isValidUserRole validates them", () => {
  assert.deepEqual(USER_ROLES, ["game_master", "admin", "user"]);
  assert.ok(isValidUserRole("game_master"));
  assert.ok(isValidUserRole("admin"));
  assert.ok(isValidUserRole("user"));
  assert.equal(isValidUserRole("superadmin"), false);
  assert.equal(isValidUserRole(""), false);
  assert.equal(isValidUserRole(null), false);
});

runStressTest("normalizeEmail handles uppercase and mixed case correctly", () => {
  assert.equal(normalizeEmail("LUCAS@SOLTHEORY.COM"), "lucas@soltheory.com");
  assert.equal(normalizeEmail("Lucas@SolTheory.com"), "lucas@soltheory.com");
  assert.equal(normalizeEmail("Steve@SolTheory.com"), "steve@soltheory.com");
  assert.equal(normalizeEmail("STEVE@SOLTHEORY.COM"), "steve@soltheory.com");
});

runStressTest("normalizeEmail trims surrounding whitespace, tabs, and newlines", () => {
  assert.equal(normalizeEmail("   lucas@soltheory.com   "), "lucas@soltheory.com");
  assert.equal(normalizeEmail("\tsteve@soltheory.com\n"), "steve@soltheory.com");
  assert.equal(normalizeEmail(" \r\n lucas@soltheory.com \t "), "lucas@soltheory.com");
});

runStressTest("isInitialGameMaster validates valid emails regardless of case or outer whitespace", () => {
  assert.equal(isInitialGameMaster(" LUCAS@SOLTHEORY.COM "), true);
  assert.equal(isInitialGameMaster("Steve@SolTheory.com"), true);
  assert.equal(isInitialGameMaster("\t\nsteve@soltheory.com \r\n"), true);
  assert.equal(isInitialGameMaster("lucas@soltheory.com"), true);
});

runStressTest("isInitialGameMaster rejects internal whitespace tampering", () => {
  assert.equal(isInitialGameMaster("lucas @soltheory.com"), false);
  assert.equal(isInitialGameMaster("lucas@ soltheory.com"), false);
  assert.equal(isInitialGameMaster("lucas@soltheory .com"), false);
  assert.equal(isInitialGameMaster("lucas\u00A0@soltheory.com"), false); // non-breaking space inside
});

// =============================================================================
// Suite 2: Adversarial Injection, Subdomain Spoofing, & Lookalike Attacks
// =============================================================================
console.log("\nSuite 2: Injection, Subdomain Spoofing, & Lookalike Attacks");

const injectionCandidates = [
  "lucas@soltheory.com.attacker.com",
  "lucas@soltheory.com.evil.org",
  "lucas@soltheory.com@evil.com",
  "attacker@lucas@soltheory.com",
  "admin@soltheory.com",
  "luke@soltheory.com",
  "lucas@other.com",
  "lucas@soltheory.co",
  "lucas@soltheory.net",
  "lucas@soltheory.org",
  "lucas@soltheory.io",
  "steve@soltheory.org",
  "lucas+test@soltheory.com",
  "lucas-admin@soltheory.com",
  "root@soltheory.com",
  "game_master@soltheory.com",
  "moderator@soltheory.com",
  "lucas@soltheory.com/admin",
  "lucas@soltheory.com?evil=1",
  "lucas@soltheory.com#hash",
  "lucas@soltheory.com\0",
  "'; DROP TABLE user_profiles; --",
  "<script>alert(1)</script>",
];

for (const candidate of injectionCandidates) {
  runStressTest(`Reject unauthorized/injection email: "${candidate}"`, () => {
    assert.equal(
      isInitialGameMaster(candidate),
      false,
      `isInitialGameMaster must reject "${candidate}"`
    );
    const profile = makeTestProfile({ email: candidate, role: "user" });
    assert.equal(
      isGameMaster(profile),
      false,
      `isGameMaster must reject profile with email "${candidate}"`
    );
    assert.equal(
      isAdmin(profile),
      false,
      `isAdmin must reject profile with email "${candidate}"`
    );
    assert.equal(
      canAccessPuzzleStudio(profile),
      false,
      `canAccessPuzzleStudio must reject profile with email "${candidate}"`
    );
  });
}

// =============================================================================
// Suite 3: Forged Roles, Role Spoofing, & Privilege Escalation Resistance
// =============================================================================
console.log("\nSuite 3: Forged Roles & Privilege Escalation Resistance");

runStressTest("Reject profile claiming role: 'game_master' with unauthorized email", () => {
  const forgedGM = makeTestProfile({
    email: "hacker@evil.com",
    role: "game_master",
  });
  assert.equal(isGameMaster(forgedGM), false, "Forged GM role must evaluate to false");
  assert.equal(isAdmin(forgedGM), false, "Forged GM must not evaluate to admin");
  assert.equal(canAccessPuzzleStudio(forgedGM), false, "Forged GM cannot access puzzle studio");
});

runStressTest("Reject profile claiming role: 'admin' with unauthorized email", () => {
  const forgedAdmin = makeTestProfile({
    email: "curator@external.com",
    role: "admin",
  });
  assert.equal(isGameMaster(forgedAdmin), false);
  assert.equal(isAdmin(forgedAdmin), false);
  assert.equal(canAccessPuzzleStudio(forgedAdmin), false);
});

runStressTest("Reject luke@soltheory.com even if profile claims role: 'game_master'", () => {
  const forgedLuke = makeTestProfile({
    email: "luke@soltheory.com",
    role: "game_master",
  });
  assert.equal(isGameMaster(forgedLuke), false, "Luke must be rejected even with game_master role");
  assert.equal(isAdmin(forgedLuke), false);
  assert.equal(canAccessPuzzleStudio(forgedLuke), false);
});

runStressTest("normalizeUserProfile demotes unauthorized user claiming 'game_master' to 'user'", () => {
  const normalized = normalizeUserProfile({
    email: "intruder@domain.com",
    role: "game_master",
  });
  assert.equal(
    normalized.role,
    "user",
    "normalizeUserProfile must clamp unauthorized game_master role to 'user'"
  );
  assert.equal(isGameMaster(normalized), false);
  assert.equal(canAccessPuzzleStudio(normalized), false);
});

runStressTest("normalizeUserProfile guarantees whitelisted emails always resolve role: 'game_master'", () => {
  const normalizedLucas = normalizeUserProfile({
    email: "lucas@soltheory.com",
    role: "user",
  });
  assert.equal(normalizedLucas.role, "game_master");
  assert.equal(isGameMaster(normalizedLucas), true);

  const normalizedSteve = normalizeUserProfile({
    email: "STEVE@SOLTHEORY.COM",
    role: "user",
  });
  assert.equal(normalizedSteve.role, "game_master");
  assert.equal(isGameMaster(normalizedSteve), true);
});

// =============================================================================
// Suite 4: Banned Status Enforcement & Direct Tampering
// =============================================================================
console.log("\nSuite 4: Banned Status Enforcement & Tampering");

runStressTest("Direct profile tampering: isBanned=true on lucas@soltheory.com revokes GM access", () => {
  const tamperedLucas = makeTestProfile({
    email: "lucas@soltheory.com",
    role: "game_master",
    isBanned: true,
    bannedReason: "Test suspension",
  });
  assert.equal(
    isGameMaster(tamperedLucas),
    false,
    "isGameMaster must return false if profile.isBanned is true, even for lucas@soltheory.com"
  );
  assert.equal(isAdmin(tamperedLucas), false);
  assert.equal(canAccessPuzzleStudio(tamperedLucas), false);

  const editPerm = checkDateEditPermission(tamperedLucas, "2026-11-08", "2026-11-08");
  assert.equal(editPerm.canEdit, false, "Banned GM must have canEdit=false");
  assert.ok(
    editPerm.reason?.includes("suspended"),
    "Edit permission reason must indicate account suspension"
  );
});

runStressTest("Direct profile tampering: isBanned=true on steve@soltheory.com revokes GM access", () => {
  const tamperedSteve = makeTestProfile({
    email: "steve@soltheory.com",
    role: "game_master",
    isBanned: true,
  });
  assert.equal(isGameMaster(tamperedSteve), false);
  assert.equal(canAccessPuzzleStudio(tamperedSteve), false);
});

runStressTest("Standard user with isBanned=true is strictly blocked across all checks", () => {
  const bannedUser = makeTestProfile({
    email: "baduser@example.com",
    isBanned: true,
  });
  assert.equal(isGameMaster(bannedUser), false);
  assert.equal(isAdmin(bannedUser), false);
  assert.equal(canAccessPuzzleStudio(bannedUser), false);
  const perm = checkDateEditPermission(bannedUser, "2026-11-15", "2026-11-08");
  assert.equal(perm.canEdit, false);
});

// =============================================================================
// Suite 5: Null Safety, Undefined, Empty, & Malformed Values
// =============================================================================
console.log("\nSuite 5: Null Safety, Empty Values, & Malformed Objects");

runStressTest("Null and undefined profile checks return false safely", () => {
  assert.equal(isGameMaster(null), false);
  assert.equal(isGameMaster(undefined as unknown as UserProfile | null), false);
  assert.equal(isAdmin(null), false);
  assert.equal(isAdmin(undefined as unknown as UserProfile | null), false);
  assert.equal(canAccessPuzzleStudio(null), false);
  assert.equal(canAccessPuzzleStudio(undefined as unknown as UserProfile | null), false);
});

runStressTest("Empty and falsy profile objects return false safely", () => {
  assert.equal(isGameMaster({} as unknown as UserProfile), false);
  assert.equal(isGameMaster({ email: "" } as unknown as UserProfile), false);
  assert.equal(isGameMaster({ email: null } as unknown as UserProfile), false);
  assert.equal(isGameMaster({ email: undefined } as unknown as UserProfile), false);
  assert.equal(isAdmin({} as unknown as UserProfile), false);
  assert.equal(canAccessPuzzleStudio({} as unknown as UserProfile), false);
});

runStressTest("isInitialGameMaster handles null, undefined, empty, and whitespace strings", () => {
  assert.equal(isInitialGameMaster(null), false);
  assert.equal(isInitialGameMaster(undefined), false);
  assert.equal(isInitialGameMaster(""), false);
  assert.equal(isInitialGameMaster("   "), false);
  assert.equal(isInitialGameMaster("\t\n"), false);
});

runStressTest("Document behavior on non-string inputs (type violation)", () => {
  // TypeScript protects against non-strings at compile time, but at runtime
  // if an unvalidated non-string is passed, normalizeEmail calls .trim()
  try {
    // @ts-expect-error testing untyped runtime value
    isInitialGameMaster(12345);
    assert.fail("Should have thrown TypeError or returned false");
  } catch (err) {
    assert.ok(
      err instanceof TypeError && err.message.includes("trim"),
      "Throws TypeError on non-string (no privilege escalation possible)"
    );
  }
});

runStressTest("checkDateEditPermission with null/undefined profile returns canEdit=false safely", () => {
  const nullPerm = checkDateEditPermission(null, "2026-11-08", "2026-11-08");
  assert.equal(nullPerm.canEdit, false);
  assert.equal(nullPerm.isPast, false);
  assert.equal(nullPerm.isToday, false);
  assert.equal(nullPerm.isFuture, false);

  const undefPerm = checkDateEditPermission(
    undefined as unknown as UserProfile | null,
    "2026-11-08",
    "2026-11-08"
  );
  assert.equal(undefPerm.canEdit, false);
});

// =============================================================================
// Suite 6: Async Role & Ban Mutation Safety (updateUserRole, setUserBannedStatus)
// =============================================================================
console.log("\nSuite 6: Async Role & Ban Mutation Safety");

const gmActor = makeTestProfile({
  email: "lucas@soltheory.com",
  role: "game_master",
});

const userActor = makeTestProfile({
  email: "regular@gmail.com",
  role: "user",
});

await runAsyncStressTest("Unauthorized actor cannot update user roles", async () => {
  const res = await updateUserRole(userActor, "someone@gmail.com", "game_master");
  assert.equal(res.ok, false);
  assert.ok(res.error?.includes("Unauthorized"));
});

await runAsyncStressTest("Cannot assign 'game_master' to non-whitelisted email even by GM actor", async () => {
  const res = await updateUserRole(gmActor, "newperson@soltheory.com", "game_master");
  assert.equal(res.ok, false);
  assert.ok(res.error?.includes("Only authorized root Game Masters"));
});

await runAsyncStressTest("Cannot demote root Game Master", async () => {
  const res = await updateUserRole(gmActor, "steve@soltheory.com", "user");
  assert.equal(res.ok, false);
  assert.ok(res.error?.includes("cannot be demoted"));
});

await runAsyncStressTest("Unauthorized actor cannot modify account ban status", async () => {
  const res = await setUserBannedStatus(userActor, "someone@gmail.com", true);
  assert.equal(res.ok, false);
  assert.ok(res.error?.includes("Unauthorized"));
});

await runAsyncStressTest("Root Game Masters cannot be banned via setUserBannedStatus", async () => {
  const resLucas = await setUserBannedStatus(gmActor, "lucas@soltheory.com", true);
  assert.equal(resLucas.ok, false);
  assert.ok(resLucas.error?.includes("permanent ban immunity"));

  const resSteve = await setUserBannedStatus(gmActor, "steve@soltheory.com", true);
  assert.equal(resSteve.ok, false);
  assert.ok(resSteve.error?.includes("permanent ban immunity"));
});

// =============================================================================
// Suite 7: Static Export Output Audit (out/ directory)
// =============================================================================
console.log("\nSuite 7: Static Export Output Audit (out/ directory)");

runStressTest("Verify static export out/ directory exists and contains expected routes", () => {
  const outDir = path.resolve(process.cwd(), "out");
  assert.ok(fs.existsSync(outDir), "out directory must exist (run npm run build first)");
  assert.ok(fs.existsSync(path.join(outDir, "index.html")), "out/index.html must exist");
  assert.ok(fs.existsSync(path.join(outDir, "admin.html")), "out/admin.html must exist");
});

runStressTest("Confirm zero leakage of 'Admin Puzzle Studio' in out/*.html", () => {
  const outDir = path.resolve(process.cwd(), "out");
  function scanHtmlFiles(dir: string): string[] {
    const leaked: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "_next") {
        leaked.push(...scanHtmlFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (content.includes("Admin Puzzle Studio")) {
          leaked.push(fullPath);
        }
      }
    }
    return leaked;
  }

  const leakedFiles = scanHtmlFiles(outDir);
  assert.deepEqual(
    leakedFiles,
    [],
    `Found 'Admin Puzzle Studio' in static HTML export: ${leakedFiles.join(", ")}`
  );
});

runStressTest("Confirm zero leakage of href='/admin' in out/*.html", () => {
  const outDir = path.resolve(process.cwd(), "out");
  function scanAdminLinks(dir: string): string[] {
    const leaked: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "_next") {
        leaked.push(...scanAdminLinks(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        // Look for anchor tags linking to /admin
        if (/href=["']\/admin["']/i.test(content)) {
          leaked.push(fullPath);
        }
      }
    }
    return leaked;
  }

  const leakedAdminLinks = scanAdminLinks(outDir);
  assert.deepEqual(
    leakedAdminLinks,
    [],
    `Found href='/admin' in static HTML files: ${leakedAdminLinks.join(", ")}`
  );
});

runStressTest("Confirm out/admin.html renders neutral credential verification screen only", () => {
  const adminHtmlPath = path.resolve(process.cwd(), "out/admin.html");
  const content = fs.readFileSync(adminHtmlPath, "utf-8");

  assert.ok(
    content.includes("Verifying Editorial Credentials..."),
    "out/admin.html must prerender the neutral verification spinner"
  );
  // Ensure no sensitive admin controls are prerendered
  assert.equal(
    content.includes("Publish Today's Puzzle"),
    false,
    "out/admin.html must NOT contain publish actions in static HTML"
  );
  assert.equal(
    content.includes("Save Draft to Cloud"),
    false,
    "out/admin.html must NOT contain draft saving actions in static HTML"
  );
  assert.equal(
    content.includes("Delete Override"),
    false,
    "out/admin.html must NOT contain delete override actions in static HTML"
  );
});

console.log("\n=================================================================");
console.log(`STRESS TEST SUMMARY: ${passedCount} passed, ${failedCount} failed`);
console.log("=================================================================\n");

if (failedCount > 0) {
  process.exit(1);
}
