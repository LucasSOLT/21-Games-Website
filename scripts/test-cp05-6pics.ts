/**
 * Checkpoint 5 — 6 Pics (6-Piece Jigsaw Reveal & Name Each Picture):
 * 66-day bank, visible overarching theme, 6 interlocking SVG puzzle pieces per image
 * (5 covering + 1 open at start), per-image fuzzy matcher, 36-point scoring (6 pts -> 1 pt per pic,
 * 0 if missed), label-free SVG scene engine, Creator Mode (`6p-`), `/admin` synonym generator, & archive.
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
const mod = await import("@/lib/moderation");

// ---- 66-day puzzle bank & public moderation -----------------------------------
kit.eq(six.SIX_PICS_PUZZLES.length, 66, "bank has 66 puzzles");
let allValid = true;
let noThemeLeakInTitle = true;
let allCleanModeration = true;
for (const p of six.SIX_PICS_PUZZLES) {
  const v = six.validateSixPicsPuzzle(p);
  if (!v.valid) {
    allValid = false;
    console.error("Invalid 6 Pics puzzle:", p.id, v.errors);
  }
  if (p.title.toLowerCase().includes(p.themeAnswer.toLowerCase())) {
    noThemeLeakInTitle = false;
  }
  if (!mod.checkContentModeration(`${p.themeAnswer} ${p.title}`, { mode: "public" }).allowed) {
    allCleanModeration = false;
  }
  for (const img of p.images) {
    const joined = [img.caption, ...(img.aliases ?? [])].join(" ");
    if (!mod.checkContentModeration(joined, { mode: "public" }).allowed) {
      allCleanModeration = false;
    }
  }
}
kit.assert(allValid, "all 66 bank puzzles pass validateSixPicsPuzzle");
kit.assert(noThemeLeakInTitle, "editorial subtitle never spoils themeAnswer");
kit.assert(allCleanModeration, "all 66 bank puzzles pass Tier 1 + Tier 2 public moderation");
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

// ---- 6 interlocking jigsaw pieces & reveal mechanics --------------------------
kit.eq(six.SIX_PICS_PIECES_PER_IMAGE, 6, "6 jigsaw pieces per image");
kit.eq(six.SIX_PICS_MAX_IMAGE_SCORE, 6, "max 6 pts per image");
kit.eq(six.SIX_PICS_MAX_SCORE, 36, "max 36 pts per 6-image puzzle");
kit.eq(six.SIX_PICS_JIGSAW_PIECES.length, 6, "6 interlocking SVG jigsaw contours");
kit.assert(
  six.SIX_PICS_JIGSAW_PIECES.every((piece) => piece.d.startsWith("M ") && piece.d.includes("C ")),
  "every jigsaw piece uses smooth cubic-Bezier interlocking tabs/blanks"
);

const hawaii = six.SIX_PICS_PUZZLES[0]!;
const firstOpen = six.getInitialRevealedPiece(hawaii.images[0]!, 0, hawaii.id);
kit.assert(firstOpen >= 0 && firstOpen < 6, "initial open piece is within 0..5 (5 covering at start)");

const revealedSeq = [firstOpen];
while (revealedSeq.length < 6) {
  const next = six.pickNextRandomPiece(revealedSeq, () => 0.42);
  kit.assert(next !== null && !revealedSeq.includes(next), "pickNextRandomPiece picks a unique covered piece");
  if (next !== null) revealedSeq.push(next);
}
kit.eq(new Set(revealedSeq).size, 6, "all 6 jigsaw pieces uncovered after 5 Reveal Piece clicks");
kit.eq(six.pickNextRandomPiece(revealedSeq), null, "pickNextRandomPiece returns null when 6/6 uncovered");

// ---- Per-image fuzzy matcher (aliases, plural/singular, Levenshtein <= 1) -----
const volcanoClue = hawaii.images[1]!; // "Volcano"
kit.assert(six.matchSixPicsImageGuess("  a Volcano! ", volcanoClue).matched, "exact normalized image caption match");
kit.assert(six.matchSixPicsImageGuess("Volcanos", volcanoClue).matched, "plural/singular stem match");
kit.assert(six.matchSixPicsImageGuess("Lava", volcanoClue).matched, "accepted image alias match");
kit.assert(six.matchSixPicsImageGuess("Volcan", volcanoClue).matched, "1-letter typo forgiveness on >=5-char image name");
kit.assert(!six.matchSixPicsImageGuess("Surfboard", volcanoClue).matched, "wrong image name rejected");

const shortClue = { scene: "sun" as const, caption: "Sun", aliases: ["solar"] };
kit.assert(six.matchSixPicsImageGuess("sun", shortClue).matched, "short 3-char exact match");
kit.assert(!six.matchSixPicsImageGuess("son", shortClue).matched, "short <5-char caption rejects 1-letter typo");
kit.assert(six.matchSixPicsImageGuess("soler", shortClue).matched, ">=5-char alias allows 1-letter typo");

const customUrlClue = {
  scene: "volcano" as const,
  caption: "Mount Fuji",
  aliases: ["Fuji"],
  imageUrl: "https://images.example.com/fuji.jpg",
};
kit.assert(six.matchSixPicsImageGuess("Mount Fuji", customUrlClue).matched, "custom URL caption matches");
kit.assert(
  !six.matchSixPicsImageGuess("Kilauea", customUrlClue).matched,
  "custom imageUrl isolates matching from built-in scene default aliases"
);

// ---- 36-point jigsaw scoring & share receipt ----------------------------------
kit.eq(
  [0, 1, 2, 3, 4, 5].map((extra) => six.scoreForSixPicsImage(true, extra)),
  [6, 5, 4, 3, 2, 1],
  "6 pts at 0 extra pieces removed (1/6 shown) down to 1 pt at 5 extra pieces removed (6/6 shown)"
);
kit.eq(six.scoreForSixPicsImage(false, 0), 0, "unsolved/passed image awards 0 points");

const sampleOutcomes = [
  { revealedPieces: [4], extraPiecesRemoved: 0, solved: true, points: 6 },
  { revealedPieces: [4, 1], extraPiecesRemoved: 1, solved: true, points: 5 },
  { revealedPieces: [4, 1, 2], extraPiecesRemoved: 2, solved: true, points: 4 },
  { revealedPieces: [4, 1, 2, 0, 3], extraPiecesRemoved: 4, solved: true, points: 2 },
  { revealedPieces: [0, 1, 2, 3, 4, 5], extraPiecesRemoved: 5, solved: true, points: 1 },
  { revealedPieces: [2, 5], extraPiecesRemoved: 1, solved: false, points: 0 },
];
kit.eq(six.totalScoreForSixPics(sampleOutcomes), 18, "totalScoreForSixPics sums 6 image outcomes (18/36)");
kit.eq(
  six.buildSixPicsEmojiReceipt(sampleOutcomes),
  "🟩🟩🟨🟧🟧⬜",
  "6-tile emoji receipt encodes piece efficiency & misses"
);

const shareStr = six.buildSixPicsShareText({
  puzzleNumber: 7,
  themeAnswer: "Hawaii",
  outcomes: sampleOutcomes,
});
kit.assert(
  shareStr.includes("6 Pics #7 — Hawaii") &&
    shareStr.includes("18/36 pts · 5/6 named") &&
    shareStr.includes("🟩🟩🟨🟧🟧⬜"),
  "share text includes puzzle #, visible theme, X/36 score, named count, and emojis"
);

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
  "six-pics-jigsaw-stage",
  "Overarching Theme",
  "Reveal Piece",
  "Pass / Reveal Word",
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
