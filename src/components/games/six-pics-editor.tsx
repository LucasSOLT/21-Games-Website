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
    title: "Six Hidden Pictures",
    themeAnswer: "",
    aliasesCsv: "",
    rows: Array.from({ length: SIX_PICS_COUNT }, (_, i) => ({
      caption: "",
      aliasesCsv: "",
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
      aliasesCsv: (img.aliases ?? []).join(", "),
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
  const [generatingIdx, setGeneratingIdx] = useState<number | "all" | null>(null);

  const updateRow = (index: number, patch: Partial<SixPicsDraftRow>) => {
    const nextRows = value.rows.map((row, i) =>
      i === index ? { ...row, ...patch } : row
    );
    onChange({ ...value, rows: nextRows });
  };

  const handleAutoAliasesForRow = async (index: number) => {
    const row = value.rows[index];
    const word = row?.caption.trim();
    if (!word) return;
    setGeneratingIdx(index);
    try {
      const suggestions = await generate6PicsSynonyms(word, aiConfig);
      const existing = (row.aliasesCsv ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const merged = [...new Set([...existing, ...suggestions])].slice(0, 16);
      updateRow(index, { aliasesCsv: merged.join(", ") });
    } finally {
      setGeneratingIdx(null);
    }
  };

  const handleAutoAliasesAll = async () => {
    setGeneratingIdx("all");
    try {
      const nextRows = await Promise.all(
        value.rows.map(async (row) => {
          const word = row.caption.trim();
          if (!word) return row;
          const suggestions = await generate6PicsSynonyms(word, aiConfig);
          const existing = (row.aliasesCsv ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const merged = [...new Set([...existing, ...suggestions])].slice(0, 16);
          return { ...row, aliasesCsv: merged.join(", ") };
        })
      );
      onChange({ ...value, rows: nextRows });
    } finally {
      setGeneratingIdx(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-bold">
            Overarching Theme (Shown to Players at Top) <span className="text-red-600">*</span>
          </label>
          <Input
            value={value.themeAnswer}
            onChange={(e) => onChange({ ...value, themeAnswer: e.target.value })}
            placeholder="e.g., Hawaii"
            maxLength={48}
            data-testid="six-pics-theme-input"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold">Editorial Subtitle</label>
          <Input
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="Six Hidden Pictures"
            maxLength={50}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-extrabold uppercase tracking-wider text-neutral-600">
            6 Hidden Pictures (Each Covered by 5/6 Jigsaw Pieces at Start)
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              generatingIdx !== null ||
              value.rows.every((r) => !r.caption.trim())
            }
            onClick={() => void handleAutoAliasesAll()}
            className="h-7 px-2.5 border-2 border-black bg-[#f4d621]/45 hover:bg-[#f4d621]/75 font-bold text-[11px]"
            data-testid="six-pics-auto-synonyms"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            {generatingIdx === "all"
              ? "Generating…"
              : "✨ Auto-Generate Synonyms/Aliases"}
          </Button>
        </div>

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
                    alt={`Picture ${idx + 1} preview`}
                    className="w-full h-full object-cover"
                    fallbackSvgTitle={`Pic ${idx + 1}`}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
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
                  <div className="flex gap-1">
                    <Input
                      value={row.caption}
                      onChange={(e) => updateRow(idx, { caption: e.target.value })}
                      placeholder={`Answer #${idx + 1} (e.g., Volcano)`}
                      maxLength={50}
                      className="h-8 text-xs font-semibold"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!row.caption.trim() || generatingIdx !== null}
                      onClick={() => void handleAutoAliasesForRow(idx)}
                      title="Auto-generate accepted synonyms for this picture"
                      className="h-8 px-2 border border-black bg-[#f4d621]/35 hover:bg-[#f4d621]/70 text-[10px] font-bold shrink-0"
                    >
                      <Sparkles className="h-3 w-3" />
                    </Button>
                  </div>
                  <Input
                    value={row.aliasesCsv ?? ""}
                    onChange={(e) => updateRow(idx, { aliasesCsv: e.target.value })}
                    placeholder="Accepted synonyms (comma-separated)"
                    maxLength={240}
                    className="h-7 text-[11px]"
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
