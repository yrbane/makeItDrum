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
  };
}
