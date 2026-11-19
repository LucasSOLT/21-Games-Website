"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Lightbulb,
  Play,
  RotateCcw,
  Shuffle,
  Sparkles,
  Undo2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AllGameSlug } from "@/lib/games-config";
import {
  buildStructuredHaikuLines,
  findConnect5TitleSpoiler,
  isPlaceholderConnect5Connection,
  sanitizeConnect5Puzzle,
  sanitizeCustomWordChunks,
  type Connect5PuzzleShape,
  type SeventeenSyllablesPuzzleShape,
} from "@/lib/puzzle-sanitizers";
import {
  countLineSyllables,
  validateHaikuStructure,
} from "@/data/puzzles/17-syllables";
import type { TwentyOneThingsBoard } from "@/data/puzzles/21-things";
import type { NineRhymesPuzzle } from "@/data/puzzles/9-rhymes";
import {
  formatScore,
  getRhymeTargetForRound,
  matchesAnswer,
  pointsForGuess,
  renderPrompt,
} from "@/lib/nine-rhymes-engine";
import { findRhymeFamilyForWord } from "@/data/rhyme-families";
import {
  getInitialRevealedPiece,
  matchSixPicsImageGuess,
  renderSixPicsSceneDataUri,
  scoreForSixPicsImage,
  type SixPicsPuzzle,
} from "@/data/puzzles/6-pics";
import { ImageWithFallback } from "@/components/image-with-fallback";
import {
  ECHO_DIFFICULTIES,
  ECHO_POSITION_COLORS,
  ECHO_POSITION_NAMES,
  buildEchoChainRules,
  describeEchoTile,
  getEchoStage,
  type EchoDifficulty,
  type EightfoldEchoPuzzle,
} from "@/data/puzzles/eightfold-echo";
import { EchoTileSvg } from "@/components/games/echo-tile-svg";
import {
  FOUR_SCORE_TARGET,
  applyBinaryFourScore,
  applyUnaryFourScore,
  buildFourScoreFormulaBlueprint,
  solveFourScore,
  type FourScoreOperator,
  type FourScorePuzzle,
} from "@/data/puzzles/four-score";
import {
  MOVE_TWO_DIFFICULTIES,
  MOVE_TWO_DIFFICULTY_META,
  getInitialBlockState,
  stepBloxorzBlock,
  type MoveTwoDifficulty,
  type MoveTwoPuzzle,
} from "@/data/puzzles/move-2";
import { MoveTwoBloxorzCanvas } from "@/components/games/move-two-canvas";
import {
  ONE_WIN_DEFAULT_PROMPT,
  normalizeOneWinEntry,
  type OneWinPromptPuzzle,
} from "@/data/puzzles/1-win";
import { moderateText } from "@/lib/moderation";
import { fnv1a32, mulberry32 } from "@/lib/seeded-random";
import { cn } from "@/lib/utils";

export interface AdminPuzzlePreviewModalProps {
  open: boolean;
  onClose: () => void;
  gameSlug: AllGameSlug;
  targetDate: string;
  draftPayload: unknown;
}

const GAME_LABELS: Record<AllGameSlug, string> = {
  "21-things": "21 Things",
  "17-syllables": "17 Syllables",
  "9-rhymes": "9 Rhymes",
  "eightfold-echo": "Eightfold Echo",
  "6-pics": "6 Pics",
  "connect-5": "Connect 5",
  "four-score": "Four Score",
  "move-2": "Move Two",
  "1-win": "1 Win",
};

function BylineHeader({
  title,
  author,
  editor,
  subtitle,
}: {
  title: string;
  author?: string;
  editor?: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border-2 border-black bg-[#FAF9F6] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="font-headline font-black text-base sm:text-lg text-black truncate">
          {title || "Untitled Draft"}
        </p>
        {subtitle && (
          <p className="text-xs text-neutral-600 line-clamp-2">{subtitle}</p>
        )}
      </div>
      <div className="text-right text-xs text-neutral-600 shrink-0">
        <p className="font-bold text-black">
          By {author?.trim() || "SOL Theory"}
        </p>
        <p className="text-[11px]">
          Edited by {editor?.trim() || "Daily Editorial"}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// 1. Connect 5 Sandbox Preview
// ============================================================================
function Connect5DraftPreview({ draft }: { draft: unknown }) {
  const puzzle = useMemo<Connect5PuzzleShape>(() => {
    const raw = (draft ?? {}) as Partial<Connect5PuzzleShape>;
    const words: [string, string, string, string, string] = [
      String(raw.words?.[0] ?? "WORD1").toUpperCase(),
      String(raw.words?.[1] ?? "WORD2").toUpperCase(),
      String(raw.words?.[2] ?? "WORD3").toUpperCase(),
      String(raw.words?.[3] ?? "WORD4").toUpperCase(),
      String(raw.words?.[4] ?? "WORD5").toUpperCase(),
    ];
    const connections: [string, string, string, string] = [
      String(raw.connections?.[0] ?? ""),
      String(raw.connections?.[1] ?? ""),
      String(raw.connections?.[2] ?? ""),
      String(raw.connections?.[3] ?? ""),
    ];
    return sanitizeConnect5Puzzle({
      id: raw.id ?? "c5-preview",
      puzzleNumber: raw.puzzleNumber ?? 1,
      title: raw.title ?? "Untitled Chain",
      words,
      connections,
      revealedHints: Array.isArray(raw.revealedHints) ? raw.revealedHints : [],
      author: raw.author ?? "SOL Theory",
      editor: raw.editor ?? "Daily Editorial",
    });
  }, [draft]);

  const [guesses, setGuesses] = useState<[string, string, string]>(() => [
    "",
    "",
    "",
  ]);
  const [revealBridges, setRevealBridges] = useState(false);

  const spoilerWord = useMemo(
    () => findConnect5TitleSpoiler(puzzle.title, puzzle.words),
    [puzzle.title, puzzle.words]
  );

  const placeholderBridges = useMemo(
    () =>
      puzzle.connections
        .map((c, idx) =>
          !c.trim() || isPlaceholderConnect5Connection(c) ? idx + 1 : null
        )
        .filter((v): v is number => v !== null),
    [puzzle.connections]
  );

  const hintPatternForRow = (rowIdx: number): string => {
    const word = puzzle.words[rowIdx] ?? "";
    const hintedCols = new Set(
      puzzle.revealedHints
        .filter((h) => h.row === rowIdx)
        .map((h) => h.col)
    );
    return word
      .split("")
      .map((ch, col) => (hintedCols.has(col) ? ch : "•"))
      .join("");
  };

  const middleSolved = [1, 2, 3].every(
    (rowIdx, gIdx) =>
      guesses[gIdx]!.trim().toUpperCase() === puzzle.words[rowIdx]
  );

  return (
    <div className="space-y-4" data-testid="preview-connect-5">
      <BylineHeader
        title={puzzle.title}
        author={puzzle.author}
        editor={puzzle.editor}
        subtitle="Bookend Chain Tester — Word 1 & Word 5 shown; type Words 2–4 or inspect bridges."
      />

      {(spoilerWord || placeholderBridges.length > 0) && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-xs text-amber-950 space-y-1">
          {spoilerWord && (
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700" />
              Title Spoiler Warning: Title contains hidden word &ldquo;{spoilerWord}&rdquo;.
            </p>
          )}
          {placeholderBridges.length > 0 && (
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700" />
              Bridge #{placeholderBridges.join(", #")} uses a generic placeholder explanation.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2.5">
        {puzzle.words.map((word, rowIdx) => {
          const isBookend = rowIdx === 0 || rowIdx === 4;
          const gIdx = rowIdx - 1;
          const val = isBookend ? word : guesses[gIdx] ?? "";
          const isCorrect =
            !isBookend && val.trim().toUpperCase() === word && word.length > 0;

          return (
            <div key={rowIdx} className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "h-9 w-9 rounded-xl border-2 border-black font-headline font-black text-sm flex items-center justify-center shrink-0",
                    isBookend || isCorrect
                      ? "bg-[#2ECC71] text-black"
                      : "bg-white text-black"
                  )}
                >
                  {rowIdx + 1}
                </span>

                {isBookend ? (
                  <div className="flex-1 rounded-xl border-2 border-black bg-[#2ECC71]/25 px-3.5 py-2 font-mono font-black text-base tracking-widest uppercase flex items-center justify-between">
                    <span>{word}</span>
                    <Badge variant="outline" className="border-black bg-white text-[10px]">
                      {rowIdx === 0 ? "Word 1 (Anchor)" : "Word 5 (Anchor)"}
                    </Badge>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      value={val}
                      onChange={(e) => {
                        const next = [...guesses] as [string, string, string];
                        next[gIdx] = e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z]/g, "");
                        setGuesses(next);
                      }}
                      placeholder={`Hint mask: ${hintPatternForRow(rowIdx)} (${word.length} letters)`}
                      className={cn(
                        "font-mono font-black uppercase tracking-widest border-2 border-black text-base sm:text-sm",
                        isCorrect && "bg-emerald-50 border-emerald-700"
                      )}
                      data-testid={`preview-c5-input-${rowIdx + 1}`}
                    />
                    <span className="w-20 text-right text-xs font-mono font-bold shrink-0">
                      {isCorrect ? (
                        <span className="text-emerald-700 inline-flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Match
                        </span>
                      ) : (
                        `${word.length} chars`
                      )}
                    </span>
                  </div>
                )}
              </div>

              {revealBridges && rowIdx < 4 && (
                <div className="ml-11 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-800">
                  <span className="font-mono font-bold text-emerald-800">
                    {puzzle.words[rowIdx]} + {puzzle.words[rowIdx + 1]}:
                  </span>{" "}
                  {puzzle.connections[rowIdx]}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {middleSolved && (
        <div className="rounded-xl border-2 border-black bg-[#2ECC71]/25 p-3 text-xs font-black text-black flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-800 shrink-0" />
          Chain Solved! All 5 words &amp; 4 bridges verified in sandbox.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRevealBridges((v) => !v)}
          data-testid="preview-c5-reveal-bridges"
          className="border-2 border-black font-bold text-xs"
        >
          {revealBridges ? (
            <EyeOff className="h-3.5 w-3.5 mr-1.5" />
          ) : (
            <Eye className="h-3.5 w-3.5 mr-1.5" />
          )}
          {revealBridges
            ? "Hide Bridge Explanations"
            : "Reveal Bridge Explanations"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setGuesses([puzzle.words[1], puzzle.words[2], puzzle.words[3]])
          }
          className="border-2 border-black font-bold text-xs"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Fill Answers
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setGuesses(["", "", ""])}
          className="border-2 border-black font-bold text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// 2. 17 Syllables Sandbox Preview
// ============================================================================
function SeventeenSyllablesDraftPreview({ draft }: { draft: unknown }) {
  const raw = (draft ?? {}) as Partial<
    SeventeenSyllablesPuzzleShape & { editor?: string }
  >;
  const lines = useMemo<[string, string, string]>(
    () => [
      String(raw.lines?.[0] ?? ""),
      String(raw.lines?.[1] ?? ""),
      String(raw.lines?.[2] ?? ""),
    ],
    [raw.lines]
  );

  const sanitizedCustom = useMemo(
    () => sanitizeCustomWordChunks(lines, raw.customWordChunks),
    [lines, raw.customWordChunks]
  );

  const structured = useMemo(
    () => buildStructuredHaikuLines(lines, sanitizedCustom),
    [lines, sanitizedCustom]
  );

  const slotDefs = useMemo(() => {
    const out: Array<{
      slotKey: string;
      lineIdx: number;
      wordIdx: number;
      chunkIdx: number;
      expected: string;
    }> = [];
    structured.forEach((line, lineIdx) => {
      line.words.forEach((w, wordIdx) => {
        w.chunks.forEach((chunk, chunkIdx) => {
          out.push({
            slotKey: `${lineIdx}-${wordIdx}-${chunkIdx}`,
            lineIdx,
            wordIdx,
            chunkIdx,
            expected: chunk,
          });
        });
      });
    });
    return out;
  }, [structured]);

  const [shuffleSeed, setShuffleSeed] = useState(1);
  const trayItems = useMemo(() => {
    const items = slotDefs.map((s, idx) => ({
      trayId: `tray-${idx}`,
      text: s.expected,
    }));
    const rand = mulberry32(
      fnv1a32(`preview-17s:${shuffleSeed}:${items.map((i) => i.text).join("|")}`)
    );
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled;
  }, [slotDefs, shuffleSeed]);

  // Maps slotKey -> trayId
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [activeSlotKey, setActiveSlotKey] = useState<string | null>(null);

  const usedTrayIds = useMemo(() => new Set(Object.values(placed)), [placed]);
  const trayById = useMemo(
    () => new Map(trayItems.map((item) => [item.trayId, item.text])),
    [trayItems]
  );

  const handleTapTrayChunk = (trayId: string) => {
    if (usedTrayIds.has(trayId)) return;
    const targetSlot =
      (activeSlotKey && !placed[activeSlotKey] ? activeSlotKey : null) ??
      slotDefs.find((s) => !placed[s.slotKey])?.slotKey;
    if (!targetSlot) return;
    setPlaced((prev) => ({ ...prev, [targetSlot]: trayId }));
    setActiveSlotKey(null);
  };

  const handleTapSlot = (slotKey: string) => {
    if (placed[slotKey]) {
      setPlaced((prev) => {
        const next = { ...prev };
        delete next[slotKey];
        return next;
      });
      setActiveSlotKey(slotKey);
    } else {
      setActiveSlotKey((prev) => (prev === slotKey ? null : slotKey));
    }
  };

  const handleAutoFill = () => {
    const remaining = [...trayItems];
    const next: Record<string, string> = {};
    for (const slot of slotDefs) {
      const matchIdx = remaining.findIndex((t) => t.text === slot.expected);
      if (matchIdx >= 0) {
        next[slot.slotKey] = remaining[matchIdx]!.trayId;
        remaining.splice(matchIdx, 1);
      }
    }
    setPlaced(next);
  };

  const allFilled =
    slotDefs.length > 0 && slotDefs.every((s) => Boolean(placed[s.slotKey]));
  const allCorrect =
    allFilled &&
    slotDefs.every((s) => {
      const tId = placed[s.slotKey];
      return tId ? trayById.get(tId) === s.expected : false;
    });

  const haikuValid = validateHaikuStructure(lines);

  return (
    <div className="space-y-4" data-testid="preview-17-syllables">
      <BylineHeader
        title={raw.theme || "Untitled Haiku"}
        author={raw.author}
        editor={raw.editor}
        subtitle={`5 · 7 · 5 Syllable Reconstruction (${slotDefs.length} slices)`}
      />

      {!haikuValid.isValid && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-xs text-amber-950 font-semibold">
          Syllable Check: {haikuValid.errors.join(" · ")}
        </div>
      )}

      {/* 3 Haiku Lines with Word-Grouped Slots */}
      <div className="rounded-2xl border-2 border-black bg-white p-4 space-y-3">
        {structured.map((line, lineIdx) => {
          const targetSyl = lineIdx === 1 ? 7 : 5;
          const actualSyl = countLineSyllables(lines[lineIdx] ?? "");
          return (
            <div key={lineIdx} className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-neutral-500">
                <span>
                  LINE {lineIdx + 1} ({targetSyl} SYLLABLES)
                </span>
                <span
                  className={cn(
                    actualSyl === targetSyl ? "text-emerald-700" : "text-amber-700"
                  )}
                >
                  {actualSyl}/{targetSyl} syl
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {line.words.map((word, wordIdx) => (
                  <div
                    key={`${lineIdx}-${wordIdx}`}
                    className="inline-flex items-center gap-1 rounded-xl border border-neutral-300 bg-neutral-50 p-1"
                  >
                    {word.chunks.map((expectedChunk, chunkIdx) => {
                      const slotKey = `${lineIdx}-${wordIdx}-${chunkIdx}`;
                      const trayId = placed[slotKey];
                      const placedText = trayId ? trayById.get(trayId) : null;
                      const isSelected = activeSlotKey === slotKey;
                      const isWrongWhenFull =
                        allFilled && placedText !== expectedChunk;

                      return (
                        <button
                          key={slotKey}
                          type="button"
                          onClick={() => handleTapSlot(slotKey)}
                          data-testid={`preview-17s-slot-${slotKey}`}
                          className={cn(
                            "min-w-11 h-9 px-2.5 rounded-lg border-2 font-mono font-black text-xs uppercase transition-all cursor-pointer",
                            placedText
                              ? isWrongWhenFull
                                ? "border-amber-600 bg-amber-100 text-amber-950"
                                : "border-black bg-[#b6df52] text-black shadow-[1px_1px_0px_#000]"
                              : isSelected
                              ? "border-black bg-yellow-100 text-black"
                              : "border-dashed border-neutral-400 bg-white text-neutral-400 hover:border-black"
                          )}
                        >
                          {placedText ?? `${expectedChunk.length}`}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {allCorrect && (
        <div className="rounded-xl border-2 border-black bg-[#b6df52]/50 p-3 text-xs font-black text-black flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-900 shrink-0" />
          ✨ Perfect 5 · 7 · 5 Haiku Reconstructed!
        </div>
      )}

      {/* Interactive Chunk Tray */}
      <div className="rounded-xl border-2 border-black bg-[#FAF9F6] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-neutral-600">
          <span>
            Tap Chunks to Place ({trayItems.length - usedTrayIds.size} remaining)
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShuffleSeed((n) => n + 1)}
              className="h-7 px-2 text-xs font-bold border border-black"
            >
              <Shuffle className="h-3 w-3 mr-1" /> Shuffle
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAutoFill}
              className="h-7 px-2 text-xs font-bold border border-black"
            >
              <Sparkles className="h-3 w-3 mr-1" /> Auto-Solve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setPlaced({});
                setActiveSlotKey(null);
              }}
              className="h-7 px-2 text-xs font-bold border border-black"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Reset
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {trayItems.map((item) => {
            const used = usedTrayIds.has(item.trayId);
            return (
              <button
                key={item.trayId}
                type="button"
                disabled={used}
                onClick={() => handleTapTrayChunk(item.trayId)}
                className={cn(
                  "px-3 py-1.5 rounded-lg border-2 font-mono font-black text-xs uppercase transition-all",
                  used
                    ? "border-neutral-200 bg-neutral-100 text-neutral-300 cursor-default"
                    : "border-black bg-white text-black shadow-[2px_2px_0px_#000] hover:bg-[#b6df52]/40 cursor-pointer"
                )}
              >
                {item.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. 21 Things Funnel Simulator
// ============================================================================
function TwentyOneThingsDraftPreview({ draft }: { draft: unknown }) {
  const raw = (draft ?? {}) as Partial<
    TwentyOneThingsBoard & { author?: string; editor?: string }
  >;
  const items = useMemo(() => {
    const base = Array.isArray(raw.items) ? raw.items : [];
    return Array.from({ length: 21 }, (_, idx) =>
      String(base[idx] ?? "").trim() || `Item #${idx + 1}`
    );
  }, [raw.items]);

  const [phase, setPhase] = useState<"pick6" | "pick3" | "pick1" | "done">(
    "pick6"
  );
  const [pick6, setPick6] = useState<number[]>([]);
  const [pick3, setPick3] = useState<number[]>([]);
  const [pick1, setPick1] = useState<number | null>(null);

  const toggleIndex = (
    idx: number,
    list: number[],
    limit: number,
    setter: (next: number[]) => void
  ) => {
    if (list.includes(idx)) {
      setter(list.filter((i) => i !== idx));
    } else if (list.length < limit) {
      setter([...list, idx]);
    }
  };

  const resetFunnel = () => {
    setPhase("pick6");
    setPick6([]);
    setPick3([]);
    setPick1(null);
  };

  return (
    <div className="space-y-4" data-testid="preview-21-things">
      <BylineHeader
        title={raw.title || "Daily 21 Things"}
        author={raw.author || raw.creatorName}
        editor={raw.editor}
        subtitle={raw.creatorBio}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/15 bg-[#f6edf5] px-3.5 py-2 text-xs font-bold">
        <span>
          {phase === "pick6" && `Step 1 of 3 · Select 6 Resonance Cards (${pick6.length}/6)`}
          {phase === "pick3" && `Step 2 of 3 · Narrow to Top 3 (${pick3.length}/3)`}
          {phase === "pick1" && "Step 3 of 3 · Crown Your #1 Resonance Pick"}
          {phase === "done" && `Funnel Complete · #1 Pick: "${items[pick1 ?? 0]}"`}
        </span>
        <div className="flex items-center gap-1.5">
          {phase === "pick6" && pick6.length < 6 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPick6([0, 1, 2, 3, 4, 5])}
              className="h-7 px-2 text-xs font-bold border border-black bg-white"
            >
              Quick Pick 6
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={resetFunnel}
            className="h-7 px-2 text-xs font-bold border border-black bg-white"
          >
            <RotateCcw className="h-3 w-3 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {phase === "pick6" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {items.map((item, idx) => {
              const selected = pick6.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleIndex(idx, pick6, 6, setPick6)}
                  className={cn(
                    "rounded-xl border-2 p-2.5 text-left text-xs font-bold transition-all cursor-pointer min-h-14",
                    selected
                      ? "border-black bg-[#daa8d0] text-black shadow-[2px_2px_0px_#000]"
                      : "border-black/20 bg-white text-neutral-900 hover:border-black"
                  )}
                >
                  <span className="block text-[10px] font-mono opacity-65">
                    #{idx + 1}
                  </span>
                  <span className="line-clamp-2">{item}</span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={pick6.length !== 6}
              onClick={() => setPhase("pick3")}
              className="bg-black text-white font-bold text-xs border-2 border-black"
            >
              Continue with Top 6 →
            </Button>
          </div>
        </>
      )}

      {phase === "pick3" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {pick6.map((idx) => {
              const selected = pick3.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleIndex(idx, pick3, 3, setPick3)}
                  className={cn(
                    "rounded-xl border-2 p-3 text-left text-xs font-bold transition-all cursor-pointer min-h-16",
                    selected
                      ? "border-black bg-[#F9D423] text-black shadow-[2px_2px_0px_#000]"
                      : "border-black/25 bg-white text-black hover:border-black"
                  )}
                >
                  <span className="block text-[10px] font-mono opacity-65">
                    #{idx + 1}
                  </span>
                  {items[idx]}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={pick3.length !== 3}
              onClick={() => setPhase("pick1")}
              className="bg-black text-white font-bold text-xs border-2 border-black"
            >
              Continue with Final 3 →
            </Button>
          </div>
        </>
      )}

      {phase === "pick1" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {pick3.map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setPick1(idx);
                setPhase("done");
              }}
              className="rounded-2xl border-2 border-black bg-[#FAF9F6] hover:bg-[#2ECC71]/30 p-4 text-left font-headline font-black text-sm cursor-pointer shadow-[3px_3px_0px_#000]"
            >
              <span className="block text-[10px] font-mono text-neutral-500 mb-1">
                Tap to Crown #1
              </span>
              {items[idx]}
            </button>
          ))}
        </div>
      )}

      {phase === "done" && pick1 !== null && (
        <div className="rounded-2xl border-2 border-black bg-[#f6edf5] p-4 space-y-2 text-center">
          <Badge className="bg-black text-white border border-black">
            #1 Daily Resonance
          </Badge>
          <p className="font-headline font-black text-xl text-black">
            {items[pick1]}
          </p>
          <p className="text-xs text-neutral-600">
            Finalists: {pick3.map((i) => items[i]).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 4. 9 Rhymes Chat Preview
// ============================================================================
function NineRhymesDraftPreview({ draft }: { draft: unknown }) {
  const puzzle = useMemo<NineRhymesPuzzle>(() => {
    const raw = (draft ?? {}) as Partial<NineRhymesPuzzle>;
    const clues = Array.isArray(raw.clues) ? raw.clues : [];
    return {
      id: raw.id ?? "9r-preview",
      puzzleNumber: raw.puzzleNumber ?? 1,
      title: raw.title ?? "9 Rhymes Draft",
      starterWord: String(raw.starterWord ?? "day").trim() || "day",
      author: raw.author ?? "SOL Theory",
      editor: raw.editor ?? "Daily Editorial",
      clues: Array.from({ length: 9 }, (_, i) => ({
        answer: String(clues[i]?.answer ?? "").trim().toLowerCase(),
        altSpellings: clues[i]?.altSpellings ?? [],
        sentence: String(clues[i]?.sentence ?? ""),
        hint: String(clues[i]?.hint ?? ""),
      })),
    };
  }, [draft]);

  const family = useMemo(
    () => findRhymeFamilyForWord(puzzle.starterWord),
    [puzzle.starterWord]
  );

  const [stepIdx, setStepIdx] = useState(0);
  const [guess, setGuess] = useState("");
  const [hintShown, setHintShown] = useState<Record<number, boolean>>({});
  const [outcomes, setOutcomes] = useState<
    Record<number, { solved: boolean; pts: number; revealed?: boolean }>
  >({});

  const activeClue = puzzle.clues[stepIdx]!;
  const rhymeTarget = getRhymeTargetForRound(puzzle, stepIdx);
  const isHinted = Boolean(hintShown[stepIdx]);
  const currentOutcome = outcomes[stepIdx];

  const totalPts = Object.values(outcomes).reduce((acc, o) => acc + o.pts, 0);

  const submitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || !activeClue.answer) return;
    const ok = matchesAnswer(guess, activeClue);
    if (ok) {
      const pts = pointsForGuess(true, isHinted);
      setOutcomes((prev) => ({ ...prev, [stepIdx]: { solved: true, pts } }));
      setGuess("");
    } else {
      setOutcomes((prev) => ({ ...prev, [stepIdx]: { solved: false, pts: 0 } }));
    }
  };

  return (
    <div className="space-y-4" data-testid="preview-9-rhymes">
      <BylineHeader
        title={puzzle.title}
        author={puzzle.author}
        editor={puzzle.editor}
        subtitle={`Starter Word: ${puzzle.starterWord.toUpperCase()} · Rhyme Family: ${
          family ? `-${family.id} (${family.entries.length} words)` : "Custom / Unindexed"
        }`}
      />

      {/* Stepper 1..9 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {puzzle.clues.map((_, i) => {
            const out = outcomes[i];
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setStepIdx(i);
                  setGuess("");
                }}
                className={cn(
                  "h-8 w-8 rounded-lg border-2 font-mono font-black text-xs cursor-pointer transition-all",
                  stepIdx === i
                    ? "border-black bg-black text-white"
                    : out?.solved
                    ? "border-black bg-[#2ECC71] text-black"
                    : out
                    ? "border-neutral-400 bg-neutral-200 text-neutral-700"
                    : "border-neutral-300 bg-white text-black hover:border-black"
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <Badge variant="outline" className="border-2 border-black font-mono font-bold">
          Score: {formatScore(totalPts)} / 9
        </Badge>
      </div>

      {/* Nine Chat Bubble */}
      <div className="rounded-2xl border-2 border-black bg-[#FAF9F6] p-4 space-y-2.5">
        <div className="inline-block rounded-2xl rounded-tl-xs border border-black/20 bg-white px-3.5 py-2 text-xs font-bold text-neutral-700">
          Here&apos;s today&apos;s word:{" "}
          <span className="font-mono font-black text-black">
            {puzzle.starterWord.toUpperCase()}
          </span>
        </div>

        <div className="rounded-2xl rounded-tl-xs border-2 border-black bg-white p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-mono font-black uppercase text-purple-800">
              Word {stepIdx + 1} of 9 ·{" "}
              {stepIdx === 0
                ? `Rhymes with ${rhymeTarget}`
                : `The next word rhymes with ${rhymeTarget}`}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <Badge variant="outline" className="border-black text-[10px]">
                Length: {activeClue.answer.length}
              </Badge>
              <Badge variant="outline" className="border-black text-[10px]">
                1st Letter: {(activeClue.answer[0] ?? "?").toUpperCase()}
              </Badge>
            </div>
          </div>

          <p className="text-sm font-medium text-black whitespace-pre-line">
            {activeClue.answer
              ? renderPrompt(activeClue)
              : "(Empty answer in draft row)"}
          </p>

          {isHinted && (
            <p className="rounded-lg bg-amber-50 border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-950">
              💡 Hint: {activeClue.hint || "(No hint text provided)"}
            </p>
          )}

          {currentOutcome && (
            <p
              className={cn(
                "text-xs font-bold",
                currentOutcome.solved ? "text-emerald-700" : "text-amber-800"
              )}
            >
              {currentOutcome.solved
                ? `✓ Correct! "${activeClue.answer.toUpperCase()}" (+${currentOutcome.pts} pts)`
                : currentOutcome.revealed
                ? `Answer: "${activeClue.answer.toUpperCase()}" (0 pts)`
                : `Not quite — expected a rhyme matching "${activeClue.answer.toUpperCase()}".`}
            </p>
          )}
        </div>

        <form onSubmit={submitGuess} className="flex flex-wrap gap-2 pt-1">
          <Input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder={`Type rhyme #${stepIdx + 1}...`}
            className="flex-1 min-w-44 border-2 border-black text-base sm:text-sm"
            data-testid="preview-9-rhymes-input"
          />
          <Button
            type="submit"
            className="bg-black text-white font-bold text-xs border-2 border-black"
          >
            Test Guess
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setHintShown((prev) => ({ ...prev, [stepIdx]: true }))
            }
            className="border-2 border-black font-bold text-xs"
          >
            <Lightbulb className="h-3.5 w-3.5 mr-1" /> Hint (-0.5)
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setOutcomes((prev) => ({
                ...prev,
                [stepIdx]: { solved: false, pts: 0, revealed: true },
              }))
            }
            className="border-2 border-black font-bold text-xs"
          >
            Reveal
          </Button>
          {stepIdx < 8 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStepIdx((i) => Math.min(8, i + 1));
                setGuess("");
              }}
              className="border-2 border-black font-bold text-xs"
            >
              Next →
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 5. 6 Pics Jigsaw Preview
// ============================================================================
function SixPicsDraftPreview({ draft }: { draft: unknown }) {
  const puzzle = useMemo<SixPicsPuzzle>(() => {
    const raw = (draft ?? {}) as Partial<SixPicsPuzzle>;
    const images = Array.isArray(raw.images) ? raw.images : [];
    return {
      id: raw.id ?? "6p-preview",
      puzzleNumber: raw.puzzleNumber ?? 1,
      title: raw.title ?? "6 Pics Draft",
      themeAnswer: raw.themeAnswer ?? "Untitled Theme",
      acceptedAliases: raw.acceptedAliases ?? [],
      author: raw.author ?? "SOL Theory",
      editor: raw.editor ?? "Daily Editorial",
      images: Array.from({ length: 6 }, (_, i) => ({
        scene: images[i]?.scene ?? "sun",
        caption: String(images[i]?.caption ?? `Picture ${i + 1}`),
        aliases: images[i]?.aliases ?? [],
        hint: images[i]?.hint,
        imageUrl: images[i]?.imageUrl,
        initialPiece: images[i]?.initialPiece,
      })),
    };
  }, [draft]);

  const [cardIdx, setCardIdx] = useState(0);
  const [revealedByCard, setRevealedByCard] = useState<Record<number, number[]>>(
    () =>
      Object.fromEntries(
        puzzle.images.map((img, idx) => [
          idx,
          [getInitialRevealedPiece(img, idx, puzzle.id)],
        ])
      )
  );
  const [solvedByCard, setSolvedByCard] = useState<Record<number, number>>({});
  const [showHint, setShowHint] = useState<Record<number, boolean>>({});
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const activeImg = puzzle.images[cardIdx]!;
  const openPieces = revealedByCard[cardIdx] ?? [0];
  const extraRemoved = Math.max(0, openPieces.length - 1);
  const potentialPts = scoreForSixPicsImage(true, extraRemoved);
  const earnedPts = solvedByCard[cardIdx];

  const revealPiece = (pieceIdx: number) => {
    if (openPieces.includes(pieceIdx)) return;
    setRevealedByCard((prev) => ({
      ...prev,
      [cardIdx]: [...openPieces, pieceIdx],
    }));
  };

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim()) return;
    const res = matchSixPicsImageGuess(guess, activeImg);
    if (res.matched) {
      setSolvedByCard((prev) => ({ ...prev, [cardIdx]: potentialPts }));
      setRevealedByCard((prev) => ({
        ...prev,
        [cardIdx]: [0, 1, 2, 3, 4, 5],
      }));
      setFeedback(`✓ Matched "${activeImg.caption}" (+${potentialPts} pts)!`);
      setGuess("");
    } else {
      setFeedback("Not a match — try another synonym or click a covered jigsaw tile.");
    }
  };

  const totalScore = Object.values(solvedByCard).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4" data-testid="preview-6-pics">
      <BylineHeader
        title={puzzle.title}
        author={puzzle.author}
        editor={puzzle.editor}
        subtitle={`Overarching Theme: ${puzzle.themeAnswer}`}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {puzzle.images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setCardIdx(i);
                setGuess("");
                setFeedback(null);
              }}
              className={cn(
                "px-2.5 py-1 rounded-lg border-2 text-xs font-bold cursor-pointer",
                cardIdx === i
                  ? "border-black bg-black text-white"
                  : solvedByCard[i] !== undefined
                  ? "border-black bg-[#2ECC71] text-black"
                  : "border-neutral-300 bg-white text-black"
              )}
            >
              Pic {i + 1}
              {solvedByCard[i] !== undefined ? ` (${solvedByCard[i]}p)` : ""}
            </button>
          ))}
        </div>
        <Badge className="bg-[#F9D423] text-black border-2 border-black font-mono font-black">
          Theme: {puzzle.themeAnswer} · {totalScore}/36 pts
        </Badge>
      </div>

      {/* Interactive 6-Piece Jigsaw Stage */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
        <div className="sm:col-span-7 relative aspect-[4/3] w-full rounded-2xl border-2 border-black overflow-hidden bg-neutral-900">
          <ImageWithFallback
            src={activeImg.imageUrl || renderSixPicsSceneDataUri(activeImg, cardIdx)}
            alt={activeImg.caption}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-2">
            {[0, 1, 2, 3, 4, 5].map((pieceIdx) => {
              const isOpen = openPieces.includes(pieceIdx);
              return (
                <button
                  key={pieceIdx}
                  type="button"
                  disabled={isOpen}
                  onClick={() => revealPiece(pieceIdx)}
                  data-testid={`preview-6p-piece-${pieceIdx}`}
                  className={cn(
                    "border border-black/30 flex flex-col items-center justify-center transition-all",
                    isOpen
                      ? "bg-transparent pointer-events-none"
                      : "bg-[#1a1a1a]/95 text-white hover:bg-[#2a2a2a] cursor-pointer"
                  )}
                >
                  {!isOpen && (
                    <>
                      <span className="font-mono font-black text-xs">
                        Piece {pieceIdx + 1}
                      </span>
                      <span className="text-[10px] text-amber-300">
                        Tap to Reveal (-1 pt)
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="sm:col-span-5 space-y-3">
          <div className="rounded-xl border-2 border-black bg-[#FAF9F6] p-3 space-y-1.5 text-xs">
            <p className="font-black text-sm">
              Picture {cardIdx + 1} of 6 ·{" "}
              {earnedPts !== undefined
                ? `Solved (${earnedPts} pts)`
                : `Worth ${potentialPts} pts`}
            </p>
            <p className="text-neutral-600">
              Pieces uncovered: {openPieces.length}/6 · Accepted aliases:{" "}
              {activeImg.aliases && activeImg.aliases.length > 0
                ? activeImg.aliases.join(", ")
                : "None"}
            </p>
            {activeImg.hint && showHint[cardIdx] && (
              <p className="rounded bg-amber-50 border border-amber-300 px-2 py-1 font-semibold text-amber-950">
                💡 {activeImg.hint}
              </p>
            )}
            {feedback && (
              <p className="font-bold text-emerald-800 pt-1">{feedback}</p>
            )}
          </div>

          <form onSubmit={handleGuess} className="space-y-2">
            <Input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Type guess to test fuzzy matching..."
              className="border-2 border-black text-base sm:text-sm"
              data-testid="preview-6-pics-input"
            />
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="submit"
                size="sm"
                className="bg-black text-white font-bold text-xs border-2 border-black"
              >
                Test Guess
              </Button>
              {activeImg.hint && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setShowHint((prev) => ({ ...prev, [cardIdx]: true }))
                  }
                  className="border-2 border-black font-bold text-xs"
                >
                  Show Hint
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setRevealedByCard((prev) => ({
                    ...prev,
                    [cardIdx]: [0, 1, 2, 3, 4, 5],
                  }));
                  setFeedback(`Answer: "${activeImg.caption}"`);
                }}
                className="border-2 border-black font-bold text-xs"
              >
                Reveal All
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 6. Eightfold Echo 3x3 Ring Preview
// ============================================================================
function EightfoldEchoDraftPreview({ draft }: { draft: unknown }) {
  const puzzle = draft as EightfoldEchoPuzzle | null;
  const [difficulty, setDifficulty] = useState<EchoDifficulty>("easy");
  const [stepCursor, setStepCursor] = useState(0);

  const stage = useMemo(
    () => (puzzle && Array.isArray(puzzle.tiles) ? getEchoStage(puzzle, difficulty) : null),
    [puzzle, difficulty]
  );

  const rules = useMemo(
    () => (stage ? buildEchoChainRules(stage) : []),
    [stage]
  );

  if (!puzzle || !stage) {
    return (
      <p className="text-sm text-neutral-600">
        No valid Eightfold Echo board available in current draft.
      </p>
    );
  }

  const activePos = stage.solution[stepCursor] ?? 4;
  const prevPos = stepCursor > 0 ? stage.solution[stepCursor - 1] ?? null : null;

  return (
    <div className="space-y-4" data-testid="preview-eightfold-echo">
      <BylineHeader
        title={puzzle.title || "Harmonic Resonance"}
        author={puzzle.author}
        editor={puzzle.editor}
        subtitle="Step through Center (0) → Step 8 to verify every single-change trait transition."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-grid grid-cols-2 gap-1 rounded-xl border-2 border-black bg-neutral-100 p-1">
          {ECHO_DIFFICULTIES.map((diff) => (
            <button
              key={diff}
              type="button"
              onClick={() => {
                setDifficulty(diff);
                setStepCursor(0);
              }}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-bold cursor-pointer",
                difficulty === diff
                  ? "bg-black text-white"
                  : "text-neutral-700 hover:bg-white"
              )}
            >
              {diff === "easy" ? "Easy 3×3" : "Hard 3×3"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={stepCursor === 0}
            onClick={() => setStepCursor((s) => Math.max(0, s - 1))}
            className="h-8 px-2.5 border-2 border-black font-bold text-xs"
          >
            ◀ Prev
          </Button>
          <Badge className="bg-black text-white border border-black font-mono text-xs">
            Step {stepCursor} / 8
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={stepCursor === 8}
            onClick={() => setStepCursor((s) => Math.min(8, s + 1))}
            className="h-8 px-2.5 border-2 border-black font-bold text-xs"
          >
            Next ▶
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
        <div className="sm:col-span-6 grid grid-cols-3 gap-2 p-3 rounded-2xl border-2 border-black bg-neutral-50 max-w-xs mx-auto w-full">
          {stage.tiles.map((tile, idx) => {
            const order = stage.solution.indexOf(idx);
            const visited = order <= stepCursor;
            const isCurrent = idx === activePos;
            const isPrev = idx === prevPos;
            const color = ECHO_POSITION_COLORS[idx]!;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setStepCursor(order)}
                className={cn(
                  "relative aspect-square rounded-xl bg-white p-2 flex items-center justify-center transition-all cursor-pointer",
                  isCurrent && "ring-4 ring-black scale-105 z-10",
                  !visited && "opacity-45"
                )}
                style={{
                  border:
                    idx === 4 ? `3px dashed ${color}` : `2.5px solid ${color}`,
                }}
                title={`${ECHO_POSITION_NAMES[idx]}: Step ${order}`}
              >
                <EchoTileSvg
                  tile={tile}
                  clipKey={`preview-echo-${difficulty}-${idx}`}
                />
                <span
                  className="absolute top-1 right-1 rounded-full px-1.5 text-[10px] font-black text-black border border-black/40"
                  style={{ backgroundColor: color }}
                >
                  {order === 0 ? "C" : order}
                </span>
                {isPrev && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/80 text-white px-1 text-[9px] font-mono">
                    prev
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="sm:col-span-6 space-y-2.5">
          <div className="rounded-xl border-2 border-black bg-[#FAF9F6] p-3 text-xs space-y-1.5">
            <p className="font-headline font-black text-sm">
              {stepCursor === 0
                ? `Start at Center (${ECHO_POSITION_NAMES[activePos]})`
                : `Step ${stepCursor - 1} → Step ${stepCursor}`}
            </p>
            <p className="text-neutral-700 font-medium">
              Active Tile:{" "}
              <strong>
                {ECHO_POSITION_NAMES[activePos]} —{" "}
                {describeEchoTile(stage.tiles[activePos]!)}
              </strong>
            </p>
            {stepCursor > 0 && rules[stepCursor - 1] && (
              <p className="rounded-lg bg-emerald-50 border border-emerald-300 px-2.5 py-1.5 font-semibold text-emerald-950">
                Shared Trait Transition: {rules[stepCursor - 1]}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {stage.solution.map((pos, sIdx) => (
              <button
                key={sIdx}
                type="button"
                onClick={() => setStepCursor(sIdx)}
                className={cn(
                  "px-2 py-1 rounded-md border text-[11px] font-mono font-bold cursor-pointer",
                  stepCursor === sIdx
                    ? "border-black bg-black text-white"
                    : "border-neutral-300 bg-white text-neutral-700"
                )}
              >
                {sIdx === 0 ? "Center" : `#${sIdx}`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 7. Four Score Interactive Math Tester
// ============================================================================
interface NumberCardState {
  id: string;
  value: number;
  expr: string;
}

function FourScoreDraftPreview({ draft }: { draft: unknown }) {
  const raw = (draft ?? {}) as Partial<FourScorePuzzle>;
  const digits = useMemo(
    () => (Array.isArray(raw.digits) ? raw.digits : []),
    [raw.digits]
  );
  const operators = useMemo(
    () => (Array.isArray(raw.operators) ? raw.operators : []),
    [raw.operators]
  );
  const solved = useMemo(
    () => solveFourScore(digits, operators, FOUR_SCORE_TARGET),
    [digits, operators]
  );

  const canonicalEq = useMemo(
    () =>
      raw.canonicalEquation?.trim() ||
      (solved.canonicalEquation
        ? `${solved.canonicalEquation} = ${FOUR_SCORE_TARGET}`
        : ""),
    [raw.canonicalEquation, solved.canonicalEquation]
  );

  const buildInitialCards = (): NumberCardState[] =>
    digits.map((d, i) => ({ id: `c-${i}`, value: d, expr: String(d) }));

  const [cards, setCards] = useState<NumberCardState[]>(buildInitialCards);
  const [remainingOps, setRemainingOps] =
    useState<FourScoreOperator[]>(operators);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedOpIdx, setSelectedOpIdx] = useState<number | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resetBoard = () => {
    setCards(buildInitialCards());
    setRemainingOps(operators);
    setSelectedCardId(null);
    setSelectedOpIdx(null);
    setErrorMsg(null);
  };

  const handleSelectOp = (opIdx: number) => {
    const op = remainingOps[opIdx];
    if (!op) return;
    setErrorMsg(null);
    if (op === "x²" && selectedCardId) {
      const target = cards.find((c) => c.id === selectedCardId);
      if (!target) return;
      const res = applyUnaryFourScore(target.value, target.expr, "x²");
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      setCards((prev) =>
        prev.map((c) =>
          c.id === target.id ? { ...c, value: res.value, expr: res.expr } : c
        )
      );
      setRemainingOps((prev) => prev.filter((_, idx) => idx !== opIdx));
      setSelectedOpIdx(null);
      return;
    }
    setSelectedOpIdx((prev) => (prev === opIdx ? null : opIdx));
  };

  const handleSelectCard = (cardId: string) => {
    setErrorMsg(null);
    if (
      selectedCardId &&
      selectedCardId !== cardId &&
      selectedOpIdx !== null
    ) {
      const op = remainingOps[selectedOpIdx];
      const left = cards.find((c) => c.id === selectedCardId);
      const right = cards.find((c) => c.id === cardId);
      if (op && op !== "x²" && left && right) {
        const res = applyBinaryFourScore(
          left.value,
          left.expr,
          op,
          right.value,
          right.expr
        );
        if (!res.ok) {
          setErrorMsg(res.error);
          return;
        }
        setCards((prev) =>
          prev
            .filter((c) => c.id !== left.id)
            .map((c) =>
              c.id === right.id
                ? { ...c, value: res.value, expr: res.expr }
                : c
            )
        );
        setRemainingOps((prev) =>
          prev.filter((_, idx) => idx !== selectedOpIdx)
        );
        setSelectedCardId(right.id);
        setSelectedOpIdx(null);
        return;
      }
    }
    setSelectedCardId((prev) => (prev === cardId ? null : cardId));
  };

  const won =
    cards.length === 1 &&
    remainingOps.length === 0 &&
    cards[0]?.value === FOUR_SCORE_TARGET;

  const blueprint = canonicalEq
    ? buildFourScoreFormulaBlueprint(
        { digits, canonicalEquation: canonicalEq },
        hintLevel
      )
    : "Enter valid solvable digits & operators to generate formula blueprint.";

  return (
    <div className="space-y-4" data-testid="preview-four-score">
      <BylineHeader
        title={raw.title || "Exact Eighty"}
        author={raw.author}
        editor={raw.editor}
        subtitle={`Target: ${FOUR_SCORE_TARGET} · Combine all ${digits.length} numbers & ${operators.length} operators`}
      />

      {/* Formula Hint Bar */}
      <div className="rounded-xl border-2 border-black bg-[#FAF9F6] p-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="block text-[10px] font-mono font-bold uppercase text-neutral-500">
            Formula Blueprint Hint Bar
          </span>
          <code className="font-mono font-black text-sm text-black">
            {blueprint}
          </code>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setHintLevel((h) => h + 1)}
          className="h-7 px-2.5 text-xs font-bold border border-black"
        >
          <Lightbulb className="h-3 w-3 mr-1" /> +1 Hint
        </Button>
      </div>

      {/* Interactive Cards & Operators */}
      <div className="rounded-2xl border-2 border-black bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-2.5 justify-center">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => handleSelectCard(card.id)}
              className={cn(
                "min-w-16 px-4 py-3 rounded-2xl border-2 font-headline font-black text-xl transition-all cursor-pointer",
                selectedCardId === card.id
                  ? "border-black bg-[#F9D423] text-black shadow-[3px_3px_0px_#000] -translate-y-0.5"
                  : won
                  ? "border-black bg-[#2ECC71] text-black"
                  : "border-black bg-neutral-50 text-black hover:bg-neutral-100"
              )}
            >
              <span className="block">{card.value}</span>
              <span className="block text-[10px] font-mono font-normal text-neutral-500">
                {card.expr}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {remainingOps.map((op, idx) => (
            <button
              key={`${op}-${idx}`}
              type="button"
              onClick={() => handleSelectOp(idx)}
              className={cn(
                "h-10 min-w-11 px-3 rounded-full border-2 font-headline font-black text-sm cursor-pointer transition-all",
                selectedOpIdx === idx
                  ? "border-black bg-black text-white"
                  : "border-black bg-[#F9D423]/70 text-black hover:bg-[#F9D423]"
              )}
            >
              {op}
            </button>
          ))}
        </div>

        {errorMsg && (
          <p className="text-center text-xs font-bold text-red-600">
            {errorMsg}
          </p>
        )}
        {won && (
          <p className="text-center text-xs font-black text-emerald-700">
            ✓ Exact 80 Reached! ({cards[0]?.expr} = 80)
          </p>
        )}
      </div>

      {showSolution && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-mono font-bold text-emerald-950">
          Verified Solution: {canonicalEq || "Unsolvable draft"}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={resetBoard}
          className="border-2 border-black font-bold text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset Cards
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowSolution((v) => !v)}
          className="border-2 border-black font-bold text-xs"
        >
          <Eye className="h-3.5 w-3.5 mr-1" />{" "}
          {showSolution ? "Hide Solution" : "Verify Canonical Solution"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// 8. Move Two Interactive 3D Bloxorz Preview
// ============================================================================
function MoveTwoDraftPreview({ draft }: { draft: unknown }) {
  const puzzle = draft as MoveTwoPuzzle | null;
  const [diff, setDiff] = useState<MoveTwoDifficulty>("easy");

  const stage = puzzle?.stages?.[diff] ?? null;
  const [history, setHistory] = useState<
    Array<ReturnType<typeof getInitialBlockState>>
  >(() => (stage ? [getInitialBlockState(stage)] : []));
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [won, setWon] = useState(false);

  const [prevStage, setPrevStage] = useState(stage);
  if (prevStage !== stage) {
    setPrevStage(stage);
    setHistory(stage ? [getInitialBlockState(stage)] : []);
    setStatusMsg(null);
    setWon(false);
  }

  const currentBlock = useMemo(
    () =>
      history[history.length - 1] ??
      (stage ? getInitialBlockState(stage) : null),
    [history, stage]
  );

  const roll = React.useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      if (!stage || !currentBlock || won) return;
      const step = stepBloxorzBlock(stage, currentBlock, dir);
      if (step.kind === "moved") {
        setHistory((prev) => [...prev, step.next]);
        setStatusMsg(null);
      } else if (step.kind === "won") {
        setHistory((prev) => [...prev, step.next]);
        setWon(true);
        setStatusMsg(
          `✓ Dropped upright into Goal in ${history.length} moves (Par ${stage.par})!`
        );
      } else {
        const reason =
          step.kind === "fall_fragile"
            ? "Touched Red Obstacle — reset to Start!"
            : step.kind === "fall_bridge"
            ? "Stepped onto closed bridge — reset to Start!"
            : "Tipped off island edge into void — reset to Start!";
        setStatusMsg(reason);
        setHistory([getInitialBlockState(stage)]);
      }
    },
    [stage, currentBlock, won, history.length]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        roll("up");
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        roll("down");
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        roll("left");
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        roll("right");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [roll]);

  if (!puzzle || !stage || !currentBlock) {
    return (
      <p className="text-sm text-neutral-600">
        No valid Move Two stages available in current draft.
      </p>
    );
  }

  const movesUsed = Math.max(0, history.length - 1);

  return (
    <div className="space-y-4" data-testid="preview-move-2">
      <BylineHeader
        title={puzzle.title || "Terracotta Span"}
        author={puzzle.author}
        editor={puzzle.editor}
        subtitle="Use Arrow / WASD keys or D-Pad below to roll the 2×1×1 block across the draft island."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {MOVE_TWO_DIFFICULTIES.map((d) => {
            const meta = MOVE_TWO_DIFFICULTY_META[d];
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDiff(d)}
                className={cn(
                  "px-3 py-1 rounded-xl border-2 text-xs font-bold cursor-pointer",
                  diff === d
                    ? "border-black bg-black text-white"
                    : "border-neutral-300 bg-white text-black"
                )}
              >
                {meta.label} ({meta.sizeLabel}) · Par {puzzle.stages[d].par}
              </button>
            );
          })}
        </div>
        <Badge variant="outline" className="border-2 border-black font-mono font-bold">
          Moves: {movesUsed} / Par {stage.par}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
        <div className="sm:col-span-8 rounded-2xl border-2 border-black bg-[#FAF9F6] p-2">
          <MoveTwoBloxorzCanvas
            stage={stage}
            bridgeMask={currentBlock.bridgeMask}
            pose={{ mode: "idle", state: currentBlock }}
            interactive={false}
            testId="preview-move-two-canvas"
          />
        </div>

        <div className="sm:col-span-4 space-y-3">
          <div className="grid grid-cols-3 gap-1.5 max-w-36 mx-auto">
            <div />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => roll("up")}
              aria-label="Roll Up"
              className="border-2 border-black h-10"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <div />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => roll("left")}
              aria-label="Roll Left"
              className="border-2 border-black h-10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => roll("down")}
              aria-label="Roll Down"
              className="border-2 border-black h-10"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => roll("right")}
              aria-label="Roll Right"
              className="border-2 border-black h-10"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {statusMsg && (
            <p
              className={cn(
                "rounded-xl border p-2.5 text-xs font-bold text-center",
                won
                  ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                  : "border-amber-300 bg-amber-50 text-amber-950"
              )}
            >
              {statusMsg}
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={history.length <= 1}
              onClick={() => {
                setHistory((prev) => prev.slice(0, -1));
                setWon(false);
                setStatusMsg(null);
              }}
              className="border-2 border-black font-bold text-xs"
            >
              <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setHistory([getInitialBlockState(stage)]);
                setWon(false);
                setStatusMsg(null);
              }}
              className="border-2 border-black font-bold text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 9. 1 Win Daily Prompt Card Preview
// ============================================================================
function OneWinDraftPreview({ draft }: { draft: unknown }) {
  const raw = (draft ?? {}) as Partial<OneWinPromptPuzzle>;
  const [sampleEntry, setSampleEntry] = useState("");

  const norm = useMemo(
    () => (sampleEntry.trim() ? normalizeOneWinEntry(sampleEntry) : null),
    [sampleEntry]
  );
  const mod = useMemo(
    () =>
      sampleEntry.trim() ? moderateText(sampleEntry, "public") : { allowed: true },
    [sampleEntry]
  );

  return (
    <div className="space-y-4" data-testid="preview-1-win">
      <div className="rounded-2xl border-2 border-black bg-[#FAF9F6] p-6 space-y-4 shadow-[4px_4px_0px_#000]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge className="bg-[#e0e1d9] text-black border border-black font-bold">
            {raw.title || "Daily Gratitude Check-In"}
          </Badge>
          <span className="text-xs text-neutral-600 font-semibold">
            By {raw.author || "SOL Theory"} · Edited by{" "}
            {raw.editor || "Daily Editorial"}
          </span>
        </div>

        <h4 className="font-headline font-black text-2xl sm:text-3xl text-black leading-tight">
          {raw.prompt || ONE_WIN_DEFAULT_PROMPT}
        </h4>

        <p className="text-sm text-neutral-600">
          {raw.subtitle ||
            "No win is too small — log yours blindly, then see where it ranks globally."}
        </p>

        <div className="space-y-2 pt-2">
          <Textarea
            rows={2}
            value={sampleEntry}
            onChange={(e) => setSampleEntry(e.target.value)}
            placeholder="Reflection sandbox (1–4 words, ≤ 35 chars, e.g. 'Morning walk')..."
            className="border-2 border-black bg-white text-base sm:text-sm"
            data-testid="preview-1-win-input"
          />
          {norm && (
            <div className="rounded-xl border border-black/15 bg-white px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
              <span>
                {norm.valid && mod.allowed ? (
                  <strong className="text-emerald-700">
                    ✓ Canonical Display: &ldquo;{norm.displayText}&rdquo; (key:{" "}
                    <code>{norm.normalizedKey}</code>)
                  </strong>
                ) : !mod.allowed ? (
                  <strong className="text-red-600">
                    Blocked by public moderation
                  </strong>
                ) : (
                  <strong className="text-amber-800">
                    Must be 1–4 words and ≤ 35 characters
                  </strong>
                )}
              </span>
              <span className="font-mono text-neutral-500">
                {norm.wordCount}/4 words · {norm.charCount}/35 chars
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Modal Shell
// ============================================================================
export function AdminPuzzlePreviewModal({
  open,
  onClose,
  gameSlug,
  targetDate,
  draftPayload,
}: AdminPuzzlePreviewModalProps) {
  const sandboxKey = `${gameSlug}:${targetDate}:${open ? "open" : "closed"}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent
        role="dialog"
        aria-modal="true"
        data-testid="admin-puzzle-preview-modal"
        className="max-w-2xl max-h-[90dvh] overflow-y-auto border-2 border-black rounded-2xl bg-white p-5 sm:p-6 shadow-2xl"
      >
        <DialogHeader className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-[#F9D423] text-black border border-black font-headline font-black text-xs">
              <Play className="h-3 w-3 mr-1" /> Playable Draft Preview
            </Badge>
            <Badge variant="outline" className="border-black font-mono text-xs">
              {GAME_LABELS[gameSlug]} · {targetDate}
            </Badge>
            <Badge
              variant="outline"
              className="border-emerald-700 bg-emerald-50 text-emerald-900 text-[10px]"
            >
              Isolated Sandbox · Zero Live Writes
            </Badge>
          </div>
          <DialogTitle className="font-headline font-black text-xl sm:text-2xl text-black">
            Test-Play {GAME_LABELS[gameSlug]} Draft
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-600">
            Verify mechanics, clues, slices, hints, and attribution before publishing to Supabase. Nothing played here affects live daily puzzles or player stats.
          </DialogDescription>
        </DialogHeader>

        <div key={sandboxKey} className="py-2">
          {gameSlug === "connect-5" && (
            <Connect5DraftPreview draft={draftPayload} />
          )}
          {gameSlug === "17-syllables" && (
            <SeventeenSyllablesDraftPreview draft={draftPayload} />
          )}
          {gameSlug === "21-things" && (
            <TwentyOneThingsDraftPreview draft={draftPayload} />
          )}
          {gameSlug === "9-rhymes" && (
            <NineRhymesDraftPreview draft={draftPayload} />
          )}
          {gameSlug === "6-pics" && (
            <SixPicsDraftPreview draft={draftPayload} />
          )}
          {gameSlug === "eightfold-echo" && (
            <EightfoldEchoDraftPreview draft={draftPayload} />
          )}
          {gameSlug === "four-score" && (
            <FourScoreDraftPreview draft={draftPayload} />
          )}
          {gameSlug === "move-2" && (
            <MoveTwoDraftPreview draft={draftPayload} />
          )}
          {gameSlug === "1-win" && (
            <OneWinDraftPreview draft={draftPayload} />
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-neutral-200">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-2 border-black font-headline font-black text-xs"
          >
            Close Sandbox Preview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
