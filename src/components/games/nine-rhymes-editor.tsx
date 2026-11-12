"use client";

import React, { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { suggest9RhymesChain, resolveAIProvider, type AIHelperConfig } from "@/lib/ai-helper";
import { NINE_RHYMES_CLUE_COUNT, type NineRhymesPuzzle } from "@/data/puzzles/9-rhymes";
import type { CreatorDraftRow } from "@/lib/nine-rhymes-engine";
import { cn } from "@/lib/utils";

export interface NineRhymesEditorState {
  title: string;
  starterWord: string;
  rows: CreatorDraftRow[];
}

export function emptyNineRhymesEditorState(): NineRhymesEditorState {
  return {
    title: "",
    starterWord: "",
    rows: Array.from({ length: NINE_RHYMES_CLUE_COUNT }, () => ({
      answer: "",
      altSpellings: "",
      sentence: "",
      hint: "",
    })),
  };
}

export function puzzleToEditorState(p: NineRhymesPuzzle): NineRhymesEditorState {
  return {
    title: p.title,
    starterWord: p.starterWord,
    rows: p.clues.map((c) => ({
      answer: c.answer,
      altSpellings: (c.altSpellings ?? []).join(", "),
      sentence: c.sentence,
      hint: c.hint,
    })),
  };
}

interface NineRhymesEditorProps {
  value: NineRhymesEditorState;
  onChange: (next: NineRhymesEditorState) => void;
  aiConfig?: AIHelperConfig;
  className?: string;
}

const inputCls =
  "w-full px-2.5 py-1.5 rounded-lg border-2 border-neutral-300 text-sm font-medium focus:border-black focus:outline-hidden bg-white";

/**
 * Shared 9 Rhymes authoring form (Creator Mode + /admin studio). Each of the 9 rows has:
 * Primary Answer (sets the letter count), Accepted Alternative Spellings, Fill-in-the-Blank
 * Sentence, Description Hint (Q19), plus the AI rhyme-chain assistant.
 */
export function NineRhymesEditor({ value, onChange, aiConfig, className }: NineRhymesEditorProps) {
  const [suggesting, setSuggesting] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const setRow = (i: number, patch: Partial<CreatorDraftRow>) =>
    onChange({ ...value, rows: value.rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });

  const handleSuggest = async () => {
    const starter = value.starterWord.trim();
    if (!starter) {
      setNote("Type a Starter Word first.");
      return;
    }
    setSuggesting(true);
    setNote(null);
    try {
      const draft = await suggest9RhymesChain(starter, aiConfig);
      if (draft.clues.length === 0) {
        setNote("No rhymes found for that word — try another starter.");
        return;
      }
      onChange({
        ...value,
        title: value.title || `Rhymes with “${draft.starterWord}”`,
        rows: value.rows.map((r, i) => {
          const c = draft.clues[i];
          if (!c) return r;
          return {
            answer: c.answer,
            altSpellings: (c.altSpellings ?? []).join(", "),
            sentence: c.sentence,
            hint: c.hint,
          };
        }),
      });
      setNote(
        `Filled ${draft.clues.length} rows via ${
          resolveAIProvider(aiConfig) === "local" ? "the local rhyme dictionary" : "AI"
        }. Review & edit before publishing.`
      );
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block text-xs font-bold text-neutral-700">
          Puzzle title (optional)
          <input
            className={cn(inputCls, "mt-1")}
            value={value.title}
            maxLength={80}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="Rhymes with “time”"
          />
        </label>
        <label className="block text-xs font-bold text-neutral-700">
          Starter Word
          <div className="mt-1 flex gap-2">
            <input
              className={inputCls}
              value={value.starterWord}
              maxLength={15}
              onChange={(e) => onChange({ ...value, starterWord: e.target.value })}
              placeholder="time"
              data-testid="nine-starter-input"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleSuggest}
              disabled={suggesting}
              className="shrink-0 border-2 border-black font-bold text-xs h-9"
              data-testid="nine-suggest-button"
            >
              {suggesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1 text-[#9D50BB]" />
              )}
              Suggest chain
            </Button>
          </div>
        </label>
      </div>
      {note && <p className="text-xs font-semibold text-neutral-600">{note}</p>}

      <div className="space-y-2">
        {value.rows.map((row, i) => (
          <div
            key={i}
            className="rounded-xl border-2 border-black/15 bg-neutral-50 p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2"
          >
            <div className="sm:col-span-2 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wide text-neutral-500">
                Word {i + 1}
              </span>
              <span className="text-[11px] font-mono text-neutral-500">
                {row.answer.replace(/[^a-z]/gi, "").length} letters
              </span>
            </div>
            <input
              className={inputCls}
              placeholder="Primary answer"
              value={row.answer}
              maxLength={15}
              onChange={(e) => setRow(i, { answer: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="Alt spellings (comma separated)"
              value={row.altSpellings}
              onChange={(e) => setRow(i, { altSpellings: e.target.value })}
            />
            <input
              className={cn(inputCls, "sm:col-span-2")}
              placeholder="Fill-in-the-blank sentence (use ___ for the blank)"
              value={row.sentence}
              maxLength={240}
              onChange={(e) => setRow(i, { sentence: e.target.value })}
            />
            <input
              className={cn(inputCls, "sm:col-span-2")}
              placeholder="Description hint"
              value={row.hint}
              maxLength={240}
              onChange={(e) => setRow(i, { hint: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
