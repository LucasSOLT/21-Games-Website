/**
 * Pure game logic for 9 Rhymes (no React): guess matching, scoring, the chat transcript
 * builder, blank rendering and the emoji share receipt.
 */

import {
  NINE_RHYMES_CLUE_COUNT,
  normalizeRhymeWord,
  validateNineRhymesPuzzle,
  type NineRhymesClue,
  type NineRhymesPuzzle,
} from "@/data/puzzles/9-rhymes";

export type RoundOutcome = "correct" | "wrong" | "revealed";

export interface RoundResult {
  /** What the player sent for this word (empty for reveals). */
  guess: string;
  outcome: RoundOutcome;
  /** True when "New hint" was used this round. */
  hinted: boolean;
  /** 1.0 / 0.5 / 0 */
  points: number;
}

export interface NineRhymesProgressState {
  results: RoundResult[];
  /** Hint used on the CURRENT (unanswered) round. */
  currentHinted: boolean;
}

export const CORRECT_POINTS = 1;
export const HINTED_CORRECT_POINTS = 0.5;
export const HINT_COST_LABEL = "New hint (-0.5 pts)";
export const REVEAL_LABEL = "Reveal answer (0 pts)";

export function matchesAnswer(guess: string, clue: Pick<NineRhymesClue, "answer" | "altSpellings">): boolean {
  const g = normalizeRhymeWord(guess);
  if (!g) return false;
  if (g === normalizeRhymeWord(clue.answer)) return true;
  return (clue.altSpellings ?? []).some((a) => normalizeRhymeWord(a) === g);
}

export function pointsForGuess(correct: boolean, hinted: boolean): number {
  if (!correct) return 0;
  return hinted ? HINTED_CORRECT_POINTS : CORRECT_POINTS;
}

export function totalScore(results: readonly RoundResult[]): number {
  return results.reduce((sum, r) => sum + r.points, 0);
}

export function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/** Spaced underscores with exact letter count, e.g. `_ _ _ _ (4 letters)`. */
export function formatBlanks(answerLength: number): string {
  const blanks = Array.from({ length: answerLength }, () => "_").join(" ");
  return `${blanks} (${answerLength} ${answerLength === 1 ? "letter" : "letters"})`;
}

/** Inserts the blanks into the sentence (replacing `___`) or appends them. */
export function renderPrompt(clue: NineRhymesClue): string {
  const blanks = formatBlanks(normalizeRhymeWord(clue.answer).length);
  const sentence = clue.sentence.trim();
  if (/_{3,}/.test(sentence)) return sentence.replace(/_{3,}/, blanks);
  return `${sentence}\n${blanks}`;
}

export const MOTIVATING_REPLIES = [
  "Nailed it! 🎯",
  "Yes! That's the one.",
  "Spot on! Nice rhyme-ing.",
  "You're on a roll!",
  "Smooth. Really smooth.",
  "Perfect! Keep it going.",
] as const;

export const MISS_REPLIES = [
  "Ooh, close! Not quite.",
  "Not that one — onward!",
  "Good try! On to the next.",
  "That one got away from us.",
  "No worries, shake it off.",
] as const;

export const REVEAL_REPLIES = [
  "No problem — here's the answer.",
  "Got it. Revealing that one.",
] as const;

/** Stable pick so transcripts rebuild identically after reload. */
function pickReply(list: readonly string[], seed: number): string {
  return list[Math.abs(seed) % list.length]!;
}

export type TranscriptRole = "nine" | "me";

export interface TranscriptMessage {
  id: string;
  role: TranscriptRole;
  text: string;
  kind: "intro" | "prompt" | "guess" | "hint-request" | "hint" | "reveal-request" | "feedback" | "summary";
}

export function getRhymeTargetForRound(
  puzzle: Pick<NineRhymesPuzzle, "starterWord" | "clues">,
  roundIndex: number
): string {
  if (roundIndex <= 0) {
    return puzzle.starterWord.toUpperCase();
  }
  const prevIdx = Math.min(roundIndex - 1, puzzle.clues.length - 1);
  return (puzzle.clues[prevIdx]?.answer ?? puzzle.starterWord).toUpperCase();
}

export function buildTranscript(
  puzzle: Pick<NineRhymesPuzzle, "id" | "starterWord" | "clues" | "puzzleNumber">,
  state: NineRhymesProgressState
): TranscriptMessage[] {
  const msgs: TranscriptMessage[] = [];
  const push = (id: string, role: TranscriptRole, text: string, kind: TranscriptMessage["kind"]) =>
    msgs.push({ id, role, text, kind });

  push("intro", "nine", `Here's today's word: ${puzzle.starterWord.toUpperCase()}`, "intro");

  const done = state.results.length;
  const lastRound = Math.min(done, NINE_RHYMES_CLUE_COUNT - 1);
  for (let i = 0; i <= lastRound; i++) {
    const clue = puzzle.clues[i]!;
    const rhymeTarget = getRhymeTargetForRound(puzzle, i);
    const rhymeLead =
      i === 0
        ? `Rhymes with ${rhymeTarget}`
        : `The next word rhymes with ${rhymeTarget}`;
    push(
      `q${i}`,
      "nine",
      `Word ${i + 1} of ${NINE_RHYMES_CLUE_COUNT} · ${rhymeLead}\n${renderPrompt(clue)}`,
      "prompt"
    );

    const result = state.results[i];
    const hinted = result ? result.hinted : state.currentHinted;
    if (hinted) {
      push(`q${i}-hq`, "me", "Can I get a hint?", "hint-request");
      push(`q${i}-h`, "nine", `Hint: ${clue.hint}`, "hint");
    }
    if (!result) break;

    if (result.outcome === "revealed") {
      push(`q${i}-a`, "me", clue.answer.toUpperCase(), "reveal-request");
      push(
        `q${i}-f`,
        "nine",
        `${pickReply(REVEAL_REPLIES, i + puzzle.puzzleNumber)} (0 pts)`,
        "feedback"
      );
    } else {
      push(`q${i}-a`, "me", result.guess.toUpperCase(), "guess");
      if (result.outcome === "correct") {
        push(
          `q${i}-f`,
          "nine",
          `${pickReply(MOTIVATING_REPLIES, i + puzzle.puzzleNumber)} +${formatScore(result.points)}`,
          "feedback"
        );
      } else {
        push(
          `q${i}-f`,
          "nine",
          `${pickReply(MISS_REPLIES, i + puzzle.puzzleNumber)} It was ${clue.answer.toUpperCase()}.`,
          "feedback"
        );
      }
    }
  }

  if (done >= NINE_RHYMES_CLUE_COUNT) {
    const score = totalScore(state.results);
    push(
      "summary",
      "nine",
      `That's all 9! You scored ${formatScore(score)} / ${NINE_RHYMES_CLUE_COUNT} today.`,
      "summary"
    );
  }
  return msgs;
}

export function pointsToEmoji(points: number): string {
  if (points >= CORRECT_POINTS) return "🟩";
  if (points > 0) return "🟨";
  return "⬜";
}

export function buildReceiptEmojis(results: readonly RoundResult[]): string {
  const tiles: string[] = [];
  for (let i = 0; i < NINE_RHYMES_CLUE_COUNT; i++) {
    tiles.push(results[i] ? pointsToEmoji(results[i]!.points) : "⬜");
  }
  return tiles.join("");
}

export function buildShareText(options: {
  puzzleNumber: number;
  results: readonly RoundResult[];
  custom?: boolean;
  creatorHandle?: string;
}): string {
  const score = formatScore(totalScore(options.results));
  const head = options.custom
    ? `9 Rhymes${options.creatorHandle ? ` by ${options.creatorHandle}` : " (friend puzzle)"}`
    : `9 Rhymes #${options.puzzleNumber}`;
  return `${head}\n${score} / ${NINE_RHYMES_CLUE_COUNT}\n${buildReceiptEmojis(options.results)}`;
}

export interface CreatorDraftRow {
  answer: string;
  altSpellings: string;
  sentence: string;
  hint: string;
}

/** Converts creator form rows into a validated puzzle payload (or error list). */
export function draftToPuzzle(options: {
  id: string;
  title: string;
  starterWord: string;
  rows: CreatorDraftRow[];
  creatorName: string;
}): { puzzle: NineRhymesPuzzle | null; errors: string[] } {
  const starter = normalizeRhymeWord(options.starterWord);
  const clues: NineRhymesClue[] = options.rows.map((r) => {
    const answer = normalizeRhymeWord(r.answer);
    const alts = r.altSpellings
      .split(",")
      .map((a) => normalizeRhymeWord(a))
      .filter((a) => a.length > 0 && a !== answer);
    return {
      answer,
      sentence: r.sentence.trim(),
      hint: r.hint.trim(),
      ...(alts.length ? { altSpellings: [...new Set(alts)].slice(0, 6) } : {}),
    };
  });
  const puzzle: NineRhymesPuzzle = {
    id: options.id,
    puzzleNumber: 0,
    title: options.title.trim() || `Rhymes with “${starter}”`,
    starterWord: starter,
    clues,
    author: options.creatorName.trim() || "Friend",
    editor: "Creator",
  };
  const check = validateNineRhymesPuzzle(puzzle);
  return check.valid ? { puzzle, errors: [] } : { puzzle: null, errors: check.errors };
}
