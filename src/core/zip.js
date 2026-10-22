// Archive ZIP en méthode « store » (sans compression), dates à zéro.

const CRC_TABLE = (function () {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function localHeader(nameBytes, crc, size) {
  const local = new Uint8Array(30 + nameBytes.length);
  const v = new DataView(local.buffer);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(4, 20, true);
  v.setUint32(14, crc, true);
  v.setUint32(18, size, true);
  v.setUint32(22, size, true);
  v.setUint16(26, nameBytes.length, true);
  local.set(nameBytes, 30);
  return local;
}

function centralHeader(nameBytes, crc, size, offset) {
  const central = new Uint8Array(46 + nameBytes.length);
  const v = new DataView(central.buffer);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(4, 20, true);
  v.setUint16(6, 20, true);
  v.setUint32(16, crc, true);
  v.setUint32(20, size, true);
  v.setUint32(24, size, true);
  v.setUint16(28, nameBytes.length, true);
  v.setUint32(42, offset, true);
  central.set(nameBytes, 46);
  return central;
}

function endRecord(count, centralSize, centralStart) {
  const end = new Uint8Array(22);
  const v = new DataView(end.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, count, true);
  v.setUint16(10, count, true);
  v.setUint32(12, centralSize, true);
  v.setUint32(16, centralStart, true);
  return end;
}

function concat(parts) {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

// files : [{ name, data: Uint8Array }] → octets de l'archive
export function buildZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = encoder.encode(f.name);
    const crc = crc32(f.data);
    const local = localHeader(nameBytes, crc, f.data.length);
    localParts.push(local, f.data);
    centralParts.push(centralHeader(nameBytes, crc, f.data.length, offset));
    offset += local.length + f.data.length;
  }
  const centralSize = centralParts.reduce((s, c) => s + c.length, 0);
  return concat([...localParts, ...centralParts, endRecord(files.length, centralSize, offset)]);
}

async function inflateRaw(raw) {
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// octets d'une archive → [{ name, data }] ; méthodes store et deflate
export async function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Ce fichier n'est pas une archive ZIP");
  const count = view.getUint16(eocd + 10, true);
  let off = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (view.getUint32(off, true) !== 0x02014b50) throw new Error('ZIP : répertoire central corrompu');
    const method = view.getUint16(off + 10, true);
    const csize = view.getUint32(off + 20, true);
    const nameLen = view.getUint16(off + 28, true);
    const extraLen = view.getUint16(off + 30, true);
    const commentLen = view.getUint16(off + 32, true);
    const localOff = view.getUint32(off + 42, true);
    const name = decoder.decode(bytes.subarray(off + 46, off + 46 + nameLen));
    const dataStart = localOff + 30 + view.getUint16(localOff + 26, true) + view.getUint16(localOff + 28, true);
    const raw = bytes.slice(dataStart, dataStart + csize);
    if (!name.endsWith('/')) {
      if (method === 0) entries.push({ name, data: raw });
      else if (method === 8) entries.push({ name, data: await inflateRaw(raw) });
      else throw new Error('ZIP : méthode de compression ' + method + ' non prise en charge');
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
