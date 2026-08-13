const nodemailer = require('nodemailer');
const SettingsService = require('./settings.service');

const MailService = {
  createTransporter() {
    const smtpConfig = SettingsService.get('smtp_config', {});
    if (!smtpConfig || !smtpConfig.host) {
      return null;
    }

    return nodemailer.createTransport({
      host: smtpConfig.host,
      port: parseInt(smtpConfig.port, 10) || 587,
      secure: smtpConfig.secure === true || smtpConfig.secure === 'true',
      auth: (smtpConfig.user && smtpConfig.pass) ? {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      } : undefined,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000
    });
  },

  async sendMail({ to, subject, html, text }) {
    try {
      const transporter = this.createTransporter();
      if (!transporter) {
        console.warn(`[MailService] SMTP nicht konfiguriert. E-Mail an ${to} konnte nicht gesendet werden.`);
        return { success: false, reason: 'SMTP nicht konfiguriert' };
      }

      const smtpConfig = SettingsService.get('smtp_config', {});
      const schoolName = SettingsService.get('school_name', 'Schule');

      // Configurable sender name
      const senderName = (smtpConfig.from_name && smtpConfig.from_name.trim()) || `Hausmeister-System (${schoolName})`;

      // Always send from the authenticated SMTP username to avoid SendAsDenied errors
      const senderMail = smtpConfig.user || 'noreply@schule.de';

      const info = await transporter.sendMail({
        from: `"${senderName}" <${senderMail}>`,
        to,
        subject,
        text,
        html
      });

      console.log(`[MailService] E-Mail erfolgreich gesendet von <${senderMail}> an ${to}. MessageID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[MailService] Fehler beim Senden an ${to}:`, err.message);
      return { success: false, reason: err.message };
    }
  },

  async sendTicketCreatedSubmitterConfirmation(ticket) {
    const schoolName = SettingsService.get('school_name', 'Schule');
    const subject = `[${ticket.ticket_number}] Bestätigung deiner Schadensmeldung - ${schoolName}`;
    const text = `Hallo ${ticket.submitter_name},\n\nvielen Dank! Deine Schadensmeldung wurde erfolgreich im System erfasst.\n\nTicketnummer: ${ticket.ticket_number}\nKategorie: ${ticket.category_name_snapshot}\nOrt/Raum: ${ticket.location}\nDatum: ${ticket.created_at}\n\nBeschreibung:\n${ticket.description}\n\nDas Hausmeister-Team wird sich um dein Anliegen kümmern.\n\nMit freundlichen Grüßen,\nDein Hausmeister-Team (${schoolName})`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
        <h2 style="color: #1e3a8a;">Schadensmeldung erhalten</h2>
        <p>Hallo <strong>${escapeHtml(ticket.submitter_name)}</strong>,</p>
        <p>deine Schadensmeldung wurde erfolgreich registriert.</p>
        <table style="width: 100%; max-width: 600px; border-collapse: collapse; margin: 20px 0; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <tr><td style="padding: 8px; font-weight: bold;">Ticket-ID:</td><td style="padding: 8px;">${escapeHtml(ticket.ticket_number)}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Kategorie:</td><td style="padding: 8px;">${escapeHtml(ticket.category_name_snapshot)}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Ort:</td><td style="padding: 8px;">${escapeHtml(ticket.location)}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Beschreibung:</td><td style="padding: 8px;">${escapeHtml(ticket.description)}</td></tr>
        </table>
        <p>Das Hausmeister-Team ist informiert und bearbeitet die Anfrage so schnell wie möglich.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b;">${escapeHtml(schoolName)} - Automatische Systembenachrichtigung</p>
      </div>
    `;

    return await this.sendMail({ to: ticket.submitter_email, subject, text, html });
  },

  async sendTicketCreatedCaretakerNotification(ticket, baseUrl) {
    const caretakerEmail = SettingsService.get('caretaker_email');
    if (!caretakerEmail) return { success: false, reason: 'Keine Hausmeister-E-Mail konfiguriert' };

    const schoolName = SettingsService.get('school_name', 'Schule');
    const ticketUrl = `${baseUrl.replace(/\/$/, '')}/hausmeister/tickets/${ticket.id}`;
    const subject = `[Neues Ticket] ${ticket.ticket_number}: ${ticket.category_name_snapshot} in ${ticket.location}`;
    const text = `Neues Ticket erhalten!\n\nTicketnummer: ${ticket.ticket_number}\nMeldende(r): ${ticket.submitter_name} (${ticket.submitter_email})\nKategorie: ${ticket.category_name_snapshot}\nOrt/Raum: ${ticket.location}\n\nBeschreibung:\n${ticket.description}\n\nLink zum Ticket: ${ticketUrl}`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
        <h2 style="color: #1e3a8a;">Neues Hausmeister-Ticket eingegangen</h2>
        <p>Es wurde ein neues Ticket gemeldet:</p>
        <ul>
          <li><strong>Ticketnummer:</strong> ${escapeHtml(ticket.ticket_number)}</li>
          <li><strong>Meldende(r):</strong> ${escapeHtml(ticket.submitter_name)} (${escapeHtml(ticket.submitter_email)})</li>
          <li><strong>Kategorie:</strong> ${escapeHtml(ticket.category_name_snapshot)}</li>
          <li><strong>Ort:</strong> ${escapeHtml(ticket.location)}</li>
        </ul>
        <p><strong>Beschreibung:</strong></p>
        <blockquote style="background: #f1f5f9; padding: 10px; border-left: 4px solid #3b82f6; margin: 10px 0;">${escapeHtml(ticket.description)}</blockquote>
        <p><a href="${ticketUrl}" style="background-color: #2563eb; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">Zum Ticket im System</a></p>
      </div>
    `;

    return await this.sendMail({ to: caretakerEmail, subject, text, html });
  },

  async sendTicketClosedSubmitterNotification(ticket) {
    const schoolName = SettingsService.get('school_name', 'Schule');
    const subject = `[${ticket.ticket_number}] Schadensmeldung abgeschlossen - ${schoolName}`;
    const text = `Hallo ${ticket.submitter_name},\n\ndeine Schadensmeldung (${ticket.ticket_number} - ${ticket.location}) wurde vom Hausmeister-Team als abgeschlossen markiert.\n\nVielen Dank für deine Meldung!\n\nMit freundlichen Grüßen,\nDein Hausmeister-Team (${schoolName})`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
        <h2 style="color: #16a34a;">Ticket erledigt / abgeschlossen</h2>
        <p>Hallo <strong>${escapeHtml(ticket.submitter_name)}</strong>,</p>
        <p>deine Schadensmeldung <strong>${escapeHtml(ticket.ticket_number)}</strong> (Ort: <em>${escapeHtml(ticket.location)}</em>) wurde als <strong>abgeschlossen</strong> markiert.</p>
        <p>Vielen Dank für deinen Hinweis!</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b;">${escapeHtml(schoolName)} - Hausmeister-Service</p>
      </div>
    `;

    return await this.sendMail({ to: ticket.submitter_email, subject, text, html });
  },

  async sendPasswordResetMail(to, role, token, protocol, host, basePath = '') {
    const roleName = role === 'admin' ? 'Administrator' : 'Hausmeister';
    
    // Normalize basePath: avoid duplicated /hausmeister in URL
    let cleanBase = (basePath || '').replace(/\/$/, '');

    const resetPath = role === 'admin' ? '/admin/passwort-zuruecksetzen' : '/passwort-zuruecksetzen';
    
    // Construct single, clean URL without duplicate subpaths
    let fullPath = resetPath;
    if (cleanBase && !resetPath.startsWith(cleanBase)) {
      fullPath = cleanBase + resetPath;
    }

    const resetUrl = `${protocol}://${host}${fullPath}?token=${token}`;
    const schoolName = SettingsService.get('school_name', 'Schule');

    const subject = `Passwort zurücksetzen für ${roleName} - ${schoolName}`;
    const text = `Hallo,\n\nes wurde eine Anforderung zum Zurücksetzen des gemeinsamen ${roleName}-Passworts gestellt.\n\nBitte klicke auf folgenden Link, um ein neues Passwort zu vergeben (1 Stunde gültig):\n${resetUrl}\n\nFalls du diese Anforderung nicht ausgelöst hast, kannst du diese E-Mail ignorieren.`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
        <h2>Passwort zurücksetzen (${roleName})</h2>
        <p>Es wurde eine Anfrage zum Zurücksetzen des ${roleName}-Passworts gestellt.</p>
        <p><a href="${resetUrl}" style="background-color: #dc2626; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">Neues Passwort festlegen</a></p>
        <p style="font-size: 12px; color: #64748b;">Link: ${resetUrl}</p>
        <p style="font-size: 12px; color: #94a3b8;">Dieser Link ist 1 Stunde gültig.</p>
      </div>
    `;

    return await this.sendMail({ to, subject, text, html });
  },

  async sendTestMail(testRecipient) {
    const schoolName = SettingsService.get('school_name', 'Schule');
    const subject = `[Test E-Mail] E-Mail-Konfiguration Hausmeister-System - ${schoolName}`;
    const text = `Dies ist eine Test-E-Mail vom Hausmeister Ticket-System der ${schoolName}.\n\nDie SMTP-Konfiguration funktioniert einwandfrei!`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
        <h2 style="color: #2563eb;">Test E-Mail erfolgreich</h2>
        <p>Die SMTP-Verbindung zum Hausmeister Ticket-System der <strong>${escapeHtml(schoolName)}</strong> ist korrekt eingerichtet.</p>
      </div>
    `;

    return await this.sendMail({ to: testRecipient, subject, text, html });
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = MailService;
