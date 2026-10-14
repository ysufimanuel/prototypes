#!/usr/bin/env node

/**
 * Firebase -> Supabase Auth migration helper.
 *
 * This script is intentionally NOT an execution script yet.
 * It validates the auth migration contract and emits the exact rows that
 * a future service-role importer must create.
 *
 * Why this is separate from the live importer:
 * - Firebase backup contains no password hashes.
 * - Supabase auth.users must be created with Supabase UUIDs.
 * - We must map every legacy Firebase UID before importing dependent rows.
 * - No secret/service-role key should ever be committed to the repository.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const inputPath = path.join(root, '.auth-migration-dry-run.json');
const outputPath = path.join(root, '.auth-migration-plan.json');

if (!fs.existsSync(inputPath)) {
  console.error(`Auth migration dry-run not found: ${inputPath}`);
  console.error('Run: node scripts/migration/auth-mapping-dry-run.js');
  process.exit(1);
}

const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const rows = input?.rows ?? [];

const errors = [];
const seenUids = new Set();
const seenEmails = new Set();

const planned = rows.map((row, index) => {
  const legacyUid = String(row.legacy_uid ?? '').trim();
  const email = String(row.email ?? '').trim().toLowerCase();

  if (!legacyUid) errors.push(`row ${index}: missing legacy_uid`);
  if (!email) errors.push(`row ${index}: missing email`);
  if (legacyUid && seenUids.has(legacyUid)) {
    errors.push(`row ${index}: duplicate legacy_uid ${legacyUid}`);
  }
  if (email && seenEmails.has(email)) {
    errors.push(`row ${index}: duplicate email ${email}`);
  }

  if (legacyUid) seenUids.add(legacyUid);
  if (email) seenEmails.add(email);

  return {
    legacy_uid: legacyUid,
    email,
    username: row.username ?? null,
    nama: row.nama ?? null,
    role: row.role ?? 'user',
    status: row.status ?? null,
    church_legacy_id: row.church_legacy_id ?? null,
    auth_user_id: null,
    action: 'CREATE_AUTH_USER_THEN_PROFILE_AND_UID_MAP',
    password_strategy: 'RESET_REQUIRED',
  };
});

const plan = {
  generated_at: new Date().toISOString(),
  execution_enabled: false,
  source: '.auth-migration-dry-run.json',
  total_users: planned.length,
  unique_legacy_uids: seenUids.size,
  unique_emails: seenEmails.size,
  errors,
  security_notes: [
    'Requires Supabase service-role credentials supplied through environment variables only.',
    'Never commit service-role keys, access tokens, or generated passwords.',
    'Firebase password hashes are not present in the backup and will not be imported.',
    'Each created Supabase auth user must be mapped in firebase_uid_map before dependent data is imported.',
    'profiles.church_id must resolve from the legacy church mapping, never from untrusted client input.',
  ],
  rows: planned,
};

fs.writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');

console.log(`Auth migration plan written: ${outputPath}`);
console.log(`users: ${planned.length}`);
console.log(`unique legacy UIDs: ${seenUids.size}`);
console.log(`unique emails: ${seenEmails.size}`);
console.log(`errors: ${errors.length}`);
console.log('execution_enabled: false');
console.log('No Supabase Auth users were created.');

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(2);
}
