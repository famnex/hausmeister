const express = require('express');
const router = express.Router();
const SettingsService = require('../services/settings.service');
const AuthService = require('../services/auth.service');
const MailService = require('../services/mail.service');
const { requireAuth } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// Admin Login Page
router.get('/login', (req, res) => {
  if (req.session && req.session.authenticatedRole === 'admin') {
    return res.redirect('/admin/einstellungen');
  }
  const schoolName = SettingsService.get('school_name', 'Schule');
  res.render('admin/login', { schoolName, error: null, successMessage: req.query.msg || null });
});

router.post('/login', async (req, res) => {
  const { password } = req.body;
  const schoolName = SettingsService.get('school_name', 'Schule');

  if (!password) {
    return res.render('admin/login', { schoolName, error: 'Bitte gib das Passwort ein.', successMessage: null });
  }

  const isValid = await AuthService.verifyRolePassword('admin', password);

  if (isValid) {
    req.session.authenticatedRole = 'admin';
    return res.redirect('/admin/einstellungen');
  } else {
    return res.render('admin/login', { schoolName, error: 'Ungültiges Administrator-Passwort.', successMessage: null });
  }
});

// Admin Root / Settings
router.get(['/', '/einstellungen'], requireAuth('admin'), (req, res) => {
  const schoolName = SettingsService.get('school_name', 'Schule');
  const adminEmail = SettingsService.get('admin_email', '');
  const caretakerEmail = SettingsService.get('caretaker_email', '');
  const schoolLogo = SettingsService.get('school_logo', null);
  const smtpConfig = SettingsService.get('smtp_config', {});

  res.render('admin/settings', {
    schoolName,
    adminEmail,
    caretakerEmail,
    schoolLogo,
    smtpConfig,
    error: null,
    successMessage: req.query.msg || null,
    testResult: null
  });
});

router.post(['/', '/einstellungen'], requireAuth('admin'), upload.single('logo'), (req, res) => {
  const { school_name, admin_email, caretaker_email, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, smtp_from_email, smtp_from_name } = req.body;

  try {
    if (school_name) SettingsService.set('school_name', school_name.trim());
    if (admin_email) SettingsService.set('admin_email', admin_email.trim().toLowerCase());
    if (caretaker_email) SettingsService.set('caretaker_email', caretaker_email.trim().toLowerCase());

    const currentSmtp = SettingsService.get('smtp_config', {});
    const effectiveUser = smtp_user ? smtp_user.trim() : (currentSmtp.user || '');

    const newSmtp = {
      host: smtp_host ? smtp_host.trim() : '',
      port: smtp_port ? parseInt(smtp_port, 10) : 587,
      user: effectiveUser,
      pass: (smtp_pass && smtp_pass.trim().length > 0) ? smtp_pass.trim() : (currentSmtp.pass || ''),
      secure: smtp_secure === 'on' || smtp_secure === 'true',
      from_email: smtp_from_email ? smtp_from_email.trim() : effectiveUser,
      from_name: smtp_from_name ? smtp_from_name.trim() : `Hausmeister-System (${school_name})`
    };

    SettingsService.set('smtp_config', newSmtp);

    if (req.file) {
      const logoRelPath = '/uploads/' + req.file.filename;
      SettingsService.set('school_logo', logoRelPath);
    }

    res.redirect('/admin/einstellungen?msg=' + encodeURIComponent('Einstellungen erfolgreich gespeichert.'));
  } catch (err) {
    console.error('Error saving settings:', err);
    res.redirect('/admin/einstellungen?msg=' + encodeURIComponent('Fehler beim Speichern: ' + err.message));
  }
});

// Test Email Functionality
router.post('/test-email', requireAuth('admin'), async (req, res) => {
  const adminEmail = SettingsService.get('admin_email');
  if (!adminEmail) {
    return res.redirect('/admin/einstellungen?msg=' + encodeURIComponent('Keine Admin E-Mail-Adresse hinterlegt.'));
  }

  const result = await MailService.sendTestMail(adminEmail);

  if (result.success) {
    res.redirect('/admin/einstellungen?msg=' + encodeURIComponent('Test-E-Mail erfolgreich an ' + adminEmail + ' gesendet!'));
  } else {
    res.redirect('/admin/einstellungen?msg=' + encodeURIComponent('Fehler beim Senden der Test-E-Mail: ' + result.reason));
  }
});

// Change Admin Password
router.get('/passwort', requireAuth('admin'), (req, res) => {
  const schoolName = SettingsService.get('school_name', 'Schule');
  res.render('admin/password', { schoolName, error: null, successMessage: req.query.msg || null });
});

router.post('/passwort', requireAuth('admin'), async (req, res) => {
  const { current_password, new_password, new_password_confirm } = req.body;
  const schoolName = SettingsService.get('school_name', 'Schule');

  if (!current_password || !new_password || !new_password_confirm) {
    return res.render('admin/password', { schoolName, error: 'Bitte fülle alle Felder aus.', successMessage: null });
  }

  if (new_password !== new_password_confirm) {
    return res.render('admin/password', { schoolName, error: 'Die neuen Passwörter stimmen nicht überein.', successMessage: null });
  }

  if (new_password.length < 6) {
    return res.render('admin/password', { schoolName, error: 'Das neue Passwort muss mindestens 6 Zeichen lang sein.', successMessage: null });
  }

  const isCurrentValid = await AuthService.verifyRolePassword('admin', current_password);
  if (!isCurrentValid) {
    return res.render('admin/password', { schoolName, error: 'Das aktuelle Passwort ist nicht korrekt.', successMessage: null });
  }

  await AuthService.setRolePassword('admin', new_password);
  res.render('admin/password', { schoolName, error: null, successMessage: 'Administrator-Passwort erfolgreich geändert.' });
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

module.exports = router;
