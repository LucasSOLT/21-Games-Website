"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  HelpCircle,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatLongDate } from "@/lib/daily-engine";
import { getGameStats } from "@/lib/game-storage";
import type { PlayableGameSlug } from "@/lib/games-config";
import { cn } from "@/lib/utils";

interface GameShellProps {
  gameSlug: PlayableGameSlug;
  gameTitle: string;
  puzzleNumber: number;
  dateKey: string;
  author: string;
  subtitle?: string;
  headerRightSlot?: React.ReactNode;
  children: React.ReactNode;
}

export function formatTimerSeconds(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function GameShell({
  gameSlug,
  gameTitle,
  puzzleNumber,
  dateKey,
  author,
  subtitle,
  headerRightSlot,
  children,
}: GameShellProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const stats = getGameStats(gameSlug);
  const winRate =
    stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#FCFCFD] text-black flex flex-col">
      {/* Top Game Navigation Bar */}
      <header className="sticky top-0 z-30 border-b-2 border-black/10 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto max-w-6xl px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          {/* Left: Back Home + Game Switcher */}
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-black px-3 py-1.5 text-xs sm:text-sm font-bold text-black hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden xs:inline">All Games</span>
            </Link>

            <div className="hidden md:flex items-center rounded-full bg-gray-100 p-1 border border-gray-200">
              <Link
                href="/games/21-things"
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-bold transition-all",
                  gameSlug === "21-things"
                    ? "bg-[#daa8d0] text-black border border-black shadow-2xs"
                    : "text-gray-600 hover:text-black"
                )}
              >
                21 Things
              </Link>
              <Link
                href="/games/connect-5"
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-bold transition-all",
                  gameSlug === "connect-5"
                    ? "bg-[#2ECC71] text-black border border-black shadow-2xs"
                    : "text-gray-600 hover:text-black"
                )}
              >
                Connect 5
              </Link>
            </div>
          </div>

          {/* Center: Title + Puzzle # + Date */}
          <div className="flex flex-col items-center text-center min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-headline font-black text-lg sm:text-2xl tracking-tight truncate">
                {gameTitle}
              </h1>
              {puzzleNumber > 0 && (
                <Badge variant="outline" className="font-mono text-xs">
                  #{puzzleNumber}
                </Badge>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-gray-500 truncate">
              {formatLongDate(dateKey)} · By {author}
            </p>
          </div>

          {/* Right: Timer / Action Slot + Archive / Stats / Help */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {headerRightSlot}

            <Link
              href={`/games/${gameSlug}/archive`}
              className="inline-flex h-9 w-9 sm:w-auto sm:px-3 items-center justify-center gap-1.5 rounded-lg border-2 border-gray-300 bg-white text-xs font-bold text-black hover:border-black transition-colors"
              title="Playable Archive"
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden lg:inline">Archive</span>
            </Link>

            <button
              type="button"
              onClick={() => setStatsOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border-2 border-gray-300 bg-white text-black hover:border-black transition-colors"
              title="Your Stats & Streak"
              aria-label="Stats"
            >
              <BarChart3 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border-2 border-gray-300 bg-white text-black hover:border-black transition-colors"
              title="How to Play"
              aria-label="How to Play"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        {subtitle && (
          <div className="bg-gray-50 border-t border-gray-200/80 py-1.5 px-4 text-center text-xs text-gray-600 font-medium">
            {subtitle}
          </div>
        )}
      </header>

      {/* Main Game Content */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-3 sm:px-6 py-4 sm:py-6">
        {children}
      </main>

      {/* How to Play Modal */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#9D50BB]" />
              How to Play {gameTitle}
            </DialogTitle>
            <DialogDescription>
              {gameSlug === "21-things"
                ? "A gratitude-driven social curation game built around a 21 → 6 → 3 → 1 narrowing funnel."
                : "A 5-row compound word-chain puzzle inspired by daily crosswords."}
            </DialogDescription>
          </DialogHeader>

          {gameSlug === "21-things" ? (
            <div className="space-y-3 text-sm text-gray-700">
              <div className="rounded-xl bg-[#f7eef5] p-3 border border-[#daa8d0]">
                <p className="font-bold text-black mb-1">
                  The 21 → 6 → 3 → 1 Funnel (All on One 3×7 Grid)
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm">
                  <li>
                    <strong>Phase 1 (Pick 6):</strong> Tap your{" "}
                    <strong>top 6 favorites</strong> from the 21 lavender tiles.
                    Selected tiles highlight in{" "}
                    <span className="inline-block rounded px-1.5 py-0.5 bg-[#F9D423] font-bold text-black">
                      Yellow
                    </span>
                    . Tap again to deselect.
                  </li>
                  <li>
                    <strong>Phase 2 (Pick 3):</strong> Unselected tiles dim into
                    the background for context. From your 6 yellow favorites,
                    choose your <strong>top 3</strong>.
                  </li>
                  <li>
                    <strong>Phase 3 (Pick 1):</strong> From your final 3, lock
                    in the <strong>single #1 item</strong> that resonates with
                    you most.
                  </li>
                  <li>
                    <strong>The Payoff (Reflection):</strong> Record a quick
                    voice note or write a short reflection on why your #1 item
                    resonated, then view the Creator Feedback Feed of everyone&apos;s
                    6 → 3 → 1 journey!
                  </li>
                </ol>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 border border-gray-200 text-xs sm:text-sm">
                <p className="font-bold text-black mb-1">
                  Create &amp; Share Your Own 21 Things
                </p>
                <p>
                  Switch to <strong>Create &amp; Share</strong> mode to tap the
                  microphone, speak a stream of consciousness, and let our smart
                  parser split your voice into 21 concise tiles (max 5 words /
                  ~30 chars each) with a shareable link for friends.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-gray-700">
              <div className="rounded-xl bg-emerald-50/70 p-3 border border-emerald-300">
                <p className="font-bold text-black mb-1">
                  Connect All 5 Words in the Chain
                </p>
                <p className="text-xs sm:text-sm mb-2">
                  Each row&apos;s word connects with the word directly above it to
                  form a compound word or familiar phrase:
                </p>
                <div className="font-mono text-xs bg-white rounded-lg p-2.5 border border-emerald-200 space-y-1">
                  <div>1. MOUSE (Shown)</div>
                  <div>2. PAD → (Mouse pad)</div>
                  <div>3. LOCK → (Padlock)</div>
                  <div>4. DOWN → (Lockdown)</div>
                  <div>5. WIND → (Downwind)</div>
                </div>
              </div>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm">
                <li>
                  <strong>Typing &amp; Focus:</strong> Typing starts at Row 2&apos;s
                  first open box and automatically advances to the next row when
                  a word is filled.
                </li>
                <li>
                  <strong>Smart Backspace:</strong> Click a specific letter box
                  to delete from that spot leftward, or backspace from the
                  rightmost filled letter. Emptying a row jumps up to the row
                  above (Row 1 and pre-revealed hint letters are locked).
                </li>
                <li>
                  <strong>Instant Check &amp; Slashes (/):</strong> Filling the
                  final box checks your board automatically. If any letters are
                  off, you&apos;ll see <em>&quot;Not quite&quot;</em> and diagonal slashes (
                  <code className="font-bold text-red-600">/</code>) on wrong
                  letters—just click or navigate to any slashed box and type a
                  new letter to overwrite it directly!
                </li>
              </ul>
            </div>
          )}

          <div className="mt-2 flex justify-end">
            <Button onClick={() => setHelpOpen(false)} className="font-bold">
              Got It, Let&apos;s Play
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats Modal */}
      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#F9D423]" />
              {gameTitle} Statistics
            </DialogTitle>
            <DialogDescription>
              Your daily streak and completion history on this device.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-4 gap-3 my-2 text-center">
            <div className="rounded-xl border-2 border-black/10 bg-gray-50 p-3">
              <div className="font-headline text-2xl font-black">
                {stats.played}
              </div>
              <div className="text-[11px] text-gray-500 font-semibold uppercase">
                Played
              </div>
            </div>
            <div className="rounded-xl border-2 border-black/10 bg-gray-50 p-3">
              <div className="font-headline text-2xl font-black">
                {winRate}%
              </div>
              <div className="text-[11px] text-gray-500 font-semibold uppercase">
                Completed
              </div>
            </div>
            <div className="rounded-xl border-2 border-black/10 bg-gray-50 p-3">
              <div className="font-headline text-2xl font-black">
                {stats.currentStreak}
              </div>
              <div className="text-[11px] text-gray-500 font-semibold uppercase">
                Streak
              </div>
            </div>
            <div className="rounded-xl border-2 border-black/10 bg-gray-50 p-3">
              <div className="font-headline text-2xl font-black">
                {stats.maxStreak}
              </div>
              <div className="text-[11px] text-gray-500 font-semibold uppercase">
                Max Streak
              </div>
            </div>
          </div>

          {gameSlug === "connect-5" && stats.bestTimeSeconds !== null && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center text-sm">
              Fastest Solve:{" "}
              <strong className="font-mono">
                {formatTimerSeconds(stats.bestTimeSeconds)}
              </strong>
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <Link
              href={`/games/${gameSlug}/archive`}
              onClick={() => setStatsOpen(false)}
              className="text-xs font-bold underline text-gray-600 hover:text-black"
            >
              Browse Playable Archive →
            </Link>
            <Button onClick={() => setStatsOpen(false)} className="font-bold">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
