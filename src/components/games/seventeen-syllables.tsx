"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  shareTextResult,
  decodeShareable17Haiku,
} from "@/lib/custom-game-share";
import { checkContentModeration } from "@/lib/moderation";
import { GameSplashScreen } from "@/components/game-splash-screen";
import { GameShell, formatTimerSeconds } from "@/components/game-shell";
import { useAuth } from "@/components/account/auth-provider";
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
  Lock,
  Share2,
  Trophy,
  CheckCircle2,
  PlusCircle,
  Lightbulb,
  KeyRound,
  AlertCircle,
  Star,
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
  const { profile } = useAuth();

  const todayKey = useMemo(() => getLocalDateKey(), []);

  const resolvedInitial = useMemo(
    () => resolvePuzzle(customParam, todayKey),
    [customParam, todayKey]
  );

  const [puzzle, setPuzzle] = useState<SeventeenSyllablesPuzzle>(
    resolvedInitial.puzzle
  );
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

  // Creator modal
  const [creatorModalOpen, setCreatorModalOpen] = useState(false);
  const [creatorTheme, setCreatorTheme] = useState("");
  const [creatorName, setCreatorName] = useState(profile?.displayName || "");
  const [creatorLine1, setCreatorLine1] = useState("");
  const [creatorLine2, setCreatorLine2] = useState("");
  const [creatorLine3, setCreatorLine3] = useState("");
  const [creatorErrors, setCreatorErrors] = useState<string[]>([]);
  const [createdShareLink, setCreatedShareLink] = useState<string | null>(null);

  // Real-Time Propagation: update board when puzzle is modified by Game Master
  const applyRemotePuzzleIfChanged = useCallback(
    (remotePuzzle: SeventeenSyllablesPuzzle) => {
      if (isCustomMode) return;
      const remoteHash = computePuzzleContentHash(remotePuzzle);
      const currentHash = computePuzzleContentHash(puzzle);
      const linesChanged =
        remotePuzzle.lines.join("|") !== puzzle.lines.join("|");
      const themeChanged = remotePuzzle.theme !== puzzle.theme;

      if (remoteHash !== currentHash || linesChanged || themeChanged) {
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
    [isCustomMode, puzzle, todayKey]
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

  // Custom Haiku Creation
  const handlePublishCustomHaiku = useCallback(() => {
    setCreatorErrors([]);

    const val = validateHaikuStructure([creatorLine1, creatorLine2, creatorLine3]);
    if (!val.isValid) {
      setCreatorErrors(val.errors);
      return;
    }

    // Content moderation check (Tier 1 slur ban, Tier 2 allows casual swearing in private)
    const mod1 = checkContentModeration(creatorLine1, { mode: "private" });
    const mod2 = checkContentModeration(creatorLine2, { mode: "private" });
    const mod3 = checkContentModeration(creatorLine3, { mode: "private" });

    if (!mod1.allowed || !mod2.allowed || !mod3.allowed) {
      setCreatorErrors([
        mod1.flaggedReason || mod2.flaggedReason || mod3.flaggedReason || "Content violates moderation policy.",
      ]);
      return;
    }

    const shortId = generateShortGameId("17s");
    const customPayload = {
      id: shortId,
      theme: (creatorTheme || "My Custom Haiku").trim(),
      creatorName: (creatorName || "Friend").trim(),
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
  }, [creatorLine1, creatorLine2, creatorLine3, creatorTheme, creatorName]);

  // Share game result snippet
  const handleShareResults = useCallback(() => {
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
        : "https://21games.ai/games/17-syllables";

    const text = [
      `17 Syllables #${puzzle.puzzleNumber || "Daily"}`,
      `${starStr} (${currentStars.toFixed(1)}/3)`,
      `⏱️ ${formatTimerSeconds(elapsedSeconds)} · ${wordHintsUsed + tileHintsUsed} hints`,
      "🟩🟩🟩",
      "🟩🟩🟩🟩",
      "🟩🟩🟩",
    ].join("\n");

    void shareTextResult({
      title: "17 Syllables Victory",
      text,
      url: shareUrl,
    });
  }, [currentStars, elapsedSeconds, puzzle.puzzleNumber, wordHintsUsed, tileHintsUsed]);

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
            setIsTimerRunning(true);
          }}
          onCreate={() => {
            setCreatorModalOpen(true);
          }}
        />

        {/* Custom Creator Dialog */}
        <Dialog open={creatorModalOpen} onOpenChange={setCreatorModalOpen}>
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
                onClick={() => setCreatorModalOpen(false)}
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
      headerRightSlot={
        <div className="flex items-center gap-2">
          {/* Stars rating badge */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-100 border border-neutral-300 text-xs font-bold">
            <Star className="w-3.5 h-3.5 fill-[#F9D423] text-black" />
            <span>{currentStars.toFixed(1)}</span>
          </div>
          {/* Timer */}
          <div className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-neutral-50 border border-neutral-200">
            {formatTimerSeconds(elapsedSeconds)}
          </div>
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
                              if (isFilled) {
                                handleRemoveChunk(slotKey);
                              } else if (selectedTrayChunkId) {
                                handlePlaceChunk(slotKey);
                              }
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const chunkId = e.dataTransfer.getData("text/plain");
                              handlePlaceChunk(slotKey, chunkId);
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

                              return (
                                <div
                                  key={charIdx}
                                  className={cn(
                                    "w-7 h-8 sm:w-9 sm:h-11 rounded flex items-center justify-center font-mono font-black text-sm sm:text-lg uppercase transition-colors",
                                    !isFilled && "bg-neutral-100/70 text-transparent",
                                    isFilled &&
                                      !slot.isMisplaced &&
                                      !slot.isLocked &&
                                      "bg-white text-black border border-neutral-200",
                                    slot.isLocked && "bg-emerald-100 text-emerald-950",
                                    slot.isMisplaced && "bg-red-100 text-red-800"
                                  )}
                                >
                                  {char}
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

        {/* Bottom Tray: Available Chunks */}
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
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
              <Trophy className="w-6 h-6" />
            </div>
            <DialogTitle className="text-2xl font-black font-headline">
              Haiku Reconstructed!
            </DialogTitle>
            <DialogDescription>
              {puzzle.theme} · 17 Syllables #{puzzle.puzzleNumber || "Daily"}
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

          <DialogFooter className="flex-col sm:flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={handleShareResults}
              className="w-full py-3 px-4 bg-black text-white hover:bg-neutral-800 rounded-full font-bold text-sm border-2 border-black flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Results</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setVictoryModalOpen(false);
                setCreatorModalOpen(true);
              }}
              className="w-full py-2.5 px-4 bg-white text-black hover:bg-neutral-50 rounded-full font-bold text-xs border-2 border-neutral-300 hover:border-black flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Your Own Haiku</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GameShell>
  );
}
