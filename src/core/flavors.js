// Les 20 recettes de percussion : données statiques décrivant comment le
// sample importé est découpé, filtré, ré-enveloppé et saturé. Aucun tirage
// aléatoire ici : les variations sont appliquées par le renderer. Les
// fréquences dépendant de l'analyse sont des fonctions (a) => Hz.
import { clamp } from './math.js';

export const FLAVORS = [
  // 1. BOOM grave — corps du sample très filtré passe-bas + renfort de basses
  { name:'BOOM', attack:0.0008, hold:0.02, decay:0.5, curvePow:1.8, attackClick:0.6,
    layers:[
      {rate:0.28, filter:'lowpass', freq:(a) => clamp(a.fundamental*4,120,500), q:0.7, gain:0.85, offsetMax:0.7},
      {rate:0.16, filter:'bandpass', freq:(a) => clamp(a.fundamental*2,60,300), q:1.1, gain:0.4, decayMul:0.75, offsetMax:0.85}
    ],
    sub:{enabled:true, rate:0.18, cutoff:(a) => clamp(a.fundamental*0.7,40,90), drive:1.5, gain:0.9, decayMul:1.1},
    sat:{drive1:2.4, asym1:0.16, foldAmt:0, drive2:1.8, asym2:0.22},
    bassBoost:{freq:75, db:6}, revTail:0.12, revDecay:2.1, revWet:0.16, outGain:1.4, peak:0.97 },

  // 2. KICK punchy — transitoire net + fold
  { name:'KICK', attack:0.0006, hold:0.006, decay:0.19, curvePow:2.0, attackClick:0.8,
    layers:[
      {rate:0.32, filter:'lowpass', freq:(a) => clamp(a.fundamental*3.4,150,650), q:0.8, gain:0.9, offsetMax:0.7},
      {rate:1.7, filter:'bandpass', freq:(a) => 800+a.brightness*3000, q:1.0, gain:0.55, holdMul:0, decayMul:0.15, offsetMax:0.3}
    ],
    sub:{enabled:true, rate:0.24, cutoff:(a) => clamp(a.fundamental*0.9,45,100), drive:2.1, gain:0.75, decayMul:0.8},
    sat:{drive1:3.4, asym1:0.2, foldAmt:0.35, drive2:2.2, asym2:0.28},
    bassBoost:{freq:85, db:7}, revTail:0.05, revDecay:1.6, revWet:0.12,
    crush:{chance:0.35, bits:9, hold:2}, outGain:1.45, peak:0.97 },

  // 3. THUD mat — mi-grave, léger comb pour un corps sourd
  { name:'THUD', attack:0.0009, hold:0.01, decay:0.3, curvePow:1.7, attackClick:0.6,
    layers:[
      {rate:0.4, filter:'lowpass', freq:(a) => clamp(a.fundamental*5,180,700), q:0.7, gain:0.85, offsetMax:0.75},
      {rate:0.55, filter:'bandpass', freq:(a) => clamp(a.midPeak*0.6,250,1200), q:1.3, gain:0.35, decayMul:0.6, offsetMax:0.6}
    ],
    comb:{enabled:true, delayMs:9, feedback:0.25, mix:0.3, invert:false},
    sat:{drive1:2.8, asym1:0.18, foldAmt:0, drive2:2.0, asym2:0.24},
    bassBoost:{freq:100, db:5}, revTail:0.14, revDecay:1.9, revWet:0.18, outGain:1.35, peak:0.96 },

  // 4. SNAP tonale — corps + crack aigu, léger phaser
  { name:'SNAP', attack:0.0006, hold:0.004, decay:0.1, curvePow:2.1, attackClick:0.75,
    layers:[
      {rate:0.55, filter:'bandpass', freq:(a) => clamp(a.fundamental*1.4,150,320), q:1.3, gain:0.85, offsetMax:0.6},
      {rate:2.4, filter:'highpass', freq:(a) => 2600+a.brightness*3200, q:0.9, gain:0.5, decayMul:0.7, offsetMax:0.4}
    ],
    phaser:{stages:2, baseFreq:(a) => clamp(a.midPeak,600,2000), spread:400, sweep:false},
    sat:{drive1:2.6, asym1:0.16, foldAmt:0, drive2:2.0, asym2:0.24},
    bassBoost:{freq:130, db:4}, revTail:0.09, revDecay:1.8, revWet:0.2, outGain:1.3, peak:0.96 },

  // 5. CRACK sec — comb inversé (annulation de phase ciblée)
  { name:'CRACK', attack:0.0005, hold:0.003, decay:0.13, curvePow:2.3, attackClick:0.7,
    layers:[
      {rate:2.0, filter:'highpass', freq:(a) => 3000+a.brightness*3500, q:0.8, gain:0.75, offsetMax:0.45},
      {rate:0.7, filter:'bandpass', freq:(a) => clamp(a.midPeak,700,2400), q:1.5, gain:0.4, decayMul:0.6, offsetMax:0.6}
    ],
    comb:{enabled:true, delayMs:3.2, feedback:0.2, mix:0.4, invert:true},
    sat:{drive1:3.0, asym1:0.2, foldAmt:0.2, drive2:2.1, asym2:0.26},
    revTail:0.08, revDecay:1.7, revWet:0.16, outGain:1.3, peak:0.95 },

  // 6. BUZZ phasé — phaser à balayage marqué
  { name:'BUZZ', attack:0.0008, hold:0.01, decay:0.24, curvePow:1.8, attackClick:0.6,
    layers:[
      {rate:1.5, filter:'bandpass', freq:(a) => clamp(a.midPeak,700,2600), q:1.5, gain:0.8, offsetMax:0.65},
      {rate:0.9, filter:'highpass', freq:() => 1800, q:0.8, gain:0.4, decayMul:0.8, offsetMax:0.5}
    ],
    phaser:{stages:4, baseFreq:(a) => clamp(a.midPeak*0.7,400,1400), spread:600, sweep:true, sweepRate:2.4},
    sat:{drive1:3.2, asym1:0.22, foldAmt:0.3, drive2:2.0, asym2:0.28},
    revTail:0.16, revDecay:1.8, revWet:0.22, outGain:1.3, peak:0.95 },

  // 7. RING métallique — comb très court (résonance) + fold
  { name:'RING', attack:0.0004, hold:0.002, decay:0.14, curvePow:1.9, attackClick:0.65,
    layers:[
      {rate:2.6, filter:'highpass', freq:(a) => 4000+a.brightness*4000, q:1.0, gain:0.75, offsetMax:0.5},
      {rate:3.4, filter:'bandpass', freq:(a) => clamp(a.centroid*0.8,1500,6000), q:2.2, gain:0.5, decayMul:0.7, offsetMax:0.4}
    ],
    comb:{enabled:true, delayMs:1.1, feedback:0.45, mix:0.5, invert:false},
    sat:{drive1:2.4, asym1:0.1, foldAmt:0.45, drive2:1.8, asym2:0.2},
    revTail:0.1, revDecay:1.6, revWet:0.14, outGain:1.15, peak:0.9 },

  // 8. TICK ultra-court — transitoire quasi sec
  { name:'TICK', attack:0.00012, hold:0.001, decay:0.02, curvePow:2.6, attackClick:0.4,
    layers:[
      {rate:3.6, filter:'highpass', freq:(a) => 5500+a.brightness*4500, q:0.9, gain:0.9, offsetMax:0.55}
    ],
    sat:{drive1:1.8, asym1:0.06, foldAmt:0, drive2:1.4, asym2:0.1},
    revTail:0, outGain:1.1, peak:0.88 },

  // 9. GLASS clair — aigu, léger phaser
  { name:'GLASS', attack:0.0004, hold:0.006, decay:0.08, curvePow:1.7, attackClick:0.45,
    layers:[
      {rate:2.1, filter:'highpass', freq:(a) => 3600+a.brightness*3600, q:0.9, gain:0.85, offsetMax:0.6}
    ],
    phaser:{stages:2, baseFreq:(a) => clamp(a.centroid,2000,6000), spread:800, sweep:true, sweepRate:1.2},
    sat:{drive1:1.7, asym1:0.06, foldAmt:0, drive2:1.4, asym2:0.1},
    revTail:0.1, revDecay:1.6, revWet:0.22, outGain:1.15, peak:0.9 },

  // 10. WASH aéré — long, grande reverb, phaser lent
  { name:'WASH', attack:0.0006, hold:0.05, decay:1.0, curvePow:0.7, attackClick:0.35,
    layers:[
      {rate:1.8, filter:'highpass', freq:(a) => 3000+a.brightness*3000, q:0.8, gain:0.85, offsetMax:0.6}
    ],
    phaser:{stages:3, baseFreq:(a) => clamp(a.centroid*0.6,1200,3500), spread:900, sweep:true, sweepRate:0.5},
    sat:{drive1:1.6, asym1:0.06, foldAmt:0, drive2:1.3, asym2:0.08},
    revTail:0.55, revDecay:1.5, revWet:0.4, outGain:1.1, peak:0.87 },

  // 11. BEND glissant — pitch-sweep + léger comb
  { name:'BEND', attack:0.0008, hold:0.003, decay:0.17, curvePow:2.0, attackClick:0.6,
    layers:[
      {pitchBend:{from:1.1, to:2.6, dur:0.15}, filter:'bandpass', freq:(a) => clamp(a.midPeak,500,3000), q:1.4, gain:0.85, offsetMax:0.7}
    ],
    comb:{enabled:true, delayMs:12, feedback:0.3, mix:0.28, invert:false},
    sat:{drive1:2.4, asym1:0.16, foldAmt:0, drive2:1.9, asym2:0.22},
    revTail:0.15, revDecay:1.7, revWet:0.22, outGain:1.25, peak:0.94 },

  // 12. SWELL inversé — sample joué à l'envers, montée puis coupure nette
  { name:'SWELL', attack:0.14, hold:0.0, decay:0.05, curvePow:1.0, attackClick:0.15,
    layers:[
      {rate:0.6, filter:'bandpass', freq:(a) => clamp(a.midPeak,400,2200), q:1.0, gain:0.9, reverse:true, offsetMax:0.5}
    ],
    sat:{drive1:1.9, asym1:0.1, foldAmt:0, drive2:1.5, asym2:0.12},
    revTail:0.25, revDecay:1.8, revWet:0.3, outGain:1.2, peak:0.92 },

  // 13. STUTTER glitché — enveloppe très courte + comb feedback élevé + bitcrush
  { name:'STUTTER', attack:0.0004, hold:0.002, decay:0.05, curvePow:2.5, attackClick:0.7,
    layers:[
      {rate:1.3, filter:'bandpass', freq:(a) => clamp(a.midPeak,400,2600), q:1.6, gain:0.85, offsetMax:0.8}
    ],
    comb:{enabled:true, delayMs:6, feedback:0.65, mix:0.5, invert:false},
    sat:{drive1:3.0, asym1:0.2, foldAmt:0.4, drive2:2.2, asym2:0.3},
    crush:{chance:0.85, bits:5, hold:3}, revTail:0.06, revDecay:1.5, revWet:0.12, outGain:1.3, peak:0.95 },

  // 14. CRUSH replié — wavefolder + bitcrush lourd
  { name:'CRUSH', attack:0.0006, hold:0.004, decay:0.15, curvePow:2.1, attackClick:0.65,
    layers:[
      {rate:0.85, filter:'bandpass', freq:(a) => clamp(a.midPeak,500,2400), q:1.2, gain:0.9, offsetMax:0.7}
    ],
    sat:{drive1:2.6, asym1:0.18, foldAmt:0.55, drive2:2.4, asym2:0.32},
    crush:{chance:0.9, bits:6, hold:3}, revTail:0.08, revDecay:1.6, revWet:0.14, outGain:1.3, peak:0.95 },

  // 15. PHASE ambiante — nombreux étages allpass, sweep lent, texture longue
  { name:'PHASE', attack:0.0025, hold:0.05, decay:0.9, curvePow:0.9, attackClick:0.3,
    layers:[
      {rate:0.5, filter:'bandpass', freq:(a) => clamp(a.midPeak*0.8,300,1800), q:1.0, gain:0.85, offsetMax:0.6}
    ],
    phaser:{stages:6, baseFreq:(a) => clamp(a.fundamental*3,200,900), spread:700, sweep:true, sweepRate:0.35},
    sat:{drive1:1.8, asym1:0.08, foldAmt:0, drive2:1.4, asym2:0.1},
    revTail:0.5, revDecay:1.6, revWet:0.35, outGain:1.15, peak:0.9 },

  // 16. GROWL grave — très saturé et asymétrique
  { name:'GROWL', attack:0.0012, hold:0.015, decay:0.34, curvePow:1.6, attackClick:0.7,
    layers:[
      {rate:0.3, filter:'lowpass', freq:(a) => clamp(a.fundamental*3.5,110,450), q:0.9, gain:0.9, offsetMax:0.7}
    ],
    sub:{enabled:true, rate:0.2, cutoff:(a) => clamp(a.fundamental*0.65,40,85), drive:2.6, gain:1.0, decayMul:1.0},
    sat:{drive1:4.2, asym1:0.4, foldAmt:0.15, drive2:2.8, asym2:0.42},
    bassBoost:{freq:70, db:7}, revTail:0.1, revDecay:1.9, revWet:0.15, outGain:1.45, peak:0.97 },

  // 17. PERC clic — transitoire net + comb léger
  { name:'PERC', attack:0.0004, hold:0.002, decay:0.09, curvePow:2.2, attackClick:0.75,
    layers:[
      {rate:1.6, filter:'bandpass', freq:(a) => clamp(a.midPeak,500,2800), q:1.5, gain:0.9, offsetMax:0.55}
    ],
    comb:{enabled:true, delayMs:5, feedback:0.2, mix:0.25, invert:false},
    sat:{drive1:2.3, asym1:0.14, foldAmt:0, drive2:1.8, asym2:0.2},
    revTail:0.09, revDecay:1.7, revWet:0.18, outGain:1.25, peak:0.95 },

  // 18. BELL aérienne — résonance à Q élevé façon cloche, phaser subtil
  { name:'BELL', attack:0.0015, hold:0.01, decay:0.6, curvePow:1.2, attackClick:0.4,
    layers:[
      {rate:1.1, filter:'bandpass', freq:(a) => clamp(a.midPeak*1.3,600,3200), q:6.5, gain:0.9, offsetMax:0.55}
    ],
    phaser:{stages:2, baseFreq:(a) => clamp(a.midPeak,600,2400), spread:500, sweep:true, sweepRate:0.8},
    sat:{drive1:1.6, asym1:0.06, foldAmt:0, drive2:1.3, asym2:0.08},
    revTail:0.3, revDecay:1.7, revWet:0.3, outGain:1.15, peak:0.9 },

  // 19. DARK wash — long, sombre, sub renforcé, phaser lent, grande reverb
  { name:'DARK', attack:0.0018, hold:0.06, decay:1.2, curvePow:0.9, attackClick:0.3,
    layers:[
      {rate:0.35, filter:'lowpass', freq:(a) => clamp(a.fundamental*3,150,600), q:0.8, gain:0.85, offsetMax:0.6}
    ],
    sub:{enabled:true, rate:0.2, cutoff:(a) => clamp(a.fundamental*0.7,40,90), drive:1.6, gain:0.7, decayMul:1.1},
    phaser:{stages:3, baseFreq:(a) => clamp(a.fundamental*2.5,150,700), spread:500, sweep:true, sweepRate:0.3},
    sat:{drive1:2.0, asym1:0.12, foldAmt:0, drive2:1.6, asym2:0.16},
    bassBoost:{freq:80, db:5}, revTail:0.7, revDecay:1.6, revWet:0.4, outGain:1.25, peak:0.93 },

  // 20. CHAOS blast — combo agressif : fold + phaser + comb + bitcrush
  { name:'CHAOS', attack:0.0004, hold:0.004, decay:0.13, curvePow:2.0, attackClick:0.85,
    layers:[
      {rate:1.4, filter:'bandpass', freq:(a) => clamp(a.midPeak,500,2600), q:1.4, gain:0.85, offsetMax:0.7},
      {rate:2.8, filter:'highpass', freq:(a) => 3200+a.brightness*3500, q:0.9, gain:0.5, decayMul:0.5, offsetMax:0.4}
    ],
    phaser:{stages:3, baseFreq:(a) => clamp(a.midPeak*0.9,500,1800), spread:700, sweep:true, sweepRate:3.2},
    comb:{enabled:true, delayMs:4.5, feedback:0.4, mix:0.35, invert:true},
    sat:{drive1:3.6, asym1:0.24, foldAmt:0.5, drive2:2.6, asym2:0.34},
    crush:{chance:0.6, bits:6, hold:2}, bassBoost:{freq:95, db:5}, revTail:0.12, revDecay:1.7, revWet:0.18, outGain:1.4, peak:0.97 }
];

export function flavorAt(idx) {
  return FLAVORS[idx % FLAVORS.length];
}
