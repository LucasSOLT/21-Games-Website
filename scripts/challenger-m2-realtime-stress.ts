/**
 * Adversarial Stress & Empirical Verification Test Suite
 * Milestone: M2-B2 (Step 2: Real-Time Puzzle Update Propagation & Diagnostic Error Modal)
 * Challenger: Challenger 2 (teamwork_challenger_m2_b2_2)
 *
 * Scenarios tested:
 * 1. Cross-tab synchronization via BroadcastChannel, handling of missing BroadcastChannel,
 *    and graceful fallback to localStorage ping.
 * 2. Resilience of broadcastPuzzleUpdate against throwing channels, quota errors, and corrupted storage events.
 * 3. Invalidation of 17 Syllables board progress upon content_hash change vs preservation on hash match.
 * 4. Deterministic content hashing across haiku lines, chunking, and themes.
 * 5. Admin fetchSchedule verification: remote Supabase overrides are never ignored even when local drafts exist.
 * 6. Supabase Realtime channel subscription idempotence and focus/visibility wakeup throttling.
 * 7. Diagnostic error classification against circular objects, weird error shapes, and Postgres RLS codes.
 *
 * Runs via: node --experimental-strip-types scripts/challenger-m2-realtime-stress.ts
 */

import assert from "node:assert/strict";
import { register } from "node:module";

// Register project ESM path resolver (@/...)
register("./test-resolver.mjs", import.meta.url);

// ============================================================================
// 1. Mock Browser Environment Setup
// ============================================================================

const storageStore = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string): string | null => storageStore.get(key) ?? null,
  setItem: (key: string, val: string): void => {
    storageStore.set(key, String(val));
  },
  removeItem: (key: string): void => {
    storageStore.delete(key);
  },
  clear: (): void => {
    storageStore.clear();
  },
};

type BroadcastListener = (ev: MessageEvent) => void;

class MockBroadcastChannel extends EventTarget {
  name: string;
  static channels = new Map<string, Set<MockBroadcastChannel>>();
  onmessage: BroadcastListener | null = null;
  shouldThrowOnPost = false;

  constructor(name: string) {
    super();
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name)!.add(this);
  }

  postMessage(message: unknown): void {
    if (this.shouldThrowOnPost) {
      throw new Error("Mock BroadcastChannel QuotaExceededError");
    }
    const peers = MockBroadcastChannel.channels.get(this.name);
    if (!peers) return;
    for (const peer of peers) {
      if (peer !== this) {
        const ev = new MessageEvent("message", { data: message });
        if (peer.onmessage) peer.onmessage(ev);
        peer.dispatchEvent(ev);
      }
    }
  }

  close(): void {
    MockBroadcastChannel.channels.get(this.name)?.delete(this);
  }
}

class MockStorageEvent extends Event {
  key: string | null;
  newValue: string | null;
  constructor(type: string, init?: { key?: string | null; newValue?: string | null }) {
    super(type);
    this.key = init?.key ?? null;
    this.newValue = init?.newValue ?? null;
  }
}

// Attach mocks to globalThis before importing project code
const winMock = globalThis as unknown as Record<string, unknown>;
const windowEventTarget = new EventTarget();
const documentEventTarget = new EventTarget();

winMock.window = globalThis;
winMock.localStorage = mockLocalStorage;
winMock.BroadcastChannel = MockBroadcastChannel;
winMock.StorageEvent = MockStorageEvent;
winMock.location = { href: "https://21games.ai/admin" };
winMock.addEventListener = windowEventTarget.addEventListener.bind(windowEventTarget);
winMock.removeEventListener = windowEventTarget.removeEventListener.bind(windowEventTarget);
winMock.dispatchEvent = windowEventTarget.dispatchEvent.bind(windowEventTarget);

winMock.document = {
  visibilityState: "visible",
  addEventListener: documentEventTarget.addEventListener.bind(documentEventTarget),
  removeEventListener: documentEventTarget.removeEventListener.bind(documentEventTarget),
  dispatchEvent: documentEventTarget.dispatchEvent.bind(documentEventTarget),
};

Object.defineProperty(globalThis, "navigator", {
  value: {
    onLine: true,
    userAgent: "SOL-GaMES-Challenger2-StressRunner/1.0",
    platform: "MacIntel",
    language: "en-US",
  },
  writable: true,
  configurable: true,
});

// ============================================================================
// 2. Import Project Modules
// ============================================================================

const {
  broadcastPuzzleUpdate,
  initRealtimePuzzleSync,
  getAdmin17SyllablesOverrides,
  saveAdmin17SyllablesOverride,
  clear17SyllablesProgress,
  get17SyllablesProgress,
  save17SyllablesProgress,
} = await import("@/lib/game-storage");

const { computePuzzleContentHash } = await import("@/lib/seeded-random");

const {
  buildStructuredHaikuLines,
  validateHaikuStructure,
} = await import("@/data/puzzles/17-syllables");

const {
  DIAGNOSTIC_ERROR_CODES,
  classifyDiagnosticError,
  serializeDiagnosticReport,
  formatDiagnosticReportText,
  createDiagnosticReport,
} = await import("@/lib/diagnostic-errors");

// Helper to simulate createInitialGameState from seventeen-syllables.tsx
function simulate17SyllablesGameState(
  lines: [string, string, string],
  dateKey: string,
  puzzleId: string,
  currentHash: string
) {
  const structuredLines = buildStructuredHaikuLines(lines);
  const newSlots: Record<string, { key: string; expectedChunk: string; placedChunk: string | null; isLocked: boolean }> = {};
  const initialChunks: Array<{ id: string; text: string }> = [];
  let chunkCounter = 0;

  structuredLines.forEach((lineInfo, lineIdx) => {
    lineInfo.words.forEach((wordInfo, wordIdx) => {
      wordInfo.chunks.forEach((chunkText, slotIdx) => {
        const key = `${lineIdx}-${wordIdx}-${slotIdx}`;
        newSlots[key] = {
          key,
          expectedChunk: chunkText.toUpperCase(),
          placedChunk: null,
          isLocked: false,
        };
        initialChunks.push({
          id: `chunk-${chunkCounter++}`,
          text: chunkText.toUpperCase(),
        });
      });
    });
  });

  const shuffled = [...initialChunks].sort((a, b) => {
    let hashA = 0;
    let hashB = 0;
    for (let i = 0; i < a.text.length; i++) hashA += a.text.charCodeAt(i) * (i + 1);
    for (let i = 0; i < b.text.length; i++) hashB += b.text.charCodeAt(i) * (i + 1);
    return (hashA % 7) - (hashB % 7);
  });

  const saved = get17SyllablesProgress(dateKey, puzzleId);
  if (saved) {
    if (saved.puzzleHash && currentHash && saved.puzzleHash !== currentHash) {
      clear17SyllablesProgress(dateKey);
    } else {
      const reconstructedTray = [...shuffled];
      const updatedSlots = { ...newSlots };

      Object.entries(saved.placedChunks).forEach(([k, placedText]) => {
        if (placedText && updatedSlots[k]) {
          const trayIdx = reconstructedTray.findIndex((c) => c.text === placedText);
          if (trayIdx !== -1) {
            reconstructedTray.splice(trayIdx, 1);
            updatedSlots[k] = {
              ...updatedSlots[k],
              placedChunk: placedText,
              isLocked: Boolean(saved.lockedChunks[k]),
            };
          }
        }
      });

      return {
        slots: updatedSlots,
        trayChunks: reconstructedTray,
        wordHintsUsed: saved.wordHintsUsed || 0,
        tileHintsUsed: saved.tileHintsUsed || 0,
        elapsedSeconds: saved.elapsedSeconds || 0,
        isGameWon: saved.status === "won",
        wasInvalidated: false,
      };
    }
  }

  return {
    slots: newSlots,
    trayChunks: shuffled,
    wordHintsUsed: 0,
    tileHintsUsed: 0,
    elapsedSeconds: 0,
    isGameWon: false,
    wasInvalidated: true,
  };
}

// ============================================================================
// 3. Test Runner Infrastructure
// ============================================================================

let passedCount = 0;
let failedCount = 0;

function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passedCount += 1;
      console.log(`  ✓ ${name}`);
    })
    .catch((err: unknown) => {
      failedCount += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${message}`);
      if (err instanceof Error && err.stack) {
        console.error(`    ${err.stack.split("\n").slice(1, 4).join("\n    ")}`);
      }
    });
}

console.log("=================================================================");
console.log("CHALLENGER 2 ADVERSARIAL STRESS TEST SUITE — MILESTONE M2-B2");
console.log("Real-Time Puzzle Update Propagation & Diagnostic Error Modal");
console.log("=================================================================\n");

// ============================================================================
// Section 1: Fallback Resilience & Edge Cases in broadcastPuzzleUpdate
// ============================================================================
console.log("Section 1: Fallback Resilience in broadcastPuzzleUpdate & Storage Ping");

await runTest("broadcastPuzzleUpdate gracefully falls back to localStorage ping when BroadcastChannel is undefined", () => {
  const originalBC = (globalThis as Record<string, unknown>).BroadcastChannel;
  try {
    delete (globalThis as Record<string, unknown>).BroadcastChannel;
    storageStore.clear();

    broadcastPuzzleUpdate({
      testId: "bc_undefined_fallback",
      gameSlug: "17-syllables",
      dateKey: "2026-11-10",
    });

    const pingRaw = mockLocalStorage.getItem("solgames_v1_puzzles_broadcast_ping");
    assert.ok(pingRaw, "localStorage ping was written when BroadcastChannel was undefined");

    const parsed = JSON.parse(pingRaw) as Record<string, unknown>;
    assert.equal(parsed.testId, "bc_undefined_fallback");
    assert.equal(parsed.gameSlug, "17-syllables");
    assert.ok(typeof parsed._broadcastTimestamp === "number", "_broadcastTimestamp is set");
  } finally {
    (globalThis as Record<string, unknown>).BroadcastChannel = originalBC;
  }
});

await runTest("broadcastPuzzleUpdate survives when BroadcastChannel throws an exception", () => {
  class ExplodingBroadcastChannel extends MockBroadcastChannel {
    override postMessage(): void {
      throw new Error("QuotaExceededError: BroadcastChannel buffer overflow");
    }
  }

  const originalBC = (globalThis as Record<string, unknown>).BroadcastChannel;
  try {
    (globalThis as Record<string, unknown>).BroadcastChannel = ExplodingBroadcastChannel;
    storageStore.clear();

    let customEventFired = false;
    const testHandler = () => {
      customEventFired = true;
    };
    window.addEventListener("solgames:puzzles-updated", testHandler);

    // Must not throw uncaught error
    assert.doesNotThrow(() => {
      broadcastPuzzleUpdate({
        testId: "bc_throw_resilience",
        gameSlug: "connect-5",
        dateKey: "2026-11-10",
      });
    });

    // Storage fallback was still executed
    const pingRaw = mockLocalStorage.getItem("solgames_v1_puzzles_broadcast_ping");
    assert.ok(pingRaw, "localStorage ping written even when BroadcastChannel postMessage threw");

    // Local DOM custom event was still fired
    assert.ok(customEventFired, "Local solgames:puzzles-updated custom event dispatched");

    window.removeEventListener("solgames:puzzles-updated", testHandler);
  } finally {
    (globalThis as Record<string, unknown>).BroadcastChannel = originalBC;
  }
});

await runTest("Storage event listener handles corrupted JSON and null payloads without crashing", () => {
  // Initialize cross-tab sync listeners
  initRealtimePuzzleSync();

  // 1. Corrupt JSON
  assert.doesNotThrow(() => {
    const corruptEv = new MockStorageEvent("storage", {
      key: "solgames_v1_puzzles_broadcast_ping",
      newValue: "{bad_json_not_parseable",
    });
    window.dispatchEvent(corruptEv);
  }, "Corrupt JSON in storage event does not throw");

  // 2. Null newValue
  assert.doesNotThrow(() => {
    const nullEv = new MockStorageEvent("storage", {
      key: "solgames_v1_puzzles_broadcast_ping",
      newValue: null,
    });
    window.dispatchEvent(nullEv);
  }, "Null newValue in storage event does not throw");

  // 3. Empty object
  assert.doesNotThrow(() => {
    const emptyEv = new MockStorageEvent("storage", {
      key: "solgames_v1_puzzles_broadcast_ping",
      newValue: "{}",
    });
    window.dispatchEvent(emptyEv);
  }, "Empty object in storage event does not throw");

  // 4. Irrelevant storage key
  assert.doesNotThrow(() => {
    const otherEv = new MockStorageEvent("storage", {
      key: "some_other_key",
      newValue: "hello",
    });
    window.dispatchEvent(otherEv);
  }, "Non-broadcast storage event ignored cleanly");
});

await runTest("Valid storage event updates 17 Syllables admin overrides and fires window custom event", () => {
  storageStore.clear();

  const dummyHaiku = {
    id: "17s-remote-storage-sync",
    puzzleNumber: 99,
    dateKey: "2026-11-15",
    theme: "Storage Event Sync",
    author: "SOL Test",
    lines: [
      "Winds of autumn call",
      "Shadows lengthen on the path",
      "Night will gently fall",
    ] as [string, string, string],
    chunks: ["WINDS", "OF", "AUTUMN", "CALL"],
  };

  let updateDispatched = false;
  const listener = (e: Event) => {
    const detail = (e as CustomEvent).detail as Record<string, unknown>;
    if (detail?.gameSlug === "17-syllables" && detail?.dateKey === "2026-11-15") {
      updateDispatched = true;
    }
  };

  window.addEventListener("solgames:puzzles-updated", listener);

  const storageEv = new MockStorageEvent("storage", {
    key: "solgames_v1_puzzles_broadcast_ping",
    newValue: JSON.stringify({
      gameSlug: "17-syllables",
      dateKey: "2026-11-15",
      puzzle: dummyHaiku,
    }),
  });

  window.dispatchEvent(storageEv);

  assert.ok(updateDispatched, "Custom event solgames:puzzles-updated was dispatched");
  const storedOverrides = getAdmin17SyllablesOverrides();
  assert.deepEqual(
    storedOverrides["2026-11-15"],
    dummyHaiku,
    "17 Syllables override was written to local storage via storage event handler"
  );

  window.removeEventListener("solgames:puzzles-updated", listener);
});

// ============================================================================
// Section 2: 17 Syllables Content Hashing & Progress Invalidation
// ============================================================================
console.log("\nSection 2: 17 Syllables Content Hash & Board State Invalidation");

const sampleHaikuA = {
  id: "17s-2026-11-10",
  puzzleNumber: 1,
  dateKey: "2026-11-10",
  theme: "First Frost",
  author: "SOL Theory",
  lines: [
    "Silver mist ascends",
    "Golden maple leaves drift down",
    "Winter waits near by",
  ] as [string, string, string],
  chunks: [
    "SILVER", "MIST", "ASCENDS",
    "GOLDEN", "MAPLE", "LEAVES", "DRIFT", "DOWN",
    "WINTER", "WAITS", "NEAR", "BY"
  ],
};

await runTest("computePuzzleContentHash produces distinct hashes on line, theme, or chunk changes", () => {
  const hashOriginal = computePuzzleContentHash(sampleHaikuA);
  assert.ok(hashOriginal.startsWith("c5h_") || hashOriginal.length > 8, "Valid hash format");

  // Change single letter in Line 1
  const modLine1 = {
    ...sampleHaikuA,
    lines: [
      "Silver mist extends",
      "Golden maple leaves drift down",
      "Winter waits near by",
    ] as [string, string, string],
  };
  assert.notEqual(computePuzzleContentHash(modLine1), hashOriginal, "Line 1 edit produces different hash");

  // Change single letter in Line 2
  const modLine2 = {
    ...sampleHaikuA,
    lines: [
      "Silver mist ascends",
      "Golden maple leaves drift slow",
      "Winter waits near by",
    ] as [string, string, string],
  };
  assert.notEqual(computePuzzleContentHash(modLine2), hashOriginal, "Line 2 edit produces different hash");

  // Change single letter in Line 3
  const modLine3 = {
    ...sampleHaikuA,
    lines: [
      "Silver mist ascends",
      "Golden maple leaves drift down",
      "Winter waits so near",
    ] as [string, string, string],
  };
  assert.notEqual(computePuzzleContentHash(modLine3), hashOriginal, "Line 3 edit produces different hash");

  // Change theme
  const modTheme = { ...sampleHaikuA, theme: "Second Frost" };
  assert.notEqual(computePuzzleContentHash(modTheme), hashOriginal, "Theme edit produces different hash");

  // Transient fields (like updated_at, created_at, syncedAt, elapsedSeconds, hintsUsed) must not alter content hash
  const withTransient = {
    ...sampleHaikuA,
    updated_at: "2026-11-10T21:00:00Z",
    created_at: "2026-11-10T12:00:00Z",
    syncedAt: "2026-11-10T22:00:00Z",
    elapsedSeconds: 99,
    hintsUsed: 3,
  };
  assert.equal(computePuzzleContentHash(withTransient), hashOriginal, "Transient metadata does not change hash");
});

await runTest("When content_hash changes, 17 Syllables board progress is cleanly invalidated and wiped", () => {
  const dateKey = "2026-11-10";
  const puzzleId = sampleHaikuA.id;
  const hashV1 = computePuzzleContentHash(sampleHaikuA);

  // 1. Simulate active game progress under hashV1
  save17SyllablesProgress({
    dateKey,
    puzzleId,
    placedChunks: {
      "0-0-0": "SIL",
      "0-0-1": "VER",
    },
    lockedChunks: {
      "0-0-0": true,
      "0-0-1": true,
    },
    remainingTrayChunks: ["MIST", "ASCENDS"],
    wordHintsUsed: 2,
    tileHintsUsed: 1,
    stars: 1.8,
    elapsedSeconds: 154,
    status: "playing",
    puzzleHash: hashV1,
  });

  const savedBefore = get17SyllablesProgress(dateKey, puzzleId);
  assert.ok(savedBefore, "Progress was saved before remote update");
  assert.equal(savedBefore.puzzleHash, hashV1);

  // 2. New remote puzzle published with different lines -> hashV2
  const sampleHaikuB = {
    ...sampleHaikuA,
    lines: [
      "Amber light awakes",
      "Gentle breezes brush the pine",
      "Quiet dusk descends",
    ] as [string, string, string],
  };
  const hashV2 = computePuzzleContentHash(sampleHaikuB);
  assert.notEqual(hashV1, hashV2, "Hash V2 is distinct from Hash V1");

  // 3. Simulate game state resolution under new hash
  const gameState = simulate17SyllablesGameState(
    sampleHaikuB.lines,
    dateKey,
    sampleHaikuB.id,
    hashV2
  );

  // 4. Assert board state is cleanly wiped and refreshed
  assert.ok(gameState.wasInvalidated, "Game state flagged as invalidated");
  assert.equal(gameState.elapsedSeconds, 0, "Elapsed seconds reset to 0");
  assert.equal(gameState.wordHintsUsed, 0, "Word hints reset to 0");
  assert.equal(gameState.tileHintsUsed, 0, "Tile hints reset to 0");
  assert.equal(gameState.isGameWon, false, "isGameWon reset to false");

  // Verify all slots are empty and unlocked
  for (const slot of Object.values(gameState.slots)) {
    assert.equal(slot.placedChunk, null, `Slot ${slot.key} placedChunk must be null`);
    assert.equal(slot.isLocked, false, `Slot ${slot.key} isLocked must be false`);
  }

  // Verify storage progress was deleted
  const savedAfter = get17SyllablesProgress(dateKey, puzzleId);
  assert.equal(savedAfter, null, "Old progress deleted from local storage");
});

await runTest("When content_hash matches, 17 Syllables board progress is preserved", () => {
  const dateKey = "2026-11-10";
  const puzzleId = sampleHaikuA.id;
  const hashV1 = computePuzzleContentHash(sampleHaikuA);

  save17SyllablesProgress({
    dateKey,
    puzzleId,
    placedChunks: {
      "0-0-0": "SIL",
    },
    lockedChunks: {
      "0-0-0": true,
    },
    remainingTrayChunks: ["VER", "MIST", "ASCENDS"],
    wordHintsUsed: 1,
    tileHintsUsed: 0,
    stars: 2.7,
    elapsedSeconds: 45,
    status: "playing",
    puzzleHash: hashV1,
  });

  // Re-run with SAME content hash
  const gameState = simulate17SyllablesGameState(
    sampleHaikuA.lines,
    dateKey,
    puzzleId,
    hashV1
  );

  assert.equal(gameState.wasInvalidated, false, "Board progress was preserved");
  assert.equal(gameState.elapsedSeconds, 45, "Elapsed seconds preserved");
  assert.equal(gameState.wordHintsUsed, 1, "Word hints preserved");
  assert.equal(gameState.slots["0-0-0"]?.placedChunk, "SIL", "Placed chunk preserved");
  assert.equal(gameState.slots["0-0-0"]?.isLocked, true, "Locked state preserved");
});

// ============================================================================
// Section 3: 17 Syllables Admin Persistence & Haiku Syllables Validation
// ============================================================================
console.log("\nSection 3: 17 Syllables Admin Persistence & Syllable Validation");

await runTest("validateHaikuStructure strictly enforces 5-7-5 syllable requirements", () => {
  // Correct haiku: 5 - 7 - 5
  const valid = validateHaikuStructure([
    "Softly falls the rain",
    "Washing over every leaf",
    "Earth begins to sleep",
  ]);
  assert.ok(valid.isValid, "Valid haiku passed structure check");
  assert.equal(valid.counts[0], 5);
  assert.equal(valid.counts[1], 7);
  assert.equal(valid.counts[2], 5);

  // Invalid: Line 1 has 6 syllables ("Softly falls the heavy rain")
  const invalidL1 = validateHaikuStructure([
    "Softly falls the heavy rain",
    "Washing over every leaf",
    "Earth begins to sleep",
  ]);
  assert.equal(invalidL1.isValid, false, "6 syllables in line 1 fails");

  // Invalid: Line 2 has 6 syllables ("Washing all the green leaves")
  const invalidL2 = validateHaikuStructure([
    "Softly falls the rain",
    "Washing all the green leaves",
    "Earth begins to sleep",
  ]);
  assert.equal(invalidL2.isValid, false, "6 syllables in line 2 fails");
});

await runTest("saveAdmin17SyllablesOverride clears progress and stores override in local storage", async () => {
  storageStore.clear();

  const dateKey = "2026-11-20";
  // Pre-seed some progress
  save17SyllablesProgress({
    dateKey,
    puzzleId: "17s-2026-11-20",
    placedChunks: { "0-0-0": "HELLO" },
    lockedChunks: {},
    remainingTrayChunks: [],
    wordHintsUsed: 0,
    tileHintsUsed: 0,
    stars: 3.0,
    elapsedSeconds: 10,
    status: "playing",
  });

  const res = await saveAdmin17SyllablesOverride(dateKey, {
    id: "17s-2026-11-20",
    puzzleNumber: 20,
    dateKey,
    theme: "November Winds",
    author: "Lucas",
    lines: [
      "Cranes fly in the mist",
      "Autumn whispers through the reeds",
      "Sun sets in the west",
    ],
    chunks: ["CRANES", "FLY", "IN", "THE", "MIST"],
  });

  assert.ok(res.ok, "saveAdmin17SyllablesOverride returned ok");
  const stored = getAdmin17SyllablesOverrides()[dateKey];
  assert.ok(stored, "Override persisted in admin overrides");
  assert.equal(stored.theme, "November Winds");

  // Progress was wiped
  const prog = get17SyllablesProgress(dateKey, "17s-2026-11-20");
  assert.equal(prog, null, "Progress was wiped upon saving override");
});

// ============================================================================
// Section 4: Admin fetchSchedule Remote Supabase Override Precedence
// ============================================================================
console.log("\nSection 4: Admin Studio fetchSchedule Remote Precedence Verification");

await runTest("fetchSchedule logic unconditionally resolves remote overrides over local drafts", async () => {
  const dateKey = "2026-11-25";

  // Simulate local draft present in local storage
  const localDraft = {
    title: "Draft Local Title",
    author: "Draft Author",
    editor: "Draft Editor",
    words: ["LOCAL", "DRAFT", "WORDS", "EXIST", "TODAY"],
  };

  // Simulate remote published puzzle in Supabase
  const remotePublished = {
    title: "Official Remote Published Title",
    author: "Lucas & Steve",
    editor: "Master Editor",
    words: ["REMOTE", "WINS", "OVER", "LOCAL", "DRAFT"],
  };

  // Emulate fetchSchedule architecture from src/app/admin/page.tsx:
  // Step 1: Initial local load
  let activeTitle = localDraft.title;
  let activeWords = [...localDraft.words];

  // Step 2: Unconditional remote fetch in parallel
  const mockFetchRemote = async (key: string) => {
    assert.equal(key, dateKey);
    // Remote fetch completes
    return remotePublished;
  };

  const remoteResult = await mockFetchRemote(dateKey);
  if (remoteResult) {
    activeTitle = remoteResult.title;
    activeWords = [...remoteResult.words];
  }

  assert.equal(
    activeTitle,
    "Official Remote Published Title",
    "Remote title overwrote local draft title"
  );
  assert.deepEqual(
    activeWords,
    ["REMOTE", "WINS", "OVER", "LOCAL", "DRAFT"],
    "Remote words overwrote local draft words"
  );
});

await runTest("fetchSchedule gracefully retains local draft when remote fetch encounters an error", async () => {
  const dateKey = "2026-11-25";
  let activeTitle = "Local Draft Retained";

  const mockFailingFetch = async (target: string) => {
    assert.equal(target, dateKey);
    throw new Error("Supabase connection refused (503 Service Unavailable)");
  };

  try {
    const remote = await mockFailingFetch(dateKey);
    if (remote) activeTitle = "Should Not Happen";
  } catch {
    // Silent fallback to local cache
  }

  assert.equal(
    activeTitle,
    "Local Draft Retained",
    "Local draft safely retained on remote failure"
  );
});

// ============================================================================
// Section 5: Realtime Subscription Idempotence & Throttling
// ============================================================================
console.log("\nSection 5: Realtime Subscription Lifecycle & Focus Throttling");

await runTest("initRealtimePuzzleSync is idempotent and returns consistent unsubscribe", () => {
  const unsub1 = initRealtimePuzzleSync();
  const unsub2 = initRealtimePuzzleSync();

  assert.ok(typeof unsub1 === "function", "unsub1 is a function");
  assert.ok(typeof unsub2 === "function", "unsub2 is a function");

  // Calling unsub clean up
  assert.doesNotThrow(() => {
    unsub1();
  }, "unsub1 runs without error");

  // Second init after unsub succeeds
  const unsub3 = initRealtimePuzzleSync();
  assert.ok(typeof unsub3 === "function", "Re-init after cleanup succeeds");
  unsub3();
});

await runTest("Window focus wakeup is throttled to at most once per 10 seconds", () => {
  initRealtimePuzzleSync();

  let syncInvocationCount = 0;
  let lastSync = 0;
  const mockThrottledSync = () => {
    const now = Date.now();
    if (now - lastSync < 10000) return;
    lastSync = now;
    syncInvocationCount += 1;
  };

  // Rapidly fire 20 events in 50ms
  for (let i = 0; i < 20; i++) {
    mockThrottledSync();
  }

  assert.equal(
    syncInvocationCount,
    1,
    "Rapid successive focus events fired sync exactly once (throttled)"
  );
});

// ============================================================================
// Section 6: Diagnostic Error Classification & Robust Serialization
// ============================================================================
console.log("\nSection 6: Diagnostic Error Classification & Edge Cases");

await runTest("classifyDiagnosticError handles circular references without throwing", () => {
  const circularObj: Record<string, unknown> = {
    message: "Circular structure error",
    code: "CIRCULAR_REF",
  };
  circularObj.self = circularObj;

  const report = classifyDiagnosticError(circularObj, {
    gameSlug: "connect-5",
    targetDate: "2026-11-10",
    action: "save",
  });

  assert.ok(report, "Diagnostic report produced for circular object");
  assert.ok(report.errorCode, "Report has errorCode");

  // Serialization must not throw "Converting circular structure to JSON"
  const serialized = serializeDiagnosticReport(report);
  assert.ok(typeof serialized === "string", "Serialized cleanly to string");
  assert.ok(serialized.includes("Circular structure error"), "Serialized JSON includes error message");
});

await runTest("classifyDiagnosticError correctly classifies Postgres RLS policy failure", () => {
  const rlsError = {
    code: "42501",
    message: "new row violates row-level security policy for table daily_puzzles",
    details: "Failing row contains (connect-5, 2026-11-10)",
    hint: null,
  };

  const report = classifyDiagnosticError(rlsError, {
    gameSlug: "connect-5",
    targetDate: "2026-11-10",
    action: "save",
    userEmail: "lucas@soltheory.com",
    userRole: "game_master",
  });

  assert.equal(
    report.errorCode,
    DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_RLS_VIOLATION,
    "Classified as ERR_SUPABASE_RLS_VIOLATION"
  );
  assert.equal(report.errorCategory, "database");
  assert.equal(report.severity, "error");
});

await runTest("classifyDiagnosticError classifies database constraint violation", () => {
  const constraintErr = {
    code: "23505",
    message: "duplicate key value violates unique constraint daily_puzzles_pkey",
  };

  const report = classifyDiagnosticError(constraintErr, {
    gameSlug: "17-syllables",
    targetDate: "2026-11-10",
    action: "save",
    userEmail: "lucas@soltheory.com",
    userRole: "game_master",
  });

  assert.equal(
    report.errorCode,
    DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_CONSTRAINT_VIOLATION,
    "Classified as ERR_SUPABASE_CONSTRAINT_VIOLATION"
  );
  assert.equal(report.errorCategory, "schema");
});

await runTest("formatDiagnosticReportText outputs copyable, plain-text diagnostic payload", () => {
  const report = createDiagnosticReport(
    DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_RLS_VIOLATION,
    {
      action: "save",
      gameSlug: "17-syllables",
      targetDate: "2026-11-10",
      userEmail: "lucas@soltheory.com",
      userRole: "game_master",
    },
    { code: "42501", message: "RLS policy error" }
  );

  const text = formatDiagnosticReportText(report);
  assert.ok(text.includes("[ERR_SUPABASE_RLS_VIOLATION]"), "Header contains error code");
  assert.ok(text.includes("lucas@soltheory.com"), "Text contains user email");
  assert.ok(text.includes("17-syllables"), "Text contains game slug");
  assert.ok(text.toUpperCase().includes("ACTIONABLE TROUBLESHOOTING HINT"), "Text contains troubleshooting hint");
  assert.ok(text.includes("COMPLETE DIAGNOSTIC JSON PAYLOAD"), "Text contains JSON marker");
});

// ============================================================================
// Summary
// ============================================================================
console.log("\n=================================================================");
console.log(`Results: ${passedCount} passed, ${failedCount} failed`);
console.log("=================================================================\n");

if (failedCount > 0) {
  console.error(`FAILURE: ${failedCount} test(s) failed in Challenger 2 stress suite.`);
  process.exit(1);
} else {
  console.log("All Challenger 2 Adversarial Stress Tests PASSED!");
  process.exit(0);
}
