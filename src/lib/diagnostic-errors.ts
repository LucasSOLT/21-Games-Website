/**
 * SOL GaMES (21games.ai) — Preloaded Diagnostic Error Codes & Classification Engine
 * Milestone: M2-B2 (Step 2: Real-Time Puzzle Update Propagation & Diagnostic Error Modal)
 * Target Location: src/lib/diagnostic-errors.ts
 *
 * Provides a structured catalog of preloaded diagnostic error codes, human-readable
 * descriptions for Game Masters, actionable troubleshooting hints for developers,
 * and a robust classifier that maps Supabase PostgrestError codes, HTTP statuses,
 * network/offline states, auth mismatches, and payload validation failures to exact codes.
 */

import { isInitialGameMaster } from "@/lib/user-auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getLocalDateKey } from "@/lib/daily-engine";
import type { PlayableGameSlug } from "@/lib/games-config";

// ============================================================================
// 1. Diagnostic Error Codes Enum & Types
// ============================================================================

export const DIAGNOSTIC_ERROR_CODES = {
  // Auth & Role Codes
  ERR_AUTH_NOT_AUTHENTICATED: "ERR_AUTH_NOT_AUTHENTICATED",
  ERR_AUTH_NOT_GAME_MASTER: "ERR_AUTH_NOT_GAME_MASTER",
  ERR_AUTH_SESSION_EXPIRED: "ERR_AUTH_SESSION_EXPIRED",

  // Network & Connection Codes
  ERR_NETWORK_OFFLINE: "ERR_NETWORK_OFFLINE",
  ERR_NETWORK_TIMEOUT: "ERR_NETWORK_TIMEOUT",
  ERR_SUPABASE_NOT_CONFIGURED: "ERR_SUPABASE_NOT_CONFIGURED",
  ERR_SUPABASE_CLIENT_UNAVAILABLE: "ERR_SUPABASE_CLIENT_UNAVAILABLE",

  // Database & RLS Codes
  ERR_SUPABASE_RLS_VIOLATION: "ERR_SUPABASE_RLS_VIOLATION",
  ERR_SUPABASE_PERMISSION_DENIED: "ERR_SUPABASE_PERMISSION_DENIED",
  ERR_SUPABASE_UPSERT_FAILED: "ERR_SUPABASE_UPSERT_FAILED",
  ERR_SUPABASE_FETCH_FAILED: "ERR_SUPABASE_FETCH_FAILED",

  // Schema & Validation Codes
  ERR_SUPABASE_SCHEMA_MISMATCH: "ERR_SUPABASE_SCHEMA_MISMATCH",
  ERR_SUPABASE_CONSTRAINT_VIOLATION: "ERR_SUPABASE_CONSTRAINT_VIOLATION",
  ERR_PAYLOAD_VALIDATION_FAILED: "ERR_PAYLOAD_VALIDATION_FAILED",
  ERR_PAYLOAD_HASH_MISMATCH: "ERR_PAYLOAD_HASH_MISMATCH",

  // Realtime Codes
  ERR_REALTIME_SUBSCRIPTION_FAILED: "ERR_REALTIME_SUBSCRIPTION_FAILED",
  ERR_REALTIME_CHANNEL_CLOSED: "ERR_REALTIME_CHANNEL_CLOSED",

  // Unhandled / Internal
  ERR_INTERNAL_UNHANDLED_EXCEPTION: "ERR_INTERNAL_UNHANDLED_EXCEPTION",
} as const;

export type DiagnosticErrorCode =
  (typeof DIAGNOSTIC_ERROR_CODES)[keyof typeof DIAGNOSTIC_ERROR_CODES];

export type DiagnosticCategory =
  | "auth"
  | "network"
  | "database"
  | "schema"
  | "realtime"
  | "internal";

export type DiagnosticSeverity = "fatal" | "error" | "warning";

// ============================================================================
// 2. Preloaded Diagnostic Error Catalog
// ============================================================================

export interface DiagnosticCodeMeta {
  code: DiagnosticErrorCode;
  category: DiagnosticCategory;
  title: string;
  description: string;
  troubleshootingHint: string;
  severity: DiagnosticSeverity;
  postgresCodes?: readonly string[];
  httpStatus?: readonly number[];
}

export const DIAGNOSTIC_ERROR_CATALOG: Record<
  DiagnosticErrorCode,
  DiagnosticCodeMeta
> = {
  ERR_AUTH_NOT_AUTHENTICATED: {
    code: "ERR_AUTH_NOT_AUTHENTICATED",
    category: "auth",
    title: "Authentication Required",
    description:
      "You are currently not signed in. Saving or syncing daily puzzle updates to the global Supabase database requires an active session with an authorized Game Master account.",
    troubleshootingHint:
      "Click the Account icon in the top-right header, sign in with an authorized Game Master email (lucas@soltheory.com or steve@soltheory.com), and retry.",
    severity: "error",
    httpStatus: [401],
  },
  ERR_AUTH_NOT_GAME_MASTER: {
    code: "ERR_AUTH_NOT_GAME_MASTER",
    category: "auth",
    title: "Unauthorized Account Role",
    description:
      "Your signed-in account is not registered as an authorized Game Master. Only root Game Masters (lucas@soltheory.com and steve@soltheory.com) have editorial permissions to publish or modify daily puzzles.",
    troubleshootingHint:
      "Sign out of this account and sign in using your designated Game Master email address.",
    severity: "error",
    httpStatus: [403],
  },
  ERR_AUTH_SESSION_EXPIRED: {
    code: "ERR_AUTH_SESSION_EXPIRED",
    category: "auth",
    title: "Authentication Session Expired",
    description:
      "Your Supabase authentication session token has expired or is no longer valid. The remote database rejected the operation because of an invalid or stale JWT.",
    troubleshootingHint:
      "Refresh the browser tab or sign out and sign back in to issue a fresh JWT token before saving changes.",
    severity: "error",
    httpStatus: [401],
  },
  ERR_NETWORK_OFFLINE: {
    code: "ERR_NETWORK_OFFLINE",
    category: "network",
    title: "Browser Disconnected / Offline",
    description:
      "Your device is currently disconnected from the internet. Your puzzle changes have been safely preserved in your local browser storage draft, but could not be transmitted to the cloud database.",
    troubleshootingHint:
      "Check your Wi-Fi or cellular network connection. Once your device is reconnected to the internet, click 'Retry Cloud Sync'.",
    severity: "warning",
  },
  ERR_NETWORK_TIMEOUT: {
    code: "ERR_NETWORK_TIMEOUT",
    category: "network",
    title: "Network Request Timed Out",
    description:
      "The network request to Supabase timed out before receiving a response from the database server.",
    troubleshootingHint:
      "Verify your connection stability. Supabase may be experiencing high latency or a cold start. Click 'Retry Cloud Sync' to re-attempt the save.",
    severity: "error",
    httpStatus: [408, 504],
  },
  ERR_SUPABASE_NOT_CONFIGURED: {
    code: "ERR_SUPABASE_NOT_CONFIGURED",
    category: "network",
    title: "Supabase Project Unconfigured",
    description:
      "Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY / PUBLISHABLE_KEY) are missing or set to invalid placeholders in this deployment.",
    troubleshootingHint:
      "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are populated in Vercel project environment variables, then trigger a redeploy.",
    severity: "fatal",
  },
  ERR_SUPABASE_CLIENT_UNAVAILABLE: {
    code: "ERR_SUPABASE_CLIENT_UNAVAILABLE",
    category: "network",
    title: "Supabase Client Initialization Failed",
    description:
      "The Supabase JavaScript client instance could not be initialized in this browser session.",
    troubleshootingHint:
      "Inspect the browser developer console for JavaScript initialization errors and reload the page.",
    severity: "fatal",
  },
  ERR_SUPABASE_RLS_VIOLATION: {
    code: "ERR_SUPABASE_RLS_VIOLATION",
    category: "database",
    title: "Database Row-Level Security Violation",
    description:
      "The Supabase Postgres Row-Level Security (RLS) policy rejected this upsert operation on table 'daily_puzzles' (Postgres error 42501).",
    troubleshootingHint:
      "Verify that policy 'Admin upsert daily_puzzles' is active in supabase/schema.sql and that table grants are applied to anon and authenticated roles.",
    severity: "error",
    postgresCodes: ["42501"],
  },
  ERR_SUPABASE_PERMISSION_DENIED: {
    code: "ERR_SUPABASE_PERMISSION_DENIED",
    category: "database",
    title: "Database Permission Denied",
    description:
      "The database role does not have permission to execute the requested operation on public.daily_puzzles.",
    troubleshootingHint:
      "Execute `GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_puzzles TO anon, authenticated;` in the Supabase SQL Editor.",
    severity: "error",
    httpStatus: [403],
    postgresCodes: ["42501"],
  },
  ERR_SUPABASE_UPSERT_FAILED: {
    code: "ERR_SUPABASE_UPSERT_FAILED",
    category: "database",
    title: "Puzzle Upsert Transaction Failed",
    description:
      "Failed to persist puzzle to Supabase public.daily_puzzles. A database transaction or unexpected server error occurred during the upsert.",
    troubleshootingHint:
      "Review the raw error details below and check the Supabase Dashboard Database Logs for error events matching this timestamp.",
    severity: "error",
  },
  ERR_SUPABASE_FETCH_FAILED: {
    code: "ERR_SUPABASE_FETCH_FAILED",
    category: "database",
    title: "Remote Puzzle Fetch Failed",
    description:
      "Could not query or retrieve the remote puzzle from Supabase for this date. The studio is falling back to local browser storage and pre-seeded banks.",
    troubleshootingHint:
      "Verify that the Supabase project is online and that table public.daily_puzzles is accessible.",
    severity: "warning",
  },
  ERR_SUPABASE_SCHEMA_MISMATCH: {
    code: "ERR_SUPABASE_SCHEMA_MISMATCH",
    category: "schema",
    title: "Database Schema Mismatch",
    description:
      "A database table, column, or constraint in Supabase does not match what the client expects (e.g. missing column or outdated PostgREST schema cache).",
    troubleshootingHint:
      "Run schema migrations from supabase/schema.sql and reload PostgREST schema cache in Supabase Dashboard (Settings -> API -> Reload schema cache).",
    severity: "error",
    postgresCodes: ["42703", "42P01"],
  },
  ERR_SUPABASE_CONSTRAINT_VIOLATION: {
    code: "ERR_SUPABASE_CONSTRAINT_VIOLATION",
    category: "schema",
    title: "Database Constraint Violation",
    description:
      "The puzzle payload violated a database integrity constraint (such as a unique constraint on (game_slug, puzzle_date) or a check constraint on game_slug).",
    troubleshootingHint:
      "Ensure game_slug ('21-things', 'connect-5', '17-syllables') and target date format (YYYY-MM-DD) are strictly valid.",
    severity: "error",
    postgresCodes: ["23505", "23514", "23502", "23503"],
  },
  ERR_PAYLOAD_VALIDATION_FAILED: {
    code: "ERR_PAYLOAD_VALIDATION_FAILED",
    category: "schema",
    title: "Puzzle Payload Validation Failed",
    description:
      "The puzzle payload failed structural or content moderation checks before saving (e.g. invalid word length, empty entries, or missing required fields).",
    troubleshootingHint:
      "Review puzzle fields: Connect 5 requires 5 words (≥2 letters each); 21 Things requires 21 items (≤5 words / ≤30 chars each); 17 Syllables requires 5-7-5 haiku structure.",
    severity: "error",
  },
  ERR_PAYLOAD_HASH_MISMATCH: {
    code: "ERR_PAYLOAD_HASH_MISMATCH",
    category: "schema",
    title: "Content Hash Verification Failed",
    description:
      "The computed SHA-256 content hash of the puzzle payload did not match the expected hash or failed to compute.",
    troubleshootingHint:
      "Ensure the puzzle payload contains valid serializable JSON data and re-save to regenerate a clean content hash.",
    severity: "error",
  },
  ERR_REALTIME_SUBSCRIPTION_FAILED: {
    code: "ERR_REALTIME_SUBSCRIPTION_FAILED",
    category: "realtime",
    title: "Realtime WebSocket Subscription Failed",
    description:
      "The client could not establish a Supabase Realtime WebSocket subscription on table 'daily_puzzles'. Live updates across client sessions will rely on polling and tab focus.",
    troubleshootingHint:
      "Verify that Realtime replication is enabled for public.daily_puzzles in Supabase Dashboard (Database -> Replication).",
    severity: "warning",
  },
  ERR_REALTIME_CHANNEL_CLOSED: {
    code: "ERR_REALTIME_CHANNEL_CLOSED",
    category: "realtime",
    title: "Realtime Channel Disconnected",
    description:
      "The Supabase Realtime WebSocket channel was closed by the server or an intermediary network proxy.",
    troubleshootingHint:
      "The client will automatically attempt to reconnect when the tab regains focus or internet connectivity resumes.",
    severity: "warning",
  },
  ERR_INTERNAL_UNHANDLED_EXCEPTION: {
    code: "ERR_INTERNAL_UNHANDLED_EXCEPTION",
    category: "internal",
    title: "Unhandled Studio Exception",
    description:
      "An unexpected runtime exception occurred while processing or saving the puzzle.",
    troubleshootingHint:
      "Click 'Copy Error Diagnostics' below and paste the report into a message to the developer for debugging.",
    severity: "error",
  },
};

// ============================================================================
// 3. Diagnostic Report & Context Interfaces
// ============================================================================

export interface DiagnosticReportRawError {
  name?: string;
  message?: string;
  code?: string | number;
  status?: number;
  details?: string;
  hint?: string;
  stack?: string;
  rawString: string;
}

export interface DiagnosticReportEnvironment {
  userAgent: string;
  url: string;
  commitHash?: string;
  isOnline: boolean;
  platform?: string;
  language?: string;
}

export interface DiagnosticReport {
  errorCode: DiagnosticErrorCode;
  errorCategory: DiagnosticCategory;
  errorTitle: string;
  errorDescription: string;
  troubleshootingHint: string;
  severity: DiagnosticSeverity;
  timestamp: string; // ISO 8601 UTC
  targetDate: string; // e.g. "2026-11-10"
  gameSlug: PlayableGameSlug | string;
  userEmail: string | null;
  userRole: string | null;
  supabaseUrl: string;
  isOnline: boolean;
  action: "save" | "fetch" | "sync" | "subscribe" | "validate" | "unknown";
  rawError: DiagnosticReportRawError;
  environment: DiagnosticReportEnvironment;
}

export interface DiagnosticContext {
  gameSlug?: PlayableGameSlug | string;
  targetDate?: string;
  userEmail?: string | null;
  userRole?: string | null;
  action?: "save" | "fetch" | "sync" | "subscribe" | "validate" | "unknown";
  puzzlePayload?: unknown;
  customMessage?: string;
  forcedErrorCode?: DiagnosticErrorCode;
  isOnline?: boolean;
}

// ============================================================================
// 4. Raw Error Extraction Helper
// ============================================================================

export function extractRawErrorDetails(error: unknown): DiagnosticReportRawError {
  if (!error) {
    return {
      message: "No error details provided.",
      rawString: "null",
    };
  }

  if (typeof error === "string") {
    return {
      message: error,
      rawString: error,
    };
  }

  if (typeof error === "object") {
    const err = error as Record<string, unknown>;
    const name = typeof err.name === "string" ? err.name : undefined;
    const message =
      typeof err.message === "string"
        ? err.message
        : typeof err.error_description === "string"
        ? err.error_description
        : undefined;
    const code =
      typeof err.code === "string" || typeof err.code === "number"
        ? err.code
        : undefined;
    const status =
      typeof err.status === "number"
        ? err.status
        : typeof err.statusCode === "number"
        ? err.statusCode
        : undefined;
    const details =
      typeof err.details === "string"
        ? err.details
        : typeof err.detail === "string"
        ? err.detail
        : undefined;
    const hint = typeof err.hint === "string" ? err.hint : undefined;
    const stack = typeof err.stack === "string" ? err.stack : undefined;

    let rawString = "";
    try {
      rawString = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
    } catch {
      rawString = String(error);
    }

    return {
      name,
      message,
      code,
      status,
      details,
      hint,
      stack,
      rawString,
    };
  }

  return {
    message: String(error),
    rawString: String(error),
  };
}

// ============================================================================
// 5. Classification Function
// ============================================================================

/**
 * Maps any runtime error, Postgres error code, Supabase PostgrestError,
 * network/offline condition, or auth mismatch to an exact DiagnosticReport.
 */
export function classifyDiagnosticError(
  error: unknown,
  context?: DiagnosticContext
): DiagnosticReport {
  const isOnline =
    typeof context?.isOnline === "boolean"
      ? context.isOnline
      : typeof navigator !== "undefined"
        ? Boolean(navigator.onLine)
        : true;
  const userAgent =
    typeof navigator !== "undefined" ? navigator.userAgent : "SSR/Node.js";
  const currentUrl =
    typeof window !== "undefined" && window.location
      ? window.location.href || "https://21games.ai/admin"
      : "https://21games.ai/admin";
  const commitHash =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "local-dev";

  const raw = extractRawErrorDetails(error);
  const msgLower = (raw.message || "").toLowerCase();
  const codeStr = raw.code ? String(raw.code).toUpperCase() : "";

  let resolvedCode: DiagnosticErrorCode =
    DIAGNOSTIC_ERROR_CODES.ERR_INTERNAL_UNHANDLED_EXCEPTION;

  // 1. Explicit override via context
  if (context?.forcedErrorCode && DIAGNOSTIC_ERROR_CATALOG[context.forcedErrorCode]) {
    resolvedCode = context.forcedErrorCode;
  }
  // 2. Offline browser detection
  else if (!isOnline || msgLower.includes("offline") || msgLower.includes("net::err_internet_disconnected")) {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_NETWORK_OFFLINE;
  }
  // 3. Supabase configuration missing
  else if (!isSupabaseConfigured) {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_NOT_CONFIGURED;
  }
  // 4. Client initialization failure
  else if (
    msgLower.includes("client unavailable") ||
    msgLower.includes("supabase client") && msgLower.includes("null") ||
    msgLower.includes("createclient failed")
  ) {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_CLIENT_UNAVAILABLE;
  }
  // 5. Auth / Role validation (save operations require Game Master)
  else if (context?.action === "save" && (!context.userEmail || context.userEmail.trim() === "")) {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_AUTH_NOT_AUTHENTICATED;
  } else if (
    context?.action === "save" &&
    context.userEmail &&
    !isInitialGameMaster(context.userEmail)
  ) {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_AUTH_NOT_GAME_MASTER;
  }
  // 6. Auth session / JWT expired
  else if (
    raw.status === 401 ||
    codeStr === "PGRST301" ||
    raw.name === "AuthSessionMissingError" ||
    raw.name === "AuthInvalidJwtError" ||
    msgLower.includes("jwt expired") ||
    msgLower.includes("token is expired") ||
    msgLower.includes("session missing") ||
    msgLower.includes("invalid claim")
  ) {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_AUTH_SESSION_EXPIRED;
  }
  // 7. Network timeouts
  else if (
    raw.status === 408 ||
    raw.status === 504 ||
    raw.name === "AbortError" ||
    raw.name === "TimeoutError" ||
    msgLower.includes("timed out") ||
    msgLower.includes("timeout") ||
    msgLower.includes("signal timed out")
  ) {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_NETWORK_TIMEOUT;
  }
  // 8. Postgres RLS violation (42501)
  else if (
    codeStr === "42501" &&
    (msgLower.includes("row-level security") ||
      msgLower.includes("rls") ||
      msgLower.includes("policy") ||
      (raw.details && raw.details.toLowerCase().includes("policy")))
  ) {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_RLS_VIOLATION;
  }
  // 9. Postgres permission denied (42501 without RLS, or 403 Forbidden)
  else if (
    raw.status === 403 ||
    codeStr === "42501" ||
    msgLower.includes("permission denied") ||
    msgLower.includes("insufficient_privilege")
  ) {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_PERMISSION_DENIED;
  }
  // 10. Schema mismatch (42703 undefined column, 42P01 undefined table, PGRST204/205)
  else if (
    ["42703", "42P01", "PGRST204", "PGRST205", "42883"].includes(codeStr) ||
    msgLower.includes("column") && msgLower.includes("does not exist") ||
    msgLower.includes("relation") && msgLower.includes("does not exist") ||
    msgLower.includes("schema cache")
  ) {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_SCHEMA_MISMATCH;
  }
  // 11. Database constraint violations (23505 unique, 23514 check, 23502 not-null, 23503 fk)
  else if (
    ["23505", "23514", "23502", "23503", "23P01"].includes(codeStr) ||
    msgLower.includes("unique constraint") ||
    msgLower.includes("check constraint") ||
    msgLower.includes("duplicate key") ||
    msgLower.includes("violates not-null constraint")
  ) {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_CONSTRAINT_VIOLATION;
  }
  // 12. Payload validation failure
  else if (
    context?.action === "validate" ||
    msgLower.includes("moderation") ||
    msgLower.includes("validation") ||
    msgLower.includes("invalid word length") ||
    msgLower.includes("each of the 5 rows") ||
    msgLower.includes("must have at least 2 letters") ||
    msgLower.includes("auto-shortened") ||
    msgLower.includes("tile constraints")
  ) {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_PAYLOAD_VALIDATION_FAILED;
  }
  // 13. Hash mismatch
  else if (
    msgLower.includes("content_hash") ||
    msgLower.includes("hash mismatch") ||
    msgLower.includes("checksum") ||
    msgLower.includes("sha-256")
  ) {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_PAYLOAD_HASH_MISMATCH;
  }
  // 14. Realtime subscription failures
  else if (
    msgLower.includes("channel_error") ||
    msgLower.includes("subscription failed") ||
    msgLower.includes("failed to join realtime") ||
    msgLower.includes("phx_error") ||
    codeStr === "CHANNEL_ERROR"
  ) {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_REALTIME_SUBSCRIPTION_FAILED;
  }
  // 15. Realtime channel closed
  else if (
    msgLower.includes("channel closed") ||
    msgLower.includes("phx_close") ||
    codeStr === "CLOSED"
  ) {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_REALTIME_CHANNEL_CLOSED;
  }
  // 16. Action-specific fallbacks
  else if (
    context?.action === "fetch" ||
    msgLower.includes("failed to fetch") ||
    msgLower.includes("networkerror when attempting to fetch resource")
  ) {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_FETCH_FAILED;
  } else if (context?.action === "save") {
    resolvedCode = DIAGNOSTIC_ERROR_CODES.ERR_SUPABASE_UPSERT_FAILED;
  }

  const meta =
    DIAGNOSTIC_ERROR_CATALOG[resolvedCode] ||
    DIAGNOSTIC_ERROR_CATALOG[
      DIAGNOSTIC_ERROR_CODES.ERR_INTERNAL_UNHANDLED_EXCEPTION
    ];

  const targetDate =
    context?.targetDate ||
    (typeof window !== "undefined" ? getLocalDateKey() : "2026-11-10");

  const gameSlug = context?.gameSlug || "connect-5";

  return {
    errorCode: resolvedCode,
    errorCategory: meta.category,
    errorTitle: meta.title,
    errorDescription: context?.customMessage || meta.description,
    troubleshootingHint: meta.troubleshootingHint,
    severity: meta.severity,
    timestamp: new Date().toISOString(),
    targetDate,
    gameSlug,
    userEmail: context?.userEmail ?? null,
    userRole: context?.userRole ?? null,
    supabaseUrl:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://trwyrfhicbnfhlbiztau.supabase.co",
    isOnline,
    action: context?.action || "unknown",
    rawError: raw,
    environment: {
      userAgent,
      url: currentUrl,
      commitHash,
      isOnline,
      platform: typeof navigator !== "undefined" ? navigator.platform : undefined,
      language: typeof navigator !== "undefined" ? navigator.language : undefined,
    },
  };
}

// ============================================================================
// 6. Formatting & Serialization Helpers
// ============================================================================

/**
 * Produces clean, indented JSON representation of the diagnostic report.
 */
export function serializeDiagnosticReport(report: DiagnosticReport): string {
  try {
    return JSON.stringify(report, null, 2);
  } catch {
    return JSON.stringify(
      {
        errorCode: report.errorCode,
        errorTitle: report.errorTitle,
        timestamp: report.timestamp,
        rawString: report.rawError.rawString,
      },
      null,
      2
    );
  }
}

/**
 * Formats diagnostic report into a structured plain-text banner ready to be
 * copied to clipboard and sent to developer via Slack, Discord, or Linear.
 */
export function formatDiagnosticReportText(report: DiagnosticReport): string {
  const divider = "=".repeat(76);
  const subDivider = "-".repeat(76);

  return [
    divider,
    "SOL GaMES (21games.ai) — STUDIO DIAGNOSTIC REPORT",
    divider,
    `Error Code:     [${report.errorCode}]`,
    `Category:       ${report.errorCategory.toUpperCase()}`,
    `Severity:       ${report.severity.toUpperCase()}`,
    `Title:          ${report.errorTitle}`,
    `Timestamp:      ${report.timestamp}`,
    subDivider,
    "GAME & TARGET DATE",
    `Game:           ${report.gameSlug}`,
    `Target Date:    ${report.targetDate}`,
    `Studio Action:  ${report.action}`,
    subDivider,
    "USER & PERMISSIONS",
    `User Email:     ${report.userEmail || "Anonymous / Not Signed In"}`,
    `Resolved Role:  ${report.userRole || "None"}`,
    `Supabase URL:   ${report.supabaseUrl}`,
    `Device Online:  ${report.isOnline ? "YES" : "NO (OFFLINE)"}`,
    subDivider,
    "WHAT HAPPENED (GAME MASTER SUMMARY)",
    report.errorDescription,
    "",
    "ACTIONABLE TROUBLESHOOTING HINT",
    report.troubleshootingHint,
    subDivider,
    "RAW DATABASE / SYSTEM ERROR",
    report.rawError.code ? `Postgres/HTTP Code: ${report.rawError.code}` : null,
    report.rawError.status ? `HTTP Status:        ${report.rawError.status}` : null,
    report.rawError.message ? `Message:            ${report.rawError.message}` : null,
    report.rawError.details ? `Details:            ${report.rawError.details}` : null,
    report.rawError.hint ? `DB Hint:            ${report.rawError.hint}` : null,
    subDivider,
    "ENVIRONMENT & BUILD",
    `Page URL:       ${report.environment.url}`,
    `Git Commit:     ${report.environment.commitHash || "local-dev"}`,
    `User Agent:     ${report.environment.userAgent}`,
    subDivider,
    "COMPLETE DIAGNOSTIC JSON PAYLOAD",
    serializeDiagnosticReport(report),
    divider,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * Direct factory to construct a pre-filled DiagnosticReport for a known error code.
 */
export function createDiagnosticReport(
  code: DiagnosticErrorCode,
  context?: DiagnosticContext,
  rawError?: unknown
): DiagnosticReport {
  return classifyDiagnosticError(rawError || new Error(`[${code}] triggered`), {
    ...context,
    forcedErrorCode: code,
  });
}

/**
 * Type guard for DiagnosticReport objects.
 */
export function isDiagnosticReport(value: unknown): value is DiagnosticReport {
  return (
    typeof value === "object" &&
    value !== null &&
    "errorCode" in value &&
    "errorTitle" in value &&
    "timestamp" in value &&
    "rawError" in value
  );
}
