const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const PROJECT_ID = process.env.FIREBASE_TEST_PROJECT_ID || 'churchmanagementsystem-a77a3';
process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const { auth, db } = require('../functions/firebase-admin');
const { requireSuperAdmin, requireChurchAdmin } = require('../functions/auth-middleware');

const AUTH_HOST = 'http://127.0.0.1:9099';
const API_KEY = 'test-api-key';

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function createTestUser(role, churchId, suffix) {
  const uid = `auth-test-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${uid}@example.test`;
  const password = 'TestPassword123!';

  await auth.createUser({ uid, email, password });
  await db.collection('users').doc(uid).set({
    uid,
    email,
    role,
    churchId,
    status: 'active',
  });

  const response = await fetch(
    `${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );

  const payload = await response.json();
  assert.equal(response.ok, true, JSON.stringify(payload));
  return { uid, email, idToken: payload.idToken };
}

async function runMiddleware(middleware, authorization) {
  const req = { headers: authorization === undefined ? {} : { authorization } };
  const res = makeResponse();
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  return { req, res, nextCalled };
}

describe('Auth middleware security', () => {
  let users = [];

  before(async () => {
    users = [];
    for (const [role, churchId, suffix] of [
      ['superadmin', 'church-a', 'superadmin'],
      ['admin', 'church-a', 'admin'],
      ['user', 'church-a', 'user'],
    ]) {
      users.push(await createTestUser(role, churchId, suffix));
    }
  });

  after(async () => {
    await Promise.all(users.map(async ({ uid }) => {
      await auth.deleteUser(uid).catch(() => {});
      await db.collection('users').doc(uid).delete().catch(() => {});
    }));
  });

  test('missing Authorization header is rejected with 401', async () => {
    const result = await runMiddleware(requireSuperAdmin);
    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, 401);
  });

  test('malformed or invalid bearer token is rejected with 403', async () => {
    const result = await runMiddleware(requireSuperAdmin, 'Bearer definitely-invalid-token');
    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, 403);
  });

  test('regular user cannot pass church-admin middleware', async () => {
    const result = await runMiddleware(requireChurchAdmin, `Bearer ${users[2].idToken}`);
    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, 403);
  });

  test('admin can pass church-admin middleware but not superadmin middleware', async () => {
    const adminResult = await runMiddleware(requireChurchAdmin, `Bearer ${users[1].idToken}`);
    assert.equal(adminResult.nextCalled, true);
    assert.equal(adminResult.req.user.role, 'admin');
    assert.equal(adminResult.req.user.churchId, 'church-a');

    const superadminResult = await runMiddleware(requireSuperAdmin, `Bearer ${users[1].idToken}`);
    assert.equal(superadminResult.nextCalled, false);
    assert.equal(superadminResult.res.statusCode, 403);
  });

  test('superadmin receives trusted UID and churchId from verified profile', async () => {
    const result = await runMiddleware(requireSuperAdmin, `Bearer ${users[0].idToken}`);
    assert.equal(result.nextCalled, true);
    assert.equal(result.req.user.uid, users[0].uid);
    assert.equal(result.req.user.churchId, 'church-a');
    assert.equal(result.req.user.role, 'superadmin');
  });

  test('valid token without a Firestore profile is rejected', async () => {
    const uid = `auth-test-no-profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `${uid}@example.test`;
    const password = 'TestPassword123!';
    await auth.createUser({ uid, email, password });

    const response = await fetch(
      `${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    const payload = await response.json();
    assert.equal(response.ok, true, JSON.stringify(payload));

    const result = await runMiddleware(requireChurchAdmin, `Bearer ${payload.idToken}`);
    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, 403);

    await auth.deleteUser(uid).catch(() => {});
  });

  test('UID mismatch between token and Firestore profile is rejected', async () => {
    const target = users[1];
    await db.collection('users').doc(target.uid).set({
      uid: 'different-uid',
      email: target.email,
      role: 'admin',
      churchId: 'church-a',
      status: 'active',
    });

    const result = await runMiddleware(requireChurchAdmin, `Bearer ${target.idToken}`);
    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, 403);

    await db.collection('users').doc(target.uid).set({
      uid: target.uid,
      email: target.email,
      role: 'admin',
      churchId: 'church-a',
      status: 'active',
    });
  });
});
