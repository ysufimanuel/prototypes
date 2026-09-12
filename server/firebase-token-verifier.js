require('dotenv').config();

const fs = require('fs');
const dns = require('dns');
const https = require('https');
const jwt = require('jsonwebtoken');

const serviceAccount = JSON.parse(
  fs.readFileSync(
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    'utf8'
  )
);

const PROJECT_ID = serviceAccount.project_id;

const GOOGLE_HOST = 'www.googleapis.com';

const CERT_PATH =
  '/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const CERT_URL =
  `https://${GOOGLE_HOST}${CERT_PATH}`;

// =====================================================
// CACHE
// =====================================================

let cachedCerts = null;
let cacheExpiresAt = 0;

const DEFAULT_CACHE_MS = 60 * 60 * 1000;

// =====================================================
// GOOGLE IPv4 FALLBACK
// =====================================================

// IP yang sebelumnya berhasil dari environment ini.
// Jangan dianggap permanen; DNS tetap dicoba terlebih dahulu.
const FALLBACK_IPS = [
  '172.217.116.4',
  '172.217.119.4',
  '172.217.115.4'
];

// =====================================================
// RESOLVE IPv4
// =====================================================

function resolveGoogleIPv4() {
  return new Promise((resolve, reject) => {
    dns.lookup(
      GOOGLE_HOST,
      {
        family: 4
      },
      (error, address) => {
        if (!error && address) {
          return resolve(address);
        }

        console.warn(
          'DNS Google gagal:',
          error ? error.message : 'unknown error'
        );

        // Fallback IP untuk environment Android.
        const fallback =
          FALLBACK_IPS[
            Math.floor(
              Math.random() * FALLBACK_IPS.length
            )
          ];

        console.warn(
          'Menggunakan fallback IPv4:',
          fallback
        );

        resolve(fallback);
      }
    );
  });
}

// =====================================================
// HTTPS REQUEST DIRECT TO IP
// =====================================================

function fetchGoogleCertsFromIP(ip) {
  return new Promise((resolve, reject) => {
    console.log(
      'Google cert request →',
      ip
    );

    const request = https.get(
      {
        hostname: ip,
        port: 443,
        path: CERT_PATH,

        // Tetap gunakan hostname asli untuk TLS SNI.
        servername: GOOGLE_HOST,

        headers: {
          Host: GOOGLE_HOST
        },

        timeout: 10000,

        // Tidak menggunakan DNS lookup lagi.
        lookup: (hostname, options, callback) => {
          callback(null, ip, 4);
        }
      },
      (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(
              new Error(
                `Google cert HTTP ${res.statusCode}`
              )
            );
          }

          try {
            const certs = JSON.parse(body);

            if (
              !certs ||
              typeof certs !== 'object' ||
              Object.keys(certs).length === 0
            ) {
              return reject(
                new Error(
                  'Google certificates kosong'
                )
              );
            }

            const cacheControl =
              res.headers['cache-control'] || '';

            const match =
              cacheControl.match(/max-age=(\d+)/);

            const cacheMs = match
              ? Number(match[1]) * 1000
              : DEFAULT_CACHE_MS;

            cachedCerts = certs;
            cacheExpiresAt =
              Date.now() + cacheMs;

            console.log(
              `Google cert cache diperbarui (${Object.keys(certs).length} keys)`
            );

            resolve(certs);

          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on('error', reject);

    request.on('timeout', () => {
      request.destroy(
        new Error(
          'Timeout mengambil Google certificates'
        )
      );
    });
  });
}

// =====================================================
// GET GOOGLE CERTS
// =====================================================

async function getGoogleCerts(forceRefresh = false) {
  if (
    !forceRefresh &&
    cachedCerts &&
    Date.now() < cacheExpiresAt
  ) {
    return cachedCerts;
  }

  const ip = await resolveGoogleIPv4();

  try {
    return await fetchGoogleCertsFromIP(ip);
  } catch (error) {
    console.warn(
      'Google cert request gagal:',
      error.message
    );

    // Kalau DNS menghasilkan IP tetapi koneksi IP tersebut gagal,
    // coba fallback IP lainnya.
    for (const fallbackIp of FALLBACK_IPS) {
      if (fallbackIp === ip) {
        continue;
      }

      try {
        console.log(
          'Mencoba fallback Google IP:',
          fallbackIp
        );

        return await fetchGoogleCertsFromIP(
          fallbackIp
        );

      } catch (fallbackError) {
        console.warn(
          `Fallback ${fallbackIp} gagal:`,
          fallbackError.message
        );
      }
    }

    throw new Error(
      'Tidak dapat mengambil Google public certificates'
    );
  }
}

// =====================================================
// VERIFY FIREBASE ID TOKEN
// =====================================================

async function verifyFirebaseIdToken(idToken) {
  if (
    typeof idToken !== 'string' ||
    idToken.trim() === ''
  ) {
    throw new Error(
      'Firebase ID token tidak valid'
    );
  }

  // Decode hanya untuk mendapatkan header.
  // BELUM TRUSTED.
  const decoded = jwt.decode(
    idToken,
    {
      complete: true
    }
  );

  if (
    !decoded ||
    !decoded.header
  ) {
    throw new Error(
      'Format Firebase ID token tidak valid'
    );
  }

  const {
    kid,
    alg
  } = decoded.header;

  console.log(
    '[JWT] alg:',
    alg
  );

  console.log(
    '[JWT] kid:',
    kid
  );

  if (alg !== 'RS256') {
    throw new Error(
      `JWT algorithm tidak diizinkan: ${alg}`
    );
  }

  if (!kid) {
    throw new Error(
      'JWT kid tidak ditemukan'
    );
  }

  let certs =
    await getGoogleCerts();

  let publicKey =
    certs[kid];

  // Google key rotation:
  // refresh certificate sekali.
  if (!publicKey) {
    console.log(
      '[JWT] kid tidak ada di cache, refresh cert...'
    );

    certs =
      await getGoogleCerts(true);

    publicKey =
      certs[kid];
  }

  if (!publicKey) {
    throw new Error(
      'Public key Google untuk kid tidak ditemukan'
    );
  }

  // ===================================================
  // CRYPTOGRAPHIC VERIFICATION
  // ===================================================

  const verified = jwt.verify(
    idToken,
    publicKey,
    {
      algorithms: ['RS256'],

      issuer:
        `https://securetoken.google.com/${PROJECT_ID}`,

      audience:
        PROJECT_ID
    }
  );

  // ===================================================
  // BASIC FIREBASE CLAIM VALIDATION
  // ===================================================

  if (
    typeof verified.sub !== 'string' ||
    verified.sub.length === 0
  ) {
    throw new Error(
      'Firebase ID token tidak memiliki UID valid'
    );
  }

  return verified;
}

// =====================================================
// EXPORT
// =====================================================
async function preloadFirebaseCerts() {
  await getGoogleCerts();
}
module.exports = {
  verifyFirebaseIdToken,
  preloadFirebaseCerts
};