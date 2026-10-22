// Faux OfflineAudioContext enregistreur : chaque nœud créé, paramètre fixé,
// courbe, buffer, connexion et départ est consigné dans `trace`, au même
// format que la trace du golden master. Permet de tester le renderer sans
// navigateur, par snapshot du graphe construit.

function checksum(f32) {
  const b = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
  let h = 2166136261;
  for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

function fmt(v) {
  if (typeof v === 'number') return String(v);
  if (v instanceof Float32Array) return `f32[${v.length}:${checksum(v)}]`;
  if (v && v.__isBuffer) return `buf[${v.length}@${v.sampleRate}:${checksum(v.getChannelData(0))}]`;
  if (v && v.__id) return v.__id;
  return String(v);
}

export function fakeBuffer(channels, sampleRate, tag) {
  const buf = {
    __isBuffer: true,
    __id: tag,
    sampleRate,
    length: channels[0].length,
    duration: channels[0].length / sampleRate,
    numberOfChannels: channels.length,
    getChannelData: (ch) => channels[ch],
  };
  return buf;
}

// signal de rendu déterministe : rampe sinusoïdale d'amplitude 0,5
function renderedSignal(length) {
  const d = new Float32Array(length);
  for (let i = 0; i < length; i++) d[i] = 0.5 * Math.sin(i * 0.05) * (1 - i / length);
  return d;
}

export function createFakeOfflineContextCtor(trace) {
  let counter = 0;
  const nextId = () => 'n' + (++counter);

  function param(ownerId, name) {
    const p = { __id: `${ownerId}.${name}`, _v: 0 };
    Object.defineProperty(p, 'value', {
      get: () => p._v,
      set: (x) => { p._v = x; trace.push(`set ${p.__id} ${fmt(x)}`); },
    });
    for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'setValueCurveAtTime']) {
      p[m] = (...args) => { trace.push(`${m} ${p.__id} ${args.map(fmt).join(' ')}`); };
    }
    return p;
  }

  function node(kind, paramNames, args) {
    const n = { __id: nextId() };
    trace.push(`${kind} ${n.__id}${args.length ? ' ' + args.map(fmt).join(' ') : ''}`);
    for (const name of paramNames) n[name] = param(n.__id, name);
    n.connect = (dest) => { trace.push(`connect ${n.__id} -> ${fmt(dest)}`); };
    n.start = (...a) => { trace.push(`start ${n.__id} ${a.map(fmt).join(' ')}`); };
    n.stop = (...a) => { trace.push(`stop ${n.__id} ${a.map(fmt).join(' ')}`); };
    return new Proxy(n, {
      set(target, key, value) {
        if (['buffer', 'curve', 'oversample', 'type'].includes(key)) trace.push(`prop ${n.__id}.${key} ${fmt(value)}`);
        target[key] = value;
        return true;
      },
    });
  }

  return function FakeOfflineAudioContext(channels, length, sampleRate) {
    const ctx = { __id: nextId(), sampleRate, destination: { __id: 'destination' } };
    trace.push(`ctx ${ctx.__id} ${channels} ${length} ${sampleRate}`);
    ctx.createGain = () => node('createGain', ['gain'], []);
    ctx.createBufferSource = () => node('createBufferSource', ['playbackRate', 'detune'], []);
    ctx.createBiquadFilter = () => node('createBiquadFilter', ['frequency', 'Q', 'gain', 'detune'], []);
    ctx.createWaveShaper = () => node('createWaveShaper', [], []);
    ctx.createOscillator = () => node('createOscillator', ['frequency', 'detune'], []);
    ctx.createDelay = (max) => node('createDelay', ['delayTime'], [max]);
    ctx.createConvolver = () => node('createConvolver', [], []);
    ctx.createDynamicsCompressor = () => node('createDynamicsCompressor', ['threshold', 'knee', 'ratio', 'attack', 'release'], []);
    ctx.createBuffer = (ch, len, sr) => {
      const buf = fakeBuffer(Array.from({ length: ch }, () => new Float32Array(len)), sr, nextId());
      trace.push(`createBuffer ${buf.__id} ${ch} ${len} ${sr}`);
      return buf;
    };
    ctx.startRendering = () => {
      trace.push(`startRendering ${ctx.__id}`);
      return Promise.resolve(fakeBuffer([renderedSignal(length)], sampleRate, 'rendered'));
    };
    return ctx;
  };
}
