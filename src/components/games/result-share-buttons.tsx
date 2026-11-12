"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import {
  copyResultsOnly,
  nativeShareResultsOnly,
  type ShareResultsOptions,
} from "@/lib/custom-game-share";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const COPIED_FEEDBACK_MS = 2000;

interface ResultShareButtonsProps {
  /** Share-sheet title. */
  title: string;
  /** Emoji + score summary (URL is appended automatically, never sent as a separate `url`). */
  text: string;
  /** Link to the game; embedded into the text so iOS/macOS Messages keeps emojis + score + link. */
  url?: string;
  className?: string;
  /** Layout: side-by-side (default) or stacked full-width. */
  stacked?: boolean;
}

/**
 * Universal completion-screen action row used by every game:
 *   - **Share**        → `nativeShareResultsOnly` (navigator.share, NEVER clipboard)
 *   - **Copy results** → `copyResultsOnly`        (clipboard only, NEVER navigator.share),
 *                        "Copied!" checkmark for 2000ms.
 */
export function ResultShareButtons({
  title,
  text,
  url,
  className,
  stacked = false,
}: ResultShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const options: ShareResultsOptions = { title, text, url };

  const handleShare = useCallback(async () => {
    await nativeShareResultsOnly(options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, text, url]);

  const handleCopy = useCallback(async () => {
    const { copied: ok } = await copyResultsOnly(options);
    if (ok && mountedRef.current) {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) setCopied(false);
        timerRef.current = null;
      }, COPIED_FEEDBACK_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, text, url]);

  return (
    <div className={cn("flex gap-2", stacked ? "flex-col" : "flex-row", className)}>
      <Button
        type="button"
        onClick={handleShare}
        data-testid="share-button"
        className="flex-1 bg-black text-white hover:bg-gray-800 border-2 border-black font-headline font-black text-xs h-10 px-3.5 sm:px-4"
      >
        <Share2 className="h-4 w-4 mr-1.5 shrink-0" />
        <span>Share</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={handleCopy}
        data-testid="copy-results-button"
        className={cn(
          "flex-1 border-2 border-black font-headline font-bold text-xs h-10 px-3.5 sm:px-4 transition-colors",
          copied
            ? "bg-[#2ECC71] text-black hover:bg-[#27b863]"
            : "bg-white text-black hover:bg-gray-100"
        )}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 mr-1.5 shrink-0" />
            <span>Copied!</span>
          </>
        ) : (
          <>
            <Copy className="h-4 w-4 mr-1.5 shrink-0" />
            <span>Copy results</span>
          </>
        )}
      </Button>
    </div>
  );
}
