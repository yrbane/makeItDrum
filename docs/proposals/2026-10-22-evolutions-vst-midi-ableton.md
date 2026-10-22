# make it drum — proposition d'évolutions : kits, MIDI, Ableton, VST

*Proposition d'architecture et de phasage — 22 octobre 2026 — état de référence : `make-it-drum` v1.1.0 (modules ES, 1 227 lignes, 50 tests, golden master, `dist/index.html` 60 Ko).*

Ce document répond aux quatre souhaits de Seb :

1. « que ça devienne un VST » ;
2. « que les notes soient mappées en MIDI (donc que ça puisse devenir une BAR) » ;
3. « un bouton pour envoyer le kit dans le Simpler d'Ableton ou pour charger d'autres BAR » ;
4. « pouvoir sauver son kit et faire une selectbox pour changer de kit à la volée ».

Il est organisé en quatre parties : **A.** ce que les autres dépôts apportent, **B.** l'état de l'art technique (avec sources), **C.** l'architecture et le phasage proposés, **D.** la recommandation et les questions ouvertes.

---

## Résumé en une page

| # | Phase | Objectif | Effort | Dépendance | Livrable web mono-fichier conservé ? |
|---|---|---|---|---|---|
| 0 | Graine reproductible | chaque pad porte une graine ; régénération à l'identique | 1 j | — | oui |
| 1 | Kits : sauvegarde, fichier, selectbox | `.kit.zip` (20 WAV + `kit.json`), IndexedDB, changement à la volée | 3–4 j | 0 | oui |
| 2 | BAR web | Web MIDI in (GM 36–55, vélocité), lecteur polyphonique, séquenceur pas-à-pas, MIDI out + horloge | 5–8 j | 1 | oui |
| 3a | Export Ableton | Drum Rack `.adg` (gzip XML) + `.sfz` + `.dspreset`, import de kits WAV/SFZ | 3–5 j | 1 | oui |
| 3b | Pont Ableton direct | compagnon local (Node) + Remote Script : « Envoyer dans Live » en un clic | 4–6 j | 3a | oui (le compagnon est un outil à part) |
| 4a | Plugin « lecteur de kit » | VST3 + CLAP (Rust, nih-plug), joue les kits `.kit.zip`, MIDI, selectbox de kits | 10–15 j | 1 | oui (dépôt séparé) |
| 4b | Plugin « UI web + moteur Web Audio » | la page actuelle dans une WebView du plugin, rendu Web Audio embarqué, lecteur natif | 20–35 j | 4a | oui |
| 4c | Réécriture DSP native | port du graphe sur `web-audio-api-rs` | 30–60 j | 4a | — |

**Recommandation courte** : 0 → 1 → 2 → 3a → 3b → 4a, puis 4b seulement si le besoin « régénérer dans le DAW » est réel ; 4c n'est pas recommandée aujourd'hui. Le point clé qui rend tout cela réaliste : **le moteur est hors-ligne** (il *rend* 20 WAV puis les *joue*). Un plugin n'a donc pas besoin du DSP Web Audio en temps réel : un **lecteur d'échantillons** suffit, et le son reste strictement identique à la version web.

---

## A. Les autres dépôts de Seb : briques et retours d'expérience

| Dépôt | Stack | État (oct. 2026) | Réutilisable pour make it drum |
|---|---|---|---|
| **drum-vst3** (`/home/seb/Dev/drum-vst3`) | Rust workspace : `common`, `core_dsp`, `vst3_plugin` (crate `vst3` 0.3, bindings COM bruts), `standalone` (cpal + midir), `gui` (egui/eframe) ; hound, rustfft ; ~19 700 lignes ; 21 specs numérotées ; CI fmt/clippy/tests + workflow release ; tests audio golden | Dernier commit 10/12/2025 ; boîte à rythmes **par synthèse** avec séquenceur 16 pas, pages, LFO, sidechain, chargement WAV, oscilloscope | **Beaucoup** : plomberie VST3 (`plugin.rs`, `midi.rs`, `state.rs`, `params.rs`), moteur de voix et chargement d'échantillons (`core_dsp/sample`, `voice`), séquenceur + transport, widgets egui (pads, step buttons, transport), tests golden audio, CI/release. C'est la base naturelle de la phase 4a. Point d'attention : UI egui (pas web) et bindings `vst3` unsafe ; nih-plug ferait la même chose en moins de code. |
| **acidgrid** (`/home/seb/Dev/acidgrid`) | Python (mido, pygame), générateur MIDI multi-styles ; **Remote Script Ableton** (`ableton_remote_script/ACIDGRID/` : `ControlSurface`, `c_instance.song()`, `receive_midi`, `build_midi_map`, création de clips via `ClipCreator`) + `install.sh` | Actif (fév. 2026) | **Squelette de Remote Script** fonctionnel avec installation documentée : exactement ce qu'il faut pour la phase 3b (« Envoyer dans Live »), où seul un script Python dans Live peut appeler les fonctions de conversion Simpler → Drum Rack. |
| **Abletonux** (`/home/seb/Dev/Abletonux`) | Scripts bash : Live 12 sous **Wine** (Arch, WineASIO, PipeWire-JACK), préfixe `~/.wine-ableton` | Fonctionnel (juil. 2026) | Pas de code, mais une **contrainte structurante** : chez Seb, Live tourne dans Wine. Conséquences : (1) un plugin doit être compilé **pour Windows** (`x86_64-pc-windows-gnu/msvc`) pour être vu par ce Live, pas en `.so` Linux ; (2) une WebView2 dans Wine est un risque connu ; (3) la User Library est dans `~/.wine-ableton/drive_c/users/<user>/Documents/Ableton/User Library/` ; (4) les Remote Scripts et un serveur UDP/OSC sur `localhost` fonctionnent normalement (Wine partage la pile réseau de l'hôte). |
| **LiveSet** (`/home/seb/Dev/LiveSet`) | Site statique (HTML/CSS `lunar-aurora`, `data/gear.js`) décrivant le setup live : Erica Synths **LXR-02**, MicroBrute, Eurorack, MiniFuse, templates Ableton | Décembre 2025 | Rien à réutiliser en code ; mais il documente le **cas d'usage réel** : une BAR matérielle (LXR-02) et un Live en face. Le MIDI out de la phase 2 a donc une cible concrète (déclencher le LXR-02 depuis la page, ou l'inverse). |
| **WebGlitch** (`/home/seb/Dev/WebGlitch`) | Extension navigateur TS (vite/vitest/happy-dom) ; `src/ui/midi.ts` = **adaptateur Web MIDI** unique (init paresseuse, `onstatechange` pour le branchement à chaud, filtrage par port, CC learn, dégradation propre si l'API est absente — cas Firefox) | v0.4.0, actif | **Le patron exact** de `src/midi/access.js` pour la phase 2 : même structure, mêmes garde-fous, en JS. Il manque seulement le note-on/off et les sorties (`MIDIOutput`). |

---

## B. État de l'art technique (sources en fin de document)

### B.1 Web MIDI (entrée / sortie)

| Navigateur | `requestMIDIAccess` | Entrées | Sorties | Remarques |
|---|---|---|---|---|
| Chrome / Edge / Chromium | oui (Chrome 43+, Edge 79+) | oui | oui, `send(data, timestamp)` planifiable | depuis Chrome 124, **prompt de permission** pour tout usage (plus seulement SysEx) ; contexte sécurisé requis (https, `localhost`) |
| Firefox | oui (108+) | oui | oui | passe par l'installation d'un **« site permission add-on »** ; refus → `SecurityError: WebMIDI requires a site permission add-on` |
| Safari | **non** | — | — | aucune implémentation ; prévoir une UI qui se masque proprement |

- GitHub Pages est en https : OK. Le fichier `dist/index.html` ouvert en `file://` n'est pas garanti comme contexte sécurisé pour cette API : à vérifier sur Chromium, et de toute façon prévoir le repli clavier (touches → pads).
- Horloge MIDI et séquenceur : les timers JS ne sont pas fiables, il faut un **ordonnanceur à anticipation** (lookahead ~100 ms, `setInterval` 25 ms, horloge de référence `AudioContext.currentTime`, le motif « A Tale of Two Clocks »), et `MIDIOutput.send(msg, timestamp)` avec un `DOMHighResTimeStamp` futur pour que le navigateur émette au bon moment. La précision réelle dépend du pilote (ALSA sous Linux : bonne).
- Ableton Link : bibliothèque C++ (GPLv2 / commerciale), pas d'implémentation navigateur ; `abletonlink` npm est un addon natif Node beta. Un pont Link exigerait le compagnon de la phase 3b → **YAGNI** tant que la synchro par horloge MIDI suffit.

### B.2 Porter le moteur Web Audio vers un plugin : les options

Rappel du graphe réel (`src/audio/renderer.js`, 234 lignes) : `AudioBufferSourceNode` (vitesse, rampes), `BiquadFilterNode` (lowpass/bandpass/highpass/peaking + allpass en cascade pour le phaser), `GainNode` avec `setValueCurveAtTime`, `DelayNode` en feedback (comb), `WaveShaperNode` avec `oversample` 2x/4x, `ConvolverNode` sur impulsion synthétique, `DynamicsCompressorNode` en master, le tout dans un `OfflineAudioContext` mono, puis bitcrush et normalisation en JS pur.

| Option | Principe | UI | Formats | Licence | Linux / Wine | Verdict pour nous |
|---|---|---|---|---|---|---|
| **Lecteur de kit natif** (Rust, **nih-plug**) | le plugin ne rend rien, il **joue** les 20 WAV d'un kit exporté par la page | egui (widgets de drum-vst3) | VST3 + CLAP par macro | ISC (nih-plug) ; VST3 SDK en **MIT depuis 3.8** (oct. 2025) | oui ; cross-compilation Windows pour Live-dans-Wine | **Recommandé en premier** : son 100 % identique, aucun DSP à porter, réutilise drum-vst3 |
| **UI web + moteur Web Audio embarqué** | la page actuelle tourne dans une **WebView** du plugin ; le rendu se fait dans l'`OfflineAudioContext` de la WebView ; les buffers passent au lecteur natif par message | la nôtre, telle quelle | VST3/CLAP (nih-plug-webview, expérimental, macOS/Windows) ; JUCE 8 `WebBrowserComponent` (WebView2 / WKWebView / WebKitGTK) ; extension CLAP `webview` (draft) + `webview-gui` de Signalsmith (CHOC) | ISC / GPLv3-ou-commercial (JUCE) / MIT | WebKitGTK côté hôte Linux ; **WebView2 dans Wine = risque élevé** | Séduisant (une seule base de code UI), à faire **après** le lecteur natif ; dépend de la maturité des WebViews dans les hôtes |
| **Réécriture DSP native** (Rust, `web-audio-api-rs`) | reconstruire le même graphe avec la bibliothèque Rust qui implémente la spec (nœuds Biquad, WaveShaper avec oversampling, Convolver, DynamicsCompressor, Delay, IIR présents ; `OfflineAudioContext` ; backends cpal/jack/pipewire) | egui ou WebView | VST3/CLAP | MIT | oui | Faisable (le graphe tient en 234 lignes) mais **l'identité au bit près est impossible** (voir B.3) ; n'a de sens que si le plugin doit *régénérer* des variations en temps réel |
| **Elementary Audio** | DSP décrit en JS, moteur C++ embarquable, template de plugin SRVB | web | VST/AU via leur intégration native | à vérifier (core open-source, kit plugin : vérifier les conditions) | partiel | Impose de réécrire le moteur dans son langage de graphe : on perd le Web Audio natif sans gagner la compatibilité |
| **Cmajor** | langage DSP, export projet JUCE C++ ou export web/WASM, JIT ; utilisé en production par NI | web ou JUCE | VST/AU/AAX via JUCE | **GPLv3 / commerciale** | oui | Même objection : réécriture totale ; licence contraignante |
| **iPlug2** | framework C++ permissif, exemples d'UI HTML/CSS, cible WAM (Web Audio Modules) | web possible | VST3/AU/AAX/CLAP/WAM | permissive | oui | Alternative C++ crédible à JUCE si la voie WebView est retenue ; pas d'avantage net sur nih-plug pour nous |

### B.3 Peut-on reproduire *exactement* les nœuds Web Audio ?

- `BiquadFilterNode` : formules fixées par la spec (Audio EQ Cookbook) → reproductible à la précision flottante près.
- `WaveShaperNode` avec `oversample` : la spec laisse le **filtre de suréchantillonnage à l'implémentation** → Chromium, WebKit et `web-audio-api-rs` diffèrent légèrement.
- `DynamicsCompressorNode` : la courbe (knee, ratio, attaque/relâchement adaptatifs) est **définie par le noyau de Chromium/WebKit** (`DynamicsCompressorKernel.cpp`), pas par la spec → c'est le nœud le moins portable.
- `ConvolverNode` : convolution partitionnée FFT ; résultat numériquement proche mais pas identique.
- Le projet **accepte déjà** une tolérance : le golden master mesure ~2e-3 d'écart entre deux rendus Chromium du *même* code (sommation non déterministe des entrées multiples, amplifiée par la saturation). Un port natif se jugerait donc « perceptuellement identique, sous tolérance », jamais « identique au bit ». D'où la recommandation de **ne pas porter le DSP** tant que le plugin peut jouer des WAV pré-rendus.
- Bonus : `node-web-audio-api` (bindings Node de `web-audio-api-rs`, binaires prébuilts Linux/mac/Windows, testé contre la suite WPT) permet de faire tourner **le code JS actuel tel quel** hors navigateur (`createRenderer({ OfflineAudioContextCtor })` est déjà injectable). C'est un atout pour le compagnon local (3b) ou pour des tests de rendu en CI sans Chromium.

### B.4 Ableton Live : ce qui est possible, et d'où

| Voie | Depuis le navigateur seul ? | Ce que ça fait | Limites |
|---|---|---|---|
| **Fichier `.adg`** (Drum Rack = XML gzippé) | **oui** (`CompressionStream('gzip')` natif, zéro dépendance) | on génère un rack de 20 pads Simpler pointant vers nos WAV ; l'utilisateur le glisse dans Live ou le dépose dans `User Library/Presets/Instruments/Drum Rack/` | **pas de schéma officiel** ; Live est intransigeant sur l'ordre des éléments ; références : `adgmaker` (Python), `tommcc/alsample` ; chemins (`RelativePathType` : Missing / External / Library / Current Project) à calibrer sur un `.adg` de référence exporté depuis le Live de Seb |
| **Dossier de WAV nommés** | oui (déjà fait : ZIP) | glisser les 20 fichiers sur un Drum Rack vide de Live les répartit sur les pads | manuel, mais universel |
| **Glisser-déposer depuis la page vers Live** | expérimental | `dataTransfer.setData('DownloadURL', 'audio/wav:nom.wav:blob…')` (non standard, Chrome) | peu fiable ; les retours (forum JUCE) sont négatifs ; à tester en 1 h, ne rien construire dessus |
| **Live API : charger un fichier dans un pad / Simpler** | non | `Browser.load_item` exige un `BrowserItem` ; **rien ne transforme un chemin en BrowserItem** (l'arbre ne contient que la User Library et les dossiers ajoutés) | → il faut *d'abord* écrire les fichiers dans la User Library, puis parcourir `browser.user_library` pour retrouver l'item et `load_item` sur un `hotswap_target` ; faisable mais fragile |
| **Live API : la « route directe »** | non (Remote Script ou Max for Live) | `create_midi_track_with_simpler(clip)` → `Sample.insert_slice(t)` à chaque frontière → `sliced_simpler_to_drum_rack(simpler)` : c'est le chemin qu'emprunte la commande *Slice to New MIDI Track* de Live. On écrit **un seul WAV** avec les 20 sons bout à bout et on connaît les offsets exacts | nécessite un clip audio dans Live (donc un fichier visible) ; noms de fonctions relevés sur un retour d'expérience (Node for Max, Live 12), à confirmer dans la doc LOM 12.3 |
| **AbletonOSC** | non (UDP, pas depuis une page) | Remote Script exposant le LOM en OSC (ports 11000/11001, Live 11+) : pistes, clips, devices, paramètres | **ni chargement de sample ni navigateur** dans l'API exposée → utile pour piloter, pas pour charger |
| **Max for Live** | non (Suite requis) | même LOM, mêmes limites ; Node for Max peut écrire des fichiers | ajoute une dépendance (Max) sans lever la limite du LOM |

Conclusion honnête : **« envoyer dans le Simpler » en un clic ne peut pas se faire depuis une page web seule.** Il faut un petit **compagnon local** (Node) qui écrit les fichiers là où Live les voit et un **Remote Script** (squelette acidgrid) qui exécute la conversion. L'export `.adg` + WAV, lui, est faisable aujourd'hui, sans rien installer.

### B.5 Formats d'échange de kits

| Format | Nature | Qui le lit | Pour nous |
|---|---|---|---|
| **Dossier/ZIP de WAV nommés** | universel | tout sampler, tout DAW, groovebox | déjà livré ; ajouter un nommage GM (`36_BOOM.wav`…) |
| **`kit.json` (le nôtre)** | métadonnées : graine, source, recettes, motif | make it drum (web et plugin) | **format pivot** ; versionné par `schemaVersion` |
| **SFZ** | texte + WAV, spec ouverte (`<region> sample= key= lovel= hivel=`) | sfizz, Decent Sampler (import), Hydrogen/Drumlabooh, Reaper (ReaSamplOmatic via import), beaucoup d'autres | **oui**, coût ~1 j, zéro dépendance |
| **Decent Sampler `.dspreset`** | XML + WAV, lecteur gratuit (VST3/AU/Linux) | Decent Sampler | optionnel, 0,5 j une fois SFZ fait |
| **SoundFont `.sf2`** | binaire monolithique, noms limités à 16 caractères | GM, trackers, FluidSynth | non prioritaire ; convertible depuis SFZ avec ConvertWithMoss |
| **`.adg`** | gzip XML propriétaire | Ableton seulement | oui, phase 3a |

---

## C. Architecture et phasage

### C.0 Invariants

- **Un fichier web, zéro dépendance d'exécution** : toutes les phases 0 à 3a vivent dans `dist/index.html`. Les API natives suffisent : Web MIDI, IndexedDB, `CompressionStream`, `File System Access` (facultatif).
- **TDD** : chaque module `core/` arrive avec ses tests `node:test` ; les modules `audio/`, `midi/`, `storage/` sont testés avec des doubles injectés, comme `library.js` aujourd'hui.
- **SOLID / KISS** : `library.js` reste l'orchestrateur ; les nouvelles capacités arrivent par **injection** dans `createLibrary` (comme `renderer`, `player`, `download`), pas par couplage au DOM.
- **YAGNI** : pas de cloud, pas de compte, pas de Link, pas de multi-kits simultanés, pas de choke groups tant que personne ne les demande.
- **Golden master** : la comparaison avec `v1.0.1` a servi à prouver le refactor. Dès que l'ordre des tirages aléatoires change (phase 0), il faut **re-baser** le golden sur `v1.1.0` (trace du graphe + 20 buffers sous tolérance) puis le faire évoluer avec le moteur. C'est un choix à acter (question ouverte Q7).
- Le plugin (phase 4) vit dans un **dépôt séparé** (`makeitdrum-plugin`), avec ses propres règles (clippy/fmt), et ne partage avec le web que le format `kit.json`.

### C.1 Vue d'ensemble cible

```
                 ┌──────────────── dist/index.html (zéro dépendance) ────────────────┐
                 │  ui/        pads · kitSelect · stepGrid · midiMenu · transport     │
                 │  library.js  orchestration (import → rendu → kits → lecture → MIDI)│
 Web MIDI in ───►│  midi/      access · in (note→pad) · out (notes, clock)           │───► Web MIDI out (LXR-02, Live…)
                 │  core/      flavors · prng · kit · drummap · sequencer · adg · sfz │
                 │  audio/     renderer (OfflineAudioContext) · polyPlayer            │
                 │  storage/   kits (IndexedDB)                                        │
                 └──────┬───────────────────────────────────────────┬───────────────┘
          .kit.zip / .adg / .sfz (téléchargement)         http://127.0.0.1:<port> (optionnel)
                        │                                           │
         ┌──────────────▼─────────────┐              ┌──────────────▼───────────────────┐
         │ makeitdrum-plugin (Rust)   │              │ makeitdrum-bridge (Node, optionnel)│
         │ nih-plug → VST3 + CLAP     │              │ écrit dans la User Library,        │
         │ lecteur 20 voix, MIDI,     │              │ pilote le Remote Script            │
         │ selectbox de kits          │              │ « MakeItDrum » (Live API)          │
         └────────────────────────────┘              └────────────────────────────────────┘
```

### Phase 0 — Graine reproductible (1 jour)

**Objectif.** Pouvoir régénérer un pad, ou un kit entier, strictement à l'identique. Prérequis des kits « légers » (phase 1) et des variations partageables.

**Briques.** `createRandom` est déjà injectable ; `scripts/make-fixture.mjs` contient déjà un `mulberry32`. On le promeut en `src/core/prng.js` (`mulberry32(seed)`, `deriveSeed(parent, index)`, `randomSeed()`), et chaque rendu reçoit **son propre générateur** : `renderer.render(cfg, sample, rng)` au lieu d'un `rng` global capturé à la création. `library.generate(idx)` tire une graine 32 bits, la mémorise dans `pads[idx].seed`, et rend avec `createRandom(mulberry32(seed))`. L'ordre des tirages dans `renderer.js` est déjà documenté comme contrat (« l'ordre des briques est aussi l'ordre des tirages ») : on l'écrit dans un test.

**Ce que ça change.** `src/audio/renderer.js` (signature), `src/library.js` (état `seeds[]`), `src/app.js` (plus de `rng` global), `tests/`. UI : rien de visible, sauf un petit « #1a2b3c » optionnel sous le pad.

**Risques.** Casse du golden master actuel (voir C.0) ; déterminisme inter-navigateurs seulement sous tolérance (c'est pourquoi la phase 1 stocke aussi les WAV).

### Phase 1 — Kits : sauvegarde, chargement, selectbox (3–4 jours)

**Objectif.** « Sauver son kit » et « changer de kit à la volée ».

**Format pivot `kit.json`** (dans un ZIP `nom.kit.zip` avec les 20 WAV) :

```json
{
  "schemaVersion": 1,
  "app": "make-it-drum", "engineVersion": "1.2.0",
  "name": "Casserole bleue", "createdAt": "2026-10-22T20:10:00Z",
  "source": { "fileName": "casserole.wav", "sampleRate": 44100, "duration": 0.53, "sha256": "…" },
  "pads": [
    { "index": 0, "flavor": "BOOM", "seed": 2874911021, "note": 36, "file": "01_BOOM.wav" },
    { "index": 1, "flavor": "KICK", "seed": 19371,      "note": 37, "file": "02_KICK.wav" }
  ],
  "pattern": null
}
```

- Les WAV sont la **vérité** (rejouables partout, y compris dans le plugin) ; les graines sont la **provenance** (régénérer à l'identique si la source est encore là). Un kit sans sa source se charge quand même.
- Nommage des fichiers `NN_FLAVOR.wav` (compatible avec l'export ZIP actuel, qui devient simplement « exporter le kit »).

**Stockage navigateur.** `src/storage/kits.js` : IndexedDB (`kits` : métadonnées + 20 `Float32Array`/PCM16 ; ~0,5 à 2 Mo par kit). Injecté dans `createLibrary` sous une interface minuscule `{ list(), get(id), put(kit), remove(id) }` ; les tests utilisent un double en mémoire. Le fichier `.kit.zip` est l'export/import (bouton + glisser-déposer sur la fenêtre, détecté par `kit.json` à l'intérieur).

**Selectbox.** `src/ui/kitSelect.js` dans la barre de menus XP : liste des kits stockés, « Sauver le kit… » (nom), « Renommer », « Supprimer », « Exporter (.kit.zip) », « Importer… ». Changer de kit = `library.loadKit(kit)` : remplace `buffers[]`, redessine les 20 formes d'onde, **sans rendu** → instantané, pendant une lecture. Le sample source du kit chargé est restauré s'il est présent (sinon les pads se jouent mais « cliquer pour varier » demande de réimporter un son).

**Ce que ça change.** Nouveaux `core/kit.js` (sérialisation/validation pure, testée), `core/zip.js` gagne un **lecteur** (le ZIP « store » est trivial à parser ; les ZIP compressés sont refusés avec un message clair — ou décompressés via `DecompressionStream('deflate-raw')`, natif), `storage/kits.js`, `ui/kitSelect.js`, `library.js` (+ `saveKit/loadKit/exportKit/importKit`), `template.html`, `styles.css`.

**Risques.** Quota IndexedDB (navigation privée, Safari) → dégrader vers « export fichier seulement ». Taille du mono-fichier : +~6 Ko.

### Phase 2 — BAR web : MIDI in, lecteur polyphonique, séquenceur, MIDI out (5–8 jours)

**2a. Entrée MIDI (1–2 j).** `src/midi/access.js` = port JS de `WebGlitch/src/ui/midi.ts` (init paresseuse au clic sur le menu 🎹, `onstatechange`, choix du port, masquage propre si l'API est absente). `src/core/midi/drummap.js` (pur) : table **General MIDI 36–55 → pads 0–19** (36 BOOM, 37 KICK, 38 THUD/snare… l'ordre exact des 20 recettes sur les 20 notes GM est une décision éditoriale, Q4) + mode « chromatique » (note − 36) ; `velocity/127` → gain (courbe réglable, `^1.5` par défaut). `library.trigger(idx, velocity)`. Le mapping est enregistré dans `kit.json` (`note` par pad). Repli clavier : touches `Q S D F…` → pads, utile sans MIDI et sur Safari.

**2b. Lecteur polyphonique (0,5 j).** `createPlayer` coupe la source précédente (mono) : parfait pour l'écoute au survol, inacceptable pour une BAR. `src/audio/polyPlayer.js` : N voix (une `AudioBufferSourceNode` + `GainNode` par déclenchement, nettoyage sur `ended`), gain de vélocité, option « mono par pad » (retrigger coupe la voix précédente du même pad). Le survol continue d'utiliser le comportement actuel.

**2c. Séquenceur pas-à-pas (2–3 j).** `src/core/sequencer.js` pur : motif 16 pas × 20 pistes (vélocité par pas, swing, longueur 1–4 mesures), fonction `stepsBetween(tFrom, tTo, bpm)` testable sans horloge réelle. `src/audio/scheduler.js` : boucle à anticipation (`setInterval` 25 ms, lookahead 100 ms) qui planifie `source.start(t)` sur `AudioContext.currentTime`. UI `src/ui/stepGrid.js` + transport (play/stop, BPM, swing) dans la fenêtre XP, sous les pads. Le motif est sauvegardé dans le kit (`pattern`).

**2d. Sortie MIDI + horloge (1–2 j).** `src/midi/out.js` : notes (note-on/off avec `timestamp` futur dérivé de l'horloge audio : `performance.now() + (t − ctx.currentTime)·1000`), **horloge MIDI** (0xF8 à 24 ppqn, Start/Stop/Continue) pour entraîner le LXR-02 ou Live en esclave. Mode esclave (suivre une horloge externe) : plus tard, si demandé.

**Ce que ça change.** `app.js` (composition), `library.js` (`trigger`, `setKitMapping`), nouveaux dossiers `src/midi/` et modules ci-dessus, `template.html` (menu MIDI, transport, grille), `styles.css`. Zéro dépendance : conservée.

**Risques.** Permissions (prompt Chrome, add-on Firefox, rien sur Safari) → tout doit fonctionner sans MIDI. Gigue de `MIDIOutput.send` selon l'OS. Taille de la page (+10–15 Ko).

### Phase 3a — Pont Ableton par fichiers + formats d'échange (3–5 jours)

**Objectif.** « Envoyer dans Ableton » sans rien installer, et « charger d'autres BAR » dans les deux sens.

1. **Export Drum Rack `.adg`** (`src/core/adg.js`, pur, 1,5–2,5 j) : gabarit XML extrait d'un `.adg` **de référence** exporté depuis le Live 12 de Seb (20 pads Simpler, notes 36–55), paramétré par les 20 chemins ; gzip via `CompressionStream('gzip')`. Livrable : `nom.ableton.zip` = `nom.adg` + `Samples/NN_FLAVOR.wav`, chemins en `RelativePathType` « Current Project » ou « Library » selon ce que le golden de référence montre. Test : round-trip gunzip → XML → les 20 chemins y sont, dans l'ordre ; **validation manuelle dans Live** (un `.adg` mal ordonné est ignoré silencieusement — c'est le risque principal, documenté par les retours d'expérience).
2. **Export SFZ** (`src/core/sfz.js`, 0,5–1 j) : un `<region>` par pad, `key=`, `lovel=0 hivel=127`, `loop_mode=one_shot`. Ouvre Decent Sampler, sfizz, Hydrogen, Reaper, MPC via convertisseurs. **`.dspreset`** en option (0,5 j).
3. **Import de kits externes** (1 j) : glisser un dossier/ZIP de WAV (≤ 20, tri par nom), ou un `.sfz` simple (regions `sample=`/`key=`) → les pads deviennent ces sons ; les recettes sont alors inactives sur ces pads (cliquer joue sans varier) ou, mieux, chaque WAV importé peut lui-même servir de **source** : « make it drum » sur un kit existant, ce qui est fidèle au concept.
4. **Essai de glisser-déposer `DownloadURL`** vers Live : 1 h, à consigner comme résultat, pas comme fonctionnalité.

**Ce que ça change.** `core/adg.js`, `core/sfz.js`, `library.js` (`exportAbleton`, `exportSfz`, `importKitFiles`), menu « Exporter ▸ ZIP / Kit / Ableton Drum Rack / SFZ ».

### Phase 3b — Pont Ableton direct : compagnon local + Remote Script (4–6 jours)

**Objectif.** Le bouton « Envoyer dans Live » fait apparaître un Drum Rack (ou un Simpler) prêt à jouer, sans glisser-déposer.

**Architecture.** Deux petites pièces, hors du mono-fichier web :

- `makeitdrum-bridge` (Node ≥ 20, un seul fichier ou un paquet npm, **zéro dépendance** possible : `node:http` + `ws` évité en utilisant HTTP simple) : écoute sur `127.0.0.1:47800`, CORS limité à l'origine de la page (et `localhost`), expose `GET /health`, `POST /kit` (reçoit le `.kit.zip`), écrit les WAV dans `…/User Library/Samples/Imported/makeitdrum/<kit>/` (chemin natif ou chemin Wine, configurable), écrit aussi le `.adg` dans `…/User Library/Presets/Instruments/Drum Rack/`, puis envoie un message au Remote Script (UDP local, protocole minuscule).
- Remote Script `MakeItDrum` (Python, à partir du squelette acidgrid) : à la réception, soit (**voie A, fiable**) parcourt `browser.user_library` jusqu'au `.adg` fraîchement écrit et fait `browser.load_item(item)` sur la piste sélectionnée ; soit (**voie B, « Simpler »**) crée un clip audio à partir du WAV concaténé, puis `create_midi_track_with_simpler` → `insert_slice` × 20 → `sliced_simpler_to_drum_rack`. La voie A répond au besoin avec moins d'inconnues ; la voie B donne littéralement « le kit dans le Simpler ».
- Dans la page : `src/bridge/client.js` (fetch vers `/health` au chargement ; si présent, le bouton « ▶ Envoyer dans Live » apparaît). Sans compagnon, rien ne change.

**Pourquoi pas AbletonOSC ?** Il ne couvre ni le navigateur ni le chargement d'échantillons ; notre Remote Script de 150 lignes fait le travail. On pourra cependant **cohabiter** avec AbletonOSC pour piloter le transport.

**Risques.** API Live non documentée pour la voie B (noms de fonctions relevés sur un retour d'expérience Live 12 — à confirmer dans la doc LOM 12.3 avant de coder) ; Python embarqué de Live (3.x depuis Live 11) ; chemins Wine ; Live rafraîchit la User Library avec un délai (prévoir un `rescan`/attente) ; installation manuelle du Remote Script (documenter, réutiliser `install.sh`).

### Phase 4 — Plugin VST3 / CLAP

#### 4a. « Kit player » natif (10–15 jours) — recommandé

- **Stack** : Rust, **nih-plug** (ISC ; VST3 + CLAP par macro ; testé Linux et Windows), UI **egui** via `nih_plug_egui` en reprenant les widgets de drum-vst3 (`knob`, `step_button`, `transport`, `fader`). Dépôt `makeitdrum-plugin`, CI fmt/clippy/tests/golden audio (copiés de drum-vst3), release avec binaires Linux `.vst3`/`.clap`, **Windows** (pour Live-dans-Wine) et macOS si un runner est disponible.
- **Fonctions** : ouvrir un `.kit.zip` (ou un dossier de WAV) ; 20 voix one-shot, vélocité, mapping GM 36–55 (le même `drummap` que le web, recopié dans un module Rust testé contre les mêmes vecteurs) ; **selectbox de kits** (scan d'un dossier `~/Documents/makeitdrum/kits/`) ; changement de kit à la volée sans clic ; état persistant (chemin du kit, kit embarqué dans le preset VST3 pour que le projet se rouvre sans le fichier) ; 1 sortie stéréo (sorties multiples : plus tard).
- **Ce que ça donne** : les pads sonnent **exactement** comme sur la page (ce sont les mêmes fichiers). Le « make it drum » reste sur le web, le plugin est l'instrument. Pour l'usage de Seb (Live sous Wine), c'est la seule voie sans WebView.
- **Réutilisation drum-vst3** : `core_dsp/sample` (hound), `voice`, `state.rs` (persistance), `midi.rs`, CI/release, tests golden audio. Ne pas reprendre le crate `vst3` 0.3 brut : nih-plug enlève tout l'unsafe.

#### 4b. « UI web + moteur Web Audio embarqué » (20–35 jours) — ensuite, si le besoin existe

- La page `dist/index.html` est servie **dans une WebView du plugin** (nih-plug-webview ou, en C++, JUCE 8 `WebBrowserComponent` / extension CLAP `webview` + `webview-gui`). Le rendu se fait dans la WebView (`OfflineAudioContext` de WebKit ou WebView2), les 20 buffers partent vers le natif par message (JSON + Float32 en base64, ~3 Mo par kit : acceptable), le lecteur natif de 4a les joue. Zéro réécriture DSP, **une seule base de code UI**.
- **Risques réels** : nih-plug-webview est explicitement « work in progress, not production-ready » (macOS surtout, Windows à vérifier, Linux absent) ; JUCE 8 impose GPLv3 ou licence commerciale ; **WebView2 dans Wine** est un point bloquant probable pour le Live de Seb ; le son diffère légèrement entre WebKit et Chromium (voir B.3) ; comportement de l'hôte (la touche Échap dans Live fait planter nih-plug-webview sur macOS, d'après son README).
- À déclencher quand : des utilisateurs veulent *générer* des kits sans quitter le DAW, ou quand les WebViews de plugins seront stabilisées (extension CLAP `webview` sortie du statut draft, par exemple).

#### 4c. Réécriture DSP native (30–60 jours) — non recommandée aujourd'hui

- `web-audio-api-rs` rend le port **mécanique** (chaque `ctx.createX()` a son équivalent, `OfflineAudioContext` existe), ce qui limite le coût à ~1 semaine de port + le reste en validation et en égalisation perceptive (compresseur, oversampling, convolution). Mais la valeur ajoutée (régénérer des variations en temps réel dans le plugin, moduler les recettes au potentiomètre) n'est aujourd'hui demandée par personne, et 4b l'obtient sans port. **YAGNI**.
- Si un jour on y va : garder `flavors.js` comme **source unique** (les recettes sont des données ; les fonctions `(a) => Hz` deviennent des expressions sérialisables ou sont évaluées côté Rust via un petit interpréteur), et exposer les kits générés dans le même `kit.json`.

### C.2 Récapitulatif des nouvelles interfaces (côté web)

| Module | Rôle | Type |
|---|---|---|
| `core/prng.js` | `mulberry32`, `deriveSeed`, `randomSeed` | pur |
| `core/kit.js` | `serializeKit`, `parseKit`, `validateKit`, nommage des fichiers | pur |
| `core/zip.js` | + `readZip(bytes)` (mode store) | pur |
| `core/midi/drummap.js` | GM 36–55 ↔ pads, courbes de vélocité | pur |
| `core/sequencer.js` | motif, swing, `stepsBetween` | pur |
| `core/adg.js`, `core/sfz.js`, `core/dspreset.js` | sérialiseurs d'export | pur |
| `audio/polyPlayer.js`, `audio/scheduler.js` | voix multiples, ordonnanceur à anticipation | Web Audio |
| `midi/access.js`, `midi/in.js`, `midi/out.js` | Web MIDI (port du patron WebGlitch) | navigateur |
| `storage/kits.js` | IndexedDB derrière `{ list, get, put, remove }` | navigateur |
| `bridge/client.js` | détection du compagnon, `POST /kit` | navigateur |
| `ui/kitSelect.js`, `ui/stepGrid.js`, `ui/midiMenu.js`, `ui/transport.js` | DOM | navigateur |
| `library.js` | + `trigger`, `saveKit`, `loadKit`, `exportKit/Ableton/Sfz`, `importKitFiles`, `sendToLive` | orchestration |

Chaque module est injecté dans `createLibrary` ; `app.js` reste le seul endroit qui connaît le DOM, Web MIDI, IndexedDB et `fetch`.

---

## D. Recommandation et questions ouvertes

### D.1 Ordre de réalisation recommandé

1. **Phase 0 + 1** (graine, kits, selectbox) — c'est le souhait n° 4, le moins cher, et le format `kit.json` est le socle de tout le reste (plugin compris). Une version 1.2.0.
2. **Phase 2a + 2b** (MIDI in + lecteur polyphonique) — en quelques jours la page devient jouable depuis un clavier/pad ou depuis Live ; souhait n° 2, première moitié. Version 1.3.0.
3. **Phase 3a** (exports `.adg`, `.sfz`, import de kits) — souhait n° 3 sans rien installer. Version 1.4.0.
4. **Phase 2c + 2d** (séquenceur, MIDI out, horloge) — la « BAR » complète, pilote le LXR-02. Version 1.5.0.
5. **Phase 3b** (compagnon + Remote Script) — le vrai bouton « Envoyer dans Live ». Dépôt annexe ou dossier `bridge/` du dépôt, mais jamais dans `dist/index.html`.
6. **Phase 4a** (plugin lecteur de kit, nih-plug, VST3 + CLAP) — souhait n° 1, dans un dépôt séparé, construit sur drum-vst3. C'est la réponse nette à la question « UI web + DSP natif *ou* réécriture » : **ni l'un ni l'autre tout de suite — un lecteur natif de kits pré-rendus**, puis **UI web + lecteur natif (4b)** si la génération dans le DAW devient un besoin ; la réécriture (4c) est écartée.

### D.2 Questions que seul Seb peut trancher

1. **Plateformes cibles du plugin** : seulement Live 12 sous Wine (→ build Windows obligatoire, WebView exclue), ou aussi Linux natif (Bitwig, Reaper, Ardour via CLAP/VST3) et macOS (signature/notarisation = coût et compte développeur) ?
2. **Le plugin doit-il *générer* ou seulement *jouer* ?** Si « jouer » suffit, 4a répond à tout et 4b/4c disparaissent du plan.
3. **Suite ou Standard ?** Max for Live est-il disponible (il n'est pas nécessaire au plan proposé, mais ça ouvre une voie de secours) ? Quelle version exacte de Live (12.x) pour calibrer le `.adg` et vérifier les fonctions `create_midi_track_with_simpler` / `sliced_simpler_to_drum_rack` dans la doc LOM ?
4. **Mapping des 20 recettes sur les notes GM 36–55** : ordre actuel des pads (BOOM = 36, KICK = 37, …) ou tri « GM-logique » (kick 36, snare 38, hat fermé 42…) ? Cela touche aussi le nommage des fichiers exportés.
5. **Vérité d'un kit sauvegardé** : WAV rendus (lourds, fidèles, rejouables partout — proposé) ou graines seules (légers, mais dépendants du navigateur et de la présence du son source) ? Le document propose les deux ; faut-il garder le mode « graines seules » ?
6. **Sens de « charger d'autres BAR »** : importer des kits externes dans make it drum, exporter vers d'autres samplers (SFZ/Decent), ou piloter des BAR matérielles (MIDI out) ? Le plan couvre les trois ; lequel prime ?
7. **Golden master** : accepter de re-baser le golden sur v1.1.0 (puisque la phase 0 change l'ordre des tirages), ou figer la génération actuelle comme « moteur v1 » sélectionnable ? La première option est plus simple.
8. **Masao** : le concept est le sien ; la direction « instrument/plugin » et le nommage (`.kit.zip`, « make it drum.vst3 ») doivent-ils lui être soumis avant la 1.2.0 ?
9. **Licence et distribution du plugin** : MIT comme le web ? Binaires attachés aux releases GitHub (comme drum-vst3) ? CLAP *et* VST3, ou VST3 seul ?
10. **Le compagnon** : acceptable d'installer un petit outil Node + un Remote Script pour « Envoyer dans Live », ou faut-il s'en tenir à l'export `.adg` glissé à la main ?

---

## Sources

**Web MIDI**
- MDN, Web MIDI API (compatibilité, contexte sécurisé, permission) : https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API
- Chrome Developers, « Web MIDI permission prompt » (Chrome 124 ; support Chrome 43 / Edge 79 / Firefox 108 / Safari non) : https://developer.chrome.com/blog/web-midi-permission-prompt
- Mozilla Bugzilla 1795025, site permission add-on pour Web MIDI : https://bugzilla.mozilla.org/show_bug.cgi?id=1795025
- Discussions W3C sur l'horodatage de `send()` et l'ordonnancement à anticipation : https://lists.w3.org/Archives/Public/public-audio/2012OctDec/0692.html
- WebGlitch, adaptateur Web MIDI de référence : `/home/seb/Dev/WebGlitch/src/ui/midi.ts`

**Plugins**
- nih-plug (Rust, ISC, VST3 + CLAP) : https://github.com/robbert-vdh/nih-plug
- nih-plug-webview (expérimental) : https://github.com/httnn/nih-plug-webview
- CLAP et extension `webview` (draft) : https://github.com/free-audio/clap — https://github.com/free-audio/clap/blob/main/include/clap/ext/draft/webview.h
- webview-gui (Signalsmith, CHOC) : https://github.com/geraintluff/webview-gui
- JUCE 8, `WebBrowserComponent` : https://docs.juce.com/master/juce__WebBrowserComponent_8h.html — annonce JUCE 8 : https://www.kvraudio.com/news/juce-8-now-available-61009
- Steinberg, VST 3.8 sous licence MIT (oct. 2025) : https://github.com/steinbergmedia/vst3sdk
- iPlug2 : https://iplug2.github.io — Elementary Audio : https://www.elementary.audio/docs — Cmajor : https://cmajor.dev/
- drum-vst3 (plomberie VST3, voix, séquenceur, CI) : `/home/seb/Dev/drum-vst3`

**Reproduction des nœuds Web Audio**
- web-audio-api-rs (Rust, MIT, nœuds Biquad/WaveShaper/Convolver/DynamicsCompressor/Delay/IIR, `OfflineAudioContext`) : https://github.com/orottier/web-audio-api-rs — liste des nœuds : https://docs.rs/web-audio-api/latest/web_audio_api/node/index.html
- node-web-audio-api (bindings Node, binaires prébuilts, suite WPT) : https://github.com/ircam-ismm/node-web-audio-api
- Chromium, `DynamicsCompressorNode.cpp` (le noyau n'est pas spécifié par le W3C) : https://chromium.googlesource.com/chromium/blink/+/HEAD/Source/modules/webaudio/DynamicsCompressorNode.cpp — WebKit bug 78937 : https://bugs.webkit.org/show_bug.cgi?id=78937

**Ableton**
- Retour d'expérience « Writing an Ableton Drum Rack from Node for Max, because the Live API can't » (limites de `Browser.load_item`, route `create_midi_track_with_simpler` → `insert_slice` → `sliced_simpler_to_drum_rack`, `.adg` gzip XML et ordre des éléments) : https://cycling74.com/forums/writing-an-ableton-drum-rack-from-node-for-max-because-the-live-api-cant
- adgmaker (génération de `.adg` Drum Rack depuis un dossier) : https://pypi.org/project/adgmaker/ — alsample (décodage `.adg/.adv`, `RelativePathType`) : https://forum.ableton.com/viewtopic.php?p=1550437
- AbletonOSC (LOM en OSC, ports 11000/11001, Live 11+) : https://github.com/ideoforms/AbletonOSC
- Live Object Model (Live 12.3) : https://docs.cycling74.com/apiref/lom/ — forum « load sample into drum rack from Max for Live » : https://cycling74.com/forums/load-sample-into-drum-rack-from-max-for-live-device
- Glisser-déposer depuis une WebView vers un DAW (`DownloadURL`, échecs rapportés) : https://forum.juce.com/t/webview-drag-and-drop-audio-files-out-of-plugin/64813
- Ableton Link pour Node (addon natif, beta) : https://www.npmjs.com/package/abletonlink
- acidgrid, Remote Script de référence : `/home/seb/Dev/acidgrid/ableton_remote_script/` — Abletonux (Live 12 sous Wine) : `/home/seb/Dev/Abletonux/README.md`

**Formats de kits**
- SFZ, introduction : https://sfzformat.com/tutorials/basics/
- Decent Sampler : https://www.decentsamples.com/ — comparatif SF2/SFZ et limite de 16 caractères : https://discourse.ardour.org/t/im-going-to-try-and-make-a-set-of-drum-samples/112530
- ConvertWithMoss (conversions WAV/SFZ/SF2/DecentSampler/MPC…) : https://www.kvraudio.com/forum/viewtopic.php?p=9036860
