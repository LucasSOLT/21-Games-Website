"use client";

import { useEffect, useState } from "react";
import { getLocalDateKey } from "@/lib/date-keys";

/**
 * Reactive local `YYYY-MM-DD` date key that automatically refreshes at local midnight
 * and whenever the browser tab regains visibility or window focus.
 */
export function useLiveLocalDateKey(): string {
  const [dateKey, setDateKey] = useState<string>(() => getLocalDateKey());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncDateKey = () => {
      const next = getLocalDateKey();
      setDateKey((prev) => (prev === next ? prev : next));
    };

    syncDateKey();

    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      2
    );
    const msUntilMidnight = Math.max(1_000, nextMidnight.getTime() - now.getTime());
    const midnightTimer = window.setTimeout(syncDateKey, msUntilMidnight);

    const onVisibility = () => {
      if (!document.hidden) syncDateKey();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", syncDateKey);

    return () => {
      window.clearTimeout(midnightTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", syncDateKey);
    };
  }, [dateKey]);

  return dateKey;
}

/**
 * Synchronous check used inside `1s` game timer intervals (`17 Syllables`,
 * `Eightfold Echo`, `Connect 5`) so elapsed solve time automatically pauses
 * whenever the browser tab is hidden OR any modal dialog (`?`, `Stats`,
 * `Settings`, `Check/Reveal`, `Daily Sweep`, `Account`) is open.
 */
export function isGameTimerExternallyPaused(): boolean {
  if (typeof document === "undefined") return false;
  if (document.hidden) return true;
  if (
    document.querySelector(
      '[data-game-dialog-open="true"], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [aria-modal="true"]'
    )
  ) {
    return true;
  }
  return false;
}
