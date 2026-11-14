/**
 * Move Two (`move-2`) — SSR-Safe Synthesized Web Audio API Sound Effects
 * Provides tactile audio feedback for the 3D 2×1 die:
 * - Roll clack (`playMoveTwoRollSfx`)
 * - Raised outer cube rim bump thud (`playMoveTwoRimBumpSfx`)
 * - Recessed hole drop + 3D cube rotation whoosh (`playMoveTwoHoleDropSfx`)
 * - Interior dark void hazard reset buzz (`playMoveTwoHazardSfx`)
 * - Face 6 victory chime (`playMoveTwoVictorySfx`)
 * - Mute persistence (`solgames_move2_muted`)
 */

import type { MoveTwoPosture } from "@/lib/generators/move-two-generator";

export const MOVE_TWO_MUTE_STORAGE_KEY = "solgames_move2_muted";

let sharedAudioCtx: AudioContext | null = null;
let memoryMutedFallback = false;

export function isMoveTwoMuted(): boolean {
  if (typeof window === "undefined") {
    return memoryMutedFallback;
  }
  try {
    return window.localStorage.getItem(MOVE_TWO_MUTE_STORAGE_KEY) === "1";
  } catch {
    return memoryMutedFallback;
  }
}

export function setMoveTwoMuted(muted: boolean): void {
  memoryMutedFallback = muted;
  if (typeof window === "undefined") return;
  try {
    if (muted) {
      window.localStorage.setItem(MOVE_TWO_MUTE_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(MOVE_TWO_MUTE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (isMoveTwoMuted()) return null;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new Ctx();
    }
    if (sharedAudioCtx.state === "suspended") {
      void sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/** Crisp woody/stone domino roll clack. Standing `UPRIGHT` produces a slightly sharper click. */
export function playMoveTwoRollSfx(posture: MoveTwoPosture = "UPRIGHT"): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    const startFreq = posture === "UPRIGHT" ? 290 : 225;
    const endFreq = posture === "UPRIGHT" ? 135 : 105;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.065);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  } catch {
    // No-op if audio blocked
  }
}

/** Low muted thud when a roll is blocked by the raised outer cube rim. */
export function playMoveTwoRimBumpSfx(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.09);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // No-op
  }
}

/** Descending hole-drop swoosh followed by a subtle 3D cube rotation whoosh. */
export function playMoveTwoHoleDropSfx(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;

    // 1. Descending drop into recessed hole
    const dropOsc = ctx.createOscillator();
    const dropGain = ctx.createGain();
    dropOsc.type = "sine";
    dropOsc.frequency.setValueAtTime(480, now);
    dropOsc.frequency.exponentialRampToValueAtTime(145, now + 0.22);

    dropGain.gain.setValueAtTime(0.15, now);
    dropGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    dropOsc.connect(dropGain);
    dropGain.connect(ctx.destination);
    dropOsc.start(now);
    dropOsc.stop(now + 0.25);

    // 2. Sequential cube rotation whoosh + spawn chime on next face
    const rotOsc = ctx.createOscillator();
    const rotGain = ctx.createGain();
    rotOsc.type = "triangle";
    rotOsc.frequency.setValueAtTime(210, now + 0.22);
    rotOsc.frequency.exponentialRampToValueAtTime(420, now + 0.42);

    rotGain.gain.setValueAtTime(0.001, now + 0.22);
    rotGain.gain.linearRampToValueAtTime(0.12, now + 0.3);
    rotGain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);

    rotOsc.connect(rotGain);
    rotGain.connect(ctx.destination);
    rotOsc.start(now + 0.22);
    rotOsc.stop(now + 0.45);
  } catch {
    // No-op
  }
}

/** Dissonant low buzz when touching an interior dark void hazard tile. */
export function playMoveTwoHazardSfx(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(155, now);
    osc.frequency.linearRampToValueAtTime(92, now + 0.2);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  } catch {
    // No-op
  }
}

/** Bright ascending chord when dropping into the final hole. */
export function playMoveTwoVictorySfx(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startAt = now + idx * 0.075;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startAt);

      gain.gain.setValueAtTime(0.13, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.36);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + 0.38);
    });
  } catch {
    // No-op
  }
}

/** Mechanical plate click + bridge latch chime for ○ Soft Switch and ✕ Heavy Switch. */
export function playMoveTwoSwitchSfx(
  kind: "soft" | "heavy" = "soft",
  opened: boolean = true
): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = kind === "heavy" ? "square" : "triangle";
    clickOsc.frequency.setValueAtTime(kind === "heavy" ? 240 : 360, now);
    clickOsc.frequency.exponentialRampToValueAtTime(
      opened ? 540 : 190,
      now + 0.11
    );

    clickGain.gain.setValueAtTime(0.12, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.13);
  } catch {
    // No-op
  }
}

/** Brittle terracotta snap + descending plunge when standing UPRIGHT on a fragile orange tile. */
export function playMoveTwoFragileCrackSfx(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const snap = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snap.type = "sawtooth";
    snap.frequency.setValueAtTime(420, now);
    snap.frequency.exponentialRampToValueAtTime(88, now + 0.16);
    snapGain.gain.setValueAtTime(0.14, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    snap.connect(snapGain);
    snapGain.connect(ctx.destination);
    snap.start(now);
    snap.stop(now + 0.18);

    const fall = ctx.createOscillator();
    const fallGain = ctx.createGain();
    fall.type = "sine";
    fall.frequency.setValueAtTime(280, now + 0.08);
    fall.frequency.exponentialRampToValueAtTime(68, now + 0.36);
    fallGain.gain.setValueAtTime(0.11, now + 0.08);
    fallGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    fall.connect(fallGain);
    fallGain.connect(ctx.destination);
    fall.start(now + 0.08);
    fall.stop(now + 0.39);
  } catch {
    // No-op
  }
}

/** Descending cliff-overhang whoosh when tipping off an open void edge or closed bridge. */
export function playMoveTwoFallSfx(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(340, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.38);

    gain.gain.setValueAtTime(0.13, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + 0.06);
    osc.stop(now + 0.41);
  } catch {
    // No-op
  }
}
