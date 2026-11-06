"use client";

import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  Database,
  Eye,
  Lightbulb,
  Play,
  Wand2,
} from "lucide-react";
import {
  CONNECT_5_PUZZLES,
  type Connect5HintCoord,
  type Connect5Puzzle,
} from "@/data/puzzles/connect-5";
import {
  enforceTileConstraints,
  parseTranscriptTo21Items,
  TWENTY_ONE_THINGS_BOARDS,
  type TwentyOneThingsBoard,
} from "@/data/puzzles/21-things";
import {
  get21ThingsBoardForDate,
  getConnect5PuzzleForDate,
  getLocalDateKey,
  getPuzzleNumberForDate,
} from "@/lib/daily-engine";
import {
  fetchRemote21ThingsOverride,
  fetchRemoteConnect5Override,
  getAdmin21ThingsOverrides,
  getAdminConnect5Overrides,
  saveAdmin21ThingsOverride,
  saveAdminConnect5Override,
} from "@/lib/game-storage";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SSR_ANCHOR_DATE = "2026-11-05";
const subscribeNoop = () => () => {};

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();

  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const targetDate = selectedDate ?? (mounted ? getLocalDateKey() : SSR_ANCHOR_DATE);
  const [activeTab, setActiveTab] = useState<string>("connect-5");

  // ==========================================================================
  // Connect 5 Creator State
  // ==========================================================================
  const [c5Title, setC5Title] = useState("Desk to Breeze");
  const [c5Author, setC5Author] = useState("Lucas Huff");
  const [c5Editor, setC5Editor] = useState("Stephen Huff");
  const [c5Words, setC5Words] = useState<[string, string, string, string, string]>([
    "MOUSE",
    "PAD",
    "LOCK",
    "DOWN",
    "WIND",
  ]);
  const [c5Connections, setC5Connections] = useState<
    [string, string, string, string]
  >([
    "MOUSE PAD — cushioned surface for a computer mouse",
    "PADLOCK — portable shackle lock",
    "LOCKDOWN — security protocol confining movement",
    "DOWNWIND — carried in the direction the wind blows",
  ]);
  const [c5Hints, setC5Hints] = useState<Connect5HintCoord[]>([
    { row: 1, col: 0 },
    { row: 3, col: 2 },
  ]);

  // ==========================================================================
  // 21 Things Creator State
  // ==========================================================================
  const [t21Title, setT21Title] = useState("Everyday Magic & Small Joys");
  const [t21Creator, setT21Creator] = useState("Lucas Huff");
  const [t21Bio, setT21Bio] = useState(
    "21 little things that make ordinary days feel extraordinary."
  );
  const [t21Stream, setT21Stream] = useState("");
  const [t21Items, setT21Items] = useState<string[]>(() =>
    TWENTY_ONE_THINGS_BOARDS[0].items.slice(0, 21)
  );

  const loadScheduleForDate = useCallback(async (dateKey: string) => {
    const localC5 = getAdminConnect5Overrides()[dateKey];
    const scheduledC5 = localC5 ?? getConnect5PuzzleForDate(dateKey);
    setC5Title(scheduledC5.title);
    setC5Author(scheduledC5.author);
    setC5Editor(scheduledC5.editor);
    setC5Words([...scheduledC5.words]);
    setC5Connections([...scheduledC5.connections]);
    setC5Hints([...scheduledC5.revealedHints]);

    const local21 = getAdmin21ThingsOverrides()[dateKey];
    const scheduled21 = local21 ?? get21ThingsBoardForDate(dateKey);
    setT21Title(scheduled21.title);
    setT21Creator(scheduled21.creatorName);
    setT21Bio(scheduled21.creatorBio);
    setT21Items(scheduled21.items.slice(0, 21));

    // Also check remote Supabase overrides if not locally overridden
    if (!localC5) {
      const remoteC5 = await fetchRemoteConnect5Override(dateKey);
      if (remoteC5) {
        setC5Title(remoteC5.title);
        setC5Author(remoteC5.author);
        setC5Editor(remoteC5.editor);
        setC5Words([...remoteC5.words]);
        setC5Connections([...remoteC5.connections]);
        setC5Hints([...remoteC5.revealedHints]);
      }
    }
    if (!local21) {
      const remote21 = await fetchRemote21ThingsOverride(dateKey);
      if (remote21) {
        setT21Title(remote21.title);
        setT21Creator(remote21.creatorName);
        setT21Bio(remote21.creatorBio);
        setT21Items(remote21.items.slice(0, 21));
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      await loadScheduleForDate(targetDate);
    });
    return () => {
      cancelled = true;
    };
  }, [targetDate, loadScheduleForDate]);

  // Toggle whether a specific letter in Rows 2-5 (rowIdx 1..4) is pre-revealed to the player
  const toggleC5HintLetter = (rowIdx: number, colIdx: number) => {
    if (rowIdx < 1 || rowIdx > 4) return;
    setC5Hints((prev) => {
      const exists = prev.some((h) => h.row === rowIdx && h.col === colIdx);
      if (exists) {
        return prev.filter((h) => !(h.row === rowIdx && h.col === colIdx));
      }
      return [...prev, { row: rowIdx, col: colIdx }];
    });
  };

  const handleC5WordChange = (rowIdx: number, rawVal: string) => {
    const clean = rawVal.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 12);
    const nextWords = [...c5Words] as [string, string, string, string, string];
    nextWords[rowIdx] = clean;
    setC5Words(nextWords);
    // Prune any hint coordinates that exceed new word length
    setC5Hints((prev) =>
      prev.filter((h) => h.row !== rowIdx || h.col < clean.length)
    );
  };

  const buildC5PuzzleObject = (): Connect5Puzzle => {
    const sanitizedWords = c5Words.map((w, i) =>
      w.trim() ? w.trim().toUpperCase() : `WORD${i + 1}`
    ) as [string, string, string, string, string];

    return {
      id: `c5-custom-${targetDate}-${sanitizedWords.join("-").toLowerCase()}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      title: c5Title.trim() || "Custom Chain",
      words: sanitizedWords,
      connections: c5Connections,
      revealedHints: c5Hints,
      author: c5Author.trim() || "Lucas Huff",
      editor: c5Editor.trim() || "Stephen Huff",
      customDate: targetDate,
    };
  };

  const handleSaveConnect5 = async (playImmediately = false) => {
    if (c5Words.some((w) => w.length < 2)) {
      toast({
        title: "Invalid Word Length",
        description: "Each of the 5 rows must have at least 2 letters.",
        variant: "destructive",
      });
      return;
    }

    const puzzleObj = buildC5PuzzleObject();
    await saveAdminConnect5Override(targetDate, puzzleObj);

    toast({
      title: `Connect 5 Saved for ${targetDate}!`,
      description: `${puzzleObj.words.join(" → ")} (${
        puzzleObj.revealedHints.length
      } pre-revealed hint letters).`,
    });

    if (playImmediately) {
      router.push(`/games/connect-5?date=${targetDate}`);
    }
  };

  const handleCopyConnect5Json = async () => {
    const puzzleObj = buildC5PuzzleObject();
    await navigator.clipboard.writeText(JSON.stringify(puzzleObj, null, 2));
    toast({
      title: "Connect 5 JSON Copied!",
      description: "Ready to paste into src/data/puzzles/connect-5.ts or Supabase.",
    });
  };

  const handleParse21Stream = () => {
    if (!t21Stream.trim()) return;
    const { items, autoShortenedCount } = parseTranscriptTo21Items(t21Stream);
    const next = [...t21Items];
    items.forEach((it, idx) => {
      if (idx < 21) next[idx] = it;
    });
    setT21Items(next);
    toast({
      title: `Parsed ${items.length} Tiles`,
      description:
        autoShortenedCount > 0
          ? `Auto-shortened ${autoShortenedCount} item(s) to ≤5 words / ≤30 chars.`
          : "All tiles fit mobile constraints!",
    });
  };

  const handleSave21Board = async (playImmediately = false) => {
    const sanitized = t21Items.map((it, idx) => {
      const { text } = enforceTileConstraints(it);
      return text || `Item #${idx + 1}`;
    });
    setT21Items(sanitized);

    const boardObj: TwentyOneThingsBoard = {
      id: `21t-custom-${targetDate}-${Date.now()}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      title: t21Title.trim() || "Daily 21 Things",
      creatorName: t21Creator.trim() || "Lucas Huff",
      creatorHandle: `@${(t21Creator.trim() || "LucasSOLT")
        .replace(/[^a-zA-Z0-9]/g, "")}`,
      creatorBio: t21Bio.trim(),
      items: sanitized,
      sampleJourneys: [],
      customDate: targetDate,
    };

    await saveAdmin21ThingsOverride(targetDate, boardObj);

    toast({
      title: `21 Things Board Saved for ${targetDate}!`,
      description: `"${boardObj.title}" by ${boardObj.creatorName} is now live.`,
    });

    if (playImmediately) {
      router.push(`/games/21-things?date=${targetDate}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFCFD] text-black">
      <header className="sticky top-0 z-30 border-b-2 border-black/10 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto max-w-6xl px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-black px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-black hover:bg-gray-100 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Back to Homepage</span>
              <span className="sm:hidden">Home</span>
            </Link>
            <h1 className="font-headline font-black text-sm sm:text-xl truncate">
              <span className="hidden sm:inline">SOL GaMES · </span>Admin &amp; Daily Puzzle Studio
            </h1>
          </div>

          <div className="hidden md:flex items-center gap-2 shrink-0">
            <Badge
              variant={isSupabaseConfigured ? "green" : "yellow"}
              className="text-xs whitespace-nowrap"
            >
              <Database className="h-3 w-3 mr-1" />
              {isSupabaseConfigured
                ? "Supabase Connected"
                : "66-Day Bank + Local/URL Mode"}
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
        {/* Global Date Picker Banner */}
        <div className="rounded-2xl border-2 border-black bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-headline font-black text-lg">
              Target Daily Schedule Date
            </h2>
            <p className="text-xs text-gray-600">
              Choose which date you want to schedule or override, or load any of
              the {CONNECT_5_PUZZLES.length} pre-seeded daily puzzles.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-gray-600" />
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => {
                const nextDate = e.target.value;
                setSelectedDate(nextDate);
                if (nextDate) {
                  void loadScheduleForDate(nextDate);
                }
              }}
              className="w-44 font-mono font-bold border-2 border-black"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="connect-5">
              🔗 Connect 5 Creator (Hint Letter Selector)
            </TabsTrigger>
            <TabsTrigger value="21-things">
              ✨ 21 Things Creator &amp; AI Formatter
            </TabsTrigger>
            <TabsTrigger value="bank">
              📚 Pre-Seeded 66-Day Bank ({CONNECT_5_PUZZLES.length} Days)
            </TabsTrigger>
          </TabsList>

          {/* ================================================================
           * TAB 1: CONNECT 5 PUZZLE CREATOR + INTERACTIVE HINT LETTER PICKER
           * ================================================================ */}
          <TabsContent value="connect-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: 5 Words & Metadata */}
              <div className="lg:col-span-6 rounded-2xl border-2 border-black bg-white p-5 space-y-4">
                <div>
                  <Badge variant="green" className="mb-1">
                    Connect 5 Builder
                  </Badge>
                  <h3 className="font-headline font-black text-xl">
                    1. Enter 5 Connected Words
                  </h3>
                  <p className="text-xs text-gray-600">
                    Each word connects with the word above it (e.g., MOUSE → PAD
                    → LOCK → DOWN → WIND). Variable lengths supported!
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                      Chain Title
                    </label>
                    <Input
                      value={c5Title}
                      onChange={(e) => setC5Title(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                      Author
                    </label>
                    <Input
                      value={c5Author}
                      onChange={(e) => setC5Author(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                      Editor
                    </label>
                    <Input
                      value={c5Editor}
                      onChange={(e) => setC5Editor(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  {c5Words.map((w, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-9 w-9 rounded-lg font-headline font-black text-sm flex items-center justify-center border-2 shrink-0",
                          idx === 0
                            ? "bg-[#2ECC71] border-black text-black"
                            : "bg-gray-100 border-gray-300 text-black"
                        )}
                      >
                        {idx + 1}
                      </span>
                      <Input
                        value={w}
                        onChange={(e) => handleC5WordChange(idx, e.target.value)}
                        placeholder={`Row ${idx + 1} Word`}
                        className="font-mono font-bold uppercase tracking-wider"
                      />
                      <span className="text-xs font-mono text-gray-500 w-16 text-right">
                        {w.length} chars
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="block text-xs font-bold uppercase text-gray-600">
                    Compound Word Explanations (Shown on Win Modal)
                  </label>
                  {c5Connections.map((conn, idx) => (
                    <Input
                      key={idx}
                      value={conn}
                      onChange={(e) => {
                        const next = [...c5Connections] as [
                          string,
                          string,
                          string,
                          string
                        ];
                        next[idx] = e.target.value;
                        setC5Connections(next);
                      }}
                      placeholder={`Connection ${idx + 1} -> ${idx + 2}`}
                      className="text-xs"
                    />
                  ))}
                </div>
              </div>

              {/* Right Column: Interactive Pre-Revealed Hint Letter Selector */}
              <div className="lg:col-span-6 rounded-2xl border-2 border-black bg-white p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="yellow" className="mb-1">
                        <Lightbulb className="h-3 w-3 mr-1" />
                        Interactive Hint Picker
                      </Badge>
                      <h3 className="font-headline font-black text-xl">
                        2. Click Letters to Pre-Reveal (0–3+ Hints)
                      </h3>
                      <p className="text-xs text-gray-600">
                        Row 1 is always shown. Click any letter box in{" "}
                        <strong>Rows 2–5</strong> below to toggle whether that
                        letter is pre-shown to players at the start of the game!
                      </p>
                    </div>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setC5Hints([])}
                      className="font-bold border border-black shrink-0"
                    >
                      Clear Hints (0)
                    </Button>
                  </div>

                  {/* Interactive 5-Row Preview Grid */}
                  <div className="rounded-2xl border-2 border-black/15 bg-gray-50 p-4 space-y-2.5">
                    {c5Words.map((word, rowIdx) => {
                      const isRow0 = rowIdx === 0;
                      return (
                        <div key={rowIdx} className="flex items-center gap-2">
                          <span className="h-8 w-8 rounded-lg bg-white border border-gray-300 font-headline font-black text-xs flex items-center justify-center shrink-0">
                            {rowIdx + 1}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {word.split("").map((ch, colIdx) => {
                              const isHinted =
                                isRow0 ||
                                c5Hints.some(
                                  (h) => h.row === rowIdx && h.col === colIdx
                                );
                              return (
                                <button
                                  key={colIdx}
                                  type="button"
                                  disabled={isRow0}
                                  onClick={() =>
                                    toggleC5HintLetter(rowIdx, colIdx)
                                  }
                                  className={cn(
                                    "h-11 w-10 rounded-xl border-2 font-headline font-black text-lg flex flex-col items-center justify-center transition-all",
                                    isRow0
                                      ? "bg-[#2ECC71] text-black border-black cursor-default"
                                      : isHinted
                                      ? "bg-[#F9D423] text-black border-black ring-2 ring-black scale-105 shadow-xs"
                                      : "bg-white text-gray-400 border-gray-300 hover:border-black hover:text-black"
                                  )}
                                  title={
                                    isRow0
                                      ? "Row 1 is always shown"
                                      : isHinted
                                      ? "Pre-revealed to player (Click to hide)"
                                      : "Hidden from player (Click to pre-reveal as hint)"
                                  }
                                >
                                  <span>{ch}</span>
                                  {!isRow0 && (
                                    <span className="text-[8px] font-mono uppercase">
                                      {isHinted ? "SHOWN" : "HIDE"}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950">
                    <strong>Active Pre-Revealed Letters ({c5Hints.length}):</strong>{" "}
                    {c5Hints.length === 0
                      ? "None (Hard mode — only Row 1 shown)"
                      : c5Hints
                          .map(
                            (h) =>
                              `Row ${h.row + 1} Col ${h.col + 1} ('${
                                c5Words[h.row]?.[h.col] ?? ""
                              }')`
                          )
                          .join(", ")}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyConnect5Json}
                    className="border-2 border-black font-bold text-xs"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy JSON
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSaveConnect5(false)}
                      className="border-2 border-black font-bold text-xs"
                    >
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      Save for {targetDate}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleSaveConnect5(true)}
                      className="bg-black text-white hover:bg-gray-800 font-headline font-black text-xs px-4"
                    >
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                      Save &amp; Test Play Now
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ================================================================
           * TAB 2: 21 THINGS CREATOR & BATCH FORMATTING STUDIO
           * ================================================================ */}
          <TabsContent value="21-things">
            <div className="rounded-2xl border-2 border-black bg-white p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <Badge variant="purple" className="mb-1">
                    21 Things Daily Studio
                  </Badge>
                  <h3 className="font-headline font-black text-xl">
                    Create or Override a Daily 21 Things Board
                  </h3>
                  <p className="text-xs text-gray-600">
                    Paste a stream of consciousness to auto-split into 21 items
                    (max 5 words / ~30 chars per tile) or edit any tile below.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                    Board Theme Title
                  </label>
                  <Input
                    value={t21Title}
                    onChange={(e) => setT21Title(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                    Creator Name
                  </label>
                  <Input
                    value={t21Creator}
                    onChange={(e) => setT21Creator(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                    Creator Subtitle / Bio
                  </label>
                  <Input
                    value={t21Bio}
                    onChange={(e) => setT21Bio(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold uppercase text-gray-600">
                    Quick Stream-of-Consciousness Parser
                  </label>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={handleParse21Stream}
                    className="font-bold border border-black"
                  >
                    <Wand2 className="h-3 w-3 mr-1" />
                    Auto-Split into 21 Tiles
                  </Button>
                </div>
                <Textarea
                  value={t21Stream}
                  onChange={(e) => setT21Stream(e.target.value)}
                  placeholder="Paste comma-separated items to auto-format into the 21 tiles below..."
                  className="min-h-[68px]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {t21Items.slice(0, 21).map((item, idx) => {
                  const words = item.trim().split(/\s+/).filter(Boolean).length;
                  const isOverLimit = words > 5 || item.length > 30;
                  const suggestion = isOverLimit
                    ? enforceTileConstraints(item).text
                    : null;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-xl border p-2",
                        isOverLimit
                          ? "border-red-500 bg-red-50"
                          : "border-black/20 bg-[#f6edf5]"
                      )}
                    >
                      <div className="flex justify-between text-[10px] font-mono text-gray-500 mb-1">
                        <span className="font-bold text-black">#{idx + 1}</span>
                        <span className={cn(isOverLimit && "text-red-600 font-bold")}>
                          {words}/5w · {item.length}/30c
                        </span>
                      </div>
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const next = [...t21Items];
                          next[idx] = e.target.value;
                          setT21Items(next);
                        }}
                        onBlur={() => {
                          const { text } = enforceTileConstraints(
                            t21Items[idx] || ""
                          );
                          if (text) {
                            const next = [...t21Items];
                            next[idx] = text;
                            setT21Items(next);
                          }
                        }}
                        className="w-full rounded bg-white border border-black/15 px-2 py-1 text-xs font-bold"
                      />
                      {isOverLimit && suggestion && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const next = [...t21Items];
                            next[idx] = suggestion;
                            setT21Items(next);
                          }}
                          className="mt-1 w-full text-left text-[10px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded px-1.5 py-0.5 truncate transition-colors"
                          title={`Apply automated edit: "${suggestion}"`}
                        >
                          ✨ Suggest: &ldquo;{suggestion}&rdquo;
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSave21Board(false)}
                  className="border-2 border-black font-bold text-xs"
                >
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Save for {targetDate}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSave21Board(true)}
                  className="bg-black text-white hover:bg-gray-800 font-headline font-black text-xs px-4"
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Save &amp; Test Play Board
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ================================================================
           * TAB 3: PRE-SEEDED 66-DAY PUZZLE BANK INSPECTOR
           * ================================================================ */}
          <TabsContent value="bank">
            <div className="rounded-2xl border-2 border-black bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-headline font-black text-xl">
                    Verified 66-Day Automated Puzzle Rotation Bank
                  </h3>
                  <p className="text-xs text-gray-600">
                    Click any pre-seeded puzzle below to load it into the editor
                    above.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
                {CONNECT_5_PUZZLES.map((p, idx) => {
                  const b = TWENTY_ONE_THINGS_BOARDS[idx];
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-gray-200 p-3.5 flex items-center justify-between gap-2 bg-gray-50/60 hover:bg-white transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            Day #{p.puzzleNumber}
                          </Badge>
                          <span className="font-headline font-bold text-sm truncate">
                            {p.title}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-emerald-800 mt-1 truncate">
                          Connect 5: {p.words.join(" → ")}
                        </p>
                        {b && (
                          <p className="text-xs text-purple-900 truncate">
                            21 Things: {b.title} (by {b.creatorName})
                          </p>
                        )}
                      </div>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setC5Title(p.title);
                          setC5Words([...p.words]);
                          setC5Connections([...p.connections]);
                          setC5Hints([...p.revealedHints]);
                          setC5Author(p.author);
                          setC5Editor(p.editor);
                          if (b) {
                            setT21Title(b.title);
                            setT21Creator(b.creatorName);
                            setT21Bio(b.creatorBio);
                            setT21Items([...b.items]);
                          }
                          setActiveTab("connect-5");
                          toast({
                            title: `Loaded Day #${p.puzzleNumber} into Studio`,
                            description:
                              "Switched to Connect 5 Creator tab (21 Things tab also loaded).",
                          });
                        }}
                        className="border border-black font-bold shrink-0"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Load
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
