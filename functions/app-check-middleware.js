const { getAppCheck } = require('firebase-admin/app-check');

function isAppCheckEnforced() {
  return String(process.env.APP_CHECK_ENFORCED || '').toLowerCase() === 'true';
}

async function requireAppCheck(req, res, next) {
  if (!isAppCheckEnforced()) return next();

  const appCheckToken = req.get('X-Firebase-AppCheck');
  if (!appCheckToken) {
    return res.status(401).json({
      success: false,
      message: 'App Check diperlukan.',
    });
  }

  try {
    const claims = await getAppCheck().verifyToken(appCheckToken);
    req.appCheck = claims;
    return next();
  } catch (error) {
    console.error('[APP CHECK] verification failed:', error.message);
    return res.status(401).json({
      success: false,
      message: 'App Check tidak valid.',
    });
  }
}

module.exports = { requireAppCheck, isAppCheckEnforced };
