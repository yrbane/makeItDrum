import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStepGrid } from '../../src/ui/stepgrid.js';
import { createPattern, toggleStep } from '../../src/core/sequencer.js';

function fakeDoc() {
  function el(tag) {
    const classes = new Set();
    const node = {
      tag, children: [], attrs: {}, textContent: '', handlers: {}, dataset: {},
      classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) },
      appendChild: (c) => { node.children.push(c); return c; },
      setAttribute: (k, v) => { node.attrs[k] = v; },
      addEventListener: (t, fn) => { node.handlers[t] = fn; },
      set className(v) { classes.clear(); v.split(' ').filter(Boolean).forEach((c) => classes.add(c)); },
      get className() { return Array.from(classes).join(' '); },
    };
    return node;
  }
  return { createElement: el };
}

test('createStepGrid : 20 lignes × 16 pas, étiquettes, clic → onToggle', () => {
  const doc = fakeDoc();
  const container = doc.createElement('div');
  const toggles = [];
  const grid = createStepGrid(container, doc, { tracks: 20, steps: 16, labels: Array.from({ length: 20 }, (_, i) => 'P' + i), onToggle: (t, s) => toggles.push([t, s]) });
  assert.equal(container.children.length, 20);
  const row = container.children[3];
  assert.equal(row.children[0].textContent, 'P3');
  assert.equal(row.children.length, 17);
  row.children[1 + 5].handlers.click();
  assert.deepEqual(toggles, [[3, 5]]);
  assert.equal(row.children[1].classList.contains('beat'), true, 'le pas 1 est marqué');
  assert.equal(row.children[2].classList.contains('beat'), false);
  assert.equal(row.children[5].classList.contains('beat'), true);
  grid.render(toggleStep(toggleStep(createPattern(), 3, 5), 3, 5));
  const cell = row.children[6];
  assert.equal(cell.classList.contains('on'), true);
  assert.equal(cell.classList.contains('v127'), true);
  grid.render(createPattern());
  assert.equal(cell.classList.contains('on'), false);
  grid.setPlayhead(5);
  assert.equal(cell.classList.contains('now'), true);
  grid.setPlayhead(-1);
  assert.equal(cell.classList.contains('now'), false);
});
