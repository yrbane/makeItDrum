// Les textes affichés sont copiés à l'identique de l'original (y compris
// « 10 fichiers », qui est faux mais fait partie du résultat livré).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES } from '../../src/ui/messages.js';

test('les messages de statut sont ceux de l\'original', () => {
  assert.equal(MESSAGES.decodeError, 'Impossible de lire ce fichier — essaie un .wav ou .mp3');
  assert.equal(MESSAGES.readError, 'Erreur de lecture du fichier.');
  assert.equal(MESSAGES.renderError, "Le traitement d'une percussion a échoué, réessaie.");
  assert.equal(MESSAGES.generating(3, 20), 'Génération de la bibliothèque… (3/20)');
  assert.equal(MESSAGES.libraryReady, 'Bibliothèque prête — survole un pad pour l\'entendre, clique pour une variation');
  assert.equal(MESSAGES.importFirst, 'Importe un son avant de générer les percussions.');
  assert.equal(MESSAGES.variationInProgress, 'Variation en cours…');
  assert.equal(MESSAGES.padReady(4), 'Pad 5 — survole pour écouter, reclique pour une variation');
  assert.equal(MESSAGES.waitForGeneration, 'Attends la fin de la génération avant de télécharger.');
  assert.equal(MESSAGES.zipPreparing, 'Préparation du pack .zip…');
  assert.equal(MESSAGES.zipDone, 'Pack téléchargé — 10 fichiers .wav dans un .zip.');
  assert.equal(MESSAGES.zipError, 'Échec de la création du pack .zip, réessaie.');
});
