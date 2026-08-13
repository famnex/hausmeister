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
  const cleanBase = basePath.replace(/\/$/, '');

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

// Create Main Router for App
const appRouter = express.Router();

// Static Files & Uploads within App Router
appRouter.use(express.static(path.join(__dirname, '../public')));
appRouter.use('/uploads', express.static(process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(__dirname, '../uploads')));

// Rate Limiting to prevent brute-force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Zu viele Anfragen von dieser IP, bitte versuche es später erneut.'
});
appRouter.use(limiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Zu viele fehlerhafte Anmeldeversuche. Bitte warte 15 Minuten.'
});
appRouter.use('/hausmeister/login', loginLimiter);
appRouter.use('/admin/login', loginLimiter);

// Global View Locals Middleware
appRouter.use((req, res, next) => {
  const currentBasePath = req.baseUrl || BASE_PATH || '';

  res.locals.basePath = currentBasePath;
  res.locals.url = (p) => buildUrl(p, currentBasePath);
  res.locals.schoolName = SettingsService.get('school_name', 'Schule');
  res.locals.schoolLogo = SettingsService.get('school_logo', null);
  res.locals.currentRole = req.session ? req.session.authenticatedRole : null;
  res.locals.currentPath = req.path;

  // Intercept res.redirect to prefix basePath if relative to root
  const rawRedirect = res.redirect.bind(res);
  res.redirect = function (urlTarget) {
    if (typeof urlTarget === 'string') {
      return rawRedirect(buildUrl(urlTarget, currentBasePath));
    }
    return rawRedirect(urlTarget);
  };

  next();
});

// Enforce Setup Check Middleware
appRouter.use(checkSetupCompleted);

// App Routes
appRouter.use('/setup', setupRoutes);
appRouter.use('/hausmeister', caretakerRoutes);
appRouter.use('/admin', adminRoutes);
appRouter.use('/auth', authRoutes);
appRouter.use('/', publicRoutes);

// Mount Router on BASE_PATH or Root
if (BASE_PATH) {
  app.use(BASE_PATH, appRouter);
  app.get('/', (req, res) => res.redirect(BASE_PATH));
} else {
  app.use('/', appRouter);
}

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
