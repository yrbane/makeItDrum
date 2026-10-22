# make it drum 1.3.0 — MIDI in, clavier et lecture polyphonique — conception

Phase 2a + 2b de `docs/proposals/2026-10-22-evolutions-vst-midi-ableton.md`.

## Intention
Jouer les 20 pads depuis un clavier/pad MIDI ou depuis Live, et depuis le clavier de
l'ordinateur, avec vélocité et polyphonie entre pads : la page devient jouable.

## Décisions
- **Mapping** : note du pad `i` = `36 + i` par défaut ; un kit chargé apporte ses notes
  (`kit.json`). `padForNote(notes, note)` renvoie le premier pad qui porte la note.
- **Web MIDI** : `src/midi/access.js`, port du patron `WebGlitch/src/ui/midi.ts` :
  `createMidiAccess(navigator)` → `{ isSupported(), init() → Promise<boolean>, inputs(),
  setInput(id | 'all'), onNote(handler(note, velocity01)), onPortsChanged(cb) }`.
  Note-on vélocité 0 = note-off (ignoré). Branchement à chaud via `onstatechange`.
  Sans API (Safari, Firefox sans extension) : bouton désactivé, clavier toujours actif.
- **Lecture polyphonique** : `src/audio/polyplayer.js`, `createPolyPlayer(getContext)` →
  `{ play(buffer, { voice, gain, onStart, onStop }), stopAll() }` ; redéclencher la même
  `voice` coupe la précédente (choke par pad), les autres pads continuent.
  Le survol/clic garde le lecteur mono historique (« une seule percussion à la fois »).
- **Clavier** : `src/ui/keyboard.js`, `bindKeyboard(doc, onPad)` : `KeyQ…KeyP` → pads
  1–10, `KeyA…KeyL, Semicolon` → pads 11–20 (par `event.code`, indépendant d'AZERTY),
  sans répétition, ignoré dans les champs de saisie. Vélocité 1.
- **Bibliothèque** : `trigger(idx, velocity)` (poly, classe `playing`), `noteOn(note,
  velocity)` via le mapping, `notes[]`.
- **Interface** : dans la barre de transport, bouton `MIDI` (demande l'accès, geste
  utilisateur) puis select des entrées (`Toutes les entrées` + ports) ; statut dans la
  barre d'état. Légende « clavier : Q…P, A…; » dans le libellé de section.
- Non-objectifs : MIDI out, horloge, séquenceur (1.5.0), CC, canaux.

## Modules
`core/midi/drummap.js` (`padForNote`, `parseMidiMessage`), `midi/access.js`,
`audio/polyplayer.js`, `ui/keyboard.js`, `library.js` (+ `trigger`, `noteOn`, `notes`),
`template.html`, `styles.css`, `messages.js`, `app.js`, smoke (clavier), README, CHANGELOG.
