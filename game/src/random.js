// A small seeded random number generator (mulberry32). The same seed always gives
// the same sequence, which is what makes the screenshot scenes repeatable and the
// game fair to re-run. Nothing in the game uses Math.random for gameplay.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick an integer in [min, max) from a seeded rng.
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min));
}

// Pick one element of an array.
export function randPick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// A shuffled copy of an array (Fisher-Yates on the seeded rng).
export function shuffled(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
