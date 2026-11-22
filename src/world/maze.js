// Level generation: rooms, not corridors. The map is cut by binary space partition into small, medium and large
// rooms that share their walls. Neighbouring rooms are joined through doorways: first along a random spanning tree,
// so every room is reachable, then with extra doorways for loops. The tree path from the start room to the guardian's
// room is the spine; two locked doorways on it cut the level into three zones, and each zone holds the key to the
// next. Loops are only ever opened inside one zone, so the locks always gate progress.
// Uses the meta RNG only: nothing here can see or touch the slot machine.

import { ENEMIES } from './data.js';

export const T = { FLOOR: 0, WALL: 1, DOOR: 2, LOCK_BRASS: 3, LOCK_BONE: 4, EXIT: 5 };
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // east, south, west, north

export const isDoorTile = t => t === T.DOOR || t === T.LOCK_BRASS || t === T.LOCK_BONE;

/** BFS distances over walkable tiles. block(x, y, t) may veto a tile. */
export function bfs(map, sx, sy, block) {
  const { w, h, tiles } = map, dist = new Int32Array(w * h).fill(-1), prev = new Int32Array(w * h).fill(-1);
  const q = [sy * w + sx]; dist[q[0]] = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx, t = tiles[j];
      if (dist[j] >= 0 || t === T.WALL || t === T.EXIT || (block && block(nx, ny, t))) continue;
      dist[j] = dist[i] + 1; prev[j] = i; q.push(j);
    }
  }
  return { dist, prev };
}

export function generate(realm, rng, tries = 0) {
  const w = realm.size, h = realm.size;
  const tiles = new Uint8Array(w * h).fill(T.WALL);
  const at = (x, y) => tiles[y * w + x], set = (x, y, t) => { tiles[y * w + x] = t; };
  const map = { w, h, tiles, at, set };

  // 1. binary space partition. A region's border rows are walls shared with its neighbours.
  const rooms = [];
  const split = (x0, y0, x1, y1, depth) => {
    const iw = x1 - x0 - 1, ih = y1 - y0 - 1;          // interior size
    const big = Math.max(iw, ih);
    const stop = big <= realm.roomMax && (big <= 5 || rng.int(100) < 22 + depth * 6);
    if (stop || (iw < 7 && ih < 7)) { rooms.push({ x0: x0 + 1, y0: y0 + 1, x1: x1 - 1, y1: y1 - 1, id: rooms.length }); return; }
    const vertical = iw > ih ? true : ih > iw ? false : rng.int(2) === 0;
    const len = vertical ? iw : ih;
    if (len < 7) { rooms.push({ x0: x0 + 1, y0: y0 + 1, x1: x1 - 1, y1: y1 - 1, id: rooms.length }); return; }
    const cut = 3 + 1 + rng.int(len - 7 + 1);            // both sides keep at least 3 interior tiles
    if (vertical) { split(x0, y0, x0 + cut, y1, depth + 1); split(x0 + cut, y0, x1, y1, depth + 1); }
    else { split(x0, y0, x1, y0 + cut, depth + 1); split(x0, y0 + cut, x1, y1, depth + 1); }
  };
  split(0, 0, w - 1, h - 1, 0);
  const roomOf = new Int16Array(w * h).fill(-1);
  for (const r of rooms) for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) { set(x, y, T.FLOOR); roomOf[y * w + x] = r.id; }
  for (const r of rooms) { r.area = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1); r.cx = (r.x0 + r.x1) >> 1; r.cy = (r.y0 + r.y1) >> 1; }

  // 2. which rooms touch, and through which wall tiles a doorway could join them
  const links = new Map();   // "a,b" -> [tile index...]
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (at(x, y) !== T.WALL) continue;
    const pairs = [[roomOf[y * w + x - 1], roomOf[y * w + x + 1]], [roomOf[(y - 1) * w + x], roomOf[(y + 1) * w + x]]];
    for (const [a, b] of pairs) {
      if (a < 0 || b < 0 || a === b) continue;
      const k = a < b ? a + ',' + b : b + ',' + a;
      (links.get(k) || links.set(k, []).get(k)).push(y * w + x);
    }
  }
  const edges = [...links.entries()].map(([k, t]) => { const [a, b] = k.split(',').map(Number); return { a, b, tiles: t }; });
  const doorway = e => { const mid = e.tiles.slice(1, -1); return rng.pick(mid.length ? mid : e.tiles); };

  // 3. a random spanning tree over the rooms
  const parent = rooms.map((_, i) => i), find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const tree = [], adj = rooms.map(() => []);
  for (const e of rng.shuffle(edges.slice())) {
    const ra = find(e.a), rb = find(e.b); if (ra === rb) continue;
    parent[ra] = rb; e.door = doorway(e); tree.push(e); adj[e.a].push(e); adj[e.b].push(e);
  }

  // 4. start in a small room; the guardian waits in the room furthest away along the tree
  const small = rooms.filter(r => r.area <= 20), startRoom = rng.pick(small.length ? small : rooms);
  const depth = new Int32Array(rooms.length).fill(-1), via = new Array(rooms.length).fill(null);
  const order = [startRoom.id]; depth[startRoom.id] = 0;
  for (let i = 0; i < order.length; i++) for (const e of adj[order[i]]) { const o = e.a === order[i] ? e.b : e.a; if (depth[o] < 0) { depth[o] = depth[order[i]] + 1; via[o] = e; order.push(o); } }
  let bossRoom = rooms[0];
  for (const r of rooms) if (depth[r.id] * 100 + r.area > depth[bossRoom.id] * 100 + bossRoom.area && r.area >= 12) bossRoom = r;
  const spine = []; for (let r = bossRoom.id; via[r]; r = via[r].a === r ? via[r].b : via[r].a) spine.unshift(via[r]);
  if (spine.length < 3 && tries < 20) return generate(realm, rng, tries + 1);

  // 5. two locks on the spine; zones are what each set of keys reaches
  const lockEdge1 = spine[Math.max(0, Math.round(spine.length * 0.3) - 1)], lockEdge2 = spine[Math.max(1, Math.round(spine.length * 0.66))] || spine[spine.length - 1];
  const zoneOfRoom = new Int8Array(rooms.length).fill(-1);
  const fill = (start, z) => { const q = [start]; zoneOfRoom[start] = z; for (let i = 0; i < q.length; i++) for (const e of adj[q[i]]) { if (e === lockEdge1 || e === lockEdge2) continue; const o = e.a === q[i] ? e.b : e.a; if (zoneOfRoom[o] < 0) { zoneOfRoom[o] = z; q.push(o); } } };
  fill(startRoom.id, 0);
  const far = e => (zoneOfRoom[e.a] < 0 ? e.a : e.b);
  const entry1 = far(lockEdge1); fill(entry1, 1); fill(far(lockEdge2), 2);
  for (const e of tree) set(e.door % w, (e.door / w) | 0, T.FLOOR);
  tiles[lockEdge1.door] = T.LOCK_BRASS; tiles[lockEdge2.door] = T.LOCK_BONE;

  // 6. loops: extra doorways between rooms of the same zone, some of them wide
  for (const e of edges) {
    if (e.door !== undefined || zoneOfRoom[e.a] !== zoneOfRoom[e.b] || rng.int(100) >= 45) continue;
    e.door = doorway(e); set(e.door % w, (e.door / w) | 0, T.FLOOR); e.loop = true;
  }
  for (const e of edges) {   // widen open doorways into arches in the wood and the crypt
    if (e.door === undefined || e.door === lockEdge1.door || e.door === lockEdge2.door || realm.id === 'mansion' || rng.int(100) >= 50) continue;
    const i = e.tiles.indexOf(e.door), nb = e.tiles[i + 1] ?? e.tiles[i - 1];
    if (nb !== undefined) tiles[nb] = T.FLOOR;
  }
  // doors in the doorways, most of all in the manor
  const doorChance = realm.id === 'mansion' ? 75 : realm.id === 'crypt' ? 30 : 0;
  for (const e of edges) if (e.door !== undefined && tiles[e.door] === T.FLOOR && rng.int(100) < doorChance) {
    const x = e.door % w, y = (e.door / w) | 0;
    const ns = at(x - 1, y) === T.WALL && at(x + 1, y) === T.WALL, ew = at(x, y - 1) === T.WALL && at(x, y + 1) === T.WALL;
    if (ns || ew) set(x, y, T.DOOR);
  }
  const zone = new Int8Array(w * h).fill(-1);
  for (let i = 0; i < w * h; i++) if (roomOf[i] >= 0) zone[i] = zoneOfRoom[roomOf[i]];
  for (const e of edges) if (e.door !== undefined) zone[e.door] = Math.max(zoneOfRoom[e.a], zoneOfRoom[e.b]);

  // 7. pillars in big rooms: single tiles, apart from each other and two tiles clear of every wall
  for (const r of rooms) {
    if (r.area < 35 || r === startRoom) continue;
    const step = realm.id === 'forest' ? 3 : 4;
    for (let y = r.y0 + 2; y <= r.y1 - 2; y += step) for (let x = r.x0 + 2; x <= r.x1 - 2; x += step) {
      if (rng.int(100) < (realm.id === 'forest' ? 55 : 80)) set(x, y, T.WALL);
    }
  }

  // 8. the way out: a wall tile on the guardian room's edge, not beside a doorway
  const isGap = i => tiles[i] !== T.WALL && roomOf[i] < 0;
  const edgeWalls = [];
  for (let x = bossRoom.x0; x <= bossRoom.x1; x++) for (const y of [bossRoom.y0 - 1, bossRoom.y1 + 1]) edgeWalls.push([x, y, 0, y < bossRoom.y0 ? 1 : -1]);
  for (let y = bossRoom.y0; y <= bossRoom.y1; y++) for (const x of [bossRoom.x0 - 1, bossRoom.x1 + 1]) edgeWalls.push([x, y, x < bossRoom.x0 ? 1 : -1, 0]);
  const solid = edgeWalls.filter(([x, y]) => at(x, y) === T.WALL && !DIRS.some(([dx, dy]) => isGap((y + dy) * w + x + dx)));
  const outer = solid.filter(([x, y]) => x === 0 || y === 0 || x === w - 1 || y === h - 1);   // prefer the edge of the map
  const [gx, gy, gdx, gdy] = rng.pick(outer.length ? outer : solid);
  set(gx, gy, T.EXIT);
  const ex = gx + gdx, ey = gy + gdy;
  if (at(ex, ey) === T.WALL) set(ex, ey, T.FLOOR);

  // 9. things. One per tile; nothing in a doorway.
  const { dist } = bfs(map, startRoom.cx, startRoom.cy);
  const used = new Set([startRoom.cy * w + startRoom.cx, ey * w + ex]);
  const nearDoor = i => DIRS.some(([dx, dy]) => isGap(i + dy * w + dx)) || isGap(i);
  const floorIn = (r, pred = () => true) => { const out = []; for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) { const i = y * w + x; if (tiles[i] === T.FLOOR && !used.has(i) && pred(i)) out.push(i); } return out; };
  const againstWall = i => DIRS.filter(([dx, dy]) => tiles[i + dy * w + dx] === T.WALL).length >= 1;
  const take = i => { used.add(i); return { x: i % w, y: (i / w) | 0 }; };

  // a chest blocks its tile: it may never cut the level in two
  const blockedByChest = new Set();
  const reachCount = () => { const r = bfs(map, startRoom.cx, startRoom.cy, (x, y) => blockedByChest.has(y * w + x)); let n = 0; for (const d of r.dist) if (d >= 0) n++; return n; };
  let reachable = reachCount();
  const safe = i => { blockedByChest.add(i); const ok = reachCount() === reachable - 1; blockedByChest.delete(i); return ok; };
  const chests = [], pickups = [];
  const chestSpot = r => { const c = floorIn(r, i => againstWall(i) && !nearDoor(i)); rng.shuffle(c); return c.find(safe); };
  const chestAt = (i, holds) => { const p = take(i); chests.push({ ...p, holds, open: false }); blockedByChest.add(i); reachable--; };
  const roomsIn = z => rooms.filter(r => zoneOfRoom[r.id] === z && r !== startRoom && r !== bossRoom);
  const farthestRoom = (list, from) => list.slice().sort((a, b) => (Math.abs(b.cx - from.cx) + Math.abs(b.cy - from.cy)) - (Math.abs(a.cx - from.cx) + Math.abs(a.cy - from.cy)));
  const placeKey = (z, key, from) => {
    for (const r of farthestRoom(roomsIn(z).length ? roomsIn(z) : rooms.filter(r => zoneOfRoom[r.id] === z), from)) { const i = chestSpot(r); if (i !== undefined) return chestAt(i, key); }
    const r = rooms.find(r => zoneOfRoom[r.id] === z), f = floorIn(r);
    pickups.push({ ...take(f[0]), kind: key });
  };
  placeKey(0, 'brass', startRoom);
  placeKey(1, 'bone', rooms[entry1]);
  for (const r of rng.shuffle(rooms.filter(r => r !== startRoom))) {
    if (chests.length >= realm.chests + 2) break;
    if (rng.int(100) < 45 + r.area) { const i = chestSpot(r); if (i !== undefined) chestAt(i, null); }
  }

  // enemies in groups, more of them deeper in; the guardian before the way out
  const enemies = [];
  let id = 0;
  for (const r of rooms) {
    if (r === startRoom) continue;
    const z = zoneOfRoom[r.id];
    const n = Math.min(5, Math.floor(r.area / 16 * realm.density * (0.7 + z * 0.3) + rng.float() * 0.9));
    for (let k = 0; k < n; k++) {
      const pool = floorIn(r, i => dist[i] >= 4 && !nearDoor(i));
      if (!pool.length) break;
      const p = take(rng.pick(pool));
      enemies.push(makeEnemy(rng.weighted(realm.enemies), p.x, p.y, id++));
    }
  }
  enemies.push(makeEnemy(realm.boss, ex, ey, 99));

  // pickups: ammunition, medkits and black magic lying about, and the realm's weapon
  const loot = realm.loot;
  for (const r of rooms) {
    const n = rng.int(100) < 25 + r.area ? 1 + (r.area > 30 ? rng.int(2) : 0) : 0;
    for (let k = 0; k < n; k++) { const pool = floorIn(r, i => !nearDoor(i)); if (!pool.length) break; pickups.push({ ...take(rng.pick(pool)), kind: rng.weighted(loot) }); }
  }
  if (realm.weapon) { const rs = roomsIn(realm.weaponZone ?? 1); const r = rs.length ? rng.pick(rs) : startRoom, pool = floorIn(r, i => !nearDoor(i)); if (pool.length) pickups.push({ ...take(rng.pick(pool)), kind: realm.weapon }); }

  const decos = [];
  for (const r of rooms) {   // every room has a light
    const spots = floorIn(r, i => againstWall(i) && !nearDoor(i));
    if (spots.length) { const i = rng.pick(spots); used.add(i); decos.push({ x: i % w, y: (i / w) | 0, kind: realm.light }); }
  }
  for (const r of rooms) for (const i of floorIn(r, i => !nearDoor(i))) if (rng.int(100) < (againstWall(i) ? 9 : 3)) { used.add(i); decos.push({ x: i % w, y: (i / w) | 0, kind: rng.pick(realm.deco) }); }

  // face into the room
  const sx = startRoom.cx, sy = startRoom.cy;
  const dir = [0, 1, 2, 3].sort((a, b) => run(b) - run(a))[0];
  function run(d) { let n = 0, x = sx, y = sy; while (at(x + DIRS[d][0], y + DIRS[d][1]) !== T.WALL && n < 20) { x += DIRS[d][0]; y += DIRS[d][1]; n++; } return n; }
  return { ...map, zone, rooms, roomOf, start: { x: sx, y: sy, dir }, exit: { x: gx, y: gy, cx: ex, cy: ey }, locks: [lockEdge1.door, lockEdge2.door], chests, enemies, pickups, decos };
}

export function makeEnemy(type, x, y, id) {
  const d = ENEMIES[type];
  return { id, type, x, y, hp: d.hp, maxHp: d.hp, awake: false, stun: 0, tick: 0, dead: false, fx: { hurt: 0, atk: 0, die: 0 } };
}
