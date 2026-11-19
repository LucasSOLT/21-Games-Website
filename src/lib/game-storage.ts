import type { Connect5Puzzle } from "@/data/puzzles/connect-5";
import type {
  TwentyOneJourney,
  TwentyOneThingsBoard,
} from "@/data/puzzles/21-things";
import type { SeventeenSyllablesPuzzle } from "@/data/puzzles/17-syllables";
import { daysBetweenDateKeys, getLocalDateKey } from "@/lib/date-keys";
import {
  ALL_GAME_SLUGS,
  GAME_PROGRESS_PREFIX,
  type AllGameSlug,
  type PlayableGameSlug,
} from "@/lib/games-config";
import {
  isGenericOverrideSlugLight,
  sanitize17SyllablesPuzzle,
  sanitizeConnect5Puzzle,
  validateLightOverridePayload,
} from "@/lib/puzzle-sanitizers";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  check21ThingsBoardModeration,
  checkMultipleFields,
} from "@/lib/moderation";
import { computePuzzleContentHash } from "@/lib/seeded-random";
import {
  classifyDiagnosticError,
  type DiagnosticReport,
} from "@/lib/diagnostic-errors";
import { normalizeVoiceNoteDataUrl } from "@/lib/voice-note-audio";

const STORAGE_PREFIX = "solgames_v1";

export interface GameStats {
  played: number;
  won: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  lastCompletedDateKey: string | null;
  lastCompletedDate: string | null;
  bestTimeSeconds: number | null;
  totalTimeSeconds: number;
  completedDates: string[];
  /** Same-day daily solves (`dateKey === todayKey`) eligible for live `currentStreak`. */
  streakDates?: string[];
  distribution: Record<string, number>;
}

export type ProfileSyncEvent =
  | {
      type: "game_win";
      gameSlug: PlayableGameSlug;
      dateKey: string;
      stats: GameStats;
    }
  | {
      type: "journey_submitted";
      journey: TwentyOneJourney;
    }
  | {
      type: "board_created";
      board: TwentyOneThingsBoard;
    };

export type ProfileSyncCallback = (
  event: ProfileSyncEvent
) => void | Promise<void>;

const profileSyncListeners = new Set<ProfileSyncCallback>();

export function registerProfileSyncCallback(
  callback: ProfileSyncCallback
): () => void {
  profileSyncListeners.add(callback);
  return () => {
    profileSyncListeners.delete(callback);
  };
}

function notifyProfileSyncListeners(event: ProfileSyncEvent): void {
  for (const cb of profileSyncListeners) {
    try {
      void cb(event);
    } catch {
      // Ignore listener errors so gameplay is never interrupted
    }
  }
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("solgames:profile-sync", { detail: event })
      );
    } catch {
      // Ignore DOM event errors
    }
  }
}

export interface Connect5SavedProgress {
  dateKey: string;
  puzzleId: string;
  grid: string[][];
  slashed: boolean[][];
  revealedByHint: boolean[][];
  elapsedSeconds: number;
  hintsUsed: number;
  status: "playing" | "won";
  wasRevealed?: boolean;
  completedAt?: string;
  puzzleHash?: string;
}

export type TwentyOneFunnelPhase =
  | "pick6"
  | "pick3"
  | "pick1"
  | "reflect"
  | "complete";

export interface TwentyOneSavedProgress {
  boardId: string;
  phase: TwentyOneFunnelPhase;
  pick6Indices: number[];
  pick3Indices: number[];
  pick1Index: number | null;
  playerName: string;
  reflectionNote: string;
  voiceNoteDataUrl?: string;
  submittedJourneyId?: string;
  puzzleHash?: string;
}

export interface SeventeenSyllablesSavedProgress {
  dateKey: string;
  puzzleId: string;
  placedChunks: Record<string, string | null>;
  lockedChunks: Record<string, boolean>;
  remainingTrayChunks: string[];
  wordHintsUsed: number;
  tileHintsUsed: number;
  stars: number;
  elapsedSeconds: number;
  status: "playing" | "won";
  wasRevealed?: boolean;
  completedAt?: string;
  puzzleHash?: string;
}

function safeReadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors in private browsing
  }
}

// ============================================================================
// Game Stats, Streaks & Merge Engine
// ============================================================================

export const DEFAULT_STATS: GameStats = {
  played: 0,
  won: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastCompletedDateKey: null,
  lastCompletedDate: null,
  bestTimeSeconds: null,
  totalTimeSeconds: 0,
  completedDates: [],
  streakDates: [],
  distribution: {},
};

function sanitizeSortedDateArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .filter((d): d is string => typeof d === "string")
        .map((d) => d.trim())
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    )
  ).sort((a, b) => a.localeCompare(b));
}

export function recomputeStreakFromCompletedDates(
  completedDates: string[],
  todayKey: string = getLocalDateKey()
): {
  currentStreak: number;
  maxStreak: number;
  lastCompletedDate: string | null;
  lastCompletedDateKey: string | null;
} {
  if (!Array.isArray(completedDates) || completedDates.length === 0) {
    return {
      currentStreak: 0,
      maxStreak: 0,
      lastCompletedDate: null,
      lastCompletedDateKey: null,
    };
  }

  const uniqueSorted = sanitizeSortedDateArray(completedDates);

  if (uniqueSorted.length === 0) {
    return {
      currentStreak: 0,
      maxStreak: 0,
      lastCompletedDate: null,
      lastCompletedDateKey: null,
    };
  }

  let maxStreak = 1;
  let run = 1;
  for (let i = 1; i < uniqueSorted.length; i++) {
    const diff = daysBetweenDateKeys(uniqueSorted[i - 1]!, uniqueSorted[i]!);
    if (diff === 1) {
      run += 1;
      if (run > maxStreak) {
        maxStreak = run;
      }
    } else if (diff > 1) {
      run = 1;
    }
  }

  const lastCompletedDate = uniqueSorted[uniqueSorted.length - 1]!;
  let currentStreak = run;

  if (todayKey && /^\d{4}-\d{2}-\d{2}$/.test(todayKey.trim())) {
    const normalizedToday = todayKey.trim();
    const datesUpToToday = uniqueSorted.filter(
      (d) => d.localeCompare(normalizedToday) <= 0
    );
    if (datesUpToToday.length === 0) {
      currentStreak = 0;
    } else {
      const lastUpToToday = datesUpToToday[datesUpToToday.length - 1]!;
      const gapFromToday = daysBetweenDateKeys(lastUpToToday, normalizedToday);
      if (gapFromToday > 1) {
        currentStreak = 0;
      } else {
        let streakUpToToday = 1;
        for (let i = datesUpToToday.length - 1; i > 0; i--) {
          const diff = daysBetweenDateKeys(
            datesUpToToday[i - 1]!,
            datesUpToToday[i]!
          );
          if (diff === 1) {
            streakUpToToday += 1;
          } else if (diff > 1) {
            break;
          }
        }
        currentStreak = streakUpToToday;
      }
    }
  }

  return {
    currentStreak,
    maxStreak,
    lastCompletedDate,
    lastCompletedDateKey: lastCompletedDate,
  };
}

export function normalizeGameStats(
  raw?: Partial<GameStats> | null,
  todayKey: string = getLocalDateKey()
): GameStats {
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_STATS,
      completedDates: [],
      streakDates: [],
      distribution: {},
    };
  }

  const dates = sanitizeSortedDateArray(raw.completedDates).filter(
    (d) => d.localeCompare(todayKey) <= 0
  );
  const explicitStreakDates = Array.isArray(raw.streakDates)
    ? sanitizeSortedDateArray(raw.streakDates).filter(
        (d) => d.localeCompare(todayKey) <= 0
      )
    : dates;

  const rawLast = raw.lastCompletedDateKey ?? raw.lastCompletedDate ?? null;
  const streakInfo =
    explicitStreakDates.length > 0
      ? recomputeStreakFromCompletedDates(explicitStreakDates, todayKey)
      : {
          currentStreak:
            rawLast &&
            /^\d{4}-\d{2}-\d{2}$/.test(rawLast) &&
            daysBetweenDateKeys(rawLast, todayKey) >= 0 &&
            daysBetweenDateKeys(rawLast, todayKey) <= 1
              ? Math.max(0, Number(raw.currentStreak ?? 0) || 0)
              : 0,
          maxStreak: Math.max(0, Number(raw.maxStreak ?? 0) || 0),
          lastCompletedDate: rawLast,
        };

  const allDatesInfo =
    dates.length > 0 ? recomputeStreakFromCompletedDates(dates, todayKey) : null;

  const won = Math.max(
    Number(raw.won ?? 0) || 0,
    Number(raw.wins ?? 0) || 0,
    dates.length
  );
  const played = Math.max(Number(raw.played ?? 0) || 0, won, dates.length);
  const maxStreak = Math.max(
    Number(raw.maxStreak ?? 0) || 0,
    streakInfo.maxStreak
  );
  const currentStreak = streakInfo.currentStreak;
  const lastDate =
    allDatesInfo?.lastCompletedDate ??
    streakInfo.lastCompletedDate ??
    rawLast ??
    null;
  const bestTimeSeconds =
    typeof raw.bestTimeSeconds === "number" && raw.bestTimeSeconds > 0
      ? raw.bestTimeSeconds
      : null;
  const totalTimeSeconds = Math.max(0, Number(raw.totalTimeSeconds ?? 0) || 0);

  const distribution: Record<string, number> = {};
  if (raw.distribution && typeof raw.distribution === "object") {
    for (const [key, value] of Object.entries(raw.distribution)) {
      const n = Number(value);
      if (!Number.isNaN(n) && n >= 0) {
        distribution[key] = n;
      }
    }
  }

  return {
    played,
    won,
    wins: won,
    currentStreak,
    maxStreak,
    lastCompletedDateKey: lastDate,
    lastCompletedDate: lastDate,
    bestTimeSeconds,
    totalTimeSeconds,
    completedDates: dates,
    streakDates: explicitStreakDates,
    distribution,
  };
}

export function mergeTwoGameStats(
  a: Partial<GameStats> | GameStats,
  b: Partial<GameStats> | GameStats,
  todayKey: string = getLocalDateKey()
): GameStats {
  const normA = normalizeGameStats(a, todayKey);
  const normB = normalizeGameStats(b, todayKey);

  const mergedDates = Array.from(
    new Set([...normA.completedDates, ...normB.completedDates])
  ).sort((x, y) => x.localeCompare(y));

  const mergedStreakDates = Array.from(
    new Set([...(normA.streakDates ?? []), ...(normB.streakDates ?? [])])
  ).sort((x, y) => x.localeCompare(y));

  const streakInfo = recomputeStreakFromCompletedDates(
    mergedStreakDates,
    todayKey
  );
  const allDatesInfo =
    mergedDates.length > 0
      ? recomputeStreakFromCompletedDates(mergedDates, todayKey)
      : null;

  const mergedWins = Math.max(
    normA.won,
    normA.wins,
    normB.won,
    normB.wins,
    mergedDates.length
  );
  const mergedPlayed = Math.max(
    normA.played,
    normB.played,
    mergedWins,
    mergedDates.length
  );
  const mergedMaxStreak = Math.max(
    normA.maxStreak,
    normB.maxStreak,
    streakInfo.maxStreak
  );
  const mergedCurrentStreak =
    mergedStreakDates.length > 0
      ? streakInfo.currentStreak
      : Math.max(normA.currentStreak, normB.currentStreak);
  const lastDate =
    allDatesInfo?.lastCompletedDate ??
    streakInfo.lastCompletedDate ??
    normA.lastCompletedDateKey ??
    normB.lastCompletedDateKey ??
    null;

  let bestTimeSeconds: number | null = null;
  if (normA.bestTimeSeconds !== null && normB.bestTimeSeconds !== null) {
    bestTimeSeconds = Math.min(normA.bestTimeSeconds, normB.bestTimeSeconds);
  } else if (normA.bestTimeSeconds !== null) {
    bestTimeSeconds = normA.bestTimeSeconds;
  } else if (normB.bestTimeSeconds !== null) {
    bestTimeSeconds = normB.bestTimeSeconds;
  }

  const totalTimeSeconds = Math.max(
    normA.totalTimeSeconds,
    normB.totalTimeSeconds
  );

  const mergedDistribution: Record<string, number> = {
    ...normA.distribution,
  };
  for (const [key, val] of Object.entries(normB.distribution)) {
    if (
      key === "best_over_par_plus_100" &&
      mergedDistribution[key] !== undefined
    ) {
      mergedDistribution[key] = Math.min(mergedDistribution[key]!, val);
    } else {
      mergedDistribution[key] = Math.max(mergedDistribution[key] ?? 0, val);
    }
  }

  return {
    played: mergedPlayed,
    won: mergedWins,
    wins: mergedWins,
    currentStreak: mergedCurrentStreak,
    maxStreak: mergedMaxStreak,
    lastCompletedDateKey: lastDate,
    lastCompletedDate: lastDate,
    bestTimeSeconds,
    totalTimeSeconds,
    completedDates: mergedDates,
    streakDates: mergedStreakDates,
    distribution: mergedDistribution,
  };
}

export function getGameStats(gameSlug: PlayableGameSlug): GameStats {
  const raw = safeReadJson<Partial<GameStats>>(
    `${STORAGE_PREFIX}_stats_${gameSlug}`,
    DEFAULT_STATS
  );
  return normalizeGameStats(raw);
}

export function setGameStats(
  gameSlug: PlayableGameSlug,
  stats: Partial<GameStats> | GameStats
): void {
  const normalized = normalizeGameStats(stats);
  safeWriteJson(`${STORAGE_PREFIX}_stats_${gameSlug}`, normalized);
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("solgames:stats-updated", {
          detail: { gameSlug, stats: normalized },
        })
      );
    } catch {
      // Ignore event dispatch errors
    }
  }
}

export interface DailySweepStatus {
  dateKey: string;
  completedSlugs: AllGameSlug[];
  remainingSlugs: AllGameSlug[];
  completedCount: number;
  totalCount: number;
  isSweepComplete: boolean;
}

export function getDailySweepStatus(
  dateKey: string = getLocalDateKey()
): DailySweepStatus {
  const completedSlugs: AllGameSlug[] = [];
  const remainingSlugs: AllGameSlug[] = [];
  for (const slug of ALL_GAME_SLUGS) {
    if (isDateCompleted(slug, dateKey)) {
      completedSlugs.push(slug);
    } else {
      remainingSlugs.push(slug);
    }
  }
  return {
    dateKey,
    completedSlugs,
    remainingSlugs,
    completedCount: completedSlugs.length,
    totalCount: ALL_GAME_SLUGS.length,
    isSweepComplete: completedSlugs.length === ALL_GAME_SLUGS.length,
  };
}

/**
 * Records a revealed puzzle attempt ("Reveal Entire Puzzle" in Connect 5 / 17 Syllables).
 * Increments `played` and `distribution.revealed` WITHOUT awarding a daily win streak,
 * Archive completion checkmark, or "Fastest Solve" bestTimeSeconds.
 */
export function recordGameRevealed(
  gameSlug: PlayableGameSlug,
  dateKey: string = getLocalDateKey()
): GameStats {
  const todayKey = getLocalDateKey();
  const current = getGameStats(gameSlug);
  if (
    dateKey.localeCompare(todayKey) > 0 ||
    current.completedDates.includes(dateKey)
  ) {
    return current;
  }
  const revealedMarkerKey = `${STORAGE_PREFIX}_revealed_${gameSlug}_${dateKey}`;
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage.getItem(revealedMarkerKey) === "1") {
        return current;
      }
      window.localStorage.setItem(revealedMarkerKey, "1");
    } catch {
      // Ignore storage errors
    }
  }
  const nextDistribution = {
    ...current.distribution,
    revealed: (current.distribution.revealed ?? 0) + 1,
  };
  const updated: GameStats = {
    ...current,
    played: current.played + 1,
    distribution: nextDistribution,
  };
  setGameStats(gameSlug, updated);
  return updated;
}

export interface RecordGameWinOptions {
  isCustom?: boolean;
  isRevealed?: boolean;
  todayKey?: string;
  distributionMutator?: (distribution: Record<string, number>) => void;
}

export function recordGameWin(
  gameSlug: PlayableGameSlug,
  dateKey: string = getLocalDateKey(),
  elapsedSeconds: number = 0,
  options?: RecordGameWinOptions
): GameStats {
  if (options?.isCustom) {
    return getGameStats(gameSlug);
  }
  if (options?.isRevealed) {
    return recordGameRevealed(gameSlug, dateKey);
  }

  const todayKey = options?.todayKey ?? getLocalDateKey();
  if (dateKey.localeCompare(todayKey) > 0) {
    return getGameStats(gameSlug);
  }

  const current = getGameStats(gameSlug);
  if (current.completedDates.includes(dateKey)) {
    return current;
  }

  const nextDates = Array.from(
    new Set([...current.completedDates, dateKey])
  ).sort((a, b) => a.localeCompare(b));

  const isSameDayDaily = dateKey === todayKey;
  const baseStreakDates = current.streakDates ?? current.completedDates;
  const nextStreakDates = isSameDayDaily
    ? Array.from(new Set([...baseStreakDates, dateKey])).sort((a, b) =>
        a.localeCompare(b)
      )
    : [...baseStreakDates];

  const streakInfo = recomputeStreakFromCompletedDates(
    nextStreakDates,
    todayKey
  );
  const allDatesInfo = recomputeStreakFromCompletedDates(nextDates, todayKey);
  const nextWon = Math.max(current.won + 1, nextDates.length);
  const nextPlayed = Math.max(current.played + 1, nextWon);

  const nextDistribution: Record<string, number> = { ...current.distribution };
  options?.distributionMutator?.(nextDistribution);

  const updated: GameStats = {
    played: nextPlayed,
    won: nextWon,
    wins: nextWon,
    currentStreak: streakInfo.currentStreak,
    maxStreak: Math.max(current.maxStreak, streakInfo.maxStreak),
    lastCompletedDateKey:
      allDatesInfo.lastCompletedDate ?? streakInfo.lastCompletedDate ?? dateKey,
    lastCompletedDate:
      allDatesInfo.lastCompletedDate ?? streakInfo.lastCompletedDate ?? dateKey,
    bestTimeSeconds:
      elapsedSeconds > 0
        ? current.bestTimeSeconds === null
          ? elapsedSeconds
          : Math.min(current.bestTimeSeconds, elapsedSeconds)
        : current.bestTimeSeconds,
    totalTimeSeconds: current.totalTimeSeconds + Math.max(0, elapsedSeconds),
    completedDates: nextDates,
    streakDates: nextStreakDates,
    distribution: nextDistribution,
  };

  setGameStats(gameSlug, updated);
  notifyProfileSyncListeners({
    type: "game_win",
    gameSlug,
    dateKey,
    stats: updated,
  });

  if (isSameDayDaily && typeof window !== "undefined") {
    try {
      const sweep = getDailySweepStatus(todayKey);
      if (sweep.isSweepComplete) {
        window.dispatchEvent(
          new CustomEvent("solgames:daily-sweep-unlocked", {
            detail: { dateKey: todayKey, triggeredBy: gameSlug },
          })
        );
      }
    } catch {
      // Ignore event dispatch errors
    }
  }

  return updated;
}

export function isDateCompleted(
  gameSlug: PlayableGameSlug,
  dateKey: string
): boolean {
  const stats = getGameStats(gameSlug);
  return stats.completedDates.includes(dateKey);
}

export function clearAllLocalUserGameData(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const prefixes = [
      `${STORAGE_PREFIX}_stats_`,
      `${STORAGE_PREFIX}_revealed_`,
      `${STORAGE_PREFIX}_c5_progress_`,
      `${STORAGE_PREFIX}_17s_progress_`,
      `${STORAGE_PREFIX}_21t_progress_`,
      `${STORAGE_PREFIX}_21t_my_journeys`,
      `${STORAGE_PREFIX}_user_21boards`,
      "solgames_v1_1w_history",
      "solgames_v1_custom_puzzles_mine",
      ...Object.values(GAME_PROGRESS_PREFIX).filter((p): p is string =>
        Boolean(p)
      ),
    ];
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && prefixes.some((prefix) => k.startsWith(prefix))) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k);
    }
    window.dispatchEvent(new CustomEvent("solgames:stats-updated"));
  } catch {
    // Ignore private-mode storage errors
  }
}

// ============================================================================
// Connect 5 Progress Persistence
// ============================================================================

export function getConnect5Progress(
  dateKey: string,
  puzzleId: string
): Connect5SavedProgress | null {
  const saved = safeReadJson<Connect5SavedProgress | null>(
    `${STORAGE_PREFIX}_c5_progress_${dateKey}`,
    null
  );
  if (!saved || saved.puzzleId !== puzzleId) return null;
  return saved;
}

export function saveConnect5Progress(progress: Connect5SavedProgress): void {
  safeWriteJson(`${STORAGE_PREFIX}_c5_progress_${progress.dateKey}`, progress);
}

export function clearConnect5Progress(dateKey: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${STORAGE_PREFIX}_c5_progress_${dateKey}`);
}

// ============================================================================
// 17 Syllables Progress & Persistence
// ============================================================================

export function get17SyllablesProgress(
  dateKey: string,
  puzzleId: string
): SeventeenSyllablesSavedProgress | null {
  const saved = safeReadJson<SeventeenSyllablesSavedProgress | null>(
    `${STORAGE_PREFIX}_17s_progress_${dateKey}`,
    null
  );
  if (!saved || saved.puzzleId !== puzzleId) return null;
  return saved;
}

export function save17SyllablesProgress(
  progress: SeventeenSyllablesSavedProgress
): void {
  safeWriteJson(`${STORAGE_PREFIX}_17s_progress_${progress.dateKey}`, progress);
}

export function clear17SyllablesProgress(dateKey: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${STORAGE_PREFIX}_17s_progress_${dateKey}`);
}

export function record17SyllablesWin(
  dateKey: string,
  stars: number,
  elapsedSeconds: number,
  options?: { isCustom?: boolean; isRevealed?: boolean }
): GameStats {
  const starKey = `stars_${stars.toFixed(1)}`;
  return recordGameWin("17-syllables", dateKey, elapsedSeconds, {
    isCustom: options?.isCustom,
    isRevealed: options?.isRevealed,
    distributionMutator: (dist) => {
      dist[starKey] = (dist[starKey] ?? 0) + 1;
    },
  });
}

// ============================================================================
// 21 Things Progress & Journey Feed Persistence (Local + Supabase)
// ============================================================================

export function get21ThingsProgress(
  boardId: string
): TwentyOneSavedProgress | null {
  return safeReadJson<TwentyOneSavedProgress | null>(
    `${STORAGE_PREFIX}_21t_progress_${boardId}`,
    null
  );
}

export function save21ThingsProgress(progress: TwentyOneSavedProgress): void {
  safeWriteJson(`${STORAGE_PREFIX}_21t_progress_${progress.boardId}`, progress);
}

export function clear21ThingsProgress(boardId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${STORAGE_PREFIX}_21t_progress_${boardId}`);
}

export function getLocalBoardJourneys(boardId: string): TwentyOneJourney[] {
  return safeReadJson<TwentyOneJourney[]>(
    `${STORAGE_PREFIX}_21t_journeys_${boardId}`,
    []
  );
}

export function getAllLocalPlayerJourneys(): TwentyOneJourney[] {
  if (typeof window === "undefined") return [];
  const byId = new Map<string, TwentyOneJourney>();

  const mySaved = safeReadJson<TwentyOneJourney[]>(
    `${STORAGE_PREFIX}_21t_my_journeys`,
    []
  );
  for (const j of mySaved) {
    if (j && typeof j.id === "string" && j.pick1) {
      byId.set(j.id, j);
    }
  }

  try {
    const prefix = `${STORAGE_PREFIX}_21t_journeys_`;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const list = safeReadJson<TwentyOneJourney[]>(key, []);
        if (Array.isArray(list)) {
          for (const j of list) {
            if (j && typeof j.id === "string" && j.pick1 && !byId.has(j.id)) {
              byId.set(j.id, {
                ...j,
                voiceNoteDataUrl: normalizeVoiceNoteDataUrl(j.voiceNoteDataUrl),
              });
            }
          }
        }
      }
    }
  } catch {
    // Ignore storage enumeration errors
  }

  return Array.from(byId.values());
}

export async function fetchBoardJourneys(
  board: TwentyOneThingsBoard
): Promise<TwentyOneJourney[]> {
  const localJourneys = getLocalBoardJourneys(board.id);

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("twenty_one_responses")
          .select("*")
          .eq("board_id", board.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (!error && Array.isArray(data)) {
          const remoteJourneys: TwentyOneJourney[] = data.map((row) => ({
            id: String(row.id),
            boardId: String(row.board_id),
            playerName: String(row.player_name || "Friend"),
            pick6: Array.isArray(row.pick_6) ? row.pick_6.map(String) : [],
            pick3: Array.isArray(row.pick_3) ? row.pick_3.map(String) : [],
            pick1: String(row.pick_1 || ""),
            reflectionNote: String(row.reflection_note || ""),
            voiceNoteDataUrl: row.voice_note_url
              ? normalizeVoiceNoteDataUrl(String(row.voice_note_url))
              : undefined,
            createdAt: row.created_at
              ? new Date(String(row.created_at)).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "Just now",
          }));

          const mergedIds = new Set(remoteJourneys.map((j) => j.id));
          const combined = [
            ...remoteJourneys,
            ...localJourneys.filter((j) => !mergedIds.has(j.id)),
          ];
          return combined;
        }
      } catch {
        // Fallback cleanly to local journeys
      }
    }
  }

  return localJourneys;
}

export async function submitPlayerJourney(
  journey: Omit<TwentyOneJourney, "id" | "createdAt">
): Promise<TwentyOneJourney> {
  const isCustom =
    journey.boardId.startsWith("21t-") ||
    journey.boardId.startsWith("custom-") ||
    journey.boardId.startsWith("c_");
  const modCheck = checkMultipleFields(
    [
      { text: journey.playerName, field: "Player Name" },
      { text: journey.reflectionNote, field: "Reflection Note" },
    ],
    { mode: isCustom ? "private" : "public" }
  );
  if (!modCheck.allowed) {
    throw new Error(modCheck.reason || "Content moderation rejected submission.");
  }

  const normalizedVoiceUrl = normalizeVoiceNoteDataUrl(journey.voiceNoteDataUrl);
  const newEntry: TwentyOneJourney = {
    ...journey,
    voiceNoteDataUrl: normalizedVoiceUrl,
    id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: "Just now",
  };

  const existing = getLocalBoardJourneys(journey.boardId);
  safeWriteJson(`${STORAGE_PREFIX}_21t_journeys_${journey.boardId}`, [
    newEntry,
    ...existing,
  ]);

  const myJourneys = safeReadJson<TwentyOneJourney[]>(
    `${STORAGE_PREFIX}_21t_my_journeys`,
    []
  );
  safeWriteJson(`${STORAGE_PREFIX}_21t_my_journeys`, [
    newEntry,
    ...myJourneys.filter((j) => j.id !== newEntry.id),
  ]);

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase.from("twenty_one_responses").insert({
          board_id: journey.boardId,
          player_name: journey.playerName,
          pick_6: journey.pick6,
          pick_3: journey.pick3,
          pick_1: journey.pick1,
          reflection_note: journey.reflectionNote,
          voice_note_url: normalizedVoiceUrl ?? null,
        });
        if (error && normalizedVoiceUrl) {
          // Ensure text reflection still lands remotely even if audio payload hit a remote limit
          await supabase.from("twenty_one_responses").insert({
            board_id: journey.boardId,
            player_name: journey.playerName,
            pick_6: journey.pick6,
            pick_3: journey.pick3,
            pick_1: journey.pick1,
            reflection_note: journey.reflectionNote,
            voice_note_url: null,
          });
        }
      } catch {
        // Already persisted locally
      }
    }
  }

  notifyProfileSyncListeners({
    type: "journey_submitted",
    journey: newEntry,
  });

  return newEntry;
}

// ============================================================================
// Custom User-Created 21 Things Boards & Admin Overrides (Local + Supabase)
// ============================================================================

export function getSavedUser21Boards(): TwentyOneThingsBoard[] {
  return safeReadJson<TwentyOneThingsBoard[]>(
    `${STORAGE_PREFIX}_user_21boards`,
    []
  );
}

export function getUserCreated21Boards(): TwentyOneThingsBoard[] {
  return getSavedUser21Boards();
}

export async function fetchUserCreated21BoardById(
  boardId: string
): Promise<TwentyOneThingsBoard | null> {
  const localMatch = getSavedUser21Boards().find((b) => b.id === boardId);
  if (localMatch) return localMatch;

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("twenty_one_boards")
          .select("*")
          .eq("id", boardId)
          .maybeSingle();

        if (!error && data && Array.isArray(data.items) && data.items.length === 21) {
          const creatorName = String(data.creator_name || "Creator");
          const remoteBoard: TwentyOneThingsBoard = {
            id: String(data.id),
            puzzleNumber: 0,
            title: String(data.title || `${creatorName}'s 21 Things`),
            creatorName,
            creatorHandle: `@${creatorName.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
            creatorBio: String(
              data.creator_bio ||
                "Narrow these 21 things down to the 1 you resonate with most."
            ),
            items: data.items.map(String),
            sampleJourneys: [],
          };
          const existing = getSavedUser21Boards().filter(
            (b) => b.id !== remoteBoard.id
          );
          safeWriteJson(`${STORAGE_PREFIX}_user_21boards`, [
            remoteBoard,
            ...existing,
          ]);
          return remoteBoard;
        }
      } catch {
        // Fallback cleanly if offline
      }
    }
  }

  return null;
}

export async function saveUserCreated21Board(
  board: TwentyOneThingsBoard,
  rawTranscript?: string
): Promise<void> {
  const modCheck = check21ThingsBoardModeration(
    {
      title: board.title,
      creatorName: board.creatorName,
      creatorBio: board.creatorBio,
      items: board.items,
    },
    { mode: "private" }
  );
  if (!modCheck.allowed) {
    throw new Error(modCheck.reason || "Custom board contains prohibited Tier 1 content.");
  }

  const existing = getSavedUser21Boards().filter((b) => b.id !== board.id);
  safeWriteJson(`${STORAGE_PREFIX}_user_21boards`, [board, ...existing]);

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          await supabase.from("twenty_one_boards").insert({
            id: board.id,
            title: board.title,
            creator_name: board.creatorName,
            creator_bio: board.creatorBio,
            items: board.items,
            raw_transcript: rawTranscript ?? null,
            is_daily: false,
          });
        }
      } catch {
        // Local copy already saved
      }
    }
  }

  notifyProfileSyncListeners({
    type: "board_created",
    board,
  });
}

let cachedC5OverridesRaw: string | null | undefined = undefined;
let cachedC5OverridesVal: Record<string, Connect5Puzzle> = {};

export function getAdminConnect5Overrides(): Record<string, Connect5Puzzle> {
  if (typeof window !== "undefined") {
    try {
      const rawStr = window.localStorage.getItem(
        `${STORAGE_PREFIX}_admin_c5_overrides`
      );
      if (rawStr === cachedC5OverridesRaw) {
        return { ...cachedC5OverridesVal };
      }
      cachedC5OverridesRaw = rawStr;
      if (!rawStr) {
        cachedC5OverridesVal = {};
        return {};
      }
      const parsed = JSON.parse(rawStr) as Record<string, Connect5Puzzle>;
      const out: Record<string, Connect5Puzzle> = {};
      for (const [k, v] of Object.entries(parsed || {})) {
        if (v && typeof v === "object") {
          out[k] = sanitizeConnect5Puzzle(v);
        }
      }
      cachedC5OverridesVal = out;
      return { ...out };
    } catch {
      return {};
    }
  }
  return {};
}

export async function fetchRemoteConnect5Override(
  dateKey: string
): Promise<Connect5Puzzle | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("daily_puzzles")
      .select("payload")
      .eq("game_slug", "connect-5")
      .eq("puzzle_date", dateKey)
      .maybeSingle();

    if (!error && data && data.payload) {
      const rawPuzzle = data.payload as Connect5Puzzle;
      if (Array.isArray(rawPuzzle.words) && rawPuzzle.words.length === 5) {
        const puzzle = sanitizeConnect5Puzzle(rawPuzzle);
        const current = getAdminConnect5Overrides();
        current[dateKey] = puzzle;
        safeWriteJson(`${STORAGE_PREFIX}_admin_c5_overrides`, current);
        return puzzle;
      }
    }
  } catch {
    // Fallback to local overrides
  }
  return null;
}

export interface SaveAdminOverrideResult {
  ok: boolean;
  remotePersisted: boolean;
  error?: string;
  rawError?: unknown;
  diagnosticReport?: DiagnosticReport;
}

let puzzlesStoreRevision = 0;
let crossTabSyncSetup = false;
let broadcastChannelInstance: BroadcastChannel | null = null;

export function getPuzzlesStoreSnapshot(): number {
  return puzzlesStoreRevision;
}

export function subscribeToPuzzlesUpdated(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = () => {
    puzzlesStoreRevision += 1;
    callback();
  };
  window.addEventListener("solgames:puzzles-updated", handler);
  return () => {
    window.removeEventListener("solgames:puzzles-updated", handler);
  };
}

export function broadcastPuzzleUpdate(detail: Record<string, unknown>): void {
  puzzlesStoreRevision += 1;

  if (typeof window === "undefined") return;

  if (typeof BroadcastChannel !== "undefined") {
    try {
      if (!broadcastChannelInstance) {
        broadcastChannelInstance = new BroadcastChannel("solgames_puzzles_channel");
      }
      broadcastChannelInstance.postMessage(detail);
    } catch {
      // Ignore BroadcastChannel errors
    }
  }

  try {
    safeWriteJson(`${STORAGE_PREFIX}_puzzles_broadcast_ping`, {
      ...detail,
      _broadcastTimestamp: Date.now(),
    });
  } catch {
    // Ignore storage quota errors
  }

  try {
    window.dispatchEvent(
      new CustomEvent("solgames:puzzles-updated", { detail })
    );
  } catch {
    // Ignore DOM event errors
  }
}

function removeLocalOverrideEntry(gameSlug: string, dateKey: string): void {
  if (gameSlug === "connect-5") {
    const current = getAdminConnect5Overrides();
    if (dateKey in current) {
      delete current[dateKey];
      safeWriteJson(`${STORAGE_PREFIX}_admin_c5_overrides`, current);
    }
  } else if (gameSlug === "21-things") {
    const current = getAdmin21ThingsOverrides();
    if (dateKey in current) {
      delete current[dateKey];
      safeWriteJson(`${STORAGE_PREFIX}_admin_21t_overrides`, current);
    }
  } else if (gameSlug === "17-syllables") {
    const current = getAdmin17SyllablesOverrides();
    if (dateKey in current) {
      delete current[dateKey];
      safeWriteJson(`${STORAGE_PREFIX}_admin_17s_overrides`, current);
    }
  } else if (isGenericOverrideSlug(gameSlug)) {
    clearGenericOverride(gameSlug, dateKey);
  }
}

function handleReceivedPuzzleUpdate(detail: Record<string, unknown>): void {
  if (!detail) return;
  puzzlesStoreRevision += 1;

  if (
    detail.deleted === true &&
    typeof detail.gameSlug === "string" &&
    typeof detail.dateKey === "string"
  ) {
    removeLocalOverrideEntry(detail.gameSlug, detail.dateKey);
  } else {
    const payload = detail.payload ?? detail.puzzle ?? detail.board;

    if (detail.gameSlug === "connect-5" && typeof detail.dateKey === "string" && payload) {
      const puzzle = sanitizeConnect5Puzzle(payload as Connect5Puzzle);
      detail.puzzle = puzzle;
      const current = getAdminConnect5Overrides();
      current[detail.dateKey] = puzzle;
      safeWriteJson(`${STORAGE_PREFIX}_admin_c5_overrides`, current);
    } else if (detail.gameSlug === "21-things" && typeof detail.dateKey === "string" && payload) {
      const board = payload as TwentyOneThingsBoard;
      detail.board = board;
      const current = getAdmin21ThingsOverrides();
      current[detail.dateKey] = board;
      safeWriteJson(`${STORAGE_PREFIX}_admin_21t_overrides`, current);
    } else if (detail.gameSlug === "17-syllables" && typeof detail.dateKey === "string" && payload) {
      const puzzle = sanitize17SyllablesPuzzle(
        payload as SeventeenSyllablesPuzzle,
        detail.dateKey
      );
      detail.puzzle = puzzle;
      const current = getAdmin17SyllablesOverrides();
      current[detail.dateKey] = puzzle;
      safeWriteJson(`${STORAGE_PREFIX}_admin_17s_overrides`, current);
    } else if (
      isGenericOverrideSlug(detail.gameSlug) &&
      typeof detail.dateKey === "string" &&
      payload
    ) {
      if (cacheGenericOverride(detail.gameSlug, detail.dateKey, payload)) {
        detail.puzzle = payload;
      }
    }
  }

  try {
    window.dispatchEvent(
      new CustomEvent("solgames:puzzles-updated", { detail })
    );
  } catch {
    // Ignore DOM event errors
  }
}

function setupCrossTabSync(): void {
  if (typeof window === "undefined" || crossTabSyncSetup) return;
  crossTabSyncSetup = true;

  if (typeof BroadcastChannel !== "undefined") {
    try {
      broadcastChannelInstance = new BroadcastChannel("solgames_puzzles_channel");
      broadcastChannelInstance.onmessage = (event) => {
        handleReceivedPuzzleUpdate(event.data);
      };
    } catch {
      // Fall back to storage event
    }
  }

  window.addEventListener("storage", (e) => {
    if (e.key === `${STORAGE_PREFIX}_puzzles_broadcast_ping` && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        handleReceivedPuzzleUpdate(data);
      } catch {
        // Ignore JSON parse error
      }
    }
  });
}

export let activeRealtimeChannel: RealtimeChannel | null = null;
let realtimeChannelInitialized = false;
let realtimeSocketAttached = false;
let realtimeChannelUnsubscribe: (() => void) | null = null;

export function getActiveRealtimeChannel(): RealtimeChannel | null {
  return activeRealtimeChannel;
}

export function broadcastRemotePuzzleUpdate(detail: {
  gameSlug: string;
  dateKey: string;
  hash?: string;
  payload?: unknown;
  deleted?: boolean;
}): void {
  if (!activeRealtimeChannel && typeof window !== "undefined" && isSupabaseConfigured) {
    initRealtimePuzzleSync({ enableRealtimeSocket: true });
  }
  if (activeRealtimeChannel) {
    try {
      void activeRealtimeChannel.send({
        type: "broadcast",
        event: "puzzle_updated",
        payload: {
          gameSlug: detail.gameSlug,
          dateKey: detail.dateKey,
          hash: detail.hash,
          payload: detail.payload,
          deleted: detail.deleted,
        },
      });
    } catch {
      // Non-fatal broadcast send error
    }
  }
}

export function initRealtimePuzzleSync(options?: {
  enableRealtimeSocket?: boolean;
}): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const wantsSocket =
    options?.enableRealtimeSocket === true ||
    window.location.pathname.startsWith("/admin");

  if (realtimeChannelInitialized && realtimeChannelUnsubscribe) {
    if (wantsSocket && !realtimeSocketAttached) {
      attachSupabaseRealtimeSocket();
    }
    return realtimeChannelUnsubscribe;
  }

  setupCrossTabSync();

  let lastVisibilitySync = Date.now();
  const handleWakeupSync = () => {
    const now = Date.now();
    if (now - lastVisibilitySync < 60_000) return;
    lastVisibilitySync = now;
    void syncAllRemoteDailyPuzzles();
  };

  window.addEventListener("focus", handleWakeupSync);
  const handleVisibility = () => {
    if (document.visibilityState === "visible") {
      handleWakeupSync();
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);

  if (wantsSocket) {
    attachSupabaseRealtimeSocket();
  }

  realtimeChannelInitialized = true;
  realtimeChannelUnsubscribe = () => {
    if (activeRealtimeChannel && isSupabaseConfigured) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) void supabase.removeChannel(activeRealtimeChannel);
      } catch {
        // Ignore cleanup errors
      }
    }
    activeRealtimeChannel = null;
    realtimeSocketAttached = false;
    window.removeEventListener("focus", handleWakeupSync);
    document.removeEventListener("visibilitychange", handleVisibility);
    realtimeChannelInitialized = false;
    realtimeChannelUnsubscribe = null;
  };
  return realtimeChannelUnsubscribe;
}

function attachSupabaseRealtimeSocket(): void {
  if (realtimeSocketAttached || !isSupabaseConfigured) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const channel = supabase
      .channel("daily_puzzles_live", {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        "broadcast",
        { event: "puzzle_updated" },
        (eventPayload: { payload?: Record<string, unknown> } | Record<string, unknown>) => {
          const broadcastData =
            eventPayload && typeof eventPayload === "object" && "payload" in eventPayload && eventPayload.payload
              ? (eventPayload.payload as Record<string, unknown>)
              : (eventPayload as Record<string, unknown>);
          if (broadcastData && typeof broadcastData === "object") {
            handleReceivedPuzzleUpdate(broadcastData);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_puzzles",
        },
        (payload) => {
          const newRow = payload.new as {
            game_slug?: string;
            puzzle_date?: string;
            payload?: unknown;
          } | null;

          if (newRow && newRow.game_slug && newRow.puzzle_date && newRow.payload) {
            const dateKey = String(newRow.puzzle_date);
            if (newRow.game_slug === "connect-5") {
              const rawPuzzle = newRow.payload as Connect5Puzzle;
              if (Array.isArray(rawPuzzle.words) && rawPuzzle.words.length === 5) {
                const puzzle = sanitizeConnect5Puzzle(rawPuzzle);
                const current = getAdminConnect5Overrides();
                current[dateKey] = puzzle;
                safeWriteJson(`${STORAGE_PREFIX}_admin_c5_overrides`, current);
                broadcastPuzzleUpdate({
                  gameSlug: "connect-5",
                  dateKey,
                  hash: computePuzzleContentHash(puzzle),
                  puzzle,
                  source: "realtime",
                });
              }
            } else if (newRow.game_slug === "21-things") {
              const board = newRow.payload as TwentyOneThingsBoard;
              if (Array.isArray(board.items) && board.items.length === 21) {
                const current = getAdmin21ThingsOverrides();
                current[dateKey] = board;
                safeWriteJson(`${STORAGE_PREFIX}_admin_21t_overrides`, current);
                broadcastPuzzleUpdate({
                  gameSlug: "21-things",
                  dateKey,
                  hash: computePuzzleContentHash(board),
                  board,
                  source: "realtime",
                });
              }
            } else if (newRow.game_slug === "17-syllables") {
              const rawPuzzle = newRow.payload as SeventeenSyllablesPuzzle;
              if (Array.isArray(rawPuzzle.lines) && rawPuzzle.lines.length === 3) {
                const puzzle = sanitize17SyllablesPuzzle(rawPuzzle, dateKey);
                const current = getAdmin17SyllablesOverrides();
                current[dateKey] = puzzle;
                safeWriteJson(`${STORAGE_PREFIX}_admin_17s_overrides`, current);
                broadcastPuzzleUpdate({
                  gameSlug: "17-syllables",
                  dateKey,
                  hash: computePuzzleContentHash(puzzle),
                  puzzle,
                  source: "realtime",
                });
              }
            } else if (
              isGenericOverrideSlug(newRow.game_slug) &&
              cacheGenericOverride(newRow.game_slug, dateKey, newRow.payload)
            ) {
              broadcastPuzzleUpdate({
                gameSlug: newRow.game_slug,
                dateKey,
                hash: computePuzzleContentHash(newRow.payload),
                puzzle: newRow.payload,
                source: "realtime",
              });
            }
          } else {
            void syncAllRemoteDailyPuzzles({ force: true, includeFutureAdmin: true });
          }
        }
      );

    activeRealtimeChannel = channel;
    realtimeSocketAttached = true;
    channel.subscribe();
  } catch {
    // Non-fatal fallback
  }
}

let lastRemoteDailySyncMs = 0;

/**
 * Fetches published daily puzzle overrides from Supabase `public.daily_puzzles`.
 * On public visitor routes, scopes queries to `puzzle_date <= tomorrow` (preventing
 * future answer leaks and 200-row payload bloat) with a 60s throttle.
 */
export async function syncAllRemoteDailyPuzzles(options?: {
  force?: boolean;
  includeFutureAdmin?: boolean;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  const now = Date.now();
  const isAdminView =
    options?.includeFutureAdmin === true ||
    (typeof window !== "undefined" && window.location.pathname.startsWith("/admin"));

  if (!options?.force && !isAdminView && now - lastRemoteDailySyncMs < 60_000) {
    return;
  }
  lastRemoteDailySyncMs = now;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    let query = supabase
      .from("daily_puzzles")
      .select("game_slug, puzzle_date, payload, updated_at")
      .order("puzzle_date", { ascending: false });

    if (!isAdminView) {
      const tomorrowUtc = new Date(Date.now() + 36 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
      query = query.lte("puzzle_date", tomorrowUtc).limit(90);
    } else {
      query = query.limit(200);
    }

    const { data, error } = await query;
    if (error || !Array.isArray(data)) return;

    const c5Overrides = getAdminConnect5Overrides();
    const t21Overrides = getAdmin21ThingsOverrides();
    const s17Overrides = getAdmin17SyllablesOverrides();
    let c5Changed = false;
    let t21Changed = false;
    let s17Changed = false;
    let genericChanged = false;

    const puzzleHashes: Record<string, string> = {};

    for (const row of data) {
      const dateKey = String(row.puzzle_date);
      if (!dateKey) continue;

      if (row.game_slug === "connect-5" && row.payload) {
        const rawPuzzle = row.payload as Connect5Puzzle;
        if (Array.isArray(rawPuzzle.words) && rawPuzzle.words.length === 5) {
          const puzzle = sanitizeConnect5Puzzle(rawPuzzle);
          const nextHash = computePuzzleContentHash(puzzle);
          const prevHash = c5Overrides[dateKey]
            ? computePuzzleContentHash(c5Overrides[dateKey])
            : null;
          if (nextHash !== prevHash) {
            c5Overrides[dateKey] = puzzle;
            c5Changed = true;
          }
          puzzleHashes[`connect-5:${dateKey}`] = nextHash;
        }
      } else if (row.game_slug === "21-things" && row.payload) {
        const board = row.payload as TwentyOneThingsBoard;
        if (Array.isArray(board.items) && board.items.length === 21) {
          const nextHash = computePuzzleContentHash(board);
          const prevHash = t21Overrides[dateKey]
            ? computePuzzleContentHash(t21Overrides[dateKey])
            : null;
          if (nextHash !== prevHash) {
            t21Overrides[dateKey] = board;
            t21Changed = true;
          }
          puzzleHashes[`21-things:${dateKey}`] = nextHash;
        }
      } else if (row.game_slug === "17-syllables" && row.payload) {
        const rawPuzzle = row.payload as SeventeenSyllablesPuzzle;
        if (Array.isArray(rawPuzzle.lines) && rawPuzzle.lines.length === 3) {
          const puzzle = sanitize17SyllablesPuzzle(rawPuzzle, dateKey);
          const nextHash = computePuzzleContentHash(puzzle);
          const prevHash = s17Overrides[dateKey]
            ? computePuzzleContentHash(s17Overrides[dateKey])
            : null;
          if (nextHash !== prevHash) {
            s17Overrides[dateKey] = puzzle;
            s17Changed = true;
          }
          puzzleHashes[`17-syllables:${dateKey}`] = nextHash;
        }
      } else if (isGenericOverrideSlug(row.game_slug) && row.payload) {
        const existing = getAdminOverridesForGame(row.game_slug)[dateKey];
        const nextHash = computePuzzleContentHash(row.payload);
        const prevHash = existing ? computePuzzleContentHash(existing) : null;
        if (nextHash !== prevHash && cacheGenericOverride(row.game_slug, dateKey, row.payload)) {
          genericChanged = true;
        }
        puzzleHashes[`${row.game_slug}:${dateKey}`] = nextHash;
      }
    }

    if (c5Changed) {
      safeWriteJson(`${STORAGE_PREFIX}_admin_c5_overrides`, c5Overrides);
    }
    if (t21Changed) {
      safeWriteJson(`${STORAGE_PREFIX}_admin_21t_overrides`, t21Overrides);
    }
    if (s17Changed) {
      safeWriteJson(`${STORAGE_PREFIX}_admin_17s_overrides`, s17Overrides);
    }

    if (c5Changed || t21Changed || s17Changed || genericChanged) {
      broadcastPuzzleUpdate({
        source: "syncAllRemoteDailyPuzzles",
        c5Overrides,
        t21Overrides,
        s17Overrides,
        hashes: puzzleHashes,
      });
    }
  } catch {
    // Non-fatal sync fallback
  }
}

export interface AdminSaveAuthContext {
  userEmail?: string | null;
  userRole?: string | null;
}

function resolveDefaultAdminAuthContext(
  authContext?: AdminSaveAuthContext
): AdminSaveAuthContext {
  if (authContext !== undefined) {
    return authContext;
  }
  const active = safeReadJson<{ email?: string; role?: string } | null>(
    `${STORAGE_PREFIX}_active_user`,
    null
  );
  return {
    userEmail: typeof active?.email === "string" ? active.email : null,
    userRole: typeof active?.role === "string" ? active.role : null,
  };
}

export async function saveAdminConnect5Override(
  dateKey: string,
  rawPuzzle: Connect5Puzzle,
  authContext?: AdminSaveAuthContext
): Promise<SaveAdminOverrideResult> {
  const puzzle = sanitizeConnect5Puzzle(rawPuzzle);
  const resolvedAuth = resolveDefaultAdminAuthContext(authContext);
  const current = getAdminConnect5Overrides();
  current[dateKey] = puzzle;
  safeWriteJson(`${STORAGE_PREFIX}_admin_c5_overrides`, current);
  clearConnect5Progress(dateKey);

  const hash = computePuzzleContentHash(puzzle);
  let remotePersisted = false;
  let remoteError: string | undefined;
  let rawError: unknown;
  let diagnosticReport: DiagnosticReport | undefined;

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let { error } = await supabase.from("daily_puzzles").upsert(
          {
            game_slug: "connect-5",
            puzzle_date: dateKey,
            puzzle_number: puzzle.puzzleNumber,
            title: puzzle.title,
            author: puzzle.author,
            editor: puzzle.editor,
            content_hash: hash,
            payload: puzzle,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "game_slug,puzzle_date" }
        );
        if (error && error.message && error.message.toLowerCase().includes("content_hash")) {
          const fallback = await supabase.from("daily_puzzles").upsert(
            {
              game_slug: "connect-5",
              puzzle_date: dateKey,
              puzzle_number: puzzle.puzzleNumber,
              title: puzzle.title,
              author: puzzle.author,
              editor: puzzle.editor,
              payload: puzzle,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "game_slug,puzzle_date" }
          );
          error = fallback.error;
        }
        if (error) {
          rawError = error;
          remoteError = error.message;
          diagnosticReport = classifyDiagnosticError(error, {
            gameSlug: "connect-5",
            targetDate: dateKey,
            action: "save",
            puzzlePayload: puzzle,
            userEmail: resolvedAuth.userEmail,
            userRole: resolvedAuth.userRole,
          });
        } else {
          remotePersisted = true;
        }
      } catch (err: unknown) {
        rawError = err;
        remoteError = err instanceof Error ? err.message : "Failed to persist puzzle to Supabase.";
        diagnosticReport = classifyDiagnosticError(err, {
          gameSlug: "connect-5",
          targetDate: dateKey,
          action: "save",
          puzzlePayload: puzzle,
          userEmail: resolvedAuth.userEmail,
          userRole: resolvedAuth.userRole,
        });
      }
    }
  }

  broadcastPuzzleUpdate({
    gameSlug: "connect-5",
    dateKey,
    hash,
    puzzle,
  });

  if (remotePersisted) {
    broadcastRemotePuzzleUpdate({
      gameSlug: "connect-5",
      dateKey,
      hash,
      payload: puzzle,
    });
  }

  return {
    ok: true,
    remotePersisted,
    error: remoteError,
    rawError,
    diagnosticReport,
  };
}

export function getAdmin21ThingsOverrides(): Record<
  string,
  TwentyOneThingsBoard
> {
  return safeReadJson<Record<string, TwentyOneThingsBoard>>(
    `${STORAGE_PREFIX}_admin_21t_overrides`,
    {}
  );
}

export async function fetchRemote21ThingsOverride(
  dateKey: string
): Promise<TwentyOneThingsBoard | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("daily_puzzles")
      .select("payload")
      .eq("game_slug", "21-things")
      .eq("puzzle_date", dateKey)
      .maybeSingle();

    if (!error && data && data.payload) {
      const board = data.payload as TwentyOneThingsBoard;
      if (Array.isArray(board.items) && board.items.length === 21) {
        const current = getAdmin21ThingsOverrides();
        current[dateKey] = board;
        safeWriteJson(`${STORAGE_PREFIX}_admin_21t_overrides`, current);
        return board;
      }
    }
  } catch {
    // Fallback to local overrides
  }
  return null;
}

export async function saveAdmin21ThingsOverride(
  dateKey: string,
  board: TwentyOneThingsBoard,
  authContext?: AdminSaveAuthContext
): Promise<SaveAdminOverrideResult> {
  const resolvedAuth = resolveDefaultAdminAuthContext(authContext);
  const current = getAdmin21ThingsOverrides();
  current[dateKey] = board;
  safeWriteJson(`${STORAGE_PREFIX}_admin_21t_overrides`, current);
  clear21ThingsProgress(board.id);

  const hash = computePuzzleContentHash(board);
  let remotePersisted = false;
  let remoteError: string | undefined;
  let rawError: unknown;
  let diagnosticReport: DiagnosticReport | undefined;

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let { error } = await supabase.from("daily_puzzles").upsert(
          {
            game_slug: "21-things",
            puzzle_date: dateKey,
            puzzle_number: board.puzzleNumber,
            title: board.title,
            author: board.creatorName,
            editor: "Daily Editorial",
            content_hash: hash,
            payload: board,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "game_slug,puzzle_date" }
        );
        if (error && error.message && error.message.toLowerCase().includes("content_hash")) {
          const fallback = await supabase.from("daily_puzzles").upsert(
            {
              game_slug: "21-things",
              puzzle_date: dateKey,
              puzzle_number: board.puzzleNumber,
              title: board.title,
              author: board.creatorName,
              editor: "Daily Editorial",
              payload: board,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "game_slug,puzzle_date" }
          );
          error = fallback.error;
        }
        if (error) {
          rawError = error;
          remoteError = error.message;
          diagnosticReport = classifyDiagnosticError(error, {
            gameSlug: "21-things",
            targetDate: dateKey,
            action: "save",
            puzzlePayload: board,
            userEmail: resolvedAuth.userEmail,
            userRole: resolvedAuth.userRole,
          });
        } else {
          remotePersisted = true;
        }
      } catch (err: unknown) {
        rawError = err;
        remoteError = err instanceof Error ? err.message : "Failed to persist board to Supabase.";
        diagnosticReport = classifyDiagnosticError(err, {
          gameSlug: "21-things",
          targetDate: dateKey,
          action: "save",
          puzzlePayload: board,
          userEmail: resolvedAuth.userEmail,
          userRole: resolvedAuth.userRole,
        });
      }
    }
  }

  broadcastPuzzleUpdate({
    gameSlug: "21-things",
    dateKey,
    hash,
    board,
  });

  if (remotePersisted) {
    broadcastRemotePuzzleUpdate({
      gameSlug: "21-things",
      dateKey,
      hash,
      payload: board,
    });
  }

  return {
    ok: true,
    remotePersisted,
    error: remoteError,
    rawError,
    diagnosticReport,
  };
}

export const saveAdmin21BoardOverride = saveAdmin21ThingsOverride;

let cached17sOverridesRaw: string | null | undefined = undefined;
let cached17sOverridesVal: Record<string, SeventeenSyllablesPuzzle> = {};

export function getAdmin17SyllablesOverrides(): Record<
  string,
  SeventeenSyllablesPuzzle
> {
  if (typeof window !== "undefined") {
    try {
      const rawStr = window.localStorage.getItem(
        `${STORAGE_PREFIX}_admin_17s_overrides`
      );
      if (rawStr === cached17sOverridesRaw) {
        return { ...cached17sOverridesVal };
      }
      cached17sOverridesRaw = rawStr;
      if (!rawStr) {
        cached17sOverridesVal = {};
        return {};
      }
      const parsed = JSON.parse(rawStr) as Record<
        string,
        SeventeenSyllablesPuzzle
      >;
      const out: Record<string, SeventeenSyllablesPuzzle> = {};
      for (const [k, v] of Object.entries(parsed || {})) {
        if (v && typeof v === "object") {
          out[k] = sanitize17SyllablesPuzzle(v, k);
        }
      }
      cached17sOverridesVal = out;
      return { ...out };
    } catch {
      return {};
    }
  }
  return {};
}

export async function fetchRemote17SyllablesOverride(
  dateKey: string
): Promise<SeventeenSyllablesPuzzle | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("daily_puzzles")
      .select("payload")
      .eq("game_slug", "17-syllables")
      .eq("puzzle_date", dateKey)
      .maybeSingle();

    if (!error && data && data.payload) {
      const rawPuzzle = data.payload as SeventeenSyllablesPuzzle;
      if (Array.isArray(rawPuzzle.lines) && rawPuzzle.lines.length === 3) {
        const puzzle = sanitize17SyllablesPuzzle(rawPuzzle, dateKey);
        if (Array.isArray(puzzle.chunks) && puzzle.chunks.length > 0) {
          const current = getAdmin17SyllablesOverrides();
          current[dateKey] = puzzle;
          safeWriteJson(`${STORAGE_PREFIX}_admin_17s_overrides`, current);
          return puzzle;
        }
      }
    }
  } catch {
    // Fallback to local overrides
  }
  return null;
}

export async function saveAdmin17SyllablesOverride(
  dateKey: string,
  rawPuzzle: SeventeenSyllablesPuzzle,
  authContext?: AdminSaveAuthContext
): Promise<SaveAdminOverrideResult> {
  const puzzle = sanitize17SyllablesPuzzle(rawPuzzle, dateKey);
  const resolvedAuth = resolveDefaultAdminAuthContext(authContext);
  const current = getAdmin17SyllablesOverrides();
  current[dateKey] = puzzle;
  safeWriteJson(`${STORAGE_PREFIX}_admin_17s_overrides`, current);
  clear17SyllablesProgress(dateKey);

  const hash = computePuzzleContentHash(puzzle);
  let remotePersisted = false;
  let remoteError: string | undefined;
  let rawError: unknown;
  let diagnosticReport: DiagnosticReport | undefined;

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let { error } = await supabase.from("daily_puzzles").upsert(
          {
            game_slug: "17-syllables",
            puzzle_date: dateKey,
            puzzle_number: puzzle.puzzleNumber,
            title: puzzle.theme || `17 Syllables #${puzzle.puzzleNumber}`,
            author: puzzle.author || "SOL Theory",
            editor: "Daily Editorial",
            content_hash: hash,
            payload: puzzle,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "game_slug,puzzle_date" }
        );
        if (error && error.message && error.message.toLowerCase().includes("content_hash")) {
          const fallback = await supabase.from("daily_puzzles").upsert(
            {
              game_slug: "17-syllables",
              puzzle_date: dateKey,
              puzzle_number: puzzle.puzzleNumber,
              title: puzzle.theme || `17 Syllables #${puzzle.puzzleNumber}`,
              author: puzzle.author || "SOL Theory",
              editor: "Daily Editorial",
              payload: puzzle,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "game_slug,puzzle_date" }
          );
          error = fallback.error;
        }
        if (error) {
          rawError = error;
          remoteError = error.message;
          diagnosticReport = classifyDiagnosticError(error, {
            gameSlug: "17-syllables",
            targetDate: dateKey,
            action: "save",
            puzzlePayload: puzzle,
            userEmail: resolvedAuth.userEmail,
            userRole: resolvedAuth.userRole,
          });
        } else {
          remotePersisted = true;
        }
      } catch (err: unknown) {
        rawError = err;
        remoteError = err instanceof Error ? err.message : "Failed to persist 17 Syllables puzzle to Supabase.";
        diagnosticReport = classifyDiagnosticError(err, {
          gameSlug: "17-syllables",
          targetDate: dateKey,
          action: "save",
          puzzlePayload: puzzle,
          userEmail: resolvedAuth.userEmail,
          userRole: resolvedAuth.userRole,
        });
      }
    }
  }

  broadcastPuzzleUpdate({
    gameSlug: "17-syllables",
    dateKey,
    hash,
    puzzle,
  });

  if (remotePersisted) {
    broadcastRemotePuzzleUpdate({
      gameSlug: "17-syllables",
      dateKey,
      hash,
      payload: puzzle,
    });
  }

  return {
    ok: true,
    remotePersisted,
    error: remoteError,
    rawError,
    diagnosticReport,
  };
}

// ============================================================================
// Generic (all 9 games) override cache, remote fetch, admin save & unpublish
// ============================================================================

/** True for any registered game slug that is NOT one of the 3 legacy typed override stores. */
export function isGenericOverrideSlug(slug: unknown): slug is AllGameSlug {
  return isGenericOverrideSlugLight(slug);
}

function genericOverrideKey(slug: string): string {
  return `${STORAGE_PREFIX}_admin_${slug}_overrides`;
}

/** Per-date override map for ANY game (legacy typed stores or the generic cache). */
export function getAdminOverridesForGame(
  gameSlug: string
): Record<string, unknown> {
  if (gameSlug === "connect-5") return getAdminConnect5Overrides();
  if (gameSlug === "21-things") return getAdmin21ThingsOverrides();
  if (gameSlug === "17-syllables") return getAdmin17SyllablesOverrides();
  return safeReadJson<Record<string, unknown>>(genericOverrideKey(gameSlug), {});
}

/**
 * Validates `payload` against the game's registered schema and stores it in the generic
 * override cache. Returns false (and stores nothing) when the payload is malformed.
 */
export function cacheGenericOverride(
  gameSlug: string,
  dateKey: string,
  payload: unknown
): boolean {
  if (!isGenericOverrideSlugLight(gameSlug) || !validateLightOverridePayload(gameSlug, payload)) {
    return false;
  }
  const current = getAdminOverridesForGame(gameSlug);
  current[dateKey] = payload;
  safeWriteJson(genericOverrideKey(gameSlug), current);
  return true;
}

export function clearGenericOverride(gameSlug: string, dateKey: string): void {
  const current = getAdminOverridesForGame(gameSlug);
  if (!(dateKey in current)) return;
  delete current[dateKey];
  safeWriteJson(genericOverrideKey(gameSlug), current);
}

/** Fetches a single day's override row from Supabase and caches it when valid. */
export async function fetchRemoteOverrideForGame(
  gameSlug: string,
  dateKey: string
): Promise<unknown | null> {
  if (gameSlug === "connect-5") return fetchRemoteConnect5Override(dateKey);
  if (gameSlug === "21-things") return fetchRemote21ThingsOverride(dateKey);
  if (gameSlug === "17-syllables") return fetchRemote17SyllablesOverride(dateKey);
  if (!isSupabaseConfigured) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("daily_puzzles")
      .select("payload")
      .eq("game_slug", gameSlug)
      .eq("puzzle_date", dateKey)
      .maybeSingle();
    if (!error && data && data.payload) {
      if (isGenericOverrideSlug(gameSlug)) {
        return cacheGenericOverride(gameSlug, dateKey, data.payload)
          ? data.payload
          : null;
      }
      return validateLightOverridePayload(gameSlug, data.payload)
        ? data.payload
        : null;
    }
  } catch {
    // Fall back to local overrides / bank
  }
  return null;
}

export interface GenericOverrideMeta {
  puzzleNumber: number;
  title: string;
  author?: string;
  editor?: string;
}

/**
 * Saves an admin puzzle for any game: validate → local cache → Supabase upsert →
 * BroadcastChannel + Realtime broadcast (same flow as the legacy typed savers).
 */
export async function saveAdminOverrideForGame(
  gameSlug: AllGameSlug,
  dateKey: string,
  payload: unknown,
  meta: GenericOverrideMeta,
  authContext?: AdminSaveAuthContext
): Promise<SaveAdminOverrideResult> {
  if (!validateLightOverridePayload(gameSlug, payload)) {
    return {
      ok: false,
      remotePersisted: false,
      error: `Invalid ${gameSlug} puzzle payload — failed schema validation.`,
    };
  }
  const resolvedAuth = resolveDefaultAdminAuthContext(authContext);
  cacheGenericOverride(gameSlug, dateKey, payload);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(
        `${STORAGE_PREFIX}_${gameSlug}_progress_${dateKey}`
      );
    } catch {
      // ignore
    }
  }

  const hash = computePuzzleContentHash(payload);
  let remotePersisted = false;
  let remoteError: string | undefined;
  let rawError: unknown;
  let diagnosticReport: DiagnosticReport | undefined;

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const row = {
          game_slug: gameSlug,
          puzzle_date: dateKey,
          puzzle_number: meta.puzzleNumber,
          title: meta.title,
          author: meta.author || "SOL Theory",
          editor: meta.editor || "Daily Editorial",
          content_hash: hash,
          payload,
          updated_at: new Date().toISOString(),
        };
        let { error } = await supabase
          .from("daily_puzzles")
          .upsert(row, { onConflict: "game_slug,puzzle_date" });
        if (error && error.message && error.message.toLowerCase().includes("content_hash")) {
          const { content_hash: _omit, ...rest } = row;
          void _omit;
          const fallback = await supabase
            .from("daily_puzzles")
            .upsert(rest, { onConflict: "game_slug,puzzle_date" });
          error = fallback.error;
        }
        if (error) {
          rawError = error;
          remoteError = error.message;
          diagnosticReport = classifyDiagnosticError(error, {
            gameSlug,
            targetDate: dateKey,
            action: "save",
            puzzlePayload: payload,
            userEmail: resolvedAuth.userEmail,
            userRole: resolvedAuth.userRole,
          });
        } else {
          remotePersisted = true;
        }
      } catch (err: unknown) {
        rawError = err;
        remoteError =
          err instanceof Error
            ? err.message
            : `Failed to persist ${gameSlug} puzzle to Supabase.`;
        diagnosticReport = classifyDiagnosticError(err, {
          gameSlug,
          targetDate: dateKey,
          action: "save",
          puzzlePayload: payload,
          userEmail: resolvedAuth.userEmail,
          userRole: resolvedAuth.userRole,
        });
      }
    }
  }

  broadcastPuzzleUpdate({ gameSlug, dateKey, hash, puzzle: payload });
  if (remotePersisted) {
    broadcastRemotePuzzleUpdate({ gameSlug, dateKey, hash, payload });
  }

  return {
    ok: true,
    remotePersisted,
    error: remoteError,
    rawError,
    diagnosticReport,
  };
}

/**
 * Unpublishes (deletes) a custom daily puzzle override from both Supabase `public.daily_puzzles`
 * and local override caches so the date cleanly reverts to the default curated bank.
 */
export async function deleteAdminOverrideForGame(
  gameSlug: AllGameSlug,
  dateKey: string,
  authContext?: AdminSaveAuthContext
): Promise<SaveAdminOverrideResult> {
  const resolvedAuth = resolveDefaultAdminAuthContext(authContext);
  let remotePersisted = false;
  let remoteError: string | undefined;
  let rawError: unknown;
  let diagnosticReport: DiagnosticReport | undefined;

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase
          .from("daily_puzzles")
          .delete()
          .eq("game_slug", gameSlug)
          .eq("puzzle_date", dateKey);
        if (error) {
          rawError = error;
          remoteError = error.message;
          diagnosticReport = classifyDiagnosticError(error, {
            gameSlug,
            targetDate: dateKey,
            action: "delete",
            userEmail: resolvedAuth.userEmail,
            userRole: resolvedAuth.userRole,
          });
          return {
            ok: false,
            remotePersisted: false,
            error: remoteError,
            rawError,
            diagnosticReport,
          };
        }
        remotePersisted = true;
      } catch (err: unknown) {
        rawError = err;
        remoteError =
          err instanceof Error
            ? err.message
            : `Failed to delete ${gameSlug} override from Supabase.`;
        diagnosticReport = classifyDiagnosticError(err, {
          gameSlug,
          targetDate: dateKey,
          action: "delete",
          userEmail: resolvedAuth.userEmail,
          userRole: resolvedAuth.userRole,
        });
        return {
          ok: false,
          remotePersisted: false,
          error: remoteError,
          rawError,
          diagnosticReport,
        };
      }
    }
  }

  removeLocalOverrideEntry(gameSlug, dateKey);
  broadcastPuzzleUpdate({ gameSlug, dateKey, deleted: true });
  if (remotePersisted) {
    broadcastRemotePuzzleUpdate({ gameSlug, dateKey, deleted: true });
  }

  return {
    ok: true,
    remotePersisted,
  };
}

// ============================================================================
// Generic per-date progress + scored-completion helpers (9 Rhymes, 6 Pics, …)
// ============================================================================

function progressKey(gameSlug: AllGameSlug, dateKey: string): string {
  return `${GAME_PROGRESS_PREFIX[gameSlug]}${dateKey}`;
}

export function getGameProgress<T extends { puzzleId?: string }>(
  gameSlug: AllGameSlug,
  dateKey: string,
  puzzleId?: string
): T | null {
  const saved = safeReadJson<T | null>(progressKey(gameSlug, dateKey), null);
  if (!saved || typeof saved !== "object") return null;
  if (puzzleId !== undefined && saved.puzzleId !== puzzleId) return null;
  return saved;
}

export function saveGameProgress<T extends object>(
  gameSlug: AllGameSlug,
  dateKey: string,
  progress: T
): void {
  safeWriteJson(progressKey(gameSlug, dateKey), progress);
}

export function clearGameProgress(gameSlug: AllGameSlug, dateKey: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(progressKey(gameSlug, dateKey));
}

/**
 * Records a finished score-based puzzle (any score counts as a completed day for streaks).
 * Atomically updates `distribution`: `score_<x.x>` buckets, `score_total_x10` (sum of score*10),
 * `flawless` (perfect scores) before firing profile sync listeners.
 */
export function recordScoredCompletion(
  gameSlug: AllGameSlug,
  dateKey: string,
  score: number,
  maxScore: number,
  elapsedSeconds: number = 0,
  options?: { isCustom?: boolean; isRevealed?: boolean }
): GameStats {
  const bucket = `score_${score.toFixed(1)}`;
  return recordGameWin(gameSlug as PlayableGameSlug, dateKey, elapsedSeconds, {
    isCustom: options?.isCustom,
    isRevealed: options?.isRevealed,
    distributionMutator: (dist) => {
      dist[bucket] = (dist[bucket] ?? 0) + 1;
      dist.score_total_x10 = (dist.score_total_x10 ?? 0) + Math.round(score * 10);
      if (score >= maxScore) {
        dist.flawless = (dist.flawless ?? 0) + 1;
      }
    },
  });
}

// ============================================================================
// Unified 9-Game Profile Stats & Q4 Signature Metrics (21 -> 1 Countdown Order)
// ============================================================================

export type AllGameStatsMap = Record<AllGameSlug, GameStats>;

export function createDefaultAllGameStatsMap(): AllGameStatsMap {
  const out = {} as AllGameStatsMap;
  for (const slug of ALL_GAME_SLUGS) {
    out[slug] = normalizeGameStats(DEFAULT_STATS);
  }
  return out;
}

export function normalizeAllGameStatsMap(
  raw?: Partial<Record<string, Partial<GameStats> | null>> | null
): AllGameStatsMap {
  const out = createDefaultAllGameStatsMap();
  if (!raw || typeof raw !== "object") return out;
  for (const slug of ALL_GAME_SLUGS) {
    if (raw[slug]) {
      out[slug] = normalizeGameStats(raw[slug]);
    }
  }
  return out;
}

export function getAllLocalGameStats(): AllGameStatsMap {
  const out = createDefaultAllGameStatsMap();
  for (const slug of ALL_GAME_SLUGS) {
    out[slug] = getGameStats(slug);
  }
  return out;
}

export function mergeAllGameStatsMaps(
  a?: Partial<Record<string, Partial<GameStats> | null>> | null,
  b?: Partial<Record<string, Partial<GameStats> | null>> | null
): AllGameStatsMap {
  const normA = normalizeAllGameStatsMap(a);
  const normB = normalizeAllGameStatsMap(b);
  const out = createDefaultAllGameStatsMap();
  for (const slug of ALL_GAME_SLUGS) {
    out[slug] = mergeTwoGameStats(normA[slug], normB[slug]);
  }
  return out;
}

export interface UnifiedMetricCell {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface UnifiedGameProfileSummary {
  slug: AllGameSlug;
  stats: GameStats;
  winPercent: number;
  metrics: UnifiedMetricCell[];
  guessDistribution?: Array<{ guessNumber: number; pointsLabel: string; count: number }>;
}

function fmtSeconds(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return "—";
  }
  const rounded = Math.round(seconds);
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function computeAvg17Stars(dist: Record<string, number>): string {
  let weighted = 0;
  let count = 0;
  for (const [k, v] of Object.entries(dist)) {
    if (k.startsWith("stars_") && v > 0) {
      const starVal = Number.parseFloat(k.slice("stars_".length));
      if (Number.isFinite(starVal)) {
        weighted += starVal * v;
        count += v;
      }
    }
  }
  if (count <= 0) return "—";
  const avg = weighted / count;
  return `${avg.toFixed(1)} ⭐`;
}

function computeAvgScoreOutOf(
  stats: GameStats,
  maxScore: number
): string {
  const totalX10 = stats.distribution.score_total_x10;
  if (typeof totalX10 === "number" && stats.played > 0) {
    const avg = totalX10 / 10 / stats.played;
    return `${avg.toFixed(1)} / ${maxScore}`;
  }
  let weighted = 0;
  let count = 0;
  for (const [k, v] of Object.entries(stats.distribution)) {
    if (k.startsWith("score_") && k !== "score_total_x10" && v > 0) {
      const val = Number.parseFloat(k.slice("score_".length));
      if (Number.isFinite(val)) {
        weighted += val * v;
        count += v;
      }
    }
  }
  if (count <= 0) return "—";
  return `${(weighted / count).toFixed(1)} / ${maxScore}`;
}

/**
 * Derives the exact Q4 signature profile metrics for any of the 9 countdown games.
 */
export function buildUnifiedGameProfileSummary(
  slug: AllGameSlug,
  rawStats?: Partial<GameStats> | null
): UnifiedGameProfileSummary {
  const stats = normalizeGameStats(rawStats);
  const winPercent =
    stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

  switch (slug) {
    case "21-things":
      return {
        slug,
        stats,
        winPercent,
        metrics: [
          { label: "Played", value: String(stats.played) },
          { label: "Current Streak", value: `${stats.currentStreak} 🔥`, highlight: true },
          { label: "Max Streak", value: String(stats.maxStreak) },
          { label: "#1 Picks Logged", value: String(stats.won) },
        ],
      };

    case "17-syllables":
      return {
        slug,
        stats,
        winPercent,
        metrics: [
          { label: "Played", value: String(stats.played) },
          { label: "Win %", value: `${winPercent}%` },
          { label: "Current Streak", value: `${stats.currentStreak} 🔥`, highlight: true },
          { label: "Max Streak", value: String(stats.maxStreak) },
          { label: "Avg Star Rating", value: computeAvg17Stars(stats.distribution) },
        ],
      };

    case "9-rhymes": {
      const flawless =
        stats.distribution.flawless ?? stats.distribution["score_9.0"] ?? 0;
      return {
        slug,
        stats,
        winPercent,
        metrics: [
          { label: "Played", value: String(stats.played) },
          { label: "Current Streak", value: `${stats.currentStreak} 🔥`, highlight: true },
          { label: "Max Streak", value: String(stats.maxStreak) },
          { label: "Avg Score", value: computeAvgScoreOutOf(stats, 9) },
          { label: "Flawless 9/9", value: String(flawless) },
        ],
      };
    }

    case "eightfold-echo": {
      const zeroMistakes = stats.distribution.zero_mistakes ?? 0;
      return {
        slug,
        stats,
        winPercent,
        metrics: [
          { label: "Played", value: String(stats.played) },
          { label: "Win %", value: `${winPercent}%` },
          { label: "Current Streak", value: `${stats.currentStreak} 🔥`, highlight: true },
          { label: "Max Streak", value: String(stats.maxStreak) },
          { label: "Best Time", value: fmtSeconds(stats.bestTimeSeconds) },
          { label: "Zero-Mistake", value: String(zeroMistakes) },
        ],
      };
    }

    case "6-pics": {
      const hasPicPts = [1, 2, 3, 4, 5, 6].some(
        (pts) => (stats.distribution[`pic_pts_${pts}`] ?? 0) > 0
      );
      const flawless =
        stats.distribution.flawless ?? stats.distribution["score_36.0"] ?? 0;
      const guessDistribution = [1, 2, 3, 4, 5, 6].map((piecesShown) => {
        const pts = 7 - piecesShown;
        const count = hasPicPts
          ? stats.distribution[`pic_pts_${pts}`] ?? 0
          : stats.distribution[`score_${pts.toFixed(1)}`] ?? 0;
        return {
          guessNumber: piecesShown,
          pointsLabel: `${pts} ${pts === 1 ? "pt" : "pts"}`,
          count,
        };
      });
      return {
        slug,
        stats,
        winPercent,
        metrics: [
          { label: "Played", value: String(stats.played) },
          { label: "Win %", value: `${winPercent}%` },
          { label: "Current Streak", value: `${stats.currentStreak} 🔥`, highlight: true },
          { label: "Max Streak", value: String(stats.maxStreak) },
          { label: "Avg Score", value: computeAvgScoreOutOf(stats, 36) },
          { label: "Flawless 36/36", value: String(flawless) },
        ],
        guessDistribution,
      };
    }

    case "connect-5": {
      const avgTime =
        stats.totalTimeSeconds > 0 && stats.won > 0
          ? Math.round(stats.totalTimeSeconds / stats.won)
          : stats.bestTimeSeconds;
      return {
        slug,
        stats,
        winPercent,
        metrics: [
          { label: "Played", value: String(stats.played) },
          { label: "Win %", value: `${winPercent}%` },
          { label: "Current Streak", value: `${stats.currentStreak} 🔥`, highlight: true },
          { label: "Max Streak", value: String(stats.maxStreak) },
          { label: "Best Time", value: fmtSeconds(stats.bestTimeSeconds) },
          { label: "Avg Time", value: fmtSeconds(avgTime) },
        ],
      };
    }

    case "four-score":
      return {
        slug,
        stats,
        winPercent,
        metrics: [
          { label: "Played", value: String(stats.played) },
          { label: "Win %", value: `${winPercent}%` },
          { label: "Current Streak", value: `${stats.currentStreak} 🔥`, highlight: true },
          { label: "Max Streak", value: String(stats.maxStreak) },
          { label: "80s Solved", value: String(stats.won) },
        ],
      };

    case "move-2": {
      const bestEncoded = stats.distribution.best_over_par_plus_100;
      let bestVsPar = "—";
      if (typeof bestEncoded === "number" && stats.won > 0) {
        const diff = bestEncoded - 100;
        bestVsPar =
          diff === 0 ? "Par (0)" : diff > 0 ? `+${diff} vs Par` : `${diff} vs Par`;
      }
      const parStars3 =
        stats.distribution.par_stars_3 ?? stats.distribution.stars_3 ?? 0;
      return {
        slug,
        stats,
        winPercent,
        metrics: [
          { label: "Played", value: String(stats.played) },
          { label: "Win %", value: `${winPercent}%` },
          { label: "Current Streak", value: `${stats.currentStreak} 🔥`, highlight: true },
          { label: "Max Streak", value: String(stats.maxStreak) },
          { label: "Best vs. Par", value: bestVsPar },
          { label: "⭐⭐⭐ Par Count", value: String(parStars3) },
        ],
      };
    }

    case "1-win":
      return {
        slug,
        stats,
        winPercent,
        metrics: [
          { label: "Daily Wins Logged", value: String(stats.won) },
          { label: "Current Streak", value: `${stats.currentStreak} 🔥`, highlight: true },
          { label: "Max Streak", value: String(stats.maxStreak) },
        ],
      };
  }
}
