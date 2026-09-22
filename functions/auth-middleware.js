const { verifyFirebaseIdToken } = require("./firebase-token-verifier");

const { db } = require("./firebase-admin");

// =====================================================
// SUPER ADMIN AUTH MIDDLEWARE
// =====================================================

async function requireSuperAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Token autentikasi tidak ditemukan",
      });
    }

    const idToken = authHeader.substring(7).trim();

    if (!idToken) {
      return res.status(401).json({
        success: false,
        message: "Token autentikasi kosong",
      });
    }

    const decoded = await verifyFirebaseIdToken(idToken);

    const userSnap = await db.collection("users").doc(decoded.uid).get();

    if (!userSnap.exists) {
      return res.status(403).json({
        success: false,
        message: "Profil user tidak ditemukan",
      });
    }

    const userData = userSnap.data();

    if (userData.uid !== decoded.uid) {
      return res.status(403).json({
        success: false,
        message: "UID user tidak cocok",
      });
    }

    if (userData.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Akses hanya untuk Superadmin",
      });
    }

    if (!userData.churchId) {
      return res.status(403).json({
        success: false,
        message: "User belum memiliki church",
      });
    }

    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      role: userData.role,
      churchId: userData.churchId,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error", { message: error.message });

    return res.status(401).json({
      success: false,
      message: "Token tidak valid atau sudah expired",
    });
  }
}

// =====================================================
// EXPORT
// =====================================================

module.exports = {
  requireSuperAdmin,
};
