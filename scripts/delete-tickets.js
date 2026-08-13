/**
 * delete-tickets.js
 * Löscht alle Tickets (und verknüpfte Kommentare/History/Attachments) aus der Datenbank.
 * Aufruf: node scripts/delete-tickets.js [--all | --id=<id>]
 *
 * Beispiele:
 *   node scripts/delete-tickets.js --all          Alle Tickets löschen
 *   node scripts/delete-tickets.js --id=1          Einzelnes Ticket löschen (ID=1)
 *   node scripts/delete-tickets.js --id=1,2,3      Mehrere Tickets löschen
 */

require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '../data/hausmeister.db');

if (!fs.existsSync(dbPath)) {
  console.error('Datenbankdatei nicht gefunden:', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('');
  console.log('Verwendung:');
  console.log('  node scripts/delete-tickets.js --all          Alle Tickets löschen');
  console.log('  node scripts/delete-tickets.js --id=1         Ticket mit ID 1 löschen');
  console.log('  node scripts/delete-tickets.js --id=1,2,3     Mehrere Tickets löschen');
  console.log('');
  process.exit(0);
}

function deleteTickets(ids = null) {
  const allTickets = ids
    ? db.prepare(`SELECT id, ticket_number FROM tickets WHERE id IN (${ids.map(() => '?').join(',')})`)
        .all(...ids)
    : db.prepare('SELECT id, ticket_number FROM tickets').all();

  if (allTickets.length === 0) {
    console.log('Keine Tickets gefunden.');
    return;
  }

  console.log(`\nFolgende ${allTickets.length} Ticket(s) werden gelöscht:`);
  allTickets.forEach(t => console.log(`  - [${t.id}] ${t.ticket_number}`));
  console.log('');

  const deleteAll = db.transaction((ticketIds) => {
    for (const id of ticketIds) {
      db.prepare('DELETE FROM ticket_comments WHERE ticket_id = ?').run(id);
      db.prepare('DELETE FROM ticket_history WHERE ticket_id = ?').run(id);
      db.prepare('DELETE FROM ticket_attachments WHERE ticket_id = ?').run(id);
      db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
    }
  });

  deleteAll(allTickets.map(t => t.id));

  console.log(`✓ ${allTickets.length} Ticket(s) erfolgreich gelöscht.`);
}

if (args.includes('--all')) {
  deleteTickets(null);
} else {
  const idArg = args.find(a => a.startsWith('--id='));
  if (!idArg) {
    console.error('Unbekanntes Argument. Nutze --all oder --id=<id>');
    process.exit(1);
  }
  const ids = idArg.replace('--id=', '').split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
  if (ids.length === 0) {
    console.error('Keine gültige ID angegeben.');
    process.exit(1);
  }
  deleteTickets(ids);
}

db.close();
