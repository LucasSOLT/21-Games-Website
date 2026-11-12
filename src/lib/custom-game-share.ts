/**
 * Custom Game Sharing Utility (Web Share API + Clipboard Fallback + Attributed Blurb)
 * Architecture: SOL GaMES (21games.ai) — Milestone 3
 * Target location: src/lib/custom-game-share.ts
 */

import { toast } from "@/hooks/use-toast";
import { assetPath } from "@/lib/asset-path";

export interface ShareCustomGameOptions {
  title: string;
  shareUrl: string;
  creatorHandle?: string | null;
  creatorName?: string | null;
  gameName?: string;
  showToast?: boolean;
  toastTitle?: string;
  toastDescription?: string;
}

export interface ShareCustomGameResult {
  shared: boolean;
  copied: boolean;
  blurbWithUrl: string;
  blurbText: string;
  creatorUsername: string;
}

export interface ShareResultsOptions {
  title: string;
  text: string;
  url?: string;
  showToast?: boolean;
  toastTitle?: string;
  toastDescription?: string;
}

/**
 * Generates a clean, compact, URL-safe alphanumeric game ID (< 14 chars).
 * Format: 21t-<8 random alphanumeric chars>
 * Example: 21t-x7k9p2m4
 */
export function generateShortGameId(prefix = "21t"): string {
  const cleanPrefix = prefix.endsWith("-") ? prefix.slice(0, -1) : prefix;
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let rand = "";
  for (let i = 0; i < 8; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${cleanPrefix}-${rand}`;
}

/**
 * Builds the canonical short share URL for a custom 21 Things board.
 * Format: https://21games.ai/games/21-things?b=<id>
 */
export function buildBoardShareUrl(board: { id: string }): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://21games.ai";
  const path = assetPath("/games/21-things");
  return `${origin}${path}?b=${encodeURIComponent(board.id)}`;
}

/**
 * Builds the internal Next.js link href for a custom 21 Things board.
 */
export function buildBoardPlayHref(board: { id: string }): string {
  return `/games/21-things?b=${encodeURIComponent(board.id)}`;
}

/**
 * Builds the canonical short share URL for a custom 17 Syllables haiku.
 * Format: https://21games.ai/games/17-syllables?b=<id>
 */
export function build17SyllablesShareUrl(haiku: { id: string }): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://21games.ai";
  const path = assetPath("/games/17-syllables");
  return `${origin}${path}?b=${encodeURIComponent(haiku.id)}`;
}

/**
 * Builds the internal Next.js link href for a custom 17 Syllables haiku.
 */
export function build17SyllablesPlayHref(haiku: { id: string }): string {
  return `/games/17-syllables?b=${encodeURIComponent(haiku.id)}`;
}

/**
 * Encodes a custom 17 Syllables haiku into a compact URL-safe base64 string
 * for offline and instant sharing without backend roundtrips.
 */
export function encodeShareable17Haiku(haiku: {
  id: string;
  theme: string;
  creatorName: string;
  lines: [string, string, string];
}): string {
  try {
    const json = JSON.stringify({
      i: haiku.id,
      t: haiku.theme,
      c: haiku.creatorName,
      l: haiku.lines,
    });
    if (typeof window !== "undefined") {
      return btoa(encodeURIComponent(json));
    }
    return Buffer.from(encodeURIComponent(json), "utf-8").toString("base64");
  } catch {
    return "";
  }
}

/**
 * Decodes a custom 17 Syllables haiku from a compact token.
 */
export function decodeShareable17Haiku(
  token: string
): {
  id: string;
  theme: string;
  creatorName: string;
  lines: [string, string, string];
} | null {
  try {
    const raw =
      typeof window !== "undefined"
        ? decodeURIComponent(atob(token))
        : decodeURIComponent(Buffer.from(token, "base64").toString("utf-8"));
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.l) || parsed.l.length !== 3) {
      return null;
    }
    return {
      id: String(parsed.i || "17s-custom"),
      theme: String(parsed.t || "Custom Haiku"),
      creatorName: String(parsed.c || "Friend"),
      lines: [String(parsed.l[0]), String(parsed.l[1]), String(parsed.l[2])],
    };
  } catch {
    return null;
  }
}

/**
 * Extracts a clean username string without leading '@' or illegal characters.
 * Ensures consistent '@<username>' attribution in the share blurb.
 */
export function extractCleanUsername(
  creatorHandle?: string | null,
  creatorName?: string | null
): string {
  if (creatorHandle && creatorHandle.trim().length > 0) {
    const cleaned = creatorHandle.trim().replace(/^@+/, "");
    if (cleaned.length > 0) return cleaned;
  }
  if (creatorName && creatorName.trim().length > 0) {
    const cleaned = creatorName
      .trim()
      .replace(/^@+/, "")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    if (cleaned.length > 0) return cleaned;
  }
  return "creator";
}

/**
 * Formats the canonical attributed share blurb for custom games.
 * Format requirement:
 * "Play my 21 Things custom board \"<Title>\" by @<username> on SOL GaMES! <URL>"
 */
export function formatCustomGameBlurb(options: {
  title: string;
  creatorHandle?: string | null;
  creatorName?: string | null;
  shareUrl: string;
  gameName?: string;
}): {
  blurbWithUrl: string;
  blurbText: string;
  creatorUsername: string;
} {
  const username = extractCleanUsername(options.creatorHandle, options.creatorName);
  const cleanTitle = (options.title || "Custom Board").trim();
  const game = (options.gameName || "21 Things").trim();
  const url = (options.shareUrl || "").trim();

  const blurbText = `Play my ${game} custom board "${cleanTitle}" by @${username} on SOL GaMES!`;
  const blurbWithUrl = url ? `${blurbText} ${url}` : blurbText;

  return {
    blurbWithUrl,
    blurbText,
    creatorUsername: username,
  };
}

/**
 * Formats creator share blurb string matching dispatch interface.
 */
export function formatCreatorShareBlurb(options: {
  title: string;
  creatorName?: string | null;
  creatorHandle?: string | null;
  shareUrl: string;
  gameName?: string;
}): string {
  const { blurbWithUrl } = formatCustomGameBlurb(options);
  return blurbWithUrl;
}

/**
 * Resilient clipboard writer supporting modern Async Clipboard API and legacy fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // 1. Try modern async Clipboard API
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to document.execCommand fallback
    }
  }

  // 2. Fallback: document.execCommand('copy')
  if (typeof document !== "undefined" && document.body) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-999999px";
      textarea.style.top = "-999999px";
      textarea.setAttribute("readonly", "");
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (success) return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Triggers native Web Share API (navigator.share) when supported,
 * and copies the attributed creator blurb + URL to clipboard.
 * Gracefully handles user cancellations (AbortError) without error toasts.
 */
export async function shareCustomGame(
  options: ShareCustomGameOptions
): Promise<ShareCustomGameResult> {
  const { blurbWithUrl, blurbText, creatorUsername } = formatCustomGameBlurb({
    title: options.title,
    creatorHandle: options.creatorHandle,
    creatorName: options.creatorName,
    shareUrl: options.shareUrl,
    gameName: options.gameName,
  });

  // Always copy to clipboard
  const copied = await copyToClipboard(blurbWithUrl);

  let shared = false;
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  if (canNativeShare) {
    const shareData: ShareData = {
      title: `${options.title} — ${options.gameName || "21 Things"}`,
      text: blurbWithUrl,
    };

    const isShareSupported =
      typeof navigator.canShare !== "function" ||
      navigator.canShare(shareData);

    if (isShareSupported) {
      try {
        await navigator.share(shareData);
        shared = true;
      } catch (err: unknown) {
        // AbortError is standard when user dismisses the native share sheet
        const isAbort =
          (err instanceof Error && err.name === "AbortError") ||
          (typeof err === "object" &&
            err !== null &&
            "name" in err &&
            (err as { name: string }).name === "AbortError");

        if (!isAbort) {
          console.warn("navigator.share was rejected, clipboard fallback retained:", err);
        }
      }
    }
  }

  // Toast feedback
  if (options.showToast !== false) {
    if (shared) {
      toast({
        title: options.toastTitle || "Board Shared!",
        description:
          options.toastDescription ||
          "Share sheet opened and link copied to clipboard.",
      });
    } else {
      toast({
        title: options.toastTitle || "Link Copied to Clipboard!",
        description:
          options.toastDescription ||
          `Share blurb with @${creatorUsername} attribution is ready to paste.`,
      });
    }
  }

  return {
    shared,
    copied,
    blurbWithUrl,
    blurbText,
    creatorUsername,
  };
}

/**
 * Reusable helper for sharing game summary results (Connect 5 or 21 Things completion).
 */
export async function shareTextResult(options: {
  title: string;
  text: string;
  url?: string;
  showToast?: boolean;
  toastTitle?: string;
  toastDescription?: string;
}): Promise<{ shared: boolean; copied: boolean }> {
  const fullText = options.url ? `${options.text}\n${options.url}` : options.text;
  const copied = await copyToClipboard(fullText);

  let shared = false;
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const shareData: ShareData = {
      title: options.title,
      text: options.text,
      url: options.url,
    };

    if (!navigator.canShare || navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        shared = true;
      } catch (err: unknown) {
        const isAbort =
          err instanceof Error && err.name === "AbortError";
        if (!isAbort) {
          console.warn("navigator.share aborted or unavailable:", err);
        }
      }
    }
  }

  if (options.showToast !== false) {
    toast({
      title: options.toastTitle || (shared ? "Results Shared!" : "Results Copied!"),
      description:
        options.toastDescription ||
        (shared
          ? "Native share sheet opened."
          : "Your game summary has been copied to the clipboard."),
    });
  }

  return { shared, copied };
}

function formatResultsTextWithUrl(text: string, url?: string): string {
  const trimmedUrl = url?.trim();
  if (!trimmedUrl) {
    return text;
  }
  if (text.includes(trimmedUrl)) {
    return text;
  }
  return text.endsWith("\n") ? `${text}${trimmedUrl}` : `${text}\n${trimmedUrl}`;
}

function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") {
    return true;
  }
  if (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name?: unknown }).name === "AbortError"
  ) {
    return true;
  }
  return false;
}

function safeCanShare(data: ShareData): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") {
    return true;
  }
  try {
    return Boolean(navigator.canShare(data));
  } catch {
    return false;
  }
}

/**
 * Opens ONLY the native OS/device share sheet via Web Share API (`navigator.share`).
 * Strictly decoupled from clipboard operations: NEVER writes to the clipboard in any code path.
 */
export async function nativeShareResultsOnly(
  options: ShareResultsOptions
): Promise<{ shared: boolean; unsupported: boolean; aborted: boolean }> {
  const canUseWebShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  if (!canUseWebShare) {
    if (options.showToast !== false) {
      toast({
        title: options.toastTitle || "Native Share Unavailable",
        description:
          options.toastDescription ||
          'Your browser doesn\'t support native sharing. Click "Copy results" instead.',
      });
    }
    return { shared: false, unsupported: true, aborted: false };
  }

  const trimmedUrl = options.url?.trim();
  const fullText = formatResultsTextWithUrl(options.text, trimmedUrl);

  // When both text and url are passed as distinct keys in Web Share API, native
  // messengers (especially iOS Messages / iMessage) prioritize the url and discard
  // the text completely. To ensure emojis, scores, and links are all delivered,
  // we embed the URL inside text and pass { title: options.title, text: fullText } as primary payload.
  const primaryShareData: ShareData = {
    title: options.title,
    text: fullText,
  };

  const textOnlyShareData: ShareData = {
    text: fullText,
  };

  const separateUrlShareData: ShareData | null = trimmedUrl
    ? { title: options.title, text: options.text, url: trimmedUrl }
    : null;

  let payloadToShare: ShareData | null = null;
  if (typeof navigator.canShare === "function") {
    if (safeCanShare(primaryShareData)) {
      payloadToShare = primaryShareData;
    } else if (safeCanShare(textOnlyShareData)) {
      payloadToShare = textOnlyShareData;
    } else if (separateUrlShareData && safeCanShare(separateUrlShareData)) {
      payloadToShare = separateUrlShareData;
    }
  } else {
    payloadToShare = primaryShareData;
  }

  if (!payloadToShare) {
    if (options.showToast !== false) {
      toast({
        title: options.toastTitle || "Native Share Unavailable",
        description:
          options.toastDescription ||
          'Your browser doesn\'t support native sharing. Click "Copy results" instead.',
      });
    }
    return { shared: false, unsupported: true, aborted: false };
  }

  try {
    await navigator.share(payloadToShare);
    if (options.showToast !== false) {
      toast({
        title: options.toastTitle || "Shared!",
        description: options.toastDescription || "Opened native share sheet.",
      });
    }
    return { shared: true, unsupported: false, aborted: false };
  } catch (err: unknown) {
    if (isAbortError(err)) {
      return { shared: false, unsupported: false, aborted: true };
    }

    if (options.showToast !== false) {
      toast({
        title: options.toastTitle || "Native Share Unavailable",
        description:
          options.toastDescription ||
          'Your browser doesn\'t support native sharing. Click "Copy results" instead.',
      });
    }
    return { shared: false, unsupported: true, aborted: false };
  }
}

/**
 * Copies formatted game summary results (+ URL if not already present) ONLY to the clipboard.
 * Strictly decoupled from Web Share API: NEVER invokes `navigator.share` or `navigator.canShare`.
 */
export async function copyResultsOnly(
  options: ShareResultsOptions
): Promise<{ copied: boolean }> {
  const fullText = formatResultsTextWithUrl(options.text, options.url);
  const copied = await copyToClipboard(fullText);

  if (options.showToast !== false) {
    if (copied) {
      toast({
        title: options.toastTitle || "Results Copied!",
        description:
          options.toastDescription ||
          "Your game summary has been copied to the clipboard.",
      });
    } else {
      toast({
        title: "Copy Failed",
        description: "Could not copy results to the clipboard.",
      });
    }
  }

  return { copied };
}
