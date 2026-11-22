// Game data for the dungeon: the hunter, weapons, black magic, enemies, realms and what each reel symbol means down
// here. Nothing in this file touches credits. The slot machine in src/slot/ is the same certified machine as in
// One-Armed Hero; the dungeon only reads its outcomes.

export const HERO = { hp: 60, medkitHeal: 25, startMedkits: 2, startBullets: 18 };

// The symbol keys are those of src/slot/machine.js. Only names and pictures change.
export const THEME = {
  crown:  { name: 'Elder Sign',      short: 'ELDER SIGN' },
  tome:   { name: 'Forbidden Tome',  short: 'TOME' },
  flask:  { name: 'Laudanum',        short: 'LAUDANUM' },
  sword:  { name: 'Sabre',           short: 'SABRE' },
  fire:   { name: 'Gunshot',         short: 'GUNSHOT' },
  shield: { name: 'Lantern Ward',    short: 'WARD' },
  eye:    { name: 'The Open Eye (Wild)', short: 'EYE' },
  obol:   { name: 'Silver Bullet',   short: 'SILVER' },
  moon:   { name: 'Blood Moon',      short: 'BLOOD MOON' },
  skull:  { name: 'Skull',           short: 'SKULL' },
};

// Weapons decide which symbols on the middle row strike, how far, and how wide.
//  row:    damage per matching cell on the middle row
//  range:  reach in tiles (1 = next to you, diagonals included)
//  ammo:   the pouch a paid spin draws one round from
//  spread: share of the damage that also hits every enemy next to the target
export const WEAPONS = {
  sabre:    { name: 'Cavalry Sabre',    short: 'SABRE',   key: 'sword', row: 3, range: 1, ammo: null },
  revolver: { name: 'Service Revolver', short: 'REVOLV',  key: 'fire',  row: 5, range: 5, ammo: 'bullets' },
  shotgun:  { name: 'Coach Gun',        short: 'SHOTGN',  key: 'fire',  row: 5, range: 3, ammo: 'shells', spread: 0.6 },
  rifle:    { name: 'Elephant Rifle',   short: 'RIFLE',   key: 'fire',  row: 8, range: 10, ammo: 'cartridges' },
};
export const WEAPON_ORDER = ['sabre', 'revolver', 'shotgun', 'rifle'];
export const AMMO_NAMES = { bullets: 'rounds', shells: 'shells', cartridges: 'cartridges' };

// Black magic. Found as pages of forbidden books; casting needs no spin but takes a turn.
export const SPELLS = {
  banish: { name: 'Sign of Banishing', short: 'BANISH', desc: '25 damage to your target.', dmg: 25 },
  flame:  { name: 'Black Flame',       short: 'FLAME',  desc: '9 damage to every enemy you can see.', dmg: 9, all: true },
  leech:  { name: 'Blood Leech',       short: 'LEECH',  desc: '14 damage to your target, and you heal as much.', dmg: 14, leech: true },
  dread:  { name: 'Veil of Dread',     short: 'DREAD',  desc: 'Every enemy you can see loses its next 2 turns.', stun: 2, all: true },
};
export const SPELL_ORDER = ['banish', 'flame', 'leech', 'dread'];

// Every winning line fires its symbol's power, whatever weapon is drawn.
export const LINE_HIT = { 3: 6, 4: 14, 5: 32 };     // sabre and gunshot lines
export const LINE_WARD = { 3: 5, 4: 10, 5: 22 };    // block until the enemies' next blow
export const LINE_HEAL = { 3: 6, 4: 12, 5: 25 };
export const LINE_TOME = { 3: 4, 4: 10, 5: 24 };    // eldritch damage; the target also loses turns
export const TOME_STUN = { 3: 1, 4: 2, 5: 3 };
export const ROW_TOME = 1;                          // each tome on the row whispers for 1
export const ROW_WARD = 2;                          // each lantern on the row blocks 2
export const EYE_HIT = 3;                           // each reel the Eye covers
export const SILVER_HIT = 3;                        // each silver bullet in Hold & Spin
export const SILVER_GRAND = 60;                     // a full screen of silver

// What a chest gives for what the reels show.
export const CHEST = {
  bulletsPerGun: 2,             // each gunshot on the row
  bulletLine: { 3: 6, 4: 12, 5: 24 },
  shellLine: { 3: 3, 4: 6, 5: 12 },  // gunshot lines also give shells once you carry the coach gun
  medkitLine: { 3: 1, 4: 2, 5: 3 },
  wardLine: { 3: 6, 4: 12, 5: 25 },   // a lasting ward that soaks damage before health
  hpLine: { 3: 5, 4: 10, 5: 20 },     // elder sign line: more maximum health
  spellLine: { 3: 1, 4: 2, 5: 3 },    // tome line: pages of black magic
  honeLine: { 3: 1, 4: 1, 5: 2 },     // sabre line: the sabre gets sharper
  silverPerObol: 1,                    // each silver bullet anywhere: one rifle cartridge
  wardPerLantern: 2,                   // each lantern on the row
  flasksForMedkit: 2,                  // two or more laudanum on the row: a medkit
  tomesForSpell: 2,                    // two or more tomes on the row: a page of black magic
};

// Enemies. hp, dmg [min,max], hit chance in %, range in tiles (1 = melee), speed (moves per turn), sight in tiles.
// role is what makes each one worth killing first:
//   ranged  hits from afar        fast   two steps a turn      heal   mends the most hurt ally in sight
//   tank    slow, hits very hard  phase  walks through doors   summon calls a minion every few turns
export const ENEMIES = {
  ghoul:    { name: 'Ghoul',           hp: 12, dmg: [3, 5],  hit: 75, range: 1, speed: 1, sight: 7, look: 'ghoul' },
  hound:    { name: 'Fen Hound',       hp: 8,  dmg: [2, 4],  hit: 80, range: 1, speed: 2, sight: 9, look: 'hound', role: 'fast' },
  cultist:  { name: 'Hooded Cultist',  hp: 10, dmg: [2, 4],  hit: 60, range: 5, speed: 1, sight: 8, look: 'cultist', role: 'ranged', drops: 'bullets' },
  shade:    { name: 'Shade',           hp: 14, dmg: [3, 6],  hit: 70, range: 1, speed: 1, sight: 8, look: 'shade', role: 'phase' },
  servant:  { name: 'Hollow Servant',  hp: 18, dmg: [4, 6],  hit: 75, range: 1, speed: 1, sight: 6, look: 'servant' },
  drowned:  { name: 'Drowned One',     hp: 22, dmg: [5, 7],  hit: 75, range: 1, speed: 1, sight: 7, look: 'drowned' },
  mass:     { name: 'Crawling Mass',   hp: 32, dmg: [6, 9],  hit: 80, range: 1, speed: 1, sight: 6, look: 'mass', role: 'tank', slow: true },
  priest:   { name: 'Cult Priest',     hp: 14, dmg: [3, 5],  hit: 65, range: 5, speed: 1, sight: 8, look: 'priest', role: 'heal', heal: 8, drops: 'cartridges' },
  // bosses guard the way out of each realm and call for help
  stag:     { name: 'The Antlered Shepherd',  hp: 70,  dmg: [5, 8],  hit: 80, range: 1, speed: 1, sight: 7, look: 'stag', boss: true, role: 'summon', summon: 'hound', every: 4 },
  widow:    { name: 'The Widow in the Paper', hp: 95,  dmg: [5, 8],  hit: 75, range: 4, speed: 1, sight: 7, look: 'widow', boss: true, role: 'summon', summon: 'shade', every: 4 },
  waiter:   { name: 'That Which Waits Below', hp: 140, dmg: [7, 10], hit: 80, range: 2, speed: 0, sight: 7, look: 'waiter', boss: true, role: 'summon', summon: 'drowned', every: 3 },
};
export const ROLE_TAGS = { ranged: 'RANGED', fast: 'FAST', heal: 'HEALER', tank: 'BRUTE', phase: 'PHASES', summon: 'SUMMONER' };

// size: tiles across; roomMax: largest room interior; density: enemies per 16 tiles of room
const LOOT_EARLY = [['bullets', 5], ['medkit', 3], ['banish', 2], ['flame', 1], ['leech', 1], ['shells', 2]];
const LOOT_LATE = [['bullets', 4], ['shells', 3], ['cartridges', 2], ['medkit', 3], ['banish', 2], ['flame', 2], ['leech', 2], ['dread', 1]];
export const REALMS = [
  { id: 'forest', name: 'The Black Wood', sub: 'Chapter I', size: 33, roomMax: 11, density: 0.38,
    enemies: [['ghoul', 4], ['hound', 3], ['cultist', 2], ['priest', 1]], boss: 'stag', chests: 4, loot: LOOT_EARLY, weapon: 'shotgun', weaponZone: 0,
    music: 'calm', fog: [26, 20, 46], fogDist: 8, sky: true, deco: ['grave', 'grave', 'stump', 'bones'], light: 'lamp', exit: 'gate',
    intro: 'The letter spoke of a manor beyond the wood. The trees lean closer as you walk.' },
  { id: 'mansion', name: 'Ashcombe Manor', sub: 'Chapter II', size: 35, roomMax: 9, density: 0.46,
    enemies: [['shade', 3], ['servant', 3], ['cultist', 3], ['priest', 2], ['ghoul', 1]], boss: 'widow', chests: 5, loot: LOOT_LATE, weapon: 'rifle', weaponZone: 1,
    music: 'map', fog: [22, 10, 26], fogDist: 7.5, sky: false, deco: ['candles', 'armchair', 'clock'], light: 'candles', exit: 'stairs',
    intro: 'Every portrait in the hall has the same red eyes. The door locks behind you.' },
  { id: 'crypt', name: 'The Crypt Beneath', sub: 'Chapter III', size: 37, roomMax: 13, density: 0.5,
    enemies: [['drowned', 3], ['mass', 2], ['priest', 2], ['cultist', 2], ['ghoul', 2]], boss: 'waiter', chests: 5, loot: LOOT_LATE,
    music: 'title', fog: [8, 4, 10], fogDist: 6.5, sky: false, deco: ['bones', 'bones', 'brazier'], light: 'brazier', exit: 'seal',
    intro: 'Below the manor the stone is wet and warm. Something vast is breathing.' },
];

export const KEY_NAMES = { brass: 'Brass Key', bone: 'Bone Key' };
