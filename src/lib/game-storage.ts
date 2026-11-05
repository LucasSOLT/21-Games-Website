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
  currentStreak: number;
  maxStreak: number;
  lastCompletedDateKey: string | null;
  bestTimeSeconds: number | null;
  totalTimeSeconds: number;
  completedDates: string[];
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
// Game Stats & Streaks
// ============================================================================

const DEFAULT_STATS: GameStats = {
  played: 0,
  won: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastCompletedDateKey: null,
  bestTimeSeconds: null,
  totalTimeSeconds: 0,
  completedDates: [],
};

export function getGameStats(gameSlug: PlayableGameSlug): GameStats {
  return safeReadJson<GameStats>(
    `${STORAGE_PREFIX}_stats_${gameSlug}`,
    DEFAULT_STATS
  );
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

  let nextStreak = 1;
  if (current.lastCompletedDateKey) {
    const diff = daysBetweenDateKeys(current.lastCompletedDateKey, dateKey);
    if (diff === 1) {
      nextStreak = current.currentStreak + 1;
    } else if (diff === 0) {
      nextStreak = current.currentStreak;
    } else {
      nextStreak = 1;
    }
  }

  const updated: GameStats = {
    played: current.played + 1,
    won: current.won + 1,
    currentStreak: nextStreak,
    maxStreak: Math.max(current.maxStreak, nextStreak),
    lastCompletedDateKey: dateKey,
    bestTimeSeconds:
      elapsedSeconds > 0
        ? current.bestTimeSeconds === null
          ? elapsedSeconds
          : Math.min(current.bestTimeSeconds, elapsedSeconds)
        : current.bestTimeSeconds,
    totalTimeSeconds: current.totalTimeSeconds + Math.max(0, elapsedSeconds),
    completedDates: [...current.completedDates, dateKey],
  };

  safeWriteJson(`${STORAGE_PREFIX}_stats_${gameSlug}`, updated);
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
            ...board.sampleJourneys.filter((j) => !mergedIds.has(j.id)),
          ];
          return combined;
        }
      } catch {
        // Fallback cleanly to local + sample journeys
      }
    }
  }

  return [...localJourneys, ...board.sampleJourneys];
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

export async function saveAdminConnect5Override(
  dateKey: string,
  puzzle: Connect5Puzzle
): Promise<void> {
  const current = getAdminConnect5Overrides();
  current[dateKey] = puzzle;
  safeWriteJson(`${STORAGE_PREFIX}_admin_c5_overrides`, current);
  clearConnect5Progress(dateKey);

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from("daily_puzzles").upsert(
          {
            game_slug: "connect-5",
            puzzle_date: dateKey,
            puzzle_number: puzzle.puzzleNumber,
            title: puzzle.title,
            author: puzzle.author,
            editor: puzzle.editor,
            payload: puzzle,
          },
          { onConflict: "game_slug,puzzle_date" }
        );
      } catch {
        // Saved locally
      }
    }
  }
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
): Promise<void> {
  const current = getAdmin21ThingsOverrides();
  current[dateKey] = board;
  safeWriteJson(`${STORAGE_PREFIX}_admin_21t_overrides`, current);
  clear21ThingsProgress(board.id);

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from("daily_puzzles").upsert(
          {
            game_slug: "21-things",
            puzzle_date: dateKey,
            puzzle_number: board.puzzleNumber,
            title: board.title,
            author: board.creatorName,
            editor: "Stephen Huff",
            payload: board,
          },
          { onConflict: "game_slug,puzzle_date" }
        );
      } catch {
        // Saved locally
      }
    }
  }
}
