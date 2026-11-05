"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
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
import {
  getAdmin21ThingsOverrides,
  getAdminConnect5Overrides,
  isDateCompleted,
} from "@/lib/game-storage";
import type { PlayableGameSlug } from "@/lib/games-config";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SSR_ANCHOR_DATE = parseDateKeyToLocalNoon("2026-11-05");
const subscribeNoop = () => () => {};

interface GameArchiveViewProps {
  gameSlug: PlayableGameSlug;
}

export function GameArchiveView({ gameSlug }: GameArchiveViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  const entries = useMemo(() => {
    const activeDate = mounted ? new Date() : SSR_ANCHOR_DATE;
    const c5Overrides = mounted ? getAdminConnect5Overrides() : undefined;
    const t21Overrides = mounted ? getAdmin21ThingsOverrides() : undefined;
    return getArchiveEntriesForGame(
      gameSlug,
      60,
      activeDate,
      c5Overrides,
      t21Overrides
    );
  }, [gameSlug, mounted]);

  const gameTitle = gameSlug === "21-things" ? "21 Things" : "Connect 5";
  const accentBg =
    gameSlug === "21-things" ? "bg-[#daa8d0]" : "bg-[#2ECC71]";

  const filtered = entries.filter(
    (entry) =>
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.dateFormatted.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(entry.puzzleNumber).includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-[#FCFCFD] text-black">
      <header className="sticky top-0 z-30 border-b-2 border-black/10 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/games/${gameSlug}`}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-black px-3.5 py-1.5 text-xs sm:text-sm font-bold text-black hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Today&apos;s {gameTitle}
            </Link>
            <Link
              href="/"
              className="text-xs font-bold text-gray-500 hover:text-black hidden sm:inline"
            >
              Home
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/games/21-things/archive"
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold border transition-all",
                gameSlug === "21-things"
                  ? "bg-[#daa8d0] text-black border-black"
                  : "bg-white text-gray-600 border-gray-200 hover:border-black"
              )}
            >
              21 Things Archive
            </Link>
            <Link
              href="/games/connect-5/archive"
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold border transition-all",
                gameSlug === "connect-5"
                  ? "bg-[#2ECC71] text-black border-black"
                  : "bg-white text-gray-600 border-gray-200 hover:border-black"
              )}
            >
              Connect 5 Archive
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
        <div
          className={cn(
            "rounded-2xl border-2 border-black p-6 flex flex-col md:flex-row md:items-center justify-between gap-4",
            accentBg
          )}
        >
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-black text-white px-3 py-1 text-xs font-bold mb-2">
              <Calendar className="h-3.5 w-3.5" />
              60-Day Playable Archive
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
              className="pl-9 border-2 border-black bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((entry, idx) => {
            const completed =
              mounted && isDateCompleted(gameSlug, entry.dateKey);
            const isToday = idx === 0 && searchQuery === "";
            return (
              <Link
                key={entry.dateKey}
                href={`/games/${gameSlug}?date=${entry.dateKey}`}
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
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
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
      </main>
    </div>
  );
}
