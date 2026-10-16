const fs = require("fs");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

function getLocalServiceAccount() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) return null;

  const resolvedPath = require("path").resolve(process.cwd(), credentialsPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Firebase service account tidak ditemukan: ${resolvedPath}`);
  }

  return JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
}

function getFirebaseAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  const localServiceAccount = getLocalServiceAccount();
  if (localServiceAccount) {
    return initializeApp({
      credential: cert(localServiceAccount),
      projectId: localServiceAccount.project_id,
    });
  }

  throw new Error(
    "Firebase Admin credentials belum dikonfigurasi. " +
      "Gunakan FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY " +
      "di Vercel atau GOOGLE_APPLICATION_CREDENTIALS untuk local development."
  );
}

const app = getFirebaseAdminApp();
const auth = getAuth(app);
const db = getFirestore(app);

module.exports = { app, auth, db };
