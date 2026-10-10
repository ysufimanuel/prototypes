const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Vercel backend contract is present", () => {
  const files = [
    "api/_lib/firebase-admin.js",
    "api/_lib/auth.js",
    "api/_lib/app-check.js",
    "api/_lib/cors.js",
    "api/_lib/error-response.js",
    "api/_lib/rate-limit.js",
    "api/admin/create-user.js",
    "api/admin/users/[uid].js",
    "api/admin/website/[...path].js",
  ];

  for (const file of files) {
    assert.ok(fs.existsSync(path.join(root, file)), `Missing ${file}`);
  }
});

test("Vercel admin auth requires Firebase ID token and optional App Check", () => {
  const auth = read("api/_lib/auth.js");
  assert.match(auth, /requireAppCheck\(req, res\)/);
  assert.match(auth, /auth\.verifyIdToken\(idToken\)/);
  assert.match(auth, /db\.collection\("users"\)\.doc\(decoded\.uid\)/);
});

test("Vercel user-management endpoints enforce superadmin and rate limiting", () => {
  const createUser = read("api/admin/create-user.js");
  const updateDeleteUser = read("api/admin/users/[uid].js");

  for (const source of [createUser, updateDeleteUser]) {
    assert.match(source, /requireSuperAdmin\(req, res\)/);
    assert.match(source, /checkRateLimit\(req, res\)/);
    assert.match(source, /applyCors\(req, res\)/);
  }
});

test("Vercel user-management endpoints enforce tenant isolation", () => {
  const createUser = read("api/admin/create-user.js");
  const updateDeleteUser = read("api/admin/users/[uid].js");

  assert.match(createUser, /churchId !== requester\.churchId/);
  assert.match(createUser, /churchId: requester\.churchId/);
  assert.match(updateDeleteUser, /existingUser\.churchId/);
  assert.match(updateDeleteUser, /existingUser\.churchId !== requester\.churchId/);
});

test("Vercel user-management prevents self destructive operations", () => {
  const source = read("api/admin/users/[uid].js");
  assert.match(source, /requester\.uid === uid/);
  assert.match(source, /Tidak dapat menghapus akun diri sendiri/);
  assert.match(source, /Super Admin tidak dapat mengubah role dirinya sendiri/);
});

test("Vercel public build keeps Firebase Admin server-side", () => {
  const firebaseAdmin = read("api/_lib/firebase-admin.js");
  const publicFirebase = read("js/firebase.js");

  assert.match(firebaseAdmin, /FIREBASE_PRIVATE_KEY/);
  assert.doesNotMatch(publicFirebase, /FIREBASE_PRIVATE_KEY/);
});
