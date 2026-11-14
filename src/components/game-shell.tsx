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
import {
  GAME_ACCENT_HEX,
  type PlayableGameSlug,
} from "@/lib/games-config";
import { getGameHelp } from "@/lib/game-help";
import { AccountNavButton } from "@/components/account/account-nav-button";
import { useAuth } from "@/components/account/auth-provider";
import { getAvatarTextClass } from "@/components/account/profile-viewer-modal";
import { getInitials } from "@/lib/user-auth";
import { cn } from "@/lib/utils";
import { SolGamesLogo } from "@/components/solgames-logo";

interface GameShellProps {
  gameSlug: PlayableGameSlug;
  gameTitle: string;
  puzzleNumber: number;
  dateKey: string;
  author: string;
  subtitle?: string;
  headerRightSlot?: React.ReactNode;
  children: React.ReactNode;
  unifiedHeader?: boolean;
  helpOpen?: boolean;
  onHelpOpenChange?: (open: boolean) => void;
  statsOpen?: boolean;
  onStatsOpenChange?: (open: boolean) => void;
}

function renderBold(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

function GenericHelpBody({ slug }: { slug: PlayableGameSlug }) {
  const help = getGameHelp(slug);
  return (
    <div className="space-y-3 text-sm text-gray-700">
      <div
        className="rounded-xl p-3 border border-black/20"
        style={{ backgroundColor: `${GAME_ACCENT_HEX[slug]}33` }}
      >
        <p className="font-bold text-black mb-1">{help.headline}</p>
        <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm">
          {help.rules.map((rule) => (
            <li key={rule}>{renderBold(rule)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
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
  unifiedHeader = false,
  helpOpen: controlledHelpOpen,
  onHelpOpenChange,
  statsOpen: controlledStatsOpen,
  onStatsOpenChange,
}: GameShellProps) {
  const [internalHelpOpen, setInternalHelpOpen] = useState(false);
  const [internalStatsOpen, setInternalStatsOpen] = useState(false);

  const helpOpen = controlledHelpOpen !== undefined ? controlledHelpOpen : internalHelpOpen;
  const setHelpOpen = onHelpOpenChange ?? setInternalHelpOpen;

  const statsOpen = controlledStatsOpen !== undefined ? controlledStatsOpen : internalStatsOpen;
  const setStatsOpen = onStatsOpenChange ?? setInternalStatsOpen;

  const { profile, openAccountModal } = useAuth();

  const stats = getGameStats(gameSlug);
  const winRate =
    stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#FCFCFD] text-black flex flex-col">
      {/* Top Game Navigation Bar */}
      <header className="sticky top-0 z-30 border-b-2 border-black/10 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto max-w-6xl px-1.5 min-[375px]:px-2.5 sm:px-6 h-12 sm:h-16 flex items-center justify-between gap-1 sm:gap-3">
          {/* Left: Brand Mark + Back Home */}
          <div className="flex items-center gap-1 sm:gap-3 shrink-0 sm:flex-1 min-w-0">
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

            <Link
              href="/"
              className="inline-flex h-7 w-7 min-[375px]:h-8 min-[375px]:w-8 sm:h-auto sm:w-auto items-center justify-center gap-1.5 rounded-full border-2 border-black sm:px-3 sm:py-1.5 text-xs sm:text-sm font-bold text-black hover:bg-gray-100 transition-colors shrink-0"
              title="All Games"
              aria-label="All Games"
            >
              <ArrowLeft className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4" />
              <span className="hidden sm:inline">All Games</span>
            </Link>
          </div>

          {/* Center: Title + Puzzle # + Date (truncates cleanly with ellipsis on narrow mobile) */}
          <div className="flex flex-col items-center justify-center text-center flex-1 min-w-0 overflow-hidden px-0.5 sm:px-2">
            <div className="flex items-center justify-center gap-1 sm:gap-2 max-w-full min-w-0">
              <h1
                data-testid="game-shell-title"
                title={gameTitle}
                className="font-headline font-black text-xs min-[375px]:text-sm sm:text-2xl tracking-tight truncate min-w-0"
              >
                {gameTitle}
              </h1>
              {puzzleNumber > 0 && (
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] sm:text-xs px-1 sm:px-2 py-0 sm:py-0.5 shrink-0"
                >
                  #{puzzleNumber}
                </Badge>
              )}
            </div>
            <p className="hidden sm:block text-[11px] sm:text-xs text-gray-500 truncate max-w-full">
              {formatLongDate(dateKey)} · By {author}
            </p>
          </div>

          {/* Right: Action Slot + Archive / Stats / Help / Account */}
          <div className="flex items-center justify-end gap-1 sm:gap-2 shrink-0 sm:flex-1 min-w-0">
            {headerRightSlot && (
              <div className={cn("items-center shrink-0", unifiedHeader ? "flex" : "hidden sm:flex")}>
                {headerRightSlot}
              </div>
            )}

            {!unifiedHeader && (
              <>
                <Link
                  href={`/games/${gameSlug}/archive`}
                  className="inline-flex h-7 w-7 min-[375px]:h-8 min-[375px]:w-8 sm:h-9 sm:w-auto sm:px-3 items-center justify-center gap-1.5 rounded-lg border-2 border-gray-300 bg-white text-xs font-bold text-black hover:border-black transition-colors shrink-0"
                  title="Playable Archive"
                  aria-label="Playable Archive"
                >
                  <Calendar className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4" />
                  <span className="hidden lg:inline">Archive</span>
                </Link>

                <button
                  type="button"
                  onClick={() => setStatsOpen(true)}
                  className="inline-flex h-7 w-7 min-[375px]:h-8 min-[375px]:w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border-2 border-gray-300 bg-white text-black hover:border-black transition-colors shrink-0"
                  title="Your Stats & Streak"
                  aria-label="Stats"
                >
                  <BarChart3 className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className="inline-flex h-7 w-7 min-[375px]:h-8 min-[375px]:w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border-2 border-gray-300 bg-white text-black hover:border-black transition-colors shrink-0"
                  title="How to Play"
                  aria-label="How to Play"
                >
                  <HelpCircle className="h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4" />
                </button>

                <AccountNavButton variant="compact" />
              </>
            )}
          </div>
        </div>

        {/* Mobile Action Sub-Bar (< 640px only when headerRightSlot is used without unifiedHeader) */}
        {/* Tier 2 Mobile Bar: shown only when headerRightSlot is provided (game-switcher pills removed) */}
        {!unifiedHeader && headerRightSlot && (
          <div className="sm:hidden px-2 min-[375px]:px-3 py-1.5 bg-gray-50/95 border-t border-black/10 flex items-center justify-between gap-2">
            <span className="text-[11px] text-gray-500 font-medium truncate">
              By {author}
            </span>
            <div className="flex items-center shrink-0">{headerRightSlot}</div>
          </div>
        )}

        {subtitle && (
          <div className="hidden sm:block bg-gray-50 border-t border-gray-200/80 py-1.5 px-4 text-center text-xs text-gray-600 font-medium">
            {subtitle}
          </div>
        )}
      </header>

      {/* Main Game Content */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-2 min-[375px]:px-2.5 sm:px-6 py-2.5 sm:py-6">
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
              {getGameHelp(gameSlug).summary}
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
          ) : gameSlug === "17-syllables" ? (
            <div className="space-y-3 text-sm text-gray-700">
              <div className="rounded-xl bg-purple-50/70 p-3 border border-purple-200">
                <p className="font-bold text-black mb-1">
                  Solve the Daily 5-7-5 Haiku
                </p>
                <p className="text-xs sm:text-sm">
                  Assemble the syllable chunks from your tray into the 3 lines of the haiku:
                  Line 1 (5 syllables), Line 2 (7 syllables), and Line 3 (5 syllables).
                </p>
              </div>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm">
                <li>
                  <strong>Placing Chunks:</strong> Tap a syllable chunk in the tray, then tap an open slot in the poem. Or tap an open slot directly to place the active chunk.
                </li>
                <li>
                  <strong>Focus &amp; Return:</strong> Tap a character square to focus it. Tapping the same filled slot a second time returns the chunk to the tray.
                </li>
                <li>
                  <strong>Check &amp; Reveal (Lifesaver):</strong> Tap the Lifesaver icon to Check Square, Check Word, or Check Puzzle. Incorrect letters are marked with a diagonal red slash.
                </li>
                <li>
                  <strong>Hints:</strong> Tap the Lightbulb icon to get a Word Hint or lock a chunk in place.
                </li>
              </ul>
            </div>
          ) : gameSlug === "move-2" ? (
            <div
              className="space-y-3 text-sm text-gray-700"
              data-testid="move-two-help-guide"
            >
              <div className="rounded-xl bg-[#FAF9F5] p-3 border border-neutral-300 space-y-1.5 text-xs sm:text-sm">
                <p className="font-bold text-black">
                  Roll Upright Into the 1×1 Green Hole
                </p>
                <p>
                  Choose <strong>Easy (6×6)</strong>, <strong>Medium (8×8)</strong>, or{" "}
                  <strong>Hard (10×10)</strong> — solving <strong>any</strong> board
                  counts toward your daily streak. Roll your 3D{" "}
                  <strong>2×1 gold block</strong> with{" "}
                  <strong>Arrow keys / WASD</strong>, swipes, or the <strong>D-Pad</strong>{" "}
                  without tipping off an open edge!
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                  Tiles, Obstacles &amp; Switches
                </p>
                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  <div className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5">
                    <span className="h-5 w-5 shrink-0 rounded-[4px] border-2 border-black bg-white shadow-[0_2px_0_#CFCBC0]" />
                    <div>
                      <strong className="text-black">Stone Tile:</strong> Safe island
                      floor. Stepping off an open edge drops you into the void.
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5">
                    <span className="h-5 w-5 shrink-0 rounded-[4px] border-2 border-black bg-[#FEF9C3] flex items-center justify-center">
                      <span className="h-2.5 w-2.5 border border-[#CA8A04] bg-[#F7DA21]" />
                    </span>
                    <div>
                      <strong className="text-black">Start Tile:</strong> Where your
                      2×1 block begins (and respawns after a fall).
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1.5">
                    <span className="h-5 w-5 shrink-0 rounded-[4px] border-2 border-black bg-[#EF4444] flex items-center justify-center">
                      <span className="h-2.5 w-2.5 border border-[#7F1D1D] bg-[#B91C1C]" />
                    </span>
                    <div>
                      <strong className="text-red-900">Red Obstacle:</strong>{" "}
                      <strong>Avoid completely!</strong> Touching a Red Obstacle{" "}
                      <em>at all</em> (standing or flat) sends you back to Start.
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5">
                    <span className="h-5 w-5 shrink-0 rounded-[4px] border-2 border-black bg-[#E0F2FE] flex items-center justify-center">
                      <span className="h-2.5 w-2.5 rounded-full border border-black bg-[#2563EB]" />
                    </span>
                    <div>
                      <strong className="text-black">Circle Switch (○):</strong>{" "}
                      Activates its linked blue bridge on <strong>any touch</strong>{" "}
                      (standing or lying flat).
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5">
                    <span className="h-5 w-5 shrink-0 rounded-[4px] border-2 border-black bg-[#EDE9FE] flex items-center justify-center font-mono text-[11px] font-black text-[#6D28D9]">
                      ✕
                    </span>
                    <div>
                      <strong className="text-black">Heavy X Switch (✕):</strong>{" "}
                      Activates its linked blue bridge{" "}
                      <strong>only when standing upright (1×1)</strong> directly on it.
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5">
                    <span className="h-5 w-5 shrink-0 rounded-[4px] border-2 border-black bg-[#DBEAFE] shadow-[0_2px_0_#60A5FA]" />
                    <div>
                      <strong className="text-black">Blue Bridge:</strong> Retractable
                      bridge across chasms (dashed outline when closed, solid blue when
                      open).
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 px-2.5 py-1.5">
                    <span className="h-5 w-5 shrink-0 rounded-[4px] border-2 border-black bg-[#2ECC71] flex items-center justify-center">
                      <span className="h-2.5 w-2.5 bg-[#052E16]" />
                    </span>
                    <div>
                      <strong className="text-emerald-950">Green Square Hole:</strong>{" "}
                      <strong>The Goal!</strong> Stand <strong>upright (1×1)</strong>{" "}
                      directly over it to drop in and win.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : gameSlug !== "connect-5" ? (
            <GenericHelpBody slug={gameSlug} />
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

          {/* NYT Games-Style Account Sync Card */}
          {!profile ? (
            <div className="rounded-xl border-2 border-black bg-[#FFFBE6] p-3.5 space-y-2.5">
              <div>
                <p className="font-headline font-black text-sm text-black">
                  Save your stats &amp; streaks across devices
                </p>
                <p className="text-xs text-gray-700 mt-0.5">
                  Log in or create a free SOL Theory account to back up your
                  daily streaks and puzzle history.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setStatsOpen(false);
                    openAccountModal("signin");
                  }}
                  className="flex-1 border-2 border-black bg-white font-bold text-xs h-9"
                >
                  Log In
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setStatsOpen(false);
                    openAccountModal("signup");
                  }}
                  className="flex-1 bg-black text-white hover:bg-gray-800 font-bold text-xs h-9"
                >
                  Create Account
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-black bg-gray-50 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  style={{ backgroundColor: profile.avatarColor }}
                  className={cn(
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-black font-headline text-xs font-black",
                    getAvatarTextClass(profile.avatarColor)
                  )}
                >
                  {getInitials(profile.displayName, profile.email)}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-black truncate">
                    Stats synced to {profile.displayName} (@
                    {profile.handle.replace(/^@+/, "")})
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    Backed up to your SOL Theory profile
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStatsOpen(false);
                  openAccountModal("profile");
                }}
                className="shrink-0 text-xs font-black text-black underline hover:text-gray-700"
              >
                View Full Profile →
              </button>
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
