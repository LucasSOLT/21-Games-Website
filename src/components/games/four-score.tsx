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
import {
  AlertTriangle,
  Calendar,
  Lightbulb,
  RotateCcw,
  Trophy,
  Undo2,
} from "lucide-react";
import {
  FOUR_SCORE_TARGET,
  applyBinaryFourScore,
  applyUnaryFourScore,
  buildFourScoreFormulaBlueprint,
  buildFourScoreShareText,
  defaultRevealedOperandCount,
  isUnaryOperator,
  type FourScoreOperator,
  type FourScorePuzzle,
} from "@/data/puzzles/four-score";
import { getDailyPuzzleForGame } from "@/lib/daily-engine";
import {
  isGameTimerExternallyPaused,
  useLiveLocalDateKey,
} from "@/hooks/use-live-date-key";
import {
  playErrorSfx,
  playRevealSfx,
  playSnapSfx,
  playTapSfx,
  playWinChimeSfx,
} from "@/lib/game-sfx";
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
import { WinFlourish } from "./win-flourish";
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
  extraHintNumbers?: number;
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
  const liveTodayKey = useLiveLocalDateKey();
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
  const [extraHintNumbers, setExtraHintNumbers] = useState<number>(
    saved?.extraHintNumbers ?? 0
  );
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);

  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const digitBufferRef = useRef<string>("");
  const digitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedRef = useRef(false);

  const current = history[history.length - 1]!;
  const unusedOpsCount = current.ops.filter((o) => !o.used).length;
  const fullBoardUsed = current.tiles.length === 1 && unusedOpsCount === 0;
  const won = fullBoardUsed && current.tiles[0]!.value === FOUR_SCORE_TARGET;
  const solved = won;
  const missedFinal = fullBoardUsed && current.tiles[0]!.value !== FOUR_SCORE_TARGET;
  const hasSavedProgress = history.length > 1;

  const baseRevealedCount = defaultRevealedOperandCount(puzzle.digits.length);
  const maxRevealableCount = Math.max(1, puzzle.digits.length - 1);
  const totalRevealedCount = Math.min(
    maxRevealableCount,
    baseRevealedCount + extraHintNumbers
  );
  const canRevealMoreHints = !won && totalRevealedCount < maxRevealableCount;

  const formulaBlueprint = useMemo(
    () =>
      won
        ? puzzle.canonicalEquation
        : buildFourScoreFormulaBlueprint(puzzle, extraHintNumbers),
    [won, puzzle, extraHintNumbers]
  );

  useEffect(
    () => () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
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
      extraHintNumbers,
    });
  }, [dateKey, puzzle.id, puzzleHash, history, undoCount, extraHintNumbers]);

  // Record win once on reaching 80 with full board used (never double-counted in Practice mode).
  useEffect(() => {
    if (!won || recordedRef.current) return;
    recordedRef.current = true;
    if (!isDateCompleted("four-score", dateKey)) {
      recordGameWin("four-score", dateKey, 0);
    }
  }, [won, dateKey]);

  const triggerIllegal = useCallback((msg: string) => {
    playErrorSfx();
    setErrorMsg(msg);
    setShaking(true);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 1500);
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
      const isFinalStep = nextTiles.length === 1 && nextOps.every((o) => o.used);
      if (isFinalStep && nextTiles[0]!.value === FOUR_SCORE_TARGET) {
        playSnapSfx(history.length);
        playWinChimeSfx();
      } else if (isFinalStep) {
        playErrorSfx();
      } else {
        playSnapSfx(history.length);
      }
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
        playTapSfx(0.9);
        setSelectedTileId(null);
        setSelectedOpId(null);
        return;
      }

      // If a first tile AND binary operator are armed, combine!
      if (selectedTileId && armedOp && !isUnaryOperator(armedOp.op)) {
        const firstTile = current.tiles.find((t) => t.id === selectedTileId);
        if (!firstTile) {
          playTapSfx();
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
        const isFinalStep = nextTiles.length === 1 && nextOps.every((o) => o.used);
        if (isFinalStep && nextTiles[0]!.value === FOUR_SCORE_TARGET) {
          playSnapSfx(history.length);
          playWinChimeSfx();
        } else if (isFinalStep) {
          playErrorSfx();
        } else {
          playSnapSfx(history.length);
        }
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
      playTapSfx();
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
        playTapSfx(0.9);
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
      playTapSfx(1.08);
      setSelectedOpId(badge.id);
    },
    [won, selectedOpId, selectedTileId, current.tiles, applyUnaryStep]
  );

  const handleUndo = useCallback(() => {
    if (history.length <= 1 || won) return;
    playTapSfx(0.9);
    setHistory((h) => h.slice(0, -1));
    setUndoCount((c) => c + 1);
    setSelectedTileId(null);
    setSelectedOpId(null);
    setErrorMsg(null);
  }, [history.length, won]);

  const handleReset = useCallback(() => {
    if (history.length <= 1 || won) return;
    playTapSfx(0.85);
    setHistory([initialSnapshot(puzzle)]);
    setUndoCount((c) => c + 1);
    setSelectedTileId(null);
    setSelectedOpId(null);
    setErrorMsg(null);
  }, [history.length, won, puzzle]);

  const handlePracticeReset = useCallback(() => {
    playTapSfx();
    recordedRef.current = true;
    setHistory([initialSnapshot(puzzle)]);
    setSelectedTileId(null);
    setSelectedOpId(null);
    setErrorMsg(null);
  }, [puzzle]);

  // Desktop keyboard shortcuts when playing (and no modal/input is focused):
  // digits 0–9, +, -, * (x), /, ^, s (square root √ / square), Backspace/u (Undo), Escape (Clear/Reset).
  useEffect(() => {
    if (!splashDismissed || won) return;

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

      const key = e.key;

      if (key === "Backspace" || key === "u" || key === "U") {
        if (history.length > 1) {
          e.preventDefault();
          handleUndo();
        }
        return;
      }

      if (key === "Escape") {
        if (history.length > 1) {
          e.preventDefault();
          handleReset();
        } else if (selectedTileId !== null || selectedOpId !== null) {
          e.preventDefault();
          playTapSfx(0.9);
          setSelectedTileId(null);
          setSelectedOpId(null);
        }
        return;
      }

      const unusedOps = current.ops.filter((o) => !o.used);
      let matchedOp: BoardOpBadge | undefined;
      if (key === "+") {
        matchedOp = unusedOps.find((o) => o.op === "+");
      } else if (key === "-") {
        matchedOp = unusedOps.find(
          (o) => o.op === "−" || (o.op as string) === "-"
        );
      } else if (key === "*" || key === "x" || key === "X") {
        matchedOp = unusedOps.find(
          (o) => o.op === "×" || (o.op as string) === "*"
        );
      } else if (key === "/") {
        matchedOp = unusedOps.find(
          (o) => o.op === "÷" || (o.op as string) === "/"
        );
      } else if (key === "^") {
        matchedOp =
          unusedOps.find((o) => o.op === "xʸ") ??
          unusedOps.find((o) => o.op === "x²");
      } else if (key === "s" || key === "S") {
        matchedOp =
          unusedOps.find((o) => String(o.op).includes("√")) ??
          unusedOps.find((o) => isUnaryOperator(o.op));
      }

      if (matchedOp) {
        e.preventDefault();
        digitBufferRef.current = "";
        handleOpClick(matchedOp);
        return;
      }

      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        const armedBinary =
          selectedOpId !== null &&
          Boolean(
            current.ops.find(
              (o) => o.id === selectedOpId && !o.used && !isUnaryOperator(o.op)
            )
          );
        const pool =
          armedBinary && selectedTileId
            ? current.tiles.filter((t) => t.id !== selectedTileId)
            : current.tiles;

        const nextBuf = !armedBinary ? `${digitBufferRef.current}${key}` : key;
        digitBufferRef.current = nextBuf;
        if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
        digitTimerRef.current = setTimeout(() => {
          digitBufferRef.current = "";
        }, 550);

        let candidate: BoardTile | undefined;
        if (nextBuf.length > 1) {
          candidate = pool.find((t) => String(t.value) === nextBuf);
        }
        if (!candidate) {
          const exactMatches = pool.filter((t) => String(t.value) === key);
          if (exactMatches.length > 0) {
            const curIdx = exactMatches.findIndex((t) => t.id === selectedTileId);
            candidate =
              !armedBinary && curIdx >= 0
                ? exactMatches[(curIdx + 1) % exactMatches.length]
                : exactMatches[0];
          } else {
            const prefixMatches = pool.filter((t) =>
              String(t.value).startsWith(key)
            );
            if (prefixMatches.length > 0) {
              const curIdx = prefixMatches.findIndex(
                (t) => t.id === selectedTileId
              );
              candidate =
                !armedBinary && curIdx >= 0
                  ? prefixMatches[(curIdx + 1) % prefixMatches.length]
                  : prefixMatches[0];
            }
          }
        }

        if (candidate) {
          if (armedBinary) {
            digitBufferRef.current = "";
          }
          handleTileClick(candidate);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    splashDismissed,
    won,
    history.length,
    selectedTileId,
    selectedOpId,
    current.ops,
    current.tiles,
    handleUndo,
    handleReset,
    handleOpClick,
    handleTileClick,
  ]);

  const liveEquationText = useMemo(() => {
    if (won) {
      return `${current.tiles[0]!.expr} = ${FOUR_SCORE_TARGET}`;
    }
    if (missedFinal) {
      return `${current.tiles[0]!.expr} = ${current.tiles[0]!.value} (target ${FOUR_SCORE_TARGET})`;
    }
    const activeTile = selectedTileId
      ? current.tiles.find((t) => t.id === selectedTileId) ?? null
      : null;
    const activeOp = selectedOpId
      ? current.ops.find((o) => o.id === selectedOpId && !o.used) ?? null
      : null;

    const otherCombined = current.tiles
      .filter((t) => t.id !== activeTile?.id && t.expr !== String(t.value))
      .map((t) => `${t.expr} = ${t.value}`);

    if (activeTile && activeOp) {
      const sym = activeOp.op === "xʸ" ? "^" : activeOp.op;
      const activeDraft = `(${activeTile.expr} ${sym} __)`;
      return otherCombined.length > 0
        ? `${otherCombined.join(" · ")}  ·  ${activeDraft}`
        : activeDraft;
    }
    if (activeTile) {
      const activeDraft =
        activeTile.expr !== String(activeTile.value)
          ? `${activeTile.expr} = ${activeTile.value}  →  pick next operator`
          : `(${activeTile.expr} ○ __)  →  pick an operator`;
      return otherCombined.length > 0
        ? `${otherCombined.join(" · ")}  ·  ${activeDraft}`
        : activeDraft;
    }

    const allCombined = current.tiles
      .filter((t) => t.expr !== String(t.value))
      .map((t) => `${t.expr} = ${t.value}`);
    if (allCombined.length > 0) {
      return allCombined.join("  ·  ");
    }
    if (current.lastExpr) return current.lastExpr;
    return "Tap a starting number tile and operator to build toward 80.";
  }, [
    won,
    missedFinal,
    current.tiles,
    current.ops,
    current.lastExpr,
    selectedTileId,
    selectedOpId,
  ]);

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
  const shareUrl =
    dateKey !== liveTodayKey
      ? `https://21games.ai/games/four-score?date=${dateKey}`
      : "https://21games.ai/games/four-score";

  if (!splashDismissed) {
    return (
      <GameShell
        gameSlug="four-score"
        gameTitle="Four Score"
        puzzleNumber={puzzle.puzzleNumber}
        dateKey={dateKey}
        author={puzzle.author}
      >
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
          onPlay={() => {
            playTapSfx();
            setSplashDismissed(true);
          }}
        />
      </GameShell>
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
      <WinFlourish active={solved} />
      <div className="max-w-lg mx-auto px-3 sm:px-4 py-2 space-y-4">
        {/* Top-Left Formula Guide + Target 80 + Live Equation Builder Banner */}
        <div
          className={cn(
            "rounded-2xl border-2 border-black bg-white p-3.5 sm:p-4 space-y-2.5 shadow-[4px_4px_0px_#000]",
            shaking && "animate-bounce motion-reduce:animate-none border-red-600"
          )}
          data-testid="four-score-banner"
        >
          <div className="flex items-start justify-between gap-3">
            {/* Top-Left: Formula Blueprint Guide (starting number + operator shown!) */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                  Formula Guide
                </span>
                {canRevealMoreHints && (
                  <button
                    type="button"
                    onClick={() => {
                      playRevealSfx();
                      setExtraHintNumbers((n) => n + 1);
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-black bg-[#F9D423] hover:bg-[#F9D423]/80 px-3 py-1 text-xs font-black text-black shadow-[1px_1px_0px_#000] cursor-pointer"
                    data-testid="four-score-reveal-hint"
                    title="Reveal one more number in the formula guide"
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    +1 #
                  </button>
                )}
              </div>
              <p
                className="font-mono font-black text-xs sm:text-sm text-neutral-900 bg-neutral-100 border border-black/20 rounded-lg px-2.5 py-1.5 break-words"
                data-testid="four-score-formula-guide"
              >
                {formulaBlueprint}
              </p>
              <p className="text-[10px] font-semibold text-neutral-500">
                Any valid order using every tile &amp; operator to reach 80 wins!
              </p>
            </div>

            {/* Top-Right: Target 80 + Remaining Inventory */}
            <div className="shrink-0 text-right space-y-1">
              <div className="inline-flex flex-col items-end rounded-xl border-2 border-black bg-[#FFFBE6] px-2.5 py-1 shadow-[2px_2px_0px_#000]">
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-800">
                  Target
                </span>
                <span className="font-headline font-black text-2xl sm:text-3xl leading-none text-neutral-900">
                  {FOUR_SCORE_TARGET}
                </span>
              </div>
              <div className="text-[11px] font-bold text-neutral-600 leading-tight">
                <div>
                  Tiles: <strong>{current.tiles.length}</strong>/{puzzle.digits.length}
                </div>
                <div>
                  Ops: <strong>{unusedOpsCount}</strong>/{puzzle.operators.length}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-0.5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-500">
              Your Live Formula
            </p>
            <div
              className="rounded-xl bg-[#fffbe6] border-2 border-black/20 px-3 py-2 font-mono text-xs sm:text-sm font-bold text-neutral-900 break-words"
              data-testid="four-score-live-equation"
            >
              {liveEquationText}
            </div>
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
                  aria-pressed={isSelected}
                  onClick={() => handleTileClick(tile)}
                  data-testid={`four-score-tile-${tile.id}`}
                  className={cn(
                    "min-h-20 rounded-2xl border-2 border-black px-3 py-2.5 flex flex-col items-center justify-center transition-all motion-reduce:transition-none select-none cursor-pointer disabled:cursor-default",
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
                  aria-pressed={isSelected}
                  onClick={() => handleOpClick(badge)}
                  data-testid={`four-score-op-${badge.id}`}
                  className={cn(
                    "h-12 min-w-14 px-3.5 rounded-full border-2 font-headline font-black text-lg transition-all motion-reduce:transition-none select-none cursor-pointer",
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
              url={shareUrl}
            />

            <Button
              type="button"
              variant="outline"
              onClick={handlePracticeReset}
              className="w-full border-2 border-black font-bold"
              data-testid="four-score-practice-reset"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Play Again (Practice)
            </Button>

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
