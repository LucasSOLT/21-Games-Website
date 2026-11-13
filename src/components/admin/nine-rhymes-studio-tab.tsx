"use client";

import React, { useMemo, useState } from "react";
import { Shuffle, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NINE_RHYMES_CLUE_COUNT,
  USABLE_RHYME_FAMILIES,
  buildPuzzleFromFamily,
  type NineRhymesPuzzle,
} from "@/data/puzzles/9-rhymes";
import { getDailyPuzzleForGame, getPuzzleNumberForDate } from "@/lib/daily-engine";
import { getAdminOverridesForGame } from "@/lib/game-storage";
import { draftToPuzzle, renderPrompt } from "@/lib/nine-rhymes-engine";
import type { AIHelperConfig } from "@/lib/ai-helper";
import {
  NineRhymesEditor,
  emptyNineRhymesEditorState,
  puzzleToEditorState,
  type NineRhymesEditorState,
} from "@/components/games/nine-rhymes-editor";
import type { GenericPublishRequest } from "@/components/admin/generic-publish";

interface NineRhymesStudioTabProps {
  targetDate: string;
  canEdit: boolean;
  editReason?: string;
  aiConfig?: AIHelperConfig;
  syncVersion?: number;
  onPublish: (req: GenericPublishRequest) => void;
}

/** `/admin` studio tab for 9 Rhymes: edit the 9 rows, AI-suggest a chain, preview, publish. */
export function NineRhymesStudioTab({
  targetDate,
  canEdit,
  editReason,
  aiConfig,
  syncVersion = 0,
  onPublish,
}: NineRhymesStudioTabProps) {
  const initial = useMemo(() => {
    void syncVersion;
    const resolved = getDailyPuzzleForGame<NineRhymesPuzzle>(
      "9-rhymes",
      targetDate,
      getAdminOverridesForGame("9-rhymes")
    );
    return resolved ? puzzleToEditorState(resolved.puzzle) : emptyNineRhymesEditorState();
  }, [targetDate, syncVersion]);

  const defaultState = useMemo(() => {
    const resolved = getDailyPuzzleForGame<NineRhymesPuzzle>("9-rhymes", targetDate, {});
    return resolved ? puzzleToEditorState(resolved.puzzle) : initial;
  }, [targetDate, initial]);

  const [editor, setEditor] = useState<NineRhymesEditorState>(initial);
  const [rerollCount, setRerollCount] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Reset the form whenever the selected date (or synced puzzle) changes.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setEditor(initial);
    setErrors([]);
  }

  const handleReroll = () => {
    const next = rerollCount + 1;
    setRerollCount(next);
    const family = USABLE_RHYME_FAMILIES[(next * 7 + targetDate.length + next) % USABLE_RHYME_FAMILIES.length]!;
    const puzzle = buildPuzzleFromFamily(family, `admin:${targetDate}:${next}`, {
      id: `9r-admin-${targetDate}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
    });
    setEditor(puzzleToEditorState(puzzle));
    setErrors([]);
  };

  const handleClearAll = () => {
    setEditor(emptyNineRhymesEditorState());
    setErrors([]);
  };

  const handleRevertDefault = () => {
    setEditor(defaultState);
    setErrors([]);
  };

  const buildPuzzle = (): NineRhymesPuzzle | null => {
    const { puzzle, errors: e } = draftToPuzzle({
      id: `9r-admin-${targetDate}`,
      title: editor.title,
      starterWord: editor.starterWord,
      rows: editor.rows,
      creatorName: "SOL Theory",
    });
    setErrors(e);
    if (!puzzle) return null;
    return { ...puzzle, puzzleNumber: getPuzzleNumberForDate(targetDate), customDate: targetDate, editor: "Daily Editorial" };
  };

  const handlePublish = (playImmediately: boolean) => {
    const puzzle = buildPuzzle();
    if (!puzzle) return;
    onPublish({
      gameSlug: "9-rhymes",
      gameTitle: "9 Rhymes",
      payload: puzzle,
      meta: {
        puzzleNumber: puzzle.puzzleNumber,
        title: puzzle.title,
        author: puzzle.author,
        editor: puzzle.editor,
      },
      preview: `Starter ${puzzle.starterWord.toUpperCase()} → ${puzzle.clues.map((c) => c.answer).join(", ")}`,
      details: [
        `Starter word: ${puzzle.starterWord}`,
        `${NINE_RHYMES_CLUE_COUNT} perfect rhymes`,
      ],
      playImmediately,
    });
  };

  const previewPuzzle = previewOpen ? buildPuzzle() : null;

  return (
    <div className="rounded-2xl border-2 border-black bg-white p-5 space-y-4 shadow-[4px_4px_0px_#000]" data-testid="admin-nine-rhymes">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Badge variant="yellow" className="mb-1">💬 9 Rhymes Studio</Badge>
          <h3 className="font-headline font-black text-xl">Craft the daily rhyme chain</h3>
          <p className="text-xs text-gray-600">
            One Starter Word + 9 perfect rhymes for {targetDate}. Use “Suggest chain” for an AI (or local dictionary) draft.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={!canEdit} onClick={handleReroll} className="border-2 border-black font-bold text-xs">
            <Shuffle className="h-4 w-4 mr-1" /> Reroll seed
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClearAll}
            data-testid="admin-9-rhymes-clear-all"
            className="border-2 border-black font-bold text-xs"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Clear All
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleRevertDefault}
            data-testid="admin-9-rhymes-revert-default"
            className="border-2 border-black font-bold text-xs"
          >
            <RotateCcw className="h-4 w-4 mr-1" /> Revert to Default
          </Button>
        </div>
      </div>

      {!canEdit && editReason && (
        <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded-lg p-2">{editReason}</p>
      )}

      <fieldset disabled={!canEdit} className="contents">
        <NineRhymesEditor value={editor} onChange={setEditor} aiConfig={aiConfig} />
      </fieldset>

      {errors.length > 0 && (
        <ul className="rounded-xl border-2 border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-700 list-disc list-inside space-y-0.5">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setPreviewOpen((v) => !v)} className="border-2 border-black font-bold">
          {previewOpen ? "Hide preview" : "Preview chat prompts"}
        </Button>
        <Button type="button" disabled={!canEdit} onClick={() => handlePublish(false)} className="bg-black text-white font-bold border-2 border-black" data-testid="admin-nine-publish">
          Publish for {targetDate}
        </Button>
        <Button type="button" disabled={!canEdit} variant="outline" onClick={() => handlePublish(true)} className="border-2 border-black font-bold">
          Publish &amp; play
        </Button>
      </div>

      {previewPuzzle && (
        <div className="rounded-xl bg-neutral-100 p-3 space-y-2" data-testid="admin-nine-preview">
          <p className="text-xs font-bold">Here&apos;s today&apos;s word: {previewPuzzle.starterWord.toUpperCase()}</p>
          {previewPuzzle.clues.map((c, i) => (
            <p key={i} className="text-xs whitespace-pre-line bg-white rounded-lg px-2.5 py-1.5 border border-neutral-200">
              <strong>{i + 1}.</strong> {renderPrompt(c)}
              <span className="block text-neutral-500">Hint: {c.hint}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
