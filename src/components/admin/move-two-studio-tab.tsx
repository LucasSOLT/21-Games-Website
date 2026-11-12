"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, Shuffle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  generateMoveTwoPuzzle,
  getDominoCells,
  solveMoveTwo,
  validateMoveTwoPuzzle,
  type MoveTwoPuzzle,
} from "@/data/puzzles/move-2";
import { getDailyPuzzleForGame, getPuzzleNumberForDate } from "@/lib/daily-engine";
import { getAdminOverridesForGame } from "@/lib/game-storage";
import type { GenericPublishRequest } from "@/components/admin/generic-publish";
import { cn } from "@/lib/utils";

interface MoveTwoStudioTabProps {
  targetDate: string;
  canEdit: boolean;
  editReason?: string;
  syncVersion?: number;
  onPublish: (req: GenericPublishRequest) => void;
}

/**
 * `/admin` Preview & Reroll Seed Studio Tab for Move Two (`GAME_DESIGN_BIBLE.md` §0.3 & Q44):
 * Move Two is 100% auto-generated and BFS-solver verified across all 6 `3×3` cube faces.
 */
export function MoveTwoStudioTab({
  targetDate,
  canEdit,
  editReason,
  syncVersion = 0,
  onPublish,
}: MoveTwoStudioTabProps) {
  const initialPuzzle = useMemo<MoveTwoPuzzle>(() => {
    void syncVersion;
    const resolved = getDailyPuzzleForGame<MoveTwoPuzzle>(
      "move-2",
      targetDate,
      getAdminOverridesForGame("move-2")
    );
    return (
      resolved?.puzzle ??
      generateMoveTwoPuzzle(`admin:${targetDate}:0`, {
        id: `m2-admin-${targetDate}`,
        puzzleNumber: getPuzzleNumberForDate(targetDate),
        customDate: targetDate,
      })
    );
  }, [targetDate, syncVersion]);

  const [draft, setDraft] = useState<MoveTwoPuzzle>(initialPuzzle);
  const [title, setTitle] = useState<string>(initialPuzzle.title);
  const [rerollCount, setRerollCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const [prevInitial, setPrevInitial] = useState(initialPuzzle);
  if (prevInitial !== initialPuzzle) {
    setPrevInitial(initialPuzzle);
    setDraft(initialPuzzle);
    setTitle(initialPuzzle.title);
    setErrors([]);
  }

  const liveSolve = useMemo(() => solveMoveTwo(draft), [draft]);

  const handleReroll = () => {
    const next = rerollCount + 1;
    setRerollCount(next);
    const generated = generateMoveTwoPuzzle(`admin:${targetDate}:reroll-${next}`, {
      id: `m2-admin-${targetDate}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      customDate: targetDate,
    });
    setDraft(generated);
    setTitle(generated.title);
    setErrors([]);
  };

  const handlePublish = (playImmediately: boolean) => {
    const candidate: MoveTwoPuzzle = {
      ...draft,
      id: `m2-admin-${targetDate}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      title: title.trim() || draft.title || "Six-Sided Roll",
      par: liveSolve.minMoves,
      canonicalMoves: liveSolve.moves,
      customDate: targetDate,
    };
    const check = validateMoveTwoPuzzle(candidate);
    if (!check.valid) {
      setErrors(check.errors);
      return;
    }
    setErrors([]);
    onPublish({
      gameSlug: "move-2",
      gameTitle: "Move Two",
      payload: candidate,
      meta: {
        puzzleNumber: candidate.puzzleNumber,
        title: candidate.title,
        author: candidate.author,
        editor: candidate.editor,
      },
      preview: `6 Cube Faces · Par ${candidate.par} moves · Target ${candidate.target.posture}`,
      details: [
        `BFS shortest path (Par): ${candidate.par} moves`,
        `Target on Face 6: ${candidate.target.posture} at (${candidate.target.r + 1}, ${candidate.target.c + 1})`,
        `Canonical solution: ${candidate.canonicalMoves.join(" → ")}`,
      ],
      playImmediately,
    });
  };

  const startCells = new Set(
    getDominoCells(draft.start).map((c) => `${c.r},${c.c}`)
  );
  const targetCells = new Set(
    getDominoCells(draft.target).map((c) => `${c.r},${c.c}`)
  );

  return (
    <div
      className="rounded-2xl border-2 border-black bg-white p-5 space-y-4 shadow-[4px_4px_0px_#000]"
      data-testid="admin-move-two"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Badge variant="green" className="mb-1">
            🎲 Move Two Studio
          </Badge>
          <h3 className="font-headline font-black text-xl">
            Preview, Reroll Seed &amp; BFS-Verify 6-Face Cube Layouts
          </h3>
          <p className="text-xs text-gray-600">
            100% procedurally generated for {targetDate} with guaranteed BFS solvability and exact Par.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!canEdit}
            onClick={handleReroll}
            className="border-2 border-black font-bold text-xs"
            data-testid="admin-move-two-reroll"
          >
            <Shuffle className="h-4 w-4 mr-1" /> Reroll Seed
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(initialPuzzle);
              setTitle(initialPuzzle.title);
              setErrors([]);
            }}
            className="border-2 border-black font-bold text-xs"
          >
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {!canEdit && editReason && (
        <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded-lg p-2">
          {editReason}
        </p>
      )}

      <div className="max-w-sm">
        <label className="block text-xs font-bold mb-1">Puzzle Title</label>
        <Input
          value={title}
          disabled={!canEdit}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={50}
        />
      </div>

      {/* 6-Face Unfolded Mini Preview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {draft.faces.map((face) => (
          <div
            key={face.index}
            className="rounded-xl border-2 border-black bg-[#FAF9F6] p-2.5 space-y-1.5"
          >
            <div className="flex items-center justify-between text-[10px] font-black uppercase">
              <span>Face {face.index + 1}</span>
              <span className="text-emerald-700">
                {face.exitEdge ? `→ ${face.exitEdge}` : "🎯 Goal"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[0, 1, 2].map((r) =>
                [0, 1, 2].map((c) => {
                  const key = `${r},${c}`;
                  const cell = face.grid[r]![c];
                  const isStart = face.index === 0 && startCells.has(key);
                  const isGoal = face.index === 5 && targetCells.has(key);
                  return (
                    <div
                      key={key}
                      className={cn(
                        "h-6 rounded border flex items-center justify-center text-[9px] font-mono font-black",
                        cell === "wall"
                          ? "bg-neutral-900 border-black text-white"
                          : cell === "hazard"
                          ? "bg-red-50 border-red-300 text-red-600"
                          : isStart
                          ? "bg-[#b6df52] border-black text-black"
                          : isGoal
                          ? "bg-red-500 border-black text-white"
                          : "bg-white border-neutral-300 text-neutral-400"
                      )}
                    >
                      {cell === "wall"
                        ? "■"
                        : cell === "hazard"
                        ? "✕"
                        : isStart
                        ? "S"
                        : isGoal
                        ? "T"
                        : ""}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {liveSolve.solvable ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 text-xs space-y-1">
          <p className="font-bold text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            BFS Solver Verified — Par: {liveSolve.minMoves} moves · Target:{" "}
            {draft.target.posture}
          </p>
          <p className="font-mono text-[11px] text-neutral-700 break-words">
            Shortest path: {liveSolve.moves.join(" → ")}
          </p>
        </div>
      ) : (
        <p className="text-xs font-bold text-red-600">
          Layout is unsolvable — click Reroll Seed.
        </p>
      )}

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
          disabled={!canEdit || !liveSolve.solvable}
          onClick={() => handlePublish(false)}
          className="bg-black text-white font-bold border-2 border-black"
          data-testid="admin-move-two-publish"
        >
          Publish for {targetDate}
        </Button>
        <Button
          type="button"
          disabled={!canEdit || !liveSolve.solvable}
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
