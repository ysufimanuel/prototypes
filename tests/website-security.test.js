const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  getDoc,
  setDoc,
} = require('firebase/firestore');

const PROJECT_ID = process.env.FIREBASE_TEST_PROJECT_ID || 'churchmanagementsystem-a77a3';
process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const { auth, db } = require('../functions/firebase-admin');
const websiteRouter = require('../functions/website');

const AUTH_HOST = 'http://127.0.0.1:9099';
const API_KEY = 'test-api-key';
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const CHURCH_A = `website-a-${RUN_ID}`;
const CHURCH_B = `website-b-${RUN_ID}`;
const CHURCH_A_NAME = `Church A ${RUN_ID}`;
const CHURCH_B_NAME = `Church B ${RUN_ID}`;

let server;
let baseUrl;
let users = [];
let rulesTestEnv;
let churchASlug;

async function createTestUser(role, churchId, suffix) {
  const uid = `website-test-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${uid}@example.test`;
  const password = 'TestPassword123!';

  await auth.createUser({ uid, email, password });
  await db.collection('users').doc(uid).set({
    uid,
    nama: `Website Test ${suffix}`,
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
  return { uid, email, idToken: payload.idToken };
}

async function apiRequest(method, requestPath, token, body) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${baseUrl}${requestPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  return { status: response.status, body: payload };
}

async function seedChurch(churchId, name) {
  await db.collection('churches').doc(churchId).set({
    nama: name,
    superadminUid: users.find(u => u.churchId === churchId && u.role === 'superadmin')?.uid || null,
  });
}

async function cleanupSiteSlugsForChurch(churchId) {
  const snapshot = await db.collection('siteSlugs').where('churchId', '==', churchId).get();
  const batch = db.batch();
  snapshot.forEach(docSnap => batch.delete(docSnap.ref));
  if (!snapshot.empty) await batch.commit();
}

describe('Website publish and public access security', () => {
  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin/website', websiteRouter);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    users.push({ ...(await createTestUser('superadmin', CHURCH_A, 'superadmin-a')), role: 'superadmin', churchId: CHURCH_A });
    users.push({ ...(await createTestUser('admin', CHURCH_A, 'admin-a')), role: 'admin', churchId: CHURCH_A });
    users.push({ ...(await createTestUser('user', CHURCH_A, 'user-a')), role: 'user', churchId: CHURCH_A });
    users.push({ ...(await createTestUser('superadmin', CHURCH_B, 'superadmin-b')), role: 'superadmin', churchId: CHURCH_B });

    await seedChurch(CHURCH_A, CHURCH_A_NAME);
    await seedChurch(CHURCH_B, CHURCH_B_NAME);

    const rulesPath = path.join(__dirname, '..', 'firestore.rules');
    rulesTestEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: fs.readFileSync(rulesPath, 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  after(async () => {
    if (rulesTestEnv) await rulesTestEnv.cleanup();
    for (const { uid } of users) {
      await auth.deleteUser(uid).catch(() => {});
      await db.collection('users').doc(uid).delete().catch(() => {});
    }
    await db.collection('churches').doc(CHURCH_A).delete().catch(() => {});
    await db.collection('churches').doc(CHURCH_B).delete().catch(() => {});
    await db.collection('publicSites').doc(CHURCH_A).delete().catch(() => {});
    await db.collection('publicSites').doc(CHURCH_B).delete().catch(() => {});
    await cleanupSiteSlugsForChurch(CHURCH_A);
    await cleanupSiteSlugsForChurch(CHURCH_B);
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  test('unauthenticated website draft access is rejected', async () => {
    const result = await apiRequest('GET', '/api/admin/website/draft');
    assert.equal(result.status, 401);
  });

  test('regular user cannot provision or publish a website', async () => {
    const provision = await apiRequest('POST', '/api/admin/website/provision', users[2].idToken, {});
    assert.equal(provision.status, 403);

    const publish = await apiRequest('POST', '/api/admin/website/publish', users[2].idToken, {});
    assert.equal(publish.status, 403);
  });

  test('church admin can provision and publish only its own church website', async () => {
    const provision = await apiRequest('POST', '/api/admin/website/provision', users[1].idToken, {});
    assert.equal(provision.status, 200);
    assert.equal(provision.body.success, true);
    assert.equal(typeof provision.body.slug, 'string');
    assert.ok(provision.body.slug.length > 0);
    churchASlug = provision.body.slug;

    const publish = await apiRequest('POST', '/api/admin/website/publish', users[1].idToken, {});
    assert.equal(publish.status, 200);
    assert.equal(publish.body.success, true);
    assert.equal(publish.body.slug, churchASlug);
  });

  test('published public data contains only published pages', async () => {
    const source = db.collection('churches').doc(CHURCH_A).collection('website').doc('content').collection('pages');
    await source.doc('public-page').set({
      title: 'Public Page',
      slug: '/public-page',
      published: true,
      sections: [{ id: 'hero', type: 'hero', enabled: true, order: 1, config: { title: 'Hello' } }],
    });
    await source.doc('draft-page').set({
      title: 'Private Draft',
      slug: '/draft-page',
      published: false,
      sections: [{ id: 'secret', type: 'hero', enabled: true, order: 1, config: { title: 'Secret' } }],
    });

    const publish = await apiRequest('POST', '/api/admin/website/publish', users[1].idToken, {});
    assert.equal(publish.status, 200);

    const publicPage = await db.collection('publicSites').doc(CHURCH_A).collection('pages').doc('public-page').get();
    const draftPage = await db.collection('publicSites').doc(CHURCH_A).collection('pages').doc('draft-page').get();
    assert.equal(publicPage.exists, true);
    assert.equal(draftPage.exists, false);
  });

  test('cross-church admin cannot write church B website through its own token', async () => {
    const result = await apiRequest('PUT', '/api/admin/website/draft', users[1].idToken, {
      config: { siteName: 'Should Stay Church A' },
      pages: [],
    });
    assert.equal(result.status, 200);

    const churchBConfig = await db.collection('churches').doc(CHURCH_B).collection('website').doc('config').get();
    assert.equal(churchBConfig.exists, false);
  });

  test('public users can read published site data', async () => {
    const publicContext = rulesTestEnv.unauthenticatedContext();
    const configRef = doc(publicContext.firestore(), 'publicSites', CHURCH_A, 'config', 'site');
    const slugRef = doc(publicContext.firestore(), 'siteSlugs', churchASlug);
    assert.equal((await assertSucceeds(getDoc(configRef))).exists(), true);
    assert.equal((await assertSucceeds(getDoc(slugRef))).exists(), true);
  });

  test('public users cannot write publicSites or siteSlugs', async () => {
    const publicContext = rulesTestEnv.unauthenticatedContext();
    const publicConfig = doc(publicContext.firestore(), 'publicSites', CHURCH_A, 'config', 'site');
    const slugRef = doc(publicContext.firestore(), 'siteSlugs', churchASlug);
    await assertFails(setDoc(publicConfig, { enabled: false }));
    await assertFails(setDoc(slugRef, { churchId: CHURCH_B }));
  });

  test('public site slug cannot be read as a different church', async () => {
    const publicContext = rulesTestEnv.unauthenticatedContext();
    const slug = await getDoc(doc(publicContext.firestore(), 'siteSlugs', churchASlug));
    assert.equal(slug.exists(), true);
    assert.equal(slug.data().churchId, CHURCH_A);
  });

  test('published config is marked enabled and published', async () => {
    const config = await db.collection('publicSites').doc(CHURCH_A).collection('config').doc('site').get();
    assert.equal(config.exists, true);
    assert.equal(config.data().enabled, true);
    assert.equal(typeof config.data().publishedAt.toDate, 'function');
    assert.equal(typeof config.data().publishedBy, 'string');
  });

  test('site slug is unique and points to the owning church', async () => {
    const slug = await db.collection('siteSlugs').doc(churchASlug).get();
    assert.equal(slug.exists, true);
    assert.equal(slug.data().churchId, CHURCH_A);

    const churchBSlug = await db.collection('siteSlugs').doc('church-b').get();
    assert.equal(churchBSlug.exists, false);
  });
});
