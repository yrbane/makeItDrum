# Changelog

## 1.6.0 — 2026-10-22 · « Envoyer dans Live »

- **Bouton `▶ ENVOYER DANS LIVE`** : apparaît quand le compagnon local tourne ; un clic écrit le Drum Rack (`.adg` + `.sfz` + `Samples/`) dans `User Library/Presets/Instruments/Drum Rack/make it drum/<kit>/` et le Remote Script le charge sur la piste sélectionnée de Live. Sans compagnon, rien ne change.
- **Compagnon `makeitdrum-bridge`** (`tools/bridge/`, Node ≥ 22, zéro dépendance, bundlé en `dist/makeitdrum-bridge.mjs` joint à la release) : `127.0.0.1:47800`, `GET /health`, `POST /kit`, origines limitées à la page locale, à la démo et à localhost, entrées de zip nettoyées, détection de la User Library (native ou Wine), notification UDP du Remote Script.
- **Remote Script `MakeItDrum`** (`tools/remote-script/`, Python de Live 11/12, `install.sh`) : socket UDP non bloquante relevée dans `update_display`, recherche du preset dans `browser.user_library`, `browser.load_item`, nouvel essai pendant 20 s le temps que Live rescanne, messages dans la barre d'état de Live.
- **Développement** : `src/bridge/client.js`, `library.sendToLive` (zip factorisé avec l'export Ableton), tests Node du serveur (HTTP + UDP + fichiers) et tests Python des parties pures ; le smoke E2E lance un vrai compagnon et vérifie le `.adg` écrit. 126 tests Node + 6 Python.

## 1.5.0 — 2026-10-22 · « Boîte à rythmes : séquenceur, sortie MIDI et horloge »

- **Séquenceur pas-à-pas** sous les pads : 20 lignes (une par recette) × 16 pas, clic = 100 → 127 → 60 → off (trois vélocités), `▶ PLAY` / `■ STOP`, BPM 40–240, swing 0–100 %, `EFFACER`. Tête de lecture sur la grille. Planification à anticipation sur l'horloge Web Audio (timer 25 ms, fenêtre 100 ms) : pas de gigue.
- **Le motif voyage avec le kit** : sauvegardé dans le navigateur, écrit dans `kit.json` (`pattern`, champ optionnel ignoré par le plugin) et relu à l'import.
- **Sortie MIDI + horloge** : après `MIDI`, select `MIDI OUT` (notes 36–55, canal 10, vélocité, horodatage calé sur l'audio) et case `HORLOGE` (24 ppqn, Start/Stop) pour piloter Live, une groovebox ou un LXR-02 en esclave.
- **Développement** : modules purs `core/sequencer` (motif immuable, `eventsBetween`), `audio/scheduler`, `midi/out`, `ui/stepgrid` ; `polyPlayer.play(…, { when })` ; smoke E2E : un pas activé, lecture avec tête de lecture, arrêt. 120 tests.

## 1.4.0 — 2026-10-22 · « Export Ableton Drum Rack et SFZ »

- **Bouton `ABLETON / SFZ`** : télécharge `<nom>.ableton.zip` = `<nom>.adg` (Drum Rack Ableton Live 12, une chaîne Simpler par pad sur les notes 36–55, vélocité, one-shot), `<nom>.sfz` (sforzando, Decent Sampler, Sitala, Bitwig, Renoise…) et les 20 WAV sous `Samples/`. À dézipper tel quel puis glisser le `.adg` dans Live.
- Le `.adg` est construit sur un gabarit écrit par Live lui-même (preset de la Core Library vidé de ses échantillons et macros), pas sur un XML inventé : `scripts/make-adg-template.mjs` documente la fabrication. Chemins relatifs au fichier, longueurs et fréquence d'échantillonnage renseignées, graine du pad conservée.
- **Développement** : modules purs `core/daw/adg`, `core/daw/sfz`, gabarit embarqué gzippé (≈10 Ko) ; smoke E2E : l'export Ableton produit 22 entrées. 103 tests.

## 1.3.0 — 2026-10-22 · « Jouable au clavier et en MIDI »

- **MIDI in** : bouton `MIDI` (Web MIDI, autorisation demandée au clic), select de l'entrée (toutes ou une seule), branchement à chaud. Notes General MIDI 36–55 = pads 1–20, vélocité respectée ; un kit chargé apporte ses propres notes (`kit.json`). Chrome/Edge complets, Firefox via extension, Safari : clavier seulement.
- **Clavier de l'ordinateur** : `Q…P` = pads 1–10, `A…;` = pads 11–20 (par position physique, AZERTY ou QWERTY).
- **Lecture polyphonique** pour le MIDI et le clavier : les pads se superposent, rejouer un pad coupe sa lecture précédente. Le survol et le clic gardent la lecture mono d'origine.
- **Développement** : modules purs `core/midi/drummap`, `midi/access` (port du patron WebGlitch, testé avec un faux navigateur), `audio/polyplayer`, `ui/keyboard` ; smoke E2E : la touche W allume le pad 2. 96 tests.

## 1.2.0 — 2026-10-22 · « Kits sauvegardés et graines »

- **Kits** : nouvelle barre `KIT` sous les pads — `SAUVER` (nom demandé), select pour **changer de kit à la volée** (chargement instantané, sans rendu), `SUPPRIMER`, `IMPORTER…`. Les kits sont stockés dans le navigateur (IndexedDB) ; sans stockage disponible, l'export reste possible.
- **Export `.kit.zip`** : remplace le pack `.zip` ; contient `kit.json` (schéma v1 : nom, recettes, graines, notes General MIDI 36–55, son source) et les 20 WAV nommés `01_BOOM.wav … 20_CHAOS.wav`. Lu tel quel par le plugin [make it drum — kit player](https://github.com/yrbane/makeItDrum-plugin). Le message « 10 fichiers » d'origine disparaît avec lui.
- **Import** : `.kit.zip` ou ancien pack `makeitdrum_NN.wav` (ZIP store ou deflate), sauvegardé puis chargé.
- **Graine par pad** : chaque rendu tire une graine 32 bits (`mulberry32`), mémorisée et exportée ; même son + même graine = même percussion.
- **Développement** : golden master retiré (il comparait la refonte à l'original à tirages identiques ; la graine par pad change les tirages par conception). Les snapshots du renderer restent le contrat du moteur ; le smoke E2E couvre sauvegarde, export et rechargement d'un kit. 82 tests. Node ≥ 22.

## 1.1.0 — 2026-10-22 · « Refonte en modules »

Aucun changement pour l'utilisateur : même son, même interface, même export. Tout est dans le code.

- **Architecture en trois couches** : `src/core/` pur (aléatoire injectable, FFT, analyse spectrale, courbes, bitcrush, normalisation, impulsion, les 20 recettes comme données nommées, encodeurs WAV et ZIP), `src/audio/` (contexte live, buffers, renderer découpé en briques, post-traitement, lecteur), `src/ui/` (DOM, pads, forme d'onde, dropzone, parallaxe, téléchargement, messages). `src/library.js` orchestre, `src/app.js` compose.
- **Tests** : 60 tests `node:test` écrits avant chaque extraction (cœur, lecteur, buffers, UI, orchestration avec doubles, build), plus le graphe du renderer figé par snapshot sur trois recettes via un faux contexte audio enregistreur. Code mort supprimé (`pick`, `makePitchCurve`).
- **Build** : esbuild (devDependency) bundle les modules en IIFE et les inline avec le CSS dans `src/template.html` → `dist/index.html`, toujours un seul fichier sans ressource distante, badge de version injecté depuis `package.json`.
- **Golden master** (`npm run golden`) : l'original (tag `v1.0.1`) et `dist` tournent dans le même Chromium headless avec un `Math.random` seedé ; la trace du graphe Web Audio (1 698 opérations) doit être identique, les 20 buffers équivalents à une tolérance calibrée sur le non-déterminisme de Chromium (sommation non ordonnée, basculements de quantification du bitcrush), le ZIP, le DOM et le CSS identiques.
- **Smoke E2E** (`npm run test:e2e`) : fichier illisible → message d'erreur et pads désactivés ; WAV valide → 20 pads actifs avec forme d'onde, console propre.
- **CI** : tests → build → golden → smoke → déploiement Pages depuis `dist/` ; `dist/index.html` joint à chaque release.

## 1.0.1 — 2026-10-22 · « Crédit à l'auteur »

- **Crédit bien visible** sous le titre de l'application : lien vers la page de l'auteur, Masao « Saiya Geez » (https://beacons.ai/saiyageez), en bouton bleu XP cliquable.
- README, `package.json` et licence MIT reportent la paternité du projet à Masao « Saiya Geez ».
- Test de cohérence supplémentaire : le lien de crédit doit être présent et pointer vers la bonne page.

## 1.0.0 — 2026-10-22 · « Première publication »

- **Moteur procédural de percussions** : un seul son importé (wav / mp3 / ogg…) devient un kit de 20 percussions très différentes — BOOM, KICK, THUD, SNAP, CRACK, BUZZ, RING, TICK, GLASS, WASH, BEND, SWELL, STUTTER, CRUSH, PHASE, GROWL, PERC, BELL, DARK, CHAOS.
- **Transformation, pas synthèse** : chaque pad est rendu hors-ligne (`OfflineAudioContext`) à partir du sample : transitoire d'attaque, couches à offset/vitesse/filtre variables, renfort de basses, réseau allpass, comb/phase, saturation multi-étages, wavefolder, bitcrush, reverb par impulsion synthétique, normalisation de crête.
- **Analyse spectrale** du son importé (FFT radix-2 maison) pour adapter les traitements à la matière sonore.
- **Interaction** : survol d'un pad = écoute immédiate, clic = nouvelle variation aléatoire ; une seule percussion joue à la fois, coupée net dès qu'une autre démarre ; forme d'onde dessinée sur chaque pad.
- **Export** : téléchargement de tout le kit en `.zip` (20 fichiers `.wav` 16 bits, encodeur WAV et archive ZIP « store » écrits à la main).
- **Interface Windows XP** : fenêtre, barre de menus, boîtier plastique avec parallaxe 3D à la souris, pads façon vieux écrans LCD/CRT avec scanlines.
- **Zéro dépendance** : un seul fichier `index.html`, aucun script ni style distant, rien n'est envoyé sur le réseau.
- Tests de cohérence (`node --test`), CI GitHub Actions avec déploiement automatique sur GitHub Pages.
