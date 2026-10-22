// Format de kit : `kit.json` (schéma v1) + 20 WAV nommés `NN_FLAVOR.wav`,
// partagé avec le plugin. Lit aussi le pack historique `makeitdrum_NN.wav`.
import { FLAVORS } from './flavors.js';
import { encodeWav } from './wav.js';

export const KIT_SCHEMA_VERSION = 1;
// note General MIDI du premier pad (C1) ; pad i → 36 + i
export const BASE_NOTE = 36;
const MAX_PADS = 20;
const LEGACY = /^(?:.*\/)?makeitdrum_(\d{2})\.wav$/i;

export function padFileName(index, flavor) {
  return String(index + 1).padStart(2, '0') + '_' + flavor + '.wav';
}

function flavorName(index) {
  return FLAVORS[index] ? FLAVORS[index].name : String(index + 1).padStart(2, '0');
}

function stem(name) {
  const base = name.split('/').pop();
  return base.replace(/\.[^.]+$/, '');
}

// pads : [{ index, flavor, seed, note? }] → objet du manifeste, sans audio
export function buildManifest({ name, engineVersion, createdAt, source, pads }) {
  return {
    schemaVersion: KIT_SCHEMA_VERSION,
    app: 'make-it-drum',
    engineVersion: engineVersion || null,
    name,
    createdAt: createdAt || null,
    source: source || null,
    pads: pads.map((p) => ({
      index: p.index,
      flavor: p.flavor,
      seed: Number.isInteger(p.seed) ? p.seed : null,
      note: Number.isInteger(p.note) ? p.note : BASE_NOTE + p.index,
      file: padFileName(p.index, p.flavor),
    })),
  };
}

export function parseManifest(text) {
  let m;
  try { m = JSON.parse(text); } catch (e) { throw new Error('kit.json illisible'); }
  if (!m || m.schemaVersion !== KIT_SCHEMA_VERSION) throw new Error('kit.json : schemaVersion non pris en charge');
  if (!Array.isArray(m.pads)) throw new Error('kit.json : liste de pads absente');
  const pads = m.pads.map((p, i) => {
    if (!p || typeof p.file !== 'string') throw new Error('kit.json : pad sans file');
    const index = Number.isInteger(p.index) ? p.index : i;
    return {
      index,
      flavor: typeof p.flavor === 'string' ? p.flavor : flavorName(index),
      seed: Number.isInteger(p.seed) ? p.seed : null,
      note: Number.isInteger(p.note) ? p.note : BASE_NOTE + index,
      file: p.file,
    };
  });
  return {
    name: typeof m.name === 'string' ? m.name : null,
    engineVersion: typeof m.engineVersion === 'string' ? m.engineVersion : null,
    createdAt: typeof m.createdAt === 'string' ? m.createdAt : null,
    source: m.source && typeof m.source === 'object' ? m.source : null,
    pads,
  };
}

// kit : { name, engineVersion, createdAt, source, pads: [{ index, flavor, seed, note?, samples, sampleRate }] }
// → fichiers pour buildZip : kit.json puis les WAV
export function packKit(kit) {
  const manifest = buildManifest(kit);
  const files = [{ name: 'kit.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) }];
  kit.pads.forEach((p, i) => {
    files.push({ name: manifest.pads[i].file, data: new Uint8Array(encodeWav(p.samples, p.sampleRate)) });
  });
  return files;
}

// entries : [{ name, data }] d'une archive → { name, source, pads: [{ index, flavor, seed, note, file, wav }] }
export function unpackKit(entries, fallbackName = 'kit') {
  const byName = new Map(entries.map((e) => [e.name, e]));
  const manifestEntry = entries.find((e) => e.name === 'kit.json' || e.name.endsWith('/kit.json'));
  if (manifestEntry) {
    const prefix = manifestEntry.name.slice(0, -'kit.json'.length);
    const m = parseManifest(new TextDecoder().decode(manifestEntry.data));
    const pads = m.pads.slice(0, MAX_PADS).map((p) => {
      const e = byName.get(prefix + p.file);
      if (!e) throw new Error('fichier absent du kit : ' + p.file);
      return { ...p, wav: e.data };
    });
    return { name: m.name || fallbackName, engineVersion: m.engineVersion, createdAt: m.createdAt, source: m.source, pads };
  }
  const legacy = entries
    .map((e) => ({ e, n: Number((LEGACY.exec(e.name) || [])[1]) }))
    .filter(({ n }) => n >= 1 && n <= MAX_PADS)
    .sort((a, b) => a.n - b.n);
  const wavs = legacy.length
    ? legacy.map(({ e, n }) => ({ e, flavor: flavorName(n - 1) }))
    : entries.filter((e) => /\.wav$/i.test(e.name)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, MAX_PADS).map((e) => ({ e, flavor: stem(e.name) }));
  if (!wavs.length) throw new Error('aucun fichier WAV dans cette archive');
  const pads = wavs.map(({ e, flavor }, index) => ({ index, flavor, seed: null, note: BASE_NOTE + index, file: e.name, wav: e.data }));
  return { name: fallbackName, engineVersion: null, createdAt: null, source: null, pads };
}
