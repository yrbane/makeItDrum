# make it drum 1.5.0 — séquenceur pas-à-pas, sortie MIDI et horloge — conception

Phase 2c + 2d de `docs/proposals/2026-10-22-evolutions-vst-midi-ableton.md`.

## Intention
La page devient une boîte à rythmes : un motif de 16 pas sur les 20 pads, joué par le
moteur Web Audio avec une horloge précise, et envoyé en MIDI (notes + horloge 24 ppqn)
pour piloter Live ou une machine (LXR-02).

## Décisions
- **Motif** (`src/core/sequencer.js`, pur) : `createPattern(tracks = 20, steps = 16)` →
  `{ steps, tracks: Uint8Array[tracks] }` avec vélocité 0 (off) / 1–127 par pas ;
  `toggleStep(pattern, track, step, velocity = 100)` (cycle off → 100 → 127 → 60 → off ;
  immuable : renvoie un nouveau motif) ; `stepDuration(bpm) = 60 / bpm / 4` ;
  `stepTime(step, bpm, swing)` : décalage des pas impairs de `swing × stepDuration / 2`
  (swing 0–1) ; `eventsBetween(pattern, { bpm, swing, origin }, from, to)` → liste
  `{ time, step, track, velocity }` pour `origin + k × barDuration + stepTime` dans
  `[from, to)`. Tout testable sans horloge.
- **Planificateur** (`src/audio/scheduler.js`) : `createScheduler({ getContext, pattern(),
  settings(), onEvent(ev), onStep(step), setInterval, clearInterval, interval = 25 ms,
  lookahead = 0.1 s })` → `{ start(), stop(), isRunning() }`. `start()` fixe `origin =
  currentTime + 0.05`, chaque tick planifie `eventsBetween(lastTime, now + lookahead)`.
  `onStep` est appelé au moment du tick pour l'affichage (tolérance 25 ms).
- **Lecture** : `polyPlayer.play(buffer, { when })` → `src.start(when)` ; le séquenceur
  déclenche `library.trigger(idx, velocity / 127, when)`.
- **MIDI out** (`src/midi/out.js` + `outputs()`/`setOutput(id)` dans `access.js`) :
  `createMidiOut(access, { toMidiTime })` → `noteOn(note, vel, time)` + `noteOff` 50 ms
  après, `clockTicks(from, to, bpm, origin)` → 0xF8 à 24 ppqn avec horodatage,
  `start()` 0xFA, `stop()` 0xFC. Horodatage : `performance.now() + (t − currentTime) ×
  1000`. Désactivé si aucune sortie choisie (« aucune »).
- **Kit** : `pattern` optionnel dans `kit.json` v1 (`{ steps, bpm, swing, tracks: [[…]] }`)
  et dans l'enregistrement IndexedDB ; le plugin ignore les champs inconnus.
- **Interface** : section `SÉQUENCEUR` sous les pads : transport (▶ / ■, BPM 40–240,
  swing 0–100 %, select `MIDI OUT` + case `horloge`), grille 20 lignes × 16 pas
  (boutons `.step`, classes `on`, `v127`, `v60`, colonne `.now`), étiquette de recette
  par ligne. Les pas 1, 5, 9, 13 sont marqués. Tout reste dans le mono-fichier.
- Non-objectifs : longueur > 1 mesure, mode esclave, enregistrement en direct, MIDI out
  des pads joués à la main (1.6.0 si demandé).

## Modules
`core/sequencer.js`, `audio/scheduler.js`, `audio/polyplayer.js` (`when`), `midi/access.js`
(`outputs`, `setOutput`), `midi/out.js`, `library.js` (`trigger(idx, vel, when)`,
`pattern`, `setPattern`), `ui/stepgrid.js`, `ui/transport.js`, `template.html`,
`styles.css`, `messages.js`, `app.js`, `core/kit.js` (`pattern`), smoke (motif joué),
README, CHANGELOG.
