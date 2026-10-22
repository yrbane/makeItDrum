import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBridgeClient } from '../../src/bridge/client.js';

test('health renvoie les infos du compagnon, ou null s\'il est absent / en erreur / lent', async () => {
  const ok = createBridgeClient(async (url, opts) => {
    assert.equal(url, 'http://127.0.0.1:47800/health');
    assert.ok(opts.signal);
    return { ok: true, json: async () => ({ app: 'makeitdrum-bridge', version: '1.6.0' }) };
  });
  assert.deepEqual(await ok.health(), { app: 'makeitdrum-bridge', version: '1.6.0' });
  const down = createBridgeClient(async () => { throw new TypeError('Failed to fetch'); });
  assert.equal(await down.health(), null);
  const other = createBridgeClient(async () => ({ ok: true, json: async () => ({ app: 'autre' }) }));
  assert.equal(await other.health(), null);
  const slow = createBridgeClient((url, { signal }) => new Promise((_, reject) => { signal.addEventListener('abort', () => reject(new Error('abort'))); }), 'http://127.0.0.1:47800', { timeout: 10 });
  assert.equal(await slow.health(), null);
});

test('sendKit poste le zip avec le nom, renvoie la réponse, lève sur erreur HTTP', async () => {
  const calls = [];
  const client = createBridgeClient(async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, json: async () => ({ ok: true, path: '/x/k.adg', notified: true }) };
  });
  const res = await client.sendKit('k', new Uint8Array([1, 2]));
  assert.equal(calls[0].url, 'http://127.0.0.1:47800/kit');
  assert.equal(calls[0].opts.method, 'POST');
  assert.equal(calls[0].opts.headers['X-Kit-Name'], 'k');
  assert.equal(calls[0].opts.headers['Content-Type'], 'application/zip');
  assert.deepEqual(res, { ok: true, path: '/x/k.adg', notified: true });
  const bad = createBridgeClient(async () => ({ ok: false, status: 500, json: async () => ({ error: 'disque plein' }) }));
  await assert.rejects(bad.sendKit('k', new Uint8Array()), /disque plein/);
});
