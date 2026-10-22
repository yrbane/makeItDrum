// Seul module qui touche l'API Web MIDI (patron repris de WebGlitch) :
// init paresseuse sur geste utilisateur, branchement à chaud des ports,
// filtrage par entrée, dégradation propre si l'API est absente ou refusée.
import { parseMidiMessage } from '../core/midi/drummap.js';

export function createMidiAccess(navigatorRef) {
  let access = null;
  let wanted = 'all';
  let wantedOutput = '';
  let noteHandler = null;
  let portsHandler = null;

  function handleMessage(inputId, event) {
    if (wanted !== 'all' && inputId !== wanted) return;
    const msg = parseMidiMessage(event.data);
    if (msg && msg.type === 'noteon' && noteHandler) noteHandler(msg.note, msg.velocity);
  }

  function wireInputs() {
    if (!access) return;
    access.inputs.forEach(function (input, id) {
      input.onmidimessage = function (event) { handleMessage(input.id || id, event); };
    });
  }

  return {
    isSupported: function () {
      return !!navigatorRef && typeof navigatorRef.requestMIDIAccess === 'function';
    },
    init: async function () {
      if (!this.isSupported()) return false;
      try {
        access = await navigatorRef.requestMIDIAccess();
      } catch (e) {
        return false;
      }
      wireInputs();
      access.onstatechange = function () {
        wireInputs();
        if (portsHandler) portsHandler();
      };
      return true;
    },
    inputs: function () {
      if (!access) return [];
      return Array.from(access.inputs.values()).map(function (i) { return { id: i.id, name: i.name || i.id }; });
    },
    setInput: function (id) { wanted = id || 'all'; },
    outputs: function () {
      if (!access || !access.outputs) return [];
      return Array.from(access.outputs.values()).map(function (o) { return { id: o.id, name: o.name || o.id }; });
    },
    setOutput: function (id) { wantedOutput = id || ''; },
    output: function () {
      if (!access || !access.outputs || !wantedOutput) return null;
      return access.outputs.get(wantedOutput) || null;
    },
    onNote: function (handler) { noteHandler = handler; },
    onPortsChanged: function (handler) { portsHandler = handler; },
  };
}
