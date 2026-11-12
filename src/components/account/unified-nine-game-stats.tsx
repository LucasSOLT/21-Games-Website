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
  /** Extra slot rendered at the bottom of the #21: 21 Things card (Recent #1 Picks + Created Boards). */
  twentyOneExtraSlot?: React.ReactNode;
  /** Compact layout for the /account Guest On-Device preview column. */
  compact?: boolean;
  /** Callback when clicking Play / Archive inside a modal. */
  onNavigateAway?: () => void;
}

export function UnifiedNineGameStats({
  remoteStats,
  boardsCreatedCount,
  twentyOneExtraSlot,
  compact = false,
  onNavigateAway,
}: UnifiedNineGameStatsProps) {
  const [localStats, setLocalStats] = useState<AllGameStatsMap>(() =>
    getAllLocalGameStats()
  );
  const [oneWinHistory, setOneWinHistory] = useState<OneWinHistoryItem[]>(() =>
    getOneWinPersonalHistory()
  );
  const [selectedFilter, setSelectedFilter] = useState<"all" | AllGameSlug>(
    "all"
  );

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
      selectedFilter === "all"
        ? ALL_GAMES
        : ALL_GAMES.filter((g) => g.slug === selectedFilter),
    [selectedFilter]
  );

  return (
    <div className="space-y-4">
      {/* 9-Game Countdown Rollup Summary Bar */}
      <div className="rounded-2xl border-2 border-black bg-[#FFFBE6] p-3.5 sm:p-4 shadow-[3px_3px_0px_#000]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-black">
            <Trophy className="h-3.5 w-3.5 text-amber-600" />
            Countdown 21 → 1 · All 9 Games Rollup
          </span>
          <span className="text-[11px] font-black text-gray-700">
            Today: {rollup.completedToday} / 9 completed
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-black/20 bg-white px-2 py-2">
            <div className="font-headline text-lg sm:text-xl font-black text-black">
              {rollup.totalPlayed}
            </div>
            <div className="text-[10px] font-bold uppercase text-gray-500">
              Total Played
            </div>
          </div>
          <div className="rounded-xl border border-black/20 bg-white px-2 py-2">
            <div className="font-headline text-lg sm:text-xl font-black text-black">
              {rollup.activeStreaks} / 9 🔥
            </div>
            <div className="text-[10px] font-bold uppercase text-gray-500">
              Active Streaks
            </div>
          </div>
          <div className="rounded-xl border border-black/20 bg-white px-2 py-2">
            <div className="font-headline text-lg sm:text-xl font-black text-black">
              {rollup.bestStreak}
            </div>
            <div className="text-[10px] font-bold uppercase text-gray-500">
              Best Streak
            </div>
          </div>
        </div>

        {/* Countdown Filter Pills: All 9 | #21 | #17 | #9 | #8 | #6 | #5 | #4 | #2 | #1 */}
        <div
          className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Filter game stats by countdown number"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedFilter === "all"}
            onClick={() => setSelectedFilter("all")}
            className={cn(
              "shrink-0 rounded-full border-2 border-black px-2.5 py-1 text-[11px] font-black transition-all cursor-pointer",
              selectedFilter === "all"
                ? "bg-black text-white"
                : "bg-white text-black hover:bg-gray-100"
            )}
          >
            All 9
          </button>
          {ALL_GAMES.map((g) => {
            const slug = g.slug as AllGameSlug;
            const num = GAME_COUNTDOWN_NUMBER[slug];
            const active = selectedFilter === slug;
            return (
              <button
                key={slug}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedFilter(slug)}
                style={
                  active
                    ? { backgroundColor: GAME_ACCENT_HEX[slug] }
                    : undefined
                }
                className={cn(
                  "shrink-0 rounded-full border-2 border-black px-2.5 py-1 text-[11px] font-black transition-all cursor-pointer",
                  active
                    ? "text-black shadow-[1px_1px_0px_#000]"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                )}
                title={g.name}
              >
                #{num} {compact ? "" : g.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Strict 21 -> 17 -> 9 -> 8 -> 6 -> 5 -> 4 -> 2 -> 1 Per-Game Cards */}
      <div className="grid grid-cols-1 gap-4">
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
                "rounded-2xl border-2 border-black bg-white shadow-[3px_3px_0px_#000] space-y-3.5",
                compact ? "p-3.5" : "p-4 sm:p-5"
              )}
            >
              {/* Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
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
                  "grid gap-2 text-center",
                  metrics.length >= 6
                    ? "grid-cols-3 sm:grid-cols-6"
                    : metrics.length === 5
                    ? "grid-cols-2 sm:grid-cols-5"
                    : metrics.length === 4
                    ? "grid-cols-2 sm:grid-cols-4"
                    : "grid-cols-3"
                )}
              >
                {metrics.map((m) => (
                  <div
                    key={m.label}
                    className={cn(
                      "rounded-xl border border-black/15 p-2",
                      m.highlight ? "bg-[#FFFBE6]" : "bg-gray-50"
                    )}
                  >
                    <div className="font-headline text-sm sm:text-base font-black text-black truncate">
                      {m.value}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-gray-500 truncate">
                      {m.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* #6: 6 Pics Piece Efficiency Breakdown (1/6 -> 6/6) */}
              {slug === "6-pics" && summary.guessDistribution && (
                <div className="rounded-xl border border-black/15 bg-gray-50/90 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-gray-600">
                    <span>Piece Efficiency (1/6 → 6/6)</span>
                    <span>Points</span>
                  </div>
                  <div className="space-y-1">
                    {summary.guessDistribution.map((row) => {
                      const pct = Math.max(
                        row.count > 0 ? 12 : 4,
                        Math.round((row.count / maxDistCount) * 100)
                      );
                      return (
                        <div
                          key={row.guessNumber}
                          className="flex items-center gap-2 text-[11px]"
                        >
                          <span className="w-7 font-mono font-black text-black text-right">
                            {row.guessNumber}/6
                          </span>
                          <div className="flex-1 h-5 rounded-md bg-white border border-black/15 overflow-hidden flex items-center">
                            <div
                              style={{
                                width: `${pct}%`,
                                backgroundColor:
                                  row.count > 0 ? accent : "#e5e7eb",
                              }}
                              className="h-full flex items-center justify-end px-1.5 text-[10px] font-black text-black transition-all"
                            >
                              {row.count}
                            </div>
                          </div>
                          <span className="w-11 text-right font-mono text-[10px] font-bold text-gray-500">
                            {row.pointsLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* #1: 1 Win Personal Daily Win History Log */}
              {slug === "1-win" && (
                <div className="rounded-xl border border-black/15 bg-gray-50/90 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-600">
                      Personal Daily Win History ({oneWinHistory.length})
                    </span>
                    <span className="text-[10px] font-bold text-gray-500">
                      Date → Your Win → Rank
                    </span>
                  </div>
                  {oneWinHistory.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      Log today&apos;s tiny win in 1 Win to start your personal
                      daily win journal.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {oneWinHistory.slice(0, compact ? 3 : 7).map((entry) => (
                        <div
                          key={`${entry.dateKey}-${entry.normalizedKey}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs"
                        >
                          <span className="font-mono text-[11px] font-bold text-gray-500 shrink-0">
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

              {/* Last 7 Days Completion Strip + Archive Link */}
              <div className="rounded-xl border border-black/15 bg-gray-50/80 p-2.5 sm:p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-gray-600">
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
                          "flex items-center justify-center rounded-full border font-black transition-all",
                          compact ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-xs",
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
                          "text-[9px] sm:text-[10px] font-bold",
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

              {/* Extra Slot for #21: 21 Things (Recent #1 Picks + Created Boards) */}
              {slug === "21-things" && twentyOneExtraSlot && (
                <div className="pt-1 space-y-3 border-t border-black/10">
                  {twentyOneExtraSlot}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
