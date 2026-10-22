// Planificateur à anticipation : un timer court relit l'horloge audio et
// planifie les événements du motif dans la fenêtre [dernier instant, maintenant + lookahead).
import { eventsBetween, stepDuration } from '../core/sequencer.js';

export function createScheduler({
  getContext, getPattern, getSettings, onEvent, onStep, onWindow = null,
  setInterval: setTimer = globalThis.setInterval, clearInterval: clearTimer = globalThis.clearInterval,
  interval = 25, lookahead = 0.1, startDelay = 0.05,
}) {
  let timer = null;
  let origin = 0;
  let scheduledUntil = 0;
  let lastStep = -1;

  function tick() {
    const ctx = getContext();
    const now = ctx.currentTime;
    const settings = getSettings();
    const pattern = getPattern();
    const until = now + lookahead;
    if (until > scheduledUntil) {
      eventsBetween(pattern, { bpm: settings.bpm, swing: settings.swing, origin }, scheduledUntil, until).forEach(onEvent);
      if (onWindow) onWindow(scheduledUntil, until, origin);
      scheduledUntil = until;
    }
    const elapsed = now - origin;
    const step = elapsed < 0 ? 0 : Math.floor(elapsed / stepDuration(settings.bpm)) % pattern.steps;
    if (step !== lastStep) {
      lastStep = step;
      onStep(step);
    }
  }

  return {
    start() {
      if (timer !== null) return;
      origin = getContext().currentTime + startDelay;
      scheduledUntil = origin;
      lastStep = -1;
      timer = setTimer(tick, interval);
      tick();
    },
    stop() {
      if (timer === null) return;
      clearTimer(timer);
      timer = null;
      lastStep = -1;
      onStep(-1);
    },
    isRunning() { return timer !== null; },
    origin() { return origin; },
  };
}
