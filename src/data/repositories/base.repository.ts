/**
 * Base Repository - Helper CRUD generik untuk Firebase Firestore
 * Semua repository lain extends class ini
 */

import {
  collection,
  addDoc,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/core/config';

let _activeChurchId: string | null = null;

export function setActiveChurch(churchId: string | null): void {
  _activeChurchId = churchId;
}

export function getActiveChurchId(): string | null {
  return _activeChurchId;
}

/**
 * Get collection reference scoped ke gereja aktif
 */
export function getCollectionRef(collectionName: string) {
  if (!_activeChurchId) {
    throw new Error('churchId belum di-set. Pastikan user sudah login.');
  }
  return collection(db, 'churches', _activeChurchId, collectionName);
}

/**
 * Get document reference scoped ke gereja aktif
 */
export function getDocRef(collectionName: string, docId: string) {
  if (!_activeChurchId) {
    throw new Error('churchId belum di-set. Pastikan user sudah login.');
  }
  return doc(db, 'churches', _activeChurchId, collectionName, docId);
}

// =========================================================
// GENERIC CRUD FUNCTIONS
// =========================================================

/**
 * Ambil semua dokumen dari koleksi
 */
export async function getAllDocuments<T = DocumentData>(collectionName: string): Promise<T[]> {
  try {
    const snap = await getDocs(getCollectionRef(collectionName));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as T);
  } catch (e) {
    console.error(`[REPO] getAllDocuments(${collectionName}):`, e);
    return [];
  }
}

/**
 * Ambil dokumen berdasarkan ID
 */
export async function getDocumentById<T = DocumentData>(collectionName: string, docId: string): Promise<T | null> {
  try {
    const snap = await getDoc(getDocRef(collectionName, docId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
  } catch (e) {
    console.error(`[REPO] getDocumentById(${collectionName}/${docId}):`, e);
    return null;
  }
}

/**
 * Tambah dokumen baru (auto-generate ID)
 */
export async function addDocument<T extends DocumentData>(collectionName: string, data: T): Promise<string | null> {
  try {
    const now = new Date().toISOString();
    const docData = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await addDoc(getCollectionRef(collectionName), docData);
    return ref.id;
  } catch (e) {
    console.error(`[REPO] addDocument(${collectionName}):`, e);
    return null;
  }
}

/**
 * Set dokumen dengan ID tertentu (create or overwrite)
 */
export async function setDocument<T extends DocumentData>(collectionName: string, docId: string, data: T): Promise<boolean> {
  try {
    await setDoc(
      getDocRef(collectionName, docId),
      { ...data, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    return true;
  } catch (e) {
    console.error(`[REPO] setDocument(${collectionName}/${docId}):`, e);
    return false;
  }
}

/**
 * Update dokumen (partial update)
 */
export async function updateDocument(collectionName: string, docId: string, data: Record<string, any>): Promise<boolean> {
  try {
    await updateDoc(getDocRef(collectionName, docId), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (e) {
    console.error(`[REPO] updateDocument(${collectionName}/${docId}):`, e);
    return false;
  }
}

/**
 * Hapus dokumen
 */
export async function deleteDocument(collectionName: string, docId: string): Promise<boolean> {
  try {
    await deleteDoc(getDocRef(collectionName, docId));
    return true;
  } catch (e) {
    console.error(`[REPO] deleteDocument(${collectionName}/${docId}):`, e);
    return false;
  }
}

/**
 * Query dokumen dengan kondisi
 */
export async function queryDocuments<T = DocumentData>(
  collectionName: string,
  field: string,
  operator: any,
  value: any
): Promise<T[]> {
  try {
    const q = query(getCollectionRef(collectionName), where(field, operator, value));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as T);
  } catch (e) {
    console.error(`[REPO] queryDocuments(${collectionName}):`, e);
    return [];
  }
}

/**
 * Subscribe ke koleksi (real-time)
 */
export function subscribeToCollection<T = DocumentData>(
  collectionName: string,
  callback: (data: T[]) => void
): () => void {
  try {
    const unsub = onSnapshot(getCollectionRef(collectionName), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }) as T);
      callback(data);
    });
    return unsub;
  } catch (e) {
    console.error(`[REPO] subscribeToCollection(${collectionName}):`, e);
    return () => {};
  }
}

/**
 * Subscribe ke dokumen tunggal (real-time)
 */
export function subscribeToDocument<T = DocumentData>(
  collectionName: string,
  docId: string,
  callback: (data: T | null) => void
): () => void {
  try {
    const unsub = onSnapshot(getDocRef(collectionName, docId), snap => {
      callback(snap.exists() ? ({ id: snap.id, ...snap.data() }) as T : null);
    });
    return unsub;
  } catch (e) {
    console.error(`[REPO] subscribeToDocument(${collectionName}/${docId}):`, e);
    return () => {};
  }
}

/**
 * Batch write (multiple operations)
 */
export async function batchWrite(operations: {
  collection: string;
  docId: string;
  type: 'set' | 'update' | 'delete';
  data?: Record<string, any>;
}[]): Promise<boolean> {
  try {
    const batch = writeBatch(db);
    operations.forEach(op => {
      const ref = getDocRef(op.collection, op.docId);
      if (op.type === 'set') batch.set(ref, op.data || {}, { merge: true });
      if (op.type === 'update') batch.update(ref, op.data || {});
      if (op.type === 'delete') batch.delete(ref);
    });
    await batch.commit();
    return true;
  } catch (e) {
    console.error('[REPO] batchWrite:', e);
    return false;
  }
}

// =========================================================
// TOP-LEVEL OPERATIONS (users, churches)
// =========================================================

/**
 * Ambil profil user berdasarkan UID
 */
export async function getUserProfile(uid: string) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) {
    console.error('[REPO] getUserProfile:', e);
    return null;
  }
}

/**
 * Set profil user
 */
export async function setUserProfile(uid: string, data: Record<string, any>): Promise<boolean> {
  try {
    await setDoc(
      doc(db, 'users', uid),
      { ...data, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    return true;
  } catch (e) {
    console.error('[REPO] setUserProfile:', e);
    return false;
  }
}

/**
 * Cari user berdasarkan username
 */
export async function getUserByUsername(username: string) {
  try {
    const q = query(collection(db, 'users'), where('username', '==', username));
    const snap = await getDocs(q);
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  } catch (e) {
    console.error('[REPO] getUserByUsername:', e);
    return null;
  }
}

/**
 * Create church
 */
export async function createChurch(churchData: Record<string, any>): Promise<string | null> {
  try {
    const ref = await addDoc(collection(db, 'churches'), {
      ...churchData,
      subscription: {
        status: 'trial',
        plan: 'free',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return ref.id;
  } catch (e) {
    console.error('[REPO] createChurch:', e);
    return null;
  }
}

/**
 * Get church by ID
 */
export async function getChurch(churchId: string) {
  try {
    const snap = await getDoc(doc(db, 'churches', churchId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) {
    console.error('[REPO] getChurch:', e);
    return null;
  }
}
