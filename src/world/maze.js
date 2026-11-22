// Level generation. A perfect maze is carved over an N x N grid of cells (tile 2x+1, 2y+1), the longest path from
// the start becomes the spine, two locked doors cut the spine into three zones, and each zone holds the key to the
// next. Loops and rooms are only ever opened inside one zone, so the locks always gate progress.
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

export function generate(realm, rng) {
  const N = realm.size, w = 2 * N + 1, h = 2 * N + 1;
  const tiles = new Uint8Array(w * h).fill(T.WALL);
  const at = (x, y) => tiles[y * w + x], set = (x, y, t) => { tiles[y * w + x] = t; };
  const map = { w, h, tiles, at, set };

  // 1. perfect maze, iterative backtracker
  const seen = new Uint8Array(N * N), stack = [[0, 0]];
  seen[0] = 1; set(1, 1, T.FLOOR);
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const opts = DIRS.filter(([dx, dy]) => { const nx = cx + dx, ny = cy + dy; return nx >= 0 && ny >= 0 && nx < N && ny < N && !seen[ny * N + nx]; });
    if (!opts.length) { stack.pop(); continue; }
    const [dx, dy] = rng.pick(opts), nx = cx + dx, ny = cy + dy;
    seen[ny * N + nx] = 1;
    set(2 * cx + 1 + dx, 2 * cy + 1 + dy, T.FLOOR); set(2 * nx + 1, 2 * ny + 1, T.FLOOR);
    stack.push([nx, ny]);
  }

  // 2. start in a random corner; the farthest cell is where the way out is
  const corners = [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]], [sx, sy] = rng.pick(corners);
  let { dist, prev } = bfs(map, sx, sy);
  let far = 0; for (let i = 0; i < dist.length; i++) if (dist[i] > dist[far]) far = i;
  const ex = far % w, ey = (far / w) | 0;
  const path = []; for (let i = far; i >= 0; i = prev[i]) path.unshift(i);

  // the exit is a wall tile beside the last cell
  const exitWalls = DIRS.map(([dx, dy]) => [ex + dx, ey + dy]).filter(([x, y]) => at(x, y) === T.WALL);
  const [gx, gy] = rng.pick(exitWalls); set(gx, gy, T.EXIT);

  // 3. two locks on the spine, on the gaps between cells (odd + even coordinates)
  const gaps = path.map((i, k) => ({ i, k })).filter(({ i }) => ((i % w) + ((i / w) | 0)) % 2 === 1);
  const lockAt = f => gaps[Math.min(gaps.length - 2, Math.max(1, Math.round(gaps.length * f)))].i;
  const lock1 = lockAt(0.34), lock2 = lockAt(0.68);
  tiles[lock1] = T.LOCK_BRASS; tiles[lock2] = T.LOCK_BONE;

  // 4. zones: what can be reached through 0, 1 or 2 locks
  const zone = new Int8Array(w * h).fill(-1);
  const fillZone = (x, y, z) => {
    const r = bfs(map, x, y, (nx, ny, t) => t === T.LOCK_BRASS || t === T.LOCK_BONE || zone[ny * w + nx] >= 0);
    for (let i = 0; i < r.dist.length; i++) if (r.dist[i] >= 0 && zone[i] < 0) zone[i] = z;
  };
  fillZone(sx, sy, 0);
  const beyond = lk => { for (const [dx, dy] of DIRS) { const j = lk + dy * w + dx; if (tiles[j] === T.FLOOR && zone[j] < 0) return j; } return -1; };
  const b1 = beyond(lock1); fillZone(b1 % w, (b1 / w) | 0, 1); zone[lock1] = 1;
  const b2 = beyond(lock2); fillZone(b2 % w, (b2 / w) | 0, 2); zone[lock2] = 2;

  // 5. loops and rooms, only within a zone
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (at(x, y) !== T.WALL || (x + y) % 2 === 0) continue;
    const horiz = x % 2 === 0;   // wall between two cells left and right
    const a = horiz ? (y * w + x - 1) : ((y - 1) * w + x), b = horiz ? (y * w + x + 1) : ((y + 1) * w + x);
    if (zone[a] >= 0 && zone[a] === zone[b] && rng.int(100) < 11) { set(x, y, T.FLOOR); zone[y * w + x] = zone[a]; }
  }
  for (let r = 0; r < Math.floor(N / 3); r++) {     // small halls: open a 2 x 2 block of cells
    const cx = rng.int(N - 1), cy = rng.int(N - 1), x0 = 2 * cx + 1, y0 = 2 * cy + 1, z = zone[y0 * w + x0];
    let ok = z >= 0;
    for (let y = y0; y <= y0 + 2 && ok; y++) for (let x = x0; x <= x0 + 2; x++) {
      const t = at(x, y); if (t === T.LOCK_BRASS || t === T.LOCK_BONE) ok = false;
      if ((x % 2 === 1 && y % 2 === 1) && zone[y * w + x] !== z) ok = false;
    }
    if (!ok) continue;
    for (let y = y0; y <= y0 + 2; y++) for (let x = x0; x <= x0 + 2; x++) if (at(x, y) === T.WALL) { set(x, y, T.FLOOR); zone[y * w + x] = z; }
  }

  // 6. plain doors on narrow gaps (a wall on both sides)
  const doorChance = realm.id === 'forest' ? 0 : realm.id === 'mansion' ? 30 : 14;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (at(x, y) !== T.FLOOR || (x + y) % 2 === 0) continue;
    const ns = at(x, y - 1) === T.WALL && at(x, y + 1) === T.WALL && at(x - 1, y) === T.FLOOR && at(x + 1, y) === T.FLOOR;
    const ew = at(x - 1, y) === T.WALL && at(x + 1, y) === T.WALL && at(x, y - 1) === T.FLOOR && at(x, y + 1) === T.FLOOR;
    if ((ns || ew) && rng.int(100) < doorChance && Math.abs(x - sx) + Math.abs(y - sy) > 2) set(x, y, T.DOOR);
  }

  // 7. things. Cells only (odd, odd), one thing per tile.
  ({ dist } = bfs(map, sx, sy, (x, y, t) => false));
  const used = new Set([sy * w + sx, ey * w + ex]);
  const cells = [];
  for (let y = 1; y < h; y += 2) for (let x = 1; x < w; x += 2) if (at(x, y) === T.FLOOR) cells.push(y * w + x);
  const deadEnd = i => DIRS.filter(([dx, dy]) => tiles[i + dy * w + dx] !== T.WALL).length === 1;
  const free = (z, pred = () => true) => cells.filter(i => zone[i] === z && !used.has(i) && pred(i));
  const take = i => { used.add(i); return { x: i % w, y: (i / w) | 0 }; };
  const farthest = (list, from) => list.sort((a, b) => manh(b, from, w) - manh(a, from, w))[0];

  // a chest blocks its tile: it may never cut the maze in two
  const reachCount = () => { const r = bfs(map, sx, sy, (x, y) => blockedByChest.has(y * w + x)); let n = 0; for (const d of r.dist) if (d >= 0) n++; return n; };
  const blockedByChest = new Set();
  let reachable = reachCount();
  const safe = i => { if (deadEnd(i)) return true; blockedByChest.add(i); const ok = reachCount() === reachable - 1; blockedByChest.delete(i); return ok; };
  const chests = [];
  const chestAt = (i, holds) => { const p = take(i); chests.push({ ...p, holds, open: false }); blockedByChest.add(i); reachable--; };
  // key chests: the brass key somewhere in zone 0 away from the start, the bone key deep in zone 1
  const prefer = list => { const d = list.filter(deadEnd); return d.length ? d : list.filter(safe); };
  // keys go in chests; in a zone too cramped for a chest the key just lies on the floor
  const pickups = [];
  const keyAt = (list, from, key) => {
    const c = prefer(list);
    if (c.length) return chestAt(farthest(c, from), key);
    const any = list.length ? list : cells.filter(i => zone[i] === (key === 'brass' ? 0 : 1));
    const p = take(farthest(any, from)); pickups.push({ ...p, kind: key });
  };
  keyAt(free(0, i => dist[i] >= 4).length ? free(0, i => dist[i] >= 4) : free(0), sy * w + sx, 'brass');
  keyAt(free(1), lock1, 'bone');
  if (realm.weaponChest) { const c = free(1).concat(free(2)).filter(deadEnd); if (c.length) chestAt(rng.pick(c), realm.weaponChest); }
  for (let k = 0; k < realm.chests; k++) {
    const pool = free(k % 3).filter(deadEnd);
    if (pool.length) chestAt(rng.pick(pool), null);
  }

  // enemies spread over the zones, more of them further in; the boss stands before the way out
  const enemies = [];
  const types = realm.enemies.map(([k, wgt]) => [k, wgt]);
  for (let k = 0; k < realm.count; k++) {
    const z = k < realm.count * 0.3 ? 0 : k < realm.count * 0.65 ? 1 : 2;
    const pool = free(z, i => dist[i] >= 5 && !enemies.some(e => Math.abs(e.x - i % w) + Math.abs(e.y - ((i / w) | 0)) < 3));
    if (!pool.length) continue;
    const p = take(rng.pick(pool)), type = rng.weighted(types);
    enemies.push(makeEnemy(type, p.x, p.y, k));
  }
  enemies.push(makeEnemy(realm.boss, ex, ey, 99));

  // loose pickups lying about, and decoration
  for (let k = 0; k < 3 + (N >> 2); k++) {
    const pool = free(k % 3, i => dist[i] >= 2); if (!pool.length) continue;
    const p = take(rng.pick(pool)); pickups.push({ ...p, kind: rng.pick(['bullets', 'bullets', 'medkit']) });
  }
  const decos = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (at(x, y) !== T.FLOOR || used.has(i) || i === sy * w + sx || rng.int(100) >= 9) continue;
    if ((x + y) % 2 === 1) continue;
    used.add(i); decos.push({ x, y, kind: rng.pick(realm.deco) });
  }

  // face into the open
  let dir = 0; for (let d = 0; d < 4; d++) if (at(sx + DIRS[d][0], sy + DIRS[d][1]) !== T.WALL) { dir = d; break; }
  return { ...map, zone, start: { x: sx, y: sy, dir }, exit: { x: gx, y: gy, cx: ex, cy: ey }, locks: [lock1, lock2], chests, enemies, pickups, decos };
}

const manh = (a, b, w) => Math.abs(a % w - b % w) + Math.abs(((a / w) | 0) - ((b / w) | 0));

export function makeEnemy(type, x, y, id) {
  const d = ENEMIES[type];
  return { id, type, x, y, hp: d.hp, maxHp: d.hp, awake: !!d.boss && false, stun: 0, tick: 0, dead: false, fx: { hurt: 0, atk: 0, die: 0 } };
}
