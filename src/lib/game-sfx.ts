/**
 * Shared SSR-Safe Synthesized Web Audio SFX Kit (`21games.ai`)
 *
 * Provides subtle, tactile, zero-asset sound effects across all 9 daily games:
 * - `playTapSfx`: Soft tactile tile click / selection tap
 * - `playSnapSfx`: Crisp ascending placement / lock-in snap
 * - `playRevealSfx`: Warm harmonic shimmer on piece/word reveal or stage clear
 * - `playErrorSfx`: Soft low-frequency invalid thud (non-jarring)
 * - `playWinChimeSfx`: Editorial 4-note ascending victory arpeggio
 *
 * Mute preference persists in `solgames_sfx_muted` and stays synchronized with
 * `solgames_move2_muted` so toggling Mute in `<GameShell>` or `Move Two` mutes all 9 games.
 */

export const GAME_SFX_MUTE_KEY = "solgames_sfx_muted";
export const LEGACY_MOVE_TWO_MUTE_KEY = "solgames_move2_muted";
export const GAME_SFX_MUTE_EVENT = "solgames:sfx-mute-changed";

let sharedCtx: AudioContext | null = null;
let memoryMuted = false;

export function isGameSfxMuted(): boolean {
  if (typeof window === "undefined") {
    return memoryMuted;
  }
  try {
    const globalMuted = window.localStorage.getItem(GAME_SFX_MUTE_KEY);
    if (globalMuted !== null) {
      return globalMuted === "1";
    }
    return window.localStorage.getItem(LEGACY_MOVE_TWO_MUTE_KEY) === "1";
  } catch {
    return memoryMuted;
  }
}

export function setGameSfxMuted(muted: boolean): void {
  memoryMuted = muted;
  if (typeof window === "undefined") return;
  try {
    if (muted) {
      window.localStorage.setItem(GAME_SFX_MUTE_KEY, "1");
      window.localStorage.setItem(LEGACY_MOVE_TWO_MUTE_KEY, "1");
    } else {
      window.localStorage.setItem(GAME_SFX_MUTE_KEY, "0");
      window.localStorage.removeItem(LEGACY_MOVE_TWO_MUTE_KEY);
    }
    window.dispatchEvent(
      new CustomEvent(GAME_SFX_MUTE_EVENT, { detail: { muted } })
    );
  } catch {
    // Ignore storage restriction errors in strict private browsing
  }
}

export function toggleGameSfxMuted(): boolean {
  const next = !isGameSfxMuted();
  setGameSfxMuted(next);
  return next;
}

export function subscribeGameSfxMute(
  listener: (muted: boolean) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const handleCustom = (ev: Event) => {
    const detail = (ev as CustomEvent<{ muted?: boolean }>).detail;
    listener(typeof detail?.muted === "boolean" ? detail.muted : isGameSfxMuted());
  };
  const handleStorage = (ev: StorageEvent) => {
    if (
      ev.key === GAME_SFX_MUTE_KEY ||
      ev.key === LEGACY_MOVE_TWO_MUTE_KEY ||
      ev.key === null
    ) {
      listener(isGameSfxMuted());
    }
  };
  window.addEventListener(GAME_SFX_MUTE_EVENT, handleCustom);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(GAME_SFX_MUTE_EVENT, handleCustom);
    window.removeEventListener("storage", handleStorage);
  };
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (isGameSfxMuted()) return null;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedCtx) {
      sharedCtx = new Ctx();
    }
    if (sharedCtx.state === "suspended") {
      void sharedCtx.resume().catch(() => {});
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

/** Subtle crisp tile tap / key press. */
export function playTapSfx(pitchMultiplier = 1): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    const start = Math.max(120, Math.min(900, 320 * pitchMultiplier));
    osc.frequency.setValueAtTime(start, now);
    osc.frequency.exponentialRampToValueAtTime(start * 0.52, now + 0.042);
    gain.gain.setValueAtTime(0.085, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.046);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch {
    // No-op when AudioContext blocked
  }
}

/** Tactile ascending snap when placing a chunk, locking a word, or advancing a tier. */
export function playSnapSfx(stepIndex = 0): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const semitoneBoost = Math.pow(2, Math.min(12, Math.max(0, stepIndex)) / 12);
    const base = 392 * semitoneBoost; // G4 upwards
    osc.type = "sine";
    osc.frequency.setValueAtTime(base * 0.85, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.25, now + 0.075);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  } catch {
    // No-op
  }
}

/** Warm two-tone shimmer when revealing a hint, solving a card, or clearing a tier. */
export function playRevealSfx(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25]; // C5 -> E5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = now + idx * 0.055;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.095, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.15);
    });
  } catch {
    // No-op
  }
}

/** Soft, non-harsh muted thud on invalid word / wrong connection / blocked action. */
export function playErrorSfx(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(78, now + 0.11);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.125);
  } catch {
    // No-op
  }
}

/** Crisp 4-note editorial victory chime (C5 - E5 - G5 - C6). */
export function playWinChimeSfx(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = now + idx * 0.075;
      const dur = idx === chord.length - 1 ? 0.36 : 0.18;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.115, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.01);
    });
  } catch {
    // No-op
  }
}
