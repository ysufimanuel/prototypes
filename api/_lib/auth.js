const { auth, db } = require("./firebase-admin");

async function requireSuperAdmin(req, res) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({ success: false, message: "Token autentikasi tidak ditemukan" });
      return null;
    }

    const idToken = authHeader.substring(7).trim();
    if (!idToken) {
      res.status(401).json({ success: false, message: "Token autentikasi kosong" });
      return null;
    }

    const decoded = await auth.verifyIdToken(idToken);
    const userSnap = await db.collection("users").doc(decoded.uid).get();

    if (!userSnap.exists) {
      res.status(403).json({ success: false, message: "Profil user tidak ditemukan" });
      return null;
    }

    const userData = userSnap.data();

    if (userData.uid !== decoded.uid) {
      res.status(403).json({ success: false, message: "UID user tidak cocok" });
      return null;
    }

    if (userData.role !== "superadmin") {
      res.status(403).json({ success: false, message: "Akses hanya untuk Superadmin" });
      return null;
    }

    if (!userData.churchId) {
      res.status(403).json({ success: false, message: "User belum memiliki church" });
      return null;
    }

    return {
      uid: decoded.uid,
      email: decoded.email || null,
      role: userData.role,
      churchId: userData.churchId,
    };
  } catch (error) {
    console.error("[AUTH] Error:", error.message);
    res.status(401).json({ success: false, message: "Token tidak valid atau sudah expired" });
    return null;
  }
}

module.exports = { requireSuperAdmin };
