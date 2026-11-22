import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, bfs, T } from '../src/world/maze.js';
import { REALMS } from '../src/world/data.js';
import { seededRng, gameRng } from '../src/rng.js';
import { newRun, enterRealm, strikeOf, lootOf, resolveAttack, step, turn } from '../src/world/game.js';
import * as S from '../src/slot/session.js';

const reach = (L, keys) => bfs(L, L.start.x, L.start.y, (x, y, t) => (t === T.LOCK_BRASS && !keys.brass) || (t === T.LOCK_BONE && !keys.bone));
const ok = (r, L, p) => r.dist[p.y * L.w + p.x] >= 0;

test('every realm is solvable: each key is reachable before the lock it opens', () => {
  for (const realm of REALMS) for (let s = 1; s <= 300; s++) {
    const L = generate(realm, seededRng(s));
    const keyAt = k => L.chests.find(c => c.holds === k) || L.pickups.find(p => p.kind === k);
    const brass = keyAt('brass'), bone = keyAt('bone');
    assert.ok(brass && bone, `keys placed (${realm.id} ${s})`);
    const r0 = reach(L, {}), r1 = reach(L, { brass: true }), r2 = reach(L, { brass: true, bone: true });
    assert.ok(ok(r0, L, brass), `brass key reachable (${realm.id} ${s})`);
    assert.ok(!ok(r0, L, bone), `bone key behind the brass lock (${realm.id} ${s})`);
    assert.ok(ok(r1, L, bone), `bone key reachable with brass (${realm.id} ${s})`);
    const cell = { x: L.exit.cx, y: L.exit.cy };
    assert.ok(!ok(r1, L, cell), `exit behind the bone lock (${realm.id} ${s})`);
    assert.ok(ok(r2, L, cell), `exit reachable with both keys (${realm.id} ${s})`);
    for (const c of L.chests) assert.ok(ok(r2, L, c), 'every chest reachable');
    assert.equal(L.tiles[L.exit.y * L.w + L.exit.x], T.EXIT);
  }
});

test('the dungeon reads slot results and never changes credits', () => {
  const run = newRun(5); enterRealm(run);
  const w = S.newWallet(100000), rng = gameRng();
  for (let i = 0; i < 400; i++) {
    const before = w.balance, res = S.playSpin(w, rng);
    const snap = JSON.stringify(res.outcome);
    strikeOf(run, res); lootOf(res);
    const e = run.level.enemies.find(x => !x.dead);
    run.hp = run.maxHp; resolveAttack(run, res, e);
    assert.equal(JSON.stringify(res.outcome), snap);
    assert.equal(w.balance, before - res.cost + res.win);
    while (S.inFreeSpins(w)) S.playSpin(w, rng);
  }
});

test('walking about never spins and never moves credits', () => {
  const run = newRun(9); enterRealm(run);
  const r = seededRng(3);
  for (let i = 0; i < 500 && !run.over; i++) {
    if (r.int(3) === 0) turn(run, r.pick([-1, 1])); else step(run, 0);
    run.hp = run.maxHp;
  }
  assert.equal(run.stats.spins, 0);
});

test('chests never cut the maze: every open tile stays reachable with both keys', () => {
  for (const realm of REALMS) for (let s = 1; s <= 200; s++) {
    const L = generate(realm, seededRng(s)), chest = new Set(L.chests.map(c => c.y * L.w + c.x));
    const r = bfs(L, L.start.x, L.start.y, (x, y) => chest.has(y * L.w + x));
    for (let i = 0; i < L.tiles.length; i++) if (L.tiles[i] !== T.WALL && L.tiles[i] !== T.EXIT && !chest.has(i)) assert.ok(r.dist[i] >= 0, `${realm.id} ${s}: tile ${i} cut off`);
  }
});
