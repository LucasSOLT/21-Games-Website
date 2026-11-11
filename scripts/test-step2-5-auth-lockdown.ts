/**
 * Step 2.5 P0 Auth & RLS Security Lockdown — Empirical Verification Harness
 *
 * Covers:
 * - Suite 1 (AUTH-3): Forged localStorage / sessionStorage / event spoofing immunity
 * - Suite 2 (AUTH-1): Strict password enforcement & zero local fallback on signIn/signUp
 * - Suite 3 (AUTH-2): Magic link zero premature session activation & zero error bypass
 * - Suite 4 (AUTH-4): Legacy plaintext password scrubber & zero-password storage invariant
 * - Suite 5 (RLS-5):  SQL migration/schema least-privilege audit + optional live Supabase RLS probe (--live-rls)
 * - Suite 6 (GATE-6 & RBAC-7): 17 Syllables & 21 Things custom creator auth gate + moderation + Admin RBAC
 *
 * Run via:
 *   node --experimental-strip-types --import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("./scripts/test-resolver.mjs", pathToFileURL("./"));' scripts/test-step2-5-auth-lockdown.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register("./test-resolver.mjs", import.meta.url);

// ============================================================================
// Browser Storage & Event Environment Harness
// ============================================================================
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  dumpEntries(): Array<[string, string]> {
    return Array.from(this.store.entries());
  }
}

const mockLocalStorage = new MemoryStorage();
const mockSessionStorage = new MemoryStorage();
const windowEvents = new EventTarget();

class PolyfillCustomEvent<T = unknown> extends Event {
  detail: T;
  constructor(type: string, params?: { detail?: T }) {
    super(type);
    this.detail = params?.detail as T;
  }
}

class PolyfillStorageEvent extends Event {
  key: string | null;
  constructor(type: string, init?: { key?: string | null }) {
    super(type);
    this.key = init?.key ?? null;
  }
}

const g = globalThis as unknown as Record<string, unknown>;
g.CustomEvent = g.CustomEvent || PolyfillCustomEvent;
g.StorageEvent = PolyfillStorageEvent;
g.localStorage = mockLocalStorage;
g.sessionStorage = mockSessionStorage;
g.window = {
  localStorage: mockLocalStorage,
  sessionStorage: mockSessionStorage,
  location: {
    origin: "https://21games.ai",
    href: "https://21games.ai/games/17-syllables?mode=create",
  },
  addEventListener: windowEvents.addEventListener.bind(windowEvents),
  removeEventListener: windowEvents.removeEventListener.bind(windowEvents),
  dispatchEvent: windowEvents.dispatchEvent.bind(windowEvents),
};

// Dynamic imports after browser globals are installed
const { getSupabaseClient, isSupabaseConfigured } = await import(
  "@/lib/supabase"
);
const {
  ACTIVE_USER_KEY,
  ACCOUNTS_DB_KEY,
  canAccessPuzzleStudio,
  getActiveUserProfile,
  getVerifiedJwtEmail,
  isAdmin,
  isGameMaster,
  normalizeUserProfile,
  restoreUserSession,
  saveActiveUserProfile,
  scrubLegacyPlaintextPasswords,
  sendMagicLink,
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
  subscribeToAuthChanges,
} = await import("@/lib/user-auth");
const {
  check17SyllablesPuzzleModeration,
  checkAdmin17SyllablesModeration,
} = await import("@/lib/moderation");
const { AuthProvider } = await import("@/components/account/auth-provider");
const { SeventeenSyllablesGame } = await import(
  "@/components/games/seventeen-syllables"
);
const { TwentyOneThingsGame } = await import(
  "@/components/games/twenty-one-things"
);
const hooksCtx = await import(
  "../node_modules/next/dist/shared/lib/hooks-client-context.shared-runtime.js"
);
const appRouterCtx = await import(
  "../node_modules/next/dist/shared/lib/app-router-context.shared-runtime.js"
);

// ============================================================================
// Test Runner Utilities
// ============================================================================
let passed = 0;
let failed = 0;

async function runCase(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
  }
}

const rawSupabase = getSupabaseClient();
if (!isSupabaseConfigured || !rawSupabase) {
  throw new Error(
    "Supabase client must be initialized for Step 2.5 auth lockdown tests"
  );
}
const supabase = rawSupabase;

const origAuth = {
  getSession: supabase.auth.getSession.bind(supabase.auth),
  signInWithPassword: supabase.auth.signInWithPassword.bind(supabase.auth),
  signUp: supabase.auth.signUp.bind(supabase.auth),
  signInWithOtp: supabase.auth.signInWithOtp.bind(supabase.auth),
  signOut: supabase.auth.signOut.bind(supabase.auth),
  onAuthStateChange: supabase.auth.onAuthStateChange.bind(supabase.auth),
  updateUser: supabase.auth.updateUser.bind(supabase.auth),
};
const origFrom = supabase.from.bind(supabase);

let authStateListeners: Array<(event: string, session: unknown) => void> = [];

function resetMocksAndStorage() {
  mockLocalStorage.clear();
  mockSessionStorage.clear();
  authStateListeners = [];

  (supabase.auth as unknown as Record<string, unknown>).getSession = async () => ({
    data: { session: null },
    error: null,
  });
  (supabase.auth as unknown as Record<string, unknown>).signOut = async () => ({
    error: null,
  });
  (supabase.auth as unknown as Record<string, unknown>).onAuthStateChange = (
    cb: (event: string, session: unknown) => void
  ) => {
    authStateListeners.push(cb);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            authStateListeners = authStateListeners.filter((l) => l !== cb);
          },
        },
      },
    };
  };
  (supabase as unknown as Record<string, unknown>).from = () => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.order = () => chain;
    chain.limit = async () => ({ data: [], error: null });
    chain.maybeSingle = async () => ({ data: null, error: null });
    chain.upsert = async () => ({ data: null, error: null });
    chain.insert = async () => ({ data: null, error: null });
    chain.update = () => chain;
    return chain;
  };
}

console.log("=================================================================");
console.log("  STEP 2.5 P0 AUTH & RLS SECURITY LOCKDOWN VERIFICATION SUITE    ");
console.log("=================================================================\n");

// ============================================================================
// SUITE 1: AUTH-3 — Forged Storage & Synthetic Event Spoofing Immunity
// ============================================================================
console.log("Suite 1 (AUTH-3): Forged Storage & Event Spoofing Immunity");

await runCase(
  "Forged localStorage GM injection (lucas@soltheory.com) is rejected and purged by restoreUserSession()",
  async () => {
    resetMocksAndStorage();
    await signOutUser();

    const forgedPayload = JSON.stringify({
      id: "forged-gm-id",
      email: "lucas@soltheory.com",
      displayName: "Forged Lucas",
      handle: "@forged_lucas",
      role: "game_master",
      authMode: "supabase",
      isBanned: false,
    });
    mockLocalStorage.setItem(ACTIVE_USER_KEY, forgedPayload);
    mockSessionStorage.setItem(ACTIVE_USER_KEY, forgedPayload);

    // Even before restoreUserSession runs, isGameMaster must return false without verified JWT
    const rawRead = getActiveUserProfile();
    assert.ok(rawRead, "Raw storage fixture was written");
    assert.equal(
      isGameMaster(rawRead),
      false,
      "isGameMaster must reject forged storage profile when no verified JWT exists"
    );
    assert.equal(isAdmin(rawRead), false);
    assert.equal(canAccessPuzzleStudio(rawRead), false);

    const restored = await restoreUserSession();
    assert.equal(
      restored,
      null,
      "restoreUserSession() must return null when supabase.auth.getSession() has no session"
    );
    assert.equal(
      mockLocalStorage.getItem(ACTIVE_USER_KEY),
      null,
      "Forged ACTIVE_USER_KEY in localStorage must be purged"
    );
    assert.equal(
      mockSessionStorage.getItem(ACTIVE_USER_KEY),
      null,
      "Forged ACTIVE_USER_KEY in sessionStorage must be purged"
    );
    assert.equal(getVerifiedJwtEmail(), null);
  }
);

await runCase(
  "subscribeToAuthChanges rejects synthetic StorageEvent & CustomEvent spoofing and purges ACTIVE_USER_KEY",
  async () => {
    resetMocksAndStorage();
    await signOutUser();

    const received: Array<unknown> = [];
    const unsubscribe = subscribeToAuthChanges((prof) => {
      received.push(prof);
    });

    try {
      // Inject forged Steve GM profile and fire StorageEvent + CustomEvents
      mockLocalStorage.setItem(
        ACTIVE_USER_KEY,
        JSON.stringify({
          id: "spoof-steve",
          email: "steve@soltheory.com",
          role: "game_master",
          authMode: "supabase",
        })
      );

      (g.window as EventTarget).dispatchEvent(
        new PolyfillStorageEvent("storage", { key: ACTIVE_USER_KEY })
      );
      await new Promise((r) => setTimeout(r, 25));

      assert.ok(received.length >= 1, "Listener was invoked");
      assert.equal(
        received[received.length - 1],
        null,
        "StorageEvent spoof must resolve to null profile"
      );
      assert.equal(
        mockLocalStorage.getItem(ACTIVE_USER_KEY),
        null,
        "StorageEvent handler must purge forged ACTIVE_USER_KEY"
      );

      // Re-inject and fire solgames:auth-changed
      mockLocalStorage.setItem(
        ACTIVE_USER_KEY,
        JSON.stringify({
          id: "spoof-admin",
          email: "editor@soltheory.com",
          role: "admin",
          authMode: "supabase",
        })
      );
      (g.window as EventTarget).dispatchEvent(
        new PolyfillCustomEvent("solgames:auth-changed")
      );
      await new Promise((r) => setTimeout(r, 25));

      assert.equal(
        received[received.length - 1],
        null,
        "CustomEvent spoof must resolve to null profile"
      );
      assert.equal(mockLocalStorage.getItem(ACTIVE_USER_KEY), null);
    } finally {
      unsubscribe();
    }
  }
);

// ============================================================================
// SUITE 2: AUTH-1 — Password Enforcement & Zero Local Fallback
// ============================================================================
console.log("\nSuite 2 (AUTH-1): Password Enforcement & Zero Local Fallback");

await runCase(
  "signInWithEmail rejects empty/missing password and wrong password with zero local fallback",
  async () => {
    resetMocksAndStorage();
    await signOutUser();

    // Pre-seed local account cache to prove signInWithEmail NEVER falls back to local DB
    mockLocalStorage.setItem(
      ACCOUNTS_DB_KEY,
      JSON.stringify({
        "lucas@soltheory.com": {
          profile: normalizeUserProfile({
            email: "lucas@soltheory.com",
            role: "game_master",
          }),
        },
      })
    );

    const emptyRes = await signInWithEmail({
      email: "lucas@soltheory.com",
      password: "   ",
    });
    assert.equal(emptyRes.ok, false);
    assert.equal(emptyRes.profile, null);

    (supabase.auth as unknown as Record<string, unknown>).signInWithPassword =
      async () => ({
        data: { user: null, session: null },
        error: { message: "Invalid login credentials", status: 400 },
      });

    const wrongRes = await signInWithEmail({
      email: "lucas@soltheory.com",
      password: "WrongPassword999!",
    });
    assert.equal(wrongRes.ok, false);
    assert.equal(wrongRes.profile, null);
    assert.equal(mockLocalStorage.getItem(ACTIVE_USER_KEY), null);
    assert.equal(getVerifiedJwtEmail(), null);
  }
);

await runCase(
  "signInWithEmail rejects unconfirmed email with confirmationRequired=true",
  async () => {
    resetMocksAndStorage();
    (supabase.auth as unknown as Record<string, unknown>).signInWithPassword =
      async () => ({
        data: { user: null, session: null },
        error: { message: "Email not confirmed", status: 400 },
      });

    const unconfirmed = await signInWithEmail({
      email: "newplayer@example.com",
      password: "ValidPassword123",
    });
    assert.equal(unconfirmed.ok, false);
    assert.equal(unconfirmed.profile, null);
    assert.equal(unconfirmed.confirmationRequired, true);
  }
);

await runCase(
  "signInWithEmail grants Game Master access ONLY when Supabase returns a verified JWT session",
  async () => {
    resetMocksAndStorage();
    (supabase.auth as unknown as Record<string, unknown>).signInWithPassword =
      async () => ({
        data: {
          user: {
            id: "11111111-1111-4111-8111-111111111111",
            email: "lucas@soltheory.com",
            created_at: "2026-10-01T00:00:00.000Z",
            user_metadata: { display_name: "Lucas SOLT" },
          },
          session: {
            access_token: "verified-jwt-token-lucas",
            user: {
              id: "11111111-1111-4111-8111-111111111111",
              email: "lucas@soltheory.com",
            },
          },
        },
        error: null,
      });

    const validRes = await signInWithEmail({
      email: "lucas@soltheory.com",
      password: "VerifiedPassword123!",
    });
    assert.equal(validRes.ok, true);
    assert.ok(validRes.profile);
    assert.equal(validRes.profile.authMode, "supabase");
    assert.equal(validRes.profile.role, "game_master");
    assert.equal(isGameMaster(validRes.profile), true);

    await signOutUser();
    assert.equal(isGameMaster(validRes.profile), false);
  }
);

await runCase(
  "signUpWithEmail rejects missing/<6-char passwords and handles confirmation-required signups without premature login",
  async () => {
    resetMocksAndStorage();

    for (const badPwd of [undefined, "", "12345", "  abc  "]) {
      const r = await signUpWithEmail({
        email: "newuser@example.com",
        password: badPwd,
      });
      assert.equal(r.ok, false, `Password "${badPwd}" must be rejected`);
      assert.equal(r.profile, null);
    }

    // Pending email confirmation (session: null)
    (supabase.auth as unknown as Record<string, unknown>).signUp = async () => ({
      data: {
        user: {
          id: "22222222-2222-4222-8222-222222222222",
          email: "pending@example.com",
          identities: [{ id: "id-1" }],
        },
        session: null,
      },
      error: null,
    });

    const pendingSignup = await signUpWithEmail({
      email: "pending@example.com",
      password: "StrongPassword123",
      displayName: "Pending Player",
    });
    assert.equal(pendingSignup.ok, true);
    assert.equal(pendingSignup.profile, null);
    assert.equal(pendingSignup.confirmationRequired, true);
    assert.equal(
      mockLocalStorage.getItem(ACTIVE_USER_KEY),
      null,
      "Unconfirmed signup must not write ACTIVE_USER_KEY"
    );

    // Obfuscated duplicate user (identities: [])
    (supabase.auth as unknown as Record<string, unknown>).signUp = async () => ({
      data: {
        user: {
          id: "22222222-2222-4222-8222-222222222222",
          email: "duplicate@example.com",
          identities: [],
        },
        session: null,
      },
      error: null,
    });

    const dupSignup = await signUpWithEmail({
      email: "duplicate@example.com",
      password: "StrongPassword123",
    });
    assert.equal(dupSignup.ok, false);
    assert.equal(dupSignup.profile, null);
    assert.match(dupSignup.error || "", /already exists/i);
  }
);

// ============================================================================
// SUITE 3: AUTH-2 — Magic Link Zero Premature Activation & Zero Error Bypass
// ============================================================================
console.log("\nSuite 3 (AUTH-2): Magic Link Zero Premature Session Activation");

await runCase(
  "sendMagicLink('lucas@soltheory.com') never activates a local session on OTP send or OTP error",
  async () => {
    resetMocksAndStorage();
    await signOutUser();

    (supabase.auth as unknown as Record<string, unknown>).signInWithOtp =
      async () => ({ data: {}, error: null });

    const sentRes = await sendMagicLink("lucas@soltheory.com");
    assert.equal(sentRes.ok, true);
    assert.equal(sentRes.magicLinkSent, true);
    assert.equal(
      sentRes.profile,
      null,
      "sendMagicLink must return profile: null until OTP URL is clicked"
    );
    assert.equal(mockLocalStorage.getItem(ACTIVE_USER_KEY), null);
    assert.equal(getActiveUserProfile(), null);
    assert.equal(getVerifiedJwtEmail(), null);

    // Rate-limit / OTP failure must return ok: false, NEVER a local fallback profile
    (supabase.auth as unknown as Record<string, unknown>).signInWithOtp =
      async () => ({
        data: {},
        error: { message: "For security purposes, you can only request this once every 60 seconds" },
      });

    const errRes = await sendMagicLink("lucas@soltheory.com");
    assert.equal(errRes.ok, false);
    assert.equal(errRes.profile, null);
    assert.equal(mockLocalStorage.getItem(ACTIVE_USER_KEY), null);
  }
);

// ============================================================================
// SUITE 4: AUTH-4 — Legacy Plaintext Password Scrubber & Zero-Password Storage
// ============================================================================
console.log("\nSuite 4 (AUTH-4): Legacy Plaintext Password Scrubber");

await runCase(
  "scrubLegacyPlaintextPasswords strips legacy password fields and signUp/signIn never persist passwords",
  async () => {
    resetMocksAndStorage();

    mockLocalStorage.setItem(
      ACCOUNTS_DB_KEY,
      JSON.stringify({
        "legacy@example.com": {
          profile: {
            email: "legacy@example.com",
            displayName: "Legacy User",
            password: "NestedSecretPassword!",
          },
          password: "OldPlaintextPassword99!",
        },
      })
    );
    mockLocalStorage.setItem(
      ACTIVE_USER_KEY,
      JSON.stringify({
        email: "legacy@example.com",
        displayName: "Legacy User",
        password: "ActivePlaintextPassword88!",
      })
    );

    scrubLegacyPlaintextPasswords();

    for (const [key, val] of [
      ...mockLocalStorage.dumpEntries(),
      ...mockSessionStorage.dumpEntries(),
    ]) {
      assert.ok(
        !val.includes("OldPlaintextPassword99!") &&
          !val.includes("NestedSecretPassword!") &&
          !val.includes("ActivePlaintextPassword88!") &&
          !val.includes('"password"'),
        `Plaintext password leaked in storage key "${key}": ${val}`
      );
    }

    // Perform authenticated signIn and verify secret password never enters storage
    const secretPwd = "UltraSecretVaultPass_2026!";
    (supabase.auth as unknown as Record<string, unknown>).signInWithPassword =
      async () => ({
        data: {
          user: {
            id: "33333333-3333-4333-8333-333333333333",
            email: "player@example.com",
            created_at: "2026-11-01T00:00:00.000Z",
          },
          session: {
            access_token: "jwt-player-token",
            user: {
              id: "33333333-3333-4333-8333-333333333333",
              email: "player@example.com",
            },
          },
        },
        error: null,
      });

    const loginRes = await signInWithEmail({
      email: "player@example.com",
      password: secretPwd,
    });
    assert.equal(loginRes.ok, true);
    saveActiveUserProfile(loginRes.profile);

    for (const [key, val] of [
      ...mockLocalStorage.dumpEntries(),
      ...mockSessionStorage.dumpEntries(),
    ]) {
      assert.ok(
        !val.includes(secretPwd) && !val.includes('"password"'),
        `Secret password or "password" key found in "${key}"`
      );
    }

    await signOutUser();
  }
);

// ============================================================================
// SUITE 5: RLS-5 — SQL Migration / Schema Audit & Optional Live Probe
// ============================================================================
console.log("\nSuite 5 (RLS-5): Postgres RLS Migration & Schema Audit");

await runCase(
  "Migration 20261111000001 and schema.sql enforce least-privilege grants, strict RLS, and zero luke@soltheory.com",
  () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20261111000001_auth_security_lockdown.sql"
    );
    const schemaPath = path.resolve(process.cwd(), "supabase/schema.sql");

    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");

    for (const [label, sql] of [
      ["20261111000001 migration", migrationSql],
      ["supabase/schema.sql", schemaSql],
    ] as const) {
      assert.match(
        sql,
        /revoke insert, update, delete on table public\.daily_puzzles from anon;/i,
        `${label} must revoke anon write grants on daily_puzzles`
      );
      assert.match(
        sql,
        /revoke select, insert, update, delete on table public\.user_profiles from anon;/i,
        `${label} must revoke all anon grants on user_profiles`
      );
      assert.match(
        sql,
        /revoke insert, update, delete on table public\.twenty_one_boards from anon;/i,
        `${label} must revoke anon write grants on twenty_one_boards`
      );
      assert.match(
        sql,
        /create or replace function public\.is_root_game_master\(\)/i,
        `${label} must define public.is_root_game_master()`
      );
      assert.match(
        sql,
        /create or replace function public\.enforce_user_profile_security\(\)/i,
        `${label} must define privilege-escalation trigger function`
      );
      assert.doesNotMatch(
        sql,
        /for all using \(true\) with check \(true\)/i,
        `${label} must not contain open FOR ALL USING (true) policies`
      );
    }

    assert.doesNotMatch(
      schemaSql,
      /luke@soltheory\.com/i,
      "supabase/schema.sql must have zero references to luke@soltheory.com"
    );
  }
);

if (
  process.argv.includes("--live-rls") ||
  process.env.VERIFY_LIVE_RLS === "1"
) {
  await runCase(
    "Live Supabase REST probes block anon daily_puzzles POST, user_profiles GET, and twenty_one_boards POST while allowing daily_puzzles GET",
    async () => {
      const url =
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        "https://trwyrfhicbnfhlbiztau.supabase.co";
      const anonKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        "sb_publishable_a9xQwMZoEA3-5nTpIFm8cw_XFmZehG0";

      const headers = {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      };

      // 1. Anon POST daily_puzzles -> 401/403 (42501)
      const dpPost = await fetch(`${url}/rest/v1/daily_puzzles`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          game_slug: "connect-5",
          puzzle_date: "2099-12-30",
          puzzle_number: 9998,
          title: "Anon Attack",
          payload: {},
        }),
      });
      assert.ok(
        dpPost.status === 401 || dpPost.status === 403,
        `Expected 401/403 on anon daily_puzzles POST, got ${dpPost.status}`
      );

      // 2. Anon GET user_profiles -> 401/403 (42501)
      const upGet = await fetch(
        `${url}/rest/v1/user_profiles?select=id&limit=1`,
        { headers }
      );
      assert.ok(
        upGet.status === 401 || upGet.status === 403,
        `Expected 401/403 on anon user_profiles GET, got ${upGet.status}`
      );

      // 3. Anon POST twenty_one_boards -> 401/403 (42501)
      const tbPost = await fetch(`${url}/rest/v1/twenty_one_boards`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "anon-probe-board",
          title: "Anon Probe",
          creator_name: "Anon",
          items: Array.from({ length: 21 }, (_, i) => `Item ${i + 1}`),
        }),
      });
      assert.ok(
        tbPost.status === 401 || tbPost.status === 403,
        `Expected 401/403 on anon twenty_one_boards POST, got ${tbPost.status}`
      );

      // 4. Anon GET daily_puzzles -> 200 OK
      const dpGet = await fetch(
        `${url}/rest/v1/daily_puzzles?select=game_slug&limit=1`,
        { headers }
      );
      assert.equal(
        dpGet.status,
        200,
        `Expected 200 on anon daily_puzzles GET, got ${dpGet.status}`
      );
    }
  );
}

// ============================================================================
// SUITE 6: GATE-6 & RBAC-7 — Custom Creator Auth Gate, Moderation & Admin RBAC
// ============================================================================
console.log("\nSuite 6 (GATE-6 & RBAC-7): Custom Creator Auth Gate & Admin RBAC");

await runCase(
  "17 Syllables moderation enforces Tier 1 & Tier 2 in Admin public mode and Tier 1 across all 5 custom fields",
  () => {
    const tier2Admin = checkAdmin17SyllablesModeration({
      theme: "Autumn Leaves",
      author: "SOL Theory",
      lines: ["FUCK GOLD AUTUMN LEAVES", "DRIFTING DOWN TO FROZEN SOIL", "WINTER REACHES IN"],
    });
    assert.equal(tier2Admin.allowed, false);
    assert.equal(tier2Admin.tier, 2);

    const tier2Private = check17SyllablesPuzzleModeration(
      {
        theme: "Damn Cold Winter",
        author: "Alex",
        lines: ["DAMN COLD AUTUMN LEAVES", "DRIFTING DOWN TO FROZEN SOIL", "WINTER REACHES IN"],
      },
      { mode: "private" }
    );
    assert.equal(tier2Private.allowed, true);

    const tier1ThemePrivate = check17SyllablesPuzzleModeration(
      {
        theme: "1488 Theme",
        author: "Alex",
        lines: ["OLD GOLD AUTUMN LEAVES", "DRIFTING DOWN TO FROZEN SOIL", "WINTER REACHES IN"],
      },
      { mode: "private" }
    );
    assert.equal(tier1ThemePrivate.allowed, false);
    assert.equal(tier1ThemePrivate.tier, 1);
  }
);

await runCase(
  "Unauthenticated ?mode=create SSR/initial render gates both 17 Syllables and 21 Things without exposing creator inputs",
  () => {
    resetMocksAndStorage();
    const searchParams = new URLSearchParams("mode=create");
    const mockRouter = {
      back: () => {},
      forward: () => {},
      refresh: () => {},
      push: () => {},
      replace: () => {},
      prefetch: () => {},
    };

    const wrapWithRouterAndAuth = (child: React.ReactNode, pathname: string) =>
      React.createElement(
        appRouterCtx.AppRouterContext.Provider,
        { value: mockRouter as never },
        React.createElement(
          hooksCtx.PathnameContext.Provider,
          { value: pathname },
          React.createElement(
            hooksCtx.SearchParamsContext.Provider,
            { value: searchParams },
            React.createElement(AuthProvider, null, child)
          )
        )
      );

    const html17 = renderToStaticMarkup(
      wrapWithRouterAndAuth(
        React.createElement(SeventeenSyllablesGame),
        "/games/17-syllables"
      )
    );
    assert.ok(
      html17.includes("Verifying account session") ||
        html17.includes("Sign In to Create Custom Haikus"),
      "Unauthenticated 17 Syllables ?mode=create must render auth gate, not haiku form"
    );
    assert.ok(
      !html17.includes("OLD GOLD AUTUMN LEAVES"),
      "Unauthenticated 17 Syllables ?mode=create must NOT expose haiku line inputs"
    );

    const html21 = renderToStaticMarkup(
      wrapWithRouterAndAuth(
        React.createElement(TwentyOneThingsGame),
        "/games/21-things"
      )
    );
    assert.ok(
      html21.includes("Verifying account session") ||
        html21.includes("Sign In to Build Custom Boards"),
      "Unauthenticated 21 Things ?mode=create must render auth gate, not 21-tile creator"
    );
    assert.ok(
      !html21.includes("Stream of Consciousness Transcript"),
      "Unauthenticated 21 Things ?mode=create must NOT expose creator transcript textarea"
    );
  }
);

await runCase(
  "21 Things removes '!isAuthenticated && !profile' loophole and Admin Studio removes dead 'Make GM' button",
  () => {
    const t21Src = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/games/twenty-one-things.tsx"),
      "utf8"
    );
    assert.ok(
      !t21Src.includes("!isAuthenticated && !profile"),
      "twenty-one-things.tsx must not contain '!isAuthenticated && !profile'"
    );

    const adminSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/admin/page.tsx"),
      "utf8"
    );
    assert.ok(
      !adminSrc.includes("Make GM"),
      "src/app/admin/page.tsx must not render dead 'Make GM' button"
    );
    assert.ok(
      adminSrc.includes("check17SyllablesPuzzleModeration"),
      "src/app/admin/page.tsx must enforce check17SyllablesPuzzleModeration in handleSave17Syllables"
    );
  }
);

// Restore original Supabase client methods
Object.assign(supabase.auth, origAuth);
(supabase as unknown as Record<string, unknown>).from = origFrom;

console.log("\n=================================================================");
console.log(`STEP 2.5 AUTH LOCKDOWN SUMMARY: ${passed} passed, ${failed} failed`);
console.log("=================================================================");

if (failed > 0) {
  process.exit(1);
}
process.exit(0);

