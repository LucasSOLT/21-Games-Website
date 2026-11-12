/**
 * Tiny dependency-free assertion kit shared by the checkpoint test scripts.
 * Usage:  import { createKit } from "./test-kit.mjs";
 */
export function createKit(title) {
  let passed = 0;
  let failed = 0;
  console.log(`\n=== ${title} ===`);
  return {
    assert(condition, name, detail) {
      if (condition) {
        passed++;
        console.log(`  ✓ ${name}`);
      } else {
        failed++;
        console.error(`  ✗ FAIL: ${name}${detail ? ` (${detail})` : ""}`);
      }
    },
    eq(actual, expected, name) {
      const ok = JSON.stringify(actual) === JSON.stringify(expected);
      if (ok) {
        passed++;
        console.log(`  ✓ ${name}`);
      } else {
        failed++;
        console.error(
          `  ✗ FAIL: ${name} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`
        );
      }
    },
    finish() {
      console.log(`--- ${title}: ${passed} passed, ${failed} failed ---\n`);
      process.exit(failed > 0 ? 1 : 0);
    },
  };
}
