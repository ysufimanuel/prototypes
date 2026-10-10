const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');

const { createAppCheckMiddleware } = require('../functions/app-check-middleware');

const testVerifyToken = async (token) => {
  if (token === 'test-valid-app-check-token') {
    return { appId: 'test-app-id', aud: ['projects/test-project/apps/test-app'] };
  }
  throw new Error('invalid App Check token');
};

function makeServer() {
  const app = express();
  app.get('/protected', createAppCheckMiddleware({ verifyToken: testVerifyToken }), (req, res) => {
    res.json({ success: true, appId: req.appCheck?.appId || null });
  });
  return http.createServer(app);
}

async function request(server, token) {
  const address = server.address();
  const headers = {};
  if (token) headers['X-Firebase-AppCheck'] = token;
  const response = await fetch(`http://127.0.0.1:${address.port}/protected`, { headers });
  return { status: response.status, body: await response.json() };
}

describe('App Check middleware', () => {
  let server;

  test('disabled App Check allows request for local/default mode', async () => {
    delete process.env.APP_CHECK_ENFORCED;
    server = makeServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const result = await request(server);
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    await new Promise((resolve) => server.close(resolve));
  });

  test('enforced App Check rejects missing token', async () => {
    process.env.APP_CHECK_ENFORCED = 'true';
    server = makeServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const result = await request(server);
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { success: false, message: 'App Check diperlukan.' });
    await new Promise((resolve) => server.close(resolve));
  });

  test('enforced App Check rejects invalid token', async () => {
    process.env.APP_CHECK_ENFORCED = 'true';
    server = makeServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const result = await request(server, 'invalid-token');
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { success: false, message: 'App Check tidak valid.' });
    await new Promise((resolve) => server.close(resolve));
  });

  test('valid App Check token reaches the protected route', async () => {
    process.env.APP_CHECK_ENFORCED = 'true';
    server = makeServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const result = await request(server, 'test-valid-app-check-token');
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.appId, 'test-app-id');
    await new Promise((resolve) => server.close(resolve));
  });
});
