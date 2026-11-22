// The first-person view: a grid raycaster in the Wolfenstein / Doom RPG tradition, drawn into a small pixel buffer.
// Textured walls with sliding inset doors, textured floor and ceiling (or the sky), coloured light from a light map
// plus the hunter's lantern, distance fog, and billboard sprites clipped against a depth buffer.

import { T, isDoorTile } from '../world/maze.js';
import { BAYER, A } from './paint.js';
import { TS } from './textures.js';

const FOV_PLANE = 0.66;

export function createView(VW, VH) {
  const buf = new Uint32Array(VW * VH), zbuf = new Float32Array(VW);
  const projH = (VW / 2) / FOV_PLANE;
  const V = { VW, VH, buf, zbuf, projH };

  /**
   * s: { L, tex, sky, lm, cam: {x, y, ang, bob}, ambient: [r,g,b], lantern: [r,g,b], fog: [r,g,b], fogDist, sprites, doorAnim, time }
   */
  V.render = s => {
    const { L, tex, cam } = s, W = L.w;
    const dirX = Math.cos(cam.ang), dirY = Math.sin(cam.ang), plX = -dirY * FOV_PLANE, plY = dirX * FOV_PLANE;
    const horizon = (VH >> 1) + (cam.bob || 0);
    const amb = s.ambient, lan = s.lantern, fog = s.fog, fogD = s.fogDist, lm = s.lm, lmS = s.lmS, lmW = W * lmS;
    const fogR = fog[0], fogG = fog[1], fogB = fog[2];

    // light at a world point and distance, written to lr/lg/lb
    let lr = 0, lg = 0, lb = 0;
    const light = (wx, wy, d) => {
      const f = Math.max(0, 1 - d / 4.2), k = f * f * (s.flash ? 1 + s.flash : 1);
      lr = amb[0] + lan[0] * k; lg = amb[1] + lan[1] * k; lb = amb[2] + lan[2] * k;
      if (lm) {
        const ix = Math.max(0, Math.min(lmW - 1, (wx * lmS) | 0)), iy = Math.max(0, Math.min(L.h * lmS - 1, (wy * lmS) | 0)), j = (iy * lmW + ix) * 3;
        lr += lm[j]; lg += lm[j + 1]; lb += lm[j + 2];
      }
    };
    // shade one texel: light, dither-quantised, then fog
    const px = (c, x, y, ff) => {
      const a = c >>> 24;
      let r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
      if (a === 254) { const k = 1 - ff * 0.35; return (0xff000000 | ((b * k + fogB * (1 - k)) << 16) | ((g * k + fogG * (1 - k)) << 8) | (r * k + fogR * (1 - k))) >>> 0; }
      const d = BAYER[((y & 3) << 2) | (x & 3)];
      const qr = Math.floor(lr * 6 + d) / 6, qg = Math.floor(lg * 6 + d) / 6, qb = Math.floor(lb * 6 + d) / 6;
      r = r * qr; g = g * qg; b = b * qb;
      r = r + (fogR - r) * ff; g = g + (fogG - g) * ff; b = b + (fogB - b) * ff;
      return (0xff000000 | (Math.min(255, b) << 16) | (Math.min(255, g) << 8) | Math.min(255, r)) >>> 0;
    };
    const fogAt = d => { const f = Math.max(0, Math.min(1, (d - 0.8) / fogD)); return f * (2 - f) * 0.97; };
    const fogQ = (f, x, y) => Math.max(0, Math.min(1, Math.floor(f * 8 + BAYER[((y & 3) << 2) | (x & 3)]) / 8));

    // ---------------- floor, ceiling, sky
    const floorT = tex.floor.data, ceilT = tex.ceil ? tex.ceil.data : null, sky = s.sky;
    const rx0 = dirX - plX, ry0 = dirY - plY, rx1 = dirX + plX, ry1 = dirY + plY;
    for (let y = 0; y < VH; y++) {
      const below = y > horizon, p = below ? y - horizon : horizon - y;
      if (p < 0.5) { for (let x = 0; x < VW; x++) buf[y * VW + x] = (0xff000000 | (fogB << 16) | (fogG << 8) | fogR) >>> 0; continue; }
      const rowD = projH * 0.5 / p;
      if (!below && !ceilT) {          // sky
        const sv = Math.max(0, Math.min(sky.h - 1, sky.h - 1 - Math.floor((horizon - y) * sky.h / (horizon + 1))));
        for (let x = 0; x < VW; x++) {
          const a = cam.ang + Math.atan((2 * x / VW - 1) * FOV_PLANE);
          let u = Math.floor(a / (Math.PI * 2) * sky.w * 2) % sky.w; if (u < 0) u += sky.w;
          const c = sky.data[sv * sky.w + u]; buf[y * VW + x] = (c | 0xff000000) >>> 0;
        }
        continue;
      }
      const ff = fogAt(rowD), T2 = below ? floorT : ceilT;
      let fx = cam.x + rowD * rx0, fy = cam.y + rowD * ry0;
      const sx = rowD * (rx1 - rx0) / VW, sy = rowD * (ry1 - ry0) / VW;
      for (let x = 0; x < VW; x++, fx += sx, fy += sy) {
        const tx = ((fx - Math.floor(fx)) * TS) | 0, ty = ((fy - Math.floor(fy)) * TS) | 0;
        light(fx, fy, rowD);
        buf[y * VW + x] = px(T2[ty * TS + tx], x, y, fogQ(ff, x, y));
      }
    }

    // ---------------- walls
    for (let x = 0; x < VW; x++) {
      const camX = 2 * x / VW - 1, rdx = dirX + plX * camX, rdy = dirY + plY * camX;
      let mx = Math.floor(cam.x), my = Math.floor(cam.y);
      const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy), stx = rdx < 0 ? -1 : 1, sty = rdy < 0 ? -1 : 1;
      let sdx = (rdx < 0 ? cam.x - mx : mx + 1 - cam.x) * ddx, sdy = (rdy < 0 ? cam.y - my : my + 1 - cam.y) * ddy;
      let side = 0, dist = 30, texImg = null, u = 0, hit = false;
      for (let it = 0; it < 64 && !hit; it++) {
        if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; }
        if (mx < 0 || my < 0 || mx >= L.w || my >= L.h) { dist = side ? sdy - ddy : sdx - ddx; texImg = tex.walls[0]; hit = true; break; }
        const t = L.tiles[my * W + mx];
        if (t === T.WALL || t === T.EXIT) {
          dist = side === 0 ? sdx - ddx : sdy - ddy;
          const wx = side === 0 ? cam.y + dist * rdy : cam.x + dist * rdx;
          u = wx - Math.floor(wx); if ((side === 0 && rdx < 0) || (side === 1 && rdy > 0)) u = 1 - u;
          texImg = t === T.EXIT ? tex.exit : tex.walls[wallVariant(mx, my, tex.walls.length)];
          hit = true;
        } else if (isDoorTile(t)) {
          const open = Math.min(1, s.doorAnim(my * W + mx));
          const ns = L.tiles[my * W + mx - 1] === T.WALL && L.tiles[my * W + mx + 1] === T.WALL;   // passage runs north-south
          let tt, hu;
          if (ns) { tt = (my + 0.5 - cam.y) / rdy; hu = cam.x + tt * rdx - mx; }
          else { tt = (mx + 0.5 - cam.x) / rdx; hu = cam.y + tt * rdy - my; }
          if (tt > 0 && hu >= 0 && hu < 1 && hu >= open) {
            dist = tt; u = hu - open; side = ns ? 1 : 0;
            texImg = t === T.DOOR ? tex.door : t === T.LOCK_BRASS ? tex.lockBrass : tex.lockBone;
            hit = true;
          }
        }
      }
      if (!texImg) texImg = tex.walls[0];
      dist = Math.max(0.05, dist);
      zbuf[x] = dist;
      const lineH = projH / dist, top = horizon - lineH / 2;
      const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(VH, Math.ceil(top + lineH));
      const tx = Math.min(TS - 1, (u * TS) | 0), data = texImg.data;
      const hx = cam.x + rdx * (dist - 0.02), hy = cam.y + rdy * (dist - 0.02);
      light(hx, hy, dist);
      if (side === 1) { lr *= 0.78; lg *= 0.78; lb *= 0.8; }
      const ff = fogAt(dist);
      for (let y = y0; y < y1; y++) {
        const ty = Math.min(TS - 1, ((y - top) / lineH * TS) | 0);
        buf[y * VW + x] = px(data[ty * TS + tx], x, y, fogQ(ff, x, y));
      }
    }

    // ---------------- sprites, far to near
    const inv = 1 / (plX * dirY - dirX * plY);
    const list = s.sprites.map(sp => { const rx = sp.x - cam.x, ry = sp.y - cam.y; return { sp, tx: inv * (dirY * rx - dirX * ry), ty: inv * (-plY * rx + plX * ry) }; })
      .filter(o => o.ty > 0.12).sort((a, b) => b.ty - a.ty);
    for (const { sp, tx, ty } of list) {
      const img = sp.img, hPx = projH * sp.h / ty, wPx = hPx * img.w / img.h;
      const cx = (VW / 2) * (1 + tx / ty) + (sp.dx || 0) * projH / ty;
      const bottom = horizon + projH * 0.5 / ty - (sp.lift || 0) * projH / ty, top = bottom - hPx;
      const xs = Math.max(0, Math.floor(cx - wPx / 2)), xe = Math.min(VW, Math.ceil(cx + wPx / 2));
      const ys = Math.max(0, Math.floor(top)), ye = Math.min(VH, Math.ceil(bottom));
      light(sp.x, sp.y, ty);
      if (sp.bright) { lr += sp.bright; lg += sp.bright; lb += sp.bright; }
      const ff = fogAt(ty), alpha = sp.alpha ?? 1, tint = sp.tint;
      for (let x = xs; x < xe; x++) {
        if (ty >= zbuf[x]) continue;
        let u = Math.floor((x - (cx - wPx / 2)) / wPx * img.w); if (sp.flip) u = img.w - 1 - u;
        if (u < 0 || u >= img.w) continue;
        for (let y = ys; y < ye; y++) {
          const v = Math.floor((y - top) / hPx * img.h); if (v < 0 || v >= img.h) continue;
          let c = img.data[v * img.w + u];
          if (!A(c)) continue;
          if (alpha < 1 && alpha * 1.0 < BAYER[((y & 3) << 2) | (x & 3)] + 0.5) continue;
          if (tint) c = tint(c);
          buf[y * VW + x] = px(c, x, y, fogQ(ff, x, y));
        }
      }
    }
    return V;
  };
  return V;
}

const wallVariant = (x, y, n) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; const r = h % 100; return n <= 1 ? 0 : r < 70 ? 0 : 1 + (r % (n - 1)); };

/**
 * Static coloured light map at lmS samples per tile: light sources (candles, braziers, the way out) with a falloff,
 * occluded by walls (a tile-level line test).
 */
export function buildLightMap(L, sources, opaque, lmS = 4) {
  const W = L.w * lmS, H = L.h * lmS, lm = new Float32Array(W * H * 3);
  for (const s of sources) {
    const R = s.r || 3.5;
    for (let y = Math.max(0, Math.floor((s.y - R) * lmS)); y < Math.min(H, Math.ceil((s.y + R) * lmS)); y++) {
      for (let x = Math.max(0, Math.floor((s.x - R) * lmS)); x < Math.min(W, Math.ceil((s.x + R) * lmS)); x++) {
        const wx = (x + 0.5) / lmS, wy = (y + 0.5) / lmS, d = Math.hypot(wx - s.x, wy - s.y);
        if (d >= R) continue;
        if (!clear(s.x, s.y, wx, wy, opaque, s.tile)) continue;
        const k = (1 - d / R) ** 2 * (s.k || 1), j = (y * W + x) * 3;
        lm[j] += s.c[0] * k; lm[j + 1] += s.c[1] * k; lm[j + 2] += s.c[2] * k;
      }
    }
  }
  return { lm, lmS };
}
function clear(ax, ay, bx, by, opaque, srcTile) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 4);
  for (let i = 1; i < n; i++) {
    const x = Math.floor(ax + (bx - ax) * i / n), y = Math.floor(ay + (by - ay) * i / n);
    if (srcTile && x === srcTile[0] && y === srcTile[1]) continue;
    if (opaque(x, y)) return false;
  }
  return true;
}
