import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindKeyboard, padForKey } from '../../src/ui/keyboard.js';

test('padForKey : Q…P → 0–9, A…L et Semicolon → 10–19, sinon null', () => {
  assert.equal(padForKey('KeyQ'), 0);
  assert.equal(padForKey('KeyP'), 9);
  assert.equal(padForKey('KeyA'), 10);
  assert.equal(padForKey('Semicolon'), 19);
  assert.equal(padForKey('KeyZ'), null);
});

test('bindKeyboard déclenche le pad à l\'appui, pas en répétition ni dans un champ', () => {
  const handlers = {};
  const doc = { addEventListener: (type, fn) => { handlers[type] = fn; } };
  const hits = [];
  bindKeyboard(doc, (idx) => hits.push(idx));
  handlers.keydown({ code: 'KeyW', repeat: false, target: { tagName: 'BODY' }, altKey: false, ctrlKey: false, metaKey: false, preventDefault: () => {} });
  handlers.keydown({ code: 'KeyW', repeat: true, target: { tagName: 'BODY' }, preventDefault: () => {} });
  handlers.keydown({ code: 'KeyE', repeat: false, target: { tagName: 'INPUT' }, preventDefault: () => {} });
  handlers.keydown({ code: 'KeyE', repeat: false, target: { tagName: 'BODY' }, ctrlKey: true, preventDefault: () => {} });
  handlers.keydown({ code: 'KeyZ', repeat: false, target: { tagName: 'BODY' }, preventDefault: () => {} });
  assert.deepEqual(hits, [1]);
});
