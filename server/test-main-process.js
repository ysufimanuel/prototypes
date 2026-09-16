const dns = require('dns');

console.log('=== MAIN PROCESS TEST ===');

dns.lookup(
  'www.googleapis.com',
  { family: 4 },
  (error, address) => {
    console.log(
      'DNS:',
      error ? error.message : address
    );

    const {
      verifyFirebaseIdToken
    } = require('./firebase-token-verifier');

    const token = process.argv[2];

    if (!token) {
      console.error('Token belum diberikan');
      process.exit(1);
    }

    verifyFirebaseIdToken(token)
      .then(decoded => {
        console.log('🔥 VERIFY BERHASIL');
        console.log({
          uid: decoded.uid,
          email: decoded.email,
          aud: decoded.aud,
          iss: decoded.iss
        });
      })
      .catch(error => {
        console.error(
          '❌ VERIFY GAGAL:',
          error.message
        );
      });
  }
);