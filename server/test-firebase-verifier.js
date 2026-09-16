require('dotenv').config();

const {
  verifyFirebaseIdToken
} = require('./firebase-token-verifier');

async function main() {
  try {
    const token = process.argv[2];

    if (!token) {
      throw new Error(
        'Token belum diberikan'
      );
    }

    const decoded =
      await verifyFirebaseIdToken(token);

    console.log('');
    console.log('🔥 FIREBASE VERIFIER BERHASIL');
    console.log({
      uid: decoded.sub,
      email: decoded.email || null,
      aud: decoded.aud,
      iss: decoded.iss
    });

  } catch (error) {
    console.error('');
    console.error('❌ VERIFIER GAGAL');
    console.error(error.message);

    process.exitCode = 1;
  }
}

main();

