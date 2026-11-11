"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  canAccessPuzzleStudio,
  initializeAuthSession,
  isAdmin,
  isGameMaster,
  sendMagicLink,
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
  subscribeToAuthChanges,
  updateUserProfile,
  type AuthResult,
  type SignInInput,
  type SignUpInput,
  type UpdateProfileInput,
  type UserProfile,
} from "@/lib/user-auth";
import {
  initRealtimePuzzleSync,
  syncAllRemoteDailyPuzzles,
} from "@/lib/game-storage";
import {
  ProfileViewerModal,
  SetNewPasswordModal,
} from "@/components/account/profile-viewer-modal";
import { getSupabaseClient } from "@/lib/supabase";

export type AccountModalTab = "signin" | "signup" | "profile";

export interface AuthContextValue {
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isGameMaster: boolean;
  isAdmin: boolean;
  canAccessStudio: boolean;
  isLoading: boolean;
  isModalOpen: boolean;
  modalInitialTab: AccountModalTab;
  openAccountModal: (tab?: AccountModalTab) => void;
  closeAccountModal: () => void;
  signIn: (input: SignInInput) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  sendMagicLinkEmail: (
    email: string
  ) => Promise<AuthResult & { ok: boolean; message: string }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: UpdateProfileInput) => Promise<AuthResult>;
  refreshProfile: () => Promise<UserProfile | null>;
  isRecoveryOpen: boolean;
  openSetNewPasswordModal: () => void;
  closeSetNewPasswordModal: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    return (
      hash.includes("type=recovery") ||
      search.includes("recovery=true") ||
      search.includes("type=recovery")
    );
  });
  const [modalInitialTab, setModalInitialTab] =
    useState<AccountModalTab>("signin");

  useEffect(() => {
    let isMounted = true;

    // Bootstrap global daily puzzles from Supabase and initialize Realtime / cross-tab sync
    void syncAllRemoteDailyPuzzles();
    const unsubscribeRealtime = initRealtimePuzzleSync();

    void initializeAuthSession()
      .then((restored) => {
        if (!isMounted) return;
        setProfile(restored);
        if (restored && !restored.isBanned) {
          setIsModalOpen(false);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const unsubscribe = subscribeToAuthChanges((nextProfile) => {
      if (!isMounted) return;
      setProfile(nextProfile);
    });

    const supabase = getSupabaseClient();
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsRecoveryOpen(true);
        }
      });
      authListener = data;
    }

    return () => {
      isMounted = false;
      unsubscribeRealtime();
      unsubscribe();
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const openAccountModal = useCallback(
    (tab?: AccountModalTab) => {
      if (tab) {
        setModalInitialTab(tab);
      } else {
        setModalInitialTab(profile ? "profile" : "signin");
      }
      setIsModalOpen(true);
    },
    [profile]
  );

  const closeAccountModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const openSetNewPasswordModal = useCallback(() => {
    setIsRecoveryOpen(true);
  }, []);

  const closeSetNewPasswordModal = useCallback(() => {
    setIsRecoveryOpen(false);
  }, []);

  const handleSignIn = useCallback(
    async (input: SignInInput): Promise<AuthResult> => {
      const result = await signInWithEmail(input);
      if (result.ok && result.profile) {
        setProfile(result.profile);
        setModalInitialTab("profile");
      }
      return result;
    },
    []
  );

  const handleSignUp = useCallback(
    async (input: SignUpInput): Promise<AuthResult> => {
      const result = await signUpWithEmail(input);
      if (result.ok && result.profile) {
        setProfile(result.profile);
        setModalInitialTab("profile");
      }
      return result;
    },
    []
  );

  const handleSendMagicLinkEmail = useCallback(
    async (
      email: string
    ): Promise<AuthResult & { ok: boolean; message: string }> => {
      const result = await sendMagicLink(email);
      const message =
        result.message ||
        result.error ||
        (result.ok
          ? "Check your inbox for your sign-in link."
          : "Could not send magic link.");
      return {
        ...result,
        profile: null,
        message,
      };
    },
    []
  );

  const handleSignOut = useCallback(async (): Promise<void> => {
    await signOutUser();
    setProfile(null);
    setModalInitialTab("signin");
  }, []);

  const handleUpdateProfile = useCallback(
    async (updates: UpdateProfileInput): Promise<AuthResult> => {
      const result = await updateUserProfile(updates);
      if (result.ok && result.profile) {
        setProfile(result.profile);
      }
      return result;
    },
    []
  );

  const handleRefreshProfile =
    useCallback(async (): Promise<UserProfile | null> => {
      const refreshed = await initializeAuthSession();
      setProfile(refreshed);
      return refreshed;
    }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      isAuthenticated: profile !== null && !profile.isBanned,
      isGameMaster: isGameMaster(profile),
      isAdmin: isAdmin(profile),
      canAccessStudio: canAccessPuzzleStudio(profile),
      isLoading,
      isModalOpen,
      modalInitialTab,
      isRecoveryOpen,
      openAccountModal,
      closeAccountModal,
      openSetNewPasswordModal,
      closeSetNewPasswordModal,
      signIn: handleSignIn,
      signUp: handleSignUp,
      sendMagicLinkEmail: handleSendMagicLinkEmail,
      signOut: handleSignOut,
      updateProfile: handleUpdateProfile,
      refreshProfile: handleRefreshProfile,
    }),
    [
      profile,
      isLoading,
      isModalOpen,
      modalInitialTab,
      isRecoveryOpen,
      openAccountModal,
      closeAccountModal,
      openSetNewPasswordModal,
      closeSetNewPasswordModal,
      handleSignIn,
      handleSignUp,
      handleSendMagicLinkEmail,
      handleSignOut,
      handleUpdateProfile,
      handleRefreshProfile,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <ProfileViewerModal />
      <SetNewPasswordModal
        open={isRecoveryOpen}
        onOpenChange={setIsRecoveryOpen}
        onSuccess={() => {
          void handleRefreshProfile();
        }}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
