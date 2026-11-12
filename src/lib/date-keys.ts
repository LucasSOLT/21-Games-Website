/**
 * Pure, dependency-free date-key helpers (YYYY-MM-DD, browser-local timezone).
 * Kept separate from daily-engine.ts so puzzle sources/generators can import
 * them without creating an import cycle.
 */

export const LAUNCH_EPOCH = "2026-09-01";
export const ROTATION_ANCHOR = "2026-11-05";

/**
 * Formats a Date object as local YYYY-MM-DD (browser timezone).
 */
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into a local Date at noon (avoids DST boundary shifts).
 */
export function parseDateKeyToLocalNoon(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * Computes whole calendar days between two YYYY-MM-DD strings.
 */
export function daysBetweenDateKeys(startKey: string, endKey: string): number {
  const a = parseDateKeyToLocalNoon(startKey);
  const b = parseDateKeyToLocalNoon(endKey);
  const diffMs = b.getTime() - a.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Monotonically increasing daily puzzle number (#1, #2, ...).
 */
export function getPuzzleNumberForDate(dateKey: string = getLocalDateKey()): number {
  const diff = daysBetweenDateKeys(LAUNCH_EPOCH, dateKey);
  return diff >= 0 ? diff + 1 : Math.abs(diff) + 1;
}

/**
 * Returns deterministic rotation index into a bank of length `bankLength`.
 */
export function getRotationIndexForDate(
  dateKey: string,
  bankLength: number
): number {
  const diff = daysBetweenDateKeys(ROTATION_ANCHOR, dateKey);
  return ((diff % bankLength) + bankLength) % bankLength;
}

/**
 * Formats a YYYY-MM-DD date key like "Thursday, November 5" or "Nov. 5, 2026".
 */
export function formatLongDate(dateKey: string): string {
  const d = parseDateKeyToLocalNoon(dateKey);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
}

export function formatShortArchiveDate(dateKey: string): {
  dayName: string;
  dateFormatted: string;
} {
  const d = parseDateKeyToLocalNoon(dateKey);
  const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    d
  );
  const dateFormatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
  return { dayName, dateFormatted };
}

/**
 * Generates an array of past N date keys (including today at index 0) for Archive views.
 */
export function getPastDateKeys(
  daysCount: number = 60,
  fromDate: Date = new Date()
): string[] {
  const keys: string[] = [];
  for (let i = 0; i < daysCount; i++) {
    const d = new Date(
      fromDate.getFullYear(),
      fromDate.getMonth(),
      fromDate.getDate() - i,
      12,
      0,
      0
    );
    keys.push(getLocalDateKey(d));
  }
  return keys;
}

