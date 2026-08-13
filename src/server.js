require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const SettingsService = require('./services/settings.service');
const checkSetupCompleted = require('./middleware/setup.middleware');

const setupRoutes = require('./routes/setup.routes');
const publicRoutes = require('./routes/public.routes');
const caretakerRoutes = require('./routes/caretaker.routes');
const adminRoutes = require('./routes/admin.routes');
const authRoutes = require('./routes/auth.routes');

const app = express();
const PORT = process.env.PORT || 5585;
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/$/, '');

function buildUrl(pathStr, basePath = '') {
  if (!pathStr) return basePath || '/';
  if (pathStr.startsWith('http://') || pathStr.startsWith('https://')) return pathStr;

  const cleanPath = pathStr.startsWith('/') ? pathStr : '/' + pathStr;
  const cleanBase = (basePath || '').replace(/\/$/, '');

  if (cleanBase) {
    if (cleanPath === cleanBase || cleanPath.startsWith(cleanBase + '/')) {
      return cleanPath;
    }
    return cleanBase + cleanPath;
  }

  return cleanPath;
}

// Security & Headers Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Body Parsers
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// Static Files & Uploads (Mounted at root and /hausmeister subpath for maximum Nginx compatibility)
app.use(express.static(path.join(__dirname, '../public')));
app.use('/hausmeister', express.static(path.join(__dirname, '../public')));

const uploadsDir = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));
app.use('/hausmeister/uploads', express.static(uploadsDir));

// Session Setup
const sessionSecret = process.env.SESSION_SECRET || 'hausmeister-secret-key-change-in-production';
app.use(session({
  name: 'hausmeister.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.REQUIRE_HTTPS === 'true',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

// View Engine (EJS + Layouts)
app.use(expressLayouts);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layouts/main');

// Rate Limiting to prevent brute-force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Zu viele Anfragen von dieser IP, bitte versuche es später erneut.'
});
app.use(limiter);

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 25,
  message: 'Zu viele fehlerhafte Anmeldeversuche. Bitte warte 10 Minuten oder starte den Dienst neu (pm2 restart hausmeister-ticket-system).'
});
app.use('/hausmeister/login', loginLimiter);
app.use('/admin/login', loginLimiter);

// Global View Locals & Redirect Interceptor Middleware
app.use((req, res, next) => {
  const envBasePath = BASE_PATH;
  const headerPrefix = (req.headers['x-forwarded-prefix'] || '').replace(/\/$/, '');
  
  let currentPrefix = envBasePath || headerPrefix || '';
  if (!currentPrefix && req.originalUrl && req.originalUrl.startsWith('/hausmeister')) {
    currentPrefix = '/hausmeister';
  }

  res.locals.basePath = currentPrefix;
  res.locals.url = (p) => buildUrl(p, currentPrefix);
  res.locals.schoolName = SettingsService.get('school_name', 'Schule');
  res.locals.schoolLogo = SettingsService.get('school_logo', null);
  res.locals.currentRole = req.session ? req.session.authenticatedRole : null;
  res.locals.currentPath = req.path;

  const rawRedirect = res.redirect.bind(res);
  res.redirect = function (urlTarget) {
    if (typeof urlTarget === 'string') {
      return rawRedirect(buildUrl(urlTarget, currentPrefix));
    }
    return rawRedirect(urlTarget);
  };

  next();
});

// Enforce Setup Check Middleware
app.use(checkSetupCompleted);

// Mount Routers for all route variations
app.use('/setup', setupRoutes);
app.use('/hausmeister/setup', setupRoutes);

app.use('/admin', adminRoutes);
app.use('/hausmeister/admin', adminRoutes);

app.use('/auth', authRoutes);
app.use('/hausmeister/auth', authRoutes);
app.use('/passwort-zuruecksetzen', authRoutes);
app.use('/hausmeister/passwort-zuruecksetzen', authRoutes);
app.use('/admin/passwort-zuruecksetzen', authRoutes);

app.use('/hausmeister', caretakerRoutes);
app.use('/caretaker', caretakerRoutes);

app.use('/hausmeister', publicRoutes);
app.use('/', publicRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('error', {
    schoolName: SettingsService.get('school_name', 'Schule'),
    message: 'Die angeforderte Seite konnte nicht gefunden werden (404).'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Exception]:', err);
  res.status(500).render('error', {
    schoolName: SettingsService.get('school_name', 'Schule'),
    message: process.env.NODE_ENV === 'production'
      ? 'Ein interner Serverfehler ist aufgetreten. Bitte versuche es später erneut.'
      : 'Serverfehler: ' + err.message
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Hausmeister Ticket-System läuft auf Port ${PORT}`);
  console.log(`Base Path: ${BASE_PATH || '/'}`);
  console.log(`Umgebung: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Setup abgeschlossen: ${SettingsService.isSetupComplete()}`);
  console.log(`====================================================`);
});

module.exports = app;
