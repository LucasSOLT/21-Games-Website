"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  Crown,
  Mic,
  MicOff,
  RotateCcw,
  Share2,
  Sparkles,
  User,
  Volume2,
  Wand2,
} from "lucide-react";
import {
  decodeShareable21Board,
  encodeShareable21Board,
  get21ThingsBoardForDate,
  getLocalDateKey,
} from "@/lib/daily-engine";
import {
  enforceTileConstraints,
  parseTranscriptTo21Items,
  type TwentyOneJourney,
  type TwentyOneThingsBoard,
} from "@/data/puzzles/21-things";
import {
  clear21ThingsProgress,
  fetchBoardJourneys,
  fetchRemote21ThingsOverride,
  fetchUserCreated21BoardById,
  get21ThingsProgress,
  getAdmin21ThingsOverrides,
  getSavedUser21Boards,
  recordGameWin,
  save21ThingsProgress,
  saveUserCreated21Board,
  submitPlayerJourney,
  type TwentyOneFunnelPhase,
  type TwentyOneSavedProgress,
} from "@/lib/game-storage";
import { GameShell } from "@/components/game-shell";
import { useAuth } from "@/components/account/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: { transcript: string };
    };
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function resolveInitial21Board(
  activeDateKey: string,
  boardTokenParam: string | null,
  boardIdParam: string | null
): TwentyOneThingsBoard {
  if (boardTokenParam) {
    const decoded = decodeShareable21Board(boardTokenParam);
    if (decoded) return decoded;
  }
  if (boardIdParam) {
    const localSaved = getSavedUser21Boards().find((b) => b.id === boardIdParam);
    if (localSaved) return localSaved;
  }
  const overrides = getAdmin21ThingsOverrides();
  return get21ThingsBoardForDate(activeDateKey, overrides);
}

function sanitizeSaved21Progress(
  saved: TwentyOneSavedProgress | null
): TwentyOneSavedProgress | null {
  if (!saved) return null;
  const pick6 = Array.isArray(saved.pick6Indices)
    ? saved.pick6Indices.filter((i) => i >= 0 && i < 21)
    : [];
  const pick3 = Array.isArray(saved.pick3Indices)
    ? saved.pick3Indices.filter((i) => pick6.includes(i))
    : [];
  const pick1 =
    typeof saved.pick1Index === "number" && pick3.includes(saved.pick1Index)
      ? saved.pick1Index
      : null;

  let phase: TwentyOneFunnelPhase = saved.phase;
  if (
    (phase === "reflect" || phase === "complete") &&
    (pick1 === null || pick3.length !== 3 || pick6.length !== 6)
  ) {
    phase = pick3.length === 3 ? "pick1" : pick6.length === 6 ? "pick3" : "pick6";
  } else if (phase === "pick1" && (pick3.length !== 3 || pick6.length !== 6)) {
    phase = pick6.length === 6 ? "pick3" : "pick6";
  } else if (phase === "pick3" && pick6.length !== 6) {
    phase = "pick6";
  }

  return {
    ...saved,
    phase,
    pick6Indices: pick6,
    pick3Indices: pick3,
    pick1Index: pick1,
  };
}

export function TwentyOneThingsGame() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const boardTokenParam = searchParams.get("board");
  const boardIdParam = searchParams.get("boardId");
  const modeParam = searchParams.get("mode");

  const [liveTodayKey, setLiveTodayKey] = useState<string>(() =>
    getLocalDateKey()
  );

  useEffect(() => {
    if (dateParam || boardTokenParam || boardIdParam) return;
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
  }, [dateParam, boardTokenParam, boardIdParam]);

  const activeDateKey = dateParam || liveTodayKey;
  const instanceKey = `${activeDateKey}::${boardTokenParam ?? ""}::${boardIdParam ?? ""}::${modeParam ?? ""}`;

  return (
    <TwentyOneThingsBoardView
      key={instanceKey}
      activeDateKey={activeDateKey}
      boardTokenParam={boardTokenParam}
      boardIdParam={boardIdParam}
      initialMode={modeParam === "create" ? "create" : "play"}
    />
  );
}

function TwentyOneThingsBoardView({
  activeDateKey,
  boardTokenParam,
  boardIdParam,
  initialMode,
}: {
  activeDateKey: string;
  boardTokenParam: string | null;
  boardIdParam: string | null;
  initialMode: "play" | "create";
}) {
  const { toast } = useToast();
  const { profile } = useAuth();

  const [mode, setMode] = useState<"play" | "create">(initialMode);

  const [board, setBoard] = useState<TwentyOneThingsBoard>(() =>
    resolveInitial21Board(activeDateKey, boardTokenParam, boardIdParam)
  );

  const [initialSaved] = useState(() =>
    sanitizeSaved21Progress(get21ThingsProgress(board.id))
  );

  // Funnel state: 21 -> 6 -> 3 -> 1 -> reflect -> complete
  const [phase, setPhase] = useState<TwentyOneFunnelPhase>(
    initialSaved?.phase ?? "pick6"
  );
  const [pick6, setPick6] = useState<number[]>(
    initialSaved?.pick6Indices ?? []
  );
  const [pick3, setPick3] = useState<number[]>(
    initialSaved?.pick3Indices ?? []
  );
  const [pick1, setPick1] = useState<number | null>(
    initialSaved?.pick1Index ?? null
  );
  const [playerName, setPlayerName] = useState<string>(
    () => initialSaved?.playerName || profile?.displayName || ""
  );
  const [reflectionNote, setReflectionNote] = useState<string>(
    initialSaved?.reflectionNote ?? ""
  );
  const [voiceNoteDataUrl, setVoiceNoteDataUrl] = useState<string | undefined>(
    initialSaved?.voiceNoteDataUrl
  );
  const [journeys, setJourneys] = useState<TwentyOneJourney[]>(
    board.sampleJourneys
  );

  // Voice recording state for player reflection
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Creator flow state ("Create & Share Your Own 21 Things")
  const [creatorName, setCreatorName] = useState<string>(
    () => profile?.displayName || ""
  );
  const [syncedProfileName, setSyncedProfileName] = useState<string>(
    profile?.displayName ?? ""
  );
  if ((profile?.displayName ?? "") !== syncedProfileName) {
    const prevDisplayName = syncedProfileName;
    const nextDisplayName = profile?.displayName ?? "";
    setSyncedProfileName(nextDisplayName);
    if (nextDisplayName) {
      if (playerName === "" || playerName === prevDisplayName) {
        setPlayerName(nextDisplayName);
      }
      if (creatorName === "" || creatorName === prevDisplayName) {
        setCreatorName(nextDisplayName);
      }
    }
  }
  const [creatorTitle, setCreatorTitle] = useState(
    "21 Things I Appreciate Today"
  );
  const creatorBio =
    "Narrow my 21 favorite things down to the 1 you resonate with most!";
  const [rawTranscript, setRawTranscript] = useState("");
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [creatorItems, setCreatorItems] = useState<string[]>(() =>
    board.items.slice(0, 21)
  );
  const [autoShortenedCount, setAutoShortenedCount] = useState(0);
  const [shareUrl, setShareUrl] = useState<string>("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Cleanup active microphone or speech recognition sessions on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore stop error on unmount
        }
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore stop error on unmount
        }
      }
    };
  }, []);

  // Load remote Supabase custom board (twenty_one_boards) or daily override (daily_puzzles)
  useEffect(() => {
    let active = true;
    if (boardIdParam && !boardTokenParam) {
      fetchUserCreated21BoardById(boardIdParam).then((remoteBoard) => {
        if (active && remoteBoard) {
          setBoard(remoteBoard);
          setCreatorItems(remoteBoard.items.slice(0, 21));
        }
      });
    } else if (!boardTokenParam && !boardIdParam) {
      fetchRemote21ThingsOverride(activeDateKey).then((remoteOverride) => {
        if (
          active &&
          remoteOverride &&
          (remoteOverride.id !== board.id ||
            remoteOverride.items.join("|") !== board.items.join("|"))
        ) {
          setBoard(remoteOverride);
          setCreatorItems(remoteOverride.items.slice(0, 21));
        }
      });
    }
    return () => {
      active = false;
    };
  }, [activeDateKey, boardIdParam, boardTokenParam, board.id, board.items]);

  // Async fetch journeys (remote Supabase + localStorage + sampleJourneys)
  useEffect(() => {
    let active = true;
    fetchBoardJourneys(board).then((list) => {
      if (active) setJourneys(list);
    });
    return () => {
      active = false;
    };
  }, [board]);

  const persistState = (
    nextPhase: TwentyOneFunnelPhase,
    next6: number[],
    next3: number[],
    next1: number | null,
    nextName = playerName,
    nextNote = reflectionNote,
    nextVoice = voiceNoteDataUrl
  ) => {
    save21ThingsProgress({
      boardId: board.id,
      phase: nextPhase,
      pick6Indices: next6,
      pick3Indices: next3,
      pick1Index: next1,
      playerName: nextName,
      reflectionNote: nextNote,
      voiceNoteDataUrl: nextVoice,
    });
  };

  const handleTileTap = (index: number) => {
    if (phase === "pick6") {
      if (pick6.includes(index)) {
        const next6 = pick6.filter((i) => i !== index);
        setPick6(next6);
        persistState("pick6", next6, [], null);
      } else {
        if (pick6.length >= 6) {
          toast({
            title: "6 Favorites Selected",
            description:
              "Tap a highlighted yellow tile to deselect it, or continue to Phase 2 (Pick 3).",
          });
          return;
        }
        const next6 = [...pick6, index];
        setPick6(next6);
        persistState("pick6", next6, [], null);
      }
      return;
    }

    if (phase === "pick3") {
      if (!pick6.includes(index)) return;
      if (pick3.includes(index)) {
        const next3 = pick3.filter((i) => i !== index);
        setPick3(next3);
        persistState("pick3", pick6, next3, null);
      } else {
        if (pick3.length >= 3) {
          toast({
            title: "Top 3 Selected",
            description:
              "Tap one of your 3 selected tiles to change it, or advance to Phase 3 (Pick 1).",
          });
          return;
        }
        const next3 = [...pick3, index];
        setPick3(next3);
        persistState("pick3", pick6, next3, null);
      }
      return;
    }

    if (phase === "pick1") {
      if (!pick3.includes(index)) return;
      const next1 = pick1 === index ? null : index;
      setPick1(next1);
      persistState("pick1", pick6, pick3, next1);
    }
  };

  const advanceToPick3 = () => {
    if (pick6.length !== 6) return;
    setPhase("pick3");
    persistState("pick3", pick6, pick3, null);
  };

  const advanceToPick1 = () => {
    if (pick3.length !== 3) return;
    setPhase("pick1");
    persistState("pick1", pick6, pick3, null);
  };

  const advanceToReflect = () => {
    if (pick1 === null) return;
    const effectiveName = playerName || profile?.displayName || "";
    if (!playerName && effectiveName) {
      setPlayerName(effectiveName);
    }
    setPhase("reflect");
    persistState("reflect", pick6, pick3, pick1, effectiveName);
  };

  const handleBackStep = () => {
    if (phase === "pick3") {
      setPhase("pick6");
      setPick3([]);
      persistState("pick6", pick6, [], null);
    } else if (phase === "pick1") {
      setPhase("pick3");
      setPick1(null);
      persistState("pick3", pick6, pick3, null);
    } else if (phase === "reflect") {
      setPhase("pick1");
      persistState("pick1", pick6, pick3, pick1);
    }
  };

  const handleResetFunnel = (targetBoardId = board.id) => {
    clear21ThingsProgress(targetBoardId);
    setPhase("pick6");
    setPick6([]);
    setPick3([]);
    setPick1(null);
    setReflectionNote("");
    setVoiceNoteDataUrl(undefined);
    if (!playerName && profile?.displayName) {
      setPlayerName(profile.displayName);
    }
  };

  const startAudioRecording = async () => {
    if (typeof window === "undefined") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            setVoiceNoteDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      toast({
        title: "Microphone Unavailable",
        description:
          "Could not access microphone. You can still type your reflection note below!",
        variant: "destructive",
      });
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const handleSubmitReflection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pick1 === null) return;

    const finalName =
      playerName.trim() || profile?.displayName?.trim() || "Friend";
    const finalNote =
      reflectionNote.trim() ||
      `I narrowed ${board.creatorName}'s 21 Things down to "${board.items[pick1]}" as my #1 resonance!`;

    const created = await submitPlayerJourney({
      boardId: board.id,
      playerName: finalName,
      pick6: pick6.map((i) => board.items[i]),
      pick3: pick3.map((i) => board.items[i]),
      pick1: board.items[pick1],
      reflectionNote: finalNote,
      voiceNoteDataUrl,
    });

    setJourneys((prev) => [created, ...prev]);
    setPhase("complete");
    persistState(
      "complete",
      pick6,
      pick3,
      pick1,
      finalName,
      finalNote,
      voiceNoteDataUrl
    );
    recordGameWin("21-things", activeDateKey, 0);

    toast({
      title: "Sent to Creator Feed!",
      description: `Your 21 → 6 → 3 → 1 journey for "${board.items[pick1]}" is live.`,
    });
  };

  const handleShareJourney = async () => {
    if (pick1 === null) return;
    const text = [
      `✨ 21 Things (${board.title} by ${board.creatorName})`,
      `21 → 6 → 3 → 1 Funnel:`,
      `🟨 Top 6: ${pick6.map((i) => board.items[i]).join(" · ")}`,
      `🟧 Top 3: ${pick3.map((i) => board.items[i]).join(" · ")}`,
      `👑 My #1: "${board.items[pick1]}"`,
      reflectionNote ? `💬 "${reflectionNote}"` : "",
      typeof window !== "undefined"
        ? window.location.href
        : "https://21games.ai/games/21-things",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to Clipboard!",
        description: "Your 21 → 6 → 3 → 1 summary is ready to paste and share.",
      });
    } catch {
      toast({
        title: "Share Summary Ready",
        description: text,
      });
    }
  };

  const toggleVoiceBrainstorm = () => {
    if (isListeningVoice) {
      recognitionRef.current?.stop();
      setIsListeningVoice(false);
      return;
    }

    if (typeof window === "undefined") return;
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      toast({
        title: "Voice Input Fallback",
        description:
          "Your browser doesn't support Web Speech API directly—type or paste your stream of consciousness below and click 'Parse into 21 Tiles'!",
      });
      return;
    }

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let transcriptChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcriptChunk += event.results[i][0].transcript + ", ";
        }
      }
      if (transcriptChunk) {
        setRawTranscript((prev) => {
          const updated = (
            prev ? `${prev} ${transcriptChunk}` : transcriptChunk
          ).trim();
          const parsed = parseTranscriptTo21Items(updated);
          if (parsed.items.length > 0) {
            setCreatorItems((curr) => {
              const merged = [...curr];
              parsed.items.forEach((item, idx) => {
                if (idx < 21) merged[idx] = item;
              });
              return merged;
            });
            setAutoShortenedCount(parsed.autoShortenedCount);
          }
          return updated;
        });
      }
    };

    recognition.onerror = () => setIsListeningVoice(false);
    recognition.onend = () => setIsListeningVoice(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListeningVoice(true);
  };

  const handleParseTranscript = (sourceText = rawTranscript) => {
    if (!sourceText.trim()) {
      toast({
        title: "Speak or Paste a Stream First",
        description:
          "Record or type comma-separated things you appreciate so we can split them into 21 tiles.",
      });
      return;
    }
    const { items, autoShortenedCount: shortened } =
      parseTranscriptTo21Items(sourceText);

    const nextItems = [...creatorItems];
    items.forEach((item, idx) => {
      if (idx < 21) nextItems[idx] = item;
    });
    setCreatorItems(nextItems);
    setAutoShortenedCount(shortened);

    toast({
      title: `Parsed ${items.length} Items into 3×7 Grid`,
      description:
        shortened > 0
          ? `Auto-shortened ${shortened} item(s) to fit the ≤5 words / ≤30 chars mobile tile limit.`
          : "All items fit the ≤5 words / ≤30 chars tile limit!",
    });
  };

  const handleLoadSampleStream = () => {
    const sample =
      "dogs with two different colored eyes, vintage VW Beetles, morning coffee smell, warm laundry right out of the dryer, rain on a tin roof, freshly baked sourdough bread, hitting green lights all the way home, first sip of ice cold water, sunlight filtering through pine trees, vinyl crackle before the song starts, handwritten thank-you notes, golden hour ocean breeze, laughing until your stomach hurts, finding twenty dollars in an old winter coat, crisp autumn leaf crunch, peeling a Clementine in one piece, late-night diner pancakes, cool side of the pillow, streetlight glow in the fog, campfire woodsmoke on a hoodie, unexpected text from an old friend";
    setRawTranscript(sample);
    handleParseTranscript(sample);
  };

  const handleCreatorTileEdit = (idx: number, rawValue: string) => {
    const next = [...creatorItems];
    next[idx] = rawValue;
    setCreatorItems(next);
  };

  const handleCreatorTileBlur = (idx: number) => {
    const current = creatorItems[idx] || "";
    const { text, wasShortened } = enforceTileConstraints(current);
    if (text && text !== current) {
      const next = [...creatorItems];
      next[idx] = text;
      setCreatorItems(next);
      if (wasShortened) {
        toast({
          title: "Tile Auto-Trimmed",
          description: `Shortened to "${text}" (max 5 words / 30 characters).`,
        });
      }
    }
  };

  const handlePublishCustomBoard = async () => {
    const sanitized = creatorItems.map((it, idx) => {
      const { text } = enforceTileConstraints(it);
      return text || `Gratitude #${idx + 1}`;
    });
    setCreatorItems(sanitized);

    const effectiveCreatorName =
      creatorName.trim() || profile?.displayName?.trim() || "";
    const resolvedCreatorName = effectiveCreatorName || "Creator";
    const resolvedHandle =
      profile?.handle &&
      (!creatorName.trim() ||
        creatorName.trim() === profile.displayName.trim())
        ? `@${profile.handle.replace(/^@+/, "")}`
        : `@${resolvedCreatorName.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

    const customBoard: TwentyOneThingsBoard = {
      id: `custom-${Date.now()}`,
      puzzleNumber: 0,
      title:
        creatorTitle.trim() || `${effectiveCreatorName || "My"}'s 21 Things`,
      creatorName: resolvedCreatorName,
      creatorHandle: resolvedHandle,
      creatorBio,
      items: sanitized,
      sampleJourneys: [],
    };

    await saveUserCreated21Board(customBoard, rawTranscript);

    const token = encodeShareable21Board(customBoard);
    const origin =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : "https://21games.ai/games/21-things";
    const fullUrl = `${origin}?boardId=${encodeURIComponent(
      customBoard.id
    )}&board=${encodeURIComponent(token)}`;
    setShareUrl(fullUrl);
    setBoard(customBoard);
    setMode("play");
    handleResetFunnel(customBoard.id);

    try {
      await navigator.clipboard.writeText(fullUrl);
      toast({
        title: "Board Live & Share Link Copied!",
        description:
          "Send the link to friends so they can play your 21 → 6 → 3 → 1 board.",
      });
    } catch {
      toast({
        title: "Your 21 Things Board is Live!",
        description: "Copy your shareable link above to send to friends.",
      });
    }
  };

  return (
    <GameShell
      gameSlug="21-things"
      gameTitle="21 Things"
      puzzleNumber={board.puzzleNumber}
      dateKey={activeDateKey}
      author={board.creatorName}
      headerRightSlot={
        <Button
          variant={mode === "create" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            const nextMode = mode === "play" ? "create" : "play";
            if (nextMode === "create" && !creatorName && profile?.displayName) {
              setCreatorName(profile.displayName);
            }
            setMode(nextMode);
          }}
          className="font-bold border-2 border-black text-[10px] min-[375px]:text-[11px] sm:text-xs h-7 sm:h-9 px-2 min-[375px]:px-2.5 sm:px-3"
        >
          <Mic className="h-3 w-3 min-[375px]:h-3.5 min-[375px]:w-3.5 mr-0.5 min-[375px]:mr-1" />
          {mode === "play" ? "Create Your Own" : "Back to Board"}
        </Button>
      }
    >
      {mode === "create" ? (
        <div className="space-y-5">
          <div className="rounded-2xl border-2 border-black bg-white p-4 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <Badge variant="purple" className="mb-1.5">
                  Creator Flow · AI Voice-to-Board
                </Badge>
                <h2 className="font-headline text-xl sm:text-2xl font-black">
                  Create &amp; Share Your Own 21 Things
                </h2>
                <p className="text-xs sm:text-sm text-gray-600">
                  Tap record and speak a continuous stream of consciousness. We
                  automatically split your thoughts into 21 tiles (≤5 words /
                  ~30 chars each).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={toggleVoiceBrainstorm}
                  className={cn(
                    "font-bold border-2 border-black h-10 px-4",
                    isListeningVoice
                      ? "bg-red-600 text-white hover:bg-red-700 animate-pulse"
                      : "bg-[#F9D423] text-black hover:bg-[#f0ca17]"
                  )}
                >
                  {isListeningVoice ? (
                    <>
                      <MicOff className="h-4 w-4 mr-1.5" />
                      Stop Mic
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 mr-1.5" />
                      Voice Brainstorm
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLoadSampleStream}
                  className="font-bold border-2 border-black h-10 text-xs"
                >
                  <Wand2 className="h-3.5 w-3.5 mr-1" />
                  Try Sample Stream
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                  Your Creator Name
                </label>
                <Input
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="e.g. Lucas Huff"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                  Board Title / Theme
                </label>
                <Input
                  value={creatorTitle}
                  onChange={(e) => setCreatorTitle(e.target.value)}
                  placeholder="e.g. 21 Things Bringing Me Joy"
                />
              </div>
            </div>

            <div className="mb-3">
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                <label className="text-xs font-bold uppercase text-gray-600">
                  Stream of Consciousness Transcript (Comma or Line Separated)
                </label>
                <button
                  type="button"
                  onClick={() => handleParseTranscript()}
                  className="text-xs font-bold text-[#9D50BB] hover:underline flex items-center gap-1"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Split &amp; Format into 21 Tiles →
                </button>
              </div>
              <Textarea
                value={rawTranscript}
                onChange={(e) => setRawTranscript(e.target.value)}
                placeholder="Speak or type freely: dogs with two different colored eyes, vintage VW Beetles, morning coffee smell, rain on a tin roof..."
                className="min-h-[84px]"
              />
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                <span className="text-xs font-bold uppercase text-gray-700">
                  Preview &amp; Edit 3×7 Mobile Grid (Max 5 Words / 30 Chars per Tile)
                </span>
                {autoShortenedCount > 0 && (
                  <Badge variant="yellow">
                    Auto-formatted {autoShortenedCount} long item(s)
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {creatorItems.slice(0, 21).map((item, idx) => {
                  const words = item.trim()
                    ? item.trim().split(/\s+/).length
                    : 0;
                  const chars = item.length;
                  const overLimit = words > 5 || chars > 30;
                  const suggestion = overLimit
                    ? enforceTileConstraints(item).text
                    : "";
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-xl border-2 p-2 bg-[#f5eaf3] transition-all",
                        overLimit
                          ? "border-red-500 bg-red-50"
                          : "border-black/25"
                      )}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 mb-1">
                        <span className="font-bold text-black">#{idx + 1}</span>
                        <span
                          className={cn(overLimit && "text-red-600 font-bold")}
                        >
                          {words}/5w · {chars}/30c
                        </span>
                      </div>
                      <input
                        type="text"
                        value={item}
                        onChange={(e) =>
                          handleCreatorTileEdit(idx, e.target.value)
                        }
                        onBlur={() => handleCreatorTileBlur(idx)}
                        className="w-full bg-white rounded-md border border-black/15 px-2 py-1 text-xs font-bold text-black focus:outline-none focus:border-black"
                        maxLength={50}
                      />
                      {overLimit && suggestion && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleCreatorTileEdit(idx, suggestion);
                          }}
                          className="mt-1 w-full text-left text-[10px] font-bold text-purple-800 bg-purple-100 hover:bg-purple-200 rounded px-1.5 py-0.5 truncate"
                          title={`Apply suggested edit: ${suggestion}`}
                        >
                          ✨ Suggest: &ldquo;{suggestion}&rdquo;
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Any tile over 5 words or 30 characters is automatically trimmed
                on blur or publish.
              </p>
              <Button
                type="button"
                onClick={handlePublishCustomBoard}
                className="w-full sm:w-auto bg-black text-white hover:bg-gray-800 font-headline font-black text-xs sm:text-sm h-11 px-3 sm:px-6"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Publish 21 Things Board &amp; Copy Friend Link
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-4">
          <div className="rounded-2xl border-2 border-black bg-white p-2.5 sm:p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-[#daa8d0] border-2 border-black flex items-center justify-center font-headline font-black text-sm sm:text-base shrink-0">
                  {board.creatorName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1 sm:flex-initial">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 sm:flex-wrap">
                    <h2 className="font-headline font-black text-sm sm:text-lg leading-tight truncate sm:whitespace-normal">
                      {board.title}
                    </h2>
                    <span className="text-[11px] sm:text-xs font-semibold text-gray-500 shrink-0">
                      {board.creatorHandle}
                    </span>
                  </div>
                  <p className="hidden sm:block text-xs text-gray-600">
                    {board.creatorBio}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5 self-start sm:self-center flex-wrap">
                <span
                  className={cn(
                    "px-1.5 xs:px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] xs:text-[10.5px] sm:text-xs font-black border whitespace-nowrap",
                    phase === "pick6"
                      ? "bg-[#F9D423] text-black border-black"
                      : "bg-gray-100 text-gray-600 border-gray-300"
                  )}
                >
                  1. Pick 6 ({pick6.length}/6)
                </span>
                <span className="text-gray-400 font-bold text-[10px] sm:text-xs">
                  →
                </span>
                <span
                  className={cn(
                    "px-1.5 xs:px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] xs:text-[10.5px] sm:text-xs font-black border whitespace-nowrap",
                    phase === "pick3"
                      ? "bg-[#F9D423] text-black border-black"
                      : "bg-gray-100 text-gray-600 border-gray-300"
                  )}
                >
                  2. Pick 3 ({pick3.length}/3)
                </span>
                <span className="text-gray-400 font-bold text-[10px] sm:text-xs">
                  →
                </span>
                <span
                  className={cn(
                    "px-1.5 xs:px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] xs:text-[10.5px] sm:text-xs font-black border whitespace-nowrap",
                    phase === "pick1" ||
                      phase === "reflect" ||
                      phase === "complete"
                      ? "bg-[#2ECC71] text-black border-black"
                      : "bg-gray-100 text-gray-600 border-gray-300"
                  )}
                >
                  3. Pick #1 {pick1 !== null ? "✓" : ""}
                </span>
              </div>
            </div>

            {shareUrl && (
              <div className="mt-2 sm:mt-3 flex items-center justify-between gap-2 rounded-xl bg-purple-50 border border-purple-200 px-3 py-2 text-xs">
                <span className="truncate font-mono text-purple-900">
                  Share link: {shareUrl}
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    toast({ title: "Friend Link Copied!" });
                  }}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
            )}

            <div className="mt-2 sm:mt-3 flex sm:flex-wrap items-center justify-between gap-1.5 sm:gap-2 rounded-xl bg-gray-900 text-white px-2.5 py-1.5 sm:px-3.5 sm:py-2.5">
              <div className="min-w-0 flex-1 sm:flex-initial text-[11px] leading-snug sm:text-sm font-medium">
                {phase === "pick6" && (
                  <>
                    <strong className="text-[#F9D423]">
                      Phase 1 (21 → 6):
                    </strong>{" "}
                    Tap your <strong>6 favorite items</strong> on the grid below
                    ({6 - pick6.length} left to pick).
                  </>
                )}
                {phase === "pick3" && (
                  <>
                    <strong className="text-[#F9D423]">
                      Phase 2 (6 → 3):
                    </strong>{" "}
                    From your 6 highlighted favorites, narrow down to your{" "}
                    <strong>top 3</strong> ({3 - pick3.length} left).
                  </>
                )}
                {phase === "pick1" && (
                  <>
                    <strong className="text-[#2ECC71]">
                      Phase 3 (3 → 1):
                    </strong>{" "}
                    From your final 3, tap the{" "}
                    <strong>single #1 item</strong> you resonate with most!
                  </>
                )}
                {phase === "reflect" && pick1 !== null && (
                  <>
                    <strong className="text-[#2ECC71]">
                      #1 Locked In: &ldquo;{board.items[pick1]}&rdquo;
                    </strong>{" "}
                    — Share a quick reflection note or voice clip below!
                  </>
                )}
                {phase === "complete" && pick1 !== null && (
                  <>
                    <strong className="text-[#2ECC71]">
                      Funnel Complete! Your #1: &ldquo;{board.items[pick1]}
                      &rdquo;
                    </strong>{" "}
                    — See how others narrowed down this board below.
                  </>
                )}
              </div>

              <div
                className={cn(
                  "items-center gap-2 shrink-0",
                  phase === "pick6"
                    ? pick6.length === 6
                      ? "hidden sm:flex"
                      : "hidden"
                    : "flex"
                )}
              >
                {(phase === "pick3" ||
                  phase === "pick1" ||
                  phase === "reflect") && (
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={handleBackStep}
                    className="font-bold text-[11px] sm:text-xs h-6 sm:h-7 px-2 sm:px-2.5"
                  >
                    ← Back<span className="hidden sm:inline"> Step</span>
                  </Button>
                )}

                {phase === "pick6" && pick6.length === 6 && (
                  <Button
                    size="sm"
                    onClick={advanceToPick3}
                    className="hidden sm:inline-flex bg-[#F9D423] text-black hover:bg-[#e6c21c] font-headline font-black text-xs sm:text-sm px-4 border-2 border-white animate-bounce"
                  >
                    Continue to Top 3 →
                  </Button>
                )}

                {phase === "pick3" && pick3.length === 3 && (
                  <Button
                    size="sm"
                    onClick={advanceToPick1}
                    className="hidden sm:inline-flex bg-[#F9D423] text-black hover:bg-[#e6c21c] font-headline font-black text-xs sm:text-sm px-4 border-2 border-white animate-bounce"
                  >
                    Continue to #1 Pick →
                  </Button>
                )}

                {phase === "pick1" && pick1 !== null && (
                  <Button
                    size="sm"
                    onClick={advanceToReflect}
                    className="hidden sm:inline-flex bg-[#2ECC71] text-black hover:bg-[#27b863] font-headline font-black text-xs sm:text-sm px-4 border-2 border-white"
                  >
                    Lock In #1 &amp; Reflect →
                  </Button>
                )}

                {phase === "complete" && (
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => handleResetFunnel()}
                    className="font-bold text-[11px] sm:text-xs h-6 sm:h-7 px-2 sm:px-2.5"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Play<span className="hidden sm:inline"> Board</span> Again
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div
            className="grid grid-cols-3 gap-1 min-[375px]:gap-1.5 sm:gap-2.5 select-none"
            role="grid"
            aria-label="21 Things 3 by 7 Grid"
          >
            {board.items.slice(0, 21).map((item, idx) => {
              const in6 = pick6.includes(idx);
              const in3 = pick3.includes(idx);
              const isWinner = pick1 === idx;

              let tileClasses =
                "bg-[#ead6e6] hover:bg-[#e2c6dc] text-black border-black/80";
              let isDimmed = false;
              let badgeLabel: string | null = null;

              if (phase === "pick6") {
                if (in6) {
                  tileClasses =
                    "bg-[#F9D423] text-black border-black ring-2 ring-black shadow-sm scale-[1.01]";
                  badgeLabel = "TOP 6";
                }
              } else if (phase === "pick3") {
                if (!in6) {
                  isDimmed = true;
                  tileClasses =
                    "bg-gray-100 text-gray-400 border-gray-200 opacity-35 scale-[0.98] cursor-default";
                } else if (in3) {
                  tileClasses =
                    "bg-[#F9D423] text-black border-black ring-2 ring-black shadow-md scale-[1.02]";
                  badgeLabel = "TOP 3";
                } else {
                  tileClasses =
                    "bg-[#fff6bf] hover:bg-[#F9D423]/70 text-black border-black/70";
                  badgeLabel = "IN 6";
                }
              } else if (phase === "pick1") {
                if (!in3) {
                  isDimmed = true;
                  tileClasses = in6
                    ? "bg-amber-50/50 text-gray-400 border-gray-200 opacity-45 scale-[0.98] cursor-default"
                    : "bg-gray-100 text-gray-400 border-gray-200 opacity-25 scale-[0.97] cursor-default";
                } else if (isWinner) {
                  tileClasses =
                    "bg-[#2ECC71] text-black border-black ring-3 ring-black shadow-lg scale-[1.03]";
                  badgeLabel = "#1 PICK";
                } else {
                  tileClasses =
                    "bg-[#F9D423] hover:bg-[#ffe03b] text-black border-black shadow-xs";
                  badgeLabel = "FINAL 3";
                }
              } else {
                if (isWinner) {
                  tileClasses =
                    "bg-[#2ECC71] text-black border-black ring-3 ring-black shadow-md";
                  badgeLabel = "👑 #1";
                } else if (in3) {
                  tileClasses =
                    "bg-[#F9D423] text-black border-black opacity-85";
                  badgeLabel = "TOP 3";
                } else if (in6) {
                  tileClasses =
                    "bg-[#fff3b0] text-gray-800 border-black/50 opacity-70";
                  badgeLabel = "TOP 6";
                } else {
                  isDimmed = true;
                  tileClasses =
                    "bg-gray-100 text-gray-400 border-gray-200 opacity-30";
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={
                    isDimmed || phase === "reflect" || phase === "complete"
                  }
                  onClick={() => handleTileTap(idx)}
                  className={cn(
                    "relative min-h-[45px] sm:min-h-[64px] rounded-xl border-2 px-1 py-0.5 min-[375px]:px-1.5 min-[375px]:py-1 sm:px-3 sm:py-2 text-center flex flex-col items-center justify-center transition-all duration-200",
                    tileClasses
                  )}
                >
                  {badgeLabel && (
                    <span className="absolute -top-1.5 sm:-top-2 right-1 sm:right-1.5 rounded-full bg-black text-white px-1 sm:px-1.5 py-0.2 text-[8px] sm:text-[9px] font-black tracking-wider uppercase">
                      {badgeLabel}
                    </span>
                  )}
                  <span className="text-[9.5px] leading-[1.1] min-[375px]:text-[10.5px] min-[375px]:leading-[1.15] sm:text-sm sm:leading-tight font-bold sm:line-clamp-2 break-words">
                    {item}
                  </span>
                </button>
              );
            })}
          </div>

          {((phase === "pick6" && pick6.length === 6) ||
            (phase === "pick3" && pick3.length === 3) ||
            (phase === "pick1" && pick1 !== null)) && (
            <div className="sm:hidden sticky bottom-2 z-20 rounded-xl border-2 border-black bg-gray-950/95 backdrop-blur-xs text-white px-3 py-2 shadow-lg flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[#F9D423] truncate">
                  {phase === "pick6" && "6/6 Favorites Selected!"}
                  {phase === "pick3" && "Top 3 Selected!"}
                  {phase === "pick1" &&
                    pick1 !== null &&
                    `#1: "${board.items[pick1]}"`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {(phase === "pick3" || phase === "pick1") && (
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={handleBackStep}
                    className="font-bold text-[11px] h-8 px-2.5"
                  >
                    ← Back
                  </Button>
                )}
                {phase === "pick6" && (
                  <Button
                    size="sm"
                    onClick={advanceToPick3}
                    className="bg-[#F9D423] text-black hover:bg-[#e6c21c] font-headline font-black text-xs h-8 px-3 border border-white"
                  >
                    Continue to Top 3 →
                  </Button>
                )}
                {phase === "pick3" && (
                  <Button
                    size="sm"
                    onClick={advanceToPick1}
                    className="bg-[#F9D423] text-black hover:bg-[#e6c21c] font-headline font-black text-xs h-8 px-3 border border-white"
                  >
                    Continue to #1 Pick →
                  </Button>
                )}
                {phase === "pick1" && (
                  <Button
                    size="sm"
                    onClick={advanceToReflect}
                    className="bg-[#2ECC71] text-black hover:bg-[#27b863] font-headline font-black text-xs h-8 px-3 border border-white"
                  >
                    Lock In #1 &amp; Reflect →
                  </Button>
                )}
              </div>
            </div>
          )}

          {phase === "reflect" && pick1 !== null && (
            <form
              onSubmit={handleSubmitReflection}
              className="rounded-2xl border-2 border-black bg-white p-4 sm:p-6 shadow-lg space-y-4"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <Badge variant="green" className="mb-1">
                    Phase 4 · The Payoff
                  </Badge>
                  <h3 className="font-headline font-black text-lg sm:text-xl">
                    Why did &ldquo;{board.items[pick1]}&rdquo; resonate as your
                    #1?
                  </h3>
                  <p className="text-xs text-gray-600">
                    Record a quick voice note or write a short message to send
                    back to {board.creatorName}&apos;s feed.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                    Your Name
                  </label>
                  <Input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="e.g. Alex"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                    Optional Voice Note
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isRecordingAudio ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={startAudioRecording}
                        className="border-2 border-black font-bold text-xs h-10"
                      >
                        <Mic className="h-4 w-4 mr-1.5 text-red-600" />
                        {voiceNoteDataUrl
                          ? "Re-record Voice Note"
                          : "Record Voice Note"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={stopAudioRecording}
                        className="bg-red-600 text-white hover:bg-red-700 font-bold text-xs h-10 animate-pulse"
                      >
                        <MicOff className="h-4 w-4 mr-1.5" />
                        Stop ({recordingSeconds}s)
                      </Button>
                    )}
                    {voiceNoteDataUrl && (
                      <audio
                        src={voiceNoteDataUrl}
                        controls
                        className="h-9 max-w-full sm:max-w-[180px]"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                  Your Reflection Note
                </label>
                <Textarea
                  value={reflectionNote}
                  onChange={(e) => setReflectionNote(e.target.value)}
                  placeholder={`Tell ${board.creatorName} why "${board.items[pick1]}" stood out above the other 20...`}
                  className="min-h-[80px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="submit"
                  className="bg-black text-white hover:bg-gray-800 font-headline font-black px-6 h-11"
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  Submit My 6 → 3 → 1 Journey
                </Button>
              </div>
            </form>
          )}

          {phase === "complete" && pick1 !== null && (
            <div className="rounded-2xl border-2 border-black bg-[#f4fbf7] p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-[#2ECC71]" />
                  <span className="font-headline font-black text-lg">
                    Your #1 Resonance: &ldquo;{board.items[pick1]}&rdquo;
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  <strong>Top 3:</strong>{" "}
                  {pick3.map((i) => board.items[i]).join(" · ")}
                </p>
                <p className="text-xs text-gray-500">
                  <strong>Top 6:</strong>{" "}
                  {pick6.map((i) => board.items[i]).join(" · ")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  onClick={handleShareJourney}
                  className="bg-black text-white hover:bg-gray-800 font-bold text-xs h-10 px-4"
                >
                  <Share2 className="h-4 w-4 mr-1.5" />
                  Share My 6 → 3 → 1
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!creatorName && profile?.displayName) {
                      setCreatorName(profile.displayName);
                    }
                    setMode("create");
                  }}
                  className="border-2 border-black font-bold text-xs h-10 px-3"
                >
                  <Mic className="h-3.5 w-3.5 mr-1" />
                  Create My Own 21
                </Button>
              </div>
            </div>
          )}

          <section className="rounded-2xl border-2 border-black/15 bg-white p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-headline font-black text-base sm:text-lg">
                  Friend 6 → 3 → 1 Journeys &amp; Reflections ({journeys.length})
                </h3>
                <p className="text-xs text-gray-500">
                  Individual feed showing how each player narrowed{" "}
                  {board.creatorName}
                  &apos;s 21 items down to their #1.
                </p>
              </div>
            </div>

            {journeys.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">
                Be the first to complete the 21 → 6 → 3 → 1 funnel on this
                board!
              </p>
            ) : (
              <div className="space-y-3">
                {journeys.map((j) => (
                  <div
                    key={j.id}
                    className="rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-bold text-sm">
                          {j.playerName}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          · {j.createdAt}
                        </span>
                      </div>
                      <Badge variant="green" className="text-xs">
                        👑 #1: {j.pick1}
                      </Badge>
                    </div>

                    <p className="text-xs sm:text-sm text-gray-800 italic bg-white rounded-lg p-2.5 border border-gray-200/80">
                      &ldquo;{j.reflectionNote}&rdquo;
                    </p>

                    {j.voiceNoteDataUrl && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Volume2 className="h-4 w-4 text-purple-700" />
                        <audio
                          src={j.voiceNoteDataUrl}
                          controls
                          className="h-8 w-full max-w-[240px] sm:max-w-xs"
                        />
                      </div>
                    )}

                    <div className="pt-1 flex flex-col gap-1 text-[11px] text-gray-600">
                      <div>
                        <span className="font-bold text-black">
                          Top 3 Finalists:
                        </span>{" "}
                        {j.pick3.map((it, i) => (
                          <span
                            key={i}
                            className="inline-block rounded bg-[#F9D423]/60 px-1.5 py-0.5 mr-1 mb-1 font-semibold text-black"
                          >
                            {it}
                          </span>
                        ))}
                      </div>
                      <div>
                        <span className="font-bold text-gray-700">
                          Initial Top 6:
                        </span>{" "}
                        {j.pick6.join(" · ")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </GameShell>
  );
}
