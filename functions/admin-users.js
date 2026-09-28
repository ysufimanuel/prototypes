const express = require("express");
const { auth, db } = require("./firebase-admin");
const { requireSuperAdmin } = require("./auth-middleware");

const router = express.Router();
const ALLOWED_ROLES = ["user", "admin", "superadmin"];

function validateRole(role) {
  return ALLOWED_ROLES.includes(role);
}

function sameChurch(req, user) {
  // A missing churchId must never grant access. User-management operations
  // are tenant-scoped and must match the authenticated superadmin exactly.
  return Boolean(
    req.user?.churchId &&
      user?.churchId &&
      req.user.churchId === user.churchId,
  );
}

function roleError() {
  return `Role tidak valid. Pilihan: ${ALLOWED_ROLES.join(", ")}`;
}

// CREATE USER
// Only a superadmin may create accounts, including accounts with admin or
// superadmin privileges. The requested church is always forced to the
// authenticated superadmin's church.
router.post("/create-user", requireSuperAdmin, async (req, res) => {
  try {
    const { nama, username, email, password, role, churchId } = req.body;

    if (!nama || !username || !email || !password || !role) {
      return res
        .status(400)
        .json({ success: false, message: "Data user belum lengkap." });
    }
    if (!validateRole(role)) {
      return res.status(400).json({ success: false, message: roleError() });
    }

    const requesterChurchId = req.user.churchId;
    if (churchId && churchId !== requesterChurchId) {
      return res.status(403).json({
        success: false,
        message: "Tidak memiliki akses ke church tersebut.",
      });
    }

    const duplicate = await db
      .collection("users")
      .where("username", "==", username)
      .limit(1)
      .get();
    if (!duplicate.empty) {
      return res
        .status(409)
        .json({ success: false, message: "Username sudah digunakan." });
    }

    const firebaseUser = await auth.createUser({ email, password, displayName: nama });
    const now = new Date().toISOString();
    const userData = {
      uid: firebaseUser.uid,
      nama,
      username,
      email,
      role,
      churchId: requesterChurchId,
      createdAt: now,
      updatedAt: now,
      createdBy: req.user.uid,
    };

    await db.collection("users").doc(firebaseUser.uid).set(userData);
    return res.status(201).json({
      success: true,
      message: "User berhasil dibuat.",
      user: userData,
    });
  } catch (error) {
    console.error("[ADMIN] CREATE USER ERROR:", error);
    const status = error.code === "auth/email-already-exists" ? 409 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Gagal membuat user.",
    });
  }
});

// UPDATE USER
// This endpoint is intentionally protected as a whole: only a superadmin
// can edit users, and therefore only a superadmin can change roles.
router.patch("/users/:uid", requireSuperAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const { nama, username, email, role } = req.body;
    if (!uid) {
      return res
        .status(400)
        .json({ success: false, message: "UID user tidak ditemukan." });
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res
        .status(404)
        .json({ success: false, message: "User Firestore tidak ditemukan." });
    }

    const existingUser = userSnap.data();
    if (!sameChurch(req, existingUser)) {
      return res.status(403).json({
        success: false,
        message: "Tidak memiliki akses ke user dari church tersebut.",
      });
    }

    const isSelf = req.user.uid === uid;
    if (role !== undefined && !validateRole(role)) {
      return res.status(400).json({ success: false, message: roleError() });
    }
    // A superadmin may change admin <-> user/superadmin, but cannot remove
    // their own last administrative identity by changing their own role.
    if (isSelf && role !== undefined && role !== existingUser.role) {
      return res.status(403).json({
        success: false,
        message: "Super Admin tidak dapat mengubah role dirinya sendiri.",
      });
    }

    if (username && username !== existingUser.username) {
      const usernameSnap = await db
        .collection("users")
        .where("username", "==", username)
        .limit(1)
        .get();
      if (usernameSnap.docs.some((doc) => doc.id !== uid)) {
        return res
          .status(409)
          .json({ success: false, message: "Username sudah digunakan." });
      }
    }

    if (email && email !== existingUser.email) {
      const emailSnap = await db
        .collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();
      if (emailSnap.docs.some((doc) => doc.id !== uid)) {
        return res
          .status(409)
          .json({ success: false, message: "Email sudah digunakan." });
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
      updatedBy: req.user.uid,
    };
    await userRef.set(updateData, { merge: true });
    const verified = (await userRef.get()).data();
    return res.status(200).json({
      success: true,
      message: "User berhasil diperbarui.",
      user: { uid, ...verified },
    });
  } catch (error) {
    console.error("[ADMIN] PATCH USER ERROR:", error);
    const status = ["auth/email-already-exists", "auth/invalid-email"].includes(
      error.code,
    )
      ? 400
      : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Gagal memperbarui user.",
    });
  }
});

// DELETE USER
router.delete("/users/:uid", requireSuperAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    if (!uid) {
      return res
        .status(400)
        .json({ success: false, message: "UID user tidak ditemukan." });
    }
    if (req.user.uid === uid) {
      return res.status(403).json({
        success: false,
        message: "Tidak dapat menghapus akun diri sendiri.",
      });
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res
        .status(404)
        .json({ success: false, message: "User Firestore tidak ditemukan." });
    }
    if (!sameChurch(req, userSnap.data())) {
      return res.status(403).json({
        success: false,
        message: "Tidak memiliki akses ke user dari church tersebut.",
      });
    }

    try {
      await auth.deleteUser(uid);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }
    await userRef.delete();
    return res
      .status(200)
      .json({ success: true, message: "User berhasil dihapus.", uid });
  } catch (error) {
    console.error("[ADMIN] DELETE USER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal menghapus user.",
    });
  }
});

module.exports = router;
