// Textes de la barre d'état (ceux d'origine conservés à l'identique, plus les kits).

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
  zipPreparing: 'Préparation du kit (.kit.zip)…',
  zipError: 'Échec de la création du kit, réessaie.',
  // kits
  kitExported: (name) => 'Kit exporté — 20 .wav + kit.json dans « ' + name + '.kit.zip ».',
  kitNamePrompt: 'Nom du kit :',
  kitSaved: (name) => 'Kit « ' + name + ' » sauvegardé dans ce navigateur.',
  kitLoaded: (name) => 'Kit « ' + name + ' » chargé — survole un pad pour l\'entendre.',
  kitDeleted: (name) => 'Kit « ' + name + ' » supprimé.',
  kitImported: (name) => 'Kit « ' + name + ' » importé et sauvegardé.',
  kitImportError: (detail) => 'Import impossible : ' + detail,
  kitMissing: 'Ce kit n\'existe plus.',
  noKitSelected: 'Choisis un kit sauvegardé à supprimer.',
  storageUnavailable: 'Sauvegarde indisponible dans ce navigateur — l\'export .kit.zip reste possible.',
};
