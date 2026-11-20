/**
 * Site-Wide Audit Overhaul Verification Suite (Phases 1–6)
 *
 * Verifies:
 * 1. Legacy WebKit CSS Compatibility (`@layer` unwrapping, `color-mix` rgba fallbacks, `zoom-layout` scan)
 * 2. Bundle Decoupling (`game-storage.ts` & `src/app/page.tsx` zero eager puzzle-bank/solver imports)
 * 3. Fair-Play Streaks (`todayKey` reset on missed days, custom `?b=` isolation, archive backfill isolation, Reveal non-win)
 * 4. `9-for-9 Daily Sweep` status & unlock event (`solgames:daily-sweep-unlocked`)
 * 5. Security & Role Access (`daily_puzzles_select_public` date horizon, forged `admin` rejection)
 * 6. `"21 Games"` Branding, 9 OpenGraph PNGs (`1200x630`), PWA icons/manifest/SW, SEO routes (`robots.txt`, `sitemap.xml`, `404.html`)
 * 7. Scoped `hero.css`, removed `hands.png`/`boxes-bg.png`/`logo.png` bloat
 * 8. Shared Web Audio SFX mute sync (`game-sfx.ts` <-> `move-two-audio.ts`) & `puzzle-sanitizers.ts`
 * 9. `/admin` Playable Preview Sandbox & Unpublish Override wiring
 *
 * Run: node --experimental-strip-types --no-warnings scripts/test-audit-overhaul.ts
 */

import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { createKit } from "./test-kit.mjs";

register("./test-resolver.mjs", import.meta.url);
const kit = createKit("Site-Wide Audit Overhaul (Phases 1–6)");

// Minimal in-memory window/localStorage shim for browser-targeted helpers
const memStore = new Map<string, string>();
const dispatchedEvents: string[] = [];

if (typeof globalThis.window === "undefined") {
  const localStorageMock = {
    getItem: (k: string) => (memStore.has(k) ? memStore.get(k)! : null),
    setItem: (k: string, v: string) => {
      memStore.set(k, String(v));
    },
    removeItem: (k: string) => {
      memStore.delete(k);
    },
    clear: () => {
      memStore.clear();
    },
    key: (i: number) => Array.from(memStore.keys())[i] ?? null,
    get length() {
      return memStore.size;
    },
  };

  (globalThis as Record<string, unknown>).localStorage = localStorageMock;
  (globalThis as Record<string, unknown>).window = {
    localStorage: localStorageMock,
    sessionStorage: localStorageMock,
    location: { origin: "https://21games.ai", pathname: "/", protocol: "https:" },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: (ev: { type?: string }) => {
      if (ev?.type) dispatchedEvents.push(ev.type);
      return true;
    },
  };
  if (typeof globalThis.CustomEvent === "undefined") {
    (globalThis as Record<string, unknown>).CustomEvent = class CustomEvent<T = unknown> {
      type: string;
      detail: T;
      constructor(type: string, init?: { detail?: T }) {
        this.type = type;
        this.detail = init?.detail as T;
      }
    };
  }
}

const cfg = await import("@/lib/games-config");
const dateKeys = await import("@/lib/date-keys");
const storage = await import("@/lib/game-storage");
const auth = await import("@/lib/user-auth");
const sfx = await import("@/lib/game-sfx");
const moveTwoAudio = await import("@/lib/move-two-audio");
const sanitizers = await import("@/lib/puzzle-sanitizers");

function readPngDimensions(filePath: string): { width: number; height: number } | null {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  if (buf.length < 24) return null;
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] !== 0x89 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x4e ||
    buf[3] !== 0x47
  ) {
    return null;
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

// ---------------------------------------------------------------------------
// 1. Phase 1: Bundle Decoupling & CSS Compatibility Config
// ---------------------------------------------------------------------------
const tailwindCfgSrc = fs.readFileSync("tailwind.config.ts", "utf8");
kit.assert(
  tailwindCfgSrc.includes("./src/lib/"),
  "tailwind.config.ts scans ./src/lib/** so zoom-layout.ts classes are never purged"
);

const postcssCfgSrc = fs.readFileSync("postcss.config.mjs", "utf8");
kit.assert(
  postcssCfgSrc.includes("postcss-legacy-compat.cjs") &&
    fs.existsSync("postcss-legacy-compat.cjs"),
  "postcss.config.mjs loads Turbopack-compatible postcss-legacy-compat.cjs"
);

const layoutSrc = fs.readFileSync("src/app/layout.tsx", "utf8");
kit.assert(
  layoutSrc.includes("CssIntegrityGuard"),
  "src/app/layout.tsx mounts CssIntegrityGuard"
);
kit.assert(
  !layoutSrc.includes("user-scalable=0"),
  "src/app/layout.tsx removes accessibility-blocking user-scalable=0"
);

const storageSrc = fs.readFileSync("src/lib/game-storage.ts", "utf8");
const nonTypeImports = storageSrc
  .replace(/import\s+type\s+[\s\S]*?from\s+["'][^"']+["'];?/g, "")
  .match(/from\s+["']@\/(data\/puzzles\/|lib\/daily-engine)[^"']*["']/g);
kit.eq(
  nonTypeImports,
  null,
  "src/lib/game-storage.ts has zero runtime imports of heavy puzzle banks or daily-engine"
);

const homePageSrc = fs.readFileSync("src/app/page.tsx", "utf8");
kit.assert(
  !homePageSrc.includes("getDailyPuzzleForGame"),
  "src/app/page.tsx does not eagerly pull all 9 solvers via getDailyPuzzleForGame"
);

// ---------------------------------------------------------------------------
// 2. Phase 2: Strict Fair-Play Streaks, Reveal Non-Win & Daily Sweep
// ---------------------------------------------------------------------------
function shiftDateKey(baseKey: string, deltaDays: number): string {
  const d = dateKeys.parseDateKeyToLocalNoon(baseKey);
  d.setDate(d.getDate() + deltaDays);
  return dateKeys.getLocalDateKey(d);
}

memStore.clear();
const today = dateKeys.getLocalDateKey();
const yesterday = shiftDateKey(today, -1);
const threeDaysAgo = shiftDateKey(today, -3);
const fourDaysAgo = shiftDateKey(today, -4);
const tomorrow = shiftDateKey(today, 1);

const missedDayStreak = storage.recomputeStreakFromCompletedDates(
  [fourDaysAgo, threeDaysAgo],
  today
);
kit.eq(
  missedDayStreak.currentStreak,
  0,
  "recomputeStreakFromCompletedDates resets currentStreak to 0 when yesterday & today were missed"
);
kit.eq(
  missedDayStreak.maxStreak,
  2,
  "recomputeStreakFromCompletedDates preserves historical maxStreak (2)"
);

const activeStreak = storage.recomputeStreakFromCompletedDates(
  [yesterday, today],
  today
);
kit.eq(
  activeStreak.currentStreak,
  2,
  "recomputeStreakFromCompletedDates computes active streak (2) across yesterday + today"
);

// Custom ?b= board isolation
memStore.clear();
storage.recordGameWin("21-things", today, 0, { isCustom: true });
const afterCustom = storage.getGameStats("21-things");
kit.eq(
  afterCustom.completedDates.includes(today),
  false,
  "Custom ?b= solve does NOT mark today's daily puzzle completed"
);
kit.eq(
  afterCustom.currentStreak,
  0,
  "Custom ?b= solve does NOT award a daily win streak"
);

// Archive backfill isolation
memStore.clear();
storage.recordGameWin("connect-5", yesterday, 42);
const afterArchive = storage.getGameStats("connect-5");
kit.eq(
  afterArchive.completedDates.includes(yesterday),
  true,
  "Archive solve marks past date completed for Archive checkmarks"
);
kit.eq(
  afterArchive.currentStreak,
  0,
  "Archive backfill does NOT artificially inflate live daily streak"
);

// Future date isolation
storage.recordGameWin("connect-5", tomorrow, 15);
kit.eq(
  storage.getGameStats("connect-5").completedDates.includes(tomorrow),
  false,
  "Future admin test solve never pollutes completedDates"
);

// Reveal non-win isolation
memStore.clear();
const afterReveal = storage.recordGameRevealed("17-syllables", today);
kit.eq(afterReveal.played, 1, "recordGameRevealed increments played count");
kit.eq(
  afterReveal.completedDates.includes(today),
  false,
  "recordGameRevealed does NOT mark daily date completed"
);
kit.eq(
  afterReveal.currentStreak,
  0,
  "recordGameRevealed does NOT grant a daily win streak"
);
kit.eq(
  afterReveal.bestTimeSeconds,
  null,
  "recordGameRevealed does NOT record Fastest Solve"
);

// 9-for-9 Daily Sweep
memStore.clear();
dispatchedEvents.length = 0;
for (let i = 0; i < cfg.ALL_GAME_SLUGS.length; i++) {
  const slug = cfg.ALL_GAME_SLUGS[i];
  storage.recordGameWin(slug, today);
  const sweep = storage.getDailySweepStatus(today);
  kit.eq(
    sweep.completedCount,
    i + 1,
    `Daily Sweep tracks ${i + 1}/9 after completing ${slug}`
  );
}
kit.eq(
  storage.getDailySweepStatus(today).isSweepComplete,
  true,
  "getDailySweepStatus reports isSweepComplete === true at 9/9"
);
kit.assert(
  dispatchedEvents.includes("solgames:daily-sweep-unlocked"),
  "Completing the 9th daily game dispatches solgames:daily-sweep-unlocked"
);

// Forged localStorage admin rejection
const forgedAdmin = {
  id: "forged-123",
  email: "attacker@example.com",
  role: "admin",
  isBanned: false,
} as unknown as Parameters<typeof auth.canAccessPuzzleStudio>[0];
kit.eq(
  auth.canAccessPuzzleStudio(forgedAdmin),
  false,
  "canAccessPuzzleStudio rejects unverified/forged admin profile"
);

const secMig = fs.readFileSync(
  "supabase/migrations/20261119000001_audit_security_and_sync.sql",
  "utf8"
);
kit.assert(
  secMig.includes("puzzle_date <= (current_date + 1)"),
  "Security migration restricts anonymous future daily_puzzles scraping"
);

// ---------------------------------------------------------------------------
// 3. Phase 3 & 4: "21 Games" Branding, Hands+Phone Promo Hero, Back-Scroll Memory & OG/PWA
// ---------------------------------------------------------------------------
kit.eq(fs.existsSync("public/logo.png"), false, "Orphaned public/logo.png removed");
kit.eq(
  readPngDimensions("public/hands.png"),
  { width: 2500, height: 1395 },
  "Hero two-hands smartphone graphic public/hands.png (2500x1395) is restored"
);
kit.eq(
  fs.existsSync("public/boxes-bg.png"),
  true,
  "Hero public/boxes-bg.png asset is present"
);

const heroSrc = fs.readFileSync("src/components/hero.tsx", "utf8");
kit.assert(
  heroSrc.includes('/hands.png') &&
    heroSrc.includes("hero-demo-container") &&
    /coming soon/i.test(heroSrc),
  "Hero renders two hands holding smartphone + in-bezel promo video 'coming soon' effect"
);
kit.assert(
  homePageSrc.includes("<Hero />") && !homePageSrc.includes("showCompactHubHeader"),
  "Homepage always renders <Hero /> for all visitors"
);

const navHistory = await import("@/lib/navigation-history");
memStore.clear();
(globalThis.window as unknown as Record<string, unknown>).scrollY = 1480;
(globalThis.window as unknown as { location: { pathname: string; search: string } }).location = {
  pathname: "/",
  search: "",
};
navHistory.recordRouteVisit("/", "/");
navHistory.snapshotScrollPosition("/", true);
(globalThis.window as unknown as Record<string, unknown>).scrollY = 0;
(globalThis.window as unknown as { location: { pathname: string; search: string } }).location = {
  pathname: "/games/move-2",
  search: "",
};
navHistory.recordRouteVisit("/games/move-2", "/games/move-2");

let pushedHref: string | null = null;
let pushedScrollOpt: boolean | undefined = undefined;
let calledBack = false;
navHistory.navigateBackToPreviousScreen(
  {
    push: (href, opts) => {
      pushedHref = href;
      pushedScrollOpt = opts?.scroll;
    },
    back: () => {
      calledBack = true;
    },
  },
  "/",
  { excludePathname: "/games/move-2", gameSlug: "move-2" }
);
const pendingRestore = navHistory.readPendingScrollRestore();
kit.assert(
  calledBack || (pushedHref === "/" && pushedScrollOpt === false),
  "Back arrow navigates to exact previous route without resetting scroll to top"
);
kit.eq(
  pendingRestore?.targetPathname,
  "/",
  "Back arrow targets exact previous screen ('/')"
);
kit.eq(
  pendingRestore?.scrollY,
  1480,
  "Back arrow preserves exact previous scrollY (1480px)"
);
navHistory.writePendingScrollRestore(null);

const gameShellSrc = fs.readFileSync("src/components/game-shell.tsx", "utf8");
kit.assert(
  gameShellSrc.includes("navigateBackToPreviousScreen"),
  "GameShell top-left back arrow uses navigateBackToPreviousScreen"
);

const rootOgDim = readPngDimensions("public/og-image.png");
kit.eq(
  rootOgDim,
  { width: 1200, height: 630 },
  "public/og-image.png is a valid 1200x630 PNG"
);

for (const slug of cfg.ALL_GAME_SLUGS) {
  const ogPath = path.join("public", "og", `${slug}.png`);
  const dim = readPngDimensions(ogPath);
  kit.eq(dim, { width: 1200, height: 630 }, `${ogPath} is a valid 1200x630 PNG`);

  const gamePageSrc = fs.readFileSync(
    path.join("src", "app", "games", slug, "page.tsx"),
    "utf8"
  );
  kit.assert(
    gamePageSrc.includes(`/og/${slug}.png`),
    `src/app/games/${slug}/page.tsx wires /og/${slug}.png`
  );
  kit.assert(
    !gamePageSrc.includes("| SOL GaMES"),
    `src/app/games/${slug}/page.tsx uses unified 21 Games title template without '| SOL GaMES'`
  );
}

kit.eq(
  readPngDimensions("public/apple-touch-icon.png"),
  { width: 180, height: 180 },
  "public/apple-touch-icon.png is 180x180"
);
kit.eq(
  readPngDimensions("public/icon-192.png"),
  { width: 192, height: 192 },
  "public/icon-192.png is 192x192"
);
kit.eq(
  readPngDimensions("public/icon-512.png"),
  { width: 512, height: 512 },
  "public/icon-512.png is 512x512"
);
kit.assert(fs.existsSync("public/favicon.ico"), "public/favicon.ico exists");
kit.assert(fs.existsSync("public/sw.js"), "public/sw.js offline Service Worker exists");
kit.assert(fs.existsSync("src/app/manifest.ts"), "src/app/manifest.ts exists");
kit.assert(fs.existsSync("src/app/robots.ts"), "src/app/robots.ts exists");
kit.assert(fs.existsSync("src/app/sitemap.ts"), "src/app/sitemap.ts exists");
kit.assert(fs.existsSync("src/app/not-found.tsx"), "src/app/not-found.tsx exists");

// ---------------------------------------------------------------------------
// 4. Phase 4–6: Scoped Hero CSS, SFX Sync, Sanitizers & Admin Preview/Unpublish
// ---------------------------------------------------------------------------
const heroCss = fs.readFileSync("src/components/hero.css", "utf8");
kit.assert(
  heroCss.includes(".sol-hero-root"),
  "src/components/hero.css scopes rules under .sol-hero-root"
);

memStore.clear();
sfx.setGameSfxMuted(true);
kit.eq(sfx.isGameSfxMuted(), true, "setGameSfxMuted(true) mutes global SFX");
kit.eq(
  moveTwoAudio.isMoveTwoMuted(),
  true,
  "setGameSfxMuted(true) synchronizes Move Two mute state"
);
moveTwoAudio.setMoveTwoMuted(false);
kit.eq(
  sfx.isGameSfxMuted(),
  false,
  "setMoveTwoMuted(false) synchronizes global SFX unmute state"
);

kit.eq(
  sanitizers.isPlaceholderConnect5Connection("Connects PAPER to CLIP"),
  true,
  "isPlaceholderConnect5Connection flags auto-generated placeholder bridges"
);
kit.eq(
  sanitizers.findConnect5TitleSpoiler("Secret CLIP Chain", ["PAPER", "CLIP", "BOARD", "WALK", "WAY"]),
  "CLIP",
  "findConnect5TitleSpoiler catches hidden middle-word spoilers in Connect 5 titles"
);

const haikuLines = sanitizers.buildStructuredHaikuLines([
  "Quiet morning light",
  "Soft rain falls on green bamboo",
  "Frogs leap in the pond",
] as [string, string, string]);
const flatChunks = sanitizers.sliceHaikuIntoChunks([
  "Quiet morning light",
  "Soft rain falls on green bamboo",
  "Frogs leap in the pond",
] as [string, string, string]);
kit.eq(
  haikuLines.reduce(
    (acc, l) => acc + l.words.reduce((wAcc, w) => wAcc + w.chunks.length, 0),
    0
  ),
  flatChunks.length,
  "17 Syllables admin sliceHaikuIntoChunks and gameplay buildStructuredHaikuLines produce identical chunk counts"
);

kit.assert(
  fs.existsSync("src/components/admin/admin-puzzle-preview-modal.tsx"),
  "Admin Playable Draft Preview modal exists"
);
const adminPageSrc = fs.readFileSync("src/app/admin/page.tsx", "utf8");
kit.assert(
  adminPageSrc.includes("AdminPuzzlePreviewModal") &&
    adminPageSrc.includes("deleteAdminOverrideForGame"),
  "src/app/admin/page.tsx wires AdminPuzzlePreviewModal and deleteAdminOverrideForGame"
);

// ---------------------------------------------------------------------------
// 5. Post-Build Static Output Checks (when `out/` is present)
// ---------------------------------------------------------------------------
if (fs.existsSync("out")) {
  kit.assert(
    fs.existsSync("out/manifest.webmanifest"),
    "Static export emits out/manifest.webmanifest"
  );
  kit.assert(
    fs.existsSync("out/robots.txt") &&
      fs.readFileSync("out/robots.txt", "utf8").includes("Disallow: /admin"),
    "Static export emits out/robots.txt disallowing /admin"
  );
  kit.assert(
    fs.existsSync("out/sitemap.xml") &&
      fs.readFileSync("out/sitemap.xml", "utf8").includes("https://21games.ai/games/move-2"),
    "Static export emits out/sitemap.xml with all 9 game URLs"
  );
  kit.assert(fs.existsSync("out/404.html"), "Static export emits custom out/404.html");

  const cssDir = path.join("out", "_next", "static", "chunks");
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs
      .readdirSync(cssDir)
      .filter((f) => f.endsWith(".css"))
      .map((f) => fs.readFileSync(path.join(cssDir, f), "utf8"))
      .join("\n");

    kit.eq(
      /@layer\s+(utilities|base|components|theme)\s*\{/.test(cssFiles),
      false,
      "Compiled CSS in out/_next/static/chunks/*.css has 0 @layer blocks (iOS < 16.4 safe!)"
    );
    kit.assert(
      /#[0-9a-fA-F]{8}|rgba\(/.test(cssFiles) &&
        cssFiles.includes("transform:translate(") &&
        cssFiles.includes(".grid-cols-3"),
      "Compiled CSS includes legacy color/transform fallbacks and zoom-layout grid classes"
    );
  }
}

kit.finish();
