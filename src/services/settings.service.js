const db = require('../db');

const SettingsService = {
  get(key, defaultValue = null) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  },

  set(key, value) {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run(key, stringValue);
  },

  getAll() {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const result = {};
    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }
    return result;
  },

  isSetupComplete() {
    return this.get('is_setup_complete', false) === true;
  }
};

module.exports = SettingsService;
