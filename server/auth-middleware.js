const {
  verifyFirebaseIdToken
} = require('./firebase-token-verifier');

const { db } = require('./firebase-admin');

async function requireSuperAdmin(req, res, next) {
  try {
    const authHeader =
      req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token autentikasi tidak ditemukan'
      });
    }

    const idToken =
      authHeader.substring(7).trim();

    if (!idToken) {
      return res.status(401).json({
        success: false,
        message: 'Token autentikasi kosong'
      });
    }

    console.log('[AUTH] STEP 1 - mulai verify token');

    const decoded =
      await verifyFirebaseIdToken(idToken);

    console.log(
      '[AUTH] STEP 1 OK - UID:',
      decoded.sub
    );

    console.log(
      '[AUTH] STEP 2 - mulai Firestore lookup'
    );

    const userSnap = await db
      .collection('users')
      .doc(decoded.sub)
      .get();

    console.log(
      '[AUTH] STEP 2 OK - exists:',
      userSnap.exists
    );

    if (!userSnap.exists) {
      return res.status(403).json({
        success: false,
        message: 'Profil user tidak ditemukan'
      });
    }

    const userData = userSnap.data();

    if (userData.uid !== decoded.sub) {
      return res.status(403).json({
        success: false,
        message: 'UID user tidak cocok'
      });
    }

    if (userData.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Akses hanya untuk Superadmin'
      });
    }

    if (!userData.churchId) {
      return res.status(403).json({
        success: false,
        message: 'User belum memiliki church'
      });
    }

    req.user = {
      uid: decoded.sub,
      email: decoded.email || null,
      role: userData.role,
      churchId: userData.churchId
    };

    next();

  } catch (error) {
    console.error(
      'Auth middleware error:',
      error.message
    );

    return res.status(401).json({
      success: false,
      message: 'Token tidak valid atau sudah expired'
    });
  }
}

module.exports = {
  requireSuperAdmin
};