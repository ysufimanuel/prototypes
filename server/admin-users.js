const express = require('express');
const { auth, db } = require('./firebase-admin');
const { requireSuperAdmin } = require('./auth-middleware');

const router = express.Router();


// =====================================================
// CREATE USER
// POST /api/admin/create-user
// =====================================================

router.post('/create-user', requireSuperAdmin, async (req, res) => {
  try {
    const {
      nama,
      username,
      email,
      password,
      role
    } = req.body;

    // ---------------------------------------------
    // VALIDASI INPUT
    // ---------------------------------------------

    if (!nama || !username || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Nama, username, email, password, dan role wajib diisi'
      });
    }

    const allowedRoles = ['user', 'admin', 'superadmin'];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role tidak valid'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password minimal 6 karakter'
      });
    }

    // ---------------------------------------------
    // CEK USERNAME
    // ---------------------------------------------

    const usernameSnap = await db
      .collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (!usernameSnap.empty) {
      return res.status(409).json({
        success: false,
        message: 'Username sudah digunakan'
      });
    }

    // ---------------------------------------------
    // BUAT FIREBASE AUTH USER
    // ---------------------------------------------

    const newAuthUser = await auth.createUser({
      email,
      password,
      displayName: nama
    });

    const newUid = newAuthUser.uid;

    // ---------------------------------------------
    // BUAT PROFILE FIRESTORE
    // CHURCH ID DIAMBIL DARI SUPERADMIN
    // ---------------------------------------------

    const now = new Date().toISOString();

    await db
      .collection('users')
      .doc(newUid)
      .set({
        uid: newUid,
        nama,
        username,
        email,
        role,
        status: 'aktif',
        churchId: req.user.churchId,
        createdAt: now,
        updatedAt: now
      });

    return res.status(201).json({
      success: true,
      message: 'User berhasil dibuat',
      user: {
        uid: newUid,
        nama,
        username,
        email,
        role,
        status: 'aktif',
        churchId: req.user.churchId
      }
    });

  } catch (error) {

    console.error('Create user error:', error);

    // ---------------------------------------------
    // JIKA FIREBASE AUTH BERHASIL DIBUAT
    // TAPI FIRESTORE GAGAL
    // HAPUS AUTH USER AGAR TIDAK JADI USER YATIM
    // ---------------------------------------------

    if (error.uid) {
      try {
        await auth.deleteUser(error.uid);
      } catch (cleanupError) {
        console.error('Cleanup Auth user gagal:', cleanupError);
      }
    }

    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({
        success: false,
        message: 'Email sudah digunakan'
      });
    }

    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({
        success: false,
        message: 'Format email tidak valid'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Gagal membuat user'
    });
  }
});


module.exports = router;