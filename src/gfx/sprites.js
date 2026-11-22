// Billboard sprites: enemies, bosses, chests, pickups and decoration, sculpted with Canvas 2D and crushed to pixel art.
// Each entry: { img, h } where h is the height in the world (1 = a wall).

import { sculpt, ell, poly, stroke, curve, lin, rad } from './paint.js';

const eyes = (ctx, x, y, gap, r = 1.6, col = '#ff3030') => { ell(ctx, x - gap, y, r, r * 0.8, col); ell(ctx, x + gap, y, r, r * 0.8, col); };

// ------------------------------------------------------------------------------------------------------- enemies
function ghoul() {
  return sculpt(64, 64, c => {
    const skin = lin(c, 20, 0, 44, 0, ['#4c5a48', '#7a8a6a', '#3a4636']);
    poly(c, [22, 62, 26, 44, 30, 62], '#2e3628'); poly(c, [34, 62, 38, 44, 42, 62], '#2e3628');   // legs
    ell(c, 32, 36, 13, 12, skin);                                                       // hunched torso
    for (let i = 0; i < 4; i++) stroke(c, [24, 31 + i * 4, 40, 31 + i * 4], '#3a4434', 1);   // ribs
    poly(c, [20, 30, 10, 46, 8, 58, 13, 57, 16, 47, 24, 36], '#5c6a52');                 // long arms
    poly(c, [44, 30, 54, 46, 56, 58, 51, 57, 48, 47, 40, 36], '#5c6a52');
    for (let i = 0; i < 3; i++) { stroke(c, [9 + i * 2, 57, 7 + i * 2, 62], '#d8d0b0', 1); stroke(c, [51 + i * 2, 57, 52 + i * 2, 62], '#d8d0b0', 1); }
    ell(c, 32, 21, 8, 8, lin(c, 24, 14, 40, 28, ['#8a9a7a', '#4c5a48']));               // head, low and forward
    poly(c, [26, 25, 38, 25, 36, 29, 28, 29], '#1a0e0e');
    for (let i = 0; i < 5; i++) poly(c, [27 + i * 2.2, 25, 28 + i * 2.2, 27.5, 29 + i * 2.2, 25], '#e8e0c8');
  }, c => eyes(c, 32, 19, 3.2));
}
function hound() {
  return sculpt(64, 64, c => {
    const fur = lin(c, 0, 30, 0, 56, ['#3a3044', '#1e1826']);
    for (const x of [16, 22, 42, 48]) poly(c, [x - 2, 50, x + 2, 50, x + 1, 63, x - 1, 63], '#1a1420');
    ell(c, 32, 44, 20, 9, fur);
    for (let i = 0; i < 7; i++) poly(c, [16 + i * 5, 38, 18 + i * 5, 30 - (i % 2) * 3, 20 + i * 5, 38], '#2a2234');   // spines
    ell(c, 50, 40, 9, 7, '#2e2638'); poly(c, [52, 38, 62, 44, 52, 48], '#2e2638');                                    // head
    poly(c, [53, 45, 61, 45, 58, 48], '#120606');
    for (let i = 0; i < 3; i++) poly(c, [54 + i * 2.5, 45, 55 + i * 2.5, 47, 56 + i * 2.5, 45], '#e0d8c0');
    poly(c, [46, 34, 48, 26, 51, 34], '#2a2234');
    curve(c, [12, 42, 4, 36, 2, 46], '#2a2234', 3);
  }, c => { ell(c, 53, 39, 1.6, 1.2, '#ff3a2a'); ell(c, 49, 39, 1.2, 1, '#ff3a2a'); });
}
function cultist(robe = '#2a1838', trim = '#8a1a22') {
  return sculpt(64, 64, c => {
    poly(c, [20, 63, 24, 30, 32, 14, 40, 30, 44, 63], lin(c, 20, 0, 44, 0, ['#160c1e', robe, '#120a18']));
    for (let i = 0; i < 6; i++) poly(c, [20 + i * 4, 63, 22 + i * 4, 58 + (i % 2) * 3, 24 + i * 4, 63], trim);     // ragged hem
    ell(c, 32, 22, 8, 10, '#1e1228'); ell(c, 32, 24, 5, 6, '#050306');                                               // hood
    poly(c, [40, 36, 50, 40, 50, 43, 40, 41], '#1e1228');                                                             // arm
    poly(c, [48, 38, 58, 38, 58, 41, 52, 41, 51, 45, 48, 45], '#3a3a44');                                              // revolver
  }, c => eyes(c, 32, 24, 2.2, 1.3));
}
function shade() {
  return sculpt(64, 64, c => {
    c.globalAlpha = 1;
    poly(c, [18, 64, 20, 30, 32, 8, 44, 30, 46, 64, 40, 54, 34, 64, 28, 54, 24, 64], lin(c, 0, 8, 0, 64, ['#0c0810', '#1a1222', '#2a1e36']));
    poly(c, [20, 30, 6, 40, 4, 50, 10, 44, 14, 50, 16, 42, 22, 36], '#120c18');                                       // reaching claws
    poly(c, [44, 30, 58, 40, 60, 50, 54, 44, 50, 50, 48, 42, 42, 36], '#120c18');
    for (const [x, y] of [[5, 50], [9, 47], [13, 49], [59, 50], [55, 47], [51, 49]]) stroke(c, [x, y, x, y + 5], '#3a2e46', 1);
  }, c => eyes(c, 32, 20, 3, 1.8));
}
function servant() {
  return sculpt(64, 64, c => {
    poly(c, [24, 63, 25, 40, 30, 40, 30, 63], '#121014'); poly(c, [34, 63, 34, 40, 39, 40, 40, 63], '#121014');
    poly(c, [21, 44, 22, 22, 32, 20, 42, 22, 43, 44], lin(c, 20, 0, 44, 0, ['#0e0c12', '#24202c', '#0e0c12']));      // tailcoat
    poly(c, [29, 22, 32, 34, 35, 22], '#d8d4cc');                                                                      // shirt front
    ell(c, 32, 13, 6, 8, lin(c, 0, 5, 0, 21, ['#b8b0a8', '#7a7068']));
    ell(c, 29.5, 12, 1.8, 2.4, '#050306'); ell(c, 34.5, 12, 1.8, 2.4, '#050306'); ell(c, 32, 17.5, 2, 1.5, '#050306');
    poly(c, [42, 26, 52, 30, 52, 33, 42, 30], '#24202c'); ell(c, 52, 30, 8, 1.5, '#9a9aa6');                          // the tray
    ell(c, 53, 27.5, 2.5, 2.5, '#8a1a22');
  });
}
function drowned() {
  return sculpt(64, 64, c => {
    const skin = lin(c, 16, 0, 48, 0, ['#203a3a', '#4a7a6a', '#1c3030']);
    poly(c, [22, 63, 24, 46, 30, 46, 29, 63], '#1c3030'); poly(c, [35, 63, 34, 46, 40, 46, 42, 63], '#1c3030');
    ell(c, 32, 36, 15, 14, skin);
    ell(c, 32, 18, 9, 9, lin(c, 0, 9, 0, 27, ['#5a8a7a', '#2a4a44']));
    poly(c, [25, 22, 39, 22, 37, 26, 27, 26], '#081010');
    for (let i = 0; i < 6; i++) stroke(c, [20 + i * 5, 46, 20 + i * 5 + (i % 2), 52 + (i % 3) * 3], '#2a5a50', 1);       // dripping weed
    poly(c, [17, 30, 8, 44, 12, 46, 20, 36], skin); poly(c, [47, 30, 56, 44, 52, 46, 44, 36], skin);
    for (const x of [24, 30, 36]) stroke(c, [x, 30, x + 3, 32], '#1a2a28', 1);                                          // gills
  }, c => { ell(c, 27.5, 16, 2.4, 2.4, '#e8f080'); ell(c, 36.5, 16, 2.4, 2.4, '#e8f080'); ell(c, 27.5, 16, 0.8, 1.6, '#202000'); ell(c, 36.5, 16, 0.8, 1.6, '#202000'); });
}
function mass() {
  return sculpt(64, 64, c => {
    for (let i = 0; i < 6; i++) curve(c, [12 + i * 8, 52, 6 + i * 10, 64, 10 + i * 9, 63], '#4a1c3a', 3);
    ell(c, 32, 46, 26, 16, rad(c, 28, 40, 28, ['#a04a6a', '#6a2448', '#3a1028']));
    ell(c, 24, 34, 12, 10, '#7a2c52'); ell(c, 42, 36, 11, 9, '#6a2448');
    poly(c, [22, 50, 42, 50, 38, 56, 26, 56], '#1a0610');
    for (let i = 0; i < 6; i++) poly(c, [23 + i * 3.3, 50, 24.5 + i * 3.3, 53, 26 + i * 3.3, 50], '#e8dcc8');
  }, c => { for (const [x, y, r] of [[22, 34, 2.5], [30, 30, 1.6], [42, 34, 2.2], [36, 42, 1.4], [16, 44, 1.6], [48, 44, 1.8], [26, 42, 1.2]]) { ell(c, x, y, r, r, '#f0e060'); ell(c, x, y, r * 0.4, r * 0.8, '#300808'); } });
}
function priest() {
  return sculpt(64, 64, c => {
    poly(c, [18, 63, 23, 28, 32, 18, 41, 28, 46, 63], lin(c, 18, 0, 46, 0, ['#2a0a10', '#5a1420', '#2a0a10']));
    poly(c, [29, 26, 35, 26, 34, 63, 30, 63], '#c89a3a');                                                             // stole
    ell(c, 32, 16, 6, 7, '#1a0e14'); poly(c, [26, 12, 32, 0, 38, 12], '#3a0e18');                                    // mitre
    stroke(c, [50, 10, 50, 63], '#3a2414', 2); ell(c, 50, 9, 4, 4, '#2a1a10');                                         // staff
    poly(c, [41, 30, 50, 34, 50, 37, 41, 35], '#4a1018');
  }, c => { eyes(c, 32, 17, 2.2, 1.3); ell(c, 50, 9, 2.4, 1.6, '#ff5030'); ell(c, 50, 9, 0.8, 1.2, '#200000'); });
}

// ---------------------------------------------------------------------------------------------------------- bosses
function stag() {
  return sculpt(96, 96, c => {
    poly(c, [30, 95, 36, 50, 48, 36, 60, 50, 66, 95, 56, 86, 48, 95, 40, 86], lin(c, 0, 36, 0, 96, ['#14101c', '#221a2e', '#0c0810']));
    const antler = (s) => { stroke(c, [48 + s * 4, 22, 48 + s * 18, 6, 48 + s * 30, 2], '#5a4a3a', 3); stroke(c, [48 + s * 12, 12, 48 + s * 10, 2], '#5a4a3a', 2); stroke(c, [48 + s * 22, 5, 48 + s * 26, -2], '#5a4a3a', 2); stroke(c, [48 + s * 18, 6, 48 + s * 32, 12], '#5a4a3a', 2); };
    antler(-1); antler(1);
    ell(c, 48, 28, 9, 12, lin(c, 0, 16, 0, 40, ['#d8d0bc', '#8a8070']));                                               // a skull for a face
    poly(c, [43, 34, 53, 34, 51, 40, 45, 40], '#1a1010');
    poly(c, [36, 50, 18, 62, 10, 80, 16, 78, 22, 66, 38, 58], '#1a1424'); poly(c, [60, 50, 78, 62, 86, 80, 80, 78, 74, 66, 58, 58], '#1a1424');
    stroke(c, [84, 30, 84, 95], '#3a2a1a', 3); curve(c, [84, 30, 92, 22, 86, 16], '#3a2a1a', 3);                       // shepherd's crook
  }, c => eyes(c, 48, 27, 4, 2.2));
}
function widow() {
  return sculpt(96, 96, c => {
    poly(c, [20, 95, 34, 44, 48, 30, 62, 44, 76, 95], lin(c, 20, 0, 76, 0, ['#0c0810', '#2a1a34', '#0c0810']));
    for (let i = 0; i < 8; i++) poly(c, [20 + i * 7, 95, 23 + i * 7, 86, 27 + i * 7, 95], '#3a2448');
    ell(c, 48, 22, 9, 12, lin(c, 0, 10, 0, 34, ['#e8e0e0', '#9a8a90']));                                                 // pale face
    poly(c, [36, 14, 48, 2, 60, 14, 62, 48, 56, 30, 40, 30, 34, 48], 'rgba(20,12,26,0.85)');                            // veil
    poly(c, [40, 26, 56, 26, 55, 30, 41, 30], '#3a0a10');
    // impossibly long arms
    poly(c, [36, 46, 16, 56, 4, 80, 8, 82, 20, 60, 38, 54], '#1e1426'); poly(c, [60, 46, 80, 56, 92, 80, 88, 82, 76, 60, 58, 54], '#1e1426');
    for (let i = 0; i < 4; i++) { stroke(c, [5 + i * 2, 81, 2 + i * 2, 90], '#d8ccd0', 1); stroke(c, [86 + i * 2, 81, 88 + i * 2, 90], '#d8ccd0', 1); }
  }, c => eyes(c, 48, 21, 3.5, 1.8));
}
function waiter() {
  return sculpt(96, 96, c => {
    for (let i = 0; i < 9; i++) curve(c, [10 + i * 10, 70, i * 11 - 4, 96, 6 + i * 10, 95], '#2a0e24', 4);
    ell(c, 48, 56, 44, 34, rad(c, 40, 40, 50, ['#3a1430', '#200a1c', '#0a0410']));
    ell(c, 48, 66, 28, 12, '#050104');                                                                                 // the maw
    for (let i = 0; i < 12; i++) { poly(c, [22 + i * 4.5, 56, 24 + i * 4.5, 63, 26 + i * 4.5, 56], '#e8dcc0'); poly(c, [24 + i * 4.2, 77, 26 + i * 4.2, 70, 28 + i * 4.2, 77], '#d8ccb0'); }
  }, c => {
    for (const [x, y, r] of [[30, 38, 4], [66, 38, 4], [48, 30, 3], [18, 52, 2.5], [78, 52, 2.5], [40, 26, 1.8], [58, 26, 1.8]]) { ell(c, x, y, r * 1.3, r, '#ff2a20'); ell(c, x, y, r * 0.35, r * 0.8, '#300000'); }
  });
}

// ---------------------------------------------------------------------------------------------------------- objects
function chest(open) {
  return sculpt(48, 48, c => {
    const wood = lin(c, 0, 20, 0, 46, ['#6a3e1e', '#3a2010']);
    c.fillStyle = wood; c.fillRect(6, 24, 36, 22);
    if (!open) { poly(c, [6, 24, 8, 14, 40, 14, 42, 24], lin(c, 0, 12, 0, 24, ['#7a4a24', '#4a2a14'])); }
    else { poly(c, [6, 24, 4, 8, 44, 8, 42, 24], '#2a160a'); c.fillStyle = '#120804'; c.fillRect(8, 22, 32, 4); }
    c.fillStyle = '#3a3a44'; for (const x of [10, 36]) c.fillRect(x, open ? 8 : 14, 3, 32 + (open ? 6 : 0));
    c.fillStyle = '#c89a3a'; c.fillRect(22, 26, 5, 6);
  }, open ? c => { c.fillStyle = 'rgba(240,190,80,1)'; c.fillRect(10, 21, 28, 2); } : null);
}
function key(col) {
  return sculpt(24, 24, c => { ell(c, 7, 12, 5, 5, col); ell(c, 7, 12, 2, 2, 'rgba(0,0,0,1)'); c.clearRect(6, 11, 2, 2); c.fillStyle = col; c.fillRect(11, 11, 11, 3); c.fillRect(17, 14, 2, 4); c.fillRect(20, 14, 2, 3); });
}
function ammo() {
  return sculpt(32, 32, c => {
    c.fillStyle = '#4a3420'; c.fillRect(6, 16, 20, 12); c.fillStyle = '#6a4a2a'; c.fillRect(6, 14, 20, 3);
    for (let i = 0; i < 4; i++) { c.fillStyle = '#c89a3a'; c.fillRect(8 + i * 5, 8, 3, 8); ell(c, 9.5 + i * 5, 8, 1.5, 2, '#9a7a5a'); }
  });
}
function medkit() {
  return sculpt(32, 32, c => {
    c.fillStyle = lin(c, 0, 12, 0, 28, ['#c8c0b0', '#8a8070']); c.fillRect(5, 12, 22, 16);
    c.fillStyle = '#3a3a44'; c.fillRect(13, 9, 6, 3);
    c.fillStyle = '#a01820'; c.fillRect(14, 15, 4, 10); c.fillRect(11, 18, 10, 4);
  });
}
function cartridges() {
  return sculpt(32, 32, c => { for (let i = 0; i < 3; i++) { c.fillStyle = '#b8b8c8'; c.fillRect(8 + i * 6, 10, 4, 16); ell(c, 10 + i * 6, 10, 2, 3, '#e8e8f0'); } });
}

// ------------------------------------------------------------------------------------------------------------ decor
function grave() {
  return sculpt(48, 48, c => {
    poly(c, [12, 47, 12, 16, 24, 8, 36, 16, 36, 47], lin(c, 12, 0, 36, 0, ['#4a4a5e', '#2a2a3a']));
    c.fillStyle = '#1a1a26'; c.fillRect(18, 22, 12, 2); c.fillRect(23, 17, 2, 12);
    for (let i = 0; i < 6; i++) poly(c, [10 + i * 5, 48, 12 + i * 5, 40 + (i % 3) * 2, 14 + i * 5, 48], '#1c2a22');
  });
}
function stump() {
  return sculpt(48, 48, c => {
    poly(c, [12, 47, 16, 26, 14, 14, 20, 22, 24, 10, 28, 22, 34, 16, 32, 28, 36, 47], lin(c, 12, 0, 36, 0, ['#1a1420', '#3a3044', '#1a1420']));
    curve(c, [16, 26, 6, 20, 4, 10], '#2a2232', 2); curve(c, [32, 28, 42, 22, 44, 14], '#2a2232', 2);
  });
}
function bones() {
  return sculpt(32, 32, c => {
    ell(c, 12, 22, 6, 5, '#d8d0b8'); ell(c, 10, 22, 1.5, 1.5, '#100808'); ell(c, 14, 22, 1.5, 1.5, '#100808');
    stroke(c, [16, 28, 28, 24], '#c8c0a8', 2); stroke(c, [4, 29, 18, 30], '#c8c0a8', 2);
  });
}
function candles() {
  return sculpt(32, 64, c => {
    c.fillStyle = '#5a3a18'; c.fillRect(15, 20, 2, 44); c.fillRect(8, 60, 16, 3); c.fillRect(6, 20, 20, 2);
    for (const x of [6, 15, 24]) { c.fillStyle = '#d8d0c0'; c.fillRect(x, 12, 3, 8); }
  }, c => { for (const x of [7.5, 16.5, 25.5]) { ell(c, x, 9, 1.8, 3, '#ffb040'); ell(c, x, 10, 0.8, 1.5, '#fff0c0'); } });
}
function armchair() {
  return sculpt(48, 48, c => {
    c.fillStyle = lin(c, 0, 8, 0, 46, ['#5a1a2a', '#2a0a14']); c.fillRect(10, 8, 28, 26);
    c.fillStyle = '#4a1422'; c.fillRect(6, 24, 36, 14); c.fillStyle = '#6a2232'; c.fillRect(6, 22, 7, 16); c.fillRect(35, 22, 7, 16);
    c.fillStyle = '#2a160a'; c.fillRect(8, 38, 3, 9); c.fillRect(37, 38, 3, 9);
  });
}
function clock() {
  return sculpt(32, 64, c => {
    c.fillStyle = lin(c, 8, 0, 24, 0, ['#2a160a', '#4a2a14', '#2a160a']); c.fillRect(8, 4, 16, 60);
    ell(c, 16, 14, 6, 6, '#c8c0a8'); stroke(c, [16, 14, 16, 10], '#100808', 1); stroke(c, [16, 14, 19, 15], '#100808', 1);
    c.fillStyle = '#100808'; c.fillRect(12, 26, 8, 28); ell(c, 16, 46, 3, 3, '#c89a3a');
  });
}
function brazier() {
  return sculpt(32, 64, c => {
    c.fillStyle = '#2a2a34'; c.fillRect(15, 34, 3, 30); c.fillRect(9, 61, 15, 3);
    poly(c, [6, 26, 26, 26, 22, 36, 10, 36], '#3a3a46');
  }, c => { poly(c, [8, 27, 12, 12, 15, 20, 17, 6, 20, 18, 22, 14, 24, 27], '#ff7020'); poly(c, [11, 27, 14, 18, 17, 22, 19, 14, 21, 27], '#ffd060'); });
}

/** Build every sprite. Called once at start-up. */
export function buildSprites() {
  return {
    ghoul: { img: ghoul(), h: 0.82 }, hound: { img: hound(), h: 0.72 }, cultist: { img: cultist(), h: 0.86 },
    shade: { img: shade(), h: 0.9 }, servant: { img: servant(), h: 0.88 }, drowned: { img: drowned(), h: 0.9 },
    mass: { img: mass(), h: 0.75 }, priest: { img: priest(), h: 0.92 },
    stag: { img: stag(), h: 1.35 }, widow: { img: widow(), h: 1.3 }, waiter: { img: waiter(), h: 1.2 },
    chest: { img: chest(false), h: 0.42 }, chestOpen: { img: chest(true), h: 0.42 },
    keyBrass: { img: key('#e0b040'), h: 0.2 }, keyBone: { img: key('#e8e0cc'), h: 0.2 },
    bullets: { img: ammo(), h: 0.28 }, medkit: { img: medkit(), h: 0.28 }, cartridges: { img: cartridges(), h: 0.28 },
    grave: { img: grave(), h: 0.55 }, stump: { img: stump(), h: 0.6 }, bones: { img: bones(), h: 0.25 },
    candles: { img: candles(), h: 0.75, light: [1.0, 0.6, 0.25] }, armchair: { img: armchair(), h: 0.5 }, clock: { img: clock(), h: 0.95 },
    brazier: { img: brazier(), h: 0.7, light: [1.1, 0.5, 0.18] },
  };
}
