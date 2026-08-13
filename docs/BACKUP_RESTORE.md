# Backup & Wiederherstellung (Backup & Restore Guide)

Da das Hausmeister Ticket-System SQLite und lokale Dateispeicher nutzt, ist die Sicherung extrem einfach und zuverlässig.

## Was muss gesichert werden?

Sämtliche persistenten Anwendungsdaten befinden sich in zwei Ordnern:

1. **`./data/`**: Enthält die SQLite-Datenbank `hausmeister.sqlite`.
2. **`./uploads/`**: Enthält hochgeladene Dateianhänge und das Schullogo.

## 1. Sicheres Backup erstellen (Online / Im laufenden Betrieb)

SQLite unterstützt das Erstellen einer sicheren Datenbanksicherung auch während Lese- und Schreibzugriffe stattfinden:

```bash
# Erstelle einen Backup-Ordner
mkdir -p /var/backups/hausmeister

# Sicherer SQLite Online-Snapshot
sqlite3 /var/www/hausmeister/data/hausmeister.sqlite ".backup '/var/backups/hausmeister/db_$(date +%F).sqlite'"

# Alternativ per Skript/Copy, wenn SQLite CLI nicht installiert ist:
# PM2 kurz stoppen, um Konsistenz zu garantieren:
# pm2 stop hausmeister-ticket-system
# cp -r /var/www/hausmeister/data /var/backups/hausmeister/data_$(date +%F)
# cp -r /var/www/hausmeister/uploads /var/backups/hausmeister/uploads_$(date +%F)
# pm2 start hausmeister-ticket-system

# Upload-Dateien sichern (tar-Archiv)
tar -czf /var/backups/hausmeister/uploads_$(date +%F).tar.gz -C /var/www/hausmeister uploads
```

### Automatisiertes tägliches Backup (Cronjob)

Füge folgenden Befehl zu deiner Crontab hinzu (`crontab -e`):

```cron
0 2 * * * cp /var/www/hausmeister/data/hausmeister.sqlite /var/backups/hausmeister/db_$(date +\%F).sqlite && tar -czf /var/backups/hausmeister/uploads_$(date +\%F).tar.gz -C /var/www/hausmeister uploads
```

---

## 2. Wiederherstellung (Restore)

Um ein Backup auf einem neuen oder bestehenden Server einzuspielen:

1. Stoppe die Anwendung:
   ```bash
   pm2 stop hausmeister-ticket-system
   ```

2. Stelle die Datenbank wieder her:
   ```bash
   cp /var/backups/hausmeister/db_2026-08-13.sqlite /var/www/hausmeister/data/hausmeister.sqlite
   ```

3. Stelle die hochgeladenen Dateien wieder her:
   ```bash
   tar -xzf /var/backups/hausmeister/uploads_2026-08-13.tar.gz -C /var/www/hausmeister
   ```

4. Starte die Anwendung neu:
   ```bash
   pm2 start hausmeister-ticket-system
   ```
