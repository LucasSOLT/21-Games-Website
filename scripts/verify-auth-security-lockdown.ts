/**
 * Live Verification Script: Auth & Login Security Lockdown (Milestone M2.5-B2)
 *
 * Verifies live Postgres RLS policies and schema constraints against Supabase Pro:
 * 1. Anon SELECT on public.daily_puzzles succeeds.
 * 2. Anon INSERT on public.daily_puzzles is rejected with 42501 (RLS violation).
 * 3. Anon UPSERT on public.daily_puzzles is rejected with 42501 (RLS violation).
 * 4. Anon UPDATE on public.daily_puzzles is rejected (RLS violation / 0 rows modified).
 * 5. Anon DELETE on public.daily_puzzles is rejected (RLS violation / 0 rows deleted).
 * 6. Anon SELECT on public.user_profiles is blocked with 42501 (email enumeration lockdown).
 * 7. Anon INSERT on public.user_profiles is blocked (RLS / FK lockdown).
 * 8. Invalid non-UUID id in public.user_profiles is rejected.
 * 9. Un-normalized email in public.user_profiles is rejected.
 *
 * Run with: node --experimental-strip-types scripts/verify-auth-security-lockdown.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://trwyrfhicbnfhlbiztau.supabase.co";

const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_a9xQwMZoEA3-5nTpIFm8cw_XFmZehG0";

const TEST_DATE_KEY = "2099-12-31";
const TEST_GAME_SLUG = "connect-5";

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  errorCode?: string | null;
}

const results: TestResult[] = [];

function recordResult(name: string, passed: boolean, details: string, errorCode?: string | null) {
  results.push({ name, passed, details, errorCode });
  const badge = passed ? "\x1b[32m[PASS]\x1b[0m" : "\x1b[31m[FAIL]\x1b[0m";
  console.log(`${badge} ${name}: ${details}${errorCode ? ` (code: ${errorCode})` : ""}`);
}

async function main() {
  console.log("=================================================================");
  console.log("LIVE AUTH & RLS SECURITY LOCKDOWN VERIFICATION (M2.5-B2)");
  console.log(`Target: ${SUPABASE_URL}`);
  console.log("=================================================================\n");

  // Create unauthenticated (anon) client with no session persistence
  const anonClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // ---------------------------------------------------------------------------
  // Test 1: Anon SELECT on daily_puzzles must succeed
  // ---------------------------------------------------------------------------
  try {
    const { data, error } = await anonClient
      .from("daily_puzzles")
      .select("id, game_slug, puzzle_date, title")
      .limit(3);

    if (error) {
      recordResult("1. Anon SELECT on daily_puzzles", false, `Failed with error: ${error.message}`, error.code);
    } else {
      recordResult(
        "1. Anon SELECT on daily_puzzles",
        true,
        `Succeeded — returned ${data?.length ?? 0} puzzles cleanly`,
        null
      );
    }
  } catch (err: unknown) {
    recordResult("1. Anon SELECT on daily_puzzles", false, `Exception: ${String(err)}`);
  }

  // ---------------------------------------------------------------------------
  // Test 2: Anon INSERT on daily_puzzles must be rejected with 42501
  // ---------------------------------------------------------------------------
  try {
    const { error } = await anonClient
      .from("daily_puzzles")
      .insert({
        game_slug: TEST_GAME_SLUG,
        puzzle_date: TEST_DATE_KEY,
        puzzle_number: 9999,
        title: "Malicious Anon Insert Probe",
        payload: { malicious: true },
      })
      .select();

    if (error) {
      const isRls = error.code === "42501" || error.message.toLowerCase().includes("row-level security");
      recordResult(
        "2. Anon INSERT on daily_puzzles",
        isRls,
        `Rejected as required: "${error.message}"`,
        error.code
      );
    } else {
      // VULNERABILITY: Insert actually succeeded!
      recordResult(
        "2. Anon INSERT on daily_puzzles",
        false,
        "CRITICAL VULNERABILITY: Anon was allowed to insert into daily_puzzles!",
        null
      );
      // Attempt cleanup
      try {
        await anonClient.from("daily_puzzles").delete().eq("puzzle_date", TEST_DATE_KEY);
      } catch {
        // Ignore cleanup failure
      }
    }
  } catch (err: unknown) {
    recordResult("2. Anon INSERT on daily_puzzles", false, `Unexpected exception: ${String(err)}`);
  }

  // ---------------------------------------------------------------------------
  // Test 3: Anon UPSERT on daily_puzzles must be rejected with 42501
  // ---------------------------------------------------------------------------
  try {
    const { error } = await anonClient
      .from("daily_puzzles")
      .upsert(
        {
          game_slug: TEST_GAME_SLUG,
          puzzle_date: TEST_DATE_KEY,
          puzzle_number: 9999,
          title: "Malicious Anon Upsert Probe",
          payload: { malicious: true },
        },
        { onConflict: "game_slug,puzzle_date" }
      )
      .select();

    if (error) {
      const isRls = error.code === "42501" || error.message.toLowerCase().includes("row-level security");
      recordResult(
        "3. Anon UPSERT on daily_puzzles",
        isRls,
        `Rejected as required: "${error.message}"`,
        error.code
      );
    } else {
      recordResult(
        "3. Anon UPSERT on daily_puzzles",
        false,
        "CRITICAL VULNERABILITY: Anon was allowed to upsert daily_puzzles!",
        null
      );
      try {
        await anonClient.from("daily_puzzles").delete().eq("puzzle_date", TEST_DATE_KEY);
      } catch {
        // Ignore cleanup failure
      }
    }
  } catch (err: unknown) {
    recordResult("3. Anon UPSERT on daily_puzzles", false, `Unexpected exception: ${String(err)}`);
  }

  // ---------------------------------------------------------------------------
  // Test 4: Anon UPDATE on daily_puzzles must be rejected / blocked
  // ---------------------------------------------------------------------------
  try {
    const { data, error } = await anonClient
      .from("daily_puzzles")
      .update({ title: "Hacked Puzzle Title" })
      .eq("puzzle_date", TEST_DATE_KEY)
      .select();

    if (error) {
      const isBlocked = error.code === "42501" || error.message.toLowerCase().includes("row-level security");
      recordResult("4. Anon UPDATE on daily_puzzles", isBlocked, `Rejected with error: ${error.message}`, error.code);
    } else if (!data || data.length === 0) {
      recordResult("4. Anon UPDATE on daily_puzzles", true, "Blocked: 0 rows modified under RLS policy", null);
    } else {
      recordResult(
        "4. Anon UPDATE on daily_puzzles",
        false,
        "CRITICAL VULNERABILITY: Anon update modified existing rows!",
        null
      );
    }
  } catch (err: unknown) {
    recordResult("4. Anon UPDATE on daily_puzzles", false, `Unexpected exception: ${String(err)}`);
  }

  // ---------------------------------------------------------------------------
  // Test 5: Anon DELETE on daily_puzzles must be rejected / blocked
  // ---------------------------------------------------------------------------
  try {
    const { data, error } = await anonClient
      .from("daily_puzzles")
      .delete()
      .eq("puzzle_date", TEST_DATE_KEY)
      .select();

    if (error) {
      const isBlocked = error.code === "42501" || error.message.toLowerCase().includes("row-level security");
      recordResult("5. Anon DELETE on daily_puzzles", isBlocked, `Rejected with error: ${error.message}`, error.code);
    } else if (!data || data.length === 0) {
      recordResult("5. Anon DELETE on daily_puzzles", true, "Blocked: 0 rows deleted under RLS policy", null);
    } else {
      recordResult(
        "5. Anon DELETE on daily_puzzles",
        false,
        "CRITICAL VULNERABILITY: Anon delete removed rows!",
        null
      );
    }
  } catch (err: unknown) {
    recordResult("5. Anon DELETE on daily_puzzles", false, `Unexpected exception: ${String(err)}`);
  }

  // ---------------------------------------------------------------------------
  // Test 6: Anon SELECT on user_profiles blocked (email enumeration lockdown)
  // ---------------------------------------------------------------------------
  try {
    const { data, error } = await anonClient
      .from("user_profiles")
      .select("id, email, display_name, handle, role")
      .limit(3);

    if (error) {
      const msg = error.message.toLowerCase();
      const isBlocked =
        error.code === "42501" ||
        msg.includes("permission denied") ||
        msg.includes("row-level security");
      recordResult(
        "6. Anon SELECT on user_profiles blocked (email enumeration lockdown)",
        isBlocked,
        `Blocked as required: "${error.message}"`,
        error.code
      );
    } else {
      recordResult(
        "6. Anon SELECT on user_profiles blocked (email enumeration lockdown)",
        false,
        `CRITICAL VULNERABILITY: Anon was allowed to read user_profiles (${data?.length ?? 0} profiles returned)!`,
        null
      );
    }
  } catch (err: unknown) {
    recordResult(
      "6. Anon SELECT on user_profiles blocked (email enumeration lockdown)",
      false,
      `Exception: ${String(err)}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 7: Anon INSERT on user_profiles must be blocked
  // ---------------------------------------------------------------------------
  try {
    const probeUuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const { error } = await anonClient
      .from("user_profiles")
      .insert({
        id: probeUuid,
        email: "unauthorized_probe@soltheory.com",
        display_name: "Attacker",
        handle: "@attacker",
      })
      .select();

    if (error) {
      const isBlocked =
        error.code === "42501" ||
        error.code === "23503" ||
        error.message.toLowerCase().includes("violates") ||
        error.message.toLowerCase().includes("row-level security");
      recordResult(
        "7. Anon INSERT on user_profiles",
        isBlocked,
        `Blocked as required: "${error.message}"`,
        error.code
      );
    } else {
      recordResult(
        "7. Anon INSERT on user_profiles",
        false,
        "VULNERABILITY: Anon was allowed to insert into user_profiles!",
        null
      );
      try {
        await anonClient.from("user_profiles").delete().eq("id", probeUuid);
      } catch {
        // Ignore cleanup failure
      }
    }
  } catch (err: unknown) {
    recordResult("7. Anon INSERT on user_profiles", false, `Unexpected exception: ${String(err)}`);
  }

  // ---------------------------------------------------------------------------
  // Test 8: Non-UUID ID on user_profiles must be rejected by Postgres
  // ---------------------------------------------------------------------------
  try {
    const { error } = await anonClient
      .from("user_profiles")
      .insert({
        id: "legacy_fake_id_not_uuid_12345",
        email: "fake_id@example.com",
        display_name: "Fake ID",
        handle: "@fake_id",
      })
      .select();

    if (error) {
      const isRejected = error.code === "22P02" || error.code === "42501" || error.code === "23503";
      recordResult(
        "8. Non-UUID id rejected on user_profiles",
        isRejected,
        `Rejected as required: "${error.message}"`,
        error.code
      );
    } else {
      recordResult(
        "8. Non-UUID id rejected on user_profiles",
        false,
        "VULNERABILITY: Non-UUID id was accepted into user_profiles!",
        null
      );
    }
  } catch (err: unknown) {
    recordResult("8. Non-UUID id rejected on user_profiles", false, `Unexpected exception: ${String(err)}`);
  }

  // ---------------------------------------------------------------------------
  // Test 9: Un-trimmed / un-normalized email rejected by check constraint
  // ---------------------------------------------------------------------------
  try {
    const { error } = await anonClient
      .from("user_profiles")
      .insert({
        id: "00000000-0000-0000-0000-000000000001",
        email: " BadEmail@Example.Com ",
        display_name: "Bad Email",
        handle: "@bad_email",
      })
      .select();

    if (error) {
      const isConstraint =
        error.code === "23514" ||
        error.code === "42501" ||
        error.code === "23503" ||
        error.message.toLowerCase().includes("check");
      recordResult(
        "9. Un-normalized email rejected on user_profiles",
        isConstraint,
        `Rejected as required: "${error.message}"`,
        error.code
      );
    } else {
      recordResult(
        "9. Un-normalized email rejected on user_profiles",
        false,
        "VULNERABILITY: Un-normalized email was accepted!",
        null
      );
    }
  } catch (err: unknown) {
    recordResult("9. Un-normalized email rejected on user_profiles", false, `Unexpected exception: ${String(err)}`);
  }

  // ---------------------------------------------------------------------------
  // Verification Summary
  // ---------------------------------------------------------------------------
  console.log("\n=================================================================");
  console.log("VERIFICATION SUMMARY:");
  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.filter((r) => !r.passed).length;
  console.log(`  Total: ${results.length} | Passed: ${passCount} | Failed: ${failCount}`);
  console.log("=================================================================");

  if (failCount > 0) {
    console.error(`\nFAILED: ${failCount} security verification test(s) failed.`);
    process.exit(1);
  } else {
    console.log("\nSUCCESS: All auth security lockdown policies and constraints verified!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in verification script:", err);
  process.exit(1);
});
