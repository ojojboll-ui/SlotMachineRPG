// PAR sheet: exact theoretical return of the machine in src/slot/machine.js.
//
//   node tools/par.mjs            print the sheet and the constants for machine.js
//   node tools/par.mjs --write    also write docs/PAR.md
//   node tools/par.mjs --mc 5e6   add a Monte Carlo cross-check with that many paid spins
//
// Method: the base game is enumerated over all 30^5 = 24,300,000 reel positions. Hold & Spin is solved exactly as
// a Markov chain over (coins on screen, respins left). Free spins follow in closed form, retriggers included.

import { writeFileSync, mkdirSync } from 'node:fs';
import * as M from '../src/slot/machine.js';
import { seededRng } from '../src/rng.js';

export function computePar() {
  const N = M.STRIPS.map(s => s.length);
  const total = N.reduce((a, b) => a * b, 1);
  // Pre-read the three visible symbols for every stop of every reel.
  const win = M.STRIPS.map((s, c) => s.map((_, i) => [0, 1, 2].map(r => s[(i - 1 + r + N[c]) % N[c]])));
  const hasEye = win.map(col => col.map(w => w.includes('eye')));
  const nMoon = win.map(col => col.map(w => w.filter(x => x === 'moon').length));
  const nObol = win.map(col => col.map(w => w.filter(x => x === 'obol').length));
  const EYE3 = ['eye', 'eye', 'eye'];

  let lineSum10 = 0, hits = 0;
  const scat = new Array(16).fill(0), coin = new Array(16).fill(0);
  const bySym = {}; // sym -> n -> [count, pay10 sum]
  const cols = new Array(5);
  for (let a = 0; a < N[0]; a++) { cols[0] = win[0][a];
  for (let b = 0; b < N[1]; b++) { cols[1] = hasEye[1][b] ? EYE3 : win[1][b];
  for (let c = 0; c < N[2]; c++) { cols[2] = hasEye[2][c] ? EYE3 : win[2][c];
  for (let d = 0; d < N[3]; d++) { cols[3] = hasEye[3][d] ? EYE3 : win[3][d];
  for (let e = 0; e < N[4]; e++) { cols[4] = win[4][e];
    let pay = 0;
    for (let i = 0; i < M.LINES.length; i++) {
      const ln = M.LINES[i], sym = cols[0][ln[0]], table = M.PAY10[sym];
      if (!table) continue;
      let n = 1;
      while (n < 5) { const s = cols[n][ln[n]]; if (s !== sym && s !== 'eye') break; n++; }
      const p = table[n];
      if (p) { pay += p; const t = (bySym[sym] ??= {}); const u = (t[n] ??= [0, 0]); u[0]++; u[1] += p; }
    }
    lineSum10 += pay; if (pay) hits++;
    // scatters are counted after wilds expand (an expanded reel hides its moon); coins before
    scat[nMoon[0][a] + (hasEye[1][b] ? 0 : nMoon[1][b]) + (hasEye[2][c] ? 0 : nMoon[2][c]) + (hasEye[3][d] ? 0 : nMoon[3][d]) + nMoon[4][e]]++;
    coin[nObol[0][a] + nObol[1][b] + nObol[2][c] + nObol[3][d] + nObol[4][e]]++;
  }}}}}

  // ---- Hold & Spin, exact ----
  const wTot = M.HS_VALUES10.reduce((a, v) => a + v[1], 0);
  const meanCoin10 = M.HS_VALUES10.reduce((a, v) => a + v[0] * v[1], 0) / wTot;
  const p = M.HS_LAND[0] / M.HS_LAND[1], CELLS = M.REELS * M.ROWS;
  const binom = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
  const memo = new Map();
  const solve = (k, r) => { // -> [expected final coin count, probability of a full screen]
    if (k >= CELLS) return [CELLS, 1];
    if (r === 0) return [k, 0];
    const key = k * 8 + r; if (memo.has(key)) return memo.get(key);
    const m = CELLS - k; let cnt = 0, full = 0;
    for (let j = 0; j <= m; j++) {
      const pj = binom(m, j) * p ** j * (1 - p) ** (m - j);
      const [c2, f2] = j === 0 ? solve(k, r - 1) : solve(k + j, M.HS_RESPINS);
      cnt += pj * c2; full += pj * f2;
    }
    memo.set(key, [cnt, full]); return [cnt, full];
  };
  const hsValue10 = c => { const [cnt, full] = solve(c, M.HS_RESPINS); return cnt * meanCoin10 + full * M.HS_GRAND10; };
  let hold10 = 0, holdTrig = 0;
  for (let c = M.HS_TRIGGER; c <= CELLS; c++) { hold10 += coin[c] / total * hsValue10(c); holdTrig += coin[c] / total; }

  // ---- Free spins, closed form ----
  const line10 = lineSum10 / total;
  let fsTrig = 0, fsAwarded = 0; // P(trigger), expected spins awarded per spin
  for (let k = 3; k <= 15; k++) { const n = M.FREE_SPINS[Math.min(5, k)] || 0; fsTrig += scat[k] / total; fsAwarded += scat[k] / total * n; }
  const freeSpinValue10 = (M.FREE_MULT * line10 + hold10) / (1 - fsAwarded);
  const free10 = fsAwarded * freeSpinValue10;

  const rtp = (line10 + hold10 + free10) / 10;
  return {
    total, rtp, base: line10 / 10, hold: hold10 / 10, free: free10 / 10,
    hit: hits / total, freeEvery: 1 / fsTrig, holdEvery: 1 / holdTrig,
    freeSpinValue10, holdValue10: hold10 / holdTrig, bonusBuyRtp: M.FREE_SPINS[3] * freeSpinValue10 / 10 / M.BONUS_BUY_X,
    meanCoin10, bySym, scat, coin,
  };
}

export function monteCarlo(spins, seed = 12345) {
  const rng = seededRng(seed);
  let won10 = 0, sq = 0;
  const freeRound = n => { let t = 0, left = n; while (left-- > 0) { const o = M.spin(rng); t += o.linePay10 * M.FREE_MULT; left += o.freeSpins; if (o.holdSpin) t += M.holdAndSpin(rng, o.raw).total10; } return t; };
  for (let i = 0; i < spins; i++) {
    const o = M.spin(rng); let w = o.linePay10;
    if (o.holdSpin) w += M.holdAndSpin(rng, o.raw).total10;
    if (o.freeSpins) w += freeRound(o.freeSpins);
    won10 += w; sq += (w / 10) ** 2;
  }
  const rtp = won10 / 10 / spins, sd = Math.sqrt(sq / spins - rtp * rtp);
  return { rtp, sd, ci95: 1.96 * sd / Math.sqrt(spins) };
}

const pct = (x, d = 3) => (x * 100).toFixed(d) + '%';

function markdown(P, mc) {
  const rows = M.PAY_ORDER.map(sym => `| ${M.SYMBOLS[sym].name} | ${[3, 4, 5].map(n => (M.PAY10[sym][n] / 10) + '×').join(' | ')} | ${[3, 4, 5].map(n => pct((P.bySym[sym]?.[n]?.[1] ?? 0) / P.total / 10)).join(' | ')} |`).join('\n');
  return `# PAR sheet

Generated by \`node tools/par.mjs --write\`. Do not edit by hand.

Game: One-Armed Hero, 5 reels × 3 rows, ${M.LINES.length} fixed lines, ${M.STRIPS[0].length} stops per reel (${P.total.toLocaleString('en')} positions).

## Return to player

| Component | RTP |
|---|---|
| Base game line wins | ${pct(P.base)} |
| Free spins | ${pct(P.free)} |
| Hold & Spin | ${pct(P.hold)} |
| **Total** | **${pct(P.rtp)}** |

| Feature | Figure |
|---|---|
| Line hit frequency | ${pct(P.hit, 2)} (1 in ${(1 / P.hit).toFixed(2)}) |
| Free spins trigger | 1 in ${P.freeEvery.toFixed(1)} spins |
| Hold & Spin trigger | 1 in ${P.holdEvery.toFixed(1)} spins |
| Value of one free spin | ${(P.freeSpinValue10 / 10).toFixed(4)} × bet |
| Mean Hold & Spin | ${(P.holdValue10 / 10).toFixed(3)} × bet |
| Bonus buy (${M.FREE_SPINS[3]} free spins for ${M.BONUS_BUY_X} × bet) | ${pct(P.bonusBuyRtp, 2)} RTP |
| Single-reel respin | priced at expected value ÷ ${pct(M.PAR.rtp, 2)}, so at most ${pct(M.PAR.rtp, 2)} RTP |
| Gamble (double or nothing, 50/50) | 100% RTP |
| Maximum win per game round | ${M.MAX_WIN_X} × bet (cap) |
${mc ? `| Monte Carlo cross-check (${mc.spins.toLocaleString('en')} spins) | ${pct(mc.rtp)} ± ${pct(mc.ci95)} (95%), σ = ${mc.sd.toFixed(2)} × bet per spin |\n` : ''}
The cap is not included in the figures above; it only affects outcomes rarer than the simulation can observe.

## Paytable (× total bet) and contribution

| Symbol | 3 | 4 | 5 | RTP from 3 | RTP from 4 | RTP from 5 |
|---|---|---|---|---|---|---|
${rows}

Wild (Eye): reels 2–4 only, expands over its whole reel, substitutes for all paying symbols.
Scatter (Blood Moon): 3 / 4 / 5 anywhere award ${M.FREE_SPINS[3]} / ${M.FREE_SPINS[4]} / ${M.FREE_SPINS[5]} free spins, line wins × ${M.FREE_MULT}, retriggers allowed. Counted after wilds expand.
Coin (Obol): ${M.HS_TRIGGER}+ anywhere start Hold & Spin (${M.HS_RESPINS} respins, ${M.HS_LAND[0]}/${M.HS_LAND[1]} per empty cell, reset on any new coin, full screen adds ${M.HS_GRAND10 / 10} × bet).

Coin values (× bet : weight): ${M.HS_VALUES10.map(v => `${v[0] / 10}:${v[1]}`).join(', ')}. Mean ${(P.meanCoin10 / 10).toFixed(4)} × bet.

## Reel strips

${M.STRIPS.map((s, i) => `Reel ${i + 1}: ${s.join(', ')}`).join('\n\n')}

## Paylines (row per reel, 0 = top)

${M.LINES.map((l, i) => `${i + 1}: ${l.join(' ')}`).join('\n')}
`;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const t0 = Date.now();
  const P = computePar();
  console.log(`RTP ${pct(P.rtp, 4)}  base ${pct(P.base, 4)}  free ${pct(P.free, 4)}  hold ${pct(P.hold, 4)}`);
  console.log(`hit ${pct(P.hit, 2)}  free 1 in ${P.freeEvery.toFixed(2)}  hold 1 in ${P.holdEvery.toFixed(2)}  bonus buy RTP ${pct(P.bonusBuyRtp, 2)}`);
  console.log('\nPaste into PAR in src/slot/machine.js:');
  console.log(`  rtp: ${P.rtp.toFixed(6)},\n  base: ${P.base.toFixed(6)}, free: ${P.free.toFixed(6)}, hold: ${P.hold.toFixed(6)}, hit: ${P.hit.toFixed(6)}, freeEvery: ${P.freeEvery.toFixed(3)}, holdEvery: ${P.holdEvery.toFixed(3)},\n  freeSpinValue10: ${P.freeSpinValue10.toFixed(6)},\n  holdValue10: ${P.holdValue10.toFixed(6)},\n  bonusBuyRtp: ${P.bonusBuyRtp.toFixed(6)},`);
  let mc = null;
  const i = process.argv.indexOf('--mc');
  if (i > 0) { const spins = Number(process.argv[i + 1]); mc = { ...monteCarlo(spins), spins }; console.log(`\nMonte Carlo: ${pct(mc.rtp)} ± ${pct(mc.ci95)}  sd ${mc.sd.toFixed(2)}`); }
  if (process.argv.includes('--write')) { mkdirSync(new URL('../docs/', import.meta.url), { recursive: true }); writeFileSync(new URL('../docs/PAR.md', import.meta.url), markdown(P, mc)); console.log('wrote docs/PAR.md'); }
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
