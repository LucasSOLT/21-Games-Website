"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Link2, Lock, Share2, Sparkles } from "lucide-react";
import type { Connect5HintCoord, Connect5Puzzle } from "@/data/puzzles/connect-5";
import { getLocalDateKey } from "@/lib/daily-engine";
import { validateConnect5Payload } from "@/lib/seeded-random";
import { saveCustomPuzzle } from "@/lib/custom-puzzles";
import {
  copyToClipboard,
  formatCustomGameBlurb,
  generateCustomGameId,
  nativeShareResultsOnly,
} from "@/lib/custom-game-share";
import { GameShell } from "@/components/game-shell";
import { useAuth } from "@/components/account/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Authenticated Creator Mode (`?mode=create`) for Connect 5:
 * Lets players author a custom 5-row compound word chain, toggle optional
 * starter hint letters on rows 2–5, and publish a `<75`-char `?b=c5-xxxxxxxx`
 * friend link backed by `public.custom_puzzles` + local fallback with Tier 2
 * `private_custom` moderation.
 */
export function ConnectFiveCreator() {
  const { profile, isAuthenticated, openAccountModal } = useAuth();
  const [title, setTitle] = useState("Sun to Storm");
  const [words, setWords] = useState<[string, string, string, string, string]>([
    "SUN",
    "FLOWER",
    "POT",
    "HOLE",
    "INONE",
  ]);
  const [connections, setConnections] = useState<[string, string, string, string]>([
    "SUNFLOWER — tall yellow summer bloom",
    "FLOWERPOT — container for growing plants",
    "POTHOLE — bump in the road surface",
    "HOLE IN ONE — ace shot in golf",
  ]);
  const [hints, setHints] = useState<Connect5HintCoord[]>([
    { row: 1, col: 0 },
    { row: 3, col: 0 },
  ]);
  const [errors, setErrors] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [created, setCreated] = useState<{
    id: string;
    url: string;
    blurbWithUrl: string;
    blurbText: string;
    title: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const shellProps = {
    gameSlug: "connect-5" as const,
    gameTitle: "Connect 5",
    puzzleNumber: 0,
    dateKey: getLocalDateKey(),
    author: profile?.displayName ?? "You",
  };

  if (!isAuthenticated || !profile) {
    return (
      <GameShell {...shellProps} subtitle="Create & Share">
        <div className="max-w-md mx-auto text-center space-y-4 py-16">
          <Sparkles className="h-8 w-8 mx-auto text-emerald-600" />
          <h2 className="font-headline font-black text-2xl">Sign in to create</h2>
          <p className="text-sm text-neutral-600">
            Creating a custom Connect 5 chain requires an account so friends can see who made it.
          </p>
          <Button
            onClick={() => openAccountModal("signin")}
            className="font-bold border-2 border-black"
          >
            Sign in
          </Button>
        </div>
      </GameShell>
    );
  }

  if (profile.isBanned) {
    return (
      <GameShell {...shellProps} subtitle="Create & Share">
        <div className="max-w-md mx-auto text-center space-y-3 py-16">
          <Lock className="h-8 w-8 mx-auto text-red-600" />
          <p className="text-sm font-semibold">
            Your account has been suspended from publishing custom puzzles.
          </p>
        </div>
      </GameShell>
    );
  }

  const updateWord = (rowIdx: number, raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 12);
    const next = [...words] as [string, string, string, string, string];
    next[rowIdx] = clean;
    setWords(next);
    setHints((prev) => prev.filter((h) => h.row !== rowIdx || h.col < clean.length));
  };

  const toggleHint = (row: number, col: number) => {
    if (row < 1 || row > 4) return;
    setHints((prev) => {
      const exists = prev.some((h) => h.row === row && h.col === col);
      return exists
        ? prev.filter((h) => !(h.row === row && h.col === col))
        : [...prev, { row, col }];
    });
  };

  const handlePublish = async () => {
    setErrors([]);
    setPublishing(true);
    try {
      const id = generateCustomGameId("connect-5");
      const candidate: Connect5Puzzle = {
        id,
        puzzleNumber: 0,
        title: title.trim() || `${profile.displayName}'s Chain`,
        author: profile.displayName,
        editor: `@${profile.handle.replace(/^@+/, "")}`,
        words: words.map((w) => w.trim().toUpperCase()) as [
          string,
          string,
          string,
          string,
          string,
        ],
        connections: connections.map((c) => c.trim()) as [
          string,
          string,
          string,
          string,
        ],
        revealedHints: hints.filter(
          (h) => h.row >= 1 && h.row <= 4 && h.col >= 0 && h.col < (words[h.row]?.length ?? 0)
        ),
      };

      const check = validateConnect5Payload(candidate);
      if (!check.valid) {
        setErrors(check.errors);
        return;
      }

      const saved = await saveCustomPuzzle({
        id,
        gameSlug: "connect-5",
        title: candidate.title,
        creatorId: profile.id,
        creatorName: profile.displayName,
        creatorHandle: profile.handle,
        payload: candidate as unknown as Record<string, unknown>,
      });

      if (!saved.ok) {
        setErrors([saved.error]);
        return;
      }

      const blurb = formatCustomGameBlurb({
        title: candidate.title,
        creatorHandle: profile.handle,
        creatorName: profile.displayName,
        shareUrl: saved.shareUrl,
        gameName: "Connect 5",
      });

      setCreated({
        id,
        url: saved.shareUrl,
        blurbWithUrl: blurb.blurbWithUrl,
        blurbText: blurb.blurbText,
        title: candidate.title,
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <GameShell {...shellProps} subtitle="Create & Share">
      <div className="max-w-2xl mx-auto space-y-5 py-2" data-testid="c5-creator">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-headline font-black text-2xl">
              Create your own Connect 5
            </h2>
            <p className="text-sm text-neutral-600">
              Build a 5-word compound chain. Row 1 is revealed in full; click any letter on Rows 2–5 to reveal it as a starter hint.
            </p>
          </div>
          <Link
            href="/games/connect-5"
            className="text-xs font-bold underline shrink-0"
          >
            Back to Daily
          </Link>
        </div>

        {created ? (
          <div
            className="rounded-2xl border-2 border-black bg-emerald-50 p-5 space-y-3"
            data-testid="c5-created"
          >
            <p className="font-headline font-black text-lg">
              Your Connect 5 chain is live! 🔗
            </p>
            <p className="text-sm break-all font-mono">{created.url}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="bg-black text-white border-2 border-black font-bold"
                onClick={() =>
                  void nativeShareResultsOnly({
                    title: `${created.title} — Connect 5`,
                    text: created.blurbText,
                    url: created.url,
                  })
                }
              >
                <Share2 className="h-4 w-4 mr-1.5" /> Share
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-2 border-black font-bold bg-white"
                onClick={async () => {
                  const ok = await copyToClipboard(created.blurbWithUrl);
                  if (ok) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1.5" /> Copied!
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4 mr-1.5" /> Copy link
                  </>
                )}
              </Button>
            </div>
            <Link
              className="inline-block text-xs font-bold underline"
              href={`/games/connect-5?b=${created.id}`}
            >
              Play your custom chain →
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-black bg-white p-4 sm:p-5 space-y-4 shadow-[0_4px_0_#111]">
            <div>
              <label className="block text-xs font-bold uppercase text-neutral-600 mb-1">
                Chain Title
              </label>
              <Input
                value={title}
                maxLength={60}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sun to Storm"
              />
            </div>

            <div className="space-y-3">
              {words.map((word, rIdx) => (
                <div
                  key={rIdx}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase text-neutral-700">
                      Row {rIdx + 1} {rIdx === 0 ? "(Starter — Revealed)" : "(Guess Row)"}
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500">
                      {word.length} letters
                    </span>
                  </div>
                  <Input
                    value={word}
                    onChange={(e) => updateWord(rIdx, e.target.value)}
                    placeholder={`WORD${rIdx + 1}`}
                    className="font-mono font-bold uppercase"
                  />
                  {rIdx >= 1 && word.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-neutral-500 mr-1">
                        Starter hints:
                      </span>
                      {word.split("").map((ch, cIdx) => {
                        const isHint = hints.some(
                          (h) => h.row === rIdx && h.col === cIdx
                        );
                        return (
                          <button
                            key={cIdx}
                            type="button"
                            onClick={() => toggleHint(rIdx, cIdx)}
                            className={cn(
                              "h-7 w-7 rounded border-2 font-mono font-black text-xs transition-colors",
                              isHint
                                ? "border-black bg-emerald-300 text-black"
                                : "border-neutral-300 bg-white text-neutral-600 hover:border-black"
                            )}
                            title="Toggle starter hint letter"
                          >
                            {ch}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {rIdx < 4 && (
                    <div className="pt-1">
                      <label className="block text-[11px] font-bold text-neutral-500 mb-1">
                        Bridge {rIdx + 1}→{rIdx + 2} explanation (shown on win)
                      </label>
                      <Input
                        value={connections[rIdx]}
                        maxLength={140}
                        onChange={(e) => {
                          const next = [...connections] as [
                            string,
                            string,
                            string,
                            string,
                          ];
                          next[rIdx] = e.target.value;
                          setConnections(next);
                        }}
                        placeholder={`${words[rIdx] || "WORD1"} ${words[rIdx + 1] || "WORD2"} — definition`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {errors.length > 0 && (
              <ul className="rounded-xl border-2 border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-700 list-disc list-inside space-y-0.5">
                {errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            )}

            <Button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              className="w-full h-11 bg-black text-white border-2 border-black font-headline font-black"
              data-testid="c5-publish"
            >
              {publishing ? "Publishing…" : "Publish & get link"}
            </Button>
          </div>
        )}
        <p className="text-[11px] text-neutral-500">
          Friend puzzles allow casual language but never slurs or hate speech.
        </p>
      </div>
    </GameShell>
  );
}
