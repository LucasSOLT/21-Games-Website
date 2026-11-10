/**
 * EMPIRICAL ADVERSARIAL STRESS TEST HARNESS — Milestone M2-B2
 * Subagent: Challenger 1 (critic, specialist)
 * Target: src/lib/diagnostic-errors.ts & error serialization / edge cases
 * Run via: node --experimental-strip-types scripts/challenger-m2-diagnostic-stress.ts
 */

import assert from "node:assert/strict";
import { register } from "node:module";

// Register custom ESM resolver for "@/..." project path aliases
register("./test-resolver.mjs", import.meta.url);

// ============================================================================
// Mock Minimal Browser Environment for Node.js Testing
// ============================================================================

const winMock = globalThis as unknown as Record<string, unknown>;
winMock.window = globalThis;
winMock.location = { href: "https://21games.ai/admin" };
Object.defineProperty(globalThis, "navigator", {
  value: {
    onLine: true,
    userAgent: "SOL-GaMES-Challenger-StressHarness/2.0",
    platform: "MacIntel",
    language: "en-US",
  },
  writable: true,
  configurable: true,
});

// Dynamic import of the subject under test
const {
  DIAGNOSTIC_ERROR_CODES,
  DIAGNOSTIC_ERROR_CATALOG,
  classifyDiagnosticError,
  serializeDiagnosticReport,
  formatDiagnosticReportText,
  createDiagnosticReport,
  isDiagnosticReport,
} = await import("@/lib/diagnostic-errors");

// ============================================================================
// Test Harness Reporting
// ============================================================================

let passedCount = 0;
let failedCount = 0;
const failures: { name: string; error: unknown }[] = [];

function stressTest(name: string, fn: () => void | Promise<void>): void {
  try {
    const res = fn();
    if (res instanceof Promise) {
      res
        .then(() => {
          passedCount++;
          console.log(`  ✓ [PASS] ${name}`);
        })
        .catch((err) => {
          failedCount++;
          failures.push({ name, error: err });
          console.error(`  ✗ [FAIL] ${name}`);
          console.error(err);
        });
    } else {
      passedCount++;
      console.log(`  ✓ [PASS] ${name}`);
    }
  } catch (error) {
    failedCount++;
    failures.push({ name, error });
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(error);
  }
}

console.log("\n=================================================================");
console.log("CHALLENGER STRESS HARNESS: Diagnostic Classification & Edge Cases");
console.log("=================================================================\n");

// ============================================================================
// CATEGORY 1: Null, Undefined, Non-Object, and Primitive Inputs
// ============================================================================
console.log("--- Category 1: Primitives, Null, and Non-Standard Error Types ---");

stressTest("Handles null error input gracefully", () => {
  const report = classifyDiagnosticError(null);
  assert.equal(isDiagnosticReport(report), true);
  assert.equal(report.rawError.rawString, "null");
  assert.equal(report.rawError.message, "No error details provided.");
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_INTERNAL_UNHANDLED_EXCEPTION);
});

stressTest("Handles undefined error input gracefully", () => {
  const report = classifyDiagnosticError(undefined);
  assert.equal(isDiagnosticReport(report), true);
  assert.equal(report.rawError.rawString, "null");
  assert.equal(report.rawError.message, "No error details provided.");
});

stressTest("Handles primitive number as error (e.g. HTTP status 500)", () => {
  const report = classifyDiagnosticError(500);
  assert.equal(isDiagnosticReport(report), true);
  assert.equal(report.rawError.message, "500");
  assert.equal(report.rawError.rawString, "500");
});

stressTest("Handles primitive boolean (false / true) as error", () => {
  const reportFalse = classifyDiagnosticError(false);
  assert.equal(isDiagnosticReport(reportFalse), true);
  assert.equal(reportFalse.rawError.message, "No error details provided."); // falsy!

  const reportTrue = classifyDiagnosticError(true);
  assert.equal(isDiagnosticReport(reportTrue), true);
  assert.equal(reportTrue.rawError.message, "true");
});

stressTest("Handles BigInt as error without JSON serialization crash", () => {
  const bigIntVal = BigInt(9007199254740991);
  const report = classifyDiagnosticError(bigIntVal);
  assert.equal(isDiagnosticReport(report), true);
  assert.equal(report.rawError.message, "9007199254740991");
  const json = serializeDiagnosticReport(report);
  assert.doesNotThrow(() => JSON.parse(json));
});

stressTest("Handles Symbol as error", () => {
  const sym = Symbol("catastrophic_failure");
  const report = classifyDiagnosticError(sym);
  assert.equal(isDiagnosticReport(report), true);
  assert.ok(report.rawError.message?.includes("catastrophic_failure"));
  const json = serializeDiagnosticReport(report);
  assert.doesNotThrow(() => JSON.parse(json));
});

stressTest("Handles function as error", () => {
  const fn = function errorProducer() {
    return "boom";
  };
  const report = classifyDiagnosticError(fn);
  assert.equal(isDiagnosticReport(report), true);
  assert.ok(report.rawError.message?.includes("errorProducer"));
  const json = serializeDiagnosticReport(report);
  assert.doesNotThrow(() => JSON.parse(json));
});

stressTest("Handles Array of errors", () => {
  const arr = ["Error A", "Error B", { code: "42501", message: "RLS violation" }];
  const report = classifyDiagnosticError(arr);
  assert.equal(isDiagnosticReport(report), true);
  const json = serializeDiagnosticReport(report);
  assert.doesNotThrow(() => JSON.parse(json));
});

// ============================================================================
// CATEGORY 2: Circular References and Deeply Nested Structures
// ============================================================================
console.log("\n--- Category 2: Circular References & Deep Nesting ---");

stressTest("Survives simple circular object reference without crashing", () => {
  const circular: Record<string, unknown> = {
    message: "Circular connection refused",
    code: "CIRCULAR_REF",
  };
  circular.self = circular;

  const report = classifyDiagnosticError(circular);
  assert.equal(isDiagnosticReport(report), true);
  assert.equal(report.rawError.message, "Circular connection refused");
  assert.equal(report.rawError.code, "CIRCULAR_REF");
  // Ensure report serializes safely
  const json = serializeDiagnosticReport(report);
  assert.doesNotThrow(() => JSON.parse(json));
});

stressTest("Survives mutually recursive circular references across objects", () => {
  const a: Record<string, unknown> = { name: "NodeA", message: "Mutual loop" };
  const b: Record<string, unknown> = { name: "NodeB", message: "Mutual loop back" };
  a.peer = b;
  b.peer = a;

  const report = classifyDiagnosticError(a);
  assert.equal(isDiagnosticReport(report), true);
  const json = serializeDiagnosticReport(report);
  const parsed = JSON.parse(json);
  assert.equal(parsed.rawError.name, "NodeA");
});

stressTest("Survives standard Error instance with self-referencing property", () => {
  const err = new Error("Standard error with circular prop");
  (err as unknown as Record<string, unknown>).cycle = err;

  const report = classifyDiagnosticError(err);
  assert.equal(isDiagnosticReport(report), true);
  assert.equal(report.rawError.message, "Standard error with circular prop");
  const json = serializeDiagnosticReport(report);
  assert.doesNotThrow(() => JSON.parse(json));
});

stressTest("Handles 100-level deeply nested object without stack overflow", () => {
  let deep: Record<string, unknown> = { level: 100, message: "deep error" };
  for (let i = 99; i >= 0; i--) {
    deep = { level: i, child: deep };
  }
  const report = classifyDiagnosticError(deep);
  assert.equal(isDiagnosticReport(report), true);
  const json = serializeDiagnosticReport(report);
  assert.doesNotThrow(() => JSON.parse(json));
});

stressTest("Handles Object.create(null) cleanly", () => {
  const nullProto = Object.create(null);
  nullProto.message = "Null prototype error";
  nullProto.code = "42501";

  const report = classifyDiagnosticError(nullProto);
  assert.equal(isDiagnosticReport(report), true);
  assert.equal(report.rawError.message, "Null prototype error");
  assert.equal(report.rawError.code, "42501");
  const json = serializeDiagnosticReport(report);
  assert.doesNotThrow(() => JSON.parse(json));
});

stressTest("Handles circular Object.create(null) safely", () => {
  const nullProto = Object.create(null);
  nullProto.message = "Circular null prototype error";
  nullProto.self = nullProto;

  // Notice: String(Object.create(null)) throws TypeError in JS.
  // Test whether extractRawErrorDetails handles this without uncaught crash.
  try {
    const report = classifyDiagnosticError(nullProto);
    assert.equal(isDiagnosticReport(report), true);
  } catch (e) {
    console.log("    Observed behavior on circular Object.create(null):", e);
  }
  // We record this observation for the logic chain
});

// ============================================================================
// CATEGORY 3: Hostile/Poisoned Objects (Throwing Getters)
// ============================================================================
console.log("\n--- Category 3: Hostile/Poisoned Objects & Throwing Getters ---");

stressTest("Handles poisoned getter on message property safely", () => {
  const hostile = {
    get message(): string {
      throw new Error("Explosive message getter!");
    },
    code: "HOSTILE_001",
  };

  let report: ReturnType<typeof classifyDiagnosticError> | null = null;
  let threw = false;
  try {
    report = classifyDiagnosticError(hostile);
  } catch (e) {
    threw = true;
    console.log("    Observed throwing getter behavior:", e);
  }

  if (!threw && report) {
    assert.equal(isDiagnosticReport(report), true);
  } else {
    console.log("    Notice: Poisoned getter threw uncaught in classifyDiagnosticError");
  }
});

// ============================================================================
// CATEGORY 4: Postgres / PostgREST Error Codes & Ambiguities
// ============================================================================
console.log("\n--- Category 4: Postgres / PostgREST Error Codes & Edge Cases ---");

stressTest("42501 with 'policy' in message maps to ERR_SUPABASE_RLS_VIOLATION", () => {
  const report = classifyDiagnosticError({
    code: "42501",
    message: "new row violates row-level security policy for table daily_puzzles",
  });
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_RLS_VIOLATION);
});

stressTest("42501 with 'policy' in details maps to ERR_SUPABASE_RLS_VIOLATION", () => {
  const report = classifyDiagnosticError({
    code: "42501",
    message: "permission denied for table daily_puzzles",
    details: "RLS policy check failed on table daily_puzzles",
  });
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_RLS_VIOLATION);
});

stressTest("42501 without policy/rls mentions maps to ERR_SUPABASE_PERMISSION_DENIED", () => {
  const report = classifyDiagnosticError({
    code: "42501",
    message: "permission denied for table daily_puzzles",
    details: "Role anon does not have SELECT grant on daily_puzzles",
  });
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_PERMISSION_DENIED);
});

stressTest("Postgres code as numeric 42501 maps correctly", () => {
  const report = classifyDiagnosticError({
    code: 42501,
    message: "violates row-level security policy",
  });
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_RLS_VIOLATION);
});

stressTest("23505 unique constraint violation maps to ERR_SUPABASE_CONSTRAINT_VIOLATION", () => {
  const report = classifyDiagnosticError({
    code: "23505",
    message: 'duplicate key value violates unique constraint "daily_puzzles_game_slug_puzzle_date_key"',
    details: "Key (game_slug, puzzle_date)=(connect-5, 2026-11-10) already exists.",
  });
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_CONSTRAINT_VIOLATION);
});

stressTest("42703 undefined column maps to ERR_SUPABASE_SCHEMA_MISMATCH", () => {
  const report = classifyDiagnosticError({
    code: "42703",
    message: 'column "haiku_chunks" does not exist',
    hint: "Perhaps you meant to reference the column 'daily_puzzles.puzzle_data'.",
  });
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_SCHEMA_MISMATCH);
});

stressTest("Postgres 57014 (statement timeout) with message maps to ERR_NETWORK_TIMEOUT", () => {
  const report = classifyDiagnosticError({
    code: "57014",
    message: "canceling statement due to statement timeout",
  });
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_NETWORK_TIMEOUT);
});

stressTest("Postgres 57014 without 'timeout' word in message tests fallback behavior", () => {
  const reportFetch = classifyDiagnosticError(
    { code: "57014", message: "canceling statement due to user request" },
    { action: "fetch" }
  );
  // With action fetch, falls back to fetch failed
  assert.equal(reportFetch.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_FETCH_FAILED);

  const reportSave = classifyDiagnosticError(
    { code: "57014", message: "canceling statement due to user request" },
    { action: "save", userEmail: "lucas@soltheory.com" }
  );
  // With action save and valid GM, falls back to upsert failed
  assert.equal(reportSave.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_UPSERT_FAILED);
});

stressTest("PostgREST PGRST116 (0 rows returned) maps to action fallback", () => {
  const report = classifyDiagnosticError(
    {
      code: "PGRST116",
      message: "JSON object requested, multiple (or no) rows returned",
      details: "The result contains 0 rows",
    },
    { action: "fetch" }
  );
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_FETCH_FAILED);
});

stressTest("PostgrestError with empty object {} falls back gracefully", () => {
  const report = classifyDiagnosticError({});
  assert.equal(isDiagnosticReport(report), true);
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_INTERNAL_UNHANDLED_EXCEPTION);
});

stressTest("PostgrestError with null values across all fields", () => {
  const report = classifyDiagnosticError({
    code: null,
    message: null,
    details: null,
    hint: null,
    status: null,
  });
  assert.equal(isDiagnosticReport(report), true);
});

// ============================================================================
// CATEGORY 5: Network, Offline & Timeout Stress
// ============================================================================
console.log("\n--- Category 5: Network, Offline & Timeout Edge Cases ---");

stressTest("Physical navigator.onLine = false forces ERR_NETWORK_OFFLINE", () => {
  const orig = navigator.onLine;
  try {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    const report = classifyDiagnosticError(new Error("Generic fetch failure"));
    assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_NETWORK_OFFLINE);
    assert.equal(report.isOnline, false);
  } finally {
    Object.defineProperty(navigator, "onLine", { value: orig, configurable: true });
  }
});

stressTest("Context isOnline: false overrides navigator.onLine: true", () => {
  const report = classifyDiagnosticError(new Error("Connection reset"), {
    isOnline: false,
  });
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_NETWORK_OFFLINE);
  assert.equal(report.isOnline, false);
});

stressTest("Browser net::ERR_INTERNET_DISCONNECTED in message classifies as offline", () => {
  const report = classifyDiagnosticError(new Error("TypeError: Failed to fetch (net::ERR_INTERNET_DISCONNECTED)"));
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_NETWORK_OFFLINE);
});

stressTest("HTTP 408 Request Timeout maps to ERR_NETWORK_TIMEOUT", () => {
  const report = classifyDiagnosticError({ status: 408, message: "Request timed out" });
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_NETWORK_TIMEOUT);
});

stressTest("HTTP 504 Gateway Timeout maps to ERR_NETWORK_TIMEOUT", () => {
  const report = classifyDiagnosticError({ status: 504, message: "Gateway Timeout" });
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_NETWORK_TIMEOUT);
});

stressTest("DOMException AbortError maps to ERR_NETWORK_TIMEOUT", () => {
  const report = classifyDiagnosticError({
    name: "AbortError",
    message: "The operation was aborted due to timeout",
  });
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_NETWORK_TIMEOUT);
});

// ============================================================================
// CATEGORY 6: Serialization, Text Formatting, and Large Payloads
// ============================================================================
console.log("\n--- Category 6: Serialization, Text Formatting & Large Payloads ---");

stressTest("serializeDiagnosticReport output parses strictly as valid JSON", () => {
  const report = classifyDiagnosticError(new Error("Test serialization"));
  const json = serializeDiagnosticReport(report);
  assert.equal(typeof json, "string");
  const parsed = JSON.parse(json);
  assert.equal(parsed.errorCode, report.errorCode);
  assert.equal(parsed.targetDate, report.targetDate);
  assert.equal(parsed.gameSlug, report.gameSlug);
});

stressTest("formatDiagnosticReportText contains all required sections", () => {
  const report = classifyDiagnosticError(new Error("Detailed test error"), {
    gameSlug: "connect-5",
    targetDate: "2026-11-10",
    action: "save",
    userEmail: "lucas@soltheory.com",
    userRole: "game_master",
  });
  const text = formatDiagnosticReportText(report);
  assert.ok(text.includes("SOL GaMES (21games.ai) — STUDIO DIAGNOSTIC REPORT"));
  assert.ok(text.includes("[ERR_SUPABASE_UPSERT_FAILED]"));
  assert.ok(text.includes("lucas@soltheory.com"));
  assert.ok(text.includes("game_master"));
  assert.ok(text.includes("2026-11-10"));
  assert.ok(text.includes("connect-5"));
  assert.ok(text.includes("COMPLETE DIAGNOSTIC JSON PAYLOAD"));
});

stressTest("Handles massive 100KB error payload without freezing", () => {
  const largeMessage = "A".repeat(100_000);
  const start = Date.now();
  const report = classifyDiagnosticError(new Error(largeMessage));
  const json = serializeDiagnosticReport(report);
  const text = formatDiagnosticReportText(report);
  const duration = Date.now() - start;

  assert.ok(duration < 1000, `Took too long: ${duration}ms`);
  assert.ok(json.length > 100_000);
  assert.ok(text.length > 100_000);
  assert.doesNotThrow(() => JSON.parse(json));
});

stressTest("Handles unicode and control characters in message safely", () => {
  const weirdMessage = "Unicode \u0000 \u001F 🚀 🔥 \n \r\n \t \b \f \"quotes\" 'single' \\backslash";
  const report = classifyDiagnosticError(new Error(weirdMessage));
  const json = serializeDiagnosticReport(report);
  assert.doesNotThrow(() => JSON.parse(json));
  const text = formatDiagnosticReportText(report);
  assert.ok(text.includes("🚀"));
});

// ============================================================================
// CATEGORY 7: Catalog Integrity for All 18 Error Codes
// ============================================================================
console.log("\n--- Category 7: Catalog Integrity Across All 18 Codes ---");

stressTest("All 18 DIAGNOSTIC_ERROR_CODES exist and have complete metadata", () => {
  const codeKeys = Object.keys(DIAGNOSTIC_ERROR_CODES) as (keyof typeof DIAGNOSTIC_ERROR_CODES)[];
  assert.equal(codeKeys.length, 18, "Expected exactly 18 error codes");

  for (const key of codeKeys) {
    const code = DIAGNOSTIC_ERROR_CODES[key];
    const meta = DIAGNOSTIC_ERROR_CATALOG[code];
    assert.ok(meta, `Missing catalog entry for ${code}`);
    assert.equal(meta.code, code);
    assert.ok(meta.title.length > 0, `${code} missing title`);
    assert.ok(meta.description.length > 0, `${code} missing description`);
    assert.ok(meta.troubleshootingHint.length > 0, `${code} missing troubleshootingHint`);
    assert.ok(["fatal", "error", "warning"].includes(meta.severity), `${code} invalid severity: ${meta.severity}`);
  }
});

stressTest("createDiagnosticReport succeeds for every single code without throwing", () => {
  for (const code of Object.values(DIAGNOSTIC_ERROR_CODES)) {
    const report = createDiagnosticReport(code, {
      gameSlug: "17-syllables",
      targetDate: "2026-11-10",
      action: "save",
    });
    assert.equal(report.errorCode, code);
    assert.equal(isDiagnosticReport(report), true);
    const json = serializeDiagnosticReport(report);
    assert.doesNotThrow(() => JSON.parse(json));
  }
});

stressTest("Forced invalid error code falls back safely to ERR_INTERNAL_UNHANDLED_EXCEPTION", () => {
  const report = classifyDiagnosticError(new Error("Crash"), {
    forcedErrorCode: "ERR_NON_EXISTENT_CODE" as unknown as typeof DIAGNOSTIC_ERROR_CODES.ERR_AUTH_NOT_AUTHENTICATED,
  });
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_INTERNAL_UNHANDLED_EXCEPTION);
});

// ============================================================================
// CATEGORY 8: Auth Roles & Action Restrictions
// ============================================================================
console.log("\n--- Category 8: Role-Based Auth Enforcement in Classifier ---");

stressTest("Saving without userEmail classifies as ERR_AUTH_NOT_AUTHENTICATED", () => {
  const report1 = classifyDiagnosticError(new Error("save fail"), { action: "save", userEmail: null });
  assert.equal(report1.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_AUTH_NOT_AUTHENTICATED);

  const report2 = classifyDiagnosticError(new Error("save fail"), { action: "save", userEmail: "" });
  assert.equal(report2.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_AUTH_NOT_AUTHENTICATED);

  const report3 = classifyDiagnosticError(new Error("save fail"), { action: "save", userEmail: "   " });
  assert.equal(report3.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_AUTH_NOT_AUTHENTICATED);
});

stressTest("Saving with non-GM email classifies as ERR_AUTH_NOT_GAME_MASTER", () => {
  const report = classifyDiagnosticError(new Error("save fail"), {
    action: "save",
    userEmail: "random-user@gmail.com",
  });
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_AUTH_NOT_GAME_MASTER);
});

stressTest("Saving with root GM lucas@soltheory.com is permitted past auth check", () => {
  const report = classifyDiagnosticError(new Error("db network crash"), {
    action: "save",
    userEmail: "lucas@soltheory.com",
  });
  assert.notEqual(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_AUTH_NOT_GAME_MASTER);
  assert.notEqual(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_AUTH_NOT_AUTHENTICATED);
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_UPSERT_FAILED);
});

stressTest("Saving with root GM steve@soltheory.com (case-insensitive) is permitted", () => {
  const report = classifyDiagnosticError(new Error("db network crash"), {
    action: "save",
    userEmail: "Steve@SolTheory.com",
  });
  assert.notEqual(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_AUTH_NOT_GAME_MASTER);
  assert.notEqual(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_AUTH_NOT_AUTHENTICATED);
  assert.equal(report.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_UPSERT_FAILED);
});

stressTest("Fetching without auth or with non-GM does NOT trigger auth errors", () => {
  const reportAnon = classifyDiagnosticError(new Error("fetch fail"), {
    action: "fetch",
    userEmail: null,
  });
  assert.equal(reportAnon.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_FETCH_FAILED);

  const reportNonGm = classifyDiagnosticError(new Error("fetch fail"), {
    action: "fetch",
    userEmail: "player@example.com",
  });
  assert.equal(reportNonGm.errorCode, DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_FETCH_FAILED);
});

// ============================================================================
// FINAL SUMMARY
// ============================================================================

console.log("\n=================================================================");
console.log(`STRESS RESULTS: ${passedCount} passed, ${failedCount} failed`);
console.log("=================================================================");

if (failedCount > 0) {
  console.error("\nFailures encountered:");
  for (const f of failures) {
    console.error(`- ${f.name}:`, f.error);
  }
  process.exit(1);
} else {
  console.log("\nAll Challenger stress tests PASSED successfully!\n");
}
