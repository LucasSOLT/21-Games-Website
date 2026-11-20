"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Flame, Sparkles, Trophy } from "lucide-react";
import { useAuth } from "@/components/account/auth-provider";
import { GameCard } from "@/components/game-card";
import { GameLogo } from "@/components/game-logo";
import { DailySweepModal } from "@/components/games/daily-sweep-modal";
import { Hero } from "@/components/hero";
import {
  ALL_GAMES,
  ALL_GAME_SLUGS,
  GAME_ACCENT_HEX,
  GAME_COUNTDOWN_NUMBER,
  getPlayableGameSlugs,
  type AllGameSlug,
} from "@/lib/games-config";
import {
  getDailySweepStatus,
  getGameStats,
  type DailySweepStatus,
} from "@/lib/game-storage";
import { useLiveLocalDateKey } from "@/hooks/use-live-date-key";
import { playTapSfx } from "@/lib/game-sfx";
import "@/components/hero.css";

const SSR_ANCHOR_DATE_KEY = "2026-11-05";

const featuredDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const archiveWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
});

const archiveShortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function parseDateKeyLocalNoon(dateKey: string): Date {
  const parts = dateKey.split("-").map(Number);
  const year = parts[0] || 2026;
  const month = parts[1] || 11;
  const day = parts[2] || 5;
  return new Date(year, month - 1, day, 12, 0, 0);
}

function formatDateKeyYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const EMPTY_SWEEP_STATUS: DailySweepStatus = {
  dateKey: SSR_ANCHOR_DATE_KEY,
  completedSlugs: [],
  remainingSlugs: [...ALL_GAME_SLUGS],
  completedCount: 0,
  totalCount: ALL_GAME_SLUGS.length,
  isSweepComplete: false,
};

export default function Home() {
  const { profile, isGameMaster, isLoading: authLoading } = useAuth();
  const todayKey = useLiveLocalDateKey();

  const [hydrated, setHydrated] = useState(false);
  const [sweepStatus, setSweepStatus] =
    useState<DailySweepStatus>(EMPTY_SWEEP_STATUS);
  const [totalPlayedAcrossAllGames, setTotalPlayedAcrossAllGames] = useState(0);
  const [bestCurrentStreak, setBestCurrentStreak] = useState(0);
  const [bestMaxStreak, setBestMaxStreak] = useState(0);

  useEffect(() => {
    const syncHubState = () => {
      const nextSweep = getDailySweepStatus(todayKey);
      let totalPlayed = 0;
      let topCurrentStreak = 0;
      let topMaxStreak = 0;

      for (const slug of ALL_GAME_SLUGS) {
        const local = getGameStats(slug);
        const remote = profile?.allGameStats?.[slug];
        const played = Math.max(local.played || 0, remote?.played || 0);
        const curStreak = Math.max(
          local.currentStreak || 0,
          remote?.currentStreak || 0
        );
        const maxStreak = Math.max(
          local.maxStreak || 0,
          remote?.maxStreak || 0
        );
        totalPlayed += played;
        if (curStreak > topCurrentStreak) topCurrentStreak = curStreak;
        if (maxStreak > topMaxStreak) topMaxStreak = maxStreak;
      }

      setSweepStatus(nextSweep);
      setTotalPlayedAcrossAllGames(totalPlayed);
      setBestCurrentStreak(topCurrentStreak);
      setBestMaxStreak(topMaxStreak);
      setHydrated(true);
    };

    syncHubState();
    window.addEventListener("solgames:stats-updated", syncHubState);
    window.addEventListener("solgames:profile-sync", syncHubState);
    window.addEventListener("storage", syncHubState);
    window.addEventListener("focus", syncHubState);
    return () => {
      window.removeEventListener("solgames:stats-updated", syncHubState);
      window.removeEventListener("solgames:profile-sync", syncHubState);
      window.removeEventListener("storage", syncHubState);
      window.removeEventListener("focus", syncHubState);
    };
  }, [todayKey, profile]);

  const isReturningPlayer =
    hydrated &&
    (totalPlayedAcrossAllGames > 0 || sweepStatus.completedCount > 0);

  const activeDateKey = hydrated ? todayKey : SSR_ANCHOR_DATE_KEY;

  const todayBannerLabel = useMemo(() => {
    return featuredDateFormatter.format(parseDateKeyLocalNoon(activeDateKey));
  }, [activeDateKey]);

  const playableSlugs = getPlayableGameSlugs();
  const liveCount = playableSlugs.length;
  const comingSoonGames = ALL_GAMES.filter((g) => !g.isPlayable);

  const nextRemainingSlug: AllGameSlug | null =
    sweepStatus.remainingSlugs[0] ?? null;
  const nextRemainingGame = nextRemainingSlug
    ? ALL_GAMES.find((g) => g.slug === nextRemainingSlug)
    : undefined;

  const recentArchiveItems = useMemo(() => {
    const baseNoon = parseDateKeyLocalNoon(activeDateKey);
    const playableGames = ALL_GAMES.filter((g) => g.isPlayable);
    if (playableGames.length === 0) return [];

    const daySeed = baseNoon.getDate();
    return [1, 2, 3, 4].map((daysAgo, idx) => {
      const d = new Date(baseNoon.getTime());
      d.setDate(d.getDate() - daysAgo);
      const dateKey = formatDateKeyYmd(d);
      const cfg = playableGames[(daySeed + idx * 2) % playableGames.length]!;
      const slug = cfg.slug as AllGameSlug;
      const num = GAME_COUNTDOWN_NUMBER[slug];
      return {
        dateKey,
        day: archiveWeekdayFormatter.format(d),
        date: archiveShortDateFormatter.format(d),
        gameName: cfg.name,
        gameSlug: slug,
        countdownNumber: num,
        logo: cfg.logo,
        tagline: cfg.tagline,
        accent: GAME_ACCENT_HEX[slug],
      };
    });
  }, [activeDateKey]);

  const handleOpenSweepReceipt = () => {
    playTapSfx(1.08);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("solgames:open-daily-sweep"));
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <DailySweepModal />
      <Hero />

      <main
        id="play"
        className="flex flex-col items-center pt-6 sm:pt-10 px-4 md:px-8 pb-16 scroll-mt-6"
      >
        {/* Returning Player / Active Progress Banner: Today's 21 -> 1 Daily Sweep */}
        {(isReturningPlayer || (hydrated && sweepStatus.completedCount > 0)) && (
          <section
            aria-label="Today's 21 to 1 Daily Sweep Progress"
            className="w-full max-w-5xl mb-6 sm:mb-8 rounded-2xl border-2 border-black bg-white p-4 sm:p-5 shadow-[4px_4px_0_#111111]"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-[#171717] px-3 py-0.5 text-xs font-headline font-black uppercase tracking-wider text-[#F9D423]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Today&apos;s 21 → 1 Daily Sweep
                </span>
                <span className="inline-flex items-center rounded-full border-2 border-black bg-[#FFFBE6] px-3 py-0.5 text-xs sm:text-sm font-headline font-black text-black">
                  {sweepStatus.completedCount} / {sweepStatus.totalCount} Solved
                  Today
                </span>
                {bestCurrentStreak > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-black bg-orange-50 px-2.5 py-0.5 text-xs font-black text-black">
                    <Flame className="h-3.5 w-3.5 text-orange-500 fill-orange-500" />
                    {bestCurrentStreak} Day Streak
                  </span>
                ) : bestMaxStreak > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-black/30 bg-neutral-100 px-2.5 py-0.5 text-xs font-bold text-neutral-700">
                    Best Streak: {bestMaxStreak}
                  </span>
                ) : null}
              </div>

              {sweepStatus.isSweepComplete ? (
                <button
                  type="button"
                  onClick={handleOpenSweepReceipt}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-black bg-gradient-to-r from-[#F9D423] via-[#ffe66d] to-[#2ECC71] px-4 py-1.5 text-xs sm:text-sm font-headline font-black text-black shadow-[2px_2px_0_#111111] hover:-translate-y-0.5 transition-transform cursor-pointer"
                >
                  <Trophy className="h-4 w-4 shrink-0" />
                  <span>🏆 9-for-9 Sweep Complete! Share Receipt</span>
                </button>
              ) : (
                nextRemainingGame &&
                nextRemainingSlug && (
                  <Link
                    href={`/games/${nextRemainingSlug}`}
                    onClick={() => playTapSfx(1.05)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-black bg-black px-3.5 py-1.5 text-xs font-headline font-black text-white shadow-[2px_2px_0_#111111] hover:bg-neutral-800 transition-colors self-start sm:self-auto"
                  >
                    <span>
                      Up Next: #{GAME_COUNTDOWN_NUMBER[nextRemainingSlug]}{" "}
                      {nextRemainingGame.name}
                    </span>
                    <span className="text-[#F9D423]">→</span>
                  </Link>
                )
              )}
            </div>

            {/* 9-Segment #21 -> #1 Countdown Progress Pills */}
            <div className="grid grid-cols-9 gap-1.5 sm:gap-2">
              {ALL_GAMES.map((game) => {
                const slug = game.slug as AllGameSlug;
                const num = GAME_COUNTDOWN_NUMBER[slug];
                const isSolved = sweepStatus.completedSlugs.includes(slug);
                const isNextUp = !isSolved && slug === nextRemainingSlug;

                return (
                  <Link
                    key={slug}
                    href={`/games/${slug}`}
                    onClick={() => playTapSfx()}
                    title={`#${num} ${game.name} — ${isSolved ? "Solved Today" : "Play Today's Puzzle"}`}
                    aria-label={`#${num} ${game.name} (${isSolved ? "Solved Today" : "Remaining"})`}
                    className={
                      isSolved
                        ? "group flex flex-col items-center justify-center rounded-xl border-2 border-black bg-[#2ECC71] py-1.5 px-1 text-black shadow-[0_2px_0_#111111] hover:-translate-y-0.5 transition-transform"
                        : isNextUp
                          ? "group flex flex-col items-center justify-center rounded-xl border-2 border-black bg-[#FFF3B0] py-1.5 px-1 text-black shadow-[0_2px_0_#111111] hover:bg-[#F9D423] hover:-translate-y-0.5 transition-all"
                          : "group flex flex-col items-center justify-center rounded-xl border-2 border-black/75 bg-[#FAFAFA] py-1.5 px-1 text-black hover:border-black hover:bg-[#FFFBE6] hover:-translate-y-0.5 transition-all"
                    }
                  >
                    <span className="flex items-center gap-0.5 font-headline text-xs sm:text-sm font-black leading-none">
                      <span>#{num}</span>
                      {isSolved && (
                        <Check
                          className="h-3 w-3 stroke-[3] text-black hidden min-[420px]:inline"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span className="mt-0.5 hidden md:block max-w-full truncate text-[10px] font-bold text-black/80 px-1">
                      {game.name}
                    </span>
                    <span className="mt-0.5 md:hidden text-[9px] font-black leading-none">
                      {isSolved ? "✓" : "·"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* 9-Game Countdown Grid (#games) */}
        <section id="games" className="w-full max-w-5xl scroll-mt-16">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b-2 border-black pb-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-headline font-black tracking-tight text-black">
                Today&apos;s 21 → 1 Countdown
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {comingSoonGames.length > 0
                  ? `${liveCount} playable daily games live now · ${comingSoonGames.length} new original formats in development`
                  : `All ${liveCount} original SOL Theory daily puzzles in #21 → #1 countdown order`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-headline font-bold">
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-white px-3 py-1 text-black shadow-[0_2px_0_#111111]">
                {todayBannerLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black bg-white px-3 py-1 text-black shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-[#2ECC71]" />{" "}
                {liveCount} Daily Live
              </span>
              {comingSoonGames.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-gray-600">
                  {comingSoonGames.length} Coming Soon
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
            {ALL_GAMES.map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>
        </section>

        {/* Playable 60-Day Archive Section (#archive) */}
        <section
          id="archive"
          className="w-full max-w-5xl mt-14 sm:mt-20 text-center scroll-mt-16"
        >
          <h2 className="text-3xl font-headline font-black mb-2">
            Free From Our 60-Day Archive
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            Missed a day? Jump straight into a recent daily puzzle below or
            browse any game&apos;s full 60-day playable archive.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            {recentArchiveItems.map((item) => (
              <Link
                key={`${item.gameSlug}-${item.dateKey}`}
                href={`/games/${item.gameSlug}?date=${item.dateKey}`}
                onClick={() => playTapSfx()}
                className="group bg-white border-2 border-black rounded-xl p-3.5 sm:p-5 text-center h-full flex flex-col justify-between shadow-[0_3px_0_#111111] transition-all duration-200 hover:shadow-[0_6px_0_#111111] hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-2.5 sm:mb-3">
                    <GameLogo logo={item.logo} variant="mini" />
                    <span
                      style={{ backgroundColor: item.accent }}
                      className="inline-block rounded-full px-2 sm:px-3 py-0.5 text-[10px] sm:text-xs font-black text-black border border-black"
                    >
                      #{item.countdownNumber} {item.gameName}
                    </span>
                  </div>
                  <p className="font-headline font-black text-base sm:text-xl text-black group-hover:underline">
                    {item.day}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 mb-2">
                    {item.date}
                  </p>
                  <p className="text-xs font-bold text-gray-700 line-clamp-2 mb-3">
                    {item.tagline}
                  </p>
                </div>
                <div className="pt-2.5 sm:pt-3 border-t border-gray-100">
                  <p className="text-xs font-headline font-black text-black inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Play Archive Board{" "}
                    <span className="text-[#9D50BB] group-hover:text-black">
                      →
                    </span>
                  </p>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {playableSlugs.map((slug) => {
              const cfg = ALL_GAMES.find((g) => g.slug === slug);
              const num = GAME_COUNTDOWN_NUMBER[slug];
              return (
                <Link
                  key={slug}
                  href={`/games/${slug}/archive`}
                  onClick={() => playTapSfx(0.95)}
                  style={{ backgroundColor: GAME_ACCENT_HEX[slug] }}
                  className="rounded-full border-2 border-black px-4 py-2 text-xs sm:text-sm font-headline font-black text-black shadow-[0_2px_0_#111111] hover:-translate-y-0.5 transition-transform"
                >
                  #{num} {cfg?.name} Archive →
                </Link>
              );
            })}
          </div>
        </section>

        {/* About & Admin Footer (#about) */}
        <footer
          id="about"
          className="w-full max-w-5xl mt-12 sm:mt-20 pt-10 border-t border-gray-200 text-center space-y-4 scroll-mt-16"
        >
          <h3 className="font-headline font-black text-xl">
            About 21 Games by SOL Theory
          </h3>
          <p className="text-sm text-gray-600 max-w-2xl mx-auto">
            Built by the SOL Theory team. Our 9 daily games count down from{" "}
            <strong>#21</strong> to <strong>#1</strong>: gratitude-driven
            curation (<strong>21 Things</strong>), haiku, rhymes, visual logic,
            pictures, compound word chains, math, 3D spatial puzzles, and
            community wins—refreshed automatically every midnight and always
            free to play.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-bold pt-2">
            {playableSlugs.map((slug) => (
              <Link
                key={slug}
                href={`/games/${slug}`}
                className="hover:underline"
              >
                #{GAME_COUNTDOWN_NUMBER[slug]}{" "}
                {ALL_GAMES.find((g) => g.slug === slug)?.name}
              </Link>
            ))}
            <Link
              href="/games/21-things?mode=create"
              className="hover:underline"
            >
              Create Your Own 21 Things
            </Link>
            {hydrated && !authLoading && isGameMaster && (
              <Link
                href="/admin"
                className="underline text-gray-600 hover:text-black"
              >
                Admin Puzzle Studio
              </Link>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}
