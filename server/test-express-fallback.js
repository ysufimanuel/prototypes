require('dotenv').config();

const express = require('express');

const {
  verifyFirebaseIdToken
} = require('./firebase-token-verifier');

const { db } = require('./firebase-admin');

const app = express();

app.get('/', async (req, res) => {
  try {
    console.log('');
    console.log('=== EXPRESS FALLBACK TEST ===');

    const header =
      req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        step: 'token',
        message: 'Bearer token tidak ditemukan'
      });
    }

    const token = header.substring(7).trim();

    console.log('STEP 1: custom JWT verifier...');
    
    const decoded =
      await verifyFirebaseIdToken(token);

    console.log(
      'STEP 1 OK:',
      decoded.sub
    );

    console.log(
      'STEP 2: Firestore users lookup...'
    );

    const snap = await db
      .collection('users')
      .doc(decoded.sub)
      .get();

    console.log(
      'STEP 2 OK:',
      snap.exists
    );

    return res.json({
      success: true,
      verifier: 'OK',
      firestore: 'OK',
      userExists: snap.exists,
      uid: decoded.sub
    });

  } catch (error) {
    console.error(
      '❌ EXPRESS FALLBACK ERROR'
    );

    console.error(
      'message:',
      error.message
    );

    console.error(
      'code:',
      error.code || null
    );

    return res.status(500).json({
      success: false,
      message: error.message,
      code: error.code || null
    });
  }
});

app.listen(3001, () => {
  console.log(
    'EXPRESS FALLBACK TEST: http://127.0.0.1:3001'
  );
});

