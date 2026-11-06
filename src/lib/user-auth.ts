import {
  TWENTY_ONE_THINGS_BOARDS,
  type TwentyOneJourney,
} from "@/data/puzzles/21-things";
import { getLocalDateKey } from "@/lib/daily-engine";
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
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export const ACCOUNTS_DB_KEY = "solgames_v1_accounts_db";
export const ACTIVE_USER_KEY = "solgames_v1_active_user";

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
  memberSince: string;
  connect5Stats: GameStats;
  twentyOneStats: GameStats;
  boardsCreatedCount: number;
  createdBoardIds: string[];
  recentPicks: RecentResonancePick[];
  authMode: "supabase" | "local";
  lastSyncedAt: string;
}

export interface StoredLocalAccount {
  profile: UserProfile;
  password?: string;
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

function safeReadStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function isValidAvatarColor(value: unknown): value is AvatarColor {
  return (
    typeof value === "string" &&
    (AVATAR_COLORS as readonly string[]).includes(value)
  );
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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

function readLocalAccountsDb(): Record<string, StoredLocalAccount> {
  return safeReadStorage<Record<string, StoredLocalAccount>>(
    ACCOUNTS_DB_KEY,
    {}
  );
}

function writeLocalAccountsDb(db: Record<string, StoredLocalAccount>): void {
  safeWriteStorage(ACCOUNTS_DB_KEY, db);
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

  return {
    id: raw.id || `usr_${email.replace(/[^a-z0-9]/g, "_")}`,
    email,
    displayName,
    handle,
    avatarColor,
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
  const raw = safeReadStorage< (Partial<UserProfile> & { email?: string }) | null >(
    ACTIVE_USER_KEY,
    null
  );
  if (!raw || !raw.email) return null;
  return normalizeUserProfile(raw as Partial<UserProfile> & { email: string });
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

export function saveActiveUserProfile(
  profile: UserProfile | null,
  passwordToPersist?: string
): void {
  if (typeof window === "undefined") return;

  if (!profile) {
    try {
      window.localStorage.removeItem(ACTIVE_USER_KEY);
    } catch {
      // Ignore storage errors
    }
    emitAuthChanged(null);
    return;
  }

  const normalized = normalizeUserProfile(profile);
  safeWriteStorage(ACTIVE_USER_KEY, normalized);

  const db = readLocalAccountsDb();
  const existingRecord = db[normalized.email];
  db[normalized.email] = {
    profile: normalized,
    password: passwordToPersist ?? existingRecord?.password,
  };
  writeLocalAccountsDb(db);

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

    // Also merge with any stored local account record for this email so no prior stats are lost
    const localDb = readLocalAccountsDb();
    const existingStored = localDb[normalizedBase.email]?.profile;

    const localC5 = getGameStats("connect-5");
    const local21 = getGameStats("21-things");

    const mergedC5 = existingStored
      ? mergeTwoGameStats(
          mergeTwoGameStats(normalizedBase.connect5Stats, existingStored.connect5Stats),
          localC5
        )
      : mergeTwoGameStats(normalizedBase.connect5Stats, localC5);

    const merged21 = existingStored
      ? mergeTwoGameStats(
          mergeTwoGameStats(normalizedBase.twentyOneStats, existingStored.twentyOneStats),
          local21
        )
      : mergeTwoGameStats(normalizedBase.twentyOneStats, local21);

    // Write merged stats back to localStorage so GameShell and game boards reflect merged streaks
    setGameStats("connect-5", mergedC5);
    setGameStats("21-things", merged21);

    // Merge user-created 21 Things board IDs
    const localCreatedBoards = getUserCreated21Boards();
    const mergedCreatedBoardIds = Array.from(
      new Set([
        ...localCreatedBoards.map((b) => b.id),
        ...normalizedBase.createdBoardIds,
        ...(existingStored?.createdBoardIds ?? []),
      ])
    ).filter(Boolean);

    // Merge recent #1 resonance picks from local journeys
    const localJourneys = getAllLocalPlayerJourneys();
    const priorPicks = [
      ...normalizedBase.recentPicks,
      ...(existingStored?.recentPicks ?? []),
    ];
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

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data?.session?.user;
        if (sessionUser && sessionUser.email) {
          const email = normalizeEmail(sessionUser.email);
          const remoteRow = await fetchSupabaseUserProfileRow(
            sessionUser.id,
            email
          );
          const localActive = getActiveUserProfile();
          const meta = sessionUser.user_metadata ?? {};

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

          return await syncProfileAndMergeGuestStats(baseProfile);
        }
      } catch {
        // Fallback cleanly to local session
      }
    }
  }

  const localProfile = getActiveUserProfile();
  if (localProfile) {
    return await syncProfileAndMergeGuestStats(localProfile);
  }

  return null;
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
  if (password && password.length < 6) {
    return {
      ok: false,
      profile: null,
      error: "Password must be at least 6 characters.",
    };
  }

  const displayName =
    input.displayName && input.displayName.trim().length > 0
      ? input.displayName.trim()
      : deriveDisplayNameFromEmail(email);
  const handle = normalizeHandle(input.handle || displayName, email);
  const avatarColor: AvatarColor = isValidAvatarColor(input.avatarColor)
    ? input.avatarColor
    : "#F9D423";

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: password || `solgames_${email.slice(0, 8)}_2026`,
          options: {
            data: {
              display_name: displayName,
              handle,
              avatar_color: avatarColor,
            },
          },
        });

        if (!error && data?.user) {
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
          if (password) {
            saveActiveUserProfile(synced, password);
          }
          return {
            ok: true,
            profile: synced,
            message:
              "Account created! Your stats and daily streaks are now backed up.",
          };
        }
      } catch {
        // Fall through to local persistence so user is never blocked
      }
    }
  }

  // Local fallback (or when Supabase is unconfigured / rate-limited / confirmation-pending)
  const db = readLocalAccountsDb();
  const existing = db[email];
  if (existing?.password && existing.password !== password) {
    return {
      ok: false,
      profile: null,
      error:
        "An account with this email already exists. Please sign in with your password.",
    };
  }

  const baseProfile = normalizeUserProfile({
    id: existing?.profile.id || `usr_${email.replace(/[^a-z0-9]/g, "_")}`,
    email,
    displayName: input.displayName?.trim() || existing?.profile.displayName || displayName,
    handle: input.handle?.trim()
      ? normalizeHandle(input.handle, email)
      : existing?.profile.handle || handle,
    avatarColor: isValidAvatarColor(input.avatarColor)
      ? input.avatarColor
      : existing?.profile.avatarColor || avatarColor,
    memberSince: existing?.profile.memberSince || new Date().toISOString(),
    connect5Stats: existing?.profile.connect5Stats,
    twentyOneStats: existing?.profile.twentyOneStats,
    createdBoardIds: existing?.profile.createdBoardIds,
    recentPicks: existing?.profile.recentPicks,
    authMode: isSupabaseConfigured ? "supabase" : "local",
  });

  const synced = await syncProfileAndMergeGuestStats(baseProfile);
  if (password) {
    saveActiveUserProfile(synced, password);
  }

  return {
    ok: true,
    profile: synced,
    message: "Account created! Your stats and daily streaks are synced.",
  };
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
  const db = readLocalAccountsDb();
  const localRecord = db[email];

  if (isSupabaseConfigured && password) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!error && data?.user) {
          const remoteRow = await fetchSupabaseUserProfileRow(
            data.user.id,
            email
          );
          const meta = data.user.user_metadata ?? {};
          const baseProfile = normalizeUserProfile({
            id: data.user.id,
            email,
            displayName:
              remoteRow?.displayName ||
              (typeof meta.display_name === "string" ? meta.display_name : undefined) ||
              localRecord?.profile.displayName ||
              deriveDisplayNameFromEmail(email),
            handle:
              remoteRow?.handle ||
              (typeof meta.handle === "string" ? meta.handle : undefined) ||
              localRecord?.profile.handle ||
              normalizeHandle(undefined, email),
            avatarColor: isValidAvatarColor(remoteRow?.avatarColor)
              ? remoteRow.avatarColor
              : isValidAvatarColor(meta.avatar_color)
              ? meta.avatar_color
              : localRecord?.profile.avatarColor ?? "#F9D423",
            memberSince:
              remoteRow?.memberSince ||
              data.user.created_at ||
              localRecord?.profile.memberSince ||
              new Date().toISOString(),
            connect5Stats:
              remoteRow?.connect5Stats ?? localRecord?.profile.connect5Stats,
            twentyOneStats:
              remoteRow?.twentyOneStats ?? localRecord?.profile.twentyOneStats,
            createdBoardIds:
              remoteRow?.createdBoardIds ?? localRecord?.profile.createdBoardIds,
            recentPicks:
              remoteRow?.recentPicks ?? localRecord?.profile.recentPicks,
            authMode: "supabase",
          });

          const synced = await syncProfileAndMergeGuestStats(baseProfile);
          saveActiveUserProfile(synced, password);
          return {
            ok: true,
            profile: synced,
            message: "Welcome back! Your stats and streaks have been synced.",
          };
        }

        if (
          error &&
          error.message.toLowerCase().includes("invalid login credentials")
        ) {
          if (!localRecord?.password || localRecord.password !== password) {
            return {
              ok: false,
              profile: null,
              error: "Incorrect email or password. Please try again.",
            };
          }
        }
      } catch {
        // Fall through to local account check
      }
    }
  }

  // Check local accounts DB password if account exists locally
  if (localRecord) {
    if (localRecord.password && localRecord.password !== password) {
      return {
        ok: false,
        profile: null,
        error: "Incorrect email or password. Please try again.",
      };
    }

    const synced = await syncProfileAndMergeGuestStats(localRecord.profile);
    if (password && !localRecord.password) {
      saveActiveUserProfile(synced, password);
    }
    return {
      ok: true,
      profile: synced,
      message: "Welcome back! Your stats and streaks are synced.",
    };
  }

  // Also check if public.user_profiles has a row for this email in Supabase
  const remoteByEmail = await fetchSupabaseUserProfileRow(
    `usr_${email.replace(/[^a-z0-9]/g, "_")}`,
    email
  );
  if (remoteByEmail) {
    const baseProfile = normalizeUserProfile({
      ...remoteByEmail,
      email,
    });
    const synced = await syncProfileAndMergeGuestStats(baseProfile);
    if (password) {
      saveActiveUserProfile(synced, password);
    }
    return {
      ok: true,
      profile: synced,
      message: "Welcome back! Your profile and streaks have been restored.",
    };
  }

  // Seamless 1-step sign-in/account creation on new device when no prior account exists
  return await signUpWithEmail({
    email,
    password: password || undefined,
  });
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

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo:
              typeof window !== "undefined"
                ? `${window.location.origin}${assetPath("/")}`
                : undefined,
          },
        });
      } catch {
        // Fall back cleanly if rate-limited
      }
    }
  }

  const db = readLocalAccountsDb();
  const existing = db[email]?.profile;
  const remoteRow = await fetchSupabaseUserProfileRow(
    existing?.id || `usr_${email.replace(/[^a-z0-9]/g, "_")}`,
    email
  );

  const baseProfile = normalizeUserProfile({
    id:
      remoteRow?.id ||
      existing?.id ||
      `usr_${email.replace(/[^a-z0-9]/g, "_")}`,
    email,
    displayName:
      remoteRow?.displayName ||
      existing?.displayName ||
      deriveDisplayNameFromEmail(email),
    handle:
      remoteRow?.handle || existing?.handle || normalizeHandle(undefined, email),
    avatarColor:
      remoteRow?.avatarColor || existing?.avatarColor || "#F9D423",
    memberSince:
      remoteRow?.memberSince ||
      existing?.memberSince ||
      new Date().toISOString(),
    connect5Stats: remoteRow?.connect5Stats ?? existing?.connect5Stats,
    twentyOneStats: remoteRow?.twentyOneStats ?? existing?.twentyOneStats,
    createdBoardIds: remoteRow?.createdBoardIds ?? existing?.createdBoardIds,
    recentPicks: remoteRow?.recentPicks ?? existing?.recentPicks,
    authMode: isSupabaseConfigured ? "supabase" : "local",
  });

  const synced = await syncProfileAndMergeGuestStats(baseProfile);

  return {
    ok: true,
    profile: synced,
    magicLinkSent: true,
    message: isSupabaseConfigured
      ? "Magic link sent & your profile is active! Your stats and streaks are synced."
      : "Signed in via instant Magic Link! Your stats and streaks are synced.",
  };
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
export const updateProfile = updateUserProfile;

