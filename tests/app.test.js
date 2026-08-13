const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

// Set test environment
const tmpDataDir = path.join(__dirname, '../data_test');
process.env.DATA_DIR = tmpDataDir;
process.env.NODE_ENV = 'test';

if (fs.existsSync(tmpDataDir)) {
  fs.rmSync(tmpDataDir, { recursive: true, force: true });
}

const db = require('../src/db');
const SettingsService = require('../src/services/settings.service');
const AuthService = require('../src/services/auth.service');
const TicketService = require('../src/services/ticket.service');

test('Setup state and SettingsService', () => {
  assert.strictEqual(SettingsService.isSetupComplete(), false);
  SettingsService.set('school_name', 'Test Gymnasium');
  assert.strictEqual(SettingsService.get('school_name'), 'Test Gymnasium');
});

test('AuthService Password Hashing and Verification', async () => {
  const hash = await AuthService.hashPassword('geheim123');
  const valid = await AuthService.verifyPassword('geheim123', hash);
  const invalid = await AuthService.verifyPassword('falsch', hash);

  assert.strictEqual(valid, true);
  assert.strictEqual(invalid, false);
});

test('Ticket creation, categories, employees and assignment', () => {
  TicketService.seedInitialCategories();
  const categories = TicketService.getAllCategories();
  assert.ok(categories.length > 0);

  // Add Employee
  const empRes = TicketService.addEmployee('Herr Becker');
  const employees = TicketService.getAllEmployees();
  assert.strictEqual(employees.length, 1);
  assert.strictEqual(employees[0].name, 'Herr Becker');

  // Create Ticket
  const ticket = TicketService.createTicket({
    submitterName: 'Max Mustermann',
    submitterEmail: 'max@schule.de',
    categoryId: categories[0].id,
    location: 'Raum 101',
    description: 'Tafel kaputt'
  });

  assert.ok(ticket.ticket_number.startsWith('#202'));
  assert.strictEqual(ticket.status, 'offen');
  assert.strictEqual(ticket.submitter_name, 'Max Mustermann');

  // Assign Employee
  TicketService.assignEmployee(ticket.id, employees[0].id);
  const updatedTicket = TicketService.getTicketById(ticket.id);
  assert.strictEqual(updatedTicket.assigned_employee_id, employees[0].id);
  assert.strictEqual(updatedTicket.assigned_employee_name, 'Herr Becker');

  // Add Internal Comment
  TicketService.addComment(ticket.id, 'Ersatzteil bestellt.', 'HB');
  const commentedTicket = TicketService.getTicketById(ticket.id);
  assert.strictEqual(commentedTicket.comments.length, 1);
  assert.strictEqual(commentedTicket.comments[0].comment_text, 'Ersatzteil bestellt.');

  // Update Status to Closed
  TicketService.updateStatus(ticket.id, 'abgeschlossen');
  const closedTicket = TicketService.getTicketById(ticket.id);
  assert.strictEqual(closedTicket.status, 'abgeschlossen');
  assert.ok(closedTicket.closed_at !== null);
});

test('Password Reset Token Lifecycle', async () => {
  const token = await AuthService.createPasswordResetToken('caretaker');
  assert.ok(token.length > 10);

  const isValid = await AuthService.verifyAndConsumeResetToken('caretaker', token);
  assert.strictEqual(isValid, true);

  // Second use must fail
  const isSecondValid = await AuthService.verifyAndConsumeResetToken('caretaker', token);
  assert.strictEqual(isSecondValid, false);
});
