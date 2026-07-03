/**
 * Auth System - Login, Register, Logout, Session Management
 * Menggunakan Firebase Authentication
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/core/config';
import { store } from '@/core/store';
import {
  setActiveChurch,
  getUserProfile,
  setUserProfile,
  createChurch,
  getUserByUsername,
} from '@/data/repositories/base.repository';
import { getChurch } from '@/data/repositories/base.repository';

// =========================================================
// LOGIN
// =========================================================

/**
 * Login dengan username atau email
 */
export async function loginUser(usernameOrEmail: string, password: string): Promise<boolean> {
  store.setLoading(true);

  try {
    let email = usernameOrEmail;

    // Jika bukan email, cari email dari username
    if (!usernameOrEmail.includes('@')) {
      const userData = await getUserByUsername(usernameOrEmail);
      if (!userData) {
        store.showToast('Username tidak ditemukan', 'error');
        store.setLoading(false);
        return false;
      }
      email = (userData as any).email;
    }

    // Firebase Auth login
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const { user } = credential;

    // Ambil profil lengkap dari Firestore
    const profile = await getUserProfile(user.uid);
    if (!profile) {
      store.showToast('Profil user tidak ditemukan', 'error');
      store.setLoading(false);
      return false;
    }

    // Set active church
    const churchId = (profile as any).churchId;
    if (churchId) {
      setActiveChurch(churchId);
      const church = await getChurch(churchId);
      const churchName = (church as any)?.nama || 'Gereja Digital';

      // Update store
      store.set({
        currentUser: { id: user.uid, ...(profile as any) },
        isAuthenticated: true,
        churchId,
        churchName,
      });
    }

    // Update last login
    await setUserProfile(user.uid, {
      lastLogin: new Date().toISOString(),
    });

    store.showToast('Login berhasil!', 'success');
    store.setLoading(false);
    return true;
  } catch (error: any) {
    console.error('[AUTH] Login error:', error.code);
    let message = 'Login gagal';
    if (error.code === 'auth/user-not-found') message = 'User tidak ditemukan';
    if (error.code === 'auth/wrong-password') message = 'Password salah';
    if (error.code === 'auth/invalid-credential') message = 'Email/username atau password salah';
    if (error.code === 'auth/too-many-requests') message = 'Terlalu banyak percobaan. Coba lagi nanti.';
    store.showToast(message, 'error');
    store.setLoading(false);
    return false;
  }
}

// =========================================================
// REGISTER CHURCH (New Church Registration)
// =========================================================

/**
 * Register gereja baru dengan admin
 */
export async function registerChurch(
  churchData: {
    nama: string;
    alamat: string;
    kota: string;
    telepon?: string;
    email?: string;
  },
  adminData: {
    nama: string;
    username: string;
    email: string;
    password: string;
  }
): Promise<boolean> {
  store.setLoading(true);

  try {
    // 1. Buat akun Firebase Auth
    const credential = await createUserWithEmailAndPassword(auth, adminData.email, adminData.password);
    const uid = credential.user.uid;

    // 2. Buat church document
    const churchId = await createChurch({
      ...churchData,
      superadminUid: uid,
    });

    if (!churchId) {
      throw new Error('Gagal membuat data gereja');
    }

    // 3. Simpan profil user
    const profile = {
      uid,
      email: adminData.email,
      nama: adminData.nama,
      username: adminData.username || adminData.email.split('@')[0],
      role: 'superadmin' as const,
      churchId,
      status: 'aktif' as const,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };

    await setUserProfile(uid, profile);

    // 4. Set active church dan login
    setActiveChurch(churchId);
    store.set({
      currentUser: { id: uid, ...profile },
      isAuthenticated: true,
      churchId,
      churchName: churchData.nama,
    });

    store.showToast('Gereja berhasil didaftarkan!', 'success');
    store.setLoading(false);
    return true;
  } catch (error: any) {
    console.error('[AUTH] Register error:', error.code);
    let message = 'Registrasi gagal';
    if (error.code === 'auth/email-already-in-use') message = 'Email sudah terdaftar';
    if (error.code === 'auth/weak-password') message = 'Password minimal 6 karakter';
    if (error.code === 'auth/invalid-email') message = 'Format email tidak valid';
    store.showToast(message, 'error');
    store.setLoading(false);
    return false;
  }
}

// =========================================================
// CREATE USER (Admin only)
// =========================================================

/**
 * Buat user baru untuk gereja (oleh admin/superadmin)
 */
export async function createChurchUser(userData: {
  nama: string;
  username: string;
  email: string;
  password: string;
  role: string;
}): Promise<boolean> {
  store.setLoading(true);

  try {
    const churchId = store.get(s => s.churchId);
    if (!churchId) {
      store.showToast('Church ID tidak ditemukan', 'error');
      store.setLoading(false);
      return false;
    }

    // Buat akun Firebase Auth
    const credential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);

    const profile = {
      uid: credential.user.uid,
      email: userData.email,
      nama: userData.nama,
      username: userData.username || userData.email.split('@')[0],
      role: userData.role || 'user',
      churchId,
      status: 'aktif',
      createdAt: new Date().toISOString(),
      lastLogin: null,
    };

    await setUserProfile(credential.user.uid, profile);

    store.showToast('User berhasil dibuat!', 'success');
    store.setLoading(false);
    return true;
  } catch (error: any) {
    console.error('[AUTH] Create user error:', error.code);
    let message = 'Gagal membuat user';
    if (error.code === 'auth/email-already-in-use') message = 'Email sudah terdaftar';
    if (error.code === 'auth/weak-password') message = 'Password minimal 6 karakter';
    store.showToast(message, 'error');
    store.setLoading(false);
    return false;
  }
}

// =========================================================
// LOGOUT
// =========================================================

/**
 * Logout user
 */
export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
    setActiveChurch(null);
    store.reset();
    store.showToast('Logout berhasil', 'info');
  } catch (error) {
    console.error('[AUTH] Logout error:', error);
    store.showToast('Gagal logout', 'error');
  }
}

// =========================================================
// PASSWORD RESET
// =========================================================

/**
 * Kirim email reset password
 */
export async function resetPassword(email: string): Promise<boolean> {
  try {
    await sendPasswordResetEmail(auth, email);
    store.showToast('Email reset password telah dikirim', 'success');
    return true;
  } catch (error: any) {
    console.error('[AUTH] Reset password error:', error.code);
    let message = 'Gagal mengirim email reset';
    if (error.code === 'auth/user-not-found') message = 'Email tidak ditemukan';
    store.showToast(message, 'error');
    return false;
  }
}

// =========================================================
// AUTH STATE LISTENER
// =========================================================

/**
 * Listen ke perubahan auth state (session restore)
 */
export function initAuthListener(): () => void {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      // Restore session
      const profile = await getUserProfile(firebaseUser.uid);
      if (profile) {
        const churchId = (profile as any).churchId;
        if (churchId) {
          setActiveChurch(churchId);
          const church = await getChurch(churchId);
          store.set({
            currentUser: { id: firebaseUser.uid, ...(profile as any) },
            isAuthenticated: true,
            churchId,
            churchName: (church as any)?.nama || 'Gereja Digital',
          });
        }
      }
    } else {
      // User logged out
      store.reset();
    }
  });
}

// =========================================================
// UTILS
// =========================================================

/**
 * Cek apakah user sudah login
 */
export function isLoggedIn(): boolean {
  return store.get(s => s.isAuthenticated);
}

/**
 * Get current user
 */
export function getCurrentUser() {
  return store.get(s => s.currentUser);
}
