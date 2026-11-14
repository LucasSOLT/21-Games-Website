"use client";

import React, { useState } from "react";
import { ImagePlus, RotateCcw, Sparkles } from "lucide-react";
import {
  SIX_PICS_COUNT,
  SIX_PICS_PIECES_PER_IMAGE,
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
      hint: "",
      scene: DEFAULT_SCENES[i % DEFAULT_SCENES.length]!,
      imageUrl: "",
      initialPiece: undefined,
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
      hint: img.hint ?? "",
      scene: img.scene,
      imageUrl: img.imageUrl ?? "",
      initialPiece: img.initialPiece,
    })),
  };
}

/**
 * Center-crops an uploaded device image to `4:3` and compresses it to a JPEG `data:` URL
 * so Admin Studio (`640×480`) and Creator Mode (`360×270`, `< 9.5KB` per photo) persist cleanly.
 */
async function compressImageFileToDataUrl(
  file: File,
  compact: boolean
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode image file."));
      el.src = objectUrl;
    });

    const targetW = compact ? 360 : 640;
    const targetH = compact ? 270 : 480;
    const targetAspect = targetW / targetH;

    const srcW = Math.max(1, img.naturalWidth || img.width);
    const srcH = Math.max(1, img.naturalHeight || img.height);
    const srcAspect = srcW / srcH;

    let sx = 0;
    let sy = 0;
    let sw = srcW;
    let sh = srcH;
    if (srcAspect > targetAspect) {
      sw = srcH * targetAspect;
      sx = (srcW - sw) / 2;
    } else if (srcAspect < targetAspect) {
      sh = srcW / targetAspect;
      sy = (srcH - sh) / 2;
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable.");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

    const maxChars = compact ? 9_500 : 120_000;
    const qualities = compact ? [0.58, 0.46, 0.36] : [0.8, 0.68, 0.56];
    let out = canvas.toDataURL("image/jpeg", qualities[0]);
    for (let i = 1; i < qualities.length && out.length > maxChars; i++) {
      out = canvas.toDataURL("image/jpeg", qualities[i]);
    }
    return out;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

interface SixPicsEditorProps {
  value: SixPicsEditorState;
  onChange: (next: SixPicsEditorState) => void;
  aiConfig?: AIHelperConfig;
  /** Uses tighter compression (`360×270`) when saving to `custom_puzzles` (`<= 64 KB` payload limit). */
  compactPhotos?: boolean;
}

export function SixPicsEditor({
  value,
  onChange,
  aiConfig,
  compactPhotos = false,
}: SixPicsEditorProps) {
  const [generatingIdx, setGeneratingIdx] = useState<number | "all" | null>(null);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const updateRow = (index: number, patch: Partial<SixPicsDraftRow>) => {
    const nextRows = value.rows.map((row, i) =>
      i === index ? { ...row, ...patch } : row
    );
    onChange({ ...value, rows: nextRows });
  };

  const handlePhotoUpload = async (index: number, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError(`Pic #${index + 1}: Please choose a valid image file.`);
      return;
    }
    setUploadError(null);
    setUploadingIdx(index);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, compactPhotos);
      updateRow(index, { imageUrl: dataUrl });
    } catch {
      setUploadError(
        `Pic #${index + 1}: Could not read that photo. Please try a JPG, PNG, or WebP image.`
      );
    } finally {
      setUploadingIdx(null);
    }
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

      {uploadError && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
          {uploadError}
        </p>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-extrabold uppercase tracking-wider text-neutral-600">
            6 Hidden Pictures (SVG Default · Upload Real Photos, Edit Names &amp; Hints)
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
            const hasUploadedDataPhoto = row.imageUrl.trim().startsWith("data:image/");
            const hasCustomImage = row.imageUrl.trim().length > 0;
            return (
              <div
                key={idx}
                className="rounded-xl border-2 border-neutral-200 bg-neutral-50 p-2.5 flex gap-2.5 items-start"
              >
                <div className="w-20 shrink-0 space-y-1.5">
                  <div className="w-20 h-16 rounded-lg overflow-hidden border border-black/30 bg-white">
                    <ImageWithFallback
                      src={row.imageUrl.trim() || fallbackUri}
                      alt={`Picture ${idx + 1} preview`}
                      className="w-full h-full object-cover"
                      fallbackSvgTitle={`Pic ${idx + 1}`}
                    />
                  </div>
                  <label
                    className="inline-flex w-full cursor-pointer items-center justify-center gap-1 rounded-md border border-black bg-white hover:bg-neutral-100 px-1.5 py-1 text-[10px] font-black text-black shadow-2xs"
                    data-testid={`six-pics-upload-label-${idx}`}
                  >
                    <ImagePlus className="h-3 w-3 shrink-0" />
                    {uploadingIdx === idx
                      ? "Loading…"
                      : hasUploadedDataPhoto
                      ? "Change"
                      : "Photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      data-testid={`six-pics-upload-${idx}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.currentTarget.value = "";
                        void handlePhotoUpload(idx, file);
                      }}
                    />
                  </label>
                  {hasCustomImage && (
                    <button
                      type="button"
                      onClick={() => updateRow(idx, { imageUrl: "" })}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-neutral-300 bg-white hover:border-black px-1.5 py-0.5 text-[10px] font-bold text-neutral-700"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      Use SVG
                    </button>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black">Pic #{idx + 1}</span>
                    <div className="flex items-center gap-1">
                      <select
                        aria-label={`Pic ${idx + 1} starting open piece`}
                        title="Starting open puzzle piece"
                        value={
                          row.initialPiece !== undefined
                            ? String(row.initialPiece)
                            : ""
                        }
                        onChange={(e) =>
                          updateRow(idx, {
                            initialPiece:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                        className="rounded border border-neutral-300 bg-white px-1 py-0.5 text-[10px] font-semibold"
                      >
                        <option value="">Auto 1st</option>
                        {Array.from(
                          { length: SIX_PICS_PIECES_PER_IMAGE },
                          (_, pIdx) => (
                            <option key={pIdx} value={String(pIdx)}>
                              Open #{pIdx + 1}
                            </option>
                          )
                        )}
                      </select>

                      <select
                        aria-label={`Pic ${idx + 1} illustrated scene`}
                        value={row.scene}
                        onChange={(e) =>
                          updateRow(idx, { scene: e.target.value as SixPicsSceneKey })
                        }
                        className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold max-w-[105px]"
                      >
                        {SIX_PICS_SCENES.map((sc) => (
                          <option key={sc} value={sc}>
                            {sc}
                          </option>
                        ))}
                      </select>
                    </div>
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
                    value={row.hint ?? ""}
                    onChange={(e) => updateRow(idx, { hint: e.target.value })}
                    placeholder="Optional hint for players (e.g., Erupting mountain)"
                    maxLength={140}
                    className="h-7 text-[11px]"
                    data-testid={`six-pics-hint-input-${idx}`}
                  />
                  {hasUploadedDataPhoto ? (
                    <p className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-900 truncate">
                      📷 Custom device photo attached
                    </p>
                  ) : (
                    <Input
                      value={row.imageUrl}
                      onChange={(e) => updateRow(idx, { imageUrl: e.target.value })}
                      placeholder="Or paste external image URL (optional)"
                      className="h-7 text-[11px]"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
