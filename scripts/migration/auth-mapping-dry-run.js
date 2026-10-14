const fs = require('node:fs');
const path = require('node:path');

const datasetPath = path.resolve(process.argv[2] || '.migration-data.json');
const outputPath = path.resolve(process.argv[3] || '.auth-mapping-dry-run.json');

if (!fs.existsSync(datasetPath)) {
  console.error(`Migration dataset not found: ${datasetPath}`);
  process.exit(1);
}

const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
const users = dataset?.collections?.users;

if (!Array.isArray(users)) {
  console.error('Invalid migration dataset: collections.users must be an array.');
  process.exit(1);
}

const seenLegacy = new Set();
const duplicateLegacyUids = [];
const invalidRows = [];
const emailMap = new Map();
const duplicateEmails = [];

for (const user of users) {
  const legacyUid = user?.uid || user?.legacy_id;
  const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';

  if (!legacyUid || typeof legacyUid !== 'string') {
    invalidRows.push({ reason: 'missing_legacy_uid', user });
    continue;
  }

  if (seenLegacy.has(legacyUid)) duplicateLegacyUids.push(legacyUid);
  seenLegacy.add(legacyUid);

  if (!email) {
    invalidRows.push({ reason: 'missing_email', legacy_uid: legacyUid });
    continue;
  }

  if (emailMap.has(email)) {
    duplicateEmails.push({ email, legacy_uids: [emailMap.get(email), legacyUid] });
  } else {
    emailMap.set(email, legacyUid);
  }
}

const rows = users.map((user) => ({
  legacy_uid: user.uid || user.legacy_id,
  email: typeof user.email === 'string' ? user.email.trim().toLowerCase() : null,
  username: user.username || null,
  nama: user.nama || null,
  role: user.role || 'user',
  status: user.status || null,
  church_legacy_id: user.churchId || null,
  auth_user_id: null,
  status_mapping: 'PENDING_AUTH_CREATION',
}));

const result = {
  meta: {
    source: dataset?.meta?.source || 'firebase-backup',
    generatedAt: new Date().toISOString(),
    tool: 'auth-mapping-dry-run',
    version: '1.1.0',
  },
  summary: {
    users: users.length,
    uniqueLegacyUids: seenLegacy.size,
    uniqueEmails: emailMap.size,
    duplicateLegacyUids: duplicateLegacyUids.length,
    duplicateEmails: duplicateEmails.length,
    invalidRows: invalidRows.length,
  },
  rows,
  duplicateLegacyUids,
  duplicateEmails,
  invalidRows,
};

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

console.log(`Auth mapping dry-run written: ${outputPath}`);
console.log(`users: ${result.summary.users}`);
console.log(`unique legacy UIDs: ${result.summary.uniqueLegacyUids}`);
console.log(`unique emails: ${result.summary.uniqueEmails}`);
console.log(`duplicate legacy UIDs: ${result.summary.duplicateLegacyUids}`);
console.log(`duplicate emails: ${result.summary.duplicateEmails}`);
console.log(`invalid rows: ${result.summary.invalidRows}`);

if (duplicateLegacyUids.length || duplicateEmails.length || invalidRows.length) process.exitCode = 2;
