const { auth } = require("./firebase-admin");
const { requireAppCheck } = require("./app-check");
const { supabaseAdmin } = require("./supabase");

async function getAuthenticatedUser(req, res) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) { res.status(401).json({ success: false, message: "Token autentikasi tidak ditemukan" }); return null; }
  const idToken = authHeader.substring(7).trim();
  if (!idToken) { res.status(401).json({ success: false, message: "Token autentikasi kosong" }); return null; }

  let decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch (error) { console.error("[AUTH] verifyIdToken gagal:", { name: error?.name || null, code: error?.code || null, message: error?.message || "Unknown auth error" }); res.status(401).json({ success: false, message: "Token autentikasi tidak valid atau sudah kedaluwarsa." }); return null; }

  try {
    // Local emulator auth is intentionally self-contained. Do not make an extra
    // Firestore request here: the admin API only needs the deterministic dev
    // identity to resolve the same tenant in Supabase.
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      const expectedUid = process.env.DEV_FIREBASE_UID || "local-cms-superadmin-001";
      const churchId = process.env.DEV_CHURCH_ID || "JhSB69TxbhTLKLUlR9VR";
      const role = process.env.DEV_FIREBASE_ROLE || "superadmin";
      const email = process.env.DEV_FIREBASE_EMAIL || decoded.email || null;
      if (decoded.uid !== expectedUid || !churchId) {
        res.status(403).json({ success: false, message: "Profil user tidak ditemukan" });
        return null;
      }
      return { uid: decoded.uid, authUserId: null, email, role, churchId };
    }

    const { data: mapping, error: mappingError } = await supabaseAdmin.from("firebase_uid_map").select("auth_user_id").eq("legacy_uid", decoded.uid).maybeSingle();
    if (mappingError) throw mappingError;

    if (mapping?.auth_user_id) {
      const { data: profile, error: profileError } = await supabaseAdmin.from("profiles").select("id, church_id, role, email, nama, status").eq("id", mapping.auth_user_id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) { res.status(403).json({ success: false, message: "Profil user tidak ditemukan" }); return null; }

      const { data: church, error: churchError } = await supabaseAdmin.from("churches").select("legacy_id").eq("id", profile.church_id).maybeSingle();
      if (churchError) throw churchError;
      if (!church?.legacy_id) { res.status(403).json({ success: false, message: "User belum memiliki church" }); return null; }

      return { uid: decoded.uid, authUserId: profile.id, email: decoded.email || profile.email || null, role: profile.role, churchId: church.legacy_id };
    }

    res.status(403).json({ success: false, message: "Profil user tidak ditemukan" });
    return null;
  } catch (error) {
    console.error("[AUTH] Supabase profile lookup gagal:", { name: error?.name || null, code: error?.code || null, message: error?.message || "Unknown Supabase error" });
    res.status(500).json({ success: false, message: "Backend gagal memverifikasi profil pengguna." });
    return null;
  }
}

async function requireChurchAdmin(req, res) {
  if (!(await requireAppCheck(req, res))) return null;
  const user = await getAuthenticatedUser(req, res); if (!user) return null;
  if (!["admin", "superadmin"].includes(user.role)) { res.status(403).json({ success: false, message: "Akses hanya untuk Admin atau Superadmin" }); return null; }
  if (!user.churchId) { res.status(403).json({ success: false, message: "User belum memiliki church" }); return null; }
  return user;
}

async function requireSuperAdmin(req, res) {
  if (!(await requireAppCheck(req, res))) return null;
  const user = await getAuthenticatedUser(req, res); if (!user) return null;
  if (user.role !== "superadmin") { res.status(403).json({ success: false, message: "Akses hanya untuk Superadmin" }); return null; }
  if (!user.churchId) { res.status(403).json({ success: false, message: "User belum memiliki church" }); return null; }
  return user;
}

module.exports = { requireSuperAdmin, requireChurchAdmin };