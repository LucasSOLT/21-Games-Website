"use client";

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  Database,
  Eye,
  Lightbulb,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CONNECT_5_PUZZLES,
  type Connect5HintCoord,
  type Connect5Puzzle,
} from "@/data/puzzles/connect-5";
import {
  enforceTileConstraints,
  parseTranscriptTo21Items,
  TWENTY_ONE_THINGS_BOARDS,
  type TwentyOneThingsBoard,
} from "@/data/puzzles/21-things";
import {
  buildStructuredHaikuLines,
  countLineSyllables,
  sliceHaikuIntoChunks,
  validateHaikuStructure,
  type SeventeenSyllablesPuzzle,
} from "@/data/puzzles/17-syllables";
import {
  get17SyllablesPuzzleForDate,
  get21ThingsBoardForDate,
  getConnect5PuzzleForDate,
  getLocalDateKey,
  getPuzzleNumberForDate,
} from "@/lib/daily-engine";
import {
  fetchRemote17SyllablesOverride,
  fetchRemote21ThingsOverride,
  fetchRemoteConnect5Override,
  getAdmin17SyllablesOverrides,
  getAdmin21ThingsOverrides,
  getAdminConnect5Overrides,
  saveAdmin17SyllablesOverride,
  saveAdmin21ThingsOverride,
  saveAdminConnect5Override,
  saveAdminOverrideForGame,
} from "@/lib/game-storage";
import type { AllGameSlug } from "@/lib/games-config";
import { collectPayloadStrings } from "@/lib/custom-puzzles";
import type { GenericPublishRequest } from "@/components/admin/generic-publish";
import { NineRhymesStudioTab } from "@/components/admin/nine-rhymes-studio-tab";
import { EightfoldEchoStudioTab } from "@/components/admin/eightfold-echo-studio-tab";
import { SixPicsStudioTab } from "@/components/admin/six-pics-studio-tab";
import { FourScoreStudioTab } from "@/components/admin/four-score-studio-tab";
import { MoveTwoStudioTab } from "@/components/admin/move-two-studio-tab";
import { OneWinStudioTab } from "@/components/admin/one-win-studio-tab";
import { HaikuSliceCutter } from "@/components/admin/haiku-slice-cutter";
import {
  classifyDiagnosticError,
  type DiagnosticReport,
} from "@/lib/diagnostic-errors";
import { DiagnosticErrorModal } from "@/components/admin/diagnostic-error-modal";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/components/account/auth-provider";
import {
  canAccessPuzzleStudio,
  checkDateEditPermission,
  fetchAllUserProfiles,
  isGameMaster,
  isInitialGameMaster,
  setUserBannedStatus,
  updateUserRole,
  type UserProfile,
  type UserRole,
} from "@/lib/user-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  check17SyllablesPuzzleModeration,
  checkConnect5PuzzleModeration,
  check21ThingsBoardModeration,
  moderateFields,
} from "@/lib/moderation";
import { cn } from "@/lib/utils";

const SSR_ANCHOR_DATE = "2026-11-05";
const subscribeNoop = () => () => {};

interface PendingPublishState {
  isOpen: boolean;
  gameSlug: AllGameSlug;
  gameTitle: string;
  targetDate: string;
  isToday: boolean;
  dateStatus: "Today" | "Future" | "Past";
  playImmediately: boolean;
  summary: {
    title: string;
    creatorOrAuthor: string;
    preview: string;
    details: string[];
  };
  onConfirm: () => Promise<void>;
}

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { profile, isLoading: authLoading } = useAuth();

  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  useEffect(() => {
    if (mounted && !authLoading && !canAccessPuzzleStudio(profile)) {
      router.replace("/");
    }
  }, [mounted, authLoading, profile, router]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const todayDateKey = mounted ? getLocalDateKey() : SSR_ANCHOR_DATE;
  const targetDate = selectedDate ?? todayDateKey;
  const [activeTab, setActiveTab] = useState<string>("connect-5");

  // Confirmation Modal State before Publishing Puzzles
  const [pendingPublish, setPendingPublish] = useState<PendingPublishState | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Diagnostic Error Modal State
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const [retrySyncFn, setRetrySyncFn] = useState<(() => Promise<void>) | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // Authorization and permission calculations
  const isGM = isGameMaster(profile);
  const editPerm = useMemo(() => {
    return checkDateEditPermission(profile, targetDate, todayDateKey);
  }, [profile, targetDate, todayDateKey]);

  const openDiagnosticError = useCallback(
    (
      error: unknown,
      context: {
        gameSlug: AllGameSlug;
        targetDate: string;
        action: "save" | "fetch" | "sync" | "validate";
        customMessage?: string;
      },
      retryHandler?: () => Promise<void>
    ) => {
      const report = classifyDiagnosticError(error, {
        gameSlug: context.gameSlug,
        targetDate: context.targetDate,
        action: context.action,
        customMessage: context.customMessage,
        userEmail: profile?.email,
        userRole: profile?.role,
        isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      });

      setDiagnosticReport(report);
      setIsDiagnosticOpen(true);
      setRetrySyncFn(retryHandler ? () => retryHandler : null);
    },
    [profile]
  );

  // ==========================================================================
  // Connect 5 Creator State
  // ==========================================================================
  const [c5Title, setC5Title] = useState("Desk to Breeze");
  const [c5Author, setC5Author] = useState("");
  const [c5Editor, setC5Editor] = useState("");
  const [c5Words, setC5Words] = useState<[string, string, string, string, string]>([
    "MOUSE",
    "PAD",
    "LOCK",
    "DOWN",
    "WIND",
  ]);
  const [c5Connections, setC5Connections] = useState<
    [string, string, string, string]
  >([
    "MOUSE PAD — cushioned surface for a computer mouse",
    "PADLOCK — portable shackle lock",
    "LOCKDOWN — security protocol confining movement",
    "DOWNWIND — carried in the direction the wind blows",
  ]);
  const [c5Hints, setC5Hints] = useState<Connect5HintCoord[]>([
    { row: 1, col: 0 },
    { row: 3, col: 2 },
  ]);

  // ==========================================================================
  // 21 Things Creator State
  // ==========================================================================
  const [t21Title, setT21Title] = useState("Everyday Magic & Small Joys");
  const [t21Creator, setT21Creator] = useState("");
  const [t21Bio, setT21Bio] = useState(
    "21 little things that make ordinary days feel extraordinary."
  );
  const [t21Stream, setT21Stream] = useState("");
  const [t21Items, setT21Items] = useState<string[]>(() =>
    TWENTY_ONE_THINGS_BOARDS[0].items.slice(0, 21)
  );

  // ==========================================================================
  // 17 Syllables Creator State
  // ==========================================================================
  const [s17Theme, setS17Theme] = useState<string>("Golden Autumn");
  const [s17Author, setS17Author] = useState<string>("SOL Theory");
  const [s17Line1, setS17Line1] = useState<string>("Gold leaves drift along");
  const [s17Line2, setS17Line2] = useState<string>("Cool winds whisper in the dusk");
  const [s17Line3, setS17Line3] = useState<string>("Soft earth waits for dawn");
  const [s17CustomWordChunks, setS17CustomWordChunks] = useState<Record<string, string[]>>({});

  // ==========================================================================
  // User Management State (Game Masters Only)
  // ==========================================================================
  const [userList, setUserList] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [actionInProgressEmail, setActionInProgressEmail] = useState<string | null>(null);

  const handleRefreshUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const list = await fetchAllUserProfiles();
      setUserList(list);
    } catch (err) {
      console.error("Failed to load user list:", err);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const handleManualCloudSync = async () => {
    setIsManualSyncing(true);
    try {
      const [remoteC5, remote21, remote17] = await Promise.all([
        fetchRemoteConnect5Override(targetDate),
        fetchRemote21ThingsOverride(targetDate),
        fetchRemote17SyllablesOverride(targetDate),
      ]);
      if (remoteC5) {
        setC5Title(remoteC5.title);
        setC5Author(remoteC5.author);
        setC5Editor(remoteC5.editor);
        setC5Words([...remoteC5.words]);
        setC5Connections([...remoteC5.connections]);
        setC5Hints([...remoteC5.revealedHints]);
      }
      if (remote21) {
        setT21Title(remote21.title);
        setT21Creator(remote21.creatorName);
        setT21Bio(remote21.creatorBio);
        setT21Items(remote21.items.slice(0, 21));
      }
      if (remote17) {
        setS17Theme(remote17.theme || "");
        setS17Author(remote17.author || "SOL Theory");
        setS17Line1(remote17.lines[0] || "");
        setS17Line2(remote17.lines[1] || "");
        setS17Line3(remote17.lines[2] || "");
        setS17CustomWordChunks(remote17.customWordChunks ?? {});
      }
      toast({
        title: "Cloud Sync Complete",
        description: `Refreshed puzzle overrides from Supabase for ${targetDate}.`,
      });
    } catch (err) {
      openDiagnosticError(
        err,
        {
          gameSlug: activeTab === "21-things" || activeTab === "17-syllables" ? activeTab : "connect-5",
          targetDate,
          action: "fetch",
          customMessage: "Cloud Sync Failed: Unable to fetch daily puzzle overrides from Supabase.",
        },
        handleManualCloudSync
      );
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleClearConnect5 = () => {
    setC5Title("");
    setC5Author("");
    setC5Editor("");
    setC5Words(["", "", "", "", ""]);
    setC5Connections(["", "", "", ""]);
    setC5Hints([]);
  };

  const handleRevertConnect5Default = () => {
    const defaultC5 = getConnect5PuzzleForDate(targetDate, {});
    setC5Title(defaultC5.title);
    setC5Author(defaultC5.author);
    setC5Editor(defaultC5.editor);
    setC5Words([...defaultC5.words]);
    setC5Connections([...defaultC5.connections]);
    setC5Hints([...defaultC5.revealedHints]);
  };

  const handleClear21Things = () => {
    setT21Title("");
    setT21Creator("");
    setT21Bio("");
    setT21Stream("");
    setT21Items(Array.from({ length: 21 }, () => ""));
  };

  const handleRevert21ThingsDefault = () => {
    const default21 = get21ThingsBoardForDate(targetDate, {});
    setT21Title(default21.title);
    setT21Creator(default21.creatorName);
    setT21Bio(default21.creatorBio);
    setT21Stream("");
    setT21Items(default21.items.slice(0, 21));
  };

  const handleClear17Syllables = () => {
    setS17Theme("");
    setS17Author("");
    setS17Line1("");
    setS17Line2("");
    setS17Line3("");
    setS17CustomWordChunks({});
  };

  const handleRevert17SyllablesDefault = () => {
    const default17 = get17SyllablesPuzzleForDate(targetDate, {});
    setS17Theme(default17.theme || "");
    setS17Author(default17.author || "SOL Theory");
    setS17Line1(default17.lines[0] || "");
    setS17Line2(default17.lines[1] || "");
    setS17Line3(default17.lines[2] || "");
    setS17CustomWordChunks(default17.customWordChunks ?? {});
  };

  useEffect(() => {
    let cancelled = false;
    async function fetchSchedule(dateKey: string) {
      // 1. Immediately render local / scheduled cache to prevent blocking UI
      const localC5 = getAdminConnect5Overrides()[dateKey];
      const scheduledC5 = localC5 ?? getConnect5PuzzleForDate(dateKey);
      if (cancelled) return;
      setC5Title(scheduledC5.title);
      setC5Author(scheduledC5.author);
      setC5Editor(scheduledC5.editor);
      setC5Words([...scheduledC5.words]);
      setC5Connections([...scheduledC5.connections]);
      setC5Hints([...scheduledC5.revealedHints]);

      const local21 = getAdmin21ThingsOverrides()[dateKey];
      const scheduled21 = local21 ?? get21ThingsBoardForDate(dateKey);
      setT21Title(scheduled21.title);
      setT21Creator(scheduled21.creatorName);
      setT21Bio(scheduled21.creatorBio);
      setT21Stream("");
      setT21Items(scheduled21.items.slice(0, 21));

      const local17 = getAdmin17SyllablesOverrides()[dateKey];
      const scheduled17 = local17 ?? get17SyllablesPuzzleForDate(dateKey);
      setS17Theme(scheduled17.theme || "");
      setS17Author(scheduled17.author || "SOL Theory");
      setS17Line1(scheduled17.lines[0] || "");
      setS17Line2(scheduled17.lines[1] || "");
      setS17Line3(scheduled17.lines[2] || "");
      setS17CustomWordChunks(scheduled17.customWordChunks ?? {});

      // 2. Unconditionally fetch remote overrides in parallel to prevent stale local cache
      try {
        const [remoteC5, remote21, remote17] = await Promise.all([
          fetchRemoteConnect5Override(dateKey),
          fetchRemote21ThingsOverride(dateKey),
          fetchRemote17SyllablesOverride(dateKey),
        ]);
        if (cancelled) return;
        if (remoteC5) {
          setC5Title(remoteC5.title);
          setC5Author(remoteC5.author);
          setC5Editor(remoteC5.editor);
          setC5Words([...remoteC5.words]);
          setC5Connections([...remoteC5.connections]);
          setC5Hints([...remoteC5.revealedHints]);
        }
        if (remote21) {
          setT21Title(remote21.title);
          setT21Creator(remote21.creatorName);
          setT21Bio(remote21.creatorBio);
          setT21Items(remote21.items.slice(0, 21));
        }
        if (remote17) {
          setS17Theme(remote17.theme || "");
          setS17Author(remote17.author || "SOL Theory");
          setS17Line1(remote17.lines[0] || "");
          setS17Line2(remote17.lines[1] || "");
          setS17Line3(remote17.lines[2] || "");
          setS17CustomWordChunks(remote17.customWordChunks ?? {});
        }
      } catch {
        // Fallback silently to local cache
      }
    }

    void fetchSchedule(targetDate);
    return () => {
      cancelled = true;
    };
  }, [activeTab, targetDate]);

  useEffect(() => {
    if (!isGM || activeTab !== "users") return;
    let cancelled = false;
    void fetchAllUserProfiles().then((list) => {
      if (cancelled) return;
      setUserList(list);
    });
    return () => {
      cancelled = true;
    };
  }, [isGM, activeTab]);

  const toggleC5HintLetter = (rowIdx: number, colIdx: number) => {
    if (rowIdx < 1 || rowIdx > 4 || !editPerm.canEdit) return;
    setC5Hints((prev) => {
      const exists = prev.some((h) => h.row === rowIdx && h.col === colIdx);
      if (exists) {
        return prev.filter((h) => !(h.row === rowIdx && h.col === colIdx));
      }
      return [...prev, { row: rowIdx, col: colIdx }];
    });
  };

  const handleC5WordChange = (rowIdx: number, rawVal: string) => {
    if (!editPerm.canEdit) return;
    const clean = rawVal.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 12);
    const nextWords = [...c5Words] as [string, string, string, string, string];
    nextWords[rowIdx] = clean;
    setC5Words(nextWords);
    setC5Hints((prev) =>
      prev.filter((h) => h.row !== rowIdx || h.col < clean.length)
    );
  };

  const buildC5PuzzleObject = (): Connect5Puzzle => {
    const sanitizedWords = c5Words.map((w, i) =>
      w.trim() ? w.trim().toUpperCase() : `WORD${i + 1}`
    ) as [string, string, string, string, string];

    return {
      id: `c5-custom-${targetDate}-${sanitizedWords.join("-").toLowerCase()}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      title: c5Title.trim() || "Custom Chain",
      words: sanitizedWords,
      connections: c5Connections,
      revealedHints: c5Hints,
      author: c5Author.trim() || "Puzzle Master",
      editor: c5Editor.trim() || "Daily Editor",
      customDate: targetDate,
    };
  };

  const handleSaveConnect5 = async (playImmediately = false) => {
    if (!editPerm.canEdit) {
      toast({
        title: "Permission Denied",
        description: editPerm.reason || "You cannot edit today's live or past puzzles.",
        variant: "destructive",
      });
      return;
    }

    if (c5Words.some((w) => w.length < 2)) {
      toast({
        title: "Invalid Word Length",
        description: "Each of the 5 rows must have at least 2 letters.",
        variant: "destructive",
      });
      return;
    }

    const puzzleObj = buildC5PuzzleObject();
    const modCheck = checkConnect5PuzzleModeration(
      {
        title: puzzleObj.title,
        author: puzzleObj.author,
        editor: puzzleObj.editor,
        words: puzzleObj.words,
        connections: puzzleObj.connections,
      },
      { mode: "public" }
    );

    if (!modCheck.allowed) {
      toast({
        title: "Content Moderation Error",
        description: modCheck.reason,
        variant: "destructive",
      });
      return;
    }

    const dateStatus: "Today" | "Future" | "Past" = editPerm.isToday
      ? "Today"
      : editPerm.isFuture
      ? "Future"
      : "Past";

    setPendingPublish({
      isOpen: true,
      gameSlug: "connect-5",
      gameTitle: "Connect 5",
      targetDate,
      isToday: editPerm.isToday,
      dateStatus,
      playImmediately,
      summary: {
        title: puzzleObj.title,
        creatorOrAuthor: puzzleObj.author,
        preview: puzzleObj.words.join(" → "),
        details: [
          `Chain: ${puzzleObj.words.join(" → ")}`,
          `Hints Pre-Revealed: ${puzzleObj.revealedHints.length}`,
          `Editor: ${puzzleObj.editor}`,
        ],
      },
      onConfirm: async () => {
        setIsPublishing(true);
        const authCtx = {
          userEmail: profile?.email ?? null,
          userRole: profile?.role ?? null,
        };
        try {
          const res = await saveAdminConnect5Override(
            targetDate,
            puzzleObj,
            authCtx
          );

          if (res.remotePersisted) {
            setPendingPublish(null);
            toast({
              title: `Connect 5 Saved Globally for ${targetDate}!`,
              description: `Persisted to Supabase and browser cache: ${puzzleObj.words.join(" → ")}.`,
            });

            if (playImmediately) {
              router.push(`/games/connect-5?date=${targetDate}`);
            }
          } else {
            setPendingPublish(null);
            const doRetry = async () => {
              setIsRetryingSync(true);
              try {
                const retryRes = await saveAdminConnect5Override(
                  targetDate,
                  puzzleObj,
                  authCtx
                );
                if (retryRes.remotePersisted) {
                  setIsDiagnosticOpen(false);
                  setDiagnosticReport(null);
                  setRetrySyncFn(null);
                  toast({
                    title: `Connect 5 Saved Globally for ${targetDate}!`,
                    description: `Persisted to Supabase: ${puzzleObj.words.join(" → ")}.`,
                  });
                  if (playImmediately) {
                    router.push(`/games/connect-5?date=${targetDate}`);
                  }
                } else {
                  openDiagnosticError(
                    retryRes.rawError || retryRes.error || "Retry attempt failed to persist Connect 5 to Supabase.",
                    {
                      gameSlug: "connect-5",
                      targetDate,
                      action: "save",
                      customMessage: "Retry Cloud Sync Failed: Could not persist Connect 5 changes to Supabase.",
                    },
                    doRetry
                  );
                }
              } finally {
                setIsRetryingSync(false);
              }
            };

            openDiagnosticError(
              res.rawError || res.error || "Failed to persist Connect 5 puzzle to Supabase cloud database.",
              {
                gameSlug: "connect-5",
                targetDate,
                action: "save",
              },
              doRetry
            );
          }
        } finally {
          setIsPublishing(false);
        }
      },
    });
  };

  const handleCopyConnect5Json = async () => {
    const puzzleObj = buildC5PuzzleObject();
    await navigator.clipboard.writeText(JSON.stringify(puzzleObj, null, 2));
    toast({
      title: "Connect 5 JSON Copied!",
      description: "Ready to paste into src/data/puzzles/connect-5.ts or Supabase.",
    });
  };

  const handleParse21Stream = () => {
    if (!editPerm.canEdit || !t21Stream.trim()) return;
    const { items, autoShortenedCount } = parseTranscriptTo21Items(t21Stream);
    const next = [...t21Items];
    items.forEach((it, idx) => {
      if (idx < 21) next[idx] = it;
    });
    setT21Items(next);
    toast({
      title: `Parsed ${items.length} Tiles`,
      description:
        autoShortenedCount > 0
          ? `Auto-shortened ${autoShortenedCount} item(s) to ≤5 words / ≤30 chars.`
          : "All tiles fit mobile constraints!",
    });
  };

  const handleSave21Board = async (playImmediately = false) => {
    if (!editPerm.canEdit) {
      toast({
        title: "Permission Denied",
        description: editPerm.reason || "You cannot edit today's live or past puzzles.",
        variant: "destructive",
      });
      return;
    }

    const sanitized = t21Items.map((it, idx) => {
      const { text } = enforceTileConstraints(it);
      return text || `Item #${idx + 1}`;
    });
    setT21Items(sanitized);

    const boardObj: TwentyOneThingsBoard = {
      id: `21t-custom-${targetDate}-${Date.now()}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      title: t21Title.trim() || "Daily 21 Things",
      creatorName: t21Creator.trim() || "Daily Curator",
      creatorHandle: `@${(t21Creator.trim() || "curator")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase()}`,
      creatorBio: t21Bio.trim(),
      items: sanitized,
      sampleJourneys: [],
      customDate: targetDate,
    };

    const modCheck = check21ThingsBoardModeration(
      {
        title: boardObj.title,
        creatorName: boardObj.creatorName,
        creatorBio: boardObj.creatorBio,
        items: boardObj.items,
      },
      { mode: "public" }
    );

    if (!modCheck.allowed) {
      toast({
        title: "Content Moderation Error",
        description: modCheck.reason,
        variant: "destructive",
      });
      return;
    }

    const dateStatus: "Today" | "Future" | "Past" = editPerm.isToday
      ? "Today"
      : editPerm.isFuture
      ? "Future"
      : "Past";

    setPendingPublish({
      isOpen: true,
      gameSlug: "21-things",
      gameTitle: "21 Things",
      targetDate,
      isToday: editPerm.isToday,
      dateStatus,
      playImmediately,
      summary: {
        title: boardObj.title,
        creatorOrAuthor: boardObj.creatorName,
        preview: `21 items: "${boardObj.items[0]}", "${boardObj.items[1]}", "${boardObj.items[2]}"...`,
        details: [
          `Theme: "${boardObj.title}"`,
          `Creator: ${boardObj.creatorName} (${boardObj.creatorHandle})`,
          `Total items: ${boardObj.items.length} tiles`,
        ],
      },
      onConfirm: async () => {
        setIsPublishing(true);
        const authCtx = {
          userEmail: profile?.email ?? null,
          userRole: profile?.role ?? null,
        };
        try {
          const res = await saveAdmin21ThingsOverride(
            targetDate,
            boardObj,
            authCtx
          );

          if (res.remotePersisted) {
            setPendingPublish(null);
            toast({
              title: `21 Things Saved Globally for ${targetDate}!`,
              description: `Persisted to Supabase: "${boardObj.title}" by ${boardObj.creatorName} is now live across all sessions.`,
            });

            if (playImmediately) {
              router.push(`/games/21-things?date=${targetDate}`);
            }
          } else {
            setPendingPublish(null);
            const doRetry = async () => {
              setIsRetryingSync(true);
              try {
                const retryRes = await saveAdmin21ThingsOverride(
                  targetDate,
                  boardObj,
                  authCtx
                );
                if (retryRes.remotePersisted) {
                  setIsDiagnosticOpen(false);
                  setDiagnosticReport(null);
                  setRetrySyncFn(null);
                  toast({
                    title: `21 Things Saved Globally for ${targetDate}!`,
                    description: `Persisted to Supabase: "${boardObj.title}" is now live.`,
                  });
                  if (playImmediately) {
                    router.push(`/games/21-things?date=${targetDate}`);
                  }
                } else {
                  openDiagnosticError(
                    retryRes.rawError || retryRes.error || "Retry attempt failed to persist 21 Things to Supabase.",
                    {
                      gameSlug: "21-things",
                      targetDate,
                      action: "save",
                      customMessage: "Retry Cloud Sync Failed: Could not persist 21 Things changes to Supabase.",
                    },
                    doRetry
                  );
                }
              } finally {
                setIsRetryingSync(false);
              }
            };

            openDiagnosticError(
              res.rawError || res.error || "Failed to persist 21 Things board to Supabase cloud database.",
              {
                gameSlug: "21-things",
                targetDate,
                action: "save",
              },
              doRetry
            );
          }
        } finally {
          setIsPublishing(false);
        }
      },
    });
  };

  const handleSave17Syllables = async (playImmediately = false) => {
    if (!editPerm.canEdit) {
      toast({
        title: "Permission Denied",
        description: editPerm.reason || "You cannot edit today's live or past puzzles.",
        variant: "destructive",
      });
      return;
    }

    const lines: [string, string, string] = [
      s17Line1.trim(),
      s17Line2.trim(),
      s17Line3.trim(),
    ];

    const validation = validateHaikuStructure(lines);
    if (!validation.isValid) {
      openDiagnosticError(
        new Error(validation.errors.join(" ")),
        {
          gameSlug: "17-syllables",
          targetDate,
          action: "validate",
          customMessage: `Haiku structure error: ${validation.errors.join(" ")}`,
        }
      );
      toast({
        title: "Haiku Validation Error",
        description: validation.errors[0] || "Must strictly adhere to 5-7-5 syllable structure.",
        variant: "destructive",
      });
      return;
    }

    const hasCustomCuts = Object.keys(s17CustomWordChunks).length > 0;
    const chunks = hasCustomCuts
      ? buildStructuredHaikuLines(lines, s17CustomWordChunks).flatMap((l) =>
          l.words.flatMap((w) => w.chunks)
        )
      : sliceHaikuIntoChunks(lines, 16);
    const puzzleNumber = getPuzzleNumberForDate(targetDate);
    const puzzleObj: SeventeenSyllablesPuzzle = {
      id: `17s-custom-${targetDate}-${Date.now()}`,
      puzzleNumber,
      dateKey: targetDate,
      theme: s17Theme.trim() || `17 Syllables #${puzzleNumber}`,
      author: s17Author.trim() || "SOL Theory",
      lines,
      chunks,
      ...(hasCustomCuts ? { customWordChunks: s17CustomWordChunks } : {}),
    };

    const modCheck = check17SyllablesPuzzleModeration(
      {
        theme: puzzleObj.theme,
        author: puzzleObj.author,
        lines: puzzleObj.lines,
      },
      { mode: "public" }
    );

    if (!modCheck.allowed) {
      toast({
        title: "Content Moderation Error",
        description: modCheck.reason,
        variant: "destructive",
      });
      return;
    }

    const dateStatus: "Today" | "Future" | "Past" = editPerm.isToday
      ? "Today"
      : editPerm.isFuture
      ? "Future"
      : "Past";

    setPendingPublish({
      isOpen: true,
      gameSlug: "17-syllables",
      gameTitle: "17 Syllables",
      targetDate,
      isToday: editPerm.isToday,
      dateStatus,
      playImmediately,
      summary: {
        title: puzzleObj.theme,
        creatorOrAuthor: puzzleObj.author,
        preview: lines.join(" / "),
        details: [
          `Theme: "${puzzleObj.theme}"`,
          `Author: ${puzzleObj.author}`,
          `17 Syllables: Line 1 (5), Line 2 (7), Line 3 (5)`,
          `Sliced into ${chunks.length} uppercase chunks`,
        ],
      },
      onConfirm: async () => {
        setIsPublishing(true);
        const authCtx = {
          userEmail: profile?.email ?? null,
          userRole: profile?.role ?? null,
        };
        try {
          const res = await saveAdmin17SyllablesOverride(
            targetDate,
            puzzleObj,
            authCtx
          );

          if (res.remotePersisted) {
            setPendingPublish(null);
            toast({
              title: `17 Syllables Saved Globally for ${targetDate}!`,
              description: `Persisted to Supabase: "${puzzleObj.theme}" is now live across all sessions.`,
            });

            if (playImmediately) {
              router.push(`/games/17-syllables?date=${targetDate}`);
            }
          } else {
            setPendingPublish(null);
            const doRetry = async () => {
              setIsRetryingSync(true);
              try {
                const retryRes = await saveAdmin17SyllablesOverride(
                  targetDate,
                  puzzleObj,
                  authCtx
                );
                if (retryRes.remotePersisted) {
                  setIsDiagnosticOpen(false);
                  setDiagnosticReport(null);
                  setRetrySyncFn(null);
                  toast({
                    title: `17 Syllables Saved Globally for ${targetDate}!`,
                    description: `Persisted to Supabase: "${puzzleObj.theme}".`,
                  });
                  if (playImmediately) {
                    router.push(`/games/17-syllables?date=${targetDate}`);
                  }
                } else {
                  openDiagnosticError(
                    retryRes.rawError || retryRes.error || "Retry attempt failed to persist 17 Syllables to Supabase.",
                    {
                      gameSlug: "17-syllables",
                      targetDate,
                      action: "save",
                      customMessage: "Retry Cloud Sync Failed: Could not persist 17 Syllables changes to Supabase.",
                    },
                    doRetry
                  );
                }
              } finally {
                setIsRetryingSync(false);
              }
            };

            openDiagnosticError(
              res.rawError || res.error || "Failed to persist 17 Syllables puzzle to Supabase cloud database.",
              {
                gameSlug: "17-syllables",
                targetDate,
                action: "save",
              },
              doRetry
            );
          }
        } finally {
          setIsPublishing(false);
        }
      },
    });
  };

  /**
   * Generic confirm-then-publish flow shared by the newer studio tabs (9 Rhymes, 6 Pics,
   * Eightfold Echo, Four Score, Move Two, 1 Win): permission check → public moderation →
   * confirmation modal → `saveAdminOverrideForGame` (+ diagnostics / retry).
   */
  const requestGenericPublish = (req: GenericPublishRequest) => {
    if (!editPerm.canEdit) {
      toast({
        title: "Permission Denied",
        description: editPerm.reason || "You cannot edit today's live or past puzzles.",
        variant: "destructive",
      });
      return;
    }
    const mod = moderateFields(
      collectPayloadStrings(req.payload, "puzzle"),
      "public"
    );
    if (!mod.allowed) {
      toast({
        title: "Content Moderation Error",
        description: mod.reason,
        variant: "destructive",
      });
      return;
    }
    const dateStatus: "Today" | "Future" | "Past" = editPerm.isToday
      ? "Today"
      : editPerm.isFuture
      ? "Future"
      : "Past";
    const date = targetDate;
    const authCtx = { userEmail: profile?.email ?? null, userRole: profile?.role ?? null };

    const finish = (playImmediately: boolean) => {
      setPendingPublish(null);
      toast({
        title: `${req.gameTitle} Saved Globally for ${date}!`,
        description: `Persisted to Supabase: "${req.meta.title}" is now live across all sessions.`,
      });
      if (playImmediately) router.push(`/games/${req.gameSlug}?date=${date}`);
    };

    setPendingPublish({
      isOpen: true,
      gameSlug: req.gameSlug,
      gameTitle: req.gameTitle,
      targetDate: date,
      isToday: editPerm.isToday,
      dateStatus,
      playImmediately: Boolean(req.playImmediately),
      summary: {
        title: req.meta.title,
        creatorOrAuthor: req.meta.author || "SOL Theory",
        preview: req.preview,
        details: req.details,
      },
      onConfirm: async () => {
        setIsPublishing(true);
        try {
          const res = await saveAdminOverrideForGame(
            req.gameSlug,
            date,
            req.payload,
            req.meta,
            authCtx
          );
          if (res.remotePersisted) {
            finish(Boolean(req.playImmediately));
            return;
          }
          setPendingPublish(null);
          const doRetry = async () => {
            setIsRetryingSync(true);
            try {
              const retry = await saveAdminOverrideForGame(
                req.gameSlug,
                date,
                req.payload,
                req.meta,
                authCtx
              );
              if (retry.remotePersisted) {
                setIsDiagnosticOpen(false);
                setDiagnosticReport(null);
                setRetrySyncFn(null);
                finish(Boolean(req.playImmediately));
              } else {
                openDiagnosticError(
                  retry.rawError || retry.error || `Retry failed to persist ${req.gameTitle} to Supabase.`,
                  { gameSlug: req.gameSlug, targetDate: date, action: "save" },
                  doRetry
                );
              }
            } finally {
              setIsRetryingSync(false);
            }
          };
          openDiagnosticError(
            res.rawError || res.error || `Failed to persist ${req.gameTitle} puzzle to Supabase cloud database.`,
            { gameSlug: req.gameSlug, targetDate: date, action: "save" },
            doRetry
          );
        } finally {
          setIsPublishing(false);
        }
      },
    });
  };

  const handleUpdateRole = async (targetUser: UserProfile, newRole: UserRole) => {
    if (!profile) return;
    if (isInitialGameMaster(targetUser.email)) {
      toast({
        title: "Action Forbidden",
        description: "Root Game Masters cannot have their roles modified.",
        variant: "destructive",
      });
      return;
    }
    setActionInProgressEmail(targetUser.email);
    try {
      const res = await updateUserRole(profile, targetUser.email, newRole);
      if (res.ok) {
        toast({
          title: "User Role Updated",
          description: `${targetUser.displayName || targetUser.email} is now ${
            newRole === "game_master"
              ? "a Game Master"
              : newRole === "admin"
              ? "an Admin (Editor)"
              : "a Standard Player"
          }.`,
        });
        await handleRefreshUsers();
      } else {
        toast({
          title: "Failed to Update Role",
          description: res.error || "An error occurred updating user role.",
          variant: "destructive",
        });
      }
    } finally {
      setActionInProgressEmail(null);
    }
  };

  const handleToggleBan = async (targetUser: UserProfile) => {
    if (!profile) return;
    if (isInitialGameMaster(targetUser.email)) {
      toast({
        title: "Action Forbidden",
        description: "Root Game Masters cannot be banned.",
        variant: "destructive",
      });
      return;
    }
    const nextBanStatus = !targetUser.isBanned;
    if (nextBanStatus) {
      const confirmed = window.confirm(
        `Are you sure you want to suspend account ${targetUser.email}? They will be barred from curating and custom board creation.`
      );
      if (!confirmed) return;
    }

    setActionInProgressEmail(targetUser.email);
    try {
      const res = await setUserBannedStatus(
        profile,
        targetUser.email,
        nextBanStatus,
        nextBanStatus
          ? `Suspended by Game Master ${profile.displayName || profile.handle}`
          : undefined
      );
      if (res.ok) {
        toast({
          title: nextBanStatus ? "Account Suspended" : "Account Reactivated",
          description: `${targetUser.displayName || targetUser.email} is now ${
            nextBanStatus ? "suspended" : "active"
          }.`,
        });
        await handleRefreshUsers();
      } else {
        toast({
          title: "Action Failed",
          description: res.error || "Failed to update ban status.",
          variant: "destructive",
        });
      }
    } finally {
      setActionInProgressEmail(null);
    }
  };

  // ==========================================================================
  // Auth Guarding: Loading State or Unauthorized Redirecting
  // ==========================================================================
  if (!mounted || authLoading || !canAccessPuzzleStudio(profile)) {
    return (
      <div className="min-h-screen bg-[#FCFCFD] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-headline font-black text-xs uppercase tracking-widest text-black">
            Verifying Editorial Credentials...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // Authorized Studio View (Admins and Game Masters)
  // ==========================================================================
  return (
    <div className="min-h-screen bg-[#FCFCFD] text-black">
      <header className="sticky top-0 z-30 border-b-2 border-black/10 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto max-w-6xl px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-black px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-black hover:bg-gray-100 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Back to Homepage</span>
              <span className="sm:hidden">Home</span>
            </Link>
            <h1 className="font-headline font-black text-sm sm:text-xl truncate">
              <span className="hidden sm:inline">SOL GaMES · </span>Admin &amp; Daily Puzzle Studio
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {profile && (
              <Badge
                variant={isGM ? "default" : "outline"}
                className={cn(
                  "text-xs whitespace-nowrap border-2 border-black",
                  isGM && "bg-black text-amber-300 font-headline font-black"
                )}
              >
                {isGM ? "👑 Game Master" : "Editor (Admin)"}
              </Badge>
            )}
            <div className="hidden md:flex items-center gap-2">
              <Badge
                variant={isSupabaseConfigured ? "green" : "yellow"}
                className="text-xs whitespace-nowrap"
              >
                <Database className="h-3 w-3 mr-1" />
                {isSupabaseConfigured
                  ? "Supabase Connected"
                  : "66-Day Bank + Local/URL Mode"}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
        {/* Global Date Picker Banner */}
        <div className="rounded-2xl border-2 border-black bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-headline font-black text-lg">
              Target Daily Schedule Date
            </h2>
            <p className="text-xs text-gray-600">
              Choose which date you want to schedule or override, or load any of
              the {CONNECT_5_PUZZLES.length} pre-seeded daily puzzles.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Button
              type="button"
              variant="outline"
              disabled={isManualSyncing}
              onClick={() => void handleManualCloudSync()}
              className="border-2 border-black font-headline font-black text-xs h-10 px-3 hover:bg-gray-100 shadow-[2px_2px_0px_#000]"
              title="Refreshes puzzle overrides from Supabase cloud database"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isManualSyncing && "animate-spin")} />
              {isManualSyncing ? "Syncing..." : "Sync Cloud"}
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-600" />
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40 sm:w-44 font-mono font-bold border-2 border-black h-10 shadow-[2px_2px_0px_#000]"
              />
            </div>
          </div>
        </div>

        {/* Date Guarding Banner (for Admins on Today or Past Dates) */}
        {!editPerm.canEdit && (
          <div className="rounded-2xl border-2 border-black bg-amber-50 p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
            <div className="h-9 w-9 rounded-xl bg-amber-100 border-2 border-black flex items-center justify-center shrink-0 text-black">
              <Lock className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-headline font-black text-sm uppercase tracking-wide text-black">
                  Read-Only Mode: {editPerm.isToday ? "Today's Live Game" : "Past Archive Game"}
                </h3>
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase font-mono border-black bg-white"
                >
                  Locked for Admins
                </Badge>
              </div>
              <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                {editPerm.reason ||
                  "Admins can only curate upcoming future puzzles. Only Game Masters can edit today's live game or past archives."}{" "}
                Select tomorrow or a future date to edit or schedule puzzles.
              </p>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full h-auto min-h-11 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 rounded-2xl border-2 border-black bg-gray-100 p-2.5 shadow-[3px_3px_0px_#000]">
            <TabsTrigger value="connect-5">
              🔗 Connect 5 Creator
            </TabsTrigger>
            <TabsTrigger value="21-things">
              ✨ 21 Things Creator
            </TabsTrigger>
            <TabsTrigger value="17-syllables">
              🎋 17 Syllables Creator
            </TabsTrigger>
            <TabsTrigger value="9-rhymes">
              💬 9 Rhymes Creator
            </TabsTrigger>
            <TabsTrigger value="eightfold-echo">
              🔷 Eightfold Echo
            </TabsTrigger>
            <TabsTrigger value="6-pics">
              🖼️ 6 Pics Creator
            </TabsTrigger>
            <TabsTrigger value="four-score">
              🧮 Four Score
            </TabsTrigger>
            <TabsTrigger value="move-2">
              🎲 Move Two
            </TabsTrigger>
            <TabsTrigger value="1-win">
              🏆 1 Win
            </TabsTrigger>
            <TabsTrigger value="bank">
              📚 66-Day Bank ({CONNECT_5_PUZZLES.length})
            </TabsTrigger>
            {isGM && (
              <TabsTrigger value="users">
                👥 User Management
              </TabsTrigger>
            )}
          </TabsList>

          {/* ================================================================
           * TAB 1: CONNECT 5 PUZZLE CREATOR
           * ================================================================ */}
          <TabsContent value="connect-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: 5 Words & Metadata */}
              <div className="lg:col-span-6 rounded-2xl border-2 border-black bg-white p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Badge variant="green" className="mb-1">
                      Connect 5 Builder
                    </Badge>
                    <h3 className="font-headline font-black text-xl">
                      1. Enter 5 Connected Words
                    </h3>
                    <p className="text-xs text-gray-600">
                      Each word connects with the word above it (e.g., MOUSE → PAD
                      → LOCK → DOWN → WIND). Variable lengths supported!
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClearConnect5}
                      data-testid="admin-connect-5-clear-all"
                      className="border-2 border-black font-bold text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Clear All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRevertConnect5Default}
                      data-testid="admin-connect-5-revert-default"
                      className="border-2 border-black font-bold text-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Revert to Default
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                      Chain Title
                    </label>
                    <Input
                      disabled={!editPerm.canEdit}
                      value={c5Title}
                      onChange={(e) => setC5Title(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                      Author
                    </label>
                    <Input
                      disabled={!editPerm.canEdit}
                      value={c5Author}
                      onChange={(e) => setC5Author(e.target.value)}
                      placeholder="e.g. Puzzle Master"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                      Editor
                    </label>
                    <Input
                      disabled={!editPerm.canEdit}
                      value={c5Editor}
                      onChange={(e) => setC5Editor(e.target.value)}
                      placeholder="e.g. Daily Editor"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  {c5Words.map((w, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-9 w-9 rounded-lg font-headline font-black text-sm flex items-center justify-center border-2 shrink-0",
                          idx === 0
                            ? "bg-[#2ECC71] border-black text-black"
                            : "bg-gray-100 border-gray-300 text-black"
                        )}
                      >
                        {idx + 1}
                      </span>
                      <Input
                        disabled={!editPerm.canEdit}
                        value={w}
                        onChange={(e) => handleC5WordChange(idx, e.target.value)}
                        placeholder={`Row ${idx + 1} Word`}
                        className="font-mono font-bold uppercase tracking-wider"
                      />
                      <span className="text-xs font-mono text-gray-500 w-16 text-right">
                        {w.length} chars
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="block text-xs font-bold uppercase text-gray-600">
                    Compound Word Explanations (Shown on Win Modal)
                  </label>
                  {c5Connections.map((conn, idx) => (
                    <Input
                      key={idx}
                      disabled={!editPerm.canEdit}
                      value={conn}
                      onChange={(e) => {
                        const next = [...c5Connections] as [
                          string,
                          string,
                          string,
                          string
                        ];
                        next[idx] = e.target.value;
                        setC5Connections(next);
                      }}
                      placeholder={`Connection ${idx + 1} -> ${idx + 2}`}
                      className="text-xs"
                    />
                  ))}
                </div>
              </div>

              {/* Right Column: Interactive Pre-Revealed Hint Letter Selector */}
              <div className="lg:col-span-6 rounded-2xl border-2 border-black bg-white p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="yellow" className="mb-1">
                        <Lightbulb className="h-3 w-3 mr-1" />
                        Interactive Hint Picker
                      </Badge>
                      <h3 className="font-headline font-black text-xl">
                        2. Click Letters to Pre-Reveal (0–3+ Hints)
                      </h3>
                      <p className="text-xs text-gray-600">
                        Row 1 is always shown. Click any letter box in{" "}
                        <strong>Rows 2–5</strong> below to toggle whether that
                        letter is pre-shown to players at the start of the game!
                      </p>
                    </div>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={!editPerm.canEdit}
                      onClick={() => setC5Hints([])}
                      className="font-bold border border-black shrink-0 disabled:opacity-50"
                    >
                      Clear Hints (0)
                    </Button>
                  </div>

                  {/* Interactive 5-Row Preview Grid */}
                  <div className="rounded-2xl border-2 border-black/15 bg-gray-50 p-4 space-y-2.5">
                    {c5Words.map((word, rowIdx) => {
                      const isRow0 = rowIdx === 0;
                      return (
                        <div key={rowIdx} className="flex items-center gap-2">
                          <span className="h-8 w-8 rounded-lg bg-white border border-gray-300 font-headline font-black text-xs flex items-center justify-center shrink-0">
                            {rowIdx + 1}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {word.split("").map((ch, colIdx) => {
                              const isHinted =
                                isRow0 ||
                                c5Hints.some(
                                  (h) => h.row === rowIdx && h.col === colIdx
                                );
                              return (
                                <button
                                  key={colIdx}
                                  type="button"
                                  disabled={isRow0 || !editPerm.canEdit}
                                  onClick={() =>
                                    toggleC5HintLetter(rowIdx, colIdx)
                                  }
                                  className={cn(
                                    "h-11 w-10 rounded-xl border-2 font-headline font-black text-lg flex flex-col items-center justify-center transition-all",
                                    isRow0
                                      ? "bg-[#2ECC71] text-black border-black cursor-default"
                                      : isHinted
                                      ? "bg-[#F9D423] text-black border-black ring-2 ring-black scale-105 shadow-xs"
                                      : "bg-white text-gray-400 border-gray-300 hover:border-black hover:text-black",
                                    !editPerm.canEdit && !isRow0 && "cursor-not-allowed opacity-75"
                                  )}
                                  title={
                                    isRow0
                                      ? "Row 1 is always shown"
                                      : !editPerm.canEdit
                                      ? "Editing locked for Admins"
                                      : isHinted
                                      ? "Pre-revealed to player (Click to hide)"
                                      : "Hidden from player (Click to pre-reveal as hint)"
                                  }
                                >
                                  <span>{ch}</span>
                                  {!isRow0 && (
                                    <span className="text-[8px] font-mono uppercase">
                                      {isHinted ? "SHOWN" : "HIDE"}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950">
                    <strong>Active Pre-Revealed Letters ({c5Hints.length}):</strong>{" "}
                    {c5Hints.length === 0
                      ? "None (Hard mode — only Row 1 shown)"
                      : c5Hints
                          .map(
                            (h) =>
                              `Row ${h.row + 1} Col ${h.col + 1} ('${
                                c5Words[h.row]?.[h.col] ?? ""
                              }')`
                          )
                          .join(", ")}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyConnect5Json}
                    className="border-2 border-black font-bold text-xs"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy JSON
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      disabled={!editPerm.canEdit}
                      variant="outline"
                      onClick={() => handleSaveConnect5(false)}
                      className="border-2 border-black font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {!editPerm.canEdit ? (
                        <Lock className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Save for {targetDate}
                    </Button>
                    <Button
                      type="button"
                      disabled={!editPerm.canEdit}
                      onClick={() => handleSaveConnect5(true)}
                      className="bg-black text-white hover:bg-gray-800 font-headline font-black text-xs px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {!editPerm.canEdit ? (
                        <Lock className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                      ) : (
                        <Play className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Save &amp; Test Play Now
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ================================================================
           * TAB 2: 21 THINGS CREATOR
           * ================================================================ */}
          <TabsContent value="21-things">
            <div className="rounded-2xl border-2 border-black bg-white p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <Badge variant="purple" className="mb-1">
                    21 Things Daily Studio
                  </Badge>
                  <h3 className="font-headline font-black text-xl">
                    Create or Override a Daily 21 Things Board
                  </h3>
                  <p className="text-xs text-gray-600">
                    Paste a stream of consciousness to auto-split into 21 items
                    (max 5 words / ~30 chars per tile) or edit any tile below.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClear21Things}
                    data-testid="admin-21-things-clear-all"
                    className="border-2 border-black font-bold text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Clear All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRevert21ThingsDefault}
                    data-testid="admin-21-things-revert-default"
                    className="border-2 border-black font-bold text-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Revert to Default
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                    Board Theme Title
                  </label>
                  <Input
                    disabled={!editPerm.canEdit}
                    value={t21Title}
                    onChange={(e) => setT21Title(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                    Creator Name
                  </label>
                  <Input
                    disabled={!editPerm.canEdit}
                    value={t21Creator}
                    onChange={(e) => setT21Creator(e.target.value)}
                    placeholder="e.g. Daily Curator"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                    Creator Subtitle / Bio
                  </label>
                  <Input
                    disabled={!editPerm.canEdit}
                    value={t21Bio}
                    onChange={(e) => setT21Bio(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold uppercase text-gray-600">
                    Quick Stream-of-Consciousness Parser
                  </label>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    disabled={!editPerm.canEdit}
                    onClick={handleParse21Stream}
                    className="font-bold border border-black disabled:opacity-50"
                  >
                    <Wand2 className="h-3 w-3 mr-1" />
                    Auto-Split into 21 Tiles
                  </Button>
                </div>
                <Textarea
                  disabled={!editPerm.canEdit}
                  value={t21Stream}
                  onChange={(e) => setT21Stream(e.target.value)}
                  placeholder="Paste comma-separated items to auto-format into the 21 tiles below..."
                  className="min-h-[68px]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {t21Items.slice(0, 21).map((item, idx) => {
                  const words = item.trim().split(/\s+/).filter(Boolean).length;
                  const isOverLimit = words > 5 || item.length > 30;
                  const suggestion = isOverLimit
                    ? enforceTileConstraints(item).text
                    : null;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-xl border p-2",
                        isOverLimit
                          ? "border-red-500 bg-red-50"
                          : "border-black/20 bg-[#f6edf5]"
                      )}
                    >
                      <div className="flex justify-between text-[10px] font-mono text-gray-500 mb-1">
                        <span className="font-bold text-black">#{idx + 1}</span>
                        <span className={cn(isOverLimit && "text-red-600 font-bold")}>
                          {words}/5w · {item.length}/30c
                        </span>
                      </div>
                      <input
                        type="text"
                        disabled={!editPerm.canEdit}
                        value={item}
                        onChange={(e) => {
                          const next = [...t21Items];
                          next[idx] = e.target.value;
                          setT21Items(next);
                        }}
                        onBlur={() => {
                          const { text } = enforceTileConstraints(
                            t21Items[idx] || ""
                          );
                          if (text) {
                            const next = [...t21Items];
                            next[idx] = text;
                            setT21Items(next);
                          }
                        }}
                        className="w-full rounded bg-white border border-black/15 px-2 py-1 text-xs font-bold disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                      {isOverLimit && suggestion && editPerm.canEdit && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const next = [...t21Items];
                            next[idx] = suggestion;
                            setT21Items(next);
                          }}
                          className="mt-1 w-full text-left text-[10px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded px-1.5 py-0.5 truncate transition-colors"
                          title={`Apply automated edit: "${suggestion}"`}
                        >
                          ✨ Suggest: &ldquo;{suggestion}&rdquo;
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <Button
                  type="button"
                  disabled={!editPerm.canEdit}
                  variant="outline"
                  onClick={() => handleSave21Board(false)}
                  className="border-2 border-black font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!editPerm.canEdit ? (
                    <Lock className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                  ) : (
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Save for {targetDate}
                </Button>
                <Button
                  type="button"
                  disabled={!editPerm.canEdit}
                  onClick={() => handleSave21Board(true)}
                  className="bg-black text-white hover:bg-gray-800 font-headline font-black text-xs px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!editPerm.canEdit ? (
                    <Lock className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                  ) : (
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Save &amp; Test Play Board
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ================================================================
           * TAB 2.5: 17 SYLLABLES HAIKU CREATOR
           * ================================================================ */}
          <TabsContent value="17-syllables">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: 3 Haiku Lines & Metadata */}
              <div className="lg:col-span-6 rounded-2xl border-2 border-black bg-white p-5 space-y-4 shadow-[4px_4px_0px_#000]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Badge variant="green" className="mb-1">
                      🎋 17 Syllables Haiku Builder
                    </Badge>
                    <h3 className="font-headline font-black text-xl">
                      1. Compose 5-7-5 Daily Haiku
                    </h3>
                    <p className="text-xs text-gray-600">
                      Write 3 poetic lines adhering strictly to the 5-7-5 syllable structure. The game automatically slices your haiku into uppercase chunks for player reconstruction.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClear17Syllables}
                      data-testid="admin-17-syllables-clear-all"
                      className="border-2 border-black font-bold text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Clear All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRevert17SyllablesDefault}
                      data-testid="admin-17-syllables-revert-default"
                      className="border-2 border-black font-bold text-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Revert to Default
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                      Haiku Theme / Title
                    </label>
                    <Input
                      disabled={!editPerm.canEdit}
                      value={s17Theme}
                      onChange={(e) => setS17Theme(e.target.value)}
                      placeholder="e.g. Golden Autumn"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                      Poet / Author
                    </label>
                    <Input
                      disabled={!editPerm.canEdit}
                      value={s17Author}
                      onChange={(e) => setS17Author(e.target.value)}
                      placeholder="SOL Theory"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  {/* Line 1 (5 syllables) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold uppercase text-gray-700">
                        Line 1 (5 Syllables)
                      </label>
                      <Badge
                        variant={countLineSyllables(s17Line1) === 5 ? "green" : "destructive"}
                        className="font-mono text-[10px]"
                      >
                        {countLineSyllables(s17Line1)} / 5 syllables
                      </Badge>
                    </div>
                    <Input
                      disabled={!editPerm.canEdit}
                      value={s17Line1}
                      onChange={(e) => {
                        setS17Line1(e.target.value);
                        setS17CustomWordChunks((prev) =>
                          Object.fromEntries(
                            Object.entries(prev).filter(([k]) => !k.startsWith("0-"))
                          )
                        );
                      }}
                      placeholder="Gold leaves drift along"
                      className="font-serif text-sm"
                    />
                  </div>

                  {/* Line 2 (7 syllables) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold uppercase text-gray-700">
                        Line 2 (7 Syllables)
                      </label>
                      <Badge
                        variant={countLineSyllables(s17Line2) === 7 ? "green" : "destructive"}
                        className="font-mono text-[10px]"
                      >
                        {countLineSyllables(s17Line2)} / 7 syllables
                      </Badge>
                    </div>
                    <Input
                      disabled={!editPerm.canEdit}
                      value={s17Line2}
                      onChange={(e) => {
                        setS17Line2(e.target.value);
                        setS17CustomWordChunks((prev) =>
                          Object.fromEntries(
                            Object.entries(prev).filter(([k]) => !k.startsWith("1-"))
                          )
                        );
                      }}
                      placeholder="Cool winds whisper in the dusk"
                      className="font-serif text-sm"
                    />
                  </div>

                  {/* Line 3 (5 syllables) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold uppercase text-gray-700">
                        Line 3 (5 Syllables)
                      </label>
                      <Badge
                        variant={countLineSyllables(s17Line3) === 5 ? "green" : "destructive"}
                        className="font-mono text-[10px]"
                      >
                        {countLineSyllables(s17Line3)} / 5 syllables
                      </Badge>
                    </div>
                    <Input
                      disabled={!editPerm.canEdit}
                      value={s17Line3}
                      onChange={(e) => {
                        setS17Line3(e.target.value);
                        setS17CustomWordChunks((prev) =>
                          Object.fromEntries(
                            Object.entries(prev).filter(([k]) => !k.startsWith("2-"))
                          )
                        );
                      }}
                      placeholder="Soft earth waits for dawn"
                      className="font-serif text-sm"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs space-y-1">
                    <span className="font-bold uppercase text-gray-600 text-[10px]">Structure Validation</span>
                    {validateHaikuStructure([s17Line1, s17Line2, s17Line3]).isValid ? (
                      <p className="text-emerald-700 font-bold flex items-center gap-1.5">
                        <Check className="h-4 w-4 stroke-[3]" /> Perfect 5-7-5 Haiku (17 Total Syllables)
                      </p>
                    ) : (
                      <div className="text-red-700 font-semibold space-y-0.5">
                        {validateHaikuStructure([s17Line1, s17Line2, s17Line3]).errors.map((err, i) => (
                          <p key={i} className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" /> {err}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Sliced Chunks Tray Preview & Publishing */}
              <div className="lg:col-span-6 rounded-2xl border-2 border-black bg-white p-5 space-y-4 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <Badge variant="yellow" className="mb-1">
                      Interactive Live Preview
                    </Badge>
                    <h3 className="font-headline font-black text-xl">
                      2. Interactive Slice Cutter &amp; Tray Preview
                    </h3>
                    <p className="text-xs text-gray-600">
                      Click between letters to customize chunk boundaries or preview shuffled tile orders:
                    </p>
                  </div>

                  {/* Interactive Click-Between-Letters Haiku Slice Cutter */}
                  <HaikuSliceCutter
                    lines={[s17Line1, s17Line2, s17Line3]}
                    customWordChunks={s17CustomWordChunks}
                    onChangeCustomWordChunks={setS17CustomWordChunks}
                    disabled={!editPerm.canEdit}
                  />

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs space-y-1">
                    <span className="font-bold uppercase text-gray-600 text-[10px]">Haiku Preview</span>
                    <p className="italic text-gray-800 font-serif text-sm leading-relaxed whitespace-pre-line">
                      &quot;{s17Line1 || "..."}&quot;{"\n"}
                      &quot;{s17Line2 || "..."}&quot;{"\n"}
                      &quot;{s17Line3 || "..."}&quot;
                    </p>
                    <p className="text-[11px] text-gray-500 font-medium pt-1">
                      — {s17Author || "SOL Theory"} ({s17Theme || "Untitled"})
                    </p>
                  </div>
                </div>

                {/* Save and Publish Controls */}
                <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const hasCustom = Object.keys(s17CustomWordChunks).length > 0;
                        const chunks = hasCustom
                          ? buildStructuredHaikuLines([s17Line1, s17Line2, s17Line3], s17CustomWordChunks).flatMap((l) =>
                              l.words.flatMap((w) => w.chunks)
                            )
                          : sliceHaikuIntoChunks([s17Line1, s17Line2, s17Line3], 16);
                        const copyPayload = {
                          theme: s17Theme,
                          author: s17Author,
                          lines: [s17Line1, s17Line2, s17Line3],
                          chunks,
                          ...(hasCustom ? { customWordChunks: s17CustomWordChunks } : {}),
                        };
                        void navigator.clipboard.writeText(JSON.stringify(copyPayload, null, 2));
                        toast({
                          title: "17 Syllables JSON Copied!",
                          description: "Payload copied to clipboard.",
                        });
                      }}
                      className="border-2 border-black text-xs font-bold"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copy JSON
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!editPerm.canEdit}
                      onClick={() => void handleSave17Syllables(false)}
                      className="border-2 border-black font-headline font-black text-xs px-4 hover:bg-gray-100"
                    >
                      {!editPerm.canEdit ? (
                        <Lock className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Save for {targetDate}
                    </Button>

                    <Button
                      type="button"
                      disabled={!editPerm.canEdit}
                      onClick={() => void handleSave17Syllables(true)}
                      className="bg-black text-white hover:bg-gray-800 font-headline font-black text-xs px-4 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-black shadow-[2px_2px_0px_#000]"
                    >
                      {!editPerm.canEdit ? (
                        <Lock className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                      ) : (
                        <Play className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Save &amp; Test Play Haiku
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ================================================================
           * TAB 3: PRE-SEEDED 66-DAY PUZZLE BANK
           * ================================================================ */}
          <TabsContent value="9-rhymes">
            <NineRhymesStudioTab
              targetDate={targetDate}
              canEdit={editPerm.canEdit}
              editReason={editPerm.reason}
              onPublish={requestGenericPublish}
            />
          </TabsContent>

          <TabsContent value="eightfold-echo">
            <EightfoldEchoStudioTab
              targetDate={targetDate}
              canEdit={editPerm.canEdit}
              editReason={editPerm.reason}
              onPublish={requestGenericPublish}
            />
          </TabsContent>

          <TabsContent value="6-pics">
            <SixPicsStudioTab
              targetDate={targetDate}
              canEdit={editPerm.canEdit}
              editReason={editPerm.reason}
              onPublish={requestGenericPublish}
            />
          </TabsContent>

          <TabsContent value="four-score">
            <FourScoreStudioTab
              targetDate={targetDate}
              canEdit={editPerm.canEdit}
              editReason={editPerm.reason}
              onPublish={requestGenericPublish}
            />
          </TabsContent>

          <TabsContent value="move-2">
            <MoveTwoStudioTab
              targetDate={targetDate}
              canEdit={editPerm.canEdit}
              editReason={editPerm.reason}
              onPublish={requestGenericPublish}
            />
          </TabsContent>

          <TabsContent value="1-win">
            <OneWinStudioTab
              targetDate={targetDate}
              canEdit={editPerm.canEdit}
              editReason={editPerm.reason}
              onPublish={requestGenericPublish}
            />
          </TabsContent>

          <TabsContent value="bank">
            <div className="rounded-2xl border-2 border-black bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-headline font-black text-xl">
                    Verified 66-Day Automated Puzzle Rotation Bank
                  </h3>
                  <p className="text-xs text-gray-600">
                    Click any pre-seeded puzzle below to load it into the editor
                    above.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
                {CONNECT_5_PUZZLES.map((p, idx) => {
                  const b = TWENTY_ONE_THINGS_BOARDS[idx];
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-gray-200 p-3.5 flex items-center justify-between gap-2 bg-gray-50/60 hover:bg-white transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            Day #{p.puzzleNumber}
                          </Badge>
                          <span className="font-headline font-bold text-sm truncate">
                            {p.title}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-emerald-800 mt-1 truncate">
                          Connect 5: {p.words.join(" → ")}
                        </p>
                        {b && (
                          <p className="text-xs text-purple-900 truncate">
                            21 Things: {b.title} (by {b.creatorName})
                          </p>
                        )}
                      </div>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={!editPerm.canEdit}
                        onClick={() => {
                          setC5Title(p.title);
                          setC5Words([...p.words]);
                          setC5Connections([...p.connections]);
                          setC5Hints([...p.revealedHints]);
                          setC5Author(p.author);
                          setC5Editor(p.editor);
                          if (b) {
                            setT21Title(b.title);
                            setT21Creator(b.creatorName);
                            setT21Bio(b.creatorBio);
                            setT21Items([...b.items]);
                          }
                          setActiveTab("connect-5");
                          toast({
                            title: `Loaded Day #${p.puzzleNumber} into Studio`,
                            description:
                              "Switched to Connect 5 Creator tab (21 Things tab also loaded).",
                          });
                        }}
                        className="border border-black font-bold shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!editPerm.canEdit ? "Editing locked for Admins" : "Load into Studio"}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Load
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* ================================================================
           * TAB 4: USER MANAGEMENT & ROLE ASSIGNMENTS (GAME MASTERS ONLY)
           * ================================================================ */}
          {isGM && (
            <TabsContent value="users">
              <div className="rounded-2xl border-2 border-black bg-white p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-black text-amber-300 border-2 border-black font-headline font-black text-xs uppercase">
                        Game Master Console
                      </Badge>
                      <span className="text-xs font-mono text-gray-500">
                        {userList.length} Accounts Registered
                      </span>
                    </div>
                    <h3 className="font-headline font-black text-xl mt-1">
                      User Management &amp; Role Assignments
                    </h3>
                    <p className="text-xs text-gray-600">
                      Promote players to Editors (Admins) to curate future puzzles, manage Game Master privileges, or suspend accounts. Root Game Masters have permanent immunity.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRefreshUsers()}
                      disabled={usersLoading}
                      className="border-2 border-black font-bold text-xs shrink-0"
                    >
                      <RefreshCw
                        className={cn("h-3.5 w-3.5 mr-1.5", usersLoading && "animate-spin")}
                      />
                      Refresh List
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search accounts by name, handle, or email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9 font-medium border-2 border-black text-xs"
                    />
                  </div>
                </div>

                {usersLoading && userList.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="h-6 w-6 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                      Loading user registry...
                    </p>
                  </div>
                ) : (
                  <div className="border-2 border-black rounded-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-100 border-b-2 border-black font-headline font-black uppercase tracking-wider text-[11px] text-black">
                          <th className="py-2.5 px-3">Player / Identity</th>
                          <th className="py-2.5 px-3">Email Address</th>
                          <th className="py-2.5 px-3">Role</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Member Since</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {userList
                          .filter((u) => {
                            if (!userSearch.trim()) return true;
                            const q = userSearch.toLowerCase();
                            return (
                              u.email.toLowerCase().includes(q) ||
                              u.displayName.toLowerCase().includes(q) ||
                              u.handle.toLowerCase().includes(q)
                            );
                          })
                          .map((u) => {
                            const isRootGM = isInitialGameMaster(u.email);
                            const isBusy = actionInProgressEmail === u.email;

                            return (
                              <tr
                                key={u.id || u.email}
                                className={cn(
                                  "hover:bg-gray-50/80 transition-colors",
                                  u.isBanned && "bg-red-50/40"
                                )}
                              >
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className="h-7 w-7 rounded-full border border-black flex items-center justify-center font-headline font-black text-xs shrink-0"
                                      style={{ backgroundColor: u.avatarColor || "#F9D423" }}
                                    >
                                      {(u.displayName || u.email).charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-black truncate">
                                        {u.displayName || "Anonymous Player"}
                                      </p>
                                      <p className="font-mono text-[11px] text-gray-500 truncate">
                                        {u.handle.startsWith("@") ? u.handle : `@${u.handle}`}
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-3 px-3 font-mono text-gray-700">
                                  {u.email}
                                </td>

                                <td className="py-3 px-3">
                                  {u.role === "game_master" ? (
                                    <Badge className="bg-black text-amber-300 border-2 border-black font-headline font-black text-[10px] uppercase tracking-wider">
                                      👑 Game Master
                                    </Badge>
                                  ) : u.role === "admin" ? (
                                    <Badge variant="green" className="text-[10px] uppercase font-bold">
                                      Admin (Editor)
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px] uppercase font-medium">
                                      Player
                                    </Badge>
                                  )}
                                </td>

                                <td className="py-3 px-3">
                                  {u.isBanned ? (
                                    <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                                      Suspended
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] uppercase font-semibold text-emerald-700 border-emerald-600 bg-emerald-50">
                                      Active
                                    </Badge>
                                  )}
                                </td>

                                <td className="py-3 px-3 font-mono text-gray-500 text-[11px]">
                                  {u.memberSince || "—"}
                                </td>

                                <td className="py-3 px-3 text-right">
                                  {isRootGM ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-300">
                                      <ShieldCheck className="h-3 w-3" /> Root GM · Immutable
                                    </span>
                                  ) : (
                                    <div className="inline-flex items-center gap-1.5 justify-end">
                                      {u.role === "user" && (
                                        <Button
                                          size="xs"
                                          variant="outline"
                                          disabled={isBusy || u.isBanned}
                                          onClick={() => void handleUpdateRole(u, "admin")}
                                          className="border border-black font-bold text-[11px] hover:bg-emerald-50 hover:text-emerald-900"
                                          title="Promote user to Admin (Editor) to curate future puzzles"
                                        >
                                          Promote to Admin
                                        </Button>
                                      )}

                                      {u.role === "admin" && (
                                        <Button
                                          size="xs"
                                          variant="outline"
                                          disabled={isBusy}
                                          onClick={() => void handleUpdateRole(u, "user")}
                                          className="border border-black font-bold text-[11px]"
                                          title="Demote Editor to standard Player"
                                        >
                                          Demote to User
                                        </Button>
                                      )}

                                      {u.role === "game_master" && !isRootGM && (
                                        <Button
                                          size="xs"
                                          variant="outline"
                                          disabled={isBusy}
                                          onClick={() => void handleUpdateRole(u, "admin")}
                                          className="border border-black font-bold text-[11px]"
                                          title="Demote Game Master to Admin"
                                        >
                                          Demote to Admin
                                        </Button>
                                      )}

                                      <Button
                                        size="xs"
                                        variant="outline"
                                        disabled={isBusy}
                                        onClick={() => void handleToggleBan(u)}
                                        className={cn(
                                          "border font-bold text-[11px]",
                                          u.isBanned
                                            ? "border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                                            : "border-red-500 text-red-600 hover:bg-red-50"
                                        )}
                                        title={
                                          u.isBanned
                                            ? "Reactivate suspended account"
                                            : "Suspend player account"
                                        }
                                      >
                                        {u.isBanned ? "Unban" : "Ban"}
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        {userList.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-gray-500 font-mono text-xs">
                              No registered users found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Confirmation Modal Popup before publishing puzzle modifications */}
      <Dialog
        open={Boolean(pendingPublish?.isOpen)}
        onOpenChange={(open) => {
          if (!open && !isPublishing) {
            setPendingPublish(null);
          }
        }}
      >
        <DialogContent className="max-w-lg border-2 border-black rounded-2xl bg-white p-6 shadow-2xl">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="font-headline font-black text-2xl flex items-center gap-2">
              Confirm &amp; Publish {pendingPublish?.gameTitle}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-600">
              Review puzzle details and destination date before publishing to the live platform.
            </DialogDescription>
          </DialogHeader>

          {pendingPublish && (
            <div className="space-y-4 py-2">
              {/* Prominent High-Visibility Warning for Today's Active Live Game */}
              {pendingPublish.isToday ? (
                <div className="rounded-xl border-2 border-red-500 bg-red-50 p-4 text-red-950 space-y-1">
                  <div className="font-headline font-black text-sm flex items-center gap-2 text-red-900">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                    <span>Modifying Today&apos;s Active Live Game</span>
                  </div>
                  <p className="text-xs leading-relaxed font-semibold">
                    ⚠️ You are modifying today&apos;s live puzzle. This will immediately update the live game for all active players.
                  </p>
                </div>
              ) : (
                <div
                  className={cn(
                    "rounded-xl border p-3 text-xs",
                    pendingPublish.dateStatus === "Future"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                      : "border-amber-300 bg-amber-50 text-amber-950"
                  )}
                >
                  <strong>Target Date:</strong> {pendingPublish.targetDate} ({pendingPublish.dateStatus} Game)
                </div>
              )}

              {/* Puzzle Details */}
              <div className="rounded-xl border-2 border-black/10 bg-gray-50 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <span className="font-bold text-gray-600 uppercase text-[10px]">Game:</span>
                  <span className="font-black text-black">{pendingPublish.gameTitle}</span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <span className="font-bold text-gray-600 uppercase text-[10px]">Target Date:</span>
                  <span className="font-mono font-bold text-black">{pendingPublish.targetDate}</span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <span className="font-bold text-gray-600 uppercase text-[10px]">Date Status:</span>
                  <Badge
                    variant={
                      pendingPublish.isToday
                        ? "destructive"
                        : pendingPublish.dateStatus === "Future"
                        ? "green"
                        : "outline"
                    }
                    className="text-[10px]"
                  >
                    {pendingPublish.dateStatus}
                  </Badge>
                </div>
                <div className="space-y-1 pt-1">
                  <span className="font-bold text-gray-600 uppercase text-[10px]">Puzzle Summary:</span>
                  <p className="font-bold text-black text-xs">{pendingPublish.summary.title}</p>
                  <p className="text-gray-600 text-xs font-mono">{pendingPublish.summary.preview}</p>
                </div>
              </div>

              {/* Persistence Indicators */}
              <div className="flex items-center gap-3 text-[11px] text-gray-600 px-1">
                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <Check className="h-3.5 w-3.5" /> Supabase Cloud DB
                </span>
                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <Check className="h-3.5 w-3.5" /> Browser Local Cache
                </span>
                {pendingPublish.playImmediately && (
                  <span className="flex items-center gap-1 text-blue-700 font-semibold">
                    <Play className="h-3 w-3" /> Test Play Immediately
                  </span>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              disabled={isPublishing}
              onClick={() => setPendingPublish(null)}
              className="font-bold border-2 border-black text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPublishing}
              onClick={() => void pendingPublish?.onConfirm()}
              className="bg-black text-white hover:bg-gray-800 font-headline font-black text-xs px-4 border-2 border-black"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Publishing...
                </>
              ) : (
                "Confirm & Publish"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diagnostic Error Modal Popup when save/sync fails */}
      <DiagnosticErrorModal
        open={isDiagnosticOpen}
        onOpenChange={(open) => {
          setIsDiagnosticOpen(open);
          if (!open) {
            setDiagnosticReport(null);
            setRetrySyncFn(null);
          }
        }}
        report={diagnosticReport}
        onRetry={retrySyncFn ? () => retrySyncFn() : undefined}
        isRetrying={isRetryingSync}
      />
    </div>
  );
}
