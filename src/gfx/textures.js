// Wall, floor, ceiling and door textures, 64 x 64, painted pixel by pixel per realm. Sky panorama for the wood.

import { image, hex, rgb, mixc, shade, ramp, fbm, artRng, bayer, R, G, B } from './paint.js';

export const TS = 64;
const tex = fn => { const t = image(TS, TS); for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.data[y * TS + x] = fn(x, y); return t; };
const H = s => s.map(c => hex(c));

// ---------------------------------------------------------------------------------------------------------------- stone
function stoneWall(seed, pal, opt = {}) {
  const n = fbm(seed, TS, 8, 3), r = artRng(seed), rowH = 16, bricks = [];
  for (let row = 0; row < 4; row++) { const off = row % 2 ? 16 : 0; for (let k = -1; k < 3; k++) bricks.push({ row, x0: off + k * 32, tone: r() * 0.35 - 0.12, crack: r() < 0.25 }); }
  const mortar = hex('#130c1a');
  return tex((x, y) => {
    const row = (y / rowH) | 0, ly = y % rowH, off = row % 2 ? 16 : 0, lx = ((x - off) % 32 + 32) % 32;
    const b = bricks.find(q => q.row === row && ((x - q.x0 + 64) % 64) < 32) || bricks[0];
    if (ly === 0 || lx === 0 || (ly === rowH - 1 && (x + y) % 3 === 0)) return mortar;
    let v = 0.45 + b.tone + (n(x, y) - 0.5) * 0.55;
    if (ly === 1 || lx === 1) v += 0.22;               // lit top-left edge
    if (ly === rowH - 2 || lx === 31) v -= 0.2;        // shadow bottom-right
    if (b.crack && Math.abs(lx - 10 - ly * 0.7) < 0.7 && ly > 3 && ly < 13) return mortar;
    let c = ramp(pal, v, x, y);
    if (opt.moss && n(x * 1.7, y * 0.6 + 40) > 0.62 && ly > 8) c = ramp(H(['#1d2a1e', '#2c3d27', '#3f5230']), n(x * 3, y * 3), x, y);
    if (opt.blood && y > 20 && (x * 7 % 13 === 0) && n(x * 0.3, 3) > 0.5 && y < 20 + n(x, 9) * 40) c = hex(y % 5 ? '#5c0f16' : '#7a1820');
    return c;
  });
}
function flagstones(seed, pal) {
  const n = fbm(seed, TS, 6, 3), r = artRng(seed);
  const tones = Array.from({ length: 16 }, () => r() * 0.3 - 0.15);
  return tex((x, y) => {
    const sx = (x / 32) | 0, sy = (y / 32) | 0, ox = (sy % 2) * 16, lx = (x + ox) % 32, ly = y % 32;
    if (lx === 0 || ly === 0) return hex('#17121c');
    let v = 0.5 + tones[(sy * 2 + (((x + ox) / 32) | 0)) % 16] + (n(x, y) - 0.5) * 0.6;
    if (lx === 1 || ly === 1) v += 0.18; if (lx === 31 || ly === 31) v -= 0.18;
    return ramp(pal, v, x, y);
  });
}

// --------------------------------------------------------------------------------------------------------------- manor
function wallpaper(seed, variant) {
  const n = fbm(seed, TS, 8, 2);
  const paper = H(['#2a1430', '#3a1c40', '#4a2650']), motif = H(['#5a2f5a', '#6c3a66']), wood = H(['#1e110c', '#2e1a12', '#40261a', '#55331f']);
  return tex((x, y) => {
    if (y >= 42) {                                   // wainscot
      if (y === 42 || y === 43) return y === 42 ? hex('#6a4426') : hex('#2a170e');
      const px = x % 32, py = y - 44;
      const inPanel = px > 3 && px < 29 && py > 2 && py < 17;
      let v = 0.45 + (n(x * 0.3, y * 2) - 0.5) * 0.5 + (inPanel ? -0.1 : 0.08);
      if (inPanel && (px === 4 || py === 3)) v -= 0.25; if (inPanel && (px === 28 || py === 16)) v += 0.25;
      return ramp(wood, v, x, y);
    }
    if (y < 2) return hex('#1b0e12');
    if (variant === 1 && x >= 14 && x < 50 && y >= 6 && y < 38) return portrait(x - 14, y - 6, n);
    if (variant === 2 && x >= 16 && x < 48 && y >= 4 && y < 40) return windowPane(x - 16, y - 4, n);
    // damask: a diamond lattice with a fleur in each diamond
    const u = ((x + 8) % 16) - 8, v = ((y + (((x + 8) / 16 | 0) % 2) * 8) % 16) - 8;
    const d = Math.abs(u) + Math.abs(v), fleur = (Math.abs(u) < 2 && Math.abs(v) < 5) || (Math.abs(v + 2) < 1.5 && Math.abs(u) < 4) || (d > 6.5 && d < 7.6);
    if (fleur) return ramp(motif, n(x, y), x, y);
    return ramp(paper, 0.5 + (n(x, y) - 0.5) * 0.8 - (y < 6 ? 0.25 : 0), x, y);
  });
}
function portrait(x, y, n) {
  const W = 36, Hh = 32;
  if (x < 3 || y < 3 || x >= W - 3 || y >= Hh - 3) {   // gilt frame
    const e = Math.min(x, y, W - 1 - x, Hh - 1 - y);
    return ramp(H(['#4a3010', '#8a6020', '#c89a3a', '#e8c060']), e === 1 ? 0.85 : e === 0 ? 0.2 : 0.5 + (n(x * 2, y * 2) - 0.5), x, y);
  }
  const cx = x - W / 2, cy = y - 14;
  if (cx * cx / 36 + cy * cy / 64 < 1) {             // a pale face in the dark
    if ((Math.abs(cx + 3) < 1.2 || Math.abs(cx - 3) < 1.2) && Math.abs(cy + 1) < 1) return rgb(255, 40, 40, 254);
    return ramp(H(['#3a2a2a', '#6a5048', '#8a6a5a']), 0.6 - cy / 20, x, y);
  }
  if (y > 22 && Math.abs(cx) < 8 + (y - 22)) return ramp(H(['#120a10', '#22141c']), n(x, y), x, y);
  return ramp(H(['#0e0a0c', '#1c1418', '#2a1e1c']), n(x * 0.5, y * 0.5), x, y);
}
function windowPane(x, y, n) {
  const W = 32, Hh = 36;
  if (x < 2 || x >= W - 2 || y < 2 || y >= Hh - 2 || x === 15 || x === 16 || y === 17) return ramp(H(['#1a0f0c', '#3a2416']), 0.5, x, y);
  if (y < 12 && Math.hypot(x - 22, y - 8) < 4.5) return rgb(250, 170, 80, 254);   // the moon through the glass
  return ramp(H(['#120c22', '#1e1434', '#2c1c44', '#40264e']), 0.2 + y / Hh * 0.7 + (n(x, y) - 0.5) * 0.3, x, y);
}
function planks(seed) {
  const n = fbm(seed, TS, 4, 3), r = artRng(seed), offs = Array.from({ length: 8 }, () => (r() * 64) | 0);
  const pal = H(['#1c100c', '#2c1a12', '#3c2416', '#4e301c', '#5e3c22']);
  return tex((x, y) => {
    const k = (y / 8) | 0, ly = y % 8, lx = (x + offs[k]) % 64;
    if (ly === 0 || lx === 0) return hex('#100806');
    return ramp(pal, 0.5 + (n(x * 0.25, y * 3) - 0.5) * 0.9 + (ly === 1 ? 0.15 : 0), x, y);
  });
}
function plaster(seed) {
  const n = fbm(seed, TS, 8, 2);
  return tex((x, y) => (y % 32 < 6 ? ramp(H(['#160c0a', '#24140e', '#321c12']), 0.3 + (n(x, y) - 0.5) + (y % 32 === 0 ? 0.4 : 0), x, y)
    : ramp(H(['#140e18', '#1c1422', '#241a2a']), n(x, y), x, y)));
}

// -------------------------------------------------------------------------------------------------------------- forest
function trees(seed, variant) {
  const n = fbm(seed, TS, 8, 3), r = artRng(seed);
  const trunks = Array.from({ length: 3 }, (_, i) => ({ x: 8 + i * 22 + r() * 8, w: 5 + r() * 5, lean: (r() - 0.5) * 0.25 }));
  const bark = H(['#120c14', '#1e1622', '#2c2232', '#3c3044']), leaf = H(['#0c1014', '#141a1e', '#1c2428', '#262e2c']);
  return tex((x, y) => {
    for (const t of trunks) {
      const cx = t.x + (y - 32) * t.lean + Math.sin(y * 0.2 + t.x) * 0.8, dx = x - cx, ww = t.w + (y > 52 ? (y - 52) * 0.5 : 0);
      if (Math.abs(dx) < ww) {
        let v = 0.4 + (dx / ww) * 0.35 + (n(x * 0.5, y * 3) - 0.5) * 0.6;
        if (((y + (t.x | 0)) % 9 === 0) && Math.abs(dx) < ww - 1) v -= 0.3;
        if (variant === 1 && Math.abs(dx) < 1.6 && y > 28 && y < 36) return rgb(255, 60, 30, 254);   // something watching from a knot
        return ramp(bark, v, x, y);
      }
    }
    // undergrowth and leaves in the gaps, darker further down
    const v = n(x, y) * 0.9 + (y < 20 ? 0.15 : 0) - (y > 48 ? 0.2 : 0);
    if (v < 0.32) return hex('#06070a');
    if (y > 50 && n(x * 2, y) > 0.55) return ramp(H(['#16201a', '#20301e', '#2c3e24']), n(x * 3, y * 3), x, y);
    return ramp(leaf, v, x, y);
  });
}
function forestFloor(seed) {
  const n = fbm(seed, TS, 6, 3);
  return tex((x, y) => {
    const v = n(x, y);
    if (n(x * 2 + 30, y * 2) > 0.66) return ramp(H(['#2a2a3c', '#3a3a4e', '#4c4c5e']), v, x, y);   // pale stones on the path
    if (v > 0.58) return ramp(H(['#1a2430', '#22303a', '#2c3c40']), (v - 0.58) * 2.5, x, y);
    return ramp(H(['#121620', '#181c2a', '#202436']), v * 1.6, x, y);
  });
}

// ---------------------------------------------------------------------------------------------------------------- doors
function door(seed, kind, base) {
  const n = fbm(seed, TS, 4, 3), wood = base || H(['#1e120c', '#2e1c12', '#422a18', '#583820']);
  const lock = kind === 'brass' ? H(['#6a4a10', '#b08020', '#e8c050']) : kind === 'bone' ? H(['#6a6050', '#b0a890', '#e8e0cc']) : null;
  return tex((x, y) => {
    const band = (y >= 10 && y < 14) || (y >= 50 && y < 54);
    if (x < 2 || x > 61) return hex('#0c0806');
    if (band) return (x % 8 === 4 && (y === 11 || y === 51)) ? hex('#9a9aa6') : ramp(H(['#1e1e26', '#33333e', '#4a4a56']), y % 4 === 1 ? 0.8 : 0.4, x, y);
    if (lock && x >= 40 && x < 52 && y >= 26 && y < 40) {
      const kx = x - 46, ky = y - 31;
      if ((kx * kx + ky * ky < 4) || (Math.abs(kx) < 1 && ky > 0 && ky < 6)) return hex('#050304');
      if (kind === 'bone' && y === 27 && (x === 43 || x === 49)) return hex('#2a2018');
      return ramp(lock, 0.6 + (x === 40 || y === 26 ? 0.3 : 0) - (x === 51 || y === 39 ? 0.35 : 0), x, y);
    }
    if (!lock && (x - 48) * (x - 48) + (y - 32) * (y - 32) < 16 && (x - 48) * (x - 48) + (y - 32) * (y - 32) > 6) return hex('#5a5a66');
    const px = x % 12;
    if (px === 0) return hex('#120a06');
    return ramp(wood, 0.5 + (n(x * 0.3, y * 2) - 0.5) * 0.9 + (px === 1 ? 0.15 : 0) - (px === 11 ? 0.15 : 0), x, y);
  });
}
function gate(seed) {   // the wood's iron gate with a red glow beyond
  const n = fbm(seed, TS, 6, 2);
  return tex((x, y) => {
    const bar = x % 8 < 2 || y < 4 || (y >= 30 && y < 33);
    if (bar) return ramp(H(['#14141c', '#2a2a36', '#44444e']), (x % 8 === 0 ? 0.8 : 0.3) + (n(x, y) - 0.5) * 0.4, x, y);
    if (y < 10 && x % 8 === 4) return hex('#2a2a36');
    const g = Math.max(0, 1 - Math.abs(y - 44) / 30) * (0.6 + n(x, y) * 0.5);
    return g > 0.72 ? rgb(110 + g * 90, 16 + g * 20, 14, 254) : ramp(H(['#050306', '#12040a', '#2a080c', '#4a0c10']), g * 1.3, x, y);
  });
}
function stairsDown(seed) {
  const n = fbm(seed, TS, 6, 2);
  return tex((x, y) => {
    const arch = Math.abs(x - 32) < 22 && (y > 16 || Math.hypot(x - 32, y - 16) < 22);
    if (!arch) return ramp(H(['#2a1430', '#3a1c40', '#4a2650']), n(x, y), x, y);
    if (Math.abs(x - 32) > 20 || (y <= 16 && Math.hypot(x - 32, y - 16) > 20)) return hex('#6a4426');
    const step = ((y - 20) / 6) | 0;
    if (y > 20 && (y - 20) % 6 === 0) return rgb(200, 60, 30, 254);
    return ramp(H(['#050306', '#160608', '#2c080a']), Math.max(0, step / 7) + bayer(x, y) * 0.1, x, y);
  });
}
function seal(seed) {   // a great round seal of stone, its runes alight
  const n = fbm(seed, TS, 8, 3);
  return tex((x, y) => {
    const d = Math.hypot(x - 31.5, y - 31.5), a = Math.atan2(y - 31.5, x - 31.5);
    if (d > 30) return ramp(H(['#1a1220', '#2a2034', '#3a2e46']), n(x, y), x, y);
    if ((d > 24 && d < 26) || (d < 10 && d > 8.5)) return rgb(230, 40, 40, 254);
    if (d > 13 && d < 21 && Math.abs(Math.sin(a * 5)) < 0.12) return rgb(200, 30, 40, 254);
    if (d < 4 && Math.abs(y - 31.5) < 1.5) return rgb(255, 80, 60, 254);
    return ramp(H(['#120c16', '#20182a', '#2e243a', '#3c3048']), 0.4 + (n(x, y) - 0.5) * 0.8 - d / 80, x, y);
  });
}

/** Everything one realm needs. */
export function realmTextures(id) {
  if (id === 'forest') {
    return { walls: [trees(11, 0), trees(23, 0), trees(37, 1)], floor: forestFloor(5), ceil: null,
             door: door(3, null), lockBrass: door(4, 'brass'), lockBone: door(5, 'bone'), exit: gate(9) };
  }
  if (id === 'mansion') {
    return { walls: [wallpaper(13, 0), wallpaper(13, 0), wallpaper(17, 1), wallpaper(19, 2)], floor: planks(7), ceil: plaster(8),
             door: door(6, null), lockBrass: door(7, 'brass'), lockBone: door(8, 'bone'), exit: stairsDown(9) };
  }
  const stone = H(['#241a30', '#342842', '#463858', '#5a4a6e', '#6e5e84']);
  return { walls: [stoneWall(41, stone), stoneWall(43, stone, { moss: true }), stoneWall(47, stone, { blood: true })],
           floor: flagstones(31, H(['#3e3e34', '#56564a', '#6e6e5c', '#8a8a72'])), ceil: flagstones(33, H(['#120e16', '#1a1420', '#221a2a'])),
           door: door(9, null, H(['#1a1010', '#2a1814', '#3a2218', '#4c2c1e'])), lockBrass: door(10, 'brass'), lockBone: door(11, 'bone'), exit: seal(12) };
}

/** The sky over the wood: a 512 x 80 panorama that wraps around the full turn. */
export function skyPanorama() {
  const W = 512, Hh = 80, t = image(W, Hh), n = fbm(77, 512, 8, 4), r = artRng(5);
  const stars = Array.from({ length: 70 }, () => [(r() * W) | 0, (r() * 40) | 0]);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const v = y / Hh;
    let c = ramp(H(['#0a0818', '#141030', '#221a46', '#3a2456', '#5a2c50', '#8a3a3a']), v * v * 1.1 + 0.02, x, y);
    const cl = n(x, y * 2.2) - (0.62 - v * 0.2);
    if (cl > 0) c = cl > 0.12 ? ramp(H(['#120c20', '#1c142c']), cl, x, y) : (cl > 0.07 ? hex('#a0482a') : hex('#3a2040'));
    t.data[y * W + x] = c;
  }
  for (const [x, y] of stars) if (R(t.data[y * W + x]) < 40) t.data[y * W + x] = rgb(200, 190, 230, 254);
  const mx = 140, my = 26;   // the moon
  for (let y = 0; y < Hh; y++) for (let x = mx - 24; x < mx + 24; x++) {
    const d = Math.hypot(x - mx, y - my);
    if (d < 15) { const k = 0.75 + n(x * 4, y * 4) * 0.35 - d / 60; t.data[y * W + x] = rgb(250 * k, 160 * k, 70 * k, 254); }
    else if (d < 22) t.data[y * W + x] = mixc(t.data[y * W + x], rgb(160, 70, 40), Math.max(0, (22 - d) / 7 * 0.5 + bayer(x, y) * 0.3) > 0.4 ? 0.5 : 0) | 0;
  }
  // distant hills and a castle on the horizon
  for (let x = 0; x < W; x++) {
    const hill = Hh - 6 - Math.round(4 + Math.sin(x * 0.05) * 3 + Math.sin(x * 0.13) * 2);
    let top = hill;
    if (x > 300 && x < 340) { const k = x - 300; top = Math.min(top, Hh - 18 - ((k % 10 < 6) ? 6 : 0) - (k > 14 && k < 22 ? 14 : 0)); }
    for (let y = Math.max(0, top); y < Hh; y++) t.data[y * W + x] = (x > 300 && x < 340 && y === Hh - 16 && x % 7 === 3) ? rgb(255, 120, 40, 254) : hex('#07060c');
  }
  return t;
}

export const texAvg = t => { let r = 0, g = 0, b = 0; for (const c of t.data) { r += R(c); g += G(c); b += B(c); } const k = t.data.length; return [r / k, g / k, b / k]; };
export { shade };
