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
  Flag,
  RotateCcw,
  Trophy,
  Undo2,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  MOVE_TWO_GRID_SIZE,
  buildMoveTwoShareText,
  computeMoveTwoStars,
  getDominoCells,
  isMoveTwoPuzzle,
  stepMoveTwoDomino,
  type MoveTwoDirection,
  type MoveTwoDominoState,
  type MoveTwoPosture,
  type MoveTwoPuzzle,
  type MoveTwoTarget,
} from "@/data/puzzles/move-2";
import {
  isMoveTwoMuted,
  playMoveTwoHazardSfx,
  playMoveTwoHoleDropSfx,
  playMoveTwoRimBumpSfx,
  playMoveTwoRollSfx,
  playMoveTwoVictorySfx,
  setMoveTwoMuted,
} from "@/lib/move-two-audio";
import { getDailyPuzzleForGame, getLocalDateKey } from "@/lib/daily-engine";
import {
  clearGameProgress,
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

interface MoveHistorySnapshot {
  domino: MoveTwoDominoState;
  moves: number;
  conqueredMax: number;
  faceEntries: Record<number, MoveTwoDominoState>;
}

interface MoveTwoSavedProgress {
  puzzleId: string;
  puzzleHash: string;
  domino: MoveTwoDominoState;
  moves: number;
  conqueredMax: number;
  faceEntries: Record<number, MoveTwoDominoState>;
  status: "playing" | "won";
}

function recordMoveTwoCompletion(
  dateKey: string,
  moves: number,
  par: number,
  stars: 1 | 2 | 3
): void {
  const before = getGameStats("move-2");
  if (before.completedDates.includes(dateKey)) return;
  const stats = recordGameWin("move-2", dateKey, 0);
  const diff = moves - par;
  const prevBestDiff = stats.distribution.best_over_par_plus_100;
  const encodedDiff = Math.max(0, diff + 100);
  stats.distribution.best_over_par_plus_100 =
    prevBestDiff === undefined ? encodedDiff : Math.min(prevBestDiff, encodedDiff);
  stats.distribution.moves_total = (stats.distribution.moves_total ?? 0) + moves;
  stats.distribution.par_total = (stats.distribution.par_total ?? 0) + par;
  if (stars === 3) {
    stats.distribution.par_stars_3 = (stats.distribution.par_stars_3 ?? 0) + 1;
  }
  stats.distribution[`stars_${stars}`] =
    (stats.distribution[`stars_${stars}`] ?? 0) + 1;
  setGameStats("move-2", stats);
}

function formatHoleBadge(posture: MoveTwoPosture, isFinalFace: boolean): string {
  const shape =
    posture === "UPRIGHT" ? "1×1" : posture === "FLAT_H" ? "1×2" : "2×1";
  return isFinalFace ? `GOAL ${shape}` : `HOLE ${shape}`;
}

/**
 * Mini 3D Isometric Cube HUD (Q41):
 * Displays a crisp NYT-styled isometric 3D cube alongside all 6 face indicators (`1 → 6`),
 * highlighting completed faces and the Face 6 green final goal hole.
 */
function IsometricCubeHud({
  activeFace,
  conqueredMax,
  won,
}: {
  activeFace: number;
  conqueredMax: number;
  won: boolean;
}) {
  const topActive = activeFace === 0 || activeFace === 3;
  const leftActive = activeFace === 1 || activeFace === 4;
  const rightActive = activeFace === 2 || activeFace === 5;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-2xl border-2 border-black bg-white px-2.5 py-1.5 shadow-[0_2px_0_#111]"
      data-testid="move-two-cube-hud"
      aria-label={`Cube progress: Face ${activeFace + 1} of 6`}
    >
      <svg
        width="36"
        height="38"
        viewBox="0 0 44 46"
        className="shrink-0"
        aria-hidden="true"
      >
        {/* Top isometric rhombus */}
        <polygon
          points="22,3 41,13 22,23 3,13"
          fill={won ? "#2ECC71" : topActive ? "#F7DA21" : "#F7F7F5"}
          stroke="#111111"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* 5x5 subtle grid lines on top face */}
        <line
          x1="15.6"
          y1="6.3"
          x2="34.6"
          y2="16.3"
          stroke="#111111"
          strokeOpacity="0.2"
          strokeWidth="1"
        />
        <line
          x1="9.3"
          y1="9.6"
          x2="28.3"
          y2="19.6"
          stroke="#111111"
          strokeOpacity="0.2"
          strokeWidth="1"
        />
        {/* Front-left isometric rhombus */}
        <polygon
          points="3,13 22,23 22,43 3,33"
          fill={won ? "#27ae60" : leftActive ? "#F7DA21" : "#EAE8E1"}
          stroke="#111111"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* Front-right isometric rhombus */}
        <polygon
          points="22,23 41,13 41,33 22,43"
          fill={
            won
              ? "#1e8449"
              : activeFace === 5
              ? "#2ECC71"
              : rightActive
              ? "#F7DA21"
              : "#DCD9D0"
          }
          stroke="#111111"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </svg>

      <div className="grid grid-cols-6 gap-1">
        {[0, 1, 2, 3, 4, 5].map((idx) => {
          const isCurrent = !won && idx === activeFace;
          const isConquered =
            won || idx < activeFace || (idx <= conqueredMax && idx !== activeFace);
          return (
            <span
              key={idx}
              title={`Face ${idx + 1}${idx === 5 ? " (Final Goal Hole)" : ""}`}
              className={cn(
                "h-5 w-5 rounded-md border text-[10px] font-mono font-black flex items-center justify-center transition-all",
                isCurrent
                  ? idx === 5
                    ? "border-2 border-black bg-[#2ECC71] text-black scale-110 shadow-[0_1px_0_#111]"
                    : "border-2 border-black bg-[#F7DA21] text-black scale-110 shadow-[0_1px_0_#111]"
                  : isConquered
                  ? "border-emerald-700 bg-emerald-500 text-white"
                  : idx === 5
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : "border-neutral-300 bg-neutral-100 text-neutral-500"
              )}
            >
              {idx + 1}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function MoveTwoGame() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const [liveTodayKey, setLiveTodayKey] = useState<string>(() => getLocalDateKey());

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

const GRID_INDICES = [0, 1, 2, 3, 4] as const;

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
    const saved = getGameProgress<MoveTwoSavedProgress>(
      "move-2",
      activeDateKey,
      initialPuzzle.id
    );
    if (!saved || saved.puzzleHash !== computePuzzleContentHash(initialPuzzle)) {
      return null;
    }
    return saved;
  }, [activeDateKey, initialPuzzle]);

  const [splashDismissed, setSplashDismissed] = useState<boolean>(false);
  const [domino, setDomino] = useState<MoveTwoDominoState>(
    () => initialSaved?.domino ?? initialPuzzle.start
  );
  const [moves, setMoves] = useState<number>(() => initialSaved?.moves ?? 0);
  const [conqueredMax, setConqueredMax] = useState<number>(
    () => initialSaved?.conqueredMax ?? 0
  );
  const [faceEntries, setFaceEntries] = useState<Record<number, MoveTwoDominoState>>(
    () => initialSaved?.faceEntries ?? { 0: initialPuzzle.start }
  );
  const [history, setHistory] = useState<MoveHistorySnapshot[]>([]);
  const [status, setStatus] = useState<"playing" | "won">(
    () => initialSaved?.status ?? "playing"
  );
  const [feedback, setFeedback] = useState<{
    kind: "bump" | "hazard" | "portal";
    message: string;
  } | null>(null);
  const [bumpDir, setBumpDir] = useState<MoveTwoDirection | null>(null);
  const [rollDir, setRollDir] = useState<MoveTwoDirection | null>(null);
  const [cubeTransition, setCubeTransition] = useState<
    "idle" | "dropping" | "rotating"
  >("idle");
  const [muted, setMuted] = useState<boolean>(() => isMoveTwoMuted());
  const [helpOpen, setHelpOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimer1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimer2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTransitionTimers = useCallback(() => {
    if (rollTimerRef.current) {
      clearTimeout(rollTimerRef.current);
      rollTimerRef.current = null;
    }
    if (transitionTimer1Ref.current) {
      clearTimeout(transitionTimer1Ref.current);
      transitionTimer1Ref.current = null;
    }
    if (transitionTimer2Ref.current) {
      clearTimeout(transitionTimer2Ref.current);
      transitionTimer2Ref.current = null;
    }
  }, []);

  const applyNewPuzzle = useCallback(
    (next: MoveTwoPuzzle) => {
      clearTransitionTimers();
      clearGameProgress("move-2", activeDateKey);
      setPuzzle(next);
      setDomino(next.start);
      setMoves(0);
      setConqueredMax(0);
      setFaceEntries({ 0: next.start });
      setHistory([]);
      setStatus("playing");
      setFeedback(null);
      setRollDir(null);
      setCubeTransition("idle");
    },
    [activeDateKey, clearTransitionTimers]
  );

  // Remote override sync + live Realtime puzzle updates
  useEffect(() => {
    let active = true;
    void fetchRemoteOverrideForGame("move-2", activeDateKey).then((remote) => {
      if (!active || !isMoveTwoPuzzle(remote)) return;
      if (computePuzzleContentHash(remote) !== puzzleHash) {
        applyNewPuzzle(remote);
      }
    });

    const onUpdated = (e: Event) => {
      if (!active) return;
      const detail = (e as CustomEvent)?.detail;
      if (detail?.gameSlug && detail.gameSlug !== "move-2") return;
      if (!detail?.dateKey || detail.dateKey === activeDateKey) {
        const local = getAdminOverridesForGame("move-2")[activeDateKey];
        if (isMoveTwoPuzzle(local) && computePuzzleContentHash(local) !== puzzleHash) {
          applyNewPuzzle(local);
        }
      }
    };
    window.addEventListener("solgames:puzzles-updated", onUpdated);
    return () => {
      active = false;
      window.removeEventListener("solgames:puzzles-updated", onUpdated);
    };
  }, [activeDateKey, puzzleHash, applyNewPuzzle]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      clearTransitionTimers();
    };
  }, [clearTransitionTimers]);

  const showTransientFeedback = useCallback(
    (kind: "bump" | "hazard" | "portal", message: string) => {
      setFeedback({ kind, message });
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setFeedback(null);
      }, 2200);
    },
    []
  );

  const persist = useCallback(
    (
      nextDomino: MoveTwoDominoState,
      nextMoves: number,
      nextConquered: number,
      nextEntries: Record<number, MoveTwoDominoState>,
      nextStatus: "playing" | "won"
    ) => {
      saveGameProgress<MoveTwoSavedProgress>("move-2", activeDateKey, {
        puzzleId: puzzle.id,
        puzzleHash,
        domino: nextDomino,
        moves: nextMoves,
        conqueredMax: nextConquered,
        faceEntries: nextEntries,
        status: nextStatus,
      });
    },
    [activeDateKey, puzzle.id, puzzleHash]
  );

  const handleToggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    setMoveTwoMuted(next);
  }, [muted]);

  const triggerRollAnimation = useCallback((dir: MoveTwoDirection) => {
    if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
    setRollDir(dir);
    rollTimerRef.current = setTimeout(() => {
      setRollDir(null);
    }, 320);
  }, []);

  const handleMove = useCallback(
    (dir: MoveTwoDirection) => {
      if (status !== "playing") return;

      const outcome = stepMoveTwoDomino(puzzle, domino, dir);
      if (outcome.kind === "bump") {
        playMoveTwoRimBumpSfx();
        setBumpDir(dir);
        setTimeout(() => setBumpDir(null), 260);
        showTransientFeedback("bump", "Blocked by a wall.");
        return;
      }

      const snapshot: MoveHistorySnapshot = {
        domino,
        moves,
        conqueredMax,
        faceEntries: { ...faceEntries },
      };
      setHistory((prev) => [...prev, snapshot]);

      const nextMoves = moves + 1;
      setMoves(nextMoves);

      if (outcome.kind === "hazard") {
        playMoveTwoHazardSfx();
        const faceStart = puzzle.faces[domino.face]?.start;
        const entryState: MoveTwoDominoState =
          faceEntries[domino.face] ??
          (faceStart
            ? {
                face: domino.face,
                posture: faceStart.posture,
                r: faceStart.r,
                c: faceStart.c,
              }
            : puzzle.start);
        setBumpDir(dir);
        setTimeout(() => setBumpDir(null), 280);
        setDomino(entryState);
        showTransientFeedback(
          "hazard",
          "You hit an obstacle! Resetting position."
        );
        persist(entryState, nextMoves, conqueredMax, faceEntries, "playing");
        return;
      }

      if (outcome.kind === "portal") {
        playMoveTwoHoleDropSfx();
        clearTransitionTimers();
        triggerRollAnimation(dir);
        setCubeTransition("dropping");
        transitionTimer1Ref.current = setTimeout(() => {
          setCubeTransition("rotating");
        }, 320);
        transitionTimer2Ref.current = setTimeout(() => {
          setCubeTransition("idle");
        }, 840);

        const nextConquered = Math.max(conqueredMax, outcome.toFace);
        const nextEntries = {
          ...faceEntries,
          [outcome.toFace]: faceEntries[outcome.toFace] ?? outcome.next,
        };
        setDomino(outcome.next);
        setConqueredMax(nextConquered);
        setFaceEntries(nextEntries);
        showTransientFeedback(
          "portal",
          `Nice! Moving to Face ${outcome.toFace + 1} of 6.`
        );
        persist(outcome.next, nextMoves, nextConquered, nextEntries, "playing");
        return;
      }

      if (outcome.kind === "won") {
        playMoveTwoVictorySfx();
        clearTransitionTimers();
        triggerRollAnimation(dir);
        setCubeTransition("dropping");
        transitionTimer1Ref.current = setTimeout(() => {
          setCubeTransition("idle");
        }, 360);

        const stars = computeMoveTwoStars(nextMoves, puzzle.par);
        setDomino(outcome.next);
        setConqueredMax(5);
        setStatus("won");
        setFeedback(null);
        persist(outcome.next, nextMoves, 5, faceEntries, "won");
        recordMoveTwoCompletion(activeDateKey, nextMoves, puzzle.par, stars);
        return;
      }

      // Standard roll within the active 5×5 face with slower 320ms physics animation
      playMoveTwoRollSfx(outcome.next.posture);
      triggerRollAnimation(dir);
      setDomino(outcome.next);
      persist(outcome.next, nextMoves, conqueredMax, faceEntries, "playing");
    },
    [
      status,
      puzzle,
      domino,
      moves,
      conqueredMax,
      faceEntries,
      persist,
      activeDateKey,
      showTransientFeedback,
      clearTransitionTimers,
      triggerRollAnimation,
    ]
  );

  const handleUndo = useCallback(() => {
    if (status !== "playing" || history.length === 0) return;
    clearTransitionTimers();
    setRollDir(null);
    setCubeTransition("idle");
    const prev = history[history.length - 1]!;
    setHistory((h) => h.slice(0, -1));
    setDomino(prev.domino);
    setMoves(prev.moves);
    setConqueredMax(prev.conqueredMax);
    setFaceEntries(prev.faceEntries);
    setFeedback(null);
    persist(
      prev.domino,
      prev.moves,
      prev.conqueredMax,
      prev.faceEntries,
      "playing"
    );
  }, [status, history, persist, clearTransitionTimers]);

  const handleResetFace = useCallback(() => {
    if (status !== "playing") return;
    const faceStart = puzzle.faces[domino.face]?.start;
    const entry: MoveTwoDominoState =
      faceEntries[domino.face] ??
      (faceStart
        ? {
            face: domino.face,
            posture: faceStart.posture,
            r: faceStart.r,
            c: faceStart.c,
          }
        : puzzle.start);
    if (
      entry.face === domino.face &&
      entry.posture === domino.posture &&
      entry.r === domino.r &&
      entry.c === domino.c
    ) {
      return;
    }
    setHistory((prev) => [
      ...prev,
      { domino, moves, conqueredMax, faceEntries: { ...faceEntries } },
    ]);
    setRollDir(null);
    setDomino(entry);
    showTransientFeedback("portal", "Position reset.");
    persist(entry, moves, conqueredMax, faceEntries, "playing");
  }, [
    status,
    faceEntries,
    domino,
    puzzle.faces,
    puzzle.start,
    moves,
    conqueredMax,
    persist,
    showTransientFeedback,
  ]);

  const handleRestartFull = useCallback(() => {
    clearTransitionTimers();
    clearGameProgress("move-2", activeDateKey);
    setDomino(puzzle.start);
    setMoves(0);
    setConqueredMax(0);
    setFaceEntries({ 0: puzzle.start });
    setHistory([]);
    setStatus("playing");
    setFeedback(null);
    setRollDir(null);
    setCubeTransition("idle");
  }, [activeDateKey, puzzle.start, clearTransitionTimers]);

  // Desktop Arrow / WASD + Z undo controls (strictly after splash screen dismiss)
  useEffect(() => {
    if (!splashDismissed || status !== "playing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      const key = e.key;
      if (key === "ArrowUp" || key === "w" || key === "W") {
        e.preventDefault();
        handleMove("up");
      } else if (key === "ArrowDown" || key === "s" || key === "S") {
        e.preventDefault();
        handleMove("down");
      } else if (key === "ArrowLeft" || key === "a" || key === "A") {
        e.preventDefault();
        handleMove("left");
      } else if (key === "ArrowRight" || key === "d" || key === "D") {
        e.preventDefault();
        handleMove("right");
      } else if (key === "z" || key === "Z" || key === "Backspace") {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [splashDismissed, status, handleMove, handleUndo]);

  const activeFace = puzzle.faces[domino.face]!;
  const faceHole = useMemo<MoveTwoTarget>(
    () =>
      activeFace.hole ??
      (domino.face === 5
        ? puzzle.target
        : {
            posture: "UPRIGHT",
            r: MOVE_TWO_GRID_SIZE - 1,
            c: MOVE_TWO_GRID_SIZE - 1,
          }),
    [activeFace.hole, domino.face, puzzle.target]
  );
  const faceStart = useMemo<MoveTwoTarget>(
    () =>
      activeFace.start ?? {
        posture: puzzle.start.posture,
        r: puzzle.start.r,
        c: puzzle.start.c,
      },
    [activeFace.start, puzzle.start.posture, puzzle.start.r, puzzle.start.c]
  );

  const occupiedCells = useMemo(() => getDominoCells(domino), [domino]);
  const occupiedKeys = useMemo(
    () => new Set(occupiedCells.map((c) => `${c.r},${c.c}`)),
    [occupiedCells]
  );
  const holeCells = useMemo(() => getDominoCells(faceHole), [faceHole]);
  const holeKeys = useMemo(
    () => new Set(holeCells.map((c) => `${c.r},${c.c}`)),
    [holeCells]
  );
  const startKeys = useMemo(
    () => new Set(getDominoCells(faceStart).map((c) => `${c.r},${c.c}`)),
    [faceStart]
  );

  const stars = computeMoveTwoStars(moves, puzzle.par);
  const shareText = useMemo(
    () =>
      buildMoveTwoShareText({
        puzzleNumber: puzzle.puzzleNumber,
        title: puzzle.title,
        moves,
        par: puzzle.par,
        stars,
      }),
    [puzzle.puzzleNumber, puzzle.title, moves, puzzle.par, stars]
  );

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
          tagline="Move the 3D 2×1 block across 6 cube faces and drop into each hole."
          theme={`${puzzle.title} · Par ${puzzle.par}`}
          author={puzzle.author}
          puzzleNumber={puzzle.puzzleNumber}
          dateKey={activeDateKey}
          showCreate={false}
          isCompletedToday={
            status === "won" || isDateCompleted("move-2", activeDateKey)
          }
          hasSavedProgress={moves > 0 && status !== "won"}
          onPlay={() => setSplashDismissed(true)}
        />
      </GameShell>
    );
  }

  const postureLabel =
    domino.posture === "UPRIGHT"
      ? "Standing 1×1 (2 Stacked)"
      : domino.posture === "FLAT_H"
      ? "Flat 1×2 ↔"
      : "Flat 2×1 ↕";

  const holeRequirementLabel =
    faceHole.posture === "UPRIGHT"
      ? "Drop Standing (1×1) into Hole"
      : faceHole.posture === "FLAT_H"
      ? "Drop Flat (1×2 ↔) into Hole"
      : "Drop Flat (2×1 ↕) into Hole";

  const stageTransform =
    cubeTransition === "rotating"
      ? "rotateX(33deg) rotateY(-16deg) scale(0.95)"
      : cubeTransition === "dropping"
      ? "rotateX(28deg) scale(0.98)"
      : "rotateX(25deg)";

  // 3D rolling physics transform on the 2x1 block actor (320ms smooth roll)
  const blockRollTransform =
    cubeTransition === "dropping"
      ? "translateY(8px) scale(0.78)"
      : rollDir === "right"
      ? "translateY(-5px) rotateZ(5deg) scale(1.03)"
      : rollDir === "left"
      ? "translateY(-5px) rotateZ(-5deg) scale(1.03)"
      : rollDir === "up"
      ? "translateY(-7px) scale(1.04)"
      : rollDir === "down"
      ? "translateY(-3px) scale(1.03)"
      : "translateY(0px) scale(1)";

  return (
    <GameShell
      gameSlug="move-2"
      gameTitle="Move Two"
      puzzleNumber={puzzle.puzzleNumber}
      dateKey={activeDateKey}
      author={puzzle.author}
      subtitle="Move the 3D 2×1 block into the hole on all 6 faces of the cube."
      helpOpen={helpOpen}
      onHelpOpenChange={setHelpOpen}
      statsOpen={statsOpen}
      onStatsOpenChange={setStatsOpen}
    >
      <div
        className="mx-auto max-w-lg space-y-3.5 select-none"
        data-testid="move-two-board"
      >
        {/* Top Status + Mini 3D Isometric Cube HUD + Mute Button */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="green" className="font-mono text-xs font-black">
                Face {domino.face + 1} / 6
              </Badge>
              <span
                className="font-mono text-xs sm:text-sm font-black text-black"
                data-testid="move-two-score-pill"
              >
                Moves: {moves} · Par: {puzzle.par}
              </span>
            </div>
            <p className="text-[11px] font-semibold text-neutral-600">
              Block: <span className="font-bold text-black">{postureLabel}</span>
              <span className="ml-2 font-bold text-emerald-700">
                · {holeRequirementLabel}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleMute}
              data-testid="move-two-mute-toggle"
              aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
              title={muted ? "Sound Muted (Tap to Unmute)" : "Sound On (Tap to Mute)"}
              className="h-9 w-9 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 flex items-center justify-center shadow-[0_2px_0_#111] cursor-pointer transition-colors"
            >
              {muted ? (
                <VolumeX className="h-4 w-4 text-neutral-500" />
              ) : (
                <Volume2 className="h-4 w-4 text-black" />
              )}
            </button>
            <IsometricCubeHud
              activeFace={domino.face}
              conqueredMax={conqueredMax}
              won={status === "won"}
            />
          </div>
        </div>

        {/* Transient feedback banner */}
        <div className="min-h-6 flex items-center justify-center">
          {feedback ? (
            <p
              className={cn(
                "px-3 py-0.5 rounded-full text-xs font-bold border",
                feedback.kind === "portal"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : feedback.kind === "hazard"
                  ? "bg-red-50 border-red-300 text-red-900"
                  : "bg-neutral-100 border-neutral-300 text-neutral-800"
              )}
            >
              {feedback.message}
            </p>
          ) : domino.face < 5 ? (
            <p className="text-xs font-semibold text-neutral-600">
              Move the 2×1 block to{" "}
              <span className="font-black text-emerald-700">
                {holeRequirementLabel}
              </span>{" "}
              to advance to Face {domino.face + 2}.
            </p>
          ) : (
            <p className="text-xs font-bold text-emerald-700 flex items-center gap-1">
              <Flag className="h-3.5 w-3.5" /> Final Face 6! {holeRequirementLabel}
            </p>
          )}
        </div>

        {/* NYT-Styled 2.5D Tilted (~25°) 5×5 Cube Face & Sharp 3D Two-Cube 2×1 Block */}
        <div
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) touchStartRef.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const start = touchStartRef.current;
            touchStartRef.current = null;
            const end = e.changedTouches[0];
            if (!start || !end) return;
            const dx = end.clientX - start.x;
            const dy = end.clientY - start.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
            if (Math.abs(dx) > Math.abs(dy)) {
              handleMove(dx > 0 ? "right" : "left");
            } else {
              handleMove(dy > 0 ? "down" : "up");
            }
          }}
          style={{ perspective: "920px" }}
          className={cn(
            "relative mx-auto w-full max-w-[360px] py-2 flex flex-col items-center transition-transform duration-200",
            bumpDir === "left" && "-translate-x-1.5",
            bumpDir === "right" && "translate-x-1.5",
            bumpDir === "up" && "-translate-y-1.5",
            bumpDir === "down" && "translate-y-1.5"
          )}
          data-testid="move-two-25d-stage"
        >
          {/* Tilted 3D Cube Slab */}
          <div
            style={{
              transform: stageTransform,
              transformStyle: "preserve-3d",
            }}
            className="w-full transition-transform duration-500 ease-out"
          >
            {/* NYT Games Editorial Cube Frame */}
            <div className="rounded-2xl bg-[#F7F7F5] p-3 border-[3px] border-[#111111] shadow-[0_12px_0_#111111,0_20px_28px_rgba(0,0,0,0.14)]">
              <div className="flex items-center justify-between px-1 pb-1 text-[10px] font-mono font-black tracking-wider uppercase text-neutral-600">
                <span>Face {domino.face + 1} of 6 · 5×5 Cube</span>
                <span className="px-2 py-0.5 rounded-full border border-emerald-700/35 bg-emerald-100 text-emerald-900">
                  {domino.face === 5 ? "Final Green Goal" : "Green Hole"}
                </span>
              </div>

              {/* Headroom mt-4 so a tall UPRIGHT 2-cube stack at row 0 rises cleanly inside the cube frame */}
              <div className="mt-4 p-2 rounded-lg bg-[#E5E3DC] border-2 border-[#111111] shadow-inner aspect-square">
                {/* Strictly Uniform 5×5 Cube Surface Grid (grid-cols-5 + grid-rows-5) */}
                <div
                  key={`face-${domino.face}`}
                  className="relative w-full h-full grid grid-cols-5 grid-rows-5 gap-1.5"
                >
                  {GRID_INDICES.map((r) =>
                    GRID_INDICES.map((c) => {
                      const key = `${r},${c}`;
                      const cellType = activeFace.grid[r]?.[c] ?? "floor";
                      const hasDomino = occupiedKeys.has(key);
                      const isHole = holeKeys.has(key);
                      const isStart = startKeys.has(key);
                      const isFinalFace = domino.face === 5;
                      const isPrimaryHoleAnchor =
                        r === faceHole.r && c === faceHole.c;

                      return (
                        <div
                          key={key}
                          data-testid={`m2-cell-${r}-${c}`}
                          className={cn(
                            "relative w-full h-full min-w-0 min-h-0 aspect-square rounded-[3px] border-2 overflow-hidden transition-colors",
                            cellType === "wall"
                              ? "bg-[#171717] border-[#111111]"
                              : cellType === "hazard"
                              ? "bg-[#1F0202] border-[#991B1B]"
                              : isHole
                              ? "bg-[#031D0E] border-[#15803D]"
                              : isStart
                              ? "bg-[#FFFBE6] border-amber-500/80 shadow-[inset_0_-2px_0_#fde68a]"
                              : "bg-white border-neutral-300 shadow-[inset_0_-2px_0_#e5e5e5]"
                          )}
                        >
                          {/* Start Tile subtle marker (absolute so zero intrinsic track stretch) */}
                          {isStart && !hasDomino && !isHole && cellType === "floor" && (
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-mono font-black uppercase tracking-tighter text-amber-800/80">
                              START
                            </span>
                          )}

                          {/* Solid Wall Block */}
                          {cellType === "wall" && (
                            <span
                              className="pointer-events-none absolute inset-1.5 bg-neutral-700 border border-neutral-500 shadow-[0_2px_0_#000]"
                              aria-label="Wall"
                            />
                          )}

                          {/* Obstacle Tile = Recessed 3D RED Hole */}
                          {cellType === "hazard" && (
                            <div
                              className="pointer-events-none absolute inset-0"
                              aria-label="Red obstacle hole"
                            >
                              {/* Visible top inner vertical red pit wall */}
                              <span className="absolute inset-x-0 top-0 h-2.5 bg-[#EF4444] border-b border-[#7F1D1D]" />
                              {/* Left & right inner vertical red pit walls */}
                              <span className="absolute top-2.5 bottom-0 left-0 w-1.5 bg-[#DC2626]" />
                              <span className="absolute top-2.5 bottom-0 right-0 w-1.5 bg-[#991B1B]" />
                              {/* Bottom inner rim */}
                              <span className="absolute inset-x-1.5 bottom-0 h-1 bg-[#7F1D1D]" />
                              {/* Sunken dark crimson pit floor */}
                              <span className="absolute top-2.5 bottom-1 left-1.5 right-1.5 bg-gradient-to-b from-[#450A0A] via-[#220303] to-[#0A0101] shadow-[inset_0_5px_9px_rgba(0,0,0,0.9)] border border-[#EF4444]/30" />
                            </div>
                          )}

                          {/* Target Hole Cavity = Recessed 3D GREEN Hole on ALL 6 Faces */}
                          {isHole && (
                            <div
                              className="pointer-events-none absolute inset-0"
                              aria-label={isFinalFace ? "Green goal hole" : "Green target hole"}
                            >
                              {/* Visible top inner vertical green pit wall */}
                              <span className="absolute inset-x-0 top-0 h-2.5 bg-[#2ECC71] border-b border-[#14532D]" />
                              {/* Left & right inner vertical green pit walls */}
                              <span className="absolute top-2.5 bottom-0 left-0 w-1.5 bg-[#22C55E]" />
                              <span className="absolute top-2.5 bottom-0 right-0 w-1.5 bg-[#15803D]" />
                              {/* Bottom inner rim */}
                              <span className="absolute inset-x-1.5 bottom-0 h-1 bg-[#14532D]" />
                              {/* Sunken emerald pit floor */}
                              <div className="absolute top-2.5 bottom-1 left-1.5 right-1.5 bg-gradient-to-b from-[#064E3B] via-[#042F1E] to-[#02140A] shadow-[inset_0_5px_9px_rgba(0,0,0,0.88)] border border-[#2ECC71]/60 flex flex-col items-center justify-center text-center overflow-hidden">
                                {!hasDomino && isPrimaryHoleAnchor && (
                                  <span className="text-[7px] font-mono font-black uppercase leading-none text-[#4ADE80] drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                                    {formatHoleBadge(faceHole.posture, isFinalFace)}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Occupied cell test-id marker (preserves m2-domino-${r}-${c} for automated checks) */}
                          {hasDomino && (
                            <span
                              data-testid={`m2-domino-${r}-${c}`}
                              className="sr-only"
                            >
                              2×1 Block at ({r}, {c})
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* Sharp-Edged 3D Two-Cube 2×1 Block Actor (Zero Curved Corners; Tall 2-Cube Tower when UPRIGHT; 320ms Physics Roll) */}
                  <div
                    data-testid="move-two-3d-block"
                    data-posture={domino.posture}
                    style={{
                      left: `${domino.c * 20}%`,
                      top: `${domino.r * 20}%`,
                      width: domino.posture === "FLAT_H" ? "40%" : "20%",
                      height: domino.posture === "FLAT_V" ? "40%" : "20%",
                      transform: blockRollTransform,
                      transition:
                        "left 320ms cubic-bezier(0.22, 1, 0.36, 1), top 320ms cubic-bezier(0.22, 1, 0.36, 1), width 320ms cubic-bezier(0.22, 1, 0.36, 1), height 320ms cubic-bezier(0.22, 1, 0.36, 1), transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                    className="pointer-events-none absolute z-20"
                  >
                    {domino.posture === "UPRIGHT" ? (
                      /* UPRIGHT (1×1 footprint): Two sharp 3D cubes visibly stacked vertically into a tall tower */
                      <svg
                        viewBox="0 0 100 100"
                        className="w-full h-full overflow-visible"
                        aria-hidden="true"
                      >
                        {/* Sharp parallelogram ground shadow on tile (r, c) */}
                        <polygon
                          points="10,95 84,95 96,75 22,75"
                          fill="rgba(0,0,0,0.24)"
                        />
                        {/* Bottom Cube (Cube 1 of 2 — resting on tile) */}
                        <polygon
                          points="8,36 80,36 80,92 8,92"
                          fill={status === "won" ? "#22C55E" : "#EAB308"}
                          stroke="#111111"
                          strokeWidth="3.5"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                        />
                        <polygon
                          points="80,36 94,16 94,72 80,92"
                          fill={status === "won" ? "#166534" : "#A16207"}
                          stroke="#111111"
                          strokeWidth="3.5"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                        />
                        {/* Upper Cube (Cube 2 of 2 — stacked vertically on top of Bottom Cube) */}
                        <polygon
                          points="8,-20 80,-20 80,36 8,36"
                          fill={status === "won" ? "#2ECC71" : "#F7DA21"}
                          stroke="#111111"
                          strokeWidth="3.5"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                        />
                        <polygon
                          points="80,-20 94,-40 94,16 80,36"
                          fill={status === "won" ? "#15803D" : "#CA8A04"}
                          stroke="#111111"
                          strokeWidth="3.5"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                        />
                        <polygon
                          points="8,-20 22,-40 94,-40 80,-20"
                          fill={status === "won" ? "#86EFAC" : "#FEF08A"}
                          stroke="#111111"
                          strokeWidth="3.5"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                        />
                      </svg>
                    ) : domino.posture === "FLAT_H" ? (
                      /* FLAT_H (1×2 horizontal): Two sharp 1-unit-tall 3D cubes attached left-to-right */
                      <svg
                        viewBox="0 0 200 100"
                        className="w-full h-full overflow-visible"
                        aria-hidden="true"
                      >
                        {/* Ground shadow across both horizontal tiles */}
                        <polygon
                          points="10,94 184,94 194,78 20,78"
                          fill="rgba(0,0,0,0.2)"
                        />
                        {/* Left Cube (Cube 1) */}
                        <polygon
                          points="6,64 18,16 100,16 88,64"
                          fill={status === "won" ? "#86EFAC" : "#FEF08A"}
                          stroke="#111111"
                          strokeWidth="3.5"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                        />
                        <polygon
                          points="6,64 88,64 88,90 6,90"
                          fill={status === "won" ? "#2ECC71" : "#F7DA21"}
                          stroke="#111111"
                          strokeWidth="3.5"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                        />
                        {/* Right Cube (Cube 2 — attached along x = 88..100 seam) */}
                        <polygon
                          points="88,64 100,16 182,16 170,64"
                          fill={status === "won" ? "#86EFAC" : "#FEF08A"}
                          stroke="#111111"
                          strokeWidth="3.5"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                        />
                        <polygon
                          points="88,64 170,64 170,90 88,90"
                          fill={status === "won" ? "#2ECC71" : "#F7DA21"}
                          stroke="#111111"
                          strokeWidth="3.5"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                        />
                        <polygon
                          points="170,64 182,16 182,42 170,90"
                          fill={status === "won" ? "#15803D" : "#CA8A04"}
                          stroke="#111111"
                          strokeWidth="3.5"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                        />
                      </svg>
                    ) : (
                      /* FLAT_V (2×1 vertical): Two sharp 1-unit-tall 3D cubes attached back-to-front */
                      <svg
                        viewBox="0 0 100 200"
                        className="w-full h-full overflow-visible"
                        aria-hidden="true"
                      >
                        {/* Ground shadow across both vertical tiles */}
                        <polygon
                          points="8,194 82,194 96,42 22,42"
                          fill="rgba(0,0,0,0.2)"
                        />
                        {/* Back Cube (Cube 1) */}
                        <polygon
                          points="13,89 20,14 92,14 85,89"
                          fill={status === "won" ? "#86EFAC" : "#FEF08A"}
                          stroke="#111111"
                          strokeWidth="3.5"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                        />
                        <polygon
                          points="85,89 92,14 92,40 85,115"
                          fill={status === "won" ? "#15803D" : "#CA8A04"}
                          stroke="#111111"
                          strokeWidth="3.5"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                        />
                        {/* Front Cube (Cube 2 — attached along y = 89 seam) */}
                        <polygon
                          points="6,164 13,89 85,89 78,164"
                          fill={status === "won" ? "#86EFAC" : "#FEF08A"}
                          stroke="#111111"
                          strokeWidth="3.5"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                        />
                        <polygon
                          points="6,164 78,164 78,190 6,190"
                          fill={status === "won" ? "#2ECC71" : "#F7DA21"}
                          stroke="#111111"
                          strokeWidth="3.5"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                        />
                        <polygon
                          points="78,164 85,89 85,115 78,190"
                          fill={status === "won" ? "#15803D" : "#CA8A04"}
                          stroke="#111111"
                          strokeWidth="3.5"
                          strokeLinejoin="miter"
                          strokeLinecap="square"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Victory Card or Controls (Undo / Reset Face + Mobile D-Pad) */}
        {status === "won" ? (
          <div
            className="rounded-2xl border-2 border-black bg-[#fffbe6] p-5 text-center space-y-3 shadow-[0_4px_0_#111]"
            data-testid="move-two-victory"
          >
            <div className="inline-flex items-center gap-2 font-headline font-black text-xl text-black">
              <Trophy className="h-5 w-5 text-emerald-600" />
              <span>
                Solved in {moves} moves · Par: {puzzle.par} · {"⭐".repeat(stars)}
              </span>
            </div>
            <p className="text-xs font-medium text-neutral-600">
              All 6 5×5 cube faces completed on Move Two #{puzzle.puzzleNumber} (&ldquo;
              {puzzle.title}&rdquo;).
            </p>
            <ResultShareButtons
              title={`Move Two #${puzzle.puzzleNumber} — "${puzzle.title}"`}
              text={shareText}
              url="https://21games.ai/games/move-2"
            />
            <div className="flex flex-wrap justify-center gap-4 pt-1 text-xs font-bold">
              <Link
                href="/games/move-2/archive"
                className="inline-flex items-center gap-1 underline"
              >
                <Calendar className="h-3.5 w-3.5" /> Playable Archive
              </Link>
              <button
                type="button"
                onClick={handleRestartFull}
                className="underline cursor-pointer"
              >
                Replay Puzzle
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {/* Undo Move & Reset Face */}
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={history.length === 0}
                onClick={handleUndo}
                className="border-2 border-black font-bold text-xs h-9 px-3.5"
                data-testid="move-two-undo"
              >
                <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                Undo Move
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFace}
                className="border-2 border-black font-bold text-xs h-9 px-3.5"
                data-testid="move-two-reset-face"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reset Face
              </Button>
            </div>

            {/* Minimalist Mobile / Desktop On-Screen D-Pad */}
            <div
              className="mx-auto grid grid-cols-3 gap-1.5 w-40"
              aria-label="Directional move controls"
              data-testid="move-two-dpad"
            >
              <div />
              <button
                type="button"
                aria-label="Move Up"
                onClick={() => handleMove("up")}
                className="h-11 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 active:translate-y-0.5 shadow-[0_2px_0_#111] flex items-center justify-center cursor-pointer"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
              <div />
              <button
                type="button"
                aria-label="Move Left"
                onClick={() => handleMove("left")}
                className="h-11 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 active:translate-y-0.5 shadow-[0_2px_0_#111] flex items-center justify-center cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Move Down"
                onClick={() => handleMove("down")}
                className="h-11 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 active:translate-y-0.5 shadow-[0_2px_0_#111] flex items-center justify-center cursor-pointer"
              >
                <ArrowDown className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Move Right"
                onClick={() => handleMove("right")}
                className="h-11 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 active:translate-y-0.5 shadow-[0_2px_0_#111] flex items-center justify-center cursor-pointer"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            <p className="text-center text-[11px] text-neutral-500 font-medium">
              Arrow keys / WASD, swipe, or tap D-Pad · Walls block · Red holes reset position · Drop into the green hole
            </p>
          </div>
        )}
      </div>
    </GameShell>
  );
}
