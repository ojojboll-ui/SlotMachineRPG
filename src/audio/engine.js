// Playback: a small sampler and step sequencer on Web Audio. All sound data comes from dsp.js.

import { SR, SFX, INSTRUMENTS, DRUMS, mtof, makeSong, normalize } from './dsp.js';
import { seededRng } from '../rng.js';

const BASES = [24, 36, 48, 60, 72, 84];   // every instrument is sampled once per octave

export function createAudio() {
  let ctx = null, master, musicBus, sfxBus, comp;
  const raw = { sfx: {}, inst: {}, drum: {} }, bufs = new Map();
  let song = null, songKey = '', nextStep = 0, nextTime = 0, timer = null;
  const A = { ready: false, muted: false, musicVol: 0.5, sfxVol: 0.9 };

  /** Synthesize every sound. Slow-ish (a few hundred ms), so call it while a loading screen shows. */
  A.build = () => {
    for (const k in SFX) raw.sfx[k] = normalize(SFX[k](), 0.85);
    for (const k in DRUMS) raw.drum[k] = DRUMS[k]();
    for (const k in INSTRUMENTS) raw.inst[k] = BASES.map(m => INSTRUMENTS[k](mtof(m)));
  };
  const toBuffer = (key, data) => {
    let b = bufs.get(key);
    if (!b) { b = ctx.createBuffer(1, data.length, SR); b.getChannelData(0).set(data); bufs.set(key, b); }
    return b;
  };
  /** Must be called from a user gesture. */
  A.unlock = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
      master = ctx.createGain(); musicBus = ctx.createGain(); sfxBus = ctx.createGain();
      musicBus.connect(master); sfxBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
      A.ready = true; A.apply();
    }
    if (ctx.state === 'suspended') ctx.resume();
  };
  A.apply = () => { if (!ctx) return; master.gain.value = A.muted ? 0 : 0.8; musicBus.gain.value = A.musicVol * 0.5; sfxBus.gain.value = A.sfxVol; };
  const fire = (buffer, bus, when, gain, rate) => {
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = buffer; s.playbackRate.value = rate; g.gain.value = gain;
    s.connect(g); g.connect(bus); s.start(when);
  };
  /** Play a sound effect. o: { vol, rate, delay } */
  A.play = (name, o = {}) => {
    if (!A.ready || A.muted || !raw.sfx[name]) return;
    fire(toBuffer('s:' + name, raw.sfx[name]), sfxBus, ctx.currentTime + (o.delay || 0), o.vol ?? 0.7, o.rate || 1);
  };
  const voice = (v, midi, when, gain) => {
    if (raw.drum[v]) return fire(toBuffer('d:' + v, raw.drum[v]), musicBus, when, gain, 1);
    const set = raw.inst[v]; if (!set) return;
    let bi = 0; for (let i = 0; i < BASES.length; i++) if (Math.abs(BASES[i] - midi) < Math.abs(BASES[bi] - midi)) bi = i;
    fire(toBuffer(`i:${v}:${bi}`, set[bi]), musicBus, when, gain, Math.pow(2, (midi - BASES[bi]) / 12));
  };
  const schedule = () => {
    if (!song || !ctx) return;
    const stepDur = 60 / song.bpm / 4;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.25) {
      for (const e of song.byStep[nextStep] || []) voice(e[1], e[2], nextTime, e[3]);
      nextStep = (nextStep + 1) % song.steps; nextTime += stepDur;
    }
  };
  /** Switch the music. The same kind and seed always gives the same tune. */
  A.music = (kind, seed = 1) => {
    const key = kind + ':' + seed;
    if (key === songKey) return;
    songKey = key;
    if (!kind) { song = null; return; }
    const s = makeSong(kind, seededRng(seed * 7919 + kind.length));
    s.byStep = []; for (const e of s.events) (s.byStep[e[0]] ||= []).push(e);
    song = s; nextStep = 0; nextTime = 0;
    if (!timer) timer = setInterval(schedule, 60);
  };
  A.duck = (sec = 1.2) => { if (!ctx) return; const t = ctx.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(A.musicVol * 0.15, t); musicBus.gain.linearRampToValueAtTime(A.musicVol * 0.5, t + sec); };
  return A;
}
