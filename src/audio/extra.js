// Sounds the dungeon adds to the One-Armed Hero set: guns, doors, footsteps, keys and the things in the dark.

import { SFX, fm, noise, sweep, mix, crush, drive } from './dsp.js';

Object.assign(SFX, {
  gun:    () => crush(drive(mix([noise({ dur: 0.35, lp: 0.7, hp: 0.05, decay: 14 }), 1], [sweep({ dur: 0.2, f0: 180, f1: 40, curve: 20, decay: 16 }), 1]), 2.5), 8, 2),
  rifle:  () => crush(drive(mix([noise({ dur: 0.7, lp: 0.55, hp: 0.02, decay: 7 }), 1], [sweep({ dur: 0.35, f0: 120, f1: 30, curve: 10, decay: 9 }), 1.2], [noise({ dur: 0.05, lp: 1, hp: 0.5, decay: 90 }), 0.6]), 3), 8, 2),
  click2: () => crush(mix([noise({ dur: 0.03, lp: 1, hp: 0.6, decay: 150 }), 0.6], [fm({ f: 2400, dur: 0.03, ratio: 1.5, index: 2, d: 0.02, s: 0, r: 0.005 }), 0.3]), 6),
  door:   () => crush(mix([sweep({ dur: 0.5, f0: 90, f1: 60, curve: 2, decay: 3, a: 0.05 }), 0.6], [noise({ dur: 0.5, lp: 0.08, decay: 5, a: 0.05 }), 0.9], [fm({ f: 310, dur: 0.4, ratio: 1.01, index: 3, vib: 0.05, a: 0.1, d: 0.3, s: 0, r: 0.05 }), 0.18]), 8, 2),
  step:   () => crush(noise({ dur: 0.07, lp: 0.15, decay: 45 }), 6, 2),
  unlock: () => crush(mix([fm({ f: 1200, dur: 0.06, ratio: 2.7, index: 2, d: 0.05, s: 0, r: 0.01 }), 0.6], [fm({ f: 900, dur: 0.1, ratio: 2.7, index: 2, d: 0.08, s: 0, r: 0.01 }), 0.6, 0.12], [noise({ dur: 0.05, lp: 0.5, decay: 60 }), 0.5, 0.12]), 8),
  growl:  () => crush(drive(mix([fm({ f: 55, dur: 0.9, ratio: 0.51, index: 7, indexDecay: 1, fb: 0.95, vib: 0.08, a: 0.15, d: 0.6, s: 0.2, r: 0.2 }), 1], [noise({ dur: 0.9, lp: 0.08, decay: 3, a: 0.2 }), 0.7]), 2), 7, 3),
  bump:   () => crush(sweep({ dur: 0.1, f0: 110, f1: 60, curve: 30, decay: 30 }), 7, 2),
  chest:  () => crush(mix([sweep({ dur: 0.35, f0: 140, f1: 220, curve: 4, decay: 6, a: 0.05 }), 0.5], [noise({ dur: 0.3, lp: 0.2, decay: 8 }), 0.6]), 8, 2),
});
