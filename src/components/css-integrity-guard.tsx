"use client";

import React, { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useNavigationScrollRestorer } from "@/lib/navigation-history";

const RELOAD_COOLDOWN_KEY = "solgames_css_reload_ts";
const RELOAD_COOLDOWN_MS = 20_000;

function triggerSafeHardReload(reason: string): void {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    const last = Number(window.sessionStorage.getItem(RELOAD_COOLDOWN_KEY) || "0");
    if (Number.isFinite(last) && now - last < RELOAD_COOLDOWN_MS) {
      return;
    }
    window.sessionStorage.setItem(RELOAD_COOLDOWN_KEY, String(now));
    console.warn(`[CssIntegrityGuard] Reloading after stale asset / CSS failure (${reason})`);
    window.location.reload();
  } catch {
    // Ignore storage restriction errors in strict private browsing
  }
}

/**
 * Self-healing guard against Vercel static-export deployment skew and stylesheet 404s.
 *
 * When a user keeps a browser tab open across a new Vercel deploy and navigates via <Link>,
 * evicted /_next/static/chunks/*.css or *.js files can 404 — which otherwise leaves raw
 * unstyled black text and floating SVGs. This guard detects failed CSS/chunk loads and
 * verifies a hidden `.hidden` Tailwind utility probe on every route transition, performing
 * at most one clean reload per 20 seconds when styles fail to apply.
 */
export function CssIntegrityGuard() {
  useNavigationScrollRestorer();
  const pathname = usePathname();
  const probeRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const handleResourceError = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target instanceof HTMLLinkElement && target.rel === "stylesheet") {
        if (target.href && target.href.includes("/_next/static/")) {
          triggerSafeHardReload(`stylesheet 404: ${target.href}`);
        }
      } else if (target instanceof HTMLScriptElement) {
        if (target.src && target.src.includes("/_next/static/chunks/")) {
          triggerSafeHardReload(`chunk script 404: ${target.src}`);
        }
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = String(event.reason?.message || event.reason || "");
      if (
        msg.includes("ChunkLoadError") ||
        msg.includes("Loading chunk") ||
        msg.includes("Failed to fetch dynamically imported module")
      ) {
        triggerSafeHardReload(`dynamic chunk rejection: ${msg.slice(0, 80)}`);
      }
    };

    window.addEventListener("error", handleResourceError, true);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("error", handleResourceError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const el = probeRef.current;
      if (!el || typeof window.getComputedStyle !== "function") return;
      // Only trigger if at least one Next stylesheet <link> is in <head> yet `.hidden` failed to apply
      const nextLinks = document.querySelectorAll('link[rel="stylesheet"][href*="/_next/static/"]');
      if (nextLinks.length === 0) return;
      const computed = window.getComputedStyle(el);
      if (computed.display !== "none") {
        triggerSafeHardReload(`tailwind .hidden probe display=${computed.display} on ${pathname}`);
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <span
      ref={probeRef}
      data-testid="css-integrity-probe"
      className="hidden"
      aria-hidden="true"
    />
  );
}
