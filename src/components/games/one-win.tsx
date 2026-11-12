"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Flame,
  Lock,
  Radio,
  Search,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import {
  ONE_WIN_DEFAULT_PROMPT,
  ONE_WIN_MAX_CHARS,
  ONE_WIN_MAX_WORDS,
  buildOneWinShareText,
  countOneWinWords,
  isOneWinPuzzle,
  normalizeOneWinEntry,
  type OneWinPromptPuzzle,
} from "@/data/puzzles/1-win";
import {
  formatLongDate,
  getDailyPuzzleForGame,
  getLocalDateKey,
  getPuzzleNumberForDate,
} from "@/lib/daily-engine";
import {
  fetchRemoteOverrideForGame,
  getAdminOverridesForGame,
  getGameStats,
} from "@/lib/game-storage";
import {
  fetchOneWinLeaderboard,
  getLocalOneWinSubmission,
  mergeOneWinLeaderboard,
  submitOneWinEntry,
  subscribeOneWinRealtime,
  type LocalOneWinSubmission,
  type OneWinLeaderboardSnapshot,
} from "@/lib/one-win-service";
import { computePuzzleContentHash } from "@/lib/seeded-random";
import { useAuth } from "@/components/account/auth-provider";
import { GameShell } from "@/components/game-shell";
import { GameSplashScreen } from "@/components/game-splash-screen";
import { ResultShareButtons } from "@/components/games/result-share-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function resolveOneWinPuzzle(dateKey: string): OneWinPromptPuzzle {
  const overrides = getAdminOverridesForGame("1-win");
  const res = getDailyPuzzleForGame<OneWinPromptPuzzle>(
    "1-win",
    dateKey,
    overrides
  );
  if (res && isOneWinPuzzle(res.puzzle)) {
    return res.puzzle;
  }
  return {
    id: `1w-${dateKey}`,
    puzzleNumber: getPuzzleNumberForDate(dateKey),
    title: "Daily Gratitude Check-In",
    prompt: ONE_WIN_DEFAULT_PROMPT,
    subtitle:
      "No win is too small — log yours blindly, then see where it ranks globally.",
    author: "SOL Theory",
    editor: "Daily Editorial",
    seedCommunityWins: [],
    customDate: dateKey,
  };
}

export function OneWinGame() {
  const searchParams = useSearchParams();
  const { profile } = useAuth();

  const dateParam = searchParams.get("date");
  const liveTodayKey = getLocalDateKey();
  const activeDateKey =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : liveTodayKey;
  const isArchiveDate = activeDateKey !== liveTodayKey;

  const [puzzle, setPuzzle] = useState<OneWinPromptPuzzle>(() =>
    resolveOneWinPuzzle(activeDateKey)
  );
  const [prevDateKey, setPrevDateKey] = useState<string>(activeDateKey);

  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [draftInput, setDraftInput] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [submission, setSubmission] = useState<LocalOneWinSubmission | null>(
    () => getLocalOneWinSubmission(activeDateKey)
  );

  const [snapshot, setSnapshot] = useState<OneWinLeaderboardSnapshot>(() => {
    const initialPuzzle = resolveOneWinPuzzle(activeDateKey);
    const localSub = getLocalOneWinSubmission(activeDateKey);
    return {
      ...mergeOneWinLeaderboard(initialPuzzle.seedCommunityWins, [], localSub),
      liveConnected: false,
    };
  });

  // Render-time reset if URL `?date=` changes
  if (prevDateKey !== activeDateKey) {
    setPrevDateKey(activeDateKey);
    const nextPuzzle = resolveOneWinPuzzle(activeDateKey);
    const nextSub = getLocalOneWinSubmission(activeDateKey);
    setPuzzle(nextPuzzle);
    setSubmission(nextSub);
    setDraftInput("");
    setErrorMsg(null);
    setSearchQuery("");
    setSnapshot({
      ...mergeOneWinLeaderboard(nextPuzzle.seedCommunityWins, [], nextSub),
      liveConnected: false,
    });
  }

  const puzzleHash = useMemo(
    () => computePuzzleContentHash(puzzle),
    [puzzle]
  );

  const refreshLeaderboard = useCallback(
    async (targetPuzzle: OneWinPromptPuzzle = puzzle) => {
      const latest = await fetchOneWinLeaderboard(activeDateKey, targetPuzzle);
      setSnapshot(latest);
      const latestSub = getLocalOneWinSubmission(activeDateKey);
      if (latestSub) {
        setSubmission(latestSub);
      }
    },
    [activeDateKey, puzzle]
  );

  // Sync remote puzzle override + live Top 100 leaderboard + Realtime subscription
  useEffect(() => {
    let active = true;

    void fetchRemoteOverrideForGame("1-win", activeDateKey).then((remote) => {
      if (!active || !isOneWinPuzzle(remote)) return;
      if (computePuzzleContentHash(remote) !== puzzleHash) {
        setPuzzle(remote);
        void refreshLeaderboard(remote);
      }
    });

    void fetchOneWinLeaderboard(activeDateKey, puzzle).then((latest) => {
      if (!active) return;
      setSnapshot(latest);
    });

    const unsubRealtime = subscribeOneWinRealtime(activeDateKey, () => {
      if (!active) return;
      void fetchOneWinLeaderboard(activeDateKey, puzzle).then((latest) => {
        if (active) setSnapshot(latest);
      });
    });

    const onPuzzleUpdated = (e: Event) => {
      if (!active) return;
      const detail = (e as CustomEvent)?.detail;
      if (detail?.gameSlug && detail.gameSlug !== "1-win") return;
      if (!detail?.dateKey || detail.dateKey === activeDateKey) {
        const local = getAdminOverridesForGame("1-win")[activeDateKey];
        if (isOneWinPuzzle(local) && computePuzzleContentHash(local) !== puzzleHash) {
          setPuzzle(local);
          void refreshLeaderboard(local);
        }
      }
    };

    window.addEventListener("solgames:puzzles-updated", onPuzzleUpdated);
    return () => {
      active = false;
      unsubRealtime();
      window.removeEventListener("solgames:puzzles-updated", onPuzzleUpdated);
    };
  }, [activeDateKey, puzzle, puzzleHash, refreshLeaderboard]);

  const wordCount = useMemo(() => countOneWinWords(draftInput), [draftInput]);
  const charCount = useMemo(
    () => Math.max(draftInput.trim().length, Array.from(draftInput.trim()).length),
    [draftInput]
  );
  const liveNormalized = useMemo(
    () => normalizeOneWinEntry(draftInput),
    [draftInput]
  );

  const showLeaderboard = Boolean(submission) || isArchiveDate;

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return snapshot.entries;
    return snapshot.entries.filter(
      (row) =>
        row.displayText.toLowerCase().includes(q) ||
        row.normalizedKey.includes(q) ||
        String(row.rank) === q.replace(/^#/, "")
    );
  }, [searchQuery, snapshot.entries]);

  const topCount = snapshot.entries[0]?.count ?? 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isArchiveDate || submission || isSubmitting) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await submitOneWinEntry({
        dateKey: activeDateKey,
        rawText: draftInput,
        puzzle,
        userId: profile?.authMode === "supabase" ? profile.id : null,
        todayDateKey: liveTodayKey,
      });
      if (!res.ok) {
        setErrorMsg(res.error || "Could not submit your win. Please check length and try again.");
        if (res.submission) setSubmission(res.submission);
        if (res.snapshot) setSnapshot(res.snapshot);
        return;
      }
      if (res.submission) setSubmission(res.submission);
      if (res.snapshot) setSnapshot(res.snapshot);
      setDraftInput("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = getGameStats("1-win");

  const shareText = useMemo(() => {
    if (!submission) return "";
    return buildOneWinShareText({
      puzzleNumber: puzzle.puzzleNumber,
      displayText: submission.displayText,
      rank: snapshot.playerRank ?? 1,
      sharedCount: snapshot.playerCount ?? 1,
    });
  }, [
    puzzle.puzzleNumber,
    snapshot.playerCount,
    snapshot.playerRank,
    submission,
  ]);

  if (showSplash) {
    return (
      <GameShell
        gameSlug="1-win"
        gameTitle="1 Win"
        puzzleNumber={puzzle.puzzleNumber}
        dateKey={activeDateKey}
        author={puzzle.author}
      >
        <GameSplashScreen
          gameSlug="1-win"
          gameTitle="1 Win"
          tagline="Share 1 win from your day in 1–4 words and see how many players around the world shared it."
          theme={puzzle.title}
          author={puzzle.author}
          puzzleNumber={puzzle.puzzleNumber}
          dateKey={activeDateKey}
          showCreate={false}
          isCompletedToday={Boolean(submission)}
          hasSavedProgress={false}
          onPlay={() => setShowSplash(false)}
        />
      </GameShell>
    );
  }

  return (
    <GameShell
      gameSlug="1-win"
      gameTitle="1 Win"
      puzzleNumber={puzzle.puzzleNumber}
      dateKey={activeDateKey}
      author={puzzle.author}
      subtitle="Share 1 win from your day and unlock the live global Top 100."
      headerRightSlot={
        <div className="flex items-center gap-1.5">
          {stats.currentStreak > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-black/20 bg-[#FFFBE6] px-2.5 py-1 text-xs font-black text-black"
              title="Current Daily Win Streak"
            >
              <Flame className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
              {stats.currentStreak}
            </span>
          )}
          {showLeaderboard && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-black bg-black px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white"
              data-testid="one-win-live-badge"
            >
              <Radio className="h-3 w-3 text-[#2ECC71] animate-pulse" />
              Top 100
            </span>
          )}
        </div>
      }
    >
      <div className="mx-auto w-full max-w-2xl px-3 sm:px-5 py-5 sm:py-8 space-y-6">
        {/* Archive View-Only Notice (Q48) */}
        {isArchiveDate && (
          <div
            className="rounded-2xl border-2 border-black bg-[#FFFBE6] p-4 shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            data-testid="one-win-archive-banner"
          >
            <div className="flex items-start gap-2.5">
              <Lock className="h-5 w-5 text-black shrink-0 mt-0.5" />
              <div>
                <p className="font-headline text-sm font-black text-black">
                  Archive View-Only · {formatLongDate(activeDateKey)}
                </p>
                <p className="text-xs text-gray-700">
                  Submissions are closed for past dates. Browse this day&apos;s final Top 100 community wins below, or log today&apos;s win!
                </p>
              </div>
            </div>
            <Link
              href="/games/1-win"
              className="inline-flex items-center justify-center rounded-full border-2 border-black bg-black px-3.5 py-1.5 text-xs font-black text-white hover:bg-gray-800 shrink-0"
            >
              Today&apos;s 1 Win
            </Link>
          </div>
        )}

        {/* STAGE 1: 100% Blind Free-Text Submission Card (Q46 & Q47) */}
        {!showLeaderboard && (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="rounded-3xl border-2 border-black bg-white p-5 sm:p-7 shadow-[5px_5px_0px_#000] space-y-5"
            data-testid="one-win-blind-form"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Badge className="border border-black bg-[#e0e1d9] text-black font-black uppercase tracking-wider text-[11px]">
                  Blind Daily Check-In · #{puzzle.puzzleNumber}
                </Badge>
                <span className="text-xs font-bold text-gray-500">
                  {formatLongDate(activeDateKey)}
                </span>
              </div>

              <h2 className="font-headline text-xl sm:text-2xl font-black text-black leading-snug">
                {puzzle.prompt}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600">
                {puzzle.subtitle}
              </p>
            </div>

            <div className="space-y-2.5">
              <label
                htmlFor="one-win-input"
                className="sr-only"
              >
                Your 1 Win Today (1 to 4 words, max 35 characters)
              </label>
              <Input
                id="one-win-input"
                type="text"
                value={draftInput}
                onChange={(e) => {
                  setDraftInput(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={48}
                placeholder="Your 1 win in 1–4 words..."
                className="h-14 rounded-2xl border-2 border-black px-4 text-lg sm:text-xl font-headline font-black text-black placeholder:text-gray-400 placeholder:font-medium focus-visible:ring-2 focus-visible:ring-black"
                data-testid="one-win-input"
              />

              {/* Live Word & Character Counters */}
              <div className="flex items-center justify-between gap-2 text-xs font-bold px-1">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 border",
                      wordCount > ONE_WIN_MAX_WORDS
                        ? "border-red-600 bg-red-50 text-red-700 font-black"
                        : wordCount >= 1
                        ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                        : "border-gray-300 bg-gray-50 text-gray-600"
                    )}
                  >
                    {wordCount} / {ONE_WIN_MAX_WORDS} words
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 border font-mono",
                      charCount > ONE_WIN_MAX_CHARS
                        ? "border-red-600 bg-red-50 text-red-700 font-black"
                        : "border-gray-300 bg-gray-50 text-gray-600"
                    )}
                  >
                    {charCount} / {ONE_WIN_MAX_CHARS} chars
                  </span>
                </div>

                {liveNormalized.valid && (
                  <span className="text-[11px] text-gray-600 truncate">
                    Groups as:{" "}
                    <strong className="font-black text-black">
                      &ldquo;{liveNormalized.displayText}&rdquo;
                    </strong>
                  </span>
                )}
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl border-2 border-red-600 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-800 flex items-start gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-[11px] text-gray-500">
                1 submission per day · Unlocks today&apos;s live global Top 100 leaderboard.
              </p>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  wordCount < 1 ||
                  wordCount > ONE_WIN_MAX_WORDS ||
                  charCount > ONE_WIN_MAX_CHARS
                }
                className="h-12 rounded-full border-2 border-black bg-black px-6 font-headline text-sm font-black text-white hover:bg-gray-800 shadow-[3px_3px_0px_#000] disabled:opacity-45"
                data-testid="one-win-submit-btn"
              >
                <Sparkles className="h-4 w-4 mr-1.5 text-[#F9D423]" />
                {isSubmitting ? "Logging Win..." : "Log My 1 Win"}
              </Button>
            </div>
          </form>
        )}

        {/* STAGE 2: Player's Locked Win Summary + Share Receipt */}
        {submission && (
          <section
            className="rounded-3xl border-2 border-black bg-white p-5 sm:p-6 shadow-[5px_5px_0px_#000] space-y-4"
            data-testid="one-win-completion-card"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black bg-[#2ECC71] px-3 py-1 text-xs font-black text-black">
                <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.6]" />
                {isArchiveDate ? "Your Win On This Day" : "Today's Win Locked"}
              </span>
              <span className="text-xs font-bold text-gray-500">
                1 Win #{puzzle.puzzleNumber} · {formatLongDate(activeDateKey)}
              </span>
            </div>

            <div className="rounded-2xl border-2 border-black bg-[#FAFAFA] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[11px] font-black uppercase tracking-widest text-gray-500">
                  Your Canonical Gratitude Win
                </div>
                <div className="font-headline text-2xl sm:text-3xl font-black text-black tracking-tight">
                  &ldquo;{submission.displayText}&rdquo;
                </div>
                <p className="text-xs text-gray-600 flex items-center gap-1.5 pt-0.5">
                  <Users className="h-3.5 w-3.5 text-black" />
                  {(snapshot.playerCount ?? 1) === 1
                    ? "You're the 1st player to log this exact win today!"
                    : `Shared by ${snapshot.playerCount} players around the world today`}
                </p>
              </div>

              <div className="flex items-center gap-3 sm:flex-col sm:items-end shrink-0">
                <div className="rounded-2xl border-2 border-black bg-[#F9D423] px-4 py-2 text-center shadow-[2px_2px_0px_#000]">
                  <div className="text-[10px] font-black uppercase tracking-wider text-black/75">
                    Global Rank
                  </div>
                  <div className="font-headline text-2xl font-black text-black">
                    #{snapshot.playerRank ?? 1}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <ResultShareButtons
                title={`1 Win #${puzzle.puzzleNumber}`}
                text={shareText}
              />
              <Link
                href="/games/1-win/archive"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-black bg-white px-4 py-2 text-xs font-black text-black hover:bg-gray-100"
              >
                <Calendar className="h-3.5 w-3.5" />
                Past Top 100 Archive
              </Link>
            </div>
          </section>
        )}

        {/* STAGE 3: Live Top 100 Today's Wins Leaderboard (Q46–Q48) */}
        {showLeaderboard && (
          <section
            className="rounded-3xl border-2 border-black bg-white p-5 sm:p-6 shadow-[5px_5px_0px_#000] space-y-4"
            data-testid="one-win-leaderboard"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-[#F9D423] fill-[#F9D423]" />
                  <h3 className="font-headline text-lg sm:text-xl font-black text-black">
                    {isArchiveDate
                      ? "Archive Top 100 Community Wins"
                      : "Live Top 100 Today's Wins"}
                  </h3>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                  {snapshot.totalSubmissions.toLocaleString()} community gratitude wins logged ·{" "}
                  {snapshot.liveConnected
                    ? "Synced live via Supabase Realtime"
                    : "Community Gratitude Board"}
                </p>
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="h-3.5 w-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter Top 100..."
                  className="h-9 pl-8 rounded-full border-black/30 text-xs"
                />
              </div>
            </div>

            <div className="divide-y divide-gray-100 max-h-[540px] overflow-y-auto pr-1 space-y-1.5">
              {filteredEntries.length === 0 ? (
                <div className="py-8 text-center text-xs font-bold text-gray-500">
                  No wins match &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                filteredEntries.map((row) => {
                  const pct = Math.max(
                    6,
                    Math.min(100, Math.round((row.count / topCount) * 100))
                  );
                  const medal =
                    row.rank === 1
                      ? "🥇"
                      : row.rank === 2
                      ? "🥈"
                      : row.rank === 3
                      ? "🥉"
                      : null;
                  return (
                    <div
                      key={row.normalizedKey}
                      className={cn(
                        "relative overflow-hidden rounded-xl border px-3.5 py-2.5 transition-all",
                        row.isPlayerWin
                          ? "border-2 border-black bg-[#FFFBE6] shadow-[2px_2px_0px_#000]"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      )}
                    >
                      <div
                        className={cn(
                          "pointer-events-none absolute inset-y-0 left-0 opacity-25",
                          row.isPlayerWin ? "bg-[#F9D423]" : "bg-[#e0e1d9]"
                        )}
                        style={{ width: `${pct}%` }}
                        aria-hidden="true"
                      />
                      <div className="relative flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={cn(
                              "inline-flex h-7 min-w-7 px-1.5 items-center justify-center rounded-lg border text-xs font-mono font-black shrink-0",
                              row.rank <= 3
                                ? "border-black bg-black text-white"
                                : "border-gray-300 bg-gray-50 text-gray-700"
                            )}
                          >
                            {medal ? `${medal} ${row.rank}` : `#${row.rank}`}
                          </span>
                          <span className="font-headline text-sm sm:text-base font-black text-black truncate">
                            {row.displayText}
                          </span>
                          {row.isPlayerWin && (
                            <Badge className="border border-black bg-[#2ECC71] text-black text-[10px] font-black uppercase px-2 py-0 shrink-0">
                              Your Win
                            </Badge>
                          )}
                        </div>

                        <span className="font-mono text-xs font-black text-gray-800 shrink-0">
                          {row.count.toLocaleString()}{" "}
                          <span className="text-[10px] font-sans font-bold text-gray-500">
                            {row.count === 1 ? "win" : "wins"}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}
      </div>
    </GameShell>
  );
}

export default OneWinGame;
