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

const serviceAccount = JSON.parse(
  fs.readFileSync(
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    'utf8'
  )
);

const app =
  getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
      });

const auth = getAuth(app);

const token = process.argv[2];

if (!token) {
  console.error('Token belum diberikan');
  process.exit(1);
}

console.log('Project:', serviceAccount.project_id);
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