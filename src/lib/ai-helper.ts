/**
 * Unified AI helper (GAME_DESIGN_BIBLE §0.2).
 *
 * Providers:
 *   1. Google AI Studio free tier — `gemini-2.5-flash` (DEFAULT, $0)
 *      keys: `GEMINI_API_KEY` / `NEXT_PUBLIC_GEMINI_API_KEY`
 *   2. OpenRouter (toggleable) — `OPENROUTER_API_KEY` / `NEXT_PUBLIC_OPENROUTER_API_KEY`
 *   3. `local` — 100% deterministic algorithmic / dictionary fallback.
 *
 * Every public function ALWAYS resolves: with no key, on rate-limits, on network errors
 * or on malformed model output it silently returns the deterministic local result, so the
 * site and `/admin` studio never fail. All AI output is validated and moderated (public
 * Tier 1 + Tier 2) before being returned.
 */

import { RHYME_FAMILIES, findClosestRhymeFamily, type RhymeFamily } from "@/data/rhyme-families";
import { fnv1a32, mulberry32 } from "@/lib/seeded-random";
import { moderateText } from "@/lib/moderation";

export type AIProvider = "gemini" | "openrouter" | "local";

export interface AIHelperConfig {
  preferredProvider?: AIProvider;
  geminiApiKey?: string;
  openRouterApiKey?: string;
  /** Override for tests / custom transports. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  geminiModel?: string;
  openRouterModel?: string;
}

export interface RhymeClueDraft {
  answer: string;
  altSpellings?: string[];
  sentence: string;
  hint: string;
}

export interface RhymesChainDraft {
  starterWord: string;
  clues: RhymeClueDraft[];
}

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.5-flash";

/* ------------------------------------------------------------------ */
/* Provider resolution                                                 */
/* ------------------------------------------------------------------ */

function envKey(...names: string[]): string | undefined {
  for (const name of names) {
    const v = typeof process !== "undefined" ? process.env?.[name] : undefined;
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

export function resolveGeminiKey(config?: AIHelperConfig): string | undefined {
  return (
    config?.geminiApiKey?.trim() ||
    envKey("GEMINI_API_KEY") ||
    envKey("NEXT_PUBLIC_GEMINI_API_KEY")
  );
}

export function resolveOpenRouterKey(config?: AIHelperConfig): string | undefined {
  return (
    config?.openRouterApiKey?.trim() ||
    envKey("OPENROUTER_API_KEY") ||
    envKey("NEXT_PUBLIC_OPENROUTER_API_KEY")
  );
}

/**
 * Picks the provider to try first. Preferred provider wins when it has a key; otherwise
 * Gemini (default) → OpenRouter → local.
 */
function readStoredProviderPref(): AIProvider | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage?.getItem("solgames_ai_provider_pref");
    if (raw === "gemini" || raw === "openrouter" || raw === "local") {
      return raw;
    }
  } catch {
    // Ignore storage read errors
  }
  return undefined;
}

export function resolveAIProvider(config?: AIHelperConfig): AIProvider {
  const hasGemini = Boolean(resolveGeminiKey(config));
  const hasRouter = Boolean(resolveOpenRouterKey(config));
  const pref = config?.preferredProvider ?? readStoredProviderPref();
  if (pref === "local") return "local";
  if (pref === "openrouter" && hasRouter) return "openrouter";
  if (pref === "gemini" && hasGemini) return "gemini";
  if (hasGemini) return "gemini";
  if (hasRouter) return "openrouter";
  return "local";
}

async function callModel(prompt: string, config?: AIHelperConfig): Promise<string | null> {
  const provider = resolveAIProvider(config);
  if (provider === "local") return null;
  const doFetch = config?.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  if (!doFetch) return null;

  try {
    if (provider === "gemini") {
      const key = resolveGeminiKey(config)!;
      const model = config?.geminiModel ?? DEFAULT_GEMINI_MODEL;
      const res = await doFetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
          }),
        }
      );
      if (!res.ok) return null;
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return json.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    }

    const key = resolveOpenRouterKey(config)!;
    const res = await doFetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: config?.openRouterModel ?? DEFAULT_OPENROUTER_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

function parseJson(text: string | null): unknown {
  if (!text) return null;
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function isPublicSafe(text: string): boolean {
  return moderateText(text, "public").allowed;
}

/* ------------------------------------------------------------------ */
/* 6 Pics — synonyms / aliases                                         */
/* ------------------------------------------------------------------ */

const THESAURUS: Readonly<Record<string, readonly string[]>> = {
  ocean: ["sea", "waves", "seaside", "marine", "tide", "beach"],
  sea: ["ocean", "waves", "seaside", "marine"],
  beach: ["shore", "seaside", "coast", "sand", "seashore"],
  rain: ["rainfall", "shower", "drizzle", "downpour", "storm"],
  snow: ["snowfall", "blizzard", "flurry", "winter"],
  winter: ["snow", "cold", "frost", "december"],
  summer: ["sunny", "heat", "july", "sunshine"],
  sun: ["sunshine", "sunlight", "daylight", "star"],
  moon: ["lunar", "moonlight", "crescent", "night"],
  night: ["evening", "nighttime", "dark", "midnight"],
  star: ["stars", "starry", "celestial", "sky"],
  fire: ["flame", "blaze", "bonfire", "campfire", "burning"],
  water: ["aqua", "liquid", "h2o", "splash"],
  tree: ["trees", "forest", "woods", "oak", "wood"],
  forest: ["woods", "woodland", "jungle", "trees"],
  flower: ["flowers", "bloom", "blossom", "petal", "garden"],
  garden: ["yard", "flowers", "plants", "backyard"],
  mountain: ["mountains", "peak", "summit", "hill", "alps"],
  river: ["stream", "creek", "brook", "waterway"],
  bridge: ["overpass", "crossing", "span", "viaduct"],
  city: ["urban", "downtown", "metropolis", "town", "skyline"],
  home: ["house", "residence", "dwelling", "household"],
  house: ["home", "residence", "dwelling"],
  car: ["auto", "automobile", "vehicle", "sedan"],
  train: ["railway", "locomotive", "railroad", "subway"],
  plane: ["airplane", "aircraft", "jet", "airliner"],
  boat: ["ship", "vessel", "sailboat", "yacht"],
  bike: ["bicycle", "cycling", "cycle"],
  music: ["song", "melody", "tune", "songs", "concert"],
  guitar: ["strings", "acoustic", "instrument", "music"],
  piano: ["keys", "keyboard", "instrument", "music"],
  book: ["novel", "reading", "library", "books"],
  library: ["books", "reading", "bookshelf"],
  school: ["class", "classroom", "education", "learning"],
  coffee: ["espresso", "latte", "caffeine", "brew", "cafe"],
  tea: ["chai", "brew", "teapot", "herbal"],
  pizza: ["pie", "slice", "pizzeria", "italian"],
  bread: ["loaf", "toast", "bakery", "baking"],
  cake: ["dessert", "birthday", "pastry", "cupcake"],
  chocolate: ["cocoa", "candy", "sweets", "cacao"],
  dog: ["puppy", "pup", "canine", "hound"],
  cat: ["kitten", "kitty", "feline", "tabby"],
  bird: ["birds", "avian", "songbird", "feathers"],
  fish: ["seafood", "aquarium", "trout", "fishing"],
  horse: ["pony", "stallion", "equine", "mare"],
  baby: ["infant", "newborn", "child", "toddler"],
  family: ["relatives", "kin", "parents", "household"],
  friend: ["friends", "buddy", "pal", "companion", "friendship"],
  love: ["romance", "affection", "heart", "hearts"],
  heart: ["love", "romance", "valentine", "cardio"],
  happy: ["joy", "joyful", "glad", "cheerful", "smile"],
  smile: ["grin", "happy", "joy", "beam"],
  sleep: ["nap", "rest", "slumber", "bed", "dream"],
  dream: ["dreams", "fantasy", "sleep", "imagination"],
  time: ["clock", "hours", "watch", "minutes"],
  clock: ["time", "watch", "timer", "hours"],
  money: ["cash", "currency", "dollars", "coins", "wealth"],
  game: ["games", "play", "puzzle", "gaming"],
  sport: ["sports", "athletics", "game", "exercise"],
  soccer: ["football", "futbol", "goal", "pitch"],
  basketball: ["hoops", "nba", "dunk", "court"],
  baseball: ["ballpark", "mlb", "homerun", "diamond"],
  travel: ["trip", "journey", "vacation", "tour", "adventure"],
  holiday: ["vacation", "celebration", "festival", "break"],
  party: ["celebration", "festival", "bash", "gathering"],
  gift: ["present", "surprise", "wrapped"],
  light: ["lamp", "glow", "bright", "shine", "lantern"],
  color: ["colour", "paint", "hue", "rainbow"],
  rainbow: ["colors", "spectrum", "arc"],
  cloud: ["clouds", "cloudy", "sky", "overcast"],
  wind: ["breeze", "gust", "windy", "gale"],
  storm: ["thunder", "tempest", "lightning", "hurricane"],
  desert: ["dunes", "sahara", "arid", "sand"],
  island: ["isle", "atoll", "tropical", "paradise"],
  castle: ["fortress", "palace", "keep", "citadel"],
  king: ["monarch", "ruler", "royal", "crown"],
  magic: ["wizard", "spell", "sorcery", "enchantment"],
  robot: ["android", "machine", "automaton", "bot"],
  space: ["cosmos", "galaxy", "universe", "outerspace", "astronaut"],
  science: ["lab", "experiment", "research", "chemistry"],
  art: ["painting", "artwork", "drawing", "gallery"],
  camera: ["photo", "photography", "snapshot", "lens"],
  phone: ["telephone", "mobile", "cellphone", "smartphone"],
  computer: ["laptop", "pc", "desktop", "tech"],
  work: ["job", "career", "office", "employment"],
  kitchen: ["cooking", "chef", "stove", "cook"],
  breakfast: ["morning meal", "brunch", "cereal", "pancakes"],
  garden_party: ["picnic", "outdoors"],
  picnic: ["outdoor meal", "park", "basket", "outing"],
  camping: ["tent", "campfire", "outdoors", "campsite"],
  hiking: ["trail", "trek", "walking", "outdoors"],
};

function stripArticle(s: string): string {
  return s.replace(/^(the|a|an)\s+/i, "");
}

function pluralForms(word: string): string[] {
  const out: string[] = [];
  if (/(s|x|z|ch|sh)$/.test(word)) out.push(`${word}es`);
  else if (/[^aeiou]y$/.test(word)) out.push(`${word.slice(0, -1)}ies`);
  else out.push(`${word}s`);
  if (word.endsWith("ies") && word.length > 4) out.push(`${word.slice(0, -3)}y`);
  else if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) out.push(word.slice(0, -1));
  return out;
}

/** Deterministic alias generator for a 6 Pics theme answer. */
export function localSixPicsSynonyms(theme: string): string[] {
  const base = stripArticle(theme.trim().toLowerCase().replace(/\s+/g, " "));
  if (!base) return [];
  const out = new Set<string>();
  const add = (v: string) => {
    const t = stripArticle(v.trim().toLowerCase());
    if (t && t !== base) out.add(t);
  };

  for (const form of pluralForms(base)) add(form);
  if (/[\s-]/.test(base)) {
    add(base.replace(/[\s-]+/g, ""));
    add(base.replace(/-/g, " "));
    add(base.replace(/\s+/g, "-"));
  }
  const words = base.split(/[\s-]+/);
  for (const w of words) {
    for (const syn of THESAURUS[w] ?? []) add(words.length === 1 ? syn : base.replace(w, syn));
  }
  if (words.length === 1) {
    for (const syn of THESAURUS[base] ?? []) add(syn);
  }
  return [...out].slice(0, 12);
}

export async function generate6PicsSynonyms(
  theme: string,
  config?: AIHelperConfig
): Promise<string[]> {
  const local = localSixPicsSynonyms(theme);
  const base = theme.trim().toLowerCase();
  if (!base) return local;

  const text = await callModel(
    `You help design a picture-theme guessing game. The secret theme answer is "${theme}". ` +
      `Return JSON {"synonyms": [...]} with 4 to 10 accepted alternative answers a player might ` +
      `type (synonyms, plural/singular forms, common spellings). Lowercase, 1-3 words each, ` +
      `family-friendly, never the original answer.`,
    config
  );
  const parsed = parseJson(text);
  const raw =
    parsed && typeof parsed === "object" && Array.isArray((parsed as { synonyms?: unknown }).synonyms)
      ? ((parsed as { synonyms: unknown[] }).synonyms as unknown[])
      : null;
  if (!raw) return local;

  const ai = raw
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length > 0 && v.length <= 30 && v !== base && isPublicSafe(v));
  if (ai.length === 0) return local;
  return [...new Set([...ai, ...local])].slice(0, 12);
}

/* ------------------------------------------------------------------ */
/* 9 Rhymes — chain suggestion                                         */
/* ------------------------------------------------------------------ */

function seededPick<T>(items: readonly T[], seed: string, count: number): T[] {
  const rand = mulberry32(fnv1a32(seed));
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr.slice(0, count);
}

/** Deterministic dictionary-based chain: starter + 9 perfect rhymes with clue sentences. */
export function localRhymesChain(starterWord: string): RhymesChainDraft {
  const starter = starterWord.trim().toLowerCase();
  const fam: RhymeFamily | null = findClosestRhymeFamily(starter);
  if (!fam) {
    return { starterWord: starter, clues: [] };
  }
  const pool = fam.entries.filter((e) => e.word !== starter);
  const chosen = seededPick(pool, `${starter}:${fam.id}`, 9);
  const clues: RhymeClueDraft[] = chosen.map((e) => ({
    answer: e.word,
    sentence: `${e.clue} (rhymes with "${starter}")`,
    hint: `Starts with "${e.word[0]!.toUpperCase()}" and has ${e.word.length} letters.`,
  }));
  return { starterWord: starter, clues };
}

function isChainShape(value: unknown): value is { starterWord?: unknown; clues: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { clues?: unknown }).clues)
  );
}

export async function suggest9RhymesChain(
  starterWord: string,
  config?: AIHelperConfig
): Promise<RhymesChainDraft> {
  const local = localRhymesChain(starterWord);
  const starter = starterWord.trim().toLowerCase();
  if (!starter) return local;

  const text = await callModel(
    `Create a 9 Rhymes puzzle. Starter word: "${starter}". Return JSON ` +
      `{"starterWord": string, "clues": [{"answer": string, "altSpellings": string[], ` +
      `"sentence": string, "hint": string}]} with EXACTLY 9 clues. Every answer must be a ` +
      `single real word that is a PERFECT rhyme of "${starter}" (identical ending sound), all ` +
      `different, family-friendly. "sentence" is a short clue or fill-in-the-blank that never ` +
      `contains the answer. "hint" is a gentler extra clue.`,
    config
  );
  const parsed = parseJson(text);
  if (!isChainShape(parsed)) return local;

  const seen = new Set<string>([starter]);
  const clues: RhymeClueDraft[] = [];
  for (const item of parsed.clues) {
    if (typeof item !== "object" || item === null) continue;
    const c = item as Record<string, unknown>;
    const answer = typeof c.answer === "string" ? c.answer.trim().toLowerCase() : "";
    const sentence = typeof c.sentence === "string" ? c.sentence.trim() : "";
    const hint = typeof c.hint === "string" ? c.hint.trim() : "";
    if (!/^[a-z]{2,12}$/.test(answer) || seen.has(answer)) continue;
    if (!sentence || !hint || sentence.toLowerCase().includes(answer)) continue;
    if (!isPublicSafe(`${answer} ${sentence} ${hint}`)) continue;
    seen.add(answer);
    const alts = Array.isArray(c.altSpellings)
      ? c.altSpellings
          .filter((a): a is string => typeof a === "string")
          .map((a) => a.trim().toLowerCase())
          .filter((a) => /^[a-z]{2,12}$/.test(a) && a !== answer)
      : [];
    clues.push({ answer, sentence, hint, ...(alts.length ? { altSpellings: alts } : {}) });
    if (clues.length === 9) break;
  }

  if (clues.length < 9) {
    // Top up with deterministic dictionary rhymes so the chain is always complete.
    for (const c of local.clues) {
      if (clues.length === 9) break;
      if (!seen.has(c.answer)) {
        seen.add(c.answer);
        clues.push(c);
      }
    }
  }
  return { starterWord: starter, clues };
}

/* ------------------------------------------------------------------ */
/* 17 Syllables — haiku draft                                          */
/* ------------------------------------------------------------------ */

const SYLLABLE_OVERRIDES: Readonly<Record<string, number>> = {
  everything: 3,
  everyone: 3,
  quiet: 2,
  create: 2,
  horizon: 3,
  cicadas: 3,
  wherever: 3,
  thousand: 2,
  poem: 2,
  fire: 1,
  our: 1,
  hour: 1,
  every: 2,
  idea: 3,
  real: 1,
  being: 2,
  neon: 2,
  children: 2,
  evening: 2,
  family: 3,
  beautiful: 3,
  the: 1,
  people: 2,
  little: 2,
  gentle: 2,
  single: 2,
  maple: 2,
  glowing: 2,
  windows: 2,
};

/** Approximate English syllable counter with an override table for irregular words. */
export function countSyllables(text: string): number {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  let total = 0;
  for (const raw of words) {
    const word = raw.replace(/'/g, "");
    if (!word) continue;
    if (SYLLABLE_OVERRIDES[word] !== undefined) {
      total += SYLLABLE_OVERRIDES[word]!;
      continue;
    }
    let w = word;
    if (w.length <= 3) {
      total += 1;
      continue;
    }
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
    const groups = w.match(/[aeiouy]{1,2}/g);
    total += Math.max(1, groups ? groups.length : 1);
  }
  return total;
}

interface HaikuBank {
  fives: readonly string[];
  sevens: readonly string[];
}

const HAIKU_BANKS: Readonly<Record<string, HaikuBank>> = {
  winter: {
    fives: ["Snow falls on the roof", "Frost on the window", "Cold wind in the trees"],
    sevens: [
      "The lake is frozen and still",
      "Footprints fade in soft white snow",
      "Smoke curls from the chimney top",
    ],
  },
  spring: {
    fives: ["Rain taps on the leaves", "Green buds wake slowly", "Birds sing at sunrise"],
    sevens: [
      "Soft petals drift on the breeze",
      "The garden hums with new life",
      "Warm light melts the last cold frost",
    ],
  },
  summer: {
    fives: ["Sun on the warm sand", "Cicadas hum loud", "Long days, golden light"],
    sevens: [
      "Waves roll in beneath the sky",
      "Cool water on sunburnt skin",
      "Children laugh in the sprinkler",
    ],
  },
  autumn: {
    fives: ["Red leaves drift and fall", "Crisp air, golden light", "Pumpkins in the field"],
    sevens: [
      "The maple lets go of gold",
      "Geese call out across the dusk",
      "Cider steams in my cold hands",
    ],
  },
  ocean: {
    fives: ["Salt wind on my face", "The tide pulls away", "Gulls cry over waves"],
    sevens: [
      "Foam spills across the wet sand",
      "The horizon holds the sun",
      "Shells whisper of distant seas",
    ],
  },
  night: {
    fives: ["Moon through the pine trees", "Stars blink in the dark", "Crickets in the grass"],
    sevens: [
      "The world is soft and so still",
      "A lone owl calls from the hill",
      "Silver light spills on the road",
    ],
  },
  love: {
    fives: ["Your hand finds my hand", "Two cups on the sill", "Soft words in the dark"],
    sevens: [
      "Home is wherever you are",
      "I save the best seat for you",
      "Your laugh fills the quiet room",
    ],
  },
  city: {
    fives: ["Rain on the bus glass", "Neon lights hum low", "Steam from the subway"],
    sevens: [
      "Taxis hiss through the wet streets",
      "A thousand windows glowing",
      "Footsteps echo down the block",
    ],
  },
  default: {
    fives: ["Morning light arrives", "A small bird begins", "The river runs on"],
    sevens: [
      "Everything is quiet now",
      "The path winds up through tall trees",
      "A single cloud drifts along",
    ],
  },
};

const THEME_KEYWORDS: ReadonlyArray<[string, readonly string[]]> = [
  ["winter", ["winter", "snow", "frost", "cold", "ice", "december", "january"]],
  ["spring", ["spring", "bloom", "blossom", "april", "may", "rain", "garden", "flower"]],
  ["summer", ["summer", "sun", "beach", "heat", "july", "august", "warm"]],
  ["autumn", ["autumn", "fall", "leaves", "harvest", "october", "november", "pumpkin"]],
  ["ocean", ["ocean", "sea", "wave", "tide", "shore", "coast", "water"]],
  ["night", ["night", "moon", "star", "dark", "midnight", "owl", "sleep"]],
  ["love", ["love", "heart", "romance", "together", "kiss", "home", "family"]],
  ["city", ["city", "urban", "street", "subway", "taxi", "town", "downtown"]],
];

export function pickHaikuBankKey(theme: string): string {
  const t = theme.toLowerCase();
  for (const [key, words] of THEME_KEYWORDS) {
    if (words.some((w) => t.includes(w))) return key;
  }
  return "default";
}

/** Deterministic 5-7-5 draft from a verified line bank (seeded by theme). */
export function localHaikuDraft(theme: string): [string, string, string] {
  const bank = HAIKU_BANKS[pickHaikuBankKey(theme)] ?? HAIKU_BANKS.default!;
  const rand = mulberry32(fnv1a32(`haiku:${theme.trim().toLowerCase()}`));
  const f1 = Math.floor(rand() * bank.fives.length);
  let f2 = Math.floor(rand() * bank.fives.length);
  if (f2 === f1) f2 = (f2 + 1) % bank.fives.length;
  const s = Math.floor(rand() * bank.sevens.length);
  return [bank.fives[f1]!, bank.sevens[s]!, bank.fives[f2]!];
}

/** Exposed for tests: every banked line with its target syllable count. */
export function getHaikuBankLines(): Array<{ line: string; syllables: 5 | 7 }> {
  const out: Array<{ line: string; syllables: 5 | 7 }> = [];
  for (const bank of Object.values(HAIKU_BANKS)) {
    for (const line of bank.fives) out.push({ line, syllables: 5 });
    for (const line of bank.sevens) out.push({ line, syllables: 7 });
  }
  return out;
}

export async function generateHaikuDraft(
  theme: string,
  config?: AIHelperConfig
): Promise<[string, string, string]> {
  const local = localHaikuDraft(theme);
  if (!theme.trim()) return local;

  const text = await callModel(
    `Write a gentle, family-friendly haiku about "${theme}". Return JSON {"lines": [l1, l2, l3]} ` +
      `with exactly 5, 7 and 5 syllables. Plain words, no rhyme required, no punctuation-only lines.`,
    config
  );
  const parsed = parseJson(text);
  const lines =
    parsed && typeof parsed === "object" && Array.isArray((parsed as { lines?: unknown }).lines)
      ? ((parsed as { lines: unknown[] }).lines as unknown[])
      : null;
  if (!lines || lines.length !== 3 || !lines.every((l) => typeof l === "string")) return local;

  const [a, b, c] = (lines as string[]).map((l) => l.trim()) as [string, string, string];
  const ok =
    countSyllables(a) === 5 &&
    countSyllables(b) === 7 &&
    countSyllables(c) === 5 &&
    isPublicSafe(`${a} ${b} ${c}`);
  return ok ? [a, b, c] : local;
}

/** Number of rhyme families available to the local fallback (for diagnostics / tests). */
export function getLocalRhymeFamilyCount(): number {
  return RHYME_FAMILIES.length;
}
