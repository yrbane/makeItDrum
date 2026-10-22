// Helpers aléatoires du moteur. Le générateur est injecté pour rendre les
// rendus reproductibles (tests, golden master) : `random` doit renvoyer un
// nombre dans [0, 1[ comme Math.random.

export function createRandom(random = Math.random) {
  function rnd(a, b) {
    return a + random() * (b - a);
  }

  // écart relatif centré : base × (1 ± pct)
  function jitter(base, pct) {
    return base * (1 + rnd(-pct, pct));
  }

  function chance(p) {
    return random() < p;
  }

  // point de départ aléatoire dans le son importé (en secondes), pour que
  // chaque couche entende un morceau différent du fichier à chaque clic
  function randomOffset(duration, maxFrac = 0.6) {
    if (!duration) return 0;
    const span = Math.max(0, duration * maxFrac - 0.01);
    return span > 0 ? random() * span : 0;
  }

  return { random, rnd, jitter, chance, randomOffset };
}
