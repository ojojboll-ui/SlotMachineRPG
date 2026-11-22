// Reel symbols (32 x 32) and the hunter's weapons as seen in first person.

import { sculpt, ell, poly, stroke, curve, lin, rad } from './paint.js';

const S = 32;
const sabre = () => sculpt(S, S, c => {
  curve(c, [7, 26, 14, 8, 27, 3], '#d8dce8', 3); curve(c, [8, 25, 15, 9, 26, 4], '#8a8ea0', 1);
  stroke(c, [4, 23, 12, 29], '#c89a3a', 3); stroke(c, [7, 26, 3, 30], '#4a2a14', 3); ell(c, 2.5, 30, 1.6, 1.6, '#c89a3a');
});
const revolver = () => sculpt(S, S, c => {
  poly(c, [4, 10, 28, 10, 28, 14, 4, 14], lin(c, 0, 10, 0, 14, ['#b8bcc8', '#5a5e6a']));
  ell(c, 12, 15, 5, 4, '#6a6e7a'); for (let i = 0; i < 3; i++) stroke(c, [9 + i * 3, 13, 9 + i * 3, 18], '#3a3e48', 1);
  poly(c, [5, 14, 10, 14, 8, 28, 2, 28], lin(c, 0, 0, 10, 0, ['#5a3018', '#8a5028']));
  poly(c, [12, 18, 15, 18, 14, 22], '#3a3e48'); c.fillStyle = '#3a3e48'; c.fillRect(26, 8, 2, 2);
}, c => { ell(c, 30, 12, 1.5, 2, '#ffd060'); });
const lantern = () => sculpt(S, S, c => {
  curve(c, [10, 8, 16, -2, 22, 8], '#3a3a44', 2);
  c.fillStyle = '#2a2a34'; c.fillRect(8, 7, 16, 3); c.fillRect(8, 26, 16, 3);
  c.fillStyle = '#3a3a44'; c.fillRect(8, 10, 2, 16); c.fillRect(22, 10, 2, 16); c.fillRect(15, 10, 2, 16);
}, c => { c.fillStyle = 'rgba(255,190,80,1)'; c.fillRect(10, 10, 5, 16); c.fillRect(17, 10, 5, 16); ell(c, 16, 18, 2, 4, '#fff4c0'); });
const laudanum = () => sculpt(S, S, c => {
  c.fillStyle = '#6a4a2a'; c.fillRect(13, 2, 6, 4);
  poly(c, [13, 6, 19, 6, 19, 11, 25, 15, 25, 30, 7, 30, 7, 15, 13, 11], lin(c, 7, 0, 25, 0, ['#3a1a0a', '#7a3a14', '#3a1a0a']));
  c.fillStyle = '#d8ccb0'; c.fillRect(9, 18, 14, 8); c.fillStyle = '#8a1a22'; c.fillRect(11, 20, 10, 1); c.fillRect(11, 23, 7, 1);
});
const tome = () => sculpt(S, S, c => {
  poly(c, [5, 5, 26, 3, 28, 27, 7, 29], lin(c, 5, 0, 28, 0, ['#2a0e18', '#4a1a2a', '#2a0e18']));
  c.fillStyle = '#d8ccb0'; poly(c, [7, 28, 27, 26, 27, 28, 8, 30], '#d8ccb0');
  stroke(c, [6, 6, 7, 28], '#c89a3a', 2); ell(c, 17, 15, 7, 5, '#c89a3a'); ell(c, 17, 15, 5.5, 3.5, '#1a0610');
}, c => { ell(c, 17, 15, 2.4, 2.4, '#ff3a30'); ell(c, 17, 15, 0.8, 2, '#200000'); });
const elderSign = () => sculpt(S, S, c => {
  ell(c, 16, 16, 14, 14, rad(c, 16, 16, 14, ['#3a6a3a', '#1e3a22', '#0e1e12']));
}, c => {
  const pts = []; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; pts.push(16 + Math.cos(a) * 11, 16 + Math.sin(a) * 11); }
  for (let i = 0; i < 5; i++) stroke(c, [pts[i * 2], pts[i * 2 + 1], pts[((i + 1) % 5) * 2], pts[((i + 1) % 5) * 2 + 1]], '#a0ff90', 1.6);
  ell(c, 16, 16.5, 3, 2.2, '#a0ff90'); ell(c, 16, 16.5, 1, 1.6, '#0e1e12');
});
const eye = () => sculpt(S, S, c => {
  ell(c, 16, 16, 15, 10, '#2a1238'); ell(c, 16, 16, 12, 7.5, '#e8dcd0');
  for (let i = 0; i < 6; i++) stroke(c, [5 + i, 14 + i % 3, 9 + i, 16], '#c04040', 0.6);
}, c => { ell(c, 16, 16, 6.5, 6.5, rad(c, 16, 16, 6.5, ['#ffd040', '#ff4020', '#a01010'])); ell(c, 16, 16, 1.5, 5, '#100000'); ell(c, 14, 13.5, 1.2, 1.2, '#ffffff'); });
const silver = () => sculpt(S, S, c => {
  ell(c, 16, 16, 14, 14, rad(c, 12, 11, 16, ['#f0f0f8', '#a8acc0', '#5a5e72']));
  ell(c, 16, 16, 10.5, 10.5, 'rgba(0,0,0,0)');
  poly(c, [13, 24, 13, 13, 16, 7, 19, 13, 19, 24], lin(c, 13, 0, 19, 0, ['#8a6a2a', '#e8c060', '#8a6a2a']));
  c.fillStyle = '#5a4a2a'; c.fillRect(13, 20, 6, 1);
});
const bloodMoon = () => sculpt(S, S, c => {
  ell(c, 16, 16, 15, 15, 'rgba(90,10,20,1)');
}, c => {
  ell(c, 16, 16, 12, 12, rad(c, 13, 12, 14, ['#ff6040', '#c01a1a', '#6a0a10']));
  for (const [x, y, r] of [[11, 12, 2.5], [20, 19, 3], [18, 10, 1.5], [12, 21, 1.8]]) ell(c, x, y, r, r, '#8a1014');
});
const skull = () => sculpt(S, S, c => {
  ell(c, 16, 14, 10, 10, lin(c, 0, 4, 0, 26, ['#e8e0cc', '#9a9280']));
  c.fillStyle = '#c8c0aa'; c.fillRect(10, 20, 12, 8);
  ell(c, 12, 15, 3, 3.4, '#0a0606'); ell(c, 20, 15, 3, 3.4, '#0a0606'); poly(c, [16, 18, 14, 22, 18, 22], '#0a0606');
  for (let i = 0; i < 4; i++) stroke(c, [12 + i * 2.7, 24, 12 + i * 2.7, 28], '#5a5448', 1);
});

export function buildSymbols() {
  return { sword: sabre(), fire: revolver(), shield: lantern(), flask: laudanum(), tome: tome(), crown: elderSign(), eye: eye(), obol: silver(), moon: bloodMoon(), skull: skull() };
}

// ------------------------------------------------------------------------------------------------ first person view
// 128 x 96, drawn at the bottom of the view a little right of centre, pointing in.
const sleeve = (c, x, y) => { poly(c, [x - 16, y, x + 20, y - 6, x + 40, 96, x - 8, 96], lin(c, x - 16, 0, x + 40, 0, ['#1a1220', '#3a2a3e', '#1a1220'])); c.fillStyle = '#d8d0c0'; poly(c, [x - 14, y + 2, x + 18, y - 4, x + 20, y + 2, x - 12, y + 8], '#c8c0b0'); };
const fist = (c, x, y) => { ell(c, x, y, 14, 11, lin(c, x - 14, 0, x + 14, 0, ['#6a4a3a', '#b88e6e', '#7a5a44'])); for (let i = 0; i < 3; i++) stroke(c, [x - 8 + i * 6, y - 7, x - 7 + i * 6, y - 1], '#5a3a2a', 1); };
const fpSabre = () => sculpt(128, 96, c => {
  curve(c, [70, 70, 84, 30, 112, 4], '#e0e4f0', 6); curve(c, [72, 66, 86, 30, 110, 6], '#7a7e90', 1.5);
  curve(c, [58, 72, 62, 56, 80, 62], '#c89a3a', 3); stroke(c, [56, 70, 82, 76], '#c89a3a', 6);
  sleeve(c, 70, 84); fist(c, 70, 78);
});
const fpRevolver = () => sculpt(128, 96, c => {
  poly(c, [42, 34, 64, 28, 68, 40, 46, 46], lin(c, 0, 28, 0, 46, ['#9a9eac', '#4a4e5a', '#1e2028']));       // barrel
  c.fillStyle = '#2a2e38'; c.fillRect(42, 31, 4, 4);
  ell(c, 70, 46, 13, 10, lin(c, 0, 36, 0, 56, ['#6a6e7a', '#2a2e38']));                                     // cylinder
  for (let i = 0; i < 4; i++) stroke(c, [62 + i * 5, 39, 62 + i * 5, 53], '#2a2e38', 1.5);
  poly(c, [66, 52, 82, 48, 92, 88, 72, 92], lin(c, 66, 0, 92, 0, ['#4a2814', '#8a5028', '#4a2814']));       // grip
  sleeve(c, 82, 86); fist(c, 80, 76);
});
const fpRifle = () => sculpt(128, 96, c => {
  poly(c, [30, 26, 40, 22, 74, 62, 64, 68], lin(c, 0, 22, 0, 68, ['#a8acba', '#3a3e48']));
  poly(c, [58, 54, 76, 50, 112, 96, 78, 96], lin(c, 58, 0, 112, 0, ['#4a2814', '#8a4c22', '#3a1e0e']));
  c.fillStyle = '#2a2e38'; c.fillRect(30, 24, 5, 4);
  sleeve(c, 90, 90); fist(c, 84, 80);
});
const fpShotgun = () => sculpt(128, 96, c => {
  poly(c, [34, 30, 50, 24, 70, 58, 56, 64], lin(c, 0, 24, 0, 64, ['#7a7e8a', '#3a3e48', '#1e2028']));    // two barrels
  poly(c, [44, 26, 52, 23, 72, 56, 64, 60], lin(c, 0, 23, 0, 60, ['#9a9eac', '#4a4e5a']));
  c.fillStyle = '#14161c'; c.fillRect(35, 29, 5, 4); c.fillRect(44, 25, 5, 4);
  poly(c, [56, 56, 76, 50, 114, 96, 80, 96], lin(c, 56, 0, 114, 0, ['#5a3014', '#9a5a28', '#4a2410']));
  sleeve(c, 92, 90); fist(c, 84, 80);
});
export function buildWeapons() { return { sabre: fpSabre(), revolver: fpRevolver(), shotgun: fpShotgun(), rifle: fpRifle() }; }
export const flash = () => sculpt(40, 40, () => {}, c => { poly(c, [20, 0, 25, 14, 40, 20, 25, 26, 20, 40, 15, 26, 0, 20, 15, 14], '#ffd060'); ell(c, 20, 20, 7, 7, '#fff8e0'); }, { outline: 0 });
