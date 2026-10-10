const express = require('express');
const { auth, db } = require('./firebase-admin');
const { requireSuperAdmin } = require('./auth-middleware');
const { sameChurch } = require('./tenant-access');

const router = express.Router();
const ALLOWED_ROLES = ['user', 'admin', 'superadmin'];

function validateRole(role) {
    return ALLOWED_ROLES.includes(role);
}

// CREATE USER
router.post('/create-user', requireSuperAdmin, async (req, res) => {
    try {
        const { nama, username, email, password, role, churchId } = req.body;

        if (!nama || !username || !email || !password || !role) {
            return res.status(400).json({ success: false, message: 'Data user belum lengkap.' });
        }
        if (!validateRole(role)) {
            return res.status(400).json({ success: false, message: `Role tidak valid. Pilihan: ${ALLOWED_ROLES.join(', ')}` });
        }

        const requesterChurchId = req.user.churchId;
        if (churchId && churchId !== requesterChurchId) {
            return res.status(403).json({ success: false, message: 'Tidak memiliki akses ke church tersebut.' });
        }

        const duplicate = await db.collection('users')
            .where('username', '==', username).limit(1).get();
        if (!duplicate.empty) {
            return res.status(409).json({ success: false, message: 'Username sudah digunakan.' });
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

        await db.collection('users').doc(firebaseUser.uid).set(userData);
        return res.status(201).json({ success: true, message: 'User berhasil dibuat.', user: userData });
    } catch (error) {
        console.error('[ADMIN] CREATE USER ERROR:', error);
        const status = error.code === 'auth/email-already-exists' ? 409 : 500;
        return res.status(status).json({ success: false, message: error.message || 'Gagal membuat user.' });
    }
});

// UPDATE USER - only requireSuperAdmin can reach this route, therefore only superadmin may change roles.
router.patch('/users/:uid', requireSuperAdmin, async (req, res) => {
    try {
        const { uid } = req.params;
        const { nama, username, email, role } = req.body;
        if (!uid) return res.status(400).json({ success: false, message: 'UID user tidak ditemukan.' });

        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) return res.status(404).json({ success: false, message: 'User Firestore tidak ditemukan.' });

        const existingUser = userSnap.data();
        if (!sameChurch(req.user, existingUser)) {
            return res.status(403).json({ success: false, message: 'Tidak memiliki akses ke user dari church tersebut.' });
        }

        const isSelf = req.user.uid === uid;
        if (role !== undefined && !validateRole(role)) {
            return res.status(400).json({ success: false, message: `Role tidak valid. Pilihan: ${ALLOWED_ROLES.join(', ')}` });
        }
        if (isSelf && role !== undefined && role !== existingUser.role) {
            return res.status(403).json({ success: false, message: 'Super Admin tidak dapat mengubah role dirinya sendiri.' });
        }

        if (username && username !== existingUser.username) {
            const usernameSnap = await db.collection('users').where('username', '==', username).limit(1).get();
            if (usernameSnap.docs.some(doc => doc.id !== uid)) {
                return res.status(409).json({ success: false, message: 'Username sudah digunakan.' });
            }
        }

        if (email && email !== existingUser.email) {
            const emailSnap = await db.collection('users').where('email', '==', email).limit(1).get();
            if (emailSnap.docs.some(doc => doc.id !== uid)) {
                return res.status(409).json({ success: false, message: 'Email sudah digunakan.' });
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
        return res.status(200).json({ success: true, message: 'User berhasil diperbarui.', user: { uid, ...verified } });
    } catch (error) {
        console.error('[ADMIN] PATCH USER ERROR:', error);
        const status = ['auth/email-already-exists', 'auth/invalid-email'].includes(error.code) ? 400 : 500;
        return res.status(status).json({ success: false, message: error.message || 'Gagal memperbarui user.' });
    }
});

// DELETE USER
router.delete('/users/:uid', requireSuperAdmin, async (req, res) => {
    try {
        const { uid } = req.params;
        if (!uid) return res.status(400).json({ success: false, message: 'UID user tidak ditemukan.' });
        if (req.user.uid === uid) return res.status(403).json({ success: false, message: 'Tidak dapat menghapus akun diri sendiri.' });

        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) return res.status(404).json({ success: false, message: 'User Firestore tidak ditemukan.' });
        if (!sameChurch(req.user, userSnap.data())) return res.status(403).json({ success: false, message: 'Tidak memiliki akses ke user dari church tersebut.' });

        try {
            await auth.deleteUser(uid);
        } catch (error) {
            if (error.code !== 'auth/user-not-found') throw error;
        }
        await userRef.delete();
        return res.status(200).json({ success: true, message: 'User berhasil dihapus.', uid });
    } catch (error) {
        console.error('[ADMIN] DELETE USER ERROR:', error);
        return res.status(500).json({ success: false, message: error.message || 'Gagal menghapus user.' });
    }
});

module.exports = router;
