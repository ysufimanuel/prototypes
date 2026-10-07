const { auth, db } = require("../_lib/firebase-admin");
const { requireSuperAdmin } = require("../_lib/auth");
const { applyCors } = require("../_lib/cors");

const ALLOWED_ROLES = ["user", "admin", "superadmin"];

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method tidak diizinkan" });

  const requester = await requireSuperAdmin(req, res);
  if (!requester) return;

  try {
    const { nama, username, email, password, role, churchId } = req.body || {};

    if (!nama || !username || !email || !password || !role) {
      return res.status(400).json({ success: false, message: "Data user belum lengkap." });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `Role tidak valid. Pilihan: ${ALLOWED_ROLES.join(", ")}` });
    }
    if (churchId && churchId !== requester.churchId) {
      return res.status(403).json({ success: false, message: "Tidak memiliki akses ke church tersebut." });
    }

    const duplicate = await db.collection("users").where("username", "==", username).limit(1).get();
    if (!duplicate.empty) {
      return res.status(409).json({ success: false, message: "Username sudah digunakan." });
    }

    const firebaseUser = await auth.createUser({ email, password, displayName: nama });
    const now = new Date().toISOString();
    const userData = {
      uid: firebaseUser.uid,
      nama,
      username,
      email,
      role,
      churchId: requester.churchId,
      createdAt: now,
      updatedAt: now,
      createdBy: requester.uid,
    };

    try {
      await db.collection("users").doc(firebaseUser.uid).set(userData);
    } catch (firestoreError) {
      try { await auth.deleteUser(firebaseUser.uid); } catch (_) {}
      throw firestoreError;
    }

    return res.status(201).json({ success: true, message: "User berhasil dibuat.", user: userData });
  } catch (error) {
    console.error("[ADMIN] CREATE USER ERROR:", error);
    const status = error.code === "auth/email-already-exists" ? 409 : 500;
    return res.status(status).json({ success: false, message: error.message || "Gagal membuat user." });
  }
};
