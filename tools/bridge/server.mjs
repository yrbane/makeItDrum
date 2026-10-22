// Compagnon local « makeitdrum-bridge » : reçoit le zip Ableton de la page, l'écrit
// dans la User Library de Live et prévient le Remote Script MakeItDrum en UDP.
// Aucune dépendance : node:http, node:dgram, node:fs ; lecteur zip du projet.
import { createServer } from 'node:http';
import { createSocket } from 'node:dgram';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { readZip } from '../../src/core/zip.js';

export const DEFAULT_PORT = 47800;
export const DEFAULT_NOTIFY_PORT = 47801;
export const MAX_BODY = 64 * 1024 * 1024;
export const KIT_SUBDIR = ['Presets', 'Instruments', 'Drum Rack', 'make it drum'];

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === 'null' || origin === 'https://yrbane.github.io') return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

// chemin d'entrée de zip accepté : relatif, sans remontée ni séparateur Windows
export function safeEntryPath(name) {
  if (typeof name !== 'string' || !name || name.includes('\\') || name.startsWith('/')) return null;
  const parts = name.split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..')) return null;
  return parts.join('/');
}

export function sanitizeKitName(name) {
  const cleaned = String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned || 'kit';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('corps trop volumineux')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function notify(port, payload) {
  return new Promise((resolve) => {
    const sock = createSocket('udp4');
    const msg = Buffer.from(JSON.stringify(payload));
    sock.send(msg, 0, msg.length, port, '127.0.0.1', (err) => { sock.close(); resolve(!err); });
  });
}

export function createBridgeServer({ userLibrary, port = DEFAULT_PORT, host = '127.0.0.1', notifyPort = DEFAULT_NOTIFY_PORT, version = 'dev', log = () => {} }) {
  function cors(req, res) {
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin)) return false;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Kit-Name');
    res.setHeader('Vary', 'Origin');
    return true;
  }

  function json(res, code, body) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  }

  async function handleKit(req, res) {
    const name = sanitizeKitName(decodeURIComponent(req.headers['x-kit-name'] || 'kit'));
    const body = await readBody(req);
    const entries = await readZip(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
    const kitDir = join(userLibrary, ...KIT_SUBDIR, name);
    let adgPath = null;
    let written = 0;
    for (const e of entries) {
      const rel = safeEntryPath(e.name);
      if (!rel) continue;
      const target = join(kitDir, ...rel.split('/'));
      if (!target.startsWith(kitDir + sep)) continue;
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, e.data);
      written++;
      if (rel.endsWith('.adg') && !rel.includes('/')) adgPath = target;
    }
    if (!adgPath) { json(res, 400, { error: 'le zip ne contient pas de Drum Rack (.adg)' }); return; }
    const notified = await notify(notifyPort, { load: name, path: adgPath });
    log(`kit « ${name} » : ${written} fichiers → ${kitDir}${notified ? ' (Remote Script prévenu)' : ''}`);
    json(res, 200, { ok: true, path: adgPath, files: written, notified });
  }

  const server = createServer(async (req, res) => {
    try {
      if (!cors(req, res)) { json(res, 403, { error: 'origine refusée' }); return; }
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      if (req.method === 'GET' && req.url === '/health') {
        json(res, 200, { app: 'makeitdrum-bridge', version, userLibrary, notifyPort });
        return;
      }
      if (req.method === 'POST' && req.url === '/kit') { await handleKit(req, res); return; }
      json(res, 404, { error: 'inconnu' });
    } catch (err) {
      log('erreur : ' + err.message);
      json(res, 500, { error: err.message });
    }
  });

  return {
    listen: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => resolve(server.address().port));
    }),
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
