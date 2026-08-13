const express = require('express');
const router = express.Router();
const SettingsService = require('../services/settings.service');
const AuthService = require('../services/auth.service');
const MailService = require('../services/mail.service');

// Helper to render forgot password view with feedback
function renderForgotPassword(res, role, error = null, successMessage = null) {
  const roleName = role === 'admin' ? 'Administrator' : 'Hausmeister';
  const schoolName = SettingsService.get('school_name', 'Schule');
  res.render('auth/forgot-password', {
    schoolName,
    role,
    roleName,
    error,
    successMessage
  });
}

// Request Reset Link Page (for Caretaker or Admin)
router.get(['/:role/passwort-vergessen', '/passwort-vergessen'], (req, res) => {
  const roleParam = req.params.role || req.query.role || 'hausmeister';
  const role = ['admin', 'administrator'].includes(roleParam) ? 'admin' : 'hausmeister';
  renderForgotPassword(res, role);
});

router.post(['/:role/passwort-vergessen', '/passwort-vergessen'], async (req, res) => {
  const roleParam = req.params.role || req.body.role || req.query.role || 'hausmeister';
  const role = ['admin', 'administrator'].includes(roleParam) ? 'admin' : 'hausmeister';
  const targetRole = role === 'admin' ? 'admin' : 'caretaker';
  const recipientEmail = SettingsService.get(targetRole === 'admin' ? 'admin_email' : 'caretaker_email');

  const genericSuccess = 'Falls für diese Rolle eine gültige E-Mail-Adresse im System hinterlegt ist, wurde ein Link zum Zurücksetzen des Passworts versendet.';

  if (!recipientEmail) {
    return renderForgotPassword(res, role, null, genericSuccess);
  }

  try {
    const rawToken = await AuthService.createPasswordResetToken(targetRole);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const basePath = res.locals.basePath || process.env.BASE_PATH || '';

    const mailResult = await MailService.sendPasswordResetMail(recipientEmail, targetRole, rawToken, protocol, host, basePath);

    if (mailResult.success) {
      renderForgotPassword(res, role, null, genericSuccess);
    } else {
      renderForgotPassword(res, role, `Der Link konnte nicht per E-Mail gesendet werden (${mailResult.reason}). Bitte kontaktiere den Administrator.`, null);
    }
  } catch (err) {
    console.error('Password reset request error:', err);
    renderForgotPassword(res, role, 'Fehler beim Verarbeiten der Anfrage: ' + err.message, null);
  }
});

// Perform Password Reset Page (Accepts any path structure including extra subpaths or legacy routes)
router.get([
  '/:role/passwort-zuruecksetzen',
  '/passwort-zuruecksetzen',
  '/hausmeister/passwort-zuruecksetzen',
  '/admin/passwort-zuruecksetzen'
], (req, res) => {
  let roleParam = req.params.role || req.query.role;
  if (!roleParam && req.originalUrl) {
    if (req.originalUrl.includes('/admin')) roleParam = 'admin';
    else roleParam = 'hausmeister';
  }

  const role = ['admin', 'administrator'].includes(roleParam) ? 'admin' : 'hausmeister';
  const token = req.query.token;

  if (!token) {
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

router.post([
  '/:role/passwort-zuruecksetzen',
  '/passwort-zuruecksetzen',
  '/hausmeister/passwort-zuruecksetzen',
  '/admin/passwort-zuruecksetzen'
], async (req, res) => {
  let roleParam = req.params.role || req.body.role || req.query.role;
  if (!roleParam && req.originalUrl) {
    if (req.originalUrl.includes('/admin')) roleParam = 'admin';
    else roleParam = 'hausmeister';
  }

  const role = ['admin', 'administrator'].includes(roleParam) ? 'admin' : 'hausmeister';
  const { token, new_password, new_password_confirm } = req.body;
  const targetRole = role === 'admin' ? 'admin' : 'caretaker';
  const roleName = role === 'admin' ? 'Administrator' : 'Hausmeister';
  const schoolName = SettingsService.get('school_name', 'Schule');

  if (!token) {
    return res.redirect('/');
  }

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
