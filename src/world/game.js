// The dungeon crawl: a run, a realm, and Doom RPG style turns. Walking, turning and using items are free; only
// combat and chests spin the reels. Every function here reads slot results and never changes them, and nothing
// depends on the bet: credits move only in src/slot/session.js.

import { HERO, WEAPONS, WEAPON_ORDER, ENEMIES, REALMS, KEY_NAMES, LINE_HIT, LINE_WARD, LINE_HEAL, LINE_TOME, TOME_STUN,
         ROW_TOME, ROW_WARD, EYE_HIT, SILVER_HIT, SILVER_GRAND, CHEST, SPELLS, SPELL_ORDER, AMMO_NAMES, WEAK_MULT, RESIST_MULT } from './data.js';
import { generate, bfs, T, DIRS, isDoorTile, makeEnemy } from './maze.js';
import { seededRng } from '../rng.js';

export function newRun(seed) {
  return {
    seed, realm: 0, hp: HERO.hp, maxHp: HERO.hp, medkits: HERO.startMedkits, bullets: HERO.startBullets,
    shells: 0, cartridges: 0, spells: { banish: 1, flame: 0, leech: 0, dread: 0 }, ward: 0, hone: 0,
    weapon: 'revolver', weapons: { sabre: true, revolver: true, shotgun: false, rifle: false }, target: null,
    stats: { kills: 0, chests: 0, spins: 0, dealt: 0, taken: 0, steps: 0 },
    level: null, turn: 0, block: 0, over: false, won: false,
  };
}

/** Build the realm the run is in. The meta RNG is derived from the run seed and the realm, never from game RNG. */
export function enterRealm(run) {
  const realm = REALMS[run.realm], rng = seededRng(run.seed * 31 + run.realm * 977 + 7);
  const L = generate(realm, rng);
  L.realm = realm; L.keys = {}; L.doors = {}; L.seen = new Uint8Array(L.w * L.h); L.rng = rng.u32();
  L.player = { ...L.start };
  run.level = L; run.block = 0; run.ward = Math.min(run.ward, 10);
  reveal(run);
  return L;
}

const metaRng = L => { const r = seededRng(L.rng); L.rng = r.u32(); return r; };

export const tileAt = (L, x, y) => (x < 0 || y < 0 || x >= L.w || y >= L.h ? T.WALL : L.tiles[y * L.w + x]);
export const doorOpen = (L, x, y) => (L.doors[y * L.w + x] || 0) >= 1;
export function passable(L, x, y) {
  const t = tileAt(L, x, y);
  if (t === T.WALL || t === T.EXIT) return false;
  if (isDoorTile(t)) return doorOpen(L, x, y);
  return true;
}
const opaque = (L, x, y) => { const t = tileAt(L, x, y); return t === T.WALL || t === T.EXIT || (isDoorTile(t) && !doorOpen(L, x, y)); };
export const enemyAt = (L, x, y) => L.enemies.find(e => !e.dead && e.x === x && e.y === y);
export const chestAt = (L, x, y) => L.chests.find(c => c.x === x && c.y === y);
const blocked = (L, x, y) => !passable(L, x, y) || !!enemyAt(L, x, y) || !!chestAt(L, x, y);

/** Tiles in a line from a to b, both ends excluded, are all see-through. */
export function lineOfSight(L, ax, ay, bx, by) {
  const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 3;
  for (let i = 1; i < n; i++) {
    const x = Math.round(ax + (bx - ax) * i / n), y = Math.round(ay + (by - ay) * i / n);
    if ((x !== ax || y !== ay) && (x !== bx || y !== by) && opaque(L, x, y)) return false;
  }
  return true;
}

/** Mark what the hunter can see on the minimap: a short radius with line of sight. */
export function reveal(run) {
  const L = run.level, p = L.player, R = 9;
  for (let y = p.y - R; y <= p.y + R; y++) for (let x = p.x - R; x <= p.x + R; x++) {
    if (x < 0 || y < 0 || x >= L.w || y >= L.h) continue;
    if (lineOfSight(L, p.x, p.y, x, y)) L.seen[y * L.w + x] = 1;
  }
}

export const weapon = run => WEAPONS[run.weapon];
export const ammoOf = (run, w = run.weapon) => (WEAPONS[w].ammo ? run[WEAPONS[w].ammo] : Infinity);
export const reach = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));   // tiles, diagonals count as one

/** Is the enemy in front of the hunter (within 45 degrees of the facing) and in sight? */
export function inView(L, e, max = 10) {
  const p = L.player, [fx, fy] = DIRS[p.dir], dx = e.x - p.x, dy = e.y - p.y;
  const fwd = dx * fx + dy * fy, side = Math.abs(dx * fy - dy * fx);
  if (fwd <= 0 || side > fwd || reach(p, e) > max) return false;
  if (reach(p, e) === 1 && side === 1 && opaque(L, p.x + fx, p.y + fy) && opaque(L, e.x - fx, e.y - fy)) return false;   // round a corner
  return lineOfSight(L, p.x, p.y, e.x, e.y);
}

/** Enemies the hunter could aim at within range, nearest first. */
export function targets(run, range = weapon(run).range) {
  const L = run.level, p = L.player;
  return L.enemies.filter(e => !e.dead && inView(L, e, range)).sort((a, b) => reach(p, a) - reach(p, b) || a.id - b.id);
}

/** The chosen target if it can still be hit, else the nearest one. */
export function currentTarget(run, range) {
  const list = targets(run, range), t = list.find(e => e.id === run.target) || list[0] || null;
  run.target = t ? t.id : run.target;
  return t;
}
export function cycleTarget(run) {
  const list = targets(run); if (!list.length) return null;
  const i = list.findIndex(e => e.id === run.target), t = list[(i + 1) % list.length];
  run.target = t.id; return t;
}
export function setTarget(run, e) { run.target = e ? e.id : null; }

/** What pressing ATTACK would hit, or why it cannot. */
export function attackTarget(run) {
  const W = weapon(run);
  if (ammoOf(run) <= 0) return { why: `No ${AMMO_NAMES[W.ammo]} for the ${W.name.toLowerCase()}.` };
  const t = currentTarget(run);
  if (t) return { enemy: t, dist: reach(run.level.player, t) };
  if (targets(run, 10).length) return { why: `Out of reach for the ${W.name.toLowerCase()}.` };
  return { why: 'Nothing to strike.' };
}

export function chestAhead(run) {
  const L = run.level, p = L.player, [dx, dy] = DIRS[p.dir], c = chestAt(L, p.x + dx, p.y + dy);
  return c && !c.open ? c : null;
}

export function cycleWeapon(run) {
  const i = WEAPON_ORDER.indexOf(run.weapon), n = WEAPON_ORDER.length;
  for (let k = 1; k <= n; k++) {
    const w = WEAPON_ORDER[(i + k) % n];
    if (run.weapons[w] && (ammoOf(run, w) > 0 || k === n)) { run.weapon = w; return w; }
  }
  return run.weapon;
}

export function turn(run, d) { const p = run.level.player; p.dir = (p.dir + d + 4) % 4; reveal(run); return { ev: [] }; }

/** Step forward (0), right (1), back (2) or left (3) relative to facing. */
export function step(run, rel) {
  const L = run.level, p = L.player, d = (p.dir + rel) % 4, [dx, dy] = DIRS[d], nx = p.x + dx, ny = p.y + dy;
  const t = tileAt(L, nx, ny), ev = [];
  if (t === T.EXIT) {
    if (p.x !== L.exit.cx || p.y !== L.exit.cy) return { ev: [{ type: 'msg', text: 'A way out, but not from this side.' }], blocked: true };
    const boss = L.enemies.find(e => ENEMIES[e.type].boss);
    if (boss && !boss.dead) return { ev: [{ type: 'msg', text: 'Not while the guardian lives.' }], blocked: true };
    return { ev: [{ type: 'exit' }], exit: true };
  }
  if (isDoorTile(t) && !doorOpen(L, nx, ny)) {
    if (t !== T.DOOR) {
      const key = t === T.LOCK_BRASS ? 'brass' : 'bone';
      if (!L.keys[key]) return { ev: [{ type: 'msg', text: `Locked. It needs the ${KEY_NAMES[key].toLowerCase()}.` }, { type: 'sfx', name: 'error' }], blocked: true };
      ev.push({ type: 'msg', text: `The ${KEY_NAMES[key].toLowerCase()} turns.` });
    }
    L.doors[ny * L.w + nx] = 0.001;     // the renderer slides it open
    ev.push({ type: 'door', x: nx, y: ny });
    return { ev: ev.concat(endTurn(run)) };
  }
  const c = chestAt(L, nx, ny);
  if (c) return { ev: [{ type: 'msg', text: c.open ? 'An empty chest.' : 'A chest. Open it to spin the reels.' }], blocked: true };
  const e = enemyAt(L, nx, ny);
  if (e) return { ev: [{ type: 'msg', text: `The ${ENEMIES[e.type].name.toLowerCase()} blocks the way.` }], blocked: true };
  if (!passable(L, nx, ny)) return { ev: [{ type: 'bump' }], blocked: true };
  p.x = nx; p.y = ny; run.stats.steps++;
  ev.push({ type: 'move' });
  for (const k of L.pickups.filter(k => k.x === nx && k.y === ny)) { L.pickups.splice(L.pickups.indexOf(k), 1); ev.push(takePickup(run, k)); }
  reveal(run);
  return { ev: ev.concat(endTurn(run)) };
}

const PICKUP = {
  medkit: run => { run.medkits++; return ['A medkit.', 'heal']; },
  bullets: (run, n = 6) => { run.bullets += n; return [`${n} revolver rounds.`, 'coin']; },
  shells: (run, n = 4) => { run.shells += n; return [`${n} shotgun shells.`, 'coin']; },
  cartridges: (run, n = 2) => { run.cartridges += n; return [`${n} rifle cartridges.`, 'coin']; },
  shotgun: run => { const had = run.weapons.shotgun; run.weapons.shotgun = true; run.shells += 6; if (!had) run.weapon = 'shotgun'; return [had ? '6 shotgun shells.' : 'A coach gun! Two barrels, wide spread.', had ? 'coin' : 'winBig', !had]; },
  rifle: run => { const had = run.weapons.rifle; run.weapons.rifle = true; run.cartridges += 4; return [had ? '4 rifle cartridges.' : 'An elephant rifle! It reaches across any room.', had ? 'coin' : 'winBig', !had]; },
};
for (const k of SPELL_ORDER) PICKUP[k] = run => { run.spells[k]++; return [`A page of black magic: ${SPELLS[k].name}.`, 'curse']; };

function takePickup(run, k) {
  if (k.kind === 'brass' || k.kind === 'bone') { run.level.keys[k.kind] = true; return { type: 'key', key: k.kind, text: `The ${KEY_NAMES[k.kind].toLowerCase()}!` }; }
  const [text, sfx, big] = (PICKUP[k.kind] || PICKUP.bullets)(run, k.n);
  return { type: big ? 'weapon' : 'loot', text, sfx };
}

export function useMedkit(run) {
  if (run.medkits <= 0) return { ev: [{ type: 'msg', text: 'No medkits left.' }, { type: 'sfx', name: 'error' }], blocked: true };
  if (run.hp >= run.maxHp) return { ev: [{ type: 'msg', text: 'You are not hurt.' }], blocked: true };
  run.medkits--; const h = Math.min(run.maxHp - run.hp, HERO.medkitHeal); run.hp += h;
  return { ev: [{ type: 'heal', n: h }, { type: 'msg', text: `Bandaged. +${h} health.` }].concat(endTurn(run)) };
}

/** Black magic: no spin, but the dark moves afterwards. */
export function castSpell(run, key) {
  const S = SPELLS[key], L = run.level;
  if (!run.spells[key]) return { ev: [{ type: 'msg', text: `You know no ${S.name}.` }, { type: 'sfx', name: 'error' }], blocked: true };
  const hit = S.all ? targets(run, 8) : [currentTarget(run, 8)].filter(Boolean);
  if (!hit.length) return { ev: [{ type: 'msg', text: 'Nothing in sight to curse.' }], blocked: true };
  run.spells[key]--;
  const ev = [{ type: 'spell', key, text: S.name + '.' }];
  for (const e of hit) {
    if (S.stun) { e.stun = Math.max(e.stun, S.stun); e.awake = true; ev.push({ type: 'stunned', enemy: e }); }
    if (S.dmg) {
      const before = e.hp; ev.push(...hurt(run, e, S.dmg, 'magic'));
      if (S.leech) { const h = Math.min(run.maxHp - run.hp, before - Math.max(0, e.hp)); run.hp += h; if (h) ev.push({ type: 'heal', n: h }); }
    }
  }
  return { ev: ev.concat(endTurn(run)) };
}

export function nearestVisible(run, range) {
  const L = run.level, p = L.player;
  let best = null, bd = 1e9;
  for (const e of L.enemies) {
    if (e.dead) continue;
    const d = reach(p, e);
    if (d <= range && d < bd && lineOfSight(L, p.x, p.y, e.x, e.y)) { best = e; bd = d; }
  }
  return best;
}

/** Weakness: 'weak' (double), 'resist' (half) or '' for an attack kind against an enemy. */
export function affinity(e, kind) {
  const D = ENEMIES[e.type];
  return kind && D.weak && D.weak.includes(kind) ? 'weak' : kind && D.resist && D.resist.includes(kind) ? 'resist' : '';
}
const MULT = { weak: WEAK_MULT, resist: RESIST_MULT, '': 1 };

function hurt(run, e, n, kind) {
  const L = run.level, mod = affinity(e, kind), real = Math.min(e.hp, Math.max(0, Math.round(n * MULT[mod])));
  e.hp -= real; e.awake = true; run.stats.dealt += real;
  const ev = [{ type: 'hurt', enemy: e, n: real, mod }];
  if (e.hp <= 0) {
    e.dead = true; run.stats.kills++;
    ev.push({ type: 'kill', enemy: e, text: `The ${ENEMIES[e.type].name.toLowerCase()} falls.` });
    const d = ENEMIES[e.type].drops;
    if (d) L.pickups.push({ x: e.x, y: e.y, kind: d, n: d === 'bullets' ? 6 : 2 });
    if (ENEMIES[e.type].boss) ev.push({ type: 'msg', text: 'The way out stands open.' });
  }
  return ev;
}

// -----------------------------------------------------------------------------------------------------------------
// Spins. The UI plays the spin through the slot session first (the outcome is settled and saved before it is shown),
// then hands the result here.
// -----------------------------------------------------------------------------------------------------------------

/** How a slot result strikes, for the weapon drawn. Pure: no state changes. */
export function strikeOf(run, res, weaponKey = run.weapon) {
  const o = res.outcome, row = o.grid[1], W = WEAPONS[weaponKey];
  const fx = { row: [], lines: [], eye: 0, hold: 0, crit: 1, dmg: 0, block: 0, heal: 0, stun: 0 };
  for (let c = 0; c < 5; c++) {
    const s = row[c];
    if (s === W.key) fx.row.push({ c, dmg: W.row + (weaponKey === 'sabre' ? run.hone : 0) });
    else if (s === 'tome') fx.row.push({ c, dmg: ROW_TOME });
    else if (s === 'shield') fx.row.push({ c, block: ROW_WARD });
  }
  for (const w of o.wins) {
    const ln = { line: w.line, sym: w.sym, n: w.n };
    if (w.sym === 'sword' || w.sym === 'fire') ln.dmg = LINE_HIT[w.n] + (w.sym === 'sword' ? run.hone * 2 : 0);
    else if (w.sym === 'shield') ln.block = LINE_WARD[w.n];
    else if (w.sym === 'flask') ln.heal = LINE_HEAL[w.n];
    else if (w.sym === 'tome') { ln.dmg = LINE_TOME[w.n]; ln.stun = TOME_STUN[w.n]; }
    else if (w.sym === 'crown') { ln.crit = w.n === 5 ? 3 : 2; fx.crit = Math.max(fx.crit, ln.crit); }
    fx.lines.push(ln);
  }
  fx.eye = o.expanded.length * EYE_HIT;
  if (res.hold) fx.hold = res.hold.coins * SILVER_HIT + (res.hold.full ? SILVER_GRAND : 0);
  const base = fx.row.reduce((a, x) => a + (x.dmg || 0), 0) + fx.lines.reduce((a, x) => a + (x.dmg || 0), 0) + fx.eye;
  fx.dmg = base * fx.crit + fx.hold;
  fx.block = fx.row.reduce((a, x) => a + (x.block || 0), 0) + fx.lines.reduce((a, x) => a + (x.block || 0), 0);
  fx.heal = fx.lines.reduce((a, x) => a + (x.heal || 0), 0);
  fx.stun = fx.lines.reduce((a, x) => Math.max(a, x.stun || 0), 0);
  return fx;
}

/** Can the hunter fight a free spin? The target is the enemy ahead, else the nearest one in sight. */
export function freeSpinTarget(run, prev) {
  if (prev && !prev.dead && inView(run.level, prev, 10)) return prev;
  return currentTarget(run, 10) || nearestVisible(run, 9);
}

/**
 * Apply an attack spin. target may be null on a free spin with nobody left in sight.
 * Enemies act afterwards unless the spin awarded or was a free spin or a Hold & Spin.
 */
export function resolveAttack(run, res, target) {
  const fx = strikeOf(run, res), ev = [{ type: 'strike', fx, enemy: target, weapon: run.weapon, kind: res.kind }];
  run.stats.spins++;
  if (res.kind === 'spin' && weapon(run).ammo) run[weapon(run).ammo] = Math.max(0, run[weapon(run).ammo] - 1);
  run.block += fx.block;
  if (fx.heal) { const h = Math.min(run.maxHp - run.hp, fx.heal); run.hp += h; if (h) ev.push({ type: 'heal', n: h }); }
  if (target && !target.dead) {
    if (fx.stun) target.stun = Math.max(target.stun, fx.stun);
    const W = weapon(run), around = W.spread && fx.dmg > 0 ? run.level.enemies.filter(e => !e.dead && e !== target && reach(e, target) === 1) : [];
    if (fx.dmg > 0) ev.push(...hurt(run, target, fx.dmg, W.kind));
    else ev.push({ type: 'miss', enemy: target });
    for (const e of around) ev.push(...hurt(run, e, fx.dmg * W.spread, W.kind));
  }
  const frozen = res.kind === 'free' || res.freeAward > 0 || !!res.hold;
  if (!frozen) ev.push(...endTurn(run));
  else if (res.freeAward) ev.push({ type: 'msg', text: `Blood moon! ${res.freeAward} free spins. The dark holds still.` });
  return { ev, fx };
}

/** What a chest gives for a slot result. Pure. With the coach gun, gunshot lines also give shells. */
export function lootOf(res, run) {
  const o = res.outcome, row = o.grid[1], L = { bullets: 0, shells: 0, medkits: 0, ward: 0, maxHp: 0, banish: 0, flame: 0, hone: 0, cartridges: 0 };
  const cnt = k => row.filter(s => s === k).length;
  L.bullets += cnt('fire') * CHEST.bulletsPerGun;
  L.ward += cnt('shield') * CHEST.wardPerLantern;
  if (cnt('flask') >= CHEST.flasksForMedkit) L.medkits++;
  if (cnt('tome') >= CHEST.tomesForSpell) L.flame++;
  for (const w of o.wins) {
    if (w.sym === 'fire') { L.bullets += CHEST.bulletLine[w.n]; if (run && run.weapons.shotgun) L.shells += CHEST.shellLine[w.n]; }
    if (w.sym === 'flask') L.medkits += CHEST.medkitLine[w.n];
    if (w.sym === 'shield') L.ward += CHEST.wardLine[w.n];
    if (w.sym === 'crown') L.maxHp += CHEST.hpLine[w.n];
    if (w.sym === 'tome') L.banish += CHEST.spellLine[w.n];
    if (w.sym === 'sword') L.hone += CHEST.honeLine[w.n];
  }
  L.cartridges += o.coins * CHEST.silverPerObol + (res.hold ? res.hold.coins * CHEST.silverPerObol : 0);
  return L;
}

const LOOT_TEXT = { bullets: n => `${n} rounds`, shells: n => `${n} shells`, cartridges: n => `${n} cartridges`, medkits: n => `${n} medkit${n > 1 ? 's' : ''}`,
  ward: n => `ward +${n}`, maxHp: n => `max health +${n}`, banish: n => `${n} sign${n > 1 ? 's' : ''} of banishing`, flame: n => `${n} black flame${n > 1 ? 's' : ''}`, hone: n => `sabre +${n}` };

/** Apply a chest spin. first: the spin that opened the chest (it also gives what the chest holds). */
export function resolveChest(run, res, chest, first) {
  const loot = lootOf(res, run), ev = [], got = [];
  run.stats.spins++;
  if (first) {
    chest.open = true; run.stats.chests++;
    const L = run.level;
    if (chest.holds === 'brass' || chest.holds === 'bone') { L.keys[chest.holds] = true; ev.push({ type: 'key', key: chest.holds, text: `The ${KEY_NAMES[chest.holds].toLowerCase()}!` }); }
    if (PICKUP[chest.holds]) ev.push(takePickup(run, { kind: chest.holds }));
  }
  for (const k in loot) {
    const n = loot[k]; if (!n) continue;
    if (k === 'maxHp') { run.maxHp += n; run.hp += n; } else if (SPELLS[k]) run.spells[k] += n; else run[k] += n;
    got.push(LOOT_TEXT[k](n));
  }
  ev.push({ type: 'loot', text: got.length ? 'Found ' + got.join(', ') + '.' : (first && chest.holds ? 'Nothing else but dust.' : 'Dust and old bones.'), loot });
  return { ev, loot };
}

// -----------------------------------------------------------------------------------------------------------------
// The enemies' turn
// -----------------------------------------------------------------------------------------------------------------

function endTurn(run) {
  const L = run.level, p = L.player, ev = [], rng = metaRng(L);
  run.turn++;
  // doors finish opening at once in the rules; the renderer animates them
  for (const k in L.doors) if (L.doors[k] > 0) L.doors[k] = Math.max(L.doors[k], 1);
  for (const e of L.enemies.slice()) {
    if (e.dead) continue;
    const D = ENEMIES[e.type];
    if (!e.awake && reach(e, p) <= D.sight && lineOfSight(L, e.x, e.y, p.x, p.y)) wake(L, e, ev);
    if (!e.awake) continue;
    if (e.stun > 0) { e.stun--; ev.push({ type: 'stunned', enemy: e }); continue; }
    e.tick++;
    // a summoner calls for help every few turns
    if (D.summon && e.tick % D.every === 0 && (e.summoned || 0) < 5) { const m = summon(L, e, D.summon); if (m) { ev.push({ type: 'summon', enemy: e, minion: m, text: `${D.name} calls out of the dark.` }); continue; } }
    // a healer mends the most hurt ally it can see
    if (D.heal) {
      const hurtAlly = L.enemies.filter(o => !o.dead && o !== e && o.hp <= o.maxHp - 4 && reach(o, e) <= 6 && lineOfSight(L, e.x, e.y, o.x, o.y)).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (hurtAlly && rng.int(100) < 70) { const n = Math.min(D.heal, hurtAlly.maxHp - hurtAlly.hp); hurtAlly.hp += n; ev.push({ type: 'enemyHeal', enemy: e, ally: hurtAlly, n }); continue; }
    }
    if (canStrike(L, e, D)) { ev.push(enemyAttack(run, e, D, rng)); if (run.hp <= 0) break; continue; }
    if (D.slow && e.tick % 2 === 0) continue;
    for (let s = 0; s < D.speed; s++) {
      if (canStrike(L, e, D)) break;
      const nxt = pathStep(L, e, D);
      if (!nxt) break;
      e.x = nxt.x; e.y = nxt.y;
    }
  }
  run.block = 0;
  if (run.hp <= 0) { run.over = true; ev.push({ type: 'death' }); }
  return ev;
}

/** One enemy wakes, and the rest of its room with it. */
function wake(L, e, ev) {
  const room = L.roomOf ? L.roomOf[e.y * L.w + e.x] : -1;
  for (const o of L.enemies) {
    if (o.dead || o.awake) continue;
    if (o === e || (room >= 0 && L.roomOf[o.y * L.w + o.x] === room)) { o.awake = true; ev.push({ type: 'wake', enemy: o }); }
  }
}

function summon(L, e, type) {
  const p = L.player;
  const spots = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dx, dy]) => [e.x + dx, e.y + dy])
    .filter(([x, y]) => passable(L, x, y) && !enemyAt(L, x, y) && !chestAt(L, x, y) && !(x === p.x && y === p.y) && !(x === L.exit.x && y === L.exit.y));
  if (!spots.length || L.enemies.filter(o => !o.dead && o.minion).length >= 3) return null;
  const [x, y] = spots[0], m = makeEnemy(type, x, y, 100 + L.enemies.length);
  m.awake = true; m.minion = true; L.enemies.push(m); e.summoned = (e.summoned || 0) + 1;
  return m;
}

function canStrike(L, e, D) {
  const p = L.player, d = reach(e, p);
  if (d === 1) {
    if (e.x === p.x || e.y === p.y) return true;
    return !opaque(L, e.x, p.y) || !opaque(L, p.x, e.y);   // diagonal, unless both corners are solid
  }
  return D.range > 1 && d <= D.range && lineOfSight(L, e.x, e.y, p.x, p.y);
}

function enemyAttack(run, e, D, rng) {
  const out = { type: 'enemyAtk', enemy: e, hit: false, dmg: 0, blocked: 0, warded: 0, ranged: reach(e, run.level.player) > 1 };
  if (!rng.chance(D.hit, 100)) return out;
  out.hit = true;
  let n = rng.range(D.dmg[0], D.dmg[1]);
  out.blocked = Math.min(run.block, n); n -= out.blocked; run.block -= out.blocked;
  out.warded = Math.min(run.ward, n); n -= out.warded; run.ward -= out.warded;
  out.dmg = Math.min(run.hp, n); run.hp -= out.dmg; run.stats.taken += out.dmg;
  return out;
}

function pathStep(L, e, D) {
  const p = L.player;
  const r = bfs(L, p.x, p.y, (x, y, t) => {
    if (x === e.x && y === e.y) return false;
    if (isDoorTile(t) && !doorOpen(L, x, y)) return !(D.role === 'phase' && t === T.DOOR);
    return !!enemyAt(L, x, y) || !!chestAt(L, x, y);
  });
  const here = r.dist[e.y * L.w + e.x];
  if (here < 0 || here > 20) return null;
  for (const [dx, dy] of DIRS) {
    const x = e.x + dx, y = e.y + dy, j = y * L.w + x;
    if (r.dist[j] >= 0 && r.dist[j] < here && !(x === p.x && y === p.y)) return { x, y };
  }
  return null;
}

export function nextRealm(run) {
  if (run.realm >= REALMS.length - 1) { run.won = true; run.over = true; return false; }
  run.realm++; enterRealm(run); return true;
}
