// Archive ZIP « store » et CRC-32.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, buildZip } from '../../src/core/zip.js';

const FILES = [
  { name: 'a.txt', data: new TextEncoder().encode('hello') },
  { name: 'b.bin', data: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]) },
];

test('crc32 du vecteur de référence « 123456789 »', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('la structure locale, centrale et de fin est cohérente', () => {
  const zip = buildZip(FILES);
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  const endOff = zip.length - 22;
  assert.equal(v.getUint32(endOff, true), 0x06054b50);
  assert.equal(v.getUint16(endOff + 8, true), 2);
  assert.equal(v.getUint16(endOff + 10, true), 2);
  const localsSize = FILES.reduce((s, f) => s + 30 + f.name.length + f.data.length, 0);
  assert.equal(v.getUint32(endOff + 16, true), localsSize);
  assert.equal(v.getUint32(endOff + 12, true), FILES.reduce((s, f) => s + 46 + f.name.length, 0));
});

test('unzip -t accepte l\'archive', (t) => {
  let unzipAvailable = true;
  try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); } catch { unzipAvailable = false; }
  if (!unzipAvailable) return t.skip('unzip absent');
  const dir = mkdtempSync(join(tmpdir(), 'mid-zip-'));
  const path = join(dir, 'test.zip');
  writeFileSync(path, buildZip(FILES));
  const out = execFileSync('unzip', ['-t', path], { encoding: 'utf8' });
  assert.match(out, /No errors detected/);
});
