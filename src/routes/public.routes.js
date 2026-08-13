const express = require('express');
const router = express.Router();
const SettingsService = require('../services/settings.service');
const TicketService = require('../services/ticket.service');
const MailService = require('../services/mail.service');
const upload = require('../middleware/upload.middleware');

router.get(['/', '/hausmeister'], (req, res) => {
  const schoolName = SettingsService.get('school_name', 'Schule');
  const schoolLogo = SettingsService.get('school_logo', null);
  const categories = TicketService.getAllCategories();
  const setupSuccess = req.query.setup_success === '1';

  res.render('public/index', {
    schoolName,
    schoolLogo,
    categories,
    setupSuccess,
    error: null,
    formData: {}
  });
});

router.post(['/ticket', '/hausmeister/ticket'], upload.array('attachments', 3), async (req, res) => {
  const { submitter_name, submitter_email, category_id, location, description } = req.body;
  const categories = TicketService.getAllCategories();
  const schoolName = SettingsService.get('school_name', 'Schule');
  const schoolLogo = SettingsService.get('school_logo', null);

  const formData = { submitter_name, submitter_email, category_id, location, description };

  if (!submitter_name || !submitter_email || !category_id || !location || !description) {
    return res.render('public/index', {
      schoolName,
      schoolLogo,
      categories,
      setupSuccess: false,
      error: 'Bitte fülle alle Pflichtfelder aus.',
      formData
    });
  }

  // Basic email syntax check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(submitter_email)) {
    return res.render('public/index', {
      schoolName,
      schoolLogo,
      categories,
      setupSuccess: false,
      error: 'Bitte gib eine gültige E-Mail-Adresse ein.',
      formData
    });
  }

  try {
    const ticket = TicketService.createTicket({
      submitterName: submitter_name.trim(),
      submitterEmail: submitter_email.trim().toLowerCase(),
      categoryId: parseInt(category_id, 10),
      location: location.trim(),
      description: description.trim(),
      attachments: req.files
    });

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const basePath = res.locals.basePath || process.env.BASE_PATH || '';

    // Send emails asynchronously (failures won't rollback ticket creation)
    MailService.sendTicketCreatedSubmitterConfirmation(ticket);
    MailService.sendTicketCreatedCaretakerNotification(ticket, protocol, host, basePath);

    res.render('public/confirmation', {
      schoolName,
      schoolLogo,
      ticket
    });
  } catch (err) {
    console.error('Error creating ticket:', err);
    res.render('public/index', {
      schoolName,
      schoolLogo,
      categories,
      setupSuccess: false,
      error: 'Fehler beim Erstellen des Tickets: ' + err.message,
      formData
    });
  }
});

module.exports = router;
