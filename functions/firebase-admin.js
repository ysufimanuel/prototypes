const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const app = getApps().length > 0 ? getApps()[0] : initializeApp();

const auth = getAuth(app);

const db = getFirestore(app);

module.exports = {
  admin: {
    app,
    auth,
    db,
  },
  db,
  auth,
};
