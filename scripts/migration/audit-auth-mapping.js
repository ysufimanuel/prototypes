#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);

function argValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] || null;
}

function printHelp() {
  console.log(`Usage:
  node scripts/migration/audit-auth-mapping.js --mapping <file> [--input <file>] [--plan <file>]

Checks the Firebase UID -> Supabase Auth UUID mapping before live migration.

Required mapping shape:
{
  "version": 1,
  "mappings": [
    {
      "firebase_uid": "legacy-firebase-uid",
      "auth_user_id": "supabase-auth-uuid"
    }
  ]
}

The mapping file must contain real Supabase auth.users UUIDs. Do not invent UUIDs.
`);
}

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const mappingFile = argValue('--mapping');
const inputFile = argValue('--input') || '.migration-data-v4.json';
const planFile = argValue('--plan') || '.migration-import-plan.json';

if (!mappingFile) {
  console.error('ERROR: --mapping <file> is required.');
  printHelp();
  process.exit(1);
}

function readJson(file) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) throw new Error(`File not found: ${absolute}`);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.mappings)) return value.mappings;
  return [];
}

function setFrom(values) {
  return new Set(values.filter(Boolean).map(String));
}

function diffSet(left, right) {
  return [...left].filter((value) => !right.has(value));
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

try {
  const source = readJson(inputFile);
  const plan = readJson(planFile);
  const mappingDocument = readJson(mappingFile);
  const mappings = asArray(mappingDocument);
  const users = Array.isArray(source?.collections?.users) ? source.collections.users : [];

  if (!users.length) fail('Migration dataset contains no users.');
  if (!mappings.length) fail('Mapping file contains no mappings.');

  const sourceFirebaseUids = setFrom(users.map((row) => row?.legacy_uid));
  const firebaseToAuth = new Map();
  const authToFirebase = new Map();

  for (const [index, row] of mappings.entries()) {
    const rowNumber = index + 1;
    const firebaseUid = row?.firebase_uid == null ? '' : String(row.firebase_uid).trim();
    const authUserId = row?.auth_user_id == null ? '' : String(row.auth_user_id).trim();

    if (!firebaseUid) {
      fail(`mapping row ${rowNumber}: firebase_uid is required`);
      continue;
    }
    if (!authUserId) {
      fail(`mapping row ${rowNumber}: auth_user_id is required for ${firebaseUid}`);
      continue;
    }
    if (!isUuid(authUserId)) {
      fail(`mapping row ${rowNumber}: auth_user_id is not a valid UUID: ${authUserId}`);
    }

    if (firebaseToAuth.has(firebaseUid) && firebaseToAuth.get(firebaseUid) !== authUserId) {
      fail(`duplicate Firebase UID mapped to multiple Auth UUIDs: ${firebaseUid}`);
    }
    if (authToFirebase.has(authUserId) && authToFirebase.get(authUserId) !== firebaseUid) {
      fail(`multiple Firebase UIDs mapped to the same Auth UUID: ${authUserId}`);
    }

    firebaseToAuth.set(firebaseUid, authUserId);
    authToFirebase.set(authUserId, firebaseUid);
  }

  const mappedFirebaseUids = new Set(firebaseToAuth.keys());
  const missing = diffSet(sourceFirebaseUids, mappedFirebaseUids);
  const unexpected = diffSet(mappedFirebaseUids, sourceFirebaseUids);

  if (missing.length) fail(`missing Auth mapping for Firebase UIDs: ${missing.join(', ')}`);
  if (unexpected.length) warnings.push(`mapping contains Firebase UIDs not present in source users: ${unexpected.join(', ')}`);

  const resolvedRefs = Array.isArray(plan?.resolvedLegacyUserRefs) ? plan.resolvedLegacyUserRefs : [];
  const unresolvedRefs = resolvedRefs.filter((row) => {
    const firebaseUid = row?.firebase_uid == null ? '' : String(row.firebase_uid).trim();
    return firebaseUid && !firebaseToAuth.has(firebaseUid);
  });

  if (unresolvedRefs.length) {
    fail(`resolved legacy user refs without Auth mapping: ${unresolvedRefs.length}`);
  }

  const mappedSourceUsers = users.filter((row) => firebaseToAuth.has(String(row.legacy_uid))).length;

  console.log('Supabase Auth mapping audit');
  console.log(`Mapping file: ${path.resolve(mappingFile)}`);
  console.log(`Source users: ${path.resolve(inputFile)}`);
  console.log(`Import plan: ${path.resolve(planFile)}`);
  console.log(`Firebase UIDs expected: ${sourceFirebaseUids.size}`);
  console.log(`Firebase UIDs mapped: ${mappedFirebaseUids.size}`);
  console.log(`Supabase Auth UUIDs mapped: ${authToFirebase.size}`);
  console.log(`Source users covered: ${mappedSourceUsers}/${users.length}`);
  console.log(`Resolved legacy user refs covered: ${resolvedRefs.length - unresolvedRefs.length}/${resolvedRefs.length}`);

  if (errors.length) {
    console.error(`FAIL: ${errors.length} error(s)`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('PASS');
  if (warnings.length) {
    console.log(`Warnings: ${warnings.length}`);
    for (const warning of warnings) console.log(`- ${warning}`);
  }
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}
