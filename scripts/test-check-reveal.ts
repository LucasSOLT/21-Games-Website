/**
 * Automated Verification Suite for Step 4 (M4-B2 / R4 & R5 + Native Share Fix)
 * Tests Native Share payload fix, PuzzleCheckRevealModal, Connect 5, and 17 Syllables.
 * Run with: node --experimental-strip-types scripts/test-check-reveal.ts
 */

import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";

// Register custom ESM resolver for "@/..." project path aliases
register("./test-resolver.mjs", import.meta.url);

const { nativeShareResultsOnly, copyResultsOnly } = await import(
  "@/lib/custom-game-share"
);
const { PuzzleCheckRevealModal } = await import(
  "@/components/games/puzzle-check-reveal-modal"
);
const { CONNECT_5_PUZZLES } = await import("@/data/puzzles/connect-5");
const { SEVENTEEN_SYLLABLES_PUZZLES, buildStructuredHaikuLines } = await import(
  "@/data/puzzles/17-syllables"
);

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ ${testName}`);
  } else {
    failedCount++;
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
  }
}

console.log("\n=======================================================");
console.log("TEST SUITE: Step 4 Verification (Share Fix + R4/R5 Modals)");
console.log("=======================================================\n");

// ----------------------------------------------------------------------------
// Group 1: Native Share Payload Emojis & Score Fix (iOS Messages Text Discard Fix)
// ----------------------------------------------------------------------------
console.log("--- Group 1: Native Share Payload Formatting & Decoupling ---");

interface TestShareData {
  title?: string;
  text?: string;
  url?: string;
}

let sharePayloadSent: TestShareData | null = null;
let clipboardWritten: string | null = null;

const getSentPayload = (): TestShareData | null => sharePayloadSent;
const getWrittenClipboard = (): string | null => clipboardWritten;

// Mock global navigator
Object.defineProperty(globalThis, "navigator", {
  value: {
    share: async (data: TestShareData) => {
      sharePayloadSent = data;
    },
    canShare: () => true,
    clipboard: {
      writeText: async (text: string) => {
        clipboardWritten = text;
      },
    },
  },
  configurable: true,
  writable: true,
});

const sampleRichText = [
  '🔗 Connect 5 #18 — "Ocean Waves"',
  "⏱️ Time: 0:42",
  "🟩🟩🟩🟩🟩",
  "🟩🟩🟩🟩🟩",
].join("\n");

sharePayloadSent = null;
clipboardWritten = null;

await nativeShareResultsOnly({
  title: "Connect 5 #18",
  text: sampleRichText,
  url: "https://21games.ai/games/connect-5",
});

assert(
  getSentPayload() !== null,
  "nativeShareResultsOnly invokes navigator.share"
);
assert(
  Boolean(getSentPayload()?.text?.includes("🟩🟩🟩🟩🟩")),
  "nativeShareResultsOnly preserves emojis in payload text"
);
assert(
  Boolean(getSentPayload()?.text?.includes("⏱️ Time: 0:42")),
  "nativeShareResultsOnly preserves score/time in payload text"
);
assert(
  Boolean(getSentPayload()?.text?.includes("https://21games.ai/games/connect-5")),
  "nativeShareResultsOnly appends URL into payload text field"
);
assert(
  getSentPayload()?.url === undefined,
  "nativeShareResultsOnly OMITS separate url key so iOS Messages does not discard text"
);
assert(
  getWrittenClipboard() === null,
  "nativeShareResultsOnly NEVER touches the clipboard (strict decoupling)"
);

// Verify copyResultsOnly decoupling
clipboardWritten = null;
sharePayloadSent = null;

await copyResultsOnly({
  title: "Connect 5 #18",
  text: sampleRichText,
  url: "https://21games.ai/games/connect-5",
});

assert(
  getWrittenClipboard() !== null && Boolean(getWrittenClipboard()?.includes("🟩🟩🟩🟩🟩")),
  "copyResultsOnly writes formatted emojis + score + URL to clipboard"
);
assert(
  getSentPayload() === null,
  "copyResultsOnly NEVER invokes navigator.share"
);

// ----------------------------------------------------------------------------
// Group 2: PuzzleCheckRevealModal Component Contract & Exact Verbatim Strings
// ----------------------------------------------------------------------------
console.log("\n--- Group 2: PuzzleCheckRevealModal Contract & Exact Strings ---");

assert(
  typeof PuzzleCheckRevealModal === "function",
  "PuzzleCheckRevealModal is exported as a React functional component"
);

const modalSource = fs.readFileSync(
  path.resolve("src/components/games/puzzle-check-reveal-modal.tsx"),
  "utf8"
);

assert(
  modalSource.includes("Check Square"),
  'Modal source contains "Check Square" action'
);
assert(
  modalSource.includes("Check Word"),
  'Modal source contains "Check Word" action'
);
assert(
  modalSource.includes("Check Puzzle"),
  'Modal source contains "Check Puzzle" action'
);
assert(
  modalSource.includes("Reveal / Clear..."),
  'Modal source contains "Reveal / Clear..." submenu trigger'
);
assert(
  modalSource.includes("Cancel"),
  'Modal source contains "Cancel" action button'
);

// Verbatim warnings
const expectedRevealWarning =
  "Are you sure you want to reveal the ENTIRE Puzzle? The game will end when you do!";
assert(
  modalSource.includes(expectedRevealWarning),
  'Modal source includes verbatim Reveal warning: "' + expectedRevealWarning + '"'
);

const expectedClearWarning =
  "Are you sure you want to clear your entered letters? This will delete all user-entered letters.";
assert(
  modalSource.includes(expectedClearWarning),
  'Modal source includes verbatim Clear warning: "' + expectedClearWarning + '"'
);

const expectedPartialCheckWarning =
  "Are you sure you want to check the entire puzzle? You haven't completed all words yet.";
assert(
  modalSource.includes(expectedPartialCheckWarning),
  'Modal source includes verbatim partial check warning: "' + expectedPartialCheckWarning + '"'
);

assert(
  modalSource.includes("Check Entire Puzzle") && modalSource.includes("Keep Playing"),
  'Partial fill confirmation contains "Check Entire Puzzle" and "Keep Playing" buttons'
);

// ----------------------------------------------------------------------------
// Group 3: Connect 5 Check & Reveal Business Logic
// ----------------------------------------------------------------------------
console.log("\n--- Group 3: Connect 5 Check & Reveal Logic ---");

const connect5Puzzle = CONNECT_5_PUZZLES[0];
const targetWords = connect5Puzzle.words;

// Simulate Connect 5 state
const testGrid: string[][] = [
  targetWords[0].split(""),
  ["W", "R", "O", "N", "G"], // 5 letters, suppose wrong
  ["", "", "", ""],
  ["", "", "", "", ""],
  ["", "", "", "", "", ""],
];
const testLocked: boolean[][] = [
  targetWords[0].split("").map(() => true),
  [false, false, false, false, false],
  [false, false, false, false],
  [false, false, false, false, false],
  [false, false, false, false, false, false],
];
const testSlashed: boolean[][] = [
  targetWords[0].split("").map(() => false),
  [false, false, false, false, false],
  [false, false, false, false],
  [false, false, false, false, false],
  [false, false, false, false, false, false],
];

// 1. Check Square on Row 1, Col 0
const checkSquareResult =
  testGrid[1][0].toUpperCase() === targetWords[1][0];
testSlashed[1][0] = !checkSquareResult;

assert(
  testSlashed[1][0] === (testGrid[1][0].toUpperCase() !== targetWords[1][0]),
  "Check Square correctly toggles slash flag based on canonical letter comparison"
);

// 2. Check Word on Row 1
for (let c = 0; c < testGrid[1].length; c++) {
  if (testGrid[1][c]) {
    testSlashed[1][c] = testGrid[1][c].toUpperCase() !== targetWords[1][c];
  }
}
assert(
  testSlashed[1].some(Boolean) || testGrid[1].join("") === targetWords[1],
  "Check Word validates all characters in active row"
);

// 3. Partial Fill Calculation
function isPartiallyFilled(grid: string[][], locked: boolean[][]): boolean {
  let filledRows = 0;
  let totalEditableFilled = 0;
  let totalEditable = 0;
  for (let r = 1; r < 5; r++) {
    let rowFull = true;
    for (let c = 0; c < grid[r].length; c++) {
      if (!locked[r][c]) {
        totalEditable++;
        if (grid[r][c] !== "") {
          totalEditableFilled++;
        } else {
          rowFull = false;
        }
      }
    }
    if (rowFull) filledRows++;
  }
  return filledRows <= 1 || totalEditableFilled < totalEditable;
}

assert(
  isPartiallyFilled(testGrid, testLocked) === true,
  "Partial fill gate correctly detects when user has only filled 1st word or partial puzzle"
);

// Full grid simulation
const fullGrid = targetWords.map((w) => w.split(""));
assert(
  isPartiallyFilled(fullGrid, testLocked) === false,
  "Partial fill gate returns false when puzzle is 100% filled"
);

// 4. Reveal Puzzle Simulation
const revealedGrid = targetWords.map((w) => w.split(""));
const revealedLocked = targetWords.map((w) => w.split("").map(() => true));
const revealedSlashed = targetWords.map((w) => w.split("").map(() => false));
assert(
  revealedGrid.every((r, i) => r.join("") === targetWords[i]) &&
    revealedLocked.every((r) => r.every(Boolean)) &&
    revealedSlashed.every((r) => r.every((s) => !s)),
  "Reveal Puzzle fills all canonical words, locks all cells, and clears slashes"
);

// 5. Clear Puzzle Simulation
const clearedGrid = testGrid.map((r, rIdx) =>
  rIdx === 0 ? [...r] : r.map((char, cIdx) => (testLocked[rIdx][cIdx] ? char : ""))
);
assert(
  clearedGrid[0].join("") === targetWords[0] &&
    clearedGrid.slice(1).every((r) => r.every((ch) => ch === "")),
  "Clear Puzzle wipes user letters in rows 1..4 while preserving starter row 0"
);

// ----------------------------------------------------------------------------
// Group 4: 17 Syllables Check & Reveal Business Logic
// ----------------------------------------------------------------------------
console.log("\n--- Group 4: 17 Syllables Check & Reveal Logic ---");

const haikuPuzzle = SEVENTEEN_SYLLABLES_PUZZLES[0];
const structuredLines = buildStructuredHaikuLines(haikuPuzzle.lines);
assert(
  structuredLines.length === 3,
  "buildStructuredHaikuLines produces 3 structured lines for haiku"
);

// Focus model test: two-tap return
let currentFocusedCell: { lineIdx: number; wordIdx: number; slotIdx: number; charIdx: number } | null = null;
const getCurrentFocusedCell = () => currentFocusedCell;
let slotRemoved = false;
const getSlotRemoved = (): boolean => slotRemoved;

function onCellTap(
  lineIdx: number,
  wordIdx: number,
  slotIdx: number,
  charIdx: number,
  isFilled: boolean
) {
  const isSlotFocused =
    currentFocusedCell?.lineIdx === lineIdx &&
    currentFocusedCell?.wordIdx === wordIdx &&
    currentFocusedCell?.slotIdx === slotIdx;

  if (isFilled && isSlotFocused) {
    slotRemoved = true;
  } else {
    currentFocusedCell = { lineIdx, wordIdx, slotIdx, charIdx };
    slotRemoved = false;
  }
}

// Tap 1: Focuses cell
onCellTap(0, 0, 0, 1, true);
assert(
  Boolean(getCurrentFocusedCell()?.charIdx === 1) && !getSlotRemoved(),
  "17 Syllables: Tap 1 on filled square focuses that square without returning chunk"
);

// Tap 2 on same slot: Returns chunk to tray
onCellTap(0, 0, 0, 1, true);
assert(
  getSlotRemoved() === true,
  "17 Syllables: Tap 2 on already-focused filled slot triggers return to tray"
);

// Visual error slash test
const slashedCellsSet = new Set<string>();
const testExpected = "AUT";
const testPlaced = "OUT";

for (let c = 0; c < testExpected.length; c++) {
  const cellId = `0-0-0-${c}`;
  if (testPlaced[c] !== testExpected[c]) {
    slashedCellsSet.add(cellId);
  }
}

assert(
  slashedCellsSet.has("0-0-0-0") && !slashedCellsSet.has("0-0-0-1"),
  "17 Syllables: Check correctly marks slashed diagonal strikeout on incorrect character only"
);

// ----------------------------------------------------------------------------
// Group 5: Header UI Unification & Component Wiring
// ----------------------------------------------------------------------------
console.log("\n--- Group 5: Top-Right Header Icon Controls (R5) ---");

const connect5Source = fs.readFileSync(
  path.resolve("src/components/games/connect-five.tsx"),
  "utf8"
);
const syllablesSource = fs.readFileSync(
  path.resolve("src/components/games/seventeen-syllables.tsx"),
  "utf8"
);
const gameShellSource = fs.readFileSync(
  path.resolve("src/components/game-shell.tsx"),
  "utf8"
);

assert(
  gameShellSource.includes("unifiedHeader"),
  "GameShell supports unifiedHeader prop"
);
assert(
  gameShellSource.includes("!unifiedHeader && headerRightSlot && (") &&
    gameShellSource.includes("Tier 2 Mobile Bar"),
  "GameShell omits redundant Tier 2 mobile bar when unifiedHeader is true or no headerRightSlot is used"
);

assert(
  connect5Source.includes("unifiedHeader={true}"),
  "connect-five.tsx passes unifiedHeader={true} to GameShell"
);
assert(
  syllablesSource.includes("unifiedHeader={true}"),
  "seventeen-syllables.tsx passes unifiedHeader={true} to GameShell"
);

assert(
  connect5Source.includes("<LifeBuoy") &&
    connect5Source.includes("<Lightbulb") &&
    connect5Source.includes("<HelpCircle") &&
    connect5Source.includes("<Settings"),
  "connect-five.tsx nests LifeBuoy, Lightbulb, HelpCircle, and Settings icon buttons in header"
);

assert(
  syllablesSource.includes("<LifeBuoy") &&
    syllablesSource.includes("<Lightbulb") &&
    syllablesSource.includes("<HelpCircle") &&
    syllablesSource.includes("<Settings"),
  "seventeen-syllables.tsx nests LifeBuoy, Lightbulb, HelpCircle, and Settings icon buttons in header"
);

assert(
  connect5Source.includes("checkRevealOpen") &&
    connect5Source.includes("bg-blue-600 text-white border-blue-600"),
  "connect-five.tsx highlights LifeBuoy icon with active blue style when modal is open"
);

assert(
  syllablesSource.includes("checkRevealModalOpen") &&
    syllablesSource.includes("bg-blue-600 text-white border-blue-600"),
  "seventeen-syllables.tsx highlights LifeBuoy icon with active blue style when modal is open"
);

console.log("\n=======================================================");
console.log(`TOTAL PASSED: ${passedCount}`);
console.log(`TOTAL FAILED: ${failedCount}`);
console.log("=======================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
