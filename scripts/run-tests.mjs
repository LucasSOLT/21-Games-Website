#!/usr/bin/env node
/**
 * Sequential test runner for `npm test`.
 * Every entry is executed with `node --experimental-strip-types`; the first
 * failure aborts the run with a non-zero exit code.
 */
import { spawnSync } from "node:child_process";

const SUITES = [
  ["scripts/test-check-reveal.ts"],
  ["--test", "src/lib/__tests__/win-screen-share.test.ts"],
  ["scripts/test-cp01-zoom.ts"],
  ["scripts/test-cp02-multigame.ts"],
  ["scripts/test-cp03-9rhymes.ts"],
  ["scripts/test-cp04-eightfold-echo.ts"],
  ["scripts/test-cp05-6pics.ts"],
  ["scripts/test-cp06-four-score.ts"],
  ["scripts/test-cp07-parity.ts"],
  ["scripts/test-cp08-move-two.ts"],
];

let failed = false;
for (const args of SUITES) {
  const label = args.join(" ");
  console.log(`\n>>> node ${label}`);
  const res = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", ...args],
    { stdio: "inherit", env: process.env }
  );
  if (res.status !== 0) {
    console.error(`\n!!! SUITE FAILED: ${label} (exit ${res.status})`);
    failed = true;
    break;
  }
}
process.exit(failed ? 1 : 0);
