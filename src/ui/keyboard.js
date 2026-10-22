// Clavier de l'ordinateur : deux rangées de dix touches → 20 pads, par
// `event.code` (indépendant de la disposition AZERTY/QWERTY).

const ROW1 = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'];
const ROW2 = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'];
const CODES = ROW1.concat(ROW2);
const EDITABLE = /^(INPUT|SELECT|TEXTAREA)$/;

export function padForKey(code) {
  const idx = CODES.indexOf(code);
  return idx >= 0 ? idx : null;
}

export function bindKeyboard(doc, onPad) {
  doc.addEventListener('keydown', function (e) {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target && EDITABLE.test(e.target.tagName || '')) return;
    const idx = padForKey(e.code);
    if (idx === null) return;
    e.preventDefault();
    onPad(idx);
  });
}
