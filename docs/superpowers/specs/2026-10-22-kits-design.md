# make it drum 1.2.0 — graines reproductibles et kits sauvegardés — conception

Phases 0 et 1 de `docs/proposals/2026-10-22-evolutions-vst-midi-ableton.md`.

## Intention
« Sauver son kit » et « changer de kit à la volée » dans la page, et produire un
format de kit lisible par le plugin (`makeItDrum-plugin`) : `nom.kit.zip` = 20 WAV
nommés `NN_FLAVOR.wav` + `kit.json` (schéma v1).

## Décisions
- **Graine par pad** : chaque rendu tire une graine 32 bits (`randomSeed`), mémorisée
  dans `seeds[idx]`, et rend avec `createRandom(mulberry32(seed))`. Le renderer reçoit
  le générateur à l'appel : `render(cfg, sample, rng)`.
- **Golden master retiré** : il comparait la refonte à l'original v1.0.1 à tirages
  identiques ; la graine par pad change les tirages par conception. Les snapshots du
  renderer (faux contexte, graine fixe) restent le contrat du graphe. Le smoke E2E
  couvre la page.
- **Kit sauvegardé = WAV rendus** (vérité) + graines (provenance). Le son source n'est
  pas stocké : un kit rechargé se joue et s'exporte ; « cliquer pour varier » demande
  un son importé.
- **Stockage** : IndexedDB `makeitdrum` / store `kits` ; enregistrement
  `{ id, name, createdAt, engineVersion, source: {fileName, sampleRate, duration},
  pads: [{ index, flavor, seed, note, sampleRate, samples: Float32Array }] }`.
  Injecté dans la bibliothèque sous `{ list(), get(id), put(kit), remove(id) }` ;
  double en mémoire dans les tests. Sans IndexedDB : boutons de sauvegarde désactivés,
  export/import toujours possibles.
- **Interface** (ligne de transport, style XP) : `KIT [select] [SAUVER] [SUPPRIMER]
  [IMPORTER…] [EXPORTER LE KIT (.kit.zip)]`. Choisir un kit dans le select le charge
  sans rendu. Sauver demande un nom (`prompt`, défaut : nom du fichier source).
- **Export** : `<nom>.kit.zip` (ZIP store) : `kit.json` + `01_BOOM.wav … 20_CHAOS.wav`.
  Le message « 10 fichiers » (bug d'origine) disparaît avec le nouveau texte.
- **Import** : `.kit.zip` ou pack `makeitdrum_NN.wav` sans manifeste (recettes par
  index) ; ZIP store ou deflate (`DecompressionStream('deflate-raw')`). Le kit importé
  est sauvegardé puis chargé.
- Mapping note : `36 + index` par défaut, écrit dans `kit.json`.

## kit.json (schéma v1)
```json
{ "schemaVersion": 1, "app": "make-it-drum", "engineVersion": "1.2.0",
  "name": "Casserole bleue", "createdAt": "2026-10-22T20:10:00Z",
  "source": { "fileName": "casserole.wav", "sampleRate": 44100, "duration": 0.53 },
  "pads": [ { "index": 0, "flavor": "BOOM", "seed": 2874911021, "note": 36, "file": "01_BOOM.wav" } ] }
```

## Modules
- `core/prng.js` : `mulberry32(seed)`, `randomSeed(random)`.
- `core/kit.js` : `padFileName`, `buildManifest`, `parseManifest`, `packKit(kit) → files`,
  `unpackKit(entries) → { name, source, pads: [{index, flavor, seed, note, wav}] }`.
- `core/zip.js` : `+ readZip(bytes) → Promise<[{name, data}]>`.
- `storage/kits.js` : `createKitStore(indexedDB)` (navigateur).
- `ui/kitbar.js` : `createKitBar(el)` → `{ setKits(list, currentId), setEnabled(flags) }`.
- `library.js` : `+ saveKit(name)`, `loadKit(id)`, `deleteKit()`, `exportKit()`,
  `importKit(file)`, `seeds` ; `exportZip` devient `exportKit`.
- `template.html`, `styles.css`, `messages.js`, `app.js`, `smoke.mjs`, CI, README, CHANGELOG.
