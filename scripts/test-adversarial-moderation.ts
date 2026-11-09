/**
 * Adversarial Stress Test Harness for Requirement R2 Content Moderation Engine
 * Location: scripts/test-adversarial-moderation.ts
 *
 * Executed by Challenger 2 to empirically verify:
 * 1. Multi-layer obfuscation attacks (homoglyph + leetspeak + zero-width + symbol padding + case mixing)
 * 2. Scunthorpe false positive resistance on complex sentences
 * 3. Boundary extremes (empty strings, 10,000-char payloads, CJK, Arabic, Emoji, pure punctuation)
 * 4. Defensive runtime touchpoints in game-storage.ts and user-auth.ts
 *
 * Run via:
 * node --experimental-strip-types --import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("./scripts/test-resolver.mjs", pathToFileURL("./"));' scripts/test-adversarial-moderation.ts
 */

import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

// Provide window and localStorage polyfill in Node environment for client storage touchpoints
if (typeof globalThis.window === "undefined") {
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      get length() {
        return store.size;
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
    },
    dispatchEvent: () => true,
    CustomEvent: class CustomEvent {
      type: string;
      init?: unknown;
      constructor(type: string, init?: unknown) {
        this.type = type;
        this.init = init;
      }
    },
  };
}
import {
  checkContentModeration,
  type ModerationMode,
  // @ts-expect-error Node ESM type-stripping requires explicit .ts extension
} from "../src/lib/moderation.ts";

import {
  submitPlayerJourney,
  saveUserCreated21Board,
  // @ts-expect-error Node ESM type-stripping requires explicit .ts extension
} from "../src/lib/game-storage.ts";

import {
  signUpWithEmail,
  updateUserProfile,
  saveActiveUserProfile,
  normalizeUserProfile,
  // @ts-expect-error Node ESM type-stripping requires explicit .ts extension
} from "../src/lib/user-auth.ts";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(
  id: string,
  category: string,
  description: string,
  fn: () => void | Promise<void>
): Promise<void> | void {
  totalTests++;
  try {
    const res = fn();
    if (res && typeof res.then === "function") {
      return res
        .then(() => {
          passedTests++;
          console.log(`[PASS] ${id.padEnd(8)} | ${category.padEnd(28)} | ${description}`);
        })
        .catch((err: unknown) => {
          failedTests++;
          console.error(`[FAIL] ${id.padEnd(8)} | ${category.padEnd(28)} | ${description}`);
          console.error(`       Error:`, err);
        });
    } else {
      passedTests++;
      console.log(`[PASS] ${id.padEnd(8)} | ${category.padEnd(28)} | ${description}`);
    }
  } catch (err) {
    failedTests++;
    console.error(`[FAIL] ${id.padEnd(8)} | ${category.padEnd(28)} | ${description}`);
    console.error(`       Error:`, err);
  }
}

async function main() {
  console.log("================================================================================");
  console.log(" EMPIRICAL CHALLENGER 2: ADVERSARIAL STRESS TEST HARNESS (MILESTONE M2-B1)");
  console.log("================================================================================\n");

  // --------------------------------------------------------------------------
  // SECTION 1: Multi-Layer Obfuscation Attacks
  // --------------------------------------------------------------------------
  console.log("--- SECTION 1: Multi-Layer Obfuscation Attacks ---");

  const obfuscationAttacks = [
    {
      id: "ADV-OB-01",
      name: "Cyrillic + Leet + Zero-Width + Dot-Padding + Mixed Case",
      input: "N.\u200Bі.G.G.3.R", // Cyrillic і, leet 3, zero-width \u200B, dots, uppercase
      mode: "private" as ModerationMode,
      expectBlocked: true,
      expectTier: 1,
    },
    {
      id: "ADV-OB-02",
      name: "Greek + Leet + Zero-Width + Underscore-Padding",
      input: "F\u200D@_g_g_0_t", // Zero-width joiner \u200D, leet @ and 0, underscores, mixed case
      mode: "private" as ModerationMode,
      expectBlocked: true,
      expectTier: 1,
    },
    {
      id: "ADV-OB-03",
      name: "Cyrillic Homoglyphs + Leet Currency + Mixed Case",
      input: "k!kе", // Cyrillic е, leet !
      mode: "public" as ModerationMode,
      expectBlocked: true,
      expectTier: 1,
    },
    {
      id: "ADV-OB-04",
      name: "Fullwidth Latin + Leet Symbol + Mixed Case",
      input: "ｒｅｔ＠ｒｄ", // Fullwidth Latin + @
      mode: "private" as ModerationMode,
      expectBlocked: true,
      expectTier: 1,
    },
    {
      id: "ADV-OB-05",
      name: "Mixed Separators + Zero-Width Non-Joiner + Flooding",
      input: "n.\u200Ci_g-g*e r", // Mixed dot, underscore, dash, asterisk, space + \u200C
      mode: "private" as ModerationMode,
      expectBlocked: true,
      expectTier: 1,
    },
    {
      id: "ADV-OB-06",
      name: "Circled Latin + Flooding + Mixed Case (Tier 2 in Public)",
      input: "ⓕⓤⓤⓤⓒⓚⓚ", // Circled letters + flooded u + flooded k
      mode: "public" as ModerationMode,
      expectBlocked: true,
      expectTier: 2,
    },
    {
      id: "ADV-OB-07",
      name: "Circled Latin + Flooding (Tier 2 in Private - Permitted)",
      input: "ⓕⓤⓤⓤⓒⓚⓚ",
      mode: "private" as ModerationMode,
      expectBlocked: false,
    },
    {
      id: "ADV-OB-08",
      name: "Multi-layer Leet Profanity ($ + 1 + ! in Public)",
      input: "b!tch a$$hole",
      mode: "public" as ModerationMode,
      expectBlocked: true,
      expectTier: 2,
    },
    {
      id: "ADV-OB-09",
      name: "Multi-layer Leet Profanity ($ + 1 + ! in Private - Permitted)",
      input: "b!tch a$$hole",
      mode: "private" as ModerationMode,
      expectBlocked: false,
    },
    {
      id: "ADV-OB-10",
      name: "Anti-Latino Slur with Leet + Separators + Case Mixing",
      input: "w.3.t.b.@.c.k",
      mode: "private" as ModerationMode,
      expectBlocked: true,
      expectTier: 1,
    },
    {
      id: "ADV-OB-11",
      name: "Anti-Asian Slur with Leet + Dots + Zero-Width",
      input: "c.h.\uFEFF1.n.k", // \uFEFF zero-width no-break space
      mode: "private" as ModerationMode,
      expectBlocked: true,
      expectTier: 1,
    },
    {
      id: "ADV-OB-12",
      name: "Extremist Numeric Hate Slogan (1488) in Private",
      input: "We stand 1488 forever",
      mode: "private" as ModerationMode,
      expectBlocked: true,
      expectTier: 1,
    },
  ];

  for (const atk of obfuscationAttacks) {
    runTest(atk.id, "Obfuscation Attack", atk.name, () => {
      const res = checkContentModeration(atk.input, { mode: atk.mode });
      assert.equal(
        res.allowed,
        !atk.expectBlocked,
        `Expected allowed=${!atk.expectBlocked}, got allowed=${res.allowed} (reason: ${res.reason})`
      );
      if (atk.expectBlocked && atk.expectTier !== undefined) {
        assert.equal(
          res.tier,
          atk.expectTier,
          `Expected tier=${atk.expectTier}, got tier=${res.tier}`
        );
      }
    });
  }

  // --------------------------------------------------------------------------
  // SECTION 2: False Positive Stress Tests (Scunthorpe Prevention)
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 2: Scunthorpe False Positive Resistance ---");

  const dictionarySentences = [
    {
      id: "ADV-FP-01",
      sentence: "We passed the classical glass peacock exhibit during cocktail hour",
      desc: "Combined test: passed, classical, glass, peacock, cocktail",
    },
    {
      id: "ADV-FP-02",
      sentence: "The passenger took the compass to navigate the mountain passage",
      desc: "Multiple 'pass' substrings: passenger, compass, passage",
    },
    {
      id: "ADV-FP-03",
      sentence: "Charles Dickens read the classic novel to the classroom",
      desc: "Dickens and classic / classroom",
    },
    {
      id: "ADV-FP-04",
      sentence: "The assistant made an assumption about the asset allocation",
      desc: "Multiple 'ass' prefixes: assistant, assumption, asset",
    },
    {
      id: "ADV-FP-05",
      sentence: "The grasshopper jumped over the green grass near the looking-glass",
      desc: "Compound words: grasshopper, looking-glass",
    },
    {
      id: "ADV-FP-06",
      sentence: "She showed great compassion and gratitude for the title award",
      desc: "Compassion, gratitude, and title",
    },
    {
      id: "ADV-FP-07",
      sentence: "The chef added shiitake mushrooms and spice to the broth",
      desc: "Shiitake and spice",
    },
    {
      id: "ADV-FP-08",
      sentence: "The cockroach crawled under the cockpit door near the weathercock",
      desc: "Cockroach, cockpit, weathercock",
    },
    {
      id: "ADV-FP-09",
      sentence: "The Benedict Arnold verdict was impossible to predict under this jurisdiction",
      desc: "Benedict, verdict, predict, jurisdiction",
    },
    {
      id: "ADV-FP-10",
      sentence: "Scunthorpe is an industrial town in North Lincolnshire",
      desc: "Scunthorpe proper noun",
    },
    {
      id: "ADV-FP-11",
      sentence: "The sniggering chigger was a curious specimen",
      desc: "Snigger and chigger variants",
    },
    {
      id: "ADV-FP-12",
      sentence: "Massive biomass was discovered near the brass instruments",
      desc: "Massive, biomass, brass",
    },
    {
      id: "ADV-FP-13",
      sentence: "The constitution of the institution guarantees petite rights and identity",
      desc: "Constitution, institution, petite, identity",
    },
    {
      id: "ADV-FP-14",
      sentence: "An addictive personality can lead to bad habits",
      desc: "Addict substring in addictive",
    },
    {
      id: "ADV-FP-15",
      sentence: "The raccoon was conspicuous inside the cocoon",
      desc: "Raccoon, conspicuous, cocoon",
    },
  ];

  for (const item of dictionarySentences) {
    runTest(item.id, "Scunthorpe Resistance", item.desc, () => {
      // Must pass in PUBLIC mode without triggering Tier 1 or Tier 2
      const res = checkContentModeration(item.sentence, { mode: "public" });
      assert.equal(
        res.allowed,
        true,
        `Expected innocent sentence to be allowed in public mode, but was blocked! Reason: ${res.reason}, Matched: ${res.matchedTerm}`
      );
    });
  }

  // --------------------------------------------------------------------------
  // SECTION 3: Boundary & Resource Stress Tests
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 3: Boundary & Resource Stress Tests ---");

  runTest("ADV-BD-01", "Boundary", "Empty string with allowEmpty=true (default)", () => {
    const res = checkContentModeration("", { mode: "public" });
    assert.equal(res.allowed, true);
  });

  runTest("ADV-BD-02", "Boundary", "Empty string with allowEmpty=false", () => {
    const res = checkContentModeration("", { mode: "public", allowEmpty: false, field: "Title" });
    assert.equal(res.allowed, false);
    assert.ok(res.reason?.includes("cannot be empty"));
  });

  runTest("ADV-BD-03", "Boundary", "Whitespace-only string with allowEmpty=true", () => {
    const res = checkContentModeration("   \t  \n  ", { mode: "public" });
    assert.equal(res.allowed, true);
  });

  runTest("ADV-BD-04", "Boundary", "Whitespace-only string with allowEmpty=false", () => {
    const res = checkContentModeration("   \t  \n  ", { mode: "public", allowEmpty: false });
    assert.equal(res.allowed, false);
  });

  runTest("ADV-BD-05", "Boundary", "CJK Strings (Japanese, Chinese, Korean)", () => {
    const cjk = "こんにちは世界！这是一个非常好的游戏。이것은 아름다운 퍼즐입니다.";
    const res = checkContentModeration(cjk, { mode: "public" });
    assert.equal(res.allowed, true);
  });

  runTest("ADV-BD-06", "Boundary", "Arabic Strings (RTL script)", () => {
    const arabic = "مرحبا بالعالم، هذا اختبار لنظام الألعاب والكلمات المتقاطعة.";
    const res = checkContentModeration(arabic, { mode: "public" });
    assert.equal(res.allowed, true);
  });

  runTest("ADV-BD-07", "Boundary", "Emoji-only strings", () => {
    const emojis = "🎮🧩🏆✨🚀💯🔥🎲🎯🌟";
    const res = checkContentModeration(emojis, { mode: "public" });
    assert.equal(res.allowed, true);
  });

  runTest("ADV-BD-08", "Boundary", "Pure punctuation string", () => {
    const punct = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~";
    const res = checkContentModeration(punct, { mode: "public" });
    assert.equal(res.allowed, true);
  });

  // 10,000-character Stress & ReDoS Benchmark
  runTest("ADV-BD-09", "Resource Stress", "10,000-char clean text performance (<50ms, no ReDoS)", () => {
    const longClean = "puzzle glass classic passage ".repeat(350); // ~10,500 chars
    const start = performance.now();
    const res = checkContentModeration(longClean, { mode: "public" });
    const durationMs = performance.now() - start;
    assert.equal(res.allowed, true);
    assert.ok(durationMs < 50, `10k char check took ${durationMs.toFixed(2)}ms (threshold: 50ms)`);
  });

  runTest("ADV-BD-10", "Resource Stress", "10,000-char text with slur at start (index 0)", () => {
    const longWithSlur = "nigger " + "puzzle game classic ".repeat(500);
    const start = performance.now();
    const res = checkContentModeration(longWithSlur, { mode: "private" });
    const durationMs = performance.now() - start;
    assert.equal(res.allowed, false);
    assert.equal(res.tier, 1);
    assert.ok(durationMs < 50, `Took ${durationMs.toFixed(2)}ms`);
  });

  runTest("ADV-BD-11", "Resource Stress", "10,000-char text with slur at middle (index ~5000)", () => {
    const half = "puzzle game classic ".repeat(250);
    const longWithSlur = half + " n.1.g.g.3.r " + half;
    const start = performance.now();
    const res = checkContentModeration(longWithSlur, { mode: "private" });
    const durationMs = performance.now() - start;
    assert.equal(res.allowed, false);
    assert.equal(res.tier, 1);
    assert.ok(durationMs < 50, `Took ${durationMs.toFixed(2)}ms`);
  });

  runTest("ADV-BD-12", "Resource Stress", "10,000-char text with slur at end (index ~10000)", () => {
    const longWithSlur = "puzzle game classic ".repeat(500) + " k!ke";
    const start = performance.now();
    const res = checkContentModeration(longWithSlur, { mode: "private" });
    const durationMs = performance.now() - start;
    assert.equal(res.allowed, false);
    assert.equal(res.tier, 1);
    assert.ok(durationMs < 50, `Took ${durationMs.toFixed(2)}ms`);
  });

  // --------------------------------------------------------------------------
  // SECTION 4: Defensive Touchpoint Validation (game-storage & user-auth)
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 4: Touchpoint Defensive Error Handling ---");

  // game-storage.ts: submitPlayerJourney
  await runTest(
    "ADV-TP-01",
    "game-storage touchpoint",
    "submitPlayerJourney allows clean submission in public mode",
    async () => {
      const journey = {
        boardId: "2026-11-08",
        playerName: "Alex Clean",
        pick6: ["1", "2", "3", "4", "5", "6"],
        pick3: ["1", "2", "3"],
        pick1: "1",
        reflectionNote: "A wonderful peaceful puzzle.",
      };
      const res = await submitPlayerJourney(journey);
      assert.ok(res.id, "Expected journey to be created and returned");
      assert.equal(res.playerName, "Alex Clean");
    }
  );

  await runTest(
    "ADV-TP-02",
    "game-storage touchpoint",
    "submitPlayerJourney THROWS on Tier 2 profanity in public mode",
    async () => {
      const journey = {
        boardId: "2026-11-08", // Daily puzzle = public mode
        playerName: "Angry Player",
        pick6: ["1", "2", "3", "4", "5", "6"],
        pick3: ["1", "2", "3"],
        pick1: "1",
        reflectionNote: "This puzzle is fucking stupid.",
      };
      await assert.rejects(
        async () => {
          await submitPlayerJourney(journey);
        },
        (err: Error) => {
          assert.ok(
            err.message.includes("Profanity is not permitted in Reflection Note"),
            `Unexpected error message: ${err.message}`
          );
          return true;
        }
      );
    }
  );

  await runTest(
    "ADV-TP-03",
    "game-storage touchpoint",
    "submitPlayerJourney PERMITS casual swearing in private custom mode",
    async () => {
      const journey = {
        boardId: "custom-board-999", // Custom board = private mode
        playerName: "Casual Player",
        pick6: ["1", "2", "3", "4", "5", "6"],
        pick3: ["1", "2", "3"],
        pick1: "1",
        reflectionNote: "Damn that was a tough one, holy shit!",
      };
      const res = await submitPlayerJourney(journey);
      assert.ok(res.id, "Expected journey to succeed in custom private mode");
    }
  );

  await runTest(
    "ADV-TP-04",
    "game-storage touchpoint",
    "submitPlayerJourney THROWS on Tier 1 slur even in private custom mode",
    async () => {
      const journey = {
        boardId: "custom-board-999", // Custom board = private mode
        playerName: "Hate User",
        pick6: ["1", "2", "3", "4", "5", "6"],
        pick3: ["1", "2", "3"],
        pick1: "1",
        reflectionNote: "You are a n!gg3r",
      };
      await assert.rejects(
        async () => {
          await submitPlayerJourney(journey);
        },
        (err: Error) => {
          assert.ok(
            err.message.includes("hate speech or derogatory slurs in Reflection Note"),
            `Unexpected error message: ${err.message}`
          );
          return true;
        }
      );
    }
  );

  // game-storage.ts: saveUserCreated21Board
  await runTest(
    "ADV-TP-05",
    "game-storage touchpoint",
    "saveUserCreated21Board permits casual swearing in private custom board",
    async () => {
      const customBoard = {
        id: "custom-test-1",
        puzzleNumber: 999,
        title: "Damn Hard 21 Things",
        creatorName: "Creator",
        creatorHandle: "creator",
        creatorBio: "Just a badass puzzle",
        items: Array(21).fill("Fresh green grass"),
        sampleJourneys: [],
      };
      await saveUserCreated21Board(customBoard);
      // Success if no exception thrown
    }
  );

  await runTest(
    "ADV-TP-06",
    "game-storage touchpoint",
    "saveUserCreated21Board THROWS on Tier 1 slur in custom board items",
    async () => {
      const badBoard = {
        id: "custom-test-2",
        puzzleNumber: 1000,
        title: "Bad Board",
        creatorName: "Creator",
        creatorHandle: "creator",
        creatorBio: "Bio",
        items: [
          ...Array(20).fill("Fresh green grass"),
          "Shut up k!ke", // Tier 1 slur in tile 21
        ],
        sampleJourneys: [],
      };
      await assert.rejects(
        async () => {
          await saveUserCreated21Board(badBoard);
        },
        (err: Error) => {
          assert.ok(
            err.message.includes("hate speech or derogatory slurs in Tile #21"),
            `Unexpected error message: ${err.message}`
          );
          return true;
        }
      );
    }
  );

  // user-auth.ts: signUpWithEmail
  await runTest(
    "ADV-TP-07",
    "user-auth touchpoint",
    "signUpWithEmail rejects profane display name with ok=false",
    async () => {
      const res = await signUpWithEmail({
        email: "profane_user@example.com",
        password: "securePassword123",
        displayName: "Fuck You All",
        handle: "@cleanhandle",
      });
      assert.equal(res.ok, false);
      assert.ok(
        res.error?.includes("Profanity is not permitted in Display Name"),
        `Unexpected error: ${res.error}`
      );
    }
  );

  await runTest(
    "ADV-TP-08",
    "user-auth touchpoint",
    "signUpWithEmail rejects hate speech in handle with ok=false",
    async () => {
      const res = await signUpWithEmail({
        email: "slur_handle@example.com",
        password: "securePassword123",
        displayName: "Clean Name",
        handle: "@n1gg3r_user",
      });
      assert.equal(res.ok, false);
      assert.ok(
        res.error?.includes("hate speech or derogatory slurs in Handle"),
        `Unexpected error: ${res.error}`
      );
    }
  );

  // user-auth.ts: updateUserProfile
  await runTest(
    "ADV-TP-09",
    "user-auth touchpoint",
    "updateUserProfile rejects profane handle with ok=false",
    async () => {
      // Mock an active signed-in session locally
      saveActiveUserProfile(
        normalizeUserProfile({
          id: "mock-user-123",
        email: "test@example.com",
        displayName: "Old Name",
        handle: "oldhandle",
        role: "user",
        memberSince: new Date().toISOString(),
      }));

      const res = await updateUserProfile({
        handle: "fuck",
      });
      assert.equal(res.ok, false);
      assert.ok(
        res.error?.includes("Profanity is not permitted in Handle"),
        `Unexpected error: ${res.error}`
      );
    }
  );

  await runTest(
    "ADV-TP-10",
    "user-auth touchpoint",
    "updateUserProfile allows clean update with ok=true",
    async () => {
      saveActiveUserProfile(
        normalizeUserProfile({
          id: "mock-user-123",
        email: "test@example.com",
        displayName: "Old Name",
        handle: "oldhandle",
        role: "user",
        memberSince: new Date().toISOString(),
      }));

      const res = await updateUserProfile({
        displayName: "Verified Challenger",
        handle: "verified_challenger",
      });
      assert.equal(res.ok, true);
      assert.equal(res.profile?.displayName, "Verified Challenger");
    }
  );

  // --------------------------------------------------------------------------
  // SECTION 5: Empirical Remediation Verification (Remediated Vulnerabilities)
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 5: Empirical Remediation Verification ---");

  // VULN-01: 1488 blocked as Tier 1
  runTest(
    "VULN-01",
    "Remediated Vulnerability",
    "1488 numeric slogan blocked as Tier 1",
    () => {
      const res = checkContentModeration("1488", { mode: "private" });
      console.log(`       [REMEDIATED] "1488" -> allowed=${res.allowed}, tier=${res.tier}`);
      assert.equal(res.allowed, false, "1488 must be blocked");
      assert.equal(res.tier, 1, "1488 must be Tier 1");
    }
  );

  // VULN-02: Snake_case handle bypass in updateUserProfile
  await runTest(
    "VULN-02",
    "Remediated Vulnerability",
    "Snake_case profanity handle (@fuck_boss) is rejected by updateUserProfile moderation",
    async () => {
      saveActiveUserProfile(
        normalizeUserProfile({
          id: "mock-user-123",
          email: "test@example.com",
          displayName: "Test User",
          handle: "testuser",
          role: "user",
          memberSince: new Date().toISOString(),
        })
      );
      const res = await updateUserProfile({ handle: "fuck_boss" });
      console.log(`       [REMEDIATED] handle "fuck_boss" -> ok=${res.ok}, error=${res.error}`);
      assert.equal(res.ok, false, "Snake_case profanity handle must be rejected");
    }
  );

  // VULN-03: Slur evasion via non-standard separators (#, ~, /)
  runTest(
    "VULN-03",
    "Remediated Vulnerability",
    "Slurs with non-standard separators (c#h#i#n#k, s#p#i#c) are blocked as Tier 1",
    () => {
      const resChink = checkContentModeration("c#h#i#n#k", { mode: "private" });
      const resSpic = checkContentModeration("s#p#i#c", { mode: "private" });
      console.log(`       [REMEDIATED] "c#h#i#n#k" -> allowed=${resChink.allowed}, "s#p#i#c" -> allowed=${resSpic.allowed}`);
      assert.equal(resChink.allowed, false, "c#h#i#n#k must be blocked as Tier 1");
      assert.equal(resSpic.allowed, false, "s#p#i#c must be blocked as Tier 1");
    }
  );

  // VULN-04: Public profanity evasion via basic dots
  runTest(
    "VULN-04",
    "Remediated Vulnerability",
    "Public profanity with dotted separators (f.u.c.k, s.h.i.t) are blocked as Tier 2",
    () => {
      const resFuck = checkContentModeration("f.u.c.k", { mode: "public" });
      const resShit = checkContentModeration("s.h.i.t", { mode: "public" });
      console.log(`       [REMEDIATED] "f.u.c.k" -> allowed=${resFuck.allowed}, "s.h.i.t" -> allowed=${resShit.allowed}`);
      assert.equal(resFuck.allowed, false, "f.u.c.k must be blocked as Tier 2 in public");
      assert.equal(resShit.allowed, false, "s.h.i.t must be blocked as Tier 2 in public");
    }
  );

  // VULN-05: False positive on dictionary words
  runTest(
    "VULN-05",
    "Remediated Vulnerability",
    "Innocent dictionary word 'sniggering' is allowed in public mode",
    () => {
      const res = checkContentModeration("The child was sniggering quietly", { mode: "public" });
      console.log(`       [REMEDIATED] "sniggering" -> allowed=${res.allowed}`);
      assert.equal(res.allowed, true, "sniggering must be allowed in public mode");
    }
  );

  // --------------------------------------------------------------------------
  // Summary & Verdict Evaluation
  // --------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(` ADVERSARIAL STRESS TEST SUMMARY:`);
  console.log(` Core Adversarial Tests Executed: ${totalTests}`);
  console.log(` Passed: ${passedTests}`);
  console.log(` Failed: ${failedTests}`);
  console.log("================================================================================");

  if (failedTests > 0) {
    console.error(`\n❌ VERDICT: FAIL — ${failedTests} adversarial test(s) failed.`);
    process.exit(1);
  } else {
    console.log(`\n✅ VERDICT: PASS — All tests passed.`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal test runner crash:", err);
  process.exit(1);
});
