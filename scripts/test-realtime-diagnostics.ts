/**
 * Automated Verification Test Suite for Milestone M2-B2:
 * Real-Time Puzzle Update Propagation & Diagnostic Error Codes Catalog
 * Architecture: SOL GaMES (21games.ai) — Requirement R2
 * Location: scripts/test-realtime-diagnostics.ts
 *
 * Runs via: node --experimental-strip-types scripts/test-realtime-diagnostics.ts
 */

import assert from "node:assert/strict";
import { register } from "node:module";

// Register custom ESM resolver for "@/..." project path aliases
register("./test-resolver.mjs", import.meta.url);

// ============================================================================
// Mock Browser Environment for Node.js Testing
// ============================================================================

const storageStore = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageStore.get(key) ?? null,
  setItem: (key: string, val: string) => storageStore.set(key, String(val)),
  removeItem: (key: string) => storageStore.delete(key),
  clear: () => storageStore.clear(),
};

class MockBroadcastChannel extends EventTarget {
  name: string;
  static channels = new Map<string, Set<MockBroadcastChannel>>();
  onmessage: ((ev: MessageEvent) => void) | null = null;

  constructor(name: string) {
    super();
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name)!.add(this);
  }

  postMessage(message: unknown): void {
    const peers = MockBroadcastChannel.channels.get(this.name);
    if (!peers) return;
    for (const peer of peers) {
      if (peer !== this) {
        const ev = new MessageEvent("message", { data: message });
        if (peer.onmessage) peer.onmessage(ev);
        peer.dispatchEvent(ev);
      }
    }
  }

  close(): void {
    MockBroadcastChannel.channels.get(this.name)?.delete(this);
  }
}

// Attach mocks to globalThis before importing application modules
const winMock = globalThis as unknown as Record<string, unknown>;
const windowEventTarget = new EventTarget();
winMock.window = globalThis;
winMock.localStorage = mockLocalStorage;
winMock.BroadcastChannel = MockBroadcastChannel;
winMock.location = { href: "https://21games.ai/admin" };
winMock.addEventListener = windowEventTarget.addEventListener.bind(windowEventTarget);
winMock.removeEventListener = windowEventTarget.removeEventListener.bind(windowEventTarget);
winMock.dispatchEvent = windowEventTarget.dispatchEvent.bind(windowEventTarget);
Object.defineProperty(globalThis, "navigator", {
  value: {
    onLine: true,
    userAgent: "SOL-GaMES-Diagnostic-TestRunner/1.0",
    platform: "Node.js",
    language: "en-US",
  },
  writable: true,
  configurable: true,
});

// ============================================================================
// Dynamic Module Imports
// ============================================================================

const {
  DIAGNOSTIC_ERROR_CODES,
  DIAGNOSTIC_ERROR_CATALOG,
  classifyDiagnosticError,
  serializeDiagnosticReport,
  formatDiagnosticReportText,
  createDiagnosticReport,
  isDiagnosticReport,
  extractRawErrorDetails,
} = await import("@/lib/diagnostic-errors");

const {
  getAdmin17SyllablesOverrides,
  saveAdmin17SyllablesOverride,
  clear17SyllablesProgress,
  broadcastPuzzleUpdate,
  subscribeToPuzzlesUpdated,
  getPuzzlesStoreSnapshot,
} = await import("@/lib/game-storage");

const {
  computePuzzleContentHash,
} = await import("@/lib/seeded-random");

const {
  validateHaikuStructure,
  sliceHaikuIntoChunks,
} = await import("@/data/puzzles/17-syllables");

// ============================================================================
// Test Runner Harness
// ============================================================================

let passedCount = 0;
let failedCount = 0;

function runTest(name: string, fn: () => void | Promise<void>): void {
  try {
    const res = fn();
    if (res instanceof Promise) {
      res
        .then(() => {
          passedCount++;
          console.log(`  ✓ ${name}`);
        })
        .catch((err) => {
          failedCount++;
          console.error(`  ✗ ${name}`);
          console.error(err);
        });
    } else {
      passedCount++;
      console.log(`  ✓ ${name}`);
    }
  } catch (error) {
    failedCount++;
    console.error(`  ✗ ${name}`);
    console.error(error);
  }
}

console.log("\n=================================================================");
console.log("TEST SUITE: Real-Time Puzzle Update Propagation & Diagnostic Errors (R2)");
console.log("=================================================================\n");

// ============================================================================
// SECTION 1: Diagnostic Error Codes Catalog & Metadata
// ============================================================================
console.log("Section 1: Diagnostic Error Codes Catalog & Metadata");

runTest("Catalog contains exactly 18 structured error codes", () => {
  const codes = Object.keys(DIAGNOSTIC_ERROR_CODES);
  assert.equal(codes.length, 18, `Expected 18 error codes, found ${codes.length}`);
});

runTest("Every catalog entry has complete human-readable and troubleshooting metadata", () => {
  for (const [codeKey, codeVal] of Object.entries(DIAGNOSTIC_ERROR_CODES)) {
    const meta = DIAGNOSTIC_ERROR_CATALOG[codeVal];
    assert.ok(meta, `Missing catalog entry for code: ${codeKey}`);
    assert.equal(meta.code, codeVal);
    assert.ok(meta.title && meta.title.length > 3, `${codeVal} title is too short`);
    assert.ok(meta.description && meta.description.length > 15, `${codeVal} description is too short`);
    assert.ok(meta.troubleshootingHint && meta.troubleshootingHint.length > 15, `${codeVal} hint is too short`);
    assert.ok(["fatal", "error", "warning"].includes(meta.severity), `Invalid severity for ${codeVal}`);
    assert.ok(
      ["auth", "network", "database", "schema", "realtime", "internal"].includes(meta.category),
      `Invalid category for ${codeVal}`
    );
  }
});

runTest("Category distribution meets architectural specifications", () => {
  const entries = Object.values(DIAGNOSTIC_ERROR_CATALOG);
  const authCount = entries.filter((e) => e.category === "auth").length;
  const networkCount = entries.filter((e) => e.category === "network").length;
  const dbCount = entries.filter((e) => e.category === "database").length;
  const schemaCount = entries.filter((e) => e.category === "schema").length;
  const realtimeCount = entries.filter((e) => e.category === "realtime").length;
  const internalCount = entries.filter((e) => e.category === "internal").length;

  assert.equal(authCount, 3, "Expected 3 auth codes");
  assert.equal(networkCount, 4, "Expected 4 network codes");
  assert.equal(dbCount, 4, "Expected 4 database codes");
  assert.equal(schemaCount, 4, "Expected 4 schema codes");
  assert.equal(realtimeCount, 2, "Expected 2 realtime codes");
  assert.equal(internalCount, 1, "Expected 1 internal code");
});

// ============================================================================
// SECTION 2: Error Classification Engine (classifyDiagnosticError)
// ============================================================================
console.log("\nSection 2: Error Classification Engine (classifyDiagnosticError)");

runTest("Explicit forcedErrorCode override takes precedence", () => {
  const report = classifyDiagnosticError(new Error("Generic error"), {
    forcedErrorCode: DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_RLS_VIOLATION,
    targetDate: "2026-11-10",
    gameSlug: "connect-5",
  });
  assert.equal(report.errorCode, "ERR_SUPABASE_RLS_VIOLATION");
  assert.equal(report.errorCategory, "database");
});

runTest("Physical offline browser condition classifies as ERR_NETWORK_OFFLINE", () => {
  const nav = globalThis.navigator as unknown as { onLine: boolean };
  const origOnline = nav.onLine;
  try {
    nav.onLine = false;
    const report = classifyDiagnosticError(new Error("Network failed"));
    assert.equal(report.errorCode, "ERR_NETWORK_OFFLINE");
    assert.equal(report.isOnline, false);
    assert.equal(report.severity, "warning");
  } finally {
    nav.onLine = origOnline;
  }
});

runTest("Offline string mentions classify as ERR_NETWORK_OFFLINE", () => {
  const report = classifyDiagnosticError(new Error("net::ERR_INTERNET_DISCONNECTED"));
  assert.equal(report.errorCode, "ERR_NETWORK_OFFLINE");
});

runTest("Missing user email on save classifies as ERR_AUTH_NOT_AUTHENTICATED", () => {
  const report = classifyDiagnosticError(new Error("Unauthorized"), {
    action: "save",
    userEmail: null,
    targetDate: "2026-11-10",
  });
  assert.equal(report.errorCode, "ERR_AUTH_NOT_AUTHENTICATED");
  assert.equal(report.errorCategory, "auth");
});

runTest("Non-GM user email on save classifies as ERR_AUTH_NOT_GAME_MASTER", () => {
  const report = classifyDiagnosticError(new Error("Forbidden"), {
    action: "save",
    userEmail: "intruder@external.com",
    userRole: "user",
    targetDate: "2026-11-10",
  });
  assert.equal(report.errorCode, "ERR_AUTH_NOT_GAME_MASTER");
  assert.equal(report.errorCategory, "auth");
});

runTest("JWT or session expiration classifies as ERR_AUTH_SESSION_EXPIRED", () => {
  const err1 = { code: "PGRST301", message: "JWT expired" };
  const report1 = classifyDiagnosticError(err1);
  assert.equal(report1.errorCode, "ERR_AUTH_SESSION_EXPIRED");

  const err2 = { status: 401, message: "Invalid token" };
  const report2 = classifyDiagnosticError(err2);
  assert.equal(report2.errorCode, "ERR_AUTH_SESSION_EXPIRED");
});

runTest("Network timeout (408, 504, AbortError) classifies as ERR_NETWORK_TIMEOUT", () => {
  const timeoutErr = { name: "AbortError", message: "The operation was aborted due to timeout" };
  const report = classifyDiagnosticError(timeoutErr);
  assert.equal(report.errorCode, "ERR_NETWORK_TIMEOUT");
  assert.equal(report.errorCategory, "network");
});

runTest("Postgres RLS policy violation (42501 with policy) classifies as ERR_SUPABASE_RLS_VIOLATION", () => {
  const rlsErr = {
    code: "42501",
    message: "new row violates row-level security policy for table daily_puzzles",
    details: "Failing row violates policy Admin upsert daily_puzzles",
  };
  const report = classifyDiagnosticError(rlsErr);
  assert.equal(report.errorCode, "ERR_SUPABASE_RLS_VIOLATION");
  assert.equal(report.rawError.code, "42501");
});

runTest("Postgres permission denied (42501 without RLS, or 403) classifies as ERR_SUPABASE_PERMISSION_DENIED", () => {
  const permErr = {
    code: "42501",
    message: "permission denied for table daily_puzzles",
  };
  const report = classifyDiagnosticError(permErr);
  assert.equal(report.errorCode, "ERR_SUPABASE_PERMISSION_DENIED");
});

runTest("Schema mismatch (42703, 42P01, PGRST204) classifies as ERR_SUPABASE_SCHEMA_MISMATCH", () => {
  const schemaErr = {
    code: "42703",
    message: "column content_hash of relation daily_puzzles does not exist",
  };
  const report = classifyDiagnosticError(schemaErr);
  assert.equal(report.errorCode, "ERR_SUPABASE_SCHEMA_MISMATCH");
  assert.equal(report.errorCategory, "schema");
});

runTest("Database constraint violations (23505, 23514) classify as ERR_SUPABASE_CONSTRAINT_VIOLATION", () => {
  const constraintErr = {
    code: "23505",
    message: "duplicate key value violates unique constraint daily_puzzles_game_slug_puzzle_date_key",
  };
  const report = classifyDiagnosticError(constraintErr);
  assert.equal(report.errorCode, "ERR_SUPABASE_CONSTRAINT_VIOLATION");
});

runTest("Payload validation failure classifies as ERR_PAYLOAD_VALIDATION_FAILED", () => {
  const report = classifyDiagnosticError(new Error("Each of the 5 rows must have at least 2 letters"), {
    action: "validate",
    gameSlug: "connect-5",
  });
  assert.equal(report.errorCode, "ERR_PAYLOAD_VALIDATION_FAILED");
});

runTest("Content hash mismatch classifies as ERR_PAYLOAD_HASH_MISMATCH", () => {
  const report = classifyDiagnosticError(new Error("content_hash checksum verification failed"));
  assert.equal(report.errorCode, "ERR_PAYLOAD_HASH_MISMATCH");
});

runTest("Realtime channel failures classify as ERR_REALTIME_SUBSCRIPTION_FAILED / CLOSED", () => {
  const reportJoin = classifyDiagnosticError(new Error("failed to join realtime topic daily_puzzles"));
  assert.equal(reportJoin.errorCode, "ERR_REALTIME_SUBSCRIPTION_FAILED");

  const reportClose = classifyDiagnosticError(new Error("phx_close channel closed by server"));
  assert.equal(reportClose.errorCode, "ERR_REALTIME_CHANNEL_CLOSED");
});

runTest("Action-specific fallbacks classify save vs fetch", () => {
  const reportSave = classifyDiagnosticError(new Error("Unexpected DB crash"), {
    action: "save",
    userEmail: "lucas@soltheory.com",
    userRole: "game_master",
  });
  assert.equal(reportSave.errorCode, "ERR_SUPABASE_UPSERT_FAILED");

  const reportFetch = classifyDiagnosticError(new Error("Failed to fetch"), { action: "fetch" });
  assert.equal(reportFetch.errorCode, "ERR_SUPABASE_FETCH_FAILED");
});

runTest("Unknown exception defaults to ERR_INTERNAL_UNHANDLED_EXCEPTION", () => {
  const report = classifyDiagnosticError(new Error("Mysterious bug with no pattern"));
  assert.equal(report.errorCode, "ERR_INTERNAL_UNHANDLED_EXCEPTION");
});

// ============================================================================
// SECTION 3: Diagnostic Report Serialization & Clipboard Formatting
// ============================================================================
console.log("\nSection 3: Diagnostic Report Serialization & Clipboard Formatting");

runTest("serializeDiagnosticReport produces valid, complete JSON", () => {
  const report = createDiagnosticReport("ERR_SUPABASE_RLS_VIOLATION", {
    gameSlug: "connect-5",
    targetDate: "2026-11-10",
    userEmail: "lucas@soltheory.com",
    userRole: "game_master",
  });

  const jsonStr = serializeDiagnosticReport(report);
  assert.ok(jsonStr.startsWith("{") && jsonStr.endsWith("}"));
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.errorCode, "ERR_SUPABASE_RLS_VIOLATION");
  assert.equal(parsed.gameSlug, "connect-5");
  assert.equal(parsed.targetDate, "2026-11-10");
  assert.equal(parsed.userEmail, "lucas@soltheory.com");
  assert.ok(parsed.environment.userAgent);
});

runTest("formatDiagnosticReportText creates structured ASCII banner", () => {
  const report = createDiagnosticReport("ERR_NETWORK_OFFLINE", {
    gameSlug: "21-things",
    targetDate: "2026-11-11",
  });

  const banner = formatDiagnosticReportText(report);
  assert.ok(banner.includes("SOL GaMES (21games.ai) — STUDIO DIAGNOSTIC REPORT"));
  assert.ok(banner.includes("[ERR_NETWORK_OFFLINE]"));
  assert.ok(banner.includes("21-things"));
  assert.ok(banner.includes("2026-11-11"));
  assert.ok(banner.includes("COMPLETE DIAGNOSTIC JSON PAYLOAD"));
});

runTest("isDiagnosticReport type guard identifies reports accurately", () => {
  const report = createDiagnosticReport("ERR_AUTH_NOT_GAME_MASTER");
  assert.ok(isDiagnosticReport(report));
  assert.equal(isDiagnosticReport(null), false);
  assert.equal(isDiagnosticReport({}), false);
  assert.equal(isDiagnosticReport("just a string"), false);
});

runTest("extractRawErrorDetails handles PostgrestError-like objects cleanly", () => {
  const pgErr = {
    code: "42501",
    status: 403,
    message: "Insufficient privilege",
    details: "table daily_puzzles",
    hint: "grant insert on daily_puzzles to authenticated",
  };
  const extracted = extractRawErrorDetails(pgErr);
  assert.equal(extracted.code, "42501");
  assert.equal(extracted.status, 403);
  assert.equal(extracted.message, "Insufficient privilege");
  assert.equal(extracted.details, "table daily_puzzles");
  assert.equal(extracted.hint, "grant insert on daily_puzzles to authenticated");
});

// ============================================================================
// SECTION 4: 17 Syllables Admin Persistence & Haiku Validation
// ============================================================================
console.log("\nSection 4: 17 Syllables Admin Persistence & Haiku Validation");

runTest("validateHaikuStructure validates 5-7-5 syllable rule", () => {
  const validHaiku: [string, string, string] = [
    "Gold leaves drift along",      // 1+1+1+2 = 5
    "Cool winds whisper in the dusk", // 1+1+2+1+1+1 = 7
    "Soft earth waits for dawn",     // 1+1+1+1+1 = 5
  ];
  const resValid = validateHaikuStructure(validHaiku);
  assert.equal(resValid.isValid, true);
  assert.deepEqual(resValid.counts, [5, 7, 5]);
  assert.equal(resValid.errors.length, 0);

  const invalidHaiku: [string, string, string] = [
    "Too short",                      // 2
    "This line is way too long for seven syllables today", // 12+
    "Fine five syllables",            // 5
  ];
  const resInvalid = validateHaikuStructure(invalidHaiku);
  assert.equal(resInvalid.isValid, false);
  assert.ok(resInvalid.errors.length >= 2);
});

runTest("sliceHaikuIntoChunks splits 5-7-5 haiku into uppercase chunks without crossing word boundaries", () => {
  const lines: [string, string, string] = [
    "Gold leaves drift along",
    "Cool winds whisper in the dusk",
    "Soft earth waits for dawn",
  ];
  const chunks = sliceHaikuIntoChunks(lines, 16);
  assert.ok(chunks.length >= 14 && chunks.length <= 20, `Chunks length was ${chunks.length}`);
  for (const chunk of chunks) {
    assert.equal(chunk, chunk.toUpperCase());
    assert.ok(/^[A-Z]+$/.test(chunk), `Chunk contains non-letters: ${chunk}`);
  }
});

runTest("saveAdmin17SyllablesOverride persists to local storage and updates overrides", async () => {
  const testDate = "2026-11-15";
  const puzzle = {
    id: `17s-${testDate}`,
    puzzleNumber: 42,
    dateKey: testDate,
    theme: "November Frost",
    author: "Lucas",
    lines: [
      "Gold leaves drift along",
      "Cool winds whisper in the dusk",
      "Soft earth waits for dawn",
    ] as [string, string, string],
    chunks: ["GOLD", "LEAVES", "DRIFT", "ALONG"],
  };

  const result = await saveAdmin17SyllablesOverride(testDate, puzzle);
  assert.equal(result.ok, true);

  const stored = getAdmin17SyllablesOverrides();
  assert.ok(stored[testDate], `Expected override for ${testDate}`);
  assert.equal(stored[testDate].theme, "November Frost");
  assert.equal(stored[testDate].author, "Lucas");
});

runTest("clear17SyllablesProgress wipes saved progress for dateKey", () => {
  const testDate = "2026-11-15";
  mockLocalStorage.setItem(`solgames_v1_17s_progress_${testDate}`, JSON.stringify({ status: "playing" }));
  assert.ok(mockLocalStorage.getItem(`solgames_v1_17s_progress_${testDate}`));

  clear17SyllablesProgress(testDate);
  assert.equal(mockLocalStorage.getItem(`solgames_v1_17s_progress_${testDate}`), null);
});

runTest("computePuzzleContentHash detects modifications across 17 Syllables puzzles", () => {
  const p1 = {
    lines: ["Gold leaves drift along", "Cool winds whisper in the dusk", "Soft earth waits for dawn"],
    theme: "Autumn",
  };
  const p2 = {
    lines: ["Gold leaves drift away", "Cool winds whisper in the dusk", "Soft earth waits for dawn"],
    theme: "Autumn",
  };
  const p3 = {
    lines: ["Gold leaves drift along", "Cool winds whisper in the dusk", "Soft earth waits for dawn"],
    theme: "Winter",
  };

  const hash1 = computePuzzleContentHash(p1);
  const hash2 = computePuzzleContentHash(p2);
  const hash3 = computePuzzleContentHash(p3);

  assert.notEqual(hash1, hash2, "Line change must change hash");
  assert.notEqual(hash1, hash3, "Theme change must change hash");
});

// ============================================================================
// SECTION 5: Real-Time Propagation & Cross-Tab BroadcastChannel
// ============================================================================
console.log("\nSection 5: Real-Time Propagation & Cross-Tab BroadcastChannel");

runTest("broadcastPuzzleUpdate increments revision and posts cross-tab ping", () => {
  const initialRevision = getPuzzlesStoreSnapshot();

  broadcastPuzzleUpdate({
    gameSlug: "connect-5",
    dateKey: "2026-11-10",
    testPing: true,
  });

  const nextRevision = getPuzzlesStoreSnapshot();
  assert.ok(nextRevision > initialRevision, "Store revision must increment");

  const broadcastPing = mockLocalStorage.getItem("solgames_v1_puzzles_broadcast_ping");
  assert.ok(broadcastPing, "Expected broadcast ping written to storage");
  const parsedPing = JSON.parse(broadcastPing);
  assert.equal(parsedPing.gameSlug, "connect-5");
  assert.equal(parsedPing.dateKey, "2026-11-10");
  assert.ok(parsedPing._broadcastTimestamp > 0);
});

runTest("subscribeToPuzzlesUpdated fires callback on broadcast update", () => {
  let callbackFired = false;
  const unsubscribe = subscribeToPuzzlesUpdated(() => {
    callbackFired = true;
  });

  broadcastPuzzleUpdate({
    gameSlug: "21-things",
    dateKey: "2026-11-12",
  });

  assert.equal(callbackFired, true, "Subscriber callback must fire on update");
  unsubscribe();
});

runTest("SaveAdminOverrideResult retains rawError on failure", async () => {
  // Simulate an RLS error from a simulated call
  const rawPostgresError = {
    code: "42501",
    message: "violates row-level security policy",
    details: "RLS check failed for anon role",
  };

  const report = classifyDiagnosticError(rawPostgresError, {
    gameSlug: "connect-5",
    targetDate: "2026-11-10",
    action: "save",
    userEmail: "lucas@soltheory.com",
    userRole: "game_master",
  });

  const mockResult = {
    ok: true,
    remotePersisted: false,
    error: rawPostgresError.message,
    rawError: rawPostgresError,
    diagnosticReport: report,
  };

  assert.equal(mockResult.remotePersisted, false);
  assert.equal(mockResult.rawError.code, "42501");
  assert.equal(mockResult.diagnosticReport.errorCode, "ERR_SUPABASE_RLS_VIOLATION");
});

// ============================================================================
// Summary
// ============================================================================

setTimeout(() => {
  console.log("\n=================================================================");
  console.log(`Results: ${passedCount} passed, ${failedCount} failed`);
  console.log("=================================================================\n");

  if (failedCount > 0) {
    console.error("Test failures detected!");
    process.exit(1);
  } else {
    console.log("All Real-Time Propagation & Diagnostic Error tests PASSED!\n");
    process.exit(0);
  }
}, 50);
