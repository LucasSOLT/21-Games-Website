"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { GameLogo } from "@/components/game-logo";
import { type GameColor, type GameConfig } from "@/lib/games-config";
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

  if (variant === "featured") {
    if (isPlayable) {
      return (
        <Link
          href={gameHref}
          className={cn("block h-full group cursor-pointer", className)}
        >
          <Card
            className={cn(
              "relative h-full flex flex-col gap-0 py-0 ring-0 items-center justify-center pt-9 pb-5 px-4 sm:pt-11 sm:pb-6 sm:px-6 text-center border-2 border-black bg-white transition-all duration-200 group-hover:-translate-y-0.5",
              isCenter
                ? "shadow-[0_6px_0_#111111] group-hover:shadow-[0_8px_0_#111111]"
                : "shadow-[0_4px_0_#111111] group-hover:shadow-[0_6px_0_#111111]"
            )}
          >
            {isCenter && (
              <span className="absolute top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-black bg-[#F9D423] px-3 py-0.5 text-[11px] font-headline font-black uppercase tracking-wider text-black shadow-[0_2px_0_#111111]">
                ★ Today&apos;s Spotlight
              </span>
            )}
            <GameLogo game={game} variant="featured" />
            <h2 className="text-2xl sm:text-3xl font-headline font-black mt-3 text-black">
              {game.name}
            </h2>
            <p className="text-base mt-1 text-gray-500">{dateLabel}</p>
            <div className="w-16 h-px bg-gray-300 my-2"></div>
            <p className="text-base text-gray-500">by {author}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-black text-white px-5 py-2 text-sm font-headline font-black group-hover:bg-gray-800 transition-colors">
              Play Today&apos;s Puzzle <span className="text-[#F9D423]">→</span>
            </span>
          </Card>
        </Link>
      );
    }
    return (
      <div className={cn("block h-full group cursor-default", className)}>
        <Card className="relative h-full flex flex-col gap-0 py-0 ring-0 items-center justify-center pt-9 pb-5 px-4 sm:pt-11 sm:pb-6 sm:px-6 text-center border-2 border-black bg-white/95 shadow-[0_4px_0_rgba(17,17,17,0.2)] transition-all duration-200">
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

  return (
    <Card
      className={cn(
        "h-full flex flex-col gap-0 py-0 ring-0 overflow-hidden rounded-xl border-2 border-black bg-white shadow-[0_3px_0_#111111] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_0_#111111]",
        className
      )}
    >
      <CardContent
        className={cn(
          "relative flex flex-col items-center justify-center h-[185px] sm:h-[225px] p-4 sm:p-6",
          !hideActions && "border-b-2 border-black",
          colorVariants[game.color]
        )}
      >
        {isPlayable ? (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border border-black bg-white/95 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-black shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2ECC71]" />
            Daily
          </span>
        ) : (
          <span className="absolute top-3 right-3 inline-flex items-center rounded-full border border-black/20 bg-white/75 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black/60">
            Soon
          </span>
        )}
        <GameLogo game={game} variant="default" />
        <h2 className="font-headline font-black text-xl sm:text-2xl mt-3.5 text-black">
          {game.name}
        </h2>
        <p className="text-xs font-medium text-black/75 mt-1 text-center">
          {game.tagline}
        </p>
      </CardContent>
      {!hideActions && (
        <CardFooter className="flex flex-col items-stretch justify-between gap-2 p-4 bg-white flex-1 border-t-0">
          {isPlayable ? (
            <div className="flex flex-row sm:flex-col gap-2 w-full">
              <Link
                href={gameHref}
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "flex-1 sm:w-full border-2 border-black bg-black text-white hover:bg-gray-800 font-headline font-black text-base sm:text-lg select-none min-h-[44px]"
                )}
              >
                Play
              </Link>
              <Link
                href={archiveHref}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "flex-1 sm:w-full border-2 border-black bg-white text-black hover:bg-gray-50 font-headline font-black text-base sm:text-lg select-none min-h-[44px]"
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
                className="w-full border-2 border-gray-300 bg-gray-50 text-gray-500 font-headline font-black text-lg select-none min-h-[44px] disabled:opacity-100 cursor-not-allowed"
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
