const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');

const PROJECT_ID = process.env.FIREBASE_TEST_PROJECT_ID || 'churchmanagementsystem-a77a3';
process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const { auth, db } = require('../functions/firebase-admin');
const adminUsersRouter = require('../functions/admin-users');

const AUTH_HOST = 'http://127.0.0.1:9099';
const API_KEY = 'test-api-key';

let server;
let baseUrl;
let users = [];

async function createTestUser(role, churchId, suffix) {
  const uid = `api-test-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${uid}@example.test`;
  const password = 'TestPassword123!';

  await auth.createUser({ uid, email, password });
  await db.collection('users').doc(uid).set({
    uid,
    nama: `Test ${suffix}`,
    username: uid,
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
  return { uid, email, password, idToken: payload.idToken };
}

async function apiRequest(method, path, token, body) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  return { status: response.status, body: payload };
}

async function createLocalUserForApi() {
  return createTestUser('user', 'church-a', `target-${Date.now()}`);
}

describe('Admin users API security', () => {
  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminUsersRouter);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    users.push(await createTestUser('superadmin', 'church-a', 'superadmin'));
    users.push(await createTestUser('admin', 'church-a', 'admin'));
    users.push(await createTestUser('user', 'church-a', 'user'));
    users.push(await createTestUser('superadmin', 'church-b', 'superadmin-b'));
  });

  after(async () => {
    for (const { uid } of users) {
      await auth.deleteUser(uid).catch(() => {});
      await db.collection('users').doc(uid).delete().catch(() => {});
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('unauthenticated create-user is rejected with 401', async () => {
    const result = await apiRequest('POST', '/api/admin/create-user', null, {});
    assert.equal(result.status, 401);
  });

  test('regular user cannot call create-user', async () => {
    const result = await apiRequest('POST', '/api/admin/create-user', users[2].idToken, {
      nama: 'Blocked User',
      username: `blocked-${Date.now()}`,
      email: `blocked-${Date.now()}@example.test`,
      password: 'TestPassword123!',
      role: 'user',
    });
    assert.equal(result.status, 403);
  });

  test('admin cannot call superadmin-only user management endpoints', async () => {
    const result = await apiRequest('POST', '/api/admin/create-user', users[1].idToken, {
      nama: 'Blocked Admin',
      username: `blocked-admin-${Date.now()}`,
      email: `blocked-admin-${Date.now()}@example.test`,
      password: 'TestPassword123!',
      role: 'user',
    });
    assert.equal(result.status, 403);
  });

  test('superadmin cannot create a user in another church', async () => {
    const result = await apiRequest('POST', '/api/admin/create-user', users[0].idToken, {
      nama: 'Cross Church User',
      username: `cross-${Date.now()}`,
      email: `cross-${Date.now()}@example.test`,
      password: 'TestPassword123!',
      role: 'user',
      churchId: 'church-b',
    });
    assert.equal(result.status, 403);
  });

  test('superadmin-created user is bound to requester church', async () => {
    const username = `created-${Date.now()}`;
    const email = `${username}@example.test`;
    const result = await apiRequest('POST', '/api/admin/create-user', users[0].idToken, {
      nama: 'Created User',
      username,
      email,
      password: 'TestPassword123!',
      role: 'user',
    });

    assert.equal(result.status, 201);
    assert.equal(result.body.success, true);
    assert.equal(result.body.user.churchId, 'church-a');
    assert.equal(result.body.user.role, 'user');

    users.push({ uid: result.body.user.uid });
  });

  test('superadmin cannot update a user from another church', async () => {
    const target = users[3];
    const result = await apiRequest('PATCH', `/api/admin/users/${target.uid}`, users[0].idToken, {
      nama: 'Should Not Update',
    });
    assert.equal(result.status, 403);
  });

  test('superadmin cannot delete a user from another church', async () => {
    const target = users[3];
    const result = await apiRequest('DELETE', `/api/admin/users/${target.uid}`, users[0].idToken);
    assert.equal(result.status, 403);

    const stillExists = await db.collection('users').doc(target.uid).get();
    assert.equal(stillExists.exists, true);
  });

  test('superadmin cannot change its own role', async () => {
    const target = users[0];
    const result = await apiRequest('PATCH', `/api/admin/users/${target.uid}`, target.idToken, {
      role: 'user',
    });
    assert.equal(result.status, 403);

    const profile = await db.collection('users').doc(target.uid).get();
    assert.equal(profile.data().role, 'superadmin');
  });
});
