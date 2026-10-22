# Changelog

## 1.1.0 — 2026-10-22 · « Refonte en modules »

Aucun changement pour l'utilisateur : même son, même interface, même export. Tout est dans le code.

- **Architecture en trois couches** : `src/core/` pur (aléatoire injectable, FFT, analyse spectrale, courbes, bitcrush, normalisation, impulsion, les 20 recettes comme données nommées, encodeurs WAV et ZIP), `src/audio/` (contexte live, buffers, renderer découpé en briques, post-traitement, lecteur), `src/ui/` (DOM, pads, forme d'onde, dropzone, parallaxe, téléchargement, messages). `src/library.js` orchestre, `src/app.js` compose.
- **Tests** : 50 tests `node:test` écrits avant chaque extraction (cœur, lecteur, UI, orchestration avec doubles, build). Code mort supprimé (`pick`, `makePitchCurve`).
- **Build** : esbuild (devDependency) bundle les modules en IIFE et les inline avec le CSS dans `src/template.html` → `dist/index.html`, toujours un seul fichier sans ressource distante, badge de version injecté depuis `package.json`.
- **Golden master** (`npm run golden`) : l'original (tag `v1.0.1`) et `dist` tournent dans le même Chromium headless avec un `Math.random` seedé ; la trace du graphe Web Audio (1 698 opérations) doit être identique, les 20 buffers équivalents à une tolérance calibrée sur le non-déterminisme de Chromium, le ZIP, le DOM et le CSS identiques.
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
