// Grille du séquenceur : une ligne par pad (étiquette + 16 pas cliquables).

export function createStepGrid(container, doc, { tracks, steps, labels, onToggle }) {
  const cells = [];
  for (let t = 0; t < tracks; t++) {
    const row = doc.createElement('div');
    row.className = 'seqrow';
    const label = doc.createElement('span');
    label.className = 'seqlabel';
    label.textContent = labels[t];
    row.appendChild(label);
    const rowCells = [];
    for (let s = 0; s < steps; s++) {
      const cell = doc.createElement('button');
      cell.type = 'button';
      cell.className = 'step' + (s % 4 === 0 ? ' beat' : '');
      cell.setAttribute('aria-label', labels[t] + ' pas ' + (s + 1));
      cell.addEventListener('click', function () { onToggle(t, s); });
      row.appendChild(cell);
      rowCells.push(cell);
    }
    cells.push(rowCells);
    container.appendChild(row);
  }

  return {
    render(pattern) {
      for (let t = 0; t < tracks; t++) {
        for (let s = 0; s < steps; s++) {
          const v = pattern.tracks[t] ? pattern.tracks[t][s] : 0;
          const cell = cells[t][s];
          cell.classList.toggle('on', v > 0);
          cell.classList.toggle('v127', v >= 127);
          cell.classList.toggle('v60', v > 0 && v < 100);
        }
      }
    },
    setPlayhead(step) {
      for (let t = 0; t < tracks; t++) {
        for (let s = 0; s < steps; s++) cells[t][s].classList.toggle('now', s === step);
      }
    },
  };
}
