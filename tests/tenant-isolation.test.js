const assert = require('node:assert/strict');
const { describe, test } = require('node:test');
const { sameChurch } = require('../functions/tenant-access');

describe('Tenant isolation', () => {
  test('same church is allowed', () => {
    assert.equal(
      sameChurch(
        { uid: 'admin-a', churchId: 'church-a' },
        { uid: 'user-a', churchId: 'church-a' },
      ),
      true,
    );
  });

  test('different churches are denied', () => {
    assert.equal(
      sameChurch(
        { uid: 'admin-a', churchId: 'church-a' },
        { uid: 'user-b', churchId: 'church-b' },
      ),
      false,
    );
  });

  test('missing requester church is denied', () => {
    assert.equal(
      sameChurch(
        { uid: 'admin-a' },
        { uid: 'user-a', churchId: 'church-a' },
      ),
      false,
    );
  });

  test('missing target church is denied', () => {
    assert.equal(
      sameChurch(
        { uid: 'admin-a', churchId: 'church-a' },
        { uid: 'legacy-user' },
      ),
      false,
    );
  });

  test('empty or falsy church ids are denied', () => {
    assert.equal(sameChurch({ churchId: '' }, { churchId: 'church-a' }), false);
    assert.equal(sameChurch({ churchId: 'church-a' }, { churchId: '' }), false);
    assert.equal(sameChurch({}, {}), false);
  });
});
