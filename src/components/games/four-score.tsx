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
import { AlertTriangle, Calendar, RotateCcw, Trophy, Undo2 } from "lucide-react";
import {
  FOUR_SCORE_TARGET,
  applyBinaryFourScore,
  applyUnaryFourScore,
  buildFourScoreShareText,
  isUnaryOperator,
  type FourScoreOperator,
  type FourScorePuzzle,
} from "@/data/puzzles/four-score";
import { getDailyPuzzleForGame, getLocalDateKey } from "@/lib/daily-engine";
import {
  getAdminOverridesForGame,
  getGameProgress,
  isDateCompleted,
  recordGameWin,
  saveGameProgress,
} from "@/lib/game-storage";
import { computePuzzleContentHash } from "@/lib/seeded-random";
import { GameShell } from "@/components/game-shell";
import { GameSplashScreen } from "@/components/game-splash-screen";
import { Button } from "@/components/ui/button";
import { ResultShareButtons } from "./result-share-buttons";
import { cn } from "@/lib/utils";

const subscribeNoop = () => () => {};

interface BoardTile {
  id: string;
  value: number;
  expr: string;
}

interface BoardOpBadge {
  id: string;
  op: FourScoreOperator;
  used: boolean;
}

interface BoardStepSnapshot {
  tiles: BoardTile[];
  ops: BoardOpBadge[];
  lastExpr: string;
}

interface SavedFourScoreProgress {
  puzzleId: string;
  puzzleHash: string;
  history: BoardStepSnapshot[];
  undoCount: number;
}

function isValidDateKey(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function initialSnapshot(puzzle: FourScorePuzzle): BoardStepSnapshot {
  return {
    tiles: puzzle.digits.map((d, idx) => ({
      id: `t-${idx}`,
      value: d,
      expr: String(d),
    })),
    ops: puzzle.operators.map((op, idx) => ({
      id: `o-${idx}`,
      op,
      used: false,
    })),
    lastExpr: "",
  };
}

export function FourScoreGame() {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center font-headline font-black text-xl">
        Loading Four Score...
      </div>
    );
  }
  return (
    <Suspense fallback={null}>
      <FourScoreDaily />
    </Suspense>
  );
}

function FourScoreDaily() {
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
    const resolved = getDailyPuzzleForGame<FourScorePuzzle>(
      "four-score",
      dateKey,
      getAdminOverridesForGame("four-score")
    );
    return resolved!.puzzle;
  }, [dateKey, syncVersion]);

  const hash = useMemo(() => computePuzzleContentHash(puzzle), [puzzle]);

  return (
    <FourScoreBoard
      key={`${puzzle.id}:${hash}:${dateKey}`}
      puzzle={puzzle}
      puzzleHash={hash}
      dateKey={dateKey}
    />
  );
}

interface FourScoreBoardProps {
  puzzle: FourScorePuzzle;
  puzzleHash: string;
  dateKey: string;
}

function FourScoreBoard({ puzzle, puzzleHash, dateKey }: FourScoreBoardProps) {
  const saved = useMemo<SavedFourScoreProgress | null>(() => {
    const s = getGameProgress<SavedFourScoreProgress>(
      "four-score",
      dateKey,
      puzzle.id
    );
    if (
      !s ||
      s.puzzleHash !== puzzleHash ||
      !Array.isArray(s.history) ||
      s.history.length === 0
    ) {
      return null;
    }
    return s;
  }, [dateKey, puzzle.id, puzzleHash]);

  const [history, setHistory] = useState<BoardStepSnapshot[]>(
    saved?.history ?? [initialSnapshot(puzzle)]
  );
  const [undoCount, setUndoCount] = useState<number>(saved?.undoCount ?? 0);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);

  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedRef = useRef(false);

  const current = history[history.length - 1]!;
  const unusedOpsCount = current.ops.filter((o) => !o.used).length;
  const fullBoardUsed = current.tiles.length === 1 && unusedOpsCount === 0;
  const won = fullBoardUsed && current.tiles[0]!.value === FOUR_SCORE_TARGET;
  const missedFinal = fullBoardUsed && current.tiles[0]!.value !== FOUR_SCORE_TARGET;
  const hasSavedProgress = history.length > 1;

  useEffect(
    () => () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    },
    []
  );

  // Persist board history per date + puzzle hash.
  useEffect(() => {
    saveGameProgress<SavedFourScoreProgress>("four-score", dateKey, {
      puzzleId: puzzle.id,
      puzzleHash,
      history,
      undoCount,
    });
  }, [dateKey, puzzle.id, puzzleHash, history, undoCount]);

  // Record win once on reaching 80 with full board used.
  useEffect(() => {
    if (!won || recordedRef.current) return;
    recordedRef.current = true;
    if (!isDateCompleted("four-score", dateKey)) {
      recordGameWin("four-score", dateKey, 0);
    }
  }, [won, dateKey]);

  const triggerIllegal = useCallback((msg: string) => {
    setErrorMsg(msg);
    setShaking(true);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 2400);
    shakeTimerRef.current = setTimeout(() => setShaking(false), 450);
  }, []);

  const applyUnaryStep = useCallback(
    (tile: BoardTile, opBadge: BoardOpBadge) => {
      const res = applyUnaryFourScore(tile.value, tile.expr, "x²");
      if (!res.ok) {
        triggerIllegal(res.error);
        return;
      }
      const nextId = `t-s${history.length}`;
      const nextTiles = current.tiles.map((t) =>
        t.id === tile.id ? { id: nextId, value: res.value, expr: res.expr } : t
      );
      const nextOps = current.ops.map((o) =>
        o.id === opBadge.id ? { ...o, used: true } : o
      );
      setHistory([
        ...history,
        {
          tiles: nextTiles,
          ops: nextOps,
          lastExpr: `${res.expr} = ${res.value}`,
        },
      ]);
      setSelectedTileId(nextTiles.length > 1 ? nextId : null);
      setSelectedOpId(null);
      setErrorMsg(null);
    },
    [current.ops, current.tiles, history, triggerIllegal]
  );

  const handleTileClick = useCallback(
    (tile: BoardTile) => {
      if (won) return;
      const armedOp = selectedOpId
        ? current.ops.find((o) => o.id === selectedOpId && !o.used) ?? null
        : null;

      // If unary x² was armed first, clicking a tile squares it immediately.
      if (armedOp && isUnaryOperator(armedOp.op)) {
        applyUnaryStep(tile, armedOp);
        return;
      }

      // Clicking the already-selected first tile deselects it.
      if (selectedTileId === tile.id) {
        setSelectedTileId(null);
        setSelectedOpId(null);
        return;
      }

      // If a first tile AND binary operator are armed, combine!
      if (selectedTileId && armedOp && !isUnaryOperator(armedOp.op)) {
        const firstTile = current.tiles.find((t) => t.id === selectedTileId);
        if (!firstTile) {
          setSelectedTileId(tile.id);
          setSelectedOpId(null);
          return;
        }
        const res = applyBinaryFourScore(
          firstTile.value,
          firstTile.expr,
          armedOp.op,
          tile.value,
          tile.expr
        );
        if (!res.ok) {
          triggerIllegal(res.error);
          setSelectedOpId(null);
          return;
        }
        const nextId = `t-s${history.length}`;
        const nextTiles: BoardTile[] = [];
        let inserted = false;
        for (const t of current.tiles) {
          if (t.id === firstTile.id) {
            nextTiles.push({ id: nextId, value: res.value, expr: res.expr });
            inserted = true;
          } else if (t.id === tile.id) {
            continue;
          } else {
            nextTiles.push(t);
          }
        }
        if (!inserted) {
          nextTiles.push({ id: nextId, value: res.value, expr: res.expr });
        }
        const nextOps = current.ops.map((o) =>
          o.id === armedOp.id ? { ...o, used: true } : o
        );
        setHistory([
          ...history,
          {
            tiles: nextTiles,
            ops: nextOps,
            lastExpr: `${res.expr} = ${res.value}`,
          },
        ]);
        setSelectedTileId(nextTiles.length > 1 ? nextId : null);
        setSelectedOpId(null);
        setErrorMsg(null);
        return;
      }

      // Otherwise select/switch the active first tile.
      setSelectedTileId(tile.id);
    },
    [
      won,
      selectedOpId,
      selectedTileId,
      current.ops,
      current.tiles,
      history,
      applyUnaryStep,
      triggerIllegal,
    ]
  );

  const handleOpClick = useCallback(
    (badge: BoardOpBadge) => {
      if (won || badge.used) return;
      if (selectedOpId === badge.id) {
        setSelectedOpId(null);
        return;
      }
      // Unary x² with an active tile transforms that tile in place immediately!
      if (isUnaryOperator(badge.op) && selectedTileId) {
        const activeTile = current.tiles.find((t) => t.id === selectedTileId);
        if (activeTile) {
          applyUnaryStep(activeTile, badge);
          return;
        }
      }
      setSelectedOpId(badge.id);
    },
    [won, selectedOpId, selectedTileId, current.tiles, applyUnaryStep]
  );

  const handleUndo = useCallback(() => {
    if (history.length <= 1 || won) return;
    setHistory((h) => h.slice(0, -1));
    setUndoCount((c) => c + 1);
    setSelectedTileId(null);
    setSelectedOpId(null);
    setErrorMsg(null);
  }, [history.length, won]);

  const handleReset = useCallback(() => {
    if (history.length <= 1 || won) return;
    setHistory([initialSnapshot(puzzle)]);
    setUndoCount((c) => c + 1);
    setSelectedTileId(null);
    setSelectedOpId(null);
    setErrorMsg(null);
  }, [history.length, won, puzzle]);

  const liveEquationText = useMemo(() => {
    if (won) {
      return `${current.tiles[0]!.expr} = ${FOUR_SCORE_TARGET}`;
    }
    const activeTile = selectedTileId
      ? current.tiles.find((t) => t.id === selectedTileId)
      : null;
    const activeOp = selectedOpId
      ? current.ops.find((o) => o.id === selectedOpId)
      : null;
    if (activeTile && activeOp) {
      const sym = activeOp.op === "xʸ" ? "^" : activeOp.op;
      return `${activeTile.expr} ${sym} ?`;
    }
    if (activeTile && activeTile.expr !== String(activeTile.value)) {
      return `${activeTile.expr} = ${activeTile.value}`;
    }
    if (current.lastExpr) return current.lastExpr;
    return "Select a number tile, then an operator to build toward 80.";
  }, [won, current.tiles, current.ops, current.lastExpr, selectedTileId, selectedOpId]);

  const shareText = useMemo(
    () =>
      buildFourScoreShareText({
        puzzleNumber: puzzle.puzzleNumber,
        digitsCount: puzzle.digits.length,
        operatorsCount: puzzle.operators.length,
        undoCount,
      }),
    [puzzle.puzzleNumber, puzzle.digits.length, puzzle.operators.length, undoCount]
  );

  if (!splashDismissed) {
    return (
      <GameSplashScreen
        gameSlug="four-score"
        gameTitle="Four Score"
        tagline="Use every number tile and operator badge once to reach the exact score of 80."
        theme={puzzle.title}
        author={puzzle.author}
        puzzleNumber={puzzle.puzzleNumber}
        dateKey={dateKey}
        showCreate={false}
        isCompletedToday={isDateCompleted("four-score", dateKey) || won}
        hasSavedProgress={hasSavedProgress && !won}
        onPlay={() => setSplashDismissed(true)}
      />
    );
  }

  return (
    <GameShell
      gameSlug="four-score"
      gameTitle="Four Score"
      puzzleNumber={puzzle.puzzleNumber}
      dateKey={dateKey}
      author={puzzle.author}
    >
      <div className="max-w-lg mx-auto px-3 sm:px-4 py-2 space-y-4">
        {/* Target 80 + Live Equation Builder Banner (Q38) */}
        <div
          className={cn(
            "rounded-2xl border-2 border-black bg-white p-3.5 sm:p-4 space-y-2 shadow-[4px_4px_0px_#000]",
            shaking && "animate-bounce border-red-600"
          )}
          data-testid="four-score-banner"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">
                Target Score
              </p>
              <p className="font-headline font-black text-3xl sm:text-4xl leading-none text-neutral-900">
                {FOUR_SCORE_TARGET}
              </p>
            </div>
            <div className="text-right text-xs font-bold text-neutral-600 space-y-0.5">
              <div>
                Tiles left: <strong>{current.tiles.length}</strong> / {puzzle.digits.length}
              </div>
              <div>
                Operators left: <strong>{unusedOpsCount}</strong> / {puzzle.operators.length}
              </div>
            </div>
          </div>

          <div
            className="rounded-xl bg-[#fffbe6] border-2 border-black/20 px-3 py-2 font-mono text-xs sm:text-sm font-bold text-neutral-900 break-words"
            data-testid="four-score-live-equation"
          >
            {liveEquationText}
          </div>

          {errorMsg && (
            <p
              role="alert"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600"
              data-testid="four-score-error"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {errorMsg}
            </p>
          )}

          {missedFinal && (
            <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-1.5">
              Full board combined to <strong>{current.tiles[0]!.value}</strong> instead of{" "}
              <strong>80</strong>. Use <strong>Undo Last Step</strong> or{" "}
              <strong>Reset Board</strong> to try another sequence!
            </p>
          )}
        </div>

        {/* Number Tiles Grid */}
        <div className="space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-wider text-neutral-600">
            Number Tiles (use all)
          </p>
          <div
            className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
            data-testid="four-score-tiles"
          >
            {current.tiles.map((tile) => {
              const isSelected = selectedTileId === tile.id;
              return (
                <button
                  key={tile.id}
                  type="button"
                  disabled={won}
                  onClick={() => handleTileClick(tile)}
                  data-testid={`four-score-tile-${tile.id}`}
                  className={cn(
                    "min-h-20 rounded-2xl border-2 border-black px-3 py-2.5 flex flex-col items-center justify-center transition-all select-none",
                    isSelected
                      ? "bg-[#F9D423] -translate-y-0.5 shadow-[4px_4px_0px_#000]"
                      : won
                      ? "bg-[#2ECC71] shadow-[4px_4px_0px_#000]"
                      : "bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000]"
                  )}
                >
                  <span className="font-headline font-black text-2xl sm:text-3xl tabular-nums">
                    {tile.value}
                  </span>
                  {tile.expr !== String(tile.value) && (
                    <span className="text-[10px] font-mono text-neutral-600 truncate max-w-full">
                      {tile.expr}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Single-Use Operator Badges */}
        <div className="space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-wider text-neutral-600">
            Single-Use Operators (use all)
          </p>
          <div
            className="flex flex-wrap gap-2 justify-center"
            data-testid="four-score-operators"
          >
            {current.ops.map((badge) => {
              const isSelected = selectedOpId === badge.id;
              return (
                <button
                  key={badge.id}
                  type="button"
                  disabled={badge.used || won}
                  onClick={() => handleOpClick(badge)}
                  data-testid={`four-score-op-${badge.id}`}
                  className={cn(
                    "h-12 min-w-14 px-3.5 rounded-full border-2 font-headline font-black text-lg transition-all select-none",
                    badge.used
                      ? "bg-neutral-200 border-neutral-300 text-neutral-400 line-through cursor-not-allowed"
                      : isSelected
                      ? "bg-black border-black text-[#F9D423] scale-105 shadow-[3px_3px_0px_#F9D423]"
                      : "bg-white border-black text-black hover:bg-[#F9D423]/40 shadow-[2px_2px_0px_#000]"
                  )}
                >
                  {badge.op}
                </button>
              );
            })}
          </div>
        </div>

        {/* Unlimited Zero-Penalty Undo & Reset Controls (Q38) */}
        {!won && (
          <div className="flex gap-2.5 pt-1">
            <Button
              type="button"
              variant="outline"
              disabled={history.length <= 1}
              onClick={handleUndo}
              className="flex-1 border-2 border-black font-bold"
              data-testid="four-score-undo"
            >
              <Undo2 className="h-4 w-4 mr-1.5" />
              Undo Last Step
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={history.length <= 1}
              onClick={handleReset}
              className="flex-1 border-2 border-black font-bold"
              data-testid="four-score-reset"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Reset Board
            </Button>
          </div>
        )}

        {/* Victory Modal / Card Showing Player Equation + Canonical Equation (Q39) */}
        {won && (
          <div
            className="rounded-2xl border-2 border-black bg-white p-4 sm:p-5 space-y-4 shadow-[4px_4px_0px_#000]"
            data-testid="four-score-victory"
          >
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F9D423] border border-black px-3 py-0.5 text-xs font-black">
                <Trophy className="h-3.5 w-3.5" />
                Four Score #{puzzle.puzzleNumber}
              </div>
              <h2 className="font-headline font-black text-2xl text-neutral-900">
                Exact 80 Reached!
              </h2>
            </div>

            <div className="space-y-2 text-xs">
              <div className="rounded-xl bg-[#2ECC71]/20 border border-black/30 p-2.5">
                <p className="font-extrabold uppercase tracking-wider text-neutral-600 mb-0.5">
                  Your Winning Equation
                </p>
                <p className="font-mono font-bold text-sm text-neutral-900 break-words">
                  {current.tiles[0]!.expr} = {FOUR_SCORE_TARGET}
                </p>
              </div>
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-2.5">
                <p className="font-extrabold uppercase tracking-wider text-neutral-500 mb-0.5">
                  Canonical Solution
                </p>
                <p className="font-mono font-semibold text-sm text-neutral-800 break-words">
                  {puzzle.canonicalEquation}
                </p>
              </div>
            </div>

            <ResultShareButtons
              title={`Four Score #${puzzle.puzzleNumber}`}
              text={shareText}
              url="https://21games.ai/games/four-score"
            />

            <div className="flex justify-center pt-1">
              <Link
                href="/games/four-score/archive"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-700 hover:text-black underline underline-offset-4"
              >
                <Calendar className="h-3.5 w-3.5" />
                Play past Four Score puzzles
              </Link>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}
