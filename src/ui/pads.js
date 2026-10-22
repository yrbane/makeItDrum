// Grille de pads : 20 boutons, chacun un vieil écran avec sa forme d'onde.

export function createPadGrid(padGrid, doc, count) {
  const els = [];
  const canvases = [];
  for (let i = 0; i < count; i++) {
    const btn = doc.createElement('button');
    btn.className = 'pad';
    btn.disabled = true;
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Percussion ' + (i + 1));
    const num = doc.createElement('span');
    num.className = 'pad-num';
    num.textContent = String(i + 1).padStart(2, '0');
    const cv = doc.createElement('canvas');
    cv.width = 140;
    cv.height = 56;
    btn.appendChild(cv);
    btn.appendChild(num);
    padGrid.appendChild(btn);
    els.push(btn);
    canvases.push(cv);
  }
  return { els, canvases };
}
