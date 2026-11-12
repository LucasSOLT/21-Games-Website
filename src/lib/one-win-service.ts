/**
 * Game #1 — 1 Win (`1-win`) Submission, Leaderboard Aggregation & Realtime Sync Service
 * Per GAME_DESIGN_BIBLE.md Q46–Q48:
 * - Enforces Tier 1 + Tier 2 public moderation (`moderateText(..., "public")`).
 * - Enforces 1–4 words and ≤ 35 characters via `normalizeOneWinEntry`.
 * - Enforces strict 1-submission-per-day lock (`localStorage` + Supabase unique constraints)
 *   and View-Only Archive mode on past dates (`dateKey !== getLocalDateKey()`).
 * - Subscribes to Supabase Realtime (`postgres_changes` on `public.one_win_submissions`)
 *   so the Live Top 100 Today's Wins Leaderboard updates in real time.
 */

import {
  normalizeOneWinEntry,
  type OneWinPromptPuzzle,
  type OneWinSeedItem,
} from "@/data/puzzles/1-win";
import { getLocalDateKey } from "@/lib/date-keys";
import {
  getGameProgress,
  recordGameWin,
  saveGameProgress,
} from "@/lib/game-storage";
import { moderateText } from "@/lib/moderation";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

const CLIENT_FP_KEY = "solgames_v1_client_fp";
const ONE_WIN_HISTORY_KEY = "solgames_v1_1w_history";
const ONE_WIN_CHANNEL_NAME = "solgames_one_win_v1";

export interface LocalOneWinSubmission {
  puzzleId?: string;
  dateKey: string;
  rawText: string;
  normalizedKey: string;
  displayText: string;
  submittedAt: string;
  syncedRemote: boolean;
}

export interface OneWinHistoryItem {
  dateKey: string;
  displayText: string;
  normalizedKey: string;
  rank: number;
  sharedCount: number;
  submittedAt: string;
}

export interface OneWinLeaderboardRow {
  rank: number;
  normalizedKey: string;
  displayText: string;
  count: number;
  isPlayerWin: boolean;
}

export interface OneWinLeaderboardSnapshot {
  entries: OneWinLeaderboardRow[];
  totalSubmissions: number;
  playerRank: number | null;
  playerCount: number | null;
  liveConnected: boolean;
}

export interface RemoteOneWinAggregate {
  normalizedKey: string;
  displayText: string;
  count: number;
}

export interface SubmitOneWinResult {
  ok: boolean;
  error?: string;
  submission?: LocalOneWinSubmission;
  snapshot?: OneWinLeaderboardSnapshot;
}

function getSafeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getOneWinClientFingerprint(): string {
  const storage = getSafeStorage();
  if (storage) {
    const existing = storage.getItem(CLIENT_FP_KEY);
    if (existing && existing.length >= 12 && existing.length <= 120) {
      return existing;
    }
  }
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
  const fp = `1wfp_${rand}`.slice(0, 64);
  try {
    storage?.setItem(CLIENT_FP_KEY, fp);
  } catch {
    // Ignore storage quota errors
  }
  return fp;
}

export function getLocalOneWinSubmission(
  dateKey: string
): LocalOneWinSubmission | null {
  const raw = getGameProgress<LocalOneWinSubmission>("1-win", dateKey);
  if (
    raw &&
    typeof raw.normalizedKey === "string" &&
    raw.normalizedKey.length > 0 &&
    typeof raw.displayText === "string"
  ) {
    return raw;
  }
  return null;
}

export function saveLocalOneWinSubmission(sub: LocalOneWinSubmission): void {
  saveGameProgress("1-win", sub.dateKey, sub);
}

export function getOneWinPersonalHistory(): OneWinHistoryItem[] {
  const storage = getSafeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(ONE_WIN_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is OneWinHistoryItem =>
          Boolean(
            x &&
              typeof x.dateKey === "string" &&
              typeof x.displayText === "string" &&
              typeof x.normalizedKey === "string"
          )
      )
      .map((x) => ({
        dateKey: x.dateKey,
        displayText: x.displayText,
        normalizedKey: x.normalizedKey,
        rank: typeof x.rank === "number" && x.rank > 0 ? x.rank : 1,
        sharedCount:
          typeof x.sharedCount === "number" && x.sharedCount > 0
            ? x.sharedCount
            : 1,
        submittedAt: x.submittedAt || new Date().toISOString(),
      }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  } catch {
    return [];
  }
}

export function upsertOneWinHistoryEntry(entry: OneWinHistoryItem): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    const existing = getOneWinPersonalHistory().filter(
      (item) => item.dateKey !== entry.dateKey
    );
    const updated = [entry, ...existing]
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
      .slice(0, 365);
    storage.setItem(ONE_WIN_HISTORY_KEY, JSON.stringify(updated));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("solgames:stats-updated"));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Pure deterministic leaderboard merger combining seeded baseline community counts,
 * live Supabase remote aggregates, and any unsynced local submission.
 */
export function mergeOneWinLeaderboard(
  seedWins: readonly OneWinSeedItem[],
  remoteAggregates: readonly RemoteOneWinAggregate[],
  localSubmission: LocalOneWinSubmission | null
): Omit<OneWinLeaderboardSnapshot, "liveConnected"> {
  const map = new Map<string, { displayText: string; count: number }>();

  for (const seed of seedWins) {
    if (!seed.normalizedKey) continue;
    const prev = map.get(seed.normalizedKey);
    if (prev) {
      prev.count += Math.max(0, seed.count);
    } else {
      map.set(seed.normalizedKey, {
        displayText: seed.displayText,
        count: Math.max(1, seed.count),
      });
    }
  }

  for (const rem of remoteAggregates) {
    if (!rem.normalizedKey || rem.count <= 0) continue;
    const prev = map.get(rem.normalizedKey);
    if (prev) {
      prev.count += rem.count;
    } else {
      map.set(rem.normalizedKey, {
        displayText: rem.displayText,
        count: rem.count,
      });
    }
  }

  // If player submitted locally and it wasn't persisted remotely (offline / no DB table yet),
  // add +1 locally so their entry immediately appears with accurate count.
  if (localSubmission && !localSubmission.syncedRemote) {
    const prev = map.get(localSubmission.normalizedKey);
    if (prev) {
      prev.count += 1;
    } else {
      map.set(localSubmission.normalizedKey, {
        displayText: localSubmission.displayText,
        count: 1,
      });
    }
  }

  const playerKey = localSubmission?.normalizedKey ?? null;
  const sortedAll = Array.from(map.entries())
    .map(([normalizedKey, val]) => ({
      normalizedKey,
      displayText: val.displayText,
      count: val.count,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.displayText.localeCompare(b.displayText);
    });

  let totalSubmissions = 0;
  let playerRank: number | null = null;
  let playerCount: number | null = null;

  const rankedAll: OneWinLeaderboardRow[] = sortedAll.map((item, idx) => {
    const rank = idx + 1;
    totalSubmissions += item.count;
    const isPlayerWin = playerKey !== null && item.normalizedKey === playerKey;
    if (isPlayerWin) {
      playerRank = rank;
      playerCount = item.count;
    }
    return {
      rank,
      normalizedKey: item.normalizedKey,
      displayText: item.displayText,
      count: item.count,
      isPlayerWin,
    };
  });

  // Refresh stored history rank/count whenever live leaderboard updates
  if (localSubmission && playerRank !== null && playerCount !== null) {
    upsertOneWinHistoryEntry({
      dateKey: localSubmission.dateKey,
      displayText: localSubmission.displayText,
      normalizedKey: localSubmission.normalizedKey,
      rank: playerRank,
      sharedCount: playerCount,
      submittedAt: localSubmission.submittedAt,
    });
  }

  return {
    entries: rankedAll.slice(0, 100),
    totalSubmissions,
    playerRank,
    playerCount,
  };
}

async function queryRemoteAggregates(
  dateKey: string
): Promise<{ aggregates: RemoteOneWinAggregate[]; liveConnected: boolean }> {
  if (!isSupabaseConfigured) {
    return { aggregates: [], liveConnected: false };
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { aggregates: [], liveConnected: false };
  }

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_one_win_top_100",
      { target_date: dateKey }
    );
    if (!rpcError && Array.isArray(rpcData)) {
      const aggregates: RemoteOneWinAggregate[] = rpcData
        .map((row: Record<string, unknown>) => ({
          normalizedKey: String(row.normalized_key ?? "").trim(),
          displayText: String(row.display_text ?? "").trim(),
          count: Number(row.submission_count ?? 0),
        }))
        .filter((r) => r.normalizedKey.length > 0 && r.count > 0);
      return { aggregates, liveConnected: true };
    }

    // Fallback direct table grouping if RPC hasn't been deployed yet
    const { data: rows, error: selErr } = await supabase
      .from("one_win_submissions")
      .select("normalized_key, display_text")
      .eq("puzzle_date", dateKey)
      .limit(2500);

    if (selErr || !Array.isArray(rows)) {
      return { aggregates: [], liveConnected: false };
    }

    const grouped = new Map<string, { displayText: string; count: number }>();
    for (const r of rows as Array<Record<string, unknown>>) {
      const k = String(r.normalized_key ?? "").trim();
      const d = String(r.display_text ?? "").trim();
      if (!k || !d) continue;
      const prev = grouped.get(k);
      if (prev) {
        prev.count += 1;
      } else {
        grouped.set(k, { displayText: d, count: 1 });
      }
    }
    return {
      aggregates: Array.from(grouped.entries()).map(([normalizedKey, v]) => ({
        normalizedKey,
        displayText: v.displayText,
        count: v.count,
      })),
      liveConnected: true,
    };
  } catch {
    return { aggregates: [], liveConnected: false };
  }
}

export async function fetchOneWinLeaderboard(
  dateKey: string,
  puzzle: Pick<OneWinPromptPuzzle, "seedCommunityWins">
): Promise<OneWinLeaderboardSnapshot> {
  const localSub = getLocalOneWinSubmission(dateKey);
  const { aggregates, liveConnected } = await queryRemoteAggregates(dateKey);
  const merged = mergeOneWinLeaderboard(
    puzzle.seedCommunityWins,
    aggregates,
    localSub
  );
  return {
    ...merged,
    liveConnected,
  };
}

function broadcastOneWinLocalEvent(dateKey: string): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return;
  }
  try {
    const ch = new BroadcastChannel(ONE_WIN_CHANNEL_NAME);
    ch.postMessage({ type: "one_win_submitted", dateKey });
    ch.close();
  } catch {
    // Ignore BroadcastChannel errors
  }
}

export async function submitOneWinEntry(opts: {
  dateKey: string;
  rawText: string;
  puzzle: Pick<OneWinPromptPuzzle, "seedCommunityWins">;
  userId?: string | null;
  todayDateKey?: string;
}): Promise<SubmitOneWinResult> {
  const today = opts.todayDateKey ?? getLocalDateKey();

  // Q48: Strictly block retroactive submissions on past/archive dates
  if (opts.dateKey !== today) {
    return {
      ok: false,
      error:
        "Submissions are closed for past dates. Archive leaderboards are view-only.",
    };
  }

  // Q46–Q48: Strict 1-submission-per-day lock
  const existing = getLocalOneWinSubmission(opts.dateKey);
  if (existing) {
    const snapshot = await fetchOneWinLeaderboard(opts.dateKey, opts.puzzle);
    return {
      ok: false,
      error: "You have already logged your 1 Win for today!",
      submission: existing,
      snapshot,
    };
  }

  // Q46: Word & character validation first so empty/long inputs get crisp guidance
  const normalized = normalizeOneWinEntry(opts.rawText);
  if (!normalized.valid) {
    return {
      ok: false,
      error: normalized.errors[0] || "Keep your win to 1–4 words (max 35 characters).",
    };
  }

  // Q48: Tier 1 + Tier 2 Public Moderation Filter (zero slurs, zero public profanity)
  const modCheck = moderateText(opts.rawText, "public", "Your 1 Win");
  if (!modCheck.allowed) {
    return {
      ok: false,
      error:
        modCheck.reason ||
        "Please keep your daily win community-friendly (profanity and slurs are not permitted).",
    };
  }

  const submittedAt = new Date().toISOString();
  let syncedRemote = false;

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const fingerprint = getOneWinClientFingerprint();
        const insertPayload: Record<string, unknown> = {
          puzzle_date: opts.dateKey,
          client_fingerprint: fingerprint,
          raw_text: normalized.rawTrimmed,
          normalized_key: normalized.normalizedKey,
          display_text: normalized.displayText,
        };
        if (opts.userId) {
          insertPayload.user_id = opts.userId;
        }
        const { error: insErr } = await supabase
          .from("one_win_submissions")
          .insert(insertPayload);

        if (!insErr) {
          syncedRemote = true;
        } else if (insErr.code === "23505") {
          // Unique constraint (already submitted from this fingerprint or user_id today)
          syncedRemote = true;
        }
      } catch {
        syncedRemote = false;
      }
    }
  }

  const submission: LocalOneWinSubmission = {
    dateKey: opts.dateKey,
    rawText: normalized.rawTrimmed,
    normalizedKey: normalized.normalizedKey,
    displayText: normalized.displayText,
    submittedAt,
    syncedRemote,
  };

  saveLocalOneWinSubmission(submission);
  recordGameWin("1-win", opts.dateKey, 0);

  const snapshot = await fetchOneWinLeaderboard(opts.dateKey, opts.puzzle);

  upsertOneWinHistoryEntry({
    dateKey: opts.dateKey,
    displayText: normalized.displayText,
    normalizedKey: normalized.normalizedKey,
    rank: snapshot.playerRank ?? 1,
    sharedCount: snapshot.playerCount ?? 1,
    submittedAt,
  });

  broadcastOneWinLocalEvent(opts.dateKey);

  return {
    ok: true,
    submission,
    snapshot,
  };
}

/**
 * Subscribes to live `one_win_submissions` changes via Supabase Realtime + BroadcastChannel.
 */
export function subscribeOneWinRealtime(
  dateKey: string,
  onUpdate: () => void
): () => void {
  const cleanups: Array<() => void> = [];

  if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel(ONE_WIN_CHANNEL_NAME);
      bc.onmessage = (ev) => {
        if (!ev.data?.dateKey || ev.data.dateKey === dateKey) {
          onUpdate();
        }
      };
      cleanups.push(() => {
        try {
          bc.close();
        } catch {
          // Ignore close error
        }
      });
    } catch {
      // Ignore BroadcastChannel error
    }
  }

  if (isSupabaseConfigured && typeof window !== "undefined") {
    const supabase = getSupabaseClient();
    if (supabase) {
      const channel = supabase
        .channel(`one_win_live_${dateKey}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "one_win_submissions",
            filter: `puzzle_date=eq.${dateKey}`,
          },
          () => {
            onUpdate();
          }
        )
        .subscribe();

      cleanups.push(() => {
        void supabase.removeChannel(channel);
      });
    }
  }

  return () => {
    for (const fn of cleanups) fn();
  };
}

export interface AdminOneWinRow {
  id: string;
  rawText: string;
  normalizedKey: string;
  displayText: string;
  createdAt: string;
}

export async function fetchRawOneWinSubmissionsForAdmin(
  dateKey: string
): Promise<AdminOneWinRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("one_win_submissions")
      .select("id, raw_text, normalized_key, display_text, created_at")
      .eq("puzzle_date", dateKey)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error || !Array.isArray(data)) return [];
    return data.map((r: Record<string, unknown>) => ({
      id: String(r.id ?? ""),
      rawText: String(r.raw_text ?? ""),
      normalizedKey: String(r.normalized_key ?? ""),
      displayText: String(r.display_text ?? ""),
      createdAt: String(r.created_at ?? ""),
    }));
  } catch {
    return [];
  }
}

export async function deleteOneWinSubmissionAsGM(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: "Supabase client unavailable." };
  }
  const { error } = await supabase
    .from("one_win_submissions")
    .delete()
    .eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
