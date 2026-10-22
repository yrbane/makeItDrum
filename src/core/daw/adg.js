// Export Ableton Drum Rack (.adg = XML gzippé) : le gabarit vient d'un preset
// écrit par Live (voir scripts/make-adg-template.mjs), une chaîne Simpler est
// clonée par pad avec sa note, son fichier et ses longueurs.
import { ADG_WRAPPER_GZ, ADG_BRANCH_GZ } from './adg-template.js';

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

async function gunzipText(b64) {
  const bytes = await pipe(base64ToBytes(b64), new DecompressionStream('gzip'));
  return new TextDecoder().decode(bytes);
}

let cached = null;
export function loadTemplates() {
  if (!cached) {
    cached = Promise.all([gunzipText(ADG_WRAPPER_GZ), gunzipText(ADG_BRANCH_GZ)])
      .then(function ([wrapper, branch]) { return { wrapper, branch }; });
  }
  return cached;
}

export function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fill(template, values) {
  return template.replace(/@@([A-Z]+)@@/g, function (m, key) {
    if (!(key in values)) throw new Error('marqueur inconnu ' + key);
    return values[key];
  });
}

// pads : [{ index, flavor, note, file, frames, sampleRate, bytes, seed }], file = null si le pad est vide
export function buildDrumRackXml({ name, pads, modDate = Math.floor(Date.now() / 1000) }, { wrapper, branch }) {
  const branches = pads
    .filter(function (p) { return p.file; })
    .map(function (p) {
      return fill(branch, {
        INDEX: String(p.index),
        NAME: escapeXml(String(p.index + 1).padStart(2, '0') + ' ' + p.flavor),
        FILE: escapeXml(p.file),
        END: String(Math.max(0, p.frames - 1)),
        FRAMES: String(p.frames),
        RATE: String(p.sampleRate),
        BYTES: String(p.bytes),
        MODDATE: String(modDate),
        SEED: String((p.seed >>> 0) || 0),
        NOTE: String(p.note),
      });
    })
    .join('');
  return fill(wrapper, { RACKNAME: escapeXml(name), BRANCHES: branches });
}

export async function buildAdg(kit) {
  const xml = buildDrumRackXml(kit, await loadTemplates());
  return pipe(new TextEncoder().encode(xml), new CompressionStream('gzip'));
}
