// A play-testing bot. It plays whole runs with the real rules and the real slot session, and reports how far it got,
// how many spins it took and how the hunter fared. Movement is free; it fights what it meets, opens every chest,
// heals below a third of its health and heads for the way out once both keys are in hand.
//
//   node tools/bot.mjs [runs=200]

import * as S from '../src/slot/session.js';
import { seededRng } from '../src/rng.js';
import * as G from '../src/world/game.js';
import { bfs, T, DIRS, isDoorTile } from '../src/world/maze.js';
import { ENEMIES, REALMS, WEAPONS } from '../src/world/data.js';

export function playRun(seed, opt = {}) {
  const rng = seededRng(seed * 7 + 1), run = G.newRun(seed), w = S.newWallet(1e9);
  w.bet = 100;
  G.enterRealm(run);
  const log = { realm: 0, spins: 0, chestSpins: 0, attackSpins: 0, turns: 0, medkits: 0, stuck: false, perRealm: [] };
  let realmSpins = 0, guard = 0;

  const spin = (mode, target, chest) => {
    let first = true, tgt = target;
    do {
      if (mode === 'attack' && S.inFreeSpins(w)) tgt = G.freeSpinTarget(run, tgt);
      const res = S.playSpin(w, rng);
      log.spins++; realmSpins++;
      if (mode === 'attack') { log.attackSpins++; G.resolveAttack(run, res, tgt); } else { log.chestSpins++; G.resolveChest(run, res, chest, first); }
      first = false;
    } while (S.inFreeSpins(w) && !run.over);
  };
  const face = d => { const p = run.level.player; while (p.dir !== d) G.turn(run, 1); };

  while (!run.over && guard++ < 6000) {
    const L = run.level, p = L.player;
    log.turns++;
    // heal
    if (run.hp < run.maxHp * 0.35 && run.medkits > 0) { G.useMedkit(run); log.medkits++; continue; }
    // choose arms: the rifle for distance, the sabre when out of rounds
    const adjacent = L.enemies.find(e => !e.dead && Math.abs(e.x - p.x) + Math.abs(e.y - p.y) === 1);
    for (const want of adjacent ? ['revolver', 'sabre', 'rifle'] : ['rifle', 'revolver', 'sabre']) if (run.weapons[want] && G.ammoOf(run, want) > 0) { run.weapon = want; break; }
    if (adjacent) { face(DIRS.findIndex(([dx, dy]) => p.x + dx === adjacent.x && p.y + dy === adjacent.y)); }
    // anything to shoot in a straight line?
    const keep = p.dir;
    let aimed = !!adjacent;
    for (let d = 0; d < 4 && !aimed; d++) {
      p.dir = d; const a = G.lookAhead(L, G.weapon(run).range);
      if (a && a.enemy && a.enemy.awake) aimed = true;
    }
    if (!aimed) p.dir = keep;
    const t = G.attackTarget(run);
    if (t.enemy && (t.enemy.awake || t.dist <= 2)) { spin('attack', t.enemy); continue; }
    if (G.chestAhead(run)) { spin('chest', null, G.chestAhead(run)); continue; }
    // where to go: the nearest unopened chest, else an enemy, else the way out
    const r = bfs(L, p.x, p.y, (x, y, tt) => (tt === T.LOCK_BRASS && !L.keys.brass) || (tt === T.LOCK_BONE && !L.keys.bone) || !!G.chestAt(L, x, y));
    const goals = [];
    for (const c of L.chests) if (!c.open) goals.push({ x: c.x, y: c.y, adj: true });
    for (const k of L.pickups) if (k.kind === 'brass' || k.kind === 'bone') goals.push({ x: k.x, y: k.y, onto: true });
    if (!goals.length) for (const e of L.enemies) if (!e.dead) goals.push({ x: e.x, y: e.y, adj: true, enemy: true });
    goals.push({ x: L.exit.x, y: L.exit.y, adj: true, exit: true });
    let best = null, bd = 1e9;
    for (const g of goals) for (const [dx, dy] of g.onto ? [[0, 0]] : DIRS) {
      const x = g.x + dx, y = g.y + dy, d = r.dist[y * L.w + x];
      if (d >= 0 && d < bd && !(g.exit && L.enemies.some(e => !e.dead && ENEMIES[e.type].boss))) { bd = d; best = { x, y, g }; }
    }
    if (!best) {   // the boss stands in front of the exit: go to it
      const boss = L.enemies.find(e => !e.dead && ENEMIES[e.type].boss);
      for (const [dx, dy] of DIRS) { const x = boss.x + dx, y = boss.y + dy, d = r.dist[y * L.w + x]; if (d >= 0 && d < bd) { bd = d; best = { x, y, g: boss }; } }
    }
    if (!best) { log.stuck = "nobest"; log.dump = () => { const rows = []; for (let y = 0; y < L.h; y++) { let s = ""; for (let x = 0; x < L.w; x++) { const t = L.tiles[y * L.w + x], e = G.enemyAt(L, x, y), c = G.chestAt(L, x, y); s += p.x === x && p.y === y ? "@" : e ? (ENEMIES[e.type].boss ? "B" : "e") : c ? (c.open ? "c" : "C") : ".#DbBX"[t]; } rows.push(s); } return rows.join("\n") + "\nkeys " + JSON.stringify(L.keys) + " doors " + JSON.stringify(L.doors); }; break; }
    if (best.x === p.x && best.y === p.y) {
      face(DIRS.findIndex(([dx, dy]) => p.x + dx === best.g.x && p.y + dy === best.g.y));
      if (best.g.exit) { G.step(run, 0); log.perRealm.push(realmSpins); realmSpins = 0; if (!G.nextRealm(run)) break; log.realm = run.realm; continue; }
      if (best.g.enemy || ENEMIES[best.g.type]) { spin('attack', G.attackTarget(run).enemy || best.g); continue; }
      continue;
    }
    // first step along the path
    let i = best.y * L.w + best.x, prev = -1;
    const back = bfs(L, best.x, best.y, (x, y, tt) => (tt === T.LOCK_BRASS && !L.keys.brass) || (tt === T.LOCK_BONE && !L.keys.bone) || !!G.chestAt(L, x, y));
    const here = back.dist[p.y * L.w + p.x];
    const d = DIRS.findIndex(([dx, dy]) => { const j = (p.y + dy) * L.w + p.x + dx; return back.dist[j] >= 0 && back.dist[j] === here - 1; });
    if (d < 0) { log.stuck = "nodir " + JSON.stringify([p, best.x, best.y, here]); break; }
    face(d); G.step(run, 0);
  }
  log.realm = run.realm; log.won = run.won; log.dead = run.over && !run.won; log.hp = run.hp; log.stats = run.stats;
  if (guard >= 6000) log.stuck = true;
  return log;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const N = +(process.argv[2] || 200), res = [];
  for (let s = 1; s <= N; s++) res.push(playRun(s));
  const reached = [0, 0, 0], won = res.filter(r => r.won).length, stuck = res.filter(r => r.stuck).length;
  for (const r of res) reached[Math.min(2, r.realm)]++;
  const avg = a => (a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(1);
  console.log(`runs ${N}: won ${won} (${(won / N * 100).toFixed(0)}%), stuck ${stuck}`);
  console.log('died in realm:', REALMS.map((R, i) => `${R.id} ${res.filter(r => r.dead && r.realm === i).length}`).join(', '));
  for (let i = 0; i < 3; i++) console.log(`spins to clear ${REALMS[i].id}: ${avg(res.map(r => r.perRealm[i]).filter(x => x !== undefined))}`);
  console.log(`spins per run ${avg(res.map(r => r.spins))} (attack ${avg(res.map(r => r.attackSpins))}, chest ${avg(res.map(r => r.chestSpins))}), medkits used ${avg(res.map(r => r.medkits))}`);
}
