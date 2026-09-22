const { getAuth } = require("firebase-admin/auth");

// =====================================================
// VERIFY FIREBASE ID TOKEN
// =====================================================

async function verifyFirebaseIdToken(idToken) {
  if (typeof idToken !== "string" || idToken.trim() === "") {
    throw new Error("Firebase ID token tidak valid");
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);

    if (typeof decodedToken.uid !== "string" || decodedToken.uid.length === 0) {
      throw new Error("Firebase ID token tidak memiliki UID valid");
    }

    return decodedToken;
  } catch (error) {
    console.error("Firebase ID token verification gagal", { message: error.message });

    throw new Error("Firebase ID token tidak valid atau sudah expired");
  }
}

// =====================================================
// EXPORT
// =====================================================

module.exports = {
  verifyFirebaseIdToken,
};
