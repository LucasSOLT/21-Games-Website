/**
 * Monthly Rolling Buffer (`Month M+2`) Generator & Multi-Solver Verifier
 * Per GAME_DESIGN_BIBLE.md §0.2 & §0.3:
 * - Always prepares calendar month `M+2` ahead of today so SOL GaMES maintains a 60+ day runway.
 * - Generates and solver-verifies all 9 countdown games (`21 → 1`) across every day of the target month:
 *   • Automated algorithmic games (`eightfold-echo`, `four-score`, `move-2`, `1-win`) run full
 *     constraint/BFS/arithmetic/normalizer verification on every generated date.
 *   • Editorial / AI-assisted games (`21-things`, `17-syllables`, `9-rhymes`, `6-pics`, `connect-5`)
 *     resolve deterministic daily schedules and validate every payload + Tier 1/2 public moderation.
 * - Zero-cost default: respects `AIProvider` (`gemini` `gemini-2.5-flash` Free Tier -> `openrouter` -> `local`).
 */

import { validateNineRhymesPuzzle } from "@/data/puzzles/9-rhymes";
import { validateSixPicsPuzzle } from "@/data/puzzles/6-pics";
import {
  generateOneWinMonthlyBatch,
  validateOneWinPuzzle,
} from "@/data/puzzles/1-win";
import { validateHaikuStructure } from "@/data/puzzles/17-syllables";
import {
  resolveAIProvider,
  type AIHelperConfig,
  type AIProvider,
} from "@/lib/ai-helper";
import { collectPayloadStrings } from "@/lib/custom-puzzles";
import { getDailyPuzzleForGame } from "@/lib/daily-engine";
import {
  ALL_GAMES,
  ALL_GAME_SLUGS,
  GAME_COUNTDOWN_NUMBER,
  type AllGameSlug,
} from "@/lib/games-config";
import {
   ECHO_START_INDEX,
  generateEightfoldEchoMonthlyBatch,
  solveEightfoldEcho,
  validateEightfoldEchoPuzzle,
} from "@/lib/generators/eightfold-echo-generator";
import {
  FOUR_SCORE_TARGET,
  generateFourScoreMonthlyBatch,
  solveFourScore,
  validateFourScorePuzzle,
} from "@/lib/generators/four-score-generator";
import {
  generateMoveTwoMonthlyBatch,
  solveMoveTwo,
  validateMoveTwoPuzzle,
} from "@/lib/generators/move-two-generator";
import { moderateText } from "@/lib/moderation";
import { getPuzzleSource } from "@/lib/puzzle-sources";
import {
  validate21ThingsPayload,
  validateConnect5Payload,
} from "@/lib/seeded-random";

export const AI_PROVIDER_PREF_KEY = "solgames_ai_provider_pref";

export function getPreferredAIProvider(): AIProvider {
  if (typeof window === "undefined") return "gemini";
  try {
    const raw = window.localStorage.getItem(AI_PROVIDER_PREF_KEY);
    if (raw === "gemini" || raw === "openrouter" || raw === "local") {
      return raw;
    }
  } catch {
    // Ignore storage access errors
  }
  return "gemini";
}

export function setPreferredAIProvider(provider: AIProvider): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AI_PROVIDER_PREF_KEY, provider);
    window.dispatchEvent(
      new CustomEvent("solgames:ai-provider-changed", { detail: { provider } })
    );
  } catch {
    // Ignore storage access errors
  }
}

export interface TargetMonthInfo {
  year: number;
  month: number; // 1..12
  monthKey: string; // YYYY-MM
  label: string; // e.g. "January 2027"
  daysInMonth: number;
}

export function buildMonthInfo(year: number, month: number): TargetMonthInfo {
  const normalizedDate = new Date(Date.UTC(year, month - 1, 1));
  const y = normalizedDate.getUTCFullYear();
  const m = normalizedDate.getUTCMonth() + 1;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthKey = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(normalizedDate);
  return { year: y, month: m, monthKey, label, daysInMonth };
}

/** Computes rolling buffer target `Month M+2` relative to `refDate` (defaults to today). */
export function getTargetMonthMPlus2(refDate: Date = new Date()): TargetMonthInfo {
  return buildMonthInfo(refDate.getUTCFullYear(), refDate.getUTCMonth() + 3);
}

export function parseMonthKey(monthKey: string): TargetMonthInfo | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!m) return null;
  const year = Number.parseInt(m[1]!, 10);
  const month = Number.parseInt(m[2]!, 10);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return buildMonthInfo(year, month);
}

export type GameGenerationTier = "auto-solver" | "editorial-ai";

export const GAME_GENERATION_TIER: Record<AllGameSlug, GameGenerationTier> = {
  "21-things": "editorial-ai",
  "17-syllables": "editorial-ai",
  "9-rhymes": "editorial-ai",
  "eightfold-echo": "auto-solver",
  "6-pics": "editorial-ai",
  "connect-5": "editorial-ai",
  "four-score": "auto-solver",
  "move-2": "auto-solver",
  "1-win": "auto-solver",
};

export interface DailyPuzzleBatchRow {
  game_slug: AllGameSlug;
  puzzle_date: string;
  title: string;
  author: string;
  editor: string;
  puzzle_number: number;
  payload: unknown;
  tier: GameGenerationTier;
  solverDetail: string;
  valid: boolean;
  errors: string[];
}

export interface MonthlyGameBatchSummary {
  slug: AllGameSlug;
  name: string;
  countdownNumber: number;
  tier: GameGenerationTier;
  daysTotal: number;
  daysVerified: number;
  allValid: boolean;
  solverNote: string;
  errors: string[];
}

export interface MonthlyBatchReport {
  year: number;
  month: number;
  monthKey: string;
  label: string;
  daysInMonth: number;
  aiProvider: AIProvider;
  allValid: boolean;
  totalPuzzles: number;
  verifiedPuzzles: number;
  games: MonthlyGameBatchSummary[];
  rows: DailyPuzzleBatchRow[];
}

function checkPublicPayloadModeration(payload: unknown): string[] {
  const strings = collectPayloadStrings(payload);
  const errs: string[] = [];
  for (const [field, s] of Object.entries(strings)) {
    const mod = moderateText(s, "public");
    if (!mod.allowed) {
      errs.push(`Moderation (${mod.tier ?? "flag"} on ${field}): ${mod.reason ?? "blocked"}`);
      break;
    }
  }
  return errs;
}

function verifySingleGamePayload(
  slug: AllGameSlug,
  payload: unknown
): { valid: boolean; solverDetail: string; errors: string[] } {
  const errors: string[] = [];
  const source = getPuzzleSource(slug);
  if (!source) {
    return {
      valid: false,
      solverDetail: "Missing puzzle source",
      errors: [`No registered puzzle source for ${slug}`],
    };
  }
  if (!source.validate(payload)) {
    errors.push(`Source validator rejected ${slug} payload`);
  }

  let solverDetail = "Schema + moderation verified";

  switch (slug) {
    case "21-things": {
      const check = validate21ThingsPayload(payload);
      if (!check.valid) errors.push(...check.errors);
      solverDetail = "21 distinct tiles + ≤45ch verified";
      break;
    }
    case "17-syllables": {
      const p = payload as { lines?: [string, string, string] };
      if (Array.isArray(p.lines) && p.lines.length === 3) {
        const check = validateHaikuStructure(p.lines);
        if (!check.isValid) {
          errors.push(`Haiku 5-7-5 invalid: ${check.counts.join("-")}`);
        }
        solverDetail = `5-7-5 haiku verified (${check.counts.join("-")})`;
      } else {
        errors.push("Missing 3 haiku lines");
      }
      break;
    }
    case "9-rhymes": {
      const check = validateNineRhymesPuzzle(payload);
      if (!check.valid) errors.push(...check.errors);
      solverDetail = "1 starter + 9 single-rhyme clues verified";
      break;
    }
    case "eightfold-echo": {
      const check = validateEightfoldEchoPuzzle(payload);
      if (!check.valid) {
        errors.push(...check.errors);
      } else {
        const p = payload as { tiles: Parameters<typeof solveEightfoldEcho>[0] };
        const solved = solveEightfoldEcho(p.tiles, ECHO_START_INDEX, 2);
        if (solved.count !== 1) {
          errors.push(`Expected 1 unique Hamiltonian chain, got ${solved.count}`);
        }
        solverDetail = `Unique 0→8 chain (${solved.ambiguousSteps} branch steps)`;
      }
      break;
    }
    case "6-pics": {
      const check = validateSixPicsPuzzle(payload);
      if (!check.valid) errors.push(...check.errors);
      solverDetail = "6 progressive clues + captions verified";
      break;
    }
    case "connect-5": {
      const check = validateConnect5Payload(payload);
      if (!check.valid) errors.push(...check.errors);
      solverDetail = "5-row compound chain verified";
      break;
    }
    case "four-score": {
      const check = validateFourScorePuzzle(payload);
      if (!check.valid) {
        errors.push(...check.errors);
      } else {
        const p = payload as {
          digits: Parameters<typeof solveFourScore>[0];
          operators: Parameters<typeof solveFourScore>[1];
        };
        const solved = solveFourScore(p.digits, p.operators, FOUR_SCORE_TARGET);
        if (!solved.solvable) {
          errors.push("Full-board solver could not reach 80");
        }
        solverDetail = `Full-board = 80 (${solved.canonicalEquation ?? "ok"})`;
      }
      break;
    }
    case "move-2": {
      const check = validateMoveTwoPuzzle(payload);
      if (!check.valid) {
        errors.push(...check.errors);
      } else {
        const p = payload as Parameters<typeof solveMoveTwo>[0] & { par: number };
        const solved = solveMoveTwo(p);
        if (!solved.solvable || solved.minMoves !== p.par) {
          errors.push(`BFS par mismatch (${solved.minMoves} vs ${p.par})`);
        }
        solverDetail = `6-face BFS Par ${p.par} verified`;
      }
      break;
    }
    case "1-win": {
      const check = validateOneWinPuzzle(payload);
      if (!check.valid) errors.push(...check.errors);
      solverDetail = "Prompt + normalized community seed verified";
      break;
    }
  }

  errors.push(...checkPublicPayloadModeration(payload));

  return {
    valid: errors.length === 0,
    solverDetail,
    errors,
  };
}

/**
 * Generates and solver-verifies all 9 countdown games for every day in `(year, month)`.
 */
export function generateAndVerifyMonthlyBatch(
  year: number,
  month: number,
  aiConfig?: AIHelperConfig
): MonthlyBatchReport {
  const info = buildMonthInfo(year, month);
  const aiProvider = resolveAIProvider(aiConfig);

  // Pre-build the 4 dedicated auto-solver monthly batches
  const echoBatch = generateEightfoldEchoMonthlyBatch(info.year, info.month);
  const fourScoreBatch = generateFourScoreMonthlyBatch(info.year, info.month);
  const moveTwoBatch = generateMoveTwoMonthlyBatch(info.year, info.month);
  const oneWinBatch = generateOneWinMonthlyBatch(info.year, info.month);

  const rows: DailyPuzzleBatchRow[] = [];
  const games: MonthlyGameBatchSummary[] = [];

  for (const slug of ALL_GAME_SLUGS) {
    const gameMeta = ALL_GAMES.find((g) => g.slug === slug)!;
    const source = getPuzzleSource(slug)!;
    const tier = GAME_GENERATION_TIER[slug];
    let daysVerified = 0;
    const gameErrors: string[] = [];
    let sampleSolverNote = "";

    for (let day = 1; day <= info.daysInMonth; day++) {
      const dateKey = `${info.monthKey}-${String(day).padStart(2, "0")}`;

      let payload: unknown;
      if (slug === "eightfold-echo") {
        payload = echoBatch[dateKey];
      } else if (slug === "four-score") {
        payload = fourScoreBatch[dateKey];
      } else if (slug === "move-2") {
        payload = moveTwoBatch[dateKey];
      } else if (slug === "1-win") {
        payload = oneWinBatch[dateKey];
      } else {
        const resolved = getDailyPuzzleForGame(slug, dateKey);
        payload = resolved?.puzzle ?? source.generateSeeded(dateKey);
      }

      const verification = verifySingleGamePayload(slug, payload);
      if (!sampleSolverNote) {
        sampleSolverNote = verification.solverDetail;
      }
      if (verification.valid) {
        daysVerified += 1;
      } else {
        gameErrors.push(
          `${dateKey}: ${verification.errors.join("; ") || "Invalid"}`
        );
      }

      const summary = source.summarize(payload as never, dateKey);
      rows.push({
        game_slug: slug,
        puzzle_date: dateKey,
        title: summary.title,
        author: summary.author,
        editor: summary.editor,
        puzzle_number: summary.puzzleNumber,
        payload,
        tier,
        solverDetail: verification.solverDetail,
        valid: verification.valid,
        errors: verification.errors,
      });
    }

    games.push({
      slug,
      name: gameMeta.name,
      countdownNumber: GAME_COUNTDOWN_NUMBER[slug],
      tier,
      daysTotal: info.daysInMonth,
      daysVerified,
      allValid: daysVerified === info.daysInMonth && gameErrors.length === 0,
      solverNote: sampleSolverNote,
      errors: gameErrors,
    });
  }

  const totalPuzzles = rows.length;
  const verifiedPuzzles = rows.filter((r) => r.valid).length;
  const allValid =
    verifiedPuzzles === totalPuzzles && games.every((g) => g.allValid);

  return {
    year: info.year,
    month: info.month,
    monthKey: info.monthKey,
    label: info.label,
    daysInMonth: info.daysInMonth,
    aiProvider,
    allValid,
    totalPuzzles,
    verifiedPuzzles,
    games,
    rows,
  };
}
