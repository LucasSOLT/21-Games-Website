"use client";

import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import {
  SIX_PICS_COUNT,
  SIX_PICS_SCENES,
  renderSixPicsSceneDataUri,
  type SixPicsDraftRow,
  type SixPicsPuzzle,
  type SixPicsSceneKey,
} from "@/data/puzzles/6-pics";
import { generate6PicsSynonyms, type AIHelperConfig } from "@/lib/ai-helper";
import { ImageWithFallback } from "@/components/image-with-fallback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface SixPicsEditorState {
  title: string;
  themeAnswer: string;
  aliasesCsv: string;
  rows: SixPicsDraftRow[];
}

const DEFAULT_SCENES: readonly SixPicsSceneKey[] = [
  "waves",
  "volcano",
  "palm-island",
  "surfboard",
  "campfire",
  "flower-lei",
];

export function emptySixPicsEditorState(): SixPicsEditorState {
  return {
    title: "Connect the Six",
    themeAnswer: "",
    aliasesCsv: "",
    rows: Array.from({ length: SIX_PICS_COUNT }, (_, i) => ({
      caption: "",
      scene: DEFAULT_SCENES[i % DEFAULT_SCENES.length]!,
      imageUrl: "",
    })),
  };
}

export function puzzleToSixPicsEditorState(puzzle: SixPicsPuzzle): SixPicsEditorState {
  return {
    title: puzzle.title,
    themeAnswer: puzzle.themeAnswer,
    aliasesCsv: puzzle.acceptedAliases.join(", "),
    rows: puzzle.images.map((img) => ({
      caption: img.caption,
      scene: img.scene,
      imageUrl: img.imageUrl ?? "",
    })),
  };
}

interface SixPicsEditorProps {
  value: SixPicsEditorState;
  onChange: (next: SixPicsEditorState) => void;
  aiConfig?: AIHelperConfig;
}

export function SixPicsEditor({ value, onChange, aiConfig }: SixPicsEditorProps) {
  const [generatingAliases, setGeneratingAliases] = useState(false);

  const handleAutoAliases = async () => {
    const theme = value.themeAnswer.trim();
    if (!theme) return;
    setGeneratingAliases(true);
    try {
      const suggestions = await generate6PicsSynonyms(theme, aiConfig);
      const existing = value.aliasesCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const merged = [...new Set([...existing, ...suggestions])].slice(0, 16);
      onChange({ ...value, aliasesCsv: merged.join(", ") });
    } finally {
      setGeneratingAliases(false);
    }
  };

  const updateRow = (index: number, patch: Partial<SixPicsDraftRow>) => {
    const nextRows = value.rows.map((row, i) =>
      i === index ? { ...row, ...patch } : row
    );
    onChange({ ...value, rows: nextRows });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-bold">
            Overarching Theme Answer <span className="text-red-600">*</span>
          </label>
          <div className="flex gap-2">
            <Input
              value={value.themeAnswer}
              onChange={(e) => onChange({ ...value, themeAnswer: e.target.value })}
              placeholder="e.g., Hawaii"
              maxLength={48}
              data-testid="six-pics-theme-input"
            />
            <Button
              type="button"
              variant="outline"
              disabled={!value.themeAnswer.trim() || generatingAliases}
              onClick={handleAutoAliases}
              className="shrink-0 border-2 border-black bg-[#f4d621]/40 hover:bg-[#f4d621]/70 font-bold text-xs"
              data-testid="six-pics-auto-synonyms"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              {generatingAliases ? "Generating…" : "✨ Auto-Generate Synonyms/Aliases"}
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold">
            Editorial Subtitle (non-spoiler)
          </label>
          <Input
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="Connect the Six"
            maxLength={50}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-bold">
          Accepted Synonyms / Aliases (comma-separated, 1-letter typo forgiveness automatic)
        </label>
        <Input
          value={value.aliasesCsv}
          onChange={(e) => onChange({ ...value, aliasesCsv: e.target.value })}
          placeholder="hawaiian islands, aloha state, maui"
          maxLength={320}
          data-testid="six-pics-aliases-input"
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-extrabold uppercase tracking-wider text-neutral-600">
          6 Progressive Visual Clues (#1 Free Start → #6 Clincher)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {value.rows.map((row, idx) => {
            const fallbackUri = renderSixPicsSceneDataUri({ scene: row.scene }, idx);
            return (
              <div
                key={idx}
                className="rounded-xl border-2 border-neutral-200 bg-neutral-50 p-2.5 flex gap-2.5 items-start"
              >
                <div className="w-20 h-16 rounded-lg overflow-hidden border border-black/30 bg-white shrink-0">
                  <ImageWithFallback
                    src={row.imageUrl.trim() || fallbackUri}
                    alt={`Clue ${idx + 1} preview`}
                    className="w-full h-full object-cover"
                    fallbackSvgTitle={`Pic ${idx + 1}`}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black">Pic #{idx + 1}</span>
                    <select
                      aria-label={`Pic ${idx + 1} illustrated scene`}
                      value={row.scene}
                      onChange={(e) =>
                        updateRow(idx, { scene: e.target.value as SixPicsSceneKey })
                      }
                      className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold"
                    >
                      {SIX_PICS_SCENES.map((sc) => (
                        <option key={sc} value={sc}>
                          {sc}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    value={row.caption}
                    onChange={(e) => updateRow(idx, { caption: e.target.value })}
                    placeholder={`Post-game caption #${idx + 1} (e.g., Ocean)`}
                    maxLength={50}
                    className="h-8 text-xs"
                  />
                  <Input
                    value={row.imageUrl}
                    onChange={(e) => updateRow(idx, { imageUrl: e.target.value })}
                    placeholder="Optional custom image/SVG URL"
                    className="h-7 text-[11px]"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
