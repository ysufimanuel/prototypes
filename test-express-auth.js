require('dotenv').config();

const express = require('express');
const cors = require('cors');
const dns = require('dns');
const https = require('https');

const app = express();

app.use(cors({
  origin: true,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Authorization']
}));

const ipv4Lookup = (hostname, options, callback) => {
  dns.lookup(
    hostname,
    {
      ...options,
      family: 4
    },
    callback
  );
};

const httpAgent = new https.Agent({
  keepAlive: true,
  lookup: ipv4Lookup
});

const {
  initializeApp,
  cert
} = require('firebase-admin/app');

const {
  getAuth
} = require('firebase-admin/auth');

const {
  getFirestore
} = require('firebase-admin/firestore');

const fs = require('fs');

const serviceAccount = JSON.parse(
  fs.readFileSync(
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    'utf8'
  )
);

const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
  httpAgent
});

const auth = getAuth(firebaseApp);
console.log('AUTH HTTP AGENT:', auth);
const db = getFirestore(firebaseApp);

app.get('/', async (req, res) => {
  try {
    const header = req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        error: 'NO_TOKEN'
      });
    }

    const token = header.substring(7);

    console.log('VERIFY START');

    const decoded = await auth.verifyIdToken(token);

    console.log('VERIFY SUCCESS:', decoded.uid);

    return res.json({
      ok: true,
      uid: decoded.uid,
      email: decoded.email || null
    });

  } catch (error) {
    console.error('VERIFY ERROR:', error);

    return res.status(401).json({
      ok: false,
      code: error.code,
      message: error.message
    });
  }
});

app.listen(3000, () => {
  console.log('TEST AUTH SERVER READY');
});
