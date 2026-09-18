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
            role,
            churchId
        } = req.body;

        if (!nama || !username || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: 'Data user belum lengkap.'
            });
        }

        const allowedRoles = ['user', 'admin', 'superadmin'];

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Role tidak valid.'
            });
        }

        // Jangan izinkan requester membuat user di church lain
        const requesterChurchId = req.user?.churchId;

        if (
            requesterChurchId &&
            churchId &&
            requesterChurchId !== churchId
        ) {
            return res.status(403).json({
                success: false,
                message: 'Tidak memiliki akses ke church tersebut.'
            });
        }

        const finalChurchId = requesterChurchId || churchId;

        // Cek username
        const usernameSnap = await db
            .collection('users')
            .where('username', '==', username)
            .limit(1)
            .get();

        if (!usernameSnap.empty) {
            return res.status(409).json({
                success: false,
                message: 'Username sudah digunakan.'
            });
        }

        // Create Firebase Auth user
        const firebaseUser = await auth.createUser({
            email,
            password,
            displayName: nama
        });

        const now = new Date().toISOString();

        const userData = {
            uid: firebaseUser.uid,
            nama,
            username,
            email,
            role,
            churchId: finalChurchId || null,
            createdAt: now,
            updatedAt: now
        };

        await db
            .collection('users')
            .doc(firebaseUser.uid)
            .set(userData);

        console.log(
            `[ADMIN] CREATE USER OK: ${firebaseUser.uid} | role=${role}`
        );

        return res.status(201).json({
            success: true,
            message: 'User berhasil dibuat.',
            user: userData
        });

    } catch (error) {
        console.error('[ADMIN] CREATE USER ERROR:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Gagal membuat user.'
        });
    }
});


// =====================================================
// UPDATE USER
// PATCH /api/admin/users/:uid
// =====================================================

router.patch('/users/:uid', requireSuperAdmin, async (req, res) => {
    try {
        const { uid } = req.params;

        const {
            nama,
            username,
            email,
            role
        } = req.body;

        console.log(
            `[ADMIN] PATCH USER REQUEST: uid=${uid}`,
            req.body
        );

        if (!uid || !nama || !username || !email || !role) {
            return res.status(400).json({
                success: false,
                message: 'Data user belum lengkap.'
            });
        }

        const allowedRoles = ['user', 'admin', 'superadmin'];

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: `Role tidak valid: ${role}`
            });
        }

        const userRef = db.collection('users').doc(uid);

        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            return res.status(404).json({
                success: false,
                message: 'User Firestore tidak ditemukan.'
            });
        }

        const existingUser = userSnap.data();
        // =========================================
        // CEGAH SUPERADMIN MENGUBAH ROLE DIRI SENDIRI
        // =========================================

        const isSelf = req.user?.uid === uid;
        const isChangingRole = role !== existingUser.role;

        if (
            isSelf &&
            isChangingRole
        ) {
            return res.status(403).json({
                success: false,
                message: 'Super Admin tidak dapat mengubah role dirinya sendiri.'
            });
        }


        // Pastikan superadmin hanya mengubah user di church yang sama
        if (
            req.user?.churchId &&
            existingUser.churchId &&
            req.user.churchId !== existingUser.churchId
        ) {
            return res.status(403).json({
                success: false,
                message: 'Tidak memiliki akses ke user dari church tersebut.'
            });
        }

        // Cek username kalau berubah
        if (username !== existingUser.username) {
            const usernameSnap = await db
                .collection('users')
                .where('username', '==', username)
                .limit(1)
                .get();

            const usernameTaken = usernameSnap.docs.some(
                doc => doc.id !== uid
            );

            if (usernameTaken) {
                return res.status(409).json({
                    success: false,
                    message: 'Username sudah digunakan.'
                });
            }
        }

        // Update Firebase Auth
        await auth.updateUser(uid, {
            displayName: nama,
            email
        });

        const now = new Date().toISOString();

        const updateData = {
            nama,
            username,
            email,
            role,
            updatedAt: now
        };

        // PAKSA update Firestore
        await userRef.set(
            updateData,
            { merge: true }
        );

        // Baca ulang dari Firestore untuk memastikan benar-benar tersimpan
        const verifySnap = await userRef.get();

        if (!verifySnap.exists) {
            throw new Error(
                'User hilang setelah update Firestore.'
            );
        }

        const verifiedUser = verifySnap.data();

        console.log(
            `[ADMIN] PATCH USER OK: ${uid} | role=${verifiedUser.role}`
        );

        return res.status(200).json({
            success: true,
            message: 'User berhasil diperbarui.',
            user: {
                uid,
                ...verifiedUser
            }
        });

    } catch (error) {
        console.error('[ADMIN] PATCH USER ERROR:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Gagal memperbarui user.'
        });
    }
});


// =====================================================
// DELETE USER
// DELETE /api/admin/users/:uid
// =====================================================

router.delete('/users/:uid', requireSuperAdmin, async (req, res) => {
    try {
        const { uid } = req.params;

        console.log(
            `[ADMIN] DELETE USER REQUEST: uid=${uid}`
        );

        if (!uid) {
            return res.status(400).json({
                success: false,
                message: 'UID user tidak ditemukan.'
            });
        }

        const userRef = db.collection('users').doc(uid);

        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            return res.status(404).json({
                success: false,
                message: 'User Firestore tidak ditemukan.'
            });
        }

        const existingUser = userSnap.data();

        // Pastikan masih satu church
        if (
            req.user?.churchId &&
            existingUser.churchId &&
            req.user.churchId !== existingUser.churchId
        ) {
            return res.status(403).json({
                success: false,
                message: 'Tidak memiliki akses ke user dari church tersebut.'
            });
        }

        // Hapus Firebase Authentication
        try {
            await auth.deleteUser(uid);

            console.log(
                `[ADMIN] AUTH DELETE OK: ${uid}`
            );

        } catch (authError) {

            // Kalau user Auth sudah tidak ada,
            // tetap lanjut hapus Firestore.
            if (authError.code === 'auth/user-not-found') {
                console.log(
                    `[ADMIN] AUTH USER SUDAH TIDAK ADA: ${uid}`
                );
            } else {
                throw authError;
            }
        }

        // Hapus Firestore profile
        await userRef.delete();

        console.log(
            `[ADMIN] FIRESTORE DELETE OK: ${uid}`
        );

        return res.status(200).json({
            success: true,
            message: 'User berhasil dihapus.',
            uid
        });

    } catch (error) {
        console.error('[ADMIN] DELETE USER ERROR:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Gagal menghapus user.'
        });
    }
});


module.exports = router;