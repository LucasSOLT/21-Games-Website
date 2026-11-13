"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Flame, Play, Trophy } from "lucide-react";
import { GameLogo } from "@/components/game-logo";
import { Badge } from "@/components/ui/badge";
import {
  ALL_GAMES,
  ALL_GAME_SLUGS,
  GAME_ACCENT_HEX,
  GAME_COUNTDOWN_NUMBER,
  type AllGameSlug,
} from "@/lib/games-config";
import { getLocalDateKey } from "@/lib/date-keys";
import {
  buildUnifiedGameProfileSummary,
  getAllLocalGameStats,
  mergeAllGameStatsMaps,
  type AllGameStatsMap,
} from "@/lib/game-storage";
import {
  getOneWinPersonalHistory,
  type OneWinHistoryItem,
} from "@/lib/one-win-service";
import { cn } from "@/lib/utils";

export interface Last7DayStripItem {
  dateKey: string;
  dayInitial: string;
  shortLabel: string;
  completed: boolean;
  isToday: boolean;
}

export function buildUnifiedLast7DaysStrip(
  completedDates: string[]
): Last7DayStripItem[] {
  const completedSet = new Set(completedDates);
  const strip: Last7DayStripItem[] = [];
  const now = new Date();
  const dayLetters = ["S", "M", "T", "W", "T", "F", "S"];

  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - offset
    );
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateKey = `${yyyy}-${mm}-${dd}`;
    strip.push({
      dateKey,
      dayInitial: dayLetters[d.getDay()] ?? "D",
      shortLabel: d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      completed: completedSet.has(dateKey),
      isToday: offset === 0,
    });
  }

  return strip;
}

export interface UnifiedNineGameStatsProps {
  /** Cloud-synced stats from UserProfile (merged with local on-device stats). */
  remoteStats?: Partial<AllGameStatsMap> | null;
  /** Optional count of created 21 Things boards to display inside the #21 card. */
  boardsCreatedCount?: number;
  /** Optional count of recent #1 picks to display inside the #21 spotlight summary. */
  recentPicksCount?: number;
  /** Extra slot rendered at the bottom of the #21: 21 Things card (Recent #1 Picks + Created Boards). */
  twentyOneExtraSlot?: React.ReactNode;
  /** Compact layout for the /account Guest On-Device preview column. */
  compact?: boolean;
  /** Callback when clicking Play / Archive inside a modal. */
  onNavigateAway?: () => void;
  /** Controlled selected game slug for spotlight view (defaults to "21-things"). */
  selectedGameId?: AllGameSlug;
  /** Callback when selecting a game in the 9-game selector grid. */
  onSelectGameId?: (slug: AllGameSlug) => void;
  /** Render 1 selected game spotlight card at a time (default true). */
  spotlightMode?: boolean;
  /** Callback to switch to the My Boards & #1 Picks tab from the #21 card. */
  onOpenBoardsTab?: () => void;
}

export function UnifiedNineGameStats({
  remoteStats,
  boardsCreatedCount,
  recentPicksCount,
  twentyOneExtraSlot,
  compact = false,
  onNavigateAway,
  selectedGameId,
  onSelectGameId,
  spotlightMode = true,
  onOpenBoardsTab,
}: UnifiedNineGameStatsProps) {
  const [localStats, setLocalStats] = useState<AllGameStatsMap>(() =>
    getAllLocalGameStats()
  );
  const [oneWinHistory, setOneWinHistory] = useState<OneWinHistoryItem[]>(() =>
    getOneWinPersonalHistory()
  );
  const [internalSelectedGameId, setInternalSelectedGameId] =
    useState<AllGameSlug>(selectedGameId ?? "21-things");

  const activeGameId: AllGameSlug = selectedGameId ?? internalSelectedGameId;

  const handleSelectGame = (slug: AllGameSlug) => {
    setInternalSelectedGameId(slug);
    onSelectGameId?.(slug);
  };

  useEffect(() => {
    const refresh = () => {
      setLocalStats(getAllLocalGameStats());
      setOneWinHistory(getOneWinPersonalHistory());
    };
    window.addEventListener("solgames:stats-updated", refresh);
    window.addEventListener("solgames:profile-sync", refresh);
    window.addEventListener("solgames:auth-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("solgames:stats-updated", refresh);
      window.removeEventListener("solgames:profile-sync", refresh);
      window.removeEventListener("solgames:auth-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const mergedStats = useMemo(
    () => mergeAllGameStatsMaps(remoteStats ?? null, localStats),
    [remoteStats, localStats]
  );

  const todayKey = getLocalDateKey();

  const rollup = useMemo(() => {
    let totalPlayed = 0;
    let activeStreaks = 0;
    let bestStreak = 0;
    let completedToday = 0;
    for (const slug of ALL_GAME_SLUGS) {
      const s = mergedStats[slug];
      totalPlayed += s.played;
      if (s.currentStreak > 0) activeStreaks += 1;
      bestStreak = Math.max(bestStreak, s.maxStreak, s.currentStreak);
      if (s.completedDates.includes(todayKey)) completedToday += 1;
    }
    return { totalPlayed, activeStreaks, bestStreak, completedToday };
  }, [mergedStats, todayKey]);

  const visibleGames = useMemo(
    () =>
      spotlightMode
        ? ALL_GAMES.filter((g) => g.slug === activeGameId)
        : ALL_GAMES,
    [spotlightMode, activeGameId]
  );

  return (
    <div className="space-y-2.5 overflow-hidden">
      {/* 9-Game Countdown Rollup & Compact 9-Game Selector Grid */}
      <div className="rounded-2xl border-2 border-black bg-[#FFFBE6] p-2.5 sm:p-3 shadow-[2px_2px_0px_#000] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-black">
            <Trophy className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            Countdown 21 → 1 · All 9 Games Rollup
          </span>
          <span className="text-[11px] font-black text-gray-800">
            Played: {rollup.totalPlayed} · Active: {rollup.activeStreaks}/9 🔥 ·
            Best: {rollup.bestStreak} · Today: {rollup.completedToday}/9
          </span>
        </div>

        {/* Compact 9-Game Selector Grid: 21 -> 17 -> 9 -> 8 -> 6 -> 5 -> 4 -> 2 -> 1 */}
        <div
          className="mt-2 grid grid-cols-3 sm:grid-cols-9 gap-1 sm:gap-1.5"
          role="tablist"
          aria-label="Filter game stats by countdown number"
          data-testid="profile-nine-game-selector"
        >
          {ALL_GAMES.map((g) => {
            const slug = g.slug as AllGameSlug;
            const num = GAME_COUNTDOWN_NUMBER[slug];
            const active = activeGameId === slug;
            const hasStreak = mergedStats[slug].currentStreak > 0;
            const shortTitle = g.name.replace(/^\d+\s+/, "");
            return (
              <button
                key={slug}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`profile-game-select-${slug}`}
                onClick={() => handleSelectGame(slug)}
                style={
                  active
                    ? { backgroundColor: GAME_ACCENT_HEX[slug] }
                    : undefined
                }
                className={cn(
                  "min-w-0 rounded-lg border-2 border-black px-1.5 py-1 text-center transition-all cursor-pointer flex flex-col items-center justify-center leading-tight",
                  active
                    ? "text-black font-black shadow-[1px_1px_0px_#000]"
                    : "bg-white text-gray-800 hover:bg-gray-100 font-bold"
                )}
                title={`#${num} ${g.name}`}
              >
                <span className="font-headline text-[11px] sm:text-xs font-black leading-none">
                  #{num}
                  {hasStreak ? " 🔥" : ""}
                </span>
                <span className="text-[9px] font-bold truncate max-w-full mt-0.5">
                  {compact ? g.name : shortTitle}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Game Spotlight Card (1 card at a time in spotlightMode) */}
      <div className="grid grid-cols-1 gap-2.5">
        {visibleGames.map((game) => {
          const slug = game.slug as AllGameSlug;
          const countdownNum = GAME_COUNTDOWN_NUMBER[slug];
          const accent = GAME_ACCENT_HEX[slug];
          const summary = buildUnifiedGameProfileSummary(
            slug,
            mergedStats[slug]
          );
          const strip = buildUnifiedLast7DaysStrip(
            summary.stats.completedDates
          );

          const metrics =
            slug === "21-things" && typeof boardsCreatedCount === "number"
              ? [
                  ...summary.metrics,
                  {
                    label: "Boards Created",
                    value: String(boardsCreatedCount),
                  },
                ]
              : summary.metrics;

          const maxDistCount = summary.guessDistribution
            ? Math.max(1, ...summary.guessDistribution.map((d) => d.count))
            : 1;

          return (
            <div
              key={slug}
              data-testid={`profile-stat-card-${slug}`}
              className={cn(
                "rounded-2xl border-2 border-black bg-white shadow-[2px_2px_0px_#000] space-y-2.5 overflow-hidden",
                compact ? "p-3" : "p-3 sm:p-3.5"
              )}
            >
              {/* Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative shrink-0 flex items-center justify-center">
                    <GameLogo game={game} variant="mini" />
                  </div>
                  <span
                    style={{ backgroundColor: accent }}
                    className="inline-flex h-6 min-w-6 px-1.5 items-center justify-center rounded-md border-2 border-black font-headline text-xs font-black text-black shrink-0"
                  >
                    #{countdownNum}
                  </span>
                  <div className="min-w-0">
                    <h5 className="font-headline text-sm sm:text-base font-black text-black leading-tight truncate">
                      {game.name}
                    </h5>
                    <p className="text-[11px] text-gray-500 font-medium truncate">
                      {game.tagline}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge className="border-2 border-black bg-[#FFFBE6] text-black font-black text-[11px] px-2 py-0.5">
                    <Flame className="h-3 w-3 text-orange-500 mr-1 fill-orange-500" />
                    {summary.stats.currentStreak}
                  </Badge>
                  <Link
                    href={`/games/${slug}/archive`}
                    onClick={onNavigateAway}
                    className="rounded-lg border border-black/30 bg-gray-50 px-2 py-1 text-[11px] font-black text-black hover:bg-gray-100 transition-colors"
                  >
                    Archive →
                  </Link>
                  <Link
                    href={`/games/${slug}`}
                    onClick={onNavigateAway}
                    style={{ backgroundColor: accent }}
                    className="inline-flex items-center gap-1 rounded-lg border-2 border-black px-2.5 py-1 text-xs font-black text-black hover:opacity-90 transition-opacity"
                  >
                    Play
                    <Play className="h-3 w-3 fill-current" />
                  </Link>
                </div>
              </div>

              {/* Signature Q4 Metrics Grid */}
              <div
                className={cn(
                  "grid gap-1.5 text-center",
                  metrics.length >= 6
                    ? "grid-cols-3 sm:grid-cols-6"
                    : metrics.length === 5
                    ? "grid-cols-3 sm:grid-cols-5"
                    : metrics.length === 4
                    ? "grid-cols-2 sm:grid-cols-4"
                    : "grid-cols-3"
                )}
              >
                {metrics.map((m) => (
                  <div
                    key={m.label}
                    className={cn(
                      "rounded-xl border border-black/15 p-1.5 sm:p-2 min-w-0",
                      m.highlight ? "bg-[#FFFBE6]" : "bg-gray-50"
                    )}
                  >
                    <div className="font-headline text-xs sm:text-sm font-black text-black truncate">
                      {m.value}
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-bold uppercase text-gray-500 truncate">
                      {m.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* #6: 6 Pics Compact 2-Column Piece Efficiency Breakdown (1/6 -> 6/6) */}
              {slug === "6-pics" && summary.guessDistribution && (
                <div className="rounded-xl border border-black/15 bg-gray-50/90 p-2.5 space-y-1.5 overflow-hidden">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-gray-600">
                    <span>Piece Efficiency (1/6 → 6/6)</span>
                    <span>Points</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {summary.guessDistribution.map((row) => {
                      const pct = Math.max(
                        row.count > 0 ? 14 : 6,
                        Math.round((row.count / maxDistCount) * 100)
                      );
                      return (
                        <div
                          key={row.guessNumber}
                          className="flex items-center gap-1.5 text-[10px] min-w-0"
                        >
                          <span className="w-6 font-mono font-black text-black text-right shrink-0">
                            {row.guessNumber}/6
                          </span>
                          <div className="flex-1 h-4 rounded-md bg-white border border-black/15 overflow-hidden flex items-center min-w-0">
                            <div
                              style={{
                                width: `${pct}%`,
                                backgroundColor:
                                  row.count > 0 ? accent : "#e5e7eb",
                              }}
                              className="h-full flex items-center justify-end px-1 text-[9px] font-black text-black transition-all"
                            >
                              {row.count}
                            </div>
                          </div>
                          <span className="w-9 text-right font-mono text-[9px] font-bold text-gray-500 shrink-0">
                            {row.pointsLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* #1: 1 Win Compact Personal Daily Win History Log (Zero Scrollbars) */}
              {slug === "1-win" && (
                <div className="rounded-xl border border-black/15 bg-gray-50/90 p-2.5 space-y-1.5 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-600">
                      Personal Daily Win History ({oneWinHistory.length})
                    </span>
                    <span className="text-[10px] font-bold text-gray-500">
                      Date → Your Win → Rank
                    </span>
                  </div>
                  {oneWinHistory.length === 0 ? (
                    <p className="text-[11px] text-gray-500">
                      Log today&apos;s tiny win in 1 Win to start your personal
                      daily win journal.
                    </p>
                  ) : (
                    <div className="space-y-1 overflow-hidden">
                      {oneWinHistory.slice(0, 2).map((entry) => (
                        <div
                          key={`${entry.dateKey}-${entry.normalizedKey}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-black/10 bg-white px-2 py-1 text-[11px] overflow-hidden"
                        >
                          <span className="font-mono text-[10px] font-bold text-gray-500 shrink-0">
                            {entry.dateKey}
                          </span>
                          <span className="font-black text-black truncate flex-1">
                            &ldquo;{entry.displayText}&rdquo;
                          </span>
                          <span className="shrink-0 rounded-md border border-black bg-[#FFFBE6] px-1.5 py-0.5 font-mono text-[10px] font-black text-black">
                            #{entry.rank}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* #21: 21 Things Compact Spotlight Summary Row */}
              {slug === "21-things" && onOpenBoardsTab && (
                <div className="rounded-xl border border-black/15 bg-[#f7eef5]/60 px-2.5 py-2 flex flex-wrap items-center justify-between gap-2 overflow-hidden">
                  <span className="text-[11px] font-bold text-gray-800 truncate">
                    ✨ {recentPicksCount ?? 0} Recent #1 Picks ·{" "}
                    {boardsCreatedCount ?? 0} Created Boards
                  </span>
                  <button
                    type="button"
                    data-testid="profile-open-boards-tab"
                    onClick={onOpenBoardsTab}
                    className="shrink-0 rounded-lg border border-black bg-white px-2.5 py-1 text-[11px] font-black text-black hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    View My Boards &amp; #1 Picks →
                  </button>
                </div>
              )}

              {/* Extra Slot for #21: 21 Things when rendered outside tabbed modal */}
              {slug === "21-things" && !onOpenBoardsTab && twentyOneExtraSlot && (
                <div className="pt-1 space-y-2.5 border-t border-black/10 overflow-hidden">
                  {twentyOneExtraSlot}
                </div>
              )}

              {/* Compact Last 7 Days Completion Strip + Archive Link */}
              <div className="rounded-xl border border-black/15 bg-gray-50/80 p-2 sm:p-2.5 overflow-hidden">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-600">
                    Last 7 Days
                  </span>
                  <Link
                    href={`/games/${slug}/archive`}
                    onClick={onNavigateAway}
                    className="text-[11px] font-bold text-black underline hover:opacity-75"
                  >
                    Archive →
                  </Link>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {strip.map((item) => (
                    <div
                      key={item.dateKey}
                      title={item.shortLabel}
                      className="flex flex-col items-center gap-0.5"
                    >
                      <div
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-black transition-all",
                          item.completed
                            ? "border-black bg-[#2ECC71] text-black shadow-[1px_1px_0px_#000]"
                            : item.isToday
                            ? "border-black border-dashed bg-white text-gray-400"
                            : "border-gray-300 bg-white text-gray-300"
                        )}
                      >
                        {item.completed ? "✓" : "·"}
                      </div>
                      <span
                        className={cn(
                          "text-[9px] sm:text-[10px] font-bold leading-none",
                          item.isToday
                            ? "text-black underline"
                            : "text-gray-500"
                        )}
                      >
                        {item.dayInitial}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
