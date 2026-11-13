"use client";

import React, { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Cloud,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Smartphone,
  Sparkles,
  UserCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/account/auth-provider";
import { UnifiedNineGameStats } from "@/components/account/unified-nine-game-stats";
import { ALL_GAME_SLUGS, type AllGameSlug } from "@/lib/games-config";
import { getLocalDateKey } from "@/lib/date-keys";
import {
  AVATAR_COLOR_OPTIONS,
  formatMemberSince,
  getInitials,
  requestPasswordReset,
  type AvatarColor,
  type RecentResonancePick,
  type UserProfile,
} from "@/lib/user-auth";
import {
  fetchUserCreated21BoardById,
  getAllLocalGameStats,
  getUserCreated21Boards,
  mergeAllGameStatsMaps,
  type AllGameStatsMap,
  type GameStats,
} from "@/lib/game-storage";
import {
  getPastDateKeys,
  parseDateKeyToLocalNoon,
} from "@/lib/daily-engine";
import { shareCustomGame } from "@/lib/custom-game-share";
import type { TwentyOneThingsBoard } from "@/data/puzzles/21-things";
import { assetPath } from "@/lib/asset-path";
import { useToast } from "@/hooks/use-toast";
import {
  checkContentModeration,
  checkUserProfileModeration,
} from "@/lib/moderation";
import { cn } from "@/lib/utils";
import { getSupabaseClient, setRememberLogin } from "@/lib/supabase";

export function getAvatarTextClass(color: AvatarColor): string {
  const match = AVATAR_COLOR_OPTIONS.find((opt) => opt.color === color);
  return match ? match.textClass : "text-black";
}

export function formatSolveTime(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || Number.isNaN(seconds) || seconds <= 0) {
    return "—";
  }
  const rounded = Math.round(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function computeAverageSolveTime(stats: GameStats): number | null {
  if (stats.totalTimeSeconds > 0 && stats.won > 0) {
    return Math.round(stats.totalTimeSeconds / stats.won);
  }
  if (stats.bestTimeSeconds !== null && stats.bestTimeSeconds > 0) {
    return stats.bestTimeSeconds;
  }
  return null;
}

export interface SevenDayStripItem {
  dateKey: string;
  dayInitial: string;
  shortLabel: string;
  isToday: boolean;
  completed: boolean;
}

export function buildLast7DaysStrip(
  completedDates: string[]
): SevenDayStripItem[] {
  const completedSet = new Set(completedDates || []);
  const past7 = getPastDateKeys(7).slice().reverse();
  return past7.map((dateKey, index) => {
    const d = parseDateKeyToLocalNoon(dateKey);
    const weekdayShort = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
    }).format(d);
    const monthDay = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(d);
    const isToday = index === past7.length - 1;
    return {
      dateKey,
      dayInitial: weekdayShort.charAt(0),
      shortLabel: isToday ? `Today (${monthDay})` : `${weekdayShort}, ${monthDay}`,
      isToday,
      completed: completedSet.has(dateKey),
    };
  });
}

export function buildBoardShareUrl(board: TwentyOneThingsBoard): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://21games.ai";
  const path = assetPath("/games/21-things");
  return `${origin}${path}?b=${encodeURIComponent(board.id)}`;
}

export function buildBoardPlayHref(board: TwentyOneThingsBoard): string {
  return `/games/21-things?b=${encodeURIComponent(board.id)}`;
}

export function buildResonancePickHref(
  pick:
    | RecentResonancePick
    | {
        boardId: string;
        dateKey?: string;
        boardTitle?: string;
        pick1Item?: string;
        reflectionNote?: string;
        reflection?: string;
      }
): string {
  if (
    pick.boardId &&
    (pick.boardId.startsWith("custom-") ||
      pick.boardId.startsWith("21t-") ||
      !/^\d{4}-\d{2}-\d{2}$/.test(pick.boardId))
  ) {
    return `/games/21-things?b=${encodeURIComponent(pick.boardId)}`;
  }
  if (pick.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(pick.dateKey)) {
    return `/games/21-things?date=${encodeURIComponent(pick.dateKey)}`;
  }
  return "/games/21-things";
}

export type GuestAuthTab = "signin" | "signup" | "magic" | "forgot";

export function GuestAuthPanel({
  initialTab = "signin",
  onAuthSuccess,
}: {
  initialTab?: "signin" | "signup" | "forgot";
  onAuthSuccess?: (profile: UserProfile) => void;
}) {
  const { signIn, signUp, sendMagicLinkEmail } = useAuth();
  const { toast } = useToast();
  const formId = useId();

  const [activeTab, setActiveTab] = useState<GuestAuthTab>(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState<AvatarColor>("#F9D423");
  const [rememberMe, setRememberMe] = useState(true);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Unified error mode states for interactive buttons
  const [signInInvalidMode, setSignInInvalidMode] = useState(false);
  const [signUpDuplicateMode, setSignUpDuplicateMode] = useState(false);

  // Live on-device guest stats across all 9 countdown games (21 -> 1)
  const [guestAllStats, setGuestAllStats] = useState<AllGameStatsMap>(() =>
    getAllLocalGameStats()
  );

  useEffect(() => {
    const refreshGuestStats = () => {
      setGuestAllStats(getAllLocalGameStats());
    };
    window.addEventListener("solgames:stats-updated", refreshGuestStats);
    window.addEventListener("solgames:profile-sync", refreshGuestStats);
    window.addEventListener("storage", refreshGuestStats);
    return () => {
      window.removeEventListener("solgames:stats-updated", refreshGuestStats);
      window.removeEventListener("solgames:profile-sync", refreshGuestStats);
      window.removeEventListener("storage", refreshGuestStats);
    };
  }, []);

  const guestTotalPlayed = ALL_GAME_SLUGS.reduce(
    (acc, slug) => acc + guestAllStats[slug].played,
    0
  );
  const guestActiveStreaks = ALL_GAME_SLUGS.reduce(
    (acc, slug) => acc + (guestAllStats[slug].currentStreak > 0 ? 1 : 0),
    0
  );
  const guestMaxStreak = ALL_GAME_SLUGS.reduce(
    (acc, slug) =>
      Math.max(
        acc,
        guestAllStats[slug].maxStreak,
        guestAllStats[slug].currentStreak
      ),
    0
  );

  const resetBanners = () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setSignInInvalidMode(false);
    setSignUpDuplicateMode(false);
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetBanners();

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!password || !password.trim()) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Synchronize Remember My Login preference to storage adapter
      setRememberLogin(rememberMe);

      const res = await signIn({
        email: cleanEmail,
        password,
      });

      if (!res.ok || !res.profile) {
        const lowerErr = (res.error || "").toLowerCase();
        if (
          res.confirmationRequired ||
          lowerErr.includes("suspended") ||
          lowerErr.includes("unavailable") ||
          lowerErr.includes("initialize") ||
          lowerErr.includes("verify your account status")
        ) {
          setErrorMessage(
            res.error ||
              "Please verify your email address via the confirmation link in your inbox before signing in."
          );
        } else {
          setSignInInvalidMode(true);
        }
        return;
      }

      toast({
        title: "Signed In to SOL Theory Games",
        description:
          res.message || "Your daily streaks and game stats are now synced.",
      });
      onAuthSuccess?.(res.profile);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetBanners();

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!password || !password.trim() || password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (displayName.trim()) {
      const mod = checkContentModeration(displayName.trim(), {
        mode: "public",
        field: "Display Name",
      });
      if (!mod.allowed) {
        setErrorMessage(mod.reason || "Display name contains inappropriate content.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await signUp({
        email: cleanEmail,
        password,
        displayName: displayName.trim() || undefined,
        avatarColor,
      });

      if (!res.ok) {
        const err = (res.error || "").toLowerCase();
        if (
          err.includes("already registered") ||
          err.includes("already exists") ||
          err.includes("registered") ||
          err.includes("duplicate")
        ) {
          setSignUpDuplicateMode(true);
        } else {
          setErrorMessage(
            res.error || "Unable to create account. Please try again."
          );
        }
        return;
      }

      if (res.confirmationRequired || !res.profile) {
        setPassword("");
        const confirmMsg =
          res.message ||
          "Account created! Check your inbox for a confirmation link to activate your account.";
        setStatusMessage(confirmMsg);
        toast({
          title: "Confirm Your Email Address",
          description: confirmMsg,
        });
        return;
      }

      toast({
        title: "Welcome to SOL Theory Games!",
        description:
          res.message ||
          "Your free account is ready and your on-device stats are backed up.",
      });
      onAuthSuccess?.(res.profile);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetBanners();

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await sendMagicLinkEmail(cleanEmail);
      if (!res.ok) {
        setErrorMessage(res.message || "Could not send magic link.");
        return;
      }
      setStatusMessage(res.message);
      toast({
        title: "Magic Link Sent",
        description: res.message,
      });
      // Do NOT activate profile locally. It activates strictly upon verified URL link click.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetBanners();

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestPasswordReset(cleanEmail);
      if (!res.ok) {
        setErrorMessage(res.error || "Unable to send reset instructions.");
        return;
      }

      setStatusMessage(
        res.message ||
          "If an account exists for this email, password reset instructions have been sent. Please check your inbox."
      );
      toast({
        title: "Password Reset Sent",
        description:
          "Check your inbox for a secure link to choose a new password.",
      });
    } catch {
      setErrorMessage("Could not send password reset email. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2.5 sm:space-y-3 overflow-hidden">
      {/* Live On-Device Guest Stats Preview Banner */}
      <div className="rounded-xl border-2 border-black bg-[#FFFBE6] p-2.5 sm:p-3 shadow-[2px_2px_0px_#000]">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-black bg-[#F9D423] text-black">
            <Sparkles className="h-3 w-3" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-black leading-snug">
              Ready to sync from this device: {guestTotalPlayed}{" "}
              {guestTotalPlayed === 1 ? "game" : "games"} played ·{" "}
              {guestMaxStreak} max streak
            </p>
            <p className="text-[11px] text-gray-700 mt-0.5 leading-snug">
              All 9 countdown games (21 → 1): {guestActiveStreaks} active{" "}
              {guestActiveStreaks === 1 ? "streak" : "streaks"} ready to back up
              to your cloud profile.
            </p>
          </div>
        </div>
      </div>

      {/* Tab Switcher: Sign In / Create Account / Magic Link */}
      <div
        className="grid grid-cols-3 gap-1 rounded-xl border-2 border-black bg-gray-100 p-1"
        role="tablist"
        aria-label="Account authentication options"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "signin"}
          onClick={() => {
            setActiveTab("signin");
            resetBanners();
          }}
          className={cn(
            "rounded-lg py-1.5 px-2 text-xs font-black transition-all cursor-pointer",
            activeTab === "signin"
              ? "bg-black text-white shadow-2xs"
              : "text-gray-700 hover:text-black"
          )}
        >
          Sign In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "signup"}
          onClick={() => {
            setActiveTab("signup");
            resetBanners();
          }}
          className={cn(
            "rounded-lg py-1.5 px-2 text-xs font-black transition-all cursor-pointer",
            activeTab === "signup"
              ? "bg-black text-white shadow-2xs"
              : "text-gray-700 hover:text-black"
          )}
        >
          Create Account
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "magic"}
          onClick={() => {
            setActiveTab("magic");
            resetBanners();
          }}
          className={cn(
            "rounded-lg py-1.5 px-2 text-xs font-black transition-all cursor-pointer",
            activeTab === "magic"
              ? "bg-black text-white shadow-2xs"
              : "text-gray-700 hover:text-black"
          )}
        >
          Magic Link
        </button>
      </div>

      {/* Unified Invalid Login Error Banner */}
      {signInInvalidMode && (
        <div
          role="alert"
          className="rounded-xl border-2 border-red-600 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 leading-snug"
        >
          Login is invalid. Check email or password and retry, or{" "}
          <button
            type="button"
            onClick={() => {
              setActiveTab("signup");
              resetBanners();
            }}
            className="font-black underline text-red-950 hover:text-black uppercase tracking-wider transition-colors inline cursor-pointer"
          >
            CREATE AN ACCOUNT
          </button>
          .
        </div>
      )}

      {/* Unified Duplicate Email Error Banner */}
      {signUpDuplicateMode && (
        <div
          role="alert"
          className="rounded-xl border-2 border-amber-600 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 leading-snug"
        >
          An account with this email already exists. Please{" "}
          <button
            type="button"
            onClick={() => {
              setActiveTab("signin");
              resetBanners();
            }}
            className="font-black underline text-amber-950 hover:text-black uppercase tracking-wider transition-colors inline cursor-pointer"
          >
            LOG IN
          </button>{" "}
          or use{" "}
          <button
            type="button"
            onClick={() => {
              setActiveTab("forgot");
              resetBanners();
            }}
            className="font-black underline text-amber-950 hover:text-black transition-colors inline cursor-pointer"
          >
            Forgot Password
          </button>
          .
        </div>
      )}

      {/* Standard Error / Status Banners */}
      {!signInInvalidMode && !signUpDuplicateMode && errorMessage && (
        <div
          role="alert"
          className="rounded-xl border-2 border-red-600 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
        >
          {errorMessage}
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          className="rounded-xl border-2 border-emerald-600 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"
        >
          {statusMessage}
        </div>
      )}

      {/* TAB 1: SIGN IN */}
      {activeTab === "signin" && (
        <form onSubmit={handleSignInSubmit} className="space-y-2.5">
          <div className="space-y-1">
            <label
              htmlFor={`${formId}-signin-email`}
              className="block text-[11px] font-black uppercase tracking-wider text-gray-700"
            >
              Email Address
            </label>
            <Input
              id={`${formId}-signin-email`}
              type="email"
              autoComplete="username"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (signInInvalidMode) setSignInInvalidMode(false);
              }}
              className="h-9 sm:h-10 border-2 border-black bg-white text-sm font-medium"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor={`${formId}-signin-password`}
                className="block text-[11px] font-black uppercase tracking-wider text-gray-700"
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("forgot");
                  resetBanners();
                }}
                className="text-[11px] font-bold text-gray-600 underline hover:text-black cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Input
                id={`${formId}-signin-password`}
                type={showSignInPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (signInInvalidMode) setSignInInvalidMode(false);
                }}
                className="h-9 sm:h-10 border-2 border-black bg-white pr-10 text-sm font-medium"
              />
              <button
                type="button"
                onClick={() => setShowSignInPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black p-1 cursor-pointer"
                aria-label={showSignInPassword ? "Hide password" : "Show password"}
              >
                {showSignInPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* [✓] Remember my login Checkbox */}
          <div className="flex items-center gap-2">
            <input
              id={`${formId}-signin-remember`}
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-2 border-black accent-black focus:ring-0 focus:outline-hidden cursor-pointer"
            />
            <label
              htmlFor={`${formId}-signin-remember`}
              className="text-xs font-bold text-gray-700 cursor-pointer select-none"
            >
              Remember my login
            </label>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-9 sm:h-10 rounded-xl border-2 border-black bg-black text-white font-black text-xs sm:text-sm hover:bg-gray-900 shadow-[2px_2px_0px_#F9D423] cursor-pointer"
          >
            {isSubmitting ? "Signing In & Syncing..." : "Log In & Sync Stats"}
          </Button>

          <p className="text-center text-xs text-gray-600">
            New to SOL Theory Games?{" "}
            <button
              type="button"
              onClick={() => {
                setActiveTab("signup");
                resetBanners();
              }}
              className="font-black text-black underline hover:text-[#9D50BB] cursor-pointer"
            >
              Create a free account
            </button>
          </p>
        </form>
      )}

      {/* TAB 2: CREATE ACCOUNT */}
      {activeTab === "signup" && (
        <form onSubmit={handleSignUpSubmit} className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label
                htmlFor={`${formId}-signup-name`}
                className="block text-[11px] font-black uppercase tracking-wider text-gray-700"
              >
                Display Name
              </label>
              <Input
                id={`${formId}-signup-name`}
                type="text"
                autoComplete="name"
                placeholder="e.g. Alex Morgan"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-9 sm:h-10 border-2 border-black bg-white text-sm font-medium"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor={`${formId}-signup-email`}
                className="block text-[11px] font-black uppercase tracking-wider text-gray-700"
              >
                Email Address
              </label>
              <Input
                id={`${formId}-signup-email`}
                type="email"
                autoComplete="username"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (signUpDuplicateMode) setSignUpDuplicateMode(false);
                }}
                className="h-9 sm:h-10 border-2 border-black bg-white text-sm font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor={`${formId}-signup-password`}
                className="block text-[11px] font-black uppercase tracking-wider text-gray-700"
              >
                Password (min 6 characters)
              </label>
              {password.length > 0 && (
                <span
                  className={cn(
                    "text-[11px] font-black",
                    password.length >= 6 ? "text-emerald-600" : "text-amber-600"
                  )}
                >
                  {password.length >= 6 ? "✓ 6+ chars" : `${password.length}/6 chars`}
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                id={`${formId}-signup-password`}
                type={showSignUpPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="Create a password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 sm:h-10 border-2 border-black bg-white pr-10 text-sm font-medium"
              />
              <button
                type="button"
                onClick={() => setShowSignUpPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black p-1 cursor-pointer"
                aria-label={showSignUpPassword ? "Hide password" : "Show password"}
              >
                {showSignUpPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* 5 SOL Theory Avatar Color Swatches */}
          <div className="space-y-1">
            <span className="block text-[11px] font-black uppercase tracking-wider text-gray-700">
              Choose Your Avatar Color
            </span>
            <div className="flex items-center justify-between gap-2 rounded-xl border-2 border-black bg-gray-50 p-2">
              <div className="flex items-center gap-2">
                {AVATAR_COLOR_OPTIONS.map((option) => {
                  const selected = avatarColor === option.color;
                  return (
                    <button
                      key={option.color}
                      type="button"
                      onClick={() => setAvatarColor(option.color)}
                      title={option.label}
                      aria-label={`Select ${option.label}`}
                      aria-pressed={selected}
                      style={{ backgroundColor: option.color }}
                      className={cn(
                        "h-7 w-7 rounded-full border-2 border-black flex items-center justify-center transition-transform cursor-pointer",
                        option.textClass,
                        selected
                          ? "scale-110 ring-2 ring-black ring-offset-1"
                          : "opacity-85 hover:opacity-100"
                      )}
                    >
                      {selected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
              <div
                style={{ backgroundColor: avatarColor }}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black font-headline text-xs font-black",
                  getAvatarTextClass(avatarColor)
                )}
              >
                {getInitials(displayName, email)}
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-9 sm:h-10 rounded-xl border-2 border-black bg-[#2ECC71] text-black font-black text-xs sm:text-sm hover:bg-[#27ae60] shadow-[2px_2px_0px_#000] cursor-pointer"
          >
            {isSubmitting
              ? "Creating Account..."
              : "Create Free Account & Save Streaks"}
          </Button>

          <p className="text-center text-xs text-gray-600">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setActiveTab("signin");
                resetBanners();
              }}
              className="font-black text-black underline hover:text-[#9D50BB] cursor-pointer"
            >
              Log in instead
            </button>
          </p>
        </form>
      )}

      {/* TAB 3: MAGIC LINK */}
      {activeTab === "magic" && (
        <form onSubmit={handleMagicLinkSubmit} className="space-y-2.5">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-700 leading-snug">
            <strong>Passwordless Sign-In:</strong> We&apos;ll email you a secure
            sign-in link. Click the link in your inbox to complete sign in.
          </div>

          <div className="space-y-1">
            <label
              htmlFor={`${formId}-magic-email`}
              className="block text-[11px] font-black uppercase tracking-wider text-gray-700"
            >
              Email Address
            </label>
            <Input
              id={`${formId}-magic-email`}
              type="email"
              autoComplete="username"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 sm:h-10 border-2 border-black bg-white text-sm font-medium"
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-9 sm:h-10 rounded-xl border-2 border-black bg-[#F9D423] text-black font-black text-xs sm:text-sm hover:bg-[#f0c808] shadow-[2px_2px_0px_#000] cursor-pointer"
          >
            <Mail className="h-4 w-4 mr-2" />
            {isSubmitting
              ? "Sending Sign-In Link..."
              : "Send Secure Sign-In Link"}
          </Button>
        </form>
      )}

      {/* TAB 4: FORGOT PASSWORD */}
      {activeTab === "forgot" && (
        <form onSubmit={handleForgotPasswordSubmit} className="space-y-2.5">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-700 leading-snug">
            <strong>Reset Your Password:</strong> Enter your email address and
            we will send you a secure link to choose a new password.
          </div>

          <div className="space-y-1">
            <label
              htmlFor={`${formId}-forgot-email`}
              className="block text-[11px] font-black uppercase tracking-wider text-gray-700"
            >
              Email Address
            </label>
            <Input
              id={`${formId}-forgot-email`}
              type="email"
              autoComplete="username"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 sm:h-10 border-2 border-black bg-white text-sm font-medium"
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-9 sm:h-10 rounded-xl border-2 border-black bg-[#9D50BB] text-white font-black text-xs sm:text-sm hover:bg-[#8338a0] shadow-[2px_2px_0px_#000] cursor-pointer"
          >
            <KeyRound className="h-4 w-4 mr-2" />
            {isSubmitting ? "Sending Reset Link..." : "Send Reset Instructions"}
          </Button>

          <p className="text-center text-xs text-gray-600">
            Remembered your password?{" "}
            <button
              type="button"
              onClick={() => {
                setActiveTab("signin");
                resetBanners();
              }}
              className="font-black text-black underline hover:text-[#9D50BB] cursor-pointer"
            >
              Back to Sign In
            </button>
          </p>
        </form>
      )}
    </div>
  );
}

export function SetNewPasswordModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();
  const formId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newPassword || !newPassword.trim() || newPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setErrorMessage("Authentication service unavailable.");
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMessage(
          error.message ||
            "Unable to set new password. The recovery link may have expired."
        );
        return;
      }

      toast({
        title: "Password Set Successfully",
        description:
          "Your new password has been saved. You are now logged in.",
      });

      // Clear recovery tokens from the URL cleanly
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", window.location.pathname);
      }

      onSuccess?.();
      onOpenChange(false);
    } catch {
      setErrorMessage("Failed to update password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-4 sm:p-5 flex flex-col gap-3">
        <DialogHeader className="text-left space-y-0.5">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#9D50BB]">
            <Lock className="h-3.5 w-3.5" />
            SOL Theory Games · Security
          </div>
          <DialogTitle className="font-headline text-lg sm:text-xl font-black text-black">
            Set New Password
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-600">
            Enter a new secure password (minimum 6 characters) for your SOL Theory account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-1 overflow-hidden">
          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl border-2 border-red-600 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor={`${formId}-new-password`}
                className="block text-[11px] font-black uppercase tracking-wider text-gray-700"
              >
                New Password (min 6 chars)
              </label>
              {newPassword.length > 0 && (
                <span
                  className={cn(
                    "text-[11px] font-black",
                    newPassword.length >= 6
                      ? "text-emerald-600"
                      : "text-amber-600"
                  )}
                >
                  {newPassword.length >= 6
                    ? "✓ 6+ chars"
                    : `${newPassword.length}/6 chars`}
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                id={`${formId}-new-password`}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-9 sm:h-10 border-2 border-black bg-white pr-10 text-sm font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black p-1 cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor={`${formId}-confirm-password`}
              className="block text-[11px] font-black uppercase tracking-wider text-gray-700"
            >
              Confirm New Password
            </label>
            <div className="relative">
              <Input
                id={`${formId}-confirm-password`}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-9 sm:h-10 border-2 border-black bg-white pr-10 text-sm font-medium"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-9 sm:h-10 rounded-xl border-2 border-black bg-black text-white font-black text-xs sm:text-sm hover:bg-gray-900 shadow-[2px_2px_0px_#F9D423] cursor-pointer"
          >
            {isSubmitting ? "Updating Password..." : "Update Password & Sign In"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type ProfileModalSectionTab = "stats" | "boards" | "edit";

export function LoggedInProfileDashboard({
  profile,
  isModalView = false,
  onNavigateAway,
  initialSectionTab = "stats",
  initialSelectedGameId = "21-things",
}: {
  profile: UserProfile;
  isModalView?: boolean;
  onNavigateAway?: () => void;
  initialSectionTab?: ProfileModalSectionTab;
  initialSelectedGameId?: AllGameSlug;
}) {
  const { updateProfile, refreshProfile, signOut } = useAuth();
  const { toast } = useToast();
  const editFormId = useId();

  const [activeTab, setActiveTab] =
    useState<ProfileModalSectionTab>(initialSectionTab);
  const [selectedGameId, setSelectedGameId] = useState<AllGameSlug>(
    initialSelectedGameId
  );
  const [localStats, setLocalStats] = useState<AllGameStatsMap>(() =>
    getAllLocalGameStats()
  );
  const [editDisplayName, setEditDisplayName] = useState(profile.displayName);
  const [editHandle, setEditHandle] = useState(profile.handle);
  const [editAvatarColor, setEditAvatarColor] = useState<AvatarColor>(
    profile.avatarColor
  );
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedBoardId, setCopiedBoardId] = useState<string | null>(null);
  const [createdBoards, setCreatedBoards] = useState<TwentyOneThingsBoard[]>(
    () => getUserCreated21Boards()
  );

  useEffect(() => {
    let isMounted = true;
    const handleSync = () => {
      if (isMounted) {
        setCreatedBoards(getUserCreated21Boards());
        setLocalStats(getAllLocalGameStats());
      }
    };

    const localIds = new Set(getUserCreated21Boards().map((b) => b.id));
    const missingRemoteIds = (profile.createdBoardIds || []).filter(
      (id) => id && !localIds.has(id)
    );
    if (missingRemoteIds.length > 0) {
      void Promise.all(
        missingRemoteIds.map((id) => fetchUserCreated21BoardById(id))
      ).then(() => {
        if (isMounted) {
          setCreatedBoards(getUserCreated21Boards());
        }
      });
    }

    window.addEventListener("solgames:stats-updated", handleSync);
    window.addEventListener("solgames:profile-sync", handleSync);
    window.addEventListener("solgames:auth-changed", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      isMounted = false;
      window.removeEventListener("solgames:stats-updated", handleSync);
      window.removeEventListener("solgames:profile-sync", handleSync);
      window.removeEventListener("solgames:auth-changed", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [profile.createdBoardIds]);

  const mergedStats = useMemo(
    () => mergeAllGameStatsMaps(profile.allGameStats ?? null, localStats),
    [profile.allGameStats, localStats]
  );

  const todayKey = getLocalDateKey();

  const rollup = useMemo(() => {
    let totalPlayed = 0;
    let activeStreaks = 0;
    let bestStreak = 0;
    let completedToday = 0;
    for (const slug of ALL_GAME_SLUGS) {
      const s = mergedStats[slug];
      totalPlayed += s.played;
      if (s.currentStreak > 0) activeStreaks += 1;
      bestStreak = Math.max(bestStreak, s.maxStreak, s.currentStreak);
      if (s.completedDates.includes(todayKey)) completedToday += 1;
    }
    return { totalPlayed, activeStreaks, bestStreak, completedToday };
  }, [mergedStats, todayKey]);

  const totalCreatedCount = Math.max(
    profile.boardsCreatedCount,
    createdBoards.length
  );

  const handleOpenEditTab = () => {
    setEditDisplayName(profile.displayName);
    setEditHandle(profile.handle);
    setEditAvatarColor(profile.avatarColor);
    setSaveFeedback(null);
    setActiveTab("edit");
  };

  const handleSaveProfileEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEdit(true);
    setSaveFeedback(null);

    const nextDisplayName = editDisplayName.trim() || profile.displayName;
    const nextHandle = editHandle.trim() || profile.handle;

    const profileMod = checkUserProfileModeration({
      displayName: nextDisplayName,
      handle: nextHandle,
    });

    if (!profileMod.allowed) {
      setIsSavingEdit(false);
      setSaveFeedback(profileMod.reason || "Invalid display name or handle.");
      toast({
        title: "Profile Moderation Notice",
        description: profileMod.reason,
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await updateProfile({
        displayName: nextDisplayName,
        handle: nextHandle,
        avatarColor: editAvatarColor,
      });
      if (res.ok) {
        setSaveFeedback("Profile saved!");
        setActiveTab("stats");
        toast({
          title: "Profile Updated",
          description: "Your display name, handle, and avatar color are saved.",
        });
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await refreshProfile();
      setCreatedBoards(getUserCreated21Boards());
      setLocalStats(getAllLocalGameStats());
      toast({
        title: "Profile & Streaks Synced",
        description: "All daily game stats and 21 Things boards are up to date.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyBoardLink = async (board: TwentyOneThingsBoard) => {
    const shareUrl = buildBoardShareUrl(board);
    const creatorHandle =
      profile.handle ||
      board.creatorHandle ||
      (board.creatorName
        ? `@${board.creatorName.toLowerCase().replace(/[^a-z0-9_]/g, "")}`
        : undefined);

    await shareCustomGame({
      title: board.title,
      creatorHandle,
      creatorName: board.creatorName || profile.displayName,
      shareUrl,
      gameName: "21 Things",
      toastTitle: "Share Link & Blurb Copied!",
      toastDescription: `Copied attributed share blurb for "${board.title}" to clipboard.`,
    });

    setCopiedBoardId(board.id);
    setTimeout(() => {
      setCopiedBoardId((prev) => (prev === board.id ? null : prev));
    }, 2200);
  };

  const handleSignOutClick = async () => {
    await signOut();
    toast({
      title: "Signed Out",
      description:
        "You have signed out. Your on-device stats remain safely stored.",
    });
  };

  const formattedHandle = profile.handle.startsWith("@")
    ? profile.handle
    : `@${profile.handle}`;

  return (
    <div className="space-y-2.5 overflow-hidden">
      {/* Compact Profile Identity Header */}
      <div className="rounded-2xl border-2 border-black bg-[#FCFCFD] p-2.5 sm:p-3.5 shadow-[2px_2px_0px_#000] overflow-hidden">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              style={{ backgroundColor: profile.avatarColor }}
              className={cn(
                "flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full border-2 border-black font-headline text-sm sm:text-base font-black shadow-[1px_1px_0px_#000]",
                getAvatarTextClass(profile.avatarColor)
              )}
            >
              {getInitials(profile.displayName, profile.email)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="font-headline text-sm sm:text-base font-black text-black truncate">
                  {profile.displayName}
                </h3>
                <span className="font-mono text-[11px] font-bold text-gray-600 truncate">
                  {formattedHandle}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-black text-[10px] font-bold px-1.5 py-0 flex items-center gap-1",
                    profile.authMode === "supabase"
                      ? "bg-emerald-100 text-emerald-950"
                      : "bg-[#FFFBE6] text-black"
                  )}
                >
                  {profile.authMode === "supabase" ? (
                    <>
                      <Cloud className="h-2.5 w-2.5" />
                      Synced · Cloud
                    </>
                  ) : (
                    <>
                      <Smartphone className="h-2.5 w-2.5" />
                      Synced · Device
                    </>
                  )}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-black bg-white text-[10px] font-bold px-1.5 py-0 text-black hidden xs:inline-flex"
                >
                  Member since {formatMemberSince(profile.memberSince)}
                </Badge>
              </div>

              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-600">
                <span className="truncate">{profile.email}</span>
                <span className="text-gray-300">·</span>
                <span className="font-black text-black">
                  {rollup.totalPlayed} Played · {rollup.activeStreaks}/9 Streaks 🔥 · Best {rollup.bestStreak}
                </span>
                {saveFeedback && (
                  <span className="text-[11px] font-bold text-emerald-700">
                    ✓ {saveFeedback}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === "edit") {
                setActiveTab("stats");
              } else {
                handleOpenEditTab();
              }
            }}
            className="shrink-0 h-8 px-2.5 border-2 border-black bg-white text-[11px] font-black text-black hover:bg-gray-100 cursor-pointer"
          >
            <Edit3 className="h-3 w-3 mr-1" />
            {activeTab === "edit" ? "Stats" : "Edit Profile"}
          </Button>
        </div>
      </div>

      {/* Top 3-Tab Segmented Navigation Bar */}
      <div
        data-testid="profile-modal-tabs"
        role="tablist"
        aria-label="Profile dashboard sections"
        className="grid grid-cols-3 gap-1 rounded-xl border-2 border-black bg-gray-100 p-1"
      >
        <button
          type="button"
          role="tab"
          data-testid="profile-tab-stats"
          aria-selected={activeTab === "stats"}
          onClick={() => setActiveTab("stats")}
          className={cn(
            "rounded-lg py-1.5 px-2 text-[11px] sm:text-xs font-black transition-all cursor-pointer truncate",
            activeTab === "stats"
              ? "bg-black text-white shadow-2xs"
              : "text-gray-700 hover:text-black"
          )}
        >
          🏆 9-Game Stats
        </button>
        <button
          type="button"
          role="tab"
          data-testid="profile-tab-boards"
          aria-selected={activeTab === "boards"}
          onClick={() => setActiveTab("boards")}
          className={cn(
            "rounded-lg py-1.5 px-2 text-[11px] sm:text-xs font-black transition-all cursor-pointer truncate",
            activeTab === "boards"
              ? "bg-black text-white shadow-2xs"
              : "text-gray-700 hover:text-black"
          )}
        >
          ✨ My Boards &amp; #1 Picks ({profile.recentPicks.length + createdBoards.length})
        </button>
        <button
          type="button"
          role="tab"
          data-testid="profile-tab-edit"
          aria-selected={activeTab === "edit"}
          onClick={handleOpenEditTab}
          className={cn(
            "rounded-lg py-1.5 px-2 text-[11px] sm:text-xs font-black transition-all cursor-pointer truncate",
            activeTab === "edit"
              ? "bg-black text-white shadow-2xs"
              : "text-gray-700 hover:text-black"
          )}
        >
          ✏️ Edit Profile
        </button>
      </div>

      {/* TAB 1: 9-GAME STATS (Compact 9-Game Selector Grid + Single-Game Spotlight Card) */}
      {activeTab === "stats" && (
        <UnifiedNineGameStats
          remoteStats={profile.allGameStats}
          boardsCreatedCount={totalCreatedCount}
          recentPicksCount={profile.recentPicks.length}
          selectedGameId={selectedGameId}
          onSelectGameId={setSelectedGameId}
          spotlightMode={true}
          onOpenBoardsTab={() => setActiveTab("boards")}
          onNavigateAway={onNavigateAway}
        />
      )}

      {/* TAB 2: MY BOARDS & #1 PICKS (Zero Scrollbars) */}
      {activeTab === "boards" && (
        <div
          data-testid="profile-boards-panel"
          className="rounded-2xl border-2 border-black bg-white p-3 sm:p-3.5 shadow-[2px_2px_0px_#000] space-y-3 overflow-hidden"
        >
          {/* Recent #1 Resonance Picks (up to 2) */}
          <div className="space-y-1.5 overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-700">
                Recent #1 Resonance Picks ({profile.recentPicks.length})
              </span>
              <Link
                href="/games/21-things"
                onClick={onNavigateAway}
                className="text-[11px] font-black text-[#9D50BB] hover:underline"
              >
                Play 21 Things →
              </Link>
            </div>

            {profile.recentPicks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-2.5 text-xs text-gray-600 flex items-center justify-between gap-2">
                <span className="truncate">
                  Complete a 21 → 6 → 3 → 1 board to save your #1 resonance picks here.
                </span>
                <Link
                  href="/games/21-things"
                  onClick={onNavigateAway}
                  className="shrink-0 font-black text-black underline"
                >
                  Play 21 Things →
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5 overflow-hidden">
                {profile.recentPicks.slice(0, 2).map((pick, idx) => (
                  <div
                    key={`${pick.boardId}-${pick.pick1Item}-${idx}`}
                    className="rounded-xl border-2 border-black/15 bg-[#f7eef5]/60 p-2.5 flex items-center justify-between gap-2 overflow-hidden"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="inline-flex items-center rounded-md border border-black bg-[#F9D423] px-1.5 py-0.5 text-[11px] font-black text-black shrink-0">
                          #1 · {pick.pick1Item}
                        </span>
                        <span className="text-[11px] font-bold text-gray-600 truncate">
                          {pick.boardTitle}
                        </span>
                      </div>
                      {pick.reflectionNote && (
                        <p className="text-[11px] italic text-gray-700 truncate">
                          &ldquo;{pick.reflectionNote}&rdquo;
                        </p>
                      )}
                    </div>
                    <Link
                      href={buildResonancePickHref(pick)}
                      onClick={onNavigateAway}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-black bg-white px-2.5 py-1 text-[11px] font-black text-black hover:bg-gray-100"
                    >
                      Board →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Created 21 Things Boards (up to 2) */}
          <div className="space-y-1.5 pt-2 border-t border-black/10 overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-700">
                My Created 21 Things Boards ({createdBoards.length})
              </span>
              <Link
                href="/games/21-things?mode=create"
                onClick={onNavigateAway}
                className="inline-flex items-center gap-1 text-[11px] font-black text-[#9D50BB] hover:underline"
              >
                <Plus className="h-3 w-3" />
                + Create Board
              </Link>
            </div>

            {createdBoards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-2.5 text-xs text-gray-600 flex items-center justify-between gap-2">
                <span className="truncate">
                  Voice-brainstorm or type your own 21 Things board to share with friends.
                </span>
                <Link
                  href="/games/21-things?mode=create"
                  onClick={onNavigateAway}
                  className="shrink-0 font-black text-black underline"
                >
                  + Create Board
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5 overflow-hidden">
                {createdBoards.slice(0, 2).map((createdBoard) => {
                  const isCopied = copiedBoardId === createdBoard.id;
                  return (
                    <div
                      key={createdBoard.id}
                      className="rounded-xl border-2 border-black/15 bg-gray-50 p-2.5 flex items-center justify-between gap-2 overflow-hidden"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-headline text-xs sm:text-sm font-black text-black truncate">
                          {createdBoard.title}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          By {createdBoard.creatorName} · 21 Tiles
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyBoardLink(createdBoard)}
                          className="inline-flex items-center gap-1 rounded-lg border-2 border-black bg-white px-2 py-1 text-[11px] font-black text-black hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy Link
                            </>
                          )}
                        </button>

                        <Link
                          href={buildBoardPlayHref(createdBoard)}
                          onClick={onNavigateAway}
                          className="inline-flex items-center gap-1 rounded-lg border-2 border-black bg-[#F9D423] px-2.5 py-1 text-[11px] font-black text-black hover:bg-[#f0c808] transition-colors"
                        >
                          Play
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: EDIT PROFILE (Zero Scrollbars) */}
      {activeTab === "edit" && (
        <form
          data-testid="profile-edit-panel"
          onSubmit={handleSaveProfileEdit}
          className="rounded-2xl border-2 border-black bg-white p-3.5 sm:p-4 space-y-3 shadow-[2px_2px_0px_#000] overflow-hidden"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label
                htmlFor={`${editFormId}-display-name`}
                className="block text-[11px] font-black uppercase tracking-wider text-gray-700"
              >
                Display Name
              </label>
              <Input
                id={`${editFormId}-display-name`}
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                className="h-9 sm:h-10 border-2 border-black bg-white text-sm font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor={`${editFormId}-handle`}
                className="block text-[11px] font-black uppercase tracking-wider text-gray-700"
              >
                Handle
              </label>
              <Input
                id={`${editFormId}-handle`}
                type="text"
                value={editHandle}
                onChange={(e) => setEditHandle(e.target.value)}
                className="h-9 sm:h-10 border-2 border-black bg-white text-sm font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-[11px] font-black uppercase tracking-wider text-gray-700">
              Avatar Color Swatch
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {AVATAR_COLOR_OPTIONS.map((option) => {
                const selected = editAvatarColor === option.color;
                return (
                  <button
                    key={option.color}
                    type="button"
                    onClick={() => setEditAvatarColor(option.color)}
                    style={{ backgroundColor: option.color }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border-2 border-black px-3 py-1 text-xs font-black transition-all cursor-pointer",
                      option.textClass,
                      selected
                        ? "ring-2 ring-black ring-offset-1 scale-105"
                        : "opacity-80 hover:opacity-100"
                    )}
                  >
                    {selected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("stats")}
              className="border-2 border-black font-bold text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSavingEdit}
              className="border-2 border-black bg-[#2ECC71] text-black hover:bg-[#27ae60] font-black text-xs cursor-pointer"
            >
              {isSavingEdit ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </form>
      )}

      {/* Compact Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-black/10">
        {isModalView ? (
          <Link
            href="/account"
            onClick={onNavigateAway}
            className="inline-flex items-center gap-1.5 text-xs font-black text-black underline hover:text-[#9D50BB]"
          >
            Open Full Profile Page →
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-black text-black underline hover:text-[#9D50BB]"
          >
            ← Back to All SOL Games
          </Link>
        )}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSyncing}
            onClick={handleManualSync}
            className="h-8 px-2.5 border-2 border-black bg-white text-[11px] font-black text-black hover:bg-gray-100 cursor-pointer"
          >
            <RefreshCw
              className={cn("h-3 w-3 mr-1", isSyncing && "animate-spin")}
            />
            {isSyncing ? "Syncing..." : "Sync Now"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSignOutClick}
            className="h-8 px-2.5 border-2 border-black bg-white text-[11px] font-black text-red-600 hover:bg-red-50 cursor-pointer"
          >
            <LogOut className="h-3 w-3 mr-1" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProfileViewerModal() {
  const {
    profile,
    isModalOpen,
    modalInitialTab,
    closeAccountModal,
  } = useAuth();

  return (
    <Dialog
      open={isModalOpen}
      onOpenChange={(open) => {
        if (!open) closeAccountModal();
      }}
    >
      <DialogContent className="w-full max-w-xl sm:max-w-2xl max-h-[95vh] overflow-hidden p-3.5 sm:p-5 flex flex-col gap-2.5 sm:gap-3">
        <DialogHeader className="text-left space-y-0.5">
          <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-[#9D50BB]">
            <UserCheck className="h-3.5 w-3.5" />
            SOL Theory Games · Account &amp; Profile
          </div>
          <DialogTitle className="font-headline text-base sm:text-xl font-black text-black leading-tight">
            {profile
              ? `${profile.displayName}'s Player Profile`
              : "Log in or create a free SOL Theory account"}
          </DialogTitle>
          <DialogDescription className="text-[11px] sm:text-xs text-gray-600 line-clamp-1">
            {profile
              ? "Your daily streaks, signature scores, personal 1 Win journal, and custom boards across all 9 countdown games (21 → 1)."
              : "Save your daily streaks, signature scores, and custom boards across all 9 countdown games (21 → 1)."}
          </DialogDescription>
        </DialogHeader>

        {!profile ? (
          <GuestAuthPanel
            key={modalInitialTab}
            initialTab={modalInitialTab === "signup" ? "signup" : "signin"}
          />
        ) : (
          <LoggedInProfileDashboard
            key={profile.id}
            profile={profile}
            isModalView={true}
            onNavigateAway={closeAccountModal}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
