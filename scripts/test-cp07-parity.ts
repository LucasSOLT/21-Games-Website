/**
 * Checkpoint 7 — Existing-game parity (`17 Syllables`, `21 Things`, `Connect 5`):
 * - `17 Syllables`: `?date=` archive resolution + custom click-between-letters haiku slice cutter
 * - `21 Things`: `<GameSplashScreen>` + `<GameErrorBoundary>` + `moderateText` public vs `private_custom`
 * - `Connect 5`: `<GameSplashScreen>` + timer gated on splash dismiss + `c5-` Creator Mode
 * Run: node --experimental-strip-types scripts/test-cp07-parity.ts
 */
import fs from "node:fs";
import { register } from "node:module";
import { createKit } from "./test-kit.mjs";

register("./test-resolver.mjs", import.meta.url);
const kit = createKit("CP7: Existing-Game Parity");

const s17 = await import("@/data/puzzles/17-syllables");
const share = await import("@/lib/custom-game-share");
const mod = await import("@/lib/moderation");

// ---- 1. 17 Syllables custom slice cutter helpers -----------------------------
const sliced = s17.sliceWordByCuts("WHISPER", [4]);
kit.eq(sliced, ["WHIS", "PER"], "sliceWordByCuts splits WHISPER at cut 4");

const whole = s17.sliceWordByCuts("AUTUMN", []);
kit.eq(whole, ["AUTUMN"], "sliceWordByCuts with empty cuts keeps whole word");

const lines: [string, string, string] = [
  "Gold leaves drift along",
  "Cool winds whisper in the dusk",
  "Soft earth waits for dawn",
];
const structured = s17.buildStructuredHaikuLines(lines, {
  "1-2": ["WHI", "SP", "ER"],
});
kit.eq(
  structured[1]?.words[2]?.chunks,
  ["WHI", "SP", "ER"],
  "buildStructuredHaikuLines honors customWordChunks for Line 2 Word 3"
);

// Invalid custom chunk mapping (doesn't concatenate to WHISPER) falls back safely
const fallbackStructured = s17.buildStructuredHaikuLines(lines, {
  "1-2": ["BAD", "CUT"],
});
kit.eq(
  fallbackStructured[1]?.words[2]?.chunks.join(""),
  "WHISPER",
  "buildStructuredHaikuLines rejects mismatched custom chunks and falls back cleanly"
);

// ---- 2. 17 Syllables ?date= archive resolution & /admin cutter ---------------
const s17GameSrc = fs.readFileSync("src/components/games/seventeen-syllables.tsx", "utf8");
kit.assert(
  s17GameSrc.includes('searchParams.get("date")') &&
    s17GameSrc.includes("resolvePuzzle(customParam, activeDateKey)") &&
    s17GameSrc.includes("puzzle.customWordChunks"),
  "17 Syllables resolves ?date=YYYY-MM-DD and honors customWordChunks"
);

const cutterSrc = fs.readFileSync("src/components/admin/haiku-slice-cutter.tsx", "utf8");
kit.assert(
  cutterSrc.includes("Reshuffle / Preview Slices") &&
    cutterSrc.includes("sliceWordByCuts"),
  "HaikuSliceCutter provides click-between-letters cuts and Reshuffle / Preview Slices"
);

const adminSrc = fs.readFileSync("src/app/admin/page.tsx", "utf8");
kit.assert(
  adminSrc.includes("HaikuSliceCutter") && adminSrc.includes("s17CustomWordChunks"),
  "/admin 17-syllables tab mounts HaikuSliceCutter with customWordChunks persistence"
);

// ---- 3. 21 Things splash screen, error boundary, and moderation --------------
const t21PageSrc = fs.readFileSync("src/app/games/21-things/page.tsx", "utf8");
const t21GameSrc = fs.readFileSync("src/components/games/twenty-one-things.tsx", "utf8");
kit.assert(
  t21PageSrc.includes("GameErrorBoundary"),
  "21 Things page wraps game in GameErrorBoundary"
);
kit.assert(
  t21GameSrc.includes("GameSplashScreen") &&
    t21GameSrc.includes("splashDismissed") &&
    t21GameSrc.includes("moderateText"),
  "21 Things renders GameSplashScreen for daily/archive play and enforces moderateText"
);
kit.assert(
  !mod.moderateText("what the hell damn", "public").allowed ||
    !mod.moderateText("bullshit reflection", "public").allowed,
  "Tier 2 profanity blocked on public surface"
);
kit.assert(
  mod.moderateText("damn good coffee", "private_custom").allowed,
  "casual swearing allowed on private_custom surface"
);

// ---- 4. Connect 5 splash screen, timer gate, and c5- Creator Mode ------------
const c5PageSrc = fs.readFileSync("src/app/games/connect-5/page.tsx", "utf8");
const c5GameSrc = fs.readFileSync("src/components/games/connect-five.tsx", "utf8");
const c5CreatorSrc = fs.readFileSync("src/components/games/connect-five-creator.tsx", "utf8");
kit.assert(
  c5PageSrc.includes("GameErrorBoundary"),
  "Connect 5 page wraps game in GameErrorBoundary"
);
kit.assert(
  c5GameSrc.includes("GameSplashScreen") &&
    c5GameSrc.includes("if (!splashDismissed || status !== \"playing\" || isBufferingWin) return;") &&
    c5GameSrc.includes("ConnectFiveCreator"),
  "Connect 5 renders GameSplashScreen, starts timer only after splash dismiss, and wires ConnectFiveCreator"
);
kit.assert(
  c5CreatorSrc.includes('generateCustomGameId("connect-5")') &&
    c5CreatorSrc.includes("saveCustomPuzzle"),
  "ConnectFiveCreator publishes compact c5-xxxxxxxx custom puzzles"
);

const sampleC5Id = share.generateCustomGameId("connect-5");
const sampleC5Url = share.buildCustomGameShareUrl("connect-5", sampleC5Id);
kit.assert(
  sampleC5Id.startsWith("c5-") &&
    share.isValidCustomGameId(sampleC5Id) &&
    sampleC5Url.length < 75,
  `Connect 5 custom short link (${sampleC5Url}) is valid and < 75 chars`
);

kit.finish();
