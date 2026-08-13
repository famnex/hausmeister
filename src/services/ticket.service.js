const db = require('../db');

const TicketService = {
  generateTicketNumber() {
    const year = new Date().getFullYear();
    const prefix = `#${year}-`;

    const row = db.prepare(`
      SELECT ticket_number FROM tickets
      WHERE ticket_number LIKE ?
      ORDER BY id DESC LIMIT 1
    `).get(`${prefix}%`);

    let nextSeq = 1;
    if (row && row.ticket_number) {
      const parts = row.ticket_number.split('-');
      if (parts.length === 2) {
        const lastNum = parseInt(parts[1], 10);
        if (!isNaN(lastNum)) {
          nextSeq = lastNum + 1;
        }
      }
    }

    const paddedSeq = String(nextSeq).padStart(4, '0');
    return `${prefix}${paddedSeq}`;
  },

  createTicket({ submitterName, submitterEmail, categoryId, location, description, attachments = [] }) {
    let categoryNameSnapshot = 'Unbekannt';
    if (categoryId) {
      const cat = db.prepare('SELECT name FROM categories WHERE id = ?').get(categoryId);
      if (cat) categoryNameSnapshot = cat.name;
    }

    const ticketNumber = this.generateTicketNumber();

    const insertTicket = db.prepare(`
      INSERT INTO tickets (ticket_number, submitter_name, submitter_email, category_id, category_name_snapshot, location, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'offen')
    `);

    const result = insertTicket.run(
      ticketNumber,
      submitterName,
      submitterEmail,
      categoryId || null,
      categoryNameSnapshot,
      location,
      description
    );

    const ticketId = result.lastInsertRowid;

    if (attachments && attachments.length > 0) {
      const insertAttach = db.prepare(`
        INSERT INTO ticket_attachments (ticket_id, filename, original_name, mime_type, size_bytes)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const att of attachments) {
        insertAttach.run(ticketId, att.filename, att.originalname, att.mimetype, att.size);
      }
    }

    this.addHistory(ticketId, 'created', `Ticket ${ticketNumber} von ${submitterName} erstellt.`);

    return this.getTicketById(ticketId);
  },

  getTicketById(id) {
    const ticket = db.prepare(`
      SELECT t.*, c.name as current_category_name, e.name as assigned_employee_name
      FROM tickets t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN employees e ON t.assigned_employee_id = e.id
      WHERE t.id = ?
    `).get(id);

    if (!ticket) return null;

    ticket.attachments = db.prepare('SELECT * FROM ticket_attachments WHERE ticket_id = ?').all(id);
    ticket.comments = db.prepare('SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at ASC').all(id);
    ticket.history = db.prepare('SELECT * FROM ticket_history WHERE ticket_id = ? ORDER BY created_at ASC').all(id);

    return ticket;
  },

  getAllTickets({ status, categoryId, employeeId, search } = {}) {
    let query = `
      SELECT t.*, c.name as current_category_name, e.name as assigned_employee_name
      FROM tickets t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN employees e ON t.assigned_employee_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (status === '__active__') {
      query += " AND t.status IN ('offen', 'in_bearbeitung')";
    } else if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }


    if (categoryId) {
      query += ' AND t.category_id = ?';
      params.push(categoryId);
    }

    if (employeeId === 'unassigned') {
      query += ' AND t.assigned_employee_id IS NULL';
    } else if (employeeId) {
      query += ' AND t.assigned_employee_id = ?';
      params.push(employeeId);
    }

    if (search) {
      query += ' AND (t.ticket_number LIKE ? OR t.submitter_name LIKE ? OR t.location LIKE ? OR t.description LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += ' ORDER BY t.created_at DESC';

    return db.prepare(query).all(...params);
  },

  assignEmployee(ticketId, employeeId) {
    const emp = employeeId ? db.prepare('SELECT name FROM employees WHERE id = ?').get(employeeId) : null;
    const empName = emp ? emp.name : 'Niemand';

    db.prepare(`
      UPDATE tickets
      SET assigned_employee_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(employeeId || null, ticketId);

    this.addHistory(ticketId, 'employee_assigned', `Zuweisung geändert auf: ${empName}`);
  },

  updateStatus(ticketId, newStatus) {
    const validStatuses = ['offen', 'in_bearbeitung', 'abgeschlossen'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Ungültiger Status: ${newStatus}`);
    }

    let closedAtClause = '';
    if (newStatus === 'abgeschlossen') {
      closedAtClause = ', closed_at = CURRENT_TIMESTAMP';
    } else {
      closedAtClause = ', closed_at = NULL';
    }

    db.prepare(`
      UPDATE tickets
      SET status = ?, updated_at = CURRENT_TIMESTAMP ${closedAtClause}
      WHERE id = ?
    `).run(newStatus, ticketId);

    const statusLabels = {
      'offen': 'Offen',
      'in_bearbeitung': 'In Bearbeitung',
      'abgeschlossen': 'Abgeschlossen'
    };

    this.addHistory(ticketId, 'status_changed', `Status geändert auf: ${statusLabels[newStatus] || newStatus}`);
  },

  addComment(ticketId, commentText, authorName = '') {
    db.prepare(`
      INSERT INTO ticket_comments (ticket_id, author_name, comment_text)
      VALUES (?, ?, ?)
    `).run(ticketId, authorName || null, commentText);

    this.addHistory(ticketId, 'comment_added', `Interner Kommentar hinzugefügt${authorName ? ' von ' + authorName : ''}.`);
  },

  addHistory(ticketId, actionType, details) {
    db.prepare(`
      INSERT INTO ticket_history (ticket_id, action_type, details)
      VALUES (?, ?, ?)
    `).run(ticketId, actionType, details);
  },

  // Category Management
  getAllCategories(includeInactive = false) {
    if (includeInactive) {
      return db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all();
    }
    return db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC').all();
  },

  addCategory(name, sortOrder = 0) {
    return db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name, sortOrder);
  },

  updateCategory(id, name, sortOrder, isActive) {
    return db.prepare('UPDATE categories SET name = ?, sort_order = ?, is_active = ? WHERE id = ?').run(name, sortOrder, isActive ? 1 : 0, id);
  },

  // Employee Management
  getAllEmployees(includeInactive = false) {
    if (includeInactive) {
      return db.prepare('SELECT * FROM employees ORDER BY name ASC').all();
    }
    return db.prepare('SELECT * FROM employees WHERE is_active = 1 ORDER BY name ASC').all();
  },

  addEmployee(name) {
    return db.prepare('INSERT INTO employees (name) VALUES (?)').run(name);
  },

  updateEmployee(id, name, isActive) {
    return db.prepare('UPDATE employees SET name = ?, is_active = ? WHERE id = ?').run(name, isActive ? 1 : 0, id);
  },

  seedInitialCategories() {
    const count = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
    if (count === 0) {
      const defaultCategories = [
        'Elektro',
        'Sanitär',
        'Heizung',
        'Möbel / Inventar',
        'Gebäude & Fenster',
        'Reinigung',
        'Außenbereich & Schulhof',
        'Sonstiges'
      ];
      const stmt = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
      defaultCategories.forEach((cat, index) => {
        stmt.run(cat, index * 10);
      });
    }
  }
};

module.exports = TicketService;
