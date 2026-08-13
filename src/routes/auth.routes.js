const express = require('express');
const router = express.Router();
const SettingsService = require('../services/settings.service');
const AuthService = require('../services/auth.service');
const MailService = require('../services/mail.service');

// Request Reset Link Page (for Caretaker or Admin)
router.get('/:role/passwort-vergessen', (req, res) => {
  const role = req.params.role;
  if (!['hausmeister', 'admin'].includes(role)) {
    return res.redirect('/');
  }

  const roleName = role === 'admin' ? 'Administrator' : 'Hausmeister';
  const schoolName = SettingsService.get('school_name', 'Schule');

  res.render('auth/forgot-password', {
    schoolName,
    role,
    roleName,
    error: null,
    successMessage: null
  });
});

router.post('/:role/passwort-vergessen', async (req, res) => {
  const role = req.params.role;
  if (!['hausmeister', 'admin'].includes(role)) {
    return res.redirect('/');
  }

  const targetRole = role === 'admin' ? 'admin' : 'caretaker';
  const roleName = role === 'admin' ? 'Administrator' : 'Hausmeister';
  const schoolName = SettingsService.get('school_name', 'Schule');
  const recipientEmail = SettingsService.get(targetRole === 'admin' ? 'admin_email' : 'caretaker_email');

  if (!recipientEmail) {
    return res.render('auth/forgot-password', {
      schoolName,
      role,
      roleName,
      error: 'Im System ist keine E-Mail-Adresse für diese Rolle hinterlegt.',
      successMessage: null
    });
  }

  try {
    const rawToken = await AuthService.createPasswordResetToken(targetRole);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;

    const mailResult = await MailService.sendPasswordResetMail(recipientEmail, targetRole, rawToken, baseUrl);

    if (mailResult.success) {
      res.render('auth/forgot-password', {
        schoolName,
        role,
        roleName,
        error: null,
        successMessage: `Ein Link zum Zurücksetzen des Passworts wurde an ${recipientEmail} gesendet.`
      });
    } else {
      res.render('auth/forgot-password', {
        schoolName,
        role,
        roleName,
        error: `Der Link konnte nicht per E-Mail gesendet werden (${mailResult.reason}). Bitte kontaktiere den Server-Administrator.`,
        successMessage: null
      });
    }
  } catch (err) {
    console.error('Password reset request error:', err);
    res.render('auth/forgot-password', {
      schoolName,
      role,
      roleName,
      error: 'Fehler beim Verarbeiten der Anfrage: ' + err.message,
      successMessage: null
    });
  }
});

// Perform Password Reset Page
router.get('/:role/passwort-zuruecksetzen', (req, res) => {
  const role = req.params.role;
  const token = req.query.token;

  if (!['hausmeister', 'admin'].includes(role) || !token) {
    return res.redirect('/');
  }

  const roleName = role === 'admin' ? 'Administrator' : 'Hausmeister';
  const schoolName = SettingsService.get('school_name', 'Schule');

  res.render('auth/reset-password', {
    schoolName,
    role,
    roleName,
    token,
    error: null
  });
});

router.post('/:role/passwort-zuruecksetzen', async (req, res) => {
  const role = req.params.role;
  const { token, new_password, new_password_confirm } = req.body;

  if (!['hausmeister', 'admin'].includes(role) || !token) {
    return res.redirect('/');
  }

  const targetRole = role === 'admin' ? 'admin' : 'caretaker';
  const roleName = role === 'admin' ? 'Administrator' : 'Hausmeister';
  const schoolName = SettingsService.get('school_name', 'Schule');

  if (!new_password || !new_password_confirm) {
    return res.render('auth/reset-password', {
      schoolName,
      role,
      roleName,
      token,
      error: 'Bitte fülle alle Felder aus.'
    });
  }

  if (new_password !== new_password_confirm) {
    return res.render('auth/reset-password', {
      schoolName,
      role,
      roleName,
      token,
      error: 'Die Passwörter stimmen nicht überein.'
    });
  }

  if (new_password.length < 6) {
    return res.render('auth/reset-password', {
      schoolName,
      role,
      roleName,
      token,
      error: 'Das Passwort muss mindestens 6 Zeichen lang sein.'
    });
  }

  try {
    const isTokenValid = await AuthService.verifyAndConsumeResetToken(targetRole, token);

    if (!isTokenValid) {
      return res.render('auth/reset-password', {
        schoolName,
        role,
        roleName,
        token,
        error: 'Der Link ist ungültig, abgelaufen oder wurde bereits verwendet.'
      });
    }

    await AuthService.setRolePassword(targetRole, new_password);

    const redirectUrl = role === 'admin' ? '/admin/login' : '/hausmeister/login';
    res.redirect(`${redirectUrl}?msg=` + encodeURIComponent('Das Passwort wurde erfolgreich zurückgesetzt. Du kannst dich jetzt anmelden.'));
  } catch (err) {
    console.error('Password reset perform error:', err);
    res.render('auth/reset-password', {
      schoolName,
      role,
      roleName,
      token,
      error: 'Fehler beim Zurücksetzen: ' + err.message
    });
  }
});

module.exports = router;
