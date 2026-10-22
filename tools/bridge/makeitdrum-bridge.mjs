#!/usr/bin/env node
// Lance le compagnon local : node tools/bridge/makeitdrum-bridge.mjs [--user-library <chemin>] [--port 47800] [--notify-port 47801]
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createBridgeServer, DEFAULT_PORT, DEFAULT_NOTIFY_PORT } from './server.mjs';

const VERSION = typeof __BRIDGE_VERSION__ !== 'undefined' ? __BRIDGE_VERSION__ : 'dev';

export function detectUserLibrary(home = homedir()) {
  const candidates = [join(home, 'Music', 'Ableton', 'User Library'), join(home, 'Documents', 'Ableton', 'User Library')];
  try {
    for (const d of readdirSync(home).filter((n) => n.startsWith('.wine'))) {
      const users = join(home, d, 'drive_c', 'users');
      if (!existsSync(users)) continue;
      for (const u of readdirSync(users)) candidates.push(join(users, u, 'Documents', 'Ableton', 'User Library'));
    }
  } catch (e) { /* pas de préfixe Wine */ }
  return candidates.find((c) => existsSync(c)) || null;
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const userLibrary = arg('--user-library', detectUserLibrary());
if (!userLibrary) {
  console.error('User Library de Live introuvable : indique-la avec --user-library <chemin>');
  process.exit(2);
}
const port = Number(arg('--port', DEFAULT_PORT));
const notifyPort = Number(arg('--notify-port', DEFAULT_NOTIFY_PORT));
const server = createBridgeServer({ userLibrary, port, notifyPort, version: VERSION, log: (m) => console.log(new Date().toISOString().slice(11, 19), m) });
const bound = await server.listen();
console.log(`makeitdrum-bridge v${VERSION} — http://127.0.0.1:${bound} — User Library : ${userLibrary} — Remote Script : UDP ${notifyPort}`);
console.log('Ouvre make it drum dans le navigateur : le bouton « ENVOYER DANS LIVE » apparaît. Ctrl+C pour arrêter.');
