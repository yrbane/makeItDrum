// Lecture : une seule percussion à la fois, coupée net dès qu'une autre démarre.
// `listener = { onStart(), onStop() }` permet à l'UI de suivre l'état sans
// que ce module connaisse le DOM.

export function createPlayer(getContext) {
  let current = null; // { src, listener }

  function stop() {
    if (!current) return;
    const { src, listener } = current;
    current = null;
    try { src.onended = null; src.stop(0); } catch (e) { /* source déjà terminée */ }
    listener.onStop();
  }

  function play(buffer, listener) {
    stop();
    const ctx = getContext();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    current = { src, listener };
    listener.onStart();
    src.onended = function () {
      if (current && current.src === src) current = null;
      listener.onStop();
    };
    src.start(0);
  }

  return { play, stop };
}
