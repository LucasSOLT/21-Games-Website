"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Flame } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { GameLogo } from "@/components/game-logo";
import {
  GAME_COUNTDOWN_NUMBER,
  GAME_PROGRESS_PREFIX,
  isAllGameSlug,
  type AllGameSlug,
  type GameColor,
  type GameConfig,
} from "@/lib/games-config";
import { getGameStats, isDateCompleted } from "@/lib/game-storage";
import { useLiveLocalDateKey } from "@/hooks/use-live-date-key";
import { playTapSfx } from "@/lib/game-sfx";
import { cn } from "@/lib/utils";

export { GameLogo };
export type Game = GameConfig;

const todayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});
const subscribeNoop = () => () => {};
const getTodayLabel = () => todayFormatter.format(new Date());
const getServerTodayLabel = () => "\u00A0";

function useTodayLabel(): string {
  return useSyncExternalStore(subscribeNoop, getTodayLabel, getServerTodayLabel);
}

type CardTodayStatus = "unplayed" | "in-progress" | "solved";

interface CardLiveSnapshot {
  hydrated: boolean;
  status: CardTodayStatus;
  currentStreak: number;
}

function hasSavedInProgressForToday(
  slug: AllGameSlug,
  todayKey: string
): boolean {
  if (typeof window === "undefined" || !todayKey) return false;
  try {
    if (
      window.localStorage.getItem(
        `solgames_v1_revealed_${slug}_${todayKey}`
      ) === "1"
    ) {
      return false;
    }

    const candidateKeys: string[] = [
      `${GAME_PROGRESS_PREFIX[slug]}${todayKey}`,
      `solgames_v1_progress_${slug}_${todayKey}`,
    ];

    if (slug === "21-things") {
      candidateKeys.push(`solgames_21things_session_${todayKey}`);
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (
          k &&
          k.startsWith("solgames_v1_21t_progress_") &&
          k.includes(todayKey)
        ) {
          candidateKeys.push(k);
        }
      }
    } else if (slug === "connect-5") {
      candidateKeys.push(`solgames_c5_progress_${todayKey}`);
    } else if (slug === "17-syllables") {
      candidateKeys.push(`solgames_17s_progress_${todayKey}`);
    }

    for (const key of candidateKeys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown> | null;
        if (!parsed || typeof parsed !== "object") continue;
        if (
          parsed.status === "won" ||
          parsed.status === "complete" ||
          parsed.phase === "complete" ||
          parsed.completed === true ||
          parsed.wasRevealed === true
        ) {
          continue;
        }
        if (Object.keys(parsed).length > 0) {
          return true;
        }
      } catch {
        if (raw.trim().length > 0) return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function readCardLiveSnapshot(
  slug: string,
  todayKey: string
): CardLiveSnapshot {
  if (typeof window === "undefined" || !isAllGameSlug(slug)) {
    return { hydrated: false, status: "unplayed", currentStreak: 0 };
  }
  const stats = getGameStats(slug);
  if (isDateCompleted(slug, todayKey)) {
    return {
      hydrated: true,
      status: "solved",
      currentStreak: stats.currentStreak || 0,
    };
  }
  if (hasSavedInProgressForToday(slug, todayKey)) {
    return {
      hydrated: true,
      status: "in-progress",
      currentStreak: stats.currentStreak || 0,
    };
  }
  return {
    hydrated: true,
    status: "unplayed",
    currentStreak: stats.currentStreak || 0,
  };
}

interface GameCardProps {
  game: GameConfig;
  href?: string;
  className?: string;
  hideActions?: boolean;
  variant?: "default" | "featured";
  isCenter?: boolean;
  date?: string;
  author?: string;
}

const colorVariants: Record<GameColor, string> = {
  yellow: "bg-[#F9D423]",
  green: "bg-[#b6df52]",
  purple: "bg-[#9D50BB]",
  grey: "bg-[#e0e1d9]",
  customPurple: "bg-[#b4a8ff]",
  customYellow: "bg-[#F9F423]",
  customF4D621: "bg-[#f4d621]",
  customPurple2: "bg-[#daa8d0]",
  customYellow2: "bg-[#f7da21]",
};

export function GameCard({
  game,
  href,
  className,
  hideActions,
  variant = "default",
  isCenter = false,
  date,
  author = "SOL Theory",
}: GameCardProps) {
  const isPlayable = game.isPlayable;
  const gameHref = href ?? `/games/${game.slug}`;
  const archiveHref = `/games/${game.slug}/archive`;
  const today = useTodayLabel();
  const dateLabel = date ?? today;
  const todayKey = useLiveLocalDateKey();

  const countdownNumber = isAllGameSlug(game.slug)
    ? GAME_COUNTDOWN_NUMBER[game.slug]
    : null;

  const [snapshot, setSnapshot] = useState<CardLiveSnapshot>({
    hydrated: false,
    status: "unplayed",
    currentStreak: 0,
  });

  useEffect(() => {
    const refresh = () => {
      setSnapshot(readCardLiveSnapshot(game.slug, todayKey));
    };
    refresh();
    window.addEventListener("solgames:stats-updated", refresh);
    window.addEventListener("solgames:profile-sync", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("solgames:stats-updated", refresh);
      window.removeEventListener("solgames:profile-sync", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [game.slug, todayKey]);

  const { hydrated, status, currentStreak } = snapshot;

  const primaryCtaLabel =
    hydrated && status === "solved"
      ? "View Today's Board"
      : hydrated && status === "in-progress"
        ? countdownNumber !== null
          ? `Continue #${countdownNumber} →`
          : "Continue →"
        : "Play Now";

  if (variant === "featured") {
    if (isPlayable) {
      return (
        <Link
          href={gameHref}
          onClick={() => playTapSfx()}
          className={cn("block h-full group cursor-pointer", className)}
        >
          <Card
            className={cn(
              "relative h-full flex flex-col gap-0 py-0 ring-0 items-center justify-center pt-11 pb-5 px-4 sm:pt-12 sm:pb-6 sm:px-6 text-center border-2 border-black bg-white transition-all duration-200 group-hover:-translate-y-0.5",
              isCenter
                ? "shadow-[0_6px_0_#111111] group-hover:shadow-[0_8px_0_#111111]"
                : "shadow-[0_4px_0_#111111] group-hover:shadow-[0_6px_0_#111111]"
            )}
          >
            {countdownNumber !== null && (
              <span className="absolute top-3 left-3 inline-flex items-center justify-center rounded-lg border-2 border-black bg-[#171717] px-2.5 py-0.5 font-headline text-xs font-black tracking-tight text-[#F9D423] shadow-[2px_2px_0_rgba(0,0,0,0.2)]">
                #{countdownNumber}
              </span>
            )}
            {isCenter && (
              <span className="absolute top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-black bg-[#F9D423] px-3 py-0.5 text-[11px] font-headline font-black uppercase tracking-wider text-black shadow-[0_2px_0_#111111]">
                ★ Today&apos;s Spotlight
              </span>
            )}
            {hydrated && status === "solved" && (
              <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border-[1.5px] border-black bg-[#2ECC71] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-black">
                ✓ Solved Today
              </span>
            )}
            {hydrated && status === "in-progress" && (
              <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border-[1.5px] border-black bg-[#F9D423] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-black">
                In Progress
              </span>
            )}
            <GameLogo game={game} variant="featured" />
            <h2 className="text-2xl sm:text-3xl font-headline font-black mt-3 text-black">
              {game.name}
            </h2>
            <p className="text-base mt-1 text-gray-500">{dateLabel}</p>
            <div className="w-16 h-px bg-gray-300 my-2"></div>
            <p className="text-base text-gray-500">by {author}</p>
            <span
              className={cn(
                "mt-4 inline-flex items-center gap-1.5 rounded-full border-2 border-black px-5 py-2 text-sm font-headline font-black transition-colors",
                hydrated && status === "solved"
                  ? "bg-[#D1FAE5] text-black group-hover:bg-[#A7F3D0]"
                  : hydrated && status === "in-progress"
                    ? "bg-[#F9D423] text-black group-hover:bg-[#f2ca13]"
                    : "bg-black text-white group-hover:bg-gray-800"
              )}
            >
              {primaryCtaLabel}
            </span>
          </Card>
        </Link>
      );
    }
    return (
      <div className={cn("block h-full group cursor-default", className)}>
        <Card className="relative h-full flex flex-col gap-0 py-0 ring-0 items-center justify-center pt-11 pb-5 px-4 sm:pt-12 sm:pb-6 sm:px-6 text-center border-2 border-black bg-white/95 shadow-[0_4px_0_rgba(17,17,17,0.2)] transition-all duration-200">
          {countdownNumber !== null && (
            <span className="absolute top-3 left-3 inline-flex items-center justify-center rounded-lg border-2 border-black bg-[#171717] px-2.5 py-0.5 font-headline text-xs font-black tracking-tight text-[#F9D423]">
              #{countdownNumber}
            </span>
          )}
          <GameLogo game={game} variant="featured" />
          <h2 className="text-2xl sm:text-3xl font-headline font-black mt-3 text-black">
            {game.name}
          </h2>
          <p className="text-base mt-1 text-gray-500">{dateLabel}</p>
          <div className="w-16 h-px bg-gray-300 my-2"></div>
          <p className="text-base text-gray-500">by {author}</p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border-2 border-gray-300 bg-gray-100 text-gray-500 px-5 py-2 text-sm font-headline font-black">
            Coming Soon
          </span>
        </Card>
      </div>
    );
  }

  const cardFaceContent = (
    <CardContent
      className={cn(
        "relative flex flex-col items-center justify-center min-h-[196px] sm:min-h-[232px] pt-10 pb-4 px-4 sm:pt-11 sm:pb-6 sm:px-6",
        !hideActions && "border-b-2 border-black",
        colorVariants[game.color]
      )}
    >
      {countdownNumber !== null && (
        <span
          aria-label={`Countdown number ${countdownNumber}`}
          className="absolute top-3 left-3 inline-flex items-center justify-center rounded-lg border-2 border-black bg-[#171717] px-2.5 py-0.5 font-headline text-xs sm:text-sm font-black tracking-tight text-[#F9D423] shadow-[2px_2px_0_rgba(0,0,0,0.22)]"
        >
          #{countdownNumber}
        </span>
      )}

      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {isPlayable && hydrated && currentStreak > 0 && (
          <span
            title={`${currentStreak}-day streak`}
            className="inline-flex items-center gap-0.5 rounded-full border-[1.5px] border-black bg-white px-2 py-0.5 text-[10px] font-black text-black shadow-2xs"
          >
            <Flame className="h-3 w-3 text-orange-500 fill-orange-500" />
            <span>{currentStreak}</span>
          </span>
        )}

        {!isPlayable ? (
          <span className="inline-flex items-center rounded-full border border-black/20 bg-white/75 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black/60">
            Soon
          </span>
        ) : hydrated && status === "solved" ? (
          <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-black bg-[#2ECC71] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-black shadow-[1.5px_1.5px_0_#111111]">
            ✓ Solved Today
          </span>
        ) : hydrated && status === "in-progress" ? (
          <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-black bg-[#F9D423] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-black shadow-[1.5px_1.5px_0_#111111]">
            <span className="h-1.5 w-1.5 rounded-full bg-black" />
            In Progress
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-black bg-white/95 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-black shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2ECC71]" />
            Daily
          </span>
        )}
      </div>

      <GameLogo game={game} variant="default" />
      <h2 className="font-headline font-black text-xl sm:text-2xl mt-3 text-black text-center">
        {game.name}
      </h2>
      <p className="text-xs font-medium text-black/80 mt-1 text-center">
        {game.tagline}
      </p>
    </CardContent>
  );

  return (
    <Card
      className={cn(
        "h-full flex flex-col gap-0 py-0 ring-0 overflow-hidden rounded-xl border-2 border-black bg-white shadow-[0_3px_0_#111111] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_0_#111111]",
        className
      )}
    >
      {isPlayable && !hideActions ? (
        <Link
          href={gameHref}
          onClick={() => playTapSfx()}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
        >
          {cardFaceContent}
        </Link>
      ) : (
        cardFaceContent
      )}

      {!hideActions && (
        <CardFooter className="flex flex-col items-stretch justify-between gap-2 p-3.5 sm:p-4 bg-white flex-1 border-t-0">
          {isPlayable ? (
            <div className="grid grid-cols-[1fr_auto] sm:flex sm:flex-col gap-2 w-full">
              <Link
                href={gameHref}
                onClick={() => playTapSfx()}
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "w-full border-2 border-black font-headline font-black text-sm sm:text-base select-none min-h-[44px] px-3",
                  hydrated && status === "solved"
                    ? "bg-[#D1FAE5] text-black hover:bg-[#A7F3D0]"
                    : hydrated && status === "in-progress"
                      ? "bg-[#F9D423] text-black hover:bg-[#f2ca13]"
                      : "bg-black text-white hover:bg-gray-800"
                )}
              >
                {primaryCtaLabel}
              </Link>
              <Link
                href={archiveHref}
                onClick={() => playTapSfx(0.95)}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "sm:w-full border-2 border-black bg-white text-black hover:bg-gray-50 font-headline font-black text-sm sm:text-base select-none min-h-[44px] px-3.5"
                )}
              >
                Archive
              </Link>
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                disabled
                className="w-full border-2 border-gray-300 bg-gray-50 text-gray-500 font-headline font-black text-base select-none min-h-[44px] disabled:opacity-100 cursor-not-allowed"
              >
                Coming Soon
              </Button>
              <div className="w-full flex items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-50/70 px-3 text-center text-xs leading-tight text-gray-500 min-h-[44px] line-clamp-2">
                {game.description}
              </div>
            </>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
