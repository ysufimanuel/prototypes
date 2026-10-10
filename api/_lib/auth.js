const { auth, db } = require("./firebase-admin");
const { requireAppCheck } = require("./app-check");

async function getAuthenticatedUser(req, res) {
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
    });
    res.status(401).json({ success: false, message: "Token autentikasi tidak valid atau sudah kedaluwarsa." });
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
    });
    res.status(500).json({ success: false, message: "Backend gagal memverifikasi profil pengguna." });
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

  return {
    uid: decoded.uid,
    email: decoded.email || null,
    role: userData.role,
    churchId: userData.churchId,
  };
}

async function requireChurchAdmin(req, res) {
  if (!(await requireAppCheck(req, res))) return null;
  const user = await getAuthenticatedUser(req, res);
  if (!user) return null;
  if (!["admin", "superadmin"].includes(user.role)) {
    res.status(403).json({ success: false, message: "Akses hanya untuk Admin atau Superadmin" });
    return null;
  }
  if (!user.churchId) {
    res.status(403).json({ success: false, message: "User belum memiliki church" });
    return null;
  }
  return user;
}

async function requireSuperAdmin(req, res) {
  if (!(await requireAppCheck(req, res))) return null;
  const user = await getAuthenticatedUser(req, res);
  if (!user) return null;
  if (user.role !== "superadmin") {
    res.status(403).json({ success: false, message: "Akses hanya untuk Superadmin" });
    return null;
  }
  if (!user.churchId) {
    res.status(403).json({ success: false, message: "User belum memiliki church" });
    return null;
  }
  return user;
}

module.exports = { requireSuperAdmin, requireChurchAdmin };
