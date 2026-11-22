// Sound synthesis, offline. Everything the game plays is computed here into small PCM buffers:
//  - FM voices (two operators with feedback, the YM2151 / YM2612 recipe of 90s arcade boards and the Mega Drive)
//  - drum and effect "samples" built from noise and sine sweeps
// and then crunched: rendered at 22 kHz, quantised to 8 bits and optionally sample-and-held, the way a cheap PCM
// channel sounded. Pure functions on Float32Arrays, so they run (and can be measured) in Node too.

export const SR = 22050;
const TAU = Math.PI * 2;
export const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// deterministic noise so every build sounds the same
let ns = 22222;
const rnd = () => { ns = (ns * 1664525 + 1013904223) >>> 0; return ns / 2147483648 - 1; };

export const buf = sec => new Float32Array(Math.max(1, Math.round(sec * SR)));
const adsr = (t, dur, a, d, s, r) => (t < a ? t / a : t < a + d ? 1 - (1 - s) * (t - a) / d : t < dur - r ? s : Math.max(0, s * (dur - t) / r));

/**
 * Two-operator FM. o: { f, dur, ratio (modulator), index, indexDecay, fb (feedback), a, d, s, r, vib, bend }
 */
export function fm(o) {
  const out = buf(o.dur), { f, ratio = 1, index = 2, indexDecay = 3, fb = 0, a = 0.004, d = 0.2, s = 0.5, r = 0.08, vib = 0, bend = 0, car = 1 } = o;
  let pc = 0, pm = 0, prev = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, fr = f * (1 + bend * Math.exp(-t * 30)) * (1 + vib * Math.sin(TAU * 5.5 * t) * Math.min(1, t * 4));
    pm += TAU * fr * ratio / SR; pc += TAU * fr * car / SR;
    const m = Math.sin(pm + fb * prev); prev = m;
    out[i] = Math.sin(pc + index * Math.exp(-t * indexDecay) * m) * adsr(t, o.dur, a, d, s, r);
  }
  return out;
}

/** Filtered noise burst. o: { dur, lp, hp (0..1 one-pole coefficients), decay, a } */
export function noise(o) {
  const out = buf(o.dur), { lp = 1, hp = 0, decay = 20, a = 0.001 } = o;
  let l = 0, h = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, x = rnd();
    l += (x - l) * lp; h += (l - h) * hp;
    out[i] = (l - h) * Math.min(1, t / a) * Math.exp(-t * decay);
  }
  return out;
}

/** Sine sweep from f0 to f1 (exponential), for kicks, thuds and risers. */
export function sweep(o) {
  const out = buf(o.dur), { f0, f1, curve = 20, decay = 8, a = 0.001 } = o;
  let p = 0;
  for (let i = 0; i < out.length; i++) { const t = i / SR, f = f1 + (f0 - f1) * Math.exp(-t * curve); p += TAU * f / SR; out[i] = Math.sin(p) * Math.min(1, t / a) * Math.exp(-t * decay); }
  return out;
}

export function mix(...layers) { // [buffer, gain, delaySeconds]
  let len = 0;
  for (const [b, , at = 0] of layers) len = Math.max(len, b.length + Math.round(at * SR));
  const out = new Float32Array(len);
  for (const [b, g = 1, at = 0] of layers) { const o = Math.round(at * SR); for (let i = 0; i < b.length; i++) out[o + i] += b[i] * g; }
  return out;
}
export function gain(b, g) { for (let i = 0; i < b.length; i++) b[i] *= g; return b; }
export function normalize(b, peak = 0.9) { let m = 0; for (let i = 0; i < b.length; i++) m = Math.max(m, Math.abs(b[i])); if (m > 0) gain(b, peak / m); return b; }
/** Soft clip, for grit. */
export function drive(b, amt) { for (let i = 0; i < b.length; i++) b[i] = Math.tanh(b[i] * amt) / Math.tanh(amt); return b; }
/** The crunch: quantise to `bits` and hold every sample `hold` times (halves, thirds... the sample rate). */
export function crush(b, bits = 8, hold = 1) {
  const q = Math.pow(2, bits - 1); let h = 0;
  for (let i = 0; i < b.length; i++) { if (i % hold === 0) h = Math.round(b[i] * q) / q; b[i] = h; }
  return b;
}
export function fadeOut(b, sec = 0.01) { const n = Math.min(b.length, Math.round(sec * SR)); for (let i = 0; i < n; i++) b[b.length - 1 - i] *= i / n; return b; }

// ---------------------------------------------------------------------------------------------------------------
// Instruments: f -> buffer. Sampled at a few pitches and replayed at other rates, like a tracker or a PCM board.
// ---------------------------------------------------------------------------------------------------------------

export const INSTRUMENTS = {
  bass:  f => crush(drive(fm({ f, dur: 0.5, ratio: 1, index: 3.2, indexDecay: 9, fb: 0.4, d: 0.25, s: 0.35, r: 0.06 }), 1.6), 8),
  bell:  f => crush(fm({ f, dur: 1.1, ratio: 3.5, index: 2.2, indexDecay: 5, d: 0.9, s: 0, r: 0.05 }), 8),
  organ: f => crush(mix([fm({ f, dur: 1.6, ratio: 1, index: 1.1, indexDecay: 0.4, a: 0.06, d: 0.3, s: 0.8, r: 0.3 }), 0.6], [fm({ f: f * 2.005, dur: 1.6, ratio: 0.5, index: 0.7, indexDecay: 0.2, a: 0.09, d: 0.3, s: 0.7, r: 0.3 }), 0.3]), 8, 2),
  lead:  f => crush(fm({ f, dur: 0.6, ratio: 2, index: 1.9, indexDecay: 2.5, fb: 0.25, a: 0.01, d: 0.2, s: 0.6, r: 0.12, vib: 0.006 }), 8),
  brass: f => crush(drive(fm({ f, dur: 0.7, ratio: 1, index: 3.4, indexDecay: 1.6, fb: 0.5, a: 0.03, d: 0.25, s: 0.65, r: 0.14 }), 1.4), 8),
  pluck: f => crush(fm({ f, dur: 0.35, ratio: 1, index: 4, indexDecay: 16, fb: 0.2, d: 0.3, s: 0, r: 0.03 }), 8),
};
export const DRUMS = {
  kick:  () => crush(drive(mix([sweep({ dur: 0.28, f0: 170, f1: 44, curve: 26, decay: 11 }), 1], [noise({ dur: 0.02, lp: 0.6, decay: 200 }), 0.3]), 2), 8, 2),
  snare: () => crush(mix([noise({ dur: 0.2, lp: 0.9, hp: 0.25, decay: 22 }), 0.8], [sweep({ dur: 0.12, f0: 260, f1: 170, curve: 30, decay: 28 }), 0.6]), 8, 2),
  hat:   () => crush(noise({ dur: 0.05, lp: 1, hp: 0.75, decay: 70 }), 6, 1),
  ohat:  () => crush(noise({ dur: 0.22, lp: 1, hp: 0.7, decay: 13 }), 6, 1),
  tom:   () => crush(sweep({ dur: 0.25, f0: 220, f1: 90, curve: 14, decay: 12 }), 8, 2),
  crash: () => crush(noise({ dur: 0.9, lp: 1, hp: 0.6, decay: 4.5 }), 6, 2),
};

const seq = (inst, notes, step, g = 1) => mix(...notes.map((m, i) => [INSTRUMENTS[inst](mtof(m)), g, i * step]));
const chord = (inst, notes, g = 1) => mix(...notes.map(m => [INSTRUMENTS[inst](mtof(m)), g]));

// ---------------------------------------------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------------------------------------------

export const SFX = {
  click:    () => crush(fm({ f: 1400, dur: 0.03, ratio: 2, index: 1, d: 0.02, s: 0, r: 0.005 }), 6),
  tick:     () => crush(noise({ dur: 0.016, lp: 0.9, hp: 0.5, decay: 240 }), 5),
  reelStop: () => crush(mix([sweep({ dur: 0.1, f0: 150, f1: 60, curve: 40, decay: 34 }), 1], [noise({ dur: 0.03, lp: 0.5, decay: 130 }), 0.5], [fm({ f: 720, dur: 0.07, ratio: 2.76, index: 2, d: 0.06, s: 0, r: 0.01 }), 0.16]), 8, 2),
  coin:     () => crush(mix([fm({ f: 1976, dur: 0.09, ratio: 3, index: 1.2, d: 0.08, s: 0, r: 0.01 }), 0.7], [fm({ f: 2637, dur: 0.22, ratio: 3, index: 1, d: 0.2, s: 0, r: 0.02 }), 0.7, 0.06]), 8),
  count:    () => crush(fm({ f: 1568, dur: 0.035, ratio: 2, index: 0.8, d: 0.03, s: 0, r: 0.005 }), 6),
  winSmall: () => seq('bell', [72, 76, 79], 0.07, 0.6),
  winBig:   () => mix([seq('brass', [60, 64, 67, 72, 76, 79, 84], 0.085, 0.5), 1], [seq('bell', [84, 88, 91, 96], 0.085, 0.4), 1, 0.34], [DRUMS.crash(), 0.5, 0.5]),
  jackpot:  () => mix([seq('brass', [60, 60, 67, 72, 72, 79, 84, 84, 91, 96], 0.11, 0.5), 1], [chord('organ', [48, 55, 60, 64], 0.3), 1, 0.9], [DRUMS.crash(), 0.6], [DRUMS.crash(), 0.6, 0.9]),
  scatter:  () => crush(mix([fm({ f: 196, dur: 1.2, ratio: 1.41, index: 3.5, indexDecay: 2.2, d: 1.1, s: 0, r: 0.05 }), 0.8], [fm({ f: 392, dur: 0.8, ratio: 3.5, index: 1.5, indexDecay: 4, d: 0.7, s: 0, r: 0.05 }), 0.3]), 8, 2),
  wild:     () => crush(mix([fm({ f: 220, dur: 0.5, ratio: 2, index: 3, indexDecay: 2, bend: -0.5, a: 0.02, d: 0.4, s: 0, r: 0.05 }), 0.6], [seq('bell', [81, 85, 88, 93], 0.05, 0.4), 1, 0.08]), 8),
  slash:    () => crush(mix([noise({ dur: 0.16, lp: 0.9, hp: 0.5, decay: 26, a: 0.03 }), 0.9], [sweep({ dur: 0.12, f0: 1800, f1: 500, curve: 22, decay: 30 }), 0.12]), 7),
  hit:      () => crush(drive(mix([sweep({ dur: 0.16, f0: 210, f1: 50, curve: 30, decay: 20 }), 1], [noise({ dur: 0.08, lp: 0.45, decay: 50 }), 0.8]), 2.4), 8, 2),
  heavy:    () => crush(drive(mix([sweep({ dur: 0.4, f0: 150, f1: 32, curve: 12, decay: 9 }), 1], [noise({ dur: 0.25, lp: 0.3, decay: 14 }), 0.9], [noise({ dur: 0.05, lp: 1, hp: 0.4, decay: 80 }), 0.5]), 3), 8, 3),
  fire:     () => crush(mix([noise({ dur: 0.45, lp: 0.25, hp: 0.05, decay: 7, a: 0.08 }), 1], [sweep({ dur: 0.3, f0: 90, f1: 300, curve: 6, decay: 9 }), 0.25]), 7, 2),
  block:    () => crush(mix([fm({ f: 520, dur: 0.3, ratio: 2.76, index: 4, indexDecay: 9, d: 0.28, s: 0, r: 0.02 }), 0.7], [noise({ dur: 0.04, lp: 1, hp: 0.3, decay: 90 }), 0.5]), 8),
  stun:     () => seq('bell', [84, 79, 75, 72], 0.06, 0.5),
  crit:     () => crush(drive(mix([chord('brass', [36, 43, 48, 55, 60, 67], 0.3), 1], [noise({ dur: 0.3, lp: 0.6, decay: 12 }), 0.5], [sweep({ dur: 0.3, f0: 120, f1: 40, curve: 12, decay: 10 }), 0.6]), 1.8), 8, 3),   // the 90s orchestra hit
  heal:     () => seq('bell', [72, 76, 79, 84, 88], 0.06, 0.45),
  charge:   () => crush(fm({ f: 660, dur: 0.1, ratio: 2, index: 1.4, bend: -0.4, d: 0.09, s: 0, r: 0.01 }), 8),
  special:  () => mix([crush(sweep({ dur: 0.5, f0: 80, f1: 900, curve: 5, decay: 3, a: 0.2 }), 7, 2), 0.5], [chord('brass', [48, 55, 60, 67], 0.3), 1, 0.3], [DRUMS.crash(), 0.5, 0.3]),
  enemyAtk: () => crush(drive(mix([fm({ f: 70, dur: 0.4, ratio: 0.5, index: 6, indexDecay: 4, fb: 0.9, a: 0.03, d: 0.3, s: 0.2, r: 0.08 }), 1], [noise({ dur: 0.3, lp: 0.2, decay: 9 }), 0.5]), 2), 7, 3),
  hurt:     () => crush(drive(mix([sweep({ dur: 0.25, f0: 300, f1: 70, curve: 14, decay: 12 }), 1], [noise({ dur: 0.12, lp: 0.5, decay: 30 }), 0.6]), 2), 8, 2),
  die:      () => crush(mix([fm({ f: 180, dur: 0.8, ratio: 0.5, index: 5, indexDecay: 2, fb: 0.8, bend: 1.2, d: 0.7, s: 0, r: 0.05 }), 0.8], [noise({ dur: 0.7, lp: 0.3, decay: 5 }), 0.6]), 7, 3),
  curse:    () => crush(fm({ f: 147, dur: 0.7, ratio: 1.41, index: 5, indexDecay: 1.5, fb: 0.6, vib: 0.03, a: 0.05, d: 0.6, s: 0, r: 0.05 }), 7, 2),
  gambleWin:  () => seq('brass', [67, 72, 76, 84], 0.08, 0.5),
  gambleLose: () => seq('brass', [55, 51, 48, 43], 0.12, 0.5),
  freeSpins:  () => mix([chord('organ', [38, 45, 50, 53], 0.35), 1], [seq('brass', [50, 53, 57, 62, 65, 69, 74], 0.1, 0.45), 1, 0.1], [SFX.scatter(), 0.5], [DRUMS.crash(), 0.5, 0.7]),
  holdLand:   () => crush(mix([fm({ f: 880, dur: 0.25, ratio: 2.76, index: 2.4, indexDecay: 10, d: 0.22, s: 0, r: 0.02 }), 0.7], [sweep({ dur: 0.08, f0: 200, f1: 80, curve: 40, decay: 40 }), 0.6]), 8),
  select:   () => seq('pluck', [57, 64], 0.05, 0.6),
  buy:      () => mix([SFX.coin(), 1], [seq('pluck', [69, 76], 0.06, 0.5), 1, 0.05]),
  error:    () => crush(fm({ f: 110, dur: 0.16, ratio: 1, index: 4, fb: 0.7, d: 0.15, s: 0, r: 0.01 }), 6, 2),
  heroDie:  () => mix([seq('organ', [57, 53, 50, 45], 0.32, 0.4), 1], [SFX.die(), 0.6]),
  power:    () => crush(sweep({ dur: 0.18, f0: 3000, f1: 200, curve: 9, decay: 10 }), 6),   // the tube switching on
};

// ---------------------------------------------------------------------------------------------------------------
// Songs: generated from a seed. Dark modes, an FM bass ostinato, bell arpeggios, a wandering lead and PCM drums.
// ---------------------------------------------------------------------------------------------------------------

const MODES = { phrygian: [0, 1, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10] };
const PROGS = [[0, 5, 2, 6], [0, 3, 5, 4], [0, 1, 0, 6], [0, 6, 5, 4], [0, 2, 3, 4], [0, 5, 3, 4]];
const KINDS = {
  title: { bpm: 84,  bass: 'x...............', drums: null,   arp: 2, lead: 0.5, pad: true },
  map:   { bpm: 92,  bass: 'x.......x.....x.', drums: 'soft', arp: 2, lead: 0,   pad: true },
  calm:  { bpm: 76,  bass: 'x...............', drums: null,   arp: 4, lead: 0.4, pad: true },
  fight: { bpm: 132, bass: 'x.x.x.xxx.x.x.xx', drums: 'rock', arp: 1, lead: 1,   pad: false },
  boss:  { bpm: 152, bass: 'x.xxx.xxx.xxx.xx', drums: 'fast', arp: 1, lead: 1,   pad: true },
  free:  { bpm: 144, bass: 'xxx.xxx.xxx.xxxx', drums: 'fast', arp: 1, lead: 1,   pad: false },
};
const DRUM_PAT = {
  soft: { hat: 'x...x...x...x...', kick: 'x.......x.......' },
  rock: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  fast: { kick: 'x..x..x.x..x..x.', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', ohat: '..............x.' },
};

/** @returns {{bpm:number, steps:number, events:Array<[step, voice, midi, gain]>}} voice is an instrument or drum */
export function makeSong(kind, rng) {
  const K = KINDS[kind] || KINDS.map, mode = MODES[rng.pick(Object.keys(MODES))], prog = rng.pick(PROGS), root = 33 + rng.int(8);
  const deg = (d, oct = 0) => root + oct * 12 + mode[((d % 7) + 7) % 7] + Math.floor(d / 7) * 12;
  const events = [], BARS = 8;
  const motif = Array.from({ length: 8 }, () => rng.int(5) - 1), rhythm = rng.pick(['x..x..x.x...x.x.', 'x.x...x.x.x...x.', 'x...x.x...x.x.xx', 'x..x.x..x..x.x..']);
  for (let bar = 0; bar < BARS; bar++) {
    const ch = prog[bar % 4], s0 = bar * 16;
    for (let i = 0; i < 16; i++) {
      const s = s0 + i;
      if (K.bass[i] === 'x') events.push([s, 'bass', deg(ch, 0) + (i % 8 === 6 && kind !== 'title' ? 12 : 0), 0.9]);
      if (i % K.arp === 0 && (kind !== 'fight' || bar >= 2)) { const up = [0, 2, 4, 7, 4, 2][Math.floor(i / K.arp) % 6]; events.push([s, kind === 'fight' || kind === 'boss' || kind === 'free' ? 'pluck' : 'bell', deg(ch + up, 2), 0.32]); }
      if (K.lead && rhythm[i] === 'x' && bar % 4 !== 3 && rng.int(100) < K.lead * 100) {
        const n = motif[(i >> 1) % 8] + (bar % 2 ? 1 : 0) + (bar >= 4 ? 2 : 0);
        events.push([s, kind === 'boss' ? 'brass' : 'lead', deg(ch + 2 + n, 3), 0.42]);
      }
      const D = K.drums && DRUM_PAT[K.drums];
      if (D) for (const d in D) if (D[d][i] === 'x') events.push([s, d, 0, d === 'hat' ? 0.25 : d === 'kick' ? 0.9 : 0.6]);
    }
    if (K.pad) for (const n of [0, 2, 4]) events.push([s0, 'organ', deg(ch + n, 2), 0.2], [s0 + 8, 'organ', deg(ch + n, 2), 0.16]);
    if (K.drums && K.drums !== 'soft' && bar % 4 === 3) for (let i = 12; i < 16; i++) events.push([s0 + i, 'tom', 0, 0.6]);
    if (K.drums && K.drums !== 'soft' && bar % 4 === 0) events.push([s0, 'crash', 0, 0.35]);
  }
  return { bpm: K.bpm, steps: BARS * 16, events };
}
