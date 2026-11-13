"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, Shuffle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ECHO_POSITION_COLORS,
  ECHO_POSITION_NAMES,
  buildEchoChainRules,
  describeEchoTile,
  generateEightfoldEchoPuzzle,
  solveEightfoldEcho,
  validateEightfoldEchoPuzzle,
  type EightfoldEchoPuzzle,
} from "@/data/puzzles/eightfold-echo";
import { getDailyPuzzleForGame, getPuzzleNumberForDate } from "@/lib/daily-engine";
import { getAdminOverridesForGame } from "@/lib/game-storage";
import { EchoTileSvg } from "@/components/games/echo-tile-svg";
import type { GenericPublishRequest } from "@/components/admin/generic-publish";

interface EightfoldEchoStudioTabProps {
  targetDate: string;
  canEdit: boolean;
  editReason?: string;
  syncVersion?: number;
  onPublish: (req: GenericPublishRequest) => void;
}

export function EightfoldEchoStudioTab({
  targetDate,
  canEdit,
  editReason,
  syncVersion = 0,
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
  const [rerollCount, setRerollCount] = useState(0);
  const [seedInput, setSeedInput] = useState(initialPuzzle.seed ?? `date:${targetDate}`);
  const [errors, setErrors] = useState<string[]>([]);

  const [prevInitial, setPrevInitial] = useState(initialPuzzle);
  if (prevInitial !== initialPuzzle) {
    setPrevInitial(initialPuzzle);
    setDraft(initialPuzzle);
    setSeedInput(initialPuzzle.seed ?? `date:${targetDate}`);
    setErrors([]);
  }

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
  };

  const handleClearAll = () => {
    setSeedInput("");
    setDraft((prev) => ({
      ...prev,
      title: "",
      seed: "",
      tiles: prev.tiles.map((t) => ({ ...t, customSvgUrl: "" })),
    }));
    setErrors([]);
  };

  const handleRevertDefault = () => {
    setDraft(defaultPuzzle);
    setSeedInput(defaultPuzzle.seed ?? `date:${targetDate}`);
    setErrors([]);
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
  };

  const solved = useMemo(() => solveEightfoldEcho(draft.tiles), [draft.tiles]);
  const rules = useMemo(() => buildEchoChainRules(draft), [draft]);

  const handlePublish = (playImmediately: boolean) => {
    const candidate: EightfoldEchoPuzzle = {
      ...draft,
      id: `8e-admin-${targetDate}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      title: draft.title.trim() || "Harmonic Resonance",
      author: "SOL Theory",
      editor: "Daily Editorial",
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
      preview: `${candidate.title} — chain ${candidate.solution.join(" → ")}`,
      details: [
        `Solver verified unique 0 → 8 chain (${solved.ambiguousSteps} decoy-rich steps)`,
        `Seed: ${candidate.seed ?? "custom"}`,
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
            Preview &amp; Reroll 3×3 Logic Sequence
          </h3>
          <p className="text-xs text-gray-600">
            100% auto-generated &amp; Hamiltonian-solver verified for {targetDate}. Reroll any seed or customize title/SVG overrides.
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

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Left: Live 3×3 Preview */}
        <div className="md:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>3×3 Board Preview</span>
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Unique paths: {solved.count}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl border-2 border-black bg-neutral-50 max-w-xs">
            {draft.tiles.map((tile, idx) => {
              const stepOrder = draft.solution.indexOf(idx);
              const color = ECHO_POSITION_COLORS[idx]!;
              return (
                <div
                  key={idx}
                  className="relative aspect-square rounded-xl bg-white p-2 flex items-center justify-center"
                  style={{
                    border:
                      idx === 4
                        ? `3px dashed ${color}`
                        : `2.5px solid ${color}`,
                  }}
                  title={`${ECHO_POSITION_NAMES[idx]}: Step ${stepOrder} — ${describeEchoTile(tile)}`}
                >
                  <EchoTileSvg tile={tile} clipKey={`admin-${targetDate}-${idx}`} />
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

        {/* Right: Seed, Title, Custom SVG URLs & 0 → 8 Rule Walkthrough */}
        <div className="md:col-span-7 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1">Puzzle Title</label>
              <Input
                value={draft.title}
                disabled={!canEdit}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                maxLength={60}
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Deterministic Seed</label>
              <div className="flex gap-1.5">
                <Input
                  value={seedInput}
                  disabled={!canEdit}
                  onChange={(e) => setSeedInput(e.target.value)}
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
          </div>

          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3 space-y-1.5">
            <p className="text-xs font-extrabold uppercase tracking-wider text-neutral-600">
              Verified 0 → 8 Chain Walkthrough
            </p>
            {rules.map((rule, idx) => (
              <p key={idx} className="text-xs text-neutral-700">
                <strong>
                  Step {idx} → {idx + 1} (pos {draft.solution[idx]} → {draft.solution[idx + 1]}):
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
