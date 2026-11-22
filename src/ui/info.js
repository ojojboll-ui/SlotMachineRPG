// The information overlay (plain HTML over the game): how the crawl works, paytable, rules, RTP, history, settings.

import * as M from '../slot/machine.js';
import { THEME, WEAPONS, LINE_HIT, LINE_WARD, LINE_HEAL, LINE_TOME, TOME_STUN, ROW_TOME, ROW_WARD, EYE_HIT, SILVER_HIT, SILVER_GRAND, CHEST, SPELLS, ENEMIES, ROLE_TAGS, KINDS } from '../world/data.js';
import { VERSION, DEMO, DEMO_BALANCE } from '../config.js';

const pct = (x, d = 2) => (x * 100).toFixed(d) + '%';
const fmt = n => Math.round(n).toLocaleString('en-US');
const s345 = t => `${t[3]} / ${t[4]} / ${t[5]}`;

export function openInfo({ SYM, wallet: w, settings: s, onSettings }) {
  const el = document.getElementById('info'), body = document.getElementById('infoBody');
  const urls = {}; for (const k in SYM) urls[k] = SYM[k].toDataURL();
  const ico = k => `<img class="sym" src="${urls[k]}" alt="${THEME[k].name}">`;
  const bet = w.bet;
  const lines = M.LINES.map((ln, i) => `<div class="line"><b>${i + 1}</b>${[0, 1, 2].map(r => `<span>${ln.map(x => (x === r ? '■' : '□')).join('')}</span>`).join('')}</div>`).join('');
  body.innerHTML = `
<h2>One-Armed Hunter <small>v${VERSION}${DEMO ? ' · demo play' : ''}</small></h2>
<p class="note">${DEMO ? 'A demonstration with play credits. No real money can be staked or won.' : ''} For adults only (18+). Gambling can be addictive: play responsibly.</p>

<h3>The crawl</h3>
<p>Walking, turning, using a medkit or casting black magic costs nothing: those turns are free, but the things in the dark move whenever you do. <b>Only two things spin the reels:</b> attacking, and opening a chest. Each such spin is an ordinary paid spin at your bet.</p>
<p>Each realm hides two locked doors. The <b>brass key</b> and the <b>bone key</b> lie in chests. A guardian stands before the way out.</p>
<p><b>Choosing what to kill.</b> The realms are rooms full of things, and each spin strikes one of them. Tap an enemy in the view (or press T) to aim at it; red brackets mark your target and a bar shows its health. Anything within your arms' reach and in front of you can be hit. Some are worth killing first:</p>
<p><b>Weak and resistant.</b> Every attack has a kind: the sabre is Blade, the revolver Pistol, the coach gun Scatter, the rifle Heavy, and black magic is Magic. An enemy takes double damage from the kinds it is weak to and half from those it resists. Those who strike from afar are weak up close. Your target's line at the top of the view shows how your arms fare against it.</p>
<div style="overflow-x:auto"><table><tr><th>Enemy</th><th>Health</th><th>Hits</th><th>Reach</th><th>Trait</th><th>Weak</th><th>Resists</th></tr>
${Object.values(ENEMIES).map(E => `<tr><td>${E.name}</td><td>${E.hp}</td><td>${E.dmg[0]}–${E.dmg[1]}</td><td>${E.range}</td><td>${E.role ? ROLE_TAGS[E.role] : ''}</td><td>${(E.weak || []).map(k => KINDS[k]).join(', ')}</td><td>${(E.resist || []).map(k => KINDS[k]).join(', ')}</td></tr>`).join('')}</table></div>
<p>Small arrows at the edges of the view point to enemies you are not facing: red for those that are awake, grey for those still asleep.</p>
<p>Healers mend the most hurt ally in sight; summoners call a new minion every few turns; when one thing in a room wakes, the whole room wakes.</p>
<p><b>Controls.</b> Arrows or W/S to walk, A/D to sidestep, Q/E or left/right to turn, Space to attack or open, T next target, H medkit, F black magic (1–4 to cast), R change arms, M map.</p>

<h3>How the reels fight</h3>
<p><b>The middle row</b> always strikes, win or not, depending on the arms you hold:</p>
<table><tr><th>Arms</th><th>Strikes with</th><th>Per symbol</th><th>Reach</th><th>Ammunition</th></tr>
${Object.values(WEAPONS).map(W => `<tr><td>${W.name}</td><td>${ico(W.key)}</td><td>${W.row}</td><td>${W.range} tile${W.range > 1 ? 's' : ''}</td><td>${W.ammo ? '1 per paid spin' : 'none'}</td></tr>`).join('')}</table>
<p>The coach gun's spread also hits every enemy standing next to your target for ${Math.round(WEAPONS.shotgun.spread * 100)}% of the damage. Both the coach gun and the rifle lie somewhere in the wood.</p>
<p>Whatever you hold: each ${ico('tome')} on the row whispers for ${ROW_TOME}, each ${ico('shield')} blocks ${ROW_WARD}, each reel the ${ico('eye')} covers hits for ${EYE_HIT}.</p>
<p><b>Every winning line fights</b> (3 / 4 / 5 of a kind): ${ico('sword')} and ${ico('fire')} hit for ${s345(LINE_HIT)}; ${ico('shield')} blocks ${s345(LINE_WARD)}; ${ico('flask')} heals ${s345(LINE_HEAL)}; ${ico('tome')} hits for ${s345(LINE_TOME)} and stuns for ${s345(TOME_STUN)} turns; ${ico('crown')} doubles all damage that spin (×3 for five).</p>
<p>${ico('obol')} Hold &amp; Spin: each silver bullet hits for ${SILVER_HIT}, a full screen for ${SILVER_GRAND} more. ${ico('moon')} Free spins: the dark holds still and every free spin is another attack.</p>
<h3>Black magic</h3>
<p>Pages of black magic lie about the realms. Casting needs no spin, but the dark moves afterwards.</p>
<table>${Object.values(SPELLS).map(S => `<tr><td>${S.name}</td><td style="text-align:left">${S.desc}</td></tr>`).join('')}</table>

<h3>What chests hold</h3>
<p>Opening a chest spins once. Besides any key inside, the middle row gives: each ${ico('fire')} ${CHEST.bulletsPerGun} rounds, each ${ico('shield')} ward +${CHEST.wardPerLantern}, ${CHEST.flasksForMedkit} or more ${ico('flask')} a medkit, ${CHEST.tomesForSpell} or more ${ico('tome')} a Black Flame. Winning lines of ${ico('fire')} give ${s345(CHEST.bulletLine)} rounds, ${ico('flask')} ${s345(CHEST.medkitLine)} medkits, ${ico('shield')} a lasting ward of ${s345(CHEST.wardLine)}, ${ico('crown')} ${s345(CHEST.hpLine)} more maximum health, ${ico('tome')} ${s345(CHEST.spellLine)} Signs of Banishing, ${ico('sword')} a sharper sabre. Every ${ico('obol')} gives a rifle cartridge.</p>

<h3>Paytable <small>at bet ${fmt(bet)}</small></h3>
<table><tr><th></th><th>3</th><th>4</th><th>5</th></tr>
${M.PAY_ORDER.map(k => `<tr><td>${ico(k)} ${THEME[k].name}</td>${[3, 4, 5].map(n => `<td>${fmt(M.credits(M.PAY10[k][n], bet))}</td>`).join('')}</tr>`).join('')}</table>
<p>Wins pay for 3, 4 or 5 matching symbols on a payline, from the leftmost reel. Only the highest win per line is paid; wins on different lines are added.</p>
<p>${ico('eye')} <b>Wild.</b> Reels 2, 3 and 4. It expands over its whole reel and stands in for every paying symbol.</p>
<p>${ico('moon')} <b>Blood Moon.</b> 3, 4 or 5 anywhere award ${M.FREE_SPINS[3]}, ${M.FREE_SPINS[4]} or ${M.FREE_SPINS[5]} free spins at the triggering bet, line wins ×${M.FREE_MULT}. They can retrigger.</p>
<p>${ico('obol')} <b>Silver Bullet: Hold &amp; Spin.</b> ${M.HS_TRIGGER} or more anywhere. They stay; the rest respin ${M.HS_RESPINS} times, and each new one resets the count. Values ${M.HS_VALUES10.map(v => (v[2] ? v[2] + ' ' : '') + v[0] / 10 + '×').join(', ')} the bet; all 15 add a GRAND of ${M.HS_GRAND10 / 10}×.</p>
<p>${ico('skull')} <b>Skull.</b> Pays nothing.</p>
<h3>Paylines</h3><div class="lines">${lines}</div>

<h3>Return to player</h3>
<table><tr><td>Theoretical RTP</td><td><b>${pct(M.PAR.rtp)}</b></td></tr><tr><td>Base game</td><td>${pct(M.PAR.base)}</td></tr><tr><td>Free spins</td><td>${pct(M.PAR.free)}</td></tr><tr><td>Hold &amp; Spin</td><td>${pct(M.PAR.hold)}</td></tr>
<tr><td>Hit frequency</td><td>${pct(M.PAR.hit, 1)}</td></tr><tr><td>Maximum win</td><td>${fmt(M.MAX_WIN_X)}× bet per game round</td></tr></table>
<p><b>The dungeon never changes the odds.</b> Arms, keys, enemies and realms only decide what a spin does down here. Credits change only when you stake them and when the reels pay, and the bet changes nothing in the dungeon. Every outcome is decided by a cryptographic random number generator and saved before the reels move.</p>

<h3>History <small>last ${w.history.length} rounds</small></h3>
<table class="hist"><tr><th>Time</th><th>Game</th><th>Stake</th><th>Win</th></tr>
${w.history.slice(0, 30).map(h => `<tr><td>${new Date(h.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td><td>${h.kind}${h.note ? ' · ' + h.note : ''}</td><td>${fmt(h.cost)}</td><td>${fmt(h.win)}</td></tr>`).join('') || '<tr><td colspan="4">No rounds yet.</td></tr>'}</table>

<h3>Settings</h3>
<div class="set">
<label><input type="checkbox" id="sSound" ${s.sound ? 'checked' : ''}> Sound</label>
<label>Music <input type="range" id="sMusic" min="0" max="100" value="${Math.round(s.music * 100)}"></label>
<label><input type="checkbox" id="sCrt" ${s.crt ? 'checked' : ''}> CRT screen</label>
${DEMO ? `<button id="sTopup">Reset demo credits to ${fmt(DEMO_BALANCE)}</button>` : ''}
</div>`;
  const on = (id, ev, fn) => { const x = document.getElementById(id); if (x) x.addEventListener(ev, fn); };
  on('sSound', 'change', e => { s.sound = e.target.checked; onSettings(); });
  on('sMusic', 'input', e => { s.music = e.target.value / 100; onSettings(); });
  on('sCrt', 'change', e => { s.crt = e.target.checked; onSettings(); });
  on('sTopup', 'click', () => { w.balance = DEMO_BALANCE; onSettings(); });
  el.hidden = false; body.scrollTop = 0;
  document.getElementById('infoClose').onclick = () => { el.hidden = true; };
}
