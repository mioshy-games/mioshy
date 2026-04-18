"use client";

const SPIN_SRC_MP3 = "/sounds/sound.mp3";
const SPIN_SRC_FALLBACK = "/sounds/spin.wav";
const SPIN_VOLUME = 1;

let audioCtx: AudioContext | null = null;
let spinBuffer: AudioBuffer | null = null;
let decodePromise: Promise<AudioBuffer> | null = null;
let activeSource: AudioBufferSourceNode | null = null;
let activeGain: GainNode | null = null;
let fadeClearTimer: number | null = null;
let spinGeneration = 0;

function getCtx(): AudioContext {
  if (typeof window === "undefined") {
    return null as unknown as AudioContext;
  }
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioCtx;
}

function disconnectActive() {
  if (fadeClearTimer !== null) {
    clearTimeout(fadeClearTimer);
    fadeClearTimer = null;
  }
  if (activeSource) {
    try {
      activeSource.stop();
    } catch {
      /* already stopped */
    }
    try {
      activeSource.disconnect();
    } catch {
      /* noop */
    }
    activeSource = null;
  }
  if (activeGain) {
    try {
      activeGain.disconnect();
    } catch {
      /* noop */
    }
    activeGain = null;
  }
}

async function ensureSpinBuffer(): Promise<AudioBuffer> {
  if (spinBuffer) return spinBuffer;
  if (!decodePromise) {
    decodePromise = (async () => {
      let res = await fetch(SPIN_SRC_MP3);
      if (!res.ok) {
        res = await fetch(SPIN_SRC_FALLBACK);
      }
      const ab = await res.arrayBuffer();
      const ctx = getCtx();
      const buf = await ctx.decodeAudioData(ab.slice(0));
      spinBuffer = buf;
      return buf;
    })();
  }
  return decodePromise;
}

export function startSpinSound() {
  const ctx = getCtx();
  void ctx.resume();

  disconnectActive();
  const gen = ++spinGeneration;

  void (async () => {
    try {
      const buf = await ensureSpinBuffer();
      if (gen !== spinGeneration) return;
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = SPIN_VOLUME;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
      if (gen !== spinGeneration) {
        try {
          source.stop();
        } catch {
          /* noop */
        }
        source.disconnect();
        gain.disconnect();
        return;
      }
      activeSource = source;
      activeGain = gain;
    } catch (e) {
      console.warn("[sounds] Web Audio playback failed", e);
    }
  })();
}

export function stopSpinSound() {
  const ctx = getCtx();

  if (!activeGain || !activeSource) {
    disconnectActive();
    return;
  }

  const now = ctx.currentTime;
  const g = activeGain.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(0, now + 0.28);

  const src = activeSource;
  fadeClearTimer = window.setTimeout(() => {
    try {
      src.stop();
    } catch {
      /* noop */
    }
    disconnectActive();
  }, 320);
}

// ─────────────────────────────────────────────────────────────────────────
// Synthesized SFX for the Snakes & Ladders board
//
// Instead of shipping ~150KB of extra WAVs, each event is a tiny oscillator
// patch scheduled against the shared AudioContext. This keeps the bundle
// light and plays reliably on iOS Safari (the same ctx is already unlocked
// by any prior user gesture — tapping the dice resumes it if needed).
//
// Call `playSound(kind)` from anywhere in the game UI. Silent on SSR.
// ─────────────────────────────────────────────────────────────────────────

export type SoundKind = "dice" | "move" | "snake" | "ladder" | "win";

interface ToneStep {
  freq: number;
  /** seconds from `at` when the tone starts */
  start: number;
  /** duration in seconds */
  dur: number;
  /** peak gain (0..1) */
  gain?: number;
  type?: OscillatorType;
}

function scheduleTones(steps: ToneStep[]) {
  if (typeof window === "undefined") return;
  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume();
  const at = ctx.currentTime;
  for (const s of steps) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = s.type ?? "sine";
    osc.frequency.value = s.freq;
    const peak = s.gain ?? 0.15;
    gain.gain.setValueAtTime(0.0001, at + s.start);
    gain.gain.exponentialRampToValueAtTime(peak, at + s.start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + s.start + s.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at + s.start);
    osc.stop(at + s.start + s.dur + 0.02);
  }
}

function scheduleSweep({
  from,
  to,
  dur,
  gainPeak = 0.18,
  type = "sawtooth",
}: {
  from: number;
  to: number;
  dur: number;
  gainPeak?: number;
  type?: OscillatorType;
}) {
  if (typeof window === "undefined") return;
  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume();
  const at = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(to, 20), at + dur);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(gainPeak, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

export function playSound(kind: SoundKind) {
  switch (kind) {
    case "dice":
      // wood-ish knock: short low thump + mid tick
      scheduleTones([
        { freq: 180, start: 0, dur: 0.08, gain: 0.25, type: "square" },
        { freq: 520, start: 0.04, dur: 0.06, gain: 0.12, type: "triangle" },
      ]);
      break;
    case "move":
      // small blip on step
      scheduleTones([{ freq: 660, start: 0, dur: 0.08, gain: 0.12, type: "sine" }]);
      break;
    case "snake":
      // descending hiss/slide
      scheduleSweep({ from: 900, to: 120, dur: 0.55, gainPeak: 0.22, type: "sawtooth" });
      break;
    case "ladder":
      // ascending arpeggio (major triad + octave)
      scheduleTones([
        { freq: 392, start: 0.0, dur: 0.12, gain: 0.16, type: "triangle" }, // G4
        { freq: 494, start: 0.1, dur: 0.12, gain: 0.16, type: "triangle" }, // B4
        { freq: 587, start: 0.2, dur: 0.14, gain: 0.18, type: "triangle" }, // D5
        { freq: 784, start: 0.32, dur: 0.2, gain: 0.2, type: "triangle" }, // G5
      ]);
      break;
    case "win":
      // fanfare: I - V - I chord, thick
      scheduleTones([
        { freq: 523.25, start: 0.0, dur: 0.25, gain: 0.18, type: "triangle" }, // C5
        { freq: 659.25, start: 0.0, dur: 0.25, gain: 0.14, type: "triangle" }, // E5
        { freq: 783.99, start: 0.0, dur: 0.25, gain: 0.12, type: "triangle" }, // G5
        { freq: 587.33, start: 0.28, dur: 0.25, gain: 0.18, type: "triangle" }, // D5
        { freq: 739.99, start: 0.28, dur: 0.25, gain: 0.14, type: "triangle" }, // F#5
        { freq: 880.0, start: 0.28, dur: 0.25, gain: 0.12, type: "triangle" }, // A5
        { freq: 523.25, start: 0.58, dur: 0.45, gain: 0.22, type: "triangle" }, // C5
        { freq: 659.25, start: 0.58, dur: 0.45, gain: 0.16, type: "triangle" },
        { freq: 1046.5, start: 0.58, dur: 0.45, gain: 0.14, type: "triangle" }, // C6
      ]);
      break;
  }
}

/**
 * Unlock the AudioContext on iOS. Call from a user gesture (e.g. the first
 * button press in the lobby). Safe to call multiple times.
 */
export function unlockAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume();
}
