// The game screen: a 240-pixel-wide canvas with the first-person view on top, the slot machine in the middle and the
// controls below, presented through the CRT. Immediate-mode drawing and buttons; an async flow plays spins and turns.

import * as M from '../slot/machine.js';
import * as S from '../slot/session.js';
import { gameRng, hashStr } from '../rng.js';
import * as G from '../world/game.js';
import { T, DIRS, isDoorTile } from '../world/maze.js';
import { REALMS, ENEMIES, WEAPONS, THEME, KEY_NAMES } from '../world/data.js';
import { createView, buildLightMap } from '../gfx/raycast.js';
import { realmTextures, skyPanorama } from '../gfx/textures.js';
import { buildSprites } from '../gfx/sprites.js';
import { buildSymbols, buildWeapons, flash as flashImg } from '../gfx/icons.js';
import { toCanvas, rgb } from '../gfx/paint.js';
import { createPresenter } from '../gfx/crt.js';
import { initText, text, textWidth, wrap } from './text.js';
import { createAudio } from '../audio/engine.js';
import '../audio/extra.js';
import { openInfo } from './info.js';
import { DEMO_BALANCE } from '../config.js';

const VW = 240;
let VH = 150;
const GOLD = '#f0b648', INK = '#06050a', DIM = '#a99cc6', TEXT = '#f3e6c9', RED = '#ff4a3a', GREEN = '#7ee07a';
const CELL_W = 34, CELL_H = 30, REEL_GAP = 2;
const fmt = n => Math.round(n).toLocaleString('en-US');
const wait = ms => new Promise(r => setTimeout(r, ms));
const ease = t => 1 - (1 - t) * (1 - t);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function startApp() {
  const out = document.getElementById('game');
  const P = createPresenter(out);
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  let H = 440;

  initText();
  const SYM = Object.fromEntries(Object.entries(buildSymbols()).map(([k, v]) => [k, toCanvas(v)]));
  const SPR = buildSprites();
  const FP = Object.fromEntries(Object.entries(buildWeapons()).map(([k, v]) => [k, toCanvas(v)]));
  const FLASH = toCanvas(flashImg());
  const SKY = skyPanorama();
  let view = createView(VW, VH), vimg = new ImageData(VW, VH), v32 = new Uint32Array(vimg.data.buffer);
  const audio = createAudio();
  const grng = gameRng();

  // ------------------------------------------------------------------------------------------------ persistent state
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem('oahunter.' + k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem('oahunter.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  let wallet = store.get('wallet') || S.newWallet(DEMO_BALANCE);
  const settings = Object.assign({ sound: true, music: 0.5, crt: true }, store.get('settings') || {});
  let run = null, scene = 'title', pendingRound = store.get('round');
  const saveWallet = () => store.set('wallet', wallet);
  function saveRun() {
    if (!run || !run.level) return store.set('run', null);
    const L = run.level;
    store.set('run', { ...run, level: null, L: { player: L.player, enemies: L.enemies.map(e => ({ ...e, fx: undefined })), chests: L.chests, pickups: L.pickups, doors: L.doors, keys: L.keys, seen: Array.from(L.seen).join(''), rng: L.rng } });
  }
  function loadRun() {
    const s = store.get('run'); if (!s || s.over) return null;
    const r = { ...s }; delete r.L;
    G.enterRealm(r);
    const L = r.level;
    Object.assign(L, { player: s.L.player, enemies: s.L.enemies.map(e => ({ ...e, fx: { hurt: 0, atk: 0, die: 0 } })), chests: s.L.chests, pickups: s.L.pickups, doors: s.L.doors, keys: s.L.keys, rng: s.L.rng });
    L.seen = Uint8Array.from(s.L.seen.split(''), Number); r.ward = s.ward;
    return r;
  }
  run = loadRun();

  // ------------------------------------------------------------------------------------------------ realm graphics
  let RG = null;   // { tex, lm, lmS, ambient, fog, fogDist }
  const doorShown = {};
  function setupRealm() {
    const L = run.level, realm = L.realm;
    const tex = realmTextures(realm.id);
    const sources = [];
    for (const d of L.decos) { const s = SPR[d.kind]; if (s && s.light) sources.push({ x: d.x + 0.5, y: d.y + 0.5, c: s.light, r: 3.2 }); }
    sources.push({ x: L.exit.x + 0.5, y: L.exit.y + 0.5, c: [1.1, 0.15, 0.1], r: 3, tile: [L.exit.x, L.exit.y] });
    const opaque = (x, y) => { const t = G.tileAt(L, x, y); return t === T.WALL || t === T.EXIT || isDoorTile(t); };
    const { lm, lmS } = buildLightMap(L, sources, opaque);
    const amb = { forest: [0.34, 0.32, 0.5], mansion: [0.2, 0.13, 0.22], crypt: [0.11, 0.08, 0.12] }[realm.id];
    RG = { tex, lm, lmS, ambient: amb, fog: realm.fog, fogDist: realm.fogDist };
    for (const k in doorShown) delete doorShown[k];
    for (const k in L.doors) doorShown[k] = L.doors[k];
    cam.x = L.player.x + 0.5; cam.y = L.player.y + 0.5; cam.ang = L.player.dir * Math.PI / 2; cam.ta = cam.ang;
    anim.clear();
  }

  // ------------------------------------------------------------------------------------------------ animation state
  const cam = { x: 0, y: 0, ang: 0, ta: 0, fx: 0, fy: 0, tx: 0, ty: 0, t: 1, bob: 0 };
  const anim = new Map();      // enemy id -> { x, y, hurt, atk, die, wake }
  const floats = [];           // { wx, wy, text, col, t } in the world, or { hud: true, ... }
  const msgs = [];             // { text, col, t }
  const fx = { shake: 0, flash: 0, red: 0, green: 0, purple: 0, recoil: 0, swing: 0, muzzle: 0, banner: null, bannerT: 0 };
  let busy = false, queued = null, bigMap = false, now = performance.now(), held = null;
  const say = (t, col = TEXT) => { msgs.push({ text: t, col, t: now }); if (msgs.length > 4) msgs.shift(); };
  const sfx = (n, o) => audio.play(n, o);

  // slot display
  const reels = Array.from({ length: 5 }, (_, c) => ({ pos: wallet.stops[c], spinning: false, stopAt: 0, bounce: 0 }));
  let hiddenWin = 0, shownGrid = null, wins = [], winFlash = 0, rowHits = [], hold = null, winShown = 0, winTarget = 0, roundTag = '', lastRes = null;

  // ------------------------------------------------------------------------------------------------ layout
  function layout() {
    const r = out.getBoundingClientRect();
    H = clamp(Math.round(VW * r.height / Math.max(1, r.width)), 400, 520);
    if (cv.height !== H) { cv.width = VW; cv.height = H; }
    const vh = clamp(H - 222, 150, 206);
    if (vh !== VH) { VH = vh; view = createView(VW, VH); vimg = new ImageData(VW, VH); v32 = new Uint32Array(vimg.data.buffer); }
    P.resize(VW, H);
  }
  const Lay = () => {
    const slotY = VH + 16, slotH = CELL_H * 3 + 6, infoY = slotY + slotH + 2, ctrlY = infoY + 13;
    return { slotY, slotH, infoY, ctrlY, ctrlH: H - ctrlY - 4 };
  };

  // ------------------------------------------------------------------------------------------------ buttons
  let btns = [];
  const button = (x, y, w, h, label, fn, o = {}) => {
    const on = o.enabled !== false, down = held && held.x >= x && held.x < x + w && held.y >= y && held.y < y + h && on;
    ctx.fillStyle = on ? (o.hot ? (down ? '#7a2a1a' : '#5a1e14') : (down ? '#3e3060' : '#241a36')) : '#16111f'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = on ? (o.hot ? '#c0582a' : '#5a4a7e') : '#2a2238'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = '#07040b'; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
    const col = on ? (o.hot ? '#ffe0b0' : TEXT) : '#5a5070';
    if (o.icon) o.icon(x + w / 2, y + h / 2 + (down ? 1 : 0), col);
    if (label) {
      const lines = String(label).split('\n'), lh = 9, y0 = y + h / 2 - lines.length * lh / 2 + 1 + (o.icon ? 8 : 0) + (down ? 1 : 0);
      lines.forEach((ln, i) => text(ctx, ln, x + w / 2, y0 + i * lh, col, { align: 'center' }));
    }
    btns.push({ x, y, w, h, fn, on, repeat: o.repeat });
  };
  const arrow = (dir, size = 5) => (cx, cy, col) => {
    ctx.fillStyle = col; ctx.beginPath();
    const p = [[size, 0], [-size, -size], [-size, size]], a = dir * Math.PI / 2;
    p.forEach(([px, py], i) => { const x = cx + px * Math.cos(a) - py * Math.sin(a), y = cy - 4 + px * Math.sin(a) + py * Math.cos(a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.fill();
  };
  const turnIcon = d => (cx, cy, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy - 2, 6, d < 0 ? -0.2 : Math.PI + 0.2, d < 0 ? Math.PI * 1.1 : -Math.PI * 0.1, d > 0); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); const x = cx + (d < 0 ? -6 : 6), y = cy - 1; ctx.moveTo(x - 3, y - 2); ctx.lineTo(x + 3, y - 2); ctx.lineTo(x, y + 3); ctx.fill();
  };

  // ------------------------------------------------------------------------------------------------ input
  const toVirtual = e => { const r = out.getBoundingClientRect(), k = out.width / r.width, v = P.view; return { x: ((e.clientX - r.left) * k - v.x) / v.w * VW, y: ((e.clientY - r.top) * k - v.y) / v.h * H }; };
  let repeatTimer = null;
  out.addEventListener('pointerdown', e => {
    e.preventDefault(); audio.unlock();
    const p = toVirtual(e); held = p;
    if (scene !== 'play') return tapScene();
    const b = btns.find(b => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h);
    if (b && b.on) {
      b.fn();
      if (b.repeat) { clearInterval(repeatTimer); repeatTimer = setInterval(() => { if (held) b.fn(); }, 230); }
    }
  });
  const release = () => { held = null; clearInterval(repeatTimer); };
  out.addEventListener('pointerup', release); out.addEventListener('pointercancel', release); out.addEventListener('pointerleave', release);
  window.addEventListener('keydown', e => {
    if (document.querySelector('.overlay:not([hidden])')) return;
    audio.unlock();
    if (scene !== 'play') { if (e.key === 'Enter' || e.key === ' ') tapScene(); return; }
    const k = e.key.toLowerCase(), map = {
      arrowup: () => act('fwd'), w: () => act('fwd'), arrowdown: () => act('back'), s: () => act('back'),
      arrowleft: () => act('left'), q: () => act('left'), arrowright: () => act('right'), e: () => act('right'),
      a: () => act('sleft'), d: () => act('sright'), ' ': () => act('action'), enter: () => act('action'),
      h: () => act('medkit'), f: () => act('sign'), r: () => act('weapon'), tab: () => act('weapon'), m: () => { bigMap = !bigMap; },
      '+': () => bet(1), '=': () => bet(1), '-': () => bet(-1),
    };
    if (map[k]) { e.preventDefault(); map[k](); }
  });

  function tapScene() {
    if (scene === 'title') {
      if (!audio.ready) audio.unlock();
      sfx('power');
      if (!run) { run = G.newRun((Date.now() ^ (grng.u32() & 0xffff)) >>> 0); G.enterRealm(run); scene = 'intro'; }
      else scene = 'play';
      setupRealm(); saveRun();
      if (scene === 'play') resumeRound();
    } else if (scene === 'intro') { scene = 'play'; sfx('select'); say(run.level.realm.name, GOLD); }
    else if (scene === 'dead' || scene === 'won') { run = null; store.set('run', null); scene = 'title'; }
  }

  // ------------------------------------------------------------------------------------------------ actions
  function bet(d) {
    if (busy || S.inFreeSpins(wallet)) return;
    const i = M.BET_LEVELS.indexOf(wallet.bet), j = clamp(i + d, 0, M.BET_LEVELS.length - 1);
    if (S.setBet(wallet, M.BET_LEVELS[j])) { sfx('click'); saveWallet(); }
  }
  function act(a) {
    if (scene !== 'play' || run.over) return;
    if (busy || cam.t < 1) { if (['fwd', 'back', 'left', 'right', 'sleft', 'sright'].includes(a)) queued = a; return; }
    const L = run.level;
    if (a === 'left' || a === 'right') { G.turn(run, a === 'left' ? -1 : 1); cam.ta += (a === 'left' ? -1 : 1) * Math.PI / 2; cam.ts = now; cam.as = cam.ang; return; }
    if (['fwd', 'back', 'sleft', 'sright'].includes(a)) {
      const rel = { fwd: 0, sright: 1, back: 2, sleft: 3 }[a], fx0 = L.player.x, fy0 = L.player.y;
      const r = G.step(run, rel);
      if (L.player.x !== fx0 || L.player.y !== fy0) { cam.fx = cam.x; cam.fy = cam.y; cam.t = 0; sfx('step', { vol: 0.35, rate: 0.9 + Math.random() * 0.2 }); }
      return runEvents(r.ev);
    }
    if (a === 'medkit') return runEvents(G.useMedkit(run).ev);
    if (a === 'sign') return runEvents(G.castSign(run).ev);
    if (a === 'weapon') { const w = G.cycleWeapon(run); sfx('click2'); say(WEAPONS[w].name, DIM); fx.swing = 0.01; return; }
    if (a === 'action') {
      const c = G.chestAhead(run);
      if (c) return spinRound('chest', null, c);
      const t = G.attackTarget(run);
      if (t.enemy) return spinRound('attack', t.enemy, null);
      sfx('error'); say(t.why, DIM);
    }
  }

  async function runEvents(ev, fromSpin) {
    busy = true;
    for (const e of ev) await playEvent(e);
    busy = false;
    afterTurn();
  }
  function afterTurn() {
    saveRun();
    if (run.over && !run.won) { setTimeout(() => { scene = 'dead'; sfx('heroDie'); }, 900); return; }
    if (queued) { const q = queued; queued = null; act(q); }
  }

  async function playEvent(e) {
    const L = run.level;
    switch (e.type) {
      case 'msg': say(e.text, DIM); break;
      case 'sfx': sfx(e.name); break;
      case 'bump': sfx('bump', { vol: 0.5 }); fx.shake = Math.max(fx.shake, 1.5); break;
      case 'move': break;
      case 'door': sfx('door'); { const k = e.y * L.w + e.x; doorShown[k] = 0.001; } if (G.tileAt(L, e.x, e.y) !== T.DOOR) sfx('unlock', { delay: 0 }); await wait(160); break;
      case 'loot': say(e.text, GREEN); sfx(e.sfx || 'coin'); await wait(250); break;
      case 'key': say(e.text, GOLD); sfx('unlock'); sfx('winSmall', { delay: 0.1 }); floatHud(e.text, GOLD); await wait(400); break;
      case 'weapon': say(e.text, GOLD); sfx('winBig'); await wait(500); break;
      case 'heal': fx.green = 1; sfx('heal'); floatHud('+' + e.n, GREEN); break;
      case 'wake': { const a = A(e.enemy); a.wake = 1; if (ENEMIES[e.enemy.type].boss) { say(`${ENEMIES[e.enemy.type].name} awakens.`, RED); sfx('growl', { vol: 0.9 }); } else sfx('growl', { vol: 0.4, rate: 1.2 + (e.enemy.id % 5) * 0.08 }); break; }
      case 'stunned': floatAt(e.enemy, 'STUNNED', '#c8a0ff'); break;
      case 'sign': fx.purple = 1; sfx('curse'); say('You trace the Sign of Banishing.', '#c8a0ff'); await wait(250); break;
      case 'hurt': { const a = A(e.enemy); a.hurt = 1; floatAt(e.enemy, '-' + e.n, e.n >= 20 ? GOLD : TEXT); sfx(e.n >= 20 ? 'heavy' : 'hit'); await wait(120); break; }
      case 'miss': floatAt(e.enemy, 'MISS', DIM); break;
      case 'kill': { const a = A(e.enemy); a.die = 0.001; say(e.text, GOLD); sfx('die'); await wait(300); break; }
      case 'enemyAtk': {
        const a = A(e.enemy); a.atk = 1; await wait(e.ranged ? 120 : 160);
        if (e.ranged) sfx('gun', { vol: 0.5, rate: 0.8 });
        if (!e.hit) { sfx('slash', { vol: 0.4 }); say(`The ${ENEMIES[e.enemy.type].name.toLowerCase()} misses.`, DIM); }
        else {
          if (e.blocked || e.warded) { sfx('block'); }
          if (e.dmg) { sfx('hurt'); fx.red = Math.min(1, 0.4 + e.dmg / 12); fx.shake = 3 + e.dmg * 0.4; floatHud('-' + e.dmg, RED); }
          const parts = [];
          if (e.blocked) parts.push(`${e.blocked} blocked`); if (e.warded) parts.push(`${e.warded} warded`);
          say(`${ENEMIES[e.enemy.type].name} hits for ${e.dmg}${parts.length ? ' (' + parts.join(', ') + ')' : ''}.`, e.dmg ? RED : DIM);
        }
        await wait(260); break;
      }
      case 'strike': break;
      case 'death': say('You have died.', RED); break;
      case 'exit': {
        sfx('special'); busy = true; fx.flash = 1; await wait(600);
        if (!G.nextRealm(run)) { scene = 'won'; sfx('jackpot'); saveRun(); break; }
        setupRealm(); scene = 'intro'; saveRun(); break;
      }
    }
  }
  const A = e => { let a = anim.get(e.id); if (!a) { a = { x: e.x + 0.5, y: e.y + 0.5, hurt: 0, atk: 0, die: 0, wake: 0 }; anim.set(e.id, a); } return a; };
  const floatAt = (e, t, col) => floats.push({ wx: e.x + 0.5, wy: e.y + 0.5, text: t, col, t: now });
  const floatHud = (t, col) => floats.push({ hud: true, text: t, col, t: now });

  // ------------------------------------------------------------------------------------------------ spins
  async function spinRound(mode, target, chest) {
    if (!S.inFreeSpins(wallet) && !S.canAfford(wallet, wallet.bet)) { sfx('error'); say('Not enough credits. Lower the bet or refill.', RED); return; }
    busy = true;
    let tgt = target, first = true;
    roundTag = mode;
    do {
      if (mode === 'attack' && S.inFreeSpins(wallet)) tgt = G.freeSpinTarget(run, tgt);
      const res = S.playSpin(wallet, grng);
      if (!res) break;
      pendingRound = { mode, chest: chest ? [chest.x, chest.y] : null, target: tgt ? tgt.id : null, first, res };
      saveWallet(); store.set('round', pendingRound);
      hiddenWin += res.win;          // shown only once the reels have revealed it
      if (mode === 'attack') weaponFire(res.kind === 'spin');
      await showSpin(res);
      applyRound(pendingRound);
      hiddenWin = 0; winTarget = res.roundWin; if (res.win) countWin(res);
      await runEventsInline(pendingRound.ev);
      pendingRound = null; store.set('round', S.inFreeSpins(wallet) ? { mode, chest: chest ? [chest.x, chest.y] : null, free: true } : null);
      first = false;
      if (S.inFreeSpins(wallet)) { fx.banner = `FREE SPIN ${wallet.free.played + 1} OF ${wallet.free.played + wallet.free.left}`; fx.bannerT = now; await wait(550); }
    } while (S.inFreeSpins(wallet) && !run.over);
    roundTag = '';
    busy = false;
    afterTurn();
  }
  function applyRound(pr) {
    const L = run.level;
    let out;
    if (pr.mode === 'attack') out = G.resolveAttack(run, pr.res, L.enemies.find(e => e.id === pr.target && !e.dead) || null);
    else out = G.resolveChest(run, pr.res, G.chestAt(L, pr.chest[0], pr.chest[1]), pr.first);
    pr.ev = out.ev; pr.fx = out.fx;
    if (out.fx) rowHits = out.fx.row.map(r => ({ c: r.c, text: r.dmg ? '+' + r.dmg : 'W' + r.block, col: r.dmg ? TEXT : '#9ad0ff' }));
    else rowHits = [];
    saveRun(); store.set('round', null);
  }
  async function runEventsInline(ev) { for (const e of ev) await playEvent(e); }
  /** Finish a round the page was closed in the middle of: apply a settled spin, then play out free spins. */
  function resumeRound() {
    const pr = store.get('round');
    if (pr && pr.res) { applyRound(pr); store.set('round', S.inFreeSpins(wallet) ? { mode: pr.mode, chest: pr.chest, free: true } : null); }
    if (S.inFreeSpins(wallet)) {
      const r = store.get('round') || { mode: 'attack' };
      say('Finishing your free spins.', GOLD);
      setTimeout(() => spinRound(r.mode, null, r.chest ? G.chestAt(run.level, r.chest[0], r.chest[1]) : null), 600);
    }
  }
  function countWin(res) {
    const big = res.win >= res.bet * 10;
    if (res.win > res.bet) sfx(big ? 'winBig' : 'winSmall');
    else sfx('coin', { vol: 0.4 });
  }

  async function showSpin(res) {
    const o = res.outcome;
    lastRes = res; hold = null; wins = []; rowHits = []; winShown = res.kind === 'free' ? winShown : 0;
    shownGrid = null;
    const t0 = performance.now();
    reels.forEach((r, c) => { r.spinning = true; r.stopAt = t0 + 420 + c * 140; r.target = o.stops[c]; });
    sfx('tick');
    await wait(420 + 4 * 140 + 120);
    // wilds expand
    shownGrid = o.raw;
    if (o.expanded.length) { await wait(120); sfx('wild'); shownGrid = o.grid; await wait(380); }
    else shownGrid = o.grid;
    if (o.scatters >= 3) { sfx('scatter'); }
    wins = o.wins; winFlash = now;
    if (o.wins.some(w => w.sym === 'crown')) sfx('crit', { delay: 0.05 });
    if (res.hold) await showHold(res);
    if (res.freeAward) { sfx('freeSpins'); fx.banner = `BLOOD MOON  +${res.freeAward} FREE SPINS`; fx.bannerT = now; await wait(900); }
    await wait(o.wins.length ? 380 : 120);
  }
  async function showHold(res) {
    const h = res.hold, cells = h.cells.map(r => r.map(() => null));
    hold = { cells, total: 0, full: false, bet: res.bet };
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) if (h.start[r][c]) cells[r][c] = h.cells[r][c];
    sfx('holdLand'); fx.banner = 'SILVER BULLETS! HOLD & SPIN'; fx.bannerT = now;
    await wait(900);
    // replay the respins
    const order = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) if (h.cells[r][c] && !h.start[r][c]) order.push([r, c]);
    let k = 0;
    for (const st of h.steps) {
      await wait(450);
      for (const [r, c] of st.landed) { cells[r][c] = h.cells[r][c]; sfx('holdLand', { rate: 1 + k * 0.03 }); k++; }
    }
    hold.full = h.full; hold.total = h.total10 * res.bet / 10;
    if (h.full) sfx('jackpot');
    await wait(900);
    hold = null;
  }

  function weaponFire(paid) {
    const w = run.weapon;
    if (w === 'sabre') { fx.swing = 1; sfx('slash'); }
    else { fx.recoil = 1; fx.muzzle = 1; fx.flash = 0.6; sfx(w === 'rifle' ? 'rifle' : 'gun'); }
  }

  // ------------------------------------------------------------------------------------------------ frame
  let last = performance.now();
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000); last = t; now = t;
    layout();
    btns = [];
    ctx.fillStyle = INK; ctx.fillRect(0, 0, VW, H);
    if (scene === 'title') drawTitle();
    else { update(dt); drawPlay(); if (scene === 'intro') drawIntro(); if (scene === 'dead' || scene === 'won') drawEnd(); }
    P.crt = settings.crt;
    P.present(cv, { shake: fx.shake > 0.05 ? [(Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake] : null });
  }

  function update(dt) {
    const L = run.level;
    // camera
    const tx = L.player.x + 0.5, ty = L.player.y + 0.5;
    if (cam.t < 1) { cam.t = Math.min(1, cam.t + dt / 0.16); const k = ease(cam.t); cam.x = cam.fx + (tx - cam.fx) * k; cam.y = cam.fy + (ty - cam.fy) * k; cam.bob = Math.sin(cam.t * Math.PI) * 2; }
    else { cam.x = tx; cam.y = ty; cam.bob = 0; if (queued && !busy) { const q = queued; queued = null; act(q); } }
    if (cam.ang !== cam.ta) { const k = Math.min(1, (now - cam.ts) / 150); cam.ang = cam.as + (cam.ta - cam.as) * ease(k); if (k >= 1) cam.ang = cam.ta; }
    // doors slide
    for (const k in L.doors) { const target = L.doors[k] > 0 ? 1 : 0; doorShown[k] = doorShown[k] === undefined ? L.doors[k] : Math.min(target, doorShown[k] + dt * 3); }
    // enemies glide
    for (const e of L.enemies) {
      const a = A(e), k = Math.min(1, dt * 10);
      a.x += (e.x + 0.5 - a.x) * k; a.y += (e.y + 0.5 - a.y) * k;
      a.hurt = Math.max(0, a.hurt - dt * 4); a.atk = Math.max(0, a.atk - dt * 3); a.wake = Math.max(0, a.wake - dt * 1.2);
      if (a.die > 0) a.die = Math.min(1, a.die + dt * 1.6);
    }
    // reels
    for (const r of reels) {
      if (r.spinning) { r.pos -= dt * 22; if (now >= r.stopAt) { r.spinning = false; r.pos = r.target; r.bounce = 1; sfx('reelStop', { vol: 0.5 }); } }
      r.bounce = Math.max(0, r.bounce - dt * 6);
    }
    if (winShown < winTarget) winShown = Math.min(winTarget, winShown + Math.max(1, winTarget * dt * 1.5));
    for (const k of ['shake']) fx[k] = Math.max(0, fx[k] - dt * 14);
    for (const k of ['flash', 'red', 'green', 'purple', 'recoil', 'muzzle']) fx[k] = Math.max(0, fx[k] - dt * 3.5);
    if (fx.swing > 0) fx.swing = Math.max(0, fx.swing - dt * 3);
    // music
    if (audio.ready) {
      const awake = L.enemies.filter(e => !e.dead && e.awake && Math.abs(e.x - L.player.x) + Math.abs(e.y - L.player.y) < 9);
      const kind = S.inFreeSpins(wallet) || roundTag && wallet.free ? 'free' : awake.some(e => ENEMIES[e.type].boss) ? 'boss' : awake.length ? 'fight' : L.realm.music;
      audio.musicVol = settings.music; audio.muted = !settings.sound; audio.apply(); audio.music(kind, hashStr(L.realm.id) % 97 + 1);
    }
  }

  // ------------------------------------------------------------------------------------------------ drawing: play
  function drawPlay() {
    const L = run.level;
    drawView(L);
    drawStatus(L);
    drawSlot();
    drawControls(L);
  }

  function drawView(L) {
    const sprites = [];
    for (const d of L.decos) { const s = SPR[d.kind]; sprites.push({ x: d.x + 0.5, y: d.y + 0.5, img: s.img, h: s.h, bright: s.light ? 0.6 : 0 }); }
    for (const c of L.chests) { const s = c.open ? SPR.chestOpen : SPR.chest; sprites.push({ x: c.x + 0.5, y: c.y + 0.5, img: s.img, h: s.h }); }
    for (const p of L.pickups) { const s = SPR[{ brass: 'keyBrass', bone: 'keyBone' }[p.kind] || p.kind] || SPR.bullets; sprites.push({ x: p.x + 0.5, y: p.y + 0.5, img: s.img, h: s.h, lift: 0.05 + Math.sin(now / 300 + p.x) * 0.03, bright: 0.25 }); }
    for (const e of L.enemies) {
      const a = A(e); if (e.dead && a.die >= 1) continue;
      const D = ENEMIES[e.type], s = SPR[D.look];
      const lunge = a.atk > 0 ? Math.sin(a.atk * Math.PI) * 0.12 : 0;
      const toward = Math.hypot(cam.x - a.x, cam.y - a.y) || 1;
      sprites.push({
        x: a.x + (cam.x - a.x) / toward * lunge, y: a.y + (cam.y - a.y) / toward * lunge, img: s.img, h: s.h * (1 + lunge * 0.4),
        lift: e.dead ? -a.die * 0.25 : Math.sin(now / 420 + e.id) * 0.012, alpha: e.dead ? 1 - a.die : (D.look === 'shade' ? 0.75 : 1),
        tint: a.hurt > 0.4 ? (c => rgb(255, 230, 220, c >>> 24)) : e.dead ? (c => rgb((c & 255) * 0.6 + 80, ((c >>> 8) & 255) * 0.4, ((c >>> 16) & 255) * 0.4, c >>> 24)) : null,
        dx: a.hurt > 0 ? Math.sin(now / 20) * a.hurt * 0.03 : 0,
      });
    }
    view.render({
      L, tex: RG.tex, sky: SKY, lm: RG.lm, lmS: RG.lmS, cam, ambient: RG.ambient, lantern: [1.05, 0.82, 0.58], fog: RG.fog, fogDist: RG.fogDist,
      sprites, doorAnim: k => doorShown[k] ?? L.doors[k] ?? 0, flash: fx.flash,
    });
    v32.set(view.buf); ctx.putImageData(vimg, 0, 0);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip();
    // the hunter's weapon
    const img = FP[run.weapon], bob = Math.sin(now / 500) * 1.5 + (cam.t < 1 ? Math.abs(Math.sin(cam.t * Math.PI)) * 3 : 0);
    let wx = VW / 2 - 20, wy = VH - img.height + 8 + bob + fx.recoil * 10;
    if (run.weapon === 'sabre' && fx.swing > 0) { const k = fx.swing; wx -= Math.sin(k * Math.PI) * 50; wy -= Math.sin(k * Math.PI) * 18; }
    if (fx.muzzle > 0.3) ctx.drawImage(FLASH, VW / 2 - 26, VH - 104 + fx.recoil * 4, 52, 52);
    ctx.drawImage(img, Math.round(wx), Math.round(wy));
    // tints
    const tint = (col, a) => { if (a > 0.01) { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; } };
    tint('#ff1010', fx.red * 0.45); tint('#40ff60', fx.green * 0.18); tint('#9040ff', fx.purple * 0.35);
    if (run.hp / run.maxHp < 0.3) tint('#600000', 0.15 + Math.sin(now / 250) * 0.08);
    // floating numbers over enemies
    const dirX = Math.cos(cam.ang), dirY = Math.sin(cam.ang), plX = -dirY * 0.66, plY = dirX * 0.66, inv = 1 / (plX * dirY - dirX * plY);
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i], age = (now - f.t) / 1000;
      if (age > 1.1) { floats.splice(i, 1); continue; }
      if (f.hud) continue;
      const rx = f.wx - cam.x, ry = f.wy - cam.y, tx = inv * (dirY * rx - dirX * ry), ty = inv * (-plY * rx + plX * ry);
      if (ty < 0.2) continue;
      const sx = VW / 2 * (1 + tx / ty), sy = Math.max(14, VH / 2 - view.projH * 0.3 / ty) - age * 18;
      text(ctx, f.text, sx, sy, f.col, { align: 'center', scale: ty < 2 ? 2 : 1 });
    }
    // wake marks
    // messages
    let my = VH - 10;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i], age = (now - m.t) / 1000; if (age > 5) continue;
      for (const ln of wrap(m.text, 150).reverse()) { if (my < 60) break; ctx.globalAlpha = Math.min(1, 5 - age); text(ctx, ln, 3, my, m.col); my -= 9; }
      ctx.globalAlpha = 1;
    }
    drawMinimap(L);
    if (fx.banner && now - fx.bannerT < 1600) {
      const a = Math.min(1, (1600 - (now - fx.bannerT)) / 300);
      ctx.globalAlpha = a; ctx.fillStyle = 'rgba(6,5,10,0.75)'; ctx.fillRect(0, 34, VW, 18);
      text(ctx, fx.banner, VW / 2, 39, GOLD, { align: 'center' }); ctx.globalAlpha = 1;
    }
    if (bigMap) drawBigMap(L);
    ctx.restore();
    // a thin frame under the view
    ctx.fillStyle = '#2a1e3a'; ctx.fillRect(0, VH, VW, 1);
  }

  function mapColor(L, x, y) {
    const t = L.tiles[y * L.w + x];
    if (t === T.WALL) return '#231a33';
    if (t === T.EXIT) return '#ff3a30';
    if (t === T.DOOR) return G.doorOpen(L, x, y) ? '#6a4a2a' : '#a0682a';
    if (t === T.LOCK_BRASS) return G.doorOpen(L, x, y) ? '#6a5a2a' : '#f0c040';
    if (t === T.LOCK_BONE) return G.doorOpen(L, x, y) ? '#6a6a5a' : '#f0e8d8';
    return '#5c4e80';
  }
  function drawMinimap(L) {
    const s = 2, mw = L.w * s, x0 = VW - mw - 3, y0 = 3;
    ctx.fillStyle = 'rgba(6,5,10,0.72)'; ctx.fillRect(x0 - 2, y0 - 2, mw + 4, L.h * s + 4);
    ctx.strokeStyle = '#5a4a7e'; ctx.lineWidth = 1; ctx.strokeRect(x0 - 2.5, y0 - 2.5, mw + 5, L.h * s + 5);
    btns.push({ x: x0 - 2, y: y0 - 2, w: mw + 4, h: L.h * s + 4, fn: () => { bigMap = !bigMap; sfx('click'); }, on: true });
    plotMap(L, x0, y0, s);
  }
  function drawBigMap(L) {
    const s = Math.floor(Math.min(VW - 20, VH - 20) / L.w), mw = L.w * s, x0 = (VW - mw) >> 1, y0 = (VH - L.h * s) >> 1;
    ctx.fillStyle = 'rgba(6,5,10,0.92)'; ctx.fillRect(0, 0, VW, VH);
    plotMap(L, x0, y0, s);
    text(ctx, L.realm.name, 4, 4, GOLD);
    const keys = Object.keys(L.keys).map(k => KEY_NAMES[k]).join(', ');
    text(ctx, keys ? 'KEYS: ' + keys : 'NO KEYS YET', 4, VH - 11, DIM);
    btns.push({ x: 0, y: 0, w: VW, h: VH, fn: () => { bigMap = false; sfx('click'); }, on: true });
  }
  function plotMap(L, x0, y0, s) {
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      if (!L.seen[y * L.w + x]) continue;
      ctx.fillStyle = mapColor(L, x, y); ctx.fillRect(x0 + x * s, y0 + y * s, s, s);
    }
    const dot = (x, y, col, k = 1) => { ctx.fillStyle = col; const d = Math.max(1, Math.floor(s * k)); ctx.fillRect(x0 + x * s + ((s - d) >> 1), y0 + y * s + ((s - d) >> 1), d, d); };
    for (const c of L.chests) if (L.seen[c.y * L.w + c.x]) dot(c.x, c.y, c.open ? '#5a4a2a' : '#e0a030', 0.8);
    for (const p of L.pickups) if (L.seen[p.y * L.w + p.x]) dot(p.x, p.y, '#60c060', 0.6);
    const p = L.player;
    for (const e of L.enemies) if (!e.dead && Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 9 && G.lineOfSight(L, p.x, p.y, e.x, e.y)) dot(e.x, e.y, (now / 300 | 0) % 2 ? '#ff3030' : '#a01010', 0.8);
    dot(p.x, p.y, '#ffffff', 1);
    const [dx, dy] = DIRS[p.dir]; ctx.fillStyle = GOLD;
    if (s >= 4) ctx.fillRect(x0 + p.x * s + s / 2 + dx * s / 2 - 1, y0 + p.y * s + s / 2 + dy * s / 2 - 1, 2, 2);
    else ctx.fillRect(x0 + (p.x + dx) * s, y0 + (p.y + dy) * s, s, s);
  }

  function drawStatus(L) {
    const y = VH + 2;
    // health bar
    const hw = 62, k = run.hp / run.maxHp;
    ctx.fillStyle = '#1a0a10'; ctx.fillRect(3, y, hw, 11);
    ctx.fillStyle = k < 0.3 ? '#c01818' : '#a02030'; ctx.fillRect(3, y, Math.round(hw * k), 11);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(3, y, Math.round(hw * k), 2);
    if (run.ward) { ctx.fillStyle = '#4a8ad0'; ctx.fillRect(3, y + 9, Math.min(hw, run.ward * 2), 2); }
    text(ctx, `♥${run.hp}/${run.maxHp}`, 6, y + 2, TEXT);
    let x = 70;
    const item = (label, col) => { x += text(ctx, label, x, y + 2, col) + 6; };
    const W = WEAPONS[run.weapon];
    item(run.weapon === 'sabre' ? 'SABRE' + (run.hone ? '+' + run.hone : '') : (run.weapon === 'rifle' ? 'RIFLE ' : 'REV ') + G.ammoOf(run), GOLD);
    if (run.weapon !== 'revolver') item('•' + run.bullets, DIM);
    if (run.weapons.rifle && run.weapon !== 'rifle') item('R' + run.cartridges, DIM);
    if (run.ward) item('W' + run.ward, '#9ad0ff');
    // keys
    let kx = VW - 3;
    for (const key of ['bone', 'brass']) if (L.keys[key]) { ctx.fillStyle = key === 'brass' ? '#e0b040' : '#e8e0cc'; kx -= 8; ctx.fillRect(kx, y + 3, 3, 5); ctx.fillRect(kx + 3, y + 5, 4, 1); }
    // hud floats
    let fy = 0;
    for (const f of floats) { if (!f.hud) continue; const age = (now - f.t) / 1000; text(ctx, f.text, 34, y - 10 - age * 14 - fy, f.col, { align: 'center' }); fy += 9; }
  }

  function drawSlot() {
    const { slotY, slotH, infoY } = Lay(), w5 = 5 * CELL_W + 4 * REEL_GAP, x0 = (VW - w5) >> 1;
    // cabinet
    ctx.fillStyle = '#1a1026'; ctx.fillRect(x0 - 5, slotY - 3, w5 + 10, slotH + 4);
    ctx.fillStyle = '#6a4a20'; ctx.fillRect(x0 - 5, slotY - 3, w5 + 10, 1); ctx.fillRect(x0 - 5, slotY + slotH, w5 + 10, 1);
    ctx.fillStyle = '#c89a3a'; ctx.fillRect(x0 - 4, slotY - 2, w5 + 8, 1); ctx.fillRect(x0 - 4, slotY + slotH - 1, w5 + 8, 1);
    const o = wallet.stops;
    for (let c = 0; c < 5; c++) {
      const rx = x0 + c * (CELL_W + REEL_GAP), ry = slotY;
      ctx.fillStyle = '#0c0912'; ctx.fillRect(rx, ry, CELL_W, CELL_H * 3);
      ctx.save(); ctx.beginPath(); ctx.rect(rx, ry, CELL_W, CELL_H * 3); ctx.clip();
      const r = reels[c], strip = M.STRIPS[c], n = strip.length;
      if (r.spinning || !shownGrid) {
        const base = Math.floor(r.pos), frac = r.pos - base;
        for (let k = -1; k <= 3; k++) {
          const sym = strip[(((base - 1 + k) % n) + n) % n], y = ry + (k - frac) * CELL_H + (r.spinning ? 0 : Math.sin(r.bounce * Math.PI) * 3);
          if (r.spinning) ctx.globalAlpha = 0.85;
          ctx.drawImage(SYM[sym], rx + 1, Math.round(y) - 1);
          ctx.globalAlpha = 1;
        }
      } else {
        for (let k = 0; k < 3; k++) {
          const sym = shownGrid[k][c], y = ry + k * CELL_H + Math.sin(r.bounce * Math.PI) * 3;
          const lit = wins.some(w => M.LINES[w.line][c] === k && c < w.n) || (k === 1 && rowHits.some(h => h.c === c));
          if (lit && (now - winFlash) % 500 < 250) { ctx.fillStyle = k === 1 && !wins.some(w => M.LINES[w.line][c] === k && c < w.n) ? '#2a1e10' : '#4a2e10'; ctx.fillRect(rx, y, CELL_W, CELL_H); }
          ctx.drawImage(SYM[sym], rx + 1, Math.round(y) - 1);
        }
      }
      ctx.restore();
    }
    // the attack row
    ctx.fillStyle = 'rgba(240,182,72,0.5)'; ctx.fillRect(x0 - 4, slotY + CELL_H, 2, CELL_H); ctx.fillRect(x0 + w5 + 2, slotY + CELL_H, 2, CELL_H);
    // win lines
    if (shownGrid && wins.length && !reels.some(r => r.spinning)) {
      const k = ((now - winFlash) / 900 | 0) % wins.length, wl = wins[k], ln = M.LINES[wl.line];
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath();
      for (let c = 0; c < wl.n; c++) { const px = x0 + c * (CELL_W + REEL_GAP) + CELL_W / 2, py = slotY + ln[c] * CELL_H + CELL_H / 2; c ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
      const lab = `${wl.n}× ${THEME[wl.sym].short}  ${fmt(wl.pay10 * lastRes.bet / 10 * (lastRes.kind === 'free' ? M.FREE_MULT : 1))}`;
      ctx.fillStyle = 'rgba(6,5,10,0.8)'; ctx.fillRect(VW / 2 - textWidth(lab) / 2 - 3, slotY + slotH - 11, textWidth(lab) + 6, 10);
      text(ctx, lab, VW / 2, slotY + slotH - 10, GOLD, { align: 'center' });
    }
    // what the row did
    if (shownGrid && !reels.some(r => r.spinning)) for (const h of rowHits) text(ctx, h.text, x0 + h.c * (CELL_W + REEL_GAP) + CELL_W - 2, slotY + CELL_H + 2, h.col, { align: 'right' });
    // hold & spin
    if (hold) {
      ctx.fillStyle = 'rgba(6,5,10,0.82)'; ctx.fillRect(x0, slotY, w5, CELL_H * 3);
      const bet = hold.bet;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
        const cell = hold.cells[r][c]; if (!cell) continue;
        const rx = x0 + c * (CELL_W + REEL_GAP), ry = slotY + r * CELL_H;
        ctx.drawImage(SYM.obol, rx + 1, ry - 1);
        text(ctx, cell.label || fmt(cell.v10 * bet / 10), rx + CELL_W / 2, ry + CELL_H - 9, cell.label ? GOLD : TEXT, { align: 'center' });
      }
      if (hold.total) text(ctx, (hold.full ? 'GRAND! ' : '') + fmt(hold.total), VW / 2, slotY + CELL_H + 10, GOLD, { align: 'center', scale: 2 });
    }
    // side rails: bet on the left, info on the right
    const free = S.inFreeSpins(wallet);
    button(2, slotY - 3, x0 - 8, 22, '', () => bet(1), { enabled: !busy && !free, icon: arrow(3, 4) });
    text(ctx, 'BET', (x0 - 4) / 2 + 1, slotY + 24, DIM, { align: 'center' });
    text(ctx, fmt(free ? wallet.free.bet : wallet.bet), (x0 - 4) / 2 + 1, slotY + 34, TEXT, { align: 'center' });
    button(2, slotY + 46, x0 - 8, 22, '', () => bet(-1), { enabled: !busy && !free, icon: arrow(1, 4) });
    button(VW - x0 + 6, slotY - 3, x0 - 8, 22, '?', () => { sfx('click'); openInfo({ SYM, wallet, settings, onSettings: () => { store.set('settings', settings); saveWallet(); } }); });
    button(VW - x0 + 6, slotY + 46, x0 - 8, 22, 'MAP', () => { bigMap = !bigMap; sfx('click'); });
    text(ctx, 'RTP', VW - (x0 - 4) / 2 - 1, slotY + 24, DIM, { align: 'center' });
    text(ctx, '96%', VW - (x0 - 4) / 2 - 1, slotY + 34, DIM, { align: 'center' });
    // info line
    const iy = infoY + 1;
    text(ctx, 'CREDIT ' + fmt(wallet.balance - hiddenWin), 3, iy, TEXT);
    const wtxt = 'WIN ' + fmt(winShown);
    text(ctx, wtxt, VW - 3, iy, winShown > 0 ? GOLD : DIM, { align: 'right' });
    if (free) text(ctx, `FREE ${wallet.free.left}`, VW / 2 + 8, iy, RED, { align: 'center' });
    if (!free && wallet.balance < wallet.bet && !busy) button(VW / 2 - 24, infoY - 1, 48, 11, 'REFILL', () => { wallet.balance = DEMO_BALANCE; saveWallet(); sfx('buy'); say('Demo credits refilled. Play money only.', GOLD); });
    else if (!free) text(ctx, 'DEMO', VW / 2 + 8, iy, '#5a4a7e', { align: 'center', shadow: null, scale: 1 });
  }

  function drawControls(L) {
    const { ctrlY, ctrlH } = Lay(), g = 3, bh = Math.floor((ctrlH - g) / 2), bw = 36, lx = 4;
    const dis = run.over;
    // movement pad
    button(lx, ctrlY, bw, bh, 'TURN', () => act('left'), { icon: turnIcon(-1), enabled: !dis });
    button(lx + bw + g, ctrlY, bw, bh, '', () => act('fwd'), { icon: arrow(3, 7), enabled: !dis, repeat: true });
    button(lx + 2 * (bw + g), ctrlY, bw, bh, 'TURN', () => act('right'), { icon: turnIcon(1), enabled: !dis });
    button(lx, ctrlY + bh + g, bw, bh, '', () => act('sleft'), { icon: arrow(2, 6), enabled: !dis, repeat: true });
    button(lx + bw + g, ctrlY + bh + g, bw, bh, '', () => act('back'), { icon: arrow(1, 7), enabled: !dis, repeat: true });
    button(lx + 2 * (bw + g), ctrlY + bh + g, bw, bh, '', () => act('sright'), { icon: arrow(0, 6), enabled: !dis, repeat: true });
    // actions
    const rx = lx + 3 * (bw + g) + 5, rw = VW - rx - 4;
    const chest = G.chestAhead(run), tgt = G.attackTarget(run);
    const free = S.inFreeSpins(wallet), afford = free || S.canAfford(wallet, wallet.bet);
    const label = chest ? 'OPEN CHEST\nSPIN ' + fmt(wallet.bet) : tgt.enemy ? 'ATTACK\nSPIN ' + fmt(wallet.bet) : 'ATTACK';
    button(rx, ctrlY, rw, bh, label, () => act('action'), { hot: !!(chest || tgt.enemy) && afford, enabled: !busy && !dis });
    const sw = Math.floor((rw - 2 * g) / 3);
    button(rx, ctrlY + bh + g, sw, bh, `MEDKIT\n${run.medkits}`, () => act('medkit'), { enabled: !busy && !dis && run.medkits > 0 });
    button(rx + sw + g, ctrlY + bh + g, sw, bh, `SIGN\n${run.signs}`, () => act('sign'), { enabled: !busy && !dis && run.signs > 0 });
    const W = WEAPONS[run.weapon];
    button(rx + 2 * (sw + g), ctrlY + bh + g, rw - 2 * (sw + g), bh, `ARMS\n${run.weapon === 'sabre' ? 'SABRE' : run.weapon === 'rifle' ? 'RIFLE' : 'REVOLV'}`, () => act('weapon'), { enabled: !busy && !dis });
  }

  // ------------------------------------------------------------------------------------------------ screens
  function drawTitle() {
    // the sky over the wood, slowly turning
    const off = (now / 80) % SKY.w, img = new ImageData(VW, 80), u = new Uint32Array(img.data.buffer);
    for (let y = 0; y < 80; y++) for (let x = 0; x < VW; x++) u[y * VW + x] = (SKY.data[y * SKY.w + ((x + (off | 0)) % SKY.w)] | 0xff000000) >>> 0;
    const scale = Math.ceil(H / 2 / 80);
    const tmp = document.createElement('canvas'); tmp.width = VW; tmp.height = 80; tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(tmp, 0, 0, VW, 80, 0, H / 2 - 80 * 2, VW * 2, 160);
    ctx.fillStyle = '#07060c'; ctx.fillRect(0, H / 2, VW, H / 2);
    // gravestones in the foreground
    ctx.drawImage(toCanvasCached('grave'), 20, H / 2 - 30); ctx.drawImage(toCanvasCached('stump'), 170, H / 2 - 34);
    text(ctx, 'ONE-ARMED', VW / 2, 40, GOLD, { align: 'center', scale: 3 });
    text(ctx, 'HUNTER', VW / 2, 66, RED, { align: 'center', scale: 3 });
    text(ctx, 'A DUNGEON CRAWL ON FIVE REELS', VW / 2, 94, DIM, { align: 'center' });
    const y = H / 2 + 20;
    const lines = ['Walk the maze for free.', 'Every fight and every chest', 'is a spin of the reels.', '', 'Find the keys. Kill what guards', 'the way out. Three realms.'];
    lines.forEach((l, i) => text(ctx, l, VW / 2, y + i * 10, TEXT, { align: 'center' }));
    if ((now / 500 | 0) % 2) text(ctx, run ? 'TAP TO CONTINUE' : 'TAP TO BEGIN', VW / 2, H - 70, GOLD, { align: 'center', scale: 2 });
    text(ctx, 'CREDIT ' + fmt(wallet.balance), VW / 2, H - 40, TEXT, { align: 'center' });
    text(ctx, 'DEMO PLAY - NO REAL MONEY - RTP 96.00%', VW / 2, H - 24, '#6a5a8e', { align: 'center' });
    text(ctx, 'ARROWS/WASD MOVE  SPACE ATTACK  H MEDKIT', VW / 2, H - 12, '#4a3a6e', { align: 'center' });
  }
  const spriteCanvases = {};
  const toCanvasCached = k => spriteCanvases[k] || (spriteCanvases[k] = toCanvas(SPR[k].img));

  function drawIntro() {
    const L = run.level, r = L.realm;
    ctx.fillStyle = 'rgba(6,5,10,0.94)'; ctx.fillRect(0, 0, VW, H);
    text(ctx, r.sub, VW / 2, 70, DIM, { align: 'center' });
    text(ctx, r.name, VW / 2, 86, GOLD, { align: 'center', scale: 2 });
    wrap(r.intro, 200).forEach((l, i) => text(ctx, l, VW / 2, 120 + i * 11, TEXT, { align: 'center' }));
    wrap('Find the brass key, then the bone key. Both lie in chests, and opening one is a spin. The guardian of the way out waits at the end.', 210)
      .forEach((l, i) => text(ctx, l, VW / 2, 190 + i * 11, DIM, { align: 'center' }));
    if ((now / 500 | 0) % 2) text(ctx, 'TAP TO ENTER', VW / 2, H - 60, GOLD, { align: 'center', scale: 2 });
  }
  function drawEnd() {
    const won = scene === 'won';
    ctx.fillStyle = won ? 'rgba(10,6,4,0.9)' : 'rgba(20,0,4,0.88)'; ctx.fillRect(0, 0, VW, H);
    text(ctx, won ? 'THE SEAL HOLDS' : 'YOU DIED', VW / 2, 70, won ? GOLD : RED, { align: 'center', scale: 2 });
    const st = run.stats;
    const rows = [['Realm', REALMS[run.realm].name], ['Kills', st.kills], ['Chests', st.chests], ['Spins', st.spins], ['Damage dealt', st.dealt], ['Damage taken', st.taken], ['Steps', st.steps]];
    rows.forEach(([k, v], i) => { text(ctx, k, 40, 110 + i * 12, DIM); text(ctx, String(v), VW - 40, 110 + i * 12, TEXT, { align: 'right' }); });
    text(ctx, 'Credits are kept between runs.', VW / 2, 210, DIM, { align: 'center' });
    if ((now / 500 | 0) % 2) text(ctx, 'TAP TO BEGIN AGAIN', VW / 2, H - 60, GOLD, { align: 'center', scale: 2 });
  }

  // ------------------------------------------------------------------------------------------------ go
  audio.build();
  if (run) { setupRealm(); }
  window.addEventListener('beforeunload', () => { saveWallet(); saveRun(); });
  requestAnimationFrame(frame);
  // a handle for automated play-testing
  window.__hunter = { get run() { return run; }, get wallet() { return wallet; }, act, get busy() { return busy; }, setup: () => { G.reveal(run); setupRealm(); }, goto: r => { run.realm = r; G.enterRealm(run); setupRealm(); } };
}
