# Hausmeister Ticket-System für Schulen

Ein schlankes, sicheres und benutzerfreundliches Ticket- und Facility-Management-System für Schulen.

## Features

- **Öffentliche Ticket-Erstellung**: Direkt auf der Startseite ohne Registrierungszwang.
- **Gemeinsame Passwörter**: Getrennter Zugang für Hausmeister & Administration (ohne komplexe Accountverwaltung).
- **Schnellzuweisung**: Direct Inline-Dropdown Zuweisung von Mitarbeitern direkt in der Ticketübersicht.
- **Kategorien & Mitarbeiter**: Eigenständige Pflege durch Hausmeister (Soft-Delete schützt Historie).
- **Interne Kommentare & Audit-Log**: Geschützte Notizen & lückenloser Verlauf je Ticket.
- **E-Mail Benachrichtigungen**: Automatische Bestätigung an Meldende, Hausmeister & Passwort-Reset.
- **Erstinstallations-Wizard**: Automatische geführte Einrichtung beim ersten Start unter `/setup`.
- **Selbstgehostet & SQLite**: Keine Cloud-Abhängigkeiten, einfache Datensicherung.

## Schnellstart (Entwicklung)

1. **Abhängigkeiten installieren**:
   ```bash
   npm install
   ```

2. **Anwendung starten**:
   ```bash
   npm start
   # Oder im Entwicklungsmodus mit Hot-Reloading:
   npm run dev
   ```

3. **Im Browser öffnen**:
   Navigiere zu `http://localhost:3000`. Beim ersten Aufruf erscheint automatisch der Installation-Wizard.

## Dokumentation

- [Linux Deployment Anleitung](docs/DEPLOYMENT.md)
- [Backup & Wiederherstellung Guide](docs/BACKUP_RESTORE.md)
- [Datenbank-Schema Dokumentation](db.md)

## Notfall-Befehle (CLI)

* **Passwort auf dem Server zurücksetzen**:
  ```bash
  node scripts/reset-admin-password.js admin "NeuesPasswort"
  node scripts/reset-admin-password.js caretaker "NeuesPasswort"
  ```

* **Setup-Wizard erneut freischalten**:
  ```bash
  node scripts/reinitialize-app.js
  ```
