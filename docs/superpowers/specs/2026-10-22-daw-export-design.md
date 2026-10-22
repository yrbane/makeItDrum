# make it drum 1.4.0 — export Ableton Drum Rack et SFZ — conception

Phase 3a de `docs/proposals/2026-10-22-evolutions-vst-midi-ableton.md`.

## Intention
Glisser le kit dans Live (ou tout sampler SFZ) sans passer par le plugin : un bouton,
un zip, un Drum Rack prêt avec les 20 pads sur les notes 36–55.

## Décisions
- **Un seul export** `ABLETON / SFZ` → `<nom>.ableton.zip` : `<nom>.adg`, `<nom>.sfz`,
  `Samples/01_BOOM.wav … 20_CHAOS.wav`. À dézipper tel quel ; le `.adg` et le `.sfz`
  référencent `Samples/…` en relatif.
- **`.adg`** = XML gzippé. Pas d'XML minimal inventé : le gabarit est un preset écrit par
  Live 12 (Core Library, « Chromatone Kit », chaînes Simpler), vidé de ses échantillons,
  macros et chemins (`scripts/make-adg-template.mjs`, à relancer sur une nouvelle
  référence). Une chaîne Simpler est clonée par pad : `ReceivingNote` = note du pad,
  `SendingNote` 60, `SampleEnd`/`DefaultDuration` = longueur, `DefaultSampleRate`,
  `RelativePathType` 1 (relatif au fichier, valeur observée dans les presets de Live)
  et `RelativePath`/`Path` = `Samples/<fichier>`, taille du fichier, graine du pad en
  `RoundRobinRandomSeed`. Les cibles d'automation d'un preset portent toutes l'Id 0
  (Live renumérote au chargement) : le clonage est sûr. Gabarit embarqué gzippé +
  base64 (≈10 Ko), décompressé par `DecompressionStream`, sortie par `CompressionStream`.
- **SFZ** : `<region>` par pad, `key`, `loop_mode=one_shot`, `region_label`.
- Vérification : tests unitaires sur le XML produit ; validation XML bien formé ;
  chargement dans Live à confirmer à la main (Live 12 sous Wine chez Seb).
- Non-objectifs : import `.adg`, macros, chaînes d'effets, Drum Sampler (DrumCell).

## Modules
`core/daw/adg-template.js` (généré), `core/daw/adg.js` (`loadTemplates`, `buildDrumRackXml`,
`buildAdg`), `core/daw/sfz.js` (`buildSfz`), `library.js` (`exportDaw`), bouton
`btnExportDaw`, messages, smoke (export + entrées), README, CHANGELOG.
