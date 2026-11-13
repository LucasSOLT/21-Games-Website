"use client";

import React, { useMemo, useState } from "react";
import { RotateCcw, Shuffle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SIX_PICS_COUNT,
  SIX_PICS_PUZZLES,
  draftToSixPicsPuzzle,
  renderSixPicsSceneDataUri,
  type SixPicsPuzzle,
} from "@/data/puzzles/6-pics";
import { getDailyPuzzleForGame, getPuzzleNumberForDate } from "@/lib/daily-engine";
import { getAdminOverridesForGame } from "@/lib/game-storage";
import type { AIHelperConfig } from "@/lib/ai-helper";
import {
  SixPicsEditor,
  emptySixPicsEditorState,
  puzzleToSixPicsEditorState,
  type SixPicsEditorState,
} from "@/components/games/six-pics-editor";
import { ImageWithFallback } from "@/components/image-with-fallback";
import type { GenericPublishRequest } from "@/components/admin/generic-publish";

interface SixPicsStudioTabProps {
  targetDate: string;
  canEdit: boolean;
  editReason?: string;
  aiConfig?: AIHelperConfig;
  syncVersion?: number;
  onPublish: (req: GenericPublishRequest) => void;
}

export function SixPicsStudioTab({
  targetDate,
  canEdit,
  editReason,
  aiConfig,
  syncVersion = 0,
  onPublish,
}: SixPicsStudioTabProps) {
  const initial = useMemo<SixPicsEditorState>(() => {
    void syncVersion;
    const resolved = getDailyPuzzleForGame<SixPicsPuzzle>(
      "6-pics",
      targetDate,
      getAdminOverridesForGame("6-pics")
    );
    return resolved
      ? puzzleToSixPicsEditorState(resolved.puzzle)
      : emptySixPicsEditorState();
  }, [targetDate, syncVersion]);

  const defaultState = useMemo<SixPicsEditorState>(() => {
    const resolved = getDailyPuzzleForGame<SixPicsPuzzle>("6-pics", targetDate, {});
    return resolved
      ? puzzleToSixPicsEditorState(resolved.puzzle)
      : initial;
  }, [targetDate, initial]);

  const [editor, setEditor] = useState<SixPicsEditorState>(initial);
  const [rerollCount, setRerollCount] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setEditor(initial);
    setErrors([]);
  }

  const handleReroll = () => {
    const next = rerollCount + 1;
    setRerollCount(next);
    const pick =
      SIX_PICS_PUZZLES[(next * 11 + targetDate.length) % SIX_PICS_PUZZLES.length]!;
    setEditor(puzzleToSixPicsEditorState(pick));
    setErrors([]);
  };

  const handleClearAll = () => {
    const base = emptySixPicsEditorState();
    setEditor({
      ...base,
      title: "",
      themeAnswer: "",
      aliasesCsv: "",
      rows: base.rows.map((r) => ({
        ...r,
        caption: "",
        aliasesCsv: "",
        imageUrl: "",
      })),
    });
    setErrors([]);
  };

  const handleRevertDefault = () => {
    setEditor(defaultState);
    setErrors([]);
  };

  const buildPuzzle = (): SixPicsPuzzle | null => {
    const { puzzle, errors: e } = draftToSixPicsPuzzle({
      id: `6p-admin-${targetDate}`,
      title: editor.title,
      themeAnswer: editor.themeAnswer,
      aliasesCsv: editor.aliasesCsv,
      rows: editor.rows,
      creatorName: "SOL Theory",
    });
    setErrors(e);
    if (!puzzle) return null;
    return {
      ...puzzle,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      editor: "Daily Editorial",
      customDate: targetDate,
    };
  };

  const handlePublish = (playImmediately: boolean) => {
    const puzzle = buildPuzzle();
    if (!puzzle) return;
    onPublish({
      gameSlug: "6-pics",
      gameTitle: "6 Pics",
      payload: puzzle,
      meta: {
        puzzleNumber: puzzle.puzzleNumber,
        title: puzzle.title,
        author: puzzle.author,
        editor: puzzle.editor,
      },
      preview: `Theme: ${puzzle.themeAnswer} · Answers: ${puzzle.images.map((i) => i.caption).join(", ")}`,
      details: [
        `Visible overarching theme: ${puzzle.themeAnswer}`,
        `${SIX_PICS_COUNT} jigsaw-covered pictures (36 pts max)`,
        `Per-image accepted synonyms + 1-letter typo forgiveness`,
      ],
      playImmediately,
    });
  };

  const previewPuzzle = previewOpen ? buildPuzzle() : null;

  return (
    <div
      className="rounded-2xl border-2 border-black bg-white p-5 space-y-4 shadow-[4px_4px_0px_#000]"
      data-testid="admin-six-pics"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Badge variant="yellow" className="mb-1">
            🖼️ 6 Pics Studio
          </Badge>
          <h3 className="font-headline font-black text-xl">
            Curate overarching theme &amp; 6 jigsaw-covered pictures
          </h3>
          <p className="text-xs text-gray-600">
            Schedule {targetDate} — players see the overarching theme at top and uncover 1/6 jigsaw pieces to name each picture (36 pts max).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!canEdit}
            onClick={handleReroll}
            className="border-2 border-black font-bold text-xs"
          >
            <Shuffle className="h-4 w-4 mr-1" /> Load Bank Preset
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClearAll}
            data-testid="admin-6-pics-clear-all"
            className="border-2 border-black font-bold text-xs"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Clear All
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleRevertDefault}
            data-testid="admin-6-pics-revert-default"
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

      <fieldset disabled={!canEdit} className="contents">
        <SixPicsEditor value={editor} onChange={setEditor} aiConfig={aiConfig} />
      </fieldset>

      {errors.length > 0 && (
        <ul className="rounded-xl border-2 border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-700 list-disc list-inside space-y-0.5">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPreviewOpen((v) => !v)}
          className="border-2 border-black font-bold"
        >
          {previewOpen ? "Hide 2×3 summary preview" : "Preview 2×3 summary grid"}
        </Button>
        <Button
          type="button"
          disabled={!canEdit}
          onClick={() => handlePublish(false)}
          className="bg-black text-white font-bold border-2 border-black"
          data-testid="admin-six-pics-publish"
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

      {previewPuzzle && (
        <div className="rounded-xl border-2 border-neutral-200 bg-neutral-50 p-4 space-y-3">
          <p className="text-center font-headline font-black text-xl">
            {previewPuzzle.themeAnswer}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {previewPuzzle.images.map((img, i) => (
              <div
                key={i}
                className="rounded-lg border border-black bg-white overflow-hidden"
              >
                <div className="aspect-[4/3]">
                  <ImageWithFallback
                    src={img.imageUrl || renderSixPicsSceneDataUri(img, i)}
                    alt={img.caption}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="px-2 py-1 text-xs font-bold border-t border-black truncate">
                  {i + 1}. {img.caption}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
