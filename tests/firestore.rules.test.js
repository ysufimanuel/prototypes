const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc, getDoc } = require('firebase/firestore');
const { describe, test, before, after } = require('node:test');

describe('Firestore security rules', () => {
  let testEnv;

  const churchA = 'church-a';
  const churchB = 'church-b';
  const superadmin = 'superadmin-uid';
  const admin = 'admin-uid';
  const user = 'user-uid';
  const otherUser = 'other-user-uid';

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'cms-v6-rules-test',
      firestore: {
        rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      await setDoc(doc(db, 'churches', churchA), {
        name: 'Church A',
        superadminUid: superadmin,
      });
      await setDoc(doc(db, 'churches', churchB), {
        name: 'Church B',
        superadminUid: otherUser,
      });

      await setDoc(doc(db, 'users', superadmin), {
        uid: superadmin,
        role: 'superadmin',
        churchId: churchA,
        status: 'active',
      });
      await setDoc(doc(db, 'users', admin), {
        uid: admin,
        role: 'admin',
        churchId: churchA,
        status: 'active',
      });
      await setDoc(doc(db, 'users', user), {
        uid: user,
        role: 'user',
        churchId: churchA,
        status: 'active',
      });
      await setDoc(doc(db, 'users', otherUser), {
        uid: otherUser,
        role: 'user',
        churchId: churchB,
        status: 'active',
      });
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  test('unauthenticated users cannot read private church data', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'churches', churchA)));
  });

  test('superadmin can read and update own church', async () => {
    const db = testEnv.authenticatedContext(superadmin).firestore();
    await assertSucceeds(getDoc(doc(db, 'churches', churchA)));
    await assertSucceeds(updateDoc(doc(db, 'churches', churchA), { name: 'Church A Updated' }));
  });

  test('admin can read own church but cannot update church document', async () => {
    const db = testEnv.authenticatedContext(admin).firestore();
    await assertSucceeds(getDoc(doc(db, 'churches', churchA)));
    await assertFails(updateDoc(doc(db, 'churches', churchA), { name: 'Blocked' }));
  });

  test('regular user can read own church but cannot update it', async () => {
    const db = testEnv.authenticatedContext(user).firestore();
    await assertSucceeds(getDoc(doc(db, 'churches', churchA)));
    await assertFails(updateDoc(doc(db, 'churches', churchA), { name: 'Blocked' }));
  });

  test('cross-tenant users cannot read another church', async () => {
    const dbA = testEnv.authenticatedContext(superadmin).firestore();
    const dbB = testEnv.authenticatedContext(otherUser).firestore();

    await assertSucceeds(getDoc(doc(dbA, 'churches', churchA)));
    await assertFails(getDoc(doc(dbA, 'churches', churchB)));
    await assertFails(getDoc(doc(dbB, 'churches', churchA)));
  });

  test('admin can create and update tenant member data', async () => {
    const db = testEnv.authenticatedContext(admin).firestore();
    const memberRef = doc(db, 'churches', churchA, 'members', 'member-1');

    await assertSucceeds(setDoc(memberRef, { name: 'Member 1' }));
    await assertSucceeds(updateDoc(memberRef, { name: 'Member Updated' }));
  });

  test('regular user cannot create, update, or delete tenant member data', async () => {
    const db = testEnv.authenticatedContext(user).firestore();
    const memberRef = doc(db, 'churches', churchA, 'members', 'member-user');

    await assertFails(setDoc(memberRef, { name: 'Blocked' }));
    await assertFails(updateDoc(memberRef, { name: 'Blocked' }));
    await assertFails(deleteDoc(memberRef));
  });

  test('admin cannot delete tenant member data but superadmin can', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'churches', churchA, 'members', 'member-delete'), {
        name: 'Delete Test',
      });
    });

    const adminDb = testEnv.authenticatedContext(admin).firestore();
    await assertFails(deleteDoc(doc(adminDb, 'churches', churchA, 'members', 'member-delete')));

    const superadminDb = testEnv.authenticatedContext(superadmin).firestore();
    await assertSucceeds(deleteDoc(doc(superadminDb, 'churches', churchA, 'members', 'member-delete')));
  });

  test('website draft is writable by admin but not regular user', async () => {
    const adminDb = testEnv.authenticatedContext(admin).firestore();
    const userDb = testEnv.authenticatedContext(user).firestore();
    const configRef = doc(adminDb, 'churches', churchA, 'website', 'config');

    await assertSucceeds(setDoc(configRef, { siteName: 'Church A' }));
    await assertSucceeds(updateDoc(configRef, { siteName: 'Church A Updated' }));
    await assertFails(updateDoc(doc(userDb, 'churches', churchA, 'website', 'config'), { siteName: 'Blocked' }));
  });

  test('website page is writable by admin and not by user', async () => {
    const adminDb = testEnv.authenticatedContext(admin).firestore();
    const userDb = testEnv.authenticatedContext(user).firestore();
    const pageRef = doc(adminDb, 'churches', churchA, 'website', 'content', 'pages', 'home');

    await assertSucceeds(setDoc(pageRef, { title: 'Home' }));
    await assertFails(updateDoc(doc(userDb, 'churches', churchA, 'website', 'content', 'pages', 'home'), { title: 'Blocked' }));
  });

  test('public site and slug are readable but not writable', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'publicSites', churchA, 'config'), { siteName: 'Public Church' });
      await setDoc(doc(db, 'siteSlugs', 'church-a'), { churchId: churchA });
    });

    const publicDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(publicDb, 'publicSites', churchA, 'config')));
    await assertSucceeds(getDoc(doc(publicDb, 'siteSlugs', 'church-a')));
    await assertFails(setDoc(doc(publicDb, 'publicSites', churchA, 'config'), { siteName: 'Hacked' }));
    await assertFails(setDoc(doc(publicDb, 'siteSlugs', 'church-a'), { churchId: churchB }));
  });

  test('user cannot modify protected role, churchId, uid, status, or createdAt fields', async () => {
    const db = testEnv.authenticatedContext(user).firestore();
    const userRef = doc(db, 'users', user);

    for (const [field, value] of [
      ['uid', 'changed'],
      ['role', 'admin'],
      ['churchId', churchB],
      ['status', 'disabled'],
      ['createdAt', 'changed'],
    ]) {
      await assertFails(updateDoc(userRef, { [field]: value }));
    }
  });

  test('superadmin can update another user only inside the same church', async () => {
    const db = testEnv.authenticatedContext(superadmin).firestore();

    await assertSucceeds(updateDoc(doc(db, 'users', admin), { displayName: 'Admin Updated' }));
    await assertFails(updateDoc(doc(db, 'users', otherUser), { displayName: 'Cross Tenant Blocked' }));
  });
});
