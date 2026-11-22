// The wallet and game rounds. The only code that moves credits, and it moves them only for stakes and wins.
// Pure state transitions on a plain, serialisable object; presentation happens afterwards from the returned result,
// so an interrupted game resumes from saved state with every outcome already settled.

import * as M from './machine.js';

export const HISTORY_SIZE = 50;

export function newWallet(balance = 0) {
  return {
    balance, bet: M.BET_LEVELS[0],
    wagered: 0, won: 0, rounds: 0,
    stops: [0, 0, 0, 0, 0],          // reels as last shown
    free: null,                      // { left, played, awarded, bet, win } while free spins run
    round: null,                     // { bet, win } of the round in progress (for the win cap)
    respin: false,                   // a single-reel respin is on offer
    gamble: null,                    // { stake, rounds } while a win can be gambled
    history: [],
  };
}

export const inFreeSpins = w => !!(w.free && w.free.left > 0);
export const activeBet = w => (inFreeSpins(w) ? w.free.bet : w.bet);
export const spinCost = w => (inFreeSpins(w) ? 0 : w.bet);
export const canAfford = (w, amount) => w.balance >= amount;
export const respinPriceFor = (w, reel) => M.respinPrice(w.stops, reel, w.bet);
export const bonusBuyPrice = w => M.BONUS_BUY_X * w.bet;

export function setBet(w, bet) {
  if (inFreeSpins(w) || !M.BET_LEVELS.includes(bet)) return false;
  w.bet = bet; w.respin = false; w.gamble = null;
  return true;
}

function log(w, entry) {
  w.history.unshift({ t: Date.now(), ...entry });
  if (w.history.length > HISTORY_SIZE) w.history.length = HISTORY_SIZE;
}

function stake(w, amount) { w.balance -= amount; w.wagered += amount; }

// Pays into the round, honouring the maximum win. Returns the credits actually paid.
function pay(w, amount) {
  const room = M.MAX_WIN_X * w.round.bet - w.round.win;
  const paid = Math.max(0, Math.min(amount, room));
  w.round.win += paid; w.balance += paid; w.won += paid;
  return paid;
}

function settle(w, rng, o, kind, cost) {
  const bet = w.round.bet, free = kind === 'free';
  const lineWin = pay(w, M.credits(o.linePay10 * (free ? M.FREE_MULT : 1), bet));
  let hold = null;
  if (o.holdSpin) {
    hold = M.holdAndSpin(rng, o.raw);
    hold.win = pay(w, M.credits(hold.total10, bet));
  }
  if (free) { w.free.left--; w.free.played++; }
  let freeAward = 0;
  if (o.freeSpins) {
    freeAward = o.freeSpins;
    if (w.free) { w.free.left += freeAward; w.free.awarded += freeAward; }
    else w.free = { left: freeAward, played: 0, awarded: freeAward, bet, win: 0 };
  }
  const win = lineWin + (hold ? hold.win : 0);
  const capped = w.round.win >= M.MAX_WIN_X * bet;
  if (capped && w.free) w.free.left = 0;
  if (w.free) w.free.win += free ? win : 0;
  w.stops = o.stops.slice();
  const res = { kind, bet, cost, outcome: o, lineWin, hold, freeAward, win, capped, roundWin: w.round.win, freeLeft: w.free ? w.free.left : 0, roundOver: false, freeTotal: 0 };
  if (!w.free || w.free.left <= 0) {             // the round is over
    res.roundOver = true;
    res.freeTotal = w.free ? w.free.win : 0;
    const base = kind !== 'free' && !freeAward && !hold;
    w.respin = kind === 'spin' && base;
    w.gamble = base && win > 0 ? { stake: win, rounds: 0 } : null;
    log(w, { kind: w.round.kind, bet, cost: w.round.cost, win: w.round.win, note: w.round.note });
    w.free = null; w.round = null; w.rounds++;
  } else {
    if (freeAward) w.round.note = 'Free spins';
    if (hold) w.round.note = w.round.note ? w.round.note + ' + Hold & Spin' : 'Hold & Spin';
  }
  return res;
}

/** A paid spin, or the next free spin if any are left. */
export function playSpin(w, rng) {
  if (inFreeSpins(w)) return settle(w, rng, M.spin(rng), 'free', 0);
  if (!canAfford(w, w.bet)) return null;
  stake(w, w.bet);
  w.round = { kind: 'Spin', bet: w.bet, cost: w.bet, win: 0, note: '' };
  w.respin = false; w.gamble = null;
  const o = M.spin(rng);
  return settle(w, rng, o, 'spin', w.bet);
}

/** Respin one reel for its quoted price; the other four stay. One respin per paid spin. */
export function playRespin(w, rng, reel) {
  if (!w.respin || inFreeSpins(w)) return null;
  const price = respinPriceFor(w, reel);
  if (!canAfford(w, price)) return null;
  stake(w, price);
  w.round = { kind: 'Respin', bet: w.bet, cost: price, win: 0, note: `Reel ${reel + 1}` };
  w.respin = false; w.gamble = null;
  const keep = [0, 1, 2, 3, 4].filter(c => c !== reel);
  const res = settle(w, rng, M.spin(rng, { keep, base: w.stops }), 'respin', price);
  res.reel = reel;
  return res;
}

/** Buy 10 free spins outright. */
export function buyBonus(w) {
  const price = bonusBuyPrice(w);
  if (inFreeSpins(w) || !canAfford(w, price)) return null;
  stake(w, price);
  w.round = { kind: 'Bonus buy', bet: w.bet, cost: price, win: 0, note: 'Free spins' };
  w.respin = false; w.gamble = null;
  w.free = { left: M.FREE_SPINS[3], played: 0, awarded: M.FREE_SPINS[3], bet: w.bet, win: 0 };
  return { price, spins: w.free.left };
}

/** Stake the last win on the colour of a card. */
export function playGamble(w, rng, guess) {
  const g = w.gamble;
  if (!g || !canAfford(w, g.stake)) return null;
  const card = M.gambleCard(rng), won = card === guess, stakeAmt = g.stake;
  stake(w, stakeAmt);
  w.respin = false;
  if (won) {
    w.balance += stakeAmt * 2; w.won += stakeAmt * 2;
    g.stake *= 2; g.rounds++;
    if (g.rounds >= M.GAMBLE_MAX_ROUNDS) w.gamble = null;
  } else w.gamble = null;
  log(w, { kind: 'Gamble', bet: stakeAmt, cost: stakeAmt, win: won ? stakeAmt * 2 : 0, note: card });
  return { card, won, stake: stakeAmt, again: !!w.gamble };
}

export function collect(w) { w.gamble = null; }
