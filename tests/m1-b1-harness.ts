import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ALL_GAMES,
  PLAYABLE_GAMES,
  getGameBySlug,
  isPlayableGameSlug,
  type GameConfig,
} from "../src/lib/games-config";
import { GameLogo } from "../src/components/game-logo";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: unknown;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, failureDetails?: unknown) {
  if (condition) {
    results.push({ name: testName, passed: true });
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    const errorMsg = `Assertion failed: ${testName}`;
    results.push({
      name: testName,
      passed: false,
      error: errorMsg,
      details: failureDetails,
    });
    console.error(`  ✗ FAIL: ${testName}`, failureDetails ?? "");
  }
}

console.log("===============================================================");
console.log("       EMPIRICAL CHALLENGER HARNESS: MILESTONE M1-B1          ");
console.log("===============================================================\n");

// --------------------------------------------------------------------------
// SUITE 1: ALL_GAMES Catalog Integrity & Countdown Sequence
// --------------------------------------------------------------------------
console.log("Suite 1: ALL_GAMES Catalog Integrity & Countdown Sequence");

assert(Array.isArray(ALL_GAMES), "ALL_GAMES is an array");
assert(ALL_GAMES.length === 9, `ALL_GAMES has exact length 9 (actual: ${ALL_GAMES.length})`);

const expectedCountdown = [
  { rank: 21, slug: "21-things", name: "21 Things", color: "customPurple2", logo: "things", isPlayable: true },
  { rank: 17, slug: "17-syllables", name: "17 Syllables", color: "green", logo: "syllables", isPlayable: true },
  { rank: 9, slug: "9-rhymes", name: "9 Rhymes", color: "customYellow2", logo: "rhymes", isPlayable: false },
  { rank: 8, slug: "eightfold-echo", name: "Eightfold Echo", color: "customPurple2", logo: "echo", isPlayable: false },
  { rank: 6, slug: "6-pics", name: "6 Pics", color: "customF4D621", logo: "6-pics", isPlayable: false },
  { rank: 5, slug: "connect-5", name: "Connect 5", color: "grey", logo: "connect", isPlayable: true },
  { rank: 4, slug: "four-score", name: "Four Score", color: "yellow", logo: "four-score", isPlayable: false },
  { rank: 2, slug: "move-2", name: "Move Two", color: "green", logo: "move-2", isPlayable: false },
  { rank: 1, slug: "1-win", name: "1 Win", color: "grey", logo: "win", isPlayable: false },
];

const actualSlugs = ALL_GAMES.map((g) => g.slug);
const expectedSlugs = expectedCountdown.map((g) => g.slug);

assert(
  JSON.stringify(actualSlugs) === JSON.stringify(expectedSlugs),
  `Strict countdown slug ordering: 21 → 17 → 9 → 8 → 6 → 5 → 4 → 2 → 1`,
  { actual: actualSlugs, expected: expectedSlugs }
);

// Verify no duplicate slugs
const uniqueSlugs = new Set(actualSlugs);
assert(uniqueSlugs.size === 9, "All 9 slugs in ALL_GAMES are unique");

// Verify obsolete game "the-11th-hour" is completely absent
assert(
  !actualSlugs.includes("the-11th-hour"),
  "Legacy game 'the-11th-hour' is removed from ALL_GAMES"
);

// Verify each game matches expected specifications
expectedCountdown.forEach((exp, idx) => {
  const actual = ALL_GAMES[idx];
  assert(
    actual.name === exp.name,
    `Game #${exp.rank} name matches '${exp.name}' (actual: '${actual?.name}')`
  );
  assert(
    actual.color === exp.color,
    `Game #${exp.rank} color matches '${exp.color}' (actual: '${actual?.color}')`
  );
  assert(
    actual.logo === exp.logo,
    `Game #${exp.rank} logo key matches '${exp.logo}' (actual: '${actual?.logo}')`
  );
  assert(
    actual.isPlayable === exp.isPlayable,
    `Game #${exp.rank} isPlayable is ${exp.isPlayable} (actual: ${actual?.isPlayable})`
  );
  assert(
    typeof actual.tagline === "string" && actual.tagline.length > 5,
    `Game #${exp.rank} tagline is non-empty editorial string: "${actual?.tagline}"`
  );
  assert(
    typeof actual.description === "string" && actual.description.length > 10,
    `Game #${exp.rank} description is substantive editorial string: "${actual?.description}"`
  );
});

// --------------------------------------------------------------------------
// SUITE 2: Playable Games & Helper Functions
// --------------------------------------------------------------------------
console.log("\nSuite 2: Playable Games & Helper Functions");

assert(
  PLAYABLE_GAMES.length === 3,
  `PLAYABLE_GAMES has exact length 3 (actual: ${PLAYABLE_GAMES.length})`
);

const playableSlugs = PLAYABLE_GAMES.map((g) => g.slug);
assert(
  playableSlugs.includes("21-things") &&
    playableSlugs.includes("17-syllables") &&
    playableSlugs.includes("connect-5"),
  `PLAYABLE_GAMES includes exactly '21-things', '17-syllables', and 'connect-5'`,
  playableSlugs
);

assert(
  isPlayableGameSlug("21-things") === true,
  "isPlayableGameSlug('21-things') returns true"
);
assert(
  isPlayableGameSlug("17-syllables") === true,
  "isPlayableGameSlug('17-syllables') returns true"
);
assert(
  isPlayableGameSlug("connect-5") === true,
  "isPlayableGameSlug('connect-5') returns true"
);
assert(
  isPlayableGameSlug("four-score") === false,
  "isPlayableGameSlug('four-score') returns false"
);
assert(
  isPlayableGameSlug("the-11th-hour") === false,
  "isPlayableGameSlug('the-11th-hour') returns false"
);

assert(
  getGameBySlug("four-score")?.name === "Four Score",
  "getGameBySlug('four-score') returns Four Score GameConfig"
);
assert(
  getGameBySlug("the-11th-hour") === undefined,
  "getGameBySlug('the-11th-hour') returns undefined"
);

// --------------------------------------------------------------------------
// SUITE 3: Four Score (#4) Exact Configuration & Properties
// --------------------------------------------------------------------------
console.log("\nSuite 3: Four Score (#4) Configuration & Properties");

const fourScore = ALL_GAMES.find((g) => g.slug === "four-score");
assert(Boolean(fourScore), "Four Score exists in ALL_GAMES");

if (fourScore) {
  assert(fourScore.id === "four-score", `Four Score id is 'four-score' (actual: '${fourScore.id}')`);
  assert(fourScore.name === "Four Score", `Four Score name is 'Four Score'`);
  assert(fourScore.slug === "four-score", `Four Score slug is 'four-score'`);
  assert(fourScore.color === "yellow", `Four Score color is 'yellow'`);
  assert(fourScore.logo === "four-score", `Four Score logo key is 'four-score'`);
  assert(fourScore.showCreate === false, `Four Score showCreate is false`);
  assert(fourScore.isPlayable === false, `Four Score isPlayable is false`);
  assert(
    fourScore.tagline === "Reach 80 math puzzle",
    `Four Score tagline is exact: '${fourScore.tagline}'`
  );
  assert(
    fourScore.description ===
      "Combine four numbers with basic arithmetic and squares to hit the target score of 80.",
    `Four Score description is exact: '${fourScore.description}'`
  );
  assert(
    ALL_GAMES[6] === fourScore,
    `Four Score occupies position index 6 in ALL_GAMES (7th game, rank #4)`
  );
}

// --------------------------------------------------------------------------
// SUITE 4: normalizeLogoKey & SVG Emblem Rendering for 9 Games + Aliases
// --------------------------------------------------------------------------
console.log("\nSuite 4: SVG Emblem Rendering for Canonical Games & Legacy Aliases");

// Helper to render GameLogo to SVG string
function renderLogo(props: {
  logo?: string;
  game?: Partial<GameConfig>;
  variant?: "default" | "featured" | "mini";
  size?: "default" | "featured" | "mini";
}): string {
  return renderToStaticMarkup(
    React.createElement(GameLogo, props as React.ComponentProps<typeof GameLogo>)
  );
}

// 4.1 Canonical 9 Games SVG Rendering
const canonicalGames: Array<{
  logo: string;
  slug: string;
  expectedLabel: string;
  requiredSubstrings: string[];
}> = [
  {
    logo: "things",
    slug: "21-things",
    expectedLabel: "21 Things logo",
    requiredSubstrings: ["M11 26 L16 20", "rx=\"2.5\"", "M35 11 L36.4 14"], // chevrons, funnel tiles, #1 star
  },
  {
    logo: "syllables",
    slug: "17-syllables",
    expectedLabel: "17 Syllables logo",
    requiredSubstrings: ["y=\"14.5\"", "y=\"31.5\"", "y=\"49.5\"", "M55 49 L68 53"], // 5-7-5 bars, fountain nib
  },
  {
    logo: "rhymes",
    slug: "9-rhymes",
    expectedLabel: "9 Rhymes logo",
    requiredSubstrings: ["M 18 16 H 56", "cx=\"26\"", "stroke=\"#9D50BB\""], // chat bubble, 9, soundwaves
  },
  {
    logo: "echo",
    slug: "eightfold-echo",
    expectedLabel: "Eightfold Echo logo",
    requiredSubstrings: ["#2ECC71", "#EC4899", "stroke-dasharray=\"1.5 1.5\""], // emerald center, rose active, trace line
  },
  {
    logo: "6-pics",
    slug: "6-pics",
    expectedLabel: "6 Pics logo",
    requiredSubstrings: ["M15.5 12.5", "M33.5 27", "M65.5 12", "M12 50 H19"], // sun, mountain, lightning, gem
  },
  {
    logo: "connect",
    slug: "connect-5",
    expectedLabel: "Connect 5 logo",
    requiredSubstrings: ["height=\"10.5\"", "r=\"3.2\"", "stroke-width=\"3.5\""], // word chain bars, connector circles & lines
  },
  {
    logo: "four-score",
    slug: "four-score",
    expectedLabel: "Four Score logo",
    requiredSubstrings: ["y=\"21\"", "38", "M 26.5 37.5", "M 63 65 L 67 71"], // = 80 card, satellite tiles 4, ×, +, x²
  },
  {
    logo: "move-2",
    slug: "move-2",
    expectedLabel: "Move Two logo",
    requiredSubstrings: ["#EF4444", "C 35 14", "#CA8A04", "#16A34A"], // red target, tumbling arc, domino cubes
  },
  {
    logo: "win",
    slug: "1-win",
    expectedLabel: "1 Win logo",
    requiredSubstrings: ["y=\"68\"", "y=\"42\"", "y=\"50\"", "y=\"30\""], // foundation bar, podiums 2, 3, 1, trophy
  },
];

canonicalGames.forEach((item) => {
  // Test by logo prop
  const svgByLogo = renderLogo({ logo: item.logo });
  assert(
    svgByLogo.startsWith("<svg") && svgByLogo.endsWith("</svg>"),
    `GameLogo({ logo: '${item.logo}' }) produces valid root SVG element`
  );
  assert(
    svgByLogo.includes(`aria-label="${item.expectedLabel}"`),
    `GameLogo({ logo: '${item.logo}' }) aria-label is '${item.expectedLabel}'`
  );
  const hasSubstringsByLogo = item.requiredSubstrings.every((sub) => {
    const found = svgByLogo.includes(sub);
    if (!found) {
      console.error(`Missing expected substring '${sub}' in svg for ${item.logo}`);
    }
    return found;
  });
  assert(
    hasSubstringsByLogo,
    `GameLogo({ logo: '${item.logo}' }) contains distinctive vector geometry elements`
  );

  // Test by slug fallback (when logo is passed as game.slug or logo=slug)
  const svgBySlug = renderLogo({ logo: item.slug });
  assert(
    svgBySlug.includes(`aria-label="${item.expectedLabel}"`),
    `GameLogo({ logo: '${item.slug}' }) normalizes slug to emblem '${item.expectedLabel}'`
  );

  // Test by game object
  const gameObj = ALL_GAMES.find((g) => g.slug === item.slug);
  if (gameObj) {
    const svgByGame = renderLogo({ game: gameObj });
    assert(
      svgByGame.includes(`aria-label="${item.expectedLabel}"`),
      `GameLogo({ game: <${gameObj.name}> }) renders '${item.expectedLabel}'`
    );
  }
});

// 4.2 Legacy Aliases Mapping to Four Score
console.log("\nSuite 5: Legacy Aliases Normalization & Four Score Fallback");

const fourScoreAliases = [
  "letter",
  "the-11th-hour",
  "11th-hour",
  "score",
  "fourscore",
  "four-score",
];

const reach80DistinctiveMarkers = [
  "y=\"21\"", // target card 38x38 at (21, 21)
  "M 26.5 37.5", // equals sign =
  "#F9D423", // yellow target card fill
  "#9D50BB", // purple multiply operator badge
  "#2ECC71", // green add operator badge
];

fourScoreAliases.forEach((alias) => {
  const svg = renderLogo({ logo: alias });
  assert(
    svg.includes(`aria-label="Four Score logo"`),
    `Legacy alias '${alias}' maps to 'Four Score logo'`
  );
  const hasAllReach80Markers = reach80DistinctiveMarkers.every((m) => svg.includes(m));
  assert(
    hasAllReach80Markers,
    `Legacy alias '${alias}' renders the Reach-80 math card emblem with satellites (4, ×, +, x²)`
  );
});

// --------------------------------------------------------------------------
// SUITE 6: Stress-Testing, Normalization Edge Cases & Resiliency
// --------------------------------------------------------------------------
console.log("\nSuite 6: Stress-Testing & Normalization Edge Cases");

// Whitespace and case-insensitivity
const edgeCaseInputs = [
  { raw: "  FOUR-SCORE  ", expected: "Four Score logo" },
  { raw: "LETTER", expected: "Four Score logo" },
  { raw: " The-11th-Hour ", expected: "Four Score logo" },
  { raw: "11TH-HOUR", expected: "Four Score logo" },
  { raw: " FourScore ", expected: "Four Score logo" },
  { raw: " SCORE ", expected: "Four Score logo" },
  { raw: " 21-THINGS ", expected: "21 Things logo" },
  { raw: "  Connect-5  ", expected: "Connect 5 logo" },
  { raw: "9-RHYMES", expected: "9 Rhymes logo" },
  { raw: "  eightfold echo  ", expected: "Eightfold Echo logo" }, // space replaced by hyphen
  { raw: "MOVE 2", expected: "Move Two logo" }, // space replaced by hyphen
];

edgeCaseInputs.forEach(({ raw, expected }) => {
  const svg = renderLogo({ logo: raw });
  assert(
    svg.includes(`aria-label="${expected}"`),
    `Edge case: normalizeLogoKey('${raw}') correctly resolves to '${expected}'`
  );
});

// Unknown / Unrecognized Key: fallback to generic default yellow square
const unknownSvg = renderLogo({ logo: "completely-unknown-puzzle-xyz" });
assert(
  unknownSvg.startsWith("<svg") && unknownSvg.includes(`aria-label="Game logo"`),
  "Unknown logo key gracefully falls back to default Game logo without throwing"
);
assert(
  unknownSvg.includes("rx=\"10\""),
  "Default fallback renders yellow rounded square placeholder"
);

// Empty key
const emptySvg = renderLogo({ logo: "" });
assert(
  emptySvg.startsWith("<svg") && emptySvg.includes(`aria-label="Game logo"`),
  "Empty logo key gracefully falls back without throwing"
);

// Undefined props
const undefinedSvg = renderLogo({});
assert(
  undefinedSvg.startsWith("<svg") && undefinedSvg.includes(`aria-label="Game logo"`),
  "GameLogo with empty props gracefully falls back without throwing"
);

// Dimensions check across variants
const miniSvg = renderLogo({ logo: "four-score", variant: "mini" });
assert(
  miniSvg.includes("width=\"28\"") && miniSvg.includes("height=\"28\""),
  "variant='mini' renders 28x28 viewBox dimensions"
);

const defaultSvg = renderLogo({ logo: "four-score", variant: "default" });
assert(
  defaultSvg.includes("width=\"72\"") && defaultSvg.includes("height=\"72\""),
  "variant='default' renders 72x72 viewBox dimensions"
);

const featuredSvg = renderLogo({ logo: "four-score", variant: "featured" });
assert(
  featuredSvg.includes("width=\"84\"") && featuredSvg.includes("height=\"84\""),
  "variant='featured' renders 84x84 viewBox dimensions"
);

// Support size prop as alias to variant
const sizeMiniSvg = renderLogo({ logo: "four-score", size: "mini" });
assert(
  sizeMiniSvg.includes("width=\"28\"") && sizeMiniSvg.includes("height=\"28\""),
  "size='mini' renders 28x28 viewBox dimensions"
);

// --------------------------------------------------------------------------
// HARNESS SUMMARY & EXIT CODE
// --------------------------------------------------------------------------
console.log("\n===============================================================");
const totalTests = results.length;
const passedTests = results.filter((r) => r.passed).length;
const failedTests = results.filter((r) => !r.passed).length;

console.log(`TOTAL TESTS : ${totalTests}`);
console.log(`PASSED      : ${passedTests}`);
console.log(`FAILED      : ${failedTests}`);
console.log("===============================================================");

if (failedTests > 0) {
  console.error(`\n[VERDICT: FAILED] ${failedTests} assertion(s) failed.`);
  process.exit(1);
} else {
  console.log(`\n[VERDICT: ALL PASSED] 100% of empirical assertions passed.`);
  process.exit(0);
}
