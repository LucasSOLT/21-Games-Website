"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Lock, Play, RefreshCw, Trash2, Trophy } from "lucide-react";
import {
  ONE_WIN_DEFAULT_PROMPT,
  generateOneWinPuzzle,
  isOneWinPuzzle,
  validateOneWinPuzzle,
  type OneWinPromptPuzzle,
} from "@/data/puzzles/1-win";
import { getDailyPuzzleForGame, getPuzzleNumberForDate } from "@/lib/daily-engine";
import { getAdminOverridesForGame } from "@/lib/game-storage";
import {
  deleteOneWinSubmissionAsGM,
  fetchOneWinLeaderboard,
  fetchRawOneWinSubmissionsForAdmin,
  type AdminOneWinRow,
  type OneWinLeaderboardRow,
} from "@/lib/one-win-service";
import type { GenericPublishRequest } from "@/components/admin/generic-publish";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface OneWinStudioTabProps {
  targetDate: string;
  canEdit: boolean;
  editReason?: string;
  onPublish: (req: GenericPublishRequest) => void;
}

function loadPuzzleForDate(targetDate: string): OneWinPromptPuzzle {
  const overrides = getAdminOverridesForGame("1-win");
  const resolved = getDailyPuzzleForGame<OneWinPromptPuzzle>(
    "1-win",
    targetDate,
    overrides
  );
  if (resolved && isOneWinPuzzle(resolved.puzzle)) {
    return resolved.puzzle;
  }
  return generateOneWinPuzzle(`date:${targetDate}`, {
    id: `1w-${targetDate}`,
    puzzleNumber: getPuzzleNumberForDate(targetDate),
    customDate: targetDate,
  });
}

export function OneWinStudioTab({
  targetDate,
  canEdit,
  editReason,
  onPublish,
}: OneWinStudioTabProps) {
  const initial = useMemo(() => loadPuzzleForDate(targetDate), [targetDate]);
  const [prevDate, setPrevDate] = useState<string>(targetDate);
  const [title, setTitle] = useState<string>(initial.title);
  const [prompt, setPrompt] = useState<string>(initial.prompt);
  const [subtitle, setSubtitle] = useState<string>(initial.subtitle);

  const [topRows, setTopRows] = useState<OneWinLeaderboardRow[]>([]);
  const [rawRows, setRawRows] = useState<AdminOneWinRow[]>([]);
  const [loadingLive, setLoadingLive] = useState<boolean>(false);

  if (prevDate !== targetDate) {
    setPrevDate(targetDate);
    setTitle(initial.title);
    setPrompt(initial.prompt);
    setSubtitle(initial.subtitle);
  }

  const candidatePuzzle: OneWinPromptPuzzle = useMemo(
    () => ({
      ...initial,
      id: `1w-${targetDate}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      title: title.trim() || "Daily Gratitude Check-In",
      prompt: prompt.trim() || ONE_WIN_DEFAULT_PROMPT,
      subtitle:
        subtitle.trim() ||
        "No win is too small — log yours blindly, then see where it ranks globally.",
      customDate: targetDate,
    }),
    [initial, prompt, subtitle, targetDate, title]
  );

  const validation = useMemo(
    () => validateOneWinPuzzle(candidatePuzzle),
    [candidatePuzzle]
  );

  useEffect(() => {
    let active = true;
    const loadLive = async () => {
      setLoadingLive(true);
      try {
        const [board, raw] = await Promise.all([
          fetchOneWinLeaderboard(targetDate, initial),
          fetchRawOneWinSubmissionsForAdmin(targetDate),
        ]);
        if (!active) return;
        setTopRows(board.entries.slice(0, 15));
        setRawRows(raw);
      } finally {
        if (active) setLoadingLive(false);
      }
    };
    void loadLive();
    return () => {
      active = false;
    };
  }, [initial, targetDate]);

  const handleRefreshLive = async () => {
    setLoadingLive(true);
    try {
      const [board, raw] = await Promise.all([
        fetchOneWinLeaderboard(targetDate, candidatePuzzle),
        fetchRawOneWinSubmissionsForAdmin(targetDate),
      ]);
      setTopRows(board.entries.slice(0, 15));
      setRawRows(raw);
    } finally {
      setLoadingLive(false);
    }
  };

  const handleDeleteRow = async (id: string) => {
    const res = await deleteOneWinSubmissionAsGM(id);
    if (res.ok) {
      await handleRefreshLive();
    }
  };

  const triggerPublish = (playImmediately: boolean) => {
    if (!canEdit || !validation.valid) return;
    onPublish({
      gameSlug: "1-win",
      gameTitle: "1 Win",
      payload: candidatePuzzle,
      meta: {
        puzzleNumber: candidatePuzzle.puzzleNumber,
        title: candidatePuzzle.title,
        author: candidatePuzzle.author,
        editor: candidatePuzzle.editor,
      },
      preview: candidatePuzzle.prompt,
      details: [
        `Title: ${candidatePuzzle.title}`,
        `Prompt: ${candidatePuzzle.prompt}`,
        `Subtitle: ${candidatePuzzle.subtitle}`,
      ],
      playImmediately,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Daily Prompt Editor */}
      <div className="lg:col-span-6 rounded-2xl border-2 border-black bg-white p-5 space-y-4 shadow-[4px_4px_0px_#000]">
        <div>
          <Badge className="mb-1 border border-black bg-[#e0e1d9] text-black font-black">
            Game #1 · 1 Win Studio
          </Badge>
          <h3 className="font-headline font-black text-xl">
            1. Curate Daily Gratitude Prompt ({targetDate})
          </h3>
          <p className="text-xs text-gray-600">
            Customize the blind check-in prompt and subtitle for {targetDate}. Players submit 1–4 words (≤ 35 chars) to unlock the Live Top 100 leaderboard.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
              Card Title
            </label>
            <Input
              disabled={!canEdit}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Daily Gratitude Check-In"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
              Blind Check-In Prompt
            </label>
            <Textarea
              disabled={!canEdit}
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={ONE_WIN_DEFAULT_PROMPT}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
              Subtitle
            </label>
            <Input
              disabled={!canEdit}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="No win is too small — log yours blindly, then see where it ranks globally."
            />
          </div>
        </div>

        {!canEdit && editReason && (
          <p className="text-xs font-semibold text-amber-800">{editReason}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button
            type="button"
            disabled={!canEdit}
            variant="outline"
            onClick={() => {
              setPrompt(ONE_WIN_DEFAULT_PROMPT);
              setTitle("Daily Gratitude Check-In");
            }}
            className="border-2 border-black font-bold text-xs"
          >
            Reset Default Prompt
          </Button>

          <Button
            type="button"
            disabled={!canEdit || !validation.valid}
            onClick={() => triggerPublish(false)}
            className="border-2 border-black bg-[#F9D423] text-black hover:bg-[#f0ca14] font-headline font-black text-xs shadow-[2px_2px_0px_#000]"
          >
            {!canEdit ? (
              <Lock className="h-3.5 w-3.5 mr-1.5" />
            ) : (
              <Check className="h-3.5 w-3.5 mr-1.5" />
            )}
            Save for {targetDate}
          </Button>

          <Button
            type="button"
            disabled={!canEdit || !validation.valid}
            onClick={() => triggerPublish(true)}
            className="border-2 border-black bg-black text-white hover:bg-gray-800 font-headline font-black text-xs shadow-[2px_2px_0px_#000]"
          >
            <Play className="h-3.5 w-3.5 mr-1.5" />
            Save &amp; Test Play
          </Button>
        </div>
      </div>

      {/* Right: Top 100 Preview & Live Moderation Feed */}
      <div className="lg:col-span-6 rounded-2xl border-2 border-black bg-white p-5 space-y-4 shadow-[4px_4px_0px_#000]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Badge variant="yellow" className="mb-1">
              Live Top 100 &amp; Moderation
            </Badge>
            <h3 className="font-headline font-black text-xl flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#F9D423]" />
              2. Community Wins ({targetDate})
            </h3>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleRefreshLive()}
            disabled={loadingLive}
            className="border-black text-xs font-bold"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingLive ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {topRows.map((row) => (
            <div
              key={row.normalizedKey}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs"
            >
              <span className="font-bold text-black">
                #{row.rank} · {row.displayText}
              </span>
              <span className="font-mono font-black text-gray-700">
                {row.count}
              </span>
            </div>
          ))}
        </div>

        {rawRows.length > 0 && (
          <div className="pt-2 border-t border-gray-200 space-y-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-gray-600">
              Live Supabase Submissions ({rawRows.length}) — Game Master Moderation
            </div>
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
              {rawRows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-black">{r.displayText}</span>{" "}
                    <span className="text-gray-400">({r.rawText})</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleDeleteRow(r.id)}
                    className="h-7 px-2 text-red-600 hover:bg-red-50"
                    title="Delete submission (Game Master only)"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
