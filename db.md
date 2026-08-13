# Datenbank-Dokumentation (SQLite)

Dieses Dokument beschreibt das Datenbankschema für das **Hausmeister Ticket-System**.

## Übersicht Tabellen

### 1. `settings`
Speichert globale Anwendungs- und Systemeinstellungen.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `key` | TEXT PRIMARY KEY | Einstellungsschlüssel (z. B. `school_name`, `admin_email`, `caretaker_email`, `admin_password_hash`, `caretaker_password_hash`, `smtp_config`, `is_setup_complete`, `school_logo`) |
| `value` | TEXT | Wert der Einstellung (ggf. JSON-formatiert) |
| `updated_at` | DATETIME | Letztes Aktualisierungsdatum |

### 2. `categories`
Kategorien für Hausmeister-Tickets.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Eindeutige ID |
| `name` | TEXT NOT NULL UNIQUE | Name der Kategorie (z. B. Elektro, Sanitär) |
| `sort_order` | INTEGER DEFAULT 0 | Sortierreihenfolge in der Anzeige |
| `is_active` | INTEGER DEFAULT 1 | 1 = Aktiv, 0 = Deaktiviert (Soft-Delete) |
| `created_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | Erstellungszeitpunkt |

### 3. `employees`
Mitarbeiter des Hausmeister-Teams zur Ticket-Zuweisung (ohne Login-Accounts).

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Eindeutige ID |
| `name` | TEXT NOT NULL | Vor- und Nachname / Name des Mitarbeiters |
| `is_active` | INTEGER DEFAULT 1 | 1 = Aktiv, 0 = Deaktiviert (Soft-Delete) |
| `created_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | Erstellungszeitpunkt |

### 4. `tickets`
Haupttabelle für Schadensmeldungen / Anfragen.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Eindeutige ID |
| `ticket_number` | TEXT NOT NULL UNIQUE | Menschenlesbare Ticketnummer (z. B. `#2026-0001`) |
| `submitter_name` | TEXT NOT NULL | Name des Meldenden |
| `submitter_email` | TEXT NOT NULL | E-Mail des Meldenden |
| `category_id` | INTEGER | Fremdschlüssel auf `categories(id)` (NULLABLE bei Löschung) |
| `category_name_snapshot` | TEXT NOT NULL | Gespeicherter Name der Kategorie zum Erstellungszeitpunkt |
| `location` | TEXT NOT NULL | Ort / Raumbezeichnung |
| `description` | TEXT NOT NULL | Fehlerbeschreibung |
| `status` | TEXT NOT NULL DEFAULT 'offen' | Status: `offen`, `in_bearbeitung`, `abgeschlossen` |
| `assigned_employee_id` | INTEGER | Fremdschlüssel auf `employees(id)` (NULLABLE) |
| `created_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | Erstellungszeitpunkt |
| `updated_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | Letzte Änderung |
| `closed_at` | DATETIME | Zeitpunkt des Abschlusses |

### 5. `ticket_attachments`
Dateianhänge zu einem Ticket (Bilder/Dateien).

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Eindeutige ID |
| `ticket_id` | INTEGER NOT NULL | Fremdschlüssel auf `tickets(id)` ON DELETE CASCADE |
| `filename` | TEXT NOT NULL | Gespeicherter Dateiname im Dateisystem |
| `original_name` | TEXT NOT NULL | Ursprünglicher Dateiname beim Upload |
| `mime_type` | TEXT NOT NULL | MIME-Typ (z.B. `image/png`) |
| `size_bytes` | INTEGER NOT NULL | Dateigröße in Bytes |
| `created_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | Erstellungszeitpunkt |

### 6. `ticket_comments`
Interne Kommentare des Hausmeisterteams zu einem Ticket.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Eindeutige ID |
| `ticket_id` | INTEGER NOT NULL | Fremdschlüssel auf `tickets(id)` ON DELETE CASCADE |
| `author_name` | TEXT | Optionales Kürzel oder Name des Verfassers |
| `comment_text` | TEXT NOT NULL | Inhalt des Kommentars |
| `created_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | Erstellungszeitpunkt |

### 7. `ticket_history`
Verlauf / Audit-Log von Ticketänderungen.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Eindeutige ID |
| `ticket_id` | INTEGER NOT NULL | Fremdschlüssel auf `tickets(id)` ON DELETE CASCADE |
| `action_type` | TEXT NOT NULL | Art der Aktion (z. B. `created`, `status_changed`, `employee_assigned`, `closed`, `reopened`) |
| `details` | TEXT | Zusaetzliche Informationen zur Änderung |
| `created_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | Erstellungszeitpunkt |

### 8. `password_reset_tokens`
Tokens zur Zurücksetzung des gemeinsamen Passworts für Hausmeister oder Admin.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Eindeutige ID |
| `target_role` | TEXT NOT NULL | Ziel-Rolle (`caretaker` oder `admin`) |
| `token_hash` | TEXT NOT NULL UNIQUE | Gehashter Token für sicheren Vergleich |
| `expires_at` | DATETIME NOT NULL | Ablaufzeitpunkt (z. B. 1 Stunde) |
| `is_used` | INTEGER DEFAULT 0 | 1 = Bereits verwendet |
| `created_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | Erstellungszeitpunkt |
