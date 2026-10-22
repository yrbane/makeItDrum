// Import de fichier : clic (sélecteur) et glisser-déposer.

export function bindDropzone({ dropzone, fileInput }, onFile) {
  dropzone.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) onFile(e.target.files[0]);
  });
  dropzone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', function () {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  });
}
