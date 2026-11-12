"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  buildStructuredHaikuLines,
  sliceHaikuIntoChunks,
  validateHaikuStructure,
  countLineSyllables,
  type SeventeenSyllablesPuzzle,
  type HaikuLineInfo,
} from "@/data/puzzles/17-syllables";
import {
  getLocalDateKey,
  get17SyllablesPuzzleForDate,
} from "@/lib/daily-engine";
import {
  get17SyllablesProgress,
  save17SyllablesProgress,
  record17SyllablesWin,
  isDateCompleted,
  getAdmin17SyllablesOverrides,
  fetchRemote17SyllablesOverride,
  clear17SyllablesProgress,
} from "@/lib/game-storage";
import { computePuzzleContentHash } from "@/lib/seeded-random";
import {
  generateShortGameId,
  build17SyllablesShareUrl,
  shareCustomGame,
  nativeShareResultsOnly,
  copyResultsOnly,
  decodeShareable17Haiku,
  type ShareResultsOptions,
} from "@/lib/custom-game-share";
import { check17SyllablesPuzzleModeration } from "@/lib/moderation";
import { GameSplashScreen } from "@/components/game-splash-screen";
import { GameShell, formatTimerSeconds } from "@/components/game-shell";
import { useAuth } from "@/components/account/auth-provider";
import { AccountNavButton } from "@/components/account/account-nav-button";
import { PuzzleCheckRevealModal } from "./puzzle-check-reveal-modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Loader2,
  Lock,
  Share2,
  Copy,
  Check,
  Trophy,
  CheckCircle2,
  PlusCircle,
  Lightbulb,
  KeyRound,
  AlertCircle,
  Star,
  LifeBuoy,
  HelpCircle,
  Settings,
  BarChart3,
  Calendar,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SlotState {
  key: string;
  lineIndex: number;
  wordIndex: number;
  slotIndex: number;
  expectedLength: number;
  expectedChunk: string;
  placedChunk: string | null;
  placedChunkId: string | null;
  isLocked: boolean;
  isMisplaced: boolean;
}

interface TrayChunk {
  id: string;
  text: string;
}

interface FocusedCell {
  lineIdx: number;
  wordIdx: number;
  slotIdx: number;
  charIdx: number;
}

function createInitialGameState(
  structuredLines: HaikuLineInfo[],
  dateKey: string,
  puzzleId: string,
  isCustomMode: boolean,
  currentHash?: string
) {
  const newSlots: Record<string, SlotState> = {};
  const initialChunks: TrayChunk[] = [];
  let chunkCounter = 0;

  structuredLines.forEach((lineInfo, lineIdx) => {
    lineInfo.words.forEach((wordInfo, wordIdx) => {
      wordInfo.chunks.forEach((chunkText, slotIdx) => {
        const key = `${lineIdx}-${wordIdx}-${slotIdx}`;
        newSlots[key] = {
          key,
          lineIndex: lineIdx,
          wordIndex: wordIdx,
          slotIndex: slotIdx,
          expectedLength: chunkText.length,
          expectedChunk: chunkText.toUpperCase(),
          placedChunk: null,
          placedChunkId: null,
          isLocked: false,
          isMisplaced: false,
        };
        initialChunks.push({
          id: `chunk-${chunkCounter++}`,
          text: chunkText.toUpperCase(),
        });
      });
    });
  });

  // Deterministic shuffle of initialChunks for the tray
  const shuffled = [...initialChunks].sort((a, b) => {
    let hashA = 0;
    let hashB = 0;
    for (let i = 0; i < a.text.length; i++) hashA += a.text.charCodeAt(i) * (i + 1);
    for (let i = 0; i < b.text.length; i++) hashB += b.text.charCodeAt(i) * (i + 1);
    return (hashA % 7) - (hashB % 7);
  });

  if (!isCustomMode && typeof window !== "undefined") {
    const saved = get17SyllablesProgress(dateKey, puzzleId);
    if (saved) {
      // Invalidate saved progress if puzzle content hash was updated remotely
      if (saved.puzzleHash && currentHash && saved.puzzleHash !== currentHash) {
        clear17SyllablesProgress(dateKey);
      } else {
        const reconstructedTray = [...shuffled];
        const updatedSlots = { ...newSlots };

        Object.entries(saved.placedChunks).forEach(([k, placedText]) => {
          if (placedText && updatedSlots[k]) {
            const trayIdx = reconstructedTray.findIndex((c) => c.text === placedText);
            if (trayIdx !== -1) {
              const matchedChunk = reconstructedTray[trayIdx];
              reconstructedTray.splice(trayIdx, 1);
              updatedSlots[k] = {
                ...updatedSlots[k],
                placedChunk: placedText,
                placedChunkId: matchedChunk.id,
                isLocked: Boolean(saved.lockedChunks[k]),
              };
            }
          }
        });

        return {
          slots: updatedSlots,
          trayChunks: reconstructedTray,
          wordHintsUsed: saved.wordHintsUsed || 0,
          tileHintsUsed: saved.tileHintsUsed || 0,
          elapsedSeconds: saved.elapsedSeconds || 0,
          isGameWon: saved.status === "won",
        };
      }
    }
  }

  return {
    slots: newSlots,
    trayChunks: shuffled,
    wordHintsUsed: 0,
    tileHintsUsed: 0,
    elapsedSeconds: 0,
    isGameWon: false,
  };
}

function resolvePuzzle(
  customParam: string | null,
  todayKey: string
): { puzzle: SeventeenSyllablesPuzzle; isCustomMode: boolean } {
  if (customParam && typeof window !== "undefined") {
    const stored = window.localStorage.getItem(`solgames_v1_17s_custom_${customParam}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.lines)) {
          const customLines = parsed.lines as [string, string, string];
          return {
            puzzle: {
              id: customParam,
              puzzleNumber: 0,
              dateKey: todayKey,
              theme: parsed.theme || "Custom Haiku",
              author: parsed.creatorName || "Friend",
              lines: customLines,
              chunks: sliceHaikuIntoChunks(customLines, 16),
            },
            isCustomMode: true,
          };
        }
      } catch {
        // ignore corrupted local custom
      }
    }

    const decoded = decodeShareable17Haiku(customParam);
    if (decoded) {
      return {
        puzzle: {
          id: decoded.id,
          puzzleNumber: 0,
          dateKey: todayKey,
          theme: decoded.theme,
          author: decoded.creatorName,
          lines: decoded.lines,
          chunks: sliceHaikuIntoChunks(decoded.lines, 16),
        },
        isCustomMode: true,
      };
    }
  }

  const overrides =
    typeof window !== "undefined" ? getAdmin17SyllablesOverrides() : undefined;
  return {
    puzzle: get17SyllablesPuzzleForDate(todayKey, overrides),
    isCustomMode: false,
  };
}

export function SeventeenSyllablesGame() {
  const searchParams = useSearchParams();
  const customParam = searchParams.get("b");
  const modeParam = searchParams.get("mode");
  const {
    profile,
    isAuthenticated,
    isLoading: authLoading,
    openAccountModal,
  } = useAuth();

  const todayKey = useMemo(() => getLocalDateKey(), []);

  const resolvedInitial = useMemo(
    () => resolvePuzzle(customParam, todayKey),
    [customParam, todayKey]
  );

  const [puzzle, setPuzzle] = useState<SeventeenSyllablesPuzzle>(
    resolvedInitial.puzzle
  );
  const puzzleRef = useRef<SeventeenSyllablesPuzzle>(puzzle);
  useEffect(() => {
    puzzleRef.current = puzzle;
  }, [puzzle]);
  const isCustomMode = resolvedInitial.isCustomMode;

  const currentContentHash = useMemo(
    () => computePuzzleContentHash(puzzle),
    [puzzle]
  );

  // Structured lines definition
  const structuredLines = useMemo<HaikuLineInfo[]>(() => {
    return buildStructuredHaikuLines(puzzle.lines);
  }, [puzzle.lines]);

  // Initial game state (computed once per puzzle without setState in effect)
  const initialData = useMemo(
    () =>
      createInitialGameState(
        structuredLines,
        puzzle.dateKey,
        puzzle.id,
        isCustomMode,
        currentContentHash
      ),
    [structuredLines, puzzle.dateKey, puzzle.id, isCustomMode, currentContentHash]
  );

  // Game state
  const [splashDismissed, setSplashDismissed] = useState(false);
  const [slots, setSlots] = useState<Record<string, SlotState>>(initialData.slots);
  const [trayChunks, setTrayChunks] = useState<TrayChunk[]>(initialData.trayChunks);
  const [selectedTrayChunkId, setSelectedTrayChunkId] = useState<string | null>(null);
  const [shakingSlotKey, setShakingSlotKey] = useState<string | null>(null);

  // Hints
  const [wordHintsUsed, setWordHintsUsed] = useState(initialData.wordHintsUsed);
  const [tileHintsUsed, setTileHintsUsed] = useState(initialData.tileHintsUsed);
  const [wordHintConfirmOpen, setWordHintConfirmOpen] = useState(false);
  const [tileHintConfirmOpen, setTileHintConfirmOpen] = useState(false);
  const [activeWordHintKey, setActiveWordHintKey] = useState<string | null>(null);

  // Timer & completion
  const [elapsedSeconds, setElapsedSeconds] = useState(initialData.elapsedSeconds);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isGameWon, setIsGameWon] = useState(initialData.isGameWon);
  const [victoryModalOpen, setVictoryModalOpen] = useState(false);
  const [resultsCopied, setResultsCopied] = useState(false);
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Square Focus, Slashed Visuals, & Header Modals
  const [focusedCell, setFocusedCell] = useState<FocusedCell | null>(null);
  const [slashedCells, setSlashedCells] = useState<Set<string>>(new Set());
  const [checkRevealModalOpen, setCheckRevealModalOpen] = useState(false);
  const [hintsModalOpen, setHintsModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
      }
    };
  }, []);

  // Creator modal (gated strictly behind verified authentication)
  const [creatorModalOpen, setCreatorModalOpen] = useState(false);
  const [pendingCreatorAfterAuth, setPendingCreatorAfterAuth] = useState(false);
  const [dismissedUrlCreateMode, setDismissedUrlCreateMode] = useState(false);
  const [creatorTheme, setCreatorTheme] = useState("");
  const [creatorName, setCreatorName] = useState(profile?.displayName || "");
  const [syncedProfileName, setSyncedProfileName] = useState<string>(
    profile?.displayName ?? ""
  );
  if ((profile?.displayName ?? "") !== syncedProfileName) {
    const prevName = syncedProfileName;
    const nextName = profile?.displayName ?? "";
    setSyncedProfileName(nextName);
    if (nextName && (creatorName === "" || creatorName === prevName)) {
      setCreatorName(nextName);
    }
  }
  const [creatorLine1, setCreatorLine1] = useState("");
  const [creatorLine2, setCreatorLine2] = useState("");
  const [creatorLine3, setCreatorLine3] = useState("");
  const [creatorErrors, setCreatorErrors] = useState<string[]>([]);
  const [createdShareLink, setCreatedShareLink] = useState<string | null>(null);

  const isCreatorDialogOpen =
    isAuthenticated &&
    !profile?.isBanned &&
    (creatorModalOpen ||
      pendingCreatorAfterAuth ||
      (modeParam === "create" && !dismissedUrlCreateMode));

  const handleCreatorDialogOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setCreatorModalOpen(false);
      setPendingCreatorAfterAuth(false);
      setDismissedUrlCreateMode(true);
    } else {
      setCreatorModalOpen(true);
    }
  }, []);

  const waitingForAuthToCreateRef = useRef(false);

  const requestOpenCreatorModal = useCallback(() => {
    if (authLoading) {
      waitingForAuthToCreateRef.current = true;
      setPendingCreatorAfterAuth(true);
      return;
    }
    if (profile?.isBanned) {
      toast({
        title: "Account Suspended",
        description:
          "Your account has been suspended from creating custom haikus.",
        variant: "destructive",
      });
      return;
    }
    if (!isAuthenticated || !profile) {
      setPendingCreatorAfterAuth(true);
      toast({
        title: "Sign In Required",
        description:
          "Please sign in or create a free account to compose and share custom 17 Syllables haikus.",
      });
      openAccountModal("signin");
      return;
    }
    setCreatorErrors([]);
    setCreatorModalOpen(true);
  }, [authLoading, isAuthenticated, openAccountModal, profile]);

  useEffect(() => {
    if (!waitingForAuthToCreateRef.current || authLoading) return;
    waitingForAuthToCreateRef.current = false;
    if (profile?.isBanned) {
      toast({
        title: "Account Suspended",
        description:
          "Your account has been suspended from creating custom haikus.",
        variant: "destructive",
      });
      return;
    }
    if (!isAuthenticated || !profile) {
      toast({
        title: "Sign In Required",
        description:
          "Please sign in or create a free account to compose and share custom 17 Syllables haikus.",
      });
      openAccountModal("signin");
    }
  }, [authLoading, isAuthenticated, openAccountModal, profile]);

  // Real-Time Propagation: update board when puzzle is modified by Game Master
  const applyRemotePuzzleIfChanged = useCallback(
    (remotePuzzle: SeventeenSyllablesPuzzle) => {
      if (isCustomMode) return;
      const activePuzzle = puzzleRef.current;
      const remoteHash = computePuzzleContentHash(remotePuzzle);
      const currentHash = computePuzzleContentHash(activePuzzle);
      const linesChanged =
        remotePuzzle.lines.join("|") !== activePuzzle.lines.join("|");
      const themeChanged = remotePuzzle.theme !== activePuzzle.theme;

      if (remoteHash !== currentHash || linesChanged || themeChanged) {
        puzzleRef.current = remotePuzzle;
        clear17SyllablesProgress(todayKey);
        const nextStructured = buildStructuredHaikuLines(remotePuzzle.lines);
        const base = createInitialGameState(
          nextStructured,
          todayKey,
          remotePuzzle.id,
          false,
          remoteHash
        );
        setPuzzle(remotePuzzle);
        setSlots(base.slots);
        setTrayChunks(base.trayChunks);
        setSelectedTrayChunkId(null);
        setWordHintsUsed(0);
        setTileHintsUsed(0);
        setElapsedSeconds(0);
        setIsTimerRunning(false);
        setIsGameWon(false);
        setVictoryModalOpen(false);
        if (copyFeedbackTimerRef.current) {
          clearTimeout(copyFeedbackTimerRef.current);
          copyFeedbackTimerRef.current = null;
        }
        setResultsCopied(false);

        save17SyllablesProgress({
          dateKey: todayKey,
          puzzleId: remotePuzzle.id,
          placedChunks: {},
          lockedChunks: {},
          remainingTrayChunks: base.trayChunks.map((c) => c.text),
          wordHintsUsed: 0,
          tileHintsUsed: 0,
          stars: 3.0,
          elapsedSeconds: 0,
          status: "playing",
          puzzleHash: remoteHash,
        });
      }
    },
    [isCustomMode, todayKey]
  );

  // Fetch remote Supabase daily_puzzles override on mount and listen to live updates
  useEffect(() => {
    if (isCustomMode) return;
    let active = true;

    void fetchRemote17SyllablesOverride(todayKey).then((remotePuzzle) => {
      if (!active || !remotePuzzle) return;
      applyRemotePuzzleIfChanged(remotePuzzle);
    });

    const handlePuzzlesUpdated = (e: Event) => {
      if (!active) return;
      const detail = (e as CustomEvent)?.detail;
      if (detail?.gameSlug && detail.gameSlug !== "17-syllables") return;
      if (!detail || !detail.dateKey || detail.dateKey === todayKey) {
        if (detail?.puzzle && detail.dateKey === todayKey) {
          applyRemotePuzzleIfChanged(detail.puzzle as SeventeenSyllablesPuzzle);
          return;
        }
        const local = getAdmin17SyllablesOverrides()[todayKey];
        if (local) {
          applyRemotePuzzleIfChanged(local);
        } else {
          void fetchRemote17SyllablesOverride(todayKey).then((remotePuzzle) => {
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
  }, [isCustomMode, todayKey, applyRemotePuzzleIfChanged]);

  // Timer effect
  useEffect(() => {
    if (!isTimerRunning || isGameWon) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, isGameWon]);

  // Star calculation: 3.0 initial - (1/3 per word hint) - (1/2 per tile hint)
  const currentStars = useMemo(() => {
    const penalty = wordHintsUsed * (1 / 3) + tileHintsUsed * 0.5;
    return Math.max(0, Math.round((3.0 - penalty) * 10) / 10);
  }, [wordHintsUsed, tileHintsUsed]);

  // Auto-save progress
  useEffect(() => {
    if (isCustomMode || !splashDismissed || Object.keys(slots).length === 0) return;

    const placedMap: Record<string, string | null> = {};
    const lockedMap: Record<string, boolean> = {};

    Object.values(slots).forEach((s) => {
      placedMap[s.key] = s.placedChunk;
      lockedMap[s.key] = s.isLocked;
    });

    save17SyllablesProgress({
      dateKey: puzzle.dateKey,
      puzzleId: puzzle.id,
      placedChunks: placedMap,
      lockedChunks: lockedMap,
      remainingTrayChunks: trayChunks.map((c) => c.text),
      wordHintsUsed,
      tileHintsUsed,
      stars: currentStars,
      elapsedSeconds,
      status: isGameWon ? "won" : "playing",
      puzzleHash: currentContentHash,
    });
  }, [
    slots,
    trayChunks,
    wordHintsUsed,
    tileHintsUsed,
    currentStars,
    elapsedSeconds,
    isGameWon,
    isCustomMode,
    splashDismissed,
    puzzle.dateKey,
    puzzle.id,
    currentContentHash,
  ]);

  // Full-Board Check Routine
  const checkFullBoard = useCallback(
    (currentSlots: Record<string, SlotState>) => {
      const allFilled = Object.values(currentSlots).every((s) => s.placedChunk !== null);
      if (!allFilled) return;

      let allCorrect = true;
      const nextSlots = { ...currentSlots };

      Object.values(nextSlots).forEach((s) => {
        if (s.placedChunk !== s.expectedChunk) {
          allCorrect = false;
          nextSlots[s.key] = { ...s, isMisplaced: true };
        } else {
          nextSlots[s.key] = { ...s, isMisplaced: false };
        }
      });

      if (allCorrect) {
        setIsGameWon(true);
        setIsTimerRunning(false);
        if (!isCustomMode) {
          record17SyllablesWin(puzzle.dateKey, currentStars, elapsedSeconds);
        }
        setTimeout(() => {
          setVictoryModalOpen(true);
        }, 600);
      } else {
        setSlots(nextSlots);
        toast({
          title: "Not quite, try again",
          description:
            "Some chunks are misplaced (highlighted in red). Correct chunks remain untouched!",
        });
      }
    },
    [currentStars, elapsedSeconds, isCustomMode, puzzle.dateKey]
  );

  // Placement Action
  const handlePlaceChunk = useCallback(
    (targetSlotKey: string, chunkIdToPlace?: string) => {
      const chunkId = chunkIdToPlace || selectedTrayChunkId;
      if (!chunkId) return;

      const chunk = trayChunks.find((c) => c.id === chunkId);
      const slot = slots[targetSlotKey];
      if (!chunk || !slot) return;

      // Strict Collision Rule (Q8):
      // Non-empty target or mismatched length returns chunk to tray with subtle shake
      if (slot.placedChunk !== null || slot.expectedLength !== chunk.text.length) {
        setShakingSlotKey(targetSlotKey);
        setTimeout(() => setShakingSlotKey(null), 450);
        return;
      }

      // Valid placement
      const nextSlots: Record<string, SlotState> = {
        ...slots,
        [targetSlotKey]: {
          ...slot,
          placedChunk: chunk.text,
          placedChunkId: chunk.id,
          isMisplaced: false,
        },
      };

      setSlots(nextSlots);
      setTrayChunks((prev) => prev.filter((c) => c.id !== chunk.id));
      setSelectedTrayChunkId(null);

      // Clear any previous error slashes for this slot
      setSlashedCells((prev) => {
        const next = new Set(prev);
        for (let c = 0; c < 10; c++) {
          next.delete(`${targetSlotKey}-${c}`);
        }
        return next;
      });

      // Check board if filled
      checkFullBoard(nextSlots);
    },
    [selectedTrayChunkId, trayChunks, slots, checkFullBoard]
  );

  // Remove placed chunk
  const handleRemoveChunk = useCallback(
    (slotKey: string) => {
      const slot = slots[slotKey];
      if (!slot || slot.placedChunk === null) return;

      if (slot.isLocked) {
        toast({
          title: "Tile is Locked",
          description: "This chunk was locked by a hint and cannot be removed.",
        });
        return;
      }

      const returnedChunk: TrayChunk = {
        id: slot.placedChunkId || `chunk-${Date.now()}`,
        text: slot.placedChunk,
      };

      setSlots((prev) => ({
        ...prev,
        [slotKey]: {
          ...slot,
          placedChunk: null,
          placedChunkId: null,
          isMisplaced: false,
        },
      }));

      // Clear any error slashes for this slot
      setSlashedCells((prev) => {
        const next = new Set(prev);
        for (let c = 0; c < 10; c++) {
          next.delete(`${slotKey}-${c}`);
        }
        return next;
      });

      setTrayChunks((prev) => [...prev, returnedChunk]);
    },
    [slots]
  );

  // Hint 1: Word Hint (max 3, costs 1/3 star)
  const handleConfirmWordHint = useCallback(() => {
    if (wordHintsUsed >= 3) return;

    // Find first word with unplaced or wrong slots
    let targetWordKey: string | null = null;
    let targetWordInfo: { lineIdx: number; wordIdx: number; text: string; chunkLengths: number[] } | null = null;

    for (let l = 0; l < structuredLines.length; l++) {
      for (let w = 0; w < structuredLines[l].words.length; w++) {
        const wordObj = structuredLines[l].words[w];
        const hasUnsolved = wordObj.chunks.some((_, s) => {
          const slot = slots[`${l}-${w}-${s}`];
          return !slot || slot.placedChunk !== slot.expectedChunk;
        });

        if (hasUnsolved) {
          targetWordKey = `${l}-${w}`;
          targetWordInfo = {
            lineIdx: l,
            wordIdx: w,
            text: wordObj.text,
            chunkLengths: wordObj.chunks.map((c) => c.length),
          };
          break;
        }
      }
      if (targetWordKey) break;
    }

    setWordHintsUsed((prev) => prev + 1);
    setWordHintConfirmOpen(false);

    if (targetWordInfo) {
      setActiveWordHintKey(targetWordKey);
      toast({
        title: `Word Hint: Line ${targetWordInfo.lineIdx + 1}, Word ${targetWordInfo.wordIdx + 1}`,
        description: `Target word has ${targetWordInfo.chunkLengths.length} chunk(s) of length: ${targetWordInfo.chunkLengths.join(" + ")} letters.`,
      });
      setTimeout(() => setActiveWordHintKey(null), 8000);
    }
  }, [wordHintsUsed, structuredLines, slots]);

  // Hint 2: Tile Lock Hint (max 2, costs 1/2 star)
  const handleConfirmTileHint = useCallback(() => {
    if (tileHintsUsed >= 2) return;

    // Find first slot that is not locked and not yet correctly filled
    const targetSlot = Object.values(slots).find(
      (s) => !s.isLocked && s.placedChunk !== s.expectedChunk
    );
    if (!targetSlot) {
      setTileHintConfirmOpen(false);
      return;
    }

    const correctText = targetSlot.expectedChunk;
    const nextTray = [...trayChunks];
    const nextSlots = { ...slots };

    // If target slot currently has a wrong chunk, return it to tray
    if (targetSlot.placedChunk && targetSlot.placedChunk !== correctText) {
      nextTray.push({
        id: targetSlot.placedChunkId || `chunk-${Date.now()}`,
        text: targetSlot.placedChunk,
      });
    }

    // Pull correct chunk from tray (or dislodge from another slot if wrongly placed elsewhere)
    let chunkToPlaceId = `chunk-locked-${Date.now()}`;
    const trayIdx = nextTray.findIndex((c) => c.text === correctText);
    if (trayIdx !== -1) {
      chunkToPlaceId = nextTray[trayIdx].id;
      nextTray.splice(trayIdx, 1);
    } else {
      // Dislodge from another wrong slot where it might be sitting
      const otherSlotKey = Object.keys(nextSlots).find(
        (k) => k !== targetSlot.key && nextSlots[k].placedChunk === correctText && !nextSlots[k].isLocked
      );
      if (otherSlotKey) {
        chunkToPlaceId = nextSlots[otherSlotKey].placedChunkId || chunkToPlaceId;
        nextSlots[otherSlotKey] = {
          ...nextSlots[otherSlotKey],
          placedChunk: null,
          placedChunkId: null,
          isMisplaced: false,
        };
      }
    }

    // Lock chunk into target slot
    nextSlots[targetSlot.key] = {
      ...targetSlot,
      placedChunk: correctText,
      placedChunkId: chunkToPlaceId,
      isLocked: true,
      isMisplaced: false,
    };

    setSlots(nextSlots);
    setTrayChunks(nextTray);
    setTileHintsUsed((prev) => prev + 1);
    setTileHintConfirmOpen(false);

    toast({
      title: "Tile Locked!",
      description: `Chunk "${correctText}" has been permanently locked in its correct position.`,
    });

    checkFullBoard(nextSlots);
  }, [tileHintsUsed, slots, trayChunks, checkFullBoard]);

  // Custom Haiku Creation (strictly requires verified non-banned auth session)
  const handlePublishCustomHaiku = useCallback(() => {
    setCreatorErrors([]);

    if (!isAuthenticated || !profile) {
      toast({
        title: "Sign In Required",
        description:
          "You must be signed in to publish a custom 17 Syllables haiku.",
        variant: "destructive",
      });
      openAccountModal("signin");
      return;
    }

    if (profile.isBanned) {
      toast({
        title: "Account Suspended",
        description:
          "Your account has been suspended from publishing custom haikus.",
        variant: "destructive",
      });
      return;
    }

    const val = validateHaikuStructure([creatorLine1, creatorLine2, creatorLine3]);
    if (!val.isValid) {
      setCreatorErrors(val.errors);
      return;
    }

    const effectiveTheme = (creatorTheme || "My Custom Haiku").trim();
    const effectiveCreatorName = (
      creatorName ||
      profile.displayName ||
      "Friend"
    ).trim();

    // Content moderation check across theme, creator name, and all 3 haiku lines (private mode)
    const mod = check17SyllablesPuzzleModeration(
      {
        theme: effectiveTheme,
        author: effectiveCreatorName,
        lines: [creatorLine1, creatorLine2, creatorLine3],
      },
      { mode: "private" }
    );

    if (!mod.allowed) {
      setCreatorErrors([
        mod.reason ||
          mod.flaggedReason ||
          "Content violates moderation policy.",
      ]);
      return;
    }

    const shortId = generateShortGameId("17s");
    const customPayload = {
      id: shortId,
      theme: effectiveTheme,
      creatorName: effectiveCreatorName,
      lines: [
        creatorLine1.trim().toUpperCase(),
        creatorLine2.trim().toUpperCase(),
        creatorLine3.trim().toUpperCase(),
      ] as [string, string, string],
    };

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        `solgames_v1_17s_custom_${shortId}`,
        JSON.stringify(customPayload)
      );
    }

    const shareUrl = build17SyllablesShareUrl({ id: shortId });
    setCreatedShareLink(shareUrl);

    void shareCustomGame({
      title: customPayload.theme,
      shareUrl,
      creatorName: customPayload.creatorName,
      gameName: "17 Syllables",
    });
  }, [
    creatorLine1,
    creatorLine2,
    creatorLine3,
    creatorTheme,
    creatorName,
    isAuthenticated,
    openAccountModal,
    profile,
  ]);

  // Build share/copy payload for both daily/archive and custom haiku completions
  const buildResultsShareOptions = useCallback((): ShareResultsOptions => {
    const starStr =
      currentStars >= 3
        ? "⭐⭐⭐"
        : currentStars >= 2
        ? "⭐⭐"
        : currentStars >= 1
        ? "⭐"
        : "✨";

    const shareUrl =
      typeof window !== "undefined" && window.location?.href
        ? window.location.href
        : isCustomMode
        ? build17SyllablesShareUrl({ id: puzzle.id })
        : "https://21games.ai/games/17-syllables";

    const headerLine = isCustomMode
      ? `17 Syllables — "${puzzle.theme}"`
      : `17 Syllables #${puzzle.puzzleNumber || "Daily"}`;

    const text = [
      headerLine,
      `${starStr} (${currentStars.toFixed(1)}/3)`,
      `⏱️ ${formatTimerSeconds(elapsedSeconds)} · ${wordHintsUsed + tileHintsUsed} hints`,
      "🟩🟩🟩",
      "🟩🟩🟩🟩",
      "🟩🟩🟩",
    ].join("\n");

    return {
      title: isCustomMode
        ? `17 Syllables — ${puzzle.theme}`
        : "17 Syllables Victory",
      text,
      url: shareUrl,
    };
  }, [
    currentStars,
    elapsedSeconds,
    isCustomMode,
    puzzle.id,
    puzzle.puzzleNumber,
    puzzle.theme,
    tileHintsUsed,
    wordHintsUsed,
  ]);

  // R3: "Share" action — native share sheet ONLY (never writes to clipboard or triggers "Copied!")
  const handleNativeShareResults = useCallback(async () => {
    await nativeShareResultsOnly(buildResultsShareOptions());
  }, [buildResultsShareOptions]);

  // R3: "Copy results" action — clipboard ONLY (never calls navigator.share)
  const handleCopyResults = useCallback(async () => {
    const { copied } = await copyResultsOnly(buildResultsShareOptions());
    if (copied) {
      setResultsCopied(true);
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
      }
      copyFeedbackTimerRef.current = setTimeout(() => {
        setResultsCopied(false);
        copyFeedbackTimerRef.current = null;
      }, 2000);
    }
  }, [buildResultsShareOptions]);

  const isPartiallyFilled = useMemo(() => {
    const slotList = Object.values(slots);
    const filledCount = slotList.filter((s) => s.placedChunk !== null).length;
    return filledCount < slotList.length;
  }, [slots]);

  const handleCheckSquare = useCallback(() => {
    if (!focusedCell || isGameWon) return;
    const { lineIdx, wordIdx, slotIdx, charIdx } = focusedCell;
    const slotKey = `${lineIdx}-${wordIdx}-${slotIdx}`;
    const slot = slots[slotKey];
    if (!slot || !slot.placedChunk) {
      toast({
        title: "Square is empty",
        description: "Select a square with an entered letter to check.",
      });
      return;
    }
    const cellId = `${slotKey}-${charIdx}`;
    const isCorrect = slot.placedChunk[charIdx] === slot.expectedChunk[charIdx];
    setSlashedCells((prev) => {
      const next = new Set(prev);
      if (!isCorrect) next.add(cellId);
      else next.delete(cellId);
      return next;
    });
    if (!isCorrect) {
      toast({
        title: "Letter is incorrect",
        description:
          "Marked with a red slash. Tap again to return chunk to tray.",
      });
    } else {
      toast({
        title: "Square is correct!",
        description: "Nice! Keep going.",
      });
    }
  }, [focusedCell, isGameWon, slots]);

  const handleCheckWord = useCallback(() => {
    if (!focusedCell || isGameWon) return;
    const { lineIdx, wordIdx } = focusedCell;
    const targetWord = structuredLines[lineIdx]?.words[wordIdx];
    if (!targetWord) return;

    let errorsFound = 0;
    let filledCount = 0;
    const nextSlashed = new Set(slashedCells);

    targetWord.chunks.forEach((_, sIdx) => {
      const slotKey = `${lineIdx}-${wordIdx}-${sIdx}`;
      const slot = slots[slotKey];
      if (slot?.placedChunk) {
        filledCount++;
        for (let c = 0; c < slot.expectedLength; c++) {
          const cellId = `${slotKey}-${c}`;
          if (slot.placedChunk[c] !== slot.expectedChunk[c]) {
            nextSlashed.add(cellId);
            errorsFound++;
          } else {
            nextSlashed.delete(cellId);
          }
        }
      }
    });

    setSlashedCells(nextSlashed);
    if (filledCount === 0) {
      toast({
        title: "Word is empty",
        description: "Place syllable chunks in this word first to check them.",
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
          filledCount === targetWord.chunks.length
            ? "Complete word is correct!"
            : "Entered letters are correct so far!",
      });
    }
  }, [focusedCell, isGameWon, structuredLines, slots, slashedCells]);

  const handleCheckPuzzle = useCallback(() => {
    if (isGameWon) return;
    let errorsFound = 0;
    let totalPlaced = 0;
    const nextSlashed = new Set<string>();
    const slotList = Object.values(slots);

    slotList.forEach((slot) => {
      if (slot.placedChunk) {
        totalPlaced++;
        for (let c = 0; c < slot.expectedLength; c++) {
          const cellId = `${slot.key}-${c}`;
          if (slot.placedChunk[c] !== slot.expectedChunk[c]) {
            nextSlashed.add(cellId);
            errorsFound++;
          }
        }
      }
    });

    setSlashedCells(nextSlashed);

    if (totalPlaced === slotList.length && errorsFound === 0) {
      checkFullBoard(slots);
      return;
    }

    if (errorsFound > 0) {
      toast({
        title: `Puzzle checked: ${errorsFound} error(s) found`,
        description: "Incorrect letters marked with red slashes.",
      });
    } else {
      toast({
        title: "Puzzle checked: All placed letters correct!",
        description: "Looking great! Keep going to complete the haiku.",
      });
    }
  }, [isGameWon, slots, checkFullBoard]);

  const handleRevealPuzzle = useCallback(() => {
    const nextSlots: Record<string, SlotState> = { ...slots };
    Object.keys(nextSlots).forEach((k) => {
      nextSlots[k] = {
        ...nextSlots[k],
        placedChunk: nextSlots[k].expectedChunk,
        placedChunkId: `revealed-${k}`,
        isLocked: true,
        isMisplaced: false,
      };
    });
    setSlots(nextSlots);
    setTrayChunks([]);
    setSlashedCells(new Set());
    setIsTimerRunning(false);
    setIsGameWon(true);
    if (!isCustomMode) {
      record17SyllablesWin(puzzle.dateKey, 0, elapsedSeconds);
    }
    setTimeout(() => {
      setVictoryModalOpen(true);
    }, 400);
  }, [slots, isCustomMode, puzzle.dateKey, elapsedSeconds]);

  const handleClearPuzzle = useCallback(() => {
    const nextSlots: Record<string, SlotState> = { ...slots };
    const returned: TrayChunk[] = [...trayChunks];

    Object.values(nextSlots).forEach((s) => {
      if (!s.isLocked && s.placedChunk) {
        returned.push({
          id: s.placedChunkId || `chunk-${Date.now()}-${Math.random()}`,
          text: s.placedChunk,
        });
        nextSlots[s.key] = {
          ...s,
          placedChunk: null,
          placedChunkId: null,
          isMisplaced: false,
        };
      }
    });

    setSlots(nextSlots);
    setTrayChunks(returned);
    setSlashedCells(new Set());
    setSelectedTrayChunkId(null);
    toast({
      title: "Puzzle Cleared",
      description: "All entered letters have been returned to tray.",
    });
  }, [slots, trayChunks]);

  const creatorDialogElement = isAuthenticated && !profile?.isBanned ? (
    <Dialog
      open={isCreatorDialogOpen}
      onOpenChange={handleCreatorDialogOpenChange}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <span>Create Your Own 17 Syllables Haiku</span>
          </DialogTitle>
          <DialogDescription>
            Compose a 5 – 7 – 5 haiku to slice into tiles and challenge your friends.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Haiku Theme / Title
            </label>
            <input
              type="text"
              value={creatorTheme}
              onChange={(e) => setCreatorTheme(e.target.value)}
              placeholder="e.g. Autumn Whisper"
              className="w-full px-3 py-2 rounded-xl border-2 border-neutral-300 font-medium text-sm focus:border-black focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Creator Name
            </label>
            <input
              type="text"
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              placeholder="Your Name or @handle"
              className="w-full px-3 py-2 rounded-xl border-2 border-neutral-300 font-medium text-sm focus:border-black focus:outline-hidden"
            />
          </div>

          {/* Line 1 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-neutral-700">Line 1 (5 syllables)</label>
              <span
                className={cn(
                  "text-xs font-mono font-bold",
                  countLineSyllables(creatorLine1) === 5 ? "text-emerald-600" : "text-neutral-500"
                )}
              >
                {countLineSyllables(creatorLine1)} / 5 {countLineSyllables(creatorLine1) === 5 && "✓"}
              </span>
            </div>
            <input
              type="text"
              value={creatorLine1}
              onChange={(e) => setCreatorLine1(e.target.value)}
              placeholder="OLD GOLD AUTUMN LEAVES"
              className="w-full px-3 py-2 rounded-xl border-2 border-neutral-300 uppercase font-mono text-sm focus:border-black focus:outline-hidden"
            />
          </div>

          {/* Line 2 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-neutral-700">Line 2 (7 syllables)</label>
              <span
                className={cn(
                  "text-xs font-mono font-bold",
                  countLineSyllables(creatorLine2) === 7 ? "text-emerald-600" : "text-neutral-500"
                )}
              >
                {countLineSyllables(creatorLine2)} / 7 {countLineSyllables(creatorLine2) === 7 && "✓"}
              </span>
            </div>
            <input
              type="text"
              value={creatorLine2}
              onChange={(e) => setCreatorLine2(e.target.value)}
              placeholder="DRIFTING DOWN TO FROZEN SOIL"
              className="w-full px-3 py-2 rounded-xl border-2 border-neutral-300 uppercase font-mono text-sm focus:border-black focus:outline-hidden"
            />
          </div>

          {/* Line 3 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-neutral-700">Line 3 (5 syllables)</label>
              <span
                className={cn(
                  "text-xs font-mono font-bold",
                  countLineSyllables(creatorLine3) === 5 ? "text-emerald-600" : "text-neutral-500"
                )}
              >
                {countLineSyllables(creatorLine3)} / 5 {countLineSyllables(creatorLine3) === 5 && "✓"}
              </span>
            </div>
            <input
              type="text"
              value={creatorLine3}
              onChange={(e) => setCreatorLine3(e.target.value)}
              placeholder="WINTER REACHES IN"
              className="w-full px-3 py-2 rounded-xl border-2 border-neutral-300 uppercase font-mono text-sm focus:border-black focus:outline-hidden"
            />
          </div>

          {creatorErrors.length > 0 && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-1">
              {creatorErrors.map((err, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          {createdShareLink && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-2">
              <p className="font-bold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Haiku Ready to Share!</span>
              </p>
              <input
                type="text"
                readOnly
                value={createdShareLink}
                className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded font-mono text-[11px]"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => handleCreatorDialogOpenChange(false)}
            className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-black"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePublishCustomHaiku}
            className="px-5 py-2.5 bg-black text-white rounded-full font-bold text-xs hover:bg-neutral-800 cursor-pointer shadow-xs"
          >
            Generate &amp; Share Link
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  // Gate direct ?mode=create navigation for unauthenticated guests or suspended accounts
  if (modeParam === "create" && !dismissedUrlCreateMode && !isAuthenticated) {
    return (
      <GameShell
        gameSlug="17-syllables"
        gameTitle="17 Syllables"
        puzzleNumber={puzzle.puzzleNumber}
        dateKey={puzzle.dateKey}
        author={puzzle.author}
        subtitle="Haiku Fragment Reconstruction"
      >
        {authLoading ? (
          <div className="rounded-2xl border-2 border-black bg-white p-8 text-center space-y-3 max-w-lg mx-auto shadow-[0_4px_0_#111111] my-8">
            <Loader2 className="h-7 w-7 animate-spin mx-auto text-black" />
            <p className="text-sm font-bold text-gray-700">
              Verifying account session...
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-black bg-white p-6 sm:p-8 text-center space-y-4 max-w-lg mx-auto shadow-[0_4px_0_#111111] my-8">
            <div className="h-14 w-14 rounded-full bg-emerald-50 border-2 border-black flex items-center justify-center mx-auto text-black">
              <Lock className="h-7 w-7" />
            </div>
            <h2 className="font-headline font-black text-2xl text-black">
              {profile?.isBanned
                ? "Account Suspended"
                : "Sign In to Create Custom Haikus"}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              {profile?.isBanned
                ? "Your account has been suspended from creating and sharing custom 17 Syllables haikus."
                : "Composing and sharing custom 17 Syllables haiku puzzles requires an account. Sign in or register for free to craft 5–7–5 puzzles for your friends."}
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              {!profile?.isBanned && (
                <Button
                  onClick={() => {
                    setPendingCreatorAfterAuth(true);
                    openAccountModal("signin");
                  }}
                  className="bg-black text-white hover:bg-gray-800 font-bold border-2 border-black"
                >
                  Sign In or Register
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setDismissedUrlCreateMode(true)}
                className="border-2 border-black font-bold"
              >
                Play Today&apos;s Haiku
              </Button>
            </div>
          </div>
        )}
      </GameShell>
    );
  }

  // If splash screen not yet dismissed
  if (!splashDismissed) {
    const isCompleted = !isCustomMode && isDateCompleted("17-syllables", puzzle.dateKey);
    const hasProgress =
      !isCustomMode &&
      Boolean(get17SyllablesProgress(puzzle.dateKey, puzzle.id)?.placedChunks);

    return (
      <GameShell
        gameSlug="17-syllables"
        gameTitle="17 Syllables"
        puzzleNumber={puzzle.puzzleNumber}
        dateKey={puzzle.dateKey}
        author={puzzle.author}
        subtitle="Haiku Fragment Reconstruction"
      >
        <GameSplashScreen
          gameSlug="17-syllables"
          gameTitle="17 Syllables"
          tagline="Reconstruct the daily 5-7-5 haiku from poetical fragments"
          theme={puzzle.theme}
          author={puzzle.author}
          puzzleNumber={puzzle.puzzleNumber}
          dateKey={puzzle.dateKey}
          showCreate={true}
          isCompletedToday={isCompleted}
          hasSavedProgress={hasProgress}
          onPlay={() => {
            setSplashDismissed(true);
            if (isGameWon) {
              setVictoryModalOpen(true);
            } else {
              setIsTimerRunning(true);
            }
          }}
          onCreate={requestOpenCreatorModal}
        />

        {creatorDialogElement}
      </GameShell>
    );
  }

  // Active Playable Game Board
  return (
    <GameShell
      gameSlug="17-syllables"
      gameTitle="17 Syllables"
      puzzleNumber={puzzle.puzzleNumber}
      dateKey={puzzle.dateKey}
      author={puzzle.author}
      subtitle={puzzle.theme}
      unifiedHeader={true}
      helpOpen={helpOpen}
      onHelpOpenChange={setHelpOpen}
      statsOpen={statsOpen}
      onStatsOpenChange={setStatsOpen}
      headerRightSlot={
        <div className="flex items-center gap-1 min-[375px]:gap-1.5">
          {/* Combined Timer & Rating Pill */}
          <div className="inline-flex h-7 min-[375px]:h-8 sm:h-9 items-center gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl border-2 border-black bg-white px-2 min-[375px]:px-2.5 font-mono text-[11px] min-[375px]:text-xs sm:text-sm font-black text-black">
            <Star className="w-3 h-3 min-[375px]:w-3.5 min-[375px]:h-3.5 fill-[#F9D423] text-black shrink-0" />
            <span>{currentStars.toFixed(1)}</span>
            <span className="text-neutral-300">|</span>
            <span>{formatTimerSeconds(elapsedSeconds)}</span>
          </div>

          {/* Lifesaver (Check & Reveal) */}
          <button
            type="button"
            onClick={() => setCheckRevealModalOpen(true)}
            disabled={isGameWon}
            className={cn(
              "h-7 w-7 min-[375px]:h-8 min-[375px]:w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-40",
              checkRevealModalOpen
                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                : "border-black/20 hover:border-black bg-white text-black"
            )}
            title="Check or Reveal Puzzle"
            aria-label="Check or Reveal Puzzle"
          >
            <LifeBuoy className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4" />
          </button>

          {/* Hints */}
          <button
            type="button"
            onClick={() => setHintsModalOpen(true)}
            disabled={isGameWon || (wordHintsUsed >= 3 && tileHintsUsed >= 2)}
            className="h-7 w-7 min-[375px]:h-8 min-[375px]:w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl border-2 border-black/20 hover:border-black bg-white text-black flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-40"
            title="Hints"
            aria-label="Hints"
          >
            <Lightbulb className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4 text-[#F9D423] fill-[#F9D423]" />
          </button>

          {/* How to Play */}
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="h-7 w-7 min-[375px]:h-8 min-[375px]:w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl border-2 border-black/20 hover:border-black bg-white text-black flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="How to Play"
            aria-label="How to Play"
          >
            <HelpCircle className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4" />
          </button>

          {/* Settings */}
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
      <div className="space-y-6 max-w-3xl mx-auto pb-12">
        {/* Top Control Bar: Theme Pill + Hints */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-2xl border-2 border-black/10 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              Haiku Theme:
            </span>
            <span className="text-xs sm:text-sm font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {puzzle.theme}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Word Hint Button */}
            <button
              type="button"
              onClick={() => setWordHintConfirmOpen(true)}
              disabled={wordHintsUsed >= 3 || isGameWon}
              className={cn(
                "px-3 py-1.5 rounded-full border-2 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                wordHintsUsed >= 3
                  ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed"
                  : "bg-white text-black border-neutral-300 hover:border-black active:scale-95"
              )}
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              <span>Word Hint ({3 - wordHintsUsed})</span>
            </button>

            {/* Tile Lock Hint Button */}
            <button
              type="button"
              onClick={() => setTileHintConfirmOpen(true)}
              disabled={tileHintsUsed >= 2 || isGameWon}
              className={cn(
                "px-3 py-1.5 rounded-full border-2 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                tileHintsUsed >= 2
                  ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed"
                  : "bg-white text-emerald-800 border-emerald-300 hover:border-emerald-600 active:scale-95"
              )}
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
              <span>Lock Tile ({2 - tileHintsUsed})</span>
            </button>
          </div>
        </div>

        {/* Haiku Board: 3 Horizontal Lines (5 - 7 - 5) */}
        <div className="bg-white border-2 border-black rounded-3xl p-4 sm:p-8 shadow-[0_6px_0_#111111] space-y-6 sm:space-y-8">
          {structuredLines.map((lineInfo, lineIdx) => (
            <div key={lineIdx} className="space-y-2">
              {/* Syllable Pill */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-300 text-neutral-600">
                  Line {lineIdx + 1} ({lineInfo.syllables} syllables)
                </span>
              </div>

              {/* Word Spans with fixed gaps */}
              <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-3">
                {lineInfo.words.map((wordInfo, wordIdx) => {
                  const isWordHintActive = activeWordHintKey === `${lineIdx}-${wordIdx}`;

                  return (
                    <div
                      key={wordIdx}
                      className={cn(
                        "inline-flex items-center gap-1.5 p-1 rounded-xl transition-all",
                        isWordHintActive &&
                          "ring-2 ring-purple-500 bg-purple-50/50 scale-105 shadow-sm"
                      )}
                    >
                      {wordInfo.chunks.map((_, slotIdx) => {
                        const slotKey = `${lineIdx}-${wordIdx}-${slotIdx}`;
                        const slot = slots[slotKey];
                        if (!slot) return null;

                        const isShaking = shakingSlotKey === slotKey;
                        const isFilled = slot.placedChunk !== null;

                        return (
                          <div
                            key={slotIdx}
                            onClick={() => {
                              if (isGameWon) return;
                              const isSlotFocused =
                                focusedCell?.lineIdx === lineIdx &&
                                focusedCell?.wordIdx === wordIdx &&
                                focusedCell?.slotIdx === slotIdx;

                              if (isFilled) {
                                if (isSlotFocused && !slot.isLocked) {
                                  // Two-tap return: tapping already-focused slot returns to tray
                                  handleRemoveChunk(slotKey);
                                } else {
                                  setFocusedCell({ lineIdx, wordIdx, slotIdx, charIdx: 0 });
                                }
                              } else if (selectedTrayChunkId) {
                                handlePlaceChunk(slotKey);
                                setFocusedCell({ lineIdx, wordIdx, slotIdx, charIdx: 0 });
                              } else {
                                setFocusedCell({ lineIdx, wordIdx, slotIdx, charIdx: 0 });
                              }
                            }}
                            onDragOver={(e) => {
                              if (isGameWon) return;
                              e.preventDefault();
                            }}
                            onDrop={(e) => {
                              if (isGameWon) return;
                              e.preventDefault();
                              const chunkId = e.dataTransfer.getData("text/plain");
                              handlePlaceChunk(slotKey, chunkId);
                              setFocusedCell({ lineIdx, wordIdx, slotIdx, charIdx: 0 });
                            }}
                            className={cn(
                              "relative inline-flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-lg border-2 transition-all select-none cursor-pointer",
                              isShaking && "animate-bounce ring-2 ring-red-500",
                              !isFilled &&
                                "border-dashed border-neutral-300 bg-neutral-50/60 hover:border-black/50 hover:bg-neutral-100",
                              isFilled &&
                                !slot.isMisplaced &&
                                !slot.isLocked &&
                                !isGameWon &&
                                "border-black bg-white shadow-xs hover:border-red-400",
                              slot.isLocked &&
                                "border-emerald-500 bg-emerald-50/70 text-emerald-950",
                              slot.isMisplaced &&
                                "border-red-500 bg-red-50 text-red-700 animate-pulse",
                              isGameWon &&
                                "border-emerald-500 bg-emerald-50 text-emerald-950 shadow-[0_0_10px_rgba(46,204,113,0.4)]"
                            )}
                          >
                            {/* Individual character boxes inside slot */}
                            {Array.from({ length: slot.expectedLength }).map((_, charIdx) => {
                              const char = slot.placedChunk ? slot.placedChunk[charIdx] : "";
                              const cellId = `${slotKey}-${charIdx}`;
                              const isSlashed = slashedCells.has(cellId);
                              const isCellFocused =
                                focusedCell?.lineIdx === lineIdx &&
                                focusedCell?.wordIdx === wordIdx &&
                                focusedCell?.slotIdx === slotIdx &&
                                focusedCell?.charIdx === charIdx;
                              const isSlotFocused =
                                focusedCell?.lineIdx === lineIdx &&
                                focusedCell?.wordIdx === wordIdx &&
                                focusedCell?.slotIdx === slotIdx;

                              return (
                                <div
                                  key={charIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isGameWon) return;
                                    if (isFilled) {
                                      if (isSlotFocused && !slot.isLocked) {
                                        // Two-tap return: tapping already-focused slot returns to tray
                                        handleRemoveChunk(slotKey);
                                      } else {
                                        setFocusedCell({ lineIdx, wordIdx, slotIdx, charIdx });
                                      }
                                    } else if (selectedTrayChunkId) {
                                      handlePlaceChunk(slotKey);
                                      setFocusedCell({ lineIdx, wordIdx, slotIdx, charIdx: 0 });
                                    } else {
                                      setFocusedCell({ lineIdx, wordIdx, slotIdx, charIdx });
                                    }
                                  }}
                                  className={cn(
                                    "relative w-7 h-8 sm:w-9 sm:h-11 rounded flex items-center justify-center font-mono font-black text-sm sm:text-lg uppercase transition-all select-none cursor-pointer",
                                    !isFilled && "bg-neutral-100/70 text-transparent",
                                    isFilled &&
                                      !slot.isMisplaced &&
                                      !slot.isLocked &&
                                      !isSlashed &&
                                      "bg-white text-black border border-neutral-200",
                                    slot.isLocked && "bg-emerald-100 text-emerald-950",
                                    (slot.isMisplaced || isSlashed) &&
                                      "bg-red-50 text-red-700 border-2 border-red-500",
                                    isCellFocused && "ring-2 ring-black scale-105 z-10 shadow-xs"
                                  )}
                                >
                                  {char}

                                  {/* NYT Red Diagonal Slash */}
                                  {isSlashed && (
                                    <svg
                                      viewBox="0 0 48 48"
                                      className="pointer-events-none absolute inset-0 h-full w-full text-red-600/85"
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
                                </div>
                              );
                            })}

                            {/* Lock badge if locked */}
                            {slot.isLocked && (
                              <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                                <Lock className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Section: Inline Completion Card (when won) or Available Chunks Tray */}
        {isGameWon ? (
          <div className="bg-emerald-50/70 border-2 border-black rounded-3xl p-4 sm:p-6 shadow-[0_4px_0_#111111] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 border-2 border-black text-emerald-800 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-headline font-black text-lg sm:text-xl text-black leading-tight">
                    Haiku Reconstructed!
                  </h2>
                  <p className="text-xs font-medium text-neutral-600">
                    {isCustomMode
                      ? `${puzzle.theme} · Custom Haiku by ${puzzle.author}`
                      : `${puzzle.theme} · 17 Syllables #${puzzle.puzzleNumber || "Daily"}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-neutral-300 text-xs font-bold text-black">
                  <Star className="w-3.5 h-3.5 fill-[#F9D423] text-black" />
                  <span>{currentStars.toFixed(1)}</span>
                </span>
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-white border border-neutral-300 text-black">
                  {formatTimerSeconds(elapsedSeconds)}
                </span>
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-white border border-neutral-300 text-neutral-700">
                  {wordHintsUsed + tileHintsUsed} hints
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 w-full">
              <button
                type="button"
                onClick={() => void handleNativeShareResults()}
                className="w-full py-2.5 sm:py-3 px-3 sm:px-4 bg-black text-white hover:bg-neutral-800 active:translate-y-0.5 rounded-full font-bold text-xs sm:text-sm border-2 border-black flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shadow-[0_2px_0_#111111] active:shadow-none transition-all whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={() => void handleCopyResults()}
                className={cn(
                  "w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-full font-bold text-xs sm:text-sm border-2 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shadow-[0_2px_0_#111111] active:translate-y-0.5 active:shadow-none transition-all whitespace-nowrap",
                  resultsCopied
                    ? "bg-emerald-600 text-white border-black"
                    : "bg-white text-black border-black hover:bg-emerald-50"
                )}
              >
                {resultsCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span>Copy results</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-200/80">
              <button
                type="button"
                onClick={() => setVictoryModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900 hover:text-black cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>View Victory Card</span>
              </button>

              <button
                type="button"
                onClick={requestOpenCreatorModal}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-700 hover:text-black cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Create Your Own Haiku</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-neutral-50 border-2 border-black/10 rounded-3xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                Poetic Fragments ({trayChunks.length} remaining)
              </span>
              <span className="text-[11px] text-neutral-400 font-medium hidden sm:inline">
                Tap a chunk to select, then tap a matching empty slot on the board
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-h-[70px]">
              {trayChunks.map((chunk) => {
                const isSelected = selectedTrayChunkId === chunk.id;

                return (
                  <button
                    key={chunk.id}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", chunk.id);
                    }}
                    onClick={() => {
                      setSelectedTrayChunkId(isSelected ? null : chunk.id);
                    }}
                    className={cn(
                      "px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border-2 font-mono font-bold text-sm sm:text-base uppercase transition-all select-none cursor-pointer",
                      isSelected
                        ? "bg-[#F9D423] text-black border-black scale-105 shadow-[0_3px_0_#111111]"
                        : "bg-white text-black border-black shadow-[0_2px_0_#111111] hover:bg-neutral-100 active:translate-y-0.5 active:shadow-none"
                    )}
                  >
                    {chunk.text}
                  </button>
                );
              })}

              {trayChunks.length === 0 && !isGameWon && (
                <div className="w-full text-center py-4 text-xs font-bold text-neutral-400">
                  All fragments placed! Checking haiku...
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Word Hint Confirmation Modal */}
      <Dialog open={wordHintConfirmOpen} onOpenChange={setWordHintConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <span>Use a Word Hint?</span>
            </DialogTitle>
            <DialogDescription>
              Highlights an unsolved word and reveals its constituent chunk lengths.
              This costs <strong>1/3 star</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setWordHintConfirmOpen(false)}
              className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-black"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmWordHint}
              className="px-4 py-2 bg-black text-white rounded-full font-bold text-xs hover:bg-neutral-800"
            >
              Use Hint (-1/3 ★)
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tile Lock Hint Confirmation Modal */}
      <Dialog open={tileHintConfirmOpen} onOpenChange={setTileHintConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-600" />
              <span>Use a Tile Lock Hint?</span>
            </DialogTitle>
            <DialogDescription>
              Automatically places and permanently locks one correct chunk into position.
              This costs <strong>1/2 star</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setTileHintConfirmOpen(false)}
              className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-black"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmTileHint}
              className="px-4 py-2 bg-emerald-600 text-white rounded-full font-bold text-xs hover:bg-emerald-700"
            >
              Lock Tile (-1/2 ★)
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Victory & Share Modal */}
      <Dialog open={victoryModalOpen} onOpenChange={setVictoryModalOpen}>
        <DialogContent className="max-w-md text-center">
          <DialogHeader className="sm:text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
              <Trophy className="w-6 h-6" />
            </div>
            <DialogTitle className="text-2xl font-black font-headline">
              Haiku Reconstructed!
            </DialogTitle>
            <DialogDescription>
              {isCustomMode
                ? `${puzzle.theme} · Custom Haiku by ${puzzle.author}`
                : `${puzzle.theme} · 17 Syllables #${puzzle.puzzleNumber || "Daily"}`}
            </DialogDescription>
          </DialogHeader>

          {/* Solved Poem Showcase */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-center font-serif space-y-1.5 my-2">
            {puzzle.lines.map((l, i) => (
              <p key={i} className="text-sm sm:text-base font-bold text-emerald-950">
                {l}
              </p>
            ))}
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-2 py-2">
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
              <div className="text-[10px] font-bold text-neutral-500 uppercase">Rating</div>
              <div className="font-black text-lg text-black flex items-center justify-center gap-1">
                <Star className="w-4 h-4 fill-[#F9D423] text-black" />
                <span>{currentStars.toFixed(1)}</span>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
              <div className="text-[10px] font-bold text-neutral-500 uppercase">Time</div>
              <div className="font-mono font-black text-lg text-black">
                {formatTimerSeconds(elapsedSeconds)}
              </div>
            </div>

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
              <div className="text-[10px] font-bold text-neutral-500 uppercase">Hints</div>
              <div className="font-mono font-black text-lg text-black">
                {wordHintsUsed + tileHintsUsed}
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-col sm:space-x-0 gap-2.5 pt-2 w-full">
            <div className="grid grid-cols-2 gap-2.5 w-full">
              <button
                type="button"
                onClick={() => void handleNativeShareResults()}
                className="w-full py-2.5 sm:py-3 px-3 sm:px-4 bg-black text-white hover:bg-neutral-800 active:translate-y-0.5 rounded-full font-bold text-xs sm:text-sm border-2 border-black flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shadow-[0_2px_0_#111111] active:shadow-none transition-all whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={() => void handleCopyResults()}
                className={cn(
                  "w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-full font-bold text-xs sm:text-sm border-2 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shadow-[0_2px_0_#111111] active:translate-y-0.5 active:shadow-none transition-all whitespace-nowrap",
                  resultsCopied
                    ? "bg-emerald-600 text-white border-black"
                    : "bg-white text-black border-black hover:bg-emerald-50"
                )}
              >
                {resultsCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span>Copy results</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setVictoryModalOpen(false);
                requestOpenCreatorModal();
              }}
              className="w-full py-2.5 px-4 bg-white text-black hover:bg-neutral-50 rounded-full font-bold text-xs border-2 border-neutral-300 hover:border-black flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Your Own Haiku</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {creatorDialogElement}

      {/* Settings & Tools Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-xs sm:max-w-sm rounded-2xl p-5 border-2 border-black shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-headline font-black">
              <Settings className="h-5 w-5 text-gray-700" />
              Settings &amp; Tools
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Manage your haiku game session, view stats, and access archives.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 pt-2">
            <Link
              href="/games/17-syllables/archive"
              onClick={() => setSettingsOpen(false)}
              className="flex items-center justify-between w-full p-3 rounded-xl border-2 border-black/10 hover:border-black bg-gray-50 font-bold text-sm text-black transition-all"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-600" />
                <span>Playable Archive</span>
              </div>
              <span className="text-xs text-gray-400">Past Haikus &rarr;</span>
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
                requestOpenCreatorModal();
              }}
              className="flex items-center justify-between w-full p-3 rounded-xl border-2 border-black/10 hover:border-black bg-gray-50 font-bold text-sm text-black transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-gray-600" />
                <span>Create Haiku</span>
              </div>
              <span className="text-xs text-gray-400">Compose &rarr;</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                setCheckRevealModalOpen(true);
              }}
              className="flex items-center justify-between w-full p-3 rounded-xl border-2 border-red-200 hover:border-red-400 bg-red-50/50 font-bold text-sm text-red-600 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-red-600" />
                <span>Clear / Reveal</span>
              </div>
              <span className="text-xs text-red-400">Assistance &rarr;</span>
            </button>

            <div className="pt-2 border-t border-black/10 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Account:</span>
              <AccountNavButton variant="compact" />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hints Modal */}
      <Dialog open={hintsModalOpen} onOpenChange={setHintsModalOpen}>
        <DialogContent className="max-w-xs sm:max-w-sm rounded-2xl p-5 border-2 border-black shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-headline font-black">
              <Lightbulb className="h-5 w-5 text-amber-500 fill-amber-500/20" />
              Puzzle Hints
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Need assistance? Use a hint to reveal words or lock tiles.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setHintsModalOpen(false);
                setWordHintConfirmOpen(true);
              }}
              disabled={wordHintsUsed >= 3 || isGameWon}
              className="flex items-center justify-between w-full p-3.5 rounded-xl border-2 border-black/10 hover:border-black bg-purple-50/60 font-bold text-sm text-black transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2.5">
                <Lightbulb className="h-4 w-4 text-purple-600" />
                <div className="text-left">
                  <div className="text-xs font-black">Word Hint ({3 - wordHintsUsed} left)</div>
                  <div className="text-[11px] text-gray-500 font-normal">Highlights next target word (-1/3 ★)</div>
                </div>
              </div>
              <span className="text-xs font-bold text-purple-700">Use &rarr;</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setHintsModalOpen(false);
                setTileHintConfirmOpen(true);
              }}
              disabled={tileHintsUsed >= 2 || isGameWon}
              className="flex items-center justify-between w-full p-3.5 rounded-xl border-2 border-black/10 hover:border-black bg-emerald-50/60 font-bold text-sm text-black transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2.5">
                <KeyRound className="h-4 w-4 text-emerald-600" />
                <div className="text-left">
                  <div className="text-xs font-black">Tile Lock Hint ({2 - tileHintsUsed} left)</div>
                  <div className="text-[11px] text-gray-500 font-normal">Locks 1 chunk in place (-1/2 ★)</div>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700">Use &rarr;</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Check & Reveal Action Modal */}
      <PuzzleCheckRevealModal
        open={checkRevealModalOpen}
        onOpenChange={setCheckRevealModalOpen}
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
