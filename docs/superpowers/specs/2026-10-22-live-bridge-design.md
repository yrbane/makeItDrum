# make it drum 1.6.0 — « Envoyer dans Live » : compagnon local + Remote Script — conception

Phase 3b de `docs/proposals/2026-10-22-evolutions-vst-midi-ableton.md`.

## Intention
Un clic dans la page → le Drum Rack apparaît sur la piste sélectionnée de Live, sans
télécharger ni glisser-déposer. Deux petites pièces hors du mono-fichier, zéro dépendance.

## Décisions
- **Compagnon** `tools/bridge/` (Node ≥ 22, `node:http` + `node:dgram`, aucune dépendance,
  bundlé par esbuild en `dist/makeitdrum-bridge.mjs` joint aux releases) : écoute
  `127.0.0.1:47800`. `GET /health` → `{ app: 'makeitdrum-bridge', version, userLibrary,
  notifyPort }`. `POST /kit` (corps = `<nom>.ableton.zip`, en-tête `X-Kit-Name`) → écrit
  `<User Library>/Presets/Instruments/Drum Rack/make it drum/<nom>/` (`<nom>.adg`,
  `<nom>.sfz`, `Samples/*.wav`, noms d'entrées nettoyés, pas de `..`), puis envoie en UDP
  à `127.0.0.1:47801` le JSON `{ "load": "<nom>", "path": "<chemin du .adg>" }` ; répond
  `{ ok: true, path, notified }`. CORS : origines `null` (fichier local),
  `https://yrbane.github.io`, `http://localhost:*`, `http://127.0.0.1:*` uniquement ;
  préflight `OPTIONS`. Taille max 64 Mo. Options `--user-library <chemin>`, `--port`,
  `--notify-port` ; détection par défaut : `~/Music/Ableton/User Library`,
  `~/Documents/Ableton/User Library`, puis préfixes Wine `~/.wine*/drive_c/users/*/Documents/Ableton/User Library`.
- **Remote Script** `tools/remote-script/MakeItDrum/` (Python 3 de Live 11/12, sans
  `ControlSurface` : objet avec `update_display()` appelé par Live ~10×/s, comme le
  squelette acidgrid). Socket UDP non bloquante sur `127.0.0.1:47801`. À la réception :
  cherche l'élément `Presets › Instruments › Drum Rack › make it drum › <nom> › <nom>`
  dans `application.browser.user_library` (noms observés dans les scripts Push de
  Live 12 : `user_library`, `children`, `name`, `is_loadable`) et appelle
  `browser.load_item(item)` sur la piste sélectionnée ; si Live n'a pas encore rescanné,
  réessaie toutes les 0,5 s pendant 20 s. `show_message` à chaque étape. Parties pures
  testées sans Live : `parse_message`, `find_item`, `target_components`.
  `install.sh` copie dans `…/User Library/Remote Scripts/MakeItDrum` (natif ou Wine).
- **Page** : `src/bridge/client.js` `createBridgeClient(fetchFn, base)` → `health()`
  (délai 1 s, `null` si absent), `sendKit(name, bytes)`. Au chargement, `health()` ; si
  le compagnon répond, bouton `▶ ENVOYER DANS LIVE` visible. `library.sendToLive()` =
  même zip que l'export Ableton (`buildDawZip()` factorisé), envoyé au pont.
- Non-objectifs : voie « Simpler » (`sliced_simpler_to_drum_rack`), AbletonOSC, Windows
  natif non testé (chemins documentés).

## Modules
`tools/bridge/server.mjs` (+ `makeitdrum-bridge.mjs` CLI), `tools/remote-script/MakeItDrum/`,
`src/bridge/client.js`, `library.js` (`buildDawZip`, `sendToLive`), bouton `btnSendLive`,
messages, `scripts/build-bridge.mjs`, CI (unittest Python), README (installation), CHANGELOG.
