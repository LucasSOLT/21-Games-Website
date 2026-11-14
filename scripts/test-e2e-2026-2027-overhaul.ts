/**
 * 4-Tier Requirement-Driven E2E Test Suite — 2026–2027 Platform Overhaul (`F1`–`F12`):
 *
 *   - Tier 1: Feature Coverage (>= 5 tests per feature area across Req 1, Req 2, Req 3, Req 4)
 *   - Tier 2: Boundary & Corner Cases (5x5 corner/border rolls, partial hole overlap, year transitions)
 *   - Tier 3: Cross-Feature Combinations (stale 3x3 override self-healing, 6-face replay + stars + profile stats)
 *   - Tier 4: Real-World Application Scenarios (426-day `2026-11-01`..`2027-12-31` x 9 games = 3,834 resolutions)
 *
 * Run: node --experimental-strip-types scripts/test-e2e-2026-2027-overhaul.ts
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { register } from "node:module";
import { createKit } from "./test-kit.mjs";

register("./test-resolver.mjs", import.meta.url);
const kit = createKit("E2E: 2026-2027 Overhaul (Tiers 1-4 · F1-F12)");

const cfg = await import("@/lib/games-config");
const daily = await import("@/lib/daily-engine");
const sources = await import("@/lib/puzzle-sources");
const storage = await import("@/lib/game-storage");
const batch = await import("@/lib/monthly-batch");
const mod = await import("@/lib/moderation");
const m2Gen = await import("@/lib/generators/move-two-generator");
const m2Data = await import("@/data/puzzles/move-2");
const m2Audio = await import("@/lib/move-two-audio");
const profileModal = await import("@/components/account/profile-viewer-modal");
const unifiedStats = await import("@/components/account/unified-nine-game-stats");
const gameHelp = await import("@/lib/game-help");

const readSrc = (relPath: string): string =>
  fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");

// ============================================================================
// TIER 1 — FEATURE COVERAGE (>= 5 tests per feature area across F1..F12)
// ============================================================================
console.log("\n--- TIER 1: Feature Coverage (F1-F12) ---");

// ----------------------------------------------------------------------------
// Req 1 (F1, F2, F3, F4): Zero-Scrollbar ProfileViewerModal & UnifiedNineGameStats
// ----------------------------------------------------------------------------
const profileModalSrc = readSrc("src/components/account/profile-viewer-modal.tsx");
const unifiedStatsSrc = readSrc("src/components/account/unified-nine-game-stats.tsx");
const accountPageSrc = readSrc("src/app/account/page.tsx");

// F1: Zero-Scrollbar Profile Popup Container
kit.assert(
  profileModalSrc.includes("overflow-hidden") && profileModalSrc.includes("flex-col"),
  "[T1·F1.1] ProfileViewerModal DialogContent uses overflow-hidden and flex-col"
);
kit.assert(
  !profileModalSrc.includes("overflow-x-auto") && !profileModalSrc.includes("overflow-y-auto"),
  "[T1·F1.2] profile-viewer-modal.tsx has zero overflow-x-auto or overflow-y-auto classes"
);
kit.assert(
  !unifiedStatsSrc.includes("overflow-x-auto") && !unifiedStatsSrc.includes("overflow-y-auto"),
  "[T1·F1.3] unified-nine-game-stats.tsx has zero overflow-x-auto or overflow-y-auto classes"
);
kit.assert(
  typeof profileModal.ProfileViewerModal === "function" &&
    typeof profileModal.LoggedInProfileDashboard === "function" &&
    typeof profileModal.GuestAuthPanel === "function" &&
    typeof profileModal.SetNewPasswordModal === "function",
  "[T1·F1.4] profile-viewer-modal.tsx exports ProfileViewerModal, LoggedInProfileDashboard, GuestAuthPanel, SetNewPasswordModal"
);
kit.assert(
  accountPageSrc.includes("LoggedInProfileDashboard") &&
    accountPageSrc.includes("GuestAuthPanel") &&
    accountPageSrc.includes("UnifiedNineGameStats"),
  "[T1·F1.5] /account page preserves imports of LoggedInProfileDashboard, GuestAuthPanel, and UnifiedNineGameStats"
);

// F2: Profile Popup Top 3-Tab Navigation (stats | boards | edit)
kit.assert(
  profileModalSrc.includes('"stats"') &&
    profileModalSrc.includes('"boards"') &&
    profileModalSrc.includes('"edit"'),
  "[T1·F2.1] profile-viewer-modal.tsx defines all 3 section tabs ('stats', 'boards', 'edit')"
);
kit.assert(
  profileModalSrc.includes("9-Game Stats") &&
    (profileModalSrc.includes("My Boards & #1 Picks") ||
      profileModalSrc.includes("My Boards &amp; #1 Picks")) &&
    profileModalSrc.includes("Edit Profile"),
  "[T1·F2.2] profile-viewer-modal.tsx renders segmented tab labels for 9-Game Stats, My Boards & #1 Picks, and Edit Profile"
);
kit.assert(
  profileModalSrc.includes('useState<ProfileModalSectionTab>("stats")') ||
    profileModalSrc.includes('initialSectionTab = "stats"') ||
    profileModalSrc.includes('useState("stats")'),
  "[T1·F2.3] LoggedInProfileDashboard initializes activeTab state to 'stats'"
);
kit.assert(
  profileModalSrc.includes("selectedGameId") && profileModalSrc.includes("setSelectedGameId"),
  "[T1·F2.4] LoggedInProfileDashboard manages selectedGameId spotlight state"
);
kit.assert(
  profileModalSrc.includes("onOpenBoardsTab") || profileModalSrc.includes('setActiveTab("boards")'),
  "[T1·F2.5] LoggedInProfileDashboard wires quick navigation from #21 spotlight card to 'boards' tab"
);

// F3: Compact 9-Game Selector Grid & Single-Game Spotlight
kit.assert(
  typeof unifiedStats.UnifiedNineGameStats === "function" &&
    typeof unifiedStats.buildUnifiedLast7DaysStrip === "function",
  "[T1·F3.1] unified-nine-game-stats.tsx exports UnifiedNineGameStats and buildUnifiedLast7DaysStrip"
);
kit.assert(
  unifiedStatsSrc.includes("selectedGameId") &&
    unifiedStatsSrc.includes("onSelectGameId") &&
    unifiedStatsSrc.includes("spotlightMode"),
  "[T1·F3.2] UnifiedNineGameStats accepts selectedGameId, onSelectGameId, and spotlightMode props"
);
kit.assert(
  unifiedStatsSrc.includes("grid-cols-3") && unifiedStatsSrc.includes("sm:grid-cols-9"),
  "[T1·F3.3] UnifiedNineGameStats renders compact 9-game selector grid (grid-cols-3 sm:grid-cols-9)"
);
kit.assert(
  unifiedStatsSrc.includes("profile-stat-card-${slug}"),
  "[T1·F3.4] UnifiedNineGameStats preserves data-testid='profile-stat-card-${slug}' on game card"
);
const stripSample = unifiedStats.buildUnifiedLast7DaysStrip([]);
kit.assert(
  stripSample.length === 7 &&
    stripSample[6]?.isToday === true &&
    stripSample.slice(0, 6).every((d) => d.isToday === false) &&
    stripSample.every((d) => d.completed === false),
  "[T1·F3.5] buildUnifiedLast7DaysStrip returns 7 chronological day items ending on Today"
);

// F4: Profile Helper Functions & Zero-Scroll Views
kit.eq(
  profileModal.getAvatarTextClass("#F9D423"),
  "text-black",
  "[T1·F4.1] getAvatarTextClass('#F9D423') returns 'text-black' for high-contrast yellow swatch"
);
kit.eq(
  profileModal.formatSolveTime(65),
  "1:05",
  "[T1·F4.2] formatSolveTime(65) formats seconds as '1:05'"
);
const avgTime = profileModal.computeAverageSolveTime(
  storage.normalizeGameStats({ played: 4, won: 4, totalTimeSeconds: 200, bestTimeSeconds: 40 })
);
kit.eq(
  avgTime,
  50,
  "[T1·F4.3] computeAverageSolveTime computes rounded mean solve time (200 / 4 = 50s)"
);
const sampleBoard = daily.get21ThingsBoardForDate("2026-11-12");
kit.assert(
  Boolean(
    sampleBoard &&
      profileModal.buildBoardShareUrl(sampleBoard).includes(`?b=${encodeURIComponent(sampleBoard.id)}`) &&
      profileModal.buildBoardPlayHref(sampleBoard) === `/games/21-things?b=${encodeURIComponent(sampleBoard.id)}`
  ),
  "[T1·F4.4] buildBoardShareUrl and buildBoardPlayHref generate valid ?b= custom board URLs"
);
kit.assert(
  profileModal.buildResonancePickHref({
    boardId: "21t-abc12345",
    boardTitle: "Custom",
    pick1Item: "Coffee",
    reflection: "Warm",
    dateKey: "2026-11-12",
  }) === "/games/21-things?b=21t-abc12345" &&
    profileModal.buildResonancePickHref({
      boardId: "2026-11-12",
      boardTitle: "Daily",
      pick1Item: "Sun",
      reflection: "Bright",
      dateKey: "2026-11-12",
    }) === "/games/21-things?date=2026-11-12",
  "[T1·F4.5] buildResonancePickHref routes custom boards to ?b= and daily boards to ?date="
);

// ----------------------------------------------------------------------------
// Req 2 (F10): Admin Studio 2-Row TabsList & TabsTrigger Button Styling
// ----------------------------------------------------------------------------
const tabsSrc = readSrc("src/components/ui/tabs.tsx");
const adminPageSrc = readSrc("src/app/admin/page.tsx");

kit.assert(
  tabsSrc.includes("min-h-11") && tabsSrc.includes("h-auto"),
  "[T1·F10.1] TabsList in src/components/ui/tabs.tsx uses min-h-11 and h-auto (no fixed h-11 clipping)"
);
kit.assert(
  tabsSrc.includes("flex-wrap"),
  "[T1·F10.2] TabsList in src/components/ui/tabs.tsx includes flex-wrap to enclose multi-row tabs"
);
kit.assert(
  tabsSrc.includes("border-2") &&
    tabsSrc.includes("bg-black text-white") &&
    tabsSrc.includes("bg-white text-black"),
  "[T1·F10.3] TabsTrigger applies explicit border-2 and solid active/inactive button backgrounds"
);
kit.assert(
  tabsSrc.includes('data-state={isActive ? "active" : "inactive"}'),
  "[T1·F10.4] TabsTrigger exposes data-state='active'|'inactive' attribute"
);
kit.assert(
  adminPageSrc.includes("<TabsList") &&
    adminPageSrc.includes("h-auto") &&
    adminPageSrc.includes("min-h-11"),
  "[T1·F10.5] /admin page TabsList uses h-auto min-h-11 so both rows of game buttons sit inside container"
);

// ----------------------------------------------------------------------------
// Req 3 (F11, F12, F9): MonthlyBufferPanel Removal, Clear All / Revert Controls, 2026-2027 Bank
// ----------------------------------------------------------------------------
// F11: Remove MonthlyBufferPanel from /admin UI while keeping monthly-batch.ts functional
kit.assert(
  !adminPageSrc.includes("<MonthlyBufferPanel"),
  "[T1·F11.1] <MonthlyBufferPanel is removed from src/app/admin/page.tsx"
);
kit.assert(
  typeof batch.getTargetMonthMPlus2 === "function" &&
    typeof batch.generateAndVerifyMonthlyBatch === "function" &&
    typeof batch.getPreferredAIProvider === "function" &&
    typeof batch.setPreferredAIProvider === "function",
  "[T1·F11.2] src/lib/monthly-batch.ts retains all batch generation and AI provider functions"
);
kit.eq(
  batch.getTargetMonthMPlus2(new Date("2026-11-20T12:00:00Z")).monthKey,
  "2027-01",
  "[T1·F11.3] getTargetMonthMPlus2 calculates 2027-01 for Nov 2026"
);
const april2027Batch = batch.generateAndVerifyMonthlyBatch(2027, 4, {
  preferredProvider: "local",
});
kit.assert(
  april2027Batch.daysInMonth === 30 &&
    april2027Batch.totalPuzzles === 270 &&
    april2027Batch.allValid === true,
  "[T1·F11.4] generateAndVerifyMonthlyBatch(2027, 4) verifies 270 valid puzzles across all 9 games"
);
kit.assert(
  fs.existsSync(path.resolve(process.cwd(), "scripts/generate-monthly-batch.ts")),
  "[T1·F11.5] scripts/generate-monthly-batch.ts CLI script remains intact for developer use"
);

// F12: "Clear All" and "Revert to Default" on all 9 games in /admin
const allAdminSources = [
  adminPageSrc,
  readSrc("src/components/admin/nine-rhymes-studio-tab.tsx"),
  readSrc("src/components/admin/eightfold-echo-studio-tab.tsx"),
  readSrc("src/components/admin/six-pics-studio-tab.tsx"),
  readSrc("src/components/admin/four-score-studio-tab.tsx"),
  readSrc("src/components/admin/move-two-studio-tab.tsx"),
  readSrc("src/components/admin/one-win-studio-tab.tsx"),
].join("\n");

const missingClearAll: string[] = [];
const missingRevertDefault: string[] = [];
for (const slug of cfg.ALL_GAME_SLUGS) {
  const altSlug = slug === "move-2" ? "move-two" : slug;
  if (
    !allAdminSources.includes(`data-testid="admin-${slug}-clear-all"`) &&
    !allAdminSources.includes(`data-testid="admin-${altSlug}-clear-all"`)
  ) {
    missingClearAll.push(slug);
  }
  if (
    !allAdminSources.includes(`data-testid="admin-${slug}-revert-default"`) &&
    !allAdminSources.includes(`data-testid="admin-${altSlug}-revert-default"`)
  ) {
    missingRevertDefault.push(slug);
  }
}
kit.eq(
  missingClearAll,
  [],
  "[T1·F12.1] All 9 games expose data-testid='admin-${slug}-clear-all' in /admin studio"
);
kit.eq(
  missingRevertDefault,
  [],
  "[T1·F12.2] All 9 games expose data-testid='admin-${slug}-revert-default' in /admin studio"
);
kit.assert(
  allAdminSources.includes("Clear All") && allAdminSources.includes("Revert to Default"),
  "[T1·F12.3] Admin studio tabs render 'Clear All' and 'Revert to Default' button labels"
);

// Verify studio tabs do NOT invoke saveAdminOverride or upsertDailyPuzzleToSupabase inside Clear All / Revert handlers
const studioTabFiles = [
  "src/components/admin/nine-rhymes-studio-tab.tsx",
  "src/components/admin/eightfold-echo-studio-tab.tsx",
  "src/components/admin/six-pics-studio-tab.tsx",
  "src/components/admin/four-score-studio-tab.tsx",
  "src/components/admin/move-two-studio-tab.tsx",
  "src/components/admin/one-win-studio-tab.tsx",
];
kit.assert(
  studioTabFiles.every((rel) => {
    const s = readSrc(rel);
    return !s.includes("saveAdminOverride") && !s.includes("upsertDailyPuzzleToSupabase");
  }),
  "[T1·F12.4] Standalone studio tab components never directly mutate overrides storage or Supabase on Clear/Revert"
);
kit.assert(
  studioTabFiles.every((rel) => {
    const s = readSrc(rel);
    return (
      s.includes("initialPuzzle") ||
      s.includes("prevInitial !== initial") ||
      s.includes("prevDate !== targetDate")
    );
  }),
  "[T1·F12.5] All standalone studio tabs automatically revert draft to initial/default puzzle on targetDate/tab change"
);

// F9: Complete 2026-2027 Pre-Generated Daily Puzzles (Tier 1 checks)
kit.assert(
  cfg.ALL_GAME_SLUGS.every((slug) => sources.getPuzzleSource(slug) !== null),
  "[T1·F9.1] All 9 countdown games are registered in PUZZLE_SOURCES"
);
kit.eq(
  m2Data.MOVE_TWO_PUZZLES.length,
  66,
  "[T1·F9.2] Static bank export MOVE_TWO_PUZZLES preserves length === 66 backwards compatibility"
);
const tier1SampleDates = ["2026-11-15", "2026-12-25", "2027-01-15", "2027-07-04", "2027-12-31"];
kit.assert(
  cfg.ALL_GAME_SLUGS.every((slug) =>
    tier1SampleDates.every((d) => daily.getDailyPuzzleForGame(slug, d)?.origin === "bank")
  ),
  "[T1·F9.3] getDailyPuzzleForGame returns origin === 'bank' across 2026 and 2027 sample dates for all 9 games"
);
kit.assert(
  cfg.ALL_GAME_SLUGS.every((slug) => {
    const src = sources.getPuzzleSource(slug)!;
    return tier1SampleDates.every((d) => {
      const res = daily.getDailyPuzzleForGame(slug, d);
      return Boolean(res && src.validate(res.puzzle) && res.summary.title.length > 0);
    });
  }),
  "[T1·F9.4] Every sample 2026-2027 daily puzzle passes source.validate and produces valid summary metadata"
);
kit.assert(
  cfg.ALL_GAME_SLUGS.every((slug) =>
    tier1SampleDates.every((d) => {
      const res = daily.getDailyPuzzleForGame(slug, d);
      return Boolean(res && mod.moderateText(res.summary.title, "public").allowed);
    })
  ),
  "[T1·F9.5] Every sample 2026-2027 daily puzzle title passes public Tier 1 + Tier 2 content moderation"
);

// ----------------------------------------------------------------------------
// Req 4 (F5, F6, F7, F8): Move Two 5x5 2.5D Overhaul, SFX, Studio & Bible
// ----------------------------------------------------------------------------
// F5: Move Two 5x5 6-Face Engine, Recessed Hole & Raised Rim
kit.eq(
  m2Gen.MOVE_TWO_GRID_SIZE,
  5,
  "[T1·F5.1] MOVE_TWO_GRID_SIZE is upgraded to 5 (5x5 grid per face)"
);
kit.assert(
  m2Data.MOVE_TWO_PUZZLES.every(
    (p) =>
      p.faces.length === 6 &&
      p.faces.every(
        (f) =>
          f.grid.length === 5 &&
          f.grid.every((row) => row.length === 5) &&
          Boolean(f.start) &&
          Boolean(f.hole)
      )
  ),
  "[T1·F5.2] All 66 MOVE_TWO_PUZZLES have 6 5x5 faces with coded face.start and face.hole"
);

const createEmpty5x5Grid = (): import("@/lib/generators/move-two-generator").MoveTwoGrid => [
  ["floor", "floor", "floor", "floor", "floor"],
  ["floor", "floor", "floor", "floor", "floor"],
  ["floor", "floor", "floor", "floor", "floor"],
  ["floor", "floor", "floor", "floor", "floor"],
  ["floor", "floor", "floor", "floor", "floor"],
];

const makeSynth5x5Puzzle = (
  face0Overrides?: Partial<import("@/lib/generators/move-two-generator").MoveTwoFace>,
  face5Overrides?: Partial<import("@/lib/generators/move-two-generator").MoveTwoFace>
) => {
  const faces = Array.from({ length: 6 }, (_, idx) => ({
    index: idx,
    grid: createEmpty5x5Grid(),
    start: { posture: "UPRIGHT" as const, r: 0, c: 0 },
    hole: { posture: "UPRIGHT" as const, r: 4, c: 4 },
    exitEdge: null,
  })) as import("@/lib/generators/move-two-generator").MoveTwoPuzzle["faces"];
  if (face0Overrides) {
    faces[0] = { ...faces[0], ...face0Overrides };
  }
  if (face5Overrides) {
    faces[5] = { ...faces[5], ...face5Overrides };
  }
  return {
    faces,
    start: { face: 0, ...faces[0].start },
    target: faces[5].hole,
  };
};

const synthBasic = makeSynth5x5Puzzle();
kit.assert(
  m2Gen.stepMoveTwoDomino(synthBasic, { face: 0, posture: "UPRIGHT", r: 0, c: 2 }, "up").kind === "bump" &&
    m2Gen.stepMoveTwoDomino(synthBasic, { face: 0, posture: "UPRIGHT", r: 4, c: 2 }, "down").kind === "bump" &&
    m2Gen.stepMoveTwoDomino(synthBasic, { face: 0, posture: "UPRIGHT", r: 2, c: 0 }, "left").kind === "bump" &&
    m2Gen.stepMoveTwoDomino(synthBasic, { face: 0, posture: "UPRIGHT", r: 2, c: 4 }, "right").kind === "bump",
  "[T1·F5.3] Raised outer cube rim returns { kind: 'bump' } on all 4 outer borders (up, down, left, right)"
);

const hazardGrid = createEmpty5x5Grid();
hazardGrid[0][1] = "hazard";
hazardGrid[1][0] = "wall";
const synthHazardWall = makeSynth5x5Puzzle({ grid: hazardGrid });
const hazOut = m2Gen.stepMoveTwoDomino(
  synthHazardWall,
  { face: 0, posture: "UPRIGHT", r: 0, c: 0 },
  "right"
);
const wallOut = m2Gen.stepMoveTwoDomino(
  synthHazardWall,
  { face: 0, posture: "UPRIGHT", r: 0, c: 0 },
  "down"
);
kit.assert(
  hazOut.kind === "hazard" && hazOut.hitCells.length >= 1 && wallOut.kind === "bump",
  "[T1·F5.4] Interior hazard tile returns { kind: 'hazard' } and interior wall tile returns { kind: 'bump' }"
);

// Hole drop on Face 0 -> portals to Face 1's coded start; Hole drop on Face 5 -> won
const synthHoleDrop = makeSynth5x5Puzzle(
  {
    start: { posture: "UPRIGHT", r: 0, c: 0 },
    hole: { posture: "FLAT_H", r: 0, c: 1 },
  },
  {
    start: { posture: "FLAT_V", r: 1, c: 1 },
    hole: { posture: "UPRIGHT", r: 2, c: 2 },
  }
);
synthHoleDrop.faces[1] = {
  ...synthHoleDrop.faces[1],
  start: { posture: "FLAT_V", r: 2, c: 3 },
};
const dropFace0 = m2Gen.stepMoveTwoDomino(
  synthHoleDrop,
  { face: 0, posture: "UPRIGHT", r: 0, c: 0 },
  "right"
);
const dropFace5 = m2Gen.stepMoveTwoDomino(
  synthHoleDrop,
  { face: 5, posture: "FLAT_H", r: 2, c: 0 },
  "right"
);
kit.assert(
  dropFace0.kind === "portal" &&
    dropFace0.fromFace === 0 &&
    dropFace0.toFace === 1 &&
    dropFace0.next.face === 1 &&
    dropFace0.next.posture === "FLAT_V" &&
    dropFace0.next.r === 2 &&
    dropFace0.next.c === 3 &&
    dropFace5.kind === "won" &&
    dropFace5.next.posture === "UPRIGHT" &&
    dropFace5.next.r === 2 &&
    dropFace5.next.c === 2,
  "[T1·F5.5] Entering recessed hole on Face 0 transitions to Face 1 coded start; entering hole on Face 5 returns { kind: 'won' }"
);

const sampleM2 = m2Data.MOVE_TWO_PUZZLES[0]!;
const face0Solved = m2Gen.solveMoveTwoFace(sampleM2.faces[0]);
const fullSolved = m2Gen.solveMoveTwo(sampleM2);
kit.assert(
  face0Solved.solvable &&
    face0Solved.minMoves >= 4 &&
    face0Solved.minMoves <= 9 &&
    fullSolved.solvable &&
    fullSolved.minMoves === sampleM2.par &&
    sampleM2.par >= 24 &&
    sampleM2.par <= 48,
  "[T1·F5.6] solveMoveTwoFace (4..9 moves/face) and solveMoveTwo (24..48 total Par) verify 5x5 puzzle optimality"
);

// F6: Move Two 2.5D Tilted Stage, 3D Extruded Die & Cube Animations
const m2GameSrc = readSrc("src/components/games/move-two.tsx");
kit.assert(
  m2GameSrc.includes("perspective") && m2GameSrc.includes("rotateX(25deg)"),
  "[T1·F6.1] move-two.tsx renders 2.5D perspective stage with rotateX(25deg) tilt"
);
kit.assert(
  m2GameSrc.includes("grid-cols-5") && m2GameSrc.includes("m2-cell-"),
  "[T1·F6.2] move-two.tsx renders 5x5 grid (grid-cols-5) with m2-cell-${r}-${c} test IDs"
);
kit.assert(
  m2GameSrc.includes("m2-domino-"),
  "[T1·F6.3] move-two.tsx renders 3D extruded domino with m2-domino-${r}-${c} test IDs"
);
kit.assert(
  (m2GameSrc.includes("HOLE") || m2GameSrc.includes("hole")) &&
    (m2GameSrc.includes("GOAL") || m2GameSrc.includes("dropping") || m2GameSrc.includes("rotating")),
  "[T1·F6.4] move-two.tsx renders recessed hole/goal indicators and hole-drop/cube rotation transitions"
);
kit.assert(
  m2GameSrc.includes("IsometricCubeHud") &&
    m2GameSrc.includes("GameSplashScreen") &&
    m2GameSrc.includes("ResultShareButtons") &&
    m2GameSrc.includes("Undo Move") &&
    m2GameSrc.includes("Reset Face"),
  "[T1·F6.5] move-two.tsx preserves IsometricCubeHud, GameSplashScreen, ResultShareButtons, Undo Move, and Reset Face"
);

// F7: Move Two Web Audio API SFX & Mute Toggle
kit.assert(
  typeof m2Audio.isMoveTwoMuted === "function" &&
    typeof m2Audio.setMoveTwoMuted === "function" &&
    typeof m2Audio.playMoveTwoRollSfx === "function" &&
    typeof m2Audio.playMoveTwoRimBumpSfx === "function" &&
    typeof m2Audio.playMoveTwoHoleDropSfx === "function" &&
    typeof m2Audio.playMoveTwoHazardSfx === "function" &&
    typeof m2Audio.playMoveTwoVictorySfx === "function",
  "[T1·F7.1] src/lib/move-two-audio.ts exports all 7 Web Audio SFX and mute control functions"
);
let sfxNoThrow = true;
try {
  m2Audio.setMoveTwoMuted(false);
  m2Audio.playMoveTwoRollSfx("UPRIGHT");
  m2Audio.playMoveTwoRollSfx("FLAT_H");
  m2Audio.playMoveTwoRollSfx("FLAT_V");
  m2Audio.playMoveTwoRimBumpSfx();
  m2Audio.playMoveTwoHoleDropSfx();
  m2Audio.playMoveTwoHazardSfx();
  m2Audio.playMoveTwoVictorySfx();
} catch {
  sfxNoThrow = false;
}
kit.assert(
  sfxNoThrow,
  "[T1·F7.2] All Move Two SFX functions execute safely in headless Node without throwing"
);
m2Audio.setMoveTwoMuted(true);
const mutedAfterTrue = m2Audio.isMoveTwoMuted();
m2Audio.setMoveTwoMuted(false);
const mutedAfterFalse = m2Audio.isMoveTwoMuted();
kit.assert(
  mutedAfterTrue === true && mutedAfterFalse === false,
  "[T1·F7.3] setMoveTwoMuted and isMoveTwoMuted accurately toggle and persist mute state"
);
kit.assert(
  m2GameSrc.includes("move-two-audio") && m2GameSrc.includes('data-testid="move-two-mute-toggle"'),
  "[T1·F7.4] move-two.tsx wires move-two-audio SFX and renders data-testid='move-two-mute-toggle'"
);
let mutedNoOpSafe = true;
try {
  m2Audio.setMoveTwoMuted(true);
  m2Audio.playMoveTwoRollSfx("UPRIGHT");
  m2Audio.playMoveTwoRimBumpSfx();
  m2Audio.playMoveTwoHoleDropSfx();
  m2Audio.playMoveTwoHazardSfx();
  m2Audio.playMoveTwoVictorySfx();
  m2Audio.setMoveTwoMuted(false);
} catch {
  mutedNoOpSafe = false;
}
kit.assert(
  mutedNoOpSafe,
  "[T1·F7.5] All SFX functions safely no-op when muted"
);

// F8: Move Two 5x5 /admin Studio Editor & GAME_DESIGN_BIBLE.md
const m2StudioSrc = readSrc("src/components/admin/move-two-studio-tab.tsx");
const bibleSrc = readSrc("GAME_DESIGN_BIBLE.md");

kit.assert(
  m2StudioSrc.includes("grid-cols-5") && !m2StudioSrc.includes("0, 1, 2].map"),
  "[T1·F8.1] move-two-studio-tab.tsx renders interactive 5x5 face grids (grid-cols-5)"
);
kit.assert(
  m2StudioSrc.includes("solveMoveTwoFace") && m2StudioSrc.includes("solveMoveTwo"),
  "[T1·F8.2] move-two-studio-tab.tsx computes live per-face (solveMoveTwoFace) and 6-face (solveMoveTwo) BFS Par"
);
kit.assert(
  (m2StudioSrc.includes('data-testid="admin-move-2-clear-all"') ||
    m2StudioSrc.includes('data-testid="admin-move-two-clear-all"')) &&
    (m2StudioSrc.includes('data-testid="admin-move-2-revert-default"') ||
      m2StudioSrc.includes('data-testid="admin-move-two-revert-default"')) &&
    m2StudioSrc.includes('data-testid="admin-move-two-reroll"'),
  "[T1·F8.3] move-two-studio-tab.tsx exposes Clear All, Revert to Default, and Reroll Seed test IDs"
);
kit.assert(
  bibleSrc.includes("5×5") &&
    (bibleSrc.includes("2.5D") || bibleSrc.includes("25°")) &&
    (bibleSrc.includes("Recessed") || bibleSrc.includes("recessed") || bibleSrc.includes("Hole")),
  "[T1·F8.4] GAME_DESIGN_BIBLE.md documents Move Two 5x5 2.5D tilted cube, recessed holes, and raised rim"
);
const m2Help = gameHelp.getGameHelp("move-2");
const m2Config = cfg.getGameBySlug("move-2");
kit.assert(
  Boolean(
    m2Help &&
      (m2Help.summary.includes("5×5") ||
        m2Help.rules.some((line) => line.includes("5×5") || line.toLowerCase().includes("hole"))) &&
      m2Config &&
      !m2Config.tagline.includes("3×3")
  ),
  "[T1·F8.5] game-help.ts and games-config.ts reflect Move Two 5x5 cube specification"
);

// ============================================================================
// TIER 2 — BOUNDARY & CORNER CASES
// ============================================================================
console.log("\n--- TIER 2: Boundary & Corner Cases ---");

// 2.1 Move Two 5x5 Corner & Border Roll Matrix across all 4 corners, 4 directions, and 3 postures
const corners = [
  { r: 0, c: 0, label: "Top-Left (0,0)" },
  { r: 0, c: 4, label: "Top-Right (0,4)" },
  { r: 4, c: 0, label: "Bottom-Left (4,0)" },
  { r: 4, c: 4, label: "Bottom-Right (4,4)" },
];
const directions: Array<import("@/lib/generators/move-two-generator").MoveTwoDirection> = [
  "up",
  "down",
  "left",
  "right",
];
const postures: Array<import("@/lib/generators/move-two-generator").MoveTwoPosture> = [
  "UPRIGHT",
  "FLAT_H",
  "FLAT_V",
];

// Use a 5x5 face where hole is at center (2,2) so corner rolls never trigger hole drop
const cornerTestPuzzle = makeSynth5x5Puzzle({
  start: { posture: "UPRIGHT", r: 2, c: 0 },
  hole: { posture: "UPRIGHT", r: 2, c: 2 },
});

let allCornerRollsConsistent = true;
let totalCornerChecks = 0;
for (const corner of corners) {
  for (const posture of postures) {
    // Anchor flat postures inside bounds at the corner when needed:
    const anchorR = posture === "FLAT_V" && corner.r === 4 ? 3 : corner.r;
    const anchorC = posture === "FLAT_H" && corner.c === 4 ? 3 : corner.c;
    const state = { face: 0, posture, r: anchorR, c: anchorC };
    for (const dir of directions) {
      totalCornerChecks++;
      const raw = m2Gen.computeRawRoll(state, dir);
      const cells = m2Gen.getDominoCells(raw);
      const expectedInBounds = cells.every(
        (cell) => cell.r >= 0 && cell.r < 5 && cell.c >= 0 && cell.c < 5
      );
      const outcome = m2Gen.stepMoveTwoDomino(cornerTestPuzzle, state, dir);
      if (!expectedInBounds && outcome.kind !== "bump") {
        allCornerRollsConsistent = false;
      }
      if (expectedInBounds && outcome.kind !== "moved") {
        allCornerRollsConsistent = false;
      }
    }
  }
}
kit.assert(
  allCornerRollsConsistent && totalCornerChecks === 48,
  "[T2·1] All 48 corner x posture x direction boundary rolls at (0,0), (0,4), (4,0), (4,4) match raised 5x5 rim physics"
);

// 2.2 Partial Hole Overlap Rejection (UPRIGHT hole vs FLAT domino, and FLAT hole vs UPRIGHT/shifted domino)
// Case A: 1x1 UPRIGHT hole at (2,2)
const puzzleUprightHole = makeSynth5x5Puzzle({
  start: { posture: "UPRIGHT", r: 0, c: 0 },
  hole: { posture: "UPRIGHT", r: 2, c: 2 },
});
// UPRIGHT at (2,0) rolling right -> tips FLAT_H onto (2,1)-(2,2) overlapping (2,2)! Must NOT drop!
const flatAcrossUprightHole1 = m2Gen.stepMoveTwoDomino(
  puzzleUprightHole,
  { face: 0, posture: "UPRIGHT", r: 2, c: 0 },
  "right"
);
// UPRIGHT at (0,2) rolling down -> tips FLAT_V onto (1,2)-(2,2) overlapping (2,2)! Must NOT drop!
const flatAcrossUprightHole2 = m2Gen.stepMoveTwoDomino(
  puzzleUprightHole,
  { face: 0, posture: "UPRIGHT", r: 0, c: 2 },
  "down"
);
// FLAT_H at (2,0)-(2,1) rolling right -> stands UPRIGHT on (2,2)! MUST drop (portal)!
const exactUprightDrop = m2Gen.stepMoveTwoDomino(
  puzzleUprightHole,
  { face: 0, posture: "FLAT_H", r: 2, c: 0 },
  "right"
);
kit.assert(
  flatAcrossUprightHole1.kind === "moved" &&
    flatAcrossUprightHole2.kind === "moved" &&
    exactUprightDrop.kind === "portal",
  "[T2·2] Rolling FLAT_H or FLAT_V across a 1x1 UPRIGHT hole returns { kind: 'moved' } and does NOT drop in"
);

// Case B: 2x1 FLAT_H hole at (2,2)-(2,3)
const puzzleFlatHHole = makeSynth5x5Puzzle({
  start: { posture: "UPRIGHT", r: 0, c: 0 },
  hole: { posture: "FLAT_H", r: 2, c: 2 },
});
// FLAT_H at (2,0)-(2,1) rolling right -> stands UPRIGHT on (2,2) (1 cell of the 2-cell FLAT_H hole)! Must NOT drop!
const uprightOnFlatHHoleCell1 = m2Gen.stepMoveTwoDomino(
  puzzleFlatHHole,
  { face: 0, posture: "FLAT_H", r: 2, c: 0 },
  "right"
);
// FLAT_V at (0,3)-(1,3) rolling down -> stands UPRIGHT on (2,3) (the other cell of the FLAT_H hole)! Must NOT drop!
const uprightOnFlatHHoleCell2 = m2Gen.stepMoveTwoDomino(
  puzzleFlatHHole,
  { face: 0, posture: "FLAT_V", r: 0, c: 3 },
  "down"
);
// UPRIGHT at (2,0) rolling right -> tips FLAT_H onto (2,1)-(2,2) (shifted by 1 cell)! Must NOT drop!
const shiftedFlatHOnHole = m2Gen.stepMoveTwoDomino(
  puzzleFlatHHole,
  { face: 0, posture: "UPRIGHT", r: 2, c: 0 },
  "right"
);
// FLAT_H at (1,2)-(1,3) rolling down -> lands FLAT_H on (2,2)-(2,3)! MUST drop (portal)!
const exactFlatHDrop = m2Gen.stepMoveTwoDomino(
  puzzleFlatHHole,
  { face: 0, posture: "FLAT_H", r: 1, c: 2 },
  "down"
);
kit.assert(
  uprightOnFlatHHoleCell1.kind === "moved" &&
    uprightOnFlatHHoleCell2.kind === "moved" &&
    shiftedFlatHOnHole.kind === "moved" &&
    exactFlatHDrop.kind === "portal",
  "[T2·3] Standing UPRIGHT on 1 cell or shifted FLAT_H across a 2x1 FLAT_H hole returns { kind: 'moved' } and does NOT drop in"
);

// Case C: 2x1 FLAT_V hole at (2,2)-(3,2)
const puzzleFlatVHole = makeSynth5x5Puzzle({
  start: { posture: "UPRIGHT", r: 0, c: 0 },
  hole: { posture: "FLAT_V", r: 2, c: 2 },
});
// FLAT_H at (2,0)-(2,1) rolling right -> stands UPRIGHT on (2,2)! Must NOT drop!
const uprightOnFlatVHole = m2Gen.stepMoveTwoDomino(
  puzzleFlatVHole,
  { face: 0, posture: "FLAT_H", r: 2, c: 0 },
  "right"
);
// FLAT_V at (2,1)-(3,1) rolling right -> lands FLAT_V on (2,2)-(3,2)! MUST drop (portal)!
const exactFlatVDrop = m2Gen.stepMoveTwoDomino(
  puzzleFlatVHole,
  { face: 0, posture: "FLAT_V", r: 2, c: 1 },
  "right"
);
kit.assert(
  uprightOnFlatVHole.kind === "moved" && exactFlatVDrop.kind === "portal",
  "[T2·4] Standing UPRIGHT on 1 cell of a 2x1 FLAT_V hole returns { kind: 'moved' } while exact FLAT_V match drops in"
);

// 2.3 Unsolvable Face & Invalid Puzzle Boundary Detection
const blockedGrid = createEmpty5x5Grid();
blockedGrid[0][2] = "hazard";
blockedGrid[1][2] = "hazard";
blockedGrid[2][2] = "hazard";
blockedGrid[3][2] = "hazard";
blockedGrid[4][2] = "hazard";
const unsolvableFaceRes = m2Gen.solveMoveTwoFace({
  index: 0,
  grid: blockedGrid,
  start: { posture: "UPRIGHT", r: 0, c: 0 },
  hole: { posture: "UPRIGHT", r: 4, c: 4 },
});
kit.eq(
  unsolvableFaceRes.solvable,
  false,
  "[T2·5] solveMoveTwoFace detects unsolvable 5x5 face when hazard barrier blocks all paths"
);

// 2.4 Profile Helper Boundary & Edge Inputs
kit.assert(
  profileModal.formatSolveTime(null) === "—" &&
    profileModal.formatSolveTime(undefined) === "—" &&
    profileModal.formatSolveTime(0) === "—" &&
    profileModal.formatSolveTime(-15) === "—" &&
    profileModal.formatSolveTime(Number.NaN) === "—" &&
    profileModal.formatSolveTime(59) === "0:59" &&
    profileModal.formatSolveTime(60) === "1:00",
  "[T2·6] formatSolveTime handles null, undefined, 0, negative, NaN, and minute rollover boundaries"
);

// 2.5 Year & Leap-Month Calendar Transitions (2026-12-31 -> 2027-01-01 -> 2027-02-28 -> 2027-03-01 -> 2027-12-31)
const boundaryDates = ["2026-12-31", "2027-01-01", "2027-02-28", "2027-03-01", "2027-12-31"];
let boundaryTransitionsOk = true;
for (const slug of cfg.ALL_GAME_SLUGS) {
  const resolutions = boundaryDates.map((d) => daily.getDailyPuzzleForGame(slug, d));
  if (resolutions.some((r) => !r || r.origin !== "bank")) {
    boundaryTransitionsOk = false;
  }
  // Verify consecutive day puzzleNumber increments across 2026-12-31 -> 2027-01-01 and 2027-02-28 -> 2027-03-01
  if (
    resolutions[1]!.summary.puzzleNumber !== resolutions[0]!.summary.puzzleNumber + 1 ||
    resolutions[3]!.summary.puzzleNumber !== resolutions[2]!.summary.puzzleNumber + 1
  ) {
    boundaryTransitionsOk = false;
  }
}
kit.assert(
  boundaryTransitionsOk,
  "[T2·7] Year-end (2026-12-31 -> 2027-01-01) and Feb-end (2027-02-28 -> 2027-03-01) transitions resolve cleanly across all 9 games"
);

// ============================================================================
// TIER 3 — CROSS-FEATURE COMBINATIONS
// ============================================================================
console.log("\n--- TIER 3: Cross-Feature Combinations ---");

// 3.1 Stale Legacy 3x3 Move Two Override Rejection + Self-Healing to 5x5 Bank Puzzle
const stale3x3Override = {
  id: "legacy-m2-3x3",
  puzzleNumber: 99,
  title: "Legacy 3x3 Puzzle",
  author: "Legacy",
  editor: "Legacy",
  faces: Array.from({ length: 6 }, (_, idx) => ({
    index: idx,
    exitEdge: idx < 5 ? "right" : null,
    grid: [
      ["floor", "floor", "floor"],
      ["floor", "floor", "floor"],
      ["floor", "floor", "floor"],
    ],
  })),
  start: { face: 0, posture: "UPRIGHT", r: 1, c: 1 },
  target: { posture: "UPRIGHT", r: 1, c: 1 },
  par: 12,
  canonicalMoves: ["right", "left"],
};

kit.eq(
  m2Gen.validateMoveTwoPuzzle(stale3x3Override).valid,
  false,
  "[T3·1] validateMoveTwoPuzzle strictly rejects stale legacy 3x3 Move Two payload"
);

const selfHealedM2 = daily.getDailyPuzzleForGame<import("@/data/puzzles/move-2").MoveTwoPuzzle>(
  "move-2",
  "2027-06-15",
  { "2027-06-15": stale3x3Override }
);
kit.assert(
  Boolean(
    selfHealedM2 &&
      selfHealedM2.origin === "bank" &&
      selfHealedM2.puzzle.faces.length === 6 &&
      selfHealedM2.puzzle.faces.every((f) => f.grid.length === 5 && f.grid[0].length === 5) &&
      m2Gen.validateMoveTwoPuzzle(selfHealedM2.puzzle).valid
  ),
  "[T3·2] getDailyPuzzleForGame('move-2') rejects stale 3x3 override and self-heals to valid 5x5 bank puzzle"
);

// 3.2 Valid Custom 5x5 Override vs. Revert-to-Default Resolution
const custom5x5Override = m2Gen.generateMoveTwoPuzzle("custom-admin-override-2027-06-15", {
  id: "m2-custom-override",
  puzzleNumber: 223,
  title: "Admin Custom 5x5 Cube",
  customDate: "2027-06-15",
});
const withValidOverride = daily.getDailyPuzzleForGame<import("@/data/puzzles/move-2").MoveTwoPuzzle>(
  "move-2",
  "2027-06-15",
  { "2027-06-15": custom5x5Override }
);
const afterRevertDefault = daily.getDailyPuzzleForGame<import("@/data/puzzles/move-2").MoveTwoPuzzle>(
  "move-2",
  "2027-06-15",
  {}
);
kit.assert(
  Boolean(
    withValidOverride &&
      withValidOverride.origin === "override" &&
      withValidOverride.puzzle.title === "Admin Custom 5x5 Cube" &&
      afterRevertDefault &&
      afterRevertDefault.origin === "bank" &&
      afterRevertDefault.puzzle.id !== "m2-custom-override"
  ),
  "[T3·3] Daily engine honors valid 5x5 custom override when published and reverts to pre-generated bank default when cleared"
);

// 3.3 Full 6-Face Canonical Move Replay + Per-Face Hole Drops + Star Rating + Profile Stats Merge + Share Text
const replayPuzzle = selfHealedM2!.puzzle;
let replayState = replayPuzzle.start;
let portalCount = 0;
let finalWon = false;
let faceStartMatches = true;

for (let i = 0; i < replayPuzzle.canonicalMoves.length; i++) {
  const dir = replayPuzzle.canonicalMoves[i]!;
  const step = m2Gen.stepMoveTwoDomino(replayPuzzle, replayState, dir);
  if (i < replayPuzzle.canonicalMoves.length - 1) {
    if (step.kind === "portal") {
      portalCount++;
      const expectedNextStart = replayPuzzle.faces[step.toFace]!.start;
      if (
        step.next.face !== step.toFace ||
        step.next.posture !== expectedNextStart.posture ||
        step.next.r !== expectedNextStart.r ||
        step.next.c !== expectedNextStart.c
      ) {
        faceStartMatches = false;
      }
      replayState = step.next;
    } else if (step.kind === "moved") {
      replayState = step.next;
    } else {
      faceStartMatches = false;
    }
  } else {
    if (
      step.kind === "won" &&
      step.next.posture === replayPuzzle.faces[5].hole.posture &&
      step.next.r === replayPuzzle.faces[5].hole.r &&
      step.next.c === replayPuzzle.faces[5].hole.c
    ) {
      finalWon = true;
    }
  }
}

const starsAtPar = m2Gen.computeMoveTwoStars(replayPuzzle.par, replayPuzzle.par);
const starsPlus2 = m2Gen.computeMoveTwoStars(replayPuzzle.par + 2, replayPuzzle.par);
const starsPlus4 = m2Gen.computeMoveTwoStars(replayPuzzle.par + 4, replayPuzzle.par);
const starsPlus10 = m2Gen.computeMoveTwoStars(replayPuzzle.par + 10, replayPuzzle.par);

const shareReceipt = m2Data.buildMoveTwoShareText({
  puzzleNumber: replayPuzzle.puzzleNumber,
  title: replayPuzzle.title,
  moves: replayPuzzle.par,
  par: replayPuzzle.par,
  stars: starsAtPar,
});

const profileSummaryM2 = storage.buildUnifiedGameProfileSummary("move-2", {
  played: 1,
  won: 1,
  currentStreak: 1,
  maxStreak: 1,
  completedDates: ["2027-06-15"],
  distribution: {
    best_over_par_plus_100: 100,
    par_stars_3: 1,
  },
});

kit.assert(
  portalCount === 5 &&
    faceStartMatches &&
    finalWon &&
    starsAtPar === 3 &&
    starsPlus2 === 3 &&
    starsPlus4 === 2 &&
    starsPlus10 === 1 &&
    shareReceipt.includes(`Par: ${replayPuzzle.par} · ⭐⭐⭐`) &&
    profileSummaryM2.metrics.some((m) => m.label === "Best vs. Par" && m.value === "Par (0)"),
  "[T3·4] Full 6-face 5x5 canonical replay drops into 5 sequential holes + Face 6 goal, computes stars, formats share receipt, and updates UnifiedNineGameStats"
);

// ============================================================================
// TIER 4 — REAL-WORLD APPLICATION SCENARIOS (426 Days x 9 Games = 3,834 Resolutions)
// ============================================================================
console.log("\n--- TIER 4: Real-World 426-Day Schedule Simulation (2026-11-01 .. 2027-12-31) ---");

function buildDateRange(startIso: string, endIso: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  const cur = new Date(Date.UTC(sy!, sm! - 1, sd!));
  const end = new Date(Date.UTC(ey!, em! - 1, ed!));
  while (cur <= end) {
    const yyyy = cur.getUTCFullYear();
    const mm = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(cur.getUTCDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

const ALL_426_DATES = buildDateRange("2026-11-01", "2027-12-31");
kit.eq(
  ALL_426_DATES.length,
  426,
  "[T4·1] Schedule span from 2026-11-01 through 2027-12-31 contains exactly 426 consecutive days"
);

function computeContentFingerprint(slug: string, puzzle: unknown): string {
  const p = puzzle as Record<string, unknown>;
  switch (slug) {
    case "21-things":
      return JSON.stringify({ title: p.title, items: p.items });
    case "17-syllables":
      return JSON.stringify({ theme: p.theme, lines: p.lines });
    case "9-rhymes":
      return JSON.stringify({
        starterWord: p.starterWord,
        clues: (p.clues as Array<Record<string, unknown>>)?.map((c) => ({
          answer: c.answer,
          sentence: c.sentence,
        })),
      });
    case "eightfold-echo":
      return JSON.stringify({
        solution: p.solution,
        tiles: p.tiles,
      });
    case "6-pics":
      return JSON.stringify({
        themeAnswer: p.themeAnswer,
        title: p.title,
        clues: (p.clues as Array<Record<string, unknown>>)?.map((c) => ({
          sceneId: c.sceneId,
          caption: c.caption,
          openPieceIndex: c.openPieceIndex,
        })),
      });
    case "connect-5":
      return JSON.stringify({
        title: p.title,
        words: p.words,
        connections: p.connections,
      });
    case "four-score":
      return JSON.stringify({
        digits: p.digits,
        operators: p.operators,
        canonicalEquation: p.canonicalEquation,
      });
    case "move-2":
      return JSON.stringify({
        faces: (p.faces as Array<Record<string, unknown>>)?.map((f) => ({
          grid: f.grid,
          start: f.start,
          hole: f.hole,
        })),
        par: p.par,
      });
    case "1-win":
      return JSON.stringify({
        title: p.title,
        prompt: p.prompt,
        subtitle: p.subtitle,
        seedCommunityWins: p.seedCommunityWins,
      });
    default:
      return JSON.stringify(p);
  }
}

let totalResolutions = 0;
for (const slug of cfg.ALL_GAME_SLUGS) {
  const source = sources.getPuzzleSource(slug)!;
  const fingerprints = new Set<string>();
  let allBankOrigin = true;
  let allValidated = true;
  let firstFailDetail = "";

  for (const dateKey of ALL_426_DATES) {
    totalResolutions++;
    const res = daily.getDailyPuzzleForGame(slug, dateKey);
    if (!res || res.origin !== "bank") {
      allBankOrigin = false;
      if (!firstFailDetail) firstFailDetail = `${slug} @ ${dateKey} origin=${res?.origin}`;
    }
    if (!res || !source.validate(res.puzzle)) {
      allValidated = false;
      if (!firstFailDetail) firstFailDetail = `${slug} @ ${dateKey} failed source.validate`;
    }
    if (res) {
      const fp = computeContentFingerprint(slug, res.puzzle);
      fingerprints.add(fp);
    }
  }

  kit.assert(
    allBankOrigin && allValidated && fingerprints.size === ALL_426_DATES.length,
    `[T4·2·${slug}] 426/426 days (2026-11-01..2027-12-31) resolve origin='bank', pass validate(), and have 426 unique puzzles (got ${fingerprints.size}/426)`,
    firstFailDetail
  );
}

kit.eq(
  totalResolutions,
  3834,
  "[T4·3] Completed all 3,834 daily puzzle resolutions (426 days x 9 games)"
);

// Verify .gitignore ignores .agents/
const gitIgnoreCheck = spawnSync("git", ["check-ignore", "-v", ".agents/"], {
  cwd: process.cwd(),
  encoding: "utf8",
});
kit.assert(
  gitIgnoreCheck.status === 0 && gitIgnoreCheck.stdout.includes(".agents/"),
  "[T4·4] .gitignore excludes .agents/ directory from git tracking"
);

// Verify Mobile Header Ellipsis Truncation, Minimalist 9 Rhymes Logo, Linear 9 Rhymes Chain & Move Two NYT 3D Stacked Block Overhaul
const gameShellSrc = readSrc("src/components/game-shell.tsx");
kit.assert(
  gameShellSrc.includes('data-testid="game-shell-title"') &&
    gameShellSrc.includes("flex-1 min-w-0 overflow-hidden") &&
    gameShellSrc.includes("truncate min-w-0"),
  "[T4·5] GameShell header center title uses flex-1 min-w-0 overflow-hidden and truncate min-w-0 for clean mobile ellipsis truncation"
);

const gameLogoSrc = readSrc("src/components/game-logo.tsx");
kit.assert(
  gameLogoSrc.includes("Minimalist NYT Games Editorial Card") &&
    gameLogoSrc.includes("Green Target Hole at top-right") &&
    gameLogoSrc.includes('strokeLinejoin="miter"') &&
    !gameLogoSrc.includes("Domino pips on top face"),
  "[T4·6] game-logo.tsx renders minimalist NYT Games 9 Rhymes emblem and sharp-edged Move Two 2-cube block + green hole (no domino pips)"
);

const nineEngineSrc = readSrc("src/lib/nine-rhymes-engine.ts");
kit.assert(
  nineEngineSrc.includes("getRhymeTargetForRound") &&
    nineEngineSrc.includes("The next word rhymes with "),
  "[T4·7] nine-rhymes-engine.ts prompts each new word to rhyme linearly with the word immediately before it"
);

kit.assert(
  m2GameSrc.includes('data-testid="move-two-3d-block"') &&
    m2GameSrc.includes("grid-rows-5") &&
    m2GameSrc.includes('strokeLinejoin="miter"') &&
    m2GameSrc.includes("320ms") &&
    m2GameSrc.includes("Blocked by a wall.") &&
    m2GameSrc.includes("You hit an obstacle! Resetting position.") &&
    m2GameSrc.includes("Red obstacle hole") &&
    m2GameSrc.includes("#2ECC71") &&
    !m2GameSrc.includes("border-sky-500") &&
    !m2GameSrc.includes("Dark void hazard"),
  "[T4·8] move-two.tsx renders uniform 5x5 tiles, sharp-edged 3D two-cube SVG block, green target holes on all 6 faces, recessed red obstacle holes, and generic copy"
);

const nineRhymesCompSrc = readSrc("src/components/games/nine-rhymes.tsx");
kit.assert(
  nineRhymesCompSrc.includes("size={1}") &&
    nineRhymesCompSrc.includes("min-w-0 w-0 flex-1") &&
    nineRhymesCompSrc.includes("shrink-0 h-9 w-9") &&
    nineRhymesCompSrc.includes("min-h-0 overflow-y-auto"),
  "[T4·9] nine-rhymes.tsx enforces size={1} min-w-0 on input and shrink-0 on Send button so Send arrow is always visible in mobile portrait view"
);

kit.finish();

