/**
 * Checkpoint 2 — multi-game hub, daily engine, AI helper, custom links, migration.
 * Run: node --experimental-strip-types scripts/test-cp02-multigame.ts
 */
import fs from "node:fs";
import { register } from "node:module";
import { createKit } from "./test-kit.mjs";

register("./test-resolver.mjs", import.meta.url);

const kit = createKit("CP2: multi-game infra");

const cfg = await import("@/lib/games-config");
const engine = await import("@/lib/daily-engine");
const sources = await import("@/lib/puzzle-sources");
const share = await import("@/lib/custom-game-share");
const ai = await import("@/lib/ai-helper");
const fam = await import("@/data/rhyme-families");
const mod = await import("@/lib/moderation");

// ---- slug config -----------------------------------------------------------------
kit.eq(
  [...cfg.ALL_GAME_SLUGS],
  ["21-things", "17-syllables", "9-rhymes", "eightfold-echo", "6-pics", "connect-5", "four-score", "move-2", "1-win"],
  "all 9 slugs in 21 -> 1 order"
);
kit.eq(
  cfg.ALL_GAME_SLUGS.map((s: string) => cfg.GAME_COUNTDOWN_NUMBER[s as keyof typeof cfg.GAME_COUNTDOWN_NUMBER]),
  [21, 17, 9, 8, 6, 5, 4, 2, 1],
  "countdown numbers"
);
for (const slug of cfg.ALL_GAME_SLUGS) {
  kit.assert(Boolean(cfg.GAME_PROGRESS_PREFIX[slug]), `${slug} has a progress prefix`);
  kit.assert(/^#[0-9a-fA-F]{6}$/.test(cfg.GAME_ACCENT_HEX[slug]), `${slug} accent is hex`);
}
kit.assert(cfg.getPlayableGameSlugs().includes("17-syllables"), "17-syllables is playable (archive route generated)");
kit.assert(cfg.isPlayableGameSlug("21-things") && cfg.isPlayableGameSlug("connect-5"), "21t + c5 playable");
kit.assert(!cfg.isPlayableGameSlug("not-a-game"), "unknown slug is not playable");

// ---- getDailyPuzzleForGame -------------------------------------------------------
for (const slug of ["21-things", "17-syllables", "connect-5"] as const) {
  const dk = "2026-11-12";
  const a = engine.getDailyPuzzleForGame(slug, dk);
  const b = engine.getDailyPuzzleForGame(slug, dk);
  kit.assert(a !== null, `${slug}: resolves a puzzle`);
  kit.eq(a?.puzzle, b?.puzzle, `${slug}: deterministic for same date`);
  kit.assert(a?.origin === "bank", `${slug}: bank origin when no override`);

  // Invalid override must be ignored (never a blank screen)
  const bad = engine.getDailyPuzzleForGame(slug, dk, { [dk]: { garbage: true } });
  kit.assert(bad !== null && bad.origin !== "override", `${slug}: invalid override ignored`);

  // Seeded fallback is deterministic and validates
  const src = sources.getPuzzleSource(slug)!;
  const s1 = src.generateSeeded(dk);
  const s2 = src.generateSeeded(dk);
  kit.eq(s1, s2, `${slug}: seeded fallback deterministic`);
  kit.assert(src.validate(s1), `${slug}: seeded fallback passes validation`);
}
kit.assert(engine.getDailyPuzzleForGame("1-win", "2026-11-12") === null || true, "unregistered games do not throw");

// ---- archive ---------------------------------------------------------------------
for (const slug of ["21-things", "17-syllables", "connect-5"] as const) {
  const entries = engine.getArchiveEntriesForGame(slug, 60, new Date("2026-11-12T12:00:00"));
  kit.eq(entries.length, 60, `${slug}: 60-day archive`);
  kit.assert(entries[0]!.dateKey === "2026-11-12", `${slug}: archive starts today`);
  kit.assert(new Set(entries.map((e: { dateKey: string }) => e.dateKey)).size === 60, `${slug}: unique dates`);
}

// ---- custom short links ----------------------------------------------------------
for (const slug of Object.keys(cfg.CUSTOM_LINK_PREFIX) as Array<keyof typeof cfg.CUSTOM_LINK_PREFIX>) {
  const id = share.generateCustomGameId(slug);
  kit.assert(share.isValidCustomGameId(id), `${slug}: generated id valid (${id})`);
  kit.eq(share.getGameSlugFromCustomId(id), slug, `${slug}: id maps back to slug`);
  const url = share.buildCustomGameShareUrl(slug, id);
  kit.assert(url.length < 75, `${slug}: share URL < 75 chars (${url.length})`);
  kit.assert(url.endsWith(`?b=${id}`), `${slug}: share URL carries ?b=`);
}
kit.assert(!share.isValidCustomGameId("zz-12345678"), "unknown prefix rejected");
kit.assert(!share.isValidCustomGameId("21t-SHORT"), "malformed id rejected");
kit.assert(share.generateCustomGameId("9-rhymes").startsWith("9r-"), "9r- prefix");
kit.assert(share.generateCustomGameId("6-pics").startsWith("6p-"), "6p- prefix");

// ---- moderation surface wrapper --------------------------------------------------
kit.assert(mod.moderateText("have a great day", "public").allowed, "clean text allowed publicly");
kit.assert(mod.moderateText("this is shit", "private_custom").allowed, "casual swearing allowed in private custom games");
kit.assert(!mod.moderateText("this is shit", "public").allowed, "casual swearing blocked on public surfaces");

// ---- AI helper (no keys => local) ------------------------------------------------
kit.eq(ai.resolveAIProvider({ preferredProvider: "gemini" }), process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY ? "gemini" : "local", "no key => local provider");
kit.eq(ai.resolveAIProvider({ geminiApiKey: "k" }), "gemini", "gemini default when key present");
kit.eq(ai.resolveAIProvider({ geminiApiKey: "k", openRouterApiKey: "o", preferredProvider: "openrouter" }), "openrouter", "openrouter toggle");
kit.eq(ai.resolveAIProvider({ geminiApiKey: "k", preferredProvider: "local" }), "local", "local forced");

const localCfg = { preferredProvider: "local" as const };
const syn = await ai.generate6PicsSynonyms("Ocean", localCfg);
kit.assert(syn.includes("sea") && !syn.includes("ocean"), "6pics synonyms local thesaurus", syn.join(","));
const syn2 = await ai.generate6PicsSynonyms("ice cream", localCfg);
kit.assert(syn2.includes("icecream") && syn2.includes("ice creams"), "6pics synonyms handle spaces/plurals", syn2.join(","));
kit.eq(await ai.generate6PicsSynonyms("Ocean", localCfg), syn, "6pics synonyms deterministic");

const chain = await ai.suggest9RhymesChain("night", localCfg);
kit.eq(chain.clues.length, 9, "9 rhymes chain has 9 clues");
kit.assert(new Set(chain.clues.map((c: { answer: string }) => c.answer)).size === 9, "9 distinct answers");
const nightFam = fam.findRhymeFamilyForWord("night")!;
kit.assert(
  chain.clues.every((c: { answer: string; sentence: string }) =>
    nightFam.entries.some((e: { word: string }) => e.word === c.answer) && !c.sentence.toLowerCase().includes(c.answer)
  ),
  "all answers rhyme with starter and never leak in the sentence"
);
const chain2 = await ai.suggest9RhymesChain("tonight", localCfg);
kit.eq(chain2.clues.length, 9, "unknown starter maps to closest family by ending");
kit.eq(await ai.suggest9RhymesChain("night", localCfg), chain, "9 rhymes chain deterministic");

for (const theme of ["winter morning", "ocean waves", "city lights", "love", "random thing"]) {
  const h = await ai.generateHaikuDraft(theme, localCfg);
  kit.eq(h.map((l: string) => ai.countSyllables(l)), [5, 7, 5], `haiku draft 5-7-5 for "${theme}"`);
  kit.eq(await ai.generateHaikuDraft(theme, localCfg), h, `haiku deterministic for "${theme}"`);
}
for (const { line, syllables } of ai.getHaikuBankLines()) {
  kit.eq(ai.countSyllables(line), syllables, `bank line "${line}" = ${syllables}`);
}

// ---- mocked remote providers fall back / validate --------------------------------
const okGemini = (async () =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ synonyms: ["Brine", "deep"] }) }] } }] }), { status: 200 })) as unknown as typeof fetch;
const aiSyn = await ai.generate6PicsSynonyms("Ocean", { geminiApiKey: "k", fetchImpl: okGemini });
kit.assert(aiSyn.includes("brine") && aiSyn.includes("sea"), "gemini synonyms merged with local", aiSyn.join(","));
const failing = (async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
kit.eq(await ai.generate6PicsSynonyms("Ocean", { geminiApiKey: "k", fetchImpl: failing }), syn, "429 => local fallback");
const throwing = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
kit.eq(await ai.suggest9RhymesChain("night", { openRouterApiKey: "o", fetchImpl: throwing }), chain, "network error => local fallback");
const junk = (async () =>
  new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), { status: 200 })) as unknown as typeof fetch;
kit.eq(await ai.generateHaikuDraft("winter", { openRouterApiKey: "o", fetchImpl: junk }), ai.localHaikuDraft("winter"), "junk => local haiku");

// ---- rhyme dictionary sanity -----------------------------------------------------
kit.assert(fam.RHYME_FAMILIES.length >= 40, `>= 40 rhyme families (${fam.RHYME_FAMILIES.length})`);
const usable = fam.RHYME_FAMILIES.filter((f: { entries: unknown[] }) => f.entries.length >= 10);
kit.assert(usable.length >= 34, `>= 34 families with 10+ words (${usable.length})`);
const allWords = new Set<string>();
let dupes = 0;
for (const f of fam.RHYME_FAMILIES) for (const e of f.entries) { if (allWords.has(e.word)) dupes++; allWords.add(e.word); }
kit.eq(dupes, 0, "no word appears in two families");
kit.assert(
  fam.RHYME_FAMILIES.every((f: { entries: Array<{ word: string; clue: string }> }) =>
    f.entries.every((e) => /^[a-z]+$/.test(e.word) && !e.clue.toLowerCase().includes(e.word))
  ),
  "dictionary words are alpha-only and clues never contain the answer"
);

// ---- SQL migration + schema ------------------------------------------------------
const mig = fs.readFileSync("supabase/migrations/20261112000001_custom_puzzles_and_all_game_stats.sql", "utf8");
const schema = fs.readFileSync("supabase/schema.sql", "utf8");
for (const [name, sql] of [["migration", mig], ["schema.sql", schema]] as const) {
  kit.assert(sql.includes("create table if not exists public.custom_puzzles"), `${name}: custom_puzzles table`);
  kit.assert(sql.includes("alter table public.custom_puzzles enable row level security"), `${name}: RLS enabled on custom_puzzles`);
  kit.assert(sql.includes("revoke all on table public.custom_puzzles from anon, authenticated"), `${name}: default privileges reset`);
  kit.assert(sql.includes("custom_puzzles_delete_gm_only") && sql.includes("is_root_game_master()"), `${name}: GM-only delete`);
  kit.assert(sql.includes("creator_id = auth.uid()") && sql.includes("not public.is_current_user_banned()"), `${name}: insert own + not banned`);
  kit.assert(!/grant (insert|update)[^;]*on table public\.custom_puzzles[^;]*anon/.test(sql), `${name}: anon cannot write`);
  kit.assert(sql.includes("grant update (all_game_stats) on table public.user_profiles to authenticated"), `${name}: all_game_stats update grant`);
  kit.assert(/all_game_stats jsonb not null default '\{\}'::jsonb/.test(sql), `${name}: all_game_stats column`);
  kit.assert(!/grant update \([^)]*\b(role|is_banned|email)\b[^)]*\)/.test(sql), `${name}: sensitive profile columns not granted`);
}
kit.assert(schema.includes("enforce_user_profile_security"), "schema keeps enforce_user_profile_security trigger");
for (const slug of cfg.ALL_GAME_SLUGS) kit.assert(schema.includes(`'${slug}'`), `schema constraint mentions ${slug}`);

// ---- source wiring ---------------------------------------------------------------
const archivePage = fs.readFileSync("src/app/games/[slug]/archive/page.tsx", "utf8");
kit.assert(archivePage.includes("getPlayableGameSlugs()"), "archive generateStaticParams driven by playable slugs");
const shell = fs.readFileSync("src/components/game-shell.tsx", "utf8");
const archiveComp = fs.readFileSync("src/components/game-archive.tsx", "utf8");
kit.assert(
  !shell.includes("playableSlugs.map") && !archiveComp.includes("playableSlugs.map") && shell.includes("getGameHelp"),
  "top game-switcher pill bar removed from game-shell & game-archive; help driven by config"
);
const boundary = fs.readFileSync("src/components/game-error-boundary.tsx", "utf8");
kit.assert(boundary.includes("GAME_PROGRESS_PREFIX") && boundary.includes("AllGameSlug"), "error boundary generic over all games");
const auth = fs.readFileSync("src/lib/user-auth.ts", "utf8");
kit.assert(/INITIAL_GAME_MASTERS[^=]*=\s*\[\s*"lucas@soltheory\.com",\s*"steve@soltheory\.com",?\s*\]/.test(auth), "INITIAL_GAME_MASTERS unchanged");

kit.finish();
