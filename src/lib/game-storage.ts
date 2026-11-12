import type { Connect5Puzzle } from "@/data/puzzles/connect-5";
import type {
  TwentyOneJourney,
  TwentyOneThingsBoard,
} from "@/data/puzzles/21-things";
import type { SeventeenSyllablesPuzzle } from "@/data/puzzles/17-syllables";
import { daysBetweenDateKeys, getLocalDateKey } from "@/lib/daily-engine";
import type { AllGameSlug, PlayableGameSlug } from "@/lib/games-config";
import { getPuzzleSource } from "@/lib/puzzle-sources";
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
  distribution: {},
};

export function recomputeStreakFromCompletedDates(
  completedDates: string[],
  todayKey?: string
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

  const uniqueSorted = Array.from(
    new Set(
      completedDates
        .filter((d): d is string => typeof d === "string")
        .map((d) => d.trim())
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    )
  ).sort((a, b) => a.localeCompare(b));

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
    const diff = daysBetweenDateKeys(uniqueSorted[i - 1], uniqueSorted[i]);
    if (diff === 1) {
      run += 1;
      if (run > maxStreak) {
        maxStreak = run;
      }
    } else if (diff > 1) {
      run = 1;
    }
  }

  const lastCompletedDate = uniqueSorted[uniqueSorted.length - 1];
  let currentStreak = run;

  if (todayKey && /^\d{4}-\d{2}-\d{2}$/.test(todayKey.trim())) {
    const normalizedToday = todayKey.trim();
    const datesUpToToday = uniqueSorted.filter(
      (d) => d.localeCompare(normalizedToday) <= 0
    );
    if (datesUpToToday.length === 0) {
      currentStreak = 0;
    } else {
      const lastUpToToday = datesUpToToday[datesUpToToday.length - 1];
      const gapFromToday = daysBetweenDateKeys(lastUpToToday, normalizedToday);
      if (gapFromToday > 1) {
        currentStreak = 0;
      } else {
        let streakUpToToday = 1;
        for (let i = datesUpToToday.length - 1; i > 0; i--) {
          const diff = daysBetweenDateKeys(
            datesUpToToday[i - 1],
            datesUpToToday[i]
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

export function normalizeGameStats(raw?: Partial<GameStats> | null): GameStats {
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_STATS,
      completedDates: [],
      distribution: {},
    };
  }

  const dates = Array.isArray(raw.completedDates)
    ? Array.from(
        new Set(
          raw.completedDates
            .filter((d): d is string => typeof d === "string")
            .map((d) => d.trim())
            .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        )
      ).sort((a, b) => a.localeCompare(b))
    : [];

  const streakInfo =
    dates.length > 0
      ? recomputeStreakFromCompletedDates(dates)
      : {
          currentStreak: Math.max(0, Number(raw.currentStreak ?? 0) || 0),
          maxStreak: Math.max(0, Number(raw.maxStreak ?? 0) || 0),
          lastCompletedDate:
            raw.lastCompletedDateKey ?? raw.lastCompletedDate ?? null,
        };

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
  const currentStreak =
    dates.length > 0
      ? streakInfo.currentStreak
      : Math.max(0, Number(raw.currentStreak ?? 0) || 0);
  const lastDate =
    streakInfo.lastCompletedDate ??
    raw.lastCompletedDateKey ??
    raw.lastCompletedDate ??
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
    distribution,
  };
}

export function mergeTwoGameStats(
  a: Partial<GameStats> | GameStats,
  b: Partial<GameStats> | GameStats
): GameStats {
  const normA = normalizeGameStats(a);
  const normB = normalizeGameStats(b);

  const mergedDates = Array.from(
    new Set([...normA.completedDates, ...normB.completedDates])
  ).sort((x, y) => x.localeCompare(y));

  const streakInfo = recomputeStreakFromCompletedDates(mergedDates);
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
    mergedDates.length > 0
      ? streakInfo.currentStreak
      : Math.max(normA.currentStreak, normB.currentStreak);
  const lastDate =
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
    mergedDistribution[key] = Math.max(mergedDistribution[key] ?? 0, val);
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

export function recordGameWin(
  gameSlug: PlayableGameSlug,
  dateKey: string = getLocalDateKey(),
  elapsedSeconds: number = 0
): GameStats {
  const current = getGameStats(gameSlug);
  if (current.completedDates.includes(dateKey)) {
    return current;
  }

  const nextDates = Array.from(
    new Set([...current.completedDates, dateKey])
  ).sort((a, b) => a.localeCompare(b));
  const streakInfo = recomputeStreakFromCompletedDates(nextDates);
  const nextWon = Math.max(current.won + 1, nextDates.length);
  const nextPlayed = Math.max(current.played + 1, nextWon);

  const updated: GameStats = {
    played: nextPlayed,
    won: nextWon,
    wins: nextWon,
    currentStreak: streakInfo.currentStreak,
    maxStreak: Math.max(current.maxStreak, streakInfo.maxStreak),
    lastCompletedDateKey: streakInfo.lastCompletedDate ?? dateKey,
    lastCompletedDate: streakInfo.lastCompletedDate ?? dateKey,
    bestTimeSeconds:
      elapsedSeconds > 0
        ? current.bestTimeSeconds === null
          ? elapsedSeconds
          : Math.min(current.bestTimeSeconds, elapsedSeconds)
        : current.bestTimeSeconds,
    totalTimeSeconds: current.totalTimeSeconds + Math.max(0, elapsedSeconds),
    completedDates: nextDates,
    distribution: { ...current.distribution },
  };

  setGameStats(gameSlug, updated);
  notifyProfileSyncListeners({
    type: "game_win",
    gameSlug,
    dateKey,
    stats: updated,
  });
  return updated;
}

export function isDateCompleted(
  gameSlug: PlayableGameSlug,
  dateKey: string
): boolean {
  const stats = getGameStats(gameSlug);
  return stats.completedDates.includes(dateKey);
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
  elapsedSeconds: number
): GameStats {
  const stats = recordGameWin("17-syllables", dateKey, elapsedSeconds);
  const starKey = `stars_${stars.toFixed(1)}`;
  const currentCount = stats.distribution[starKey] ?? 0;
  stats.distribution[starKey] = currentCount + 1;
  setGameStats("17-syllables", stats);
  return stats;
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
              byId.set(j.id, j);
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
              ? String(row.voice_note_url)
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

  const newEntry: TwentyOneJourney = {
    ...journey,
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
        await supabase.from("twenty_one_responses").insert({
          board_id: journey.boardId,
          player_name: journey.playerName,
          pick_6: journey.pick6,
          pick_3: journey.pick3,
          pick_1: journey.pick1,
          reflection_note: journey.reflectionNote,
          voice_note_url: journey.voiceNoteDataUrl ?? null,
        });
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

export function getAdminConnect5Overrides(): Record<string, Connect5Puzzle> {
  return safeReadJson<Record<string, Connect5Puzzle>>(
    `${STORAGE_PREFIX}_admin_c5_overrides`,
    {}
  );
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
      const puzzle = data.payload as Connect5Puzzle;
      if (Array.isArray(puzzle.words) && puzzle.words.length === 5) {
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

  // 1. Post to BroadcastChannel for other open tabs
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

  // 2. Storage fallback for tabs/browsers without BroadcastChannel
  try {
    safeWriteJson(`${STORAGE_PREFIX}_puzzles_broadcast_ping`, {
      ...detail,
      _broadcastTimestamp: Date.now(),
    });
  } catch {
    // Ignore storage quota errors
  }

  // 3. Local DOM CustomEvent for current tab
  try {
    window.dispatchEvent(
      new CustomEvent("solgames:puzzles-updated", { detail })
    );
  } catch {
    // Ignore DOM event errors
  }
}

function handleReceivedPuzzleUpdate(detail: Record<string, unknown>): void {
  if (!detail) return;
  puzzlesStoreRevision += 1;

  const payload = detail.payload ?? detail.puzzle ?? detail.board;

  // If this update contained puzzle data, ensure local storage has it
  if (detail.gameSlug === "connect-5" && typeof detail.dateKey === "string" && payload) {
    const puzzle = payload as Connect5Puzzle;
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
    const puzzle = payload as SeventeenSyllablesPuzzle;
    detail.puzzle = puzzle;
    const current = getAdmin17SyllablesOverrides();
    current[detail.dateKey] = puzzle;
    safeWriteJson(`${STORAGE_PREFIX}_admin_17s_overrides`, current);
  } else if (
    isGenericOverrideSlug(detail.gameSlug) &&
    typeof detail.dateKey === "string" &&
    payload
  ) {
    // Countdown games #9 .. #1 share one generic, validated override cache.
    if (cacheGenericOverride(detail.gameSlug, detail.dateKey, payload)) {
      detail.puzzle = payload;
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
let realtimeChannelUnsubscribe: (() => void) | null = null;

export function getActiveRealtimeChannel(): RealtimeChannel | null {
  return activeRealtimeChannel;
}

export function broadcastRemotePuzzleUpdate(detail: {
  gameSlug: string;
  dateKey: string;
  hash?: string;
  payload?: unknown;
}): void {
  if (!activeRealtimeChannel && typeof window !== "undefined" && isSupabaseConfigured) {
    initRealtimePuzzleSync();
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
        },
      });
    } catch {
      // Non-fatal broadcast send error
    }
  }
}

export function initRealtimePuzzleSync(): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  if (realtimeChannelInitialized && realtimeChannelUnsubscribe) {
    return realtimeChannelUnsubscribe;
  }

  // 1. Setup BroadcastChannel and storage listeners for cross-tab communication
  setupCrossTabSync();

  // 2. Setup focus & visibility change listeners (throttled to at most once every 10 seconds)
  let lastVisibilitySync = 0;
  const handleWakeupSync = () => {
    const now = Date.now();
    if (now - lastVisibilitySync < 10000) return;
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

  // 3. Setup Supabase Realtime channel if Supabase is configured
  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
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
                  const puzzle = newRow.payload as Connect5Puzzle;
                  if (Array.isArray(puzzle.words) && puzzle.words.length === 5) {
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
                  const puzzle = newRow.payload as SeventeenSyllablesPuzzle;
                  if (Array.isArray(puzzle.lines) && puzzle.lines.length === 3) {
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
                // If row payload missing or event was DELETE, trigger full resync
                void syncAllRemoteDailyPuzzles();
              }
            }
          );

        activeRealtimeChannel = channel;
        channel.subscribe();

        realtimeChannelInitialized = true;
        realtimeChannelUnsubscribe = () => {
          try {
            void supabase.removeChannel(channel);
          } catch {
            // Ignore channel cleanup errors
          }
          activeRealtimeChannel = null;
          window.removeEventListener("focus", handleWakeupSync);
          document.removeEventListener("visibilitychange", handleVisibility);
          realtimeChannelInitialized = false;
          realtimeChannelUnsubscribe = null;
        };
        return realtimeChannelUnsubscribe;
      } catch {
        // Fallback to local polling/focus sync
      }
    }
  }

  realtimeChannelInitialized = true;
  realtimeChannelUnsubscribe = () => {
    window.removeEventListener("focus", handleWakeupSync);
    document.removeEventListener("visibilitychange", handleVisibility);
    realtimeChannelInitialized = false;
    realtimeChannelUnsubscribe = null;
  };
  return realtimeChannelUnsubscribe;
}

/**
 * Fetches all daily puzzles from Supabase `public.daily_puzzles` (Connect 5, 21 Things, 17 Syllables),
 * updates local storage override caches, and dispatches "solgames:puzzles-updated" via BroadcastChannel.
 * This ensures that puzzle edits made by Game Masters on any device immediately
 * synchronize across all browser sessions upon page load or refresh.
 */
export async function syncAllRemoteDailyPuzzles(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const { data, error } = await supabase
      .from("daily_puzzles")
      .select("game_slug, puzzle_date, payload, updated_at")
      .order("puzzle_date", { ascending: false })
      .limit(200);

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
        const puzzle = row.payload as Connect5Puzzle;
        if (Array.isArray(puzzle.words) && puzzle.words.length === 5) {
          c5Overrides[dateKey] = puzzle;
          c5Changed = true;
          puzzleHashes[`connect-5:${dateKey}`] = computePuzzleContentHash(puzzle);
        }
      } else if (row.game_slug === "21-things" && row.payload) {
        const board = row.payload as TwentyOneThingsBoard;
        if (Array.isArray(board.items) && board.items.length === 21) {
          t21Overrides[dateKey] = board;
          t21Changed = true;
          puzzleHashes[`21-things:${dateKey}`] = computePuzzleContentHash(board);
        }
      } else if (row.game_slug === "17-syllables" && row.payload) {
        const puzzle = row.payload as SeventeenSyllablesPuzzle;
        if (Array.isArray(puzzle.lines) && puzzle.lines.length === 3) {
          s17Overrides[dateKey] = puzzle;
          s17Changed = true;
          puzzleHashes[`17-syllables:${dateKey}`] = computePuzzleContentHash(puzzle);
        }
      } else if (isGenericOverrideSlug(row.game_slug) && row.payload) {
        if (cacheGenericOverride(row.game_slug, dateKey, row.payload)) {
          genericChanged = true;
          puzzleHashes[`${row.game_slug}:${dateKey}`] = computePuzzleContentHash(
            row.payload
          );
        }
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
  puzzle: Connect5Puzzle,
  authContext?: AdminSaveAuthContext
): Promise<SaveAdminOverrideResult> {
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

export function getAdmin17SyllablesOverrides(): Record<
  string,
  SeventeenSyllablesPuzzle
> {
  return safeReadJson<Record<string, SeventeenSyllablesPuzzle>>(
    `${STORAGE_PREFIX}_admin_17s_overrides`,
    {}
  );
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
      const puzzle = data.payload as SeventeenSyllablesPuzzle;
      if (
        Array.isArray(puzzle.lines) &&
        puzzle.lines.length === 3 &&
        Array.isArray(puzzle.chunks) &&
        puzzle.chunks.length > 0
      ) {
        const current = getAdmin17SyllablesOverrides();
        current[dateKey] = puzzle;
        safeWriteJson(`${STORAGE_PREFIX}_admin_17s_overrides`, current);
        return puzzle;
      }
    }
  } catch {
    // Fallback to local overrides
  }
  return null;
}

export async function saveAdmin17SyllablesOverride(
  dateKey: string,
  puzzle: SeventeenSyllablesPuzzle,
  authContext?: AdminSaveAuthContext
): Promise<SaveAdminOverrideResult> {
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
// Generic (all 9 games) override cache, remote fetch & admin save
// ============================================================================

const LEGACY_OVERRIDE_SLUGS: ReadonlySet<string> = new Set([
  "connect-5",
  "21-things",
  "17-syllables",
]);

/** True for any registered game slug that is NOT one of the 3 legacy typed override stores. */
export function isGenericOverrideSlug(slug: unknown): slug is AllGameSlug {
  return (
    typeof slug === "string" &&
    !LEGACY_OVERRIDE_SLUGS.has(slug) &&
    getPuzzleSource(slug) !== null
  );
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
  const source = getPuzzleSource(gameSlug);
  if (!source || !source.validate(payload)) return false;
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
      const source = getPuzzleSource(gameSlug);
      return source && source.validate(data.payload) ? data.payload : null;
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
  const source = getPuzzleSource(gameSlug);
  if (!source || !source.validate(payload)) {
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
