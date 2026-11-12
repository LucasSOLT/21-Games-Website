"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  HelpCircle,
  LifeBuoy,
  Lightbulb,
  Link2,
  Loader2,
  PlusCircle,
  RotateCcw,
  Settings,
  Share2,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { Connect5Puzzle } from "@/data/puzzles/connect-5";
import { getConnect5PuzzleForDate, getLocalDateKey } from "@/lib/daily-engine";
import {
  buildCustomGameShareUrl,
  copyResultsOnly,
  nativeShareResultsOnly,
  type ShareResultsOptions,
} from "@/lib/custom-game-share";
import { fetchCustomPuzzle } from "@/lib/custom-puzzles";
import {
  clearConnect5Progress,
  fetchRemoteConnect5Override,
  getAdminConnect5Overrides,
  getConnect5Progress,
  isDateCompleted,
  recordGameWin,
  saveConnect5Progress,
} from "@/lib/game-storage";
import {
  computePuzzleContentHash,
  validateConnect5Payload,
} from "@/lib/seeded-random";
import { formatTimerSeconds, GameShell } from "@/components/game-shell";
import { GameSplashScreen } from "@/components/game-splash-screen";
import { ConnectFiveCreator } from "./connect-five-creator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountNavButton } from "@/components/account/account-nav-button";
import { PuzzleCheckRevealModal } from "./puzzle-check-reveal-modal";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
];

function createInitialGrid(puzzle: Connect5Puzzle): {
  grid: string[][];
  locked: boolean[][];
  slashed: boolean[][];
} {
  const grid = puzzle.words.map((word, rowIdx) =>
    word.split("").map((ch) => (rowIdx === 0 ? ch : ""))
  );
  const locked = puzzle.words.map((word, rowIdx) =>
    word.split("").map(() => rowIdx === 0)
  );
  const slashed = puzzle.words.map((word) => word.split("").map(() => false));

  for (const hint of puzzle.revealedHints) {
    if (
      hint.row >= 1 &&
      hint.row < puzzle.words.length &&
      hint.col >= 0 &&
      hint.col < puzzle.words[hint.row].length
    ) {
      grid[hint.row][hint.col] = puzzle.words[hint.row][hint.col];
      locked[hint.row][hint.col] = true;
    }
  }

  return { grid, locked, slashed };
}

function findFirstOpenCell(
  grid: string[][],
  locked: boolean[][],
  slashed: boolean[][],
  startRow = 1
): { row: number; col: number } {
  for (let r = Math.max(1, startRow); r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (!locked[r][c] && (grid[r][c] === "" || slashed[r][c])) {
        return { row: r, col: c };
      }
    }
  }
  for (let r = 1; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (!locked[r][c]) {
        return { row: r, col: c };
      }
    }
  }
  return { row: 1, col: 0 };
}

interface InitialBoardState {
  puzzle: Connect5Puzzle;
  grid: string[][];
  locked: boolean[][];
  slashed: boolean[][];
  elapsedSeconds: number;
  hintsUsed: number;
  status: "playing" | "won";
  activeRow: number;
  activeCol: number;
}

function isSavedGridCompatible(
  saved: NonNullable<ReturnType<typeof getConnect5Progress>>,
  puzzle: Connect5Puzzle
): boolean {
  if (!Array.isArray(saved.grid) || saved.grid.length !== 5) return false;
  for (let r = 0; r < 5; r++) {
    if (
      !Array.isArray(saved.grid[r]) ||
      saved.grid[r].length !== puzzle.words[r].length
    ) {
      return false;
    }
  }
  if (saved.grid[0].join("") !== puzzle.words[0]) return false;
  return true;
}

function loadInitialBoardState(
  activeDateKey: string,
  customPuzzle?: Connect5Puzzle
): InitialBoardState {
  if (customPuzzle) {
    const base = createInitialGrid(customPuzzle);
    const firstOpen = findFirstOpenCell(
      base.grid,
      base.locked,
      base.slashed,
      1
    );
    return {
      puzzle: customPuzzle,
      grid: base.grid,
      locked: base.locked,
      slashed: base.slashed,
      elapsedSeconds: 0,
      hintsUsed: 0,
      status: "playing",
      activeRow: firstOpen.row,
      activeCol: firstOpen.col,
    };
  }

  const overrides = getAdminConnect5Overrides();
  const resolved = getConnect5PuzzleForDate(activeDateKey, overrides);
  const base = createInitialGrid(resolved);
  const saved = getConnect5Progress(activeDateKey, resolved.id);
  const expectedHash = computePuzzleContentHash(resolved);

  if (
    saved &&
    isSavedGridCompatible(saved, resolved) &&
    (!saved.puzzleHash || saved.puzzleHash === expectedHash)
  ) {
    const mergedLocked = base.locked.map((row, r) =>
      row.map((isLock, c) => isLock || Boolean(saved.revealedByHint?.[r]?.[c]))
    );
    const mergedSlashed =
      Array.isArray(saved.slashed) && saved.slashed.length === 5
        ? saved.slashed
        : base.slashed;
    const firstOpen = findFirstOpenCell(
      saved.grid,
      mergedLocked,
      mergedSlashed,
      1
    );
    return {
      puzzle: resolved,
      grid: saved.grid,
      locked: mergedLocked,
      slashed: mergedSlashed,
      elapsedSeconds: saved.elapsedSeconds || 0,
      hintsUsed: saved.hintsUsed || 0,
      status: saved.status,
      activeRow: firstOpen.row,
      activeCol: firstOpen.col,
    };
  }

  if (saved) {
    clearConnect5Progress(activeDateKey);
  }

  const firstOpen = findFirstOpenCell(
    base.grid,
    base.locked,
    base.slashed,
    1
  );
  return {
    puzzle: resolved,
    grid: base.grid,
    locked: base.locked,
    slashed: base.slashed,
    elapsedSeconds: 0,
    hintsUsed: 0,
    status: "playing",
    activeRow: firstOpen.row,
    activeCol: firstOpen.col,
  };
}

export function ConnectFiveGame() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const modeParam = searchParams.get("mode");
  const customId = searchParams.get("b");
  const [liveTodayKey, setLiveTodayKey] = useState<string>(() =>
    getLocalDateKey()
  );

  // Automatically detect midnight rollover when playing Today's daily puzzle
  useEffect(() => {
    if (dateParam || customId || modeParam === "create") return;
    const checkDate = () => {
      const current = getLocalDateKey();
      setLiveTodayKey((prev) => (prev !== current ? current : prev));
    };
    const interval = setInterval(checkDate, 30000);
    window.addEventListener("focus", checkDate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", checkDate);
    };
  }, [dateParam, customId, modeParam]);

  const activeDateKey = dateParam || liveTodayKey;

  if (modeParam === "create") {
    return <ConnectFiveCreator />;
  }

  if (customId) {
    return (
      <ConnectFiveCustomLoader
        key={`custom:${customId}`}
        customId={customId}
        activeDateKey={activeDateKey}
      />
    );
  }

  return <ConnectFiveBoard key={activeDateKey} activeDateKey={activeDateKey} />;
}

function ConnectFiveCustomLoader({
  customId,
  activeDateKey,
}: {
  customId: string;
  activeDateKey: string;
}) {
  const [state, setState] = useState<{
    loading: boolean;
    puzzle: Connect5Puzzle | null;
  }>({ loading: true, puzzle: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const record = await fetchCustomPuzzle<Connect5Puzzle>(customId);
      if (cancelled) return;
      if (!record) {
        setState({ loading: false, puzzle: null });
        return;
      }
      const checked = validateConnect5Payload(record.payload);
      if (!checked.valid || !checked.puzzle) {
        setState({ loading: false, puzzle: null });
        return;
      }
      setState({
        loading: false,
        puzzle: {
          ...checked.puzzle,
          id: record.id,
          puzzleNumber: 0,
          author: record.creatorName || checked.puzzle.author || "Friend",
          editor: record.creatorHandle
            ? `@${record.creatorHandle.replace(/^@+/, "")}`
            : checked.puzzle.editor || "SOL GaMES",
        },
      });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [customId]);

  if (state.loading) {
    return (
      <GameShell
        gameSlug="connect-5"
        gameTitle="Connect 5"
        puzzleNumber={0}
        dateKey={activeDateKey}
        author="Friend"
      >
        <div className="mx-auto max-w-md my-12 p-8 text-center bg-white border-2 border-black rounded-2xl shadow-2xs space-y-3">
          <Loader2 className="h-7 w-7 animate-spin mx-auto text-black" />
          <p className="font-headline font-bold text-sm text-neutral-700">
            Loading custom Connect 5 chain…
          </p>
        </div>
      </GameShell>
    );
  }

  if (!state.puzzle) {
    return (
      <GameShell
        gameSlug="connect-5"
        gameTitle="Connect 5"
        puzzleNumber={0}
        dateKey={activeDateKey}
        author="SOL GaMES"
      >
        <div className="mx-auto max-w-md my-12 p-6 sm:p-8 text-center bg-white border-2 border-black rounded-2xl shadow-2xs space-y-4">
          <AlertCircle className="h-8 w-8 text-red-600 mx-auto" />
          <h2 className="font-headline font-black text-xl">
            Custom Chain Not Found
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600">
            We couldn&apos;t find a Connect 5 chain matching{" "}
            <span className="font-mono font-bold text-black">{customId}</span>.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/games/connect-5"
              className="inline-flex items-center justify-center h-10 rounded-xl bg-black text-white font-bold text-xs border-2 border-black"
            >
              Play Today&apos;s Connect 5
            </Link>
            <Link
              href="/games/connect-5?mode=create"
              className="inline-flex items-center justify-center h-10 rounded-xl bg-white text-black font-bold text-xs border-2 border-black"
            >
              Create Your Own
            </Link>
          </div>
        </div>
      </GameShell>
    );
  }

  return (
    <ConnectFiveBoard
      activeDateKey={activeDateKey}
      customPuzzle={state.puzzle}
      customId={customId}
    />
  );
}

function ConnectFiveBoard({
  activeDateKey,
  customPuzzle,
  customId,
}: {
  activeDateKey: string;
  customPuzzle?: Connect5Puzzle;
  customId?: string;
}) {
  const router = useRouter();
  const isCustom = Boolean(customPuzzle);
  const [splashDismissed, setSplashDismissed] = useState<boolean>(isCustom);

  const [initial] = useState<InitialBoardState>(() =>
    loadInitialBoardState(activeDateKey, customPuzzle)
  );

  const [puzzle, setPuzzle] = useState<Connect5Puzzle>(initial.puzzle);
  const [grid, setGrid] = useState<string[][]>(initial.grid);
  const [locked, setLocked] = useState<boolean[][]>(initial.locked);
  const [slashed, setSlashed] = useState<boolean[][]>(initial.slashed);

  const [activeRow, setActiveRow] = useState<number>(initial.activeRow);
  const [activeCol, setActiveCol] = useState<number>(initial.activeCol);
  const [specificCellFocus, setSpecificCellFocus] = useState<boolean>(true);

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(
    initial.elapsedSeconds
  );
  const elapsedSecondsRef = useRef<number>(initial.elapsedSeconds);
  const [hintsUsed, setHintsUsed] = useState<number>(initial.hintsUsed);
  const [status, setStatus] = useState<"playing" | "won">(initial.status);
  const [isBufferingWin, setIsBufferingWin] = useState<boolean>(false);
  const isBufferingWinRef = useRef<boolean>(false);
  const [winModalOpen, setWinModalOpen] = useState<boolean>(
    initial.status === "won"
  );
  const [notQuiteBanner, setNotQuiteBanner] = useState<boolean>(false);
  const [resultsCopied, setResultsCopied] = useState<boolean>(false);
  const [checkRevealOpen, setCheckRevealOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);
  const [statsOpen, setStatsOpen] = useState<boolean>(false);

  const isMountedRef = useRef<boolean>(true);
  const winTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notQuiteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  const applyRemotePuzzleIfChanged = useCallback(
    (remotePuzzle: Connect5Puzzle) => {
      const remoteHash = computePuzzleContentHash(remotePuzzle);
      const currentHash = computePuzzleContentHash(puzzle);
      const wordsChanged =
        remotePuzzle.words.join("|") !== puzzle.words.join("|");
      const connectionsChanged =
        remotePuzzle.connections.join("|") !== puzzle.connections.join("|");

      if (remoteHash !== currentHash || wordsChanged || connectionsChanged) {
        clearConnect5Progress(activeDateKey);
        const base = createInitialGrid(remotePuzzle);
        const firstOpen = findFirstOpenCell(
          base.grid,
          base.locked,
          base.slashed,
          1
        );
        setPuzzle(remotePuzzle);
        setGrid(base.grid);
        setLocked(base.locked);
        setSlashed(base.slashed);
        setStatus("playing");
        setElapsedSeconds(0);
        elapsedSecondsRef.current = 0;
        setHintsUsed(0);
        setWinModalOpen(false);
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
          copyTimeoutRef.current = null;
        }
        setResultsCopied(false);
        setIsBufferingWin(false);
        isBufferingWinRef.current = false;
        setActiveRow(firstOpen.row);
        setActiveCol(firstOpen.col);
        setSpecificCellFocus(true);

        saveConnect5Progress({
          dateKey: activeDateKey,
          puzzleId: remotePuzzle.id,
          grid: base.grid,
          slashed: base.slashed,
          revealedByHint: base.locked,
          elapsedSeconds: 0,
          hintsUsed: 0,
          status: "playing",
          puzzleHash: remoteHash,
        });
      }
    },
    [activeDateKey, puzzle]
  );

  // Fetch remote Supabase daily_puzzles override if configured and listen to live updates
  useEffect(() => {
    if (isCustom) return;
    let active = true;
    fetchRemoteConnect5Override(activeDateKey).then((remotePuzzle) => {
      if (!active || !remotePuzzle) return;
      applyRemotePuzzleIfChanged(remotePuzzle);
    });

    const handlePuzzlesUpdated = (e: Event) => {
      if (!active) return;
      const detail = (e as CustomEvent)?.detail;
      if (detail?.gameSlug && detail.gameSlug !== "connect-5") return;
      if (!detail || !detail.dateKey || detail.dateKey === activeDateKey) {
        if (detail?.puzzle && detail.dateKey === activeDateKey) {
          applyRemotePuzzleIfChanged(detail.puzzle);
          return;
        }
        const local = getAdminConnect5Overrides()[activeDateKey];
        if (local) {
          applyRemotePuzzleIfChanged(local);
        } else {
          fetchRemoteConnect5Override(activeDateKey).then((remotePuzzle) => {
            if (!active || !remotePuzzle) return;
            applyRemotePuzzleIfChanged(remotePuzzle);
          });
        }
      }
    };

    window.addEventListener("solgames:puzzles-updated", handlePuzzlesUpdated);
    return () => {
      active = false;
      window.removeEventListener("solgames:puzzles-updated", handlePuzzlesUpdated);
    };
  }, [activeDateKey, applyRemotePuzzleIfChanged, isCustom]);

  // Live count-up timer while playing (starts strictly after splash screen is dismissed)
  useEffect(() => {
    if (!splashDismissed || status !== "playing" || isBufferingWin) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        elapsedSecondsRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [splashDismissed, status, isBufferingWin]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (winTimeoutRef.current) clearTimeout(winTimeoutRef.current);
      if (notQuiteTimeoutRef.current) clearTimeout(notQuiteTimeoutRef.current);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Persist current board state
  const persistProgress = useCallback(
    (
      nextGrid: string[][],
      nextLocked: boolean[][],
      nextSlashed: boolean[][],
      nextStatus: "playing" | "won" = status,
      nextHints: number = hintsUsed,
      nextElapsed: number = elapsedSecondsRef.current
    ) => {
      if (isCustom) return;
      saveConnect5Progress({
        dateKey: activeDateKey,
        puzzleId: puzzle.id,
        grid: nextGrid,
        slashed: nextSlashed,
        revealedByHint: nextLocked,
        elapsedSeconds: nextElapsed,
        hintsUsed: nextHints,
        status: nextStatus,
        completedAt: nextStatus === "won" ? new Date().toISOString() : undefined,
        puzzleHash: computePuzzleContentHash(puzzle),
      });
    },
    [activeDateKey, puzzle, status, hintsUsed, isCustom]
  );

  // Trigger board validation when all boxes are filled (and no unaddressed slashes remain)
  const evaluateBoardIfFull = useCallback(
    (
      candidateGrid: string[][],
      candidateLocked: boolean[][],
      candidateSlashed: boolean[][]
    ) => {
      for (let r = 1; r < 5; r++) {
        for (let c = 0; c < candidateGrid[r].length; c++) {
          if (candidateGrid[r][c] === "" || candidateSlashed[r][c]) {
            return;
          }
        }
      }

      let allCorrect = true;
      const newSlashed = candidateSlashed.map((row) => [...row]);
      let firstWrongCell: { row: number; col: number } | null = null;

      for (let r = 1; r < 5; r++) {
        const targetWord = puzzle.words[r];
        for (let c = 0; c < targetWord.length; c++) {
          if (candidateGrid[r][c].toUpperCase() !== targetWord[c]) {
            allCorrect = false;
            if (!candidateLocked[r][c]) {
              newSlashed[r][c] = true;
              if (!firstWrongCell) {
                firstWrongCell = { row: r, col: c };
              }
            }
          } else {
            newSlashed[r][c] = false;
          }
        }
      }

      const currentElapsed = elapsedSecondsRef.current;

      if (allCorrect) {
        isBufferingWinRef.current = true;
        setIsBufferingWin(true);
        setNotQuiteBanner(false);
        persistProgress(
          candidateGrid,
          candidateLocked,
          newSlashed,
          "won",
          hintsUsed,
          currentElapsed
        );
        if (!isCustom) {
          recordGameWin("connect-5", activeDateKey, currentElapsed);
        }

        if (winTimeoutRef.current) clearTimeout(winTimeoutRef.current);
        winTimeoutRef.current = setTimeout(() => {
          isBufferingWinRef.current = false;
          setIsBufferingWin(false);
          setStatus("won");
          setWinModalOpen(true);
        }, 1000);
      } else {
        setSlashed(newSlashed);
        setNotQuiteBanner(true);
        persistProgress(
          candidateGrid,
          candidateLocked,
          newSlashed,
          "playing",
          hintsUsed,
          currentElapsed
        );

        if (firstWrongCell) {
          setActiveRow(firstWrongCell.row);
          setActiveCol(firstWrongCell.col);
          setSpecificCellFocus(true);
        }

        if (notQuiteTimeoutRef.current) clearTimeout(notQuiteTimeoutRef.current);
        notQuiteTimeoutRef.current = setTimeout(() => {
          setNotQuiteBanner(false);
        }, 3800);
      }
    },
    [puzzle.words, persistProgress, hintsUsed, activeDateKey, isCustom]
  );

  // Handle typing a letter A-Z
  const handleLetterInput = useCallback(
    (rawLetter: string) => {
      if (status !== "playing" || isBufferingWin || isBufferingWinRef.current) {
        return;
      }
      const letter = rawLetter.toUpperCase();
      if (!/^[A-Z]$/.test(letter)) return;

      const targetRow = Math.max(1, Math.min(4, activeRow));
      let targetCol = activeCol;

      if (
        !specificCellFocus ||
        targetCol < 0 ||
        targetCol >= grid[targetRow].length ||
        locked[targetRow][targetCol]
      ) {
        let foundCol = -1;
        for (let c = 0; c < grid[targetRow].length; c++) {
          if (
            !locked[targetRow][c] &&
            (grid[targetRow][c] === "" || slashed[targetRow][c])
          ) {
            foundCol = c;
            break;
          }
        }
        if (foundCol === -1) {
          for (let c = 0; c < grid[targetRow].length; c++) {
            if (!locked[targetRow][c]) {
              foundCol = c;
              break;
            }
          }
        }
        if (foundCol === -1) return;
        targetCol = foundCol;
      }

      const wasOverwriteOfNormalCell =
        grid[targetRow][targetCol] !== "" && !slashed[targetRow][targetCol];

      const nextGrid = grid.map((r) => [...r]);
      const nextSlashed = slashed.map((r) => [...r]);
      nextGrid[targetRow][targetCol] = letter;
      nextSlashed[targetRow][targetCol] = false;

      setGrid(nextGrid);
      setSlashed(nextSlashed);
      setNotQuiteBanner(false);

      let nextFocus: { row: number; col: number } | null = null;
      for (let c = targetCol + 1; c < nextGrid[targetRow].length; c++) {
        if (
          !locked[targetRow][c] &&
          (nextGrid[targetRow][c] === "" || nextSlashed[targetRow][c])
        ) {
          nextFocus = { row: targetRow, col: c };
          break;
        }
      }

      // If the user explicitly clicked and overwrote a filled cell in this word, advance to the next unlocked letter in the same word
      if (!nextFocus && wasOverwriteOfNormalCell) {
        for (let c = targetCol + 1; c < nextGrid[targetRow].length; c++) {
          if (!locked[targetRow][c]) {
            nextFocus = { row: targetRow, col: c };
            break;
          }
        }
      }

      if (!nextFocus) {
        for (let c = 0; c < targetCol; c++) {
          if (
            !locked[targetRow][c] &&
            (nextGrid[targetRow][c] === "" || nextSlashed[targetRow][c])
          ) {
            nextFocus = { row: targetRow, col: c };
            break;
          }
        }
      }

      if (!nextFocus) {
        for (let offset = 1; offset <= 4; offset++) {
          const r = ((targetRow - 1 + offset) % 4) + 1;
          for (let c = 0; c < nextGrid[r].length; c++) {
            if (
              !locked[r][c] &&
              (nextGrid[r][c] === "" || nextSlashed[r][c])
            ) {
              nextFocus = { row: r, col: c };
              break;
            }
          }
          if (nextFocus) break;
        }
      }

      if (nextFocus) {
        setActiveRow(nextFocus.row);
        setActiveCol(nextFocus.col);
        setSpecificCellFocus(true);
      }

      persistProgress(nextGrid, locked, nextSlashed);
      evaluateBoardIfFull(nextGrid, locked, nextSlashed);
    },
    [
      status,
      isBufferingWin,
      activeRow,
      activeCol,
      specificCellFocus,
      grid,
      locked,
      slashed,
      persistProgress,
      evaluateBoardIfFull,
    ]
  );

  // Smart NYT Crossword-Style Backspace
  const handleBackspace = useCallback(() => {
    if (status !== "playing" || isBufferingWin || isBufferingWinRef.current) {
      return;
    }

    const r = Math.max(1, Math.min(4, activeRow));
    const nextGrid = grid.map((row) => [...row]);
    const nextSlashed = slashed.map((row) => [...row]);

    const jumpUpAndDeleteRightmost = (fromRow: number) => {
      for (let prevRow = fromRow - 1; prevRow >= 1; prevRow--) {
        let rightmostFilled = -1;
        let rightmostEditable = -1;
        for (let c = nextGrid[prevRow].length - 1; c >= 0; c--) {
          if (!locked[prevRow][c]) {
            if (rightmostEditable === -1) rightmostEditable = c;
            if (nextGrid[prevRow][c] !== "") {
              rightmostFilled = c;
              break;
            }
          }
        }
        if (rightmostFilled !== -1) {
          nextGrid[prevRow][rightmostFilled] = "";
          nextSlashed[prevRow][rightmostFilled] = false;
          setGrid(nextGrid);
          setSlashed(nextSlashed);
          setActiveRow(prevRow);
          setActiveCol(rightmostFilled);
          setSpecificCellFocus(true);
          persistProgress(nextGrid, locked, nextSlashed);
          return;
        }
        if (rightmostEditable !== -1) {
          setActiveRow(prevRow);
          setActiveCol(rightmostEditable);
          setSpecificCellFocus(false);
          return;
        }
      }
    };

    if (specificCellFocus) {
      const c = Math.max(0, Math.min(nextGrid[r].length - 1, activeCol));

      // 1. If the focused cell itself has a letter, delete it and keep cursor on `c`
      // so typing a replacement fills `c`, and pressing Backspace again deletes `c - 1`.
      if (!locked[r][c] && nextGrid[r][c] !== "") {
        nextGrid[r][c] = "";
        nextSlashed[r][c] = false;
        setGrid(nextGrid);
        setSlashed(nextSlashed);
        setActiveCol(c);
        persistProgress(nextGrid, locked, nextSlashed);
        return;
      }

      // 2. Focused cell is already empty (or locked): delete the nearest filled editable cell to the left,
      // leaving any letters to the right of `c` in this word completely untouched.
      let leftFilledCol = -1;
      for (let left = c - 1; left >= 0; left--) {
        if (!locked[r][left] && nextGrid[r][left] !== "") {
          leftFilledCol = left;
          break;
        }
      }

      if (leftFilledCol !== -1) {
        nextGrid[r][leftFilledCol] = "";
        nextSlashed[r][leftFilledCol] = false;
        setGrid(nextGrid);
        setSlashed(nextSlashed);
        setActiveCol(leftFilledCol);
        persistProgress(nextGrid, locked, nextSlashed);
        return;
      }

      // 3. No filled editable cells to the left of `c`. If the entire row is now empty, jump up to the row above.
      // If there are still letters to the right of `c`, leave them alone!
      let anyFilledInRow = false;
      for (let colIdx = nextGrid[r].length - 1; colIdx >= 0; colIdx--) {
        if (!locked[r][colIdx] && nextGrid[r][colIdx] !== "") {
          anyFilledInRow = true;
          break;
        }
      }

      if (!anyFilledInRow) {
        jumpUpAndDeleteRightmost(r);
      }
      return;
    }

    // General row focus (not focused on a specific letter cell): delete rightmost filled letter right-to-left
    let rightmostCol = -1;
    for (let colIdx = nextGrid[r].length - 1; colIdx >= 0; colIdx--) {
      if (!locked[r][colIdx] && nextGrid[r][colIdx] !== "") {
        rightmostCol = colIdx;
        break;
      }
    }

    if (rightmostCol !== -1) {
      nextGrid[r][rightmostCol] = "";
      nextSlashed[r][rightmostCol] = false;
      setGrid(nextGrid);
      setSlashed(nextSlashed);
      setActiveCol(rightmostCol);
      setSpecificCellFocus(false);
      persistProgress(nextGrid, locked, nextSlashed);
    } else {
      jumpUpAndDeleteRightmost(r);
    }
  }, [
    status,
    isBufferingWin,
    activeRow,
    activeCol,
    specificCellFocus,
    grid,
    locked,
    slashed,
    persistProgress,
  ]);

  const handleNavigationKey = useCallback(
    (key: string, shiftKey = false) => {
      if (status !== "playing" || isBufferingWin || isBufferingWinRef.current) {
        return;
      }

      if (key === "Enter" || key === "Tab") {
        const dir = shiftKey ? -1 : 1;
        const nextRow = ((activeRow - 1 + dir + 4) % 4) + 1;
        let firstCol = 0;
        for (let c = 0; c < grid[nextRow].length; c++) {
          if (
            !locked[nextRow][c] &&
            (grid[nextRow][c] === "" || slashed[nextRow][c])
          ) {
            firstCol = c;
            break;
          }
        }
        setActiveRow(nextRow);
        setActiveCol(firstCol);
        setSpecificCellFocus(true);
        return;
      }

      if (key === "ArrowDown") {
        const nextRow = Math.min(4, activeRow + 1);
        const clampedCol = Math.min(activeCol, grid[nextRow].length - 1);
        setActiveRow(nextRow);
        setActiveCol(clampedCol);
        setSpecificCellFocus(true);
      } else if (key === "ArrowUp") {
        const nextRow = Math.max(1, activeRow - 1);
        const clampedCol = Math.min(activeCol, grid[nextRow].length - 1);
        setActiveRow(nextRow);
        setActiveCol(clampedCol);
        setSpecificCellFocus(true);
      } else if (key === "ArrowRight") {
        if (activeCol + 1 < grid[activeRow].length) {
          setActiveCol(activeCol + 1);
          setSpecificCellFocus(true);
        } else if (activeRow < 4) {
          setActiveRow(activeRow + 1);
          setActiveCol(0);
          setSpecificCellFocus(true);
        }
      } else if (key === "ArrowLeft") {
        if (activeCol - 1 >= 0) {
          setActiveCol(activeCol - 1);
          setSpecificCellFocus(true);
        } else if (activeRow > 1) {
          const prevRow = activeRow - 1;
          setActiveRow(prevRow);
          setActiveCol(grid[prevRow].length - 1);
          setSpecificCellFocus(true);
        }
      }
    },
    [status, isBufferingWin, activeRow, activeCol, grid, locked, slashed]
  );

  useEffect(() => {
    if (!splashDismissed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        handleLetterInput(e.key);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        handleBackspace();
      } else if (
        [
          "Enter",
          "Tab",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.key)
      ) {
        e.preventDefault();
        handleNavigationKey(e.key, e.shiftKey);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [splashDismissed, handleLetterInput, handleBackspace, handleNavigationKey]);

  const handleRevealHint = () => {
    if (status !== "playing" || isBufferingWin || isBufferingWinRef.current) {
      return;
    }

    let target: { row: number; col: number } | null = null;
    if (
      activeRow >= 1 &&
      activeRow <= 4 &&
      !locked[activeRow][activeCol] &&
      (grid[activeRow][activeCol] === "" ||
        slashed[activeRow][activeCol] ||
        grid[activeRow][activeCol] !== puzzle.words[activeRow][activeCol])
    ) {
      target = { row: activeRow, col: activeCol };
    } else {
      for (let r = 1; r < 5; r++) {
        for (let c = 0; c < puzzle.words[r].length; c++) {
          if (
            !locked[r][c] &&
            (grid[r][c] === "" ||
              slashed[r][c] ||
              grid[r][c] !== puzzle.words[r][c])
          ) {
            target = { row: r, col: c };
            break;
          }
        }
        if (target) break;
      }
    }

    if (!target) return;

    const nextGrid = grid.map((r) => [...r]);
    const nextLocked = locked.map((r) => [...r]);
    const nextSlashed = slashed.map((r) => [...r]);

    nextGrid[target.row][target.col] = puzzle.words[target.row][target.col];
    nextLocked[target.row][target.col] = true;
    nextSlashed[target.row][target.col] = false;

    const nextHints = hintsUsed + 1;
    setGrid(nextGrid);
    setLocked(nextLocked);
    setSlashed(nextSlashed);
    setHintsUsed(nextHints);

    const nextOpen = findFirstOpenCell(
      nextGrid,
      nextLocked,
      nextSlashed,
      target.row
    );
    setActiveRow(nextOpen.row);
    setActiveCol(nextOpen.col);
    setSpecificCellFocus(true);

    persistProgress(
      nextGrid,
      nextLocked,
      nextSlashed,
      "playing",
      nextHints,
      elapsedSecondsRef.current
    );
    evaluateBoardIfFull(nextGrid, nextLocked, nextSlashed);
  };

  const handleResetPuzzle = () => {
    if (winTimeoutRef.current) {
      clearTimeout(winTimeoutRef.current);
      winTimeoutRef.current = null;
    }
    if (notQuiteTimeoutRef.current) {
      clearTimeout(notQuiteTimeoutRef.current);
      notQuiteTimeoutRef.current = null;
    }
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
    isBufferingWinRef.current = false;
    if (!isCustom) {
      clearConnect5Progress(activeDateKey);
    }
    const base = createInitialGrid(puzzle);
    setGrid(base.grid);
    setLocked(base.locked);
    setSlashed(base.slashed);
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    setHintsUsed(0);
    setStatus("playing");
    setIsBufferingWin(false);
    setWinModalOpen(false);
    setResultsCopied(false);
    setNotQuiteBanner(false);
    const firstOpen = findFirstOpenCell(base.grid, base.locked, base.slashed, 1);
    setActiveRow(firstOpen.row);
    setActiveCol(firstOpen.col);
    setSpecificCellFocus(true);
  };

  const buildConnect5ShareOptions = (): ShareResultsOptions => {
    const rowEmojis = puzzle.words.map((w) => "🟩".repeat(w.length));
    const header = isCustom
      ? `🔗 Connect 5 — "${puzzle.title}" (by ${puzzle.author})`
      : `🔗 Connect 5 #${puzzle.puzzleNumber} — "${puzzle.title}"`;
    const text = [
      header,
      `⏱️ Time: ${formatTimerSeconds(elapsedSeconds)}${
        hintsUsed > 0 ? ` (${hintsUsed} hint${hintsUsed > 1 ? "s" : ""})` : ""
      }`,
      ...rowEmojis,
    ].join("\n");

    const url =
      isCustom && customId
        ? buildCustomGameShareUrl("connect-5", customId)
        : typeof window !== "undefined" && window.location?.href
        ? window.location.href
        : "https://21games.ai/games/connect-5";

    return {
      title: header,
      text,
      url,
    };
  };

  const handleNativeShareResults = async () => {
    await nativeShareResultsOnly(buildConnect5ShareOptions());
  };

  const handleCopyResults = async () => {
    const { copied } = await copyResultsOnly(buildConnect5ShareOptions());
    if (copied && isMountedRef.current) {
      setResultsCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setResultsCopied(false);
        }
        copyTimeoutRef.current = null;
      }, 2000);
    }
  };

  const isPartiallyFilled = useMemo(() => {
    let filledRows = 0;
    let totalEditableFilled = 0;
    let totalEditable = 0;
    for (let r = 1; r < 5; r++) {
      let rowFull = true;
      for (let c = 0; c < grid[r].length; c++) {
        if (!locked[r][c]) {
          totalEditable++;
          if (grid[r][c] !== "") {
            totalEditableFilled++;
          } else {
            rowFull = false;
          }
        }
      }
      if (rowFull) filledRows++;
    }
    return filledRows <= 1 || totalEditableFilled < totalEditable;
  }, [grid, locked]);

  const handleCheckSquare = useCallback(() => {
    if (status !== "playing") return;
    const targetRow = activeRow;
    const targetCol = activeCol;
    if (targetRow < 1 || targetRow > 4) {
      toast({
        title: "Starter row cannot be checked",
        description: "Row 1 is already solved.",
      });
      return;
    }
    if (locked[targetRow][targetCol]) {
      toast({
        title: "Square is locked",
        description: "This letter is already revealed.",
      });
      return;
    }
    const currentLetter = grid[targetRow][targetCol];
    if (!currentLetter) {
      toast({
        title: "Square is empty",
        description: "Type a letter first to check it.",
      });
      return;
    }
    const isCorrect =
      currentLetter.toUpperCase() === puzzle.words[targetRow][targetCol];
    const nextSlashed = slashed.map((r) => [...r]);
    nextSlashed[targetRow][targetCol] = !isCorrect;
    setSlashed(nextSlashed);
    persistProgress(
      grid,
      locked,
      nextSlashed,
      status,
      hintsUsed,
      elapsedSecondsRef.current
    );
    if (!isCorrect) {
      toast({
        title: "Letter is incorrect",
        description:
          "Marked with a red slash. Type a new letter to replace it.",
      });
    } else {
      toast({
        title: "Square is correct!",
        description: "Nice! Keep going.",
      });
    }
  }, [
    status,
    activeRow,
    activeCol,
    locked,
    grid,
    puzzle.words,
    slashed,
    persistProgress,
    hintsUsed,
  ]);

  const handleCheckWord = useCallback(() => {
    if (status !== "playing") return;
    const targetRow = activeRow;
    if (targetRow < 1 || targetRow > 4) return;
    const targetWord = puzzle.words[targetRow];
    const nextSlashed = slashed.map((r) => [...r]);
    let errorsFound = 0;
    let enteredCount = 0;
    for (let c = 0; c < targetWord.length; c++) {
      if (locked[targetRow][c]) continue;
      const current = grid[targetRow][c];
      if (!current) continue;
      enteredCount++;
      if (current.toUpperCase() !== targetWord[c]) {
        nextSlashed[targetRow][c] = true;
        errorsFound++;
      } else {
        nextSlashed[targetRow][c] = false;
      }
    }
    setSlashed(nextSlashed);
    persistProgress(
      grid,
      locked,
      nextSlashed,
      status,
      hintsUsed,
      elapsedSecondsRef.current
    );
    if (enteredCount === 0) {
      toast({
        title: "Word is empty",
        description: "Enter letters in this row to check them.",
      });
    } else if (errorsFound > 0) {
      toast({
        title: `Word checked: ${errorsFound} error(s) found`,
        description: "Incorrect letters have been marked with a red slash.",
      });
    } else {
      toast({
        title: "Word checked: All entered letters correct!",
        description:
          enteredCount === targetWord.length
            ? "Complete row is correct!"
            : "Looking good so far!",
      });
    }
  }, [
    status,
    activeRow,
    puzzle.words,
    locked,
    grid,
    slashed,
    persistProgress,
    hintsUsed,
  ]);

  const handleCheckPuzzle = useCallback(() => {
    if (status !== "playing") return;
    const nextSlashed = slashed.map((r) => [...r]);
    let errorsFound = 0;
    let totalEntered = 0;
    let totalRequired = 0;
    let allCorrect = true;

    for (let r = 1; r < 5; r++) {
      const targetWord = puzzle.words[r];
      for (let c = 0; c < targetWord.length; c++) {
        totalRequired++;
        if (locked[r][c]) {
          totalEntered++;
          continue;
        }
        const current = grid[r][c];
        if (current) {
          totalEntered++;
          if (current.toUpperCase() !== targetWord[c]) {
            nextSlashed[r][c] = true;
            errorsFound++;
            allCorrect = false;
          } else {
            nextSlashed[r][c] = false;
          }
        } else {
          allCorrect = false;
        }
      }
    }

    setSlashed(nextSlashed);
    persistProgress(
      grid,
      locked,
      nextSlashed,
      status,
      hintsUsed,
      elapsedSecondsRef.current
    );

    if (allCorrect && totalEntered === totalRequired) {
      evaluateBoardIfFull(grid, locked, nextSlashed);
      return;
    }

    if (errorsFound > 0) {
      toast({
        title: `Puzzle checked: ${errorsFound} error(s) found`,
        description: "Incorrect letters marked with red slashes.",
      });
    } else {
      toast({
        title: "Puzzle checked: All entered letters correct!",
        description: "Every letter you've entered so far is correct.",
      });
    }
  }, [
    status,
    slashed,
    puzzle.words,
    locked,
    grid,
    persistProgress,
    hintsUsed,
    evaluateBoardIfFull,
  ]);

  const handleRevealPuzzle = useCallback(() => {
    const nextGrid = puzzle.words.map((w) => w.split(""));
    const nextLocked = puzzle.words.map((w) =>
      Array.from({ length: w.length }, () => true)
    );
    const nextSlashed = puzzle.words.map((w) =>
      Array.from({ length: w.length }, () => false)
    );

    setGrid(nextGrid);
    setLocked(nextLocked);
    setSlashed(nextSlashed);
    setStatus("won");
    setWinModalOpen(true);

    const currentElapsed = elapsedSecondsRef.current;
    persistProgress(
      nextGrid,
      nextLocked,
      nextSlashed,
      "won",
      hintsUsed,
      currentElapsed
    );
    if (!isCustom) {
      recordGameWin("connect-5", activeDateKey, currentElapsed);
    }
  }, [puzzle.words, persistProgress, hintsUsed, activeDateKey, isCustom]);

  const handleClearPuzzle = useCallback(() => {
    const nextGrid = grid.map((r, rIdx) =>
      rIdx === 0
        ? [...r]
        : r.map((char, cIdx) => (locked[rIdx][cIdx] ? char : ""))
    );
    const nextSlashed = slashed.map((r, rIdx) =>
      rIdx === 0
        ? [...r]
        : r.map((s, cIdx) => (locked[rIdx][cIdx] ? s : false))
    );

    setGrid(nextGrid);
    setSlashed(nextSlashed);
    const firstOpen = findFirstOpenCell(nextGrid, locked, nextSlashed, 1);
    setActiveRow(firstOpen.row);
    setActiveCol(firstOpen.col);
    setSpecificCellFocus(false);
    persistProgress(
      nextGrid,
      locked,
      nextSlashed,
      status,
      hintsUsed,
      elapsedSecondsRef.current
    );
    toast({
      title: "Puzzle Cleared",
      description: "All entered letters have been cleared.",
    });
  }, [grid, locked, slashed, status, hintsUsed, persistProgress]);

  if (!splashDismissed) {
    return (
      <GameShell
        gameSlug="connect-5"
        gameTitle="Connect 5"
        puzzleNumber={puzzle.puzzleNumber}
        dateKey={activeDateKey}
        author={puzzle.author}
      >
        <GameSplashScreen
          gameSlug="connect-5"
          gameTitle="Connect 5"
          tagline="Complete the 5-row compound word chain where each row connects to the word above it."
          theme={puzzle.title}
          author={puzzle.author}
          puzzleNumber={puzzle.puzzleNumber}
          dateKey={activeDateKey}
          showCreate={true}
          isCompletedToday={
            status === "won" || isDateCompleted("connect-5", activeDateKey)
          }
          hasSavedProgress={elapsedSeconds > 0 && status !== "won"}
          onPlay={() => setSplashDismissed(true)}
          onCreate={() => router.push("/games/connect-5?mode=create")}
        />
      </GameShell>
    );
  }

  return (
    <GameShell
      gameSlug="connect-5"
      gameTitle="Connect 5"
      puzzleNumber={puzzle.puzzleNumber}
      dateKey={activeDateKey}
      author={puzzle.author}
      subtitle="Complete the 5-word compound chain. Each row connects with the word above it."
      unifiedHeader={true}
      helpOpen={helpOpen}
      onHelpOpenChange={setHelpOpen}
      statsOpen={statsOpen}
      onStatsOpenChange={setStatsOpen}
      headerRightSlot={
        <div className="flex items-center gap-1 min-[375px]:gap-1.5">
          <div
            className={cn(
              "inline-flex h-7 min-[375px]:h-8 sm:h-9 items-center gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl border-2 px-2 min-[375px]:px-2.5 font-mono text-[11px] min-[375px]:text-xs sm:text-sm font-black",
              status === "won" || isBufferingWin
                ? "border-[#2ECC71] bg-emerald-50 text-emerald-900"
                : "border-black bg-white text-black"
            )}
            title="Elapsed Time"
          >
            <Clock className="h-3 w-3 min-[375px]:h-3.5 min-[375px]:w-3.5" />
            <span>{formatTimerSeconds(elapsedSeconds)}</span>
          </div>

          <button
            type="button"
            onClick={() => setCheckRevealOpen(true)}
            disabled={status !== "playing"}
            className={cn(
              "h-7 w-7 min-[375px]:h-8 min-[375px]:w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-40",
              checkRevealOpen
                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                : "border-black/20 hover:border-black bg-white text-black"
            )}
            title="Check or Reveal Puzzle"
            aria-label="Check or Reveal Puzzle"
          >
            <LifeBuoy className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4" />
          </button>

          {status === "playing" && (
            <button
              type="button"
              onClick={handleRevealHint}
              className="h-7 w-7 min-[375px]:h-8 min-[375px]:w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl border-2 border-black/20 hover:border-black bg-white text-black flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="Reveal one letter hint"
              aria-label="Hint"
            >
              <Lightbulb className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4 text-[#F9D423] fill-[#F9D423]" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="h-7 w-7 min-[375px]:h-8 min-[375px]:w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl border-2 border-black/20 hover:border-black bg-white text-black flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="How to Play"
            aria-label="How to Play"
          >
            <HelpCircle className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4" />
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="h-7 w-7 min-[375px]:h-8 min-[375px]:w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl border-2 border-black/20 hover:border-black bg-white text-black flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Settings & Tools"
            aria-label="Settings"
          >
            <Settings className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4" />
          </button>
        </div>
      }
    >
      <div className="mx-auto max-w-xl flex flex-col items-center space-y-4 sm:space-y-5">
        <div className="flex items-center justify-between w-full px-1 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="green" className="text-xs truncate">
              <Link2 className="h-3 w-3 mr-1 shrink-0" />
              <span className="truncate">Chain: {puzzle.title}</span>
            </Badge>
            <span className="text-xs text-gray-500 hidden sm:inline shrink-0">
              Edited by {puzzle.editor}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status === "won" && (
              <Button
                size="xs"
                onClick={() => setWinModalOpen(true)}
                className="bg-[#2ECC71] text-black hover:bg-[#27b863] font-bold border border-black"
              >
                <Trophy className="h-3.5 w-3.5 mr-1" />
                View Win Summary
              </Button>
            )}
            <button
              type="button"
              onClick={handleResetPuzzle}
              className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-black"
              title="Reset board"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>

        <div
          className={cn(
            "w-full rounded-2xl border-2 border-black bg-white p-2.5 min-[375px]:p-3.5 sm:p-6 shadow-sm space-y-2.5 sm:space-y-3 transition-all",
            isBufferingWin && "ring-4 ring-[#2ECC71] bg-emerald-50/40 scale-[1.01]"
          )}
        >
          {puzzle.words.map((word, rowIdx) => {
            const isRow0 = rowIdx === 0;
            const isRowFocused =
              status === "playing" && !isRow0 && activeRow === rowIdx;

            return (
              <div
                key={rowIdx}
                onClick={() => {
                  if (!isRow0 && status === "playing") {
                    setActiveRow(rowIdx);
                    setSpecificCellFocus(false);
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 min-[375px]:gap-2.5 sm:gap-3 rounded-xl p-1.5 min-[375px]:p-2 sm:p-2.5 border-2 transition-all cursor-pointer",
                  isRow0
                    ? "bg-emerald-50/80 border-emerald-500/60 cursor-default"
                    : isRowFocused
                    ? "bg-[#f4fbf7] border-[#2ECC71] ring-3 ring-[#2ECC71]/35 shadow-xs"
                    : "bg-gray-50/60 border-transparent hover:border-gray-200"
                )}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isRow0 && status === "playing") {
                      setActiveRow(rowIdx);
                      setSpecificCellFocus(false);
                    }
                  }}
                  className={cn(
                    "h-7 w-7 min-[375px]:h-8 min-[375px]:w-8 sm:h-9 sm:w-9 rounded-lg font-headline font-black text-xs min-[375px]:text-sm flex items-center justify-center shrink-0 border-2 transition-colors",
                    isRow0
                      ? "bg-[#2ECC71] text-black border-black"
                      : isRowFocused
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-600 border-gray-300"
                  )}
                  title={
                    isRow0
                      ? "Starter Word (Locked)"
                      : `Row ${rowIdx + 1} (${word.length} letters) — Click for row focus`
                  }
                >
                  {rowIdx + 1}
                </button>

                <div className="flex items-center gap-1 min-[375px]:gap-1.5 sm:gap-2 flex-nowrap">
                  {word.split("").map((_, colIdx) => {
                    const char = grid[rowIdx]?.[colIdx] ?? "";
                    const isCellLocked = locked[rowIdx]?.[colIdx] ?? false;
                    const isCellSlashed = slashed[rowIdx]?.[colIdx] ?? false;
                    const isCellSelected =
                      isRowFocused &&
                      specificCellFocus &&
                      activeCol === colIdx &&
                      !isCellLocked;

                    return (
                      <button
                        key={colIdx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (status !== "playing" || isRow0) return;
                          setActiveRow(rowIdx);
                          if (!isCellLocked) {
                            setActiveCol(colIdx);
                            setSpecificCellFocus(true);
                          } else {
                            const nextOpen = findFirstOpenCell(
                              grid,
                              locked,
                              slashed,
                              rowIdx
                            );
                            setActiveCol(
                              nextOpen.row === rowIdx ? nextOpen.col : 0
                            );
                            setSpecificCellFocus(true);
                          }
                        }}
                        className={cn(
                          "relative h-9 min-[375px]:h-10 sm:h-13 rounded-lg min-[375px]:rounded-xl border-2 font-headline font-black text-base min-[375px]:text-lg sm:text-2xl uppercase flex items-center justify-center transition-all select-none shrink-0",
                          word.length >= 7
                            ? "w-7 min-[375px]:w-8 sm:w-12"
                            : "w-8 min-[375px]:w-9 sm:w-12",
                          isRow0
                            ? "bg-[#2ECC71] text-black border-black shadow-2xs cursor-default"
                            : status === "won" || isBufferingWin
                            ? "bg-[#2ECC71] text-black border-black"
                            : isCellLocked
                            ? "bg-amber-100/90 text-black border-black/80 cursor-default"
                            : isCellSlashed
                            ? isCellSelected
                              ? "bg-red-50 text-red-700 border-red-600 ring-3 ring-[#F9D423]"
                              : "bg-red-50/80 text-red-700 border-red-500"
                            : isCellSelected
                            ? "bg-[#F9D423] text-black border-black ring-2 ring-black scale-[1.04] shadow-xs"
                            : isRowFocused
                            ? "bg-white text-black border-black"
                            : "bg-white text-black border-gray-300 hover:border-black/60"
                        )}
                        aria-label={`Row ${rowIdx + 1} Letter ${colIdx + 1}`}
                      >
                        <span className="relative z-10">{char}</span>

                        {!isRow0 && isCellLocked && status === "playing" && (
                          <span
                            className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-600"
                            title="Pre-revealed Hint Letter"
                          />
                        )}

                        {isCellSlashed && (
                          <svg
                            viewBox="0 0 48 48"
                            className="pointer-events-none absolute inset-0 h-full w-full text-red-600/85"
                            aria-hidden="true"
                          >
                            <line
                              x1="8"
                              y1="40"
                              x2="40"
                              y2="8"
                              stroke="currentColor"
                              strokeWidth="3.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>

                <span className="ml-auto text-[11px] font-mono font-bold text-gray-400 hidden xs:inline">
                  {word.length}L
                </span>
              </div>
            );
          })}
        </div>

        {isBufferingWin && (
          <div className="flex items-center gap-2 rounded-full bg-[#2ECC71] border-2 border-black px-5 py-2 text-sm font-headline font-black text-black shadow-md animate-bounce">
            <Sparkles className="h-4 w-4" />
            Checking chain... Connected!
          </div>
        )}

        {notQuiteBanner && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-full bg-black text-white border-2 border-red-500 px-5 py-2.5 text-xs sm:text-sm font-bold shadow-xl animate-in fade-in slide-in-from-bottom-2"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            <span>
              <strong>Not quite!</strong> Slashed letters (
              <code className="text-red-400 font-bold">/</code>) aren&apos;t right
              — just type over any slashed box to replace it.
            </span>
          </div>
        )}

        {status === "won" ? (
          <div className="w-full rounded-2xl border-2 border-black bg-[#f4fbf7] p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-[#2ECC71] shrink-0" />
                <span className="font-headline font-black text-base sm:text-lg text-black">
                  Solved in {formatTimerSeconds(elapsedSeconds)}!
                </span>
              </div>
              <p className="text-xs text-gray-600">
                Connect 5 #{puzzle.puzzleNumber} · &ldquo;{puzzle.title}&rdquo;
                {hintsUsed > 0
                  ? ` · ${hintsUsed} hint${hintsUsed > 1 ? "s" : ""} used`
                  : " · No hints used"}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
              <Button
                type="button"
                onClick={handleNativeShareResults}
                className="bg-black text-white hover:bg-gray-800 border-2 border-black font-headline font-black text-xs h-10 px-3.5 sm:px-4"
              >
                <Share2 className="h-4 w-4 mr-1.5 shrink-0" />
                <span>Share</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyResults}
                className={cn(
                  "border-2 border-black font-headline font-bold text-xs h-10 px-3.5 sm:px-4 transition-colors",
                  resultsCopied
                    ? "bg-[#2ECC71] text-black hover:bg-[#27b863]"
                    : "bg-white text-black hover:bg-gray-100"
                )}
              >
                {resultsCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-1.5 shrink-0" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1.5 shrink-0" />
                    <span>Copy results</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full space-y-1.5 pt-1 select-none">
            {KEYBOARD_ROWS.map((rowKeys, rIdx) => (
              <div
                key={rIdx}
                className="flex justify-center gap-0.5 min-[375px]:gap-1 sm:gap-1.5"
              >
                {rowKeys.map((k) => {
                  const isWide = k === "ENTER" || k === "BACKSPACE";
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        if (k === "BACKSPACE") {
                          handleBackspace();
                        } else if (k === "ENTER") {
                          handleNavigationKey("Enter");
                        } else {
                          handleLetterInput(k);
                        }
                      }}
                      className={cn(
                        "h-10 min-[375px]:h-11 sm:h-12 rounded-lg border-2 border-black/15 bg-white font-headline font-bold text-xs sm:text-sm text-black shadow-2xs active:translate-y-0.5 hover:border-black hover:bg-gray-50 transition-all flex items-center justify-center",
                        isWide
                          ? "px-2 min-[375px]:px-2.5 sm:px-4 text-[11px] min-[375px]:text-xs shrink-0"
                          : "flex-1 max-w-8 sm:max-w-10 min-w-0"
                      )}
                    >
                      {k === "BACKSPACE" ? "⌫" : k === "ENTER" ? "NEXT" : k}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={winModalOpen} onOpenChange={setWinModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <CheckCircle2 className="h-6 w-6 text-[#2ECC71]" />
              You Win!
            </DialogTitle>
            <DialogDescription>
              You solved Connect 5 #{puzzle.puzzleNumber} (&ldquo;{puzzle.title}
              &rdquo;) in{" "}
              <strong className="text-black font-mono">
                {formatTimerSeconds(elapsedSeconds)}
              </strong>
              !
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 my-2">
            <p className="text-xs font-bold uppercase text-gray-500">
              Today&apos;s 5-Word Chain Connections
            </p>
            {puzzle.connections.map((conn, idx) => (
              <div
                key={idx}
                className="rounded-xl bg-emerald-50/80 border border-emerald-300 px-3 py-2 text-xs sm:text-sm font-medium text-gray-900"
              >
                <span className="font-mono font-bold text-emerald-800 mr-1.5">
                  {idx + 1}→{idx + 2}:
                </span>
                {conn}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                onClick={handleNativeShareResults}
                className="w-full bg-black text-white hover:bg-gray-800 border-2 border-black font-headline font-black h-10 px-4"
              >
                <Share2 className="h-4 w-4 mr-1.5 shrink-0" />
                <span>Share</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyResults}
                className={cn(
                  "w-full border-2 border-black font-headline font-bold h-10 px-4 transition-colors",
                  resultsCopied
                    ? "bg-[#2ECC71] text-black hover:bg-[#27b863]"
                    : "bg-white text-black hover:bg-gray-100"
                )}
              >
                {resultsCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-1.5 shrink-0" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1.5 shrink-0" />
                    <span>Copy results</span>
                  </>
                )}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setWinModalOpen(false)}
              className="w-full border-2 border-black/25 hover:border-black bg-white text-black font-bold h-9 text-xs"
            >
              View Board
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-xs sm:max-w-sm rounded-2xl p-5 border-2 border-black shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-headline font-black">
              <Settings className="h-5 w-5 text-gray-700" />
              Settings &amp; Tools
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Manage your game session, view stats, and access archives.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 pt-2">
            <Link
              href="/games/connect-5/archive"
              onClick={() => setSettingsOpen(false)}
              className="flex items-center justify-between w-full p-3 rounded-xl border-2 border-black/10 hover:border-black bg-gray-50 font-bold text-sm text-black transition-all"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-600" />
                <span>Playable Archive</span>
              </div>
              <span className="text-xs text-gray-400">Past Games &rarr;</span>
            </Link>

            <Link
              href="/games/connect-5?mode=create"
              onClick={() => setSettingsOpen(false)}
              className="flex items-center justify-between w-full p-3 rounded-xl border-2 border-black/10 hover:border-black bg-emerald-50/70 font-bold text-sm text-black transition-all"
            >
              <div className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-emerald-700" />
                <span>Create Your Own</span>
              </div>
              <span className="text-xs text-emerald-700">Share Link &rarr;</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                setStatsOpen(true);
              }}
              className="flex items-center justify-between w-full p-3 rounded-xl border-2 border-black/10 hover:border-black bg-gray-50 font-bold text-sm text-black transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gray-600" />
                <span>Stats &amp; Streaks</span>
              </div>
              <span className="text-xs text-gray-400">View &rarr;</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                handleResetPuzzle();
              }}
              className="flex items-center justify-between w-full p-3 rounded-xl border-2 border-red-200 hover:border-red-400 bg-red-50/50 font-bold text-sm text-red-600 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-red-600" />
                <span>Reset Board</span>
              </div>
              <span className="text-xs text-red-400">Restart &rarr;</span>
            </button>

            <div className="pt-2 border-t border-black/10 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Account:</span>
              <AccountNavButton variant="compact" />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Check & Reveal Action Modal */}
      <PuzzleCheckRevealModal
        open={checkRevealOpen}
        onOpenChange={setCheckRevealOpen}
        isPartiallyFilled={isPartiallyFilled}
        squareLabel="Check Square"
        wordLabel="Check Word"
        onCheckSquare={handleCheckSquare}
        onCheckWord={handleCheckWord}
        onCheckPuzzle={handleCheckPuzzle}
        onRevealPuzzle={handleRevealPuzzle}
        onClearPuzzle={handleClearPuzzle}
      />
    </GameShell>
  );
}
