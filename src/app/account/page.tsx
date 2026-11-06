"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  ShieldCheck,
  Trophy,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/components/account/auth-provider";
import { AccountNavButton } from "@/components/account/account-nav-button";
import {
  buildLast7DaysStrip,
  computeAverageSolveTime,
  formatSolveTime,
  GuestAuthPanel,
  LoggedInProfileDashboard,
} from "@/components/account/profile-viewer-modal";
import {
  getGameStats,
  getUserCreated21Boards,
  type GameStats,
} from "@/lib/game-storage";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function AccountPage() {
  const { profile, isLoading } = useAuth();

  const [guestC5, setGuestC5] = useState<GameStats>(() =>
    getGameStats("connect-5")
  );
  const [guest21, setGuest21] = useState<GameStats>(() =>
    getGameStats("21-things")
  );
  const [guestCreatedCount, setGuestCreatedCount] = useState<number>(
    () => getUserCreated21Boards().length
  );

  useEffect(() => {
    const syncLocalPreview = () => {
      setGuestC5(getGameStats("connect-5"));
      setGuest21(getGameStats("21-things"));
      setGuestCreatedCount(getUserCreated21Boards().length);
    };
    window.addEventListener("solgames:stats-updated", syncLocalPreview);
    window.addEventListener("solgames:profile-sync", syncLocalPreview);
    window.addEventListener("solgames:auth-changed", syncLocalPreview);
    window.addEventListener("storage", syncLocalPreview);
    return () => {
      window.removeEventListener("solgames:stats-updated", syncLocalPreview);
      window.removeEventListener("solgames:profile-sync", syncLocalPreview);
      window.removeEventListener("solgames:auth-changed", syncLocalPreview);
      window.removeEventListener("storage", syncLocalPreview);
    };
  }, []);

  const c5Strip = buildLast7DaysStrip(guestC5.completedDates);
  const t21Strip = buildLast7DaysStrip(guest21.completedDates);
  const guestC5WinRate =
    guestC5.played > 0 ? Math.round((guestC5.won / guestC5.played) * 100) : 0;
  const guestC5Avg = computeAverageSolveTime(guestC5);

  return (
    <div className="min-h-screen bg-[#FCFCFD] text-black flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b-2 border-black/10 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto max-w-5xl px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-black px-3 py-1.5 text-xs sm:text-sm font-bold text-black hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>All Games</span>
            </Link>

            <div className="hidden sm:flex items-center rounded-full bg-gray-100 p-1 border border-gray-200">
              <Link
                href="/games/21-things"
                className="rounded-full px-3 py-1 text-xs font-bold text-gray-700 hover:text-black transition-all"
              >
                21 Things
              </Link>
              <Link
                href="/games/connect-5"
                className="rounded-full px-3 py-1 text-xs font-bold text-gray-700 hover:text-black transition-all"
              >
                Connect 5
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-center text-center min-w-0">
            <h1 className="font-headline font-black text-base sm:text-xl tracking-tight truncate">
              Account &amp; Profile
            </h1>
            <p className="text-[11px] text-gray-500 hidden xs:block">
              SOL Theory Games · Stats &amp; Streaks
            </p>
          </div>

          <div className="flex items-center gap-2">
            <AccountNavButton variant="compact" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-3 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Editorial Page Banner */}
        <div className="rounded-2xl border-2 border-black bg-white p-5 sm:p-6 shadow-[4px_4px_0px_#000]">
          <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#9D50BB] mb-1.5">
            <UserCheck className="h-4 w-4" />
            SOL Theory Games · Player Hub
          </div>
          <h2 className="font-headline text-2xl sm:text-3xl font-black text-black tracking-tight">
            {profile
              ? `Welcome back, ${profile.displayName}`
              : "Log in or create a free SOL Theory account"}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-2xl">
            {profile
              ? "Your Connect 5 solve times, daily streaks, and 21 Things resonance journeys are automatically synced."
              : "Save your daily streaks, solve times, and custom 21 Things boards across all your devices—free forever."}
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border-2 border-black bg-white p-8 text-center text-sm font-bold text-gray-500">
            Loading your SOL Theory player profile...
          </div>
        ) : profile ? (
          <LoggedInProfileDashboard
            key={profile.id}
            profile={profile}
            isModalView={false}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Auth Forms */}
            <div className="lg:col-span-6 rounded-2xl border-2 border-black bg-white p-5 sm:p-6 shadow-[4px_4px_0px_#000]">
              <GuestAuthPanel initialTab="signin" />
            </div>

            {/* Right Column: On-Device Guest Stats Preview */}
            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-2xl border-2 border-black bg-white p-5 shadow-[4px_4px_0px_#000] space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-[#F9D423]" />
                    <h3 className="font-headline text-base sm:text-lg font-black text-black">
                      On-Device Guest Stats
                    </h3>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-black bg-[#FFFBE6] text-[11px] font-black text-black"
                  >
                    Guest Session
                  </Badge>
                </div>

                <p className="text-xs text-gray-600">
                  These stats are currently stored in this browser. Sign in or
                  create an account to merge and back them up automatically.
                </p>

                {/* Guest Connect 5 Preview */}
                <div className="rounded-xl border-2 border-black/15 bg-gray-50 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-black bg-[#2ECC71] font-headline text-xs font-black text-black">
                        C5
                      </span>
                      <span className="font-headline text-sm font-black text-black">
                        Connect 5
                      </span>
                    </div>
                    <Link
                      href="/games/connect-5"
                      className="inline-flex items-center gap-1 text-xs font-black text-black underline"
                    >
                      Play <Play className="h-3 w-3 fill-current" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-lg bg-white border border-black/10 p-2">
                      <div className="font-headline text-base font-black">
                        {guestC5.played}
                      </div>
                      <div className="text-[10px] font-bold uppercase text-gray-500">
                        Played
                      </div>
                    </div>
                    <div className="rounded-lg bg-white border border-black/10 p-2">
                      <div className="font-headline text-base font-black">
                        {guestC5WinRate}%
                      </div>
                      <div className="text-[10px] font-bold uppercase text-gray-500">
                        Win %
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#FFFBE6] border border-black/10 p-2">
                      <div className="font-headline text-base font-black">
                        {guestC5.currentStreak} 🔥
                      </div>
                      <div className="text-[10px] font-bold uppercase text-gray-600">
                        Streak
                      </div>
                    </div>
                    <div className="rounded-lg bg-white border border-black/10 p-2">
                      <div className="font-mono text-sm font-black">
                        {formatSolveTime(guestC5.bestTimeSeconds ?? guestC5Avg)}
                      </div>
                      <div className="text-[10px] font-bold uppercase text-gray-500">
                        Best
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center pt-1">
                    {c5Strip.map((item) => (
                      <div
                        key={item.dateKey}
                        title={item.shortLabel}
                        className="flex flex-col items-center gap-0.5"
                      >
                        <div
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-black",
                            item.completed
                              ? "border-black bg-[#2ECC71] text-black"
                              : "border-gray-300 bg-white text-gray-300"
                          )}
                        >
                          {item.completed ? "✓" : "·"}
                        </div>
                        <span className="text-[9px] font-bold text-gray-500">
                          {item.dayInitial}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Guest 21 Things Preview */}
                <div className="rounded-xl border-2 border-black/15 bg-gray-50 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-black bg-[#daa8d0] font-headline text-xs font-black text-black">
                        21
                      </span>
                      <span className="font-headline text-sm font-black text-black">
                        21 Things
                      </span>
                    </div>
                    <Link
                      href="/games/21-things"
                      className="inline-flex items-center gap-1 text-xs font-black text-black underline"
                    >
                      Play <Play className="h-3 w-3 fill-current" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-lg bg-white border border-black/10 p-2">
                      <div className="font-headline text-base font-black">
                        {guest21.won}
                      </div>
                      <div className="text-[10px] font-bold uppercase text-gray-500">
                        Done
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#FFFBE6] border border-black/10 p-2">
                      <div className="font-headline text-base font-black">
                        {guest21.currentStreak} 🔥
                      </div>
                      <div className="text-[10px] font-bold uppercase text-gray-600">
                        Streak
                      </div>
                    </div>
                    <div className="rounded-lg bg-white border border-black/10 p-2">
                      <div className="font-headline text-base font-black">
                        {guest21.maxStreak}
                      </div>
                      <div className="text-[10px] font-bold uppercase text-gray-500">
                        Max
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#f7eef5] border border-black/10 p-2">
                      <div className="font-headline text-base font-black">
                        {guestCreatedCount}
                      </div>
                      <div className="text-[10px] font-bold uppercase text-gray-600">
                        Created
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center pt-1">
                    {t21Strip.map((item) => (
                      <div
                        key={item.dateKey}
                        title={item.shortLabel}
                        className="flex flex-col items-center gap-0.5"
                      >
                        <div
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-black",
                            item.completed
                              ? "border-black bg-[#2ECC71] text-black"
                              : "border-gray-300 bg-white text-gray-300"
                          )}
                        >
                          {item.completed ? "✓" : "·"}
                        </div>
                        <span className="text-[9px] font-bold text-gray-500">
                          {item.dayInitial}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-black/10 bg-[#f7eef5]/50 p-3 flex items-start gap-2.5 text-xs text-gray-700">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-[#9D50BB] mt-0.5" />
                  <span>
                    <strong>Zero Progress Lost:</strong> Signing in or creating
                    an account automatically merges your guest completions,
                    fastest times, and created 21 Things boards into your
                    profile.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
