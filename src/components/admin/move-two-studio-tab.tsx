"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, Eraser, RotateCcw, Shuffle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MOVE_TWO_BOARD_SIZES,
  MOVE_TWO_DIFFICULTIES,
  MOVE_TWO_DIFFICULTY_META,
  createMoveTwoGrid,
  generateBloxorzStage,
  generateMoveTwoPuzzle,
  getInitialBlockState,
  getMoveTwoPuzzleForDate,
  isMoveTwoPuzzle,
  solveBloxorzStage,
  solveMoveTwo,
  validateMoveTwoPuzzle,
  type MoveTwoBridgeDef,
  type MoveTwoCoord,
  type MoveTwoDifficulty,
  type MoveTwoPuzzle,
  type MoveTwoStage,
  type MoveTwoSwitchBehavior,
  type MoveTwoSwitchDef,
  type MoveTwoTileType,
} from "@/data/puzzles/move-2";
import { MoveTwoBloxorzCanvas } from "@/components/games/move-two-canvas";
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

type StudioPaintTool =
  | "void"
  | "floor"
  | "fragile"
  | "bridge_A"
  | "bridge_B"
  | "soft_A"
  | "soft_B"
  | "heavy_A"
  | "heavy_B"
  | "start"
  | "goal";

const PAINT_TOOLS: ReadonlyArray<{
  id: StudioPaintTool;
  label: string;
  swatchClass: string;
}> = [
  {
    id: "floor",
    label: "Stone Floor",
    swatchClass: "bg-white border-black text-black",
  },
  {
    id: "void",
    label: "Void (Empty)",
    swatchClass: "bg-neutral-200 border-neutral-500 text-neutral-700",
  },
  {
    id: "fragile",
    label: "Red Obstacle",
    swatchClass: "bg-[#EF4444] border-black text-white",
  },
  {
    id: "bridge_A",
    label: "Bridge A",
    swatchClass: "bg-[#DBEAFE] border-blue-700 text-blue-950",
  },
  {
    id: "bridge_B",
    label: "Bridge B",
    swatchClass: "bg-[#BFDBFE] border-blue-800 text-blue-950",
  },
  {
    id: "soft_A",
    label: "○ Switch → A",
    swatchClass: "bg-sky-100 border-sky-700 text-sky-950",
  },
  {
    id: "soft_B",
    label: "○ Switch → B",
    swatchClass: "bg-sky-100 border-sky-700 text-sky-950",
  },
  {
    id: "heavy_A",
    label: "✕ Heavy → A",
    swatchClass: "bg-violet-100 border-violet-700 text-violet-950",
  },
  {
    id: "heavy_B",
    label: "✕ Heavy → B",
    swatchClass: "bg-violet-100 border-violet-700 text-violet-950",
  },
  {
    id: "start",
    label: "Set Start (S)",
    swatchClass: "bg-[#F7DA21] border-black text-black",
  },
  {
    id: "goal",
    label: "Set Goal (G)",
    swatchClass: "bg-[#2ECC71] border-black text-black",
  },
];

function buildBlankBloxorzStage(difficulty: MoveTwoDifficulty): MoveTwoStage {
  const size = MOVE_TWO_BOARD_SIZES[difficulty];
  const grid = createMoveTwoGrid(size, "void");
  // Carve a clean connected floating stone island ready for manual sculpting
  for (let r = 1; r < size - 1; r++) {
    for (let c = 1; c < size - 1; c++) {
      grid[r]![c] = "floor";
    }
  }
  const start: MoveTwoCoord = { r: 1, c: 1 };
  const goal: MoveTwoCoord = { r: size - 2, c: size - 2 };
  const solved = solveBloxorzStage({
    size,
    grid,
    start,
    goal,
    bridges: [],
    switches: [],
  });
  return {
    difficulty,
    size,
    grid,
    start,
    goal,
    bridges: [],
    switches: [],
    par: solved.solvable ? solved.minMoves : 6,
    canonicalMoves: solved.moves,
  };
}

function buildCleanBlankMoveTwoPuzzle(targetDate: string): MoveTwoPuzzle {
  const easy = buildBlankBloxorzStage("easy");
  const medium = buildBlankBloxorzStage("medium");
  const hard = buildBlankBloxorzStage("hard");
  return {
    version: 3,
    id: `m2-admin-${targetDate}`,
    puzzleNumber: getPuzzleNumberForDate(targetDate),
    title: "",
    author: "SOL Theory",
    editor: "Daily Editorial",
    stages: { easy, medium, hard },
    par: medium.par,
    customDate: targetDate,
  };
}

/**
 * Normalizes `bridges` and `switches` arrays after painting or toggling cells on `stage`
 * so `validateMoveTwoStage` and `solveBloxorzStage` remain 100% consistent.
 */
function normalizeStageAfterEdit(
  stage: MoveTwoStage,
  nextGrid: MoveTwoTileType[][],
  nextStart: MoveTwoCoord,
  nextGoal: MoveTwoCoord,
  nextBridgesRaw: MoveTwoBridgeDef[],
  nextSwitchesRaw: MoveTwoSwitchDef[]
): MoveTwoStage {
  // Keep only bridge cells that are actually marked "bridge" in nextGrid
  const cleanedBridges: MoveTwoBridgeDef[] = [];
  const claimedBridgeCells = new Set<string>();

  for (const b of nextBridgesRaw) {
    const validCells = b.cells.filter((cell) => {
      const key = `${cell.r},${cell.c}`;
      if (nextGrid[cell.r]?.[cell.c] !== "bridge" || claimedBridgeCells.has(key)) {
        return false;
      }
      claimedBridgeCells.add(key);
      return true;
    });
    if (validCells.length > 0) {
      cleanedBridges.push({
        id: b.id,
        cells: validCells,
        initiallyOpen: b.initiallyOpen,
      });
    }
  }

  // Ensure any orphaned "bridge" cell on nextGrid is assigned to Bridge A
  const orphanCells: MoveTwoCoord[] = [];
  for (let r = 0; r < stage.size; r++) {
    for (let c = 0; c < stage.size; c++) {
      if (nextGrid[r]![c] === "bridge" && !claimedBridgeCells.has(`${r},${c}`)) {
        orphanCells.push({ r, c });
      }
    }
  }
  if (orphanCells.length > 0) {
    const existingA = cleanedBridges.find((b) => b.id === "A");
    if (existingA) {
      existingA.cells.push(...orphanCells);
    } else {
      cleanedBridges.push({
        id: "A",
        cells: orphanCells,
        initiallyOpen: false,
      });
    }
  }

  const validBridgeIds = new Set(cleanedBridges.map((b) => b.id));
  const cleanedSwitches: MoveTwoSwitchDef[] = [];

  for (const sw of nextSwitchesRaw) {
    const tile = nextGrid[sw.r]?.[sw.c];
    const expectedTile = sw.kind === "soft" ? "soft_switch" : "heavy_switch";
    if (tile !== expectedTile) continue;
    if (!validBridgeIds.has(sw.bridgeId)) {
      // Revert switch tile to plain floor if its target bridge was completely erased
      nextGrid[sw.r]![sw.c] = "floor";
      continue;
    }
    cleanedSwitches.push(sw);
  }

  const solved = solveBloxorzStage({
    size: stage.size,
    grid: nextGrid,
    start: nextStart,
    goal: nextGoal,
    bridges: cleanedBridges,
    switches: cleanedSwitches,
  });

  return {
    ...stage,
    grid: nextGrid,
    start: nextStart,
    goal: nextGoal,
    bridges: cleanedBridges,
    switches: cleanedSwitches,
    par: solved.solvable ? solved.minMoves : stage.par,
    canonicalMoves: solved.solvable ? solved.moves : [],
  };
}

/**
 * `/admin` Interactive 3-Difficulty (`6×6` Easy · `8×8` Medium · `10×10` Hard) Bloxorz Studio Editor:
 * Supports painting floating stone islands, void chasms, fragile terracotta tiles, retractable bridges (`A`/`B`),
 * `○` soft switches & `✕` heavy switches, live 3D canvas preview, live per-difficulty BFS `Par` verification,
 * `"Clear All"` (local form state only), and `"Revert to Default"`.
 */
export function MoveTwoStudioTab({
  targetDate,
  canEdit = true,
  editReason,
  syncVersion = 0,
  initialPuzzle: propInitialPuzzle,
  onPublish,
  onClearOverride,
}: MoveTwoStudioTabProps) {
  const defaultBankPuzzle = useMemo<MoveTwoPuzzle>(
    () => getMoveTwoPuzzleForDate(targetDate),
    [targetDate]
  );

  const resolvedInitialPuzzle = useMemo<MoveTwoPuzzle>(() => {
    void syncVersion;
    if (propInitialPuzzle && isMoveTwoPuzzle(propInitialPuzzle)) {
      return propInitialPuzzle;
    }
    const resolved = getDailyPuzzleForGame<MoveTwoPuzzle>(
      "move-2",
      targetDate,
      getAdminOverridesForGame("move-2")
    );
    return resolved?.puzzle ?? defaultBankPuzzle;
  }, [targetDate, syncVersion, propInitialPuzzle, defaultBankPuzzle]);

  const [draft, setDraft] = useState<MoveTwoPuzzle>(resolvedInitialPuzzle);
  const [title, setTitle] = useState<string>(resolvedInitialPuzzle.title);
  const [activeDiff, setActiveDiff] = useState<MoveTwoDifficulty>("medium");
  const [paintTool, setPaintTool] = useState<StudioPaintTool>("fragile");
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

  const liveSolve = useMemo(() => solveMoveTwo(draft), [draft]);
  const activeStage = draft.stages[activeDiff];
  const activeStageSolve = liveSolve.stages[activeDiff];

  const updateStage = (
    diff: MoveTwoDifficulty,
    updater: (stage: MoveTwoStage) => MoveTwoStage
  ) => {
    setDraft((prev) => {
      const updatedStage = updater(prev.stages[diff]);
      const nextStages = {
        ...prev.stages,
        [diff]: updatedStage,
      };
      return {
        ...prev,
        stages: nextStages,
        par: nextStages.medium.par,
      };
    });
    setErrors([]);
  };

  const handleCellClick = (r: number, c: number) => {
    if (!canEdit) return;
    updateStage(activeDiff, (stage) => {
      const nextGrid = stage.grid.map((row) => [...row]);
      let nextStart = { ...stage.start };
      let nextGoal = { ...stage.goal };
      let nextBridges = stage.bridges.map((b) => ({
        ...b,
        cells: b.cells.map((cell) => ({ ...cell })),
      }));
      let nextSwitches = stage.switches.map((sw) => ({ ...sw }));

      const isStartCell = stage.start.r === r && stage.start.c === c;
      const isGoalCell = stage.goal.r === r && stage.goal.c === c;

      if (paintTool === "start") {
        if (isGoalCell) return stage;
        nextStart = { r, c };
        if (nextGrid[r]![c] === "void" || nextGrid[r]![c] === "fragile") {
          nextGrid[r]![c] = "floor";
        }
        return normalizeStageAfterEdit(
          stage,
          nextGrid,
          nextStart,
          nextGoal,
          nextBridges,
          nextSwitches
        );
      }

      if (paintTool === "goal") {
        if (isStartCell) return stage;
        nextGoal = { r, c };
        nextGrid[r]![c] = "floor";
        nextSwitches = nextSwitches.filter((sw) => sw.r !== r || sw.c !== c);
        return normalizeStageAfterEdit(
          stage,
          nextGrid,
          nextStart,
          nextGoal,
          nextBridges,
          nextSwitches
        );
      }

      // Protect Start & Goal from becoming void or fragile
      if ((isStartCell || isGoalCell) && (paintTool === "void" || paintTool === "fragile")) {
        return stage;
      }

      // Remove any existing switch or bridge claim on (r, c) before painting new type
      nextSwitches = nextSwitches.filter((sw) => sw.r !== r || sw.c !== c);
      nextBridges = nextBridges.map((b) => ({
        ...b,
        cells: b.cells.filter((cell) => cell.r !== r || cell.c !== c),
      }));

      if (paintTool === "void" || paintTool === "floor" || paintTool === "fragile") {
        nextGrid[r]![c] = paintTool;
      } else if (paintTool === "bridge_A" || paintTool === "bridge_B") {
        const bridgeId = paintTool === "bridge_A" ? "A" : "B";
        nextGrid[r]![c] = "bridge";
        const existing = nextBridges.find((b) => b.id === bridgeId);
        if (existing) {
          existing.cells.push({ r, c });
        } else {
          nextBridges.push({
            id: bridgeId,
            cells: [{ r, c }],
            initiallyOpen: false,
          });
        }
      } else {
        // Switch tool (soft_A, soft_B, heavy_A, heavy_B)
        const isHeavy = paintTool.startsWith("heavy");
        const bridgeId = paintTool.endsWith("_A") ? "A" : "B";
        // Ensure target bridge exists so switch isn't stripped; if no bridge cells yet, no-op until bridge exists
        if (!nextBridges.some((b) => b.id === bridgeId && b.cells.length > 0)) {
          return stage;
        }
        nextGrid[r]![c] = isHeavy ? "heavy_switch" : "soft_switch";
        nextSwitches.push({
          r,
          c,
          kind: isHeavy ? "heavy" : "soft",
          bridgeId,
          behavior: "toggle",
        });
      }

      return normalizeStageAfterEdit(
        stage,
        nextGrid,
        nextStart,
        nextGoal,
        nextBridges,
        nextSwitches
      );
    });
  };

  const handleToggleBridgeInitiallyOpen = (bridgeId: string) => {
    if (!canEdit) return;
    updateStage(activeDiff, (stage) => {
      const nextBridges = stage.bridges.map((b) =>
        b.id === bridgeId ? { ...b, initiallyOpen: !b.initiallyOpen } : b
      );
      return normalizeStageAfterEdit(
        stage,
        stage.grid.map((row) => [...row]),
        stage.start,
        stage.goal,
        nextBridges,
        stage.switches
      );
    });
  };

  const handleCycleSwitchBehavior = (r: number, c: number) => {
    if (!canEdit) return;
    const order: MoveTwoSwitchBehavior[] = ["toggle", "open", "close"];
    updateStage(activeDiff, (stage) => {
      const nextSwitches = stage.switches.map((sw) => {
        if (sw.r !== r || sw.c !== c) return sw;
        const nextIdx = (order.indexOf(sw.behavior) + 1) % order.length;
        return { ...sw, behavior: order[nextIdx]! };
      });
      return normalizeStageAfterEdit(
        stage,
        stage.grid.map((row) => [...row]),
        stage.start,
        stage.goal,
        stage.bridges,
        nextSwitches
      );
    });
  };

  const handleRerollAll = () => {
    const next = rerollCount + 1;
    setRerollCount(next);
    const generated = generateMoveTwoPuzzle(
      `admin:v3:${targetDate}:reroll-${next}`,
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

  const handleRerollActiveStage = () => {
    const next = rerollCount + 1;
    setRerollCount(next);
    const nextStage = generateBloxorzStage(
      `admin:v3:${targetDate}:${activeDiff}:reroll-${next}`,
      activeDiff
    );
    updateStage(activeDiff, () => nextStage);
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
    onClearOverride?.();
  };

  const handlePublish = (playImmediately: boolean) => {
    const syncedStages: Record<MoveTwoDifficulty, MoveTwoStage> = {
      easy: {
        ...draft.stages.easy,
        par: liveSolve.stages.easy.minMoves,
        canonicalMoves: liveSolve.stages.easy.moves,
      },
      medium: {
        ...draft.stages.medium,
        par: liveSolve.stages.medium.minMoves,
        canonicalMoves: liveSolve.stages.medium.moves,
      },
      hard: {
        ...draft.stages.hard,
        par: liveSolve.stages.hard.minMoves,
        canonicalMoves: liveSolve.stages.hard.moves,
      },
    };

    const candidate: MoveTwoPuzzle = {
      ...draft,
      version: 3,
      id: `m2-admin-${targetDate}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      title: title.trim() || draft.title || "Terracotta Span",
      stages: syncedStages,
      par: syncedStages.medium.par,
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
      preview: `Bloxorz 6×6 (Par ${syncedStages.easy.par}) · 8×8 (Par ${syncedStages.medium.par}) · 10×10 (Par ${syncedStages.hard.par})`,
      details: [
        `Easy (6×6): BFS Par ${syncedStages.easy.par} moves`,
        `Medium (8×8): BFS Par ${syncedStages.medium.par} moves`,
        `Hard (10×10): BFS Par ${syncedStages.hard.par} moves`,
      ],
      playImmediately,
    });
  };

  const previewInitBlock = useMemo(
    () => getInitialBlockState(activeStage),
    [activeStage]
  );

  return (
    <div
      className="rounded-2xl border-2 border-black bg-white p-5 space-y-4 shadow-[4px_4px_0px_#000]"
      data-testid="admin-move-two"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Badge variant="green" className="mb-1">
            🟨 Move Two Bloxorz Studio (6×6 · 8×8 · 10×10)
          </Badge>
          <h3 className="font-headline font-black text-xl">
            3D Floating Island, Switch &amp; Bridge Level Architect
          </h3>
          <p className="text-xs text-gray-600">
            Pre-filled for {targetDate} with BFS-verified Easy (6×6), Medium (8×8), and Hard (10×10) Bloxorz stages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!canEdit}
            onClick={handleRerollAll}
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

      {/* Title Input + Difficulty Tabs */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full sm:max-w-xs">
          <label className="block text-xs font-bold mb-1">Puzzle Title</label>
          <Input
            value={title}
            disabled={!canEdit}
            placeholder="e.g. Terracotta Span"
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            data-testid="admin-move-two-title-input"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {MOVE_TWO_DIFFICULTIES.map((diff) => {
            const meta = MOVE_TWO_DIFFICULTY_META[diff];
            const solved = liveSolve.stages[diff];
            const active = activeDiff === diff;
            return (
              <button
                key={diff}
                type="button"
                onClick={() => setActiveDiff(diff)}
                data-testid={`admin-move-two-diff-${diff}`}
                className={cn(
                  "px-3 py-1.5 rounded-xl border-2 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  active
                    ? "border-black bg-black text-white shadow-[0_2px_0_#111]"
                    : "border-neutral-300 bg-neutral-50 text-neutral-800 hover:border-black"
                )}
              >
                <span>
                  {meta.label} ({meta.sizeLabel})
                </span>
                <span
                  className={cn(
                    "font-mono text-[10px] px-1.5 py-0.5 rounded-full",
                    solved.solvable
                      ? active
                        ? "bg-[#2ECC71] text-black"
                        : "bg-emerald-100 text-emerald-900"
                      : "bg-red-500 text-white"
                  )}
                >
                  {solved.solvable ? `Par ${solved.minMoves}` : "Unsolvable"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Paint Palette */}
      <div className="rounded-xl border border-neutral-200 bg-[#FAF9F5] p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-neutral-700">
            Paint Tile Tool ({MOVE_TWO_DIFFICULTY_META[activeDiff].label}{" "}
            {activeStage.size}×{activeStage.size}):
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canEdit}
            onClick={handleRerollActiveStage}
            className="h-7 text-[11px] font-bold border border-black"
          >
            <Shuffle className="h-3 w-3 mr-1" /> Reroll {activeStage.size}×
            {activeStage.size} Only
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PAINT_TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              disabled={!canEdit}
              onClick={() => setPaintTool(tool.id)}
              data-testid={`admin-move-two-tool-${tool.id}`}
              className={cn(
                "px-2.5 py-1 rounded-lg border-2 text-[11px] font-bold transition-all cursor-pointer",
                paintTool === tool.id
                  ? "border-black ring-2 ring-black bg-[#F7DA21] text-black"
                  : tool.swatchClass
              )}
            >
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      {/* Side-by-Side 2D Interactive Grid + Live 3D Bloxorz Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* 2D Tile Painter */}
        <div className="rounded-xl border-2 border-black bg-[#FAF9F6] p-3 space-y-3">
          <div className="flex items-center justify-between text-xs font-black uppercase">
            <span>
              2D Grid Editor ({activeStage.size}×{activeStage.size})
            </span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[11px] font-mono border",
                activeStageSolve.solvable
                  ? "bg-emerald-50 border-emerald-400 text-emerald-800"
                  : "bg-red-50 border-red-400 text-red-700"
              )}
            >
              {activeStageSolve.solvable
                ? `✓ BFS Par: ${activeStageSolve.minMoves} moves`
                : "Unsolvable"}
            </span>
          </div>

          <div
            className={cn(
              "grid gap-1 bg-neutral-200/80 p-1.5 rounded-xl border-2 border-black aspect-square",
              activeStage.size === 6
                ? "grid-cols-6"
                : activeStage.size === 8
                ? "grid-cols-8"
                : "grid-cols-10"
            )}
          >
            {Array.from({ length: activeStage.size }, (_, r) =>
              Array.from({ length: activeStage.size }, (_, c) => {
                const tile = activeStage.grid[r]![c]!;
                const isStart =
                  activeStage.start.r === r && activeStage.start.c === c;
                const isGoal =
                  activeStage.goal.r === r && activeStage.goal.c === c;
                const bridgeOwner = activeStage.bridges.find((b) =>
                  b.cells.some((cell) => cell.r === r && cell.c === c)
                );
                const sw = activeStage.switches.find(
                  (s) => s.r === r && s.c === c
                );

                return (
                  <button
                    key={`${r},${c}`}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => handleCellClick(r, c)}
                    data-testid={`admin-m2-${activeDiff}-cell-${r}-${c}`}
                    className={cn(
                      "w-full h-full aspect-square rounded-[3px] border flex items-center justify-center text-[10px] font-mono font-black transition-colors cursor-pointer",
                      isStart
                        ? "bg-[#F7DA21] border-black text-black"
                        : isGoal
                        ? "bg-[#2ECC71] border-[#14532D] text-black"
                        : tile === "void"
                        ? "bg-neutral-300/45 border-dashed border-neutral-400 text-neutral-400"
                        : tile === "fragile"
                        ? "bg-[#EF4444] border-[#991B1B] text-white"
                        : tile === "bridge"
                        ? "bg-[#DBEAFE] border-blue-700 text-blue-950"
                        : tile === "soft_switch"
                        ? "bg-sky-100 border-sky-700 text-sky-950"
                        : tile === "heavy_switch"
                        ? "bg-violet-100 border-violet-700 text-violet-950"
                        : "bg-white border-neutral-400 text-neutral-600 hover:bg-neutral-100"
                    )}
                  >
                    {isStart
                      ? "S"
                      : isGoal
                      ? "G"
                      : tile === "bridge"
                      ? bridgeOwner?.id ?? "B"
                      : tile === "soft_switch"
                      ? `○${sw?.bridgeId ?? ""}`
                      : tile === "heavy_switch"
                      ? `✕${sw?.bridgeId ?? ""}`
                      : tile === "fragile"
                      ? "!"
                      : ""}
                  </button>
                );
              })
            )}
          </div>

          {/* Bridge & Switch Inspector */}
          {(activeStage.bridges.length > 0 || activeStage.switches.length > 0) && (
            <div className="space-y-1.5 pt-1 border-t border-neutral-200 text-[11px]">
              {activeStage.bridges.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between bg-white rounded-lg border border-neutral-200 px-2.5 py-1"
                >
                  <span className="font-bold">
                    Bridge {b.id} ({b.cells.length} tiles)
                  </span>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => handleToggleBridgeInitiallyOpen(b.id)}
                    className="font-mono font-bold underline cursor-pointer text-blue-700"
                  >
                    {b.initiallyOpen ? "Initially Open" : "Initially Closed"}
                  </button>
                </div>
              ))}
              {activeStage.switches.map((sw) => (
                <div
                  key={`${sw.r},${sw.c}`}
                  className="flex items-center justify-between bg-white rounded-lg border border-neutral-200 px-2.5 py-1"
                >
                  <span className="font-semibold">
                    {sw.kind === "heavy" ? "✕ Heavy" : "○ Soft"} Switch (
                    {sw.r + 1},{sw.c + 1}) → Bridge {sw.bridgeId}
                  </span>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => handleCycleSwitchBehavior(sw.r, sw.c)}
                    className="font-mono font-bold underline cursor-pointer text-violet-700"
                  >
                    Mode: {sw.behavior}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live 3D Trimetric Bloxorz Preview */}
        <div className="rounded-xl border-2 border-black bg-[#FAF9F6] p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-black uppercase">
            <span>Live 3D Bloxorz Preview</span>
            <span className="font-mono text-[10px] text-neutral-500">
              Trimetric Camera
            </span>
          </div>
          <MoveTwoBloxorzCanvas
            stage={activeStage}
            bridgeMask={previewInitBlock.bridgeMask}
            pose={{ mode: "idle", state: previewInitBlock }}
            interactive={false}
            testId="admin-move-two-3d-preview"
          />
          {activeStageSolve.solvable && (
            <p className="font-mono text-[11px] text-neutral-600 break-words">
              Shortest path ({activeStageSolve.minMoves}m):{" "}
              {activeStageSolve.moves.join(" → ")}
            </p>
          )}
        </div>
      </div>

      {liveSolve.solvable ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 text-xs space-y-1">
          <p className="font-bold text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            All 3 Bloxorz Stages Verified — Easy (6×6): Par{" "}
            {liveSolve.stages.easy.minMoves} · Medium (8×8): Par{" "}
            {liveSolve.stages.medium.minMoves} · Hard (10×10): Par{" "}
            {liveSolve.stages.hard.minMoves}
          </p>
        </div>
      ) : (
        <p className="text-xs font-bold text-red-600">
          One or more difficulty boards are unsolvable — ensure Start and Goal are connected (or reachable via switches) before publishing.
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
