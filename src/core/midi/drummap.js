// Mapping notes MIDI ↔ pads et décodage des messages de notes (pur).

export const BASE_NOTE = 36;

export function defaultNotes(count) {
  return Array.from({ length: count }, (_, i) => BASE_NOTE + i);
}

// premier pad qui porte la note, sinon null
export function padForNote(notes, note) {
  const idx = notes.indexOf(note);
  return idx >= 0 ? idx : null;
}

// data : Uint8Array d'un message MIDI → { type, channel, note, velocity } ou null
export function parseMidiMessage(data) {
  if (!data || data.length < 3) return null;
  const status = data[0] & 0xf0;
  const channel = data[0] & 0x0f;
  const note = data[1] & 0x7f;
  const velocity = (data[2] & 0x7f) / 127;
  if (status === 0x90 && velocity > 0) return { type: 'noteon', channel, note, velocity };
  if (status === 0x90 || status === 0x80) return { type: 'noteoff', channel, note, velocity };
  return null;
}
