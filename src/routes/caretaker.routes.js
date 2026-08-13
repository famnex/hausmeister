const express = require('express');
const router = express.Router();
const SettingsService = require('../services/settings.service');
const AuthService = require('../services/auth.service');
const TicketService = require('../services/ticket.service');
const MailService = require('../services/mail.service');
const { requireAuth } = require('../middleware/auth.middleware');

// Caretaker Login Page
router.get('/login', (req, res) => {
  if (req.session && ['caretaker', 'admin'].includes(req.session.authenticatedRole)) {
    return res.redirect('/hausmeister');
  }
  const schoolName = SettingsService.get('school_name', 'Schule');
  res.render('caretaker/login', { schoolName, error: null, successMessage: req.query.msg || null });
});

router.post('/login', async (req, res) => {
  const { password } = req.body;
  const schoolName = SettingsService.get('school_name', 'Schule');

  if (!password) {
    return res.render('caretaker/login', { schoolName, error: 'Bitte gib das Passwort ein.', successMessage: null });
  }

  const isValid = await AuthService.verifyRolePassword('caretaker', password);

  if (isValid) {
    req.session.authenticatedRole = 'caretaker';
    return res.redirect('/hausmeister');
  } else {
    const isAdmin = await AuthService.verifyRolePassword('admin', password);
    if (isAdmin) {
      req.session.authenticatedRole = 'admin';
      return res.redirect('/hausmeister');
    }
    return res.render('caretaker/login', { schoolName, error: 'Ungültiges Hausmeister-Passwort.', successMessage: null });
  }
});

// Caretaker Dashboard Root
router.get('/', requireAuth('caretaker'), (req, res) => {
  const schoolName = SettingsService.get('school_name', 'Schule');
  const { status, category_id, employee_id, search } = req.query;

  const tickets = TicketService.getAllTickets({
    status: status || null,
    categoryId: category_id ? parseInt(category_id, 10) : null,
    employeeId: employee_id || null,
    search: search || null
  });

  const categories = TicketService.getAllCategories(true);
  const employees = TicketService.getAllEmployees(true);

  const allTickets = TicketService.getAllTickets();
  const stats = {
    open: allTickets.filter(t => t.status === 'offen').length,
    inProgress: allTickets.filter(t => t.status === 'in_bearbeitung').length,
    closed: allTickets.filter(t => t.status === 'abgeschlossen').length,
    unassigned: allTickets.filter(t => !t.assigned_employee_id && t.status !== 'abgeschlossen').length
  };

  res.render('caretaker/dashboard', {
    schoolName,
    tickets,
    categories,
    employees,
    filters: { status: status || '', category_id: category_id || '', employee_id: employee_id || '', search: search || '' },
    stats,
    successMessage: req.query.msg || null
  });
});

// Fast Inline Assignment from Overview
router.post('/tickets/:id/assign-fast', requireAuth('caretaker'), (req, res) => {
  const ticketId = parseInt(req.params.id, 10);
  const { employee_id } = req.body;

  try {
    TicketService.assignEmployee(ticketId, employee_id ? parseInt(employee_id, 10) : null);
    res.redirect('/hausmeister?msg=' + encodeURIComponent('Zuweisung gespeichert.'));
  } catch (err) {
    res.redirect('/hausmeister?msg=' + encodeURIComponent('Fehler beim Zuweisen: ' + err.message));
  }
});

// Ticket Detail View
router.get('/tickets/:id', requireAuth('caretaker'), (req, res) => {
  const schoolName = SettingsService.get('school_name', 'Schule');
  const ticketId = parseInt(req.params.id, 10);
  const ticket = TicketService.getTicketById(ticketId);

  if (!ticket) {
    return res.status(404).render('error', { schoolName, message: 'Ticket nicht gefunden.' });
  }

  const categories = TicketService.getAllCategories(true);
  const employees = TicketService.getAllEmployees(true);

  res.render('caretaker/ticket-detail', {
    schoolName,
    ticket,
    categories,
    employees,
    error: null,
    successMessage: req.query.msg || null
  });
});

// Update Ticket Status / Assignment
router.post('/tickets/:id/update', requireAuth('caretaker'), async (req, res) => {
  const ticketId = parseInt(req.params.id, 10);
  const { status, assigned_employee_id } = req.body;
  const ticket = TicketService.getTicketById(ticketId);

  if (!ticket) {
    return res.redirect('/hausmeister');
  }

  try {
    const oldStatus = ticket.status;

    if (assigned_employee_id !== undefined) {
      TicketService.assignEmployee(ticketId, assigned_employee_id ? parseInt(assigned_employee_id, 10) : null);
    }

    if (status && status !== oldStatus) {
      TicketService.updateStatus(ticketId, status);

      if (status === 'abgeschlossen') {
        const updatedTicket = TicketService.getTicketById(ticketId);
        MailService.sendTicketClosedSubmitterNotification(updatedTicket);
      }
    }

    res.redirect(`/hausmeister/tickets/${ticketId}?msg=` + encodeURIComponent('Änderungen gespeichert.'));
  } catch (err) {
    console.error('Error updating ticket:', err);
    res.redirect(`/hausmeister/tickets/${ticketId}?msg=` + encodeURIComponent('Fehler: ' + err.message));
  }
});

// Add Internal Comment
router.post('/tickets/:id/comment', requireAuth('caretaker'), (req, res) => {
  const ticketId = parseInt(req.params.id, 10);
  const { author_name, comment_text } = req.body;

  if (!comment_text || !comment_text.trim()) {
    return res.redirect(`/hausmeister/tickets/${ticketId}?msg=` + encodeURIComponent('Kommentar darf nicht leer sein.'));
  }

  try {
    TicketService.addComment(ticketId, comment_text.trim(), author_name ? author_name.trim() : '');
    res.redirect(`/hausmeister/tickets/${ticketId}?msg=` + encodeURIComponent('Kommentar hinzugefügt.'));
  } catch (err) {
    res.redirect(`/hausmeister/tickets/${ticketId}?msg=` + encodeURIComponent('Fehler: ' + err.message));
  }
});

// Category Management
router.get('/categories', requireAuth('caretaker'), (req, res) => {
  const schoolName = SettingsService.get('school_name', 'Schule');
  const categories = TicketService.getAllCategories(true);

  res.render('caretaker/categories', {
    schoolName,
    categories,
    error: null,
    successMessage: req.query.msg || null
  });
});

router.post('/categories/add', requireAuth('caretaker'), (req, res) => {
  const { name, sort_order } = req.body;
  if (!name || !name.trim()) {
    return res.redirect('/hausmeister/categories?msg=' + encodeURIComponent('Kategoriename darf nicht leer sein.'));
  }

  try {
    TicketService.addCategory(name.trim(), sort_order ? parseInt(sort_order, 10) : 0);
    res.redirect('/hausmeister/categories?msg=' + encodeURIComponent('Kategorie hinzugefügt.'));
  } catch (err) {
    res.redirect('/hausmeister/categories?msg=' + encodeURIComponent('Fehler: ' + err.message));
  }
});

router.post('/categories/:id/edit', requireAuth('caretaker'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, sort_order, is_active } = req.body;

  try {
    TicketService.updateCategory(id, name.trim(), parseInt(sort_order, 10) || 0, is_active === 'on');
    res.redirect('/hausmeister/categories?msg=' + encodeURIComponent('Kategorie aktualisiert.'));
  } catch (err) {
    res.redirect('/hausmeister/categories?msg=' + encodeURIComponent('Fehler: ' + err.message));
  }
});

// Employee Management
router.get('/employees', requireAuth('caretaker'), (req, res) => {
  const schoolName = SettingsService.get('school_name', 'Schule');
  const employees = TicketService.getAllEmployees(true);

  res.render('caretaker/employees', {
    schoolName,
    employees,
    error: null,
    successMessage: req.query.msg || null
  });
});

router.post('/employees/add', requireAuth('caretaker'), (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.redirect('/hausmeister/employees?msg=' + encodeURIComponent('Name darf nicht leer sein.'));
  }

  try {
    TicketService.addEmployee(name.trim());
    res.redirect('/hausmeister/employees?msg=' + encodeURIComponent('Mitarbeiter hinzugefügt.'));
  } catch (err) {
    res.redirect('/hausmeister/employees?msg=' + encodeURIComponent('Fehler: ' + err.message));
  }
});

router.post('/employees/:id/edit', requireAuth('caretaker'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, is_active } = req.body;

  try {
    TicketService.updateEmployee(id, name.trim(), is_active === 'on');
    res.redirect('/hausmeister/employees?msg=' + encodeURIComponent('Mitarbeiter aktualisiert.'));
  } catch (err) {
    res.redirect('/hausmeister/employees?msg=' + encodeURIComponent('Fehler: ' + err.message));
  }
});

// Change Password
router.get('/passwort', requireAuth('caretaker'), (req, res) => {
  const schoolName = SettingsService.get('school_name', 'Schule');
  res.render('caretaker/password', { schoolName, error: null, successMessage: req.query.msg || null });
});

router.post('/passwort', requireAuth('caretaker'), async (req, res) => {
  const { current_password, new_password, new_password_confirm } = req.body;
  const schoolName = SettingsService.get('school_name', 'Schule');

  if (!current_password || !new_password || !new_password_confirm) {
    return res.render('caretaker/password', { schoolName, error: 'Bitte fülle alle Felder aus.', successMessage: null });
  }

  if (new_password !== new_password_confirm) {
    return res.render('caretaker/password', { schoolName, error: 'Die neuen Passwörter stimmen nicht überein.', successMessage: null });
  }

  if (new_password.length < 6) {
    return res.render('caretaker/password', { schoolName, error: 'Das neue Passwort muss mindestens 6 Zeichen lang sein.', successMessage: null });
  }

  const isCurrentValid = await AuthService.verifyRolePassword('caretaker', current_password);
  if (!isCurrentValid) {
    return res.render('caretaker/password', { schoolName, error: 'Das aktuelle Passwort ist nicht korrekt.', successMessage: null });
  }

  await AuthService.setRolePassword('caretaker', new_password);
  res.render('caretaker/password', { schoolName, error: null, successMessage: 'Hausmeister-Passwort erfolgreich geändert.' });
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/hausmeister/login');
});

module.exports = router;
