/**
 * Checkpoint 1 — 21 Things 3-col / 2-col accessibility zoom (R6).
 * Run: node --experimental-strip-types scripts/test-cp01-zoom.ts
 */
import fs from "node:fs";
import { register } from "node:module";
import { createKit } from "./test-kit.mjs";

register("./test-resolver.mjs", import.meta.url);

const kit = createKit("CP1: 21 Things zoom toggle");
const z = await import("@/lib/zoom-layout");

kit.eq(z.parseZoomColumns("2"), 2, "parse '2' -> 2");
kit.eq(z.parseZoomColumns(2), 2, "parse numeric 2 -> 2");
kit.eq(z.parseZoomColumns("3"), 3, "parse '3' -> 3");
kit.eq(z.parseZoomColumns(null), 3, "parse null -> default 3");
kit.eq(z.parseZoomColumns("garbage"), 3, "parse garbage -> default 3");
kit.eq(z.parseZoomColumns(" 2 "), 2, "parse trimmed ' 2 ' -> 2");

kit.assert(z.getZoomGridClasses(3).includes("grid-cols-3"), "3-col grid class");
kit.assert(z.getZoomGridClasses(2).includes("grid-cols-2"), "2-col grid class");
kit.assert(
  z.getZoomTileSizeClasses(2).includes("aspect-[5/4]"),
  "2-col tiles are near-square"
);
kit.assert(
  !z.getZoomTextClasses(2).includes("line-clamp"),
  "2-col text never line-clamps (no clipping of long phrases)"
);
kit.assert(
  z.getZoomTextClasses(2).includes("tracking-tight") &&
    z.getZoomTextClasses(2).includes("break-words"),
  "2-col text has tight tracking + graceful wrapping"
);

// localStorage persistence with a minimal window shim
const store = new Map<string, string>();
const listeners = new Map<string, Array<() => void>>();
const g = globalThis as unknown as Record<string, unknown>;
g.window = {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
  },
  dispatchEvent: (e: { type: string }) => {
    (listeners.get(e.type) ?? []).forEach((fn) => fn());
    return true;
  },
  addEventListener: (t: string, fn: () => void) => {
    listeners.set(t, [...(listeners.get(t) ?? []), fn]);
  },
  removeEventListener: (t: string, fn: () => void) => {
    listeners.set(t, (listeners.get(t) ?? []).filter((f) => f !== fn));
  },
};
g.Event = class {
  type: string;
  constructor(t: string) {
    this.type = t;
  }
};

kit.eq(z.readZoomColumns(), 3, "default read is 3 cols");
let notified = 0;
const unsub = z.subscribeZoomColumns(() => notified++);
z.writeZoomColumns(2);
kit.eq(z.readZoomColumns(), 2, "persisted 2 cols is read back");
kit.eq(store.get(z.ZOOM_COLUMNS_STORAGE_KEY), "2", "localStorage key written");
kit.eq(notified, 1, "subscribers notified on change");
unsub();
z.writeZoomColumns(3);
kit.eq(notified, 1, "unsubscribed listener not notified");
kit.eq(z.readZoomColumns(), 3, "switch back to 3 cols");

// Source wiring checks
const src = fs.readFileSync("src/components/games/twenty-one-things.tsx", "utf8");
kit.assert(src.includes('data-testid="zoom-cols-toggle"'), "toggle rendered in header slot");
kit.assert(src.includes("getZoomGridClasses(zoomCols)"), "grid uses zoom classes");
kit.assert(src.includes("getZoomTextClasses(zoomCols)"), "tile text uses zoom classes");

kit.finish();
