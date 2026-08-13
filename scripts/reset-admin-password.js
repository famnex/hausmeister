/**
 * Recovery script to reset Administrator or Caretaker password directly via Linux CLI.
 * Usage: node scripts/reset-admin-password.js [admin|caretaker] <new_password>
 */

const path = require('path');
process.env.DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');

const db = require('../src/db');
const AuthService = require('../src/services/auth.service');
const SettingsService = require('../src/services/settings.service');

async function run() {
  const roleArg = process.argv[2] || 'admin';
  const newPassword = process.argv[3];

  if (!newPassword || newPassword.length < 6) {
    console.error('Verwendung: node scripts/reset-admin-password.js [admin|caretaker] <neues_passwort>');
    console.error('Fehler: Das Passwort muss mindestens 6 Zeichen lang sein.');
    process.exit(1);
  }

  const role = roleArg.toLowerCase() === 'caretaker' ? 'caretaker' : 'admin';
  const roleName = role === 'admin' ? 'Administrator' : 'Hausmeister';

  try {
    await AuthService.setRolePassword(role, newPassword);
    console.log(`[SUCCESS] Das ${roleName}-Passwort wurde erfolgreich zurückgesetzt!`);
  } catch (err) {
    console.error(`[ERROR] Fehler beim Zurücksetzen des Passworts:`, err.message);
    process.exit(1);
  }
}

run();
