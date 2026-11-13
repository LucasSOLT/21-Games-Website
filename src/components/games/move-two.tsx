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
  X,
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
  return isFinalFace ? `🎯 ${shape}` : `⬇ ${shape}`;
}

/**
 * Mini 3D Isometric Rubik's-Style Cube HUD (Q41):
 * Displays a crisp isometric 3D cube alongside all 6 face indicators (`1 → 6`),
 * highlighting conquered faces in green and the active face in high-contrast lime/black.
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
          fill={won ? "#2ECC71" : topActive ? "#b6df52" : "#f4f4f5"}
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
          strokeOpacity="0.22"
          strokeWidth="1"
        />
        <line
          x1="9.3"
          y1="9.6"
          x2="28.3"
          y2="19.6"
          stroke="#111111"
          strokeOpacity="0.22"
          strokeWidth="1"
        />
        {/* Front-left isometric rhombus */}
        <polygon
          points="3,13 22,23 22,43 3,33"
          fill={won ? "#27ae60" : leftActive ? "#b6df52" : "#e4e4e7"}
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
              ? "#fca5a5"
              : rightActive
              ? "#b6df52"
              : "#d4d4d8"
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
                  ? "border-2 border-black bg-[#b6df52] text-black scale-110 shadow-[0_1px_0_#111]"
                  : isConquered
                  ? "border-emerald-700 bg-emerald-500 text-white"
                  : idx === 5
                  ? "border-red-300 bg-red-50 text-red-700"
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
  const [cubeTransition, setCubeTransition] = useState<
    "idle" | "dropping" | "rotating"
  >("idle");
  const [muted, setMuted] = useState<boolean>(() => isMoveTwoMuted());
  const [helpOpen, setHelpOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimer1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimer2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTransitionTimers = useCallback(() => {
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
      }, 2000);
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

  const handleMove = useCallback(
    (dir: MoveTwoDirection) => {
      if (status !== "playing") return;

      const outcome = stepMoveTwoDomino(puzzle, domino, dir);
      if (outcome.kind === "bump") {
        playMoveTwoRimBumpSfx();
        setBumpDir(dir);
        setTimeout(() => setBumpDir(null), 240);
        showTransientFeedback(
          "bump",
          "Blocked by the raised cube rim — try another direction."
        );
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
        setTimeout(() => setBumpDir(null), 260);
        setDomino(entryState);
        showTransientFeedback(
          "hazard",
          `Dark void hazard! Reset to Face ${domino.face + 1} spawn.`
        );
        persist(entryState, nextMoves, conqueredMax, faceEntries, "playing");
        return;
      }

      if (outcome.kind === "portal") {
        playMoveTwoHoleDropSfx();
        clearTransitionTimers();
        setCubeTransition("dropping");
        transitionTimer1Ref.current = setTimeout(() => {
          setCubeTransition("rotating");
        }, 160);
        transitionTimer2Ref.current = setTimeout(() => {
          setCubeTransition("idle");
        }, 420);

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
          `Dropped into hole! Cube rotated to Face ${outcome.toFace + 1}.`
        );
        persist(outcome.next, nextMoves, nextConquered, nextEntries, "playing");
        return;
      }

      if (outcome.kind === "won") {
        playMoveTwoVictorySfx();
        clearTransitionTimers();
        setCubeTransition("dropping");
        transitionTimer1Ref.current = setTimeout(() => {
          setCubeTransition("idle");
        }, 280);

        const stars = computeMoveTwoStars(nextMoves, puzzle.par);
        setDomino(outcome.next);
        setConqueredMax(5);
        setStatus("won");
        setFeedback(null);
        persist(outcome.next, nextMoves, 5, faceEntries, "won");
        recordMoveTwoCompletion(activeDateKey, nextMoves, puzzle.par, stars);
        return;
      }

      // Standard roll within the active 5×5 face
      playMoveTwoRollSfx(outcome.next.posture);
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
    ]
  );

  const handleUndo = useCallback(() => {
    if (status !== "playing" || history.length === 0) return;
    clearTransitionTimers();
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
    setDomino(entry);
    showTransientFeedback("portal", `Reset to Face ${domino.face + 1} spawn.`);
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
          tagline="Roll the 3D 2×1 die across 6 tilted 5×5 cube faces and drop into each recessed hole."
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
      ? "Standing 1×1 (Tall)"
      : domino.posture === "FLAT_H"
      ? "Flat 1×2 ↔"
      : "Flat 2×1 ↕";

  const holeRequirementLabel =
    faceHole.posture === "UPRIGHT"
      ? "Drop Upright (1×1) into Hole"
      : faceHole.posture === "FLAT_H"
      ? "Drop Flat (1×2 ↔) into Trench"
      : "Drop Flat (2×1 ↕) into Trench";

  const stageTransform =
    cubeTransition === "rotating"
      ? "rotateX(32deg) rotateY(-14deg) scale(0.96)"
      : cubeTransition === "dropping"
      ? "rotateX(27deg) scale(0.99)"
      : "rotateX(25deg)";

  return (
    <GameShell
      gameSlug="move-2"
      gameTitle="Move Two"
      puzzleNumber={puzzle.puzzleNumber}
      dateKey={activeDateKey}
      author={puzzle.author}
      subtitle="Roll the 3D 2×1 die into each face's recessed hole across all 6 cube faces."
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
              Die: <span className="font-bold text-black">{postureLabel}</span>
              <span
                className={cn(
                  "ml-2 font-bold",
                  domino.face === 5 ? "text-red-700" : "text-emerald-800"
                )}
              >
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
                  ? "bg-red-50 border-red-300 text-red-800"
                  : "bg-neutral-100 border-neutral-300 text-neutral-700"
              )}
            >
              {feedback.message}
            </p>
          ) : domino.face < 5 ? (
            <p className="text-xs font-semibold text-neutral-600">
              Align the 3D die to{" "}
              <span className="font-black text-emerald-800">
                {holeRequirementLabel}
              </span>{" "}
              to drop into Face {domino.face + 2}.
            </p>
          ) : (
            <p className="text-xs font-bold text-red-700 flex items-center gap-1">
              <Flag className="h-3.5 w-3.5" /> Final Face 6! {holeRequirementLabel}
            </p>
          )}
        </div>

        {/* 2.5D Tilted (~25°) 5×5 Cube Face with Raised Outer Rim & True 3D Extruded 2×1 Die */}
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
            "relative mx-auto w-full max-w-[360px] py-1 flex flex-col items-center transition-transform duration-150",
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
            className="w-full transition-transform duration-300 ease-out"
          >
            {/* Raised Outer Cube Rim Frame */}
            <div className="rounded-3xl bg-gradient-to-b from-neutral-800 via-neutral-900 to-black p-2.5 border-4 border-black shadow-[0_14px_0_#111111,0_22px_30px_rgba(0,0,0,0.28)]">
              <div className="flex items-center justify-between px-2 pb-1.5 text-[10px] font-mono font-black tracking-wider uppercase text-neutral-300">
                <span>Face {domino.face + 1} · 5×5 Cube Surface</span>
                <span className="text-[#b6df52]">Raised Rim Guard</span>
              </div>

              {/* 5×5 Recessed Board Grid inside Raised Rim */}
              <div
                key={`face-${domino.face}`}
                className="grid grid-cols-5 gap-1.5 p-2 rounded-2xl bg-[#EAE6DF] border-2 border-neutral-700 shadow-inner aspect-square"
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

                    // Determine if this cell is part of a 2-cell FLAT_H or FLAT_V domino or hole
                    const isDominoAnchor = r === domino.r && c === domino.c;
                    const dominoPartnerRight =
                      hasDomino && domino.posture === "FLAT_H" && isDominoAnchor;
                    const dominoPartnerLeft =
                      hasDomino &&
                      domino.posture === "FLAT_H" &&
                      !isDominoAnchor;
                    const dominoPartnerDown =
                      hasDomino && domino.posture === "FLAT_V" && isDominoAnchor;
                    const dominoPartnerUp =
                      hasDomino &&
                      domino.posture === "FLAT_V" &&
                      !isDominoAnchor;

                    return (
                      <div
                        key={key}
                        data-testid={`m2-cell-${r}-${c}`}
                        className={cn(
                          "relative rounded-xl border-2 flex items-center justify-center transition-all",
                          cellType === "wall"
                            ? "bg-neutral-900 border-black text-neutral-400 shadow-[0_3px_0_#000]"
                            : cellType === "hazard"
                            ? "bg-neutral-950 border-red-500/90 text-red-500 shadow-[inset_0_4px_8px_rgba(0,0,0,0.85)]"
                            : isHole
                            ? isFinalFace
                              ? "bg-neutral-950 border-red-500 text-red-300 shadow-[inset_0_5px_10px_rgba(0,0,0,0.95)] ring-2 ring-red-400/50"
                              : "bg-neutral-950 border-[#b6df52] text-[#b6df52] shadow-[inset_0_5px_10px_rgba(0,0,0,0.95)] ring-2 ring-[#b6df52]/40"
                            : isStart
                            ? "bg-[#f7fbe9] border-emerald-600/60 shadow-[0_2px_0_#cbd5e1]"
                            : "bg-white border-neutral-300 shadow-[0_2px_0_#cbd5e1]"
                        )}
                      >
                        {/* Start Pad subtle marker */}
                        {isStart && !hasDomino && !isHole && cellType === "floor" && (
                          <span className="text-[8px] font-mono font-black uppercase tracking-tighter text-emerald-700/70">
                            SPAWN
                          </span>
                        )}

                        {/* Solid Wall Block */}
                        {cellType === "wall" && (
                          <span
                            className="h-5 w-5 rounded-sm bg-neutral-700 border border-neutral-500 shadow-[0_2px_0_#000]"
                            aria-label="Solid wall"
                          />
                        )}

                        {/* Interior Dark Void Hazard Tile */}
                        {cellType === "hazard" && (
                          <div
                            className="flex flex-col items-center justify-center"
                            aria-label="Dark void hazard"
                          >
                            <X className="h-5 w-5 stroke-[3] text-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.6)]" />
                          </div>
                        )}

                        {/* Recessed Target Hole Cavity */}
                        {isHole && !hasDomino && (
                          <div className="inset-1 absolute rounded-lg border border-dashed border-current/50 bg-gradient-to-b from-black via-neutral-900 to-neutral-950 flex flex-col items-center justify-center text-center overflow-hidden">
                            <span
                              className={cn(
                                "h-2.5 w-2.5 rounded-full border",
                                isFinalFace
                                  ? "bg-red-500/40 border-red-400"
                                  : "bg-[#b6df52]/30 border-[#b6df52]"
                              )}
                            />
                            {isPrimaryHoleAnchor && (
                              <span
                                className={cn(
                                  "text-[8px] font-mono font-black uppercase leading-none mt-0.5",
                                  isFinalFace ? "text-red-300" : "text-[#b6df52]"
                                )}
                              >
                                {formatHoleBadge(faceHole.posture, isFinalFace)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* True 3D Extruded 2×1 Domino / Die */}
                        {hasDomino && (
                          <div
                            data-testid={`m2-domino-${r}-${c}`}
                            className={cn(
                              "inset-0.5 absolute rounded-lg border-2 border-black flex flex-col items-center justify-between overflow-hidden font-mono font-black transition-all duration-150 z-10",
                              cubeTransition === "dropping" &&
                                "scale-75 translate-y-1.5 opacity-60",
                              status === "won"
                                ? "bg-gradient-to-b from-[#4ade80] to-[#16a34a] text-black shadow-[0_5px_0_#052e16]"
                                : domino.posture === "UPRIGHT"
                                ? "bg-gradient-to-b from-[#d9f99d] via-[#b6df52] to-[#84cc16] text-black -translate-y-2 scale-[1.08] shadow-[0_9px_0_#1a2e05,0_12px_14px_rgba(0,0,0,0.45)]"
                                : "bg-gradient-to-b from-white via-neutral-100 to-neutral-200 text-black -translate-y-0.5 shadow-[0_5px_0_#111111,0_7px_10px_rgba(0,0,0,0.3)]",
                              dominoPartnerRight && "rounded-r-sm",
                              dominoPartnerLeft && "rounded-l-sm",
                              dominoPartnerDown && "rounded-b-sm",
                              dominoPartnerUp && "rounded-t-sm"
                            )}
                          >
                            {/* Top Bevel Highlight */}
                            <div className="w-full h-1 bg-white/60 shrink-0" />

                            {/* Die Pips & 2×1 Posture Indicator */}
                            {domino.posture === "UPRIGHT" ? (
                              <div className="flex flex-col items-center justify-center gap-0.5 my-auto">
                                <div className="flex items-center gap-1">
                                  <span className="h-2 w-2 rounded-full bg-black border border-white/40" />
                                  <span className="h-2 w-2 rounded-full bg-black border border-white/40" />
                                </div>
                                <span className="text-[7px] font-black uppercase tracking-tighter text-neutral-900 leading-none">
                                  2× TALL
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center my-auto">
                                {isDominoAnchor ? (
                                  <span className="h-2.5 w-2.5 rounded-full bg-black shadow-inner" />
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-black" />
                                    <span className="h-2 w-2 rounded-full bg-black" />
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 3D Front Extruded Thickness Lip */}
                            <div
                              className={cn(
                                "w-full shrink-0 border-t border-black/40",
                                domino.posture === "UPRIGHT"
                                  ? "h-2.5 bg-[#4d7c0f]"
                                  : "h-1.5 bg-neutral-400"
                              )}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
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
              All 6 5×5 cube faces conquered on Move Two #{puzzle.puzzleNumber} (&ldquo;
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
              aria-label="Directional roll controls"
              data-testid="move-two-dpad"
            >
              <div />
              <button
                type="button"
                aria-label="Roll Up"
                onClick={() => handleMove("up")}
                className="h-11 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 active:translate-y-0.5 shadow-[0_2px_0_#111] flex items-center justify-center cursor-pointer"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
              <div />
              <button
                type="button"
                aria-label="Roll Left"
                onClick={() => handleMove("left")}
                className="h-11 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 active:translate-y-0.5 shadow-[0_2px_0_#111] flex items-center justify-center cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Roll Down"
                onClick={() => handleMove("down")}
                className="h-11 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 active:translate-y-0.5 shadow-[0_2px_0_#111] flex items-center justify-center cursor-pointer"
              >
                <ArrowDown className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Roll Right"
                onClick={() => handleMove("right")}
                className="h-11 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 active:translate-y-0.5 shadow-[0_2px_0_#111] flex items-center justify-center cursor-pointer"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            <p className="text-center text-[11px] text-neutral-500 font-medium">
              Arrow keys / WASD, swipe, or tap D-Pad · Outer rim blocks · Void ✕ resets face · Match hole posture to drop in
            </p>
          </div>
        )}
      </div>
    </GameShell>
  );
}
