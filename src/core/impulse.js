// Impulsion de réverbération synthétique : bruit décroissant en puissance.
// Remplit `data` EN PLACE ; `random` est le générateur injecté.

export function fillImpulseInPlace(data, decay, random) {
  const len = data.length;
  for (let i = 0; i < len; i++) {
    data[i] = (random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return data;
}
