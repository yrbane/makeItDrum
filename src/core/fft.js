// FFT radix-2 en place (Cooley-Tukey). `re` et `im` doivent avoir une
// longueur puissance de deux ; ils sont remplacés par le spectre.

export function fftInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr0 = Math.cos(ang);
    const wi0 = Math.sin(ang);
    const half = len / 2;
    for (let i = 0; i < n; i += len) {
      let curWr = 1;
      let curWi = 0;
      for (let k = 0; k < half; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + half] * curWr - im[i + k + half] * curWi;
        const vi = re[i + k + half] * curWi + im[i + k + half] * curWr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + half] = ur - vr; im[i + k + half] = ui - vi;
        const nwr = curWr * wr0 - curWi * wi0;
        const nwi = curWr * wi0 + curWi * wr0;
        curWr = nwr; curWi = nwi;
      }
    }
  }
}
