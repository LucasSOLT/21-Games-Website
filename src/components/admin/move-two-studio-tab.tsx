"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, Eraser, RotateCcw, Shuffle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MOVE_TWO_POSTURES,
  emptyMoveTwoFloorGrid,
  generateMoveTwoPuzzle,
  getDominoCells,
  getMoveTwoPuzzleForDate,
  solveMoveTwo,
  solveMoveTwoFace,
  validateMoveTwoPuzzle,
  type MoveTwoFace,
  type MoveTwoPosture,
  type MoveTwoPuzzle,
  type MoveTwoTarget,
} from "@/data/puzzles/move-2";
import { getDailyPuzzleForGame, getPuzzleNumberForDate } from "@/lib/daily-engine";
import { getAdminOverridesForGame } from "@/lib/game-storage";
import type { GenericPublishRequest } from "@/components/admin/generic-publish";
import { cn } from "@/lib/utils";

export interface MoveTwoStudioTabProps {
  targetDate: string;
  canEdit?: boolean;
  editReason?: string;
  syncVersion?: number;
  initialPuzzle?: MoveTwoPuzzle;
  hasCustomOverride?: boolean;
  onPublish: (req: GenericPublishRequest) => void;
  onClearOverride?: () => void;
}

type FaceEditTool = "hazard" | "start" | "hole";

const GRID_INDICES = [0, 1, 2, 3, 4] as const;

function clampAnchorForPosture(
  r: number,
  c: number,
  posture: MoveTwoPosture
): { r: number; c: number } {
  const maxR = posture === "FLAT_V" ? 3 : 4;
  const maxC = posture === "FLAT_H" ? 3 : 4;
  return {
    r: Math.max(0, Math.min(maxR, r)),
    c: Math.max(0, Math.min(maxC, c)),
  };
}

function targetsOverlap(a: MoveTwoTarget, b: MoveTwoTarget): boolean {
  const aKeys = new Set(getDominoCells(a).map((c) => `${c.r},${c.c}`));
  return getDominoCells(b).some((c) => aKeys.has(`${c.r},${c.c}`));
}

function buildCleanBlankMoveTwoPuzzle(targetDate: string): MoveTwoPuzzle {
  const faces = [0, 1, 2, 3, 4, 5].map((index) => {
    const grid = emptyMoveTwoFloorGrid();
    const start: MoveTwoTarget = { posture: "UPRIGHT", r: 0, c: 0 };
    const hole: MoveTwoTarget = { posture: "UPRIGHT", r: 4, c: 4 };
    const solved = solveMoveTwoFace({ index, grid, start, hole });
    return {
      index,
      grid,
      start,
      hole,
      parMoves: solved.solvable ? solved.minMoves : 6,
      exitEdge: null,
    } satisfies MoveTwoFace;
  }) as MoveTwoPuzzle["faces"];

  const start = {
    face: 0,
    posture: faces[0].start.posture,
    r: faces[0].start.r,
    c: faces[0].start.c,
  };
  const target = { ...faces[5].hole };
  const solved = solveMoveTwo({ faces, start, target });

  return {
    id: `m2-admin-${targetDate}`,
    puzzleNumber: getPuzzleNumberForDate(targetDate),
    title: "",
    author: "SOL Theory",
    editor: "Daily Editorial",
    faces,
    start,
    target,
    par: solved.solvable ? solved.minMoves : 36,
    canonicalMoves: solved.moves,
    customDate: targetDate,
  };
}

/**
 * `/admin` Interactive 5×5 6-Face Studio Editor for Move Two:
 * Supports toggling interior dark void hazards (`✕`), moving/changing per-face Start (`S`) and
 * Recessed Hole (`H`) postures (`1×1 Upright`, `1×2 Flat ↔`, `2×1 Flat ↕`), live per-face & 6-face
 * BFS Par verification, `"Clear All"` (local form state only), and `"Revert to Default"`.
 */
export function MoveTwoStudioTab({
  targetDate,
  canEdit = true,
  editReason,
  syncVersion = 0,
  initialPuzzle: propInitialPuzzle,
  onPublish,
}: MoveTwoStudioTabProps) {
  const defaultBankPuzzle = useMemo<MoveTwoPuzzle>(
    () => getMoveTwoPuzzleForDate(targetDate),
    [targetDate]
  );

  const resolvedInitialPuzzle = useMemo<MoveTwoPuzzle>(() => {
    void syncVersion;
    if (propInitialPuzzle) return propInitialPuzzle;
    const resolved = getDailyPuzzleForGame<MoveTwoPuzzle>(
      "move-2",
      targetDate,
      getAdminOverridesForGame("move-2")
    );
    return resolved?.puzzle ?? defaultBankPuzzle;
  }, [targetDate, syncVersion, propInitialPuzzle, defaultBankPuzzle]);

  const [draft, setDraft] = useState<MoveTwoPuzzle>(resolvedInitialPuzzle);
  const [title, setTitle] = useState<string>(resolvedInitialPuzzle.title);
  const [editTool, setEditTool] = useState<FaceEditTool>("hazard");
  const [rerollCount, setRerollCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const [prevKey, setPrevKey] = useState(`${targetDate}:${syncVersion}`);
  const currentKey = `${targetDate}:${syncVersion}`;
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setDraft(resolvedInitialPuzzle);
    setTitle(resolvedInitialPuzzle.title);
    setErrors([]);
  }

  const faceSolves = useMemo(
    () => draft.faces.map((face) => solveMoveTwoFace(face)),
    [draft.faces]
  );
  const liveSolve = useMemo(() => solveMoveTwo(draft), [draft]);

  const updateFace = (
    faceIndex: number,
    updater: (face: MoveTwoFace) => MoveTwoFace
  ) => {
    setDraft((prev) => {
      const nextFaces = prev.faces.map((f, idx) =>
        idx === faceIndex ? updater(f) : f
      ) as MoveTwoPuzzle["faces"];
      const nextStart = {
        face: 0,
        posture: nextFaces[0].start.posture,
        r: nextFaces[0].start.r,
        c: nextFaces[0].start.c,
      };
      const nextTarget = { ...nextFaces[5].hole };
      const solved = solveMoveTwo({
        faces: nextFaces,
        start: nextStart,
        target: nextTarget,
      });
      return {
        ...prev,
        faces: nextFaces,
        start: nextStart,
        target: nextTarget,
        par: solved.solvable ? solved.minMoves : prev.par,
        canonicalMoves: solved.solvable ? solved.moves : prev.canonicalMoves,
      };
    });
    setErrors([]);
  };

  const handleCellClick = (faceIndex: number, r: number, c: number) => {
    if (!canEdit) return;
    updateFace(faceIndex, (face) => {
      const nextGrid = face.grid.map((row) => [...row]) as MoveTwoFace["grid"];
      const startKeys = new Set(
        getDominoCells(face.start).map((cell) => `${cell.r},${cell.c}`)
      );
      const holeKeys = new Set(
        getDominoCells(face.hole).map((cell) => `${cell.r},${cell.c}`)
      );

      if (editTool === "hazard") {
        const key = `${r},${c}`;
        if (startKeys.has(key) || holeKeys.has(key)) {
          return face;
        }
        nextGrid[r]![c] = nextGrid[r]![c] === "hazard" ? "floor" : "hazard";
        const solved = solveMoveTwoFace({ ...face, grid: nextGrid });
        return {
          ...face,
          grid: nextGrid,
          parMoves: solved.solvable ? solved.minMoves : undefined,
        };
      }

      if (editTool === "start") {
        const clamped = clampAnchorForPosture(r, c, face.start.posture);
        const candidateStart: MoveTwoTarget = {
          posture: face.start.posture,
          r: clamped.r,
          c: clamped.c,
        };
        if (targetsOverlap(candidateStart, face.hole)) {
          return face;
        }
        for (const cell of getDominoCells(candidateStart)) {
          nextGrid[cell.r]![cell.c] = "floor";
        }
        const solved = solveMoveTwoFace({
          ...face,
          grid: nextGrid,
          start: candidateStart,
        });
        return {
          ...face,
          grid: nextGrid,
          start: candidateStart,
          parMoves: solved.solvable ? solved.minMoves : undefined,
        };
      }

      // editTool === "hole"
      const clamped = clampAnchorForPosture(r, c, face.hole.posture);
      const candidateHole: MoveTwoTarget = {
        posture: face.hole.posture,
        r: clamped.r,
        c: clamped.c,
      };
      if (targetsOverlap(face.start, candidateHole)) {
        return face;
      }
      for (const cell of getDominoCells(candidateHole)) {
        nextGrid[cell.r]![cell.c] = "floor";
      }
      const solved = solveMoveTwoFace({
        ...face,
        grid: nextGrid,
        hole: candidateHole,
      });
      return {
        ...face,
        grid: nextGrid,
        hole: candidateHole,
        parMoves: solved.solvable ? solved.minMoves : undefined,
      };
    });
  };

  const handleChangeStartPosture = (
    faceIndex: number,
    posture: MoveTwoPosture
  ) => {
    if (!canEdit) return;
    updateFace(faceIndex, (face) => {
      const nextGrid = face.grid.map((row) => [...row]) as MoveTwoFace["grid"];
      const clamped = clampAnchorForPosture(
        face.start.r,
        face.start.c,
        posture
      );
      let candidateStart: MoveTwoTarget = {
        posture,
        r: clamped.r,
        c: clamped.c,
      };
      if (targetsOverlap(candidateStart, face.hole)) {
        const fallbackAnchor =
          face.hole.r < 2 ? { r: 3, c: 0 } : { r: 0, c: 0 };
        candidateStart = {
          posture,
          ...clampAnchorForPosture(fallbackAnchor.r, fallbackAnchor.c, posture),
        };
      }
      for (const cell of getDominoCells(candidateStart)) {
        nextGrid[cell.r]![cell.c] = "floor";
      }
      const solved = solveMoveTwoFace({
        ...face,
        grid: nextGrid,
        start: candidateStart,
      });
      return {
        ...face,
        grid: nextGrid,
        start: candidateStart,
        parMoves: solved.solvable ? solved.minMoves : undefined,
      };
    });
  };

  const handleChangeHolePosture = (
    faceIndex: number,
    posture: MoveTwoPosture
  ) => {
    if (!canEdit) return;
    updateFace(faceIndex, (face) => {
      const nextGrid = face.grid.map((row) => [...row]) as MoveTwoFace["grid"];
      const clamped = clampAnchorForPosture(face.hole.r, face.hole.c, posture);
      let candidateHole: MoveTwoTarget = {
        posture,
        r: clamped.r,
        c: clamped.c,
      };
      if (targetsOverlap(face.start, candidateHole)) {
        const fallbackAnchor =
          face.start.r < 2 ? { r: 3, c: 3 } : { r: 0, c: 3 };
        candidateHole = {
          posture,
          ...clampAnchorForPosture(fallbackAnchor.r, fallbackAnchor.c, posture),
        };
      }
      for (const cell of getDominoCells(candidateHole)) {
        nextGrid[cell.r]![cell.c] = "floor";
      }
      const solved = solveMoveTwoFace({
        ...face,
        grid: nextGrid,
        hole: candidateHole,
      });
      return {
        ...face,
        grid: nextGrid,
        hole: candidateHole,
        parMoves: solved.solvable ? solved.minMoves : undefined,
      };
    });
  };

  const handleReroll = () => {
    const next = rerollCount + 1;
    setRerollCount(next);
    const generated = generateMoveTwoPuzzle(
      `admin:${targetDate}:reroll-${next}`,
      {
        id: `m2-admin-${targetDate}`,
        puzzleNumber: getPuzzleNumberForDate(targetDate),
        customDate: targetDate,
      }
    );
    setDraft(generated);
    setTitle(generated.title);
    setErrors([]);
  };

  const handleClearAll = () => {
    const blank = buildCleanBlankMoveTwoPuzzle(targetDate);
    setDraft(blank);
    setTitle("");
    setErrors([]);
  };

  const handleRevertToDefault = () => {
    setDraft(defaultBankPuzzle);
    setTitle(defaultBankPuzzle.title);
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
      preview: `6 5×5 Cube Faces · Par ${candidate.par} moves · Goal ${candidate.target.posture}`,
      details: [
        `BFS shortest path (Par): ${candidate.par} moves across 6 5×5 faces`,
        `Final Hole on Face 6: ${candidate.target.posture} at (${candidate.target.r + 1}, ${candidate.target.c + 1})`,
        `Canonical solution: ${candidate.canonicalMoves.join(" → ")}`,
      ],
      playImmediately,
    });
  };

  return (
    <div
      className="rounded-2xl border-2 border-black bg-white p-5 space-y-4 shadow-[4px_4px_0px_#000]"
      data-testid="admin-move-two"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Badge variant="green" className="mb-1">
            🧊 Move Two 5×5 Studio
          </Badge>
          <h3 className="font-headline font-black text-xl">
            Interactive 6-Face 5×5 Cube Layout &amp; Hole Editor
          </h3>
          <p className="text-xs text-gray-600">
            Pre-filled for {targetDate} with BFS-verified 5×5 faces. Click any tile to edit obstacles, start positions, or target holes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            disabled={!canEdit}
            onClick={handleClearAll}
            className="border-2 border-black font-bold text-xs text-red-700 hover:bg-red-50"
            data-testid="admin-move-two-clear-all"
          >
            <span
              data-testid="admin-move-2-clear-all"
              className="inline-flex items-center"
            >
              <Eraser className="h-4 w-4 mr-1" /> Clear All
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleRevertToDefault}
            className="border-2 border-black font-bold text-xs"
            data-testid="admin-move-two-revert-default"
          >
            <span
              data-testid="admin-move-2-revert-default"
              className="inline-flex items-center"
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Revert to Default
            </span>
          </Button>
        </div>
      </div>

      {!canEdit && editReason && (
        <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded-lg p-2">
          {editReason}
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full sm:max-w-xs">
          <label className="block text-xs font-bold mb-1">Puzzle Title</label>
          <Input
            value={title}
            disabled={!canEdit}
            placeholder="e.g. Six-Sided Roll"
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            data-testid="admin-move-two-title-input"
          />
        </div>

        {/* Click Tool Selector */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-neutral-600 mr-1">
            Click Tile Mode:
          </span>
          {(
            [
              { id: "hazard", label: "Toggle Red Hole" },
              { id: "start", label: "Set Start (S)" },
              { id: "hole", label: "Set Green Hole (H)" },
            ] as const
          ).map((tool) => (
            <button
              key={tool.id}
              type="button"
              disabled={!canEdit}
              onClick={() => setEditTool(tool.id)}
              data-testid={`admin-move-two-tool-${tool.id}`}
              className={cn(
                "px-2.5 py-1 rounded-lg border-2 text-xs font-bold transition-all cursor-pointer",
                editTool === tool.id
                  ? "border-black bg-[#b6df52] text-black shadow-[0_2px_0_#111]"
                  : "border-neutral-300 bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
              )}
            >
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6-Face 5×5 Interactive Grid Editor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {draft.faces.map((face, idx) => {
          const startCells = new Set(
            getDominoCells(face.start).map((c) => `${c.r},${c.c}`)
          );
          const holeCells = new Set(
            getDominoCells(face.hole).map((c) => `${c.r},${c.c}`)
          );
          const faceSolved = faceSolves[idx]!;
          const isFinal = idx === 5;

          return (
            <div
              key={face.index}
              data-testid={`admin-move-two-face-${idx}`}
              className="rounded-xl border-2 border-black bg-[#FAF9F6] p-3 space-y-2"
            >
              <div className="flex items-center justify-between text-xs font-black uppercase">
                <span>
                  Face {face.index + 1} {isFinal ? "· Final Green Goal" : `· Green Hole → ${face.index + 2}`}
                </span>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-mono border",
                    faceSolved.solvable
                      ? "bg-emerald-50 border-emerald-400 text-emerald-800"
                      : "bg-red-50 border-red-400 text-red-700"
                  )}
                >
                  {faceSolved.solvable
                    ? `Par: ${faceSolved.minMoves}m`
                    : "Unsolvable"}
                </span>
              </div>

              {/* 5×5 Grid */}
              <div className="grid grid-cols-5 grid-rows-5 gap-1 bg-[#EAE8E1] p-1.5 rounded-xl border-2 border-black aspect-square">
                {GRID_INDICES.map((r) =>
                  GRID_INDICES.map((c) => {
                    const key = `${r},${c}`;
                    const cell = face.grid[r]![c];
                    const isStart = startCells.has(key);
                    const isHole = holeCells.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleCellClick(idx, r, c)}
                        data-testid={`admin-m2-face-${idx}-cell-${r}-${c}`}
                        className={cn(
                          "w-full h-full aspect-square rounded-sm border-2 flex items-center justify-center text-[10px] font-mono font-black transition-colors cursor-pointer",
                          cell === "wall"
                            ? "bg-neutral-800 border-black text-white"
                            : cell === "hazard"
                            ? "bg-[#DC2626] border-[#7F1D1D] text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.45)]"
                            : isStart
                            ? "bg-[#F7DA21] border-black text-black"
                            : isHole
                            ? "bg-[#2ECC71] border-[#14532D] text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]"
                            : "bg-white border-neutral-300 text-neutral-400 hover:bg-neutral-100"
                        )}
                      >
                        {cell === "wall"
                          ? "■"
                          : cell === "hazard"
                          ? "●"
                          : isStart
                          ? "S"
                          : isHole
                          ? isFinal
                            ? "G"
                            : "H"
                          : ""}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Per-face Start & Hole Posture selectors */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div>
                  <span className="block font-bold text-neutral-600 mb-0.5">
                    Start (S) Posture
                  </span>
                  <select
                    aria-label={`Face ${idx + 1} Start Posture`}
                    disabled={!canEdit}
                    value={face.start.posture}
                    onChange={(e) =>
                      handleChangeStartPosture(
                        idx,
                        e.target.value as MoveTwoPosture
                      )
                    }
                    className="w-full rounded border border-neutral-300 bg-white px-1.5 py-1 font-bold text-[10px]"
                  >
                    {MOVE_TWO_POSTURES.map((p) => (
                      <option key={p} value={p}>
                        {p === "UPRIGHT"
                          ? "1×1 Upright"
                          : p === "FLAT_H"
                          ? "1×2 Flat ↔"
                          : "2×1 Flat ↕"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="block font-bold text-neutral-600 mb-0.5">
                    Hole ({isFinal ? "G" : "H"}) Posture
                  </span>
                  <select
                    aria-label={`Face ${idx + 1} Hole Posture`}
                    disabled={!canEdit}
                    value={face.hole.posture}
                    onChange={(e) =>
                      handleChangeHolePosture(
                        idx,
                        e.target.value as MoveTwoPosture
                      )
                    }
                    className="w-full rounded border border-neutral-300 bg-white px-1.5 py-1 font-bold text-[10px]"
                  >
                    {MOVE_TWO_POSTURES.map((p) => (
                      <option key={p} value={p}>
                        {p === "UPRIGHT"
                          ? "1×1 Upright Hole"
                          : p === "FLAT_H"
                          ? "1×2 Flat ↔ Hole"
                          : "2×1 Flat ↕ Hole"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {liveSolve.solvable ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 text-xs space-y-1">
          <p className="font-bold text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            BFS Solver Verified — Par: {liveSolve.minMoves} moves across 6 5×5 faces · Final Hole:{" "}
            {draft.target.posture}
          </p>
          <p className="font-mono text-[11px] text-neutral-700 break-words">
            Shortest path: {liveSolve.moves.join(" → ")}
          </p>
        </div>
      ) : (
        <p className="text-xs font-bold text-red-600">
          One or more faces are unsolvable — adjust hazards/positions or click Reroll Seed / Revert to Default.
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
