// Accès centralisé aux éléments de la page.

export function queryElements(doc) {
  return {
    win: doc.querySelector('.win'),
    dropzone: doc.getElementById('dropzone'),
    fileInput: doc.getElementById('fileInput'),
    dzFile: doc.getElementById('dzFile'),
    statusText: doc.getElementById('statusText'),
    btnExportAll: doc.getElementById('btnExportAll'),
    padGrid: doc.getElementById('padGrid'),
    kitSelect: doc.getElementById('kitSelect'),
    btnSaveKit: doc.getElementById('btnSaveKit'),
    btnDeleteKit: doc.getElementById('btnDeleteKit'),
    btnImportKit: doc.getElementById('btnImportKit'),
    kitInput: doc.getElementById('kitInput'),
    btnMidi: doc.getElementById('btnMidi'),
    btnExportDaw: doc.getElementById('btnExportDaw'),
    btnPlay: doc.getElementById('btnPlay'),
    bpmInput: doc.getElementById('bpmInput'),
    swingInput: doc.getElementById('swingInput'),
    swingValue: doc.getElementById('swingValue'),
    midiOutSelect: doc.getElementById('midiOutSelect'),
    chkClock: doc.getElementById('chkClock'),
    btnClear: doc.getElementById('btnClear'),
    stepGrid: doc.getElementById('stepGrid'),
    midiSelect: doc.getElementById('midiSelect'),
  };
}
