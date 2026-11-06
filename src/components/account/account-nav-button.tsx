"use client";

import React from "react";
import { Flame, User } from "lucide-react";
import { useAuth } from "@/components/account/auth-provider";
import { getAvatarTextClass } from "@/components/account/profile-viewer-modal";
import { getInitials } from "@/lib/user-auth";
import { cn } from "@/lib/utils";

export interface AccountNavButtonProps {
  variant?: "hero" | "compact";
  className?: string;
}

export function AccountNavButton({
  variant = "compact",
  className,
}: AccountNavButtonProps) {
  const { profile, openAccountModal } = useAuth();

  if (!profile) {
    return (
      <button
        type="button"
        onClick={() => openAccountModal("signin")}
        className={cn(
          "inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-full border-2 border-black bg-white font-black text-black transition-all hover:bg-[#FFFBE6] active:translate-y-0.5 whitespace-nowrap shrink-0",
          variant === "hero"
            ? "px-2.5 min-[375px]:px-4 py-1.5 min-[375px]:py-2 text-[11px] min-[375px]:text-xs sm:text-sm shadow-[2px_2px_0px_#000]"
            : "h-7 min-[375px]:h-8 sm:h-9 px-2 min-[375px]:px-2.5 sm:px-3 text-[11px] sm:text-xs shadow-[1px_1px_0px_#000]",
          className
        )}
        title="Log in or create a free SOL Theory account"
        aria-label="Log In"
      >
        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
        <span>Log In</span>
      </button>
    );
  }

  const firstName =
    profile.displayName.trim().split(/\s+/)[0] || profile.handle;
  const combinedStreak =
    (profile.connect5Stats.currentStreak || 0) +
    (profile.twentyOneStats.currentStreak || 0);

  return (
    <button
      type="button"
      onClick={() => openAccountModal("profile")}
      className={cn(
        "inline-flex items-center gap-1.5 sm:gap-2 rounded-full border-2 border-black bg-white font-black text-black transition-all hover:bg-gray-50 active:translate-y-0.5 whitespace-nowrap shrink-0",
        variant === "hero"
          ? "pl-1 pr-2.5 min-[375px]:pl-1.5 min-[375px]:pr-3.5 py-1 text-xs sm:text-sm shadow-[2px_2px_0px_#000]"
          : "h-7 min-[375px]:h-8 sm:h-9 pl-1 pr-2 min-[375px]:pr-2.5 text-xs shadow-[1px_1px_0px_#000]",
        className
      )}
      title={`${profile.displayName} (${profile.handle}) — View Stats & Profile`}
      aria-label={`Open ${profile.displayName}'s profile`}
    >
      <span
        style={{ backgroundColor: profile.avatarColor }}
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-black font-headline font-black shrink-0",
          variant === "hero"
            ? "h-7 w-7 text-xs"
            : "h-5 w-5 min-[375px]:h-6 min-[375px]:w-6 text-[10px] min-[375px]:text-[11px]",
          getAvatarTextClass(profile.avatarColor)
        )}
      >
        {getInitials(profile.displayName, profile.email)}
      </span>

      <span className="hidden sm:inline max-w-[110px] truncate">
        {firstName}
      </span>

      {combinedStreak > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full border border-black bg-[#FFFBE6] px-1.5 py-0.5 text-[11px] font-black text-black">
          <Flame className="h-3 w-3 text-orange-500 fill-orange-500" />
          {combinedStreak}
        </span>
      )}
    </button>
  );
}
