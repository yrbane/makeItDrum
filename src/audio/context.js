// AudioContext « live » créé paresseusement (au premier geste utilisateur)
// et relancé s'il a été suspendu par le navigateur.

export function createLiveContext(windowRef = globalThis) {
  let ctx = null;
  return {
    get() {
      if (!ctx) {
        const Ctor = windowRef.AudioContext || windowRef.webkitAudioContext;
        ctx = new Ctor();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    },
  };
}
