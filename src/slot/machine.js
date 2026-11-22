// The slot machine: fixed, certifiable math. Pure functions, no DOM, no meta game.
//
// Money is counted in whole credits. Every bet level is a multiple of 10 and every pay is stored in tenths of the
// total bet (the "10" suffix), so all wins are exact integers: win = pay10 * bet / 10. Nothing is ever rounded.
// See docs/PAR.md for the full sheet; tools/par.mjs derives it by enumerating all 30^5 reel positions.

export const REELS = 5;
export const ROWS = 3;

export const SYMBOLS = {
  crown:  { name: 'Crown',      role: 'pay' },
  tome:   { name: 'Grimoire',   role: 'pay' },
  flask:  { name: 'Flask',      role: 'pay' },
  sword:  { name: 'Blade',      role: 'pay' },
  fire:   { name: 'Hellfire',   role: 'pay' },
  shield: { name: 'Bulwark',    role: 'pay' },
  eye:    { name: 'Eye (Wild)', role: 'wild' },     // reels 2-4 only; expands over its reel
  obol:   { name: 'Obol',       role: 'coin' },     // 6+ anywhere: Hold & Spin
  moon:   { name: 'Blood Moon', role: 'scatter' },  // 3+ anywhere: free spins
  skull:  { name: 'Skull',      role: 'blank' },
};

// Reel strips, 30 stops each. The visible window shows stop-1, stop, stop+1.
export const STRIPS = [
  ['skull', 'flask', 'sword', 'skull', 'fire', 'fire', 'tome', 'fire', 'obol', 'tome', 'crown', 'shield', 'skull', 'flask', 'shield',
   'shield', 'flask', 'sword', 'flask', 'sword', 'shield', 'moon', 'obol', 'sword', 'sword', 'sword', 'fire', 'obol', 'skull', 'flask'],
  ['sword', 'shield', 'obol', 'crown', 'sword', 'flask', 'shield', 'obol', 'tome', 'eye', 'obol', 'tome', 'sword', 'sword', 'obol',
   'sword', 'fire', 'skull', 'sword', 'shield', 'fire', 'flask', 'shield', 'skull', 'fire', 'flask', 'moon', 'flask', 'flask', 'fire'],
  ['sword', 'moon', 'sword', 'flask', 'flask', 'sword', 'flask', 'sword', 'skull', 'fire', 'shield', 'crown', 'obol', 'shield', 'shield',
   'fire', 'tome', 'tome', 'sword', 'flask', 'eye', 'sword', 'fire', 'obol', 'obol', 'flask', 'fire', 'skull', 'obol', 'shield'],
  ['tome', 'crown', 'tome', 'sword', 'shield', 'flask', 'sword', 'obol', 'moon', 'sword', 'shield', 'flask', 'obol', 'flask', 'sword',
   'sword', 'flask', 'skull', 'flask', 'fire', 'obol', 'obol', 'sword', 'shield', 'fire', 'fire', 'fire', 'eye', 'shield', 'skull'],
  ['skull', 'crown', 'tome', 'flask', 'sword', 'fire', 'tome', 'obol', 'moon', 'sword', 'sword', 'fire', 'shield', 'shield', 'obol',
   'shield', 'skull', 'flask', 'fire', 'skull', 'obol', 'fire', 'flask', 'sword', 'flask', 'shield', 'skull', 'sword', 'sword', 'flask'],
];

// 10 fixed paylines: the row (0 top, 1 middle, 2 bottom) on each reel. Line 1 is the middle row.
export const LINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 2, 1, 0, 1],
];

// Pays in tenths of the total bet for 3 / 4 / 5 of a kind from the leftmost reel.
export const PAY10 = {
  crown:  { 3: 40, 4: 200, 5: 1000 },
  tome:   { 3: 20, 4: 60,  5: 250 },
  flask:  { 3: 11, 4: 30,  5: 120 },
  sword:  { 3: 6,  4: 20,  5: 80 },
  fire:   { 3: 6,  4: 20,  5: 80 },
  shield: { 3: 5,  4: 15,  5: 60 },
};
export const PAY_ORDER = ['crown', 'tome', 'flask', 'sword', 'fire', 'shield'];

export const BET_LEVELS = [100, 200, 300, 500, 1000, 2000];

export const FREE_SPINS = { 3: 10, 4: 15, 5: 25 };  // by number of scatters anywhere
export const FREE_MULT = 3;                          // line wins are tripled during free spins

export const HS_TRIGGER = 6;                         // coins anywhere to start Hold & Spin
export const HS_RESPINS = 3;
export const HS_LAND = [7, 50];                      // each empty cell lands a coin with probability 7/50 per respin
export const HS_VALUES10 = [                         // [value in tenths of the bet, integer weight, label]
  [5, 293], [10, 299], [20, 183], [30, 105], [50, 70], [100, 32, 'MINI'], [250, 13, 'MAJOR'], [500, 5, 'MAXI'],
];
export const HS_GRAND10 = 1000;                      // all 15 cells filled

export const BONUS_BUY_X = 24;                       // 10 free spins for 24 x bet
export const GAMBLE_MAX_ROUNDS = 3;
export const MAX_WIN_X = 5000;                       // a game round never pays more than 5000 x bet

// Theoretical figures, from tools/par.mjs (exact enumeration; test/par.test.mjs keeps them honest).
export const PAR = {
  rtp: 0.960032,
  base: 0.651555, free: 0.199156, hold: 0.109321, hit: 0.241852, freeEvery: 116.822, holdEvery: 412.088,
  freeSpinValue10: 22.631409,   // value of one awarded free spin, in tenths of the bet (retriggers and features included)
  holdValue10: 450.497891,      // mean Hold & Spin value at trigger, in tenths of the bet
  bonusBuyRtp: 0.942975,
  sd: 5.2,                      // standard deviation per spin, in bets (Monte Carlo)
};

const mod = (i, n) => ((i % n) + n) % n;

export function gridFrom(stops) {
  const g = [[], [], []];
  for (let c = 0; c < REELS; c++) {
    const s = STRIPS[c], n = s.length;
    for (let r = 0; r < ROWS; r++) g[r][c] = s[mod(stops[c] - 1 + r, n)];
  }
  return g;
}

/** A wild anywhere on reels 2-4 nudges to the middle and covers its whole reel. Mutates g. */
export function expandWilds(g) {
  const expanded = [];
  for (let c = 1; c <= 3; c++) {
    let from = -1;
    for (let r = 0; r < ROWS; r++) if (g[r][c] === 'eye') { from = r; break; }
    if (from >= 0) { expanded.push({ reel: c, from }); for (let r = 0; r < ROWS; r++) g[r][c] = 'eye'; }
  }
  return expanded;
}

export function evalLines(g) {
  const wins = [];
  for (let i = 0; i < LINES.length; i++) {
    const ln = LINES[i], sym = g[ln[0]][0], table = PAY10[sym];
    if (!table) continue;
    let n = 1;
    while (n < REELS && (g[ln[n]][n] === sym || g[ln[n]][n] === 'eye')) n++;
    const pay10 = table[n];
    if (pay10) wins.push({ line: i, sym, n, pay10 });
  }
  return wins;
}

export function count(g, sym) {
  let n = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < REELS; c++) if (g[r][c] === sym) n++;
  return n;
}

/** Everything the screen shows for a set of reel stops. */
export function evaluate(stops) {
  const raw = gridFrom(stops);
  const grid = raw.map(row => row.slice());
  const expanded = expandWilds(grid);
  const wins = evalLines(grid);
  const scatters = count(grid, 'moon');
  const coins = count(raw, 'obol');
  return {
    stops: stops.slice(), raw, grid, expanded, wins,
    linePay10: wins.reduce((a, w) => a + w.pay10, 0),
    scatters, freeSpins: FREE_SPINS[Math.min(5, scatters)] || 0,
    coins, holdSpin: coins >= HS_TRIGGER,
  };
}

/**
 * One spin of the reels.
 * @param {import('../rng.js').Rng} rng
 * @param {{keep?: number[], base?: number[]}} [opts] keep: reels that stay on base (single-reel respin)
 */
export function spin(rng, opts = {}) {
  const stops = [];
  for (let c = 0; c < REELS; c++) stops[c] = opts.keep && opts.keep.includes(c) ? opts.base[c] : rng.int(STRIPS[c].length);
  return evaluate(stops);
}

const hsValue = rng => rng.weighted(HS_VALUES10.map(v => [v, v[1]]));

/** Hold & Spin: coins stick, 3 respins, any new coin resets the count, a full screen adds the GRAND. */
export function holdAndSpin(rng, raw) {
  const cells = raw.map(row => row.map(sym => {
    if (sym !== 'obol') return null;
    const v = hsValue(rng); return { v10: v[0], label: v[2] || null };
  }));
  const start = cells.map(row => row.map(Boolean));
  const steps = [];
  let respins = HS_RESPINS;
  const isFull = () => cells.every(row => row.every(Boolean));
  while (respins > 0 && !isFull()) {
    const landed = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < REELS; c++) {
      if (!cells[r][c] && rng.chance(HS_LAND[0], HS_LAND[1])) {
        const v = hsValue(rng);
        cells[r][c] = { v10: v[0], label: v[2] || null };
        landed.push([r, c]);
      }
    }
    respins = landed.length ? HS_RESPINS : respins - 1;
    steps.push({ landed, respins });
  }
  const full = isFull();
  let total10 = full ? HS_GRAND10 : 0, coins = 0;
  for (const row of cells) for (const cell of row) if (cell) { total10 += cell.v10; coins++; }
  return { start, cells, steps, full, coins, total10 };
}

/** Exact credits for a pay expressed in tenths of the bet. */
export const credits = (pay10, bet) => pay10 * bet / 10;

// ---------------------------------------------------------------------------------------------------------------
// Single-reel respin. Its price is the exact expected value of the new outcome divided by the RTP, so buying a
// respin can never return more than the base game does.
// ---------------------------------------------------------------------------------------------------------------

/** Expected value, in tenths of the bet, of respinning one reel while the other four stay. */
export function respinValue10(stops, reel) {
  const s = stops.slice(), n = STRIPS[reel].length;
  let total = 0;
  for (let i = 0; i < n; i++) {
    s[reel] = i;
    const o = evaluate(s);
    total += o.linePay10;
    if (o.freeSpins) total += o.freeSpins * PAR.freeSpinValue10;
    if (o.holdSpin) total += PAR.holdValue10;
  }
  return total / n;
}

export function respinPrice(stops, reel, bet) {
  return Math.max(1, Math.ceil(respinValue10(stops, reel) * bet / 10 / PAR.rtp));
}

/** Gamble: an even-money, 50/50 double-or-nothing. RTP 100%. */
export const gambleCard = rng => (rng.int(2) === 0 ? 'red' : 'black');
