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

const dns = require('dns');
const https = require('https');

const serviceAccount = JSON.parse(
  fs.readFileSync(
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    'utf8'
  )
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

console.log('Firebase Admin Project:', serviceAccount.project_id);
console.log('Auth initialized:', !!auth);
console.log('Firestore initialized:', !!db);

dns.lookup('www.googleapis.com', (err, address, family) => {
  console.log('[DNS]', {
    error: err ? err.message : null,
    address,
    family
  });
});

https.get(
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
  response => {
    console.log('[HTTPS]', response.statusCode);
    response.resume();
  }
).on('error', error => {
  console.error('[HTTPS ERROR]', error.message);
});

const token = process.argv[2];

if (!token) {
  console.error('TOKEN BELUM DIBERIKAN');
  process.exit(1);
}

console.log('Token length:', token.length);

auth.verifyIdToken(token)
  .then(decoded => {
    console.log('VERIFY BERHASIL 🔥');
    console.log({
      uid: decoded.uid,
      email: decoded.email,
      aud: decoded.aud,
      iss: decoded.iss
    });
  })
  .catch(error => {
    console.error('VERIFY GAGAL ❌');
    console.error(error);
  });