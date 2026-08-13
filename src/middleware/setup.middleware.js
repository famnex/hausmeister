const SettingsService = require('../services/settings.service');

function checkSetupCompleted(req, res, next) {
  const isSetup = SettingsService.isSetupComplete();

  if (!isSetup && !req.path.startsWith('/setup') && !req.path.startsWith('/public') && !req.path.startsWith('/css') && !req.path.startsWith('/js')) {
    return res.redirect('/setup');
  }

  if (isSetup && req.path.startsWith('/setup')) {
    return res.redirect('/');
  }

  next();
}

module.exports = checkSetupCompleted;
