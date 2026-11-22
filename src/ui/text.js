// Bitmap text for the 2D canvas, from the One-Armed Hero arcade font. Tinted copies are cached per colour.

import { buildFont, textWidth as tw, wrap as wr, GLYPH_H } from '../gfx/font.js';

let font = null, base = null;
const tints = new Map();

export function initText() {
  font = buildFont();
  base = document.createElement('canvas'); base.width = font.w; base.height = font.h;
  const ctx = base.getContext('2d'), id = ctx.createImageData(font.w, font.h);
  id.data.set(font.albedo); ctx.putImageData(id, 0, 0);
}
function tinted(col) {
  let c = tints.get(col);
  if (!c) {
    c = document.createElement('canvas'); c.width = font.w; c.height = font.h;
    const x = c.getContext('2d'); x.drawImage(base, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, font.w, font.h);
    tints.set(col, c);
  }
  return c;
}
export const textWidth = (s, scale = 1) => tw(font, s, scale);
export const wrap = (s, w, scale = 1) => wr(font, s, w, scale);
export const LINE_H = GLYPH_H + 2;

/** Draw text. align: 'left' | 'center' | 'right'. shadow: colour of a 1px drop shadow, or null. */
export function text(ctx, s, x, y, col = '#f3e6c9', o = {}) {
  const scale = o.scale || 1, str = String(s).toUpperCase(), w = textWidth(str, scale);
  let cx = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x);
  y = Math.round(y);
  if (o.shadow !== null) draw(ctx, str, cx + scale, y + scale, tinted(o.shadow || '#07040b'), scale);
  draw(ctx, str, cx, y, tinted(col), scale);
  return w;
}
function draw(ctx, str, x, y, img, scale) {
  for (const ch of str) {
    const g = font.glyphs[ch];
    if (g) { ctx.drawImage(img, g.x, 1, g.w, GLYPH_H, x, y, g.w * scale, GLYPH_H * scale); x += (g.w + 1) * scale; }
    else x += 4 * scale;
  }
}
