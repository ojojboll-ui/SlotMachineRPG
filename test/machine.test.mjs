import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/slot/machine.js';
import { seededRng, gameRng } from '../src/rng.js';
import { computePar } from '../tools/par.mjs';

test('strips: 30 stops, wilds only on reels 2-4, known symbols', () => {
  M.STRIPS.forEach((s, c) => {
    assert.equal(s.length, 30);
    s.forEach(sym => assert.ok(M.SYMBOLS[sym], sym));
    assert.equal(s.includes('eye'), c >= 1 && c <= 3);
  });
});

test('every bet level pays every prize in whole credits', () => {
  for (const bet of M.BET_LEVELS) {
    assert.equal(bet % 10, 0);
    for (const sym of M.PAY_ORDER) for (const n of [3, 4, 5]) assert.ok(Number.isInteger(M.credits(M.PAY10[sym][n] * M.FREE_MULT, bet)));
    for (const v of M.HS_VALUES10) assert.ok(Number.isInteger(M.credits(v[0], bet)));
  }
});

test('line evaluation: left to right, wild substitutes and expands', () => {
  const g = [['sword', 'sword', 'eye', 'sword', 'tome'], ['tome', 'fire', 'fire', 'fire', 'fire'], ['skull', 'skull', 'skull', 'skull', 'skull']];
  const ex = M.expandWilds(g);
  assert.deepEqual(ex, [{ reel: 2, from: 0 }]);
  const wins = M.evalLines(g);
  const top = wins.find(w => w.line === 1);
  assert.deepEqual({ sym: top.sym, n: top.n, pay10: top.pay10 }, { sym: 'sword', n: 4, pay10: 20 });
  assert.equal(wins.find(w => w.line === 0), undefined); // tome, fire: no run of 3
});

test('PAR constants in machine.js match the exact enumeration', () => {
  const P = computePar();
  for (const k of ['rtp', 'base', 'free', 'hold', 'hit', 'bonusBuyRtp']) assert.ok(Math.abs(P[k] - M.PAR[k]) < 1e-6, `${k}: ${P[k]} vs ${M.PAR[k]}`);
  assert.ok(Math.abs(P.freeSpinValue10 - M.PAR.freeSpinValue10) < 1e-5);
  assert.ok(Math.abs(P.holdValue10 - M.PAR.holdValue10) < 1e-5);
  assert.ok(P.rtp > 0.9595 && P.rtp < 0.9605, 'RTP is 96.0%');
});

test('a respin is never sold below its value', () => {
  const rng = seededRng(7);
  for (let i = 0; i < 300; i++) {
    const o = M.spin(rng), reel = rng.int(5), bet = rng.pick(M.BET_LEVELS);
    const value = M.respinValue10(o.stops, reel) * bet / 10, price = M.respinPrice(o.stops, reel, bet);
    assert.ok(Number.isInteger(price) && price >= 1);
    assert.ok(value / price <= M.PAR.rtp + 1e-9, `respin RTP ${value / price}`);
  }
});

test('hold & spin: coins never vanish, totals add up', () => {
  const rng = seededRng(99);
  for (let i = 0; i < 2000; i++) {
    const raw = M.gridFrom([rng.int(30), rng.int(30), rng.int(30), rng.int(30), rng.int(30)]);
    const h = M.holdAndSpin(rng, raw);
    let sum = h.full ? M.HS_GRAND10 : 0, n = 0;
    h.cells.forEach((row, r) => row.forEach((cell, c) => { if (cell) { sum += cell.v10; n++; } else assert.equal(raw[r][c] === 'obol', false); }));
    assert.equal(sum, h.total10); assert.equal(n, h.coins); assert.equal(h.full, n === 15);
  }
});

test('game rng: unbiased integers in range', () => {
  const rng = gameRng(), counts = new Array(30).fill(0), N = 300000;
  for (let i = 0; i < N; i++) { const x = rng.int(30); assert.ok(x >= 0 && x < 30); counts[x]++; }
  const exp = N / 30, chi = counts.reduce((a, c) => a + (c - exp) ** 2 / exp, 0);
  assert.ok(chi < 70, `chi-square ${chi} (29 dof)`); // p < 0.00003 if it fails
});
