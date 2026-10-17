const { getAppCheck } = require("firebase-admin/app-check");
const { getApps } = require("firebase-admin/app");

async function requireAppCheck(req, res) {
  if (process.env.APP_CHECK_ENFORCED !== "true") return true;

  // Local Auth Emulator requests are already isolated to the development
  // environment. Do not call Firebase App Check verification here: the Admin
  // App Check verifier expects production attestation/debug tokens and can
  // block a local request while trying to verify remote credentials.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    req.appCheck = { local: true, development: true };
    return true;
  }

  const token = String(req.headers["x-firebase-appcheck"] || "").trim();
  if (!token) {
    res.status(401).json({ success: false, message: "App Check diperlukan." });
    return false;
  }

  try {
    if (getApps().length === 0) throw new Error("Firebase Admin belum diinisialisasi");
    const appCheck = getAppCheck();
    const decoded = await appCheck.verifyToken(token);
    req.appCheck = decoded;
    return true;
  } catch (error) {
    console.error("[APP CHECK] verifyToken gagal:", {
      name: error?.name || null,
      code: error?.code || null,
      message: error?.message || "Unknown App Check error",
    });
    res.status(401).json({ success: false, message: "App Check tidak valid." });
    return false;
  }
}

module.exports = { requireAppCheck };
