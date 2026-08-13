const SettingsService = require('../services/settings.service');

function checkSetupCompleted(req, res, next) {
  const isSetup = SettingsService.isSetupComplete();
  const path = req.path;
  const originalUrl = req.originalUrl || '';

  const isSetupRoute = path.includes('/setup') || originalUrl.includes('/setup');
  const isPublicAsset = path.includes('/css') || path.includes('/js') || path.includes('/uploads') || path.includes('/favicon');

  if (!isSetup && !isSetupRoute && !isPublicAsset) {
    return res.redirect('/setup');
  }

  if (isSetup && isSetupRoute) {
    return res.redirect('/');
  }

  next();
}

module.exports = checkSetupCompleted;
