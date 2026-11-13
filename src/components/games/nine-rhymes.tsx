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
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Calendar, Delete, Link2, Share2, Sparkles } from "lucide-react";
import {
  NINE_RHYMES_CLUE_COUNT,
  validateNineRhymesPuzzle,
  type NineRhymesPuzzle,
} from "@/data/puzzles/9-rhymes";
import { getDailyPuzzleForGame, getLocalDateKey } from "@/lib/daily-engine";
import {
  buildCustomGameShareUrl,
  copyToClipboard,
  formatCustomGameBlurb,
  nativeShareResultsOnly,
  isValidCustomGameId,
} from "@/lib/custom-game-share";
import { fetchCustomPuzzle, saveCustomPuzzle } from "@/lib/custom-puzzles";
import {
  clearGameProgress,
  getAdminOverridesForGame,
  getGameProgress,
  isDateCompleted,
  recordScoredCompletion,
  saveGameProgress,
} from "@/lib/game-storage";
import {
  HINT_COST_LABEL,
  REVEAL_LABEL,
  buildReceiptEmojis,
  buildShareText,
  buildTranscript,
  draftToPuzzle,
  formatScore,
  getRhymeTargetForRound,
  matchesAnswer,
  pointsForGuess,
  totalScore,
  type RoundResult,
} from "@/lib/nine-rhymes-engine";
import { generateCustomGameId } from "@/lib/custom-game-share";
import { computePuzzleContentHash } from "@/lib/seeded-random";
import { GameShell } from "@/components/game-shell";
import { GameSplashScreen } from "@/components/game-splash-screen";
import { GameLogo } from "@/components/game-logo";
import { useAuth } from "@/components/account/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResultShareButtons } from "./result-share-buttons";
import {
  NineRhymesEditor,
  emptyNineRhymesEditorState,
  type NineRhymesEditorState,
} from "./nine-rhymes-editor";
import { cn } from "@/lib/utils";

const TYPING_DELAY_MS = 400;
const MAX_INPUT_LENGTH = 15;
const subscribeNoop = () => () => {};

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

interface SavedNineProgress {
  puzzleId: string;
  puzzleHash: string;
  results: RoundResult[];
  currentHinted: boolean;
}

function isValidDateKey(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/* ------------------------------------------------------------------------ */
/* Entry point                                                              */
/* ------------------------------------------------------------------------ */

export function NineRhymesGame() {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center font-headline font-black text-xl">
        Loading 9 Rhymes...
      </div>
    );
  }
  return (
    <Suspense fallback={null}>
      <NineRhymesRouter />
    </Suspense>
  );
}

function NineRhymesRouter() {
  const searchParams = useSearchParams();
  const customId = searchParams.get("b");
  const mode = searchParams.get("mode");
  const dateParam = searchParams.get("date");

  if (mode === "create") return <NineRhymesCreator />;
  if (customId) return <NineRhymesCustomLoader customId={customId} />;
  return <NineRhymesDaily dateParam={dateParam} />;
}

/* ------------------------------------------------------------------------ */
/* Daily / archive                                                          */
/* ------------------------------------------------------------------------ */

function NineRhymesDaily({ dateParam }: { dateParam: string | null }) {
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
    const resolved = getDailyPuzzleForGame<NineRhymesPuzzle>(
      "9-rhymes",
      dateKey,
      getAdminOverridesForGame("9-rhymes")
    );
    return resolved!.puzzle;
  }, [dateKey, syncVersion]);

  const hash = useMemo(() => computePuzzleContentHash(puzzle), [puzzle]);

  return (
    <NineRhymesBoard
      key={`${puzzle.id}:${hash}:${dateKey}`}
      puzzle={puzzle}
      puzzleHash={hash}
      dateKey={dateKey}
      isCustom={false}
    />
  );
}

/* ------------------------------------------------------------------------ */
/* Custom friend puzzle (?b=9r-xxxxxxxx)                                    */
/* ------------------------------------------------------------------------ */

function NineRhymesCustomLoader({ customId }: { customId: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "missing" }
    | { status: "ready"; puzzle: NineRhymesPuzzle; handle: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isValidCustomGameId(customId) || !customId.startsWith("9r-")) {
        if (!cancelled) setState({ status: "missing" });
        return;
      }
      const record = await fetchCustomPuzzle<NineRhymesPuzzle>(customId);
      if (cancelled) return;
      if (!record || !validateNineRhymesPuzzle(record.payload).valid) {
        setState({ status: "missing" });
        return;
      }
      setState({
        status: "ready",
        puzzle: { ...record.payload, id: record.id, puzzleNumber: 0, author: record.creatorName || record.payload.author },
        handle: record.creatorHandle,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [customId]);

  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center font-headline font-black text-xl">
        Loading friend puzzle...
      </div>
    );
  }
  if (state.status === "missing") {
    return (
      <GameShell gameSlug="9-rhymes" gameTitle="9 Rhymes" puzzleNumber={0} dateKey={getLocalDateKey()} author="Friend">
        <div className="max-w-md mx-auto text-center space-y-4 py-16">
          <h2 className="font-headline font-black text-2xl">Puzzle not found</h2>
          <p className="text-sm text-neutral-600">
            This friend link may be mistyped or was removed. You can still play today&apos;s 9 Rhymes.
          </p>
          <Link
            href="/games/9-rhymes"
            className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-bold text-white border-2 border-black"
          >
            Play today&apos;s 9 Rhymes
          </Link>
        </div>
      </GameShell>
    );
  }
  return (
    <NineRhymesBoard
      key={state.puzzle.id}
      puzzle={state.puzzle}
      puzzleHash={computePuzzleContentHash(state.puzzle)}
      dateKey={getLocalDateKey()}
      isCustom
      creatorHandle={state.handle}
      customId={customId}
    />
  );
}

/* ------------------------------------------------------------------------ */
/* Board                                                                    */
/* ------------------------------------------------------------------------ */

interface NineRhymesBoardProps {
  puzzle: NineRhymesPuzzle;
  puzzleHash: string;
  dateKey: string;
  isCustom: boolean;
  creatorHandle?: string;
  customId?: string;
}

function NineRhymesBoard({
  puzzle,
  puzzleHash,
  dateKey,
  isCustom,
  creatorHandle,
  customId,
}: NineRhymesBoardProps) {
  const router = useRouter();

  const saved = useMemo<SavedNineProgress | null>(() => {
    if (isCustom) return null;
    const s = getGameProgress<SavedNineProgress>("9-rhymes", dateKey, puzzle.id);
    if (!s || s.puzzleHash !== puzzleHash || !Array.isArray(s.results)) return null;
    return s;
  }, [isCustom, dateKey, puzzle.id, puzzleHash]);

  const [results, setResults] = useState<RoundResult[]>(saved?.results ?? []);
  const [currentHinted, setCurrentHinted] = useState<boolean>(saved?.currentHinted ?? false);
  const [input, setInput] = useState("");
  const [confirm, setConfirm] = useState<null | "hint" | "reveal">(null);
  const [splashDismissed, setSplashDismissed] = useState(isCustom);
  const [helpOpen, setHelpOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const freshStart = !saved || (saved.results.length === 0 && !saved.currentHinted);
  const transcript = useMemo(
    () => buildTranscript(puzzle, { results, currentHinted }),
    [puzzle, results, currentHinted]
  );
  const [shown, setShown] = useState<number>(freshStart ? 1 : transcript.length);
  const [typing, setTyping] = useState<boolean>(freshStart);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const recordedRef = useRef(false);

  const complete = results.length >= NINE_RHYMES_CLUE_COUNT;
  const roundIndex = Math.min(results.length, NINE_RHYMES_CLUE_COUNT - 1);
  const score = totalScore(results);
  const busy = typing;
  const inputLocked = busy || complete || !splashDismissed;

  // Opening: Bubble 1 immediately, typing dots, then Round 1's sentence.
  useEffect(() => {
    if (!freshStart || !splashDismissed) return;
    timerRef.current = setTimeout(() => {
      setShown(buildTranscript(puzzle, { results: [], currentHinted: false }).length);
      setTyping(false);
    }, TYPING_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splashDismissed]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // Persist progress (daily + archive only).
  useEffect(() => {
    if (isCustom) return;
    saveGameProgress<SavedNineProgress>("9-rhymes", dateKey, {
      puzzleId: puzzle.id,
      puzzleHash,
      results,
      currentHinted,
    });
  }, [isCustom, dateKey, puzzle.id, puzzleHash, results, currentHinted]);

  // Record stats once on completion (never for friend puzzles).
  useEffect(() => {
    if (!complete || isCustom || recordedRef.current) return;
    recordedRef.current = true;
    if (!isDateCompleted("9-rhymes", dateKey)) {
      recordScoredCompletion("9-rhymes", dateKey, score, NINE_RHYMES_CLUE_COUNT);
    }
  }, [complete, isCustom, dateKey, score]);

  // Smooth auto-scroll to the newest bubble / typing dots.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [shown, typing, complete]);

  const advance = useCallback(
    (nextResults: RoundResult[], nextHinted: boolean) => {
      const nextTranscript = buildTranscript(puzzle, {
        results: nextResults,
        currentHinted: nextHinted,
      });
      setResults(nextResults);
      setCurrentHinted(nextHinted);
      // My bubble appears instantly; Nine's reply follows the 400ms typing indicator.
      setShown((s) => s + 1);
      setTyping(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setShown(nextTranscript.length);
        setTyping(false);
      }, TYPING_DELAY_MS);
    },
    [puzzle]
  );

  const submitGuess = useCallback(() => {
    if (inputLocked) return;
    const guess = input.trim();
    if (!guess) return;
    const clue = puzzle.clues[roundIndex]!;
    const correct = matchesAnswer(guess, clue);
    const result: RoundResult = {
      guess,
      outcome: correct ? "correct" : "wrong",
      hinted: currentHinted,
      points: pointsForGuess(correct, currentHinted),
    };
    setInput("");
    advance([...results, result], false);
  }, [inputLocked, input, puzzle.clues, roundIndex, currentHinted, results, advance]);

  const confirmHint = () => {
    setConfirm(null);
    if (inputLocked || currentHinted) return;
    advance(results, true);
  };

  const confirmReveal = () => {
    setConfirm(null);
    if (inputLocked) return;
    setInput("");
    advance(
      [...results, { guess: "", outcome: "revealed", hinted: currentHinted, points: 0 }],
      false
    );
  };

  const pressLetter = useCallback(
    (letter: string) => {
      if (inputLocked) return;
      setInput((v) => (v.length < MAX_INPUT_LENGTH ? v + letter.toLowerCase() : v));
    },
    [inputLocked]
  );
  const pressBackspace = useCallback(() => {
    if (inputLocked) return;
    setInput((v) => v.slice(0, -1));
  }, [inputLocked]);

  // Desktop physical keyboard.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (confirm || helpOpen || statsOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        if (!(target as HTMLInputElement).readOnly) return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        submitGuess();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        pressBackspace();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        pressLetter(e.key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirm, helpOpen, statsOpen, submitGuess, pressBackspace, pressLetter]);

  const handleReplay = () => {
    clearGameProgress("9-rhymes", dateKey);
    window.location.reload();
  };

  const showResultCard = complete && !typing && shown >= transcript.length;
  const shareUrl = isCustom && customId
    ? buildCustomGameShareUrl("9-rhymes", customId)
    : typeof window !== "undefined"
    ? `${window.location.origin}${window.location.pathname}`.replace(/\/$/, "")
    : "https://21games.ai/games/9-rhymes";
  const shareText = buildShareText({
    puzzleNumber: puzzle.puzzleNumber,
    results,
    custom: isCustom,
    creatorHandle,
  });

  const shellProps = {
    gameSlug: "9-rhymes" as const,
    gameTitle: "9 Rhymes",
    puzzleNumber: puzzle.puzzleNumber,
    dateKey,
    author: puzzle.author,
  };

  if (!splashDismissed) {
    return (
      <GameShell {...shellProps} subtitle="Text with Nine">
        <GameSplashScreen
          gameSlug="9-rhymes"
          gameTitle="9 Rhymes"
          tagline="Text with Nine to solve 9 rhymes"
          theme={puzzle.title}
          author={puzzle.author}
          puzzleNumber={puzzle.puzzleNumber}
          dateKey={dateKey}
          showCreate
          isCompletedToday={!isCustom && isDateCompleted("9-rhymes", dateKey)}
          hasSavedProgress={results.length > 0 || currentHinted}
          onPlay={() => setSplashDismissed(true)}
          onCreate={() => router.push("/games/9-rhymes?mode=create")}
        />
      </GameShell>
    );
  }

  const visible = transcript.slice(0, shown);

  return (
    <GameShell
      {...shellProps}
      subtitle="Text with Nine"
      helpOpen={helpOpen}
      onHelpOpenChange={setHelpOpen}
      statsOpen={statsOpen}
      onStatsOpenChange={setStatsOpen}
    >
      <div
        className="mx-auto w-full max-w-md h-[calc(100dvh-7.5rem)] min-h-[520px] sm:h-[calc(100dvh-9rem)] flex flex-col rounded-2xl border-2 border-black bg-white overflow-hidden shadow-[0_4px_0_#111111]"
        data-testid="nine-rhymes-chat"
      >
        {/* Contact header */}
        <div className="shrink-0 border-b-2 border-black/10 bg-[#f7f7f8] px-3 py-2 flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-full border-2 border-black bg-[#f7da21] flex items-center justify-center overflow-hidden shrink-0">
            <GameLogo logo="rhymes" variant="mini" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-headline font-black text-base leading-tight">Nine</p>
            <p className="text-[11px] font-semibold text-neutral-500 truncate" data-testid="nine-status">
              Word {Math.min(results.length + 1, NINE_RHYMES_CLUE_COUNT)} of {NINE_RHYMES_CLUE_COUNT} · Score: {formatScore(score)} / {NINE_RHYMES_CLUE_COUNT}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full bg-black text-white px-2.5 py-1 text-[11px] font-black tracking-wide"
            data-testid="nine-starter-badge"
          >
            {results.length === 0
              ? `Starter: ${puzzle.starterWord.toUpperCase()}`
              : `Rhymes with: ${getRhymeTargetForRound(puzzle, Math.min(results.length, NINE_RHYMES_CLUE_COUNT - 1))}`}
          </span>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-white" aria-live="polite">
          {visible.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "me" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[82%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[15px] leading-snug font-medium animate-in fade-in zoom-in-95 duration-150",
                  m.role === "me"
                    ? "bg-[#007AFF] text-white rounded-br-md"
                    : "bg-[#E9E9EB] text-black rounded-bl-md"
                )}
                data-role={m.role}
              >
                {m.text}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex justify-start" data-testid="nine-typing">
              <div className="rounded-2xl rounded-bl-md bg-[#E9E9EB] px-4 py-3 flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full bg-neutral-500 animate-bounce"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {showResultCard && (
            <div
              className="mt-3 rounded-2xl border-2 border-black bg-[#fffbe6] p-4 text-center space-y-3"
              data-testid="nine-result-card"
            >
              <p className="font-headline font-black text-lg">
                {formatScore(score)} / {NINE_RHYMES_CLUE_COUNT}
              </p>
              <p className="text-2xl tracking-wider" aria-label="Result receipt">
                {buildReceiptEmojis(results)}
              </p>
              <ResultShareButtons
                title={isCustom ? "9 Rhymes friend puzzle" : `9 Rhymes #${puzzle.puzzleNumber}`}
                text={shareText}
                url={shareUrl}
              />
              <div className="flex flex-wrap justify-center gap-3 text-xs font-bold">
                {isCustom ? (
                  <>
                    <Link className="underline" href="/games/9-rhymes">Play today&apos;s 9 Rhymes</Link>
                    <Link className="underline" href="/games/9-rhymes?mode=create">Create your own</Link>
                  </>
                ) : (
                  <>
                    <Link className="underline inline-flex items-center gap-1" href="/games/9-rhymes/archive">
                      <Calendar className="h-3.5 w-3.5" /> Archive
                    </Link>
                    <button type="button" className="underline" onClick={handleReplay}>
                      Replay this puzzle
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick-reply pills */}
        {!complete && (
          <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-t border-black/10 bg-white overflow-x-auto">
            {!currentHinted && (
              <button
                type="button"
                disabled={inputLocked}
                onClick={() => setConfirm("hint")}
                className="shrink-0 rounded-full border-2 border-[#007AFF] text-[#007AFF] px-3 py-1 text-xs font-bold disabled:opacity-40"
                data-testid="nine-hint-pill"
              >
                {HINT_COST_LABEL}
              </button>
            )}
            <button
              type="button"
              disabled={inputLocked}
              onClick={() => setConfirm("reveal")}
              className="shrink-0 rounded-full border-2 border-neutral-400 text-neutral-700 px-3 py-1 text-xs font-bold disabled:opacity-40"
              data-testid="nine-reveal-pill"
            >
              {REVEAL_LABEL}
            </button>
          </div>
        )}

        {/* iMessage input bar (readOnly: no OS keyboard) */}
        {!complete && (
          <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-white border-t border-black/10">
            <input
              readOnly
              inputMode="none"
              aria-label="Your guess"
              value={input.toUpperCase()}
              placeholder="Text Message"
              className="flex-1 rounded-full border-2 border-neutral-300 px-4 py-2 text-[15px] font-semibold tracking-widest bg-white placeholder:tracking-normal placeholder:font-normal focus:outline-hidden"
              data-testid="nine-input"
              onFocus={(e) => e.currentTarget.blur()}
            />
            <button
              type="button"
              onClick={submitGuess}
              disabled={inputLocked || input.trim().length === 0}
              aria-label="Send guess"
              className="h-9 w-9 rounded-full bg-[#007AFF] text-white flex items-center justify-center disabled:opacity-30 transition-opacity"
              data-testid="nine-send"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Custom QWERTY keyboard */}
        {!complete && (
          <div className="shrink-0 bg-[#D1D3D9] px-1 pt-1.5 pb-2 space-y-1.5 select-none" data-testid="nine-keyboard">
            {KEYBOARD_ROWS.map((row, ri) => (
              <div key={ri} className="flex justify-center gap-1">
                {ri === 2 && <span className="w-6" />}
                {row.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pressLetter(k)}
                    disabled={inputLocked}
                    className="h-10 flex-1 max-w-[34px] rounded-md bg-white text-sm font-bold text-black shadow-[0_1px_0_#8b8d92] active:bg-neutral-200 disabled:opacity-60"
                  >
                    {k}
                  </button>
                ))}
                {ri === 2 && (
                  <button
                    type="button"
                    onClick={pressBackspace}
                    disabled={inputLocked}
                    aria-label="Backspace"
                    className="h-10 w-12 rounded-md bg-[#AEB3BE] flex items-center justify-center text-black shadow-[0_1px_0_#8b8d92] active:bg-neutral-400"
                  >
                    <Delete className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hint confirmation */}
      <Dialog open={confirm === "hint"} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Need a hint?</DialogTitle>
            <DialogDescription>
              Use a description hint for this word? Correct guess will be worth 0.5 pts instead of 1.0 pt.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)} className="border-2 border-black font-bold">
              Cancel
            </Button>
            <Button onClick={confirmHint} className="font-bold bg-[#007AFF] hover:bg-[#0066d6] text-white" data-testid="nine-hint-confirm">
              Use hint
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reveal confirmation */}
      <Dialog open={confirm === "reveal"} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reveal this word?</DialogTitle>
            <DialogDescription>
              Reveal this word for 0 points and move to the next rhyme?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)} className="border-2 border-black font-bold">
              Cancel
            </Button>
            <Button onClick={confirmReveal} className="font-bold bg-black text-white" data-testid="nine-reveal-confirm">
              Reveal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </GameShell>
  );
}

/* ------------------------------------------------------------------------ */
/* Creator Mode (?mode=create)                                              */
/* ------------------------------------------------------------------------ */

function NineRhymesCreator() {
  const { profile, isAuthenticated, openAccountModal } = useAuth();
  const [editor, setEditor] = useState<NineRhymesEditorState>(emptyNineRhymesEditorState);
  const [errors, setErrors] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [created, setCreated] = useState<{ url: string; blurbWithUrl: string; blurbText: string; title: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const shell = {
    gameSlug: "9-rhymes" as const,
    gameTitle: "9 Rhymes",
    puzzleNumber: 0,
    dateKey: getLocalDateKey(),
    author: profile?.displayName ?? "You",
  };

  if (!isAuthenticated || !profile) {
    return (
      <GameShell {...shell} subtitle="Create & Share">
        <div className="max-w-md mx-auto text-center space-y-4 py-16">
          <Sparkles className="h-8 w-8 mx-auto text-[#9D50BB]" />
          <h2 className="font-headline font-black text-2xl">Sign in to create</h2>
          <p className="text-sm text-neutral-600">
            Creating a custom 9 Rhymes puzzle requires an account so friends can see who made it.
          </p>
          <Button onClick={() => openAccountModal("signin")} className="font-bold border-2 border-black">
            Sign in
          </Button>
        </div>
      </GameShell>
    );
  }

  if (profile.isBanned) {
    return (
      <GameShell {...shell} subtitle="Create & Share">
        <p className="text-center py-16 text-sm font-semibold">
          Your account has been suspended from publishing custom puzzles.
        </p>
      </GameShell>
    );
  }

  const publish = async () => {
    setErrors([]);
    setPublishing(true);
    try {
      const id = generateCustomGameId("9-rhymes");
      const { puzzle, errors: draftErrors } = draftToPuzzle({
        id,
        title: editor.title,
        starterWord: editor.starterWord,
        rows: editor.rows,
        creatorName: profile.displayName,
      });
      if (!puzzle) {
        setErrors(draftErrors);
        return;
      }
      const saved = await saveCustomPuzzle({
        id,
        gameSlug: "9-rhymes",
        title: puzzle.title,
        creatorId: profile.id,
        creatorName: profile.displayName,
        creatorHandle: profile.handle,
        payload: puzzle as unknown as Record<string, unknown>,
      });
      if (!saved.ok) {
        setErrors([saved.error]);
        return;
      }
      const blurb = formatCustomGameBlurb({
        title: puzzle.title,
        creatorHandle: profile.handle,
        creatorName: profile.displayName,
        shareUrl: saved.shareUrl,
        gameName: "9 Rhymes",
      });
      setCreated({
        url: saved.shareUrl,
        blurbWithUrl: blurb.blurbWithUrl,
        blurbText: blurb.blurbText,
        title: puzzle.title,
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <GameShell {...shell} subtitle="Create & Share">
      <div className="max-w-2xl mx-auto space-y-4 py-2" data-testid="nine-creator">
        <div>
          <h2 className="font-headline font-black text-2xl">Create your own 9 Rhymes</h2>
          <p className="text-sm text-neutral-600">
            Pick a Starter Word and 9 perfect rhymes. Friends play it as a text chat with Nine.
          </p>
        </div>

        {created ? (
          <div className="rounded-2xl border-2 border-black bg-[#fffbe6] p-4 space-y-3" data-testid="nine-created">
            <p className="font-headline font-black text-lg">Your puzzle is ready! 🎉</p>
            <p className="text-sm break-all font-mono">{created.url}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1 bg-black text-white border-2 border-black font-bold"
                onClick={() =>
                  void nativeShareResultsOnly({
                    title: `${created.title} — 9 Rhymes`,
                    text: created.blurbText,
                    url: created.url,
                  })
                }
              >
                <Share2 className="h-4 w-4 mr-1.5" /> Share
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-2 border-black font-bold"
                onClick={async () => {
                  const ok = await copyToClipboard(created.blurbWithUrl);
                  if (ok) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
              >
                <Link2 className="h-4 w-4 mr-1.5" /> {copied ? "Copied!" : "Copy link"}
              </Button>
            </div>
            <Link className="text-xs font-bold underline" href={`/games/9-rhymes?b=${created.url.split("?b=")[1]}`}>
              Play it yourself →
            </Link>
          </div>
        ) : (
          <>
            <NineRhymesEditor value={editor} onChange={setEditor} />
            {errors.length > 0 && (
              <ul className="rounded-xl border-2 border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-700 list-disc list-inside space-y-0.5">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              onClick={publish}
              disabled={publishing}
              className="w-full h-11 bg-black text-white border-2 border-black font-headline font-black"
              data-testid="nine-publish"
            >
              {publishing ? "Publishing…" : "Publish & get link"}
            </Button>
          </>
        )}
        <p className="text-[11px] text-neutral-500">
          Friend puzzles allow casual language but never slurs or hate speech.
        </p>
      </div>
    </GameShell>
  );
}

