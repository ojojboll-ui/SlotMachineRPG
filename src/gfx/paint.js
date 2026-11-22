// Small pixel-art toolkit. Images are { w, h, data: Uint32Array } in the canvas byte order (ABGR in a little-endian
// word). Alpha 254 marks an emissive pixel: the renderer lights it fully and fog barely touches it.

export const rgb = (r, g, b, a = 255) => (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
export const hex = (s, a = 255) => { const n = parseInt(s.replace('#', ''), 16); return rgb(n >> 16, (n >> 8) & 255, n & 255, a); };
export const R = c => c & 255, G = c => (c >>> 8) & 255, B = c => (c >>> 16) & 255, A = c => c >>> 24;
export const mixc = (a, b, t) => rgb(R(a) + (R(b) - R(a)) * t, G(a) + (G(b) - G(a)) * t, B(a) + (B(b) - B(a)) * t, A(a));
export const shade = (c, k) => rgb(Math.min(255, R(c) * k), Math.min(255, G(c) * k), Math.min(255, B(c) * k), A(c));

export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16 - 0.47);
export const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

export function image(w, h) { return { w, h, data: new Uint32Array(w * h) }; }

/** Tileable value noise in [0,1) with the given period. */
export function noise2(seed, period) {
  const g = new Float32Array(period * period);
  let s = seed >>> 0;
  for (let i = 0; i < g.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; g[i] = s / 4294967296; }
  const at = (x, y) => g[(((y % period) + period) % period) * period + (((x % period) + period) % period)];
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx, b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

/** Fractal noise, tileable over `size` pixels. */
export function fbm(seed, size, cells = 8, oct = 3) {
  const ns = []; for (let o = 0; o < oct; o++) ns.push(noise2(seed + o * 101, cells << o));
  return (x, y) => { let v = 0, a = 0.5, t = 0; for (let o = 0; o < oct; o++) { v += ns[o](x / size * (cells << o), y / size * (cells << o)) * a; t += a; a *= 0.5; } return v / t; };
}

/** A small deterministic random source for art. */
export function artRng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/** Pick from a ramp of colours by a value in [0,1), dithered. */
export function ramp(cols, v, x, y, dither = 1) {
  const t = Math.max(0, Math.min(0.9999, v + bayer(x, y) * dither / cols.length)) * cols.length;
  return cols[Math.max(0, Math.min(cols.length - 1, Math.floor(t)))];
}

/**
 * Paint with the Canvas 2D API, then turn the result into crisp pixel art: hard alpha, colours posterised with an
 * ordered dither, and a dark outline. glow() paints emissive parts on top.
 */
export function sculpt(w, h, draw, glow, opt = {}) {
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const c = mk(), ctx = c.getContext('2d');
  draw(ctx);
  const d = ctx.getImageData(0, 0, w, h).data;
  let gd = null;
  if (glow) { const g = mk(), gx = g.getContext('2d'); glow(gx); gd = gx.getImageData(0, 0, w, h).data; }
  const out = image(w, h), levels = opt.levels || 12, outline = opt.outline ?? hex('#07040b');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, j = i * 4;
    if (gd && gd[j + 3] > 110) { out.data[i] = rgb(gd[j], gd[j + 1], gd[j + 2], 254); continue; }
    if (d[j + 3] < 128) continue;
    const q = v => Math.max(0, Math.min(255, Math.round(v / 255 * levels + bayer(x, y) * 0.9) * 255 / levels));
    out.data[i] = rgb(q(d[j]), q(d[j + 1]), q(d[j + 2]), 255);
  }
  if (outline) {
    const src = out.data.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (A(src[i])) continue;
      if ((x > 0 && A(src[i - 1])) || (x < w - 1 && A(src[i + 1])) || (y > 0 && A(src[i - w])) || (y < h - 1 && A(src[i + w]))) out.data[i] = outline;
    }
  }
  return out;
}

/** An image as a canvas, for the 2D UI. */
export function toCanvas(img, scale = 1) {
  const c = document.createElement('canvas'); c.width = img.w; c.height = img.h;
  const ctx = c.getContext('2d'), id = ctx.createImageData(img.w, img.h);
  const u = new Uint32Array(id.data.buffer);
  for (let i = 0; i < u.length; i++) { const v = img.data[i]; u[i] = A(v) ? (v | 0xff000000) >>> 0 : 0; }
  ctx.putImageData(id, 0, 0);
  if (scale === 1) return c;
  const s = document.createElement('canvas'); s.width = img.w * scale; s.height = img.h * scale;
  const sx = s.getContext('2d'); sx.imageSmoothingEnabled = false; sx.drawImage(c, 0, 0, s.width, s.height);
  return s;
}

// Canvas helpers used by the sculpted art
export function ell(ctx, x, y, rx, ry, fill, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
export function poly(ctx, pts, fill) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
export function stroke(ctx, pts, col, wdt = 1) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
export function curve(ctx, pts, col, wdt = 1) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]); ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.lineCap = 'round'; ctx.stroke(); }
export function lin(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; }
export function rad(ctx, x, y, r, stops) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; }
