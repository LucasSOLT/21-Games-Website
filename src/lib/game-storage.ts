import type { Connect5Puzzle } from "@/data/puzzles/connect-5";
import type {
  TwentyOneJourney,
  TwentyOneThingsBoard,
} from "@/data/puzzles/21-things";
import { daysBetweenDateKeys, getLocalDateKey } from "@/lib/daily-engine";
import type { PlayableGameSlug } from "@/lib/games-config";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

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
  const existing = getSavedUser21Boards().filter((b) => b.id !== board.id);
  safeWriteJson(`${STORAGE_PREFIX}_user_21boards`, [board, ...existing]);

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from("twenty_one_boards").upsert({
          id: board.id,
          title: board.title,
          creator_name: board.creatorName,
          creator_bio: board.creatorBio,
          items: board.items,
          raw_transcript: rawTranscript ?? null,
          is_daily: false,
        });
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
}

let puzzlesStoreRevision = 0;

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

/**
 * Fetches all daily puzzles from Supabase `public.daily_puzzles` (Connect 5 & 21 Things),
 * updates local storage override caches, and dispatches "solgames:puzzles-updated".
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
    let c5Changed = false;
    let t21Changed = false;

    for (const row of data) {
      const dateKey = String(row.puzzle_date);
      if (!dateKey) continue;

      if (row.game_slug === "connect-5" && row.payload) {
        const puzzle = row.payload as Connect5Puzzle;
        if (Array.isArray(puzzle.words) && puzzle.words.length === 5) {
          c5Overrides[dateKey] = puzzle;
          c5Changed = true;
        }
      } else if (row.game_slug === "21-things" && row.payload) {
        const board = row.payload as TwentyOneThingsBoard;
        if (Array.isArray(board.items) && board.items.length === 21) {
          t21Overrides[dateKey] = board;
          t21Changed = true;
        }
      }
    }

    if (c5Changed) {
      safeWriteJson(`${STORAGE_PREFIX}_admin_c5_overrides`, c5Overrides);
    }
    if (t21Changed) {
      safeWriteJson(`${STORAGE_PREFIX}_admin_21t_overrides`, t21Overrides);
    }

    if ((c5Changed || t21Changed) && typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent("solgames:puzzles-updated", {
            detail: { source: "syncAllRemoteDailyPuzzles" },
          })
        );
      } catch {
        // Ignore DOM event errors
      }
    }
  } catch {
    // Non-fatal sync fallback
  }
}

export async function saveAdminConnect5Override(
  dateKey: string,
  puzzle: Connect5Puzzle
): Promise<SaveAdminOverrideResult> {
  const current = getAdminConnect5Overrides();
  current[dateKey] = puzzle;
  safeWriteJson(`${STORAGE_PREFIX}_admin_c5_overrides`, current);
  clearConnect5Progress(dateKey);

  let remotePersisted = false;
  let remoteError: string | undefined;

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase.from("daily_puzzles").upsert(
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
        if (error) {
          remoteError = error.message;
        } else {
          remotePersisted = true;
        }
      } catch (err: unknown) {
        remoteError = err instanceof Error ? err.message : "Failed to persist puzzle to Supabase.";
      }
    }
  }

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("solgames:puzzles-updated", {
          detail: { gameSlug: "connect-5", dateKey },
        })
      );
    } catch {
      // Ignore DOM event errors
    }
  }

  return {
    ok: true,
    remotePersisted,
    error: remoteError,
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
  board: TwentyOneThingsBoard
): Promise<SaveAdminOverrideResult> {
  const current = getAdmin21ThingsOverrides();
  current[dateKey] = board;
  safeWriteJson(`${STORAGE_PREFIX}_admin_21t_overrides`, current);
  clear21ThingsProgress(board.id);

  let remotePersisted = false;
  let remoteError: string | undefined;

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase.from("daily_puzzles").upsert(
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
        if (error) {
          remoteError = error.message;
        } else {
          remotePersisted = true;
        }
      } catch (err: unknown) {
        remoteError = err instanceof Error ? err.message : "Failed to persist board to Supabase.";
      }
    }
  }

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("solgames:puzzles-updated", {
          detail: { gameSlug: "21-things", dateKey },
        })
      );
    } catch {
      // Ignore DOM event errors
    }
  }

  return {
    ok: true,
    remotePersisted,
    error: remoteError,
  };
}
