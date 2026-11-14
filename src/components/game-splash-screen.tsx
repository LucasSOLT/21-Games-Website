"use client";

import React from "react";
import { GameLogo } from "@/components/game-logo";
import { formatLongDate, getLocalDateKey } from "@/lib/daily-engine";
import { Play, RotateCcw, Award, PlusCircle, Sparkles, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GameSplashScreenProps {
  gameSlug: string;
  gameTitle: string;
  tagline: string;
  theme?: string;
  author?: string;
  puzzleNumber?: number;
  dateKey?: string;
  showCreate?: boolean;
  isCompletedToday?: boolean;
  hasSavedProgress?: boolean;
  onPlay: () => void;
  onCreate?: () => void;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Universal NYT-Style Pre-Game Splash Screen (<GameSplashScreen>)
 * Per GAME_DESIGN_BIBLE.md Section 0.1 & Q2.
 * Renders a minimalist, editorial card with the custom vector GameLogo,
 * formatted date, theme/author attribution, primary Play/Continue/See Results button,
 * and optional "Create Your Own" button.
 */
export function GameSplashScreen({
  gameSlug,
  gameTitle,
  tagline,
  theme,
  author,
  puzzleNumber,
  dateKey = getLocalDateKey(),
  showCreate = false,
  isCompletedToday = false,
  hasSavedProgress = false,
  onPlay,
  onCreate,
  children,
  className,
}: GameSplashScreenProps) {
  const formattedDate = formatLongDate(dateKey);

  const primaryLabel = isCompletedToday
    ? "See Results"
    : hasSavedProgress
    ? "Continue"
    : "Play";

  const PrimaryIcon = isCompletedToday
    ? Award
    : hasSavedProgress
    ? RotateCcw
    : Play;

  return (
    <div
      className={cn(
        "min-h-[75vh] w-full flex items-center justify-center p-3 sm:p-6",
        className
      )}
    >
      <div className="max-w-md w-full bg-white border-2 border-black rounded-3xl p-6 sm:p-8 shadow-[0_6px_0_#111111] text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Featured Vector Emblem */}
        <div className="flex justify-center pt-2">
          <div className="relative group">
            <GameLogo
              logo={gameSlug}
              variant="featured"
              className="drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
            />
          </div>
        </div>

        {/* Title, Tagline & Puzzle Number */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <h1 className="font-headline font-black text-2xl sm:text-3xl text-black tracking-tight">
              {gameTitle}
            </h1>
            {puzzleNumber !== undefined && puzzleNumber > 0 && (
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-300 text-neutral-700">
                #{puzzleNumber}
              </span>
            )}
          </div>
          <p className="text-sm sm:text-base text-neutral-600 font-medium leading-snug">
            {tagline}
          </p>
        </div>

        {/* Date & Attribution Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-50 border border-neutral-200 text-xs font-semibold text-neutral-700">
            <Calendar className="w-3.5 h-3.5 text-neutral-500" />
            <span>{formattedDate}</span>
          </div>

          {theme && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Theme: {theme}</span>
            </div>
          )}

          {author && !theme && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-50 border border-neutral-200 text-xs font-semibold text-neutral-600">
              <span>By {author}</span>
            </div>
          )}
        </div>

        {children && <div>{children}</div>}

        {/* Action Buttons */}
        <div className="pt-2 space-y-3">
          <button
            type="button"
            onClick={onPlay}
            className="w-full py-3.5 px-6 bg-black text-white hover:bg-neutral-800 active:bg-neutral-900 rounded-full font-bold text-base border-2 border-black transition-all shadow-[0_3px_0_#111111] hover:shadow-[0_1px_0_#111111] hover:translate-y-0.5 active:translate-y-1 active:shadow-none flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <PrimaryIcon className="w-4 h-4 fill-current" />
            <span>{primaryLabel}</span>
          </button>

          {showCreate && onCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="w-full py-3 px-6 bg-white text-black hover:bg-neutral-50 active:bg-neutral-100 rounded-full font-bold text-sm border-2 border-neutral-300 hover:border-black transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Your Own</span>
            </button>
          )}
        </div>

        {/* Footer Credit */}
        {author && theme && (
          <p className="text-[11px] text-neutral-400 font-medium">
            Curated by {author} · SOL GaMES Editorial Desk
          </p>
        )}
      </div>
    </div>
  );
}
