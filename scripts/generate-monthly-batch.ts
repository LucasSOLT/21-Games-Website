#!/usr/bin/env node
/**
 * Monthly Rolling Buffer (`Month M+2`) Generator & Solver Verifier CLI
 * Per GAME_DESIGN_BIBLE.md §0.2 & §0.3.
 *
 * Usage:
 *   npm run generate-batch -- --dry-run
 *   npm run generate-batch -- --month=2027-01 --dry-run
 *   npm run generate-batch -- --month=2027-01 --out=/tmp/batch-2027-01.json
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";

register("./test-resolver.mjs", import.meta.url);

const batchLib = await import("@/lib/monthly-batch");
type AIProvider = import("@/lib/ai-helper").AIProvider;

const rawArgs = process.argv.slice(2);
let dryRun = false;
let monthOverride: string | null = null;
let outPath: string | null = null;
let providerOverride: AIProvider | undefined;

for (const arg of rawArgs) {
  if (arg === "--dry-run" || arg === "-n") {
    dryRun = true;
  } else if (arg.startsWith("--month=")) {
    monthOverride = arg.slice("--month=".length).trim();
  } else if (arg.startsWith("--out=")) {
    outPath = arg.slice("--out=".length).trim();
  } else if (arg.startsWith("--provider=")) {
    const p = arg.slice("--provider=".length).trim();
    if (p === "gemini" || p === "openrouter" || p === "local") {
      providerOverride = p;
    }
  } else if (/^\d{4}-\d{2}$/.test(arg)) {
    monthOverride = arg;
  }
}

const targetInfo = monthOverride
  ? batchLib.parseMonthKey(monthOverride)
  : batchLib.getTargetMonthMPlus2();

if (!targetInfo) {
  console.error(
    `Invalid --month="${monthOverride}". Expected YYYY-MM (e.g. 2027-01).`
  );
  process.exit(1);
}

const startedAt = Date.now();
const report = batchLib.generateAndVerifyMonthlyBatch(
  targetInfo.year,
  targetInfo.month,
  providerOverride ? { preferredProvider: providerOverride } : undefined
);
const elapsedMs = Date.now() - startedAt;

console.log(
  `\n========================================================================`
);
console.log(
  ` SOL GaMES (21 → 1) · Monthly Rolling Buffer Batch (${report.label})`
);
console.log(
  `========================================================================`
);
console.log(
  ` Target Month : ${report.monthKey} (${report.daysInMonth} days) · Mode: ${
    dryRun ? "DRY-RUN (no disk/DB writes)" : "LIVE"
  }`
);
console.log(
  ` AI Provider  : ${report.aiProvider} (Gemini 2.5 Flash Free Tier default -> OpenRouter -> Local)`
);
console.log(
  `------------------------------------------------------------------------`
);

for (const g of report.games) {
  const badge = g.allValid ? "PASS" : "FAIL";
  const numTag = `#${String(g.countdownNumber).padStart(2, " ")}`;
  const nameTag = g.name.padEnd(16, " ");
  const tierTag = g.tier.padEnd(12, " ");
  const countTag = `${g.daysVerified}/${g.daysTotal} days`;
  console.log(
    ` [${badge}] ${numTag} ${nameTag} | ${tierTag} | ${countTag} | ${g.solverNote}`
  );
  if (!g.allValid) {
    for (const err of g.errors.slice(0, 5)) {
      console.error(`        -> ${err}`);
    }
  }
}

console.log(
  `------------------------------------------------------------------------`
);
console.log(
  ` Total Verified: ${report.verifiedPuzzles} / ${report.totalPuzzles} daily puzzles in ${elapsedMs}ms · Overall: ${
    report.allValid ? "ALL 9 GAMES PASS" : "FAILED"
  }`
);
console.log(
  `========================================================================\n`
);

if (outPath && !dryRun) {
  const resolved = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(report, null, 2), "utf8");
  console.log(`Wrote monthly batch JSON (${report.rows.length} rows) -> ${resolved}`);
}

process.exit(report.allValid ? 0 : 1);
