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
  X,
} from "lucide-react";
import {
  buildMoveTwoShareText,
  computeMoveTwoStars,
  getDominoCells,
  isMoveTwoPuzzle,
  stepMoveTwoDomino,
  type MoveTwoDirection,
  type MoveTwoDominoState,
  type MoveTwoPuzzle,
} from "@/data/puzzles/move-2";
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
      className="inline-flex items-center gap-2.5 rounded-2xl border-2 border-black bg-white px-2.5 py-1.5 shadow-[0_2px_0_#111]"
      data-testid="move-two-cube-hud"
      aria-label={`Cube progress: Face ${activeFace + 1} of 6`}
    >
      <svg
        width="38"
        height="40"
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
        {/* 3x3 subtle grid lines on top face */}
        <line x1="15.6" y1="6.3" x2="34.6" y2="16.3" stroke="#111111" strokeOpacity="0.22" strokeWidth="1" />
        <line x1="9.3" y1="9.6" x2="28.3" y2="19.6" stroke="#111111" strokeOpacity="0.22" strokeWidth="1" />
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
          const isConquered = won || idx < activeFace || (idx <= conqueredMax && idx !== activeFace);
          return (
            <span
              key={idx}
              title={`Face ${idx + 1}${idx === 5 ? " (Red Target)" : ""}`}
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
  const [bumping, setBumping] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyNewPuzzle = useCallback(
    (next: MoveTwoPuzzle) => {
      clearGameProgress("move-2", activeDateKey);
      setPuzzle(next);
      setDomino(next.start);
      setMoves(0);
      setConqueredMax(0);
      setFaceEntries({ 0: next.start });
      setHistory([]);
      setStatus("playing");
      setFeedback(null);
    },
    [activeDateKey]
  );

  // Remote override sync + live Realtime puzzle updates
  useEffect(() => {
    let active = true;
    void fetchRemoteOverrideForGame("move-2", activeDateKey).then(
      (remote) => {
        if (!active || !isMoveTwoPuzzle(remote)) return;
        if (computePuzzleContentHash(remote) !== puzzleHash) {
          applyNewPuzzle(remote);
        }
      }
    );

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
    };
  }, []);

  const showTransientFeedback = useCallback(
    (kind: "bump" | "hazard" | "portal", message: string) => {
      setFeedback({ kind, message });
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setFeedback(null);
      }, 1800);
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

  const handleMove = useCallback(
    (dir: MoveTwoDirection) => {
      if (status !== "playing") return;

      const outcome = stepMoveTwoDomino(puzzle, domino, dir);
      if (outcome.kind === "bump") {
        setBumping(true);
        setTimeout(() => setBumping(false), 260);
        showTransientFeedback("bump", "Blocked by solid border or wall.");
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
        const entryState = faceEntries[domino.face] ?? puzzle.start;
        setBumping(true);
        setTimeout(() => setBumping(false), 260);
        setDomino(entryState);
        showTransientFeedback(
          "hazard",
          `Hazard tile! Reset to Face ${domino.face + 1} entry.`
        );
        persist(entryState, nextMoves, conqueredMax, faceEntries, "playing");
        return;
      }

      if (outcome.kind === "portal") {
        const nextConquered = Math.max(conqueredMax, outcome.toFace);
        const nextEntries = {
          ...faceEntries,
          [outcome.toFace]:
            faceEntries[outcome.toFace] ?? outcome.next,
        };
        setDomino(outcome.next);
        setConqueredMax(nextConquered);
        setFaceEntries(nextEntries);
        showTransientFeedback(
          "portal",
          `Rolled onto Face ${outcome.toFace + 1}!`
        );
        persist(outcome.next, nextMoves, nextConquered, nextEntries, "playing");
        return;
      }

      if (outcome.kind === "won") {
        const stars = computeMoveTwoStars(nextMoves, puzzle.par);
        setDomino(outcome.next);
        setConqueredMax(5);
        setStatus("won");
        setFeedback(null);
        persist(outcome.next, nextMoves, 5, faceEntries, "won");
        recordMoveTwoCompletion(activeDateKey, nextMoves, puzzle.par, stars);
        return;
      }

      // Normal move within the active face
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
    ]
  );

  const handleUndo = useCallback(() => {
    if (status !== "playing" || history.length === 0) return;
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
  }, [status, history, persist]);

  const handleResetFace = useCallback(() => {
    if (status !== "playing") return;
    const entry = faceEntries[domino.face] ?? puzzle.start;
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
    showTransientFeedback("portal", `Reset to Face ${domino.face + 1} start.`);
    persist(entry, moves, conqueredMax, faceEntries, "playing");
  }, [
    status,
    faceEntries,
    domino,
    puzzle.start,
    moves,
    conqueredMax,
    persist,
    showTransientFeedback,
  ]);

  const handleRestartFull = useCallback(() => {
    clearGameProgress("move-2", activeDateKey);
    setDomino(puzzle.start);
    setMoves(0);
    setConqueredMax(0);
    setFaceEntries({ 0: puzzle.start });
    setHistory([]);
    setStatus("playing");
    setFeedback(null);
  }, [activeDateKey, puzzle.start]);

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
  const occupiedKeys = useMemo(
    () => new Set(getDominoCells(domino).map((c) => `${c.r},${c.c}`)),
    [domino]
  );
  const targetKeys = useMemo(
    () => new Set(getDominoCells(puzzle.target).map((c) => `${c.r},${c.c}`)),
    [puzzle.target]
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
          tagline="Roll the 1×1×2 domino across 6 cube faces to land on the Red Target."
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
      ? "Standing 1×1"
      : domino.posture === "FLAT_H"
      ? "Flat 1×2 ↔"
      : "Flat 2×1 ↕";

  const targetPostureLabel =
    puzzle.target.posture === "UPRIGHT"
      ? "Stand Upright (1×1) on Red"
      : puzzle.target.posture === "FLAT_H"
      ? "Lie Flat (1×2 ↔) on Red"
      : "Lie Flat (2×1 ↕) on Red";

  return (
    <GameShell
      gameSlug="move-2"
      gameTitle="Move Two"
      puzzleNumber={puzzle.puzzleNumber}
      dateKey={activeDateKey}
      author={puzzle.author}
      subtitle="Roll the 3D domino across 6 cube faces to reach the Red Target."
      helpOpen={helpOpen}
      onHelpOpenChange={setHelpOpen}
      statsOpen={statsOpen}
      onStatsOpenChange={setStatsOpen}
    >
      <div
        className="mx-auto max-w-lg space-y-4 select-none"
        data-testid="move-two-board"
      >
        {/* Top Status + Mini 3D Isometric Cube HUD */}
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
              Domino: <span className="font-bold text-black">{postureLabel}</span>
              {domino.face === 5 && (
                <span className="ml-2 text-red-700 font-bold">
                  · Goal: {targetPostureLabel}
                </span>
              )}
            </p>
          </div>

          <IsometricCubeHud
            activeFace={domino.face}
            conqueredMax={conqueredMax}
            won={status === "won"}
          />
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
            <p className="text-xs font-semibold text-neutral-500">
              Roll cleanly across the{" "}
              <span className="font-black text-emerald-800 uppercase">
                {activeFace.exitEdge}
              </span>{" "}
              portal edge to enter Face {domino.face + 2}.
            </p>
          ) : (
            <p className="text-xs font-bold text-red-700 flex items-center gap-1">
              <Flag className="h-3.5 w-3.5" /> Final Face! {targetPostureLabel}
            </p>
          )}
        </div>

        {/* 2D Active 3x3 Face with Portal Edge Indicators & Touch Swipe */}
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
          className={cn(
            "relative mx-auto w-full max-w-[330px] flex flex-col items-center transition-transform duration-150",
            bumping && "translate-x-1 -translate-y-0.5"
          )}
        >
          {/* Top Portal Indicator */}
          {activeFace.exitEdge === "up" ? (
            <div className="mb-1.5 inline-flex items-center gap-1 rounded-full border-2 border-black bg-[#b6df52] px-3 py-0.5 text-xs font-black text-black shadow-[0_2px_0_#111]">
              <ArrowUp className="h-3.5 w-3.5" /> Portal → Face {domino.face + 2}
            </div>
          ) : (
            <div className="mb-1.5 h-5" />
          )}

          <div className="flex items-center justify-center w-full gap-1.5">
            {/* Left Portal Indicator */}
            {activeFace.exitEdge === "left" ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-black bg-[#b6df52] px-1.5 py-3 text-[10px] font-black text-black shadow-[0_2px_0_#111] shrink-0">
                <ArrowLeft className="h-3.5 w-3.5 mb-0.5" />
                <span>F{domino.face + 2}</span>
              </div>
            ) : (
              <div className="w-7 shrink-0" />
            )}

            {/* 3x3 Grid Stage */}
            <div
              key={`face-${domino.face}`}
              className={cn(
                "grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[#FAF9F6] border-4 border-black shadow-[0_6px_0_#111111] flex-1 aspect-square max-w-[264px] animate-in fade-in zoom-in-95 duration-150",
                activeFace.exitEdge === "up" && "border-t-emerald-500 border-t-dashed",
                activeFace.exitEdge === "down" && "border-b-emerald-500 border-b-dashed",
                activeFace.exitEdge === "left" && "border-l-emerald-500 border-l-dashed",
                activeFace.exitEdge === "right" && "border-r-emerald-500 border-r-dashed"
              )}
            >
              {[0, 1, 2].map((r) =>
                [0, 1, 2].map((c) => {
                  const key = `${r},${c}`;
                  const cellType = activeFace.grid[r]![c];
                  const hasDomino = occupiedKeys.has(key);
                  const isTarget = domino.face === 5 && targetKeys.has(key);

                  return (
                    <div
                      key={key}
                      data-testid={`m2-cell-${r}-${c}`}
                      className={cn(
                        "relative rounded-xl border-2 flex items-center justify-center transition-all",
                        cellType === "wall"
                          ? "bg-neutral-900 border-black text-neutral-500"
                          : cellType === "hazard"
                          ? "bg-red-50/80 border-red-300 border-dashed text-red-600"
                          : isTarget
                          ? "bg-red-500/15 border-red-600 text-red-700"
                          : "bg-white border-neutral-300"
                      )}
                    >
                      {cellType === "wall" && (
                        <span
                          className="h-5 w-5 rounded-sm bg-neutral-700 border border-neutral-600"
                          aria-label="Solid wall"
                        />
                      )}
                      {cellType === "hazard" && (
                        <X className="h-6 w-6 stroke-[3] text-red-500" aria-label="Hazard hole" />
                      )}
                      {isTarget && !hasDomino && (
                        <div className="flex flex-col items-center justify-center text-center">
                          <span className="h-4 w-4 rounded-sm bg-red-600 border border-black block" />
                          <span className="text-[9px] font-black uppercase text-red-800 mt-0.5">
                            {puzzle.target.posture === "UPRIGHT" ? "1×1" : "2×1"}
                          </span>
                        </div>
                      )}
                      {hasDomino && (
                        <div
                          data-testid={`m2-domino-${r}-${c}`}
                          className={cn(
                            "inset-1 absolute rounded-lg border-2 border-black flex items-center justify-center font-mono font-black transition-all",
                            status === "won"
                              ? "bg-[#2ECC71] text-black shadow-[0_3px_0_#111]"
                              : domino.posture === "UPRIGHT"
                              ? "bg-[#111111] text-white shadow-[0_4px_0_#52525b] scale-[1.03]"
                              : "bg-[#b6df52] text-black shadow-[0_2px_0_#111]"
                          )}
                        >
                          {domino.posture === "UPRIGHT" ? (
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-[#b6df52]" />
                          ) : (
                            <span className="h-2.5 w-2.5 rounded-full bg-black" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Portal Indicator */}
            {activeFace.exitEdge === "right" ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-black bg-[#b6df52] px-1.5 py-3 text-[10px] font-black text-black shadow-[0_2px_0_#111] shrink-0">
                <ArrowRight className="h-3.5 w-3.5 mb-0.5" />
                <span>F{domino.face + 2}</span>
              </div>
            ) : (
              <div className="w-7 shrink-0" />
            )}
          </div>

          {/* Bottom Portal Indicator */}
          {activeFace.exitEdge === "down" ? (
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border-2 border-black bg-[#b6df52] px-3 py-0.5 text-xs font-black text-black shadow-[0_2px_0_#111]">
              <ArrowDown className="h-3.5 w-3.5" /> Portal → Face {domino.face + 2}
            </div>
          ) : (
            <div className="mt-1.5 h-5" />
          )}
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
              All 6 cube faces conquered on Move Two #{puzzle.puzzleNumber} (&ldquo;
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

            <p className="text-center text-[11px] text-neutral-400 font-medium">
              Use Arrow keys / WASD, swipe the board, or tap the D-Pad · Walls ⬛ block · Hazards ✕ reset face
            </p>
          </div>
        )}
      </div>
    </GameShell>
  );
}
