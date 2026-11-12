/**
 * Content Moderation Engine
 * Architecture: SOL GaMES (21games.ai) — Requirement R2 / Batch 1
 * Location: src/lib/moderation.ts
 *
 * Implements a resilient two-tier content moderation system:
 * - Tier 1: Universal ban on hate speech, racial slurs, derogatory terms,
 *   and severe harassment everywhere (both public daily modes and private custom link-shared games).
 * - Tier 2: Public mode block on general profanity and casual swearing (daily games,
 *   public leaderboards, user profiles, admin studio), while permitting casual swearing
 *   in private custom link-shared games (`?b=<id>`).
 * - Scunthorpe problem prevention with strict token boundaries and an explicit innocent allowlist.
 * - 6-stage normalization pipeline to defeat leetspeak, homoglyphs, repeated character flooding,
 *   invisible characters, and separator interleaving.
 */

export type ModerationMode = "public" | "private";

export interface ModerationContext {
  mode: ModerationMode;
  field?: string;
  allowEmpty?: boolean; // defaults to true
  allowProfanityInPrivate?: boolean; // defaults to true
}

export type ModerationOptions = ModerationContext;

export interface ModerationResult {
  allowed: boolean;
  tier?: 1 | 2;
  reason?: string;
  flaggedReason?: string;
  field?: string;
  matchedTerm?: string;
  flaggedWord?: string;
  sanitized?: string;
  sanitizedText?: string;
}

export interface ModerationBatchItem {
  text: string;
  field: string;
}

/**
 * Common words that contain substrings identical to profanities or slurs.
 * These words must NEVER be flagged as violations.
 */
export const INNOCENT_ALLOWLIST: ReadonlySet<string> = new Set([
  // "ass" substrings
  "pass", "passage", "passenger", "passport", "compass", "trespass",
  "glass", "sunglasses", "hourglass", "wineglass", "looking-glass",
  "grass", "bluegrass", "lemongrass", "grasshopper",
  "class", "classic", "classical", "classmate", "classroom", "classify",
  "mass", "massive", "biomass",
  "brass", "bass",
  "asset", "assert", "assertion", "assist", "assistance", "assistant",
  "associate", "association", "assume", "assumption", "assure", "assurance",
  "assemble", "assembly", "assess", "assessment",
  "passive", "passion", "compassion", "compassionate",
  "embarrass", "harass", "harassment",
  "cassette", "molasses", "potassium", "sassafras",

  // "cock" substrings
  "peacock", "cocktail", "cockpit", "cockroach", "shuttlecock",
  "woodcock", "weathercock", "stopcock", "hancock",

  // "dick" substrings
  "dickens", "dickinson", "benedict", "verdict", "predict", "addict",
  "jurisdiction", "contradict",

  // "tit" substrings
  "title", "entity", "attitude", "petite", "constitution", "appetite",
  "institution", "quantity", "identity", "titan", "titanic", "gratitude",

  // "cunt" substrings
  "scunthorpe",

  // Botanical / culinary / literary
  "snigger", "sniggers", "sniggered", "sniggering", "sniggerer", "sniggerers",
  "chigger", "chiggers", "nigella", "shiitake", "shitake",
  "spice", "spicy", "spices", "spiced", "spicing", "hospice", "hospices", "auspicious", "suspicion", "suspicious",
  "raccoon", "cocoon", "conspicuous", "despicable"
]);

// Homoglyphs map for Cyrillic and Greek characters to ASCII Latin
const HOMOGLYPHS: Record<string, string> = {
  // Cyrillic Lowercase
  а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x", і: "i", ј: "j", ѕ: "s",
  в: "b", к: "k", м: "m", т: "t", п: "n", г: "r", б: "b", д: "d", з: "z", л: "l",
  // Cyrillic Uppercase
  А: "a", В: "b", Г: "r", Д: "d", Е: "e", З: "z", І: "i", Ј: "j", К: "k", Л: "l",
  М: "m", О: "o", П: "n", Р: "p", С: "c", Т: "t", У: "y", Х: "x", Ѕ: "s", Б: "b",
  // Greek Lowercase
  α: "a", ο: "o", ρ: "p", ι: "i", ν: "v", ε: "e", κ: "k", τ: "t", υ: "u", η: "n",
  // Greek Uppercase
  Α: "a", Ο: "o", Ρ: "p", Ι: "i", Ν: "v", Ε: "e", Κ: "k", Τ: "t", Υ: "u", Η: "n"
};

/**
 * 6-Stage Normalization Pipeline:
 * 1. Strip invisible / zero-width characters (U+200B-U+200D, U+FEFF, U+00AD, U+2060).
 * 2. Unicode NFKD decomposition (strips combining diacritics).
 * 3. Homoglyph mapping (Cyrillic, Greek, fullwidth, circled).
 * 4. Lowercasing & trimming.
 * 5. Leetspeak / symbol translation (@ -> a, 1/! -> i, 0 -> o, $ -> s, etc.).
 * 6. Character flooding collapse (3+ identical characters collapsed to 1).
 */
export function normalizeForModeration(input: string): {
  raw: string;
  normalized: string;
  condensed: string;
  tokens: string[];
} {
  if (!input) {
    return { raw: "", normalized: "", condensed: "", tokens: [] };
  }

  // Stage 1: Strip invisible/zero-width chars; normalize non-breaking spaces
  let text = input
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, "")
    .replace(/\u00A0/g, " ");

  // Stage 2: Unicode NFKD decomposition (separates base characters from accents)
  text = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  // Stage 3: Homoglyph and fullwidth mapping
  let mapped = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = ch.charCodeAt(0);

    // Fullwidth Latin: U+FF01-U+FF5E
    if (code >= 0xff21 && code <= 0xff3a) {
      mapped += String.fromCharCode(code - 0xfee0 + 32);
      continue;
    }
    if (code >= 0xff41 && code <= 0xff5a) {
      mapped += String.fromCharCode(code - 0xfee0);
      continue;
    }

    // Circled Latin: U+24B6-U+24E9
    if (code >= 0x24b6 && code <= 0x24cf) {
      mapped += String.fromCharCode(code - 0x24b6 + 97);
      continue;
    }
    if (code >= 0x24d0 && code <= 0x24e9) {
      mapped += String.fromCharCode(code - 0x24d0 + 97);
      continue;
    }

    if (HOMOGLYPHS[ch]) {
      mapped += HOMOGLYPHS[ch];
      continue;
    }
    const lowerCh = ch.toLowerCase();
    if (HOMOGLYPHS[lowerCh]) {
      mapped += HOMOGLYPHS[lowerCh];
      continue;
    }

    mapped += ch;
  }
  text = mapped;

  // Stage 4: Lowercasing
  text = text.toLowerCase();

  // Strip leading @ from handles / mentions before leetspeak so @solplayer doesn't become asolplayer
  text = text.replace(/(^|\s)@([a-z0-9_]+)/gi, "$1$2");

  // Stage 5: Leetspeak symbol translation
  text = text
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .replace(/0/g, "o")
    .replace(/[1!|\]]/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b");

  // Stage 6: Character flooding collapse (3+ identical characters collapsed to 1)
  text = text.replace(/(.)\1{2,}/g, "$1");

  // Split into word tokens for allowlist and token-level checks (underscores treated as word delimiters)
  const tokens = text
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  // Condensed representation (punctuation and spaces stripped) for interleaved checking
  const condensed = text.replace(/[^a-z0-9]/g, "");

  return {
    raw: input,
    normalized: text,
    condensed,
    tokens,
  };
}

export const normalizeText = normalizeForModeration;

/**
 * Tier 1: Racial slurs, hate speech, derogatory terms, and severe harassment.
 * Strictly prohibited across ALL modes (public daily games and private custom link-shared games).
 */
const TIER_1_PATTERNS: RegExp[] = [
  // Racial slurs
  /\bn+[i1!|]+g+g+[e3a@]+r?s?\b/i,
  /\bn+[i1!|]+g+g+[a@]+h?z?\b/i,
  /\bn+[i1!|]+g+l+[e3]+t\b/i,
  /\bc+[o0]{2,}n+s?\b/i,
  /\bd+[a@]r+k+[i1!|]+[e3]+s?\b/i,
  /\bt+[a@]r+b+[a@]b+(?:y|ies)\b/i,
  /\bs+[a@]n+d+n+[i1!|]+g+g+[e3a@]+r?s?\b/i,

  // Anti-Semitic
  /\bk+[i1!|]+k+[e3]+s?\b/i,
  /\by+[i1!|]+d+s?\b/i,
  /\bs+h+[e3]+[e3]+n+(?:y|ies)\b/i,

  // Anti-Asian
  /\bc+h+[i1!|]+n+k+s?\b/i,
  /\bg+[o0]{2,}k+s?\b/i,
  /\bz+[i1!|]+p+p+[e3]+r+h+[e3]+[a@]+d\b/i,
  /\bs+l+[o0]+p+[e3]+h+[e3]+[a@]+d\b/i,

  // Anti-Latino (catches spic, spics, spik, spicks)
  /\bs+p+[i1!|]+(?:k|c|ck)+s?\b/i,
  /\bw+[e3]+t+b+[a@]+c+k+s?\b/i,
  /\bb+[e3]+[a@]+n+[e3]+r+s?\b/i,

  // Anti-Indigenous
  /\br+[e3]+d+s+k+[i1!|]+n+s?\b/i,
  /\bs+q+u+[a@]+w+s?\b/i,
  /\b[i1!|]+n+j+u+n+s?\b/i,

  // Anti-Arab / Islamophobic
  /\br+[a@]+g+h+[e3]+[a@]+d+s?\b/i,
  /\bt+[o0]+w+[e3]+l+h+[e3]+[a@]+d+s?\b/i,

  // LGBTQ+
  /\bf+[a@]+g+[o0i1!|]+t+s?\b/i,
  /\bf+[a@]+g+s?\b/i,
  /\bd+y+k+[e3]+s?\b/i,
  /\bt+r+[a@]+n+n+(?:y|ies)\b/i,
  /\bs+h+[e3]+m+[a@]+l+[e3]+s?\b/i,

  // Ableist
  /\br+[e3]+t+[a@]+r+d+s?\b/i,
  /\br+[e3]+t+[a@]+r+d+[e3]+d\b/i,
  /\bm+[o0]+n+g+[o0]+l+[o0]+[i1!|]+d+s?\b/i,

  // Extremist / Hate Slogans
  /\b1488\b/i,
  /\bg+[a@]+s\s+t+h+[e3]\s+j+[e3]+w+s\b/i,
  /\bh+[i1!|]+t+l+[e3]+r\s+d+[i1!|]+d\s+n+[o0]+t+h+[i1!|]+n+g\s+w+r+[o0]+n+g\b/i,
];

/**
 * Interleaved Tier 1 patterns (catches n.i.g.g.e.r, f_a_g_g_o_t, k i k e, c/h/i/n/k, s#p#i#c, etc.)
 */
const TIER_1_INTERLEAVED_PATTERNS: RegExp[] = [
  /\bn[^a-z0-9]+i[^a-z0-9]+g[^a-z0-9]+g[^a-z0-9]+e[^a-z0-9]+r\b/i,
  /\bn[^a-z0-9]+i[^a-z0-9]+g[^a-z0-9]+g[^a-z0-9]+a\b/i,
  /\bf[^a-z0-9]+a[^a-z0-9]+g[^a-z0-9]+g[^a-z0-9]+o[^a-z0-9]+t\b/i,
  /\bf[^a-z0-9]+a[^a-z0-9]+g[^a-z0-9]+s\b/i,
  /\bk[^a-z0-9]+i[^a-z0-9]+k[^a-z0-9]+e\b/i,
  /\br[^a-z0-9]+e[^a-z0-9]+t[^a-z0-9]+a[^a-z0-9]+r[^a-z0-9]+d\b/i,
  /\bc[^a-z0-9]+h[^a-z0-9]+i[^a-z0-9]+n[^a-z0-9]+k\b/i,
  /\bg[^a-z0-9]+o[^a-z0-9]+o[^a-z0-9]+k\b/i,
  /\bs[^a-z0-9]+p[^a-z0-9]+i[^a-z0-9]+c\b/i,
  /\bw[^a-z0-9]+e[^a-z0-9]+t[^a-z0-9]+b[^a-z0-9]+a[^a-z0-9]+c[^a-z0-9]+k\b/i,
  /\bd[^a-z0-9]+y[^a-z0-9]+k[^a-z0-9]+e\b/i,
];

/**
 * Tier 2: General profanity, vulgarity, and casual swear words.
 * Strictly blocked in public mode (daily games, public leaderboards, public profiles, admin studio),
 * while permitted in private custom link-shared games (`?b=<id>`).
 */
const TIER_2_PATTERNS: RegExp[] = [
  /\bf+u+c+k+(?:[e3]r|[i1!|]ng|[e3]d|s)?\b/i,
  /\bm[o0]th[e3]rf+u+c+k+(?:[e3]r|[i1!|]ng|[e3]d|s)?\b/i,
  /\bsh+[i1!|]+t+(?:[e3]r|[i1!|]ng|[e3]d|y|s)?\b/i,
  /\bb+u+l+l+sh+[i1!|]+t+\b/i,
  /\bb+[i1!|]+t+c+h+(?:[e3]s|[e3]d|[i1!|]ng|y)?\b/i,
  /\bc+u+n+t+s?\b/i,
  /\bd+[i1!|]+c+k+(?:h[e3][a@]d|s)?\b/i,
  /\bp+u+s+s+(?:y|ies)\b/i,
  /\bc+[o0]+c+k+(?:s|s+u+c+k+[e3]r)?\b/i,
  /\b[a@]s+s+h+[o0]+l+[e3]s?\b/i,
  /\b[a@]r+s+[e3]+h+[o0]+l+[e3]s?\b/i,
  /\bd+u+m+b+[a@]s+s+(?:[e3]s)?\b/i,
  /\bj+[a@]c+k+[a@]s+s+(?:[e3]s)?\b/i,
  /\bb+[a@]d+[a@]s+s+(?:[e3]s)?\b/i,
  /\bb+[a@]s+t+[a@]r+d+s?\b/i,
  /\bw+[a@]n+k+[e3]r+s?\b/i,
  /\bt+w+[a@]t+s?\b/i,
  /\bs+l+u+t+(?:s|t+y)?\b/i,
  /\bwh+[o0]+r+[e3]+s?\b/i,
  /\bp+[i1!|]+s+s+(?:[e3]s|[e3]d|[i1!|]ng)?\b/i,
  /\bd+[a@]m+n+(?:[e3]d|m+[i1!|]t)?\b/i,
  /\bg+[o0]+d+d+[a@]m+n+\b/i,
  /\bh+[e3]+l+l+\b/i,
  /\bc+r+[a@]p+(?:p+y|s)?\b/i,
  /\b[a@]s+s+(?:[e3]s)?\b/i,
  /\b[a@]r+s+[e3]+(?:s)?\b/i,
];

/**
 * Interleaved Tier 2 patterns for public mode (catches f u c k, f.u.c.k, s.h.i.t, etc.)
 */
const TIER_2_INTERLEAVED_PATTERNS: RegExp[] = [
  /\bf+[^a-z0-9]+u+[^a-z0-9]+c+[^a-z0-9]+k+\b/i,
  /\bs+[^a-z0-9]+h+[^a-z0-9]+i+[^a-z0-9]+t+\b/i,
  /\bb+[^a-z0-9]+i+[^a-z0-9]+t+[^a-z0-9]+c+[^a-z0-9]+h+\b/i,
  /\bc+[^a-z0-9]+u+[^a-z0-9]+n+[^a-z0-9]+t+\b/i,
  /\ba+[^a-z0-9]+s+[^a-z0-9]+s+[^a-z0-9]+h+[^a-z0-9]+o+[^a-z0-9]+l+[^a-z0-9]+e+\b/i,
  /\bd+[^a-z0-9]+i+[^a-z0-9]+c+[^a-z0-9]+k+\b/i,
  /\bp+[^a-z0-9]+i+[^a-z0-9]+s+[^a-z0-9]+s+\b/i,
  /\bb+[^a-z0-9]+a+[^a-z0-9]+s+[^a-z0-9]+t+[^a-z0-9]+a+[^a-z0-9]+r+[^a-z0-9]+d+\b/i,
  /\bw+[^a-z0-9]+h+[^a-z0-9]+o+[^a-z0-9]+r+[^a-z0-9]+e+\b/i,
];

/**
 * Masks a matched offensive term for logging/feedback (e.g. "fuck" -> "f***").
 */
function maskTerm(term: string): string {
  if (term.length <= 2) return "**";
  return term[0] + "*".repeat(term.length - 2) + term[term.length - 1];
}

/**
 * Checks a single string against Tier 1 (universal) and Tier 2 (public only) moderation rules.
 */
export function checkContentModeration(
  text: string,
  context: ModerationContext
): ModerationResult {
  const allowEmpty = context.allowEmpty !== false;
  if (!text || text.trim().length === 0) {
    if (!allowEmpty) {
      const msg = context.field
        ? `${context.field} cannot be empty.`
        : "Content cannot be empty.";
      return {
        allowed: false,
        reason: msg,
        flaggedReason: msg,
        field: context.field,
      };
    }
    return { allowed: true };
  }

  // Pre-leetspeak numeric hate slogan check (catches 1488, 14 88, 14.88, 14/88 before Stage 5 leetspeak converts 1488 -> iabb)
  if (/\b14[\s._\-*\\/|~#]*88\b/.test(text)) {
    const reason = context.field
      ? `This submission contains hate speech or derogatory slurs in ${context.field}, which are strictly prohibited across all public and private games.`
      : "This submission contains hate speech or derogatory slurs, which are strictly prohibited across all public and private games.";
    return {
      allowed: false,
      tier: 1,
      reason,
      flaggedReason: reason,
      field: context.field,
      matchedTerm: "1488",
      flaggedWord: "1488",
    };
  }

  const { normalized, condensed, tokens } = normalizeForModeration(text);

  // Replace underscores with spaces in safeNormalized so snake_case (e.g. @fuck_boss, @chink_boss)
  // does not prevent \b word boundaries from matching.
  let safeNormalized = normalized.replace(/_/g, " ");
  const uniqueTokens = new Set(tokens);
  for (const token of uniqueTokens) {
    if (
      INNOCENT_ALLOWLIST.has(token) ||
      token.startsWith("snigger") ||
      token.startsWith("chigger")
    ) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      safeNormalized = safeNormalized.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "___innocent___");
    }
  }

  // --- 1. Tier 1 Check (Universal: both public and private) ---
  for (const pattern of TIER_1_PATTERNS) {
    const match = safeNormalized.match(pattern);
    if (match) {
      const reason = context.field
        ? `This submission contains hate speech or derogatory slurs in ${context.field}, which are strictly prohibited across all public and private games.`
        : "This submission contains hate speech or derogatory slurs, which are strictly prohibited across all public and private games.";
      return {
        allowed: false,
        tier: 1,
        reason,
        flaggedReason: reason,
        field: context.field,
        matchedTerm: maskTerm(match[0]),
        flaggedWord: maskTerm(match[0]),
      };
    }
  }

  // Interleaved Tier 1 Check (on safeNormalized string where separators are present)
  for (const pattern of TIER_1_INTERLEAVED_PATTERNS) {
    const match = safeNormalized.match(pattern);
    if (match) {
      const reason = context.field
        ? `This submission contains hate speech or derogatory slurs in ${context.field}, which are strictly prohibited across all public and private games.`
        : "This submission contains hate speech or derogatory slurs, which are strictly prohibited across all public and private games.";
      return {
        allowed: false,
        tier: 1,
        reason,
        flaggedReason: reason,
        field: context.field,
        matchedTerm: maskTerm(match[0]),
        flaggedWord: maskTerm(match[0]),
      };
    }
  }

  // Check condensed stream for exact severe slurs (ensuring innocent allowlisted words aren't falsely triggered)
  const TIER_1_CONDENSED = [
    "nigger", "nigga", "faggot", "kike", "retard", "sandnigger",
    "wetback", "zipperhead", "chink", "spic", "gook", "dyke"
  ];
  // Vowel-deduped condensed to catch vowel flooding evasions like "kiike", "niigger", "reetard", "faaggot"
  const condensedVowelCollapsed = condensed.replace(/([aeiouy1!3408])\1+/gi, "$1");

  for (const slur of TIER_1_CONDENSED) {
    if (condensed.includes(slur) || condensedVowelCollapsed.includes(slur)) {
      // Confirm it's not part of an allowlisted token (e.g. "snigger", "sniggering", "spice", "hospice")
      const isAllowlisted = tokens.some(
        (t) =>
          (INNOCENT_ALLOWLIST.has(t) || t.startsWith("snigger") || t.startsWith("chigger")) &&
          (t.includes(slur) || t.replace(/([aeiouy1!3408])\1+/gi, "$1").includes(slur))
      );
      if (!isAllowlisted) {
        const reason = context.field
          ? `This submission contains hate speech or derogatory slurs in ${context.field}, which are strictly prohibited across all public and private games.`
          : "This submission contains hate speech or derogatory slurs, which are strictly prohibited across all public and private games.";
        return {
          allowed: false,
          tier: 1,
          reason,
          flaggedReason: reason,
          field: context.field,
          matchedTerm: maskTerm(slur),
          flaggedWord: maskTerm(slur),
        };
      }
    }
  }

  // --- 2. Tier 2 Check (Public Mode Only) ---
  // In private mode (custom link-shared games), casual profanity is permitted.
  const allowProfanityInPrivate = context.allowProfanityInPrivate !== false;
  if (context.mode === "private" && allowProfanityInPrivate) {
    return { allowed: true };
  }

  // Public mode: strictly block general profanity
  for (const pattern of TIER_2_PATTERNS) {
    const match = safeNormalized.match(pattern);
    if (match) {
      const reason = context.field
        ? `Profanity is not permitted in ${context.field}. Casual language is only permitted in private custom link-shared games.`
        : "Profanity is not permitted in public games, daily puzzles, or public profiles. Casual language is only permitted in private custom link-shared games.";
      return {
        allowed: false,
        tier: 2,
        reason,
        flaggedReason: reason,
        field: context.field,
        matchedTerm: maskTerm(match[0]),
        flaggedWord: maskTerm(match[0]),
      };
    }
  }

  // Public mode: check interleaved profanity (e.g. "f u c k", "f.u.c.k", "s.h.i.t")
  for (const pattern of TIER_2_INTERLEAVED_PATTERNS) {
    const match = safeNormalized.match(pattern);
    if (match) {
      const reason = context.field
        ? `Profanity is not permitted in ${context.field}. Casual language is only permitted in private custom link-shared games.`
        : "Profanity is not permitted in public games, daily puzzles, or public profiles. Casual language is only permitted in private custom link-shared games.";
      return {
        allowed: false,
        tier: 2,
        reason,
        flaggedReason: reason,
        field: context.field,
        matchedTerm: maskTerm(match[0]),
        flaggedWord: maskTerm(match[0]),
      };
    }
  }

  return { allowed: true };
}

/**
 * Validates multiple fields against content moderation, returning the first violation encountered.
 * Supports both Array and Record<string, string> input formats.
 */
export function checkMultipleFields(
  fields: Array<{ text: string; field: string } | [string, string]> | Record<string, string>,
  context: ModerationContext | { mode: ModerationMode }
): ModerationResult {
  let list: Array<{ text: string; field: string }>;
  if (Array.isArray(fields)) {
    list = fields.map((item) =>
      Array.isArray(item) ? { text: item[0], field: item[1] } : item
    );
  } else {
    list = Object.entries(fields).map(([field, text]) => ({ text, field }));
  }
  for (const item of list) {
    const res = checkContentModeration(item.text, {
      mode: context.mode,
      field: item.field,
      allowEmpty: (context as ModerationContext).allowEmpty,
      allowProfanityInPrivate: (context as ModerationContext).allowProfanityInPrivate,
    });
    if (!res.allowed) {
      return res;
    }
  }
  return { allowed: true };
}

export const checkBatchModeration = checkMultipleFields;

/**
 * Validates a 21 Things board (title, creatorName, creatorBio, and all 21 items).
 */
export function check21ThingsBoardModeration(
  board: {
    title: string;
    creatorName: string;
    creatorBio?: string;
    items: string[];
  },
  context: { mode: ModerationMode }
): ModerationResult {
  const fields: ModerationBatchItem[] = [
    { text: board.title, field: "Board Title" },
    { text: board.creatorName, field: "Creator Name" },
  ];
  if (board.creatorBio) {
    fields.push({ text: board.creatorBio, field: "Creator Bio" });
  }
  board.items.forEach((item, idx) => {
    fields.push({ text: item, field: `Tile #${idx + 1}` });
  });

  return checkMultipleFields(fields, context);
}

/**
 * Validates a Connect 5 puzzle (title, author, editor, 5 words, 4 connection clues) in public mode.
 */
export function checkConnect5PuzzleModeration(
  puzzle: {
    title: string;
    author: string;
    editor: string;
    words: [string, string, string, string, string] | string[];
    connections: [string, string, string, string] | string[];
  },
  context: { mode: ModerationMode } = { mode: "public" }
): ModerationResult {
  const fields: ModerationBatchItem[] = [
    { text: puzzle.title, field: "Puzzle Title" },
    { text: puzzle.author, field: "Author" },
    { text: puzzle.editor, field: "Editor" },
  ];

  puzzle.words.forEach((w, idx) => {
    fields.push({ text: w, field: `Word #${idx + 1}` });
  });

  puzzle.connections.forEach((c, idx) => {
    fields.push({ text: c, field: `Connection #${idx + 1}` });
  });

  return checkMultipleFields(fields, context);
}

/**
 * Validates a user profile (displayName and handle) in public mode.
 */
export function checkUserProfileModeration(profile: {
  displayName?: string;
  handle?: string;
}): ModerationResult {
  const fields: ModerationBatchItem[] = [];
  if (profile.displayName) {
    fields.push({ text: profile.displayName, field: "Display Name" });
  }
  if (profile.handle) {
    fields.push({ text: profile.handle, field: "Handle" });
  }
  return checkMultipleFields(fields, { mode: "public" });
}

/**
 * Validates 21 Things reflection submission (playerName and reflectionNote).
 */
export function checkTwentyOneReflectionModeration(
  submission: { playerName?: string; reflectionNote?: string },
  context: { mode: ModerationMode } = { mode: "public" }
): ModerationResult {
  const fields: Array<{ text: string; field: string }> = [];
  if (submission.playerName) {
    fields.push({ text: submission.playerName, field: "Player Name" });
  }
  if (submission.reflectionNote) {
    fields.push({ text: submission.reflectionNote, field: "Reflection Note" });
  }
  return checkMultipleFields(fields, context);
}

/**
 * Validates custom board creation in private mode.
 */
export function checkCustomBoardModeration(
  board: {
    title: string;
    creatorName: string;
    creatorBio?: string;
    items: string[];
  },
  context: { mode: ModerationMode } = { mode: "private" }
): ModerationResult {
  return check21ThingsBoardModeration(board, context);
}

/**
 * Validates Connect 5 puzzle creation in admin studio (public mode).
 */
export function checkAdminConnect5Moderation(puzzle: {
  title: string;
  author: string;
  editor: string;
  words: [string, string, string, string, string] | string[];
  connections: [string, string, string, string] | string[];
}): ModerationResult {
  return checkConnect5PuzzleModeration(puzzle, { mode: "public" });
}

/**
 * Validates 21 Things board creation in admin studio (public mode).
 */
export function checkAdmin21BoardModeration(board: {
  title: string;
  creatorName: string;
  creatorBio?: string;
  items: string[];
}): ModerationResult {
  return check21ThingsBoardModeration(board, { mode: "public" });
}

/**
 * Validates a 17 Syllables haiku puzzle (theme, author, and 3 haiku lines).
 */
export function check17SyllablesPuzzleModeration(
  puzzle: {
    theme: string;
    author: string;
    lines: [string, string, string] | string[];
  },
  context: { mode: ModerationMode } = { mode: "public" }
): ModerationResult {
  const fields: Array<{ text: string; field: string }> = [
    { text: puzzle.theme, field: "Haiku Theme" },
    { text: puzzle.author, field: "Author" },
  ];
  puzzle.lines.forEach((line, idx) => {
    fields.push({ text: line, field: `Haiku Line ${idx + 1}` });
  });
  return checkMultipleFields(fields, context);
}

/**
 * Validates 17 Syllables haiku creation in admin studio (public mode).
 */
export function checkAdmin17SyllablesModeration(puzzle: {
  theme: string;
  author: string;
  lines: [string, string, string] | string[];
}): ModerationResult {
  return check17SyllablesPuzzleModeration(puzzle, { mode: "public" });
}


/**
 * Surface selector for `moderateText`:
 *   - `"public"`         daily puzzles, profiles, `1 Win`, `21 Things` reflections (Tier 1 + Tier 2)
 *   - `"private"` / `"private_custom"`  friend games opened via `?b=<id>` (Tier 1 only;
 *                         casual swearing allowed)
 */
export type ModerationSurface = "public" | "private" | "private_custom";

/** Convenience wrapper around `checkContentModeration` taking a named surface. */
export function moderateText(
  text: string,
  surface: ModerationSurface,
  field?: string
): ModerationResult {
  return checkContentModeration(text, {
    mode: surface === "public" ? "public" : "private",
    field,
  });
}

/** Multi-field variant of `moderateText`. */
export function moderateFields(
  fields: Record<string, string>,
  surface: ModerationSurface
): ModerationResult {
  return checkMultipleFields(fields, { mode: surface === "public" ? "public" : "private" });
}
