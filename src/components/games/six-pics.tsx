"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Eye,
  Link2,
  Puzzle,
  Send,
  Share2,
  SkipForward,
  Sparkles,
} from "lucide-react";
import {
  SIX_PICS_COUNT,
  SIX_PICS_JIGSAW_PIECES,
  SIX_PICS_JIGSAW_VIEWBOX,
  SIX_PICS_MAX_IMAGE_SCORE,
  SIX_PICS_MAX_SCORE,
  SIX_PICS_PIECES_PER_IMAGE,
  buildSixPicsEmojiReceipt,
  buildSixPicsShareText,
  draftToSixPicsPuzzle,
  getInitialRevealedPiece,
  matchSixPicsImageGuess,
  pickNextRandomPiece,
  renderSixPicsSceneDataUri,
  scoreForSixPicsImage,
  totalScoreForSixPics,
  validateSixPicsPuzzle,
  type SixPicsClueImage,
  type SixPicsImageOutcome,
  type SixPicsPuzzle,
} from "@/data/puzzles/6-pics";
import { getDailyPuzzleForGame, getLocalDateKey } from "@/lib/daily-engine";
import {
  copyToClipboard,
  formatCustomGameBlurb,
  generateCustomGameId,
  isValidCustomGameId,
  nativeShareResultsOnly,
} from "@/lib/custom-game-share";
import { fetchCustomPuzzle, saveCustomPuzzle } from "@/lib/custom-puzzles";
import {
  getAdminOverridesForGame,
  getGameProgress,
  getGameStats,
  isDateCompleted,
  recordScoredCompletion,
  saveGameProgress,
  setGameStats,
} from "@/lib/game-storage";
import { computePuzzleContentHash } from "@/lib/seeded-random";
import { GameShell } from "@/components/game-shell";
import { GameSplashScreen } from "@/components/game-splash-screen";
import { ImageWithFallback } from "@/components/image-with-fallback";
import { useAuth } from "@/components/account/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResultShareButtons } from "./result-share-buttons";
import {
  SixPicsEditor,
  emptySixPicsEditorState,
  type SixPicsEditorState,
} from "./six-pics-editor";
import { cn } from "@/lib/utils";

const subscribeNoop = () => () => {};

interface SavedSixPicsProgressV2 {
  version: 2;
  puzzleId: string;
  puzzleHash: string;
  currentIndex: number;
  currentRevealedPieces: number[];
  outcomes: SixPicsImageOutcome[];
}

function isValidDateKey(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Resilient visual card rendering custom `imageUrl` with inline SVG illustration fallback. */
function SixPicsClueVisual({
  clue,
  index,
  alt,
  className,
}: {
  clue: SixPicsClueImage;
  index: number;
  alt: string;
  className?: string;
}) {
  const inlineSvgUri = useMemo(
    () => renderSixPicsSceneDataUri(clue, index),
    [clue, index]
  );
  return (
    <ImageWithFallback
      src={clue.imageUrl || inlineSvgUri}
      alt={alt}
      className={cn("w-full h-full object-cover select-none", className)}
      fallbackSvgTitle={alt}
      fallbackIcon={
        clue.imageUrl ? (
          <ImageWithFallback
            src={inlineSvgUri}
            alt={alt}
            className="w-full h-full object-cover select-none"
          />
        ) : undefined
      }
    />
  );
}

/**
 * 6-Piece Interlocking Jigsaw Overlay (`3×2` SVG puzzle pieces over the `4:3` picture).
 * Covered pieces block 5/6 of the image at start; revealed pieces animate off smoothly.
 */
function SixPicsJigsawStage({
  clue,
  imageIndex,
  revealedPieces,
  fullyUncovered,
  currentWorth,
}: {
  clue: SixPicsClueImage;
  imageIndex: number;
  revealedPieces: readonly number[];
  fullyUncovered: boolean;
  currentWorth: number;
}) {
  const revealedSet = useMemo(
    () => new Set(fullyUncovered ? [0, 1, 2, 3, 4, 5] : revealedPieces),
    [fullyUncovered, revealedPieces]
  );
  const coveredCount = SIX_PICS_PIECES_PER_IMAGE - revealedSet.size;

  return (
    <div
      className="relative aspect-[4/3] w-full rounded-2xl border-2 border-black bg-neutral-100 overflow-hidden shadow-[4px_4px_0px_#000] select-none"
      data-testid="six-pics-jigsaw-stage"
    >
      <SixPicsClueVisual
        clue={clue}
        index={imageIndex}
        alt={`Hidden picture ${imageIndex + 1} of ${SIX_PICS_COUNT}`}
      />

      {/* Interlocking 6-Piece SVG Jigsaw Overlay */}
      <svg
        viewBox={SIX_PICS_JIGSAW_VIEWBOX}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-label={`${coveredCount} of ${SIX_PICS_PIECES_PER_IMAGE} puzzle pieces covering picture`}
      >
        <defs>
          <linearGradient id="six-pics-piece-grad-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#27272a" />
            <stop offset="100%" stopColor="#18181b" />
          </linearGradient>
          <linearGradient id="six-pics-piece-grad-b" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3f3f46" />
            <stop offset="100%" stopColor="#27272a" />
          </linearGradient>
        </defs>

        {SIX_PICS_JIGSAW_PIECES.map((piece) => {
          const isOpen = revealedSet.has(piece.index);
          const checker = (piece.row + piece.col) % 2 === 0;
          return (
            <g
              key={piece.index}
              data-testid={`jigsaw-piece-${piece.index}`}
              data-covered={isOpen ? "false" : "true"}
              style={{
                opacity: isOpen ? 0 : 1,
                transform: isOpen ? "scale(0.92)" : "scale(1)",
                transformOrigin: `${piece.center[0]}px ${piece.center[1]}px`,
                transition: "opacity 260ms ease-out, transform 260ms ease-out",
              }}
            >
              <path
                d={piece.d}
                fill={
                  checker
                    ? "url(#six-pics-piece-grad-a)"
                    : "url(#six-pics-piece-grad-b)"
                }
                stroke="#f4d621"
                strokeWidth={2.2}
                strokeLinejoin="round"
              />
              <circle
                cx={piece.center[0]}
                cy={piece.center[1]}
                r={13}
                fill="#18181b"
                stroke="#f4d621"
                strokeOpacity={0.75}
                strokeWidth={1.6}
              />
              <text
                x={piece.center[0]}
                y={piece.center[1] + 4}
                textAnchor="middle"
                fill="#f4d621"
                fontSize="11"
                fontWeight="800"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                {piece.index + 1}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Top Floating Status Pills */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
        <span className="rounded-full bg-black/85 text-white border border-white/25 px-2.5 py-0.5 text-xs font-extrabold shadow">
          Pic {imageIndex + 1} of {SIX_PICS_COUNT} ·{" "}
          {fullyUncovered
            ? "6/6 shown"
            : `${revealedSet.size}/${SIX_PICS_PIECES_PER_IMAGE} shown`}
        </span>

        {!fullyUncovered && (
          <span
            className="rounded-full bg-[#f4d621] text-black border-2 border-black px-2.5 py-0.5 text-xs font-black shadow-[2px_2px_0px_#000]"
            data-testid="six-pics-current-worth"
          >
            Worth {currentWorth} {currentWorth === 1 ? "pt" : "pts"}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Entry & Router                                                           */
/* ------------------------------------------------------------------------ */

export function SixPicsGame() {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center font-headline font-black text-xl">
        Loading 6 Pics...
      </div>
    );
  }
  return (
    <Suspense fallback={null}>
      <SixPicsRouter />
    </Suspense>
  );
}

function SixPicsRouter() {
  const searchParams = useSearchParams();
  const customId = searchParams.get("b");
  const mode = searchParams.get("mode");
  const dateParam = searchParams.get("date");

  if (mode === "create") return <SixPicsCreator />;
  if (customId) return <SixPicsCustomLoader customId={customId} />;
  return <SixPicsDaily dateParam={dateParam} />;
}

/* ------------------------------------------------------------------------ */
/* Daily / Archive                                                          */
/* ------------------------------------------------------------------------ */

function SixPicsDaily({ dateParam }: { dateParam: string | null }) {
  const todayKey = useMemo(() => getLocalDateKey(), []);
  const dateKey =
    isValidDateKey(dateParam) && dateParam <= todayKey ? dateParam : todayKey;
  const [syncVersion, setSyncVersion] = useState(0);

  useEffect(() => {
    const bump = () => setSyncVersion((v) => v + 1);
    window.addEventListener("solgames:puzzles-updated", bump);
    return () => window.removeEventListener("solgames:puzzles-updated", bump);
  }, []);

  const puzzle = useMemo(() => {
    void syncVersion;
    const resolved = getDailyPuzzleForGame<SixPicsPuzzle>(
      "6-pics",
      dateKey,
      getAdminOverridesForGame("6-pics")
    );
    return resolved!.puzzle;
  }, [dateKey, syncVersion]);

  const hash = useMemo(() => computePuzzleContentHash(puzzle), [puzzle]);

  return (
    <SixPicsBoard
      key={`${puzzle.id}:${hash}:${dateKey}`}
      puzzle={puzzle}
      puzzleHash={hash}
      dateKey={dateKey}
      isCustom={false}
    />
  );
}

/* ------------------------------------------------------------------------ */
/* Custom Friend Puzzle (?b=6p-xxxxxxxx)                                    */
/* ------------------------------------------------------------------------ */

function SixPicsCustomLoader({ customId }: { customId: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "missing" }
    | { status: "ready"; puzzle: SixPicsPuzzle; handle: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isValidCustomGameId(customId) || !customId.startsWith("6p-")) {
        if (!cancelled) setState({ status: "missing" });
        return;
      }
      const record = await fetchCustomPuzzle<SixPicsPuzzle>(customId);
      if (cancelled) return;
      if (!record || !validateSixPicsPuzzle(record.payload).valid) {
        setState({ status: "missing" });
        return;
      }
      setState({
        status: "ready",
        puzzle: {
          ...record.payload,
          id: record.id,
          puzzleNumber: 0,
          author: record.creatorName || record.payload.author,
        },
        handle: record.creatorHandle,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [customId]);

  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center font-headline font-black text-xl">
        Loading friend puzzle...
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <GameShell
        gameSlug="6-pics"
        gameTitle="6 Pics"
        puzzleNumber={0}
        dateKey={getLocalDateKey()}
        author="Friend"
      >
        <div className="max-w-md mx-auto text-center space-y-4 py-16">
          <h2 className="font-headline font-black text-2xl">Puzzle not found</h2>
          <p className="text-sm text-neutral-600">
            This friend link may be mistyped or was removed. You can still play today&apos;s 6 Pics!
          </p>
          <Link
            href="/games/6-pics"
            className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-bold text-white border-2 border-black"
          >
            Play today&apos;s 6 Pics
          </Link>
        </div>
      </GameShell>
    );
  }

  return (
    <SixPicsBoard
      key={state.puzzle.id}
      puzzle={state.puzzle}
      puzzleHash={computePuzzleContentHash(state.puzzle)}
      dateKey={getLocalDateKey()}
      isCustom
      creatorHandle={state.handle}
      customId={customId}
    />
  );
}

/* ------------------------------------------------------------------------ */
/* Jigsaw Gameplay & Post-Game 2×3 Gallery                                  */
/* ------------------------------------------------------------------------ */

interface SixPicsBoardProps {
  puzzle: SixPicsPuzzle;
  puzzleHash: string;
  dateKey: string;
  isCustom: boolean;
  creatorHandle?: string;
  customId?: string;
}

function isSavedProgressV2(raw: unknown, puzzleHash: string): raw is SavedSixPicsProgressV2 {
  if (!raw || typeof raw !== "object") return false;
  const s = raw as Record<string, unknown>;
  return (
    s.version === 2 &&
    s.puzzleHash === puzzleHash &&
    typeof s.currentIndex === "number" &&
    Array.isArray(s.currentRevealedPieces) &&
    Array.isArray(s.outcomes)
  );
}

function SixPicsBoard({
  puzzle,
  puzzleHash,
  dateKey,
  isCustom,
  creatorHandle,
  customId,
}: SixPicsBoardProps) {
  const router = useRouter();

  const saved = useMemo<SavedSixPicsProgressV2 | null>(() => {
    if (isCustom) return null;
    const raw = getGameProgress<Partial<SavedSixPicsProgressV2>>("6-pics", dateKey, puzzle.id);
    return isSavedProgressV2(raw, puzzleHash) ? raw : null;
  }, [isCustom, dateKey, puzzle.id, puzzleHash]);

  const initialFirstPiece = useMemo(
    () => getInitialRevealedPiece(puzzle.images[0]!, 0, puzzle.id),
    [puzzle.images, puzzle.id]
  );

  const [outcomes, setOutcomes] = useState<SixPicsImageOutcome[]>(
    () => saved?.outcomes ?? []
  );
  const [currentIndex, setCurrentIndex] = useState<number>(() =>
    Math.min(SIX_PICS_COUNT - 1, saved?.currentIndex ?? saved?.outcomes.length ?? 0)
  );
  const [currentRevealedPieces, setCurrentRevealedPieces] = useState<number[]>(() =>
    saved?.currentRevealedPieces && saved.currentRevealedPieces.length > 0
      ? saved.currentRevealedPieces
      : [initialFirstPiece]
  );
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const [guessInput, setGuessInput] = useState("");
  const [splashDismissed, setSplashDismissed] = useState(isCustom);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [confirmingPass, setConfirmingPass] = useState(false);
  const [awaitingAdvance, setAwaitingAdvance] = useState(false);

  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const guessInputRef = useRef<HTMLInputElement | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedRef = useRef(false);

  const finished = outcomes.length >= SIX_PICS_COUNT && !awaitingAdvance;
  const totalScore = useMemo(() => totalScoreForSixPics(outcomes), [outcomes]);
  const namedCount = useMemo(
    () => outcomes.filter((o) => o.solved && o.points > 0).length,
    [outcomes]
  );
  const totalExtraPiecesRemoved = useMemo(
    () => outcomes.reduce((acc, o) => acc + o.extraPiecesRemoved, 0),
    [outcomes]
  );
  const piecesSaved = 30 - totalExtraPiecesRemoved;

  const activeImageIndex = Math.min(currentIndex, SIX_PICS_COUNT - 1);
  const currentClue = puzzle.images[activeImageIndex]!;
  const extraPiecesRemovedOnCurrent = Math.max(0, currentRevealedPieces.length - 1);
  const remainingCoveredCount = Math.max(
    0,
    SIX_PICS_PIECES_PER_IMAGE - currentRevealedPieces.length
  );
  const currentWorth = scoreForSixPicsImage(true, extraPiecesRemovedOnCurrent);
  const currentResolvedOutcome = awaitingAdvance
    ? outcomes[activeImageIndex] ?? null
    : null;

  useEffect(
    () => () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    },
    []
  );

  // Focus the Next button when an image finishes so Enter advances effortlessly.
  useEffect(() => {
    if (awaitingAdvance) {
      nextButtonRef.current?.focus();
    } else if (splashDismissed && !finished) {
      guessInputRef.current?.focus();
    }
  }, [awaitingAdvance, splashDismissed, finished, activeImageIndex]);

  // Persist daily/archive progress.
  useEffect(() => {
    if (isCustom) return;
    saveGameProgress<SavedSixPicsProgressV2>("6-pics", dateKey, {
      version: 2,
      puzzleId: puzzle.id,
      puzzleHash,
      currentIndex,
      currentRevealedPieces,
      outcomes,
    });
  }, [isCustom, dateKey, puzzle.id, puzzleHash, currentIndex, currentRevealedPieces, outcomes]);

  // Record completion stats once out of 36 max points + per-image piece efficiency buckets.
  useEffect(() => {
    if (!finished || isCustom || recordedRef.current) return;
    recordedRef.current = true;
    const current = getGameStats("6-pics");
    const lossKey = `loss_${dateKey}`;
    if (current.completedDates.includes(dateKey) || current.distribution[lossKey]) return;

    const picBuckets: Record<string, number> = {};
    for (const o of outcomes) {
      if (o.solved && o.points >= 1 && o.points <= 6) {
        const k = `pic_pts_${o.points}`;
        picBuckets[k] = (picBuckets[k] ?? 0) + 1;
      }
    }

    if (totalScore > 0) {
      const updated = recordScoredCompletion(
        "6-pics",
        dateKey,
        totalScore,
        SIX_PICS_MAX_SCORE
      );
      const mergedDist = { ...updated.distribution };
      for (const [k, delta] of Object.entries(picBuckets)) {
        mergedDist[k] = (mergedDist[k] ?? 0) + delta;
      }
      setGameStats("6-pics", {
        ...updated,
        distribution: mergedDist,
      });
    } else {
      setGameStats("6-pics", {
        ...current,
        played: current.played + 1,
        distribution: {
          ...current.distribution,
          "score_0.0": (current.distribution["score_0.0"] ?? 0) + 1,
          [lossKey]: 1,
        },
      });
    }
  }, [finished, isCustom, dateKey, outcomes, totalScore]);

  const handleRevealPiece = useCallback(() => {
    if (finished || awaitingAdvance) return;
    const nextPiece = pickNextRandomPiece(currentRevealedPieces);
    if (nextPiece === null) return;
    const nextRevealed = [...currentRevealedPieces, nextPiece];
    setCurrentRevealedPieces(nextRevealed);
    setConfirmingPass(false);
    const nextWorth = scoreForSixPicsImage(true, nextRevealed.length - 1);
    setFeedback(
      nextRevealed.length >= SIX_PICS_PIECES_PER_IMAGE
        ? `All 6 pieces uncovered! Worth ${nextWorth} pt.`
        : `Piece #${nextPiece + 1} removed — ${nextRevealed.length}/6 shown (worth ${nextWorth} pts).`
    );
  }, [finished, awaitingAdvance, currentRevealedPieces]);

  const submitGuess = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (finished || awaitingAdvance) return;
      const trimmed = guessInput.trim();
      if (!trimmed) return;

      const match = matchSixPicsImageGuess(trimmed, currentClue);
      if (match.matched) {
        const pts = scoreForSixPicsImage(true, extraPiecesRemovedOnCurrent);
        const outcome: SixPicsImageOutcome = {
          revealedPieces: [...currentRevealedPieces],
          extraPiecesRemoved: extraPiecesRemovedOnCurrent,
          solved: true,
          guess: trimmed,
          points: pts,
        };
        setOutcomes((prev) => [...prev, outcome]);
        setGuessInput("");
        setFeedback(null);
        setConfirmingPass(false);
        setAwaitingAdvance(true);
        return;
      }

      // Free wrong guess: shake + helpful feedback, zero point penalty, zero auto-reveal.
      setWrongGuesses((prev) =>
        prev.some((w) => w.toLowerCase() === trimmed.toLowerCase())
          ? prev
          : [...prev, trimmed]
      );
      setGuessInput("");
      setConfirmingPass(false);
      setShaking(true);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = setTimeout(() => setShaking(false), 420);
      setFeedback(
        remainingCoveredCount > 0
          ? `Not quite (“${trimmed}”) — try again or Reveal Piece (-1 pt)!`
          : `Not quite (“${trimmed}”) — try another word or Pass (0 pts).`
      );
    },
    [
      finished,
      awaitingAdvance,
      guessInput,
      currentClue,
      extraPiecesRemovedOnCurrent,
      currentRevealedPieces,
      remainingCoveredCount,
    ]
  );

  const commitPass = useCallback(() => {
    if (finished || awaitingAdvance) return;
    const outcome: SixPicsImageOutcome = {
      revealedPieces: [...currentRevealedPieces],
      extraPiecesRemoved: extraPiecesRemovedOnCurrent,
      solved: false,
      points: 0,
    };
    setOutcomes((prev) => [...prev, outcome]);
    setGuessInput("");
    setFeedback(null);
    setConfirmingPass(false);
    setAwaitingAdvance(true);
  }, [finished, awaitingAdvance, currentRevealedPieces, extraPiecesRemovedOnCurrent]);

  const handlePassClick = useCallback(() => {
    if (finished || awaitingAdvance) return;
    if (remainingCoveredCount > 0 && !confirmingPass) {
      setConfirmingPass(true);
      return;
    }
    commitPass();
  }, [finished, awaitingAdvance, remainingCoveredCount, confirmingPass, commitPass]);

  const advanceToNextPicture = useCallback(() => {
    const nextIdx = activeImageIndex + 1;
    setAwaitingAdvance(false);
    setWrongGuesses([]);
    setGuessInput("");
    setFeedback(null);
    setConfirmingPass(false);
    if (nextIdx < SIX_PICS_COUNT) {
      const firstOpen = getInitialRevealedPiece(
        puzzle.images[nextIdx]!,
        nextIdx,
        puzzle.id
      );
      setCurrentIndex(nextIdx);
      setCurrentRevealedPieces([firstOpen]);
    }
  }, [activeImageIndex, puzzle.images, puzzle.id]);

  const shareText = useMemo(
    () =>
      buildSixPicsShareText({
        puzzleNumber: puzzle.puzzleNumber,
        themeAnswer: puzzle.themeAnswer,
        outcomes,
        custom: isCustom,
        creatorHandle,
      }),
    [puzzle.puzzleNumber, puzzle.themeAnswer, outcomes, isCustom, creatorHandle]
  );

  const shareUrl =
    isCustom && customId
      ? `https://21games.ai/games/6-pics?b=${customId}`
      : "https://21games.ai/games/6-pics";

  const hasSavedProgress =
    !finished &&
    (outcomes.length > 0 || currentRevealedPieces.length > 1);

  if (!splashDismissed) {
    return (
      <GameSplashScreen
        gameSlug="6-pics"
        gameTitle="6 Pics"
        tagline="Use today's theme and uncover as few puzzle pieces as possible to name all 6 hidden pictures."
        theme={puzzle.themeAnswer}
        author={puzzle.author}
        puzzleNumber={puzzle.puzzleNumber}
        dateKey={dateKey}
        showCreate
        isCompletedToday={isDateCompleted("6-pics", dateKey) || finished}
        hasSavedProgress={hasSavedProgress}
        onPlay={() => setSplashDismissed(true)}
        onCreate={() => router.push("/games/6-pics?mode=create")}
      />
    );
  }

  return (
    <GameShell
      gameSlug="6-pics"
      gameTitle="6 Pics"
      puzzleNumber={puzzle.puzzleNumber}
      dateKey={dateKey}
      author={puzzle.author}
    >
      <div className="max-w-xl mx-auto px-2.5 sm:px-4 py-1.5 sm:py-2 space-y-3.5">
        {!finished ? (
          /* ================================================================
           * GAMEPLAY: Visible Theme + Guess/Reveal Bar + 6-Piece Jigsaw Stage
           * ================================================================ */
          <div className="space-y-3" data-testid="six-pics-gameplay">
            {/* Overarching Theme + Running Score Banner */}
            <div
              className="rounded-2xl border-2 border-black bg-[#FFFBE6] px-3.5 py-2.5 shadow-[3px_3px_0px_#000] flex flex-wrap items-center justify-between gap-2"
              data-testid="six-pics-theme-banner"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">
                  Overarching Theme
                </p>
                <h2 className="font-headline font-black text-lg sm:text-xl text-black leading-tight truncate">
                  {puzzle.themeAnswer}
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="rounded-xl border-2 border-black bg-white px-2.5 py-1 text-xs font-black text-black">
                  Score: {totalScore} / {SIX_PICS_MAX_SCORE}
                </span>
                <span className="hidden min-[380px]:inline-flex rounded-xl border border-black/25 bg-white/80 px-2 py-1 text-[11px] font-bold text-neutral-700">
                  {namedCount}/{SIX_PICS_COUNT} named
                </span>
              </div>
            </div>

            {/* 6-Picture Progress Strip */}
            <div
              className="grid grid-cols-6 gap-1.5"
              aria-label="Six pictures progress"
            >
              {Array.from({ length: SIX_PICS_COUNT }, (_, idx) => {
                const done = outcomes[idx];
                const isCurrent = idx === activeImageIndex && !done;
                return (
                  <div
                    key={idx}
                    data-testid={`six-pics-step-${idx}`}
                    className={cn(
                      "h-7 rounded-lg border-2 text-[11px] font-black flex items-center justify-center transition-all",
                      done
                        ? done.solved
                          ? "bg-emerald-100 border-black text-emerald-950"
                          : "bg-neutral-200 border-neutral-400 text-neutral-600"
                        : isCurrent
                        ? "bg-[#f4d621] border-black text-black shadow-[2px_2px_0px_#000]"
                        : "bg-white border-neutral-300 text-neutral-400"
                    )}
                  >
                    {done ? (done.solved ? `+${done.points}` : "0pt") : `#${idx + 1}`}
                  </div>
                );
              })}
            </div>

            {/* Guess Input OR Post-Solve Full Reveal Interstitial */}
            {!awaitingAdvance ? (
              <form
                onSubmit={submitGuess}
                className={cn(
                  "rounded-2xl border-2 border-black bg-white p-3 space-y-2.5 shadow-[3px_3px_0px_#000]",
                  shaking && "animate-bounce border-red-600"
                )}
              >
                <div className="flex gap-2">
                  <Input
                    ref={guessInputRef}
                    value={guessInput}
                    onChange={(e) => setGuessInput(e.target.value)}
                    placeholder={`Name Picture #${activeImageIndex + 1}…`}
                    maxLength={48}
                    aria-label={`Name picture ${activeImageIndex + 1}`}
                    className="border-2 border-black font-semibold"
                    data-testid="six-pics-guess-input"
                  />
                  <Button
                    type="submit"
                    disabled={!guessInput.trim()}
                    className="bg-black text-white border-2 border-black font-headline font-black shrink-0"
                    data-testid="six-pics-submit"
                  >
                    <Send className="h-4 w-4 mr-1" /> Guess
                  </Button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={remainingCoveredCount <= 0}
                    onClick={handleRevealPiece}
                    className="h-8 px-3 text-xs font-black border-2 border-black bg-[#f4d621] hover:bg-[#f4d621]/80 text-black disabled:opacity-50"
                    data-testid="six-pics-reveal-piece"
                  >
                    <Puzzle className="h-3.5 w-3.5 mr-1.5" />
                    {remainingCoveredCount > 0
                      ? `Reveal Piece (-1 pt · ${remainingCoveredCount} left)`
                      : "All 6 Pieces Open (1 pt)"}
                  </Button>

                  {confirmingPass ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={commitPass}
                        className="h-8 px-2.5 text-xs font-black border-2 border-red-700 bg-red-50 text-red-800 hover:bg-red-100"
                        data-testid="six-pics-confirm-pass"
                      >
                        Confirm Pass (0 pts)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmingPass(false)}
                        className="h-8 px-2 text-xs font-bold"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handlePassClick}
                      className="h-8 px-2.5 text-xs font-bold border-2 border-neutral-400 hover:border-black text-neutral-700"
                      data-testid="six-pics-pass"
                    >
                      <SkipForward className="h-3.5 w-3.5 mr-1" />
                      Pass / Reveal Word (0 pts)
                    </Button>
                  )}
                </div>

                {feedback ? (
                  <p className="text-xs font-bold text-amber-800">{feedback}</p>
                ) : (
                  <p className="text-[11px] text-neutral-500">
                    1/6 of the picture is open for free — wrong guesses have no penalty!
                  </p>
                )}
              </form>
            ) : (
              <div
                className={cn(
                  "rounded-2xl border-2 border-black p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-[3px_3px_0px_#000]",
                  currentResolvedOutcome?.solved ? "bg-emerald-50" : "bg-neutral-100"
                )}
                data-testid="six-pics-pic-result"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-600">
                    {currentResolvedOutcome?.solved
                      ? `Correct! +${currentResolvedOutcome.points} / ${SIX_PICS_MAX_IMAGE_SCORE} pts`
                      : "Passed · 0 / 6 pts"}
                  </p>
                  <p className="font-headline font-black text-lg text-black truncate">
                    {currentResolvedOutcome?.solved && (
                      <CheckCircle2 className="inline h-4 w-4 text-emerald-600 mr-1.5 -mt-0.5" />
                    )}
                    {currentClue.caption}
                  </p>
                </div>

                <Button
                  ref={nextButtonRef}
                  type="button"
                  onClick={advanceToNextPicture}
                  className="bg-black text-white border-2 border-black font-headline font-black shrink-0"
                  data-testid="six-pics-next-pic"
                >
                  {activeImageIndex + 1 < SIX_PICS_COUNT ? (
                    <>
                      Next Picture ({activeImageIndex + 2}/{SIX_PICS_COUNT})
                      <ArrowRight className="h-4 w-4 ml-1.5" />
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-1.5" />
                      See Final Results
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Jigsaw-Covered Picture Stage */}
            <SixPicsJigsawStage
              clue={currentClue}
              imageIndex={activeImageIndex}
              revealedPieces={currentRevealedPieces}
              fullyUncovered={awaitingAdvance}
              currentWorth={currentWorth}
            />

            {wrongGuesses.length > 0 && !awaitingAdvance && (
              <div className="flex flex-wrap gap-1.5 items-center text-xs">
                <span className="font-bold text-neutral-500">Tried on this pic:</span>
                {wrongGuesses.map((g, i) => (
                  <span
                    key={`${g}-${i}`}
                    className="rounded-full bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 font-semibold"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ================================================================
           * POST-GAME ENDING SCREEN: Theme + 36-Pt Score + 2×3 Gallery (Q32)
           * ================================================================ */
          <div
            className="rounded-2xl border-2 border-black bg-white p-4 sm:p-5 space-y-4 shadow-[4px_4px_0px_#000]"
            data-testid="six-pics-summary"
          >
            <div className="text-center space-y-1">
              <p className="text-xs font-extrabold uppercase tracking-wider text-amber-700">
                {totalScore === SIX_PICS_MAX_SCORE
                  ? `Flawless! ${totalScore}/${SIX_PICS_MAX_SCORE} pts · 6/6 Named`
                  : `Score: ${totalScore}/${SIX_PICS_MAX_SCORE} pts · ${namedCount}/${SIX_PICS_COUNT} Named · ${piecesSaved} Pieces Saved`}
              </p>
              <h2
                className="font-headline font-black text-2xl sm:text-3xl tracking-tight text-neutral-900"
                data-testid="six-pics-theme-header"
              >
                {puzzle.themeAnswer}
              </h2>
              <p className="text-lg tracking-widest" aria-label="Emoji score receipt">
                {buildSixPicsEmojiReceipt(outcomes)}
              </p>
            </div>

            {/* 2×3 Grid (2 columns, 3 rows) revealing all 6 images + numbered names + points */}
            <div
              className="grid grid-cols-2 gap-2.5 sm:gap-3"
              data-testid="six-pics-summary-grid"
            >
              {puzzle.images.map((img, idx) => {
                const out = outcomes[idx];
                const pts = out?.points ?? 0;
                return (
                  <div
                    key={idx}
                    className="rounded-xl border-2 border-black overflow-hidden bg-neutral-50 flex flex-col"
                  >
                    <div className="aspect-[4/3] w-full bg-neutral-100 relative">
                      <SixPicsClueVisual
                        clue={img}
                        index={idx}
                        alt={`${idx + 1}. ${img.caption}`}
                      />
                      <span
                        className={cn(
                          "absolute top-2 right-2 rounded-full border border-black px-2 py-0.5 text-[10px] font-black shadow-2xs",
                          pts >= 5
                            ? "bg-emerald-300 text-black"
                            : pts >= 1
                            ? "bg-[#f4d621] text-black"
                            : "bg-neutral-200 text-neutral-700"
                        )}
                      >
                        {pts}/{SIX_PICS_MAX_IMAGE_SCORE} pts
                      </span>
                    </div>
                    <div className="px-2.5 py-1.5 bg-white border-t-2 border-black text-xs font-extrabold text-neutral-900 truncate">
                      {idx + 1}. {img.caption}
                    </div>
                  </div>
                );
              })}
            </div>

            <ResultShareButtons
              title={
                isCustom
                  ? `6 Pics — ${puzzle.themeAnswer}`
                  : `6 Pics #${puzzle.puzzleNumber} — ${puzzle.themeAnswer}`
              }
              text={shareText}
              url={shareUrl}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <Link
                href="/games/6-pics/archive"
                className="inline-flex items-center gap-1 font-bold text-neutral-700 hover:text-black underline underline-offset-4"
              >
                <Calendar className="h-3.5 w-3.5" />
                6 Pics Archive
              </Link>
              <Link
                href="/games/6-pics?mode=create"
                className="inline-flex items-center gap-1 font-bold text-neutral-700 hover:text-black underline underline-offset-4"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Create &amp; Share your own 6 Pics
              </Link>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}

/* ------------------------------------------------------------------------ */
/* Authenticated Creator Mode (?mode=create -> ?b=6p-xxxxxxxx)              */
/* ------------------------------------------------------------------------ */

function SixPicsCreator() {
  const { profile, isAuthenticated, openAccountModal } = useAuth();
  const [editor, setEditor] = useState<SixPicsEditorState>(emptySixPicsEditorState);
  const [errors, setErrors] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [created, setCreated] = useState<{
    url: string;
    blurbWithUrl: string;
    blurbText: string;
    title: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const shell = {
    gameSlug: "6-pics" as const,
    gameTitle: "6 Pics",
    puzzleNumber: 0,
    dateKey: getLocalDateKey(),
    author: profile?.displayName ?? "You",
  };

  if (!isAuthenticated || !profile) {
    return (
      <GameShell {...shell} subtitle="Create & Share">
        <div className="max-w-md mx-auto text-center space-y-4 py-16">
          <Sparkles className="h-8 w-8 mx-auto text-amber-500" />
          <h2 className="font-headline font-black text-2xl">Sign in to create</h2>
          <p className="text-sm text-neutral-600">
            Creating a custom 6 Pics puzzle requires an account so friends can see who made it.
          </p>
          <Button
            onClick={() => openAccountModal("signin")}
            className="font-bold border-2 border-black"
          >
            Sign in
          </Button>
        </div>
      </GameShell>
    );
  }

  if (profile.isBanned) {
    return (
      <GameShell {...shell} subtitle="Create & Share">
        <p className="text-center py-16 text-sm font-semibold">
          Your account has been suspended from publishing custom puzzles.
        </p>
      </GameShell>
    );
  }

  const publish = async () => {
    setErrors([]);
    setPublishing(true);
    try {
      const id = generateCustomGameId("6-pics");
      const { puzzle, errors: draftErrors } = draftToSixPicsPuzzle({
        id,
        title: editor.title,
        themeAnswer: editor.themeAnswer,
        aliasesCsv: editor.aliasesCsv,
        rows: editor.rows,
        creatorName: profile.displayName,
      });
      if (!puzzle) {
        setErrors(draftErrors);
        return;
      }
      const saved = await saveCustomPuzzle({
        id,
        gameSlug: "6-pics",
        title: `${puzzle.themeAnswer} — ${puzzle.title}`,
        creatorId: profile.id,
        creatorName: profile.displayName,
        creatorHandle: profile.handle,
        payload: puzzle as unknown as Record<string, unknown>,
      });
      if (!saved.ok) {
        setErrors([saved.error]);
        return;
      }
      const blurb = formatCustomGameBlurb({
        title: puzzle.themeAnswer,
        creatorHandle: profile.handle,
        creatorName: profile.displayName,
        shareUrl: saved.shareUrl,
        gameName: "6 Pics",
      });
      setCreated({
        url: saved.shareUrl,
        blurbWithUrl: blurb.blurbWithUrl,
        blurbText: blurb.blurbText,
        title: puzzle.themeAnswer,
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <GameShell {...shell} subtitle="Create & Share">
      <div className="max-w-2xl mx-auto space-y-4 py-2" data-testid="six-pics-creator">
        <div>
          <h2 className="font-headline font-black text-2xl">Create your own 6 Pics</h2>
          <p className="text-sm text-neutral-600">
            Set an overarching theme and 6 hidden pictures. Friends see 1/6 of each picture at first and score up to 36 points!
          </p>
        </div>

        {created ? (
          <div className="rounded-2xl border-2 border-black bg-[#fffbe6] p-4 space-y-3">
            <p className="font-headline font-black text-lg">Your 6 Pics link is ready! 🎉</p>
            <p className="text-sm break-all font-mono">{created.url}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1 bg-black text-white border-2 border-black font-bold"
                onClick={() =>
                  void nativeShareResultsOnly({
                    title: `${created.title} — 6 Pics`,
                    text: created.blurbText,
                    url: created.url,
                  })
                }
              >
                <Share2 className="h-4 w-4 mr-1.5" /> Share
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-2 border-black font-bold"
                onClick={async () => {
                  const ok = await copyToClipboard(created.blurbWithUrl);
                  if (ok) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
              >
                <Link2 className="h-4 w-4 mr-1.5" /> {copied ? "Copied!" : "Copy link"}
              </Button>
            </div>
            <Link
              className="text-xs font-bold underline"
              href={`/games/6-pics?b=${created.url.split("?b=")[1]}`}
            >
              Play it yourself →
            </Link>
          </div>
        ) : (
          <>
            <SixPicsEditor value={editor} onChange={setEditor} />
            {errors.length > 0 && (
              <ul className="rounded-xl border-2 border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-700 list-disc list-inside space-y-0.5">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              onClick={publish}
              disabled={publishing}
              className="w-full h-11 bg-black text-white border-2 border-black font-headline font-black"
              data-testid="six-pics-publish"
            >
              {publishing ? "Publishing…" : "Publish & get link"}
            </Button>
          </>
        )}
      </div>
    </GameShell>
  );
}
