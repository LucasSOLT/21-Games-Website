/**
 * Empirical Live Verification Script: Cross-Device Supabase Realtime Delivery
 *
 * Verifies live WebSocket event propagation between two independent Supabase
 * client instances connected to https://trwyrfhicbnfhlbiztau.supabase.co.
 *
 * Run with: node --experimental-strip-types scripts/verify-live-supabase-realtime.ts
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

async function main() {
  console.log("=================================================================");
  console.log("LIVE REALTIME VERIFICATION: Two Independent Supabase Clients");
  console.log(`Target Supabase URL: ${SUPABASE_URL}`);
  console.log("=================================================================");

  // Initialize two independent Supabase client instances (simulating Device A and Device B)
  const clientA = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const clientB = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("\n[1/4] Establishing WebSocket Realtime connections for Client A and Client B...");

  let clientBReceivedBroadcast = false;
  let receivedPayload: unknown = null;

  // Setup Client B (Subscriber) on channel "daily_puzzles_live"
  const channelB = clientB.channel("daily_puzzles_live", {
    config: {
      broadcast: { self: false },
    },
  });

  channelB.on(
    "broadcast",
    { event: "puzzle_updated" },
    (msg: { payload?: unknown } | unknown) => {
      console.log(" -> [Client B] Received live broadcast message over WebSocket!");
      clientBReceivedBroadcast = true;
      receivedPayload = msg && typeof msg === "object" && "payload" in msg ? msg.payload : msg;
    }
  );

  // Setup Client A (Broadcaster) on channel "daily_puzzles_live"
  const channelA = clientA.channel("daily_puzzles_live", {
    config: {
      broadcast: { self: false },
    },
  });

  // Subscribe both channels and wait for SUBSCRIBED status
  await Promise.all([
    new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Client B subscribe timeout")), 15000);
      channelB.subscribe((status, err) => {
        console.log(`   Client B status: ${status}${err ? ` (error: ${err.message})` : ""}`);
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        }
      });
    }),
    new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Client A subscribe timeout")), 15000);
      channelA.subscribe((status, err) => {
        console.log(`   Client A status: ${status}${err ? ` (error: ${err.message})` : ""}`);
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        }
      });
    }),
  ]);

  console.log("\n[2/4] Both clients subscribed to 'daily_puzzles_live' channel.");

  // Client A broadcasts puzzle update
  const testPayload = {
    gameSlug: TEST_GAME_SLUG,
    dateKey: TEST_DATE_KEY,
    hash: "test-live-hash-2099",
    payload: {
      puzzleNumber: 9999,
      words: [
        { word: "ALPHA", hint: "Beginning" },
        { word: "BRAVO", hint: "Cheer" },
        { word: "CHRLI", hint: "Letter C" },
        { word: "DELTA", hint: "River mouth" },
        { word: "ECHO1", hint: "Reflection" },
      ],
      connectionExplanation: "Phonetic test words",
    },
  };

  console.log("\n[3/4] Client A sending broadcast over WebSocket...");
  const sendResult = await channelA.send({
    type: "broadcast",
    event: "puzzle_updated",
    payload: testPayload,
  });
  console.log(`   Client A send() result: ${sendResult}`);

  // Wait up to 10 seconds for Client B to receive the message
  const startTime = Date.now();
  while (!clientBReceivedBroadcast && Date.now() - startTime < 10000) {
    await new Promise((r) => setTimeout(r, 200));
  }

  // [4/4] Verify live RLS lockdown: anon SELECT allowed, anon INSERT/UPSERT blocked (42501)
  console.log("\n[4/4] Verifying live Postgres RLS lockdown on daily_puzzles...");
  const selectProbe = await clientA
    .from("daily_puzzles")
    .select("game_slug, puzzle_date")
    .limit(1);
  const anonSelectAllowed = !selectProbe.error;
  console.log(
    `   Anon SELECT on daily_puzzles: ${anonSelectAllowed ? "ALLOWED (expected)" : `FAILED (${selectProbe.error?.message})`}`
  );

  const insertProbe = await clientA.from("daily_puzzles").insert({
    game_slug: TEST_GAME_SLUG,
    puzzle_date: TEST_DATE_KEY,
    puzzle_number: 9999,
    title: "Unauthorized Anon Probe",
    payload: testPayload.payload,
  });
  const anonWriteBlocked =
    Boolean(insertProbe.error) &&
    (insertProbe.error?.code === "42501" ||
      (insertProbe.error?.message || "")
        .toLowerCase()
        .includes("permission denied") ||
      (insertProbe.error?.message || "")
        .toLowerCase()
        .includes("row-level security"));
  console.log(
    `   Anon INSERT on daily_puzzles: ${
      anonWriteBlocked
        ? `BLOCKED as required (${insertProbe.error?.code}: ${insertProbe.error?.message})`
        : "UNEXPECTEDLY ALLOWED"
    }`
  );

  // Cleanup channels
  try {
    await clientA.removeChannel(channelA);
    await clientB.removeChannel(channelB);
  } catch {
    // Ignore cleanup errors
  }

  console.log("\n=================================================================");
  console.log("FINAL REALTIME & RLS VERIFICATION RESULT:");
  console.log(`  Client B Received Broadcast: ${clientBReceivedBroadcast}`);
  if (receivedPayload) {
    console.log("  Received Payload Match:", (receivedPayload as { gameSlug?: string }).gameSlug === TEST_GAME_SLUG);
  }
  console.log(`  Anon SELECT Allowed:         ${anonSelectAllowed}`);
  console.log(`  Anon Write Blocked (42501):  ${anonWriteBlocked}`);
  console.log(`  REALTIME DELIVERED:          ${clientBReceivedBroadcast}`);
  console.log("=================================================================");

  if (!clientBReceivedBroadcast || !anonSelectAllowed || !anonWriteBlocked) {
    console.error(
      "FAILED: Realtime broadcast or RLS lockdown verification check failed."
    );
    process.exit(1);
  }

  console.log("SUCCESS: Realtime WebSocket event delivered and RLS write lockdown verified!");
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL ERROR in realtime verification:", err);
  process.exit(1);
});
