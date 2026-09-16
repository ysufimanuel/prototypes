require('dotenv').config();

const fs = require('fs');
const https = require('https');
const jwt = require('jsonwebtoken');

const serviceAccount = JSON.parse(
  fs.readFileSync(
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    'utf8'
  )
);

const PROJECT_ID = serviceAccount.project_id;

const CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const ipv4Lookup = (hostname, options, callback) => {
  require('dns').lookup(
    hostname,
    {
      ...options,
      family: 4
    },
    callback
  );
};

const httpsAgent = new https.Agent({
  keepAlive: true,
  lookup: ipv4Lookup
});

function fetchGoogleCerts() {
  return new Promise((resolve, reject) => {
    https.get(
      CERT_URL,
      {
        agent: httpsAgent
      },
      (res) => {
        let body = '';

        res.on('data', chunk => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(
              new Error(`Google cert HTTP ${res.statusCode}`)
            );
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      }
    ).on('error', reject);
  });
}

async function main() {
  try {
    const token = process.argv[2];

    if (!token) {
      throw new Error(
        'Token belum diberikan. Jalankan: node server/test-jwt-verify.js "TOKEN"'
      );
    }

    // Decode header SAJA untuk mendapatkan kid.
    // Belum dianggap trusted.
    const decoded = jwt.decode(token, {
      complete: true
    });

    if (!decoded || !decoded.header) {
      throw new Error('JWT tidak valid');
    }

    const { kid, alg } = decoded.header;

    console.log('JWT alg:', alg);
    console.log('JWT kid:', kid);

    if (alg !== 'RS256') {
      throw new Error('Algorithm JWT bukan RS256');
    }

    if (!kid) {
      throw new Error('JWT kid tidak ditemukan');
    }

    console.log('Mengambil Google public certificates...');

    const certs = await fetchGoogleCerts();

    console.log(
      'Google certificates:',
      Object.keys(certs)
    );

    const publicKey = certs[kid];

    if (!publicKey) {
      throw new Error(
        'Public key untuk kid tersebut tidak ditemukan'
      );
    }

    const verified = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID
    });

    console.log('');
    console.log('🔥 JWT VERIFY BERHASIL');
    console.log({
      uid: verified.sub,
      email: verified.email || null,
      aud: verified.aud,
      iss: verified.iss
    });

  } catch (error) {
    console.error('');
    console.error('❌ JWT VERIFY GAGAL');
    console.error(error.message);
    process.exitCode = 1;
  }
}

main();