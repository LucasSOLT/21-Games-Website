"use client";

import React, { useEffect, useState } from "react";
import { Flame, User } from "lucide-react";
import { useAuth } from "@/components/account/auth-provider";
import { getLocalDateKey } from "@/lib/date-keys";
import { ALL_GAME_SLUGS } from "@/lib/games-config";
import { getAllLocalGameStats, mergeAllGameStatsMaps } from "@/lib/game-storage";
import { getInitials } from "@/lib/user-auth";
import { cn } from "@/lib/utils";

function resolveAvatarTextClass(bg: string): string {
  return bg === "#111111" || bg === "#9D50BB" ? "text-white" : "text-black";
}

export interface AccountNavButtonProps {
  variant?: "hero" | "compact";
  className?: string;
}

export function AccountNavButton({
  variant = "compact",
  className,
}: AccountNavButtonProps) {
  const { profile, openAccountModal } = useAuth();
  const [statsTick, setStatsTick] = useState(0);

  useEffect(() => {
    const bump = () => setStatsTick((n) => n + 1);
    window.addEventListener("solgames:stats-updated", bump);
    window.addEventListener("solgames:profile-sync", bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener("solgames:stats-updated", bump);
      window.removeEventListener("solgames:profile-sync", bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  void statsTick;
  const todayKey = typeof window !== "undefined" ? getLocalDateKey() : "";
  const merged =
    typeof window !== "undefined"
      ? mergeAllGameStatsMaps(profile?.allGameStats ?? null, getAllLocalGameStats())
      : null;

  let bestCurrentStreak = 0;
  let completedToday = 0;
  if (merged) {
    for (const slug of ALL_GAME_SLUGS) {
      const s = merged[slug];
      bestCurrentStreak = Math.max(bestCurrentStreak, s.currentStreak || 0);
      if (todayKey && s.completedDates.includes(todayKey)) {
        completedToday += 1;
      }
    }
  }

  if (!profile) {
    return (
      <button
        type="button"
        onClick={() => openAccountModal("signin")}
        className={cn(
          "inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-full border-2 border-black bg-white font-black text-black transition-all hover:bg-[#FFFBE6] active:translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer",
          variant === "hero"
            ? "px-2.5 min-[375px]:px-4 py-1.5 min-[375px]:py-2 text-[11px] min-[375px]:text-xs sm:text-sm shadow-[2px_2px_0px_#000]"
            : "h-8 sm:h-9 px-2 min-[375px]:px-2.5 sm:px-3 text-[10px] min-[375px]:text-[11px] sm:text-xs shadow-[1px_1px_0px_#000]",
          className
        )}
        title="Log in or create a free 21 Games account"
        aria-label="Log In"
      >
        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
        <span>Log In</span>
        {completedToday > 0 && (
          <span className="inline-flex items-center rounded-full border border-black bg-[#F9D423] px-1.5 py-0.5 text-[10px] font-black text-black">
            {completedToday}/9
          </span>
        )}
      </button>
    );
  }

  const firstName =
    profile.displayName.trim().split(/\s+/)[0] || profile.handle;

  return (
    <button
      type="button"
      onClick={() => openAccountModal("profile")}
      className={cn(
        "inline-flex items-center gap-1.5 sm:gap-2 rounded-full border-2 border-black bg-white font-black text-black transition-all hover:bg-gray-50 active:translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer",
        variant === "hero"
          ? "pl-1 pr-2.5 min-[375px]:pl-1.5 min-[375px]:pr-3.5 py-1 text-xs sm:text-sm shadow-[2px_2px_0px_#000]"
          : "h-8 sm:h-9 pl-1 pr-2 min-[375px]:pr-2.5 text-xs shadow-[1px_1px_0px_#000]",
        className
      )}
      title={`${profile.displayName} (${profile.handle}) — ${completedToday}/9 Solved Today`}
      aria-label={`Open ${profile.displayName}'s profile`}
    >
      <span
        style={{ backgroundColor: profile.avatarColor }}
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-black font-headline font-black shrink-0",
          variant === "hero"
            ? "h-7 w-7 text-xs"
            : "h-6 w-6 text-[10px] min-[375px]:text-[11px]",
          resolveAvatarTextClass(profile.avatarColor)
        )}
      >
        {getInitials(profile.displayName, profile.email)}
      </span>

      <span className="hidden sm:inline max-w-[110px] truncate">
        {firstName}
      </span>

      {bestCurrentStreak > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full border border-black bg-[#FFFBE6] px-1.5 py-0.5 text-[11px] font-black text-black">
          <Flame className="h-3 w-3 text-orange-500 fill-orange-500" />
          {bestCurrentStreak}
        </span>
      )}
    </button>
  );
}
