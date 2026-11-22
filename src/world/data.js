// Game data for the dungeon: the hunter, weapons, enemies, realms and what each reel symbol means down here.
// Nothing in this file touches credits. The slot machine in src/slot/ is the same certified machine as in
// One-Armed Hero; the dungeon only reads its outcomes.

export const HERO = { hp: 60, medkitHeal: 25, startMedkits: 2, startBullets: 18, startCartridges: 0, startSigns: 1 };

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

// Weapons decide which symbols on the middle row strike, and how far.
//  row:   damage per matching cell on the middle row
//  range: tiles in a straight line ahead (1 = adjacent only)
//  ammo:  which pouch a spin draws one round from
export const WEAPONS = {
  sabre:    { name: 'Cavalry Sabre',  key: 'sword', row: 3, range: 1, ammo: null },
  revolver: { name: 'Service Revolver', key: 'fire', row: 5, range: 4, ammo: 'bullets' },
  rifle:    { name: 'Elephant Rifle', key: 'fire', row: 8, range: 9, ammo: 'cartridges' },
};
export const WEAPON_ORDER = ['sabre', 'revolver', 'rifle'];

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
export const SIGN_DAMAGE = 25;                      // the Sign of Banishing, a spell that needs no spin

// What a chest gives for what the reels show.
export const CHEST = {
  bulletsPerGun: 2,             // each gunshot on the row
  bulletLine: { 3: 6, 4: 12, 5: 24 },
  medkitLine: { 3: 1, 4: 2, 5: 3 },
  wardLine: { 3: 6, 4: 12, 5: 25 },   // a lasting ward that soaks damage before health
  hpLine: { 3: 5, 4: 10, 5: 20 },     // elder sign line: more maximum health
  signLine: { 3: 1, 4: 2, 5: 3 },     // tome line: Signs of Banishing
  honeLine: { 3: 1, 4: 1, 5: 2 },     // sabre line: the sabre gets sharper
  silverPerObol: 1,                    // each silver bullet anywhere: one rifle cartridge
  wardPerLantern: 2,                   // each lantern on the row
  flasksForMedkit: 2,                  // two or more laudanum on the row: a medkit
  tomesForSign: 2,                     // two or more tomes on the row: a sign of banishing
};

// Enemies. hp, dmg [min,max], hit chance in %, range (1 = melee), speed (moves per turn), sight in tiles.
export const ENEMIES = {
  ghoul:    { name: 'Ghoul',            hp: 12, dmg: [3, 5],  hit: 75, range: 1, speed: 1, sight: 7,  look: 'ghoul' },
  hound:    { name: 'Fen Hound',        hp: 8,  dmg: [2, 4],  hit: 80, range: 1, speed: 2, sight: 9,  look: 'hound' },
  cultist:  { name: 'Hooded Cultist',   hp: 10, dmg: [2, 4],  hit: 60, range: 4, speed: 1, sight: 7,  look: 'cultist', drops: 'bullets' },
  shade:    { name: 'Shade',            hp: 14, dmg: [3, 6],  hit: 70, range: 1, speed: 1, sight: 8,  look: 'shade', phase: true },
  servant:  { name: 'Hollow Servant',   hp: 18, dmg: [4, 6],  hit: 75, range: 1, speed: 1, sight: 6,  look: 'servant' },
  drowned:  { name: 'Drowned One',      hp: 22, dmg: [5, 7],  hit: 75, range: 1, speed: 1, sight: 7,  look: 'drowned' },
  mass:     { name: 'Crawling Mass',    hp: 32, dmg: [6, 9],  hit: 80, range: 1, speed: 1, sight: 5,  look: 'mass', slow: true },
  priest:   { name: 'Cult Priest',      hp: 16, dmg: [4, 6],  hit: 65, range: 5, speed: 1, sight: 8,  look: 'priest', drops: 'cartridges' },
  // bosses guard the way out of each realm
  stag:     { name: 'The Antlered Shepherd',   hp: 70,  dmg: [5, 8],   hit: 80, range: 1, speed: 1, sight: 6, look: 'stag', boss: true },
  widow:    { name: 'The Widow in the Paper',  hp: 95,  dmg: [5, 8],   hit: 75, range: 3, speed: 1, sight: 6, look: 'widow', boss: true },
  waiter:   { name: 'That Which Waits Below',  hp: 140, dmg: [7, 10],  hit: 80, range: 2, speed: 0, sight: 6, look: 'waiter', boss: true },
};

export const REALMS = [
  { id: 'forest', name: 'The Black Wood', sub: 'Chapter I', size: 9, enemies: [['ghoul', 4], ['hound', 3], ['cultist', 2]], count: 9, boss: 'stag',
    chests: 4, music: 'calm', fog: [26, 20, 46], fogDist: 7.5, sky: true, deco: ['grave', 'grave', 'stump', 'bones'], exit: 'gate',
    keys: ['brass', 'bone'], weaponChest: 'rifle', intro: 'The letter spoke of a manor beyond the wood. The trees lean closer as you walk.' },
  { id: 'mansion', name: 'Ashcombe Manor', sub: 'Chapter II', size: 10, enemies: [['shade', 3], ['servant', 3], ['cultist', 3], ['ghoul', 1]], count: 11, boss: 'widow',
    chests: 5, music: 'map', fog: [22, 10, 26], fogDist: 7, sky: false, deco: ['candles', 'candles', 'armchair', 'clock'], exit: 'stairs',
    keys: ['brass', 'bone'], intro: 'Every portrait in the hall has the same red eyes. The door locks behind you.' },
  { id: 'crypt', name: 'The Crypt Beneath', sub: 'Chapter III', size: 11, enemies: [['drowned', 3], ['mass', 2], ['priest', 3], ['ghoul', 2]], count: 13, boss: 'waiter',
    chests: 5, music: 'title', fog: [8, 4, 10], fogDist: 6, sky: false, deco: ['brazier', 'bones', 'bones', 'brazier'], exit: 'seal',
    keys: ['brass', 'bone'], intro: 'Below the manor the stone is wet and warm. Something vast is breathing.' },
];

export const KEY_NAMES = { brass: 'Brass Key', bone: 'Bone Key' };
