/**
 * Game #1 — 1 Win (`1-win`) Daily Community Gratitude Prompt Bank & Normalization Engine
 * Per GAME_DESIGN_BIBLE.md Q46–Q48:
 * - 100% blind free-text prompt before submission (max 4 words, max 35 characters).
 * - Canonical normalization (`normalizeOneWinEntry`) grouping punctuation, casing,
 *   leading articles, and simple plurals into a canonical key with clean Title Case display.
 * - Deterministic date-seeded baseline community wins merged with live Supabase rows.
 */

import { fnv1a32, mulberry32 } from "@/lib/seeded-random";
import {
  ROTATION_ANCHOR,
  daysBetweenDateKeys,
  getLocalDateKey,
  getPuzzleNumberForDate,
} from "@/lib/date-keys";

export const ONE_WIN_MAX_WORDS = 4;
export const ONE_WIN_MAX_CHARS = 35;

export const ONE_WIN_DEFAULT_PROMPT =
  "What is 1 win from your day today? Keep it short (1–4 words) to see how many others shared your win today!";

export interface OneWinSeedItem {
  normalizedKey: string;
  displayText: string;
  count: number;
}

export interface OneWinPromptPuzzle {
  id: string;
  puzzleNumber: number;
  title: string;
  prompt: string;
  subtitle: string;
  author: string;
  editor: string;
  seedCommunityWins: OneWinSeedItem[];
  customDate?: string;
}

export interface NormalizedOneWinEntry {
  valid: boolean;
  errors: string[];
  rawTrimmed: string;
  normalizedKey: string;
  displayText: string;
  wordCount: number;
  charCount: number;
}

const LEADING_ARTICLES = new Set(["a", "an", "the", "my"]);

const INVARIANT_SINGULAR_S = new Set([
  "focus",
  "peace",
  "progress",
  "fitness",
  "wellness",
  "mindfulness",
  "kindness",
  "stillness",
  "gratitude",
  "chess",
  "tennis",
  "pilates",
  "hummus",
  "oatmeal",
  "series",
  "news",
  "class",
  "glass",
  "grass",
  "pass",
  "boss",
  "loss",
  "less",
  "yes",
  "this",
  "his",
  "bus",
  "gas",
  "plus",
]);

const MINOR_TITLE_WORDS = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

function singularizeSimpleWord(word: string): string {
  if (word.length < 4 || INVARIANT_SINGULAR_S.has(word)) {
    return word;
  }
  if (
    word.endsWith("ss") ||
    word.endsWith("us") ||
    word.endsWith("is") ||
    word.endsWith("os") ||
    word.endsWith("ics")
  ) {
    return word;
  }
  if (word.endsWith("ies") && word.length >= 5) {
    return `${word.slice(0, -3)}y`;
  }
  if (
    (word.endsWith("ches") ||
      word.endsWith("shes") ||
      word.endsWith("xes") ||
      word.endsWith("zes")) &&
    word.length >= 5
  ) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && !word.endsWith("es")) {
    return word.slice(0, -1);
  }
  if (word.endsWith("es") && word.length >= 5) {
    // e.g. "dishes" handled above; words like "miles", "notes", "hikes", "games" -> keep final 'e'!
    return word.slice(0, -1);
  }
  return word;
}

export function toOneWinTitleCase(canonicalPhrase: string): string {
  const words = canonicalPhrase.trim().split(/\s+/).filter(Boolean);
  return words
    .map((w, idx) => {
      if (idx > 0 && idx < words.length - 1 && MINOR_TITLE_WORDS.has(w)) {
        return w;
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/**
 * Normalizes a free-text `1 Win` entry (Q46):
 * - Strips punctuation & emojis, collapses whitespace, lowercases.
 * - Enforces `1–4` words and `≤ 35` characters.
 * - Strips leading `a` / `an` / `the` / `my` when 2+ tokens remain and normalizes
 *   trailing plural `-s` on the final word so `"Deep sleep"`, `"deep sleep!"`,
 *   and `"  Deep Sleep "` all map to `"deep sleep"` -> `"Deep Sleep"`.
 */
export function normalizeOneWinEntry(raw: string): NormalizedOneWinEntry {
  const rawTrimmed = (raw ?? "").trim().replace(/\s+/g, " ");
  const charCount = Math.max(rawTrimmed.length, Array.from(rawTrimmed).length);
  const errors: string[] = [];

  if (!rawTrimmed) {
    return {
      valid: false,
      errors: ["Enter 1 win from your day (1–4 words)."],
      rawTrimmed: "",
      normalizedKey: "",
      displayText: "",
      wordCount: 0,
      charCount: 0,
    };
  }

  if (charCount > ONE_WIN_MAX_CHARS) {
    errors.push(`Keep your win under ${ONE_WIN_MAX_CHARS} characters (${charCount}/${ONE_WIN_MAX_CHARS}).`);
  }

  // Remove internal apostrophes cleanly, then strip emojis & non-alphanumeric symbols into spaces
  const cleaned = rawTrimmed
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const rawTokens = cleaned ? cleaned.split(" ").filter(Boolean) : [];
  const wordCount = rawTokens.length;

  if (wordCount === 0) {
    errors.push("Use at least 1 word with letters or numbers.");
  } else if (wordCount > ONE_WIN_MAX_WORDS) {
    errors.push(`Keep your win to 1–${ONE_WIN_MAX_WORDS} words (${wordCount} words entered).`);
  }

  const canonicalTokens = [...rawTokens];
  if (canonicalTokens.length >= 2 && LEADING_ARTICLES.has(canonicalTokens[0]!)) {
    canonicalTokens.shift();
  }
  if (canonicalTokens.length >= 1) {
    const lastIdx = canonicalTokens.length - 1;
    canonicalTokens[lastIdx] = singularizeSimpleWord(canonicalTokens[lastIdx]!);
  }

  const normalizedKey = canonicalTokens.join(" ").slice(0, ONE_WIN_MAX_CHARS).trim();
  const displayText = toOneWinTitleCase(normalizedKey).slice(0, ONE_WIN_MAX_CHARS).trim();

  if (!normalizedKey) {
    errors.push("Enter a valid 1–4 word win.");
  }

  return {
    valid: errors.length === 0,
    errors,
    rawTrimmed,
    normalizedKey,
    displayText,
    wordCount,
    charCount,
  };
}

/** Counts words live in the input bar using the same token logic as submission. */
export function countOneWinWords(raw: string): number {
  const cleaned = (raw ?? "")
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

const COMMUNITY_WIN_POOL: readonly string[] = [
  "Morning Walk",
  "Deep Sleep",
  "Drank Enough Water",
  "Called Mom",
  "Inbox Zero",
  "Made My Bed",
  "Cooked Dinner",
  "Morning Coffee",
  "Finished Workout",
  "Read Ten Pages",
  "Fresh Air",
  "Cleaned Kitchen",
  "No Snooze Button",
  "Good Conversation",
  "Walked Dog",
  "Stretched Today",
  "Finished Big Task",
  "Watched Sunset",
  "Early Gym Session",
  "Ate Healthy Lunch",
  "Took Deep Breaths",
  "Helped A Friend",
  "Wrote In Journal",
  "Finished A Book",
  "Phone Free Hour",
  "Afternoon Run",
  "Tidy Desk",
  "Laughed Hard",
  "On Time Today",
  "Morning Sunlight",
  "Yoga Practice",
  "Paid Bills",
  "Cold Shower",
  "Learned Something New",
  "Quiet Tea Break",
  "Watered Plants",
  "Family Dinner",
  "Power Nap",
  "Bike Ride",
  "Sent Thank You",
  "Folded Laundry",
  "Cleared Mind",
  "Early Bedtime",
  "Mindful Walk",
  "Zero Doomscrolling",
  "Creative Focus",
  "Grocery Run Done",
  "Played Music",
  "Warm Sunshine",
  "Kept My Promise",
  "Homemade Soup",
  "Patience Today",
  "Step Goal Hit",
  "Kind Word Shared",
  "Focused Work Block",
  "Clean Inbox",
];

const DAILY_THEMES: ReadonlyArray<{
  title: string;
  subtitle: string;
  prompt?: string;
}> = [
  {
    title: "Daily Gratitude Check-In",
    subtitle: "No win is too small — log yours blindly, then see where it ranks globally.",
    prompt: ONE_WIN_DEFAULT_PROMPT,
  },
  {
    title: "One Small Victory",
    subtitle: "Celebrate 1 bright moment from today alongside players everywhere.",
    prompt: "Name 1 small victory from your day today in 1–4 words to unlock the global Top 100!",
  },
  {
    title: "Evening Reflection",
    subtitle: "Pause for ten seconds and name 1 thing that went right today.",
    prompt: "What is 1 thing that went right for you today? Share it in 1–4 words!",
  },
  {
    title: "Shared Momentum",
    subtitle: "Short, honest wins connect thousands of days into one community board.",
    prompt: "What 1 positive habit or step forward did you complete today (1–4 words)?",
  },
  {
    title: "Quiet Triumph",
    subtitle: "From deep sleep to inbox zero — what was your #1 win today?",
    prompt: "What quiet triumph from today deserves a nod? Log it in 1–4 words!",
  },
  {
    title: "Bright Spot",
    subtitle: "Capture 1 win in 1–4 words before unlocking today's live Top 100.",
    prompt: "What was the brightest spot of your day today? Keep it to 1–4 words!",
  },
  {
    title: "Mindful Milestone",
    subtitle: "Every good day is built from simple moments of care and focus.",
    prompt: "What is 1 mindful moment or personal win you are grateful for today (1–4 words)?",
  },
  {
    title: "Daily Spark",
    subtitle: "See how many players around the world shared your exact highlight today.",
    prompt: "What sparked energy or joy in your day today? Enter 1–4 words!",
  },
  {
    title: "Forward Motion",
    subtitle: "Progress counts whether it is a finished project or a ten-minute walk.",
    prompt: "What is 1 way you moved forward or took care of yourself today (1–4 words)?",
  },
  {
    title: "Gratitude Pulse",
    subtitle: "Log your #1 win blindly before the live community board reveals.",
    prompt: "In 1–4 words, what is 1 win from today that made you smile?",
  },
  {
    title: "Golden Minute",
    subtitle: "One honest phrase is all it takes to anchor the day in gratitude.",
    prompt: "What was 1 golden minute or highlight from your day today (1–4 words)?",
  },
  {
    title: "Simple Accomplishment",
    subtitle: "Real life wins are simple, human, and surprisingly universal.",
    prompt: "What is 1 simple accomplishment from your day today? Keep it to 1–4 words!",
  },
];

export function buildSeedCommunityWins(seedKey: string): OneWinSeedItem[] {
  const rng = mulberry32(fnv1a32(`1-win:community:${seedKey}`));
  const pool = [...COMMUNITY_WIN_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }

  const countPicked = 42;
  const items: OneWinSeedItem[] = [];
  for (let i = 0; i < countPicked && i < pool.length; i++) {
    const norm = normalizeOneWinEntry(pool[i]!);
    if (!norm.valid) continue;
    // Zipf-like realistic community distribution (top wins ~48–95, tail ~2–14)
    const base = Math.max(2, Math.round(88 / Math.pow(i + 1.35, 0.72)));
    const jitter = Math.floor(rng() * 6);
    items.push({
      normalizedKey: norm.normalizedKey,
      displayText: norm.displayText,
      count: base + jitter,
    });
  }
  return items;
}

export function validateOneWinPuzzle(
  candidate: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!candidate || typeof candidate !== "object") {
    return { valid: false, errors: ["Puzzle must be an object."] };
  }
  const p = candidate as Partial<OneWinPromptPuzzle>;
  if (!p.title || typeof p.title !== "string" || !p.title.trim()) {
    errors.push("Missing prompt title.");
  }
  if (!p.prompt || typeof p.prompt !== "string" || p.prompt.trim().length < 10) {
    errors.push("Prompt must be at least 10 characters.");
  }
  if (!Array.isArray(p.seedCommunityWins) || p.seedCommunityWins.length < 5) {
    errors.push("seedCommunityWins must include at least 5 baseline entries.");
  }
  return { valid: errors.length === 0, errors };
}

export function isOneWinPuzzle(value: unknown): value is OneWinPromptPuzzle {
  return validateOneWinPuzzle(value).valid;
}

export function generateOneWinPuzzle(
  seedKey: string,
  meta?: {
    id?: string;
    puzzleNumber?: number;
    customDate?: string;
    title?: string;
    prompt?: string;
    subtitle?: string;
  }
): OneWinPromptPuzzle {
  const idx = fnv1a32(`1-win:theme:${seedKey}`) % DAILY_THEMES.length;
  const picked = DAILY_THEMES[idx]!;
  return {
    id: meta?.id ?? `1w-${seedKey}`,
    puzzleNumber: meta?.puzzleNumber ?? 1,
    title: meta?.title?.trim() || picked.title,
    prompt: meta?.prompt?.trim() || picked.prompt || ONE_WIN_DEFAULT_PROMPT,
    subtitle: meta?.subtitle?.trim() || picked.subtitle,
    author: "SOL Theory",
    editor: "Daily Editorial",
    seedCommunityWins: buildSeedCommunityWins(seedKey),
    ...(meta?.customDate ? { customDate: meta.customDate } : {}),
  };
}

export const ONE_WIN_BANK_SIZE = 66;

export const ONE_WIN_PUZZLES: OneWinPromptPuzzle[] = Array.from(
  { length: ONE_WIN_BANK_SIZE },
  (_, idx) =>
    generateOneWinPuzzle(`bank:v1:${idx}`, {
      id: `1w-bank-${String(idx + 1).padStart(2, "0")}`,
      puzzleNumber: idx + 1,
    })
);

const ONE_WIN_DATE_CACHE = new Map<string, OneWinPromptPuzzle>();

/**
 * Deterministic, cached, non-repeating 2026–2027 bank resolution for 1 Win.
 * - For `0 <= diff < 66`, returns `ONE_WIN_PUZZLES[diff]`.
 * - For all other dates, deterministically synthesizes and caches a unique
 *   daily gratitude prompt and baseline community leaderboard for `dateKey`.
 */
export function getOneWinPuzzleForDate(
  dateKey: string = getLocalDateKey()
): OneWinPromptPuzzle {
  const puzzleNumber = getPuzzleNumberForDate(dateKey);
  const diff = daysBetweenDateKeys(ROTATION_ANCHOR, dateKey);
  if (diff >= 0 && diff < ONE_WIN_PUZZLES.length) {
    const base = ONE_WIN_PUZZLES[diff]!;
    return {
      ...base,
      puzzleNumber,
      customDate: dateKey,
    };
  }

  const cached = ONE_WIN_DATE_CACHE.get(dateKey);
  if (cached) {
    return {
      ...cached,
      puzzleNumber,
      customDate: dateKey,
    };
  }

  const seqIdx = diff >= 0 ? diff : 50000 - diff;
  const theme = DAILY_THEMES[seqIdx % DAILY_THEMES.length]!;
  const round = Math.floor(seqIdx / DAILY_THEMES.length) + 1;
  const editionWords = [
    "Morning",
    "Evening",
    "Midday",
    "Golden",
    "Mindful",
    "Community",
    "Bright",
    "Shared",
    "Peaceful",
    "Steady",
  ] as const;
  const editionWord = editionWords[round % editionWords.length]!;
  const vol = Math.floor(round / editionWords.length) + 1;
  const synthesized = generateOneWinPuzzle(`bank:date:${dateKey}`, {
    id: `ow-bank-${dateKey}`,
    puzzleNumber,
    customDate: dateKey,
    title: `${theme.title} · ${editionWord} Vol. ${vol}`,
    prompt: theme.prompt || ONE_WIN_DEFAULT_PROMPT,
    subtitle: theme.subtitle,
  });

  ONE_WIN_DATE_CACHE.set(dateKey, synthesized);
  return synthesized;
}

export function generateSeededOneWinPuzzle(
  dateKey: string,
  puzzleNumber: number
): OneWinPromptPuzzle {
  return generateOneWinPuzzle(`date:${dateKey}`, {
    id: `1w-${dateKey}`,
    puzzleNumber,
    customDate: dateKey,
  });
}

export function generateOneWinMonthlyBatch(
  year: number,
  month: number
): Record<string, OneWinPromptPuzzle> {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out: Record<string, OneWinPromptPuzzle> = {};
  const mm = String(month).padStart(2, "0");
  for (let day = 1; day <= daysInMonth; day++) {
    const dd = String(day).padStart(2, "0");
    const dateKey = `${year}-${mm}-${dd}`;
    out[dateKey] = generateOneWinPuzzle(`date:${dateKey}`, {
      id: `1w-${dateKey}`,
      puzzleNumber: getPuzzleNumberForDate(dateKey),
      customDate: dateKey,
    });
  }
  return out;
}

export function buildOneWinShareText(opts: {
  puzzleNumber: number;
  displayText: string;
  rank: number;
  sharedCount: number;
}): string {
  const othersLabel =
    opts.sharedCount === 1
      ? "1st to log this win today!"
      : `Shared by ${opts.sharedCount} players today`;
  return [
    `🏆 1 Win #${opts.puzzleNumber}`,
    `"${opts.displayText}"`,
    `Global Rank #${opts.rank} · ${othersLabel}`,
    `✨ 1 → 100 Community Gratitude`,
  ].join("\n");
}
