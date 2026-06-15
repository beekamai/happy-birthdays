/* Cozy SFX synthesized with the Web Audio API — no audio files, no network,
   instant. Soft sine/triangle tones on a warm pentatonic scale, gentle ADSR,
   and a low-pass filter so nothing is harsh. A single shared AudioContext is
   created lazily on the first user gesture (browsers block audio before that).
   Mute state persists in localStorage. */

type SoundName =
  | "tap"
  | "pop"
  | "catch"
  | "miss"
  | "flip"
  | "match"
  | "step"
  | "hint"
  | "start"
  | "win"
  | "lose"
  | "pet";

/* Warm pentatonic-ish frequencies (Hz). */
const NOTE = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
} as const;

const MUTE_KEY = "hb-sfx-muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

try {
  muted = localStorage.getItem(MUTE_KEY) === "1";
} catch {
  /* private mode — default unmuted */
}

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* Lazily create / resume the audio graph. Returns null if unavailable. */
function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/* One enveloped note: osc → gain(ADSR) → lowpass → master. */
function note(
  freq: number,
  opts: {
    at?: number;
    dur?: number;
    type?: OscillatorType;
    gain?: number;
    glideTo?: number;
  } = {},
): void {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + (opts.at ?? 0);
  const dur = opts.dur ?? 0.18;
  const peak = opts.gain ?? 0.5;

  const osc = ctx.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + dur);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.012); /* soft attack */
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); /* decay */

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2600;

  osc.connect(env);
  env.connect(lp);
  lp.connect(master);

  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/* Each SFX is a tiny composition of notes. */
function render(name: SoundName): void {
  switch (name) {
    case "tap":
      note(NOTE.A5, { dur: 0.09, gain: 0.28, type: "sine" });
      break;
    case "pop":
      note(NOTE.C6, { dur: 0.1, gain: 0.32, type: "triangle", glideTo: NOTE.G5 });
      break;
    case "catch":
      note(NOTE.G5, { dur: 0.12, gain: 0.34, type: "triangle" });
      note(NOTE.C6, { at: 0.05, dur: 0.12, gain: 0.26, type: "sine" });
      break;
    case "miss":
      note(NOTE.A4, { dur: 0.16, gain: 0.22, type: "triangle", glideTo: NOTE.D4 });
      break;
    case "flip":
      note(NOTE.E5, { dur: 0.07, gain: 0.22, type: "sine" });
      break;
    case "match":
      note(NOTE.E5, { dur: 0.12, gain: 0.3, type: "triangle" });
      note(NOTE.A5, { at: 0.09, dur: 0.16, gain: 0.3, type: "triangle" });
      break;
    case "step":
      note(NOTE.D4, { dur: 0.06, gain: 0.16, type: "sine" });
      break;
    case "hint":
      note(NOTE.C6, { dur: 0.1, gain: 0.26, type: "sine", glideTo: NOTE.E5 });
      break;
    case "start":
      note(NOTE.C5, { dur: 0.16, gain: 0.26 });
      note(NOTE.G5, { at: 0.08, dur: 0.18, gain: 0.24 });
      break;
    case "win": {
      const seq = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6];
      seq.forEach((f, i) =>
        note(f, { at: i * 0.11, dur: 0.3, gain: 0.34, type: "triangle" }),
      );
      break;
    }
    case "lose":
      note(NOTE.G4, { dur: 0.22, gain: 0.24, type: "triangle", glideTo: NOTE.C4 });
      break;
    case "pet": {
      /* a random warm note each pet, so repeated taps feel playful */
      const pool = [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5];
      const f = pool[Math.floor(Math.random() * pool.length)]!;
      note(f, { dur: 0.14, gain: 0.3, type: "triangle" });
      break;
    }
  }
}

/** Play a named SFX. No-op when muted, unavailable, or reduced-motion. */
export function playSound(name: SoundName): void {
  try {
    if (muted || reducedMotion()) return;
    if (!ensure()) return;
    render(name);
  } catch {
    /* never let audio break the UI */
  }
}

/** Toggle mute; persists. Returns the new muted state. */
export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (!muted) {
    /* nudge a tiny sound so the user hears it came back on */
    playSound("tap");
  }
  return muted;
}

export function isMuted(): boolean {
  return muted;
}

/** Resume the audio context on the first gesture (call once on mount). */
export function unlockAudio(): void {
  ensure();
}

export type { SoundName };
