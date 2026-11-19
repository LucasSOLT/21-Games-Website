"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";

interface WinFlourishProps {
  /** Trigger flourish when transitioning from false -> true (or mounted true). */
  active: boolean;
  /** Optional duration in ms before auto-unmounting particles (default 2200ms). */
  durationMs?: number;
}

interface BurstPiece {
  id: number;
  leftPct: number;
  delayMs: number;
  dxPx: number;
  dyPx: number;
  rotateDeg: number;
  color: string;
  shape: "star" | "tile" | "diamond";
}

const PALETTE = ["#F9D423", "#2ECC71", "#9D50BB", "#171717", "#FFFFFF"];

const PIECES: BurstPiece[] = Array.from({ length: 18 }, (_, idx) => {
  const spread = idx / 17;
  const centered = spread - 0.5;
  return {
    id: idx,
    leftPct: 18 + spread * 64,
    delayMs: (idx % 6) * 45,
    dxPx: Math.round(centered * 150 + ((idx % 3) - 1) * 18),
    dyPx: -95 - (idx % 5) * 26,
    rotateDeg: (idx % 2 === 0 ? 1 : -1) * (85 + idx * 14),
    color: PALETTE[idx % PALETTE.length],
    shape: idx % 3 === 0 ? "star" : idx % 3 === 1 ? "tile" : "diamond",
  };
});

function subscribeReducedMotion(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return true;
}

/**
 * Crisp, zero-layout-shift NYT-style victory flourish (`#F9D423`, `#2ECC71`, `#9D50BB`).
 * Renders fixed pointer-events-none geometric tiles & stars for ~2.2s and strictly
 * skips rendering when `prefers-reduced-motion: reduce` is enabled.
 */
export function WinFlourish({ active, durationMs = 2200 }: WinFlourishProps) {
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
  const [expired, setExpired] = useState(false);
  const [prevActive, setPrevActive] = useState(active);

  if (active !== prevActive) {
    setPrevActive(active);
    setExpired(false);
  }

  useEffect(() => {
    if (!active || prefersReducedMotion || typeof window === "undefined") {
      return;
    }
    const timer = window.setTimeout(() => setExpired(true), durationMs);
    return () => window.clearTimeout(timer);
  }, [active, durationMs, prefersReducedMotion]);

  if (!active || prefersReducedMotion || expired) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="win-flourish"
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      <style>{`
        @keyframes solWinBurst {
          0% {
            opacity: 0;
            transform: translate3d(0, 16px, 0) scale(0.45) rotate(0deg);
          }
          18% {
            opacity: 1;
            transform: translate3d(calc(var(--sol-dx) * 0.45), calc(var(--sol-dy) * 0.65), 0) scale(1.05) rotate(calc(var(--sol-rot) * 0.4));
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--sol-dx), calc(var(--sol-dy) + 140px), 0) scale(0.75) rotate(var(--sol-rot));
          }
        }
      `}</style>
      {PIECES.map((p) => (
        <span
          key={p.id}
          style={
            {
              left: `${p.leftPct}%`,
              top: "26%",
              animation: `solWinBurst 1550ms cubic-bezier(0.2, 0.8, 0.2, 1) ${p.delayMs}ms forwards`,
              "--sol-dx": `${p.dxPx}px`,
              "--sol-dy": `${p.dyPx}px`,
              "--sol-rot": `${p.rotateDeg}deg`,
            } as React.CSSProperties
          }
          className="absolute inline-flex items-center justify-center opacity-0"
        >
          {p.shape === "star" ? (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 1.8L12.4 6.8L17.9 7.6L13.9 11.4L14.9 16.9L10 14.3L5.1 16.9L6.1 11.4L2.1 7.6L7.6 6.8L10 1.8Z"
                fill={p.color}
                stroke="#171717"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          ) : p.shape === "tile" ? (
            <span
              style={{ backgroundColor: p.color }}
              className="block h-3.5 w-3.5 rounded-[3px] border-[1.8px] border-[#171717] shadow-[1.5px_1.5px_0px_#171717]"
            />
          ) : (
            <span
              style={{ backgroundColor: p.color }}
              className="block h-3 w-3 rotate-45 rounded-[2px] border-[1.8px] border-[#171717]"
            />
          )}
        </span>
      ))}
    </div>
  );
}
