// A play-testing bot. It plays whole runs with the real rules and the real slot session, and reports how far it got,
// how many spins it took and how the hunter fared. It walks to chests, keys and pickups, picks targets the way a
// careful player would (healers and summoned help first, then whatever is closest to dying), uses black magic on
// crowds and heals below a third of its health.
//
//   node tools/bot.mjs [runs=200]

import * as S from '../src/slot/session.js';
import { seededRng } from '../src/rng.js';
import * as G from '../src/world/game.js';
import { bfs, T, DIRS } from '../src/world/maze.js';
import { ENEMIES, REALMS, WEAPONS } from '../src/world/data.js';

const PRIORITY = { heal: 0, summon: 3, ranged: 1, fast: 2 };
const score = e => (PRIORITY[ENEMIES[e.type].role] ?? 4) * 1000 + e.hp;

export function playRun(seed) {
  const rng = seededRng(seed * 7 + 1), run = G.newRun(seed), w = S.newWallet(1e9);
  G.enterRealm(run);
  const log = { realm: 0, spins: 0, chestSpins: 0, attackSpins: 0, turns: 0, medkits: 0, spells: 0, stuck: false, perRealm: [] };
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
  const face = d => { if (d >= 0) run.level.player.dir = d; };
  const blockFn = L => (x, y, tt) => (tt === T.LOCK_BRASS && !L.keys.brass) || (tt === T.LOCK_BONE && !L.keys.bone) || !!G.chestAt(L, x, y);

  while (!run.over && guard++ < 8000) {
    const L = run.level, p = L.player;
    log.turns++;
    if (run.hp < run.maxHp * 0.35 && run.medkits > 0) { G.useMedkit(run); log.medkits++; continue; }

    // look around: which way has the most worth hitting?
    let best = null;
    for (let d = 0; d < 4; d++) {
      p.dir = d;
      for (const wk of ['shotgun', 'rifle', 'revolver', 'sabre']) {
        if (!run.weapons[wk] || G.ammoOf(run, wk) <= 0) continue;
        run.weapon = wk;
        const list = G.targets(run).filter(e => e.awake || G.reach(p, e) <= 2);
        if (!list.length) continue;
        const t = list.sort((a, b) => score(a) - score(b))[0];
        const around = WEAPONS[wk].spread ? L.enemies.filter(e => !e.dead && e !== t && G.reach(e, t) === 1).length : 0;
        const val = score(t) - around * 300 - (wk === 'sabre' ? 0 : 50);
        if (!best || val < best.val) best = { d, wk, t, val, n: list.length };
      }
    }
    if (best) {
      face(best.d); run.weapon = best.wk; G.setTarget(run, best.t);
      const seen = G.targets(run, 8).length;
      if (seen >= 3 && run.spells.dread && run.hp < run.maxHp * 0.6) { const cr = G.castSpell(run, 'dread'); log.spells++; if (cr.blocked) { log.blockedSpell = ['dread', cr.ev[0].text]; } else continue; }
      if (seen >= 3 && run.spells.flame) { const cr = G.castSpell(run, 'flame'); log.spells++; if (cr.blocked) { log.blockedSpell = ['flame', cr.ev[0].text]; } else continue; }
      if (run.spells.leech && run.hp < run.maxHp * 0.5) { const cr = G.castSpell(run, 'leech'); log.spells++; if (cr.blocked) { log.blockedSpell = ['leech', cr.ev[0].text]; } else continue; }
      if (run.spells.banish && ENEMIES[best.t.type].role === 'heal') { const cr = G.castSpell(run, 'banish'); log.spells++; if (cr.blocked) { log.blockedSpell = ['banish', cr.ev[0].text]; } else continue; }
      spin('attack', best.t); continue;
    }
    p.dir = 0;

    // where to go: chests, keys and pickups, else enemies, else the way out
    const r = bfs(L, p.x, p.y, blockFn(L));
    const goals = [];
    for (const c of L.chests) if (!c.open) goals.push({ x: c.x, y: c.y, chest: c });
    for (const k of L.pickups) goals.push({ x: k.x, y: k.y, onto: true });
    const bossAlive = L.enemies.some(e => !e.dead && ENEMIES[e.type].boss);
    if (!goals.length) for (const e of L.enemies) if (!e.dead) goals.push({ x: e.x, y: e.y, enemy: e });
    if (!bossAlive) goals.push({ x: L.exit.cx, y: L.exit.cy, onto: true, exit: true });
    let go = null, bd = 1e9;
    for (const g of goals) for (const [dx, dy] of g.onto ? [[0, 0]] : DIRS) {
      const x = g.x + dx, y = g.y + dy, d = r.dist[y * L.w + x];
      if (d >= 0 && d < bd) { bd = d; go = { x, y, g }; }
    }
    log.last = { p: { ...p }, go: go && { x: go.x, y: go.y, kind: Object.keys(go.g).join("/"), gx: go.g.x, gy: go.g.y }, best: !!best };
    if (!go) { log.stuck = "nogoal"; break; }
    if (go.x === p.x && go.y === p.y) {
      if (go.g.exit) {
        face(DIRS.findIndex(([dx, dy]) => p.x + dx === L.exit.x && p.y + dy === L.exit.y)); G.step(run, 0);
        log.perRealm.push(realmSpins); realmSpins = 0; if (!G.nextRealm(run)) break; log.realm = run.realm; continue;
      }
      face(DIRS.findIndex(([dx, dy]) => p.x + dx === go.g.x && p.y + dy === go.g.y));
      if (go.g.chest) { spin('chest', null, go.g.chest); continue; }
      if (go.g.enemy) { go.g.enemy.awake = true; continue; }
      continue;
    }
    const back = bfs(L, go.x, go.y, blockFn(L)), here = back.dist[p.y * L.w + p.x];
    const d = DIRS.findIndex(([dx, dy]) => { const j = (p.y + dy) * L.w + p.x + dx; return back.dist[j] >= 0 && back.dist[j] === here - 1; });
    if (d < 0) { log.stuck = 'nodir'; break; }
    face(d);
    const blocker = G.enemyAt(L, p.x + DIRS[d][0], p.y + DIRS[d][1]);
    if (blocker) { blocker.awake = true; spin('attack', blocker); continue; }
    G.step(run, 0);
  }
  log.realm = run.realm; log.won = run.won; log.dead = run.over && !run.won; log.hp = run.hp; log.stats = run.stats;
  if (guard >= 8000) log.stuck = 'guard';
  return log;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const N = +(process.argv[2] || 200), res = [];
  for (let s = 1; s <= N; s++) res.push(playRun(s));
  const won = res.filter(r => r.won).length, stuck = res.filter(r => r.stuck);
  const avg = a => (a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(1);
  console.log(`runs ${N}: won ${won} (${(won / N * 100).toFixed(0)}%), stuck ${stuck.length} ${[...new Set(stuck.map(r => r.stuck))].join(' ')}`);
  console.log('died in realm:', REALMS.map((R, i) => `${R.id} ${res.filter(r => r.dead && r.realm === i).length}`).join(', '));
  for (let i = 0; i < 3; i++) console.log(`spins to clear ${REALMS[i].id}: ${avg(res.map(r => r.perRealm[i]).filter(x => x !== undefined))}`);
  console.log(`spins per run ${avg(res.map(r => r.spins))} (attack ${avg(res.map(r => r.attackSpins))}, chest ${avg(res.map(r => r.chestSpins))}), medkits ${avg(res.map(r => r.medkits))}, spells ${avg(res.map(r => r.spells))}, kills ${avg(res.map(r => r.stats.kills))}`);
}
