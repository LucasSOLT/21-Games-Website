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
  Calendar,
  ChevronLeft,
  ChevronRight,
  Link2,
  Lock,
  Send,
  Share2,
  SkipForward,
  Sparkles,
} from "lucide-react";
import {
  SIX_PICS_COUNT,
  buildSixPicsEmojiReceipt,
  buildSixPicsShareText,
  draftToSixPicsPuzzle,
  matchSixPicsGuess,
  renderSixPicsSceneDataUri,
  scoreForSixPics,
  validateSixPicsPuzzle,
  type SixPicsAttempt,
  type SixPicsClueImage,
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

interface SavedSixPicsProgress {
  puzzleId: string;
  puzzleHash: string;
  attempts: SixPicsAttempt[];
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
/* Gameplay Carousel & Post-Game 2×3 Grid                                   */
/* ------------------------------------------------------------------------ */

interface SixPicsBoardProps {
  puzzle: SixPicsPuzzle;
  puzzleHash: string;
  dateKey: string;
  isCustom: boolean;
  creatorHandle?: string;
  customId?: string;
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

  const saved = useMemo<SavedSixPicsProgress | null>(() => {
    if (isCustom) return null;
    const s = getGameProgress<SavedSixPicsProgress>("6-pics", dateKey, puzzle.id);
    if (!s || s.puzzleHash !== puzzleHash || !Array.isArray(s.attempts)) return null;
    return s;
  }, [isCustom, dateKey, puzzle.id, puzzleHash]);

  const [attempts, setAttempts] = useState<SixPicsAttempt[]>(saved?.attempts ?? []);
  const [guessInput, setGuessInput] = useState("");
  const [splashDismissed, setSplashDismissed] = useState(isCustom);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);

  const solvedIndex = attempts.findIndex((a) => a.kind === "correct");
  const won = solvedIndex >= 0;
  const lost = !won && attempts.length >= SIX_PICS_COUNT;
  const finished = won || lost;
  const unlockedCount = finished
    ? SIX_PICS_COUNT
    : Math.min(SIX_PICS_COUNT, attempts.length + 1);
  const score = scoreForSixPics(won ? solvedIndex + 1 : null);

  const [activeSlide, setActiveSlide] = useState<number>(() =>
    Math.min(SIX_PICS_COUNT - 1, (saved?.attempts.length ?? 0))
  );
  const touchStartXRef = useRef<number | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedRef = useRef(false);

  useEffect(
    () => () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    },
    []
  );

  // Persist daily/archive progress.
  useEffect(() => {
    if (isCustom) return;
    saveGameProgress<SavedSixPicsProgress>("6-pics", dateKey, {
      puzzleId: puzzle.id,
      puzzleHash,
      attempts,
    });
  }, [isCustom, dateKey, puzzle.id, puzzleHash, attempts]);

  // Record completion stats once (wins via recordScoredCompletion; 0/6 loss increments played).
  useEffect(() => {
    if (!finished || isCustom || recordedRef.current) return;
    recordedRef.current = true;
    const current = getGameStats("6-pics");
    const lossKey = `loss_${dateKey}`;
    if (current.completedDates.includes(dateKey) || current.distribution[lossKey]) return;
    if (won) {
      recordScoredCompletion("6-pics", dateKey, score, SIX_PICS_COUNT);
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
  }, [finished, isCustom, dateKey, won, score]);

  const submitGuess = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (finished) return;
      const trimmed = guessInput.trim();
      if (!trimmed) return;

      const match = matchSixPicsGuess(trimmed, puzzle);
      if (match.matched) {
        const nextAttempts: SixPicsAttempt[] = [
          ...attempts,
          { kind: "correct", guess: trimmed },
        ];
        setAttempts(nextAttempts);
        setGuessInput("");
        setFeedback(null);
        return;
      }

      const nextAttempts: SixPicsAttempt[] = [
        ...attempts,
        { kind: "wrong", guess: trimmed },
      ];
      setAttempts(nextAttempts);
      setGuessInput("");
      setShaking(true);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = setTimeout(() => setShaking(false), 450);

      if (nextAttempts.length < SIX_PICS_COUNT) {
        const nextIdx = nextAttempts.length;
        setActiveSlide(nextIdx);
        setFeedback(`Not quite — Pic #${nextIdx + 1} unlocked!`);
      } else {
        setFeedback(null);
      }
    },
    [finished, guessInput, puzzle, attempts]
  );

  const handleSkip = useCallback(() => {
    if (finished) return;
    const nextAttempts: SixPicsAttempt[] = [...attempts, { kind: "skip" }];
    setAttempts(nextAttempts);
    setGuessInput("");
    if (nextAttempts.length < SIX_PICS_COUNT) {
      const nextIdx = nextAttempts.length;
      setActiveSlide(nextIdx);
      setFeedback(`Revealed Pic #${nextIdx + 1} of ${SIX_PICS_COUNT}`);
    } else {
      setFeedback(null);
    }
  }, [finished, attempts]);

  const goPrev = useCallback(() => {
    setActiveSlide((s) => (s > 0 ? s - 1 : unlockedCount - 1));
  }, [unlockedCount]);

  const goNext = useCallback(() => {
    setActiveSlide((s) => (s + 1 < unlockedCount ? s + 1 : 0));
  }, [unlockedCount]);

  const shareText = useMemo(
    () =>
      buildSixPicsShareText({
        puzzleNumber: puzzle.puzzleNumber,
        attempts,
        custom: isCustom,
        creatorHandle,
      }),
    [puzzle.puzzleNumber, attempts, isCustom, creatorHandle]
  );

  const shareUrl = isCustom && customId
    ? `https://21games.ai/games/6-pics?b=${customId}`
    : "https://21games.ai/games/6-pics";

  if (!splashDismissed) {
    return (
      <GameSplashScreen
        gameSlug="6-pics"
        gameTitle="6 Pics"
        tagline="Six progressive visual clues, one overarching secret theme."
        theme={puzzle.title}
        author={puzzle.author}
        puzzleNumber={puzzle.puzzleNumber}
        dateKey={dateKey}
        showCreate
        isCompletedToday={isDateCompleted("6-pics", dateKey) || finished}
        hasSavedProgress={attempts.length > 0 && !finished}
        onPlay={() => setSplashDismissed(true)}
        onCreate={() => router.push("/games/6-pics?mode=create")}
      />
    );
  }

  const currentSlideClue = puzzle.images[Math.min(activeSlide, unlockedCount - 1)]!;

  return (
    <GameShell
      gameSlug="6-pics"
      gameTitle="6 Pics"
      puzzleNumber={puzzle.puzzleNumber}
      dateKey={dateKey}
      author={puzzle.author}
    >
      <div className="max-w-xl mx-auto px-3 sm:px-4 py-2 space-y-4">
        {!finished ? (
          /* ================================================================
           * GAMEPLAY: Guess Bar + Label-Free Single-Image Carousel (Q27-Q29)
           * ================================================================ */
          <div className="space-y-3" data-testid="six-pics-gameplay">
            <form
              onSubmit={submitGuess}
              className={cn(
                "rounded-2xl border-2 border-black bg-white p-3 space-y-2.5 shadow-[3px_3px_0px_#000]",
                shaking && "animate-bounce border-red-600"
              )}
            >
              <div className="flex items-center justify-between text-xs font-bold text-neutral-600">
                <span>
                  Attempt {attempts.length + 1} of {SIX_PICS_COUNT} · Worth{" "}
                  <strong>{SIX_PICS_COUNT - attempts.length}/6</strong>
                </span>
                <span>
                  Unlocked: {unlockedCount}/{SIX_PICS_COUNT}
                </span>
              </div>

              <div className="flex gap-2">
                <Input
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  placeholder="Guess the overarching theme…"
                  maxLength={48}
                  aria-label="Theme guess"
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

              <div className="flex items-center justify-between gap-2">
                {feedback ? (
                  <p className="text-xs font-bold text-amber-800 truncate">{feedback}</p>
                ) : (
                  <p className="text-[11px] text-neutral-500">
                    Pic #1 is free — wrong guess or skip unlocks the next picture.
                  </p>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSkip}
                  className="h-8 px-2.5 text-xs font-bold border-2 border-black bg-[#f4d621]/35 hover:bg-[#f4d621]/65 shrink-0"
                  data-testid="six-pics-skip"
                >
                  <SkipForward className="h-3.5 w-3.5 mr-1" />
                  {unlockedCount < SIX_PICS_COUNT
                    ? `Skip / Reveal Next Pic (${unlockedCount + 1}/${SIX_PICS_COUNT})`
                    : "Give Up / Reveal Theme"}
                </Button>
              </div>
            </form>

            {/* Focused Single-Image Carousel (strictly label-free during gameplay) */}
            <div
              className="relative rounded-2xl border-2 border-black bg-white overflow-hidden shadow-[4px_4px_0px_#000]"
              onTouchStart={(e) => {
                touchStartXRef.current = e.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={(e) => {
                const startX = touchStartXRef.current;
                const endX = e.changedTouches[0]?.clientX ?? null;
                touchStartXRef.current = null;
                if (startX === null || endX === null) return;
                const delta = endX - startX;
                if (Math.abs(delta) < 36 || unlockedCount <= 1) return;
                if (delta < 0) goNext();
                else goPrev();
              }}
              data-testid="six-pics-carousel"
            >
              <div className="aspect-[4/3] w-full bg-neutral-100 relative">
                <SixPicsClueVisual
                  clue={currentSlideClue}
                  index={activeSlide}
                  alt={`Visual clue ${activeSlide + 1} of ${SIX_PICS_COUNT}`}
                />
                <span className="absolute top-3 left-3 rounded-full bg-black/80 text-white px-2.5 py-0.5 text-xs font-bold">
                  {activeSlide + 1} of {SIX_PICS_COUNT}
                </span>

                {unlockedCount > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goPrev}
                      aria-label="Previous unlocked picture"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white border-2 border-black flex items-center justify-center shadow"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      aria-label="Next unlocked picture"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white border-2 border-black flex items-center justify-center shadow"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>

              {/* 6 Pagination Dots (Unlocked vs Locked 🔒) */}
              <div
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-neutral-50 border-t-2 border-black"
                role="tablist"
                aria-label="Clue picture pagination"
              >
                {Array.from({ length: SIX_PICS_COUNT }, (_, idx) => {
                  const isUnlocked = idx < unlockedCount;
                  const isCurrent = idx === activeSlide;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!isUnlocked}
                      onClick={() => setActiveSlide(idx)}
                      aria-label={
                        isUnlocked
                          ? `View picture ${idx + 1} of ${SIX_PICS_COUNT}`
                          : `Picture ${idx + 1} locked`
                      }
                      data-testid={`six-pics-dot-${idx}`}
                      className={cn(
                        "h-7 min-w-7 px-1.5 rounded-full text-xs font-black border-2 transition-all flex items-center justify-center",
                        isCurrent
                          ? "bg-[#f4d621] border-black text-black scale-105"
                          : isUnlocked
                          ? "bg-white border-black text-black hover:bg-neutral-100"
                          : "bg-neutral-200 border-neutral-300 text-neutral-500 cursor-not-allowed"
                      )}
                    >
                      {isUnlocked ? idx + 1 : <Lock className="h-3 w-3" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {attempts.some((a) => a.kind === "wrong") && (
              <div className="flex flex-wrap gap-1.5 items-center text-xs">
                <span className="font-bold text-neutral-500">Past guesses:</span>
                {attempts
                  .filter((a): a is { kind: "wrong"; guess: string } => a.kind === "wrong")
                  .map((a, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 font-semibold"
                    >
                      {a.guess}
                    </span>
                  ))}
              </div>
            )}
          </div>
        ) : (
          /* ================================================================
           * POST-GAME ENDING SCREEN: Bold Theme Header + 2×3 Captioned Grid (Q32)
           * ================================================================ */
          <div
            className="rounded-2xl border-2 border-black bg-white p-4 sm:p-5 space-y-4 shadow-[4px_4px_0px_#000]"
            data-testid="six-pics-summary"
          >
            <div className="text-center space-y-1">
              <p className="text-xs font-extrabold uppercase tracking-wider text-amber-700">
                {won ? `Solved! Score: ${score}/${SIX_PICS_COUNT}` : `Out of guesses · 0/${SIX_PICS_COUNT}`}
              </p>
              <h2
                className="font-headline font-black text-2xl sm:text-3xl tracking-tight text-neutral-900"
                data-testid="six-pics-theme-header"
              >
                {puzzle.themeAnswer}
              </h2>
              <p className="text-lg tracking-widest" aria-label="Emoji score receipt">
                {buildSixPicsEmojiReceipt(attempts)}
              </p>
            </div>

            {/* 2×3 Grid (2 columns, 3 rows) revealing all 6 images + numbered captions */}
            <div
              className="grid grid-cols-2 gap-2.5 sm:gap-3"
              data-testid="six-pics-summary-grid"
            >
              {puzzle.images.map((img, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border-2 border-black overflow-hidden bg-neutral-50 flex flex-col"
                >
                  <div className="aspect-[4/3] w-full bg-neutral-100">
                    <SixPicsClueVisual
                      clue={img}
                      index={idx}
                      alt={`${idx + 1}. ${img.caption}`}
                    />
                  </div>
                  <div className="px-2.5 py-1.5 bg-white border-t-2 border-black text-xs font-extrabold text-neutral-900 truncate">
                    {idx + 1}. {img.caption}
                  </div>
                </div>
              ))}
            </div>

            <ResultShareButtons
              title={
                isCustom
                  ? `6 Pics — ${puzzle.title}`
                  : `6 Pics #${puzzle.puzzleNumber}`
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
        title: puzzle.title,
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
        title: puzzle.title,
        creatorHandle: profile.handle,
        creatorName: profile.displayName,
        shareUrl: saved.shareUrl,
        gameName: "6 Pics",
      });
      setCreated({
        url: saved.shareUrl,
        blurbWithUrl: blurb.blurbWithUrl,
        blurbText: blurb.blurbText,
        title: puzzle.title,
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
            Choose a secret theme and 6 progressive visual clues. Friends unlock them one by one!
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
