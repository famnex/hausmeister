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
const PORT = process.env.PORT || 3000;

// Security & Headers Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allows inline images/uploads for simplicity
  crossOriginEmbedderPolicy: false
}));

// Rate Limiting to prevent brute-force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Zu viele Anfragen von dieser IP, bitte versuche es später erneut.'
});
app.use(limiter);

// Specific rate limit for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Zu viele fehlerhafte Anmeldeversuche. Bitte warte 15 Minuten.'
});
app.use('/hausmeister/login', loginLimiter);
app.use('/admin/login', loginLimiter);

// Body Parsers
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// Static Files & Uploads
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(__dirname, '../uploads')));

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
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  }
}));

// View Engine (EJS + Layouts)
app.use(expressLayouts);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layouts/main');

// Global View Locals Middleware
app.use((req, res, next) => {
  res.locals.schoolName = SettingsService.get('school_name', 'Schule');
  res.locals.schoolLogo = SettingsService.get('school_logo', null);
  res.locals.currentRole = req.session ? req.session.authenticatedRole : null;
  res.locals.currentPath = req.path;
  next();
});

// Enforce Setup Check Middleware
app.use(checkSetupCompleted);

// Mount Routes
app.use('/setup', setupRoutes);
app.use('/', publicRoutes);
app.use('/hausmeister', caretakerRoutes);
app.use('/admin', adminRoutes);
app.use('/auth', authRoutes);

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
  console.log(`Umgebung: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Setup abgeschlossen: ${SettingsService.isSetupComplete()}`);
  console.log(`====================================================`);
});

module.exports = app;
