"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import Link from "next/link";

export interface GameErrorBoundaryProps {
  gameSlug: "21-things" | "connect-5";
  gameTitle: string;
  children: ReactNode;
  storageKeysToReset?: string[];
  onReset?: () => void;
  fallback?: ReactNode;
}

interface GameErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  resetIteration: number;
}

/**
 * Resilient React 19 Error Boundary for active playable games (Requirement R3).
 * Catches unhandled runtime render crashes, provides self-healing corrupted state
 * recovery by purging corrupt localStorage keys, and cleanly remounts children.
 */
export class GameErrorBoundary extends Component<
  GameErrorBoundaryProps,
  GameErrorBoundaryState
> {
  public override state: GameErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    resetIteration: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<GameErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[GameErrorBoundary] Caught runtime exception in '${this.props.gameSlug}' (${this.props.gameTitle}):`,
      error,
      errorInfo
    );
    this.setState({ errorInfo });
  }

  /**
   * State Recovery Routine:
   * 1. Purges corrupted progress keys from localStorage.
   * 2. Calls optional onReset handler.
   * 3. Increments resetIteration and clears error state to remount children.
   */
  public handleReset = (): void => {
    const { gameSlug, storageKeysToReset, onReset } = this.props;

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const prefix =
          gameSlug === "21-things"
            ? "solgames_v1_21t_progress_"
            : gameSlug === "connect-5"
            ? "solgames_v1_c5_progress_"
            : null;

        if (prefix) {
          const keysToRemove: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith(prefix)) {
              keysToRemove.push(key);
            }
          }
          for (const key of keysToRemove) {
            window.localStorage.removeItem(key);
          }
        }

        // Also purge any specific keys passed as props
        if (Array.isArray(storageKeysToReset)) {
          for (const key of storageKeysToReset) {
            window.localStorage.removeItem(key);
          }
        }
      } catch (storageError) {
        console.error(
          "[GameErrorBoundary] Failed to purge localStorage progress:",
          storageError
        );
      }
    }

    try {
      onReset?.();
    } catch (cbError) {
      console.error("[GameErrorBoundary] onReset callback failed:", cbError);
    }

    // Reset error state and increment resetIteration to remount children with clean key
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      resetIteration: prev.resetIteration + 1,
    }));
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { gameTitle } = this.props;

      return (
        <div className="min-h-[60vh] w-full flex items-center justify-center p-4 sm:p-6 bg-[#FAF8F5]">
          <div className="max-w-md w-full bg-white border-2 border-black rounded-2xl p-6 sm:p-8 shadow-[0_4px_0_#111111] text-center space-y-5">
            {/* Editorial Warning Emblem */}
            <div className="mx-auto w-14 h-14 rounded-full bg-[#FFC107]/20 border-2 border-black flex items-center justify-center text-black">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <div className="space-y-1.5">
              <h2 className="font-headline font-black text-2xl text-black tracking-tight">
                Game Hitch Recovered
              </h2>
              <p className="text-sm text-neutral-600 leading-relaxed">
                An unexpected hiccup occurred while rendering{" "}
                <strong>{gameTitle}</strong>. We can clear any corrupted local
                puzzle state and reload a clean board for you.
              </p>
            </div>

            {/* Primary Action: Self-Healing Reset */}
            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-3 px-4 bg-black text-white hover:bg-neutral-800 rounded-xl font-bold border-2 border-black transition-colors shadow-[0_2px_0_#111111] active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Reset Puzzle State &amp; Recover
              </button>

              <Link
                href="/"
                className="inline-block text-xs font-bold text-neutral-600 hover:text-black underline underline-offset-4"
              >
                Return to All Games
              </Link>
            </div>

            {/* Technical Collapse */}
            {this.state.error && (
              <details className="text-left text-xs text-neutral-500 bg-neutral-50 rounded-lg p-2.5 border border-neutral-200">
                <summary className="cursor-pointer font-mono font-medium hover:text-neutral-800 select-none">
                  Technical Details
                </summary>
                <p className="mt-1.5 font-mono break-all text-[11px] text-red-600">
                  {this.state.error.message || String(this.state.error)}
                </p>
              </details>
            )}
          </div>
        </div>
      );
    }

    // Remounts the children with a clean React key whenever resetIteration increments
    return (
      <React.Fragment key={this.state.resetIteration}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
