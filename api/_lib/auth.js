const { auth, db } = require("./firebase-admin");

async function requireSuperAdmin(req, res) {
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

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch (error) {
    console.error("[AUTH] verifyIdToken gagal:", {
      name: error?.name || null,
      code: error?.code || null,
      message: error?.message || "Unknown auth error",
      details: error?.details || null,
    });

    res.status(401).json({
      success: false,
      message: `Verifikasi ID token gagal (${error?.code || "unknown"}).`,
    });
    return null;
  }

  let userSnap;
  try {
    userSnap = await db.collection("users").doc(decoded.uid).get();
  } catch (error) {
    console.error("[AUTH] Firestore users lookup gagal:", {
      name: error?.name || null,
      code: error?.code || null,
      message: error?.message || "Unknown Firestore error",
      details: error?.details || null,
    });

    res.status(500).json({
      success: false,
      message: `Backend gagal mengakses Firestore (${error?.code || "unknown"}).`,
    });
    return null;
  }

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
}

module.exports = { requireSuperAdmin };
