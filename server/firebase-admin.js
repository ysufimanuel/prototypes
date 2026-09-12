require('dotenv').config();

const fs = require('fs');

const {
  initializeApp,
  getApps,
  cert
} = require('firebase-admin/app');

const {
  getAuth
} = require('firebase-admin/auth');

const {
  getFirestore
} = require('firebase-admin/firestore');

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!serviceAccountPath) {
  throw new Error(
    'GOOGLE_APPLICATION_CREDENTIALS belum diset di .env'
  );
}

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, 'utf8')
);

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
      });

const db = getFirestore(app);
const auth = getAuth(app);

console.log(
  'Firebase Admin Project:',
  serviceAccount.project_id
);

module.exports = {
  admin: {
    app,
    auth,
    db
  },
  db,
  auth
};