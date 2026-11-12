"use client";

import React, { useMemo, useState } from "react";
import { RotateCcw, Scissors, Shuffle } from "lucide-react";
import {
  buildStructuredHaikuLines,
  sliceWordByCuts,
} from "@/data/puzzles/17-syllables";
import { fnv1a32, mulberry32 } from "@/lib/seeded-random";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HaikuSliceCutterProps {
  lines: [string, string, string];
  customWordChunks: Record<string, string[]>;
  onChangeCustomWordChunks: (next: Record<string, string[]>) => void;
  disabled?: boolean;
}

function chunksToCuts(chunks: readonly string[]): number[] {
  const cuts: number[] = [];
  let acc = 0;
  for (let i = 0; i < chunks.length - 1; i++) {
    acc += chunks[i]!.length;
    cuts.push(acc);
  }
  return cuts;
}

/**
 * Interactive click-between-letters haiku slicer for `/admin` 17 Syllables Studio:
 * - Click between any two letters of a word to toggle a slice cut (`|`) on or off.
 * - Click "Reshuffle / Preview Slices" to preview randomized tray tile orders.
 */
export function HaikuSliceCutter({
  lines,
  customWordChunks,
  onChangeCustomWordChunks,
  disabled = false,
}: HaikuSliceCutterProps) {
  const [shuffleNonce, setShuffleNonce] = useState(0);

  const structured = useMemo(
    () => buildStructuredHaikuLines(lines, customWordChunks),
    [lines, customWordChunks]
  );

  const allChunks = useMemo(() => {
    const flat = structured.flatMap((line) =>
      line.words.flatMap((w) => w.chunks)
    );
    if (shuffleNonce === 0) return flat;
    const rand = mulberry32(fnv1a32(`preview:${shuffleNonce}:${flat.join("|")}`));
    const arr = [...flat];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }, [structured, shuffleNonce]);

  const toggleCut = (lineIdx: number, wordIdx: number, word: string, currentChunks: string[], cutPos: number) => {
    if (disabled) return;
    const key = `${lineIdx}-${wordIdx}`;
    const existingCuts = chunksToCuts(currentChunks);
    const nextCuts = existingCuts.includes(cutPos)
      ? existingCuts.filter((c) => c !== cutPos)
      : [...existingCuts, cutPos].sort((a, b) => a - b);
    const nextChunks = sliceWordByCuts(word, nextCuts);
    onChangeCustomWordChunks({
      ...customWordChunks,
      [key]: nextChunks,
    });
  };

  return (
    <div className="space-y-3" data-testid="haiku-slice-cutter">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-600 flex items-center gap-1 font-medium">
          <Scissors className="h-3.5 w-3.5 text-emerald-700" />
          Click between any two letters below to toggle custom slice cuts:
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => setShuffleNonce((n) => n + 1)}
            className="h-7 px-2.5 text-xs font-bold border-2 border-black bg-[#b6df52]/40 hover:bg-[#b6df52]/70"
            data-testid="haiku-reshuffle-preview"
          >
            <Shuffle className="h-3.5 w-3.5 mr-1" />
            Reshuffle / Preview Slices
          </Button>
          {Object.keys(customWordChunks).length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onChangeCustomWordChunks({})}
              className="h-7 px-2 text-xs font-bold border-2 border-black"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Auto-Slice
            </Button>
          )}
        </div>
      </div>

      {/* Interactive click-between-letters lines */}
      <div className="rounded-xl border-2 border-neutral-200 bg-white p-3 space-y-2.5">
        {structured.map((lineInfo, lineIdx) => (
          <div key={lineIdx} className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase text-neutral-400 w-10 shrink-0">
              Line {lineIdx + 1}
            </span>
            {lineInfo.words.map((wordObj, wordIdx) => {
              const cuts = new Set(chunksToCuts(wordObj.chunks));
              const letters = wordObj.text.split("");
              return (
                <div
                  key={`${lineIdx}-${wordIdx}`}
                  className="inline-flex items-center rounded-lg border border-neutral-300 bg-neutral-50 px-1.5 py-1"
                >
                  {letters.map((ch, charIdx) => {
                    const cutPos = charIdx + 1;
                    const isLast = charIdx === letters.length - 1;
                    const hasCut = cuts.has(cutPos);
                    return (
                      <React.Fragment key={charIdx}>
                        <span className="font-mono font-black text-xs sm:text-sm text-neutral-900 px-0.5">
                          {ch}
                        </span>
                        {!isLast && (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              toggleCut(
                                lineIdx,
                                wordIdx,
                                wordObj.text,
                                wordObj.chunks,
                                cutPos
                              )
                            }
                            title={
                              hasCut
                                ? `Remove slice cut in ${wordObj.text}`
                                : `Add slice cut in ${wordObj.text}`
                            }
                            aria-label={`Toggle cut after letter ${charIdx + 1} of ${wordObj.text}`}
                            data-testid={`haiku-cut-${lineIdx}-${wordIdx}-${cutPos}`}
                            className={cn(
                              "h-5 w-3 mx-0.5 rounded flex items-center justify-center text-[11px] font-black transition-colors",
                              hasCut
                                ? "bg-emerald-600 text-white"
                                : "bg-transparent text-neutral-300 hover:bg-neutral-200 hover:text-black"
                            )}
                          >
                            |
                          </button>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Resulting Tray Chunk Tiles */}
      <div className="rounded-xl border-2 border-black bg-[#FAF9F6] p-3.5 min-h-[108px] space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-neutral-500">
          <span>Player Tray Tiles ({allChunks.length} slices)</span>
          {Object.keys(customWordChunks).length > 0 && (
            <span className="text-emerald-700">Custom cuts active</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {allChunks.map((chunk, i) => (
            <div
              key={`${chunk}-${i}`}
              className="px-3 py-1.5 rounded-lg border-2 border-black bg-white font-mono font-black text-sm uppercase shadow-[2px_2px_0px_#000]"
            >
              {chunk}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
