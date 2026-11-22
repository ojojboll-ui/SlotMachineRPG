// Random number generation.
//
// Two separate generators, never mixed:
//  - gameRng():   cryptographically strong, unbiased. The ONLY source of randomness for anything that decides a
//                 payout (reel stops, Hold & Spin, gamble). In a real-money deployment this generator lives on the
//                 game server; the client only presents outcomes.
//  - seededRng(): small deterministic PRNG for cosmetics and the meta game (maps, enemy looks, backgrounds, music),
//                 so those never consume or influence game randomness.

export class Rng {
  /** @param {() => number} next32 returns a uniform unsigned 32-bit integer */
  constructor(next32) { this.u32 = next32; }

  /** Uniform integer in [0, n) without modulo bias (rejection sampling). */
  int(n) {
    if (!(n > 0) || n > 0x100000000) throw new RangeError('int(n): n out of range');
    const limit = Math.floor(0x100000000 / n) * n;
    let x;
    do { x = this.u32(); } while (x >= limit);
    return x % n;
  }

  /** Uniform integer in [a, b]. */
  range(a, b) { return a + this.int(b - a + 1); }

  /** Uniform float in [0, 1) with 53 bits of resolution. */
  float() { return ((this.u32() >>> 5) * 67108864 + (this.u32() >>> 6)) / 9007199254740992; }

  /** True with probability num/den, decided on integers so the odds are exact. */
  chance(num, den) { return this.int(den) < num; }

  pick(arr) { return arr[this.int(arr.length)]; }

  /** Pick from [[item, integerWeight], ...]. */
  weighted(pairs) {
    let total = 0;
    for (const p of pairs) total += p[1];
    let x = this.int(total);
    for (const p of pairs) { if ((x -= p[1]) < 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = this.int(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
}

/** Cryptographically strong generator (Web Crypto, also available in Node). */
export function gameRng() {
  const buf = new Uint32Array(128);
  let i = buf.length;
  return new Rng(() => {
    if (i >= buf.length) { globalThis.crypto.getRandomValues(buf); i = 0; }
    return buf[i++];
  });
}

/** Deterministic generator (mulberry32) for cosmetics, the meta game and tests. */
export function seededRng(seed) {
  let a = seed >>> 0;
  return new Rng(() => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  });
}

/** Stable 32-bit hash of a string, for deriving seeds. */
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
