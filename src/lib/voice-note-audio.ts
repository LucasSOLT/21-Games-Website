/**
 * Cross-browser voice-note MIME negotiation, binary container magic-byte healing,
 * and Blob URL conversion for 21 Things community reflections.
 *
 * Fixes iOS Safari / Chrome `▶ Error` playback caused by hardcoding `audio/webm`
 * on MP4/AAC (`ftyp`) recordings or exceeding Supabase's 1 MB `voice_note_url` limit.
 */

export const VOICE_NOTE_MIME_CANDIDATES = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

export const VOICE_NOTE_BITS_PER_SECOND = 32_000;
export const MAX_VOICE_NOTE_SECONDS = 60;
/** Safely under `supabase/schema.sql`'s `char_length(voice_note_url) <= 1048576` check. */
export const MAX_VOICE_NOTE_DATA_URL_CHARS = 950_000;
const MIN_VALID_AUDIO_BYTES = 32;

/**
 * Picks the best supported `MediaRecorder` MIME type for the current browser.
 * Prefers `audio/mp4` (AAC) first because it plays natively on iOS Safari, macOS Safari,
 * Chrome, Edge, Firefox, and Android alike; falls back to `audio/webm;codecs=opus`.
 */
export function pickSupportedAudioMimeType(): string {
  if (
    typeof window === "undefined" ||
    typeof MediaRecorder === "undefined" ||
    typeof MediaRecorder.isTypeSupported !== "function"
  ) {
    return "";
  }
  for (const candidate of VOICE_NOTE_MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    } catch {
      // Ignore browser quirks on unsupported MIME strings
    }
  }
  return "";
}

/**
 * Inspects the first 16 bytes of an audio container to detect its true MIME type.
 */
export function detectAudioMimeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // ISO BMFF / MP4 / M4A: bytes 4..7 == "ftyp" (0x66 0x74 0x79 0x70)
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return "audio/mp4";
  }

  // WebM / Matroska EBML header: 0x1A 0x45 0xDF 0xA3
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return "audio/webm";
  }

  // Ogg container: "OggS"
  if (
    bytes[0] === 0x4f &&
    bytes[1] === 0x67 &&
    bytes[2] === 0x67 &&
    bytes[3] === 0x53
  ) {
    return "audio/ogg";
  }

  // RIFF WAVE: "RIFF"...."WAVE"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  ) {
    return "audio/wav";
  }

  // MP3 ID3 tag ("ID3") or MPEG frame sync (0xFF 0xE0..0xFF)
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
    (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)
  ) {
    return "audio/mpeg";
  }

  return null;
}

function decodeBase64Bytes(b64: string, maxChars?: number): Uint8Array | null {
  const clean = b64.replace(/\s+/g, "");
  if (!clean) return null;
  const slice =
    typeof maxChars === "number"
      ? clean.slice(0, maxChars - (maxChars % 4))
      : clean;
  if (!slice) return null;

  try {
    if (typeof atob === "function") {
      const bin = atob(slice);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i);
      }
      return out;
    }
    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(slice, "base64"));
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Validates and normalizes a voice-note URL or `data:audio/...;base64,...` string:
 * - Rejects empty, truncated (`< 32` bytes), or corrupt base64 strings (returning `undefined`).
 * - Auto-heals mislabeled iOS Safari clips (`data:audio/webm;base64,<ftyp...>`) to `data:audio/mp4;base64,...`.
 * - Passes through valid `https://` / `http://` audio URLs.
 */
export function normalizeVoiceNoteDataUrl(
  rawUrl?: string | null
): string | undefined {
  if (!rawUrl || typeof rawUrl !== "string") return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed.length <= 4096 ? trimmed : undefined;
  }

  if (!trimmed.startsWith("data:")) return undefined;
  if (trimmed.length > MAX_VOICE_NOTE_DATA_URL_CHARS) return undefined;

  const commaIdx = trimmed.indexOf(",");
  if (commaIdx < 5) return undefined;

  const header = trimmed.slice(5, commaIdx);
  const payload = trimmed.slice(commaIdx + 1).replace(/\s+/g, "");
  if (!/;base64$/i.test(header) && !header.toLowerCase().includes(";base64")) {
    return undefined;
  }

  // Decode the first 96 base64 chars (72 bytes) to verify non-empty payload & magic header
  const headBytes = decodeBase64Bytes(payload, 96);
  if (!headBytes || headBytes.length < MIN_VALID_AUDIO_BYTES) {
    return undefined;
  }

  const declaredMime =
    header.split(";")[0]?.trim().toLowerCase() || "audio/mp4";
  const sniffedMime = detectAudioMimeFromBytes(headBytes);
  const resolvedMime =
    sniffedMime ??
    (declaredMime.startsWith("audio/") ? declaredMime : "audio/mp4");

  return `data:${resolvedMime};base64,${payload}`;
}

/**
 * Converts a normalized `data:audio/...;base64,...` string into a `Blob` so `<audio>`
 * can play from a `blob:` Object URL reliably on iOS Safari and mobile WebViews.
 */
export function voiceNoteDataUrlToBlob(dataUrl: string): Blob | null {
  const normalized = normalizeVoiceNoteDataUrl(dataUrl);
  if (!normalized || !normalized.startsWith("data:")) return null;
  const commaIdx = normalized.indexOf(",");
  if (commaIdx < 0) return null;
  const mime =
    normalized.slice(5, commaIdx).split(";")[0]?.trim() || "audio/mp4";
  const bytes = decodeBase64Bytes(normalized.slice(commaIdx + 1));
  if (!bytes || bytes.length < MIN_VALID_AUDIO_BYTES) return null;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: mime });
}
