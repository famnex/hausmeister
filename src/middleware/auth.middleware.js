function requireAuth(role) {
  return function(req, res, next) {
    if (!req.session || !req.session.authenticatedRole) {
      const loginUrl = role === 'admin' ? '/admin/login' : '/hausmeister/login';
      return res.redirect(loginUrl);
    }

    if (role === 'admin' && req.session.authenticatedRole !== 'admin') {
      return res.redirect('/admin/login');
    }

    if (role === 'caretaker' && !['caretaker', 'admin'].includes(req.session.authenticatedRole)) {
      return res.redirect('/hausmeister/login');
    }

    next();
  };
}

module.exports = {
  requireAuth
};
