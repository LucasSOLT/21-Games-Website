"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Trophy, X, Sparkles, CheckCircle2 } from "lucide-react";
import {
  ALL_GAMES,
  GAME_COUNTDOWN_NUMBER,
  type PlayableGameSlug,
} from "@/lib/games-config";
import {
  getDailySweepStatus,
  getGameStats,
  type DailySweepStatus,
} from "@/lib/game-storage";
import { getLocalDateKey } from "@/lib/date-keys";
import { playWinChimeSfx } from "@/lib/game-sfx";
import { ResultShareButtons } from "@/components/games/result-share-buttons";
import { WinFlourish } from "@/components/games/win-flourish";

const SWEEP_SHOWN_STORAGE_PREFIX = "solgames_v1_sweep_modal_shown_";

function buildSweepShareText(dateKey: string): string {
  const rows = ALL_GAMES.map((g) => {
    const slug = g.slug as PlayableGameSlug;
    const num = GAME_COUNTDOWN_NUMBER[slug];
    const stats = getGameStats(slug);
    const streakTag = stats.currentStreak > 1 ? ` (${stats.currentStreak}🔥)` : "";
    return `#${String(num).padStart(2, "0")} ${g.name}: 🟩${streakTag}`;
  });
  return [
    `🏆 21 Games · 9-for-9 Daily Sweep! (${dateKey})`,
    `21 → 17 → 9 → 8 → 6 → 5 → 4 → 2 → 1 ✨`,
    ...rows,
  ].join("\n");
}

/**
 * Celebratory `🏆 9-for-9 Daily Sweep!` modal.
 * Automatically opens once per day when `"solgames:daily-sweep-unlocked"` fires
 * (upon finishing the 9th daily game), and can also be opened on demand via
 * `window.dispatchEvent(new CustomEvent("solgames:open-daily-sweep"))`.
 */
export function DailySweepModal() {
  const [open, setOpen] = useState(false);
  const [sweep, setSweep] = useState<DailySweepStatus | null>(null);

  const refreshAndOpen = useCallback((force: boolean) => {
    const todayKey = getLocalDateKey();
    const status = getDailySweepStatus(todayKey);
    if (!status.isSweepComplete && !force) return;
    if (!force && typeof window !== "undefined") {
      try {
        const shownKey = `${SWEEP_SHOWN_STORAGE_PREFIX}${todayKey}`;
        if (window.localStorage.getItem(shownKey) === "1") {
          return;
        }
        window.localStorage.setItem(shownKey, "1");
      } catch {
        // Ignore storage errors
      }
    }
    setSweep(status);
    setOpen(true);
    playWinChimeSfx();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUnlocked = () => refreshAndOpen(false);
    const onManualOpen = () => refreshAndOpen(true);
    window.addEventListener("solgames:daily-sweep-unlocked", onUnlocked);
    window.addEventListener("solgames:open-daily-sweep", onManualOpen);
    return () => {
      window.removeEventListener("solgames:daily-sweep-unlocked", onUnlocked);
      window.removeEventListener("solgames:open-daily-sweep", onManualOpen);
    };
  }, [refreshAndOpen]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const dateKey = sweep?.dateKey ?? getLocalDateKey();
  const shareText = useMemo(
    () => (open ? buildSweepShareText(dateKey) : ""),
    [open, dateKey]
  );

  if (!open) return null;

  return (
    <>
      <WinFlourish active={open} durationMs={2600} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-sweep-title"
        data-game-dialog-open="true"
        data-testid="daily-sweep-modal"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
        onClick={() => setOpen(false)}
      >
        <div
          className="relative w-full max-w-md rounded-2xl border-[2.5px] border-[#171717] bg-[#FCFCFD] p-5 sm:p-6 shadow-[6px_6px_0px_#171717]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close Daily Sweep modal"
            className="absolute right-3.5 top-3.5 flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#171717] bg-white text-[#171717] hover:bg-neutral-100"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#171717] bg-[#F9D423] shadow-[2px_2px_0px_#171717]">
              <Trophy className="h-5 w-5 text-[#171717]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 rounded-full border border-[#171717] bg-[#2ECC71]/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#171717]">
                <Sparkles className="h-3 w-3" /> 21 → 1 Ritual Complete
              </div>
              <h2
                id="daily-sweep-title"
                className="mt-0.5 font-headline text-xl font-black tracking-tight text-[#171717]"
              >
                9-for-9 Daily Sweep!
              </h2>
            </div>
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-neutral-600">
            You completed every single puzzle in today&apos;s{" "}
            <span className="font-bold text-[#171717]">21 → 1</span> countdown (
            <span className="font-mono font-semibold">{dateKey}</span>).
          </p>

          <div className="mt-3.5 grid grid-cols-3 gap-1.5 rounded-xl border-2 border-[#171717] bg-white p-2.5">
            {ALL_GAMES.map((game) => {
              const num = GAME_COUNTDOWN_NUMBER[game.slug as PlayableGameSlug];
              return (
                <div
                  key={game.slug}
                  className="flex items-center gap-1.5 rounded-lg border border-[#171717]/20 bg-[#2ECC71]/15 px-2 py-1.5"
                >
                  <span className="inline-flex h-5 min-w-[1.35rem] items-center justify-center rounded border border-[#171717] bg-[#F9D423] px-1 font-headline text-[10px] font-black text-[#171717]">
                    {num}
                  </span>
                  <span className="truncate text-[11px] font-bold text-[#171717]">
                    {game.name}
                  </span>
                  <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-[#1c9950]" />
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <ResultShareButtons
              title="21 Games · 9-for-9 Daily Sweep!"
              text={shareText}
              url="https://21games.ai"
            />
          </div>
        </div>
      </div>
    </>
  );
}
