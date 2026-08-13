const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const SettingsService = require('./settings.service');

const AuthService = {
  async hashPassword(password) {
    return await bcrypt.hash(password, 10);
  },

  async verifyPassword(password, hash) {
    if (!hash || !password) return false;
    return await bcrypt.compare(password, hash);
  },

  async verifyRolePassword(role, password) {
    const hashKey = role === 'admin' ? 'admin_password_hash' : 'caretaker_password_hash';
    const hash = SettingsService.get(hashKey);
    return await this.verifyPassword(password, hash);
  },

  async setRolePassword(role, newPassword) {
    const hashKey = role === 'admin' ? 'admin_password_hash' : 'caretaker_password_hash';
    const hash = await this.hashPassword(newPassword);
    SettingsService.set(hashKey, hash);
  },

  async createPasswordResetToken(role) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour validity

    db.prepare(`
      INSERT INTO password_reset_tokens (target_role, token_hash, expires_at)
      VALUES (?, ?, ?)
    `).run(role, tokenHash, expiresAt);

    return rawToken;
  },

  async verifyAndConsumeResetToken(role, rawToken) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const row = db.prepare(`
      SELECT * FROM password_reset_tokens
      WHERE target_role = ? AND token_hash = ? AND is_used = 0 AND expires_at > CURRENT_TIMESTAMP
    `).get(role, tokenHash);

    if (!row) {
      return false;
    }

    db.prepare('UPDATE password_reset_tokens SET is_used = 1 WHERE id = ?').run(row.id);
    return true;
  },

  cleanExpiredTokens() {
    db.prepare(`
      DELETE FROM password_reset_tokens
      WHERE expires_at <= CURRENT_TIMESTAMP OR is_used = 1
    `).run();
  }
};

module.exports = AuthService;
