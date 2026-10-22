// Fabrication d'AudioBuffers dérivés : copie inversée du sample, impulsion de reverb.
import { reverseInto } from '../core/samples.js';
import { fillImpulseInPlace } from '../core/impulse.js';

// inversion temporelle du sample, calculée une seule fois au chargement :
// permet un vrai layer « reverse » sans jamais synthétiser de nouveau son
export function makeReversedBuffer(buffer, AudioBufferCtor = globalThis.AudioBuffer) {
  const rev = new AudioBufferCtor({
    length: buffer.length,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    reverseInto(buffer.getChannelData(ch), rev.getChannelData(ch));
  }
  return rev;
}

export function makeImpulseBuffer(ctx, duration, decay, random) {
  const len = Math.max(1, Math.floor(duration * ctx.sampleRate));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  fillImpulseInPlace(buf.getChannelData(0), decay, random);
  return buf;
}
