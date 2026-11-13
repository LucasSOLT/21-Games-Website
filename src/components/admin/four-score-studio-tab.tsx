"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, Shuffle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FOUR_SCORE_OPERATORS,
  FOUR_SCORE_TARGET,
  generateFourScorePuzzle,
  solveFourScore,
  validateFourScorePuzzle,
  type FourScoreOperator,
  type FourScorePuzzle,
} from "@/data/puzzles/four-score";
import { getDailyPuzzleForGame, getPuzzleNumberForDate } from "@/lib/daily-engine";
import { getAdminOverridesForGame } from "@/lib/game-storage";
import type { GenericPublishRequest } from "@/components/admin/generic-publish";

interface FourScoreStudioTabProps {
  targetDate: string;
  canEdit: boolean;
  editReason?: string;
  syncVersion?: number;
  onPublish: (req: GenericPublishRequest) => void;
}

export function FourScoreStudioTab({
  targetDate,
  canEdit,
  editReason,
  syncVersion = 0,
  onPublish,
}: FourScoreStudioTabProps) {
  const initialPuzzle = useMemo<FourScorePuzzle>(() => {
    void syncVersion;
    const resolved = getDailyPuzzleForGame<FourScorePuzzle>(
      "four-score",
      targetDate,
      getAdminOverridesForGame("four-score")
    );
    return (
      resolved?.puzzle ??
      generateFourScorePuzzle(`admin:${targetDate}:0`, {
        id: `4s-admin-${targetDate}`,
        puzzleNumber: getPuzzleNumberForDate(targetDate),
        customDate: targetDate,
      })
    );
  }, [targetDate, syncVersion]);

  const defaultPuzzle = useMemo<FourScorePuzzle>(() => {
    const resolved = getDailyPuzzleForGame<FourScorePuzzle>(
      "four-score",
      targetDate,
      {}
    );
    return resolved?.puzzle ?? initialPuzzle;
  }, [targetDate, initialPuzzle]);

  const [title, setTitle] = useState(initialPuzzle.title);
  const [digitsCsv, setDigitsCsv] = useState(initialPuzzle.digits.join(", "));
  const [opsCsv, setOpsCsv] = useState(initialPuzzle.operators.join(", "));
  const [rerollCount, setRerollCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const [prevInitial, setPrevInitial] = useState(initialPuzzle);
  if (prevInitial !== initialPuzzle) {
    setPrevInitial(initialPuzzle);
    setTitle(initialPuzzle.title);
    setDigitsCsv(initialPuzzle.digits.join(", "));
    setOpsCsv(initialPuzzle.operators.join(", "));
    setErrors([]);
  }

  const parsedDigits = useMemo(
    () =>
      digitsCsv
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0),
    [digitsCsv]
  );

  const parsedOps = useMemo(
    () =>
      opsCsv
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is FourScoreOperator =>
          (FOUR_SCORE_OPERATORS as readonly string[]).includes(s)
        ),
    [opsCsv]
  );

  const liveSolve = useMemo(
    () => solveFourScore(parsedDigits, parsedOps, FOUR_SCORE_TARGET),
    [parsedDigits, parsedOps]
  );

  const handleReroll = () => {
    const next = rerollCount + 1;
    setRerollCount(next);
    const nextPuzzle = generateFourScorePuzzle(`admin:${targetDate}:reroll-${next}`, {
      id: `4s-admin-${targetDate}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      customDate: targetDate,
    });
    setTitle(nextPuzzle.title);
    setDigitsCsv(nextPuzzle.digits.join(", "));
    setOpsCsv(nextPuzzle.operators.join(", "));
    setErrors([]);
  };

  const handleClearAll = () => {
    setTitle("");
    setDigitsCsv("");
    setOpsCsv("");
    setErrors([]);
  };

  const handleRevertDefault = () => {
    setTitle(defaultPuzzle.title);
    setDigitsCsv(defaultPuzzle.digits.join(", "));
    setOpsCsv(defaultPuzzle.operators.join(", "));
    setErrors([]);
  };

  const handlePublish = (playImmediately: boolean) => {
    const candidate: FourScorePuzzle = {
      id: `4s-admin-${targetDate}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      title: title.trim() || "Exact Eighty",
      author: "SOL Theory",
      editor: "Daily Editorial",
      target: FOUR_SCORE_TARGET,
      digits: parsedDigits,
      operators: parsedOps,
      canonicalEquation: liveSolve.canonicalEquation
        ? `${liveSolve.canonicalEquation} = ${FOUR_SCORE_TARGET}`
        : "",
      customDate: targetDate,
    };
    const check = validateFourScorePuzzle(candidate);
    if (!check.valid) {
      setErrors(check.errors);
      return;
    }
    setErrors([]);
    onPublish({
      gameSlug: "four-score",
      gameTitle: "Four Score",
      payload: candidate,
      meta: {
        puzzleNumber: candidate.puzzleNumber,
        title: candidate.title,
        author: candidate.author,
        editor: candidate.editor,
      },
      preview: `Digits [${candidate.digits.join(", ")}] · Ops [${candidate.operators.join(" ")}] → ${candidate.canonicalEquation}`,
      details: [
        `${candidate.digits.length} tiles & ${candidate.operators.length} operators`,
        `Solver verified: ${candidate.canonicalEquation}`,
      ],
      playImmediately,
    });
  };

  return (
    <div
      className="rounded-2xl border-2 border-black bg-white p-5 space-y-4 shadow-[4px_4px_0px_#000]"
      data-testid="admin-four-score"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Badge variant="yellow" className="mb-1">
            🧮 Four Score Studio
          </Badge>
          <h3 className="font-headline font-black text-xl">
            Preview, Reroll &amp; Solver-Verify Reach-80 Boards
          </h3>
          <p className="text-xs text-gray-600">
            Every board for {targetDate} is verified by the backtracking full-board math solver (`= 80`).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!canEdit}
            onClick={handleReroll}
            className="border-2 border-black font-bold text-xs"
            data-testid="admin-four-score-reroll"
          >
            <Shuffle className="h-4 w-4 mr-1" /> Reroll Seed
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClearAll}
            data-testid="admin-four-score-clear-all"
            className="border-2 border-black font-bold text-xs"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Clear All
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleRevertDefault}
            data-testid="admin-four-score-revert-default"
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold mb-1">Title</label>
          <Input
            value={title}
            disabled={!canEdit}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
          />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">
            Digits (≥ 4 integers, comma-separated)
          </label>
          <Input
            value={digitsCsv}
            disabled={!canEdit}
            onChange={(e) => setDigitsCsv(e.target.value)}
            placeholder="3, 7, 5, 1"
          />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">
            Operators (+, −, ×, ÷, x², xʸ)
          </label>
          <Input
            value={opsCsv}
            disabled={!canEdit}
            onChange={(e) => setOpsCsv(e.target.value)}
            placeholder="+, ×, ×, x²"
          />
        </div>
      </div>

      {/* Live Preview & Canonical Solver Status */}
      <div className="rounded-xl border-2 border-neutral-200 bg-neutral-50 p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          {parsedDigits.map((d, i) => (
            <span
              key={i}
              className="inline-flex h-11 min-w-11 px-3 items-center justify-center rounded-xl border-2 border-black bg-white font-headline font-black text-lg"
            >
              {d}
            </span>
          ))}
          <span className="mx-1 text-neutral-400 font-black">·</span>
          {parsedOps.map((op, i) => (
            <span
              key={i}
              className="inline-flex h-10 min-w-10 px-2.5 items-center justify-center rounded-full border-2 border-black bg-[#F9D423] font-headline font-black text-sm"
            >
              {op}
            </span>
          ))}
        </div>

        {liveSolve.solvable ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Verified full-board solution:{" "}
            <code className="bg-white px-2 py-0.5 rounded border border-emerald-300">
              {liveSolve.canonicalEquation} = 80
            </code>
          </p>
        ) : (
          <p className="text-xs font-bold text-red-600">
            No valid full-board solution to 80 with these tiles &amp; operators (binary ops must equal digits − 1).
          </p>
        )}
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
          disabled={!canEdit || !liveSolve.solvable}
          onClick={() => handlePublish(false)}
          className="bg-black text-white font-bold border-2 border-black"
          data-testid="admin-four-score-publish"
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
