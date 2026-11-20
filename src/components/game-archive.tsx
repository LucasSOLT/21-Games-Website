"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Play,
  Search,
} from "lucide-react";
import {
  getArchiveEntriesForGame,
  parseDateKeyToLocalNoon,
} from "@/lib/daily-engine";
import { getAdminOverridesForGame, isDateCompleted } from "@/lib/game-storage";
import {
  ALL_GAMES,
  GAME_ACCENT_HEX,
  GAME_COUNTDOWN_NUMBER,
  type AllGameSlug,
  type PlayableGameSlug,
} from "@/lib/games-config";
import { useLiveLocalDateKey } from "@/hooks/use-live-date-key";
import { playTapSfx } from "@/lib/game-sfx";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AccountNavButton } from "@/components/account/account-nav-button";
import { SolGamesLogo } from "@/components/solgames-logo";
import { navigateBackToPreviousScreen } from "@/lib/navigation-history";

const SSR_ANCHOR_DATE = parseDateKeyToLocalNoon("2026-11-05");
const subscribeNoop = () => () => {};

type ArchiveStatusFilter = "all" | "unplayed" | "completed";

interface GameArchiveViewProps {
  gameSlug: PlayableGameSlug;
}

export function GameArchiveView({ gameSlug }: GameArchiveViewProps) {
  const router = useRouter();
  const liveTodayKey = useLiveLocalDateKey();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ArchiveStatusFilter>("all");
  const [puzzleSyncVersion, setPuzzleSyncVersion] = useState(0);
  const [statsVersion, setStatsVersion] = useState(0);

  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  useEffect(() => {
    const handlePuzzlesUpdated = () => {
      setPuzzleSyncVersion((v) => v + 1);
    };
    const handleStatsUpdated = () => {
      setStatsVersion((v) => v + 1);
    };
    window.addEventListener("solgames:puzzles-updated", handlePuzzlesUpdated);
    window.addEventListener("solgames:stats-updated", handleStatsUpdated);
    window.addEventListener("solgames:profile-sync", handleStatsUpdated);
    window.addEventListener("storage", handleStatsUpdated);
    window.addEventListener("focus", handleStatsUpdated);
    return () => {
      window.removeEventListener(
        "solgames:puzzles-updated",
        handlePuzzlesUpdated
      );
      window.removeEventListener("solgames:stats-updated", handleStatsUpdated);
      window.removeEventListener("solgames:profile-sync", handleStatsUpdated);
      window.removeEventListener("storage", handleStatsUpdated);
      window.removeEventListener("focus", handleStatsUpdated);
    };
  }, []);

  const entries = useMemo(() => {
    void puzzleSyncVersion;
    const activeDate = mounted
      ? parseDateKeyToLocalNoon(liveTodayKey)
      : SSR_ANCHOR_DATE;
    const overrides = mounted ? getAdminOverridesForGame(gameSlug) : undefined;
    return getArchiveEntriesForGame(gameSlug, 60, activeDate, overrides);
  }, [gameSlug, mounted, liveTodayKey, puzzleSyncVersion]);

  const completedDateSet = useMemo(() => {
    void statsVersion;
    if (!mounted) return new Set<string>();
    const solved = new Set<string>();
    for (const entry of entries) {
      if (isDateCompleted(gameSlug, entry.dateKey)) {
        solved.add(entry.dateKey);
      }
    }
    return solved;
  }, [entries, gameSlug, mounted, statsVersion]);

  const totalCount = entries.length;
  const completedCount = completedDateSet.size;
  const unplayedCount = Math.max(0, totalCount - completedCount);
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const nextUnsolvedEntry = useMemo(() => {
    if (!mounted) return null;
    return entries.find((e) => !completedDateSet.has(e.dateKey)) ?? null;
  }, [mounted, entries, completedDateSet]);

  const gameConfig = ALL_GAMES.find((g) => g.slug === gameSlug);
  const gameTitle = gameConfig?.name ?? gameSlug;
  const countdownNumber = GAME_COUNTDOWN_NUMBER[gameSlug];
  const accentHex = GAME_ACCENT_HEX[gameSlug];
  const newestDateKey = entries[0]?.dateKey ?? "";

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filtered = entries.filter((entry) => {
    const isCompleted = completedDateSet.has(entry.dateKey);
    if (statusFilter === "completed" && !isCompleted) return false;
    if (statusFilter === "unplayed" && isCompleted) return false;

    if (!normalizedQuery) return true;
    return (
      entry.title.toLowerCase().includes(normalizedQuery) ||
      entry.dateFormatted.toLowerCase().includes(normalizedQuery) ||
      entry.dayName.toLowerCase().includes(normalizedQuery) ||
      entry.author.toLowerCase().includes(normalizedQuery) ||
      entry.dateKey.toLowerCase().includes(normalizedQuery) ||
      String(entry.puzzleNumber).includes(normalizedQuery)
    );
  });

  const handleSwitchGameArchive = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const nextSlug = e.target.value;
    playTapSfx();
    router.push(`/games/${nextSlug}/archive`);
  };

  const handleSelectFilter = (nextFilter: ArchiveStatusFilter) => {
    playTapSfx();
    setStatusFilter(nextFilter);
  };

  return (
    <div className="min-h-screen bg-[#FCFCFD] text-black">
      <header className="sticky top-0 z-30 border-b-2 border-black/10 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto max-w-6xl px-2 min-[375px]:px-3 sm:px-6 h-12 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <Link
              href="/"
              className="group flex items-center shrink-0 transition-transform hover:scale-105 active:scale-95"
              title="SOL GaMES - Home"
              aria-label="SOL GaMES Homepage"
            >
              <SolGamesLogo
                variant="mark"
                size={30}
                className="h-7 w-7 sm:h-8 sm:w-8"
              />
            </Link>
            <button
              type="button"
              onClick={() => {
                playTapSfx(0.95);
                navigateBackToPreviousScreen(router, `/games/${gameSlug}`, {
                  excludePathname: `/games/${gameSlug}/archive`,
                  gameSlug,
                });
              }}
              data-testid="archive-back-button"
              className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full border-2 border-black bg-white px-2 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-sm font-bold text-black hover:bg-gray-100 transition-colors whitespace-nowrap cursor-pointer"
              aria-label="Back to previous screen"
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span>Back</span>
            </button>
            <Link
              href={`/games/${gameSlug}`}
              className="text-xs font-bold text-gray-600 hover:text-black hidden sm:inline whitespace-nowrap"
            >
              Today&apos;s {gameTitle}
            </Link>
            <Link
              href="/"
              className="text-xs font-bold text-gray-500 hover:text-black hidden lg:inline whitespace-nowrap"
            >
              All 9 Games
            </Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <select
              aria-label="Switch game archive"
              value={gameSlug}
              onChange={handleSwitchGameArchive}
              className="h-8 sm:h-9 max-w-[128px] min-[400px]:max-w-[155px] sm:max-w-[215px] rounded-full border-2 border-black bg-white px-2.5 sm:px-3 text-[11px] sm:text-xs font-headline font-black text-black shadow-[1px_1px_0_#000] focus:outline-none focus:ring-2 focus:ring-black cursor-pointer truncate"
            >
              {ALL_GAMES.map((g) => {
                const slug = g.slug as AllGameSlug;
                const num = GAME_COUNTDOWN_NUMBER[slug];
                return (
                  <option key={slug} value={slug}>
                    #{num} {g.name} Archive
                  </option>
                );
              })}
            </select>
            <AccountNavButton variant="compact" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
        <div
          style={{ backgroundColor: accentHex }}
          className="rounded-2xl border-2 border-black p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[4px_4px_0_#111111]"
        >
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-black text-white px-3 py-1 text-xs font-bold mb-2">
              <Calendar className="h-3.5 w-3.5" />
              <span>#{countdownNumber} · 60-Day Playable Archive</span>
            </div>
            <h1 className="font-headline font-black text-3xl sm:text-4xl text-black">
              {gameTitle} Archive
            </h1>
            <p className="text-sm text-black/80 mt-1">
              Missed a day? Every past daily {gameTitle} puzzle is unlocked and
              playable anytime.
            </p>
          </div>

          <div className="w-full md:w-72 relative">
            <Search className="h-4 w-4 text-gray-500 absolute left-3 top-3" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${gameTitle} puzzles...`}
              aria-label={`Search ${gameTitle} archive puzzles`}
              className="pl-9 border-2 border-black bg-white"
            />
          </div>
        </div>

        {/* X / 60 Solved Progress Bar + Filter Pills + Play Next Unsolved CTA */}
        <section
          aria-label="Archive completion progress and filters"
          className="rounded-2xl border-2 border-black bg-white p-4 sm:p-5 shadow-[3px_3px_0_#111111] space-y-3.5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-headline text-base sm:text-lg font-black text-black">
                {completedCount} / {totalCount} Solved
              </span>
              <span className="inline-flex items-center rounded-full border border-black bg-[#F4F4F5] px-2.5 py-0.5 text-xs font-bold text-black">
                {progressPercent}% of 60-Day Window
              </span>
            </div>

            {mounted && nextUnsolvedEntry ? (
              <Link
                href={`/games/${gameSlug}?date=${nextUnsolvedEntry.dateKey}`}
                onClick={() => playTapSfx(1.05)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-black bg-black px-4 py-1.5 text-xs sm:text-sm font-headline font-black text-white shadow-[2px_2px_0_#111111] hover:bg-neutral-800 transition-colors self-start sm:self-auto"
              >
                <span>Play Next Unsolved →</span>
              </Link>
            ) : mounted && totalCount > 0 && unplayedCount === 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-[#2ECC71] px-3.5 py-1 text-xs font-headline font-black text-black">
                <CheckCircle2 className="h-3.5 w-3.5" />
                All {totalCount} Archive Puzzles Solved!
              </span>
            ) : null}
          </div>

          <div
            role="progressbar"
            aria-valuenow={completedCount}
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-label={`${completedCount} of ${totalCount} archive puzzles solved`}
            className="h-3 w-full overflow-hidden rounded-full border-2 border-black bg-neutral-100"
          >
            <div
              style={{ width: `${progressPercent}%` }}
              className="h-full bg-[#2ECC71] transition-all duration-300"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div
              role="group"
              aria-label="Filter archive by completion status"
              className="flex flex-wrap items-center gap-2"
            >
              <button
                type="button"
                aria-pressed={statusFilter === "all"}
                onClick={() => handleSelectFilter("all")}
                className={
                  statusFilter === "all"
                    ? "rounded-full border-2 border-black bg-black px-3.5 py-1 text-xs font-headline font-black text-white shadow-[1.5px_1.5px_0_#111111] cursor-pointer"
                    : "rounded-full border-2 border-black bg-white px-3.5 py-1 text-xs font-headline font-bold text-black hover:bg-neutral-100 cursor-pointer"
                }
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                aria-pressed={statusFilter === "unplayed"}
                onClick={() => handleSelectFilter("unplayed")}
                className={
                  statusFilter === "unplayed"
                    ? "rounded-full border-2 border-black bg-[#F9D423] px-3.5 py-1 text-xs font-headline font-black text-black shadow-[1.5px_1.5px_0_#111111] cursor-pointer"
                    : "rounded-full border-2 border-black bg-white px-3.5 py-1 text-xs font-headline font-bold text-black hover:bg-neutral-100 cursor-pointer"
                }
              >
                Unplayed ({unplayedCount})
              </button>
              <button
                type="button"
                aria-pressed={statusFilter === "completed"}
                onClick={() => handleSelectFilter("completed")}
                className={
                  statusFilter === "completed"
                    ? "rounded-full border-2 border-black bg-[#2ECC71] px-3.5 py-1 text-xs font-headline font-black text-black shadow-[1.5px_1.5px_0_#111111] cursor-pointer"
                    : "rounded-full border-2 border-black bg-white px-3.5 py-1 text-xs font-headline font-bold text-black hover:bg-neutral-100 cursor-pointer"
                }
              >
                Completed ({completedCount})
              </button>
            </div>

            {(statusFilter !== "all" || normalizedQuery !== "") && (
              <button
                type="button"
                onClick={() => {
                  playTapSfx();
                  setStatusFilter("all");
                  setSearchQuery("");
                }}
                className="text-xs font-bold text-gray-600 underline hover:text-black cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        </section>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-black/30 bg-white p-10 text-center space-y-3">
            <p className="font-headline text-lg font-black text-black">
              No matching {gameTitle} puzzles found
            </p>
            <p className="text-sm text-gray-600">
              {statusFilter === "completed" && completedCount === 0
                ? "You haven't completed any puzzles in this 60-day window yet."
                : statusFilter === "unplayed" && unplayedCount === 0
                  ? "Every puzzle in this 60-day window is already solved!"
                  : "Try clearing your search or switching the status filter."}
            </p>
            <button
              type="button"
              onClick={() => {
                playTapSfx();
                setStatusFilter("all");
                setSearchQuery("");
              }}
              className="inline-flex items-center rounded-full border-2 border-black bg-black px-4 py-1.5 text-xs font-headline font-black text-white hover:bg-neutral-800 cursor-pointer"
            >
              Show All ({totalCount}) Puzzles
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((entry) => {
              const completed = completedDateSet.has(entry.dateKey);
              const isToday = entry.dateKey === newestDateKey;
              return (
                <Link
                  key={entry.dateKey}
                  href={`/games/${gameSlug}?date=${entry.dateKey}`}
                  onClick={() => playTapSfx()}
                  className="group block rounded-2xl border-2 border-black/15 hover:border-black bg-white p-5 shadow-2xs hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        #{entry.puzzleNumber}
                      </Badge>
                      {isToday && <Badge variant="yellow">Today</Badge>}
                    </div>
                    {completed ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-full px-2.5 py-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 group-hover:text-black">
                        <Play className="h-3.5 w-3.5" />
                        Play
                      </span>
                    )}
                  </div>

                  <h2 className="font-headline font-black text-lg text-black group-hover:underline line-clamp-1">
                    {entry.title}
                  </h2>
                  <p className="text-xs font-semibold text-gray-500 mt-1">
                    {entry.dayName}, {entry.dateFormatted}
                  </p>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 uppercase">
                    <span>By {entry.author}</span>
                    <span>Edited by {entry.editor}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
