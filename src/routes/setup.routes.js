const express = require('express');
const router = express.Router();
const SettingsService = require('../services/settings.service');
const AuthService = require('../services/auth.service');
const TicketService = require('../services/ticket.service');
const MailService = require('../services/mail.service');

router.get('/', (req, res) => {
  const schoolName = SettingsService.get('school_name', 'Schule');
  const schoolLogo = SettingsService.get('school_logo', null);
  const categories = TicketService.getAllCategories();

  res.render('setup/index', {
    schoolName,
    schoolLogo,
    categories,
    error: null,
    formData: {}
  });
});

router.post('/', async (req, res) => {
  if (SettingsService.isSetupComplete()) {
    return res.redirect('/');
  }

  const { school_name, admin_email, caretaker_email, admin_password, admin_password_confirm, caretaker_password, caretaker_password_confirm, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, smtp_from_email, smtp_from_name } = req.body;

  const formData = { school_name, admin_email, caretaker_email, smtp_host, smtp_port, smtp_user, smtp_secure, smtp_from_email, smtp_from_name };

  if (!school_name || !admin_email || !caretaker_email || !admin_password || !caretaker_password) {
    return res.render('setup/index', {
      error: 'Bitte fülle alle Pflichtfelder aus.',
      formData
    });
  }

  if (admin_password !== admin_password_confirm) {
    return res.render('setup/index', {
      error: 'Die Administrator-Passwörter stimmen nicht überein.',
      formData
    });
  }

  if (caretaker_password !== caretaker_password_confirm) {
    return res.render('setup/index', {
      error: 'Die Hausmeister-Passwörter stimmen nicht überein.',
      formData
    });
  }

  if (admin_password.length < 6 || caretaker_password.length < 6) {
    return res.render('setup/index', {
      error: 'Die Passwörter müssen mindestens 6 Zeichen lang sein.',
      formData
    });
  }

  try {
    const adminHash = await AuthService.hashPassword(admin_password);
    const caretakerHash = await AuthService.hashPassword(caretaker_password);

    SettingsService.set('school_name', school_name.trim());
    SettingsService.set('admin_email', admin_email.trim().toLowerCase());
    SettingsService.set('caretaker_email', caretaker_email.trim().toLowerCase());
    SettingsService.set('admin_password_hash', adminHash);
    SettingsService.set('caretaker_password_hash', caretakerHash);

    const smtpConfig = {
      host: smtp_host ? smtp_host.trim() : '',
      port: smtp_port ? parseInt(smtp_port, 10) : 587,
      user: smtp_user ? smtp_user.trim() : '',
      pass: smtp_pass ? smtp_pass.trim() : '',
      secure: smtp_secure === 'on' || smtp_secure === 'true',
      from_email: smtp_from_email ? smtp_from_email.trim() : admin_email.trim(),
      from_name: smtp_from_name ? smtp_from_name.trim() : `Hausmeister-System (${school_name})`
    };

    SettingsService.set('smtp_config', smtpConfig);

    // Initialize default categories
    TicketService.seedInitialCategories();

    // Mark setup as complete
    SettingsService.set('is_setup_complete', true);

    res.redirect('/?setup_success=1');
  } catch (err) {
    console.error('Setup error:', err);
    res.render('setup/index', {
      error: 'Bei der Initialisierung ist ein Fehler aufgetreten: ' + err.message,
      formData
    });
  }
});

module.exports = router;
