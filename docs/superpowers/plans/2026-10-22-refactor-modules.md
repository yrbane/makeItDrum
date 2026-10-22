# Refactor en modules — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Découper `index.html` en modules ES testables sans changer d'un échantillon le son, le look ni l'export, avec un golden master qui le prouve.

**Architecture:** Trois couches : `src/core/` (pur, Node-testable), `src/audio/` (Web Audio), `src/ui/` (DOM). `src/app.js` compose. Un build esbuild + inline produit `dist/index.html`. Le golden master rend les 20 pads avec l'original (`git show v1.0.1:index.html`) et avec `dist/` dans le même Chromium, aléatoire seedé, et compare.

**Tech Stack:** JavaScript ES2020, `node:test`, esbuild (devDependency), puppeteer-core sur `/usr/bin/chromium` (devDependency), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-22-refactor-modules-design.md`

## Global Constraints

- Node ≥ 20 ; aucune dépendance de production ; `dist/index.html` ne charge aucune ressource distante.
- Code en anglais, commentaires et messages de commit en français. Les textes affichés à l'utilisateur sont copiés **à l'identique** (y compris « Pack téléchargé — 10 fichiers .wav dans un .zip. », qui est faux mais fait partie du résultat).
- L'ordre et le nombre des appels à `Math.random` sont ceux de l'original ; tout aléatoire passe par l'objet `rng` injecté.
- Branche `refactor/modules` ; commits intermédiaires sans bump ; fusion finale en v1.1.0.
- Précision : le constructeur a confirmé que les 20 recettes sont **statiques** (aucun tirage dans `FLAVOR_CONFIGS`) : `flavors.js` est donc une table de données, les tirages sont tous dans le renderer, l'impulsion et le post-traitement. Le spec est ajusté en ce sens (section « Arbitrages », point 1).

## Review Focus

1. Fichier audio illisible (non décodable) → message « Impossible de lire ce fichier — essaie un .wav ou .mp3 », pads restent désactivés. Test : smoke E2E (Task 15).
2. Clic sur un pad pendant sa propre génération (`padBusy`) → ignoré, pas de double rendu. Test : Task 12 (`library` avec renderer factice lent).
3. Clic « Télécharger » avant la fin de la génération → message « Attends la fin de la génération avant de télécharger. », pas de téléchargement. Test : Task 12.
4. Sample très court (quelques ms) → `randomOffset` renvoie 0, `analyzeSamples` ne divise pas par zéro, FFT N = 1024 minimum. Tests : Tasks 2 et 3.
5. Sample multicanal → analyse sur le canal 0, buffer inversé sur tous les canaux, WAV mono depuis le canal 0. Tests : Task 4 (`reverse`), Task 8 (`wav`), golden avec fixture mono (stéréo hors périmètre du golden, inchangé).

---

### Task 1: Branche, outillage, fixture

**Files:**
- Create: `scripts/make-fixture.mjs`, `tests/fixtures/fixture.wav`
- Modify: `package.json`, `.gitignore`

- [ ] **Step 1:** `git switch -c refactor/modules`
- [ ] **Step 2:** `npm install --save-dev esbuild puppeteer-core` ; vérifier qu'aucune `dependencies` n'apparaît.
- [ ] **Step 3:** Écrire `scripts/make-fixture.mjs` : génère un WAV mono 22 050 Hz, 16 bits, 0,5 s, signal déterministe (sinus 180 Hz × exp(−9t) + bruit mulberry32(1) × exp(−40t), amplitude 0,8), écrit `tests/fixtures/fixture.wav`. Le lancer une fois et committer le WAV.
- [ ] **Step 4:** `package.json` scripts : `"test": "node --test \"tests/**/*.test.mjs\""`, `"build": "node scripts/build.mjs"`, `"golden": "node scripts/golden.mjs"`, `"test:e2e": "node scripts/smoke.mjs"`, `"serve": "python3 -m http.server 8765 -d dist"`. `.gitignore` : ajouter `node_modules/` et `dist/`.
- [ ] **Step 5:** Commit « outillage : esbuild, puppeteer-core, fixture WAV déterministe ».

### Task 2: `core/random.js` + `core/math.js`

**Files:** Create `src/core/random.js`, `src/core/math.js`, `tests/core/random.test.mjs`, `tests/core/math.test.mjs`

**Interfaces — Produces:**
- `clamp(v, a, b)`.
- `createRandom(random = Math.random) → { rnd(a,b), jitter(base,pct), chance(p), randomOffset(duration, maxFrac = 0.6) }`. `randomOffset` prend une **durée en secondes** (pas un buffer) ; renvoie 0 si `duration` est falsy ; `span = max(0, dur*maxFrac − 0.01)` ; tire `random()*span` seulement si `span > 0` (sinon aucun tirage).

- [ ] **Step 1:** Tests : avec `random = () => 0.5`, `rnd(0,10) === 5`, `jitter(100, 0.2) === 100`, `chance(0.6) === true`, `chance(0.4) === false`, `randomOffset(1) === 0.5*(0.6−0.01)`, `randomOffset(0) === 0`, `randomOffset(0.01) === 0` **sans appeler** `random` (compteur). `clamp(5,0,3) === 3`, `clamp(-1,0,3) === 0`.
- [ ] **Step 2:** Lancer, voir échouer (module introuvable).
- [ ] **Step 3:** Implémenter.
- [ ] **Step 4:** Lancer, vert. Commit « core : helpers aléatoires injectables et clamp ».

### Task 3: `core/fft.js` + `core/analysis.js`

**Files:** Create `src/core/fft.js`, `src/core/analysis.js`, tests correspondants.

**Interfaces — Produces:** `fftInPlace(re, im)` ; `analyzeSamples(data: Float32Array, sampleRate) → { centroid, fundamental, midPeak, brightness, crest }` (corps identique à `analyzeBuffer`, `data` = canal 0).

- [ ] **Step 1:** Tests FFT : impulsion `[1,0,0,…]` (N=8) → `re` tous 1, `im` tous 0 ; sinus de 4 périodes sur N=64 → magnitude max au bin 4 ; N=1024 d'un sinus 440 Hz à 44 100 Hz → pic au bin `round(440/43.07)=10`.
- [ ] **Step 2:** Tests analyse : sinus 60 Hz 1 s à 44 100 → `fundamental` dans [55, 65], `brightness < 0.05` ; bruit blanc mulberry32 → `brightness > 0.5` ; silence (zéros) → `centroid === 2000`, `fundamental === 60`, `midPeak === 1200`, `brightness === 0.3`, `crest === 1` ; 10 échantillons → ne lève pas, `N` interne 1024.
- [ ] **Step 3:** Rouge, implémenter, vert. Commit « core : FFT et analyse spectrale pures ».

### Task 4: `core/curves.js`, `core/bitcrush.js`, `core/normalize.js`, `core/impulse.js`, `core/samples.js`

**Files:** Create les cinq modules + tests.

**Interfaces — Produces:**
- `makeSatCurve(drive, asym)`, `makeEnvCurve(attack, hold, decay, curvePow)`, `scaledEnv(attack, hold, decay, curvePow, peak)`, `makeFoldCurve(threshold)` — copies exactes (`makePitchCurve` supprimé : jamais appelé).
- `bitcrushInPlace(data: Float32Array, bitDepth, holdSamples)` — un canal.
- `peakOf(channels: Float32Array[]) → number` ; `normalizePeakInPlace(channels, target = 0.95)` — même seuil `0.0001`.
- `fillImpulseInPlace(data: Float32Array, decay, random)` — `data[i] = (random()*2−1) * (1 − i/len)^decay`.
- `reverseInto(src: Float32Array, dst: Float32Array)`.

- [ ] **Step 1:** Tests : `makeSatCurve(1,0)` longueur 1024, `curve[1023] === 1`, `curve[0] === −1`, monotone croissante ; `makeFoldCurve(0.5)` : `|curve[i]| ≤ 1`, `curve[1023] === 1`, un point au-delà du seuil est replié (valeur pour x=0.75 → `(1−0.75)/0.5 = 0.5`) ; `makeEnvCurve(0.1,0.1,0.1,2)` : `curve[511] === 0.0001`, max 1 ; `scaledEnv(…, 0.5)` : max 0.5 ; `bitcrushInPlace([0.3,0.31,0.9], 3, 2)` → `[0.25,0.25,0.875]` ; `normalizePeakInPlace([[0.5,−0.25]], 0.95)` → `[0.95,−0.475]` ; silence inchangé ; `fillImpulseInPlace` avec `random=()=>1` et `decay=1` → `data[i] = 1−i/len` ; `reverseInto([1,2,3])` → `[3,2,1]`.
- [ ] **Step 2:** Rouge, implémenter, vert. Commit « core : courbes, bitcrush, normalisation, impulsion, inversion ».

### Task 5: `core/flavors.js`

**Files:** Create `src/core/flavors.js`, `tests/core/flavors.test.mjs`

**Interfaces — Produces:** `FLAVORS` (tableau des 20 configs, **copié tel quel** depuis `FLAVOR_CONFIGS`, chaque entrée gagne un champ `name` : 'BOOM', 'KICK', 'THUD', 'SNAP', 'CRACK', 'BUZZ', 'RING', 'TICK', 'GLASS', 'WASH', 'BEND', 'SWELL', 'STUTTER', 'CRUSH', 'PHASE', 'GROWL', 'PERC', 'BELL', 'DARK', 'CHAOS') ; `flavorAt(idx) → FLAVORS[idx % FLAVORS.length]`. Les `freq`/`cutoff`/`baseFreq` restent des fonctions `(a) => …` utilisant `clamp`.

- [ ] **Step 1:** Tests : 20 entrées, noms dans l'ordre ci-dessus, chaque entrée a `attack, hold, decay, curvePow, layers (≥1), sat.drive1, sat.drive2, outGain, peak` ; `flavorAt(20) === FLAVORS[0]` ; avec `a = {fundamental:60, midPeak:1200, centroid:2000, brightness:0.3, crest:3}` toute `freq(a)` renvoie un nombre fini > 0.
- [ ] **Step 2:** Rouge, implémenter, vert. Commit « core : les 20 recettes comme données nommées ».

### Task 6: `core/wav.js`

**Interfaces — Produces:** `encodeWav(samples: Float32Array, sampleRate) → ArrayBuffer` (mono 16 bits, saturation `s<0 ? s*0x8000 : s*0x7FFF`).

- [ ] **Step 1:** Tests : en-tête `RIFF`/`WAVE`/`fmt `/`data`, `byteLength === 44 + 2n`, taille RIFF `36+2n`, sampleRate relu, `[1, −1, 0, 2, −2]` → int16 `[32767, −32768, 0, 32767, −32768]`.
- [ ] **Step 2:** Rouge, implémenter, vert. Commit « core : encodeur WAV ».

### Task 7: `core/zip.js`

**Interfaces — Produces:** `crc32(bytes: Uint8Array) → number` ; `buildZip(files: {name, data: Uint8Array}[]) → Uint8Array` (concaténation locaux + central + fin, méthode store, dates à 0, exactement les champs de l'original).

- [ ] **Step 1:** Tests : `crc32('123456789')` = `0xCBF43926` ; zip de deux fichiers : signature `0x04034b50` à 0, `0x06054b50` dans les 22 derniers octets, nombre d'entrées 2, offset central = somme des locaux ; écrire le zip dans un fichier temporaire et `unzip -t` renvoie « No errors detected » (test ignoré proprement si `unzip` absent).
- [ ] **Step 2:** Rouge, implémenter, vert. Commit « core : archive ZIP store et CRC-32 ».

### Task 8: `audio/buffers.js`, `audio/context.js`, `audio/postprocess.js`

**Files:** Create les trois modules (pas de tests unitaires : couverts par le golden).

**Interfaces — Produces:**
- `makeReversedBuffer(buffer) → AudioBuffer` (via `new AudioBuffer({...})` + `reverseInto`).
- `makeImpulseBuffer(ctx, duration, decay, random) → AudioBuffer` (`len = max(1, floor(duration*sr))`, `ctx.createBuffer(1, len, sr)`, `fillImpulseInPlace`).
- `createLiveContext(windowRef = window) → { get(): AudioContext }` : crée à la première demande, `resume()` si `suspended`, renvoie le contexte.
- `postprocess(buffer, { crush, crushBits, crushHold, peak })` : si `crush`, bitcrush sur chaque canal ; puis `normalizePeakInPlace` sur tous les canaux ; renvoie `buffer`. **Note :** dans l'original `finishRender` tire `chance(crushChance)` avec `crushChance = 1` → `Math.random() < 1`, un tirage **toujours effectué** quand `opts.crush` est vrai. Ce tirage doit être conservé : `postprocess` reçoit `rng` et appelle `rng.chance(1)` si `crush`.

- [ ] **Step 1:** Implémenter. Commit « audio : buffers, contexte live, post-traitement ».

### Task 9: `audio/renderer.js`

**Files:** Create `src/audio/renderer.js`

**Interfaces — Produces:** `createRenderer({ rng, OfflineAudioContextCtor }) → render(cfg, sample)` avec `sample = { originalBuffer, reversedBuffer, analysis }` → `Promise<AudioBuffer>`.

Découpage interne, **dans cet ordre d'exécution** (chaque fonction reçoit `ctx`, `cfg`, les valeurs communes `{sr, a, attack, hold, decay, total, revTail, tailPad}` et `rng`) :
1. `computeTimings(cfg, rng)` : `hold = jitter(cfg.hold,0.3)`, `decay = jitter(cfg.decay,0.25)`, `revTail = cfg.revTail ? jitter(cfg.revTail,0.3) : 0`, `tailPad` ; `len`.
2. `addTransient(...)` → connecte sur `mix` (tirages : rate, hp freq, sat drive, clickDur, clickGain).
3. `addLayers(...)` (pour chaque layer : pitchBend ou rate, filtre, invert, enveloppe, `randomOffset(buf.duration, offsetMax ?? 0.75)`).
4. `addSub(...)` (rate, cutoff, drive, enveloppe, `randomOffset(originalBuffer.duration, 0.7)`).
5. `addPhaser(mix)` → noeud de sortie (sweepRate, depth, puis par étage freq et Q).
6. `addComb(node)` → noeud de sortie.
7. `addSaturation(node)` → noeud (drive1, fold optionnel, drive2).
8. `addBassBoost(node)` → noeud.
9. `addReverb(node, finalMix)` (si `revTail > 0.02` : impulse avec `jitter(revDecay||1.7,0.25)`, puis `wet = jitter(revWet||0.22,0.3)`).
10. `connectMaster(ctx, finalMix, jitter(cfg.outGain||1.3, 0.15))` : attention, **l'argument est évalué avant** les tirages internes de `connectMaster` (ratio puis release).
11. `crush = cfg.crush ? chance(cfg.crush.chance ?? 0.3) : false` **puis** `startRendering`, puis `postprocess`.

`safeStart(src, offset)` conservé tel quel dans ce module.

- [ ] **Step 1:** Implémenter en recopiant les valeurs de l'original (clamps `30`/`60`/`300`, `sr*0.45`, `35..220`, oversample `'2x'`/`'4x'`, Q `0.9`, compresseur −17/4/0.0008).
- [ ] **Step 2:** Commit « audio : renderer en briques, ordre des tirages préservé ».

### Task 10: `audio/player.js`

**Interfaces — Produces:** `createPlayer(getCtx) → { play(buffer, listener), stop() }` avec `listener = { onStart(), onStop() }`. `play` : `stop()` (qui appelle `onStop` du précédent et `src.stop(0)` avec `onended = null`), crée la source, `listener.onStart()`, `src.onended = () => { if current === src → current = null; listener.onStop(); }`, `src.start(0)`.

- [ ] **Step 1:** Test unitaire avec un faux contexte (`createBufferSource` renvoie un objet avec `connect/start/stop/onended`) : jouer A puis B → `A.stop` appelé une fois, `onStop(A)` une fois, `onStart(B)` une fois ; `onended` de A après `stop()` n'appelle pas `onStop` deux fois (car `onended` mis à null).
- [ ] **Step 2:** Rouge, implémenter, vert. Commit « audio : lecteur une-percu-à-la-fois ».

### Task 11: `ui/` — `dom.js`, `pads.js`, `waveform.js`, `dropzone.js`, `parallax.js`, `download.js`, `messages.js`

**Interfaces — Produces:**
- `queryElements(doc) → { win, dropzone, fileInput, dzFile, statusText, btnExportAll, padGrid }`.
- `createPadGrid(padGrid, doc, count) → { els: HTMLButtonElement[], canvases }` (mêmes attributs : `pad`, `disabled`, `type=button`, `aria-label 'Percussion N'`, `pad-num` `'01'`, canvas 140×56, ordre canvas puis num).
- `drawWaveform(canvas, samples: Float32Array | null)`.
- `bindDropzone({ dropzone, fileInput }, onFile)`.
- `initParallax(win, windowRef, doc)`.
- `downloadBlob(doc, blob, filename)` (createObjectURL, `<a download>`, revoke après 4000 ms).
- `MESSAGES` : objet avec toutes les chaînes de statut, copiées à l'identique ; `generating(i, n)` et `padReady(i)` comme fonctions.

- [ ] **Step 1:** Test de `MESSAGES` : snapshot des chaînes exactes (y compris « 10 fichiers »). Test de `drawWaveform` sans DOM : objet canvas factice enregistrant `moveTo/lineTo` ; `[0.5, −0.5]` sur largeur 2 → segments `(0, 0.5h)→(0, h)` et `(1, 0)→(1, 0.5h)`… copier les valeurs exactes du calcul `(1+min)*amp`.
- [ ] **Step 2:** Implémenter. Commit « ui : DOM, pads, forme d'onde, dropzone, parallaxe, téléchargement, messages ».

### Task 12: `library.js` (orchestration)

**Interfaces — Produces:** `createLibrary({ padCount, pads, status, renderer, player, liveCtx, decode, draw }) → { load(file), generate(idx, autoplay), regenerateAll(), play(idx), exportZip(), buffers }` où `status = { set(text) }`, `decode(arrayBuffer) → Promise<AudioBuffer>`, `draw(canvas, samples)`.

Comportements copiés : `load` lit le `File` via `FileReader`, décode, calcule inversé + analyse, écrit `'✓ ' + file.name`, active les pads, `regenerateAll()` ; erreurs → messages exacts. `generate` : garde `padBusy`, classe `playing` pendant le rendu, dessine, autoplay via `player.play` avec listener qui gère `playing`. `regenerateAll` : désactive export, messages « Génération… (i/20) », « Bibliothèque prête — … », réactive export. `exportZip` : garde « Attends la fin… », messages « Préparation du pack .zip… » / « Pack téléchargé — 10 fichiers .wav dans un .zip. » / échec, noms `makeitdrum_01.wav` … `makeitdrum_pack.zip`.

- [ ] **Step 1:** Tests avec doubles (renderer qui résout après `setTimeout 0`, player factice, pads factices avec `classList` Set) : `generate(0)` pendant un `generate(0)` en cours → le renderer n'est appelé qu'une fois ; `exportZip()` avec un buffer manquant → `status.set` reçoit « Attends la fin de la génération avant de télécharger. » et aucun téléchargement ; `regenerateAll()` → 20 appels renderer, dernier message « Bibliothèque prête — … », export réactivé.
- [ ] **Step 2:** Rouge, implémenter, vert. Commit « app : orchestration de la bibliothèque testée avec doubles ».

### Task 13: `app.js`, `template.html`, `styles.css`, `scripts/build.mjs`

**Files:** Create `src/app.js`, `src/template.html`, `src/styles.css`, `scripts/build.mjs`, `tests/build.test.mjs`. Delete `index.html` (racine).

- [ ] **Step 1:** Extraire le CSS (lignes 7–281 de l'original) dans `src/styles.css` **sans modification**. `src/template.html` = l'original avec `<style>…</style>` remplacé par `<style>\n<!-- build:css -->\n</style>`, le `<script>…</script>` par `<script>\n<!-- build:js -->\n</script>`, et `v1.0.1` dans le badge par `v{{VERSION}}`.
- [ ] **Step 2:** `src/app.js` : composition root (`createRandom(Math.random)`, `createRenderer`, `createPlayer`, `createLibrary`, `bindDropzone`, `initParallax`, écouteurs `mouseenter`/`click` des pads et `click` export, avec les gardes et messages de l'original).
- [ ] **Step 3:** `scripts/build.mjs` : `esbuild.build({ entryPoints:['src/app.js'], bundle:true, format:'iife', target:'es2020', write:false, legalComments:'inline', banner:{ js:'//! make it drum.exe — Masao « Saiya Geez » — v<version> — https://github.com/yrbane/makeItDrum' } })`, remplace les trois marqueurs, écrit `dist/index.html`.
- [ ] **Step 4:** Test `tests/build.test.mjs` : lance le build (child_process), puis sur `dist/index.html` : badge `v<package.version>`, aucun `<script src=`/`<link href="http`, `<style>` contient exactement le texte de `src/styles.css`, présence des ids `dropzone fileInput padGrid btnExportAll statusText`. Supprimer `tests/index.test.mjs` (remplacé).
- [ ] **Step 5:** `npm test` vert ; `git rm index.html`. Commit « build : template + CSS + bundle esbuild → dist/index.html ».

### Task 14: `scripts/golden.mjs`

- [ ] **Step 1:** Écrire le script : extrait l'original avec `git show v1.0.1:index.html` dans `dist/.golden/original.html` ; pour chaque page (`original`, `dist/index.html`) : `puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })`, `evaluateOnNewDocument` installe mulberry32(123456) dans `Math.random`, un shim sur `OfflineAudioContext.prototype.startRendering` qui pousse chaque buffer rendu dans `window.__rendered`, un shim de `URL.createObjectURL` qui garde le dernier Blob dans `window.__lastBlob` et un `HTMLAnchorElement.prototype.click` neutralisé ; charge via `file://` ; injecte `tests/fixtures/fixture.wav` dans `#fileInput` (DataTransfer) ; attend « Bibliothèque prête » ; clique `#btnExportAll` ; attend « Pack téléchargé » ; récupère : 20 canaux 0 en base64 (Float32Array), SHA-256 du zip (via `crypto.subtle`), `document.body.innerText`, fingerprint DOM (`tagName.className#id` de chaque élément dans l'ordre), texte du `<style>`.
- [ ] **Step 2:** Comparaison : longueurs égales, `max|a−b| ≤ 1e-6` par pad, hash zip égal, innerText égal (après remplacement de `v1.0.1`/`v<version>`), fingerprint DOM égal (idem pour le badge), style égal. Affiche un tableau `pad | longueur | max diff` et sort 1 si écart.
- [ ] **Step 3:** `npm run build && npm run golden` → 20 lignes à 0, « GOLDEN OK ». Commit « golden master : original vs dist, aléatoire seedé, comparaison exacte ».

### Task 15: `scripts/smoke.mjs` + CI + docs + fusion

- [ ] **Step 1:** `scripts/smoke.mjs` : charge `dist/index.html`, fichier texte invalide → message « Impossible de lire ce fichier — essaie un .wav ou .mp3 » et 20 pads toujours `disabled` ; puis fixture → 20 pads actifs, aucune erreur console hors favicon.
- [ ] **Step 2:** `ci.yml` : job test → `npm ci`, `npm test`, `npm run build`, `CHROME_PATH=$(which google-chrome) npm run golden`, `npm run test:e2e`, upload artefact `dist/index.html` ; job deploy depuis `dist/`.
- [ ] **Step 3:** README : section « Développement » (scripts, arborescence `src/`, golden master), « Structure du dépôt ». CHANGELOG v1.1.0 « Refonte en modules ». `package.json` 1.1.0.
- [ ] **Step 4:** `git switch main && git merge --no-ff refactor/modules` avec message « v1.1.0 — refonte en modules : cœur DSP pur testé, build esbuild, golden master », push, CI verte, tag `v1.1.0`, release avec `dist/index.html` joint, vitrines (texte inchangé, capture inutile : rendu identique).
