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
import { ProfileViewerModal } from "@/components/account/profile-viewer-modal";

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
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
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

    return () => {
      isMounted = false;
      unsubscribeRealtime();
      unsubscribe();
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
      if (result.ok && result.profile) {
        setProfile(result.profile);
        setModalInitialTab("profile");
      }
      const message =
        result.message ||
        result.error ||
        (result.ok
          ? "Magic link sent! Your profile and streaks are synced."
          : "Could not send magic link.");
      return {
        ...result,
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
      openAccountModal,
      closeAccountModal,
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
      openAccountModal,
      closeAccountModal,
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
