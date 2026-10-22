// Textes de la barre d'état, copiés à l'identique de l'original.

export const MESSAGES = {
  decodeError: 'Impossible de lire ce fichier — essaie un .wav ou .mp3',
  readError: 'Erreur de lecture du fichier.',
  renderError: "Le traitement d'une percussion a échoué, réessaie.",
  generating: (i, n) => 'Génération de la bibliothèque… (' + i + '/' + n + ')',
  libraryReady: 'Bibliothèque prête — survole un pad pour l\'entendre, clique pour une variation',
  importFirst: 'Importe un son avant de générer les percussions.',
  variationInProgress: 'Variation en cours…',
  padReady: (idx) => 'Pad ' + (idx + 1) + ' — survole pour écouter, reclique pour une variation',
  waitForGeneration: 'Attends la fin de la génération avant de télécharger.',
  zipPreparing: 'Préparation du pack .zip…',
  zipDone: 'Pack téléchargé — 10 fichiers .wav dans un .zip.',
  zipError: 'Échec de la création du pack .zip, réessaie.',
};
