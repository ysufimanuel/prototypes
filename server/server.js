require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const {
  verifyFirebaseIdToken,
  preloadFirebaseCerts
} = require('./firebase-token-verifier');

// =====================================================
// CORS
// =====================================================

app.use(cors({
  origin: true,
  methods: [
    'GET',
    'POST',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ],
  allowedHeaders: [
    'Content-Type',
    'Authorization'
  ]
}));

// =====================================================
// JSON
// =====================================================

app.use(express.json());

// =====================================================
// ADMIN USER ROUTES
// =====================================================

const adminUsersRouter =
  require('./admin-users');

const {
  preloadFirebaseCerts
} = require('./firebase-token-verifier');

app.use(
  '/api/admin',
  adminUsersRouter
);

// =====================================================
// HEALTH CHECK
// =====================================================

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'CMS V6 Backend hidup 🔥'
  });
});

// =====================================================
// SERVER
// =====================================================

async function startServer() {
  console.log('Memuat Firebase public certificates...');

  // Coba preload, tapi JANGAN blokir server
  preloadFirebaseCerts()
    .then(() => {
      console.log('Firebase public certificates siap.');
    })
    .catch((error) => {
      console.warn(
        'Preload Firebase certificates gagal:',
        error.message
      );
      console.warn(
        'Server tetap dijalankan. Verifier akan mencoba mengambil cert saat diperlukan.'
      );
    });

  app.listen(PORT, () => {
    console.log(
      `CMS V6 Backend running on http://localhost:${PORT}`
    );
  });
}

startServer();