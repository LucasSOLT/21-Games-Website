/**
 * Checkpoint 3 — 9 Rhymes: bank, validator, seeded fallback, engine, wiring.
 * Run: node --experimental-strip-types scripts/test-cp03-9rhymes.ts
 */
import fs from "node:fs";
import { register } from "node:module";
import { createKit } from "./test-kit.mjs";

register("./test-resolver.mjs", import.meta.url);
const kit = createKit("CP3: 9 Rhymes");

const data = await import("@/data/puzzles/9-rhymes");
const eng = await import("@/lib/nine-rhymes-engine");
const fam = await import("@/data/rhyme-families");
const daily = await import("@/lib/daily-engine");
const cfg = await import("@/lib/games-config");

// ---- bank ----------------------------------------------------------------------
kit.eq(data.NINE_RHYMES_PUZZLES.length, 66, "bank has 66 puzzles");
let allValid = true;
let allSameFamily = true;
let noDupes = true;
for (const p of data.NINE_RHYMES_PUZZLES) {
  const v = data.validateNineRhymesPuzzle(p);
  if (!v.valid) { allValid = false; console.error("invalid", p.id, v.errors); }
  const words = [p.starterWord, ...p.clues.map((c: { answer: string }) => c.answer)];
  if (new Set(words).size !== 10) noDupes = false;
  const f = fam.findRhymeFamilyForWord(p.starterWord);
  if (!f || !p.clues.every((c: { answer: string }) => f.entries.some((e: { word: string }) => e.word === c.answer))) {
    allSameFamily = false;
    console.error("family mismatch", p.id);
  }
}
kit.assert(allValid, "every bank puzzle passes validateNineRhymesPuzzle");
kit.assert(noDupes, "no duplicate words within a puzzle");
kit.assert(allSameFamily, "starter + 9 targets share ONE rhyme family");
kit.assert(data.USABLE_RHYME_FAMILIES.length >= 10, "at least 10 usable rhyme families");
kit.assert(
  data.NINE_RHYMES_PUZZLES.every((p: { clues: { sentence: string; answer: string }[] }) =>
    p.clues.every((c) => !c.sentence.toLowerCase().split(/[^a-z]+/).includes(c.answer))
  ),
  "no clue leaks its own answer"
);

// ---- validator rejects ----------------------------------------------------------
const good = data.NINE_RHYMES_PUZZLES[0];
kit.assert(!data.validateNineRhymesPuzzle(null).valid, "null rejected");
kit.assert(!data.validateNineRhymesPuzzle({ ...good, clues: good.clues.slice(0, 8) }).valid, "8 clues rejected");
kit.assert(!data.validateNineRhymesPuzzle({ ...good, starterWord: "two words" }).valid, "multiword starter rejected");
kit.assert(
  !data.validateNineRhymesPuzzle({ ...good, clues: [{ ...good.clues[0], answer: good.starterWord }, ...good.clues.slice(1)] }).valid,
  "duplicate of starter rejected"
);
kit.assert(
  !data.validateNineRhymesPuzzle({ ...good, clues: [{ ...good.clues[0], sentence: `the ${good.clues[0].answer}` }, ...good.clues.slice(1)] }).valid,
  "answer inside sentence rejected"
);

// ---- seeded fallback -------------------------------------------------------------
let seededOk = true;
for (let d = 1; d <= 28; d++) {
  const dk = `2027-02-${String(d).padStart(2, "0")}`;
  const a = data.generateSeededNineRhymesPuzzle(dk, d);
  const b = data.generateSeededNineRhymesPuzzle(dk, d);
  if (JSON.stringify(a) !== JSON.stringify(b) || !data.validateNineRhymesPuzzle(a).valid) seededOk = false;
}
kit.assert(seededOk, "seeded fallback is deterministic + valid for 28 dates");
kit.assert(
  data.generateSeededNineRhymesPuzzle("2027-02-01", 1).starterWord !== undefined,
  "seeded puzzle has a starter"
);

// ---- daily engine ----------------------------------------------------------------
const dk = "2026-11-12";
const r1 = daily.getDailyPuzzleForGame("9-rhymes", dk);
kit.assert(r1 !== null && r1.origin === "bank", "daily engine resolves bank puzzle");
const override = { ...good, id: "9r-override", title: "Override" };
const r2 = daily.getDailyPuzzleForGame("9-rhymes", dk, { [dk]: override });
kit.assert(r2?.origin !== "bank" && (r2?.puzzle as { id: string }).id === "9r-override", "valid override wins");
const r3 = daily.getDailyPuzzleForGame("9-rhymes", dk, { [dk]: { junk: 1 } });
kit.assert(r3 !== null && data.validateNineRhymesPuzzle(r3.puzzle).valid, "invalid override ignored");

// ---- engine --------------------------------------------------------------------
const clue = { answer: "night", altSpellings: ["nite"], sentence: "x", hint: "y" };
kit.assert(eng.matchesAnswer("  NIGHT! ", clue), "match ignores case/punct/space");
kit.assert(eng.matchesAnswer("nite", clue), "alt spelling accepted");
kit.assert(!eng.matchesAnswer("light", clue) && !eng.matchesAnswer("", clue), "wrong/empty rejected");
kit.eq([eng.pointsForGuess(true, false), eng.pointsForGuess(true, true), eng.pointsForGuess(false, false)], [1, 0.5, 0], "scoring 1.0 / 0.5 / 0");
kit.eq(eng.formatBlanks(4), "_ _ _ _ (4 letters)", "blanks show exact letter count");
kit.assert(eng.renderPrompt(good.clues[0]).includes(`(${good.clues[0].answer.length} letters)`), "prompt has letter count");
kit.eq(eng.formatScore(7.5), "7.5", "format half score");
kit.eq(eng.formatScore(9), "9", "format whole score");
kit.eq(eng.HINT_COST_LABEL, "New hint (-0.5 pts)", "hint pill label");
kit.eq(eng.REVEAL_LABEL, "Reveal answer (0 pts)", "reveal pill label");

const results = [
  { outcome: "correct", guess: "a", hinted: false, points: 1 },
  { outcome: "correct", guess: "b", hinted: true, points: 0.5 },
  { outcome: "wrong", guess: "c", hinted: false, points: 0 },
  { outcome: "revealed", guess: "", hinted: true, points: 0 },
] as const;
kit.eq(eng.totalScore(results as never), 1.5, "totalScore sums points");
kit.eq(eng.buildReceiptEmojis(results as never), "🟩🟨⬜⬜⬜⬜⬜⬜⬜", "receipt emojis 🟩🟨⬜ with 9 tiles");
const tr0 = eng.buildTranscript(good, { results: [], currentHinted: false } as never);
kit.assert(tr0[0].text === `Here's today's word: ${good.starterWord.toUpperCase()}`, "intro bubble");
kit.assert(tr0.some((m: { kind: string }) => m.kind === "prompt"), "first prompt shown");
kit.eq(
  eng.getRhymeTargetForRound(good, 0),
  good.starterWord.toUpperCase(),
  "Round 1 rhymes with the starter word"
);
kit.eq(
  eng.getRhymeTargetForRound(good, 1),
  good.clues[0].answer.toUpperCase(),
  "Round 2 rhymes with Round 1's answer"
);
kit.assert(
  tr0[1]!.text.includes(`Word 1 of 9 · Rhymes with ${good.starterWord.toUpperCase()}`),
  "Round 1 prompt bubble shows 'Rhymes with <STARTER>'"
);
const full = Array.from({ length: 9 }, () => ({ outcome: "correct", guess: "x", hinted: false, points: 1 }));
const trF = eng.buildTranscript(good, { results: full, currentHinted: false } as never);
kit.assert(
  [1, 2, 3, 4, 5, 6, 7, 8].every((i) => {
    const promptMsg = trF.find((m: { id: string }) => m.id === `q${i}`);
    return Boolean(
      promptMsg &&
        promptMsg.text.includes(
          `Word ${i + 1} of 9 · The next word rhymes with ${good.clues[i - 1]!.answer.toUpperCase()}`
        )
    );
  }),
  "Rounds 2..9 prompt bubbles linearly say 'The next word rhymes with <previous word>'"
);
kit.assert(trF[trF.length - 1].text === "That's all 9! You scored 9 / 9 today.", "summary bubble");
const share = eng.buildShareText({ puzzleNumber: 12, results: full as never });
kit.assert(share.startsWith("9 Rhymes #12\n9 / 9\n"), "share text header + score");

// ---- creator draft ---------------------------------------------------------------
const rows = good.clues.map((c: { answer: string; sentence: string; hint: string }) => ({ answer: c.answer, altSpellings: "", sentence: c.sentence, hint: c.hint }));
const draft = eng.draftToPuzzle({ id: "9r-abcd1234", title: "", starterWord: good.starterWord, rows, creatorName: "Pal" });
kit.assert(draft.puzzle !== null && draft.errors.length === 0, "draftToPuzzle builds valid puzzle");
const bad = eng.draftToPuzzle({ id: "x", title: "", starterWord: good.starterWord, rows: rows.slice(0, 5), creatorName: "" });
kit.assert(bad.puzzle === null && bad.errors.length > 0, "draftToPuzzle reports errors");

// ---- wiring --------------------------------------------------------------------
kit.assert(cfg.isPlayableGameSlug("9-rhymes"), "9-rhymes isPlayable");
const comp = fs.readFileSync("src/components/games/nine-rhymes.tsx", "utf8");
for (const needle of ["readOnly", "HINT_COST_LABEL", "REVEAL_LABEL", "400", "mode", "ResultShareButtons", "GameSplashScreen", "Starter:", "Word "]) {
  kit.assert(comp.includes(needle), `component contains ${needle}`);
}
const btns = fs.readFileSync("src/components/games/result-share-buttons.tsx", "utf8");
kit.assert(btns.includes("nativeShareResultsOnly") && btns.includes("copyResultsOnly"), "Share + Copy use split helpers");
kit.assert(btns.includes("Copy results") && btns.includes("Share") && btns.includes("2000"), "Share/Copy labels + 2000ms");
const page = fs.readFileSync("src/app/games/9-rhymes/page.tsx", "utf8");
kit.assert(page.includes("GameErrorBoundary") && page.includes("Suspense"), "page wraps boundary + Suspense");
const admin = fs.readFileSync("src/app/admin/page.tsx", "utf8");
kit.assert(admin.includes("NineRhymesStudioTab"), "/admin has 9 Rhymes tab");
const archive = await import("@/app/games/[slug]/archive/page");
const params = await archive.generateStaticParams();
kit.assert(params.some((p: { slug: string }) => p.slug === "9-rhymes"), "archive static params include 9-rhymes");

kit.finish();
