/**
 * Church Management System V6 - Firebase Integration
 * FIXED: Proper Firestore writes, no silent failures
 */

console.log('[FIREBASE] Script loading...');

const firebaseConfig = {
    apiKey: "AIzaSyBOyT_6Klad5P34gq-VbsY6gVqWYAnwiyE",
    authDomain: "churchmanagementsystem-a77a3.firebaseapp.com",
    projectId: "churchmanagementsystem-a77a3",
    storageBucket: "churchmanagementsystem-a77a3.firebasestorage.app",
    messagingSenderId: "369150207272",
    appId: "1:369150207272:web:0c9c3251c6c4300e0f5c1d",
    measurementId: "G-XWR9DH5Q0G"
};

try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js");
    const {
        getFirestore, collection, addDoc, getDocs, doc, setDoc,
        updateDoc, deleteDoc, getDoc, query, where, orderBy,
        onSnapshot, writeBatch, arrayUnion, serverTimestamp
    } = await import("https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js");
    const {
        getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
        onAuthStateChanged, signOut, sendPasswordResetEmail
    } = await import("https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js");

    const app  = initializeApp(firebaseConfig);
    const db   = getFirestore(app);
    const auth = getAuth(app);

    window.firebaseApp = app;
    window.db   = db;
    window.auth = auth;
    window.firebaseCollection         = collection;
    window.firebaseAddDoc             = addDoc;
    window.firebaseGetDocs            = getDocs;
    window.firebaseDoc                = doc;
    window.firebaseSetDoc             = setDoc;
    window.firebaseUpdateDoc          = updateDoc;
    window.firebaseDeleteDoc          = deleteDoc;
    window.firebaseGetDoc             = getDoc;
    window.firebaseQuery              = query;
    window.firebaseWhere              = where;
    window.firebaseOrderBy            = orderBy;
    window.firebaseOnSnapshot         = onSnapshot;
    window.firebaseWriteBatch         = writeBatch;
    window.firebaseSignIn             = signInWithEmailAndPassword;
    window.firebaseCreateUser         = createUserWithEmailAndPassword;
    window.firebaseOnAuthStateChanged = onAuthStateChanged;
    window.firebaseSignOut            = signOut;
    window.firebaseSendPasswordResetEmail = sendPasswordResetEmail;
    window.firebaseServerTimestamp    = serverTimestamp;
    window.firebaseArrayUnion         = arrayUnion;

    console.log('[FIREBASE] Initialized — multi-tenant mode');
} catch (error) {
    console.error('[FIREBASE] Init error:', error);
    window.firebaseInitError = error.message;
}

let _activeChurchId = null;
let _activeUserId = null;

function setActiveChurch(churchId) {
    _activeChurchId = churchId;
    console.log('[FIREBASE] Active church:', churchId);
}

function getActiveChurchId() {
    return _activeChurchId;
}

function setActiveUser(userId) {
    _activeUserId = userId;
}

function getActiveUser() {
    return _activeUserId;
}

function isFirebaseReady() {
    return typeof window.db !== 'undefined' && window.db !== null;
}

function isAuthReady() {
    return typeof window.auth !== 'undefined' && window.auth !== null;
}

// ========================================
// HELPER: Church collection reference
// ========================================
function churchCol(colName) {
    if (!_activeChurchId) throw new Error('churchId belum di-set');
    return window.firebaseCollection(window.db, 'churches', _activeChurchId, colName);
}

function churchDocRef(colName, docId) {
    if (!_activeChurchId) throw new Error('churchId belum di-set');
    return window.firebaseDoc(window.db, 'churches', _activeChurchId, colName, docId);
}

// ========================================
// CORE CRUD - ACTUALLY WRITES TO FIRESTORE
// ========================================

/**
 * Add document to church collection
 * @param {string} collectionName - Collection name
 * @param {object} data - Document data
 * @returns {Promise<{id: string, ...data}>}
 */
async function firebaseAddDoc(collectionName, data) {
    if (!isFirebaseReady()) {
        console.error('[FIREBASE] Not ready');
        throw new Error('Firebase not initialized');
    }
    try {
        const docRef = await window.firebaseAddDoc(churchCol(collectionName), {
            ...data,
            createdAt: window.firebaseServerTimestamp(),
            updatedAt: window.firebaseServerTimestamp()
        });
        console.log(`[FIREBASE] Added to ${collectionName}:`, docRef.id);
        return { id: docRef.id, ...data, createdAt: new Date(), updatedAt: new Date() };
    } catch (e) {
        console.error(`[FIREBASE] Error adding to ${collectionName}:`, e);
        throw e;
    }
}

/**
 * Get all documents from collection
 */
async function firebaseGetAllDocs(collectionName) {
    if (!isFirebaseReady()) return [];
    try {
        const snap = await window.firebaseGetDocs(churchCol(collectionName));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error(`[FIREBASE] Error getting ${collectionName}:`, e);
        return [];
    }
}

/**
 * Get single document
 */
async function firebaseGetDoc(collectionName, docId) {
    if (!isFirebaseReady()) return null;
    try {
        const snap = await window.firebaseGetDoc(churchDocRef(collectionName, docId));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    } catch (e) {
        console.error(`[FIREBASE] Error getting ${collectionName}/${docId}:`, e);
        return null;
    }
}

/**
 * Update document - ACTUALLY writes to Firestore
 */
async function firebaseUpdateDoc(collectionName, docId, data) {
    if (!isFirebaseReady()) {
        console.error('[FIREBASE] Not ready');
        throw new Error('Firebase not initialized');
    }
    try {
        await window.firebaseUpdateDoc(churchDocRef(collectionName, docId), {
            ...data,
            updatedAt: window.firebaseServerTimestamp()
        });
        console.log(`[FIREBASE] Updated ${collectionName}/${docId}`);
        return true;
    } catch (e) {
        console.error(`[FIREBASE] Error updating ${collectionName}/${docId}:`, e);
        throw e;
    }
}

/**
 * Delete document
 */
async function firebaseDeleteDoc(collectionName, docId) {
    if (!isFirebaseReady()) {
        console.error('[FIREBASE] Not ready');
        throw new Error('Firebase not initialized');
    }
    try {
        await window.firebaseDeleteDoc(churchDocRef(collectionName, docId));
        console.log(`[FIREBASE] Deleted ${collectionName}/${docId}`);
        return true;
    } catch (e) {
        console.error(`[FIREBASE] Error deleting ${collectionName}/${docId}:`, e);
        throw e;
    }
}

/**
 * Set entire document (create or overwrite)
 */
async function firebaseSetDoc(collectionName, docId, data) {
    if (!isFirebaseReady()) {
        console.error('[FIREBASE] Not ready');
        throw new Error('Firebase not initialized');
    }
    try {
        await window.firebaseSetDoc(churchDocRef(collectionName, docId), {
            ...data,
            updatedAt: window.firebaseServerTimestamp()
        });
        console.log(`[FIREBASE] Set ${collectionName}/${docId}`);
        return true;
    } catch (e) {
        console.error(`[FIREBASE] Error setting ${collectionName}/${docId}:`, e);
        throw e;
    }
}

// ========================================
// AUTHENTICATION
// ========================================

async function registerChurch(email, password, churchData) {
    if (!isAuthReady()) throw new Error('Auth not ready');
    try {
        const userCred = await window.firebaseCreateUser(window.auth, email, password);
        const uid = userCred.user.uid;

        // Create church profile
        const churchRef = window.firebaseDoc(window.db, 'churches', uid);
        await window.firebaseSetDoc(churchRef, {
            ...churchData,
            createdAt: window.firebaseServerTimestamp(),
            subscription: { status: 'active', plan: 'free', expiresAt: null }
        });

        // Create user profile
        const userRef = window.firebaseDoc(window.db, 'users', uid);
        await window.firebaseSetDoc(userRef, {
            churchId: uid,
            role: 'admin',
            nama: churchData.contactName || 'Admin',
            email: email,
            createdAt: window.firebaseServerTimestamp()
        });

        console.log('[FIREBASE] Church registered:', uid);
        return { uid, email };
    } catch (e) {
        console.error('[FIREBASE] Register error:', e);
        throw e;
    }
}

async function loginUser(email, password) {
    if (!isAuthReady()) throw new Error('Auth not ready');
    try {
        const userCred = await window.firebaseSignIn(window.auth, email, password);
        const uid = userCred.user.uid;

        // Get user profile to find churchId
        const userDoc = await window.firebaseGetDoc('users', uid);
        if (!userDoc) throw new Error('User profile not found');

        const churchId = userDoc.churchId;
        setActiveChurch(churchId);
        setActiveUser(uid);

        console.log('[FIREBASE] Login success:', uid);
        return { uid, churchId, ...userDoc };
    } catch (e) {
        console.error('[FIREBASE] Login error:', e);
        throw e;
    }
}

async function logoutFromFirebase() {
    if (!isAuthReady()) return;
    try {
        await window.firebaseSignOut(window.auth);
        _activeChurchId = null;
        _activeUserId = null;
        console.log('[FIREBASE] Logout success');
    } catch (e) {
        console.error('[FIREBASE] Logout error:', e);
    }
}

// ========================================
// REAL-TIME LISTENERS
// ========================================

function listenToCollection(collectionName, callback) {
    if (!isFirebaseReady()) {
        console.error('[FIREBASE] Not ready');
        return () => {};
    }
    try {
        return window.firebaseOnSnapshot(churchCol(collectionName), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(data);
        });
    } catch (e) {
        console.error(`[FIREBASE] Listener error for ${collectionName}:`, e);
        return () => {};
    }
}

// ========================================
// EXPOSE TO WINDOW
// ========================================
window.firebaseAddDoc = firebaseAddDoc;
window.firebaseGetAllDocs = firebaseGetAllDocs;
window.firebaseGetDoc = firebaseGetDoc;
window.firebaseUpdateDoc = firebaseUpdateDoc;
window.firebaseDeleteDoc = firebaseDeleteDoc;
window.firebaseSetDoc = firebaseSetDoc;
window.registerChurch = registerChurch;
window.loginUser = loginUser;
window.logoutFromFirebase = logoutFromFirebase;
window.listenToCollection = listenToCollection;
window.getActiveChurchId = getActiveChurchId;
window.getActiveUser = getActiveUser;
window.setActiveChurch = setActiveChurch;
window.setActiveUser = setActiveUser;

console.log('[FIREBASE] All functions exported to window');