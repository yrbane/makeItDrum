# make it drum.exe 🥁🪟

**Un projet de [Masao « Saiya Geez »](https://beacons.ai/saiyageez)** 🥁 — [beacons.ai/saiyageez](https://beacons.ai/saiyageez)

> **N'importe quel son devient un kit de batterie.**
> Glisse un fichier audio (un claquement de porte, une voix, une casserole, un synthé…) et make it drum en tire **20 percussions radicalement différentes** — rendues en temps réel par un moteur Web Audio procédural, dans une fenêtre Windows XP qui bouge avec ta souris.

**[▶ Démo en ligne](https://yrbane.github.io/makeItDrum/)** · **[Dernière release](https://github.com/yrbane/makeItDrum/releases/latest)**

[<img src="https://yrbane.github.io/shots/makeitdrum.webp" alt="make it drum — fenêtre Windows XP avec 20 pads de percussions" width="100%">](https://yrbane.github.io/makeItDrum/)

---

## Table des matières

- [Le concept](#le-concept)
- [Utilisation](#utilisation)
- [Les 20 percussions](#les-20-percussions)
- [Comment ça marche](#comment-ça-marche)
  - [Analyse du son importé](#analyse-du-son-importé)
  - [Le moteur de transformation](#le-moteur-de-transformation)
  - [Lecture et export](#lecture-et-export)
- [Philosophie : un fichier, zéro dépendance](#philosophie--un-fichier-zéro-dépendance)
- [Compatibilité navigateurs](#compatibilité-navigateurs)
- [Développement](#développement)
  - [Structure du dépôt](#structure-du-dépôt)
- [Conventions du projet](#conventions-du-projet)
- [Crédits](#crédits)
- [Licence](#licence)

---

## Le concept

Un sampler classique vous demande de trouver le bon son. make it drum fait l'inverse : **un seul son, n'importe lequel, suffit**. Le moteur ne synthétise rien de nouveau, il **transforme** la matière importée — il la filtre, la replie, la sature, la retarde, l'inverse, la résonne — jusqu'à obtenir un kit complet, du kick sub-grave au blast chaotique.

Chaque pad est une recette différente appliquée au même sample. Chaque clic sur un pad relance la recette avec de l'aléatoire contrôlé : on obtient une variation, jamais deux fois la même.

Le tout dans une interface qui assume son côté rétro : fenêtre XP, barre de menus, boîtier plastique brillant avec parallaxe 3D, pads façon vieux écrans LCD avec scanlines.

## Utilisation

1. Ouvrir **[la démo](https://yrbane.github.io/makeItDrum/)** ou le fichier `index.html` de la [dernière release](https://github.com/yrbane/makeItDrum/releases/latest) dans un navigateur.
2. **Glisser-déposer** un fichier audio sur la zone prévue, ou cliquer pour parcourir (`.wav`, `.mp3`, `.ogg`, tout ce que le navigateur sait décoder).
3. La bibliothèque de 20 percussions se génère en quelques secondes, avec la forme d'onde de chacune.
4. **Survoler un pad** = écoute immédiate. **Cliquer** = nouvelle variation aléatoire de cette percussion, jouée aussitôt.
5. **Jouer** : clavier `Q…P` (pads 1–10) et `A…;` (pads 11–20), ou bouton **MIDI** puis notes 36–55 depuis un clavier, un pad ou Live (Chrome/Edge ; Firefox via extension ; Safari : clavier seulement).
6. **Séquenceur** : 20 lignes × 16 pas, clic = 100 → 127 → 60 → off, `▶ PLAY`, BPM, swing. Avec `MIDI` activé : `MIDI OUT` envoie les notes 36–55 et `HORLOGE` une horloge 24 ppqn (Live, groovebox, LXR-02 en esclave). Le motif est sauvegardé avec le kit.
7. **SAUVER** garde le kit dans le navigateur ; le select **change de kit à la volée** ; **IMPORTER…** lit un `.kit.zip`.
8. **ABLETON / SFZ** : `<nom>.ableton.zip` avec un **Drum Rack Live 12** (`.adg`, 20 chaînes Simpler sur les notes 36–55), un **`.sfz`** et les WAV sous `Samples/` — dézipper, glisser le `.adg` dans Live ou le `.sfz` dans n'importe quel sampler SFZ.
9. **EXPORTER LE KIT (.KIT.ZIP)** : `kit.json` + les 20 sons `.wav` 16 bits, prêts pour le [plugin VST3 / CLAP](https://github.com/yrbane/makeItDrum-plugin), un sampler, un DAW ou une groovebox.

Au survol et au clic, une seule percussion joue à la fois : la suivante coupe net la précédente, comme sur une vraie boîte à rythmes. Au clavier et en MIDI, les pads se superposent (chaque pad coupe seulement sa propre lecture précédente).

## Les 20 percussions

| # | Nom | Recette |
|---|-----|---------|
| 1 | **BOOM** grave | corps très filtré passe-bas + renfort de basses |
| 2 | **KICK** punchy | transitoire net + wavefolder |
| 3 | **THUD** mat | mi-grave, léger comb pour un corps sourd |
| 4 | **SNAP** tonale | corps + crack aigu, léger phaser |
| 5 | **CRACK** sec | comb inversé (annulation de phase ciblée) |
| 6 | **BUZZ** phasé | phaser à balayage marqué |
| 7 | **RING** métallique | comb très court (résonance) + fold |
| 8 | **TICK** ultra-court | transitoire quasi sec |
| 9 | **GLASS** clair | aigu, léger phaser |
| 10 | **WASH** aéré | long, grande reverb, phaser lent |
| 11 | **BEND** glissant | pitch-sweep + léger comb |
| 12 | **SWELL** inversé | sample à l'envers, montée puis coupure nette |
| 13 | **STUTTER** glitché | enveloppe très courte + comb feedback élevé + bitcrush |
| 14 | **CRUSH** replié | wavefolder + bitcrush lourd |
| 15 | **PHASE** ambiante | nombreux étages allpass, sweep lent, texture longue |
| 16 | **GROWL** grave | très saturé et asymétrique |
| 17 | **PERC** clic | transitoire net + comb léger |
| 18 | **BELL** aérienne | résonance à Q élevé façon cloche, phaser subtil |
| 19 | **DARK** wash | long, sombre, sub renforcé, phaser lent, grande reverb |
| 20 | **CHAOS** blast | fold + phaser + comb + bitcrush, tout en même temps |

## Comment ça marche

### Analyse du son importé

Au chargement, le fichier est décodé par le navigateur (`decodeAudioData`), une copie inversée est calculée une fois pour toutes, puis le sample passe par une **FFT radix-2 écrite à la main** pour en extraire son profil spectral. Ce profil oriente les traitements : un son déjà grave n'a pas besoin du même renfort de basses qu'un son clair.

### Le moteur de transformation

Chaque pad est rendu **hors-ligne** dans un `OfflineAudioContext` à partir d'une configuration (durée, enveloppe, offset de lecture, vitesse, filtres, effets…). Les briques, toutes construites sur les nœuds natifs de Web Audio :

- **Transient d'attaque** : un éclat très court prélevé littéralement au début du sample.
- **Couches** : plusieurs lectures du sample à offset, vitesse et filtre variables, mixées.
- **Renfort de basses** : copie passe-bas saturée, plus un EQ peaking pour le coffre.
- **Réseau de phase** : allpass en cascade, éventuellement balayés par un LFO (phaser).
- **Comb / phase courte** : mélange avec une copie retardée en feedback (résonance, annulation).
- **Saturation multi-étages** par `WaveShaper`, avec **repliement** (wavefolder) optionnel pour un grain plus sale.
- **Bitcrush** appliqué directement sur les échantillons rendus.
- **Reverb** par convolution sur une impulsion synthétique.
- **Normalisation de crête** en fin de chaîne pour un kit homogène.

L'aléatoire (`jitter`, `pick`, `chance`) est injecté dans chaque paramètre à chaque régénération : même recette, autre variation.

### Lecture et export

Survoler un pad le joue ; cliquer régénère sa percussion avec une nouvelle graine. La barre
`KIT` sauvegarde le kit affiché dans le navigateur (IndexedDB), le select change de kit à la
volée sans rendu, `IMPORTER…` lit un `.kit.zip` ou un ancien pack de WAV, et
`EXPORTER LE KIT` télécharge `<nom>.kit.zip` : `kit.json` (schéma v1 : recettes, graines,
notes General MIDI 36–55, son source) et les 20 WAV `01_BOOM.wav … 20_CHAOS.wav`, 16 bits
mono, lisibles par le plugin [make it drum — kit player](https://github.com/yrbane/makeItDrum-plugin)
(VST3 / CLAP) ou tout sampler.

## Philosophie : un fichier, zéro dépendance

Le livrable est **un seul `index.html`** : HTML, CSS et JavaScript inlinés, aucun script ni style distant, aucun framework à l'exécution. Rien n'est envoyé sur le réseau : le son importé reste dans le navigateur. On peut télécharger le fichier depuis la [dernière release](https://github.com/yrbane/makeItDrum/releases/latest), l'ouvrir en double-cliquant dessus, et il marche.

Le code source, lui, est découpé en modules ES dans `src/` et assemblé par un build (esbuild, en dépendance de développement seulement).

## Compatibilité navigateurs

Tout navigateur moderne avec Web Audio : Chrome / Chromium, Firefox, Edge, Safari. Les formats audio acceptés dépendent des décodeurs du navigateur (`.wav` et `.mp3` partout, `.ogg` selon la plateforme).

## Développement

```bash
npm ci            # dépendances de développement uniquement (esbuild, puppeteer-core)
npm test          # tests unitaires du cœur, de l'audio, de l'UI, de l'orchestration et du build
npm run build     # produit dist/index.html (bundle esbuild inliné dans le gabarit)
node scripts/export-kit.mjs son.wav [kit.kit.zip]   # fabrique un kit en ligne de commande (Chromium headless) ; --ableton pour le Drum Rack
npm run test:e2e  # smoke E2E sur dist/index.html
npm run serve     # sert dist/ sur http://localhost:8765
```

Les scripts navigateur utilisent `/usr/bin/chromium` par défaut ; `CHROME_PATH` permet d'en choisir un autre.

La CI (GitHub Actions) enchaîne tests unitaires, build et smoke E2E à chaque push, puis déploie `dist/index.html` sur GitHub Pages depuis `main`. Chaque release joint ce fichier.

### Structure du dépôt

```
src/
  core/        pur, sans DOM ni Web Audio : random, math, fft, analysis, curves,
               bitcrush, normalize, impulse, samples, flavors (les 20 recettes), wav, zip
  audio/       Web Audio : context (live), buffers, renderer (le moteur en briques),
               postprocess, player
  ui/          DOM : dom, pads, waveform, dropzone, parallax, download, messages
  library.js   orchestration (import → rendu → lecture → export), testée avec des doubles
  app.js       composition : câble les trois couches
  template.html, styles.css
scripts/       build.mjs, smoke.mjs, export-kit.mjs, make-adg-template.mjs, make-fixture.mjs
tests/         node:test, miroir de src/ ; fixtures/fixture.wav est le son de référence
dist/          généré, non versionné : index.html autonome
```

### Reproductibilité et contrat du moteur

Chaque pad est rendu avec sa propre graine 32 bits (`mulberry32`), mémorisée et écrite
dans `kit.json` : même son source + même graine = même percussion. Le graphe Web Audio
construit par le moteur pour une graine donnée est figé par snapshot
(`tests/audio/snapshots/`) via un faux contexte audio enregistreur ; toute dérive du
moteur fait échouer ces tests. Le golden master de la 1.1.0 (comparaison à l'original
v1.0.1, à tirages identiques) a été retiré en 1.2.0 : la graine par pad change les
tirages par conception, après avoir prouvé l'équivalence de la refonte.

## Conventions du projet

- Code en anglais, commentaires et commits en français.
- Chaque commit porte une version SemVer, reportée dans `package.json`, dans le badge de l'interface et dans [`CHANGELOG.md`](CHANGELOG.md).
- Principes : TDD, SOLID, DRY, KISS, YAGNI.

## Crédits

- **Auteur** : [Masao « Saiya Geez »](https://beacons.ai/saiyageez) — concept, design et moteur sonore.
- Publication, tests et CI : [yrbane](https://github.com/yrbane).

## Licence

[MIT](LICENSE) — © 2026 Masao « Saiya Geez »
