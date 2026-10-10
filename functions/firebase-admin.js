const admin = require("firebase-admin");

const app = admin.apps.length > 0 ? admin.app() : admin.initializeApp();

const auth = admin.auth();
const db = admin.firestore();

console.log("Firebase Admin initialized");

module.exports = {
  admin,
  db,
  auth,
};
