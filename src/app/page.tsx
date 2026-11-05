"use client";

import React, { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { GameCard } from "@/components/game-card";
import { Hero } from "@/components/hero";
import { ALL_GAMES } from "@/lib/games-config";
import {
  formatShortArchiveDate,
  get21ThingsBoardForDate,
  getConnect5PuzzleForDate,
  getPastDateKeys,
  parseDateKeyToLocalNoon,
} from "@/lib/daily-engine";
import {
  getAdmin21ThingsOverrides,
  getAdminConnect5Overrides,
} from "@/lib/game-storage";
import "@/components/hero.css";

const SSR_ANCHOR_DATE = parseDateKeyToLocalNoon("2026-11-05");
const subscribeNoop = () => () => {};

export default function Home() {
  const leftGame = ALL_GAMES.find((g) => g.slug === "9-rhymes")!;
  const centerGame = ALL_GAMES.find((g) => g.slug === "21-things")!;
  const rightGame = ALL_GAMES.find((g) => g.slug === "connect-5")!;

  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  // Compute past 4 days dynamically on client without hydration mismatch
  const recentArchiveItems = useMemo(() => {
    const activeDate = mounted ? new Date() : SSR_ANCHOR_DATE;
    const c5Overrides = mounted ? getAdminConnect5Overrides() : undefined;
    const t21Overrides = mounted ? getAdmin21ThingsOverrides() : undefined;
    const keys = getPastDateKeys(5, activeDate).slice(1, 5); // Past 4 days before today
    return keys.map((dateKey, idx) => {
      const { dayName, dateFormatted } = formatShortArchiveDate(dateKey);
      const isConnect5 = idx % 2 === 1;
      if (isConnect5) {
        const p = getConnect5PuzzleForDate(dateKey, c5Overrides);
        return {
          dateKey,
          day: dayName,
          date: dateFormatted,
          gameName: "Connect 5",
          gameSlug: "connect-5" as const,
          subtitle: `${p.title} (#${p.puzzleNumber})`,
          author: p.author,
          editor: p.editor,
          badgeBg: "bg-[#2ECC71]",
        };
      } else {
        const b = get21ThingsBoardForDate(dateKey, t21Overrides);
        return {
          dateKey,
          day: dayName,
          date: dateFormatted,
          gameName: "21 Things",
          gameSlug: "21-things" as const,
          subtitle: `${b.title} (#${b.puzzleNumber})`,
          author: b.creatorName,
          editor: "Stephen Huff",
          badgeBg: "bg-[#daa8d0]",
        };
      }
    });
  }, [mounted]);

  return (
    <div className="bg-background overflow-x-hidden">
      <Hero />

      {/* Top Purple Featured Banner (#play) */}
      <header
        id="play"
        className="bg-[#b3a8ff] py-12 lg:py-24 px-4 scroll-mt-4"
      >
        <div className="mx-auto max-w-7xl flex flex-col lg:flex-row justify-center items-stretch gap-6">
          <div className="w-full max-w-sm lg:w-1/3 mx-auto">
            <GameCard
              game={leftGame}
              variant="featured"
              author="Lucas Huff"
            />
          </div>
          <div className="w-full max-w-sm lg:w-1/2 mx-auto">
            <GameCard
              game={centerGame}
              variant="featured"
              author="Lucas Huff"
              isCenter
            />
          </div>
          <div className="w-full max-w-sm lg:w-1/3 mx-auto">
            <GameCard
              game={rightGame}
              variant="featured"
              author="Stephen Huff"
            />
          </div>
        </div>
      </header>

      <main className="flex flex-col items-center mt-16 px-4 md:px-8 pb-16">
        {/* 9-Game Grid (#games) */}
        <div id="games" className="w-full max-w-5xl scroll-mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {ALL_GAMES.map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>
        </div>

        {/* Dynamic Playable Archive Section (#archive) */}
        <section
          id="archive"
          className="w-full max-w-5xl mt-24 text-center scroll-mt-6"
        >
          <h2 className="text-3xl font-headline font-black mb-2">
            Free From Our Archive
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            Click any recent daily puzzle below to jump straight in, or browse
            the full 60-day archives.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {recentArchiveItems.map((item) => (
              <Link
                key={`${item.gameSlug}-${item.dateKey}`}
                href={`/games/${item.gameSlug}?date=${item.dateKey}`}
                className="group bg-white border-2 border-gray-200 hover:border-black rounded-xl p-5 text-center h-full flex flex-col justify-between transition-all hover:shadow-md hover:-translate-y-0.5"
              >
                <div>
                  <span
                    className={`inline-block rounded-full px-3 py-0.5 text-xs font-black text-black border border-black mb-3 ${item.badgeBg}`}
                  >
                    {item.gameName}
                  </span>
                  <p className="font-headline font-black text-xl text-black group-hover:underline">
                    {item.day}
                  </p>
                  <p className="text-sm text-gray-500 mb-2">{item.date}</p>
                  <p className="text-xs font-bold text-gray-800 line-clamp-1 mb-4">
                    {item.subtitle}
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 uppercase">
                    by {item.author}
                  </p>
                  <p className="text-xs text-gray-500 uppercase">
                    Edited by {item.editor}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/games/21-things/archive"
              className="rounded-full border-2 border-black bg-[#daa8d0] px-5 py-2 text-xs sm:text-sm font-headline font-black text-black hover:opacity-90 transition-opacity"
            >
              21 Things Full Archive →
            </Link>
            <Link
              href="/games/connect-5/archive"
              className="rounded-full border-2 border-black bg-[#2ECC71] px-5 py-2 text-xs sm:text-sm font-headline font-black text-black hover:opacity-90 transition-opacity"
            >
              Connect 5 Full Archive →
            </Link>
          </div>
        </section>

        {/* About & Admin Footer (#about) */}
        <footer
          id="about"
          className="w-full max-w-5xl mt-20 pt-10 border-t border-gray-200 text-center space-y-4 scroll-mt-6"
        >
          <h3 className="font-headline font-black text-xl">
            About 21 Games by SOL Theory
          </h3>
          <p className="text-sm text-gray-600 max-w-2xl mx-auto">
            Built by Lucas Huff, Stephen Huff, and the SOL Theory team. Our
            daily games combine gratitude-driven social curation (
            <strong>21 Things</strong>) and crisp word-chain deduction (
            <strong>Connect 5</strong>)—refreshed automatically every midnight
            and always free to play.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-bold pt-2">
            <Link href="/games/21-things" className="hover:underline">
              Play 21 Things
            </Link>
            <Link href="/games/connect-5" className="hover:underline">
              Play Connect 5
            </Link>
            <Link
              href="/games/21-things?mode=create"
              className="hover:underline"
            >
              Create Your Own 21 Things
            </Link>
            <Link href="/admin" className="underline text-gray-600 hover:text-black">
              Admin Puzzle Studio
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
