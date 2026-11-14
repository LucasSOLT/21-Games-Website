"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Calendar,
  Check,
  ChevronRight,
  RotateCcw,
  Trophy,
  Undo2,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  MOVE_TWO_DIFFICULTIES,
  MOVE_TWO_DIFFICULTY_META,
  buildMoveTwoShareText,
  computeMoveTwoStars,
  getInitialBlockState,
  isBridgeOpen,
  isMoveTwoPuzzle,
  stepBloxorzBlock,
  type MoveTwoBlockState,
  type MoveTwoDifficulty,
  type MoveTwoDifficultyScoreSummary,
  type MoveTwoDirection,
  type MoveTwoPuzzle,
} from "@/data/puzzles/move-2";
import {
  isMoveTwoMuted,
  playMoveTwoFallSfx,
  playMoveTwoFragileCrackSfx,
  playMoveTwoHoleDropSfx,
  playMoveTwoRollSfx,
  playMoveTwoSwitchSfx,
  playMoveTwoVictorySfx,
  setMoveTwoMuted,
} from "@/lib/move-two-audio";
import type { CuboidAnimationPose } from "@/lib/move-two-renderer-3d";
import { MoveTwoBloxorzCanvas } from "@/components/games/move-two-canvas";
import { getDailyPuzzleForGame, getLocalDateKey } from "@/lib/daily-engine";
import {
  fetchRemoteOverrideForGame,
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
import { ResultShareButtons } from "@/components/games/result-share-buttons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StageHistorySnapshot {
  block: MoveTwoBlockState;
  moves: number;
  falls: number;
}

interface StageRuntimeState {
  block: MoveTwoBlockState;
  moves: number;
  falls: number;
  status: "playing" | "won";
  bestMoves?: number;
}

interface MoveTwoSavedProgressV3 {
  version: 3;
  puzzleId: string;
  puzzleHash: string;
  activeDifficulty: MoveTwoDifficulty;
  stages: Record<MoveTwoDifficulty, StageRuntimeState>;
}

function buildFreshStageStates(
  puzzle: MoveTwoPuzzle
): Record<MoveTwoDifficulty, StageRuntimeState> {
  return {
    easy: {
      block: getInitialBlockState(puzzle.stages.easy),
      moves: 0,
      falls: 0,
      status: "playing",
    },
    medium: {
      block: getInitialBlockState(puzzle.stages.medium),
      moves: 0,
      falls: 0,
      status: "playing",
    },
    hard: {
      block: getInitialBlockState(puzzle.stages.hard),
      moves: 0,
      falls: 0,
      status: "playing",
    },
  };
}

function isValidSavedProgressV3(
  val: unknown,
  expectedHash: string
): val is MoveTwoSavedProgressV3 {
  if (!val || typeof val !== "object") return false;
  const v = val as Record<string, unknown>;
  if (v.version !== 3 || v.puzzleHash !== expectedHash) return false;
  if (!MOVE_TWO_DIFFICULTIES.includes(v.activeDifficulty as MoveTwoDifficulty)) {
    return false;
  }
  const st = v.stages as Record<string, StageRuntimeState> | undefined;
  if (!st) return false;
  return MOVE_TWO_DIFFICULTIES.every((d) => {
    const entry = st[d];
    return Boolean(
      entry &&
        entry.block &&
        typeof entry.block.r === "number" &&
        typeof entry.block.c === "number" &&
        typeof entry.block.bridgeMask === "number" &&
        typeof entry.moves === "number" &&
        typeof entry.falls === "number"
    );
  });
}

function recordMoveTwoCompletion(
  dateKey: string,
  moves: number,
  par: number,
  stars: 1 | 2 | 3
): void {
  const before = getGameStats("move-2");
  const diff = moves - par;
  const encodedDiff = Math.max(0, diff + 100);

  if (before.completedDates.includes(dateKey)) {
    // Already credited today's streak — still allow upgrading Best vs. Par if better!
    const prevBest = before.distribution.best_over_par_plus_100;
    if (prevBest === undefined || encodedDiff < prevBest) {
      before.distribution.best_over_par_plus_100 = encodedDiff;
      setGameStats("move-2", before);
    }
    return;
  }

  const stats = recordGameWin("move-2", dateKey, 0);
  const prevBestDiff = stats.distribution.best_over_par_plus_100;
  stats.distribution.best_over_par_plus_100 =
    prevBestDiff === undefined
      ? encodedDiff
      : Math.min(prevBestDiff, encodedDiff);
  stats.distribution.moves_total = (stats.distribution.moves_total ?? 0) + moves;
  stats.distribution.par_total = (stats.distribution.par_total ?? 0) + par;
  if (stars === 3) {
    stats.distribution.par_stars_3 = (stats.distribution.par_stars_3 ?? 0) + 1;
  }
  stats.distribution[`stars_${stars}`] =
    (stats.distribution[`stars_${stars}`] ?? 0) + 1;
  setGameStats("move-2", stats);
}

export function MoveTwoGame() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const [liveTodayKey, setLiveTodayKey] = useState<string>(() =>
    getLocalDateKey()
  );

  useEffect(() => {
    if (dateParam) return;
    const onCheck = () => {
      const curr = getLocalDateKey();
      setLiveTodayKey((prev) => (prev !== curr ? curr : prev));
    };
    const id = setInterval(onCheck, 30_000);
    window.addEventListener("focus", onCheck);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onCheck);
    };
  }, [dateParam]);

  const activeDateKey = dateParam || liveTodayKey;
  return <MoveTwoBoard key={activeDateKey} activeDateKey={activeDateKey} />;
}

function MoveTwoBoard({ activeDateKey }: { activeDateKey: string }) {
  const initialPuzzle = useMemo<MoveTwoPuzzle>(() => {
    const resolved = getDailyPuzzleForGame<MoveTwoPuzzle>(
      "move-2",
      activeDateKey,
      getAdminOverridesForGame("move-2")
    );
    if (!resolved) {
      throw new Error(`Unable to resolve Move Two puzzle for ${activeDateKey}`);
    }
    return resolved.puzzle;
  }, [activeDateKey]);

  const [puzzle, setPuzzle] = useState<MoveTwoPuzzle>(initialPuzzle);
  const puzzleHash = useMemo(() => computePuzzleContentHash(puzzle), [puzzle]);

  const initialSaved = useMemo(() => {
    const raw = getGameProgress<Partial<MoveTwoSavedProgressV3>>(
      "move-2",
      activeDateKey,
      initialPuzzle.id
    );
    const hash = computePuzzleContentHash(initialPuzzle);
    if (!isValidSavedProgressV3(raw, hash)) {
      return null;
    }
    return raw;
  }, [activeDateKey, initialPuzzle]);

  const [splashDismissed, setSplashDismissed] = useState<boolean>(false);
  const [activeDifficulty, setActiveDifficulty] = useState<MoveTwoDifficulty>(
    () => initialSaved?.activeDifficulty ?? "easy"
  );
  const [stageStates, setStageStates] = useState<
    Record<MoveTwoDifficulty, StageRuntimeState>
  >(() => initialSaved?.stages ?? buildFreshStageStates(initialPuzzle));
  const [historyByDiff, setHistoryByDiff] = useState<
    Record<MoveTwoDifficulty, StageHistorySnapshot[]>
  >({
    easy: [],
    medium: [],
    hard: [],
  });

  const [feedback, setFeedback] = useState<{
    tone: "neutral" | "warn" | "info";
    message: string;
  } | null>(null);
  const [muted, setMuted] = useState<boolean>(() => isMoveTwoMuted());

  // Live 60fps animation pose & broken fragile tile indicator
  const [animPose, setAnimPose] = useState<CuboidAnimationPose | null>(null);
  const [brokenFragileCell, setBrokenFragileCell] = useState<{
    r: number;
    c: number;
    progress: number;
  } | null>(null);

  const rafRef = useRef<number | null>(null);
  const animKindRef = useRef<
    "idle" | "rolling" | "falling" | "spawning" | "winning"
  >("idle");
  const queuedDirRef = useRef<MoveTwoDirection | null>(null);
  const performMoveRef = useRef<(dir: MoveTwoDirection) => void>(() => {});

  const cancelActiveRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    animKindRef.current = "idle";
    queuedDirRef.current = null;
    setAnimPose(null);
    setBrokenFragileCell(null);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Remote override check (Supabase published puzzles)
  useEffect(() => {
    let cancelled = false;
    void fetchRemoteOverrideForGame("move-2", activeDateKey).then(
      (remote) => {
        if (cancelled || !remote || !isMoveTwoPuzzle(remote)) return;
        const nextHash = computePuzzleContentHash(remote);
        if (nextHash === computePuzzleContentHash(puzzle)) return;
        cancelActiveRaf();
        setPuzzle(remote);
        setStageStates(buildFreshStageStates(remote));
        setHistoryByDiff({ easy: [], medium: [], hard: [] });
        setFeedback(null);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [activeDateKey, puzzle, cancelActiveRaf]);

  // Persist v3 progress to localStorage whenever state changes
  useEffect(() => {
    const hasAnyActivity = MOVE_TWO_DIFFICULTIES.some(
      (d) => stageStates[d].moves > 0 || stageStates[d].status === "won"
    );
    if (!hasAnyActivity) return;

    const payload: MoveTwoSavedProgressV3 = {
      version: 3,
      puzzleId: puzzle.id,
      puzzleHash,
      activeDifficulty,
      stages: stageStates,
    };
    saveGameProgress("move-2", activeDateKey, payload);
  }, [activeDateKey, puzzle.id, puzzleHash, activeDifficulty, stageStates]);

  const currentStage = puzzle.stages[activeDifficulty];
  const currentState = stageStates[activeDifficulty];

  const runSpawnDropAnimation = useCallback(
    (spawnBlock: MoveTwoBlockState) => {
      animKindRef.current = "spawning";
      const startTs = performance.now();
      const duration = 165;

      const tick = (now: number) => {
        const t = Math.min(1, (now - startTs) / duration);
        const dropZ = (1 - t) * (1 - t) * 0.95;
        setAnimPose({
          mode: "idle",
          state: spawnBlock,
          dropZ,
        });
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
          animKindRef.current = "idle";
          setAnimPose(null);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    []
  );

  const performMove = useCallback(
    (dir: MoveTwoDirection) => {
      const diff = activeDifficulty;
      const stage = puzzle.stages[diff];
      const runtime = stageStates[diff];
      if (runtime.status === "won") return;

      // 1-deep input buffer while a normal 230ms roll is mid-flight
      if (animKindRef.current === "rolling") {
        queuedDirRef.current = dir;
        return;
      }
      if (animKindRef.current !== "idle") {
        return;
      }

      const outcome = stepBloxorzBlock(stage, runtime.block, dir);

      // Push snapshot for Undo
      setHistoryByDiff((prev) => ({
        ...prev,
        [diff]: [
          ...prev[diff],
          {
            block: runtime.block,
            moves: runtime.moves,
            falls: runtime.falls,
          },
        ],
      }));

      if (outcome.kind === "moved") {
        playMoveTwoRollSfx(outcome.next.posture);
        if (outcome.triggeredSwitch) {
          const bridgeOpenNow = isBridgeOpen(
            stage,
            outcome.next.bridgeMask,
            outcome.triggeredSwitch.bridgeId
          );
          playMoveTwoSwitchSfx(outcome.triggeredSwitch.kind, bridgeOpenNow);
          setFeedback({
            tone: "info",
            message: `Bridge ${outcome.triggeredSwitch.bridgeId} ${
              bridgeOpenNow ? "extended!" : "retracted."
            }`,
          });
        } else {
          setFeedback(null);
        }

        animKindRef.current = "rolling";
        const fromBlock = runtime.block;
        const startTs = performance.now();
        const duration = 225;

        const tick = (now: number) => {
          const t = Math.min(1, (now - startTs) / duration);
          setAnimPose({
            mode: "rolling",
            from: fromBlock,
            dir,
            progress: t,
          });
          if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            rafRef.current = null;
            animKindRef.current = "idle";
            setAnimPose(null);
            setStageStates((prev) => ({
              ...prev,
              [diff]: {
                ...prev[diff],
                block: outcome.next,
                moves: prev[diff].moves + 1,
              },
            }));

            const queued = queuedDirRef.current;
            queuedDirRef.current = null;
            if (queued) {
              requestAnimationFrame(() => performMoveRef.current(queued));
            }
          }
        };

        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (outcome.kind === "fall_void" || outcome.kind === "fall_bridge") {
        playMoveTwoRollSfx(outcome.attempted.posture);
        playMoveTwoFallSfx();
        setFeedback({
          tone: "warn",
          message:
            outcome.kind === "fall_bridge"
              ? `Bridge ${outcome.bridgeId} is closed! Trigger its switch first.`
              : "Tipped off the island edge! Resetting to Start.",
        });

        animKindRef.current = "falling";
        queuedDirRef.current = null;
        const fromBlock = runtime.block;
        const startTs = performance.now();
        const duration = 480;

        const tick = (now: number) => {
          const t = Math.min(1, (now - startTs) / duration);
          setAnimPose({
            mode: "falling_edge",
            from: fromBlock,
            dir,
            progress: t,
            overhangDir: dir,
          });
          if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            const resetBlock = getInitialBlockState(stage);
            setStageStates((prev) => ({
              ...prev,
              [diff]: {
                ...prev[diff],
                block: resetBlock,
                moves: prev[diff].moves + 1,
                falls: prev[diff].falls + 1,
              },
            }));
            runSpawnDropAnimation(resetBlock);
          }
        };

        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (outcome.kind === "fall_fragile") {
        playMoveTwoFragileCrackSfx();
        setFeedback({
          tone: "warn",
          message:
            "Fragile orange tile broke! Roll flat across orange tiles instead of standing upright.",
        });

        animKindRef.current = "falling";
        queuedDirRef.current = null;
        const fromBlock = runtime.block;
        const startTs = performance.now();
        const duration = 490;

        const tick = (now: number) => {
          const t = Math.min(1, (now - startTs) / duration);
          setAnimPose({
            mode: "breaking_fragile",
            from: fromBlock,
            dir,
            progress: t,
            landed: outcome.attempted,
          });
          if (t > 0.42) {
            setBrokenFragileCell({
              r: outcome.brokenCell.r,
              c: outcome.brokenCell.c,
              progress: (t - 0.42) / 0.58,
            });
          }
          if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            setBrokenFragileCell(null);
            const resetBlock = getInitialBlockState(stage);
            setStageStates((prev) => ({
              ...prev,
              [diff]: {
                ...prev[diff],
                block: resetBlock,
                moves: prev[diff].moves + 1,
                falls: prev[diff].falls + 1,
              },
            }));
            runSpawnDropAnimation(resetBlock);
          }
        };

        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // outcome.kind === "won"
      playMoveTwoRollSfx("UPRIGHT");
      playMoveTwoHoleDropSfx();
      setFeedback(null);

      animKindRef.current = "winning";
      queuedDirRef.current = null;
      const fromBlock = runtime.block;
      const finalMoves = runtime.moves + 1;
      const stars = computeMoveTwoStars(finalMoves, stage.par);
      const startTs = performance.now();
      const duration = 460;

      const tick = (now: number) => {
        const t = Math.min(1, (now - startTs) / duration);
        setAnimPose({
          mode: "dropping_goal",
          from: fromBlock,
          dir,
          progress: t,
          goal: stage.goal,
        });
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
          animKindRef.current = "idle";
          setAnimPose(null);
          playMoveTwoVictorySfx();
          recordMoveTwoCompletion(activeDateKey, finalMoves, stage.par, stars);
          setStageStates((prev) => {
            const prevBest = prev[diff].bestMoves;
            const nextBest =
              prevBest === undefined ? finalMoves : Math.min(prevBest, finalMoves);
            return {
              ...prev,
              [diff]: {
                ...prev[diff],
                block: outcome.next,
                moves: finalMoves,
                status: "won",
                bestMoves: nextBest,
              },
            };
          });
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [activeDifficulty, puzzle.stages, stageStates, activeDateKey, runSpawnDropAnimation]
  );

  useEffect(() => {
    performMoveRef.current = performMove;
  }, [performMove]);

  // Keyboard controls (Arrow keys + WASD)
  useEffect(() => {
    if (!splashDismissed || currentState.status === "won") return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      let dir: MoveTwoDirection | null = null;
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          dir = "up";
          break;
        case "ArrowDown":
        case "s":
        case "S":
          dir = "down";
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          dir = "left";
          break;
        case "ArrowRight":
        case "d":
        case "D":
          dir = "right";
          break;
      }
      if (dir) {
        e.preventDefault();
        performMoveRef.current(dir);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [splashDismissed, currentState.status]);

  const handleSelectDifficulty = (diff: MoveTwoDifficulty) => {
    if (diff === activeDifficulty) return;
    cancelActiveRaf();
    setFeedback(null);
    setActiveDifficulty(diff);
  };

  const handleUndo = () => {
    if (currentState.status === "won") return;
    const stack = historyByDiff[activeDifficulty];
    if (stack.length === 0) return;
    cancelActiveRaf();
    const last = stack[stack.length - 1]!;
    setHistoryByDiff((prev) => ({
      ...prev,
      [activeDifficulty]: prev[activeDifficulty].slice(0, -1),
    }));
    setStageStates((prev) => ({
      ...prev,
      [activeDifficulty]: {
        ...prev[activeDifficulty],
        block: last.block,
        moves: last.moves,
        falls: last.falls,
        status: "playing",
      },
    }));
    setFeedback(null);
  };

  const handleResetStage = () => {
    cancelActiveRaf();
    const resetBlock = getInitialBlockState(currentStage);
    if (currentState.status !== "won") {
      setHistoryByDiff((prev) => ({
        ...prev,
        [activeDifficulty]: [
          ...prev[activeDifficulty],
          {
            block: currentState.block,
            moves: currentState.moves,
            falls: currentState.falls,
          },
        ],
      }));
    } else {
      setHistoryByDiff((prev) => ({ ...prev, [activeDifficulty]: [] }));
    }
    setStageStates((prev) => ({
      ...prev,
      [activeDifficulty]: {
        ...prev[activeDifficulty],
        block: resetBlock,
        moves: prev[activeDifficulty].status === "won" ? 0 : prev[activeDifficulty].moves,
        falls: prev[activeDifficulty].status === "won" ? 0 : prev[activeDifficulty].falls,
        status: "playing",
      },
    }));
    setFeedback(null);
    runSpawnDropAnimation(resetBlock);
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMoveTwoMuted(next);
    setMuted(next);
  };

  const effectivePose: CuboidAnimationPose = animPose ?? {
    mode: "idle",
    state: currentState.block,
  };

  const anyWonToday =
    MOVE_TWO_DIFFICULTIES.some((d) => stageStates[d].status === "won") ||
    isDateCompleted("move-2", activeDateKey);

  const hasSavedMoves = MOVE_TWO_DIFFICULTIES.some(
    (d) => stageStates[d].moves > 0
  );

  const solvedResultsMap = useMemo(() => {
    const map: Partial<Record<MoveTwoDifficulty, MoveTwoDifficultyScoreSummary>> =
      {};
    for (const d of MOVE_TWO_DIFFICULTIES) {
      const st = stageStates[d];
      const movesUsed =
        st.status === "won" ? st.moves : st.bestMoves;
      if (movesUsed !== undefined) {
        const par = puzzle.stages[d].par;
        map[d] = {
          moves: movesUsed,
          par,
          stars: computeMoveTwoStars(movesUsed, par),
        };
      }
    }
    return map;
  }, [stageStates, puzzle.stages]);

  const shareText = useMemo(
    () =>
      buildMoveTwoShareText({
        puzzleNumber: puzzle.puzzleNumber,
        title: puzzle.title,
        moves: currentState.moves,
        par: currentStage.par,
        stars: computeMoveTwoStars(currentState.moves, currentStage.par),
        results: solvedResultsMap,
      }),
    [
      puzzle.puzzleNumber,
      puzzle.title,
      currentState.moves,
      currentStage.par,
      solvedResultsMap,
    ]
  );

  const nextUnsolvedDifficulty = useMemo<MoveTwoDifficulty | null>(() => {
    const orderedAfterCurrent: MoveTwoDifficulty[] =
      activeDifficulty === "easy"
        ? ["medium", "hard"]
        : activeDifficulty === "medium"
        ? ["hard", "easy"]
        : ["easy", "medium"];
    for (const d of orderedAfterCurrent) {
      if (stageStates[d].status !== "won" && stageStates[d].bestMoves === undefined) {
        return d;
      }
    }
    return null;
  }, [activeDifficulty, stageStates]);

  if (!splashDismissed) {
    return (
      <GameShell
        gameSlug="move-2"
        gameTitle="Move Two"
        puzzleNumber={puzzle.puzzleNumber}
        dateKey={activeDateKey}
        author={puzzle.author}
      >
        <GameSplashScreen
          gameSlug="move-2"
          gameTitle="Move Two"
          tagline="Roll the 3D 2×1 block across floating islands and drop upright into the green square hole."
          theme={puzzle.title}
          author={puzzle.author}
          puzzleNumber={puzzle.puzzleNumber}
          dateKey={activeDateKey}
          isCompletedToday={
            stageStates[activeDifficulty].status === "won" ||
            (anyWonToday && !hasSavedMoves)
          }
          hasSavedProgress={hasSavedMoves}
          onPlay={() => setSplashDismissed(true)}
        >
          <div
            className="space-y-2 text-left"
            data-testid="move-two-splash-difficulty"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 text-center">
              Choose Board Size
            </p>
            <div className="grid grid-cols-3 gap-2">
              {MOVE_TWO_DIFFICULTIES.map((diff) => {
                const meta = MOVE_TWO_DIFFICULTY_META[diff];
                const st = stageStates[diff];
                const solved = st.status === "won" || st.bestMoves !== undefined;
                const selected = activeDifficulty === diff;
                return (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setActiveDifficulty(diff)}
                    className={cn(
                      "relative rounded-2xl border-2 p-2.5 text-center transition-all cursor-pointer",
                      selected
                        ? "border-black bg-[#F7DA21] text-black shadow-[0_2px_0_#171717]"
                        : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-black"
                    )}
                  >
                    {solved && (
                      <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-[#2ECC71] border border-black flex items-center justify-center text-black">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    )}
                    <div className="font-headline font-black text-xs sm:text-sm">
                      {meta.label}
                    </div>
                    <div className="font-mono text-[11px] font-bold opacity-80">
                      {meta.sizeLabel}
                    </div>
                    <div className="text-[10px] font-medium opacity-75 mt-0.5">
                      Par {puzzle.stages[diff].par}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </GameSplashScreen>
      </GameShell>
    );
  }

  const currentStars = computeMoveTwoStars(
    currentState.moves,
    currentStage.par
  );
  const postureLabel =
    currentState.block.posture === "UPRIGHT"
      ? "Standing 1×1"
      : currentState.block.posture === "FLAT_H"
      ? "Flat 1×2 ↔"
      : "Flat 2×1 ↕";

  return (
    <GameShell
      gameSlug="move-2"
      gameTitle="Move Two"
      puzzleNumber={puzzle.puzzleNumber}
      dateKey={activeDateKey}
      author={puzzle.author}
    >
      <div className="mx-auto max-w-xl w-full px-3 py-3 sm:py-5 space-y-3">
        {/* NYT Sudoku-Style Difficulty Switcher Tabs */}
        <div
          className="grid grid-cols-3 gap-1.5 rounded-2xl border-2 border-black bg-white p-1 shadow-[0_2px_0_#171717]"
          data-testid="move-two-difficulty-tabs"
          role="tablist"
          aria-label="Move Two board difficulty"
        >
          {MOVE_TWO_DIFFICULTIES.map((diff) => {
            const meta = MOVE_TWO_DIFFICULTY_META[diff];
            const st = stageStates[diff];
            const solved = st.status === "won" || st.bestMoves !== undefined;
            const active = activeDifficulty === diff;
            return (
              <button
                key={diff}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`move-two-diff-${diff}`}
                onClick={() => handleSelectDifficulty(diff)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer",
                  active
                    ? "bg-black text-white shadow-sm"
                    : "bg-transparent text-neutral-700 hover:bg-neutral-100"
                )}
              >
                <span>{meta.label}</span>
                <span
                  className={cn(
                    "font-mono text-[11px]",
                    active ? "text-[#F7DA21]" : "text-neutral-500"
                  )}
                >
                  {meta.sizeLabel}
                </span>
                {solved && (
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#2ECC71] text-black border border-black"
                    title={`${meta.label} solved`}
                  >
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Compact Status & Audio Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-black bg-white px-3 py-2 shadow-[0_2px_0_#171717]">
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
            <span className="font-mono font-black text-black">
              Moves: {currentState.moves}
            </span>
            <span className="text-neutral-300">·</span>
            <span className="font-mono font-bold text-neutral-600">
              Par: {currentStage.par}
            </span>
            {currentState.falls > 0 && (
              <>
                <span className="text-neutral-300">·</span>
                <span className="font-mono font-semibold text-orange-700">
                  Falls: {currentState.falls}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="border-black bg-[#FEF9C3] text-black font-mono text-[11px] font-bold px-2 py-0.5"
            >
              {postureLabel}
            </Badge>
            <button
              type="button"
              onClick={handleToggleMute}
              data-testid="move-two-mute-toggle"
              aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
              title={muted ? "Unmute SFX" : "Mute SFX"}
              className="h-7 w-7 rounded-full border border-neutral-300 hover:border-black bg-neutral-50 flex items-center justify-center text-neutral-700 cursor-pointer"
            >
              {muted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            role="status"
            className={cn(
              "rounded-xl border-2 px-3 py-1.5 text-xs font-bold text-center transition-all",
              feedback.tone === "warn"
                ? "border-orange-500 bg-orange-50 text-orange-950"
                : feedback.tone === "info"
                ? "border-blue-500 bg-blue-50 text-blue-950"
                : "border-neutral-300 bg-neutral-50 text-neutral-800"
            )}
          >
            {feedback.message}
          </div>
        )}

        {/* Main 3D Floating Bloxorz Island Canvas */}
        <MoveTwoBloxorzCanvas
          stage={currentStage}
          bridgeMask={currentState.block.bridgeMask}
          pose={effectivePose}
          brokenFragileCell={brokenFragileCell}
          interactive={currentState.status !== "won"}
          onSwipeDirection={performMove}
        />

        {/* Victory Card OR Controls + D-Pad */}
        {currentState.status === "won" ? (
          <div
            className="rounded-3xl border-2 border-black bg-white p-5 space-y-4 shadow-[0_5px_0_#171717] text-center animate-in fade-in zoom-in-95 duration-200"
            data-testid="move-two-victory-card"
          >
            <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-[#2ECC71] px-3 py-1 text-xs font-black text-black">
              <Trophy className="h-3.5 w-3.5" />
              <span>
                {MOVE_TWO_DIFFICULTY_META[activeDifficulty].label} (
                {MOVE_TWO_DIFFICULTY_META[activeDifficulty].sizeLabel}) Cleared!
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="font-headline font-black text-2xl text-black">
                {puzzle.title}
              </h2>
              <p className="text-sm font-semibold text-neutral-700">
                Solved in{" "}
                <span className="font-mono font-black text-black">
                  {currentState.moves}
                </span>{" "}
                moves · Par{" "}
                <span className="font-mono font-bold">{currentStage.par}</span>{" "}
                · {"⭐".repeat(currentStars)}
              </p>
            </div>

            {/* 3-Difficulty Progress Summary */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {MOVE_TWO_DIFFICULTIES.map((diff) => {
                const meta = MOVE_TWO_DIFFICULTY_META[diff];
                const summary = solvedResultsMap[diff];
                return (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => handleSelectDifficulty(diff)}
                    className={cn(
                      "rounded-xl border-2 p-2 text-center transition-all cursor-pointer",
                      summary
                        ? "border-emerald-600 bg-emerald-50/80 text-emerald-950"
                        : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-black"
                    )}
                  >
                    <div className="text-xs font-black">
                      {meta.label} ({meta.sizeLabel})
                    </div>
                    <div className="text-[11px] font-mono font-bold mt-0.5">
                      {summary
                        ? `${summary.moves}m · ${"⭐".repeat(summary.stars)}`
                        : `Par ${puzzle.stages[diff].par}`}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {nextUnsolvedDifficulty && (
                <Button
                  type="button"
                  onClick={() => handleSelectDifficulty(nextUnsolvedDifficulty)}
                  className="rounded-full border-2 border-black bg-[#F7DA21] hover:bg-[#eab308] text-black font-bold shadow-[0_2px_0_#171717]"
                  data-testid="move-two-next-difficulty"
                >
                  Next: Play{" "}
                  {MOVE_TWO_DIFFICULTY_META[nextUnsolvedDifficulty].label} (
                  {MOVE_TWO_DIFFICULTY_META[nextUnsolvedDifficulty].sizeLabel})
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={handleResetStage}
                className="rounded-full border-2 border-black font-bold"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Replay {MOVE_TWO_DIFFICULTY_META[activeDifficulty].sizeLabel}
              </Button>
            </div>

            <div className="pt-1 border-t border-neutral-200">
              <ResultShareButtons
                title={`Move Two #${puzzle.puzzleNumber}`}
                text={shareText}
              />
            </div>

            <div className="pt-1">
              <Link
                href="/games/move-2/archive"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-600 hover:text-black underline underline-offset-4"
              >
                <Calendar className="h-3.5 w-3.5" />
                Browse Move Two Archive
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Tactile D-Pad + Undo / Reset Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-black bg-white p-3 shadow-[0_2px_0_#171717]">
              {/* D-Pad */}
              <div
                className="grid grid-cols-3 gap-1.5 mx-auto sm:mx-0"
                aria-label="Directional roll controls"
              >
                <div />
                <button
                  type="button"
                  onClick={() => performMove("up")}
                  data-testid="move-two-btn-up"
                  aria-label="Roll Up"
                  className="h-10 w-12 rounded-xl border-2 border-black bg-[#FAF9F5] hover:bg-[#F7DA21] active:translate-y-0.5 flex items-center justify-center shadow-[0_2px_0_#171717] cursor-pointer"
                >
                  <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                </button>
                <div />
                <button
                  type="button"
                  onClick={() => performMove("left")}
                  data-testid="move-two-btn-left"
                  aria-label="Roll Left"
                  className="h-10 w-12 rounded-xl border-2 border-black bg-[#FAF9F5] hover:bg-[#F7DA21] active:translate-y-0.5 flex items-center justify-center shadow-[0_2px_0_#171717] cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
                </button>
                <button
                  type="button"
                  onClick={() => performMove("down")}
                  data-testid="move-two-btn-down"
                  aria-label="Roll Down"
                  className="h-10 w-12 rounded-xl border-2 border-black bg-[#FAF9F5] hover:bg-[#F7DA21] active:translate-y-0.5 flex items-center justify-center shadow-[0_2px_0_#171717] cursor-pointer"
                >
                  <ArrowDown className="h-4 w-4 stroke-[2.5]" />
                </button>
                <button
                  type="button"
                  onClick={() => performMove("right")}
                  data-testid="move-two-btn-right"
                  aria-label="Roll Right"
                  className="h-10 w-12 rounded-xl border-2 border-black bg-[#FAF9F5] hover:bg-[#F7DA21] active:translate-y-0.5 flex items-center justify-center shadow-[0_2px_0_#171717] cursor-pointer"
                >
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Undo / Reset / Archive */}
              <div className="flex flex-wrap items-center justify-center gap-2 mx-auto sm:mx-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={historyByDiff[activeDifficulty].length === 0}
                  onClick={handleUndo}
                  data-testid="move-two-undo"
                  className="rounded-xl border-2 border-black font-bold text-xs"
                >
                  <Undo2 className="h-3.5 w-3.5 mr-1" />
                  Undo Move
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetStage}
                  data-testid="move-two-reset"
                  className="rounded-xl border-2 border-black font-bold text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Reset Board
                </Button>
              </div>
            </div>

            {/* Compact NYT Bloxorz Tile Legend */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-xl border border-neutral-200 bg-white/90 px-3 py-2 text-[11px] font-semibold text-neutral-700">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 border border-black bg-[#FB923C] inline-block" />
                <span>Orange: Flat Only</span>
              </span>
              {currentStage.switches.some((s) => s.kind === "soft") && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full border border-black bg-[#2563EB] inline-block" />
                  <span>○ Switch: Any Touch</span>
                </span>
              )}
              {currentStage.switches.some((s) => s.kind === "heavy") && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-mono font-black text-[#6D28D9]">✕</span>
                  <span>Heavy Switch: Upright Only</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 border border-black bg-[#2ECC71] inline-block" />
                <span>Green Hole: Stand 1×1</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}
