"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export interface NavHistoryEntry {
  routeKey: string;
  pathname: string;
  scrollY: number;
  ts: number;
}

export interface PendingScrollRestore {
  targetRouteKey: string;
  targetPathname: string;
  scrollY: number | null;
  anchorId?: string;
  expiresAt: number;
}

interface RouterLike {
  push: (href: string, options?: { scroll?: boolean }) => void;
  back: () => void;
}

const NAV_STACK_KEY = "solgames_nav_stack_v1";
const SCROLL_MAP_KEY = "solgames_scroll_map_v1";
const PENDING_RESTORE_KEY = "solgames_pending_scroll_restore_v1";
const MAX_STACK_ENTRIES = 40;

let inMemoryNavChanges = 0;
let lastNavigationClickTs = 0;
let activeRouteKeyRef = "";

export function getCurrentRouteKey(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname || "/"}${window.location.search || ""}`;
}

export function readScrollMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(SCROLL_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        out[k] = Math.round(v);
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeScrollMap(map: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SCROLL_MAP_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function readNavStack(): NavHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(NAV_STACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is NavHistoryEntry =>
        Boolean(e) &&
        typeof (e as NavHistoryEntry).routeKey === "string" &&
        typeof (e as NavHistoryEntry).pathname === "string" &&
        typeof (e as NavHistoryEntry).scrollY === "number"
    );
  } catch {
    return [];
  }
}

function writeNavStack(stack: NavHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      NAV_STACK_KEY,
      JSON.stringify(stack.slice(-MAX_STACK_ENTRIES))
    );
  } catch {
    // Ignore storage errors
  }
}

export function readPendingScrollRestore(): PendingScrollRestore | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_RESTORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingScrollRestore;
    if (
      !parsed ||
      typeof parsed.targetPathname !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (Date.now() > parsed.expiresAt) {
      window.sessionStorage.removeItem(PENDING_RESTORE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingScrollRestore(
  restore: PendingScrollRestore | null
): void {
  if (typeof window === "undefined") return;
  try {
    if (!restore) {
      window.sessionStorage.removeItem(PENDING_RESTORE_KEY);
    } else {
      window.sessionStorage.setItem(
        PENDING_RESTORE_KEY,
        JSON.stringify(restore)
      );
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Snapshots the current `window.scrollY` for `routeKey` into `sessionStorage`.
 * Guards against accidental `0` clobbering right after clicking a `<Link>` when
 * Next.js resets scroll during client route transitions.
 */
export function snapshotScrollPosition(
  explicitRouteKey?: string,
  forceEvenDuringLinkClick = false
): void {
  if (typeof window === "undefined") return;
  const routeKey = explicitRouteKey || activeRouteKeyRef || getCurrentRouteKey();
  const y = Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));

  const map = readScrollMap();
  const prevY = map[routeKey] ?? 0;

  // Prevent Next.js route-transition scroll-to-0 from overwriting a non-zero position
  if (
    !forceEvenDuringLinkClick &&
    y === 0 &&
    prevY > 40 &&
    Date.now() - lastNavigationClickTs < 600
  ) {
    return;
  }

  map[routeKey] = y;
  writeScrollMap(map);

  const stack = readNavStack();
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]!.routeKey === routeKey) {
      stack[i] = { ...stack[i]!, scrollY: y, ts: Date.now() };
      writeNavStack(stack);
      break;
    }
  }
}

export function recordRouteVisit(routeKey: string, pathname: string): void {
  if (typeof window === "undefined") return;
  const stack = readNavStack();
  const map = readScrollMap();
  const existingScroll = map[routeKey] ?? 0;
  const last = stack[stack.length - 1];

  if (last && last.routeKey === routeKey) {
    return;
  }

  stack.push({
    routeKey,
    pathname,
    scrollY: existingScroll,
    ts: Date.now(),
  });
  writeNavStack(stack);
  inMemoryNavChanges += 1;
}

/**
 * Navigates back to the exact previous in-app screen (e.g. Home `/`, Archive, Account)
 * and arms instant `window.scrollY` restoration so the user lands right where they left off.
 */
export function navigateBackToPreviousScreen(
  router: RouterLike,
  fallbackHref = "/",
  options?: { excludePathname?: string; gameSlug?: string }
): void {
  if (typeof window === "undefined") {
    router.push(fallbackHref, { scroll: false });
    return;
  }

  const currentPathname =
    options?.excludePathname || window.location.pathname || "";
  const stack = readNavStack();
  const scrollMap = readScrollMap();

  // Walk backwards to find the most recent screen outside the current screen/game
  let targetIdx = -1;
  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i]!;
    if (entry.pathname !== currentPathname) {
      targetIdx = i;
      break;
    }
  }

  try {
    if (window.history && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  } catch {
    // Ignore
  }

  if (targetIdx >= 0) {
    const target = stack[targetIdx]!;
    const savedY = scrollMap[target.routeKey] ?? target.scrollY ?? 0;
    const stepsBack = stack.length - 1 - targetIdx;

    // Trim popped entries from our stack so subsequent backs stay aligned
    writeNavStack(stack.slice(0, targetIdx + 1));

    writePendingScrollRestore({
      targetRouteKey: target.routeKey,
      targetPathname: target.pathname,
      scrollY: savedY,
      anchorId: options?.gameSlug ? `game-card-${options.gameSlug}` : undefined,
      expiresAt: Date.now() + 8_000,
    });

    if (
      stepsBack === 1 &&
      inMemoryNavChanges >= 2 &&
      (window.history?.length ?? 0) > 1
    ) {
      router.back();
      return;
    }

    router.push(target.routeKey, { scroll: false });
    return;
  }

  // Fallback when user opened a game URL directly in a fresh tab
  const fallbackPathname = fallbackHref.split("?")[0] || "/";
  const fallbackSavedY = scrollMap[fallbackHref] ?? null;

  writePendingScrollRestore({
    targetRouteKey: fallbackHref,
    targetPathname: fallbackPathname,
    scrollY: fallbackSavedY,
    anchorId: options?.gameSlug ? `game-card-${options.gameSlug}` : undefined,
    expiresAt: Date.now() + 8_000,
  });

  router.push(fallbackHref, { scroll: false });
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Global hook mounted once in root layout (`CssIntegrityGuard`) to:
 * 1. Track route history and pre-click scroll positions across all screens.
 * 2. Restore exact `window.scrollY` before paint (`useLayoutEffect`) + across dynamic
 *    hydration frames whenever returning via the top-left Back arrow or browser Back/swipe.
 */
export function useNavigationScrollRestorer(): void {
  const pathname = usePathname() || "/";
  const prevRouteKeyRef = useRef<string>("");

  // Global scroll + pre-link-click + popstate listeners
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {
      // Ignore
    }

    let rafId: number | null = null;
    const handleScroll = () => {
      // Do not overwrite saved scroll while a pending restoration is actively running
      if (readPendingScrollRestore()) return;
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        snapshotScrollPosition();
      });
    };

    const handlePreNavigationPointer = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== "function") return;
      const anchor = target.closest("a[href]");
      if (anchor) {
        const href = anchor.getAttribute("href") || "";
        if (href.startsWith("/") && !href.startsWith("//")) {
          // Snapshot exact scrollY right BEFORE Next.js starts navigating
          snapshotScrollPosition(activeRouteKeyRef || getCurrentRouteKey(), true);
          lastNavigationClickTs = Date.now();
        }
      }
    };

    const handlePopState = () => {
      const destRouteKey = getCurrentRouteKey();
      const destPathname = window.location.pathname || "/";
      const existingPending = readPendingScrollRestore();
      if (existingPending && existingPending.targetPathname === destPathname) {
        return;
      }
      const map = readScrollMap();
      const savedY = map[destRouteKey];
      if (typeof savedY === "number") {
        // Also trim navStack if the user used browser Back/swipe
        const stack = readNavStack();
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i]!.routeKey === destRouteKey) {
            writeNavStack(stack.slice(0, i + 1));
            break;
          }
        }
        writePendingScrollRestore({
          targetRouteKey: destRouteKey,
          targetPathname: destPathname,
          scrollY: savedY,
          expiresAt: Date.now() + 8_000,
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pointerdown", handlePreNavigationPointer, true);
    window.addEventListener("click", handlePreNavigationPointer, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pointerdown", handlePreNavigationPointer, true);
      window.removeEventListener("click", handlePreNavigationPointer, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Route transition & synchronous pre-paint scroll restoration
  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const currentRouteKey = `${pathname}${window.location.search || ""}`;
    activeRouteKeyRef = currentRouteKey;

    if (prevRouteKeyRef.current !== currentRouteKey) {
      prevRouteKeyRef.current = currentRouteKey;
      recordRouteVisit(currentRouteKey, pathname);
    }

    const pending = readPendingScrollRestore();
    if (!pending || pending.targetPathname !== pathname) {
      return;
    }

    let cancelledByUser = false;
    const cancelRestore = () => {
      cancelledByUser = true;
      writePendingScrollRestore(null);
    };

    const applyTargetScroll = () => {
      if (cancelledByUser) return;
      if (typeof pending.scrollY === "number") {
        window.scrollTo(0, pending.scrollY);
      } else if (pending.anchorId) {
        const el = document.getElementById(pending.anchorId);
        if (el) {
          const rect = el.getBoundingClientRect();
          const targetTop = Math.max(
            0,
            Math.round(rect.top + window.scrollY - window.innerHeight * 0.28)
          );
          window.scrollTo(0, targetTop);
        }
      }
    };

    // 1. Immediate pre-paint jump (zero top-of-page flash!)
    applyTargetScroll();

    const enforceDuringTransition = () => {
      if (cancelledByUser || typeof pending.scrollY !== "number") return;
      if (Math.abs(window.scrollY - pending.scrollY) > 2) {
        const maxScroll = Math.max(
          0,
          document.documentElement.scrollHeight - window.innerHeight
        );
        if (maxScroll >= Math.min(pending.scrollY, 80)) {
          window.scrollTo(0, Math.min(pending.scrollY, maxScroll));
        }
      }
    };

    const handleUserKeyCancel = (e: KeyboardEvent) => {
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "PageDown" ||
        e.key === "PageUp" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === " "
      ) {
        cancelRestore();
      }
    };

    // 2. Stabilize across hydration / image layout frames for ~320ms unless user scrolls
    window.addEventListener("wheel", cancelRestore, { passive: true });
    window.addEventListener("touchmove", cancelRestore, { passive: true });
    window.addEventListener("pointerdown", cancelRestore, { passive: true });
    window.addEventListener("keydown", handleUserKeyCancel);
    window.addEventListener("scroll", enforceDuringTransition, { passive: true });

    const raf1 = window.requestAnimationFrame(() => {
      applyTargetScroll();
    });
    const t1 = window.setTimeout(applyTargetScroll, 45);
    const t2 = window.setTimeout(applyTargetScroll, 120);
    const t3 = window.setTimeout(() => {
      applyTargetScroll();
      writePendingScrollRestore(null);
    }, 320);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && document.body) {
      ro = new ResizeObserver(() => {
        applyTargetScroll();
      });
      ro.observe(document.body);
    }

    return () => {
      window.cancelAnimationFrame(raf1);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.removeEventListener("wheel", cancelRestore);
      window.removeEventListener("touchmove", cancelRestore);
      window.removeEventListener("pointerdown", cancelRestore);
      window.removeEventListener("keydown", handleUserKeyCancel);
      window.removeEventListener("scroll", enforceDuringTransition);
      if (ro) ro.disconnect();
    };
  }, [pathname]);
}
