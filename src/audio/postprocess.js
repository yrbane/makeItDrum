// Post-traitement commun à toutes les percussions, EN PLACE sur le buffer
// rendu : bitcrush optionnel puis normalisation de crête.
import { bitcrushInPlace } from '../core/bitcrush.js';
import { normalizePeakInPlace } from '../core/normalize.js';

function channelsOf(buffer) {
  const out = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) out.push(buffer.getChannelData(ch));
  return out;
}

export function postprocess(buffer, { crush, crushBits, crushHold, peak }, rng) {
  const channels = channelsOf(buffer);
  // historique : la décision de crush fait un tirage supplémentaire (chance(1))
  if (crush && rng.chance(1)) {
    for (const d of channels) bitcrushInPlace(d, crushBits, crushHold);
  }
  normalizePeakInPlace(channels, peak);
  return buffer;
}
