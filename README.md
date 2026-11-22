# One-Armed Hunter

A Lovecraftian first-person dungeon crawler played on a five-reel slot machine, in the spirit of Doom RPG and
Eye of the Beholder. Portrait, touch first, one HTML file. The sibling of
[One-Armed Hero](https://github.com/ojojboll-ui/slot-dungeon), with the same certified slot machine.

Demo play only. There is no real money in this build.

## The game

- **The crawl:** each realm is a small, crowded, generated set of rooms that open into one another, with
  pillars in the big halls, seen in first person through a grid raycaster with sliding doors, textured floors and
  ceilings, coloured light and fog. Turn-based like Doom RPG: the things in the dark move only when you do. A minimap
  draws itself as you explore.
- **Choosing what to kill.** Rooms wake together, so fights are against groups. Tap an enemy (or press T) to aim at
  it; anything in front of you within your arms' reach can be hit. Enemies have roles: healers mend their allies,
  cultists shoot from afar, hounds run two steps a turn, brutes hit hard, shades walk through doors, and each guardian
  summons help. Each enemy is weak to some kinds of attack (double damage) and resists others (half): those who
  strike from afar are weak to the sabre and the coach gun, brutes and drowned things to the rifle's heavy rounds,
  shades to black magic. Arrows at the edges of the view point to enemies you are not facing.
- **Only fights and chests spin.** Walking, turning, medkits and the Sign of Banishing are free turns. Attacking and
  opening a chest are paid spins at your bet.
- **The reels fight.** The middle row strikes with the arms you hold (sabre: blades; revolver, coach gun and rifle:
  gunshots, each with its own reach and ammunition; the coach gun's spread also hits whatever stands next to the
  target), lanterns block, tomes whisper. Every winning line fires its symbol's power:
  hits, wards, healing, stuns and the Elder Sign's critical. Silver bullets in Hold & Spin each hit; during Blood Moon
  free spins the dark holds still.
- **Pickups and black magic.** Ammunition, medkits, the coach gun, the rifle and pages of black magic lie about:
  Sign of Banishing, Black Flame (every enemy in sight), Blood Leech and Veil of Dread. Casting needs no spin.
- **Chests** hold the brass and bone keys that open each realm's two locked doors, and what the reels show decides
  the rest: rounds, medkits, wards, cartridges, signs, more health, a sharper sabre.
- **Three realms:** The Black Wood, Ashcombe Manor and The Crypt Beneath, each with its own textures, enemies and a
  guardian before the way out.
- **The two never mix.** Credits change only through stakes and wins in `src/slot/session.js`. Nothing in the dungeon
  alters the reels, the paytable or the RTP (96.00%, see [docs/PAR.md](docs/PAR.md)), and the bet changes nothing
  in the dungeon.

## Build

    npm install
    npm run build        # writes index.html and dist/artifact.html
    npm test             # paytable, RNG, RTP, level generation and the slot/dungeon boundary
    npm run par          # exact RTP by full enumeration
    node tools/bot.mjs   # a bot plays whole runs and reports win rate, deaths per realm and spins per realm

Everything on screen and everything you hear is generated in code at start-up. There are no image or audio files.

| Path | What it holds |
|---|---|
| `src/slot/` | The One-Armed Hero machine, unchanged: reel strips, paytable, features, wallet and history |
| `src/world/` | Realms, enemies, weapons, maze generation with keys and locks, turns and combat rules |
| `src/gfx/` | Raycaster, procedural textures and sprites, reel symbols, the CRT presenter |
| `src/ui/` | The game screen, controls, the rules overlay |
| `src/audio/` | FM synthesis and the sequencer from One-Armed Hero, plus the dungeon's sounds |

Controls: arrows or W/S walk, A/D sidestep, Q/E or left/right turn, Space attack or open, H medkit, F sign,
T next target, F black magic (1-4 to cast), R change arms, M map.
