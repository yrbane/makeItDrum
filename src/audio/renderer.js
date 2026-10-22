// Moteur : transformation du son importé, pas de génération.
// Chaque percussion est construite EXCLUSIVEMENT à partir du sample importé
// (et de sa copie inversée). Ce qui change le caractère d'une percu à l'autre,
// c'est la façon dont le sample est découpé, filtré, ré-enveloppé et dont sa
// phase est retravaillée (allpass en cascade, comb en feedback), puis la
// saturation multi-étages et un renfort de basses dérivé du sample lui-même.
//
// L'ordre des briques ci-dessous est aussi l'ordre des tirages aléatoires :
// il doit rester identique pour que deux rendus à graine égale coïncident.
import { clamp } from '../core/math.js';
import { makeSatCurve, makeFoldCurve, scaledEnv } from '../core/curves.js';
import { makeImpulseBuffer } from './buffers.js';
import { postprocess } from './postprocess.js';

function safeStart(src, offset) {
  try { src.start(0, offset || 0); } catch (e) { try { src.start(0); } catch (e2) { /* déjà démarrée */ } }
}

// durées communes : palier et chute varient à chaque rendu
function computeTimings(cfg, sr, rng) {
  const attack = cfg.attack;
  const hold = rng.jitter(cfg.hold, 0.3);
  const decay = rng.jitter(cfg.decay, 0.25);
  const total = attack + hold + decay;
  const revTail = cfg.revTail ? rng.jitter(cfg.revTail, 0.3) : 0;
  const tailPad = 0.1 + (cfg.phaser && cfg.phaser.stages ? 0.08 : 0) + (cfg.comb && cfg.comb.enabled ? 0.08 : 0);
  const length = Math.max(2, Math.ceil((total + revTail + tailPad) * sr));
  return { sr, attack, hold, decay, total, revTail, tailPad, length };
}

// transient d'attaque : petit éclat sec pris littéralement au tout début du
// sample (l'attaque réelle du son d'origine), passe-haut et saturé
function addTransient(ctx, cfg, t, sample, rng, mix) {
  const src = ctx.createBufferSource();
  src.buffer = sample.originalBuffer;
  src.playbackRate.value = rng.jitter(2.0, 0.25);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = clamp(rng.jitter(900 + sample.analysis.brightness * 2500, 0.25), 300, t.sr * 0.45);
  const shaper = ctx.createWaveShaper();
  shaper.curve = makeSatCurve(rng.jitter(3.4, 0.25), 0.22);
  shaper.oversample = '2x';
  const env = ctx.createGain();
  const clickDur = rng.jitter(0.007, 0.3);
  const clickGain = cfg.attackClick !== undefined ? cfg.attackClick : 0.55;
  env.gain.setValueCurveAtTime(scaledEnv(0.00015, 0, clickDur, 3.4, rng.jitter(clickGain, 0.2)), 0, 0.00015 + clickDur);
  src.connect(hp); hp.connect(shaper); shaper.connect(env); env.connect(mix);
  safeStart(src, 0);
}

// couches directement issues du sample (offset / vitesse / filtre variables)
function addLayer(ctx, cfg, layer, t, sample, rng, mix) {
  const a = sample.analysis;
  const buf = layer.reverse ? sample.reversedBuffer : sample.originalBuffer;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  if (layer.pitchBend) {
    const bendDur = rng.jitter(layer.pitchBend.dur !== undefined ? layer.pitchBend.dur : t.total * 0.6, 0.3);
    src.playbackRate.setValueAtTime(rng.jitter(layer.pitchBend.from, 0.15), 0);
    src.playbackRate.linearRampToValueAtTime(rng.jitter(layer.pitchBend.to, 0.15), bendDur);
  } else {
    src.playbackRate.value = rng.jitter(layer.rate, 0.15);
  }
  let node = src;
  if (layer.filter) {
    const f = ctx.createBiquadFilter();
    f.type = layer.filter;
    f.frequency.value = clamp(rng.jitter(layer.freq(a), 0.22), 30, t.sr * 0.45);
    f.Q.value = rng.jitter(layer.q || 1, 0.3);
    node.connect(f); node = f;
  }
  if (layer.invert) {
    const inv = ctx.createGain();
    inv.gain.value = -1;
    node.connect(inv); node = inv;
  }
  const holdL = t.hold * (layer.holdMul !== undefined ? layer.holdMul : 1);
  const decayL = t.decay * (layer.decayMul !== undefined ? layer.decayMul : 1);
  const g = ctx.createGain();
  g.gain.setValueCurveAtTime(scaledEnv(t.attack, holdL, decayL, cfg.curvePow, layer.gain), 0, t.attack + holdL + decayL);
  node.connect(g); g.connect(mix);
  safeStart(src, rng.randomOffset(buf.duration, layer.offsetMax !== undefined ? layer.offsetMax : 0.75));
}

// renfort de basses : copie du sample filtrée passe-bas + saturation
// asymétrique (génère les harmoniques graves manquantes), pas de sub sinus
function addSub(ctx, cfg, t, sample, rng, mix) {
  const sub = cfg.sub;
  const src = ctx.createBufferSource();
  src.buffer = sample.originalBuffer;
  src.playbackRate.value = rng.jitter(sub.rate, 0.15);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = clamp(rng.jitter(sub.cutoff(sample.analysis), 0.2), 35, 220);
  const drive = ctx.createWaveShaper();
  drive.curve = makeSatCurve(rng.jitter(sub.drive, 0.2), 0.32);
  drive.oversample = '4x';
  const decayL = t.decay * (sub.decayMul !== undefined ? sub.decayMul : 1);
  const env = ctx.createGain();
  env.gain.setValueCurveAtTime(scaledEnv(t.attack, t.hold, decayL, cfg.curvePow, sub.gain), 0, t.attack + t.hold + decayL);
  src.connect(lp); lp.connect(drive); drive.connect(env); env.connect(mix);
  safeStart(src, rng.randomOffset(sample.originalBuffer.duration, 0.7));
}

// réseau de phase : allpass en cascade, éventuellement balayés par un LFO
function addPhaser(ctx, cfg, t, sample, rng, input) {
  const ph = cfg.phaser;
  let node = input;
  let lfoDepth = null;
  if (ph.sweep) {
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = rng.jitter(ph.sweepRate, 0.3);
    lfoDepth = ctx.createGain();
    lfoDepth.gain.value = rng.jitter(ph.spread * 0.5, 0.3);
    lfo.connect(lfoDepth);
    lfo.start(0);
    lfo.stop(t.total + t.revTail + t.tailPad);
  }
  for (let s = 0; s < ph.stages; s++) {
    const ap = ctx.createBiquadFilter();
    ap.type = 'allpass';
    ap.frequency.value = clamp(rng.jitter(ph.baseFreq(sample.analysis) * Math.pow(1.55, s), 0.25), 60, t.sr * 0.45);
    ap.Q.value = rng.jitter(0.7, 0.3);
    if (lfoDepth) lfoDepth.connect(ap.frequency);
    node.connect(ap); node = ap;
  }
  return node;
}

// comb / phase courte : mélange avec une copie retardée en feedback
function addComb(ctx, cfg, rng, input) {
  const comb = cfg.comb;
  const delay = ctx.createDelay(0.05);
  delay.delayTime.value = rng.jitter(comb.delayMs / 1000, 0.3);
  const fb = ctx.createGain();
  fb.gain.value = rng.jitter(comb.feedback, 0.3);
  const combGain = ctx.createGain();
  combGain.gain.value = (comb.invert ? -1 : 1) * rng.jitter(comb.mix, 0.3);
  const out = ctx.createGain();
  input.connect(delay); delay.connect(fb); fb.connect(delay);
  input.connect(out);
  delay.connect(combGain); combGain.connect(out);
  return out;
}

// saturation multi-étages (punch) + repliement optionnel (grain plus sale)
function addSaturation(ctx, cfg, rng, input) {
  const sat = cfg.sat;
  const drive1 = ctx.createWaveShaper();
  drive1.curve = makeSatCurve(rng.jitter(sat.drive1, 0.22), sat.asym1 !== undefined ? sat.asym1 : 0.2);
  drive1.oversample = '4x';
  input.connect(drive1);
  let node = drive1;
  if (sat.foldAmt) {
    const fold = ctx.createWaveShaper();
    fold.curve = makeFoldCurve(rng.jitter(sat.foldAmt, 0.25));
    fold.oversample = '4x';
    drive1.connect(fold); node = fold;
  }
  const drive2 = ctx.createWaveShaper();
  drive2.curve = makeSatCurve(rng.jitter(sat.drive2, 0.22), sat.asym2 !== undefined ? sat.asym2 : 0.28);
  drive2.oversample = '4x';
  node.connect(drive2);
  return drive2;
}

// boost de basses (peaking EQ) pour plus de coffre
function addBassBoost(ctx, cfg, rng, input) {
  const bass = ctx.createBiquadFilter();
  bass.type = 'peaking';
  bass.frequency.value = rng.jitter(cfg.bassBoost.freq, 0.2);
  bass.Q.value = 0.9;
  bass.gain.value = rng.jitter(cfg.bassBoost.db, 0.2);
  input.connect(bass);
  return bass;
}

// reverb par convolution sur une impulsion synthétique, en parallèle du signal sec
function addReverb(ctx, cfg, t, rng, input, output) {
  const conv = ctx.createConvolver();
  conv.buffer = makeImpulseBuffer(ctx, t.revTail, rng.jitter(cfg.revDecay || 1.7, 0.25), rng.random);
  const wet = ctx.createGain();
  wet.gain.value = rng.jitter(cfg.revWet || 0.22, 0.3);
  input.connect(conv); conv.connect(wet); wet.connect(output);
}

// bus de sortie « qui tape » : compression rapide + gain de makeup
function connectMaster(ctx, node, driveOut, rng) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -17;
  comp.knee.value = 4;
  comp.ratio.value = rng.jitter(9, 0.2);
  comp.attack.value = 0.0008;
  comp.release.value = rng.jitter(0.09, 0.3);
  const out = ctx.createGain();
  out.gain.value = driveOut;
  node.connect(comp); comp.connect(out); out.connect(ctx.destination);
}

export function createRenderer({ rng, OfflineAudioContextCtor = globalThis.OfflineAudioContext }) {
  // sample = { originalBuffer, reversedBuffer, analysis }
  async function render(cfg, sample) {
    const t = computeTimings(cfg, sample.originalBuffer.sampleRate, rng);
    const ctx = new OfflineAudioContextCtor(1, t.length, t.sr);
    const mix = ctx.createGain();

    addTransient(ctx, cfg, t, sample, rng, mix);
    for (const layer of cfg.layers) addLayer(ctx, cfg, layer, t, sample, rng, mix);
    if (cfg.sub && cfg.sub.enabled) addSub(ctx, cfg, t, sample, rng, mix);

    let chain = mix;
    if (cfg.phaser && cfg.phaser.stages > 0) chain = addPhaser(ctx, cfg, t, sample, rng, chain);
    if (cfg.comb && cfg.comb.enabled) chain = addComb(ctx, cfg, rng, chain);
    chain = addSaturation(ctx, cfg, rng, chain);
    if (cfg.bassBoost) chain = addBassBoost(ctx, cfg, rng, chain);

    const finalMix = ctx.createGain();
    chain.connect(finalMix);
    if (t.revTail > 0.02) addReverb(ctx, cfg, t, rng, chain, finalMix);
    connectMaster(ctx, finalMix, rng.jitter(cfg.outGain || 1.3, 0.15), rng);

    const crush = cfg.crush ? rng.chance(cfg.crush.chance !== undefined ? cfg.crush.chance : 0.3) : false;
    const rendered = await ctx.startRendering();
    return postprocess(rendered, {
      crush,
      crushBits: cfg.crush ? cfg.crush.bits || 8 : 8,
      crushHold: cfg.crush ? cfg.crush.hold || 2 : 2,
      peak: cfg.peak !== undefined ? cfg.peak : 0.96,
    }, rng);
  }

  return { render };
}
