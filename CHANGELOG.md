# Changelog

## 1.0.0 — 2026-10-22 · « Première publication »

- **Moteur procédural de percussions** : un seul son importé (wav / mp3 / ogg…) devient un kit de 20 percussions très différentes — BOOM, KICK, THUD, SNAP, CRACK, BUZZ, RING, TICK, GLASS, WASH, BEND, SWELL, STUTTER, CRUSH, PHASE, GROWL, PERC, BELL, DARK, CHAOS.
- **Transformation, pas synthèse** : chaque pad est rendu hors-ligne (`OfflineAudioContext`) à partir du sample : transitoire d'attaque, couches à offset/vitesse/filtre variables, renfort de basses, réseau allpass, comb/phase, saturation multi-étages, wavefolder, bitcrush, reverb par impulsion synthétique, normalisation de crête.
- **Analyse spectrale** du son importé (FFT radix-2 maison) pour adapter les traitements à la matière sonore.
- **Interaction** : survol d'un pad = écoute immédiate, clic = nouvelle variation aléatoire ; une seule percussion joue à la fois, coupée net dès qu'une autre démarre ; forme d'onde dessinée sur chaque pad.
- **Export** : téléchargement de tout le kit en `.zip` (20 fichiers `.wav` 16 bits, encodeur WAV et archive ZIP « store » écrits à la main).
- **Interface Windows XP** : fenêtre, barre de menus, boîtier plastique avec parallaxe 3D à la souris, pads façon vieux écrans LCD/CRT avec scanlines.
- **Zéro dépendance** : un seul fichier `index.html`, aucun script ni style distant, rien n'est envoyé sur le réseau.
- Tests de cohérence (`node --test`), CI GitHub Actions avec déploiement automatique sur GitHub Pages.
