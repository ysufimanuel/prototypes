console.log('=== STEP 1 ===');

require('dotenv').config();

console.log('=== STEP 2 dotenv ===');

const express = require('express');

console.log('=== STEP 3 express ===');

const cors = require('cors');

console.log('=== STEP 4 cors ===');

const fs = require('fs');

console.log('=== STEP 5 fs ===');

const dns = require('dns');
const https = require('https');

console.log('=== STEP 6 dns/https ===');

const {
  initializeApp,
  getApps,
  cert
} = require('firebase-admin/app');

console.log('=== STEP 7 firebase-admin/app ===');

const {
  getAuth
} = require('firebase-admin/auth');

console.log('=== STEP 8 firebase-admin/auth ===');

const {
  getFirestore
} = require('firebase-admin/firestore');

console.log('=== STEP 9 firebase-admin/firestore ===');

console.log('NODE:', process.version);
console.log('CWD:', process.cwd());

console.log('ENV NETWORK:', {
  HTTP_PROXY: process.env.HTTP_PROXY,
  HTTPS_PROXY: process.env.HTTPS_PROXY,
  ALL_PROXY: process.env.ALL_PROXY,
  NO_PROXY: process.env.NO_PROXY
});

dns.lookup('www.googleapis.com', (err, address, family) => {
  console.log('[DNS RESULT]', {
    error: err ? err.message : null,
    address,
    family
  });
});

https.get(
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
  response => {
    console.log('[HTTPS RESULT]', response.statusCode);
    response.resume();
  }
).on('error', error => {
  console.error('[HTTPS ERROR]', error.message);
});