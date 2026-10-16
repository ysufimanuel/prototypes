import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Development-only seed for the Firebase Auth + Firestore emulators.
// It uses an existing Firebase legacy church ID so the local Website Manager
// resolves the same tenant in Supabase.

process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";

const uid = process.env.DEV_FIREBASE_UID || "local-cms-superadmin-001";
const email = process.env.DEV_FIREBASE_EMAIL || "local-admin@gms-cms.test";
const password = process.env.DEV_FIREBASE_PASSWORD;
const churchId = process.env.DEV_CHURCH_ID || "JhSB69TxbhTLKLUlR9VR";
const role = process.env.DEV_FIREBASE_ROLE || "superadmin";
const churchName = process.env.DEV_CHURCH_NAME || "GMS";

if (!password) {
  throw new Error("DEV_FIREBASE_PASSWORD wajib diisi saat menjalankan seed.");
}

function loadServiceAccount() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS belum dikonfigurasi.");
  }

  const resolvedPath = path.resolve(process.cwd(), credentialsPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Firebase service account tidak ditemukan: ${resolvedPath}`);
  }

  return JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
}

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = loadServiceAccount();
  return initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const app = getAdminApp();
const auth = getAuth(app);
const db = getFirestore(app);

async function ensureAuthUser() {
  try {
    const existing = await auth.getUser(uid);
    const user = await auth.updateUser(uid, {
      email,
      password,
      emailVerified: true,
      disabled: false,
      displayName: "Local CMS Superadmin",
    });
    return { action: "updated", user };
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;

    const user = await auth.createUser({
      uid,
      email,
      password,
      emailVerified: true,
      disabled: false,
      displayName: "Local CMS Superadmin",
    });
    return { action: "created", user };
  }
}

async function ensureFirestoreProfile(userRecord) {
  const profile = {
    uid: userRecord.uid,
    email,
    nama: "Local CMS Superadmin",
    role,
    status: "aktif",
    churchId,
    seededForLocalDevelopment: true,
  };

  await db.collection("users").doc(userRecord.uid).set(profile, { merge: true });
  return profile;
}

async function ensureFirestoreChurch() {
  const church = {
    nama: churchName,
    name: churchName,
    seededForLocalDevelopment: true,
  };

  await db.collection("churches").doc(churchId).set(church, { merge: true });
  return church;
}

async function main() {
  console.log("[SEED] Auth emulator:", process.env.FIREBASE_AUTH_EMULATOR_HOST);
  console.log("[SEED] Firestore emulator:", process.env.FIRESTORE_EMULATOR_HOST);
  console.log("[SEED] Target churchId:", churchId);

  const authResult = await ensureAuthUser();
  const profile = await ensureFirestoreProfile(authResult.user);
  await ensureFirestoreChurch();

  console.log("[SEED] Auth user:", authResult.action);
  console.log("[SEED] uid:", profile.uid);
  console.log("[SEED] email:", profile.email);
  console.log("[SEED] role:", profile.role);
  console.log("[SEED] churchId:", profile.churchId);
  console.log("[SEED] Firestore church:", churchName);
  console.log("[SEED] PASS — deterministic local admin + church are ready.");
}

main().catch((error) => {
  console.error("[SEED] FAIL:", error?.message || error);
  process.exitCode = 1;
});
