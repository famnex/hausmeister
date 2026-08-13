/**
 * CLI script to reset application initialization state for re-running setup wizard.
 * Usage: node scripts/reinitialize-app.js
 */

const path = require('path');
process.env.DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');

const db = require('../src/db');
const SettingsService = require('../src/services/settings.service');

function run() {
  try {
    SettingsService.set('is_setup_complete', false);
    console.log('[SUCCESS] Das System wurde in den Setup-Modus zurückgesetzt.');
    console.log('Beim nächsten Aufruf im Browser öffnet sich automatisch der Installation-Wizard (/setup).');
  } catch (err) {
    console.error('[ERROR] Fehler beim Zurücksetzen:', err.message);
    process.exit(1);
  }
}

run();
