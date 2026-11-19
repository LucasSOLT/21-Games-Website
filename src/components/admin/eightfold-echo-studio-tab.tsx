"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, RotateCcw, Shuffle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ECHO_DIFFICULTIES,
  ECHO_POSITION_COLORS,
  ECHO_POSITION_NAMES,
  buildEchoChainRules,
  countStartNearMissDecoys,
  describeEchoTile,
  generateEightfoldEchoPuzzle,
  getEchoStage,
  solveEightfoldEcho,
  validateEightfoldEchoPuzzle,
  type EchoDifficulty,
  type EightfoldEchoPuzzle,
} from "@/data/puzzles/eightfold-echo";
import { getDailyPuzzleForGame, getPuzzleNumberForDate } from "@/lib/daily-engine";
import { getAdminOverridesForGame } from "@/lib/game-storage";
import { EchoTileSvg } from "@/components/games/echo-tile-svg";
import type { GenericPublishRequest } from "@/components/admin/generic-publish";
import { cn } from "@/lib/utils";

interface EightfoldEchoStudioTabProps {
  targetDate: string;
  canEdit: boolean;
  editReason?: string;
  syncVersion?: number;
  defaultAuthor?: string;
  defaultEditor?: string;
  onDraftChange?: (draft: unknown) => void;
  onDirty?: () => void;
  onPublish: (req: GenericPublishRequest) => void;
}

export function EightfoldEchoStudioTab({
  targetDate,
  canEdit,
  editReason,
  syncVersion = 0,
  defaultAuthor = "SOL Theory",
  defaultEditor = "Daily Editorial",
  onDraftChange,
  onDirty,
  onPublish,
}: EightfoldEchoStudioTabProps) {
  const initialPuzzle = useMemo<EightfoldEchoPuzzle>(() => {
    void syncVersion;
    const resolved = getDailyPuzzleForGame<EightfoldEchoPuzzle>(
      "eightfold-echo",
      targetDate,
      getAdminOverridesForGame("eightfold-echo")
    );
    return (
      resolved?.puzzle ??
      generateEightfoldEchoPuzzle(`admin:${targetDate}:0`, {
        id: `8e-admin-${targetDate}`,
        puzzleNumber: getPuzzleNumberForDate(targetDate),
        customDate: targetDate,
      })
    );
  }, [targetDate, syncVersion]);

  const defaultPuzzle = useMemo<EightfoldEchoPuzzle>(() => {
    const resolved = getDailyPuzzleForGame<EightfoldEchoPuzzle>(
      "eightfold-echo",
      targetDate,
      {}
    );
    return resolved?.puzzle ?? initialPuzzle;
  }, [targetDate, initialPuzzle]);

  const [draft, setDraft] = useState<EightfoldEchoPuzzle>(initialPuzzle);
  const [author, setAuthor] = useState<string>(
    initialPuzzle.author || defaultAuthor || "SOL Theory"
  );
  const [editorName, setEditorName] = useState<string>(
    initialPuzzle.editor || defaultEditor || "Daily Editorial"
  );
  const [previewDifficulty, setPreviewDifficulty] = useState<EchoDifficulty>("easy");
  const [rerollCount, setRerollCount] = useState(0);
  const [seedInput, setSeedInput] = useState(initialPuzzle.seed ?? `date:${targetDate}`);
  const [errors, setErrors] = useState<string[]>([]);

  const [prevInitial, setPrevInitial] = useState(initialPuzzle);
  if (prevInitial !== initialPuzzle) {
    setPrevInitial(initialPuzzle);
    setDraft(initialPuzzle);
    setAuthor(initialPuzzle.author || defaultAuthor || "SOL Theory");
    setEditorName(initialPuzzle.editor || defaultEditor || "Daily Editorial");
    setSeedInput(initialPuzzle.seed ?? `date:${targetDate}`);
    setErrors([]);
  }

  const liveDraft = useMemo<EightfoldEchoPuzzle>(() => {
    const easyStage = getEchoStage(draft, "easy");
    const hardStage = getEchoStage(draft, "hard");
    return {
      ...draft,
      id: `8e-admin-${targetDate}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      title: draft.title.trim() || "Harmonic Resonance",
      author: author.trim() || defaultAuthor || "SOL Theory",
      editor: editorName.trim() || defaultEditor || "Daily Editorial",
      tiles: hardStage.tiles,
      solution: hardStage.solution,
      stages: {
        easy: easyStage,
        hard: hardStage,
      },
      customDate: targetDate,
    };
  }, [author, defaultAuthor, defaultEditor, draft, editorName, targetDate]);

  const onDraftChangeRef = useRef(onDraftChange);
  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  });
  useEffect(() => {
    onDraftChangeRef.current?.(liveDraft);
  }, [liveDraft]);

  const handleReroll = () => {
    const next = rerollCount + 1;
    setRerollCount(next);
    const nextSeed = `admin:${targetDate}:reroll-${next}`;
    setSeedInput(nextSeed);
    const nextPuzzle = generateEightfoldEchoPuzzle(nextSeed, {
      id: `8e-admin-${targetDate}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      customDate: targetDate,
    });
    setDraft(nextPuzzle);
    setErrors([]);
    onDirty?.();
  };

  const handleClearAll = () => {
    setSeedInput("");
    setAuthor("");
    setEditorName("");
    setDraft((prev) => ({
      ...prev,
      title: "",
      seed: "",
      tiles: prev.tiles.map((t) => ({ ...t, customSvgUrl: "" })),
    }));
    setErrors([]);
    onDirty?.();
  };

  const handleRevertDefault = () => {
    setDraft(defaultPuzzle);
    setAuthor(defaultPuzzle.author || defaultAuthor || "SOL Theory");
    setEditorName(defaultPuzzle.editor || defaultEditor || "Daily Editorial");
    setSeedInput(defaultPuzzle.seed ?? `date:${targetDate}`);
    setErrors([]);
    onDirty?.();
  };

  const handleApplySeed = () => {
    const cleanSeed = seedInput.trim() || `admin:${targetDate}`;
    const nextPuzzle = generateEightfoldEchoPuzzle(cleanSeed, {
      id: `8e-admin-${targetDate}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      title: draft.title,
      customDate: targetDate,
    });
    setDraft(nextPuzzle);
    setErrors([]);
    onDirty?.();
  };

  const activeStage = useMemo(
    () => getEchoStage(draft, previewDifficulty),
    [draft, previewDifficulty]
  );
  const solved = useMemo(
    () => solveEightfoldEcho(activeStage.tiles),
    [activeStage.tiles]
  );
  const nearMissCount = useMemo(
    () => countStartNearMissDecoys(activeStage),
    [activeStage]
  );
  const rules = useMemo(() => buildEchoChainRules(activeStage), [activeStage]);

  const handlePublish = (playImmediately: boolean) => {
    const easyStage = getEchoStage(draft, "easy");
    const hardStage = getEchoStage(draft, "hard");
    const candidate: EightfoldEchoPuzzle = {
      ...draft,
      id: `8e-admin-${targetDate}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      title: draft.title.trim() || "Harmonic Resonance",
      author: author.trim() || defaultAuthor || "SOL Theory",
      editor: editorName.trim() || defaultEditor || "Daily Editorial",
      tiles: hardStage.tiles,
      solution: hardStage.solution,
      stages: {
        easy: easyStage,
        hard: hardStage,
      },
      customDate: targetDate,
    };
    const check = validateEightfoldEchoPuzzle(candidate);
    if (!check.valid) {
      setErrors(check.errors);
      return;
    }
    setErrors([]);
    onPublish({
      gameSlug: "eightfold-echo",
      gameTitle: "Eightfold Echo",
      payload: candidate,
      meta: {
        puzzleNumber: candidate.puzzleNumber,
        title: candidate.title,
        author: candidate.author,
        editor: candidate.editor,
      },
      preview: `${candidate.title} — Easy (${easyStage.solution.join(" → ")}) & Hard (${hardStage.solution.join(" → ")})`,
      details: [
        `Easy verified: 0 ambiguous steps, ${countStartNearMissDecoys(easyStage)} 2-change near-miss decoys`,
        `Hard verified: ${solveEightfoldEcho(hardStage.tiles).ambiguousSteps} lookahead steps`,
        `Author: ${candidate.author} · Editor: ${candidate.editor}`,
      ],
      playImmediately,
    });
  };

  return (
    <div
      className="rounded-2xl border-2 border-black bg-white p-5 space-y-5 shadow-[4px_4px_0px_#000]"
      data-testid="admin-eightfold-echo"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge className="mb-1 bg-[#daa8d0] text-black border border-black">
            🔷 Eightfold Echo Studio
          </Badge>
          <h3 className="font-headline font-black text-xl">
            Preview &amp; Reroll Daily Easy &amp; Hard Sequences
          </h3>
          <p className="text-xs text-gray-600">
            100% auto-generated &amp; Hamiltonian-solver verified (Easy + Hard) for {targetDate}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!canEdit}
            onClick={handleReroll}
            className="border-2 border-black font-bold text-xs"
            data-testid="admin-echo-reroll"
          >
            <Shuffle className="h-4 w-4 mr-1" /> Reroll Seed
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClearAll}
            data-testid="admin-eightfold-echo-clear-all"
            className="border-2 border-black font-bold text-xs"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Clear All
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleRevertDefault}
            data-testid="admin-eightfold-echo-revert-default"
            className="border-2 border-black font-bold text-xs"
          >
            <RotateCcw className="h-4 w-4 mr-1" /> Revert to Default
          </Button>
        </div>
      </div>

      {!canEdit && editReason && (
        <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded-lg p-2">
          {editReason}
        </p>
      )}

      {/* Stage Preview Switcher */}
      <div className="inline-grid grid-cols-2 gap-1 rounded-xl border-2 border-black bg-neutral-100 p-1">
        {ECHO_DIFFICULTIES.map((diff) => (
          <button
            key={diff}
            type="button"
            onClick={() => setPreviewDifficulty(diff)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-xs font-bold transition-all cursor-pointer",
              previewDifficulty === diff
                ? "bg-black text-white"
                : "text-neutral-700 hover:bg-white"
            )}
          >
            {diff === "easy" ? "Easy Board" : "Hard Board"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Left: Live 3×3 Preview */}
        <div className="md:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>
              3×3 {previewDifficulty === "easy" ? "Easy" : "Hard"} Preview
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Unique paths: {solved.count} ·{" "}
              {previewDifficulty === "easy"
                ? `${nearMissCount} near-miss decoys`
                : `${solved.ambiguousSteps} lookahead steps`}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl border-2 border-black bg-neutral-50 max-w-xs">
            {activeStage.tiles.map((tile, idx) => {
              const stepOrder = activeStage.solution.indexOf(idx);
              const color = ECHO_POSITION_COLORS[idx]!;
              return (
                <div
                  key={idx}
                  className="relative w-full aspect-square overflow-hidden rounded-xl bg-white p-2 flex items-center justify-center"
                  style={{
                    border:
                      idx === 4
                        ? `3px dashed ${color}`
                        : `2.5px solid ${color}`,
                  }}
                  title={`${ECHO_POSITION_NAMES[idx]}: Step ${stepOrder} — ${describeEchoTile(tile)}`}
                >
                  <EchoTileSvg
                    tile={tile}
                    clipKey={`admin-${targetDate}-${previewDifficulty}-${idx}`}
                  />
                  <span
                    className="absolute top-1 right-1 rounded-full px-1.5 text-[10px] font-black text-black border border-black/40"
                    style={{ backgroundColor: color }}
                  >
                    {stepOrder}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-500">
            Step numbers shown above are <strong>Admin Studio preview only</strong> — player tiles show zero step badges during gameplay.
          </p>
        </div>

        {/* Right: Seed, Title, Attribution, & 0 → 8 Rule Walkthrough */}
        <div className="md:col-span-7 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1">Puzzle Title</label>
              <Input
                value={draft.title}
                disabled={!canEdit}
                onChange={(e) => {
                  setDraft({ ...draft, title: e.target.value });
                  onDirty?.();
                }}
                maxLength={60}
                className="text-base sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Deterministic Seed</label>
              <div className="flex gap-1.5">
                <Input
                  value={seedInput}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setSeedInput(e.target.value);
                    onDirty?.();
                  }}
                  className="text-base sm:text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canEdit}
                  onClick={handleApplySeed}
                  className="border-2 border-black font-bold text-xs shrink-0"
                >
                  Generate
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Author</label>
              <Input
                value={author}
                disabled={!canEdit}
                onChange={(e) => {
                  setAuthor(e.target.value);
                  onDirty?.();
                }}
                placeholder={defaultAuthor}
                className="text-base sm:text-sm"
                data-testid="admin-eightfold-echo-author"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Editor</label>
              <Input
                value={editorName}
                disabled={!canEdit}
                onChange={(e) => {
                  setEditorName(e.target.value);
                  onDirty?.();
                }}
                placeholder={defaultEditor}
                className="text-base sm:text-sm"
                data-testid="admin-eightfold-echo-editor"
              />
            </div>
          </div>

          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3 space-y-1.5">
            <p className="text-xs font-extrabold uppercase tracking-wider text-neutral-600">
              Verified 0 → 8 Chain Walkthrough ({previewDifficulty === "easy" ? "Easy" : "Hard"})
            </p>
            {rules.map((rule, idx) => (
              <p key={idx} className="text-xs text-neutral-700">
                <strong>
                  Step {idx} → {idx + 1} (pos {activeStage.solution[idx]} → {activeStage.solution[idx + 1]}):
                </strong>{" "}
                {rule}
              </p>
            ))}
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="rounded-xl border-2 border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-700 list-disc list-inside">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!canEdit}
          onClick={() => handlePublish(false)}
          className="bg-black text-white font-bold border-2 border-black"
          data-testid="admin-echo-publish"
        >
          Publish for {targetDate}
        </Button>
        <Button
          type="button"
          disabled={!canEdit}
          variant="outline"
          onClick={() => handlePublish(true)}
          className="border-2 border-black font-bold"
        >
          Publish &amp; play
        </Button>
      </div>
    </div>
  );
}
