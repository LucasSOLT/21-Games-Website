/**
 * Checkpoint 5 — 6 Pics: 66-day bank, fuzzy Levenshtein matcher, progressive scoring,
 * label-free SVG scene engine, Creator Mode (`6p-`), `/admin` synonym generator, and archive.
 * Run: node --experimental-strip-types scripts/test-cp05-6pics.ts
 */
import fs from "node:fs";
import { register } from "node:module";
import { createKit } from "./test-kit.mjs";

register("./test-resolver.mjs", import.meta.url);
const kit = createKit("CP5: 6 Pics");

const six = await import("@/data/puzzles/6-pics");
const daily = await import("@/lib/daily-engine");
const cfg = await import("@/lib/games-config");
const share = await import("@/lib/custom-game-share");
const ai = await import("@/lib/ai-helper");

// ---- 66-day puzzle bank -------------------------------------------------------
kit.eq(six.SIX_PICS_PUZZLES.length, 66, "bank has 66 puzzles");
let allValid = true;
let noThemeLeakInTitle = true;
for (const p of six.SIX_PICS_PUZZLES) {
  const v = six.validateSixPicsPuzzle(p);
  if (!v.valid) {
    allValid = false;
    console.error("Invalid 6 Pics puzzle:", p.id, v.errors);
  }
  if (p.title.toLowerCase().includes(p.themeAnswer.toLowerCase())) {
    noThemeLeakInTitle = false;
  }
}
kit.assert(allValid, "all 66 bank puzzles pass validateSixPicsPuzzle");
kit.assert(noThemeLeakInTitle, "editorial subtitle never spoils themeAnswer");
kit.eq(six.SIX_PICS_PUZZLES[0]!.themeAnswer, "Hawaii", "puzzle #1 matches Q32 Hawaii theme");

// ---- Label-free SVG scene renderer -------------------------------------------
let scenesLabelFree = true;
for (const scene of six.SIX_PICS_SCENES) {
  const svg = six.renderSixPicsSceneSvg({ scene }, 0);
  if (!svg.startsWith("<svg") || svg.includes("<text")) {
    scenesLabelFree = false;
  }
}
kit.assert(
  scenesLabelFree,
  "all 84 scene presets render valid SVG with zero <text> labels during gameplay"
);

// ---- Fuzzy matcher & Levenshtein <= 1 for >= 5 chars (Q30) --------------------
const hawaii = six.SIX_PICS_PUZZLES[0]!;
kit.assert(six.matchSixPicsGuess("  THE Hawaii! ", hawaii).matched, "exact normalized match");
kit.assert(six.matchSixPicsGuess("Aloha State", hawaii).matched, "accepted alias match");
kit.assert(six.matchSixPicsGuess("Hawai", hawaii).matched, "1-letter deletion typo on 6-char theme");
kit.assert(six.matchSixPicsGuess("Hawaiii", hawaii).matched, "1-letter insertion typo on 6-char theme");
kit.assert(!six.matchSixPicsGuess("Alaska", hawaii).matched, "unrelated guess rejected");

const shortTheme = { themeAnswer: "Cat", acceptedAliases: ["feline"] };
kit.assert(six.matchSixPicsGuess("cat", shortTheme).matched, "short 3-char exact match");
kit.assert(
  !six.matchSixPicsGuess("car", shortTheme).matched,
  "short <5-char theme does NOT allow 1-letter typo forgiveness"
);
kit.assert(
  six.matchSixPicsGuess("felin", shortTheme).matched,
  ">=5-char alias still gets 1-letter typo forgiveness"
);

// ---- Scoring 6/6 down to 0/6 (Q29 & Q31) -------------------------------------
kit.eq(
  [1, 2, 3, 4, 5, 6].map((n) => six.scoreForSixPics(n)),
  [6, 5, 4, 3, 2, 1],
  "scoring 6/6 on Pic #1 down to 1/6 on Pic #6"
);
kit.eq(six.scoreForSixPics(null), 0, "missed all 6 attempts -> 0/6");

const receipt = six.buildSixPicsEmojiReceipt([
  { kind: "wrong", guess: "ocean" },
  { kind: "skip" },
  { kind: "correct", guess: "Hawaii" },
]);
kit.eq(receipt, "🟥🟨🟩⬜⬜⬜", "6-tile emoji receipt");
const shareStr = six.buildSixPicsShareText({
  puzzleNumber: 7,
  attempts: [
    { kind: "wrong", guess: "ocean" },
    { kind: "correct", guess: "Hawaii" },
  ],
});
kit.assert(shareStr.startsWith("6 Pics #7\n5/6\n🟥🟩⬜⬜⬜⬜"), "share text score + emojis");

// ---- AI / local synonym helper & Creator link --------------------------------
const autoSyns = await ai.generate6PicsSynonyms("Ocean", { preferredProvider: "local" });
kit.assert(autoSyns.length >= 2 && autoSyns.includes("sea"), "generate6PicsSynonyms returns local aliases");
const customId = share.generateCustomGameId("6-pics");
kit.assert(customId.startsWith("6p-") && share.isValidCustomGameId(customId), "6p- custom short link ID");
kit.assert(
  share.buildCustomGameShareUrl("6-pics", customId).length < 75,
  "6-pics custom share URL < 75 chars"
);

// ---- Daily engine + seeded fallback ------------------------------------------
const dk = "2026-11-12";
const dailyRes = daily.getDailyPuzzleForGame("6-pics", dk);
kit.assert(dailyRes !== null && dailyRes.origin === "bank", "daily engine resolves 6-pics");
const fallbackRes = daily.getDailyPuzzleForGame("6-pics", dk, { [dk]: { invalid: 1 } });
kit.assert(
  fallbackRes !== null && six.validateSixPicsPuzzle(fallbackRes.puzzle).valid,
  "invalid override falls back cleanly"
);

// ---- Config & UI wiring -------------------------------------------------------
kit.assert(cfg.isPlayableGameSlug("6-pics"), "6-pics isPlayable");
kit.eq(cfg.getGameBySlug("6-pics")?.showCreate, true, "6-pics showCreate is true");

const comp = fs.readFileSync("src/components/games/six-pics.tsx", "utf8");
for (const needle of [
  "GameSplashScreen",
  "ImageWithFallback",
  "ResultShareButtons",
  "Skip / Reveal Next Pic",
  "grid-cols-2",
  "mode === \"create\"",
  "6p-",
]) {
  kit.assert(comp.includes(needle), `six-pics.tsx contains ${needle}`);
}
const editor = fs.readFileSync("src/components/games/six-pics-editor.tsx", "utf8");
kit.assert(
  editor.includes("Auto-Generate Synonyms/Aliases") && editor.includes("generate6PicsSynonyms"),
  "SixPicsEditor wires Auto-Generate Synonyms/Aliases button"
);
const admin = fs.readFileSync("src/app/admin/page.tsx", "utf8");
kit.assert(admin.includes("SixPicsStudioTab"), "/admin includes SixPicsStudioTab");
const archive = await import("@/app/games/[slug]/archive/page");
const params = await archive.generateStaticParams();
kit.assert(
  params.some((p: { slug: string }) => p.slug === "6-pics"),
  "archive static params include 6-pics"
);

kit.finish();
