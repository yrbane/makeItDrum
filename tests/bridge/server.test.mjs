import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSocket } from 'node:dgram';
import { createBridgeServer, isAllowedOrigin, safeEntryPath } from '../../tools/bridge/server.mjs';
import { buildZip } from '../../src/core/zip.js';

function udpListener() {
  const sock = createSocket('udp4');
  const messages = [];
  sock.on('message', (m) => messages.push(JSON.parse(m.toString())));
  return new Promise((resolve) => sock.bind(0, '127.0.0.1', () => resolve({ port: sock.address().port, messages, close: () => sock.close() })));
}

test('isAllowedOrigin : fichier local, site de la démo, localhost ; rien d\'autre', () => {
  assert.equal(isAllowedOrigin('null'), true);
  assert.equal(isAllowedOrigin('https://yrbane.github.io'), true);
  assert.equal(isAllowedOrigin('http://localhost:8080'), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:5173'), true);
  assert.equal(isAllowedOrigin('https://evil.example'), false);
  assert.equal(isAllowedOrigin(undefined), false);
});

test('safeEntryPath refuse les chemins qui sortent du dossier', () => {
  assert.equal(safeEntryPath('Samples/01_BOOM.wav'), 'Samples/01_BOOM.wav');
  assert.equal(safeEntryPath('k.adg'), 'k.adg');
  assert.equal(safeEntryPath('../x'), null);
  assert.equal(safeEntryPath('/etc/passwd'), null);
  assert.equal(safeEntryPath('a\\..\\b'), null);
});

test('GET /health, OPTIONS, POST /kit écrit le kit dans la User Library et prévient le Remote Script', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mid-bridge-'));
  const udp = await udpListener();
  const server = createBridgeServer({ userLibrary: dir, port: 0, notifyPort: udp.port, version: '1.6.0' });
  const port = await server.listen();
  try {
    const base = 'http://127.0.0.1:' + port;
    const health = await (await fetch(base + '/health', { headers: { Origin: 'null' } })).json();
    assert.equal(health.app, 'makeitdrum-bridge');
    assert.equal(health.version, '1.6.0');
    assert.equal(health.userLibrary, dir);
    const pre = await fetch(base + '/kit', { method: 'OPTIONS', headers: { Origin: 'https://yrbane.github.io', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-origin'), 'https://yrbane.github.io');
    const zip = buildZip([
      { name: 'Mon kit.adg', data: new Uint8Array([0x1f, 0x8b, 1]) },
      { name: 'Mon kit.sfz', data: new TextEncoder().encode('<region>') },
      { name: 'Samples/01_BOOM.wav', data: new Uint8Array([1, 2, 3]) },
      { name: '../evil.txt', data: new Uint8Array([9]) },
    ]);
    const res = await fetch(base + '/kit', { method: 'POST', headers: { Origin: 'null', 'Content-Type': 'application/zip', 'X-Kit-Name': 'Mon kit' }, body: zip });
    assert.equal(res.status, 200);
    const body = await res.json();
    const kitDir = join(dir, 'Presets', 'Instruments', 'Drum Rack', 'make it drum', 'Mon kit');
    assert.equal(body.ok, true);
    assert.equal(body.path, join(kitDir, 'Mon kit.adg'));
    assert.equal(body.notified, true);
    assert.deepEqual(Array.from(readFileSync(join(kitDir, 'Samples', '01_BOOM.wav'))), [1, 2, 3]);
    assert.equal(existsSync(join(dir, 'evil.txt')), false);
    await new Promise((r) => setTimeout(r, 100));
    assert.deepEqual(udp.messages, [{ load: 'Mon kit', path: join(kitDir, 'Mon kit.adg') }]);
    const forbidden = await fetch(base + '/kit', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: zip });
    assert.equal(forbidden.status, 403);
    const noAdg = await fetch(base + '/kit', { method: 'POST', headers: { Origin: 'null', 'X-Kit-Name': 'x' }, body: buildZip([{ name: 'a.txt', data: new Uint8Array([1]) }]) });
    assert.equal(noAdg.status, 400);
  } finally {
    await server.close();
    udp.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
