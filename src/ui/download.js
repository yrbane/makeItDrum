// Déclenche le téléchargement d'un Blob via un lien temporaire.

export function downloadBlob(doc, blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = filename;
  doc.body.appendChild(a);
  a.click();
  doc.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}
