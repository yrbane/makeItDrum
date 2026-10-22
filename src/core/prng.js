// Générateur pseudo-aléatoire déterministe (mulberry32) : une graine 32 bits
// reproduit exactement la même suite de tirages, donc le même rendu.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// graine 32 bits non signée tirée de `random` (Math.random par défaut)
export function randomSeed(random = Math.random) {
  return Math.floor(random() * 0x100000000) >>> 0;
}
