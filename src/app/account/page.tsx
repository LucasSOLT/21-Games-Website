"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Trophy,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/components/account/auth-provider";
import { AccountNavButton } from "@/components/account/account-nav-button";
import {
  GuestAuthPanel,
  LoggedInProfileDashboard,
} from "@/components/account/profile-viewer-modal";
import { UnifiedNineGameStats } from "@/components/account/unified-nine-game-stats";
import { SolGamesLogo } from "@/components/solgames-logo";
import { getUserCreated21Boards } from "@/lib/game-storage";
import { getMyCreatedCustomPuzzles } from "@/lib/custom-puzzles";
import { ALL_GAMES, GAME_COUNTDOWN_NUMBER } from "@/lib/games-config";
import { Badge } from "@/components/ui/badge";

function countLocalGuestCreated(): number {
  const ids = new Set<string>([
    ...getUserCreated21Boards().map((b) => b.id),
    ...getMyCreatedCustomPuzzles().map((p) => p.id),
  ]);
  return ids.size;
}

export default function AccountPage() {
  const { profile, isLoading } = useAuth();

  const [guestCreatedCount, setGuestCreatedCount] = useState<number>(() =>
    countLocalGuestCreated()
  );

  useEffect(() => {
    const syncLocalPreview = () => {
      setGuestCreatedCount(countLocalGuestCreated());
    };
    window.addEventListener("solgames:stats-updated", syncLocalPreview);
    window.addEventListener("solgames:profile-sync", syncLocalPreview);
    window.addEventListener("solgames:auth-changed", syncLocalPreview);
    window.addEventListener("solgames:custom-puzzle-created", syncLocalPreview);
    window.addEventListener("storage", syncLocalPreview);
    return () => {
      window.removeEventListener("solgames:stats-updated", syncLocalPreview);
      window.removeEventListener("solgames:profile-sync", syncLocalPreview);
      window.removeEventListener("solgames:auth-changed", syncLocalPreview);
      window.removeEventListener("solgames:custom-puzzle-created", syncLocalPreview);
      window.removeEventListener("storage", syncLocalPreview);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#FCFCFD] text-black flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b-2 border-black/10 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto max-w-5xl px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/" aria-label="21 Games Home" className="shrink-0">
              <SolGamesLogo variant="mark" size={32} />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-black px-3 py-1.5 text-xs sm:text-sm font-bold text-black hover:bg-gray-100 transition-colors shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>All 9 Games</span>
            </Link>

            <div className="hidden lg:flex items-center rounded-full bg-gray-100 p-1 border border-gray-200 gap-0.5">
              {ALL_GAMES.map((g) => (
                <Link
                  key={g.slug}
                  href={`/games/${g.slug}`}
                  title={g.name}
                  className="rounded-full px-2 py-0.5 text-[11px] font-bold text-gray-700 hover:bg-white hover:text-black transition-all"
                >
                  #{GAME_COUNTDOWN_NUMBER[g.slug as keyof typeof GAME_COUNTDOWN_NUMBER]}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center text-center min-w-0">
            <h1 className="font-headline font-black text-base sm:text-xl tracking-tight truncate">
              Account &amp; Profile
            </h1>
            <p className="text-[11px] text-gray-500 hidden xs:block">
              21 Games · Countdown 21 → 1 Stats &amp; Streaks
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <AccountNavButton variant="compact" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-3 sm:px-6 py-6 sm:py-10 space-y-6">
        <div className="rounded-2xl border-2 border-black bg-white p-5 sm:p-6 shadow-[4px_4px_0px_#000]">
          <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#9D50BB] mb-1.5">
            <UserCheck className="h-4 w-4" />
            21 Games by SOL Theory · Unified 9-Game Player Hub
          </div>
          <h2 className="font-headline text-2xl sm:text-3xl font-black text-black tracking-tight">
            {profile
              ? `Welcome back, ${profile.displayName}`
              : "Log in or create a free 21 Games account"}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-2xl">
            {profile
              ? "Your daily streaks, 60-day archive checkmarks, personal 1 Win journal, and custom puzzles across all 9 countdown games (21 → 1) are automatically synced."
              : "Save your daily streaks, 60-day archive checkmarks, personal 1 Win journal, and custom puzzles across all 9 countdown games (21 → 1)—free forever."}
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border-2 border-black bg-white p-8 text-center text-sm font-bold text-gray-500">
            Loading your 21 Games player profile...
          </div>
        ) : profile ? (
          <LoggedInProfileDashboard
            key={profile.id}
            profile={profile}
            isModalView={false}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 rounded-2xl border-2 border-black bg-white p-5 sm:p-6 shadow-[4px_4px_0px_#000]">
              <GuestAuthPanel initialTab="signin" />
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-2xl border-2 border-black bg-white p-5 shadow-[4px_4px_0px_#000] space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-[#F9D423]" />
                    <h3 className="font-headline text-base sm:text-lg font-black text-black">
                      On-Device 9-Game Guest Stats
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
                  These stats across all 9 countdown games (21 → 1) are stored
                  in this browser. Sign in or create an account to merge and
                  back them up automatically across devices.
                </p>

                <UnifiedNineGameStats
                  boardsCreatedCount={guestCreatedCount}
                  compact
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
