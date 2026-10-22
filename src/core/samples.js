// Manipulations d'échantillons pures.

// inversion temporelle : dst[i] = src[n-1-i]
export function reverseInto(src, dst) {
  for (let i = 0; i < src.length; i++) dst[i] = src[src.length - 1 - i];
  return dst;
}
