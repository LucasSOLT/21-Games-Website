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
import { AlertTriangle, ArrowRight, Calendar, Check, Clock, Lightbulb } from "lucide-react";
import {
  ECHO_DIFFICULTIES,
  ECHO_GRID_SIZE,
  ECHO_POSITION_COLORS,
  ECHO_START_INDEX,
  buildEchoChainRules,
  buildEchoShareText,
  describeEchoTile,
  echoStars,
  formatEchoTime,
  formatEchoVictorySummary,
  getEchoStage,
  pickEchoHintCandidates,
  type EchoDifficulty,
  type EightfoldEchoPuzzle,
} from "@/data/puzzles/eightfold-echo";
import { getDailyPuzzleForGame } from "@/lib/daily-engine";
import {
  isGameTimerExternallyPaused,
  useLiveLocalDateKey,
} from "@/hooks/use-live-date-key";
import {
  playErrorSfx,
  playSnapSfx,
  playTapSfx,
  playWinChimeSfx,
} from "@/lib/game-sfx";
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
import { WinFlourish } from "./win-flourish";
import { cn } from "@/lib/utils";

const WRONG_PENALTY_SECONDS = 5;
const HINT_PENALTY_SECONDS = 15;
const subscribeNoop = () => () => {};

interface EchoStageProgress {
  visited: number[];
  mistakes: number;
  baseSeconds: number;
  penaltySeconds: number;
}

interface SavedEchoProgress {
  puzzleId: string;
  puzzleHash: string;
  activeDifficulty?: EchoDifficulty;
  stages?: Partial<Record<EchoDifficulty, EchoStageProgress>>;
  /** Legacy single-stage fields preserved for backward compatibility. */
  visited?: number[];
  mistakes?: number;
  baseSeconds?: number;
  penaltySeconds?: number;
}

function emptyStageProgress(): EchoStageProgress {
  return {
    visited: [ECHO_START_INDEX],
    mistakes: 0,
    baseSeconds: 0,
    penaltySeconds: 0,
  };
}

function isValidStageProgress(v: unknown): v is EchoStageProgress {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    Array.isArray(s.visited) &&
    s.visited.length > 0 &&
    s.visited[0] === ECHO_START_INDEX &&
    typeof s.mistakes === "number" &&
    typeof s.baseSeconds === "number" &&
    typeof s.penaltySeconds === "number"
  );
}

function isValidDateKey(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const DIFFICULTY_META: Record<
  EchoDifficulty,
  { label: string; subtitle: string }
> = {
  easy: {
    label: "Easy",
    subtitle: "Direct 1-change chain",
  },
  hard: {
    label: "Hard",
    subtitle: "Lookahead chain",
  },
};

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
  const todayKey = useLiveLocalDateKey();
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
  const liveTodayKey = useLiveLocalDateKey();
  const initialSaved = useMemo<{
    activeDifficulty: EchoDifficulty;
    stages: Record<EchoDifficulty, EchoStageProgress>;
  }>(() => {
    const fallback = {
      activeDifficulty: "easy" as EchoDifficulty,
      stages: {
        easy: emptyStageProgress(),
        hard: emptyStageProgress(),
      },
    };
    const s = getGameProgress<SavedEchoProgress>(
      "eightfold-echo",
      dateKey,
      puzzle.id
    );
    if (!s || s.puzzleHash !== puzzleHash) {
      return fallback;
    }
    const easySaved = isValidStageProgress(s.stages?.easy)
      ? s.stages!.easy!
      : emptyStageProgress();
    const hardSaved = isValidStageProgress(s.stages?.hard)
      ? s.stages!.hard!
      : Array.isArray(s.visited) &&
        s.visited.length > 0 &&
        s.visited[0] === ECHO_START_INDEX
      ? {
          visited: s.visited,
          mistakes: s.mistakes ?? 0,
          baseSeconds: s.baseSeconds ?? 0,
          penaltySeconds: s.penaltySeconds ?? 0,
        }
      : emptyStageProgress();

    const activeDifficulty: EchoDifficulty =
      s.activeDifficulty === "hard" ? "hard" : "easy";

    return {
      activeDifficulty,
      stages: {
        easy: easySaved,
        hard: hardSaved,
      },
    };
  }, [dateKey, puzzle.id, puzzleHash]);

  const [difficulty, setDifficulty] = useState<EchoDifficulty>(
    initialSaved.activeDifficulty
  );
  const [stagesState, setStagesState] = useState<
    Record<EchoDifficulty, EchoStageProgress>
  >(initialSaved.stages);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const [hintConfirmOpen, setHintConfirmOpen] = useState(false);
  const [hintCandidates, setHintCandidates] = useState<number[]>([]);
  const [shakeTile, setShakeTile] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [kbCursor, setKbCursor] = useState<number | null>(null);

  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedStagesRef = useRef<Set<EchoDifficulty>>(new Set());
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const currentStage = useMemo(
    () => getEchoStage(puzzle, difficulty),
    [puzzle, difficulty]
  );
  const curProgress = stagesState[difficulty];
  const { visited, mistakes, baseSeconds, penaltySeconds } = curProgress;

  const complete = visited.length >= ECHO_GRID_SIZE;
  const currentModeSolved = complete;
  const easyComplete = stagesState.easy.visited.length >= ECHO_GRID_SIZE;
  const hardComplete = stagesState.hard.visited.length >= ECHO_GRID_SIZE;
  const activeTileIndex = complete
    ? -1
    : (visited[visited.length - 1] ?? ECHO_START_INDEX);
  const stepNumber = Math.min(visited.length - 1, ECHO_GRID_SIZE - 1);
  const totalElapsed = baseSeconds + penaltySeconds;
  const hasSavedProgress =
    visited.length > 1 || mistakes > 0 || totalElapsed > 0;
  const completedAlready =
    isDateCompleted("eightfold-echo", dateKey) || easyComplete || hardComplete;

  const switchDifficulty = useCallback((nextDiff: EchoDifficulty) => {
    playTapSfx();
    setDifficulty(nextDiff);
    setHintCandidates([]);
    setShakeTile(null);
    setToastMsg(null);
    setKbCursor(null);
  }, []);

  // Count-up stopwatch starts ONLY after splash screen is dismissed (Q22) on the active unsolved stage,
  // and pauses automatically whenever tab is hidden or any dialog is open.
  useEffect(() => {
    if (!splashDismissed || complete) return;
    const id = setInterval(() => {
      if (isGameTimerExternallyPaused()) return;
      setStagesState((prev) => ({
        ...prev,
        [difficulty]: {
          ...prev[difficulty],
          baseSeconds: prev[difficulty].baseSeconds + 1,
        },
      }));
    }, 1000);
    return () => clearInterval(id);
  }, [splashDismissed, complete, difficulty]);

  useEffect(
    () => () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  // Persist progress per date + puzzle hash across both Easy and Hard stages.
  useEffect(() => {
    saveGameProgress<SavedEchoProgress>("eightfold-echo", dateKey, {
      puzzleId: puzzle.id,
      puzzleHash,
      activeDifficulty: difficulty,
      stages: stagesState,
      visited: stagesState[difficulty].visited,
      mistakes: stagesState[difficulty].mistakes,
      baseSeconds: stagesState[difficulty].baseSeconds,
      penaltySeconds: stagesState[difficulty].penaltySeconds,
    });
  }, [dateKey, puzzle.id, puzzleHash, difficulty, stagesState]);

  // Record daily win when EITHER Easy or Hard is solved, and track per-stage star stats.
  useEffect(() => {
    if (!complete || recordedStagesRef.current.has(difficulty)) return;
    recordedStagesRef.current.add(difficulty);
    const recordedTime = Math.max(1, totalElapsed);
    const stars = echoStars(mistakes, totalElapsed);
    if (!isDateCompleted("eightfold-echo", dateKey)) {
      const updated = recordGameWin("eightfold-echo", dateKey, recordedTime);
      const dist = { ...updated.distribution };
      dist[`stars_${stars}`] = (dist[`stars_${stars}`] ?? 0) + 1;
      dist[`solved_${difficulty}`] = (dist[`solved_${difficulty}`] ?? 0) + 1;
      if (mistakes === 0) {
        dist.zero_mistakes = (dist.zero_mistakes ?? 0) + 1;
      }
      setGameStats("eightfold-echo", {
        ...getGameStats("eightfold-echo"),
        distribution: dist,
      });
    } else {
      const existing = getGameStats("eightfold-echo");
      const dist = { ...existing.distribution };
      const stageFlag = `date_${dateKey}_${difficulty}`;
      if (!dist[stageFlag]) {
        dist[stageFlag] = 1;
        dist[`solved_${difficulty}`] = (dist[`solved_${difficulty}`] ?? 0) + 1;
        setGameStats("eightfold-echo", { ...existing, distribution: dist });
      }
    }
  }, [complete, dateKey, difficulty, mistakes, totalElapsed]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 1500);
  }, []);

  const handleTileTap = useCallback(
    (gridIndex: number) => {
      if (!splashDismissed || complete) return;
      if (visited.includes(gridIndex)) return;

      const expectedNext = currentStage.solution[visited.length];
      if (gridIndex === expectedNext) {
        const nextLen = visited.length + 1;
        playSnapSfx(visited.length);
        if (nextLen >= ECHO_GRID_SIZE) {
          playWinChimeSfx();
        }
        setStagesState((prev) => ({
          ...prev,
          [difficulty]: {
            ...prev[difficulty],
            visited: [...prev[difficulty].visited, gridIndex],
          },
        }));
        setHintCandidates([]);
        setToastMsg(null);
      } else {
        playErrorSfx();
        setStagesState((prev) => ({
          ...prev,
          [difficulty]: {
            ...prev[difficulty],
            mistakes: prev[difficulty].mistakes + 1,
            penaltySeconds:
              prev[difficulty].penaltySeconds + WRONG_PENALTY_SECONDS,
          },
        }));
        setShakeTile(gridIndex);
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
        shakeTimerRef.current = setTimeout(() => setShakeTile(null), 450);
        showToast(`Not quite! +${WRONG_PENALTY_SECONDS}s`);
      }
    },
    [
      splashDismissed,
      complete,
      visited,
      currentStage.solution,
      difficulty,
      showToast,
    ]
  );

  // Desktop keyboard navigation: Arrow keys move cursor across the 3×3 grid (Enter/Space selects),
  // and 1–9 number keys directly select tiles 1..9 when no modal/input is focused.
  useEffect(() => {
    if (!splashDismissed || complete) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isGameTimerExternallyPaused()) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const idx = Number(e.key) - 1;
        setKbCursor(idx);
        const btn = tileRefs.current[idx];
        if (btn && !btn.disabled) {
          btn.focus();
        }
        if (!visited.includes(idx)) {
          handleTileTap(idx);
        }
        return;
      }

      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        e.preventDefault();
        const base =
          kbCursor ?? (activeTileIndex >= 0 ? activeTileIndex : ECHO_START_INDEX);
        let row = Math.floor(base / 3);
        let col = base % 3;
        if (e.key === "ArrowUp") row = (row + 2) % 3;
        if (e.key === "ArrowDown") row = (row + 1) % 3;
        if (e.key === "ArrowLeft") col = (col + 2) % 3;
        if (e.key === "ArrowRight") col = (col + 1) % 3;
        const nextIdx = row * 3 + col;
        setKbCursor(nextIdx);
        playTapSfx(0.95);
        const nextBtn = tileRefs.current[nextIdx];
        if (nextBtn && !nextBtn.disabled) {
          nextBtn.focus();
        } else if (
          document.activeElement instanceof HTMLElement &&
          tileRefs.current.includes(document.activeElement as HTMLButtonElement)
        ) {
          document.activeElement.blur();
        }
        return;
      }

      if (
        (e.key === "Enter" || e.key === " ") &&
        kbCursor !== null &&
        document.activeElement !== tileRefs.current[kbCursor]
      ) {
        if (!visited.includes(kbCursor)) {
          e.preventDefault();
          handleTileTap(kbCursor);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [splashDismissed, complete, kbCursor, activeTileIndex, visited, handleTileTap]);

  const confirmHint = useCallback(() => {
    setHintConfirmOpen(false);
    if (complete) return;
    playTapSfx(1.15);
    setStagesState((prev) => ({
      ...prev,
      [difficulty]: {
        ...prev[difficulty],
        penaltySeconds: prev[difficulty].penaltySeconds + HINT_PENALTY_SECONDS,
      },
    }));
    const candidates = pickEchoHintCandidates(
      currentStage,
      visited,
      `${puzzle.id}:${difficulty}`
    );
    setHintCandidates(candidates);
    showToast(`Hint active! +${HINT_PENALTY_SECONDS}s`);
  }, [complete, difficulty, currentStage, visited, puzzle.id, showToast]);

  const chainRules = useMemo(
    () => buildEchoChainRules(currentStage),
    [currentStage]
  );
  const stars = echoStars(mistakes, totalElapsed);
  const victorySummary = formatEchoVictorySummary(totalElapsed, mistakes, stars);
  const shareText = useMemo(
    () =>
      buildEchoShareText({
        puzzleNumber: puzzle.puzzleNumber,
        elapsedSeconds: totalElapsed,
        mistakes,
        solution: currentStage.solution,
        difficulty,
      }),
    [puzzle.puzzleNumber, currentStage.solution, totalElapsed, mistakes, difficulty]
  );
  const shareUrl =
    dateKey !== liveTodayKey
      ? `https://21games.ai/games/eightfold-echo?date=${dateKey}`
      : "https://21games.ai/games/eightfold-echo";

  const renderDifficultyTabs = (compact = false) => (
    <div
      className={cn(
        "inline-grid grid-cols-2 gap-1 rounded-xl border-2 border-black bg-neutral-100 p-1",
        compact ? "w-full max-w-[min(92vw,380px)]" : "w-full"
      )}
      role="tablist"
      aria-label="Eightfold Echo difficulty"
      data-testid="echo-difficulty-tabs"
    >
      {ECHO_DIFFICULTIES.map((diff) => {
        const isSelected = difficulty === diff;
        const isSolved = stagesState[diff].visited.length >= ECHO_GRID_SIZE;
        return (
          <button
            key={diff}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => switchDifficulty(diff)}
            data-testid={`echo-diff-${diff}`}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all motion-reduce:transition-none flex items-center justify-center gap-1.5 cursor-pointer",
              isSelected
                ? "bg-black text-white shadow-sm"
                : "text-neutral-700 hover:bg-white/80"
            )}
          >
            <span>{DIFFICULTY_META[diff].label}</span>
            <span
              className={cn(
                "text-[10px] font-medium hidden sm:inline",
                isSelected ? "text-neutral-300" : "text-neutral-500"
              )}
            >
              · {DIFFICULTY_META[diff].subtitle}
            </span>
            {isSolved && (
              <span
                className={cn(
                  "inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-black",
                  isSelected
                    ? "bg-[#2ECC71] text-black"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-400"
                )}
                aria-label={`${DIFFICULTY_META[diff].label} solved`}
              >
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  if (!splashDismissed) {
    return (
      <GameShell
        gameSlug="eightfold-echo"
        gameTitle="Eightfold Echo"
        puzzleNumber={puzzle.puzzleNumber}
        dateKey={dateKey}
        author={puzzle.author}
      >
        <GameSplashScreen
          gameSlug="eightfold-echo"
          gameTitle="Eightfold Echo"
          tagline="Follow the single-change shape echo from the emerald center across all 9 tiles."
          theme={puzzle.title}
          author={puzzle.author}
          puzzleNumber={puzzle.puzzleNumber}
          dateKey={dateKey}
          showCreate={false}
          isCompletedToday={complete || completedAlready}
          hasSavedProgress={hasSavedProgress && !complete}
          onPlay={() => {
            playTapSfx();
            setSplashDismissed(true);
          }}
        >
          <div className="space-y-1.5">
            {renderDifficultyTabs(false)}
            <p className="text-[11px] text-neutral-500 font-medium">
              {difficulty === "easy"
                ? "Easy: 1 direct match per step + subtle 2-change decoys. Solving either counts for your streak!"
                : "Hard: Full shape vocabulary with multi-step lookahead."}
            </p>
          </div>
        </GameSplashScreen>
      </GameShell>
    );
  }

  const otherDifficulty: EchoDifficulty = difficulty === "easy" ? "hard" : "easy";
  const otherSolved = stagesState[otherDifficulty].visited.length >= ECHO_GRID_SIZE;

  return (
    <GameShell
      gameSlug="eightfold-echo"
      gameTitle="Eightfold Echo"
      puzzleNumber={puzzle.puzzleNumber}
      dateKey={dateKey}
      author={puzzle.author}
    >
      <WinFlourish active={currentModeSolved} />
      <div className="max-w-lg mx-auto px-2 sm:px-4 py-1 sm:py-2 flex flex-col items-center gap-2 sm:gap-2.5">
        {/* Easy / Hard Difficulty Switcher */}
        {renderDifficultyTabs(true)}

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
              onClick={() => {
                playTapSfx();
                setHintConfirmOpen(true);
              }}
              className="h-7 px-2 text-[11px] sm:text-xs font-bold border-2 border-black bg-[#daa8d0]/25 hover:bg-[#daa8d0]/45"
              data-testid="echo-hint-button"
            >
              <Lightbulb className="h-3.5 w-3.5 mr-1" />
              Hint (+15s)
            </Button>
          )}
        </div>

        {/* Toast / instruction micro-banner (fixed height so layout never shifts) */}
        <div className="min-h-[1.5rem] flex items-center justify-center px-1" aria-live="polite">
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
              {difficulty === "easy" ? (
                <>
                  Tap the unvisited tile that changes <strong>exactly 1 attribute</strong> from the dotted tile.
                </>
              ) : (
                <>
                  Tap the <strong>1-change</strong> tile that links all 9 tiles without stranding one.
                </>
              )}
            </p>
          ) : (
            <p className="text-xs font-bold text-emerald-700">
              {DIFFICULTY_META[difficulty].label} Echo chain complete!
            </p>
          )}
        </div>

        {/* 3×3 Square Shape Grid — overflow-proof height derived directly from 3 square row tracks */}
        <div
          className="w-full max-w-[min(88vw,360px)] sm:max-w-[380px] grid grid-cols-3 gap-2 sm:gap-2.5 p-2.5 rounded-2xl border-2 border-black bg-neutral-50 shadow-[4px_4px_0px_#000]"
          role="group"
          aria-label="Eightfold Echo 3 by 3 tile grid"
          data-testid="echo-grid"
        >
          {currentStage.tiles.map((tile, idx) => {
            const signatureColor = ECHO_POSITION_COLORS[idx]!;
            const visitedOrder = visited.indexOf(idx);
            const isActive = idx === activeTileIndex && !complete;
            const isCompletedTile =
              visitedOrder >= 0 && (complete || visitedOrder < visited.length - 1);
            const isHintPulse = hintCandidates.includes(idx) && !isCompletedTile && !isActive;
            const isShaking = shakeTile === idx;
            const isKbFocused = kbCursor === idx && !complete;
            const rowNum = Math.floor(idx / 3) + 1;
            const colNum = (idx % 3) + 1;

            return (
              <button
                key={idx}
                ref={(el) => {
                  tileRefs.current[idx] = el;
                }}
                type="button"
                disabled={complete || isCompletedTile || isActive}
                aria-pressed={isCompletedTile || isActive}
                onFocus={() => setKbCursor(idx)}
                onClick={() => handleTileTap(idx)}
                aria-label={
                  isCompletedTile
                    ? `Tile ${idx + 1} (row ${rowNum}, column ${colNum}): Completed step ${visitedOrder}`
                    : isActive
                    ? `Tile ${idx + 1} (row ${rowNum}, column ${colNum}): Current active tile, ${describeEchoTile(tile)}`
                    : `Tile ${idx + 1} (row ${rowNum}, column ${colNum}): Unvisited tile, ${describeEchoTile(tile)}`
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
                  "relative w-full aspect-square min-w-0 min-h-0 overflow-hidden rounded-xl flex items-center justify-center p-2 sm:p-2.5 transition-all motion-reduce:transition-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-black",
                  !isCompletedTile &&
                    !isActive &&
                    !complete &&
                    "hover:border-black hover:-translate-y-0.5 active:translate-y-0 cursor-pointer",
                  isActive && "shadow-[0_0_0_3px_rgba(0,0,0,0.06)]",
                  isKbFocused && "ring-2 ring-black ring-offset-1",
                  isHintPulse && "animate-pulse motion-reduce:animate-none ring-4 ring-amber-400",
                  isShaking && "animate-bounce motion-reduce:animate-none bg-red-50"
                )}
              >
                {/* Q21: Completed tiles fill 100% solid in their signature color (NO step badges & inner shape hidden). */}
                {!isCompletedTile && (
                  <div className="w-full h-full flex items-center justify-center overflow-hidden">
                    <EchoTileSvg
                      tile={tile}
                      clipKey={`board-${puzzle.id}-${difficulty}-${idx}`}
                    />
                  </div>
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
                Eightfold Echo #{puzzle.puzzleNumber} · {DIFFICULTY_META[difficulty].label}
              </p>
              <h2
                className="font-headline font-black text-lg sm:text-xl text-neutral-900"
                data-testid="echo-victory-summary"
              >
                {victorySummary}
              </h2>
              <p className="text-xs text-neutral-500">“{puzzle.title}”</p>
            </div>

            {!otherSolved && (
              <Button
                type="button"
                onClick={() => switchDifficulty(otherDifficulty)}
                className="w-full bg-[#daa8d0] hover:bg-[#c993be] text-black border-2 border-black font-bold"
                data-testid="echo-play-other-difficulty"
              >
                Next: Play {DIFFICULTY_META[otherDifficulty].label} Board
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            )}

            <ResultShareButtons
              title={`Eightfold Echo #${puzzle.puzzleNumber} (${DIFFICULTY_META[difficulty].label})`}
              text={shareText}
              url={shareUrl}
            />

            {/* Ordered 0 → 8 Visual Chain */}
            <div className="space-y-2 pt-1 border-t border-neutral-200">
              <p className="text-xs font-extrabold uppercase tracking-wider text-neutral-600">
                0 → 8 Echo Chain &amp; Step Rules ({DIFFICULTY_META[difficulty].label})
              </p>
              <div
                className="grid grid-cols-9 gap-1"
                data-testid="echo-chain-strip"
              >
                {currentStage.solution.map((pos, stepIdx) => (
                  <div
                    key={pos}
                    className="flex flex-col items-center gap-0.5"
                    title={`Step ${stepIdx}: ${describeEchoTile(currentStage.tiles[pos]!)}`}
                  >
                    <div
                      className="w-full aspect-square rounded-lg p-1 bg-white overflow-hidden"
                      style={{
                        border: `2.5px solid ${ECHO_POSITION_COLORS[pos]}`,
                      }}
                    >
                      <EchoTileSvg
                        tile={currentStage.tiles[pos]!}
                        clipKey={`chain-${puzzle.id}-${difficulty}-${stepIdx}`}
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
                          ECHO_POSITION_COLORS[currentStage.solution[idx + 1]!],
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
