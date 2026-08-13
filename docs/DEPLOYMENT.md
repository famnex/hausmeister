# Linux Deployment Guide - Hausmeister Ticket-System (Port 5585)

Dieses Dokument beschreibt die Installation und den dauerhaften Betrieb des Hausmeister Ticket-Systems auf einem Linux-Server mit vorgegebenem Port 5585.

## 1. Anwendungs-Code klonen

Lade die Anwendung auf den Server in das gewünschte Verzeichnis:

```bash
git clone https://github.com/famnex/hausmeister.git /var/www/hausmeister
cd /var/www/hausmeister
```

## 2. Abhängigkeiten installieren & Umgebungsdatei erstellen

```bash
npm install --production
cp .env.example .env
```

Falls gewünscht, passe `.env` an:
```env
PORT=5585
NODE_ENV=production
SESSION_SECRET=erzeuge_hier_einen_langen_zufaelligen_schluessel
```

## 3. Anwendung mit PM2 starten

Starte das System direkt über die vorkonfigurierte PM2 Ecosystem-Datei:

```bash
pm2 start ecosystem.config.js
pm2 save
```

## 4. Nginx Reverse Proxy Konfiguration (Port 5585)

Erstelle oder passe die Nginx-Konfiguration an:

```nginx
server {
    listen 80;
    server_name hausmeister.meineschule.de;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:5585;
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

Nginx neu laden:
```bash
sudo systemctl reload nginx
```
