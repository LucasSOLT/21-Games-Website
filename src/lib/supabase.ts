import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://trwyrfhicbnfhlbiztau.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_a9xQwMZoEA3-5nTpIFm8cw_XFmZehG0";

export function sanitizeSupabaseEnvValue(raw?: string | null): string {
  if (!raw || typeof raw !== "string") return "";
  let cleaned = raw.trim().replace(/^["']+|["']+$/g, "").trim();
  // Strip accidental "NEXT_PUBLIC_SUPABASE_...=" prefix if pasted into Vercel env value field
  cleaned = cleaned
    .replace(/^[A-Z0-9_]+\s*=\s*/i, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();
  return cleaned;
}

export function resolveSupabaseUrl(raw?: string | null): string {
  const cleaned = sanitizeSupabaseEnvValue(raw);
  if (
    cleaned &&
    cleaned.startsWith("http") &&
    !cleaned.toLowerCase().includes("placeholder")
  ) {
    return cleaned.replace(/\/+$/, "");
  }
  return DEFAULT_SUPABASE_URL;
}

export function resolveSupabaseAnonKey(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const cleaned = sanitizeSupabaseEnvValue(candidate);
    if (
      cleaned &&
      cleaned.length >= 16 &&
      !cleaned.toLowerCase().includes("placeholder") &&
      !cleaned.startsWith("http")
    ) {
      return cleaned;
    }
  }
  return DEFAULT_SUPABASE_PUBLISHABLE_KEY;
}

export const supabaseUrl = resolveSupabaseUrl(
  process.env.NEXT_PUBLIC_SUPABASE_URL
);
export const supabaseAnonKey = resolveSupabaseAnonKey(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith("http") &&
    !supabaseUrl.includes("placeholder")
);

export const SUPABASE_AUTH_STORAGE_KEY = "solgames_supabase_auth";
export const REMEMBER_LOGIN_KEY = "solgames_remember_login";

export function getRememberLogin(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(REMEMBER_LOGIN_KEY);
    if (stored === null) return true; // Default to true
    return stored === "true";
  } catch {
    return true;
  }
}

export function setRememberLogin(remember: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMEMBER_LOGIN_KEY, remember ? "true" : "false");
  } catch {
    // Ignore storage quota errors
  }
}

export function clearAuthStorage(storageKey: string = SUPABASE_AUTH_STORAGE_KEY): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.removeItem(storageKey);
    window.localStorage.removeItem("solgames_v1_active_user");
    window.sessionStorage.removeItem("solgames_v1_active_user");
    window.localStorage.removeItem("solgames_v1_accounts_db");
  } catch {
    // Ignore storage errors
  }
}

export function switchRememberLogin(
  newRemember: boolean,
  storageKey: string = SUPABASE_AUTH_STORAGE_KEY
): void {
  setRememberLogin(newRemember);
  if (typeof window === "undefined") return;
  try {
    if (newRemember) {
      // Migrate from sessionStorage to localStorage
      const sessionData = window.sessionStorage.getItem(storageKey);
      if (sessionData !== null) {
        window.localStorage.setItem(storageKey, sessionData);
        window.sessionStorage.removeItem(storageKey);
      }
      const activeUser = window.sessionStorage.getItem("solgames_v1_active_user");
      if (activeUser !== null) {
        window.localStorage.setItem("solgames_v1_active_user", activeUser);
        window.sessionStorage.removeItem("solgames_v1_active_user");
      }
    } else {
      // Migrate from localStorage to sessionStorage
      const sessionData = window.localStorage.getItem(storageKey);
      if (sessionData !== null) {
        window.sessionStorage.setItem(storageKey, sessionData);
        window.localStorage.removeItem(storageKey);
      }
      const activeUser = window.localStorage.getItem("solgames_v1_active_user");
      if (activeUser !== null) {
        window.sessionStorage.setItem("solgames_v1_active_user", activeUser);
        window.localStorage.removeItem("solgames_v1_active_user");
      }
    }
  } catch {
    // Ignore storage errors
  }
}

export const dynamicSupabaseStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      const remember = getRememberLogin();
      if (remember) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
        return window.sessionStorage.getItem(key);
      } else {
        const val = window.sessionStorage.getItem(key);
        if (val !== null) return val;
        return window.localStorage.getItem(key);
      }
    } catch {
      return null;
    }
  },

  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      const remember = getRememberLogin();
      if (remember) {
        window.localStorage.setItem(key, value);
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(key, value);
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore quota errors
    }
  },

  removeItem: (key: string): void => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore errors
    }
  },
};

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: dynamicSupabaseStorage,
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return clientInstance;
}
