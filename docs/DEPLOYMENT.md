# Linux Deployment Guide - Hausmeister Ticket-System

Dieses Dokument beschreibt die schrittweise Installation und den dauerhaften Betrieb des Hausmeister Ticket-Systems auf einem Linux-Server (z. B. Ubuntu / Debian).

## 1. Voraussetzungen

* Node.js v18 LTS oder v20 LTS
* npm (wird mit Node.js installiert)
* Git (optional)
* Nginx (als Reverse Proxy)
* PM2 (Process Manager)

Node.js auf Ubuntu/Debian installieren:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential
```

## 2. Anwendungs-Code kopieren / klonen

Lade die Anwendung auf den Server in ein Verzeichnis deiner Wahl (z. B. `/var/www/hausmeister`):

```bash
sudo mkdir -p /var/www/hausmeister
sudo chown -R $USER:$USER /var/www/hausmeister
cd /var/www/hausmeister
# Code hierhin kopieren oder klonen
```

## 3. Abhängigkeiten installieren & Umgebung konfigurieren

```bash
npm install --production

# .env Datei aus Vorlage erstellen
cp .env.example .env
```

Passe die `.env`-Datei bei Bedarf an:
```env
PORT=3000
NODE_ENV=production
SESSION_SECRET=erzeuge_hier_einen_langen_zufaelligen_schluessel
DATA_DIR=./data
UPLOADS_DIR=./uploads
```

## 4. PM2 Prozess-Manager einrichten

Installiere PM2 global:
```bash
sudo npm install -g pm2
```

Starte die Anwendung über PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
```

PM2 für automatischen Systemstart nach einem Server-Neustart einrichten:
```bash
pm2 startup
# Führe den von pm2 ausgegebenen Befehl aus!
```

## 5. Nginx Reverse Proxy & HTTPS (Certbot)

Erstelle eine Nginx-Konfigurationsdatei `/etc/nginx/sites-available/hausmeister`:

```nginx
server {
    listen 80;
    server_name hausmeister.meineschule.de; # Deine Domain anpassen

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Aktiviere die Seite und lade Nginx neu:
```bash
sudo ln -s /etc/nginx/sites-available/hausmeister /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Kostenloses SSL-Zertifikat mit Certbot einrichten:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d hausmeister.meineschule.de
```

## 6. Erstinstallation im Browser

Öffne deine Domain im Browser: `https://hausmeister.meineschule.de/`
Du wirst automatisch zum Installation-Wizard `/setup` weitergeleitet. Fülle dort den Schulnamen, E-Mail-Adressen und Passwörter aus. Nach Abschluss ist das System sofort betriebsbereit.

## 7. CLI Notfall-Befehle

**Passwort zurücksetzen (falls E-Mail / SMTP gestört ist):**
```bash
node scripts/reset-admin-password.js admin "NeuesPasswort123"
node scripts/reset-admin-password.js caretaker "NeuesHausmeisterPasswort"
```

**Setup-Wizard erneut freischalten:**
```bash
node scripts/reinitialize-app.js
```
