import {
  TWENTY_ONE_THINGS_BOARDS,
  type TwentyOneJourney,
} from "@/data/puzzles/21-things";
import { daysBetweenDateKeys, getLocalDateKey } from "@/lib/daily-engine";
import {
  DEFAULT_STATS,
  getAdmin21ThingsOverrides,
  getAllLocalPlayerJourneys,
  getGameStats,
  getUserCreated21Boards,
  mergeTwoGameStats,
  normalizeGameStats,
  registerProfileSyncCallback,
  setGameStats,
  type GameStats,
} from "@/lib/game-storage";
import { assetPath } from "@/lib/asset-path";
import {
  clearAuthStorage,
  getRememberLogin,
  getSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { checkContentModeration } from "@/lib/moderation";

export const ACTIVE_USER_KEY = "solgames_v1_active_user";

// Startup scrubber to purge legacy plaintext password database
if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem("solgames_v1_accounts_db");
  } catch {
    // Ignore storage errors
  }
}

export type UserRole = "game_master" | "admin" | "user";

export const USER_ROLES: readonly UserRole[] = [
  "game_master",
  "admin",
  "user",
] as const;

export const INITIAL_GAME_MASTERS: readonly string[] = [
  "lucas@soltheory.com",
  "steve@soltheory.com",
] as const;

export type AvatarColor =
  | "#F9D423"
  | "#2ECC71"
  | "#9D50BB"
  | "#daa8d0"
  | "#111111";

export const AVATAR_COLORS: readonly AvatarColor[] = [
  "#F9D423",
  "#2ECC71",
  "#9D50BB",
  "#daa8d0",
  "#111111",
] as const;

export const AVATAR_COLOR_OPTIONS: ReadonlyArray<{
  color: AvatarColor;
  label: string;
  textClass: string;
}> = [
  { color: "#F9D423", label: "SOL Yellow", textClass: "text-black" },
  { color: "#2ECC71", label: "Connect Green", textClass: "text-black" },
  { color: "#9D50BB", label: "SOL Purple", textClass: "text-white" },
  { color: "#daa8d0", label: "21 Things Lilac", textClass: "text-black" },
  { color: "#111111", label: "NYT Ink Black", textClass: "text-white" },
] as const;

export interface RecentResonancePick {
  boardId: string;
  boardTitle: string;
  dateKey: string;
  pick1Item: string;
  reflectionNote: string;
  pickedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  handle: string;
  avatarColor: AvatarColor;
  role: UserRole;
  isBanned: boolean;
  bannedAt?: string | null;
  bannedReason?: string | null;
  memberSince: string;
  connect5Stats: GameStats;
  twentyOneStats: GameStats;
  boardsCreatedCount: number;
  createdBoardIds: string[];
  recentPicks: RecentResonancePick[];
  authMode: "supabase" | "local";
  lastSyncedAt: string;
}


export interface SignUpInput {
  email: string;
  password?: string;
  displayName?: string;
  handle?: string;
  avatarColor?: AvatarColor;
}

export interface SignInInput {
  email: string;
  password?: string;
}

export interface UpdateProfileInput {
  displayName?: string;
  handle?: string;
  avatarColor?: AvatarColor;
}

export interface AuthResult {
  ok: boolean;
  profile: UserProfile | null;
  error?: string;
  message?: string;
  magicLinkSent?: boolean;
}

export function isValidAvatarColor(value: unknown): value is AvatarColor {
  return (
    typeof value === "string" &&
    (AVATAR_COLORS as readonly string[]).includes(value)
  );
}

export function normalizeEmail(email?: string | null): string {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

export function isInitialGameMaster(email?: string | null): boolean {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  return INITIAL_GAME_MASTERS.includes(normalized);
}

export function isValidUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value as UserRole)
  );
}

let activeVerifiedJwtEmail: string | null = null;
let activeVerifiedJwtToken: string | null = null;

export function getVerifiedJwtEmail(): string | null {
  return activeVerifiedJwtEmail;
}

export function getVerifiedJwtToken(): string | null {
  return activeVerifiedJwtToken;
}

export function setVerifiedJwtEmailForTesting(email: string | null): void {
  activeVerifiedJwtEmail = email ? normalizeEmail(email) : null;
}

export async function verifyGameMasterSession(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session?.user?.email || !session?.access_token) {
      activeVerifiedJwtEmail = null;
      activeVerifiedJwtToken = null;
      return false;
    }
    const email = normalizeEmail(session.user.email);
    activeVerifiedJwtEmail = email;
    activeVerifiedJwtToken = session.access_token;
    return isInitialGameMaster(email);
  } catch {
    activeVerifiedJwtEmail = null;
    activeVerifiedJwtToken = null;
    return false;
  }
}

export function isGameMaster(profile: UserProfile | null): boolean {
  if (!profile || profile.isBanned) return false;
  if (!profile.email || typeof profile.email !== "string") return false;
  const email = normalizeEmail(profile.email);
  if (!email || !isInitialGameMaster(email)) return false;

  if (typeof window !== "undefined") {
    if (profile.authMode !== "supabase") return false;
    if (!activeVerifiedJwtEmail || activeVerifiedJwtEmail !== email) {
      return false;
    }
  }
  return true;
}

export function isAdmin(profile: UserProfile | null): boolean {
  return isGameMaster(profile);
}

export function canAccessPuzzleStudio(profile: UserProfile | null): boolean {
  return isGameMaster(profile);
}

export interface DateEditPermission {
  canEdit: boolean;
  reason?: string;
  isPast: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export function checkDateEditPermission(
  profile: UserProfile | null,
  targetDateKey: string,
  todayDateKey: string = getLocalDateKey()
): DateEditPermission {
  if (!profile || profile.isBanned) {
    return {
      canEdit: false,
      reason: profile?.isBanned
        ? `Account suspended: ${profile.bannedReason || "Access revoked."}`
        : "You must be signed in with an authorized editor account.",
      isPast: false,
      isToday: false,
      isFuture: false,
    };
  }

  const diff = daysBetweenDateKeys(todayDateKey, targetDateKey);
  const isPast = diff < 0;
  const isToday = diff === 0;
  const isFuture = diff > 0;

  if (isGameMaster(profile)) {
    return { canEdit: true, isPast, isToday, isFuture };
  }

  if (profile.role === "admin") {
    if (isFuture) {
      return { canEdit: true, isPast, isToday, isFuture };
    }
    return {
      canEdit: false,
      reason: isToday
        ? "Today's live game is locked. Only Game Masters can edit live games."
        : "Past games are locked. Only Game Masters can edit past archives.",
      isPast,
      isToday,
      isFuture,
    };
  }

  return {
    canEdit: false,
    reason: "Standard player accounts cannot edit puzzles.",
    isPast,
    isToday,
    isFuture,
  };
}

export function deriveDisplayNameFromEmail(email: string): string {
  const localPart = normalizeEmail(email).split("@")[0] || "Player";
  const cleaned = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "SOL Player";
  return cleaned
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function normalizeHandle(raw?: string, fallbackEmail?: string): string {
  const baseSource =
    raw && raw.trim().length > 0
      ? raw.trim()
      : fallbackEmail
      ? normalizeEmail(fallbackEmail).split("@")[0]
      : "solplayer";
  const slug = baseSource
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
  return `@${slug || "solplayer"}`;
}

export function getInitials(displayName: string, email?: string): string {
  const source = (displayName || "").trim() || deriveDisplayNameFromEmail(email || "");
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "SG";
}

export function formatMemberSince(isoOrLabel: string): string {
  if (!isoOrLabel) return "Nov 2026";
  const parsed = new Date(isoOrLabel);
  if (Number.isNaN(parsed.getTime())) {
    return isoOrLabel;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(parsed);
}


function resolveBoardMetadata(boardId: string): {
  boardTitle: string;
  dateKey: string;
} {
  const createdBoards = getUserCreated21Boards();
  const createdMatch = createdBoards.find((b) => b.id === boardId);
  if (createdMatch) {
    return {
      boardTitle: createdMatch.title,
      dateKey: createdMatch.customDate ?? getLocalDateKey(),
    };
  }

  const overrides = getAdmin21ThingsOverrides();
  for (const [dateKey, board] of Object.entries(overrides)) {
    if (board.id === boardId) {
      return {
        boardTitle: board.title,
        dateKey,
      };
    }
  }

  const dailyMatch = TWENTY_ONE_THINGS_BOARDS.find((b) => b.id === boardId);
  if (dailyMatch) {
    return {
      boardTitle: dailyMatch.title,
      dateKey: dailyMatch.customDate ?? getLocalDateKey(),
    };
  }

  return {
    boardTitle: "21 Things Board",
    dateKey: getLocalDateKey(),
  };
}

function journeyToResonancePick(
  journey: TwentyOneJourney
): RecentResonancePick | null {
  if (!journey || !journey.pick1) return null;
  const meta = resolveBoardMetadata(journey.boardId);
  return {
    boardId: journey.boardId,
    boardTitle: meta.boardTitle,
    dateKey: meta.dateKey,
    pick1Item: journey.pick1,
    reflectionNote: journey.reflectionNote || "",
    pickedAt: journey.createdAt || "Recently",
  };
}

function mergeRecentPicks(
  existingPicks: RecentResonancePick[],
  localJourneys: TwentyOneJourney[]
): RecentResonancePick[] {
  const seen = new Set<string>();
  const combined: RecentResonancePick[] = [];

  const fromLocal = localJourneys
    .map(journeyToResonancePick)
    .filter((p): p is RecentResonancePick => p !== null);

  for (const pick of [...fromLocal, ...(existingPicks || [])]) {
    if (!pick || !pick.pick1Item) continue;
    const dedupeKey = `${pick.boardId}::${pick.pick1Item}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    combined.push({
      boardId: String(pick.boardId || "daily"),
      boardTitle: String(pick.boardTitle || "21 Things Board"),
      dateKey: String(pick.dateKey || getLocalDateKey()),
      pick1Item: String(pick.pick1Item),
      reflectionNote: String(pick.reflectionNote || ""),
      pickedAt: String(pick.pickedAt || "Recently"),
    });
  }

  return combined.slice(0, 20);
}

export function normalizeUserProfile(
  raw: Partial<UserProfile> & { email: string; id?: string }
): UserProfile {
  const email = normalizeEmail(raw.email);
  const displayName =
    raw.displayName && raw.displayName.trim().length > 0
      ? raw.displayName.trim()
      : deriveDisplayNameFromEmail(email);
  const handle = normalizeHandle(raw.handle, email);
  const avatarColor: AvatarColor = isValidAvatarColor(raw.avatarColor)
    ? raw.avatarColor
    : "#F9D423";
  const createdBoardIds = Array.isArray(raw.createdBoardIds)
    ? Array.from(new Set(raw.createdBoardIds.map(String).filter(Boolean)))
    : [];

  const rawRecord = raw as Record<string, unknown>;
  const isDefaultGM = isInitialGameMaster(email);
  const resolvedRole: UserRole = isDefaultGM
    ? "game_master"
    : isValidUserRole(raw.role) && raw.role !== "game_master"
    ? raw.role
    : isValidUserRole(rawRecord.role) && rawRecord.role !== "game_master"
    ? (rawRecord.role as UserRole)
    : "user";

  const isBanned = isDefaultGM
    ? false
    : Boolean(raw.isBanned ?? rawRecord.is_banned ?? false);

  const bannedAt = isBanned
    ? String(raw.bannedAt || rawRecord.banned_at || new Date().toISOString())
    : null;

  const bannedReason = isBanned
    ? String(
        raw.bannedReason ||
          rawRecord.banned_reason ||
          "Account suspended by administrator."
      )
    : null;

  return {
    id: raw.id || `usr_${email.replace(/[^a-z0-9]/g, "_")}`,
    email,
    displayName,
    handle,
    avatarColor,
    role: resolvedRole,
    isBanned,
    bannedAt,
    bannedReason,
    memberSince: raw.memberSince || new Date().toISOString(),
    connect5Stats: normalizeGameStats(raw.connect5Stats ?? DEFAULT_STATS),
    twentyOneStats: normalizeGameStats(raw.twentyOneStats ?? DEFAULT_STATS),
    boardsCreatedCount: Math.max(
      Number(raw.boardsCreatedCount ?? 0) || 0,
      createdBoardIds.length
    ),
    createdBoardIds,
    recentPicks: Array.isArray(raw.recentPicks) ? raw.recentPicks : [],
    authMode: raw.authMode === "supabase" ? "supabase" : "local",
    lastSyncedAt: raw.lastSyncedAt || new Date().toISOString(),
  };
}

export function getActiveUserProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    let raw = window.sessionStorage.getItem(ACTIVE_USER_KEY);
    if (!raw) {
      raw = window.localStorage.getItem(ACTIVE_USER_KEY);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.email) return null;
    return normalizeUserProfile(parsed as Partial<UserProfile> & { email: string });
  } catch {
    return null;
  }
}

function emitAuthChanged(profile: UserProfile | null): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("solgames:auth-changed", { detail: { profile } })
    );
  } catch {
    // Ignore DOM event errors
  }
}

export function saveActiveUserProfile(profile: UserProfile | null): void {
  if (typeof window === "undefined") return;

  if (!profile) {
    clearAuthStorage();
    try {
      window.localStorage.removeItem(ACTIVE_USER_KEY);
      window.sessionStorage.removeItem(ACTIVE_USER_KEY);
    } catch {
      // Ignore storage errors
    }
    emitAuthChanged(null);
    return;
  }

  const normalized = normalizeUserProfile(profile);
  const remember = getRememberLogin();
  const raw = JSON.stringify(normalized);

  try {
    if (remember) {
      window.localStorage.setItem(ACTIVE_USER_KEY, raw);
      window.sessionStorage.removeItem(ACTIVE_USER_KEY);
    } else {
      window.sessionStorage.setItem(ACTIVE_USER_KEY, raw);
      window.localStorage.removeItem(ACTIVE_USER_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }

  emitAuthChanged(normalized);
}

async function fetchSupabaseUserProfileRow(
  userId: string,
  email: string
): Promise<Partial<UserProfile> | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const normalizedEmail = normalizeEmail(email);
    let data: Record<string, unknown> | null = null;

    if (normalizedEmail) {
      const byEmail = await supabase
        .from("user_profiles")
        .select("*")
        .eq("email", normalizedEmail)
        .maybeSingle();
      if (!byEmail.error && byEmail.data) {
        data = byEmail.data as Record<string, unknown>;
      }
    }

    if (!data && userId) {
      const byId = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (!byId.error && byId.data) {
        data = byId.data as Record<string, unknown>;
      }
    }

    if (!data) return null;

    return {
      id: String(data.id || userId),
      email: normalizeEmail(String(data.email || email)),
      displayName: String(
        data.display_name || deriveDisplayNameFromEmail(email)
      ),
      handle: normalizeHandle(String(data.handle || ""), email),
      avatarColor: isValidAvatarColor(data.avatar_color)
        ? data.avatar_color
        : "#F9D423",
      role: isValidUserRole(data.role)
        ? data.role
        : isInitialGameMaster(email)
        ? "game_master"
        : "user",
      isBanned: Boolean(data.is_banned ?? false),
      bannedAt: data.banned_at ? String(data.banned_at) : null,
      bannedReason: data.banned_reason ? String(data.banned_reason) : null,
      memberSince: String(data.created_at || new Date().toISOString()),
      connect5Stats: normalizeGameStats(
        (data.connect5_stats as Partial<GameStats>) ?? DEFAULT_STATS
      ),
      twentyOneStats: normalizeGameStats(
        (data.twenty_one_stats as Partial<GameStats>) ?? DEFAULT_STATS
      ),
      recentPicks: Array.isArray(data.recent_picks)
        ? (data.recent_picks as RecentResonancePick[])
        : [],
      createdBoardIds: Array.isArray(data.created_board_ids)
        ? data.created_board_ids.map(String)
        : [],
      boardsCreatedCount: Array.isArray(data.created_board_ids)
        ? data.created_board_ids.length
        : 0,
      authMode: "supabase",
      lastSyncedAt: String(data.updated_at || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

async function upsertSupabaseUserProfileRow(
  profile: UserProfile
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const row = {
    id: profile.id,
    email: profile.email,
    display_name: profile.displayName,
    handle: profile.handle,
    avatar_color: profile.avatarColor,
    role: profile.role,
    is_banned: profile.isBanned,
    banned_at: profile.bannedAt ?? null,
    banned_reason: profile.bannedReason ?? null,
    connect5_stats: profile.connect5Stats,
    twenty_one_stats: profile.twentyOneStats,
    recent_picks: profile.recentPicks,
    created_board_ids: profile.createdBoardIds,
    updated_at: profile.lastSyncedAt,
  };

  try {
    const { error } = await supabase
      .from("user_profiles")
      .upsert(row, { onConflict: "email" });
    if (error) {
      await supabase.from("user_profiles").upsert(row, { onConflict: "id" });
    }
  } catch {
    // Local profile already saved
  }
}

export async function fetchAllUserProfiles(): Promise<UserProfile[]> {
  const profileMap = new Map<string, UserProfile>();

  // 1. Seed root Game Masters
  for (const gmEmail of INITIAL_GAME_MASTERS) {
    const normalized = normalizeEmail(gmEmail);
    profileMap.set(
      normalized,
      normalizeUserProfile({
        id: `usr_${normalized.replace(/[^a-z0-9]/g, "_")}`,
        email: normalized,
        displayName: deriveDisplayNameFromEmail(normalized),
        handle: normalizeHandle(undefined, normalized),
        role: "game_master",
        isBanned: false,
        memberSince: "2026-09-01T00:00:00.000Z",
      })
    );
  }

  // 2. Fetch from Supabase
  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);

        if (!error && Array.isArray(data)) {
          for (const row of data) {
            const email = normalizeEmail(String(row.email || ""));
            if (!email) continue;
            profileMap.set(
              email,
              normalizeUserProfile({
                id: String(row.id || `usr_${email.replace(/[^a-z0-9]/g, "_")}`),
                email,
                displayName: String(
                  row.display_name || deriveDisplayNameFromEmail(email)
                ),
                handle: normalizeHandle(String(row.handle || ""), email),
                avatarColor: isValidAvatarColor(row.avatar_color)
                  ? row.avatar_color
                  : "#F9D423",
                role: (row.role as UserRole) || (isInitialGameMaster(email) ? "game_master" : "user"),
                isBanned: Boolean(row.is_banned ?? false),
                bannedAt: row.banned_at ? String(row.banned_at) : null,
                bannedReason: row.banned_reason ? String(row.banned_reason) : null,
                memberSince: String(row.created_at || new Date().toISOString()),
                connect5Stats: normalizeGameStats(
                  (row.connect5_stats as Partial<GameStats>) ?? DEFAULT_STATS
                ),
                twentyOneStats: normalizeGameStats(
                  (row.twenty_one_stats as Partial<GameStats>) ?? DEFAULT_STATS
                ),
                recentPicks: Array.isArray(row.recent_picks)
                  ? (row.recent_picks as RecentResonancePick[])
                  : [],
                createdBoardIds: Array.isArray(row.created_board_ids)
                  ? row.created_board_ids.map(String)
                  : [],
                boardsCreatedCount: Array.isArray(row.created_board_ids)
                  ? row.created_board_ids.length
                  : 0,
                authMode: "supabase",
                lastSyncedAt: String(row.updated_at || new Date().toISOString()),
              })
            );
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
  }

  // 3. Merge active user
  const active = getActiveUserProfile();
  if (active?.email) {
    const email = normalizeEmail(active.email);
    if (!profileMap.has(email)) {
      profileMap.set(email, active);
    }
  }

  return Array.from(profileMap.values()).sort((a, b) => {
    const rolePriority: Record<UserRole, number> = {
      game_master: 3,
      admin: 2,
      user: 1,
    };
    const diff = (rolePriority[b.role] || 0) - (rolePriority[a.role] || 0);
    if (diff !== 0) return diff;
    return new Date(b.memberSince).getTime() - new Date(a.memberSince).getTime();
  });
}

export async function updateUserRole(
  actorProfile: UserProfile,
  targetEmail: string,
  newRole: UserRole
): Promise<{ ok: boolean; error?: string }> {
  if (!isGameMaster(actorProfile)) {
    return {
      ok: false,
      error: "Unauthorized: Only Game Masters can modify user roles.",
    };
  }

  const normalizedTarget = normalizeEmail(targetEmail);

  if (isInitialGameMaster(normalizedTarget) && newRole !== "game_master") {
    return {
      ok: false,
      error: "Root Game Masters cannot be demoted.",
    };
  }

  if (newRole === "game_master" && !isInitialGameMaster(normalizedTarget)) {
    return {
      ok: false,
      error: "Only authorized root Game Masters can hold the Game Master role.",
    };
  }

  if (!isValidUserRole(newRole)) {
    return {
      ok: false,
      error: `Invalid role: ${newRole}. Must be 'game_master', 'admin', or 'user'.`,
    };
  }

  const active = getActiveUserProfile();
  if (active && normalizeEmail(active.email) === normalizedTarget) {
    const updated = normalizeUserProfile({
      ...active,
      role: newRole,
      lastSyncedAt: new Date().toISOString(),
    });
    saveActiveUserProfile(updated);
  }

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase
          .from("user_profiles")
          .update({
            role: newRole,
            updated_at: new Date().toISOString(),
          })
          .eq("email", normalizedTarget);

        if (error) {
          return { ok: false, error: error.message };
        }
      } catch (err: unknown) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Failed to update role in Supabase.",
        };
      }
    }
  }

  return { ok: true };
}

export async function setUserBannedStatus(
  actorProfile: UserProfile,
  targetEmail: string,
  isBanned: boolean,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isGameMaster(actorProfile)) {
    return {
      ok: false,
      error: "Unauthorized: Only Game Masters can modify account ban status.",
    };
  }

  const normalizedTarget = normalizeEmail(targetEmail);

  if (isInitialGameMaster(normalizedTarget) && isBanned) {
    return {
      ok: false,
      error: "Root Game Masters have permanent ban immunity.",
    };
  }

  const bannedAt = isBanned ? new Date().toISOString() : null;
  const bannedReason = isBanned
    ? (reason?.trim() || "Account suspended by Game Master.")
    : null;

  const active = getActiveUserProfile();
  if (active && normalizeEmail(active.email) === normalizedTarget) {
    const updated = normalizeUserProfile({
      ...active,
      isBanned,
      bannedAt,
      bannedReason,
      lastSyncedAt: new Date().toISOString(),
    });
    saveActiveUserProfile(updated);
  }

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase
          .from("user_profiles")
          .update({
            is_banned: isBanned,
            banned_at: bannedAt,
            banned_reason: bannedReason,
            updated_at: new Date().toISOString(),
          })
          .eq("email", normalizedTarget);

        if (error) {
          return { ok: false, error: error.message };
        }
      } catch (err: unknown) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Failed to update ban status in Supabase.",
        };
      }
    }
  }

  return { ok: true };
}

let isContinuousSyncRegistered = false;
let isSyncInProgress = false;
let pendingResyncAfterCurrent = false;

export function ensureProfileSyncListenerRegistered(): void {
  if (isContinuousSyncRegistered) return;
  isContinuousSyncRegistered = true;

  registerProfileSyncCallback(async () => {
    if (isSyncInProgress) {
      pendingResyncAfterCurrent = true;
      return;
    }
    const active = getActiveUserProfile();
    if (!active) return;
    await syncProfileAndMergeGuestStats(active);
  });
}

/**
 * Merges local guest GameStats ("connect-5" & "21-things"), created 21 Things boards,
 * and local player journeys into `baseProfile`, writes the merged GameStats back to
 * localStorage via `setGameStats()`, saves the updated UserProfile to localStorage
 * and Supabase `public.user_profiles`, and registers continuous sync with `game-storage.ts`.
 */
export async function syncProfileAndMergeGuestStats(
  baseProfile: UserProfile
): Promise<UserProfile> {
  ensureProfileSyncListenerRegistered();
  isSyncInProgress = true;

  let syncedProfile: UserProfile;
  try {
    const normalizedBase = normalizeUserProfile(baseProfile);

    const localC5 = getGameStats("connect-5");
    const local21 = getGameStats("21-things");

    const mergedC5 = mergeTwoGameStats(normalizedBase.connect5Stats, localC5);
    const merged21 = mergeTwoGameStats(normalizedBase.twentyOneStats, local21);

    // Write merged stats back to localStorage so GameShell and game boards reflect merged streaks
    setGameStats("connect-5", mergedC5);
    setGameStats("21-things", merged21);

    // Merge user-created 21 Things board IDs
    const localCreatedBoards = getUserCreated21Boards();
    const mergedCreatedBoardIds = Array.from(
      new Set([
        ...localCreatedBoards.map((b) => b.id),
        ...normalizedBase.createdBoardIds,
      ])
    ).filter(Boolean);

    // Merge recent #1 resonance picks from local journeys
    const localJourneys = getAllLocalPlayerJourneys();
    const priorPicks = normalizedBase.recentPicks;
    const mergedRecentPicks = mergeRecentPicks(priorPicks, localJourneys);

    syncedProfile = {
      ...normalizedBase,
      connect5Stats: mergedC5,
      twentyOneStats: merged21,
      createdBoardIds: mergedCreatedBoardIds,
      boardsCreatedCount: mergedCreatedBoardIds.length,
      recentPicks: mergedRecentPicks,
      lastSyncedAt: new Date().toISOString(),
    };

    saveActiveUserProfile(syncedProfile);
    await upsertSupabaseUserProfileRow(syncedProfile);
  } finally {
    isSyncInProgress = false;
  }

  if (pendingResyncAfterCurrent) {
    pendingResyncAfterCurrent = false;
    const latestActive = getActiveUserProfile();
    if (latestActive) {
      return await syncProfileAndMergeGuestStats(latestActive);
    }
  }

  return syncedProfile;
}

export async function restoreUserSession(): Promise<UserProfile | null> {
  ensureProfileSyncListenerRegistered();

  if (!isSupabaseConfigured) {
    activeVerifiedJwtEmail = null;
    activeVerifiedJwtToken = null;
    saveActiveUserProfile(null);
    return null;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    activeVerifiedJwtEmail = null;
    activeVerifiedJwtToken = null;
    saveActiveUserProfile(null);
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    const session = data?.session;
    const sessionUser = session?.user;

    if (error || !sessionUser || !sessionUser.email || !session?.access_token) {
      activeVerifiedJwtEmail = null;
      activeVerifiedJwtToken = null;
      saveActiveUserProfile(null);
      return null;
    }

    const email = normalizeEmail(sessionUser.email);
    activeVerifiedJwtEmail = email;
    activeVerifiedJwtToken = session.access_token;

    const remoteRow = await fetchSupabaseUserProfileRow(
      sessionUser.id,
      email
    );

    if (remoteRow?.isBanned) {
      await supabase.auth.signOut();
      activeVerifiedJwtEmail = null;
      activeVerifiedJwtToken = null;
      saveActiveUserProfile(null);
      return null;
    }

    const meta = sessionUser.user_metadata ?? {};
    const localActive = getActiveUserProfile();

    const baseProfile = normalizeUserProfile({
      id: sessionUser.id,
      email,
      displayName:
        remoteRow?.displayName ||
        (typeof meta.display_name === "string" ? meta.display_name : undefined) ||
        localActive?.displayName ||
        deriveDisplayNameFromEmail(email),
      handle:
        remoteRow?.handle ||
        (typeof meta.handle === "string" ? meta.handle : undefined) ||
        localActive?.handle ||
        normalizeHandle(undefined, email),
      avatarColor: isValidAvatarColor(remoteRow?.avatarColor)
        ? remoteRow.avatarColor
        : isValidAvatarColor(meta.avatar_color)
        ? meta.avatar_color
        : localActive?.avatarColor ?? "#F9D423",
      memberSince:
        remoteRow?.memberSince ||
        sessionUser.created_at ||
        localActive?.memberSince ||
        new Date().toISOString(),
      connect5Stats: remoteRow?.connect5Stats ?? localActive?.connect5Stats,
      twentyOneStats: remoteRow?.twentyOneStats ?? localActive?.twentyOneStats,
      createdBoardIds:
        remoteRow?.createdBoardIds ?? localActive?.createdBoardIds ?? [],
      recentPicks: remoteRow?.recentPicks ?? localActive?.recentPicks ?? [],
      authMode: "supabase",
    });

    const synced = await syncProfileAndMergeGuestStats(baseProfile);
    saveActiveUserProfile(synced);
    return synced;
  } catch {
    activeVerifiedJwtEmail = null;
    activeVerifiedJwtToken = null;
    saveActiveUserProfile(null);
    return null;
  }
}

export async function signUpWithEmail(input: SignUpInput): Promise<AuthResult> {
  const email = normalizeEmail(input.email || "");
  if (!email || !email.includes("@") || !email.includes(".")) {
    return {
      ok: false,
      profile: null,
      error: "Please enter a valid email address.",
    };
  }

  const password = input.password?.trim() || "";
  if (!password || password.length < 8) {
    return {
      ok: false,
      profile: null,
      error: "Password must be at least 8 characters.",
    };
  }

  if (input.displayName && input.displayName.trim().length > 0) {
    const mod = checkContentModeration(input.displayName, {
      mode: "public",
      field: "Display Name",
    });
    if (!mod.allowed) {
      return { ok: false, profile: null, error: mod.reason };
    }
  }

  if (input.handle && input.handle.trim().length > 0) {
    const mod = checkContentModeration(input.handle, {
      mode: "public",
      field: "Handle",
    });
    if (!mod.allowed) {
      return { ok: false, profile: null, error: mod.reason };
    }
  }

  const displayName =
    input.displayName && input.displayName.trim().length > 0
      ? input.displayName.trim()
      : deriveDisplayNameFromEmail(email);
  const handle = normalizeHandle(input.handle || displayName, email);
  const avatarColor: AvatarColor = isValidAvatarColor(input.avatarColor)
    ? input.avatarColor
    : "#F9D423";

  if (!isSupabaseConfigured) {
    return {
      ok: false,
      profile: null,
      error: "Authentication service is temporarily unavailable.",
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      profile: null,
      error: "Unable to initialize authentication client.",
    };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          handle,
          avatar_color: avatarColor,
        },
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        msg.includes("registered") ||
        msg.includes("duplicate") ||
        error.status === 422
      ) {
        return {
          ok: false,
          profile: null,
          error: "An account with this email already exists. Please log in or use Forgot Password.",
        };
      }
      return {
        ok: false,
        profile: null,
        error: error.message || "Unable to create account. Please try again.",
      };
    }

    if (!data?.user) {
      return {
        ok: false,
        profile: null,
        error: "Unable to create account. Please try again.",
      };
    }

    if (data.user && !data.session) {
      return {
        ok: true,
        profile: null,
        message: "Account created! Check your inbox for a confirmation link to activate your account.",
      };
    }

    activeVerifiedJwtEmail = normalizeEmail(data.user.email || email);
    activeVerifiedJwtToken = data.session?.access_token || null;

    const remoteRow = await fetchSupabaseUserProfileRow(
      data.user.id,
      email
    );
    const baseProfile = normalizeUserProfile({
      id: data.user.id,
      email,
      displayName: remoteRow?.displayName || displayName,
      handle: remoteRow?.handle || handle,
      avatarColor: remoteRow?.avatarColor || avatarColor,
      memberSince: data.user.created_at || new Date().toISOString(),
      connect5Stats: remoteRow?.connect5Stats,
      twentyOneStats: remoteRow?.twentyOneStats,
      createdBoardIds: remoteRow?.createdBoardIds,
      recentPicks: remoteRow?.recentPicks,
      authMode: "supabase",
    });

    const synced = await syncProfileAndMergeGuestStats(baseProfile);
    saveActiveUserProfile(synced);
    return {
      ok: true,
      profile: synced,
      message:
        "Account created! Your stats and daily streaks are now backed up.",
    };
  } catch (err: unknown) {
    return {
      ok: false,
      profile: null,
      error: err instanceof Error ? err.message : "Unable to create account.",
    };
  }
}

export async function signInWithEmail(input: SignInInput): Promise<AuthResult> {
  const email = normalizeEmail(input.email || "");
  if (!email || !email.includes("@") || !email.includes(".")) {
    return {
      ok: false,
      profile: null,
      error: "Please enter a valid email address.",
    };
  }

  const password = input.password?.trim() || "";
  if (!password) {
    return {
      ok: false,
      profile: null,
      error: "Please enter your password.",
    };
  }

  if (!isSupabaseConfigured) {
    return {
      ok: false,
      profile: null,
      error: "Authentication service is temporarily unavailable.",
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      profile: null,
      error: "Unable to initialize authentication client.",
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("invalid login credentials") ||
        msg.includes("invalid_credentials") ||
        error.status === 400
      ) {
        return {
          ok: false,
          profile: null,
          error: "Invalid email or password. Please try again or create an account.",
        };
      }
      if (msg.includes("email not confirmed")) {
        return {
          ok: false,
          profile: null,
          error: "Please verify your email address before signing in.",
        };
      }
      return {
        ok: false,
        profile: null,
        error: error.message || "Unable to sign in. Please check your credentials.",
      };
    }

    if (!data?.user) {
      return {
        ok: false,
        profile: null,
        error: "Sign in failed. No user returned.",
      };
    }

    activeVerifiedJwtEmail = normalizeEmail(data.user.email || email);
    activeVerifiedJwtToken = data.session?.access_token || null;

    const remoteRow = await fetchSupabaseUserProfileRow(
      data.user.id,
      email
    );

    if (remoteRow?.isBanned) {
      await supabase.auth.signOut();
      activeVerifiedJwtEmail = null;
      activeVerifiedJwtToken = null;
      saveActiveUserProfile(null);
      return {
        ok: false,
        profile: null,
        error: `Account suspended: ${remoteRow.bannedReason || "Access revoked."}`,
      };
    }

    const meta = data.user.user_metadata ?? {};
    const baseProfile = normalizeUserProfile({
      id: data.user.id,
      email,
      displayName:
        remoteRow?.displayName ||
        (typeof meta.display_name === "string" ? meta.display_name : undefined) ||
        deriveDisplayNameFromEmail(email),
      handle:
        remoteRow?.handle ||
        (typeof meta.handle === "string" ? meta.handle : undefined) ||
        normalizeHandle(undefined, email),
      avatarColor: isValidAvatarColor(remoteRow?.avatarColor)
        ? remoteRow.avatarColor
        : isValidAvatarColor(meta.avatar_color)
        ? meta.avatar_color
        : "#F9D423",
      memberSince:
        remoteRow?.memberSince ||
        data.user.created_at ||
        new Date().toISOString(),
      connect5Stats: remoteRow?.connect5Stats,
      twentyOneStats: remoteRow?.twentyOneStats,
      createdBoardIds: remoteRow?.createdBoardIds,
      recentPicks: remoteRow?.recentPicks,
      authMode: "supabase",
    });

    const synced = await syncProfileAndMergeGuestStats(baseProfile);
    saveActiveUserProfile(synced);

    return {
      ok: true,
      profile: synced,
      message: "Welcome back! Your stats and streaks have been synced.",
    };
  } catch (err: unknown) {
    return {
      ok: false,
      profile: null,
      error: err instanceof Error ? err.message : "Unable to sign in.",
    };
  }
}

export async function sendMagicLink(emailInput: string): Promise<AuthResult> {
  const email = normalizeEmail(emailInput || "");
  if (!email || !email.includes("@") || !email.includes(".")) {
    return {
      ok: false,
      profile: null,
      error: "Please enter a valid email address.",
    };
  }

  if (!isSupabaseConfigured) {
    return {
      ok: false,
      profile: null,
      error: "Authentication service is temporarily unavailable.",
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      profile: null,
      error: "Unable to initialize authentication client.",
    };
  }

  try {
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}${assetPath("/")}`
        : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      return {
        ok: false,
        profile: null,
        error: error.message || "Failed to send magic link. Please try again.",
      };
    }

    return {
      ok: true,
      profile: null,
      magicLinkSent: true,
      message: "Check your inbox for your sign-in link.",
    };
  } catch (err: unknown) {
    return {
      ok: false,
      profile: null,
      error: err instanceof Error ? err.message : "Failed to send magic link.",
    };
  }
}

export async function requestPasswordReset(
  emailInput: string
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const email = normalizeEmail(emailInput || "");
  if (!email || !email.includes("@") || !email.includes(".")) {
    return {
      ok: false,
      error: "Please enter a valid email address.",
    };
  }

  if (!isSupabaseConfigured) {
    return {
      ok: false,
      error: "Authentication service is temporarily unavailable.",
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      error: "Unable to initialize authentication client.",
    };
  }

  try {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://21games.ai";
    const redirectTo = `${origin}${assetPath("/account?recovery=true")}`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      return {
        ok: false,
        error: error.message || "Unable to send password reset email.",
      };
    }

    return {
      ok: true,
      message:
        "If an account exists for this email, password reset instructions have been sent. Please check your inbox.",
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Unable to send password reset email.",
    };
  }
}

export async function signOutUser(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore signOut network errors
      }
    }
  }
  saveActiveUserProfile(null);
}

export async function updateUserProfile(
  updates: UpdateProfileInput
): Promise<AuthResult> {
  const current = getActiveUserProfile();
  if (!current) {
    return {
      ok: false,
      profile: null,
      error: "You must be signed in to update your profile.",
    };
  }

  if (updates.displayName !== undefined && updates.displayName.trim().length > 0) {
    const mod = checkContentModeration(updates.displayName, {
      mode: "public",
      field: "Display Name",
    });
    if (!mod.allowed) {
      return { ok: false, profile: null, error: mod.reason };
    }
  }

  if (updates.handle !== undefined && updates.handle.trim().length > 0) {
    const mod = checkContentModeration(updates.handle, {
      mode: "public",
      field: "Handle",
    });
    if (!mod.allowed) {
      return { ok: false, profile: null, error: mod.reason };
    }
  }

  const nextDisplayName =
    updates.displayName !== undefined && updates.displayName.trim().length > 0
      ? updates.displayName.trim()
      : current.displayName;
  const nextHandle =
    updates.handle !== undefined && updates.handle.trim().length > 0
      ? normalizeHandle(updates.handle, current.email)
      : current.handle;
  const nextAvatarColor: AvatarColor = isValidAvatarColor(updates.avatarColor)
    ? updates.avatarColor
    : current.avatarColor;

  const updatedBase: UserProfile = {
    ...current,
    displayName: nextDisplayName,
    handle: nextHandle,
    avatarColor: nextAvatarColor,
    lastSyncedAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.updateUser({
          data: {
            display_name: nextDisplayName,
            handle: nextHandle,
            avatar_color: nextAvatarColor,
          },
        });
      } catch {
        // Ignore auth metadata error if session is local fallback
      }
    }
  }

  const synced = await syncProfileAndMergeGuestStats(updatedBase);
  return {
    ok: true,
    profile: synced,
    message: "Profile updated.",
  };
}

export function subscribeToAuthChanges(
  listener: (profile: UserProfile | null) => void
): () => void {
  ensureProfileSyncListenerRegistered();

  if (typeof window === "undefined") {
    return () => {};
  }

  const handleAuthEvent = () => {
    listener(getActiveUserProfile());
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (
      !event.key ||
      event.key === ACTIVE_USER_KEY ||
      event.key.startsWith("solgames_v1_stats_")
    ) {
      listener(getActiveUserProfile());
    }
  };

  window.addEventListener("solgames:auth-changed", handleAuthEvent);
  window.addEventListener("solgames:stats-updated", handleAuthEvent);
  window.addEventListener("storage", handleStorageEvent);

  let unsubscribeSupabase: (() => void) | null = null;
  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          listener(getActiveUserProfile());
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          void restoreUserSession().then((profile) => {
            listener(profile);
          });
        }
      });
      unsubscribeSupabase = () => {
        data.subscription.unsubscribe();
      };
    }
  }

  return () => {
    window.removeEventListener("solgames:auth-changed", handleAuthEvent);
    window.removeEventListener("solgames:stats-updated", handleAuthEvent);
    window.removeEventListener("storage", handleStorageEvent);
    if (unsubscribeSupabase) {
      unsubscribeSupabase();
    }
  };
}

// Convenient aliases for UI consumers
export const initializeAuthSession = restoreUserSession;
export const signUp = signUpWithEmail;
export const signIn = signInWithEmail;
export const signInWithMagicLink = sendMagicLink;
export const signOut = signOutUser;
export const resetPassword = requestPasswordReset;
export const updateProfile = updateUserProfile;

