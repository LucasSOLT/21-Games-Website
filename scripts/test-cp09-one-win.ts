/**
 * Checkpoint 9 — Game #1 (`1 Win`): canonical normalization, 1–4 word & ≤35-char rules,
 * Tier 1 + Tier 2 public moderation, 1-per-day submission lock, archive view-only guard,
 * Top 100 leaderboard aggregation, personal history log, and Supabase RLS migration checks.
 * Run: node --experimental-strip-types scripts/test-cp09-one-win.ts
 */
import fs from "node:fs";
import { register } from "node:module";
import { createKit } from "./test-kit.mjs";

register("./test-resolver.mjs", import.meta.url);
const kit = createKit("CP9: 1 Win");

const mem = new Map<string, string>();
const mockStorage = {
  get length() {
    return mem.size;
  },
  clear: () => mem.clear(),
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  key: (i: number) => Array.from(mem.keys())[i] ?? null,
  removeItem: (k: string) => {
    mem.delete(k);
  },
  setItem: (k: string, v: string) => {
    mem.set(k, String(v));
  },
} as Storage;

Object.defineProperty(globalThis, "localStorage", {
  value: mockStorage,
  configurable: true,
});
Object.defineProperty(globalThis, "window", {
  value: {
    localStorage: mockStorage,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  configurable: true,
});

const ow = await import("@/data/puzzles/1-win");
const svc = await import("@/lib/one-win-service");
const daily = await import("@/lib/daily-engine");
const cfg = await import("@/lib/games-config");
const storage = await import("@/lib/game-storage");

// ---- Canonical normalization (Q46) -------------------------------------------
const a = ow.normalizeOneWinEntry("Deep sleep");
const b = ow.normalizeOneWinEntry("deep sleep!");
const c = ow.normalizeOneWinEntry("  Deep Sleep ");
kit.assert(
  a.valid && b.valid && c.valid,
  "all three Deep Sleep variants validate"
);
kit.assert(
  a.normalizedKey === "deep sleep" &&
    b.normalizedKey === "deep sleep" &&
    c.normalizedKey === "deep sleep",
  '"Deep sleep", "deep sleep!", and "  Deep Sleep " map to "deep sleep"'
);
kit.eq(b.displayText, "Deep Sleep", "canonical display text is Title Case");

// Leading articles + trailing plural normalization
const w1 = ow.normalizeOneWinEntry("A morning walk");
const w2 = ow.normalizeOneWinEntry("Morning walks!");
const w3 = ow.normalizeOneWinEntry("My morning walk ☕");
kit.assert(
  w1.normalizedKey === "morning walk" &&
    w2.normalizedKey === "morning walk" &&
    w3.normalizedKey === "morning walk" &&
    w2.displayText === "Morning Walk",
  "articles, emojis, and simple plurals normalize into Morning Walk"
);

// Invariant -s words preserved cleanly
const focusEntry = ow.normalizeOneWinEntry("Deep focus");
kit.eq(focusEntry.normalizedKey, "deep focus", "focus is not mangled by singularizer");
const chessEntry = ow.normalizeOneWinEntry("Played chess");
kit.eq(chessEntry.normalizedKey, "played chess", "chess is not mangled by singularizer");

// Word & character limits (Q46)
const fiveWords = ow.normalizeOneWinEntry("One two three four five");
kit.assert(!fiveWords.valid && fiveWords.wordCount === 5, "5-word entry rejected");

const over35Chars = ow.normalizeOneWinEntry("Extraordinarily supercalifragilistic");
kit.assert(!over35Chars.valid && over35Chars.charCount > 35, ">35-char entry rejected");

const emptyEmoji = ow.normalizeOneWinEntry("🎉✨🔥");
kit.assert(!emptyEmoji.valid, "emoji-only entry without words rejected");

// ---- 66-day prompt bank & monthly batch --------------------------------------
kit.eq(ow.ONE_WIN_PUZZLES.length, 66, "1 Win bank has 66 daily prompts");
kit.assert(
  ow.ONE_WIN_PUZZLES.every((p) => ow.validateOneWinPuzzle(p).valid),
  "all 66 prompts pass validateOneWinPuzzle"
);
const batch = ow.generateOneWinMonthlyBatch(2027, 4);
kit.eq(Object.keys(batch).length, 30, "April 2027 batch has 30 days");

// ---- Submission, Moderation, Archive Lock & 1-per-day Lock (Q46–Q48) ---------
const samplePuzzle = ow.ONE_WIN_PUZZLES[0]!;
const todayKey = "2026-11-12";
const pastKey = "2026-11-10";

// 1. Archive view-only lock: cannot submit for past date
const pastAttempt = await svc.submitOneWinEntry({
  dateKey: pastKey,
  rawText: "Morning walk",
  puzzle: samplePuzzle,
  todayDateKey: todayKey,
});
kit.assert(!pastAttempt.ok, "retroactive submission on archive date rejected");

// 2. Tier 2 public profanity & Tier 1 slurs strictly blocked on 1 Win
const profanityAttempt = await svc.submitOneWinEntry({
  dateKey: todayKey,
  rawText: "Fuck yeah today",
  puzzle: samplePuzzle,
  todayDateKey: todayKey,
});
kit.assert(!profanityAttempt.ok, "Tier 2 public profanity blocked on 1 Win");

const slurAttempt = await svc.submitOneWinEntry({
  dateKey: todayKey,
  rawText: "1488 win",
  puzzle: samplePuzzle,
  todayDateKey: todayKey,
});
kit.assert(!slurAttempt.ok, "Tier 1 hate symbol/slur blocked on 1 Win");

// 3. Valid today submission succeeds, records stats + personal history, and locks day
const goodSubmit = await svc.submitOneWinEntry({
  dateKey: todayKey,
  rawText: "deep sleep!",
  puzzle: samplePuzzle,
  todayDateKey: todayKey,
});
kit.assert(
  goodSubmit.ok &&
    goodSubmit.submission?.displayText === "Deep Sleep" &&
    Boolean(goodSubmit.snapshot && goodSubmit.snapshot.entries.length > 0),
  "valid 1 Win submission succeeds and returns Top 100 leaderboard"
);
kit.assert(
  (goodSubmit.snapshot?.playerRank ?? 0) >= 1 &&
    (goodSubmit.snapshot?.playerCount ?? 0) >= 1,
  "player rank and shared count computed in leaderboard snapshot"
);

// Second submission on same date is locked
const duplicateAttempt = await svc.submitOneWinEntry({
  dateKey: todayKey,
  rawText: "Morning coffee",
  puzzle: samplePuzzle,
  todayDateKey: todayKey,
});
kit.assert(!duplicateAttempt.ok, "second submission on same day is locked");

// Stats & personal history updated
const winStats = storage.getGameStats("1-win");
kit.eq(winStats.played, 1, "1 Win daily completion recorded in GameStats");
const history = svc.getOneWinPersonalHistory();
kit.assert(
  history.length === 1 &&
    history[0]?.dateKey === todayKey &&
    history[0]?.displayText === "Deep Sleep",
  "personal daily win history logs Date -> DisplayText -> Global Rank"
);

// ---- All 9 countdown games now playable! -------------------------------------
kit.eq(cfg.PLAYABLE_GAMES.length, 9, "all 9 countdown games are now playable!");
kit.assert(cfg.isPlayableGameSlug("1-win"), "1-win is playable");
kit.eq(cfg.getGameBySlug("1-win")?.showCreate, false, "1-win has showCreate: false");

const resolved = daily.getDailyPuzzleForGame("1-win", "2026-11-18");
kit.assert(
  Boolean(resolved && ow.isOneWinPuzzle(resolved.puzzle)),
  "daily engine resolves valid 1 Win prompt"
);

// ---- Supabase migration & UI wiring checks -----------------------------------
const migSrc = fs.readFileSync(
  new URL(
    "../supabase/migrations/20261112000002_one_win_submissions.sql",
    import.meta.url
  ),
  "utf8"
);
kit.assert(
  migSrc.includes("alter table public.one_win_submissions enable row level security"),
  "migration enables RLS on one_win_submissions"
);
kit.assert(
  migSrc.includes("revoke all on table public.one_win_submissions from anon, authenticated"),
  "migration revokes default privileges before least-privilege grants"
);
kit.assert(
  migSrc.includes("get_one_win_top_100") && migSrc.includes("supabase_realtime"),
  "migration defines Top 100 RPC and adds table to supabase_realtime"
);

const uiSrc = fs.readFileSync(
  new URL("../src/components/games/one-win.tsx", import.meta.url),
  "utf8"
);
kit.assert(uiSrc.includes("GameSplashScreen"), "1 Win mounts GameSplashScreen");
kit.assert(uiSrc.includes("showCreate={false}"), "1 Win hides Create button");
kit.assert(uiSrc.includes('autoComplete="off"'), "1 Win disables autocomplete spoilers");
kit.assert(uiSrc.includes("Archive View-Only"), "1 Win renders Archive View-Only mode");
kit.assert(uiSrc.includes("ResultShareButtons"), "1 Win mounts decoupled Share + Copy buttons");

const pageSrc = fs.readFileSync(
  new URL("../src/app/games/1-win/page.tsx", import.meta.url),
  "utf8"
);
kit.assert(pageSrc.includes("GameErrorBoundary"), "1 Win page wrapped in GameErrorBoundary");

const adminSrc = fs.readFileSync(
  new URL("../src/app/admin/page.tsx", import.meta.url),
  "utf8"
);
kit.assert(adminSrc.includes("OneWinStudioTab"), "/admin mounts OneWinStudioTab");

kit.finish();
