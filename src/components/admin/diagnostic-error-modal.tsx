"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Info,
  Lightbulb,
  Loader2,
  RefreshCw,
  Terminal,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { DiagnosticReport } from "@/lib/diagnostic-errors";
import { serializeDiagnosticReport } from "@/lib/diagnostic-errors";

export interface DiagnosticErrorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: DiagnosticReport | null;
  onRetry?: () => Promise<void> | void;
  isRetrying?: boolean;
}

/**
 * Fallback clipboard write helper supporting mobile webviews and restricted security contexts.
 */
async function copyToClipboardSafe(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("navigator.clipboard.writeText failed, trying DOM fallback:", err);
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    textarea.setAttribute("readonly", "");
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.error("DOM fallback copy failed:", err);
    return false;
  }
}

/**
 * NYT-Style High-Contrast Diagnostic Error Modal
 *
 * Displays when a Game Master's puzzle update fails to persist to Supabase.
 * Replaces transient toasts with a persistent, actionable dialog featuring:
 * 1. High-visibility alert badge & prominent Error Code badge
 * 2. Plain-English explanation + developer troubleshooting hints
 * 3. Local draft preservation reassurance (no work lost)
 * 4. Preloaded monospace JSON diagnostics in a scrollable container
 * 5. 1-click clipboard copy with immediate visual feedback
 * 6. "Retry Cloud Sync" and "Dismiss / Keep Local Draft" actions
 */
export function DiagnosticErrorModal({
  open,
  onOpenChange,
  report,
  onRetry,
  isRetrying = false,
}: DiagnosticErrorModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const serializedJson = useMemo(() => {
    if (!report) return "";
    return serializeDiagnosticReport(report);
  }, [report]);

  const handleCopy = useCallback(async () => {
    if (!serializedJson) return;

    const ok = await copyToClipboardSafe(serializedJson);
    if (ok) {
      setCopied(true);
      toast({
        title: "Error Diagnostics Copied!",
        description:
          "Preloaded diagnostic payload copied to clipboard. Ready to paste and send to the developer.",
      });
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast({
        title: "Copy Failed",
        description:
          "Unable to copy automatically. Please highlight the JSON block below and copy manually.",
        variant: "destructive",
      });
    }
  }, [serializedJson, toast]);

  if (!report) return null;

  const isFatal = report.severity === "fatal";
  const isWarning = report.severity === "warning";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-2 border-black rounded-2xl bg-white p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="space-y-2 text-left">
          {/* Header row with High-Visibility Alert Badge */}
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-black shadow-[2px_2px_0px_#000]",
                isFatal
                  ? "bg-red-600 text-white"
                  : isWarning
                  ? "bg-amber-400 text-black"
                  : "bg-red-100 text-red-700"
              )}
            >
              <AlertTriangle className="h-6 w-6 stroke-[2.5]" />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="font-headline font-black text-xl sm:text-2xl text-black leading-tight flex items-center gap-2">
                <span>{report.errorTitle || "Cloud Database Sync Failed"}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-600 font-medium">
                The studio could not synchronize this puzzle with the global Supabase database.
              </DialogDescription>
            </div>
          </div>

          {/* Metadata Badges Cluster */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge
              variant="destructive"
              className="font-mono text-xs font-black tracking-wider px-2.5 py-1 border-2 border-black shadow-[2px_2px_0px_#000]"
            >
              [{report.errorCode}]
            </Badge>

            <span className="rounded-lg border border-gray-300 bg-gray-50 px-2 py-0.5 font-mono text-[11px] font-bold text-gray-700">
              📅 {report.targetDate}
            </span>

            <span className="rounded-lg border border-gray-300 bg-gray-50 px-2 py-0.5 font-mono text-[11px] font-bold text-gray-700 uppercase">
              🎮 {report.gameSlug}
            </span>

            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 font-mono text-[11px] font-bold",
                report.isOnline
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-red-300 bg-red-50 text-red-800"
              )}
            >
              {report.isOnline ? (
                <>
                  <Wifi className="h-3 w-3 text-emerald-600" /> Online
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-red-600" /> Offline
                </>
              )}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {/* Plain-English Explanation & Troubleshooting Callout */}
          <div className="rounded-xl border-2 border-red-500 bg-red-50/90 p-4 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <p className="font-bold text-red-950 leading-relaxed text-xs sm:text-[13px]">
                {report.errorDescription}
              </p>
            </div>

            {report.troubleshootingHint && (
              <div className="border-t border-red-200/90 pt-2 flex items-start gap-2 text-red-900 text-xs font-medium">
                <Lightbulb className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="font-bold">Troubleshooting Hint:</strong>{" "}
                  {report.troubleshootingHint}
                </p>
              </div>
            )}
          </div>

          {/* Local Draft Saved Reassurance Banner */}
          <div className="rounded-xl border-2 border-black bg-[#FFFBE6] p-3 text-xs text-black shadow-[2px_2px_0px_#000] flex items-start gap-2.5">
            <Check className="h-4 w-4 text-emerald-700 shrink-0 stroke-[3] mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Local Draft Preserved in Browser</p>
              <p className="text-[11px] text-gray-700 mt-0.5 leading-normal">
                Your edits are safely stored on this device. You can test play locally or dismiss
                this modal and retry syncing once network connectivity or database permissions are
                restored.
              </p>
            </div>
          </div>

          {/* Monospace Preloaded Diagnostic Payload Block */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-gray-600 px-1">
              <span className="flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-gray-700" />
                Diagnostic Error Report Payload
              </span>
              <span className="font-mono text-[10px] text-gray-500 truncate max-w-[200px]">
                {report.timestamp}
              </span>
            </div>

            <div className="relative rounded-xl border-2 border-black bg-gray-950 p-3 shadow-[3px_3px_0px_#000]">
              <pre
                tabIndex={0}
                aria-label="Diagnostic JSON Payload"
                className="max-h-48 overflow-y-auto font-mono text-[11px] leading-relaxed text-emerald-400 select-all whitespace-pre-wrap break-all pr-2 focus:outline-none"
              >
                {serializedJson}
              </pre>
            </div>
            <p className="text-[10px] text-gray-500 px-1">
              Tip: Click <strong>&quot;Copy Error Diagnostics&quot;</strong> below to copy this entire
              report to your clipboard and send it directly to the developer.
            </p>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-3 border-t border-gray-200 sm:justify-between items-stretch sm:items-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-2 border-black font-bold text-xs px-3.5 py-2 hover:bg-gray-100"
          >
            Dismiss / Keep Local Draft
          </Button>

          <div className="flex flex-col sm:flex-row gap-2">
            {onRetry && (
              <Button
                type="button"
                disabled={isRetrying}
                onClick={() => void onRetry()}
                className="bg-[#2ECC71] text-black hover:bg-[#27ae60] border-2 border-black font-headline font-black text-xs px-4 py-2 shadow-[2px_2px_0px_#000] disabled:opacity-50"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Retrying Sync...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Retry Cloud Sync
                  </>
                )}
              </Button>
            )}

            <Button
              type="button"
              onClick={handleCopy}
              className={cn(
                "border-2 border-black font-headline font-black text-xs px-4 py-2 transition-all shadow-[3px_3px_0px_#F9D423] active:translate-x-0.5 active:translate-y-0.5",
                copied
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-black text-white hover:bg-gray-800"
              )}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5 stroke-[3] text-white" />
                  Copied Diagnostics!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy Error Diagnostics
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
