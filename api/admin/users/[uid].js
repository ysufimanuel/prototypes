const { auth, db } = require("../../_lib/firebase-admin");
const { requireSuperAdmin } = require("../../_lib/auth");
const { applyCors } = require("../../_lib/cors");
const { checkRateLimit } = require("../../_lib/rate-limit");
const { safeApiError } = require("../../_lib/error-response");

const ALLOWED_ROLES = ["user", "admin", "superadmin"];

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (!["PATCH", "DELETE"].includes(req.method)) {
    return res.status(405).json({ success: false, message: "Method tidak diizinkan" });
  }
  if (!checkRateLimit(req, res)) return;

  const requester = await requireSuperAdmin(req, res);
  if (!requester) return;

  const uid = req.query.uid;
  if (!uid) {
    return res.status(400).json({ success: false, message: "UID user tidak ditemukan." });
  }

  try {
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ success: false, message: "User Firestore tidak ditemukan." });
    }

    const existingUser = userSnap.data();
    if (!existingUser.churchId || existingUser.churchId !== requester.churchId) {
      return res.status(403).json({ success: false, message: "Tidak memiliki akses ke user dari church tersebut." });
    }

    if (req.method === "DELETE") {
      if (requester.uid === uid) {
        return res.status(403).json({ success: false, message: "Tidak dapat menghapus akun diri sendiri." });
      }

      try {
        await auth.deleteUser(uid);
      } catch (error) {
        if (error.code !== "auth/user-not-found") throw error;
      }
      await userRef.delete();
      return res.status(200).json({ success: true, message: "User berhasil dihapus.", uid });
    }

    const { nama, username, email, role, password } = req.body || {};

    if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role tidak valid. Pilihan: ${ALLOWED_ROLES.join(", ")}`,
      });
    }

    if (requester.uid === uid && role !== undefined && role !== existingUser.role) {
      return res.status(403).json({
        success: false,
        message: "Super Admin tidak dapat mengubah role dirinya sendiri.",
      });
    }

    if (username && username !== existingUser.username) {
      const snap = await db.collection("users").where("username", "==", username).limit(1).get();
      if (snap.docs.some((doc) => doc.id !== uid)) {
        return res.status(409).json({ success: false, message: "Username sudah digunakan." });
      }
    }

    if (email && email !== existingUser.email) {
      const snap = await db.collection("users").where("email", "==", email).limit(1).get();
      if (snap.docs.some((doc) => doc.id !== uid)) {
        return res.status(409).json({ success: false, message: "Email sudah digunakan." });
      }
    }

    if (password !== undefined && password !== "" && String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Password minimal 6 karakter." });
    }

    const authUpdate = {};
    if (nama) authUpdate.displayName = nama;
    if (email) authUpdate.email = email;
    if (password) authUpdate.password = String(password);
    if (Object.keys(authUpdate).length) await auth.updateUser(uid, authUpdate);

    const updateData = {
      ...(nama ? { nama } : {}),
      ...(username ? { username } : {}),
      ...(email ? { email } : {}),
      ...(role !== undefined ? { role } : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: requester.uid,
    };

    await userRef.set(updateData, { merge: true });
    const verified = (await userRef.get()).data();

    return res.status(200).json({
      success: true,
      message: "User berhasil diperbarui.",
      user: { uid, ...verified },
    });
  } catch (error) {
    return safeApiError(res, error, "Gagal memproses user.", {
      allowed: {
        "auth/email-already-exists": 400,
        "auth/invalid-email": 400,
      },
      messages: {
        "auth/email-already-exists": "Email sudah digunakan.",
        "auth/invalid-email": "Format email tidak valid.",
      },
    });
  }
};
