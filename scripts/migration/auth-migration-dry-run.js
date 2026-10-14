#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const inputPath = path.join(root, '.migration-data.json');
const outputPath = path.join(root, '.auth-migration-dry-run.json');

if (!fs.existsSync(inputPath)) {
  console.error(`Migration dataset not found: ${inputPath}`);
  console.error('Run: node scripts/migration/transform.js backup.json');
  process.exit(1);
}

const dataset = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const users = dataset?.collections?.users?.rows ?? [];

const errors = [];
const seenUids = new Set();
const seenEmails = new Set();

const rows = users.map((user, index) => {
  const legacyUid = String(user.legacy_id ?? user.uid ?? '').trim();
  const email = String(user.email ?? '').trim().toLowerCase();

  if (!legacyUid) errors.push(`row ${index}: missing legacy Firebase UID`);
  if (!email) errors.push(`row ${index}: missing email`);

  if (legacyUid && seenUids.has(legacyUid)) {
    errors.push(`row ${index}: duplicate legacy UID ${legacyUid}`);
  }
  if (email && seenEmails.has(email)) {
    errors.push(`row ${index}: duplicate email ${email}`);
  }

  if (legacyUid) seenUids.add(legacyUid);
  if (email) seenEmails.add(email);

  return {
    legacy_uid: legacyUid,
    email,
    username: user.username ?? null,
    nama: user.nama ?? null,
    role: user.role ?? 'user',
    status: user.status ?? null,
    church_legacy_id: user.churchId ?? null,
    auth_user_id: null,
    mapping_status: 'PENDING_AUTH_CREATION',
  };
});

const result = {
  generated_at: new Date().toISOString(),
  source: '.migration-data.json',
  total_users: rows.length,
  unique_legacy_uids: seenUids.size,
  unique_emails: seenEmails.size,
  errors,
  rows,
};

fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

console.log(`Auth migration dry-run written: ${outputPath}`);
console.log(`users: ${rows.length}`);
console.log(`unique legacy UIDs: ${seenUids.size}`);
console.log(`unique emails: ${seenEmails.size}`);
console.log(`errors: ${errors.length}`);

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(2);
}

console.log('Auth migration preflight: PASS');
console.log('No Supabase Auth users were created.');
console.log('No passwords were imported or changed.');
