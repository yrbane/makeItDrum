import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { buildZip, readZip, crc32 } from '../../src/core/zip.js';

test('readZip relit les entrées d\'une archive store produite par buildZip', async () => {
  const files = [{ name: 'a.txt', data: new TextEncoder().encode('hello') }, { name: 'dir/b.bin', data: new Uint8Array([1, 2, 3]) }];
  const entries = await readZip(buildZip(files));
  assert.deepEqual(entries.map((e) => e.name), ['a.txt', 'dir/b.bin']);
  assert.equal(new TextDecoder().decode(entries[0].data), 'hello');
  assert.deepEqual(Array.from(entries[1].data), [1, 2, 3]);
});

test('readZip décompresse une entrée deflate', async () => {
  const raw = new TextEncoder().encode('x'.repeat(1000));
  const deflated = new Uint8Array(deflateRawSync(raw));
  const name = new TextEncoder().encode('big.txt');
  const local = new Uint8Array(30 + name.length);
  const v = new DataView(local.buffer);
  v.setUint32(0, 0x04034b50, true); v.setUint16(8, 8, true); v.setUint32(14, crc32(raw), true);
  v.setUint32(18, deflated.length, true); v.setUint32(22, raw.length, true); v.setUint16(26, name.length, true);
  local.set(name, 30);
  const central = new Uint8Array(46 + name.length);
  const c = new DataView(central.buffer);
  c.setUint32(0, 0x02014b50, true); c.setUint16(10, 8, true); c.setUint32(16, crc32(raw), true);
  c.setUint32(20, deflated.length, true); c.setUint32(24, raw.length, true); c.setUint16(28, name.length, true); c.setUint32(42, 0, true);
  central.set(name, 46);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, 1, true); e.setUint16(10, 1, true);
  e.setUint32(12, central.length, true); e.setUint32(16, local.length + deflated.length, true);
  const zip = new Uint8Array([...local, ...deflated, ...central, ...end]);
  const entries = await readZip(zip);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].data.length, 1000);
});

test('readZip rejette ce qui n\'est pas un ZIP', async () => {
  await assert.rejects(readZip(new Uint8Array([1, 2, 3, 4])), /ZIP/);
});
