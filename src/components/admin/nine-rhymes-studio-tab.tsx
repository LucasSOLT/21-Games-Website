"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Shuffle, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  defaultAuthor?: string;
  defaultEditor?: string;
  onDraftChange?: (draft: unknown) => void;
  onDirty?: () => void;
  onPublish: (req: GenericPublishRequest) => void;
}

/** `/admin` studio tab for 9 Rhymes: edit the 9 rows, AI-suggest a chain, preview, publish. */
export function NineRhymesStudioTab({
  targetDate,
  canEdit,
  editReason,
  aiConfig,
  syncVersion = 0,
  defaultAuthor = "SOL Theory",
  defaultEditor = "Daily Editorial",
  onDraftChange,
  onDirty,
  onPublish,
}: NineRhymesStudioTabProps) {
  const resolvedInitial = useMemo(() => {
    void syncVersion;
    return getDailyPuzzleForGame<NineRhymesPuzzle>(
      "9-rhymes",
      targetDate,
      getAdminOverridesForGame("9-rhymes")
    )?.puzzle ?? null;
  }, [targetDate, syncVersion]);

  const initial = useMemo(
    () => (resolvedInitial ? puzzleToEditorState(resolvedInitial) : emptyNineRhymesEditorState()),
    [resolvedInitial]
  );

  const resolvedDefault = useMemo(
    () => getDailyPuzzleForGame<NineRhymesPuzzle>("9-rhymes", targetDate, {})?.puzzle ?? null,
    [targetDate]
  );

  const defaultState = useMemo(
    () => (resolvedDefault ? puzzleToEditorState(resolvedDefault) : initial),
    [resolvedDefault, initial]
  );

  const [editor, setEditor] = useState<NineRhymesEditorState>(initial);
  const [author, setAuthor] = useState<string>(
    resolvedInitial?.author || defaultAuthor || "SOL Theory"
  );
  const [editorName, setEditorName] = useState<string>(
    resolvedInitial?.editor || defaultEditor || "Daily Editorial"
  );
  const [rerollCount, setRerollCount] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Reset the form whenever the selected date (or synced puzzle) changes.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setEditor(initial);
    setAuthor(resolvedInitial?.author || defaultAuthor || "SOL Theory");
    setEditorName(resolvedInitial?.editor || defaultEditor || "Daily Editorial");
    setErrors([]);
  }

  const liveDraft = useMemo<NineRhymesPuzzle>(() => {
    const cleanAuthor = author.trim() || defaultAuthor || "SOL Theory";
    const cleanEditor = editorName.trim() || defaultEditor || "Daily Editorial";
    const parsed = draftToPuzzle({
      id: `9r-admin-${targetDate}`,
      title: editor.title,
      starterWord: editor.starterWord,
      rows: editor.rows,
      creatorName: cleanAuthor,
    });
    if (parsed.puzzle) {
      return {
        ...parsed.puzzle,
        puzzleNumber: getPuzzleNumberForDate(targetDate),
        author: cleanAuthor,
        editor: cleanEditor,
        customDate: targetDate,
      };
    }
    return {
      id: `9r-admin-${targetDate}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      title: editor.title.trim() || "9 Rhymes Draft",
      starterWord: editor.starterWord.trim().toLowerCase() || "day",
      author: cleanAuthor,
      editor: cleanEditor,
      clues: Array.from({ length: 9 }, (_, i) => {
        const row = editor.rows[i];
        return {
          answer: (row?.answer ?? "").trim().toLowerCase(),
          altSpellings: (row?.altSpellings ?? "")
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
          sentence: row?.sentence ?? "",
          hint: row?.hint ?? "",
        };
      }),
      customDate: targetDate,
    };
  }, [author, defaultAuthor, defaultEditor, editor, editorName, targetDate]);

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
    const family = USABLE_RHYME_FAMILIES[(next * 7 + targetDate.length + next) % USABLE_RHYME_FAMILIES.length]!;
    const puzzle = buildPuzzleFromFamily(family, `admin:${targetDate}:${next}`, {
      id: `9r-admin-${targetDate}`,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
    });
    setEditor(puzzleToEditorState(puzzle));
    setErrors([]);
    onDirty?.();
  };

  const handleClearAll = () => {
    setEditor(emptyNineRhymesEditorState());
    setAuthor("");
    setEditorName("");
    setErrors([]);
    onDirty?.();
  };

  const handleRevertDefault = () => {
    setEditor(defaultState);
    setAuthor(resolvedDefault?.author || defaultAuthor || "SOL Theory");
    setEditorName(resolvedDefault?.editor || defaultEditor || "Daily Editorial");
    setErrors([]);
    onDirty?.();
  };

  const buildPuzzle = (): NineRhymesPuzzle | null => {
    const cleanAuthor = author.trim() || defaultAuthor || "SOL Theory";
    const cleanEditor = editorName.trim() || defaultEditor || "Daily Editorial";
    const { puzzle, errors: e } = draftToPuzzle({
      id: `9r-admin-${targetDate}`,
      title: editor.title,
      starterWord: editor.starterWord,
      rows: editor.rows,
      creatorName: cleanAuthor,
    });
    setErrors(e);
    if (!puzzle) return null;
    return {
      ...puzzle,
      puzzleNumber: getPuzzleNumberForDate(targetDate),
      customDate: targetDate,
      author: cleanAuthor,
      editor: cleanEditor,
    };
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
        `Author: ${puzzle.author} · Editor: ${puzzle.editor}`,
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
            Author
          </label>
          <Input
            disabled={!canEdit}
            value={author}
            onChange={(e) => {
              setAuthor(e.target.value);
              onDirty?.();
            }}
            placeholder={defaultAuthor}
            className="text-base sm:text-sm"
            data-testid="admin-9-rhymes-author"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
            Editor
          </label>
          <Input
            disabled={!canEdit}
            value={editorName}
            onChange={(e) => {
              setEditorName(e.target.value);
              onDirty?.();
            }}
            placeholder={defaultEditor}
            className="text-base sm:text-sm"
            data-testid="admin-9-rhymes-editor"
          />
        </div>
      </div>

      <fieldset disabled={!canEdit} className="contents">
        <NineRhymesEditor
          value={editor}
          onChange={(next) => {
            setEditor(next);
            onDirty?.();
          }}
          aiConfig={aiConfig}
        />
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
