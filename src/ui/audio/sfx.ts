/**
 * Tiny WebAudio synth — every sound is generated, no asset files.
 * Pitch of score ticks rises during a scoring sequence like a combo meter.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let volume = 0.5;

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
}
export function setVolume(v: number) {
  volume = v;
  if (master) master.gain.value = v;
}

interface ToneOpts {
  freq: number;
  to?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone({ freq, to, dur = 0.12, type = "square", gain = 0.15, delay = 0 }: ToneOpts) {
  const a = ac();
  if (!a || !master) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur = 0.12, gain = 0.12, filterFreq = 2400, delay = 0) {
  const a = ac();
  if (!a || !master) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = filterFreq;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

const semitone = (base: number, n: number) => base * 2 ** (n / 12);

export const sfx = {
  select: () => tone({ freq: 660, to: 880, dur: 0.06, type: "triangle", gain: 0.12 }),
  deselect: () => tone({ freq: 660, to: 440, dur: 0.06, type: "triangle", gain: 0.1 }),
  deal: (i = 0) => noise(0.07, 0.08, 3000 + i * 150, i * 0.035),
  discard: () => noise(0.18, 0.12, 1400),
  /** step = index within the scoring sequence, for a rising pitch. */
  chips: (step: number) => tone({ freq: semitone(392, Math.min(step, 24)), dur: 0.09, type: "square", gain: 0.09 }),
  mult: (step: number) => tone({ freq: semitone(523, Math.min(step, 24)), dur: 0.11, type: "sawtooth", gain: 0.08 }),
  xmult: (step: number) => {
    const b = semitone(330, Math.min(step, 20));
    tone({ freq: b, dur: 0.25, type: "sawtooth", gain: 0.09 });
    tone({ freq: b * 1.26, dur: 0.25, type: "square", gain: 0.06 });
    tone({ freq: b * 1.5, dur: 0.3, type: "triangle", gain: 0.08 });
  },
  money: () => {
    tone({ freq: 1318, dur: 0.07, type: "square", gain: 0.07 });
    tone({ freq: 1760, dur: 0.14, type: "square", gain: 0.07, delay: 0.06 });
  },
  retrigger: () => tone({ freq: 880, to: 1320, dur: 0.12, type: "triangle", gain: 0.1 }),
  debuff: () => tone({ freq: 200, to: 120, dur: 0.18, type: "sawtooth", gain: 0.08 }),
  shatter: () => {
    noise(0.3, 0.2, 5000);
    tone({ freq: 2400, to: 600, dur: 0.25, type: "triangle", gain: 0.06 });
  },
  handName: () => tone({ freq: 440, to: 660, dur: 0.15, type: "triangle", gain: 0.12 }),
  total: () => {
    tone({ freq: 262, dur: 0.35, type: "square", gain: 0.06 });
    tone({ freq: 392, dur: 0.35, type: "square", gain: 0.05 });
    noise(0.4, 0.08, 800);
  },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.22, type: "square", gain: 0.08, delay: i * 0.09 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.3, type: "triangle", gain: 0.1, delay: i * 0.16 })),
  buy: () => {
    tone({ freq: 988, dur: 0.06, type: "square", gain: 0.07 });
    tone({ freq: 1318, dur: 0.1, type: "square", gain: 0.07, delay: 0.05 });
  },
  click: () => tone({ freq: 300, dur: 0.04, type: "square", gain: 0.06 }),
  tarot: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: semitone(440, n), dur: 0.18, type: "sine", gain: 0.1, delay: i * 0.05 })),
  error: () => tone({ freq: 160, dur: 0.12, type: "square", gain: 0.08 }),
};
