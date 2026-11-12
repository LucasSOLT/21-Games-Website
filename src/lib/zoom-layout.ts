/**
 * 21 Things accessibility zoom layout (Step 5 / R6).
 *
 * The 21-tile board defaults to a compact 3-column grid. Players on small
 * screens (or with older / visually-impaired eyes) can switch to a zoomed
 * 2-column grid with larger, more square tiles. The preference persists in
 * localStorage and is shared across tabs via a lightweight custom event.
 */

export type ZoomColumns = 3 | 2;

export const ZOOM_COLUMNS_STORAGE_KEY = "solgames_v1_21t_cols";
export const ZOOM_COLUMNS_EVENT = "solgames:21t-cols-changed";
export const DEFAULT_ZOOM_COLUMNS: ZoomColumns = 3;

/** Safely parses a persisted value; anything unrecognised falls back to 3 columns. */
export function parseZoomColumns(raw: unknown): ZoomColumns {
  const value = typeof raw === "string" ? raw.trim() : raw;
  if (value === 2 || value === "2") return 2;
  return DEFAULT_ZOOM_COLUMNS;
}

export function readZoomColumns(): ZoomColumns {
  if (typeof window === "undefined") return DEFAULT_ZOOM_COLUMNS;
  try {
    return parseZoomColumns(window.localStorage.getItem(ZOOM_COLUMNS_STORAGE_KEY));
  } catch {
    return DEFAULT_ZOOM_COLUMNS;
  }
}

export function writeZoomColumns(cols: ZoomColumns): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ZOOM_COLUMNS_STORAGE_KEY, String(cols));
  } catch {
    /* storage unavailable — preference stays in-memory only for this session */
  }
  try {
    window.dispatchEvent(new Event(ZOOM_COLUMNS_EVENT));
  } catch {
    /* ignore */
  }
}

export function subscribeZoomColumns(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === ZOOM_COLUMNS_STORAGE_KEY) onChange();
  };
  window.addEventListener(ZOOM_COLUMNS_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ZOOM_COLUMNS_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Tailwind classes for the board grid container in each zoom mode. */
export function getZoomGridClasses(cols: ZoomColumns): string {
  return cols === 2
    ? "grid grid-cols-2 gap-2 min-[375px]:gap-2.5 sm:gap-3 select-none"
    : "grid grid-cols-3 gap-1 min-[375px]:gap-1.5 sm:gap-2.5 select-none";
}

/**
 * Tailwind classes for a tile's sizing + typography in each zoom mode.
 * 2-col: near-square tiles (aspect 5/4, grows when text needs room), crisp 15–18px
 * type with tight tracking/leading, balanced wrapping and no line clamping so very
 * long phrases wrap gracefully instead of clipping.
 */
export function getZoomTileSizeClasses(cols: ZoomColumns): string {
  return cols === 2
    ? "aspect-[5/4] min-h-[76px] rounded-2xl border-2 px-2.5 py-2 sm:px-4 sm:py-3"
    : "min-h-[45px] sm:min-h-[64px] rounded-xl border-2 px-1 py-0.5 min-[375px]:px-1.5 min-[375px]:py-1 sm:px-3 sm:py-2";
}

export function getZoomTextClasses(cols: ZoomColumns): string {
  return cols === 2
    ? "text-[15px] leading-[1.18] tracking-tight min-[375px]:text-base sm:text-lg sm:leading-[1.2] font-bold break-words [text-wrap:balance] hyphens-auto"
    : "text-[9.5px] leading-[1.1] min-[375px]:text-[10.5px] min-[375px]:leading-[1.15] sm:text-sm sm:leading-tight font-bold sm:line-clamp-2 break-words";
}
