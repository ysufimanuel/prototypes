require('dotenv').config();

const fs = require('fs');
const dns = require('dns');

const {
  initializeApp,
  getApps,
  cert
} = require('firebase-admin/app');

const {
  getAuth
} = require('firebase-admin/auth');

const {
  initializeFirestore
} = require('firebase-admin/firestore');


/*
 * Android DNS workaround
 *
 * dns.lookup() bermasalah di environment ini,
 * sedangkan dns.resolve4() masih bisa resolve hostname.
 */
const originalLookup = dns.lookup;

dns.lookup = function (hostname, options, callback) {
  let opts = options;
  let cb = callback;

  if (typeof options === 'function') {
    cb = options;
    opts = {};
  }

  if (hostname === 'firestore.googleapis.com') {
    const ip = '142.250.4.95';

    console.log(
      '[DNS] firestore static lookup:',
      hostname,
      '=>',
      ip,
      'options:',
      opts
    );

    if (opts && opts.all) {
      return cb(null, [
        {
          address: ip,
          family: 4
        }
      ]);
    }

    return cb(null, ip, 4);
  }

  if (hostname === 'www.googleapis.com') {
    const ip = '172.217.112.4';

    console.log(
      '[DNS] google static lookup:',
      hostname,
      '=>',
      ip,
      'options:',
      opts
    );

    if (opts && opts.all) {
      return cb(null, [
        {
          address: ip,
          family: 4
        }
      ]);
    }

    return cb(null, ip, 4);
  }

  return originalLookup.call(
    dns,
    hostname,
    opts,
    cb
  );
};


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


/*
 * REST transport:
 * hindari gRPC karena resolver gRPC di Android
 * gagal resolve firestore.googleapis.com.
 */
const db = initializeFirestore(app, {
  preferRest: true
});

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