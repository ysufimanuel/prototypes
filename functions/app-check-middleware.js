const { getAppCheck } = require('firebase-admin/app-check');

function isAppCheckEnforced() {
  return String(process.env.APP_CHECK_ENFORCED || '').toLowerCase() === 'true';
}

function defaultVerifyAppCheckToken(token) {
  return getAppCheck().verifyToken(token);
}

function createAppCheckMiddleware({ verifyToken = defaultVerifyAppCheckToken } = {}) {
  return async function requireAppCheck(req, res, next) {
    if (!isAppCheckEnforced()) return next();

    const appCheckToken = req.get('X-Firebase-AppCheck');
    if (!appCheckToken) {
      return res.status(401).json({
        success: false,
        message: 'App Check diperlukan.',
      });
    }

    try {
      const claims = await verifyToken(appCheckToken);
      req.appCheck = claims;
      return next();
    } catch (error) {
      console.error('[APP CHECK] verification failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'App Check tidak valid.',
      });
    }
  };
}

const requireAppCheck = createAppCheckMiddleware();

module.exports = {
  createAppCheckMiddleware,
  requireAppCheck,
  isAppCheckEnforced,
};
