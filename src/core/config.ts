/**
 * Church Management System - Core Configuration
 * Semua konstanta dan konfigurasi aplikasi
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase Configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Database Collections
export const DB_COLLECTIONS = {
  MEMBERS: 'members',
  FAMILIES: 'families',
  GROUPS: 'groups',
  EVENTS: 'events',
  ATTENDANCE: 'attendance',
  DONATIONS: 'donations',
  DONORS: 'donors',
  VOLUNTEERS: 'volunteers',
  ASSIGNMENTS: 'assignments',
  USERS: 'users',
  ANNOUNCEMENTS: 'announcements',
  PEMASUKAN: 'pemasukan',
  PENGELUARAN: 'pengeluaran',
  FINANCE_CATEGORIES: 'financeCategories',
  FINANCE_CONFIG: 'financeConfig',
  APPROVAL_HISTORY: 'approvalHistory',
  SETTINGS: 'settings',
  NOTIFICATIONS: 'notifications',
  DEATHS: 'deaths',
} as const;

// Roles
export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  USER: 'user',
} as const;

// App Constants
export const APP_NAME = 'Church Management System';
export const APP_VERSION = '7.0.0';

// Default data structure for seeding
export const defaultData = {
  churchProfile: {
    nama: 'Gereja Kristen Indonesia',
    alamat: 'Jl. Gereja No. 123',
    kota: 'Jakarta',
    telepon: '021-12345678',
    email: 'info@gereja.com',
    website: 'www.gereja.com',
  },
  finance: {
    saldoAwal: 5000000,
    saldoAkhir: 0,
  },
};

// Realtime collections for sync
export const REALTIME_COLLECTIONS = [
  'members', 'families', 'groups', 'events',
  'attendance', 'donations', 'donors', 'volunteers',
  'assignments', 'announcements', 'pemasukan',
  'pengeluaran', 'financeCategories', 'notifications',
  'approvalHistory',
] as const;
