/**
 * Custom friend-puzzle persistence for compact `?b=<prefix>-<8chars>` links.
 *
 * Primary store: `public.custom_puzzles` (Supabase, RLS-protected).
 * Fallback store: `localStorage` (so creating / replaying a link never fails offline or
 * when signed out). All creator text is checked with Tier 1 (+ no Tier 2) moderation:
 * custom friend games are private, so casual swearing is allowed but slurs never are.
 */

import { getSupabaseClient } from "@/lib/supabase";
import {
  buildCustomGameShareUrl,
  generateCustomGameId,
  getGameSlugFromCustomId,
  isValidCustomGameId,
  MAX_CUSTOM_SHARE_URL_LENGTH,
} from "@/lib/custom-game-share";
import { moderateFields } from "@/lib/moderation";
import type { CustomLinkGameSlug } from "@/lib/games-config";

export interface CustomPuzzleRecord<P = Record<string, unknown>> {
  id: string;
  gameSlug: CustomLinkGameSlug;
  title: string;
  creatorId: string | null;
  creatorName: string;
  creatorHandle: string;
  payload: P;
  createdAt: string;
}

export type SaveCustomPuzzleResult<P> =
  | { ok: true; record: CustomPuzzleRecord<P>; shareUrl: string; synced: boolean }
  | { ok: false; error: string };

const LOCAL_KEY = "solgames_v1_custom_puzzles";
const MAX_LOCAL_RECORDS = 100;

function readLocal(): CustomPuzzleRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is CustomPuzzleRecord =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as CustomPuzzleRecord).id === "string" &&
        isValidCustomGameId((r as CustomPuzzleRecord).id) &&
        typeof (r as CustomPuzzleRecord).payload === "object"
    );
  } catch {
    return [];
  }
}

function writeLocal(records: CustomPuzzleRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify(records.slice(-MAX_LOCAL_RECORDS))
    );
  } catch {
    // storage full / blocked: Supabase remains the source of truth
  }
}

/** Flattens every string inside a payload for moderation (depth-limited). */
export function collectPayloadStrings(
  value: unknown,
  prefix = "payload",
  depth = 0,
  out: Record<string, string> = {}
): Record<string, string> {
  if (depth > 4) return out;
  if (typeof value === "string") {
    out[prefix] = value;
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => collectPayloadStrings(v, `${prefix}[${i}]`, depth + 1, out));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      collectPayloadStrings(v, `${prefix}.${k}`, depth + 1, out);
    }
  }
  return out;
}

export interface SaveCustomPuzzleInput<P> {
  gameSlug: CustomLinkGameSlug;
  title: string;
  creatorId?: string | null;
  creatorName: string;
  creatorHandle: string;
  payload: P;
  /** Optional pre-generated id (must be valid and match the game prefix). */
  id?: string;
}

/** Validates, moderates (private tier) and saves a custom puzzle; always returns a link. */
export async function saveCustomPuzzle<P extends Record<string, unknown>>(
  input: SaveCustomPuzzleInput<P>
): Promise<SaveCustomPuzzleResult<P>> {
  const id = input.id ?? generateCustomGameId(input.gameSlug);
  if (!isValidCustomGameId(id) || getGameSlugFromCustomId(id) !== input.gameSlug) {
    return { ok: false, error: "Invalid custom puzzle id." };
  }

  const verdict = moderateFields(
    {
      title: input.title,
      creatorName: input.creatorName,
      ...collectPayloadStrings(input.payload),
    },
    "private_custom"
  );
  if (!verdict.allowed) {
    return {
      ok: false,
      error: verdict.reason ?? "This content isn't allowed. Please edit it and try again.",
    };
  }

  const shareUrl = buildCustomGameShareUrl(input.gameSlug, id);
  if (shareUrl.length >= MAX_CUSTOM_SHARE_URL_LENGTH) {
    // Never expected on 21games.ai; guards against unusually long preview origins.
    console.warn(`[custom-puzzles] share link is ${shareUrl.length} chars`);
  }

  const record: CustomPuzzleRecord<P> = {
    id,
    gameSlug: input.gameSlug,
    title: input.title,
    creatorId: input.creatorId ?? null,
    creatorName: input.creatorName,
    creatorHandle: input.creatorHandle,
    payload: input.payload,
    createdAt: new Date().toISOString(),
  };

  // Local copy first: the link works on this device even if the network call fails.
  writeLocal([...readLocal().filter((r) => r.id !== id), record]);

  let synced = false;
  const supabase = getSupabaseClient();
  if (supabase && input.creatorId) {
    try {
      const { error } = await supabase.from("custom_puzzles").insert({
        id,
        game_slug: input.gameSlug,
        title: input.title,
        creator_id: input.creatorId,
        creator_name: input.creatorName,
        creator_handle: input.creatorHandle,
        payload: input.payload,
      });
      synced = !error;
      if (error) console.warn("[custom-puzzles] remote save failed:", error.message);
    } catch (err) {
      console.warn("[custom-puzzles] remote save threw:", err);
    }
  }

  return { ok: true, record, shareUrl, synced };
}

/** Loads a custom puzzle by `?b=` id: local cache first, then Supabase. */
export async function fetchCustomPuzzle<P = Record<string, unknown>>(
  id: string
): Promise<CustomPuzzleRecord<P> | null> {
  if (!isValidCustomGameId(id)) return null;
  const local = readLocal().find((r) => r.id === id);
  if (local) return local as CustomPuzzleRecord<P>;

  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("custom_puzzles")
      .select("id, game_slug, title, creator_id, creator_name, creator_handle, payload, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const slug = getGameSlugFromCustomId(String(data.id));
    if (!slug || slug !== data.game_slug) return null;
    const record: CustomPuzzleRecord<P> = {
      id: String(data.id),
      gameSlug: slug,
      title: String(data.title ?? ""),
      creatorId: data.creator_id ? String(data.creator_id) : null,
      creatorName: String(data.creator_name ?? ""),
      creatorHandle: String(data.creator_handle ?? ""),
      payload: data.payload as P,
      createdAt: String(data.created_at ?? new Date().toISOString()),
    };
    writeLocal([...readLocal().filter((r) => r.id !== id), record as CustomPuzzleRecord]);
    return record;
  } catch {
    return null;
  }
}
