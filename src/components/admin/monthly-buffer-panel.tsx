"use client";

import React, { useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  Cpu,
  Download,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  resolveAIProvider,
  type AIProvider,
} from "@/lib/ai-helper";
import {
  generateAndVerifyMonthlyBatch,
  getPreferredAIProvider,
  getTargetMonthMPlus2,
  parseMonthKey,
  setPreferredAIProvider,
  type MonthlyBatchReport,
} from "@/lib/monthly-batch";
import type { AllGameSlug } from "@/lib/games-config";
import { cn } from "@/lib/utils";

export interface MonthlyBufferPanelProps {
  onSelectDateAndGame?: (dateKey: string, gameSlug: AllGameSlug) => void;
}

const PROVIDER_OPTIONS: ReadonlyArray<{
  id: AIProvider;
  label: string;
  sublabel: string;
}> = [
  {
    id: "gemini",
    label: "Gemini 2.5 Flash",
    sublabel: "Free Tier Default ($0)",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    sublabel: "Optional Multi-Model",
  },
  {
    id: "local",
    label: "Local Deterministic",
    sublabel: "Offline / Zero-API",
  },
];

export function MonthlyBufferPanel({
  onSelectDateAndGame,
}: MonthlyBufferPanelProps) {
  const defaultMPlus2 = getTargetMonthMPlus2();
  const [monthInput, setMonthInput] = useState<string>(defaultMPlus2.monthKey);
  const [preferredProvider, setProviderState] = useState<AIProvider>(() =>
    getPreferredAIProvider()
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<MonthlyBatchReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const effectiveProvider = resolveAIProvider({
    preferredProvider,
  });

  const handleProviderClick = (next: AIProvider) => {
    setProviderState(next);
    setPreferredAIProvider(next);
  };

  const handleGenerateBatch = () => {
    setErrorMsg(null);
    const parsed = parseMonthKey(monthInput) ?? defaultMPlus2;
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const res = generateAndVerifyMonthlyBatch(parsed.year, parsed.month, {
          preferredProvider,
        });
        setReport(res);
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Failed to generate monthly batch."
        );
      } finally {
        setIsGenerating(false);
      }
    }, 20);
  };

  const handleExportJson = () => {
    if (!report || typeof window === "undefined") return;
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solgames-batch-${report.monthKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border-2 border-black bg-[#FFFBE6] p-4 sm:p-5 shadow-[3px_3px_0px_#000] space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-2 border-black bg-[#b6df52] text-black font-black text-[11px]">
              <CalendarCheck className="h-3.5 w-3.5 mr-1" />
              Rolling Buffer · Month M+2 ({defaultMPlus2.label})
            </Badge>
            <Badge
              variant="outline"
              className="border-black bg-white text-[11px] font-mono font-bold text-black"
            >
              Active AI: {effectiveProvider}
            </Badge>
          </div>
          <h3 className="font-headline font-black text-base sm:text-lg text-black">
            Monthly 9-Game Batch Generator &amp; Solver Verifier
          </h3>
          <p className="text-xs text-gray-700 max-w-2xl">
            1st-of-the-month workflow (§0.3): generate and solver-verify{" "}
            <strong>{defaultMPlus2.label}</strong> across all 9 countdown games
            (21 → 1) to keep a 60+ day daily puzzle buffer ready at $0/mo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="month"
            aria-label="Target batch month (YYYY-MM)"
            value={monthInput}
            onChange={(e) => setMonthInput(e.target.value)}
            className="w-40 border-2 border-black bg-white font-mono text-xs font-bold h-10"
          />
          <Button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerateBatch}
            className="border-2 border-black bg-black text-white hover:bg-gray-800 font-headline font-black text-xs h-10 px-3.5 shadow-[2px_2px_0px_#9D50BB]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Verifying 9 Solvers...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1.5 text-[#F9D423]" />
                Generate {monthInput || defaultMPlus2.monthKey} Batch
              </>
            )}
          </Button>
          {report && (
            <Button
              type="button"
              variant="outline"
              onClick={handleExportJson}
              className="border-2 border-black bg-white text-black hover:bg-gray-100 font-headline font-black text-xs h-10 px-3"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export JSON
            </Button>
          )}
        </div>
      </div>

      {/* Unified AI Provider Toggle (§0.2) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/15">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-gray-700">
          <Cpu className="h-3.5 w-3.5" />
          Studio AI Draft Provider (§0.2):
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {PROVIDER_OPTIONS.map((opt) => {
            const selected = preferredProvider === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleProviderClick(opt.id)}
                className={cn(
                  "rounded-lg border-2 border-black px-2.5 py-1 text-left transition-all cursor-pointer",
                  selected
                    ? "bg-black text-white shadow-[1px_1px_0px_#9D50BB]"
                    : "bg-white text-black hover:bg-gray-100"
                )}
              >
                <span className="text-[11px] font-black">{opt.label}</span>
                <span
                  className={cn(
                    "ml-1.5 text-[10px]",
                    selected ? "text-gray-300" : "text-gray-500"
                  )}
                >
                  · {opt.sublabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border-2 border-red-600 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      {report && (
        <div className="rounded-xl border-2 border-black bg-white p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={cn(
                  "h-4 w-4",
                  report.allValid ? "text-emerald-600" : "text-amber-600"
                )}
              />
              <span className="font-headline text-sm font-black text-black">
                {report.label}: {report.verifiedPuzzles} /{" "}
                {report.totalPuzzles} daily puzzles verified across all 9 games
              </span>
            </div>
            <span className="font-mono text-[11px] font-bold text-gray-600">
              {report.daysInMonth} days × 9 games
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {report.games.map((g) => (
              <div
                key={g.slug}
                className="rounded-lg border border-black/20 bg-gray-50 p-2.5 flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] font-black text-black">
                      #{g.countdownNumber}
                    </span>
                    <span className="font-headline text-xs font-black text-black truncate">
                      {g.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-600 truncate mt-0.5">
                    {g.solverNote}
                  </p>
                </div>
                <div className="flex flex-col items-end shrink-0 gap-1">
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 font-mono text-[10px] font-black",
                      g.allValid
                        ? "border-emerald-700 bg-emerald-100 text-emerald-950"
                        : "border-red-700 bg-red-100 text-red-900"
                    )}
                  >
                    {g.daysVerified}/{g.daysTotal}
                  </span>
                  {onSelectDateAndGame && (
                    <button
                      type="button"
                      onClick={() =>
                        onSelectDateAndGame(`${report.monthKey}-01`, g.slug)
                      }
                      className="text-[10px] font-bold text-black underline hover:text-[#9D50BB] cursor-pointer"
                    >
                      Inspect Day 1 →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
