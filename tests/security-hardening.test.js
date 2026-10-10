const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { rateLimit, resetRateLimitStore } = require('../functions/rate-limit');
const { safeApiError } = require('../functions/error-response');

describe('Phase 5 security hardening', () => {
  beforeEach(() => resetRateLimitStore());

  test('rate limiter allows requests below the configured limit', () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 2 });
    const req = { ip: '10.0.0.1', headers: {}, socket: {} };
    let nextCount = 0;
    const res = { status() { return this; }, json() { return this; }, set() { return this; } };

    middleware(req, res, () => { nextCount += 1; });
    middleware(req, res, () => { nextCount += 1; });

    assert.equal(nextCount, 2);
  });

  test('rate limiter returns 429 after the configured limit', () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 1 });
    const req = { ip: '10.0.0.2', headers: {}, socket: {} };
    const response = { statusCode: null, headers: {}, body: null, status(code) { this.statusCode = code; return this; }, set(name, value) { this.headers[name] = value; return this; }, json(body) { this.body = body; return this; } };

    middleware(req, response, () => {});
    middleware(req, response, () => {});

    assert.equal(response.statusCode, 429);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, 'Terlalu banyak permintaan. Coba lagi nanti.');
    assert.ok(Number(response.headers['Retry-After']) >= 1);
  });

  test('rate limiter keeps separate clients independent', () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 1 });
    const makeReq = ip => ({ ip, headers: {}, socket: {} });
    const makeRes = () => ({ statusCode: null, status(code) { this.statusCode = code; return this; }, set() { return this; }, json() { return this; } });

    const first = makeRes();
    const second = makeRes();
    middleware(makeReq('10.0.0.3'), first, () => {});
    middleware(makeReq('10.0.0.4'), second, () => {});

    assert.equal(first.statusCode, null);
    assert.equal(second.statusCode, null);
  });

  test('unknown internal errors never expose error.message', () => {
    const response = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    const internal = new Error('SECRET_FIREBASE_STACK_OR_DATABASE_DETAIL');

    safeApiError(response, internal, 'Gagal memproses permintaan.');

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { success: false, message: 'Gagal memproses permintaan.' });
    assert.equal(JSON.stringify(response.body).includes('SECRET_FIREBASE_STACK_OR_DATABASE_DETAIL'), false);
  });

  test('known safe Firebase errors map to controlled public messages', () => {
    const response = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };

    safeApiError(response, { code: 'auth/email-already-exists', message: 'internal detail' }, 'Gagal membuat user.', {
      allowed: { 'auth/email-already-exists': 409 },
      messages: { 'auth/email-already-exists': 'Email sudah digunakan.' },
    });

    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.body, { success: false, message: 'Email sudah digunakan.' });
  });
});
