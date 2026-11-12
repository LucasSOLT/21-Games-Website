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
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Calendar, Clock, Lightbulb } from "lucide-react";
import {
  ECHO_GRID_SIZE,
  ECHO_POSITION_COLORS,
  ECHO_START_INDEX,
  buildEchoChainRules,
  buildEchoShareText,
  describeEchoTile,
  echoStars,
  formatEchoTime,
  formatEchoVictorySummary,
  pickEchoHintCandidates,
  type EightfoldEchoPuzzle,
} from "@/data/puzzles/eightfold-echo";
import { getDailyPuzzleForGame, getLocalDateKey } from "@/lib/daily-engine";
import {
  getAdminOverridesForGame,
  getGameProgress,
  getGameStats,
  isDateCompleted,
  recordGameWin,
  saveGameProgress,
  setGameStats,
} from "@/lib/game-storage";
import { computePuzzleContentHash } from "@/lib/seeded-random";
import { GameShell } from "@/components/game-shell";
import { GameSplashScreen } from "@/components/game-splash-screen";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EchoTileSvg } from "./echo-tile-svg";
import { ResultShareButtons } from "./result-share-buttons";
import { cn } from "@/lib/utils";

const WRONG_PENALTY_SECONDS = 5;
const HINT_PENALTY_SECONDS = 15;
const subscribeNoop = () => () => {};

interface SavedEchoProgress {
  puzzleId: string;
  puzzleHash: string;
  visited: number[];
  mistakes: number;
  baseSeconds: number;
  penaltySeconds: number;
}

function isValidDateKey(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function EightfoldEchoGame() {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center font-headline font-black text-xl">
        Loading Eightfold Echo...
      </div>
    );
  }
  return (
    <Suspense fallback={null}>
      <EightfoldEchoDaily />
    </Suspense>
  );
}

function EightfoldEchoDaily() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
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
    const resolved = getDailyPuzzleForGame<EightfoldEchoPuzzle>(
      "eightfold-echo",
      dateKey,
      getAdminOverridesForGame("eightfold-echo")
    );
    return resolved!.puzzle;
  }, [dateKey, syncVersion]);

  const hash = useMemo(() => computePuzzleContentHash(puzzle), [puzzle]);

  return (
    <EightfoldEchoBoard
      key={`${puzzle.id}:${hash}:${dateKey}`}
      puzzle={puzzle}
      puzzleHash={hash}
      dateKey={dateKey}
    />
  );
}

interface EightfoldEchoBoardProps {
  puzzle: EightfoldEchoPuzzle;
  puzzleHash: string;
  dateKey: string;
}

function EightfoldEchoBoard({
  puzzle,
  puzzleHash,
  dateKey,
}: EightfoldEchoBoardProps) {
  const saved = useMemo<SavedEchoProgress | null>(() => {
    const s = getGameProgress<SavedEchoProgress>(
      "eightfold-echo",
      dateKey,
      puzzle.id
    );
    if (
      !s ||
      s.puzzleHash !== puzzleHash ||
      !Array.isArray(s.visited) ||
      s.visited.length === 0 ||
      s.visited[0] !== ECHO_START_INDEX
    ) {
      return null;
    }
    return s;
  }, [dateKey, puzzle.id, puzzleHash]);

  const [visited, setVisited] = useState<number[]>(
    saved?.visited ?? [ECHO_START_INDEX]
  );
  const [mistakes, setMistakes] = useState<number>(saved?.mistakes ?? 0);
  const [baseSeconds, setBaseSeconds] = useState<number>(
    saved?.baseSeconds ?? 0
  );
  const [penaltySeconds, setPenaltySeconds] = useState<number>(
    saved?.penaltySeconds ?? 0
  );
  const [splashDismissed, setSplashDismissed] = useState(false);
  const [hintConfirmOpen, setHintConfirmOpen] = useState(false);
  const [hintCandidates, setHintCandidates] = useState<number[]>([]);
  const [shakeTile, setShakeTile] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedRef = useRef(false);

  const complete = visited.length >= ECHO_GRID_SIZE;
  const activeTileIndex = complete
    ? -1
    : (visited[visited.length - 1] ?? ECHO_START_INDEX);
  const stepNumber = Math.min(visited.length - 1, ECHO_GRID_SIZE - 1);
  const totalElapsed = baseSeconds + penaltySeconds;
  const hasSavedProgress =
    visited.length > 1 || mistakes > 0 || totalElapsed > 0;
  const completedAlready = isDateCompleted("eightfold-echo", dateKey) || complete;

  // Count-up stopwatch starts ONLY after splash screen is dismissed (Q22).
  useEffect(() => {
    if (!splashDismissed || complete) return;
    const id = setInterval(() => {
      setBaseSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [splashDismissed, complete]);

  useEffect(
    () => () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  // Persist progress per date + puzzle hash.
  useEffect(() => {
    saveGameProgress<SavedEchoProgress>("eightfold-echo", dateKey, {
      puzzleId: puzzle.id,
      puzzleHash,
      visited,
      mistakes,
      baseSeconds,
      penaltySeconds,
    });
  }, [
    dateKey,
    puzzle.id,
    puzzleHash,
    visited,
    mistakes,
    baseSeconds,
    penaltySeconds,
  ]);

  // Record win + star/zero-mistake buckets once when solved.
  useEffect(() => {
    if (!complete || recordedRef.current) return;
    recordedRef.current = true;
    if (!isDateCompleted("eightfold-echo", dateKey)) {
      const recordedTime = Math.max(1, totalElapsed);
      const stars = echoStars(mistakes, totalElapsed);
      const updated = recordGameWin("eightfold-echo", dateKey, recordedTime);
      const dist = { ...updated.distribution };
      dist[`stars_${stars}`] = (dist[`stars_${stars}`] ?? 0) + 1;
      if (mistakes === 0) {
        dist.zero_mistakes = (dist.zero_mistakes ?? 0) + 1;
      }
      setGameStats("eightfold-echo", { ...getGameStats("eightfold-echo"), distribution: dist });
    }
  }, [complete, dateKey, mistakes, totalElapsed]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 1600);
  }, []);

  const handleTileTap = useCallback(
    (gridIndex: number) => {
      if (!splashDismissed || complete) return;
      if (visited.includes(gridIndex)) return;

      const expectedNext = puzzle.solution[visited.length];
      if (gridIndex === expectedNext) {
        const nextVisited = [...visited, gridIndex];
        setVisited(nextVisited);
        setHintCandidates([]);
        setToastMsg(null);
      } else {
        setMistakes((m) => m + 1);
        setPenaltySeconds((p) => p + WRONG_PENALTY_SECONDS);
        setShakeTile(gridIndex);
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
        shakeTimerRef.current = setTimeout(() => setShakeTile(null), 450);
        showToast(`Not quite! +${WRONG_PENALTY_SECONDS}s`);
      }
    },
    [splashDismissed, complete, visited, puzzle.solution, showToast]
  );

  const confirmHint = useCallback(() => {
    setHintConfirmOpen(false);
    if (complete) return;
    setPenaltySeconds((p) => p + HINT_PENALTY_SECONDS);
    const candidates = pickEchoHintCandidates(puzzle, visited, puzzle.id);
    setHintCandidates(candidates);
    showToast(`Hint active! +${HINT_PENALTY_SECONDS}s`);
  }, [complete, puzzle, visited, showToast]);

  const chainRules = useMemo(() => buildEchoChainRules(puzzle), [puzzle]);
  const stars = echoStars(mistakes, totalElapsed);
  const victorySummary = formatEchoVictorySummary(totalElapsed, mistakes, stars);
  const shareText = useMemo(
    () =>
      buildEchoShareText({
        puzzleNumber: puzzle.puzzleNumber,
        elapsedSeconds: totalElapsed,
        mistakes,
        solution: puzzle.solution,
      }),
    [puzzle.puzzleNumber, puzzle.solution, totalElapsed, mistakes]
  );

  if (!splashDismissed) {
    return (
      <GameSplashScreen
        gameSlug="eightfold-echo"
        gameTitle="Eightfold Echo"
        tagline="Follow the single-change shape echo from the emerald center across all 9 tiles."
        theme={puzzle.title}
        author={puzzle.author}
        puzzleNumber={puzzle.puzzleNumber}
        dateKey={dateKey}
        showCreate={false}
        isCompletedToday={completedAlready}
        hasSavedProgress={hasSavedProgress && !complete}
        onPlay={() => setSplashDismissed(true)}
      />
    );
  }

  return (
    <GameShell
      gameSlug="eightfold-echo"
      gameTitle="Eightfold Echo"
      puzzleNumber={puzzle.puzzleNumber}
      dateKey={dateKey}
      author={puzzle.author}
    >
      <div className="max-w-lg mx-auto px-2 sm:px-4 py-1 sm:py-2 flex flex-col items-center gap-2.5 sm:gap-3">
        {/* Compact single-screen HUD bar (fits 320px viewports cleanly) */}
        <div
          className="w-full max-w-[min(92vw,380px)] flex items-center justify-between gap-1.5 rounded-xl border-2 border-black bg-white px-2.5 py-1.5 shadow-[2px_2px_0px_#000]"
          data-testid="echo-hud"
        >
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold tabular-nums">
            <span className="inline-flex items-center gap-1 text-neutral-900" data-testid="echo-timer">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {formatEchoTime(totalElapsed)}
            </span>
            <span className="text-neutral-300">·</span>
            <span className="text-neutral-700" data-testid="echo-mistakes">
              Mistakes: <strong>{mistakes}</strong>
            </span>
            <span className="hidden xs:inline text-neutral-300">·</span>
            <span className="text-[11px] sm:text-xs text-neutral-500">
              {complete ? "8/8" : `${stepNumber}/8`}
            </span>
          </div>

          {!complete && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={hintCandidates.length > 0 || visited.length >= ECHO_GRID_SIZE - 1}
              onClick={() => setHintConfirmOpen(true)}
              className="h-7 px-2 text-[11px] sm:text-xs font-bold border-2 border-black bg-[#daa8d0]/25 hover:bg-[#daa8d0]/45"
              data-testid="echo-hint-button"
            >
              <Lightbulb className="h-3.5 w-3.5 mr-1" />
              Hint (+15s)
            </Button>
          )}
        </div>

        {/* Toast / instruction micro-banner */}
        <div className="h-5 flex items-center justify-center">
          {toastMsg ? (
            <span
              role="status"
              className="inline-flex items-center gap-1 rounded-full bg-red-600 text-white px-2.5 py-0.5 text-xs font-bold shadow-sm"
              data-testid="echo-toast"
            >
              <AlertTriangle className="h-3 w-3" />
              {toastMsg}
            </span>
          ) : !complete ? (
            <p className="text-[11px] sm:text-xs text-neutral-600 font-medium text-center">
              Tap the unvisited tile that changes <strong>exactly 1 attribute</strong> from the dotted tile.
            </p>
          ) : (
            <p className="text-xs font-bold text-emerald-700">Echo chain complete!</p>
          )}
        </div>

        {/* 3×3 Square Shape Grid — single-screen fit on 320px mobile & desktop */}
        <div
          className="w-full max-w-[min(86vw,356px)] sm:max-w-[376px] aspect-square grid grid-cols-3 gap-2 sm:gap-2.5 p-2 rounded-2xl border-2 border-black bg-neutral-50 shadow-[4px_4px_0px_#000]"
          role="grid"
          aria-label="Eightfold Echo 3 by 3 shape grid"
          data-testid="echo-grid"
        >
          {puzzle.tiles.map((tile, idx) => {
            const signatureColor = ECHO_POSITION_COLORS[idx]!;
            const visitedOrder = visited.indexOf(idx);
            const isActive = idx === activeTileIndex && !complete;
            const isCompletedTile =
              visitedOrder >= 0 && (complete || visitedOrder < visited.length - 1);
            const isHintPulse = hintCandidates.includes(idx) && !isCompletedTile && !isActive;
            const isShaking = shakeTile === idx;

            return (
              <button
                key={idx}
                type="button"
                disabled={complete || isCompletedTile || isActive}
                onClick={() => handleTileTap(idx)}
                aria-label={
                  isCompletedTile
                    ? `Completed tile at position ${idx + 1}`
                    : isActive
                    ? `Current active tile: ${describeEchoTile(tile)}`
                    : `Unvisited tile: ${describeEchoTile(tile)}`
                }
                data-testid={`echo-tile-${idx}`}
                data-state={
                  isCompletedTile ? "completed" : isActive ? "active" : "unvisited"
                }
                style={
                  isCompletedTile
                    ? {
                        backgroundColor: signatureColor,
                        borderColor: "#111111",
                        borderWidth: "2px",
                        borderStyle: "solid",
                      }
                    : isActive
                    ? {
                        backgroundColor: "#ffffff",
                        borderColor: signatureColor,
                        borderWidth: "3px",
                        borderStyle: "dashed",
                      }
                    : {
                        backgroundColor: "#ffffff",
                        borderColor: isShaking ? "#dc2626" : "#d4d4d8",
                        borderWidth: "2px",
                        borderStyle: "solid",
                      }
                }
                className={cn(
                  "relative aspect-square rounded-xl flex items-center justify-center p-2 sm:p-2.5 transition-all select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-black",
                  !isCompletedTile &&
                    !isActive &&
                    !complete &&
                    "hover:border-black hover:-translate-y-0.5 active:translate-y-0 cursor-pointer",
                  isActive && "shadow-[0_0_0_3px_rgba(0,0,0,0.06)]",
                  isHintPulse && "animate-pulse ring-4 ring-amber-400",
                  isShaking && "animate-bounce bg-red-50"
                )}
              >
                {/* Q21: Completed tiles fill 100% solid in their signature color (NO step badges & inner shape hidden). */}
                {!isCompletedTile && (
                  <EchoTileSvg tile={tile} clipKey={`board-${puzzle.id}-${idx}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Post-Game Victory Card + Ordered 0 → 8 Chain & Logic Walkthrough (Q24 & Q26) */}
        {complete && (
          <div
            className="w-full max-w-[min(94vw,440px)] rounded-2xl border-2 border-black bg-white p-4 sm:p-5 space-y-4 shadow-[4px_4px_0px_#000] mt-1"
            data-testid="echo-victory-card"
          >
            <div className="text-center space-y-1">
              <p className="text-xs font-extrabold uppercase tracking-wider text-purple-700">
                Eightfold Echo #{puzzle.puzzleNumber}
              </p>
              <h2
                className="font-headline font-black text-lg sm:text-xl text-neutral-900"
                data-testid="echo-victory-summary"
              >
                {victorySummary}
              </h2>
              <p className="text-xs text-neutral-500">“{puzzle.title}”</p>
            </div>

            <ResultShareButtons
              title={`Eightfold Echo #${puzzle.puzzleNumber}`}
              text={shareText}
              url="https://21games.ai/games/eightfold-echo"
            />

            {/* Ordered 0 → 8 Visual Chain */}
            <div className="space-y-2 pt-1 border-t border-neutral-200">
              <p className="text-xs font-extrabold uppercase tracking-wider text-neutral-600">
                0 → 8 Echo Chain &amp; Step Rules
              </p>
              <div
                className="grid grid-cols-9 gap-1"
                data-testid="echo-chain-strip"
              >
                {puzzle.solution.map((pos, stepIdx) => (
                  <div
                    key={pos}
                    className="flex flex-col items-center gap-0.5"
                    title={`Step ${stepIdx}: ${describeEchoTile(puzzle.tiles[pos]!)}`}
                  >
                    <div
                      className="w-full aspect-square rounded-lg p-1 bg-white"
                      style={{
                        border: `2.5px solid ${ECHO_POSITION_COLORS[pos]}`,
                      }}
                    >
                      <EchoTileSvg
                        tile={puzzle.tiles[pos]!}
                        clipKey={`chain-${puzzle.id}-${stepIdx}`}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-neutral-500 tabular-nums">
                      {stepIdx}
                    </span>
                  </div>
                ))}
              </div>

              <ol className="space-y-1 text-xs text-neutral-700 pt-1">
                {chainRules.map((rule, idx) => (
                  <li
                    key={idx}
                    className="rounded-lg bg-neutral-50 border border-neutral-200 px-2.5 py-1.5 flex items-start gap-2"
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full mt-1 shrink-0 border border-black/30"
                      style={{
                        backgroundColor:
                          ECHO_POSITION_COLORS[puzzle.solution[idx + 1]!],
                      }}
                    />
                    <span>
                      <strong>
                        {idx} → {idx + 1}:
                      </strong>{" "}
                      {rule}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex justify-center pt-1">
              <Link
                href="/games/eightfold-echo/archive"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-700 hover:text-black underline underline-offset-4"
              >
                <Calendar className="h-3.5 w-3.5" />
                Play past Eightfold Echo puzzles
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation-gated Hint Dialog (Q23) */}
      <Dialog open={hintConfirmOpen} onOpenChange={setHintConfirmOpen}>
        <DialogContent className="max-w-sm border-2 border-black">
          <DialogHeader>
            <DialogTitle className="font-headline font-black">
              Use a Candidate Hint (+15s)?
            </DialogTitle>
            <DialogDescription className="text-sm text-neutral-600">
              Confirming adds <strong>+15 seconds</strong> to your stopwatch and pulses{" "}
              <strong>2 candidate tiles</strong> on the board (one is the true next echo,
              one is a decoy).
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setHintConfirmOpen(false)}
              className="border-2 border-black font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmHint}
              className="bg-black text-white border-2 border-black font-bold"
              data-testid="echo-hint-confirm"
            >
              Pulse 2 Tiles (+15s)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </GameShell>
  );
}
