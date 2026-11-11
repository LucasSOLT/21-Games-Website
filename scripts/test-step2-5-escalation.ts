/**
 * Step 2.5 — AUTHENTICATED privilege-escalation test (iteration 2, finding H1).
 *
 * Why this exists: the original lockdown suite only probed the database as `anon`,
 * so a broken `enforce_user_profile_security()` trigger (SECURITY DEFINER +
 * legacy `request.jwt.claim.role` GUC) went unnoticed. This script drives the REAL
 * stack with REAL signed `authenticated` JWTs:
 *
 *   LOCAL mode (default, no credentials needed)
 *     - initdb a throw-away PostgreSQL cluster (needs PostgreSQL server binaries,
 *       auto-detected in /usr/lib/postgresql/*\/bin or $PG_BIN),
 *     - emulate Supabase's roles (anon / authenticated / service_role /
 *       authenticator) and `auth` schema (auth.uid()/role()/jwt() use the SAME
 *       definitions as Supabase, i.e. they read request.jwt.claims),
 *     - apply every file in supabase/migrations in order,
 *     - run the real PostgREST binary (auto-downloaded to the OS temp dir if absent,
 *       or $POSTGREST_BIN) which sets `request.jwt.claims` exactly like Supabase,
 *     - PHASE A (pre-fix reproduction): apply only migrations <= 20261111000001 and
 *       prove the escalation is exploitable (role='admin' self-promotion, self-unban),
 *     - PHASE B (post-fix): apply all migrations and assert every escalation is
 *       rejected while legitimate own-profile updates still work.
 *
 *   LIVE mode (`--live-auth`, requires env SUPABASE_SERVICE_ROLE_KEY; never printed)
 *     - creates two disposable confirmed users through the GoTrue admin API, runs the
 *       same core escalation checks against the production REST API with their real
 *       JWTs, and ALWAYS deletes the users (and any rows) afterwards.
 *     - If no service-role key is available the live phase is skipped with a notice
 *       (a signup through the public API would leave undeletable residue).
 *
 * Run: node --experimental-strip-types scripts/test-step2-5-escalation.ts [--live-auth]
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = process.cwd();
const MIGRATIONS_DIR = path.join(REPO, "supabase", "migrations");
const FIX_MIGRATION = "20261111000002_profile_trigger_hardening.sql";
const POSTGREST_VERSION = "v12.2.3";
const GM_EMAIL = "lucas@soltheory.com";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed++;
    console.log(`  \x1b[32m[PASS]\x1b[0m ${name}`);
  } else {
    failed++;
    console.log(`  \x1b[31m[FAIL]\x1b[0m ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// Shared abstractions (used by both local and live mode)
// ---------------------------------------------------------------------------
interface ApiResult {
  status: number;
  body: unknown;
}

interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_banned: boolean;
  banned_at: string | null;
  banned_reason: string | null;
  recent_picks: unknown;
}

interface SuiteEnv {
  call(
    token: string | null,
    method: string,
    pathAndQuery: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<ApiResult>;
  profile(email: string): Promise<ProfileRow | null>;
  users: Record<string, { id: string; email: string; token: string }>;
}

function rejected(res: ApiResult): boolean {
  if (res.status >= 400) return true;
  return Array.isArray(res.body) && res.body.length === 0;
}

const REP = { Prefer: "return=representation" };

/** Core escalation checks; identical logic is used against local and live APIs. */
async function runCoreChecks(env: SuiteEnv): Promise<void> {
  const alice = env.users.alice;
  const bob = env.users.bob; // pre-banned by the caller
  const patch = (u: { id: string; token: string }, body: unknown, id = u.id) =>
    env.call(u.token, "PATCH", `/user_profiles?id=eq.${id}`, body, REP);

  console.log(" Self-escalation attempts by a normal authenticated user");
  let res = await patch(alice, { role: "admin" });
  let row = await env.profile(alice.email);
  check("PATCH own role='admin' is rejected", rejected(res), `status ${res.status}`);
  check("role is still 'user' in the database", row?.role === "user", `role=${row?.role}`);

  res = await patch(alice, { role: "game_master" });
  row = await env.profile(alice.email);
  check("PATCH own role='game_master' is rejected", rejected(res) && row?.role === "user");

  res = await patch(alice, { email: GM_EMAIL });
  row = await env.profile(alice.email);
  check("PATCH own email (to a root GM address) is rejected", rejected(res) && row?.email === alice.email);

  res = await patch(alice, { is_banned: true, banned_reason: "x", banned_at: new Date().toISOString() });
  row = await env.profile(alice.email);
  check("PATCH ban columns on self is rejected", rejected(res) && row?.is_banned === false && row?.banned_reason === null);

  res = await patch(alice, { id: randomUUID() });
  row = await env.profile(alice.email);
  check("PATCH own primary key is rejected", rejected(res) && row?.id === alice.id);

  res = await env.call(
    alice.token,
    "POST",
    "/user_profiles?on_conflict=id",
    { id: alice.id, email: alice.email, display_name: "A", handle: "@a", role: "admin", is_banned: false },
    { Prefer: "resolution=merge-duplicates,return=representation" }
  );
  row = await env.profile(alice.email);
  check("Legacy full-row upsert that carries role='admin' is rejected", rejected(res) && row?.role === "user");

  console.log(" Banned user cannot lift own ban");
  const bobBefore = await env.profile(bob.email);
  res = await patch(bob, { is_banned: false, banned_at: null, banned_reason: null });
  row = await env.profile(bob.email);
  check("PATCH is_banned=false by banned user is rejected", rejected(res) && row?.is_banned === true, `status ${res.status}`);
  check("ban reason untouched", row?.banned_reason === bobBefore?.banned_reason);
  res = await patch(bob, { display_name: "Bob Unbanned" });
  row = await env.profile(bob.email);
  check("banned user cannot edit profile at all", rejected(res) && row?.display_name !== "Bob Unbanned");

  console.log(" Cross-user writes");
  res = await patch(alice, { display_name: "Hijacked" }, bob.id);
  row = await env.profile(bob.email);
  check("PATCH another user's display_name affects 0 rows", rejected(res) && row?.display_name !== "Hijacked");

  console.log(" Privileged RPC / table access by a normal user");
  res = await env.call(alice.token, "POST", "/rpc/admin_set_user_role", {
    target_email: alice.email,
    new_role: "admin",
  });
  row = await env.profile(alice.email);
  check("RPC admin_set_user_role(self,'admin') is rejected", rejected(res) && row?.role === "user", `status ${res.status}`);
  res = await env.call(alice.token, "POST", "/rpc/admin_set_user_banned", {
    target_email: bob.email,
    banned: false,
  });
  row = await env.profile(bob.email);
  check("RPC admin_set_user_banned(bob,false) is rejected", rejected(res) && row?.is_banned === true, `status ${res.status}`);
  res = await env.call(alice.token, "POST", "/daily_puzzles", {
    game_slug: "connect-5",
    puzzle_date: "2099-12-30",
    puzzle_number: 99001,
    title: "Escalation Probe",
    payload: {},
  });
  check("non-admin POST to daily_puzzles is rejected", res.status === 401 || res.status === 403, `status ${res.status}`);
  const dp = await env.call(alice.token, "GET", "/daily_puzzles?title=eq.Escalation%20Probe&select=id");
  check("probe puzzle row does not exist", Array.isArray(dp.body) && dp.body.length === 0);
  res = await env.call(
    alice.token,
    "PATCH",
    "/daily_puzzles?puzzle_number=eq.1",
    { title: "defaced" },
    REP
  );
  check("non-admin PATCH on daily_puzzles affects nothing", rejected(res));

  console.log(" Anonymous (no JWT) access");
  res = await env.call(null, "POST", "/rpc/admin_set_user_role", { target_email: alice.email, new_role: "admin" });
  check("anon RPC admin_set_user_role is rejected", res.status === 401 || res.status === 403, `status ${res.status}`);
  res = await env.call(null, "GET", "/user_profiles?select=email");
  check("anon cannot read user_profiles", res.status === 401 || res.status === 403, `status ${res.status}`);
  res = await env.call(null, "GET", "/daily_puzzles?select=id&limit=1");
  check("anon can still read daily_puzzles", res.status === 200);

  console.log(" Legitimate own-profile updates still work");
  const picks = [{ boardId: "b1", pick1Item: "x" }];
  res = await patch(alice, {
    display_name: "Alice Renamed",
    handle: "@alice_renamed",
    avatar_color: "#123456",
    connect5_stats: { gamesPlayed: 3 },
    twenty_one_stats: { gamesPlayed: 2 },
    recent_picks: picks,
    created_board_ids: ["board-1"],
    updated_at: new Date().toISOString(),
  });
  row = await env.profile(alice.email);
  check("own display name / handle / stats / picks update succeeds", !rejected(res) && row?.display_name === "Alice Renamed", `status ${res.status}`);
  check("own recent_picks persisted", JSON.stringify(row?.recent_picks) === JSON.stringify(picks));
  const own = await env.call(alice.token, "GET", "/user_profiles?select=email");
  check(
    "authenticated user reads only their own profile",
    Array.isArray(own.body) && own.body.length === 1 && (own.body[0] as { email: string }).email === alice.email
  );
}

// ---------------------------------------------------------------------------
// LOCAL harness plumbing
// ---------------------------------------------------------------------------
function findPgBin(): string | null {
  const candidates: string[] = [];
  if (process.env.PG_BIN) candidates.push(process.env.PG_BIN);
  const root = "/usr/lib/postgresql";
  if (fs.existsSync(root)) {
    for (const v of fs.readdirSync(root).sort((a, b) => Number(b) - Number(a))) {
      candidates.push(path.join(root, v, "bin"));
    }
  }
  return candidates.find((d) => fs.existsSync(path.join(d, "postgres")) && fs.existsSync(path.join(d, "initdb"))) ?? null;
}

function ensurePostgrest(): string | null {
  if (process.env.POSTGREST_BIN && fs.existsSync(process.env.POSTGREST_BIN)) return process.env.POSTGREST_BIN;
  const dir = path.join(os.tmpdir(), `postgrest-${POSTGREST_VERSION}`);
  const bin = path.join(dir, "postgrest");
  if (fs.existsSync(bin)) return bin;
  fs.mkdirSync(dir, { recursive: true });
  const url = `https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/postgrest-${POSTGREST_VERSION}-linux-static-x64.tar.xz`;
  const archive = path.join(dir, "postgrest.tar.xz");
  const dl = spawnSync("curl", ["-sSL", "-m", "120", "-o", archive, url], { encoding: "utf8" });
  if (dl.status !== 0) return null;
  const ex = spawnSync("tar", ["-xJf", archive, "-C", dir], { encoding: "utf8" });
  return ex.status === 0 && fs.existsSync(bin) ? bin : null;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signJwt(secret: string, payload: Record<string, unknown>): string {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...payload }));
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

const BASELINE_SQL = `
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'supabase_auth_admin'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
end;
$$;
grant anon, authenticated, service_role to authenticator;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
-- Same definitions Supabase ships (they read the JSON GUC request.jwt.claims):
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text $$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
                  nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase's default privileges for objects created by postgres in public:
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
`;

class LocalCluster {
  pgBin: string;
  dir: string;
  port: number;
  server: ChildProcess | null = null;
  constructor(pgBin: string, port: number) {
    this.pgBin = pgBin;
    this.port = port;
    this.dir = fs.mkdtempSync(path.join(os.tmpdir(), "sol-rls-"));
  }
  private bin(name: string): string {
    return path.join(this.pgBin, name);
  }
  async start(): Promise<void> {
    const data = path.join(this.dir, "data");
    const init = spawnSync(this.bin("initdb"), ["-D", data, "-U", "postgres", "-A", "trust", "--no-sync"], { encoding: "utf8" });
    if (init.status !== 0) throw new Error(`initdb failed: ${init.stderr}`);
    this.server = spawn(
      this.bin("postgres"),
      ["-D", data, "-p", String(this.port), "-c", "listen_addresses=127.0.0.1", "-c", `unix_socket_directories=${this.dir}`, "-c", "fsync=off"],
      { stdio: "ignore" }
    );
    for (let i = 0; i < 60; i++) {
      const r = spawnSync(this.bin("pg_isready"), ["-h", "127.0.0.1", "-p", String(this.port)]);
      if (r.status === 0) return;
      await new Promise((r2) => setTimeout(r2, 250));
    }
    throw new Error("postgres did not become ready");
  }
  psql(db: string, args: string[]): string {
    const r = spawnSync(
      "psql",
      ["-h", "127.0.0.1", "-p", String(this.port), "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-q", "-tA", ...args],
      { encoding: "utf8" }
    );
    if (r.status !== 0) throw new Error(`psql failed (${args.join(" ").slice(0, 80)}): ${r.stderr}`);
    return r.stdout.trim();
  }
  sql(db: string, query: string): string {
    return this.psql(db, ["-c", query]);
  }
  file(db: string, file: string): void {
    this.psql(db, ["-f", file]);
  }
  createDb(db: string): void {
    this.psql("postgres", ["-c", `create database ${db}`]);
  }
  provision(db: string, includeFix: boolean): void {
    this.createDb(db);
    const baseline = path.join(this.dir, `${db}-baseline.sql`);
    fs.writeFileSync(baseline, BASELINE_SQL);
    this.psql(db, ["-f", baseline]);
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql") && (includeFix || f < FIX_MIGRATION))
      .sort();
    for (const f of files) this.file(db, path.join(MIGRATIONS_DIR, f));
  }
  provisionFromSchemaSql(db: string): void {
    this.createDb(db);
    const baseline = path.join(this.dir, `${db}-baseline.sql`);
    fs.writeFileSync(baseline, BASELINE_SQL);
    this.psql(db, ["-f", baseline]);
    this.file(db, path.join(REPO, "supabase", "schema.sql"));
  }
  stop(): void {
    try {
      this.server?.kill("SIGINT");
    } catch {
      // ignore
    }
    spawnSync("sleep", ["1"]);
    fs.rmSync(this.dir, { recursive: true, force: true });
  }
}

interface RunningPostgrest {
  proc: ChildProcess;
  url: string;
  stop(): void;
}

async function startPostgrest(bin: string, cluster: LocalCluster, db: string, secret: string, port: number): Promise<RunningPostgrest> {
  const proc = spawn(bin, [], {
    env: {
      ...process.env,
      PGRST_DB_URI: `postgres://authenticator@127.0.0.1:${cluster.port}/${db}`,
      PGRST_DB_SCHEMAS: "public",
      PGRST_DB_ANON_ROLE: "anon",
      PGRST_JWT_SECRET: secret,
      PGRST_SERVER_HOST: "127.0.0.1",
      PGRST_SERVER_PORT: String(port),
      PGRST_DB_POOL: "2",
    },
    stdio: "ignore",
  });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`${url}/`);
      if (r.status === 200) {
        return { proc, url, stop: () => proc.kill("SIGTERM") };
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  proc.kill("SIGTERM");
  throw new Error("PostgREST did not become ready");
}

function restCaller(baseUrl: string, prefix: string, apikey?: string) {
  return async (
    token: string | null,
    method: string,
    pathAndQuery: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<ApiResult> => {
    const h: Record<string, string> = { "Content-Type": "application/json", ...headers };
    if (apikey) h.apikey = apikey;
    if (token) h.Authorization = `Bearer ${token}`;
    else if (apikey && apikey.startsWith("eyJ")) h.Authorization = `Bearer ${apikey}`;
    const res = await fetch(`${baseUrl}${prefix}${pathAndQuery}`, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: res.status, body: parsed };
  };
}

function seedUser(cluster: LocalCluster, db: string, email: string): string {
  const id = randomUUID();
  cluster.sql(db, `insert into auth.users (id, email) values ('${id}', '${email}')`);
  return id;
}

function profileReader(cluster: LocalCluster, db: string) {
  return async (email: string): Promise<ProfileRow | null> => {
    const out = cluster.sql(
      db,
      `select coalesce(row_to_json(t), 'null'::json) from (select id, email, display_name, role, is_banned, banned_at, banned_reason, recent_picks from public.user_profiles where email = '${email}') t`
    );
    return out ? (JSON.parse(out) as ProfileRow | null) : null;
  };
}

function makeLocalEnv(cluster: LocalCluster, db: string, base: string, secret: string, emails: string[]): SuiteEnv {
  const users: SuiteEnv["users"] = {};
  for (const e of emails) {
    const name = e.split("@")[0];
    const id = seedUser(cluster, db, e);
    users[name] = {
      id,
      email: e,
      token: signJwt(secret, { aud: "authenticated", role: "authenticated", sub: id, email: e }),
    };
  }
  return {
    call: restCaller(base, "", undefined),
    profile: profileReader(cluster, db),
    users,
  };
}

async function main(): Promise<void> {
  const live = process.argv.includes("--live-auth");
  const localOnly = !live || process.argv.includes("--with-local");

  if (localOnly) {
    await runLocal();
  }
  if (live) {
    await runLive();
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

async function runLocal(): Promise<void> {
  const pgBin = findPgBin();
  if (!pgBin) {
    check("PostgreSQL server binaries available for the local harness", false, "set PG_BIN or install postgresql");
    return;
  }
  const pgrstBin = ensurePostgrest();
  if (!pgrstBin) {
    check("PostgREST binary available for the local harness", false, "set POSTGREST_BIN or allow download from github.com");
    return;
  }
  const pgPort = 54000 + Math.floor(Math.random() * 500);
  const rest1 = pgPort + 600;
  const rest2 = pgPort + 601;
  const secret = randomBytes(32).toString("hex");
  const cluster = new LocalCluster(pgBin, pgPort);
  const running: RunningPostgrest[] = [];
  try {
    await cluster.start();

    // ---------------- PHASE A: reproduce H1 against migrations <= 20261111000001
    console.log("\nPHASE A — pre-fix schema (migrations up to 20261111000001): reproduce H1");
    cluster.provision("prefix", false);
    const a = await startPostgrest(pgrstBin, cluster, "prefix", secret, rest1);
    running.push(a);
    const envA = makeLocalEnv(cluster, "prefix", a.url, secret, ["alice@example.test", "bob@example.test"]);
    cluster.sql("prefix", `update public.user_profiles set is_banned = true, banned_reason = 'spam' where email = 'bob@example.test'`);
    let r = await envA.call(envA.users.alice.token, "PATCH", `/user_profiles?id=eq.${envA.users.alice.id}`, { role: "admin" }, REP);
    let p = await envA.profile("alice@example.test");
    check("H1 reproduced: pre-fix trigger lets a user self-promote to admin", p?.role === "admin", `status ${r.status} role=${p?.role}`);
    r = await envA.call(envA.users.bob.token, "PATCH", `/user_profiles?id=eq.${envA.users.bob.id}`, { is_banned: false }, REP);
    p = await envA.profile("bob@example.test");
    check("H1 reproduced: pre-fix trigger lets a banned user un-ban themselves", p?.is_banned === false);
    a.stop();

    // ---------------- PHASE B: full migrations
    console.log("\nPHASE B — post-fix schema (all migrations incl. 20261111000002)");
    cluster.provision("postfix", true);
    // Idempotency: the fix migration (and the previous one) must re-apply cleanly.
    cluster.file("postfix", path.join(MIGRATIONS_DIR, FIX_MIGRATION));
    check("migration 20261111000002 re-applies idempotently", true);

    const b = await startPostgrest(pgrstBin, cluster, "postfix", secret, rest2);
    running.push(b);
    const env = makeLocalEnv(cluster, "postfix", b.url, secret, [
      "alice@example.test",
      "bob@example.test",
      "carol@example.test",
      "dave@example.test",
      "erin@example.test",
      GM_EMAIL,
    ]);
    // Trusted internal (SQL editor / migration) paths keep working:
    cluster.sql("postfix", `update public.user_profiles set role = 'admin' where email = 'carol@example.test'`);
    cluster.sql("postfix", `update public.user_profiles set is_banned = true, banned_reason = 'spam' where email = 'bob@example.test'`);
    check(
      "trusted internal session (psql/migration) can still set role=admin and ban",
      (await env.profile("carol@example.test"))?.role === "admin" && (await env.profile("bob@example.test"))?.is_banned === true
    );
    check("root GM profile created by signup trigger has role game_master", (await env.profile(GM_EMAIL))?.role === "game_master");
    check("ordinary signup profile has role user", (await env.profile("alice@example.test"))?.role === "user");

    await runCoreChecks(env);

    const u = env.users;
    const gm = u.lucas;
    const patchU = (x: { id: string; token: string }, body: unknown, id = x.id) =>
      env.call(x.token, "PATCH", `/user_profiles?id=eq.${id}`, body, REP);

    console.log(" Insert path (client falls back to INSERT only when no profile row exists)");
    cluster.sql("postfix", `delete from public.user_profiles where email = 'dave@example.test'`);
    let res = await patchU(u.dave, { display_name: "Dave" });
    check("update on missing profile affects 0 rows", rejected(res));
    res = await env.call(
      u.dave.token,
      "POST",
      "/user_profiles",
      { id: u.dave.id, email: u.dave.email, display_name: "Dave", handle: "@dave", role: "admin" },
      REP
    );
    check("INSERT own profile carrying role='admin' is rejected", rejected(res) && (await env.profile(u.dave.email)) === null, `status ${res.status}`);
    res = await env.call(
      u.dave.token,
      "POST",
      "/user_profiles",
      { id: u.dave.id, email: u.dave.email, display_name: "Dave", handle: "@dave" },
      REP
    );
    check("INSERT own minimal profile succeeds and is forced to role 'user'", !rejected(res) && (await env.profile(u.dave.email))?.role === "user", `status ${res.status}`);
    res = await env.call(
      u.dave.token,
      "POST",
      "/user_profiles",
      { id: randomUUID(), email: "ghost@example.test", display_name: "G", handle: "@g" },
      REP
    );
    check("INSERT a profile for another id is rejected", rejected(res));

    console.log(" Real admin (role set by a trusted path) vs daily_puzzles");
    const future = "2099-12-30";
    res = await env.call(u.carol.token, "POST", "/daily_puzzles", { game_slug: "connect-5", puzzle_date: future, puzzle_number: 99002, title: "Carol Future", payload: {} }, REP);
    check("real admin may insert a FUTURE puzzle", !rejected(res), `status ${res.status}`);
    const today = new Date().toISOString().slice(0, 10);
    res = await env.call(u.carol.token, "POST", "/daily_puzzles", { game_slug: "connect-5", puzzle_date: today, puzzle_number: 99003, title: "Carol Today", payload: {} }, REP);
    check("real admin may NOT insert today's puzzle", rejected(res), `status ${res.status}`);
    res = await patchU(u.carol, { role: "game_master" });
    check("admin cannot self-promote to game_master", rejected(res) && (await env.profile(u.carol.email))?.role === "admin");

    console.log(" Root Game Master RPCs");
    const rpc = (name: string, body: unknown) => env.call(gm.token, "POST", `/rpc/${name}`, body);
    res = await rpc("admin_set_user_role", { target_email: u.erin.email, new_role: "admin" });
    check("GM admin_set_user_role(erin,'admin') affects exactly 1 row", res.body === 1 && (await env.profile(u.erin.email))?.role === "admin", JSON.stringify(res.body));
    res = await rpc("admin_set_user_role", { target_email: "nobody@example.test", new_role: "admin" });
    check("GM admin_set_user_role on unknown email reports 0 rows", res.status === 200 && res.body === 0, JSON.stringify(res.body));
    res = await rpc("admin_set_user_role", { target_email: u.erin.email, new_role: "game_master" });
    check("GM cannot mint another game_master", rejected(res) && (await env.profile(u.erin.email))?.role === "admin");
    res = await rpc("admin_set_user_role", { target_email: GM_EMAIL, new_role: "user" });
    check("GM cannot demote a root GM", rejected(res) && (await env.profile(GM_EMAIL))?.role === "game_master");
    res = await rpc("admin_set_user_banned", { target_email: u.erin.email, banned: true, reason: "abuse" });
    let ep = await env.profile(u.erin.email);
    check("GM admin_set_user_banned(erin,true) bans exactly 1 row", res.body === 1 && ep?.is_banned === true && ep?.banned_reason === "abuse", JSON.stringify(res.body));
    res = await patchU(u.erin, { display_name: "Erin Evades" });
    check("freshly banned user can no longer edit their profile", rejected(res) && (await env.profile(u.erin.email))?.display_name !== "Erin Evades");
    res = await rpc("admin_set_user_banned", { target_email: u.erin.email, banned: false });
    ep = await env.profile(u.erin.email);
    check("GM can lift a ban", res.body === 1 && ep?.is_banned === false && ep?.banned_reason === null);
    res = await rpc("admin_set_user_banned", { target_email: GM_EMAIL, banned: true });
    check("root GM ban immunity", rejected(res) && (await env.profile(GM_EMAIL))?.is_banned === false);
    res = await patchU(gm, { role: "user" });
    check("GM cannot demote self via direct PATCH", rejected(res) && (await env.profile(GM_EMAIL))?.role === "game_master");
    res = await patchU(gm, { role: "user" }, u.erin.id);
    check("even a GM cannot write role directly (must use RPC)", rejected(res) && (await env.profile(u.erin.email))?.role === "admin" /* set earlier via RPC */);
    res = await patchU(gm, { display_name: "Lucas GM" });
    check("GM can edit own display name", !rejected(res) && (await env.profile(GM_EMAIL))?.display_name === "Lucas GM");
    const all = await env.call(gm.token, "GET", "/user_profiles?select=email");
    check("GM can read all profiles", Array.isArray(all.body) && all.body.length >= 6, JSON.stringify(all.body)?.slice(0, 80));
    res = await env.call(gm.token, "POST", "/daily_puzzles", { game_slug: "connect-5", puzzle_date: today, puzzle_number: 99004, title: "GM Today", payload: {} }, REP);
    check("root GM may insert today's puzzle", !rejected(res), `status ${res.status}`);

    console.log(" service_role (server key) keeps working but cannot mint game_masters");
    const svc = signJwt(secret, { role: "service_role" });
    res = await env.call(svc, "PATCH", `/user_profiles?id=eq.${u.alice.id}`, { role: "admin" }, REP);
    check("service_role may set role=admin", !rejected(res) && (await env.profile(u.alice.email))?.role === "admin", `status ${res.status}`);
    res = await env.call(svc, "PATCH", `/user_profiles?id=eq.${u.alice.id}`, { role: "game_master" }, REP);
    check("service_role cannot create a non-roster game_master (demoted by trigger)", (await env.profile(u.alice.email))?.role === "user");

    console.log(" Trigger-in-isolation defence-in-depth (even if column grants were wide open)");
    cluster.sql("postfix", `grant insert, update on table public.user_profiles to authenticated; notify pgrst, 'reload schema';`);
    await new Promise((r2) => setTimeout(r2, 200));
    res = await patchU(u.alice, { role: "admin" });
    check(
      "trigger alone rejects PATCH role='admin' with 42501 when column grants are wide open",
      res.status >= 400 && (await env.profile(u.alice.email))?.role === "user",
      `status ${res.status}`
    );
    res = await patchU(u.bob, { is_banned: false });
    check(
      "trigger alone rejects PATCH is_banned=false by banned user with 42501",
      res.status >= 400 && (await env.profile(u.bob.email))?.is_banned === true,
      `status ${res.status}`
    );
    cluster.sql("postfix", `delete from public.user_profiles where email = 'dave@example.test'`);
    res = await env.call(
      u.dave.token,
      "POST",
      "/user_profiles",
      { id: u.dave.id, email: u.dave.email, display_name: "Dave", handle: "@dave", role: "admin" },
      REP
    );
    check(
      "trigger alone rejects INSERT with role='admin' with 42501",
      res.status >= 400 && (await env.profile(u.dave.email)) === null,
      `status ${res.status}`
    );
    cluster.file("postfix", path.join(MIGRATIONS_DIR, FIX_MIGRATION));
    cluster.sql("postfix", `notify pgrst, 'reload schema';`);

    // ---------------- PHASE C: supabase/schema.sql (standalone bootstrap) must behave identically
    console.log("\nPHASE C — supabase/schema.sql applied standalone gives the same protections");
    cluster.provisionFromSchemaSql("schemaonly");
    const c = await startPostgrest(pgrstBin, cluster, "schemaonly", secret, rest2 + 1);
    running.push(c);
    const envC = makeLocalEnv(cluster, "schemaonly", c.url, secret, ["alice@example.test", "bob@example.test"]);
    cluster.sql("schemaonly", `update public.user_profiles set is_banned = true, banned_reason = 'spam' where email = 'bob@example.test'`);
    await runCoreChecks(envC);
  } finally {
    for (const p of running) p.stop();
    cluster.stop();
  }
}

// ---------------------------------------------------------------------------
// LIVE mode (production Supabase)
// ---------------------------------------------------------------------------
async function runLive(): Promise<void> {
  console.log("\nLIVE — authenticated escalation & forged-JWT probes against production Supabase");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://trwyrfhicbnfhlbiztau.supabase.co";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "sb_publishable_a9xQwMZoEA3-5nTpIFm8cw_XFmZehG0";

  // 1. Forged HS256 JWT probes (always runnable without service-role credentials)
  const forgedToken = signJwt("wrong-attacker-signing-secret-0000", {
    aud: "authenticated",
    role: "authenticated",
    sub: "11111111-1111-4111-8111-111111111111",
    email: GM_EMAIL,
  });
  const goTrueForged = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${forgedToken}` },
  });
  check(
    "Live GoTrue /auth/v1/user rejects forged authenticated GM JWT",
    goTrueForged.status === 401 || goTrueForged.status === 403,
    `status ${goTrueForged.status}`
  );
  const pgrstForged = await restCaller(url, "/rest/v1", anonKey)(
    forgedToken,
    "PATCH",
    "/user_profiles?id=eq.11111111-1111-4111-8111-111111111111",
    { role: "admin" },
    REP
  );
  check(
    "Live PostgREST rejects forged authenticated JWT on user_profiles PATCH",
    pgrstForged.status === 401 || pgrstForged.status === 403,
    `status ${pgrstForged.status}`
  );

  // 2. Live RPC & hygiene probes (confirming migration 20261111000002 is live)
  const anon = restCaller(url, "/rest/v1", anonKey);
  const liveRpcRole = await anon(null, "POST", "/rpc/admin_set_user_role", {
    target_email: "nobody@example.test",
    new_role: "admin",
  });
  check(
    "Live RPC admin_set_user_role exists and rejects anon with 401/403 (not 404)",
    liveRpcRole.status === 401 || liveRpcRole.status === 403,
    `status ${liveRpcRole.status}`
  );
  const liveRpcBan = await anon(null, "POST", "/rpc/admin_set_user_banned", {
    target_email: "nobody@example.test",
    banned: true,
  });
  check(
    "Live RPC admin_set_user_banned exists and rejects anon with 401/403 (not 404)",
    liveRpcBan.status === 401 || liveRpcBan.status === 403,
    `status ${liveRpcBan.status}`
  );
  const staleBoards = await anon(
    null,
    "GET",
    "/twenty_one_boards?id=in.(custom-test-1,custom-test-2,21t-e2eanon0)&select=id"
  );
  check(
    "Live twenty_one_boards has zero stale pre-lockdown test boards",
    Array.isArray(staleBoards.body) && staleBoards.body.length === 0,
    JSON.stringify(staleBoards.body)
  );
  const staleResponses = await anon(
    null,
    "GET",
    "/twenty_one_responses?board_id=eq.custom-board-999&select=id"
  );
  check(
    "Live twenty_one_responses has zero stale custom-board-999 test fixtures",
    Array.isArray(staleResponses.body) && staleResponses.body.length === 0,
    JSON.stringify(staleResponses.body)
  );

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.log("  [INFO] SUPABASE_SERVICE_ROLE_KEY not set: skipping GoTrue admin disposable-user creation so zero prod auth.users residue is left.");
    return;
  }
  const svcHeaders: Record<string, string> = { apikey: serviceKey, "Content-Type": "application/json" };
  if (serviceKey.startsWith("eyJ")) svcHeaders.Authorization = `Bearer ${serviceKey}`;
  const created: string[] = [];
  const stamp = Date.now();
  const password = randomBytes(18).toString("hex");
  const make = async (label: string) => {
    const email = `escalation-probe-${label}-${stamp}@example.test`;
    const cr = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: svcHeaders,
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const j = (await cr.json()) as { id?: string };
    if (!j.id) throw new Error(`could not create disposable user (${cr.status})`);
    created.push(j.id);
    const tk = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const t = (await tk.json()) as { access_token?: string };
    if (!t.access_token) throw new Error(`could not sign in disposable user (${tk.status})`);
    return { id: j.id, email, token: t.access_token };
  };
  try {
    const alice = await make("a");
    const bob = await make("b");
    const svc = restCaller(url, "/rest/v1", serviceKey);
    const anon = restCaller(url, "/rest/v1", anonKey);
    await svc(null, "PATCH", `/user_profiles?id=eq.${bob.id}`, { is_banned: true, banned_reason: "probe" });
    const env: SuiteEnv = {
      call: (token, ...rest) => (token ? restCaller(url, "/rest/v1", anonKey)(token, ...rest) : anon(null, ...rest)),
      profile: async (email) => {
        const r = await svc(null, "GET", `/user_profiles?email=eq.${encodeURIComponent(email)}&select=*`);
        return Array.isArray(r.body) && r.body.length ? (r.body[0] as ProfileRow) : null;
      },
      users: { alice, bob },
    };
    await runCoreChecks(env);
  } finally {
    for (const id of created) {
      await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svcHeaders });
    }
    const left = await restCaller(url, "/rest/v1", serviceKey)(null, "GET", `/user_profiles?email=like.escalation-probe-*-${stamp}@example.test&select=id`);
    check("disposable users and profiles were deleted (zero residue)", Array.isArray(left.body) && left.body.length === 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
