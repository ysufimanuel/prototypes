const { auth, db } = require("../../_lib/firebase-admin");
const { requireSuperAdmin } = require("../../_lib/auth");

const ALLOWED_ROLES = ["user", "admin", "superadmin"];

function sameChurch(requester, user) {
  return requester.churchId === user.churchId;
}

module.exports = async function handler(req, res) {
  const requester = await requireSuperAdmin(req, res);
  if (!requester) return;

  const uid = req.query.uid;
  if (!uid) return res.status(400).json({ success: false, message: "UID user tidak ditemukan." });

  try {
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ success: false, message: "User Firestore tidak ditemukan." });
    }

    const existingUser = userSnap.data();
    if (!sameChurch(requester, existingUser)) {
      return res.status(403).json({ success: false, message: "Tidak memiliki akses ke user dari church tersebut." });
    }

    if (req.method === "PATCH") {
      const { nama, username, email, role } = req.body || {};

      if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Role tidak valid. Pilihan: ${ALLOWED_ROLES.join(", ")}`,
        });
      }
      if (requester.uid === uid && role !== undefined && role !== existingUser.role) {
        return res.status(403).json({ success: false, message: "Super Admin tidak dapat mengubah role dirinya sendiri." });
      }

      if (username && username !== existingUser.username) {
        const usernameSnap = await db.collection("users").where("username", "==", username).limit(1).get();
        if (usernameSnap.docs.some(doc => doc.id !== uid)) {
          return res.status(409).json({ success: false, message: "Username sudah digunakan." });
        }
      }

      if (email && email !== existingUser.email) {
        const emailSnap = await db.collection("users").where("email", "==", email).limit(1).get();
        if (emailSnap.docs.some(doc => doc.id !== uid)) {
          return res.status(409).json({ success: false, message: "Email sudah digunakan." });
        }
      }

      const authUpdate = {};
      if (nama) authUpdate.displayName = nama;
      if (email) authUpdate.email = email;
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
      return res.status(200).json({ success: true, message: "User berhasil diperbarui.", user: { uid, ...verified } });
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

    return res.status(405).json({ success: false, message: "Method tidak diizinkan." });
  } catch (error) {
    console.error("[ADMIN] USER ERROR:", error);
    const status = ["auth/email-already-exists", "auth/invalid-email"].includes(error.code) ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message || "Gagal memproses user." });
  }
};
