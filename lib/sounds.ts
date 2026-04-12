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
