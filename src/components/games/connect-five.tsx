"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Lightbulb,
  Link2,
  RotateCcw,
  Share2,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { Connect5Puzzle } from "@/data/puzzles/connect-5";
import { getConnect5PuzzleForDate, getLocalDateKey } from "@/lib/daily-engine";
import {
  clearConnect5Progress,
  fetchRemoteConnect5Override,
  getAdminConnect5Overrides,
  getConnect5Progress,
  recordGameWin,
  saveConnect5Progress,
} from "@/lib/game-storage";
import { formatTimerSeconds, GameShell } from "@/components/game-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
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

function loadInitialBoardState(activeDateKey: string): InitialBoardState {
  const overrides = getAdminConnect5Overrides();
  const resolved = getConnect5PuzzleForDate(activeDateKey, overrides);
  const base = createInitialGrid(resolved);
  const saved = getConnect5Progress(activeDateKey, resolved.id);

  if (saved && isSavedGridCompatible(saved, resolved)) {
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
  const [liveTodayKey, setLiveTodayKey] = useState<string>(() =>
    getLocalDateKey()
  );

  // Automatically detect midnight rollover when playing Today's daily puzzle
  useEffect(() => {
    if (dateParam) return;
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
  }, [dateParam]);

  const activeDateKey = dateParam || liveTodayKey;

  return <ConnectFiveBoard key={activeDateKey} activeDateKey={activeDateKey} />;
}

function ConnectFiveBoard({ activeDateKey }: { activeDateKey: string }) {
  const { toast } = useToast();

  const [initial] = useState<InitialBoardState>(() =>
    loadInitialBoardState(activeDateKey)
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

  const winTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notQuiteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  // Fetch remote Supabase daily_puzzles override if configured
  useEffect(() => {
    let active = true;
    fetchRemoteConnect5Override(activeDateKey).then((remotePuzzle) => {
      if (!active || !remotePuzzle) return;
      if (
        remotePuzzle.id !== puzzle.id ||
        remotePuzzle.words.join("|") !== puzzle.words.join("|")
      ) {
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
        setActiveRow(firstOpen.row);
        setActiveCol(firstOpen.col);
        setSpecificCellFocus(true);
      }
    });
    return () => {
      active = false;
    };
  }, [activeDateKey, puzzle.id, puzzle.words]);

  // Live count-up timer while playing
  useEffect(() => {
    if (status !== "playing" || isBufferingWin) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        elapsedSecondsRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status, isBufferingWin]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (winTimeoutRef.current) clearTimeout(winTimeoutRef.current);
      if (notQuiteTimeoutRef.current) clearTimeout(notQuiteTimeoutRef.current);
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
      saveConnect5Progress({
        dateKey: activeDateKey,
        puzzleId: puzzle.id,
        grid: nextGrid,
        slashed: nextSlashed,
        revealedByHint: nextLocked,
        elapsedSeconds: nextElapsed,
        hintsUsed: nextHints,
        status: nextStatus,
      });
    },
    [activeDateKey, puzzle.id, status, hintsUsed]
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
        recordGameWin("connect-5", activeDateKey, currentElapsed);

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
    [puzzle.words, persistProgress, hintsUsed, activeDateKey]
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
  }, [handleLetterInput, handleBackspace, handleNavigationKey]);

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
    isBufferingWinRef.current = false;
    clearConnect5Progress(activeDateKey);
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
    setNotQuiteBanner(false);
    const firstOpen = findFirstOpenCell(base.grid, base.locked, base.slashed, 1);
    setActiveRow(firstOpen.row);
    setActiveCol(firstOpen.col);
    setSpecificCellFocus(true);
  };

  const handleShareResults = async () => {
    const rowEmojis = puzzle.words.map((w) => "🟩".repeat(w.length));
    const shareText = [
      `🔗 Connect 5 #${puzzle.puzzleNumber} — "${puzzle.title}"`,
      `⏱️ Time: ${formatTimerSeconds(elapsedSeconds)}${
        hintsUsed > 0 ? ` (${hintsUsed} hint${hintsUsed > 1 ? "s" : ""})` : ""
      }`,
      ...rowEmojis,
      typeof window !== "undefined"
        ? window.location.href
        : "https://www.solworld.ai/solgames/games/connect-5",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(shareText);
      toast({
        title: "Results Copied!",
        description: "Your Connect 5 time and grid are ready to share.",
      });
    } catch {
      toast({
        title: "Share Summary",
        description: shareText,
      });
    }
  };

  return (
    <GameShell
      gameSlug="connect-5"
      gameTitle="Connect 5"
      puzzleNumber={puzzle.puzzleNumber}
      dateKey={activeDateKey}
      author={puzzle.author}
      subtitle="Complete the 5-word compound chain. Each row connects with the word above it."
      headerRightSlot={
        <div className="flex items-center gap-1 min-[375px]:gap-1.5">
          <div
            className={cn(
              "inline-flex h-7 sm:h-9 items-center gap-1 sm:gap-1.5 rounded-lg border-2 px-2 min-[375px]:px-2.5 font-mono text-[11px] min-[375px]:text-xs sm:text-sm font-black",
              status === "won" || isBufferingWin
                ? "border-[#2ECC71] bg-emerald-50 text-emerald-900"
                : "border-black bg-white text-black"
            )}
            title="Elapsed Time"
          >
            <Clock className="h-3 w-3 min-[375px]:h-3.5 min-[375px]:w-3.5" />
            <span>{formatTimerSeconds(elapsedSeconds)}</span>
          </div>

          {status === "playing" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevealHint}
              className="border-2 border-black font-bold text-[11px] sm:text-xs h-7 sm:h-9 px-2 min-[375px]:px-2.5"
              title="Reveal one letter hint"
            >
              <Lightbulb className="h-3.5 w-3.5 sm:mr-1 text-[#F9D423] fill-[#F9D423]" />
              <span className="hidden sm:inline">Hint</span>
            </Button>
          )}
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

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setWinModalOpen(false)}
              className="border-2 border-black font-bold"
            >
              View Board
            </Button>
            <Button
              onClick={handleShareResults}
              className="bg-black text-white hover:bg-gray-800 font-headline font-black px-5"
            >
              <Share2 className="h-4 w-4 mr-1.5" />
              Share Results
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </GameShell>
  );
}
