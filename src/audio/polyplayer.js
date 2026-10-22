// Lecture polyphonique : une source par déclenchement, gain = vélocité ;
// rejouer la même `voice` (pad) coupe sa lecture précédente, pas les autres.

export function createPolyPlayer(getContext) {
  const active = new Map(); // voice → { src, onStop }

  function stopVoice(voice) {
    const v = active.get(voice);
    if (!v) return;
    active.delete(voice);
    try { v.src.onended = null; v.src.stop(0); } catch (e) { /* déjà terminée */ }
    if (v.onStop) v.onStop();
  }

  function play(buffer, { voice = 0, gain = 1, when = 0, onStart, onStop } = {}) {
    stopVoice(voice);
    const ctx = getContext();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    src.connect(amp);
    amp.connect(ctx.destination);
    const entry = { src, onStop };
    active.set(voice, entry);
    if (onStart) onStart();
    src.onended = function () {
      if (active.get(voice) === entry) {
        active.delete(voice);
        if (onStop) onStop();
      }
    };
    src.start(when);
  }

  function stopAll() {
    Array.from(active.keys()).forEach(stopVoice);
  }

  return { play, stopAll };
}
