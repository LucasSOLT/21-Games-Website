import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameLogo } from "../src/components/game-logo";
import {
  ALL_GAMES,
  PLAYABLE_GAMES,
  isPlayableGameSlug,
  getGameBySlug,
  type GameConfig,
} from "../src/lib/games-config";
import fs from "fs";
import path from "path";

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: unknown;
}

const results: TestResult[] = [];

function assert(condition: boolean, category: string, name: string, errorMsg?: string, details?: unknown) {
  if (condition) {
    results.push({ category, name, passed: true, details });
  } else {
    results.push({
      category,
      name,
      passed: false,
      error: errorMsg || "Assertion failed",
      details,
    });
  }
}

function testSection(name: string) {
  console.log(`\n=== RUNNING: ${name} ===`);
}

// ============================================================================
// SIGNATURES FOR EMPIRICAL VALIDATION
// ============================================================================
const SIGNATURES = {
  fallback: (html: string) => html.includes('x="12" y="12" width="56" height="56"') && html.length < 400,
  fourScore: (html: string) => html.includes('aria-label="Four Score logo"') && html.includes('cx="38" cy="35"') && html.includes('fill="#F9D423"'),
  connect: (html: string) => html.includes('aria-label="Connect 5 logo"') && html.includes('stroke-width="3.5"'),
  things: (html: string) => html.includes('aria-label="21 Things logo"') && html.includes('M35 11 L36.4 14'),
  syllables: (html: string) => html.includes('aria-label="17 Syllables logo"') && html.includes('M53 47 L66 51'),
  rhymes: (html: string) => html.includes('aria-label="9 Rhymes logo"') && html.includes('M 18 16 H 56 C 62 16'),
  echo: (html: string) => html.includes('aria-label="Eightfold Echo logo"') && html.includes('stroke="#EC4899"'),
  sixPics: (html: string) => html.includes('aria-label="6 Pics logo"') && html.includes('M33.5 27 L39 14.5'),
  win: (html: string) => html.includes('aria-label="1 Win logo"') && html.includes('M 33 10 L 35 6.5'),
  move2: (html: string) => html.includes('aria-label="Move Two logo"') && html.includes('fill="#EF4444"'),
};

// ============================================================================
// TEST SUITE 1: GameLogo Rendering & Edge Cases
// ============================================================================
testSection("1. GameLogo Rendering & Edge Cases");

// 1.1 Unknown logo keys fallback safely without crashing
const unknownKeys = [
  "completely-unknown-key-9999",
  "xyz",
  "foo-bar-baz",
  "<script>alert('xss')</script>",
  "' OR '1'='1' --",
  "🎮🎲🎯",
  "A".repeat(5000), // extreme length stress
  "???!!!###$$$",
  "12345",
];

for (const key of unknownKeys) {
  try {
    const markup = renderToStaticMarkup(React.createElement(GameLogo, { logo: key }));
    const isFallback = SIGNATURES.fallback(markup);
    const hasRoleImg = markup.includes('role="img"');
    assert(
      isFallback && hasRoleImg,
      "GameLogo Edge Cases",
      `Unknown key fallback: ${key.slice(0, 30)}`,
      `Expected fallback SVG, got length ${markup.length}`
    );
  } catch (err) {
    assert(false, "GameLogo Edge Cases", `Unknown key fallback: ${key.slice(0, 30)}`, `Threw error: ${err}`);
  }
}

// 1.2 Empty, whitespace, undefined, null
const emptyInputs = [
  { desc: "empty string", props: { logo: "" } },
  { desc: "spaces string", props: { logo: "   " } },
  { desc: "tabs/newlines string", props: { logo: "\t\n\r  " } },
  { desc: "empty game object", props: { game: {} as unknown as GameConfig } },
  { desc: "game with empty strings", props: { game: { name: "", slug: "", logo: "" } as unknown as GameConfig } },
  { desc: "game with whitespace", props: { game: { name: "  ", slug: " \t ", logo: " \n " } as unknown as GameConfig } },
  { desc: "no props provided", props: {} },
];

for (const input of emptyInputs) {
  try {
    const markup = renderToStaticMarkup(React.createElement(GameLogo, input.props));
    const isFallback = SIGNATURES.fallback(markup);
    assert(
      isFallback,
      "GameLogo Edge Cases",
      `Falsy/empty input: ${input.desc}`,
      `Expected safe fallback SVG, got length: ${markup.length}`
    );
  } catch (err) {
    assert(false, "GameLogo Edge Cases", `Falsy/empty input: ${input.desc}`, `Threw error: ${err}`);
  }
}

// 1.3 Case insensitivity and whitespace trimming for canonical games
const caseTrimTests = [
  { input: "  FOUR-SCORE  ", validator: SIGNATURES.fourScore, emblem: "Four Score" },
  { input: "four-score\n\t", validator: SIGNATURES.fourScore, emblem: "Four Score" },
  { input: "Four Score", validator: SIGNATURES.fourScore, emblem: "Four Score" },
  { input: "  fOuR-ScOrE  ", validator: SIGNATURES.fourScore, emblem: "Four Score" },
  { input: "CONNECT-5", validator: SIGNATURES.connect, emblem: "Connect 5" },
  { input: "  Connect 5  ", validator: SIGNATURES.connect, emblem: "Connect 5" },
  { input: "21-THINGS", validator: SIGNATURES.things, emblem: "21 Things" },
  { input: "  21 Things  ", validator: SIGNATURES.things, emblem: "21 Things" },
  { input: "17-SYLLABLES", validator: SIGNATURES.syllables, emblem: "17 Syllables" },
  { input: " 17 Syllables ", validator: SIGNATURES.syllables, emblem: "17 Syllables" },
  { input: "9-RHYMES", validator: SIGNATURES.rhymes, emblem: "9 Rhymes" },
  { input: " 9 Rhymes ", validator: SIGNATURES.rhymes, emblem: "9 Rhymes" },
  { input: "EIGHTFOLD-ECHO", validator: SIGNATURES.echo, emblem: "Eightfold Echo" },
  { input: " Eightfold Echo ", validator: SIGNATURES.echo, emblem: "Eightfold Echo" },
  { input: "6-PICS", validator: SIGNATURES.sixPics, emblem: "6 Pics" },
  { input: "  6 Pics  ", validator: SIGNATURES.sixPics, emblem: "6 Pics" },
  { input: "1-WIN", validator: SIGNATURES.win, emblem: "1 Win" },
  { input: "  1 Win  ", validator: SIGNATURES.win, emblem: "1 Win" },
  { input: "MOVE-2", validator: SIGNATURES.move2, emblem: "Move Two" },
  { input: "  Move 2  ", validator: SIGNATURES.move2, emblem: "Move Two" },
];

for (const test of caseTrimTests) {
  try {
    const markup = renderToStaticMarkup(React.createElement(GameLogo, { logo: test.input }));
    const matchesEmblem = test.validator(markup);
    assert(
      matchesEmblem,
      "GameLogo Case & Trim",
      `Case/trim normalization for '${test.input.replace(/[\n\t]/g, " ")}' (${test.emblem})`,
      `Markup failed signature for ${test.emblem}`
    );
  } catch (err) {
    assert(false, "GameLogo Case & Trim", `Case/trim normalization for '${test.input}'`, `Threw error: ${err}`);
  }
}

// 1.4 Legacy and Alias Keys
const legacyAliasTests = [
  { key: "the-11th-hour", validator: SIGNATURES.fourScore, desc: "legacy 'the-11th-hour' maps to Four Score" },
  { key: "11th-hour", validator: SIGNATURES.fourScore, desc: "legacy '11th-hour' maps to Four Score" },
  { key: "THE-11TH-HOUR", validator: SIGNATURES.fourScore, desc: "uppercase 'THE-11TH-HOUR' maps to Four Score" },
  { key: "letter", validator: SIGNATURES.fourScore, desc: "legacy 'letter' maps to Four Score" },
  { key: "score", validator: SIGNATURES.fourScore, desc: "alias 'score' maps to Four Score" },
  { key: "fourscore", validator: SIGNATURES.fourScore, desc: "alias 'fourscore' maps to Four Score" },
  { key: "move2", validator: SIGNATURES.move2, desc: "alias 'move2' maps to Move Two" },
  { key: "6pics", validator: SIGNATURES.sixPics, desc: "alias '6pics' maps to 6 Pics" },
];

for (const test of legacyAliasTests) {
  try {
    const markup = renderToStaticMarkup(React.createElement(GameLogo, { logo: test.key }));
    const matched = test.validator(markup);
    assert(matched, "GameLogo Legacy Aliases", test.desc, `Markup failed signature`);
  } catch (err) {
    assert(false, "GameLogo Legacy Aliases", test.desc, `Threw error: ${err}`);
  }
}

// 1.5 Adversarial Edge Case: The "Move Two" name matching probe
// In ALL_GAMES, Move Two has name: "Move Two", slug: "move-2", logo: "move-2".
// What if someone passes game={{ name: "Move Two" }} without logo or slug, or logo="Move Two"?
{
  const nameOnlyMarkup = renderToStaticMarkup(
    React.createElement(GameLogo, { game: { name: "Move Two" } as unknown as GameConfig })
  );
  const matchedDomino = SIGNATURES.move2(nameOnlyMarkup);
  // We document that name-only probe without slug/logo triggers fallback:
  assert(
    !matchedDomino,
    "GameLogo Adversarial Probe",
    "Adversarial probe: game={{ name: 'Move Two' }} (name-only without slug/logo)",
    "Fails to resolve 'Move Two' name to 'move-2' because normalizeLogoKey lacks 'move-two' case; safely renders fallback",
    { fallsBackSafely: SIGNATURES.fallback(nameOnlyMarkup) }
  );

  // But when ALL_GAMES game config is passed (as on homepage), it resolves cleanly:
  const move2Game = ALL_GAMES.find((g) => g.slug === "move-2");
  const canonicalMarkup = renderToStaticMarkup(React.createElement(GameLogo, { game: move2Game }));
  assert(
    SIGNATURES.move2(canonicalMarkup),
    "GameLogo Canonical Games",
    "Canonical ALL_GAMES[move-2] renders Move Two 3D domino emblem",
    "Failed to render Move Two emblem from canonical game config"
  );
}

// 1.6 Size and Variant Props
const variantTests = [
  { variant: "featured" as const, expectedSize: 'width="84" height="84"' },
  { variant: "default" as const, expectedSize: 'width="72" height="72"' },
  { variant: "mini" as const, expectedSize: 'width="28" height="28"' },
  { size: "mini" as const, expectedSize: 'width="28" height="28"' },
  { variant: "invalid" as unknown as "default", expectedSize: 'width="72" height="72"' },
];

for (const vt of variantTests) {
  const markup = renderToStaticMarkup(
    React.createElement(GameLogo, { logo: "four-score", variant: vt.variant, size: vt.size })
  );
  const hasSize = markup.includes(vt.expectedSize);
  assert(
    hasSize,
    "GameLogo Dimensions",
    `Variant/size probe: ${vt.variant ?? vt.size}`,
    `Expected '${vt.expectedSize}' in markup, got: ${markup.slice(0, 60)}`
  );
}

// ============================================================================
// TEST SUITE 2: PLAYABLE_GAMES & ALL_GAMES Invariants
// ============================================================================
testSection("2. PLAYABLE_GAMES & ALL_GAMES Invariants");

// 2.1 ALL_GAMES length
assert(
  ALL_GAMES.length === 9,
  "Lineup Invariants",
  "ALL_GAMES has exactly 9 games",
  `Expected 9, got ${ALL_GAMES.length}`
);

// 2.2 Strict countdown order: 21, 17, 9, 8, 6, 5, 4, 2, 1
const expectedOrder = [
  { slug: "21-things", expectedNum: 21, name: "21 Things" },
  { slug: "17-syllables", expectedNum: 17, name: "17 Syllables" },
  { slug: "9-rhymes", expectedNum: 9, name: "9 Rhymes" },
  { slug: "eightfold-echo", expectedNum: 8, name: "Eightfold Echo" },
  { slug: "6-pics", expectedNum: 6, name: "6 Pics" },
  { slug: "connect-5", expectedNum: 5, name: "Connect 5" },
  { slug: "four-score", expectedNum: 4, name: "Four Score" },
  { slug: "move-2", expectedNum: 2, name: "Move Two" },
  { slug: "1-win", expectedNum: 1, name: "1 Win" },
];

for (let i = 0; i < expectedOrder.length; i++) {
  const expected = expectedOrder[i];
  const actual = ALL_GAMES[i];
  assert(
    actual && actual.slug === expected.slug,
    "Countdown Order",
    `Position ${i + 1} is #${expected.expectedNum} (${expected.name})`,
    `Expected slug '${expected.slug}', got '${actual?.slug}' at index ${i}`
  );
}

// 2.3 PLAYABLE_GAMES invariants
assert(
  PLAYABLE_GAMES.length === 3,
  "Playable Invariants",
  "PLAYABLE_GAMES has exactly 3 games (17 Syllables went live after M1-B1)",
  `Expected 3, got ${PLAYABLE_GAMES.length}`
);

const playableSlugs = PLAYABLE_GAMES.map((g) => g.slug).sort();
assert(
  JSON.stringify(playableSlugs) === JSON.stringify(["17-syllables", "21-things", "connect-5"]),
  "Playable Invariants",
  "PLAYABLE_GAMES contains only '17-syllables', '21-things' and 'connect-5'",
  `Got: ${JSON.stringify(playableSlugs)}`
);

// 2.4 Verify all other 6 games are NOT playable
const nonPlayableSlugs = [
  "9-rhymes",
  "eightfold-echo",
  "6-pics",
  "four-score",
  "move-2",
  "1-win",
];

for (const slug of nonPlayableSlugs) {
  const game = getGameBySlug(slug);
  assert(
    game !== undefined && game.isPlayable === false,
    "Playable Invariants",
    `Game '${slug}' has isPlayable === false`,
    `Expected isPlayable === false, got: ${game?.isPlayable}`
  );
}

// 2.5 isPlayableGameSlug function validation
assert(
  isPlayableGameSlug("21-things") === true,
  "Slug Predicate",
  "isPlayableGameSlug('21-things') === true"
);
assert(
  isPlayableGameSlug("17-syllables") === true,
  "Slug Predicate",
  "isPlayableGameSlug('17-syllables') === true"
);
assert(
  isPlayableGameSlug("connect-5") === true,
  "Slug Predicate",
  "isPlayableGameSlug('connect-5') === true"
);
assert(
  isPlayableGameSlug("four-score") === false,
  "Slug Predicate",
  "isPlayableGameSlug('four-score') === false"
);
assert(
  isPlayableGameSlug("the-11th-hour") === false,
  "Slug Predicate",
  "isPlayableGameSlug('the-11th-hour') === false"
);
for (const slug of nonPlayableSlugs) {
  assert(
    isPlayableGameSlug(slug) === false,
    "Slug Predicate",
    `isPlayableGameSlug('${slug}') === false`
  );
}
assert(
  isPlayableGameSlug("") === false,
  "Slug Predicate",
  "isPlayableGameSlug('') === false"
);
assert(
  isPlayableGameSlug("random-slug") === false,
  "Slug Predicate",
  "isPlayableGameSlug('random-slug') === false"
);

// 2.6 getGameBySlug checks
assert(
  getGameBySlug("the-11th-hour") === undefined,
  "Game Lookup",
  "getGameBySlug('the-11th-hour') === undefined"
);
assert(
  getGameBySlug("four-score")?.name === "Four Score",
  "Game Lookup",
  "getGameBySlug('four-score') returns Four Score"
);
assert(
  getGameBySlug("four-score")?.tagline === "Reach 80 math puzzle",
  "Game Metadata",
  "Four Score tagline is 'Reach 80 math puzzle'"
);

// 2.7 Uniqueness
const slugs = ALL_GAMES.map((g) => g.slug);
assert(new Set(slugs).size === 9, "Uniqueness", "All 9 game slugs are mutually unique");
const names = ALL_GAMES.map((g) => g.name);
assert(new Set(names).size === 9, "Uniqueness", "All 9 game names are mutually unique");

// ============================================================================
// TEST SUITE 3: Codebase Dangling References to 'the-11th-hour'
// ============================================================================
testSection("3. Absence of Dangling References to 'the-11th-hour'");

function scanDirectory(dir: string, fileList: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next" && entry.name !== ".git" && entry.name !== "out") {
        scanDirectory(fullPath, fileList);
      }
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") || entry.name.endsWith(".js") || entry.name.endsWith(".json"))
    ) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const srcDir = path.resolve(import.meta.dirname, "../src");
const allSrcFiles = scanDirectory(srcDir);

const danglingRefHits: { file: string; line: number; content: string }[] = [];

for (const filePath of allSrcFiles) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("the-11th-hour") || line.includes("11th-hour") || line.toLowerCase().includes("11th hour")) {
      // Exclude intentional backward-compatibility case in game-logo.tsx
      if (filePath.endsWith("game-logo.tsx") && (line.includes("case \"the-11th-hour\":") || line.includes("case \"11th-hour\":"))) {
        continue;
      }
      danglingRefHits.push({
        file: path.relative(path.resolve(import.meta.dirname, ".."), filePath),
        line: i + 1,
        content: line.trim(),
      });
    }
  }
}

assert(
  danglingRefHits.length === 0,
  "Dangling References",
  "No dangling references to 'the-11th-hour' in active src/ code paths",
  `Found ${danglingRefHits.length} dangling reference(s)`,
  danglingRefHits
);

// Check if any file/folder in src is named with 11th
const namedWith11th = allSrcFiles.filter((f) => f.includes("11th") || f.includes("eleven"));
assert(
  namedWith11th.length === 0,
  "Dangling Files",
  "No files or folders named with 11th in src/",
  `Found files: ${JSON.stringify(namedWith11th)}`
);

// ============================================================================
// TEST SUMMARY & METRICS
// ============================================================================
console.log("\n=================== TEST SUMMARY ===================");
const passedCount = results.filter((r) => r.passed).length;
const failedCount = results.filter((r) => !r.passed).length;
console.log(`Total Tests Run : ${results.length}`);
console.log(`Passed          : ${passedCount}`);
console.log(`Failed          : ${failedCount}`);

if (failedCount > 0) {
  console.log("\nFAILED TESTS DETAILS:");
  for (const r of results.filter((r) => !r.passed)) {
    console.log(`- [${r.category}] ${r.name}`);
    console.log(`  Error: ${r.error}`);
    if (r.details) console.log(`  Details: ${JSON.stringify(r.details)}`);
  }
}

const criticalFailures = results.filter((r) => !r.passed);
if (criticalFailures.length > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
