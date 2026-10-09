const { verifyFirebaseIdToken } = require("./firebase-token-verifier");
const { db } = require("./firebase-admin");

async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("AUTH_REQUIRED");
  const idToken = authHeader.substring(7).trim();
  if (!idToken) throw new Error("AUTH_REQUIRED");
  const decoded = await verifyFirebaseIdToken(idToken);
  const userSnap = await db.collection("users").doc(decoded.uid).get();
  if (!userSnap.exists) throw new Error("PROFILE_NOT_FOUND");
  const userData = userSnap.data();
  if (userData.uid !== decoded.uid) throw new Error("UID_MISMATCH");
  return { uid:decoded.uid, email:decoded.email || null, role:userData.role, churchId:userData.churchId };
}

async function requireSuperAdmin(req,res,next){
  try{
    const user=await getAuthenticatedUser(req);
    if(user.role!=="superadmin") return res.status(403).json({success:false,message:"Akses hanya untuk Superadmin"});
    if(!user.churchId) return res.status(403).json({success:false,message:"User belum memiliki church"});
    req.user=user; next();
  }catch(error){
    console.error("Auth middleware error:",error.message);
    const status=error.message==="AUTH_REQUIRED"?401:403;
    return res.status(status).json({success:false,message:status===401?"Token autentikasi tidak ditemukan":"Profil user tidak valid"});
  }
}

async function requireChurchAdmin(req,res,next){
  try{
    const user=await getAuthenticatedUser(req);
    if(!["admin","superadmin"].includes(user.role)) return res.status(403).json({success:false,message:"Akses hanya untuk Admin atau Superadmin"});
    if(!user.churchId) return res.status(403).json({success:false,message:"User belum memiliki church"});
    req.user=user; next();
  }catch(error){
    console.error("Church admin auth error:",error.message);
    const status=error.message==="AUTH_REQUIRED"?401:403;
    return res.status(status).json({success:false,message:status===401?"Token autentikasi tidak ditemukan":"Profil user tidak valid"});
  }
}

module.exports={requireSuperAdmin,requireChurchAdmin};
