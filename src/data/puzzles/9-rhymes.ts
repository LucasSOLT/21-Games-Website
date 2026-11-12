/**
 * 9 Rhymes puzzle data: types, validator, 66-day perfect-rhyme bank and the
 * deterministic date-seeded generator (GAME_DESIGN_BIBLE Q12–Q19).
 *
 * Every puzzle = 1 Starter Word + 9 target answers that share ONE exact perfect rhyme
 * sound. The bank is built from the curated `RHYME_FAMILIES` dictionary (each family is a
 * verified perfect-rhyme set) so a puzzle can never mix rhyme sounds.
 */

import {
  RHYME_FAMILIES,
  type RhymeEntry,
  type RhymeFamily,
} from "@/data/rhyme-families";
import { fnv1a32, mulberry32 } from "@/lib/seeded-random";

export interface NineRhymesClue {
  /** Primary answer (lowercase letters only) — determines the letter count. */
  answer: string;
  /** Accepted alternative spellings (lowercase letters only). */
  altSpellings?: string[];
  /** Fill-in-the-blank sentence or description shown by Nine. May contain `___`. */
  sentence: string;
  /** Description hint revealed by the "New hint" pill (worth 0.5 pts instead of 1.0). */
  hint: string;
}

export interface NineRhymesPuzzle {
  id: string;
  puzzleNumber: number;
  title: string;
  starterWord: string;
  clues: NineRhymesClue[];
  author: string;
  editor: string;
  customDate?: string;
}

export const NINE_RHYMES_CLUE_COUNT = 9;
export const NINE_RHYMES_BANK_SIZE = 66;

const ANSWER_RE = /^[a-z]{2,15}$/;

/** Lowercases and strips everything except a–z (used for guesses, answers and alt spellings). */
export function normalizeRhymeWord(input: string): string {
  return input.toLowerCase().replace(/[^a-z]/g, "");
}

export interface NineRhymesValidation {
  valid: boolean;
  errors: string[];
}

/** Strict runtime validation for bank / Supabase / localStorage / Creator Mode payloads. */
export function validateNineRhymesPuzzle(payload: unknown): NineRhymesValidation {
  const errors: string[] = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, errors: ["Payload must be a non-null object."] };
  }
  const p = payload as Record<string, unknown>;

  if (typeof p.starterWord !== "string" || !ANSWER_RE.test(normalizeRhymeWord(p.starterWord)) ||
      normalizeRhymeWord(p.starterWord) !== p.starterWord.trim().toLowerCase()) {
    errors.push("starterWord must be a single word of 2-15 letters.");
  }
  if (!Array.isArray(p.clues) || p.clues.length !== NINE_RHYMES_CLUE_COUNT) {
    errors.push(`clues must be an array of exactly ${NINE_RHYMES_CLUE_COUNT} entries.`);
    return { valid: false, errors };
  }
  const starter = typeof p.starterWord === "string" ? normalizeRhymeWord(p.starterWord) : "";
  const seen = new Set<string>(starter ? [starter] : []);
  p.clues.forEach((raw, i) => {
    const n = i + 1;
    if (!raw || typeof raw !== "object") {
      errors.push(`Clue ${n} must be an object.`);
      return;
    }
    const c = raw as Record<string, unknown>;
    const answer = typeof c.answer === "string" ? c.answer.trim().toLowerCase() : "";
    if (!ANSWER_RE.test(answer)) {
      errors.push(`Clue ${n}: answer must be 2-15 lowercase letters.`);
    } else if (seen.has(answer)) {
      errors.push(`Clue ${n}: "${answer}" is a duplicate of another word.`);
    } else {
      seen.add(answer);
    }
    if (typeof c.sentence !== "string" || c.sentence.trim().length < 3 || c.sentence.length > 240) {
      errors.push(`Clue ${n}: sentence must be 3-240 characters.`);
    } else if (
      answer &&
      c.sentence
        .toLowerCase()
        .split(/[^a-z]+/)
        .includes(answer)
    ) {
      errors.push(`Clue ${n}: sentence must not contain the answer.`);
    }
    if (typeof c.hint !== "string" || c.hint.trim().length < 3 || c.hint.length > 240) {
      errors.push(`Clue ${n}: hint must be 3-240 characters.`);
    }
    if (c.altSpellings !== undefined) {
      if (!Array.isArray(c.altSpellings) || c.altSpellings.length > 6 ||
          !c.altSpellings.every((a) => typeof a === "string" && ANSWER_RE.test(a.trim().toLowerCase()))) {
        errors.push(`Clue ${n}: altSpellings must be up to 6 lowercase-letter words.`);
      }
    }
  });
  if (typeof p.title !== "string" || p.title.trim().length === 0) {
    errors.push("title is required.");
  }
  return { valid: errors.length === 0, errors };
}

export function isNineRhymesPuzzle(payload: unknown): payload is NineRhymesPuzzle {
  return validateNineRhymesPuzzle(payload).valid;
}

function shuffled<T>(items: readonly T[], seed: string): T[] {
  const rand = mulberry32(fnv1a32(seed));
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Builds the Nine-style clue for a dictionary entry. */
export function buildClueFromEntry(entry: RhymeEntry, starter: string): NineRhymesClue {
  const word = entry.word;
  const last = word[word.length - 1]!.toUpperCase();
  return {
    answer: word,
    sentence: `${entry.clue} — it rhymes with “${starter}”.`,
    hint:
      word.length > 3
        ? `It starts with “${word[0]!.toUpperCase()}” and ends with “${last}”.`
        : `It starts with “${word[0]!.toUpperCase()}”.`,
  };
}

/** Families that have at least 10 words (1 starter + 9 targets). */
export const USABLE_RHYME_FAMILIES: readonly RhymeFamily[] = RHYME_FAMILIES.filter(
  (f) => f.entries.length >= NINE_RHYMES_CLUE_COUNT + 1
);

/** Builds a validated puzzle from a family: seeded starter + 9 seeded targets. */
export function buildPuzzleFromFamily(
  family: RhymeFamily,
  seed: string,
  meta: { id: string; puzzleNumber: number; author?: string; editor?: string }
): NineRhymesPuzzle {
  const order = shuffled(family.entries, `${seed}:${family.id}`);
  const starter = order[0]!;
  const targets = order.slice(1, 1 + NINE_RHYMES_CLUE_COUNT);
  return {
    id: meta.id,
    puzzleNumber: meta.puzzleNumber,
    title: `Rhymes with “${starter.word}”`,
    starterWord: starter.word,
    clues: targets.map((t) => buildClueFromEntry(t, starter.word)),
    author: meta.author ?? "SOL Theory",
    editor: meta.editor ?? "Daily Editorial",
  };
}

function buildBank(): NineRhymesPuzzle[] {
  const order = shuffled(USABLE_RHYME_FAMILIES, "9-rhymes:bank-order");
  const bank: NineRhymesPuzzle[] = [];
  for (let i = 0; i < NINE_RHYMES_BANK_SIZE; i++) {
    const family = order[i % order.length]!;
    const round = Math.floor(i / order.length);
    bank.push(
      buildPuzzleFromFamily(family, `9-rhymes:bank:${round}`, {
        id: `9r-bank-${String(i + 1).padStart(2, "0")}`,
        puzzleNumber: i + 1,
      })
    );
  }
  return bank;
}

/** 66-day perfect-rhyme puzzle bank. */
export const NINE_RHYMES_PUZZLES: NineRhymesPuzzle[] = buildBank();

/**
 * Deterministic date-seeded fallback: `hash("9-rhymes:" + dateKey)` picks a family and the
 * word order, so any date always resolves to a valid puzzle even if the bank/override fail.
 */
export function generateSeededNineRhymesPuzzle(
  dateKey: string,
  puzzleNumber: number
): NineRhymesPuzzle {
  const idx = fnv1a32(`9-rhymes:${dateKey}`) % USABLE_RHYME_FAMILIES.length;
  const family = USABLE_RHYME_FAMILIES[idx]!;
  return {
    ...buildPuzzleFromFamily(family, `9-rhymes:seed:${dateKey}`, {
      id: `9r-seed-${dateKey}`,
      puzzleNumber,
    }),
    customDate: dateKey,
  };
}
