"use client";

import React, { useEffect, useId, useState } from "react";
import Link from "next/link";
import {
  Check,
  Cloud,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Play,
  Plus,
  RefreshCw,
  Smartphone,
  Sparkles,
  Trophy,
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
  getGameStats,
  getUserCreated21Boards,
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

export function buildResonancePickHref(pick: RecentResonancePick): string {
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

  // Live on-device guest stats
  const [guestC5Stats, setGuestC5Stats] = useState<GameStats>(() =>
    getGameStats("connect-5")
  );
  const [guest21Stats, setGuest21Stats] = useState<GameStats>(() =>
    getGameStats("21-things")
  );

  useEffect(() => {
    const refreshGuestStats = () => {
      setGuestC5Stats(getGameStats("connect-5"));
      setGuest21Stats(getGameStats("21-things"));
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

  const guestTotalPlayed = guestC5Stats.played + guest21Stats.played;
  const guestMaxStreak = Math.max(
    guestC5Stats.maxStreak,
    guest21Stats.maxStreak,
    guestC5Stats.currentStreak,
    guest21Stats.currentStreak
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
        if (
          res.confirmationRequired ||
          (res.error && res.error.toLowerCase().includes("suspended"))
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
    <div className="space-y-4">
      {/* Live On-Device Guest Stats Preview Banner */}
      <div className="rounded-xl border-2 border-black bg-[#FFFBE6] p-3.5 shadow-[3px_3px_0px_#000]">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-black bg-[#F9D423] text-black">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-black text-black">
              Ready to sync from this device: {guestTotalPlayed}{" "}
              {guestTotalPlayed === 1 ? "game" : "games"} played ·{" "}
              {guestMaxStreak} max streak
            </p>
            <p className="text-[11px] sm:text-xs text-gray-700 mt-0.5">
              Connect 5: {guestC5Stats.played} played ({guestC5Stats.currentStreak}{" "}
              streak) · 21 Things: {guest21Stats.won} completed (
              {guest21Stats.currentStreak} streak)
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
            "rounded-lg py-2 px-2 text-xs sm:text-sm font-black transition-all cursor-pointer",
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
            "rounded-lg py-2 px-2 text-xs sm:text-sm font-black transition-all cursor-pointer",
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
            "rounded-lg py-2 px-2 text-xs sm:text-sm font-black transition-all cursor-pointer",
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
          className="rounded-xl border-2 border-red-600 bg-red-50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-red-700 leading-relaxed"
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
          className="rounded-xl border-2 border-amber-600 bg-amber-50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-amber-900 leading-relaxed"
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
          className="rounded-xl border-2 border-red-600 bg-red-50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-red-700"
        >
          {errorMessage}
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          className="rounded-xl border-2 border-emerald-600 bg-emerald-50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-emerald-800"
        >
          {statusMessage}
        </div>
      )}

      {/* TAB 1: SIGN IN */}
      {activeTab === "signin" && (
        <form onSubmit={handleSignInSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor={`${formId}-signin-email`}
              className="block text-xs font-black uppercase tracking-wider text-gray-700"
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
              className="h-11 border-2 border-black bg-white text-base sm:text-sm font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor={`${formId}-signin-password`}
                className="block text-xs font-black uppercase tracking-wider text-gray-700"
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("forgot");
                  resetBanners();
                }}
                className="text-xs font-bold text-gray-600 underline hover:text-black cursor-pointer"
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
                className="h-11 border-2 border-black bg-white pr-10 text-base sm:text-sm font-medium"
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
          <div className="flex items-center gap-2 pt-0.5">
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
            className="w-full h-11 rounded-xl border-2 border-black bg-black text-white font-black text-sm hover:bg-gray-900 shadow-[3px_3px_0px_#F9D423] cursor-pointer"
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
        <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor={`${formId}-signup-name`}
              className="block text-xs font-black uppercase tracking-wider text-gray-700"
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
              className="h-11 border-2 border-black bg-white text-base sm:text-sm font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`${formId}-signup-email`}
              className="block text-xs font-black uppercase tracking-wider text-gray-700"
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
              className="h-11 border-2 border-black bg-white text-base sm:text-sm font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor={`${formId}-signup-password`}
                className="block text-xs font-black uppercase tracking-wider text-gray-700"
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
                className="h-11 border-2 border-black bg-white pr-10 text-base sm:text-sm font-medium"
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
          <div className="space-y-1.5">
            <span className="block text-xs font-black uppercase tracking-wider text-gray-700">
              Choose Your Avatar Color
            </span>
            <div className="flex items-center justify-between gap-2 rounded-xl border-2 border-black bg-gray-50 p-2.5">
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
                        "h-8 w-8 rounded-full border-2 border-black flex items-center justify-center transition-transform cursor-pointer",
                        option.textClass,
                        selected
                          ? "scale-110 ring-2 ring-black ring-offset-2"
                          : "opacity-85 hover:opacity-100"
                      )}
                    >
                      {selected && <Check className="h-4 w-4 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
              <div
                style={{ backgroundColor: avatarColor }}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-black font-headline text-xs font-black",
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
            className="w-full h-11 rounded-xl border-2 border-black bg-[#2ECC71] text-black font-black text-sm hover:bg-[#27ae60] shadow-[3px_3px_0px_#000] cursor-pointer"
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
        <form onSubmit={handleMagicLinkSubmit} className="space-y-3.5">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 leading-relaxed">
            <strong>Passwordless Sign-In:</strong> We&apos;ll email you a secure
            sign-in link. Click the link in your inbox to complete sign in.
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`${formId}-magic-email`}
              className="block text-xs font-black uppercase tracking-wider text-gray-700"
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
              className="h-11 border-2 border-black bg-white text-base sm:text-sm font-medium"
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 rounded-xl border-2 border-black bg-[#F9D423] text-black font-black text-sm hover:bg-[#f0c808] shadow-[3px_3px_0px_#000] cursor-pointer"
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
        <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 leading-relaxed">
            <strong>Reset Your Password:</strong> Enter your email address and
            we will send you a secure link to choose a new password.
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`${formId}-forgot-email`}
              className="block text-xs font-black uppercase tracking-wider text-gray-700"
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
              className="h-11 border-2 border-black bg-white text-base sm:text-sm font-medium"
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 rounded-xl border-2 border-black bg-[#9D50BB] text-white font-black text-sm hover:bg-[#8338a0] shadow-[3px_3px_0px_#000] cursor-pointer"
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
      <DialogContent className="max-w-md p-5 sm:p-6">
        <DialogHeader className="text-left">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#9D50BB] mb-1">
            <Lock className="h-3.5 w-3.5" />
            SOL Theory Games · Security
          </div>
          <DialogTitle className="font-headline text-xl sm:text-2xl font-black text-black">
            Set New Password
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-gray-600">
            Enter a new secure password (minimum 6 characters) for your SOL Theory account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl border-2 border-red-600 bg-red-50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor={`${formId}-new-password`}
                className="block text-xs font-black uppercase tracking-wider text-gray-700"
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
                className="h-11 border-2 border-black bg-white pr-10 text-base sm:text-sm font-medium"
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

          <div className="space-y-1.5">
            <label
              htmlFor={`${formId}-confirm-password`}
              className="block text-xs font-black uppercase tracking-wider text-gray-700"
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
                className="h-11 border-2 border-black bg-white pr-10 text-base sm:text-sm font-medium"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 rounded-xl border-2 border-black bg-black text-white font-black text-sm hover:bg-gray-900 shadow-[3px_3px_0px_#F9D423] cursor-pointer"
          >
            {isSubmitting ? "Updating Password..." : "Update Password & Sign In"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LoggedInProfileDashboard({
  profile,
  isModalView = false,
  onNavigateAway,
}: {
  profile: UserProfile;
  isModalView?: boolean;
  onNavigateAway?: () => void;
}) {
  const { updateProfile, refreshProfile, signOut } = useAuth();
  const { toast } = useToast();
  const editFormId = useId();

  const [isEditing, setIsEditing] = useState(false);
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

    window.addEventListener("solgames:profile-sync", handleSync);
    window.addEventListener("solgames:auth-changed", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      isMounted = false;
      window.removeEventListener("solgames:profile-sync", handleSync);
      window.removeEventListener("solgames:auth-changed", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [profile.createdBoardIds]);

  const c5 = profile.connect5Stats;
  const t21 = profile.twentyOneStats;
  const c5WinRate = c5.played > 0 ? Math.round((c5.won / c5.played) * 100) : 0;
  const c5AvgSeconds = computeAverageSolveTime(c5);
  const c5Strip = buildLast7DaysStrip(c5.completedDates);
  const t21Strip = buildLast7DaysStrip(t21.completedDates);
  const totalCreatedCount = Math.max(
    profile.boardsCreatedCount,
    createdBoards.length
  );

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
        setIsEditing(false);
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
    <div className="space-y-5">
      {/* NYT Games-Style Account Header Card */}
      <div className="rounded-2xl border-2 border-black bg-[#FCFCFD] p-4 sm:p-5 shadow-[4px_4px_0px_#000]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              style={{ backgroundColor: profile.avatarColor }}
              className={cn(
                "flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-full border-2 border-black font-headline text-xl sm:text-2xl font-black shadow-[2px_2px_0px_#000]",
                getAvatarTextClass(profile.avatarColor)
              )}
            >
              {getInitials(profile.displayName, profile.email)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-headline text-lg sm:text-xl font-black text-black truncate">
                  {profile.displayName}
                </h3>
                <span className="font-mono text-xs font-bold text-gray-600">
                  {formattedHandle}
                </span>
              </div>
              <p className="text-xs text-gray-600 truncate mt-0.5">
                {profile.email}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="border-black bg-white text-[11px] font-bold text-black"
                >
                  Member since {formatMemberSince(profile.memberSince)}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-black text-[11px] font-bold flex items-center gap-1",
                    profile.authMode === "supabase"
                      ? "bg-emerald-100 text-emerald-950"
                      : "bg-[#FFFBE6] text-black"
                  )}
                >
                  {profile.authMode === "supabase" ? (
                    <>
                      <Cloud className="h-3 w-3" />
                      Synced · Cloud
                    </>
                  ) : (
                    <>
                      <Smartphone className="h-3 w-3" />
                      Synced · Device
                    </>
                  )}
                </Badge>
                {saveFeedback && (
                  <span className="text-[11px] font-bold text-emerald-700">
                    ✓ {saveFeedback}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!isEditing) {
                  setEditDisplayName(profile.displayName);
                  setEditHandle(profile.handle);
                  setEditAvatarColor(profile.avatarColor);
                }
                setIsEditing((prev) => !prev);
              }}
              className="border-2 border-black bg-white text-xs font-black text-black hover:bg-gray-100"
            >
              <Edit3 className="h-3.5 w-3.5 mr-1.5" />
              {isEditing ? "Cancel" : "Edit Profile"}
            </Button>
          </div>
        </div>

        {/* Inline Edit Profile Drawer */}
        {isEditing && (
          <form
            onSubmit={handleSaveProfileEdit}
            className="mt-4 pt-4 border-t-2 border-black/10 space-y-3.5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  className="h-10 border-2 border-black bg-white text-base sm:text-sm font-semibold"
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
                  className="h-10 border-2 border-black bg-white text-base sm:text-sm font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="block text-[11px] font-black uppercase tracking-wider text-gray-700">
                Avatar Color Swatch
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                {AVATAR_COLOR_OPTIONS.map((option) => {
                  const selected = editAvatarColor === option.color;
                  return (
                    <button
                      key={option.color}
                      type="button"
                      onClick={() => setEditAvatarColor(option.color)}
                      style={{ backgroundColor: option.color }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border-2 border-black px-3 py-1 text-xs font-black transition-all",
                        option.textClass,
                        selected
                          ? "ring-2 ring-black ring-offset-2 scale-105"
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
                onClick={() => setIsEditing(false)}
                className="border-2 border-black font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingEdit}
                className="border-2 border-black bg-[#2ECC71] text-black hover:bg-[#27ae60] font-black text-xs"
              >
                {isSavingEdit ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Section Title: Your Stats & Streaks */}
      <div className="flex items-center justify-between">
        <h4 className="font-headline text-base sm:text-lg font-black text-black flex items-center gap-2">
          <Trophy className="h-5 w-5 text-[#F9D423]" />
          Your Stats &amp; Streaks
        </h4>
        <span className="text-xs font-semibold text-gray-500">
          Auto-synced across games
        </span>
      </div>

      {/* Two Game Stats Cards */}
      <div className="grid grid-cols-1 gap-4">
        {/* 1. CONNECT 5 CARD */}
        <div className="rounded-2xl border-2 border-black bg-white p-4 sm:p-5 shadow-[3px_3px_0px_#000] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 border-black bg-[#2ECC71] font-headline text-sm font-black text-black">
                C5
              </span>
              <div>
                <h5 className="font-headline text-base font-black text-black leading-tight">
                  Connect 5
                </h5>
                <p className="text-[11px] text-gray-500 font-medium">
                  Daily 5-Word Compound Chain
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="border-2 border-black bg-[#FFFBE6] text-black font-black text-xs px-2.5 py-0.5">
                <Flame className="h-3.5 w-3.5 text-orange-500 mr-1 fill-orange-500" />
                {c5.currentStreak} Streak
              </Badge>
              <Link
                href="/games/connect-5"
                onClick={onNavigateAway}
                className="inline-flex items-center gap-1 rounded-lg border-2 border-black bg-[#2ECC71] px-2.5 py-1 text-xs font-black text-black hover:bg-[#27ae60] transition-colors"
              >
                Play
                <Play className="h-3 w-3 fill-current" />
              </Link>
            </div>
          </div>

          {/* 6 Stat Metrics for Connect 5 */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            <div className="rounded-xl border border-black/15 bg-gray-50 p-2.5">
              <div className="font-headline text-lg sm:text-xl font-black text-black">
                {c5.played}
              </div>
              <div className="text-[10px] font-bold uppercase text-gray-500">
                Played
              </div>
            </div>
            <div className="rounded-xl border border-black/15 bg-gray-50 p-2.5">
              <div className="font-headline text-lg sm:text-xl font-black text-black">
                {c5WinRate}%
              </div>
              <div className="text-[10px] font-bold uppercase text-gray-500">
                Win %
              </div>
            </div>
            <div className="rounded-xl border border-black/15 bg-[#FFFBE6] p-2.5">
              <div className="font-headline text-lg sm:text-xl font-black text-black">
                {c5.currentStreak} 🔥
              </div>
              <div className="text-[10px] font-bold uppercase text-gray-600">
                Current
              </div>
            </div>
            <div className="rounded-xl border border-black/15 bg-gray-50 p-2.5">
              <div className="font-headline text-lg sm:text-xl font-black text-black">
                {c5.maxStreak}
              </div>
              <div className="text-[10px] font-bold uppercase text-gray-500">
                Max Streak
              </div>
            </div>
            <div className="rounded-xl border border-black/15 bg-emerald-50/70 p-2.5">
              <div className="font-mono text-base sm:text-lg font-black text-black">
                {formatSolveTime(c5.bestTimeSeconds)}
              </div>
              <div className="text-[10px] font-bold uppercase text-gray-600">
                Fastest
              </div>
            </div>
            <div className="rounded-xl border border-black/15 bg-gray-50 p-2.5">
              <div className="font-mono text-base sm:text-lg font-black text-black">
                {formatSolveTime(c5AvgSeconds)}
              </div>
              <div className="text-[10px] font-bold uppercase text-gray-500">
                Avg Time
              </div>
            </div>
          </div>

          {/* Last 7 Days Completion Strip */}
          <div className="rounded-xl border border-black/15 bg-gray-50/80 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-600">
                Last 7 Days Completion Strip
              </span>
              <Link
                href="/games/connect-5/archive"
                onClick={onNavigateAway}
                className="text-[11px] font-bold text-black underline hover:text-[#2ECC71]"
              >
                Full Archive →
              </Link>
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {c5Strip.map((item) => (
                <div
                  key={item.dateKey}
                  title={item.shortLabel}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-black transition-all",
                      item.completed
                        ? "border-black bg-[#2ECC71] text-black shadow-[1px_1px_0px_#000]"
                        : item.isToday
                        ? "border-black border-dashed bg-white text-gray-400"
                        : "border-gray-300 bg-white text-gray-300"
                    )}
                  >
                    {item.completed ? "✓" : "·"}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold",
                      item.isToday ? "text-black underline" : "text-gray-500"
                    )}
                  >
                    {item.dayInitial}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. 21 THINGS CARD */}
        <div className="rounded-2xl border-2 border-black bg-white p-4 sm:p-5 shadow-[3px_3px_0px_#000] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 border-black bg-[#daa8d0] font-headline text-sm font-black text-black">
                21
              </span>
              <div>
                <h5 className="font-headline text-base font-black text-black leading-tight">
                  21 Things
                </h5>
                <p className="text-[11px] text-gray-500 font-medium">
                  21 → 6 → 3 → 1 Social Gratitude Funnel
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="border-2 border-black bg-[#FFFBE6] text-black font-black text-xs px-2.5 py-0.5">
                <Flame className="h-3.5 w-3.5 text-orange-500 mr-1 fill-orange-500" />
                {t21.currentStreak} Streak
              </Badge>
              <Link
                href="/games/21-things"
                onClick={onNavigateAway}
                className="inline-flex items-center gap-1 rounded-lg border-2 border-black bg-[#daa8d0] px-2.5 py-1 text-xs font-black text-black hover:bg-[#c992be] transition-colors"
              >
                Play
                <Play className="h-3 w-3 fill-current" />
              </Link>
            </div>
          </div>

          {/* 4 Stat Metrics for 21 Things */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="rounded-xl border border-black/15 bg-gray-50 p-2.5">
              <div className="font-headline text-lg sm:text-xl font-black text-black">
                {t21.won}
              </div>
              <div className="text-[10px] font-bold uppercase text-gray-500">
                Boards Completed
              </div>
            </div>
            <div className="rounded-xl border border-black/15 bg-[#FFFBE6] p-2.5">
              <div className="font-headline text-lg sm:text-xl font-black text-black">
                {t21.currentStreak} 🔥
              </div>
              <div className="text-[10px] font-bold uppercase text-gray-600">
                Current Streak
              </div>
            </div>
            <div className="rounded-xl border border-black/15 bg-gray-50 p-2.5">
              <div className="font-headline text-lg sm:text-xl font-black text-black">
                {t21.maxStreak}
              </div>
              <div className="text-[10px] font-bold uppercase text-gray-500">
                Max Streak
              </div>
            </div>
            <div className="rounded-xl border border-black/15 bg-[#f7eef5] p-2.5">
              <div className="font-headline text-lg sm:text-xl font-black text-black">
                {totalCreatedCount}
              </div>
              <div className="text-[10px] font-bold uppercase text-gray-600">
                Boards Created
              </div>
            </div>
          </div>

          {/* Last 7 Days Completion Strip for 21 Things */}
          <div className="rounded-xl border border-black/15 bg-gray-50/80 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-600">
                Last 7 Days Completion Strip
              </span>
              <Link
                href="/games/21-things/archive"
                onClick={onNavigateAway}
                className="text-[11px] font-bold text-black underline hover:text-[#9D50BB]"
              >
                Full Archive →
              </Link>
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {t21Strip.map((item) => (
                <div
                  key={item.dateKey}
                  title={item.shortLabel}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-black transition-all",
                      item.completed
                        ? "border-black bg-[#2ECC71] text-black shadow-[1px_1px_0px_#000]"
                        : item.isToday
                        ? "border-black border-dashed bg-white text-gray-400"
                        : "border-gray-300 bg-white text-gray-300"
                    )}
                  >
                    {item.completed ? "✓" : "·"}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold",
                      item.isToday ? "text-black underline" : "text-gray-500"
                    )}
                  >
                    {item.dayInitial}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent #1 Resonance Picks */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-gray-700">
                Recent #1 Resonance Picks ({profile.recentPicks.length})
              </span>
            </div>

            {profile.recentPicks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600 flex items-center justify-between gap-2">
                <span>
                  Complete a 21 → 6 → 3 → 1 board to save your #1 resonance
                  picks here.
                </span>
                <Link
                  href="/games/21-things"
                  onClick={onNavigateAway}
                  className="shrink-0 font-black text-black underline"
                >
                  Play Now →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {profile.recentPicks
                  .slice(0, isModalView ? 3 : 8)
                  .map((pick, idx) => (
                    <div
                      key={`${pick.boardId}-${pick.pick1Item}-${idx}`}
                      className="rounded-xl border-2 border-black/15 bg-[#f7eef5]/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center rounded-md border border-black bg-[#F9D423] px-2 py-0.5 text-xs font-black text-black">
                            #1 · {pick.pick1Item}
                          </span>
                          <span className="text-[11px] font-bold text-gray-600 truncate">
                            {pick.boardTitle}
                          </span>
                        </div>
                        {pick.reflectionNote && (
                          <p className="text-xs italic text-gray-700 line-clamp-2">
                            &ldquo;{pick.reflectionNote}&rdquo;
                          </p>
                        )}
                      </div>
                      <Link
                        href={buildResonancePickHref(pick)}
                        onClick={onNavigateAway}
                        className="shrink-0 self-start sm:self-center inline-flex items-center gap-1 rounded-lg border border-black bg-white px-2.5 py-1 text-[11px] font-black text-black hover:bg-gray-100"
                      >
                        Board →
                      </Link>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* My Created 21 Things Boards */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-gray-700">
                My Created 21 Things Boards ({createdBoards.length})
              </span>
              <Link
                href="/games/21-things?mode=create"
                onClick={onNavigateAway}
                className="inline-flex items-center gap-1 text-xs font-black text-[#9D50BB] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Board
              </Link>
            </div>

            {createdBoards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600 flex items-center justify-between gap-2">
                <span>
                  Voice-brainstorm or type your own 21 Things board to share
                  with friends.
                </span>
                <Link
                  href="/games/21-things?mode=create"
                  onClick={onNavigateAway}
                  className="shrink-0 font-black text-black underline"
                >
                  Create →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {createdBoards
                  .slice(0, isModalView ? 3 : 10)
                  .map((createdBoard) => {
                    const isCopied = copiedBoardId === createdBoard.id;
                    return (
                      <div
                        key={createdBoard.id}
                        className="rounded-xl border-2 border-black/15 bg-gray-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0">
                          <div className="font-headline text-sm font-black text-black truncate">
                            {createdBoard.title}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            By {createdBoard.creatorName} · 21 Tiles
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyBoardLink(createdBoard)}
                            className="inline-flex items-center gap-1 rounded-lg border-2 border-black bg-white px-2.5 py-1 text-xs font-black text-black hover:bg-gray-100 transition-colors"
                          >
                            {isCopied ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                Copy Link
                              </>
                            )}
                          </button>

                          <Link
                            href={buildBoardPlayHref(createdBoard)}
                            onClick={onNavigateAway}
                            className="inline-flex items-center gap-1 rounded-lg border-2 border-black bg-[#F9D423] px-2.5 py-1 text-xs font-black text-black hover:bg-[#f0c808] transition-colors"
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
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t-2 border-black/10">
        {isModalView ? (
          <Link
            href="/account"
            onClick={onNavigateAway}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-black underline hover:text-[#9D50BB]"
          >
            Open Full Profile Page →
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-black underline hover:text-[#9D50BB]"
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
            className="border-2 border-black bg-white text-xs font-black text-black hover:bg-gray-100"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5 mr-1.5", isSyncing && "animate-spin")}
            />
            {isSyncing ? "Syncing..." : "Sync Now"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSignOutClick}
            className="border-2 border-black bg-white text-xs font-black text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
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
      <DialogContent className="max-w-2xl p-5 sm:p-6">
        <DialogHeader className="text-left">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#9D50BB] mb-1">
            <UserCheck className="h-3.5 w-3.5" />
            SOL Theory Games · Account &amp; Profile
          </div>
          <DialogTitle className="font-headline text-xl sm:text-2xl font-black text-black">
            {profile
              ? `${profile.displayName}'s Player Profile`
              : "Log in or create a free SOL Theory account"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-gray-600">
            {profile
              ? "Your NYT Games-style daily streaks, solve times, and 21 Things resonance boards."
              : "Save your daily streaks, solve times, and 21 Things boards across all your devices."}
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
