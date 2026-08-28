/**
 * FIREBASE CONFIGURATION — Multi-tenant with church tenant isolation
 * ====================================================================
 * Konfigurasi Firebase untuk Church Management System V6
 * - Multi-tenant: data terisolasi per gereja
 * - Firestore untuk penyimpanan data real-time
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  enableIndexedDbPersistence
} from 'firebase/firestore';

// ── Firebase Configuration ──────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyB4U3by4pGJ58Z8sYsiaL4NZWAckUlB5x0",
  authDomain: "church-managementsyste.firebaseapp.com",
  projectId: "church-managementsyste",
  storageBucket: "church-managementsyste.appspot.com",
  messagingSenderId: "1090537282659",
  appId: "1:1090537282659:web:e18d93b0ae7e0ebc8f5e8f",
  measurementId: "G-3S3P9ETY6M"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Enable offline persistence
try {
  enableIndexedDbPersistence(db);
} catch (err) {
  console.warn('Firebase persistence not available:', err);
}

// ── Tenant Helpers ──────────────────────────────────────────────
export function getCurrentTenant(): string | null {
  const tenantData = localStorage.getItem('tenantData');
  if (tenantData) {
    try {
      const data = JSON.parse(tenantData);
      return data.id || null;
    } catch {
      return null;
    }
  }
  // Fallback for compatibility
  return localStorage.getItem('churchTenant') || localStorage.getItem('selectedTenant') || null;
}

export function getTenantCollectionPath(baseCollection: string): string {
  const tenantId = getCurrentTenant();
  if (tenantId) {
    return `tenants/${tenantId}/${baseCollection}`;
  }
  return baseCollection;
}

// ── Firestore Helpers ───────────────────────────────────────────

/**
 * Get a document reference with tenant isolation
 */
export function getTenantDocRef(collectionName: string, docId: string) {
  const path = getTenantCollectionPath(collectionName);
  return doc(db, path, docId);
}

/**
 * Get a collection reference with tenant isolation
 */
export function getTenantCollectionRef(collectionName: string) {
  const path = getTenantCollectionPath(collectionName);
  return collection(db, path);
}

/**
 * Get document data
 */
export async function getDocument(collectionName: string, docId: string): Promise<any> {
  try {
    const docRef = getTenantDocRef(collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error(`Error getting document ${collectionName}/${docId}:`, error);
    return null;
  }
}

/**
 * Get all documents from a collection
 */
export async function getAllDocuments(collectionName: string): Promise<any[]> {
  try {
    const colRef = getTenantCollectionRef(collectionName);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error getting all documents from ${collectionName}:`, error);
    return [];
  }
}

/**
 * Query documents
 */
export async function queryDocuments(
  collectionName: string,
  fieldPath: string,
  opStr: '==' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains',
  value: any
): Promise<any[]> {
  try {
    const colRef = getTenantCollectionRef(collectionName);
    const q = query(colRef, where(fieldPath, opStr, value));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error querying documents from ${collectionName}:`, error);
    return [];
  }
}

/**
 * Set document data
 */
export async function setDocument(
  collectionName: string,
  docId: string,
  data: any
): Promise<boolean> {
  try {
    const docRef = getTenantDocRef(collectionName, docId);
    await setDoc(docRef, { ...data, _updatedAt: Timestamp.now() }, { merge: true });
    return true;
  } catch (error) {
    console.error(`Error setting document ${collectionName}/${docId}:`, error);
    return false;
  }
}

/**
 * Update document data
 */
export async function updateDocument(
  collectionName: string,
  docId: string,
  data: any
): Promise<boolean> {
  try {
    const docRef = getTenantDocRef(collectionName, docId);
    await updateDoc(docRef, { ...data, _updatedAt: Timestamp.now() });
    return true;
  } catch (error) {
    console.error(`Error updating document ${collectionName}/${docId}:`, error);
    return false;
  }
}

/**
 * Delete document
 */
export async function deleteDocument(collectionName: string, docId: string): Promise<boolean> {
  try {
    const docRef = getTenantDocRef(collectionName, docId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error(`Error deleting document ${collectionName}/${docId}:`, error);
    return false;
  }
}

/**
 * Add document with auto-generated ID
 */
export async function addDocument(collectionName: string, data: any): Promise<string | null> {
  try {
    const colRef = getTenantCollectionRef(collectionName);
    const newDocRef = doc(colRef);
    await setDoc(newDocRef, { ...data, _createdAt: Timestamp.now(), _updatedAt: Timestamp.now() });
    return newDocRef.id;
  } catch (error) {
    console.error(`Error adding document to ${collectionName}:`, error);
    return null;
  }
}

/**
 * Subscribe to collection changes (real-time)
 */
export async function subscribeToCollection(
  collectionName: string,
  callback: (data: any[]) => void
): Promise<() => void> {
  try {
    const colRef = getTenantCollectionRef(collectionName);
    const { onSnapshot } = await import('firebase/firestore');
    return onSnapshot(colRef, (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      callback(data);
    }, (error: any) => {
      console.error(`Subscription error for ${collectionName}:`, error);
    });
  } catch (error) {
    console.error(`Error subscribing to ${collectionName}:`, error);
    return () => {};
  }
}

// ── Database Health Check ───────────────────────────────────────
export async function checkFirebaseHealth(): Promise<boolean> {
  try {
    await getDocument('_health', 'check');
    return true;
  } catch {
    return false;
  }
}

export function isFirebaseReady(): boolean {
  return !!db && !!getCurrentTenant();
}

// ── Export ──────────────────────────────────────────────────────
export { db, app, Timestamp };
export default app;
