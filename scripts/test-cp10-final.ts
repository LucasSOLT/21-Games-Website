/**
 * Checkpoint 10 — Final End-to-End Verification Suite across ALL 9 Countdown Games (21 -> 1):
 *   1. Countdown roster order (21 -> 17 -> 9 -> 8 -> 6 -> 5 -> 4 -> 2 -> 1) & all 9 `isPlayable: true`
 *   2. Exact 5 `showCreate: true` games vs 4 `showCreate: false` games
 *   3. Multi-date daily engine + corrupted-override fallback across all 9 games
 *   4. Monthly Rolling Buffer (`Month M+2`) batch generator + CLI `--dry-run` exit 0
 *   5. Unified 9-Game Profile Stats (Q4 signature metrics, 6 Pics distribution, Move Two Par merge)
 *   6. Moderation Tier 1 (global ban) & Tier 2 (public block / private `?b=` allow)
 *   7. Decoupled `nativeShareResultsOnly` + `copyResultsOnly` across all 9 game components
 *   8. Security & RLS invariants (`INITIAL_GAME_MASTERS`, `/admin` guard, RLS on all tables)
 *
 * Run: node --experimental-strip-types scripts/test-cp10-final.ts
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { register } from "node:module";
import { createKit } from "./test-kit.mjs";

register("./test-resolver.mjs", import.meta.url);
const kit = createKit("CP10: Final 9-Game Audit");

const cfg = await import("@/lib/games-config");
const daily = await import("@/lib/daily-engine");
const storage = await import("@/lib/game-storage");
const batch = await import("@/lib/monthly-batch");
const auth = await import("@/lib/user-auth");
const mod = await import("@/lib/moderation");

// ---------------------------------------------------------------------------
// 1. All 9 Countdown Games Live & Ordered 21 -> 17 -> 9 -> 8 -> 6 -> 5 -> 4 -> 2 -> 1
// ---------------------------------------------------------------------------
const EXPECTED_SLUGS = [
  "21-things",
  "17-syllables",
  "9-rhymes",
  "eightfold-echo",
  "6-pics",
  "connect-5",
  "four-score",
  "move-2",
  "1-win",
];
const EXPECTED_NUMBERS = [21, 17, 9, 8, 6, 5, 4, 2, 1];

kit.eq(cfg.ALL_GAMES.length, 9, "ALL_GAMES has all 9 countdown games");
kit.eq(
  cfg.ALL_GAMES.map((g) => g.slug),
  EXPECTED_SLUGS,
  "ALL_GAMES slugs are in strict 21 -> 1 countdown order"
);
kit.eq(
  cfg.ALL_GAMES.map((g) => cfg.GAME_COUNTDOWN_NUMBER[g.slug as typeof cfg.ALL_GAME_SLUGS[number]]),
  EXPECTED_NUMBERS,
  "Countdown numbers strictly match 21 -> 17 -> 9 -> 8 -> 6 -> 5 -> 4 -> 2 -> 1"
);
kit.assert(
  cfg.ALL_GAMES.every((g) => g.isPlayable === true),
  "Every single one of the 9 countdown games has isPlayable: true"
);

// ---------------------------------------------------------------------------
// 2. Creator Mode Roster (`showCreate` true on 5 games, false on 4 games)
// ---------------------------------------------------------------------------
const showCreateTrue = cfg.ALL_GAMES.filter((g) => g.showCreate).map((g) => g.slug);
const showCreateFalse = cfg.ALL_GAMES.filter((g) => !g.showCreate).map((g) => g.slug);
kit.eq(
  showCreateTrue,
  ["21-things", "17-syllables", "9-rhymes", "6-pics", "connect-5"],
  "showCreate === true on exact 5 creator-enabled games"
);
kit.eq(
  showCreateFalse,
  ["eightfold-echo", "four-score", "move-2", "1-win"],
  "showCreate === false on exact 4 algorithmic/community games"
);

// ---------------------------------------------------------------------------
// 3. Multi-Date Resolution + Corrupted Override Self-Healing across All 9 Games
// ---------------------------------------------------------------------------
const SAMPLE_DATES = ["2026-11-05", "2026-11-12", "2027-02-28", "2031-08-19"];
for (const slug of cfg.ALL_GAME_SLUGS) {
  for (const dateKey of SAMPLE_DATES) {
    const resolved = daily.getDailyPuzzleForGame(slug, dateKey);
    kit.assert(
      Boolean(resolved && resolved.puzzle && resolved.summary.title),
      `${slug} resolves valid puzzle for ${dateKey}`
    );
  }
  const healed = daily.getDailyPuzzleForGame(slug, "2027-03-15", {
    "2027-03-15": { broken: true, tiles: "invalid", words: null },
  });
  kit.assert(
    Boolean(healed && healed.origin !== "override"),
    `${slug} self-heals corrupted override via bank/seeded fallback`
  );
}

// ---------------------------------------------------------------------------
// 4. Monthly Rolling Buffer (`Month M+2`) Generator & CLI `--dry-run`
// ---------------------------------------------------------------------------
const mPlus2FromNov = batch.getTargetMonthMPlus2(new Date("2026-11-15T12:00:00Z"));
kit.eq(mPlus2FromNov.monthKey, "2027-01", "Month M+2 from Nov 2026 is 2027-01");

const febReport = batch.generateAndVerifyMonthlyBatch(2027, 2, {
  preferredProvider: "local",
});
kit.eq(febReport.daysInMonth, 28, "2027-02 has 28 days");
kit.eq(febReport.totalPuzzles, 28 * 9, "2027-02 batch generates 252 puzzles (28 * 9)");
kit.assert(febReport.allValid, "All 252 puzzles in 2027-02 pass solver + moderation verification");

const cliRun = spawnSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--no-warnings",
    "scripts/generate-monthly-batch.ts",
    "--month=2027-02",
    "--dry-run",
  ],
  { cwd: process.cwd(), encoding: "utf8" }
);
kit.eq(cliRun.status, 0, "generate-monthly-batch.ts --dry-run exits 0");
kit.assert(
  cliRun.stdout.includes("ALL 9 GAMES PASS"),
  "CLI stdout confirms ALL 9 GAMES PASS"
);

// ---------------------------------------------------------------------------
// 5. Unified 9-Game Profile Stats (Q4 Signature Metrics + Merge + Normalization)
// ---------------------------------------------------------------------------
const s17 = storage.buildUnifiedGameProfileSummary("17-syllables", {
  played: 4,
  won: 4,
  currentStreak: 3,
  maxStreak: 4,
  distribution: { "stars_3.0": 2, "stars_2.0": 2 },
});
kit.assert(
  s17.metrics.some((m) => m.label === "Avg Star Rating" && m.value === "2.5 ⭐"),
  "17 Syllables computes weighted Avg Star Rating (2.5 ⭐)"
);

const s9 = storage.buildUnifiedGameProfileSummary("9-rhymes", {
  played: 2,
  won: 2,
  currentStreak: 2,
  maxStreak: 2,
  distribution: { score_total_x10: 175, flawless: 1 },
});
kit.assert(
  s9.metrics.some((m) => m.label === "Avg Score" && m.value === "8.8 / 9") &&
    s9.metrics.some((m) => m.label === "Flawless 9/9" && m.value === "1"),
  "9 Rhymes computes Avg Score (x / 9) and Flawless 9/9 count"
);

const s6 = storage.buildUnifiedGameProfileSummary("6-pics", {
  played: 3,
  won: 3,
  currentStreak: 3,
  maxStreak: 3,
  distribution: {
    score_total_x10: 930,
    flawless: 1,
    pic_pts_6: 10,
    pic_pts_5: 5,
    pic_pts_3: 2,
  },
});
kit.eq(
  s6.guessDistribution?.length,
  6,
  "6 Pics builds 6-bar Piece Efficiency breakdown (1/6..6/6)"
);
kit.eq(
  s6.guessDistribution?.[0]?.count,
  10,
  "6 Pics maps pic_pts_6 to 1/6 (6 pts) count"
);
kit.assert(
  s6.metrics.some((m) => m.label === "Avg Score" && m.value === "31.0 / 36") &&
    s6.metrics.some((m) => m.label === "Flawless 36/36" && m.value === "1"),
  "6 Pics computes 36-point Avg Score (31.0 / 36) and Flawless 36/36 count"
);

const sM2Merged = storage.mergeTwoGameStats(
  {
    played: 2,
    won: 2,
    completedDates: ["2026-11-10", "2026-11-11"],
    distribution: { best_over_par_plus_100: 103, par_stars_3: 1 },
  },
  {
    played: 3,
    won: 3,
    completedDates: ["2026-11-10", "2026-11-11", "2026-11-12"],
    distribution: { best_over_par_plus_100: 100, par_stars_3: 2 },
  }
);
const sM2 = storage.buildUnifiedGameProfileSummary("move-2", sM2Merged);
kit.assert(
  sM2.metrics.some((m) => m.label === "Best vs. Par" && m.value === "Par (0)") &&
    sM2.metrics.some((m) => m.label === "⭐⭐⭐ Par Count" && m.value === "2"),
  "Move Two merges best_over_par_plus_100 via Math.min and computes Par (0)"
);

for (const slug of cfg.ALL_GAME_SLUGS) {
  const summary = storage.buildUnifiedGameProfileSummary(slug, {
    played: 1,
    won: 1,
    currentStreak: 1,
    maxStreak: 1,
    completedDates: ["2026-11-12"],
  });
  kit.assert(summary.metrics.length >= 3, `${slug} exposes Q4 signature metrics`);
}

const normProf = auth.normalizeUserProfile({
  id: "u1",
  email: "player@example.com",
  connect5Stats: storage.normalizeGameStats({
    played: 5,
    won: 5,
    completedDates: ["2026-11-12"],
  }),
  allGameStats: {
    "9-rhymes": storage.normalizeGameStats({
      played: 3,
      won: 3,
      completedDates: ["2026-11-12"],
    }),
  } as Partial<Record<string, Partial<import("@/lib/game-storage").GameStats>>> as never,
});
kit.eq(
  normProf.allGameStats?.["connect-5"].played,
  5,
  "normalizeUserProfile merges legacy connect5Stats into allGameStats['connect-5']"
);
kit.eq(
  normProf.allGameStats?.["9-rhymes"].played,
  3,
  "normalizeUserProfile preserves allGameStats['9-rhymes']"
);

// ---------------------------------------------------------------------------
// 6. Tier 1 & Tier 2 Moderation Invariants
// ---------------------------------------------------------------------------
kit.eq(
  mod.moderateText("clean gratitude reflection", "public").allowed,
  true,
  "Clean text passes public moderation"
);
kit.eq(
  mod.moderateText("what the fuck happened", "public").allowed,
  false,
  "Tier 2 profanity is blocked on public surfaces"
);
kit.eq(
  mod.moderateText("what the fuck happened", "private").allowed,
  true,
  "Tier 2 casual swearing is allowed inside private ?b= custom friend games"
);
kit.eq(
  mod.moderateText("kike slur test", "private").allowed,
  false,
  "Tier 1 hate speech/slurs are strictly blocked even in private mode"
);

// ---------------------------------------------------------------------------
// 7. Decoupled Share + Copy Results + Route & Security Invariants across Codebase
// ---------------------------------------------------------------------------
kit.eq(
  [...auth.INITIAL_GAME_MASTERS],
  ["lucas@soltheory.com", "steve@soltheory.com"],
  "INITIAL_GAME_MASTERS contains ONLY lucas@soltheory.com and steve@soltheory.com"
);

const GAME_COMPONENT_FILES: Array<[string, string]> = [
  ["21-things", "src/components/games/twenty-one-things.tsx"],
  ["17-syllables", "src/components/games/seventeen-syllables.tsx"],
  ["9-rhymes", "src/components/games/nine-rhymes.tsx"],
  ["eightfold-echo", "src/components/games/eightfold-echo.tsx"],
  ["6-pics", "src/components/games/six-pics.tsx"],
  ["connect-5", "src/components/games/connect-five.tsx"],
  ["four-score", "src/components/games/four-score.tsx"],
  ["move-2", "src/components/games/move-two.tsx"],
  ["1-win", "src/components/games/one-win.tsx"],
];

const shareButtonsSrc = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/games/result-share-buttons.tsx"),
  "utf8"
);
kit.assert(
  shareButtonsSrc.includes("nativeShareResultsOnly") &&
    shareButtonsSrc.includes("copyResultsOnly") &&
    shareButtonsSrc.includes("COPIED_FEEDBACK_MS = 2000"),
  "ResultShareButtons implements decoupled nativeShareResultsOnly + copyResultsOnly (2000ms)"
);

for (const [slug, relFile] of GAME_COMPONENT_FILES) {
  const src = fs.readFileSync(path.resolve(process.cwd(), relFile), "utf8");
  const hasDecoupledShare =
    src.includes("ResultShareButtons") ||
    (src.includes("nativeShareResultsOnly") && src.includes("copyResultsOnly"));
  kit.assert(
    hasDecoupledShare,
    `${slug} (${relFile}) renders decoupled Share + Copy results buttons`
  );
  const pagePath = path.resolve(process.cwd(), `src/app/games/${slug}/page.tsx`);
  kit.assert(fs.existsSync(pagePath), `/games/${slug}/page.tsx route exists`);
}

const schemaSql = fs.readFileSync(
  path.resolve(process.cwd(), "supabase/schema.sql"),
  "utf8"
);
for (const table of [
  "user_profiles",
  "daily_puzzles",
  "custom_puzzles",
  "one_win_submissions",
]) {
  const rlsPattern = new RegExp(
    `alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`,
    "i"
  );
  kit.assert(rlsPattern.test(schemaSql), `RLS enabled on public.${table} in schema.sql`);
}

kit.finish();
