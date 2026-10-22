// Barre des kits : select des kits sauvegardés + boutons.

export function createKitBar({ kitSelect, btnSaveKit, btnDeleteKit }, doc) {
  const PLACEHOLDER = '— kit courant (non sauvegardé) —';
  let enabled = { save: true, delete: true };
  let hasCurrent = false;

  function applyButtons() {
    btnSaveKit.disabled = !enabled.save;
    btnDeleteKit.disabled = !enabled.delete || !hasCurrent;
  }

  return {
    setKits: function (list, currentId) {
      kitSelect.textContent = '';
      const first = doc.createElement('option');
      first.value = '';
      first.textContent = PLACEHOLDER;
      kitSelect.appendChild(first);
      list.forEach(function (k) {
        const opt = doc.createElement('option');
        opt.value = k.id;
        opt.textContent = k.name;
        kitSelect.appendChild(opt);
      });
      kitSelect.value = currentId || '';
      kitSelect.disabled = list.length === 0;
      hasCurrent = !!currentId;
      applyButtons();
    },
    setEnabled: function (flags) {
      enabled = Object.assign({}, enabled, flags);
      applyButtons();
    },
  };
}
