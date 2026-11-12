"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
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
import { getUserCreated21Boards } from "@/lib/game-storage";
import { Badge } from "@/components/ui/badge";

export default function AccountPage() {
  const { profile, isLoading } = useAuth();

  const [guestCreatedCount, setGuestCreatedCount] = useState<number>(
    () => getUserCreated21Boards().length
  );

  useEffect(() => {
    const syncLocalPreview = () => {
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
              <span>All 9 Games</span>
            </Link>

            <div className="hidden md:flex items-center rounded-full bg-gray-100 p-1 border border-gray-200">
              <Link
                href="/games/21-things"
                className="rounded-full px-2.5 py-1 text-xs font-bold text-gray-700 hover:text-black transition-all"
              >
                #21 Things
              </Link>
              <Link
                href="/games/9-rhymes"
                className="rounded-full px-2.5 py-1 text-xs font-bold text-gray-700 hover:text-black transition-all"
              >
                #9 Rhymes
              </Link>
              <Link
                href="/games/connect-5"
                className="rounded-full px-2.5 py-1 text-xs font-bold text-gray-700 hover:text-black transition-all"
              >
                #5 Connect
              </Link>
              <Link
                href="/games/1-win"
                className="rounded-full px-2.5 py-1 text-xs font-bold text-gray-700 hover:text-black transition-all"
              >
                #1 Win
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-center text-center min-w-0">
            <h1 className="font-headline font-black text-base sm:text-xl tracking-tight truncate">
              Account &amp; Profile
            </h1>
            <p className="text-[11px] text-gray-500 hidden xs:block">
              SOL Theory Games · Countdown 21 → 1 Stats &amp; Streaks
            </p>
          </div>

          <div className="flex items-center gap-2">
            <AccountNavButton variant="compact" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-3 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Editorial Page Banner */}
        <div className="rounded-2xl border-2 border-black bg-white p-5 sm:p-6 shadow-[4px_4px_0px_#000]">
          <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#9D50BB] mb-1.5">
            <UserCheck className="h-4 w-4" />
            SOL Theory Games · Unified 9-Game Player Hub
          </div>
          <h2 className="font-headline text-2xl sm:text-3xl font-black text-black tracking-tight">
            {profile
              ? `Welcome back, ${profile.displayName}`
              : "Log in or create a free SOL Theory account"}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-2xl">
            {profile
              ? "Your daily streaks, signature scores, personal 1 Win journal, and custom boards across all 9 countdown games (21 → 1) are automatically synced."
              : "Save your daily streaks, scores, personal 1 Win journal, and custom boards across all 9 countdown games (21 → 1)—free forever."}
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
            <div className="lg:col-span-5 rounded-2xl border-2 border-black bg-white p-5 sm:p-6 shadow-[4px_4px_0px_#000]">
              <GuestAuthPanel initialTab="signin" />
            </div>

            {/* Right Column: On-Device Guest Stats Preview across all 9 Countdown Games */}
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
                  back them up automatically.
                </p>

                <UnifiedNineGameStats
                  boardsCreatedCount={guestCreatedCount}
                  compact={true}
                />

                <div className="rounded-xl border border-black/10 bg-[#f7eef5]/50 p-3 flex items-start gap-2.5 text-xs text-gray-700">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-[#9D50BB] mt-0.5" />
                  <span>
                    <strong>Zero Progress Lost:</strong> Signing in or creating
                    an account automatically merges your guest completions,
                    streaks, best times, and created boards across all 9 games
                    into your cloud profile.
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
