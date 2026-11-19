"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Volume2, X } from "lucide-react";
import {
  normalizeVoiceNoteDataUrl,
  voiceNoteDataUrlToBlob,
} from "@/lib/voice-note-audio";
import { cn } from "@/lib/utils";

interface VoiceNotePlayerProps {
  src?: string | null;
  /** Optional remove handler shown in the compose form before submitting. */
  onRemove?: () => void;
  className?: string;
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const whole = Math.floor(sec);
  const mins = Math.floor(whole / 60);
  const rem = whole % 60;
  return `${mins}:${String(rem).padStart(2, "0")}`;
}

/**
 * Cross-browser voice-note player that heals mislabeled `data:audio/*` containers,
 * plays via `Blob` Object URLs on Safari/Chrome, and gracefully suppresses corrupt
 * legacy clips instead of rendering a broken `▶ Error` widget.
 */
export function VoiceNotePlayer({
  src,
  onRemove,
  className,
}: VoiceNotePlayerProps) {
  const normalizedSrc = useMemo(() => normalizeVoiceNoteDataUrl(src), [src]);

  if (!normalizedSrc) {
    if (onRemove && src) {
      return (
        <div className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900">
          <span>Clip couldn&apos;t load — please tap Re-record.</span>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove voice note"
            className="rounded p-0.5 hover:bg-amber-200/60"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    }
    return null;
  }

  return (
    <VoiceNotePlayerInner
      key={normalizedSrc}
      normalizedSrc={normalizedSrc}
      onRemove={onRemove}
      className={className}
    />
  );
}

function VoiceNotePlayerInner({
  normalizedSrc,
  onRemove,
  className,
}: {
  normalizedSrc: string;
  onRemove?: () => void;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if (
      normalizedSrc.startsWith("http://") ||
      normalizedSrc.startsWith("https://")
    ) {
      el.src = normalizedSrc;
      return () => {
        el.pause();
        el.removeAttribute("src");
      };
    }

    const blob = voiceNoteDataUrlToBlob(normalizedSrc);
    if (!blob) {
      queueMicrotask(() => setFailed(true));
      return;
    }

    const objUrl = URL.createObjectURL(blob);
    el.src = objUrl;
    return () => {
      el.pause();
      el.removeAttribute("src");
      URL.revokeObjectURL(objUrl);
    };
  }, [normalizedSrc]);

  if (failed) {
    if (onRemove) {
      return (
        <div className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900">
          <span>Clip couldn&apos;t play — please tap Re-record.</span>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove voice note"
            className="rounded p-0.5 hover:bg-amber-200/60"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    }
    return null;
  }

  const progressPct =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    try {
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      setFailed(true);
    }
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border-2 border-black bg-white px-2.5 py-1.5 shadow-[2px_2px_0px_#000]",
        className
      )}
      data-testid="voice-note-player"
    >
      <audio
        ref={audioRef}
        preload="metadata"
        playsInline
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime || 0);
        }}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onError={() => {
          setPlaying(false);
          setFailed(true);
        }}
      />

      <button
        type="button"
        onClick={() => void togglePlay()}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className="h-7 w-7 rounded-full border-2 border-black bg-[#F9D423] hover:bg-[#F9D423]/85 text-black flex items-center justify-center shrink-0 transition-transform active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5 fill-black" />
        ) : (
          <Play className="h-3.5 w-3.5 fill-black ml-0.5" />
        )}
      </button>

      <div
        aria-hidden="true"
        className="inline-flex items-end gap-0.5 h-3.5 shrink-0"
      >
        {[0, 1, 2].map((barIdx) => (
          <span
            key={barIdx}
            style={{ animationDelay: `${barIdx * 120}ms` }}
            className={cn(
              "w-0.5 rounded-full bg-neutral-800 transition-all motion-reduce:animate-none motion-reduce:transition-none",
              playing
                ? barIdx === 1
                  ? "h-3.5 animate-pulse"
                  : "h-2.5 animate-pulse"
                : barIdx === 1
                ? "h-2.5"
                : "h-1.5"
            )}
          />
        ))}
      </div>

      <Volume2 className="sr-only" />

      <div className="w-24 sm:w-32 h-2 rounded-full bg-neutral-200 overflow-hidden border border-black/20">
        <div
          className="h-full bg-black transition-[width] duration-100 motion-reduce:transition-none motion-reduce:animate-none"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <span className="font-mono text-[11px] font-bold text-neutral-800 tabular-nums shrink-0">
        {playing || currentTime > 0
          ? formatSeconds(currentTime)
          : duration > 0
          ? formatSeconds(duration)
          : "Voice"}
      </span>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove recorded voice note"
          title="Remove voice note"
          className="ml-0.5 rounded-full p-1 text-neutral-500 hover:bg-neutral-100 hover:text-black"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
