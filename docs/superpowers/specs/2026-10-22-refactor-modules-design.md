# Refactor iso-fonctionnel de make it drum — conception

Date : 2026-10-22 · Statut : proposé

## Intention

Le projet de Masao « Saiya Geez » tient dans un seul `index.html` de 1 400 lignes (CSS + 44 Ko de JS). Il marche, il sonne, il a du style. Mais le code est un monolithe non testable : DSP, Web Audio, DOM, encodage WAV/ZIP et effets visuels sont imbriqués dans la même portée.

Objectif : réorganiser le code pour qu'il respecte les critères de qualité du dépôt (TDD, SOLID, DRY, KISS, YAGNI, code en anglais / commentaires en français) **sans changer d'un iota ce que l'utilisateur voit, entend ou télécharge**.

## Goals

- Code découpé en modules ES à responsabilité unique, testables isolément.
- Cœur DSP et encodeurs **purs** (aucune dépendance au DOM ni à Web Audio), couverts par des tests unitaires Node.
- Couche Web Audio et couche UI séparées, chacune derrière une interface étroite.
- Le livrable reste **un seul `index.html` autonome, sans aucune ressource distante**, produit par un build.
- Preuve de non-régression : un test « golden master » rend les 20 pads avec la version d'origine et la version refactorée, dans le même navigateur, avec le même aléatoire, et exige des buffers identiques.

## Non-goals

- Aucun changement de rendu sonore, de look, de texte, de comportement, de format d'export.
- Pas de nouvelle fonctionnalité, pas de nouveau réglage, pas d'optimisation de perf qui changerait le son.
- Pas de TypeScript, pas de framework UI, pas de Tailwind : le projet reste JS/CSS natifs.
- Pas de refonte du CSS au-delà de son extraction dans un fichier séparé (il est déjà raisonnablement structuré).

## Anti-goals (ce qui serait un échec même si « ça marche »)

- Un pad qui sonne différemment, même légèrement.
- Un `index.html` final qui charge quoi que ce soit en réseau ou ne s'ouvre plus d'un double-clic.
- Une abstraction « au cas où » : chaque module doit avoir au moins deux raisons d'exister (un appelant réel et un test).
- Des tests qui ne testent que la structure du texte HTML (comme aujourd'hui) à la place du comportement.

## Contraintes

- Node ≥ 20, `node:test` comme lanceur de tests unitaires (déjà en place, zéro dépendance).
- Livrable `index.html` sans dépendance : les dépendances de développement (bundler, pilote de navigateur) sont acceptées, à condition de n'être jamais embarquées.
- Chromium disponible localement (`/usr/bin/chromium`) et sur les runners GitHub (Chrome préinstallé) pour les tests navigateur.
- Branche de travail `refactor/modules`, commits intermédiaires sans version, puis fusion dans `main` avec un seul bump de version (v1.1.0), CHANGELOG, tag et release, comme sur les autres projets du compte.

## Décisions prises

### 1. Arborescence cible

```
src/
  core/            # pur : aucun import de DOM ni de Web Audio
    random.js      # rnd/jitter/pick/chance/randomOffset avec générateur injecté
    math.js        # clamp et helpers numériques
    fft.js         # FFT radix-2 in-place
    analysis.js    # analyse spectrale d'un Float32Array → profil
    curves.js      # tables WaveShaper (saturation, fold), enveloppes, courbes de pitch
    bitcrush.js    # repliement de résolution sur échantillons
    normalize.js   # normalisation de crête
    flavors.js     # les 20 recettes : (analysis, rng) → config de rendu
    wav.js         # encodeur WAV PCM 16 bits
    zip.js         # archive ZIP « store » + CRC-32
  audio/
    context.js     # création paresseuse de l'AudioContext live
    impulse.js     # impulsion de reverb synthétique (OfflineAudioContext)
    renderer.js    # config → AudioBuffer rendu hors-ligne (graphe Web Audio)
    player.js      # lecture « une seule percu à la fois »
  ui/
    dom.js         # accès centralisé aux éléments
    dropzone.js    # import de fichier (clic, drag & drop)
    pads.js        # grille, états, déclenchement
    waveform.js    # dessin de la forme d'onde sur canvas
    parallax.js    # effet 3D à la souris
    status.js      # barre d'état
    exporter.js    # bouton ZIP
  app.js           # composition : câble les couches
  template.html    # squelette HTML avec marqueurs <!-- css --> et <!-- js -->
  styles.css
scripts/
  build.mjs        # esbuild (IIFE, pas de minification) + inline → dist/index.html
  golden.mjs       # golden master : original vs dist dans Chromium headless
tests/
  core/*.test.mjs  # unitaires purs (node:test)
  fixtures/        # un petit WAV de référence
dist/index.html    # livrable généré, ignoré par git, joint aux releases
```

### 2. Aléatoire injecté, ordre des tirages préservé

Tous les helpers aléatoires reçoivent une fonction `random()` (par défaut `Math.random`). Les 20 recettes doivent appeler le générateur **dans le même ordre et le même nombre de fois** que le code d'origine : c'est ce qui rend le golden master possible et c'est la contrainte principale du découpage. Le refactor déplace du code, il ne réordonne pas les tirages.

### 3. Golden master, sans fixtures lourdes

`scripts/golden.mjs` pilote Chromium headless via `puppeteer-core` (devDependency, utilise le Chromium du système, rien à télécharger). Pour chaque version (originale : `git show v1.0.1:index.html` ; nouvelle : `dist/index.html`) :

1. remplace `Math.random` par un PRNG seedé (mulberry32, graine fixe) **avant** le chargement du script ;
2. injecte le WAV de `tests/fixtures/` via le `<input type="file">` ;
3. attend « Bibliothèque prête », récupère les 20 buffers rendus (exposés par un hook de test) et les 20 WAV encodés ;
4. compare échantillon par échantillon : écart maximal toléré `1e-6` (même navigateur, même graphe → en pratique 0).

Le ZIP exporté est comparé octet à octet (en-têtes, CRC, ordre des fichiers). Les deux versions tournent dans le même binaire Chromium, donc aucune référence n'est stockée dans le dépôt.

Pour que l'original expose ses buffers sans être modifié, le script injecte un petit shim qui intercepte `OfflineAudioContext.prototype.startRendering` et collecte les résultats dans l'ordre : identique pour les deux versions, donc équitable.

### 4. Build

`esbuild` en devDependency, mode IIFE, sans minification (le fichier reste lisible, comme l'original), cible ES2020. Le script insère le CSS et le JS dans `template.html` aux marqueurs. Le résultat est écrit dans `dist/index.html`. Le `index.html` de la racine est supprimé du dépôt (l'historique garde l'original et le golden master le relit par tag).

### 5. Tests unitaires (TDD, par module pur)

Écrits **avant** l'extraction de chaque module, en caractérisant d'abord le comportement de l'original (tests de caractérisation) :

- `random` : séquence attendue pour un générateur déterministe, bornes de `jitter`, distribution de `pick`.
- `fft` : impulsion → spectre plat ; sinus → pic au bon bin ; symétrie hermitienne.
- `analysis` : profil d'un sinus grave vs aigu, d'un bruit blanc.
- `curves` : monotonie de la saturation, pliage du fold, bornes des enveloppes.
- `bitcrush`, `normalize` : valeurs connues.
- `flavors` : avec un générateur fixe, chaque recette produit une config stable (snapshot JSON) et exactement le nombre de tirages attendu.
- `wav` : en-tête RIFF conforme, taille, conversion 16 bits saturée.
- `zip` : CRC-32 de « 123456789 » = `0xCBF43926`, structure locale + centrale, lisible par `unzip -t`.

Les couches `audio/` et `ui/` ne sont couvertes que par le golden master et un smoke E2E (chargement, 20 pads, export) : écrire des tests unitaires sur des mocks de Web Audio n'apporterait rien ici (YAGNI).

### 6. CI

Le workflow enchaîne : tests unitaires → build → golden master et smoke dans Chrome headless → déploiement Pages depuis `dist/`. La release joint `dist/index.html`.

### 7. Versionnage

Fusion unique en v1.1.0 (« Refonte en modules »), entrée CHANGELOG décrivant l'architecture et la preuve de non-régression. Le badge de version est injecté au build depuis `package.json` (le test existant « badge = manifeste » devient un test du build).

## Arbitrages après relecture constructeur (mes choix)

1. **Où vit l'aléatoire.** Le générateur traverse les trois couches exactement comme dans l'original : `flavors.js` tire ce que la recette tire (et reçoit en entrée l'analyse, la durée et le taux d'échantillonnage du sample pour `randomOffset` et les bornes `sr × 0,45`), `renderer.js` tire les `jitter()` pendant la construction du graphe, `impulse.js` tire son bruit, et la décision de bitcrush est tirée après le rendu, au même endroit qu'aujourd'hui. Le test de `flavors` vérifie donc un snapshot de config et le nombre de tirages **de la recette seule**. L'ordre global des tirages est garanti par le golden master, pas par les tests unitaires. On ne « résout » pas tout l'aléa en amont : cela changerait la structure et gonflerait les configs de dizaines de milliers de flottants pour rien.
2. **Mutation en place.** `normalize.js` et `bitcrush.js` opèrent **en place** sur le `Float32Array` reçu (celui de `getChannelData`), comme l'original. Documenté dans leur en-tête. Le shim `startRendering` du golden master voit ainsi le résultat final dans les deux versions avec un mécanisme unique.
3. **Commentaires dans le livrable.** esbuild ne conserve pas les commentaires ordinaires. Le code source lisible et commenté est désormais `src/`, pas `dist/index.html` ; le livrable garde seulement un en-tête `//!` (auteur, version, lien vers le dépôt). Le test actuel « 20 traitements décrits » devient un test de `flavors.js` (20 recettes exportées, chacune nommée). On n'écrit pas de bundler maison pour préserver des commentaires : trop de code pour un gain nul à l'écoute.

## Laissé au constructeur

- Le détail du découpage interne de `renderer.js` (une fonction par brique : transient, couches, basses, allpass, comb, saturation…), tant que le graphe Web Audio reste identique.
- Le nom exact des fonctions et des fichiers dans les limites ci-dessus.
- La taille du WAV de fixture (court, quelques dixièmes de seconde, mono).
- L'ordre d'extraction des modules (recommandé : du plus pur au plus couplé, golden master vert à chaque étape).
