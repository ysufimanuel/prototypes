#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

function argValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] || null;
}

function printHelp() {
  console.log(`Usage:\n  node scripts/migration/audit-auth-mapping.js --mapping <file> [--plan <file>]\n\nChecks the Firebase UID -> Supabase Auth UUID mapping before live migration.\n\nRequired mapping shape:\n{\n  "version": 1,\n  "mappings": [\n    {\n      "firebase_uid": "legacy-firebase-uid",\n      "auth_user_id": "supabase-auth-uuid"\n    }\n  ]\n}\n\nThe mapping file must contain real Supabase auth.users UUIDs. Do not invent UUIDs.\n`);
}

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const mappingFile = argValue('--mapping');
const planFile = argValue('--plan') || '.migration-import-plan.json';

if (!mappingFile) {
  console.error('ERROR: --mapping <file> is required.');
  printHelp();
  process.exit(1);
}

function readJson(file) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) {
    throw new Error(`File not found: ${absolute}`);
  }
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

function fail(message) {
  errors.push(message);
}

const errors = [];
const warnings = [];

try {
  const plan = readJson(planFile);
  const mappingDocument = readJson(mappingFile);
  const mappings = asArray(mappingDocument);

  if (!mappings.length) {
    fail('Mapping file contains no mappings.');
  }

  const firebaseToAuth = new Map();
  const authToFirebase = new Map();
  const mappingRows = new Map();

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
    mappingRows.set(firebaseUid, row);
  }

  const expectedFirebaseUids = setFrom([
    ...(plan.profiles || []).map((row) => row.firebase_uid || row.legacy_uid),
    ...(plan.resolvedLegacyUserRefs || []).map((row) => row.firebase_uid),
  ]);

  const mappedFirebaseUids = new Set(firebaseToAuth.keys());
  const missing = diffSet(expectedFirebaseUids, mappedFirebaseUids);
  const unexpected = diffSet(mappedFirebaseUids, expectedFirebaseUids);

  if (missing.length) {
    fail(`missing Auth mapping for Firebase UIDs: ${missing.join(', ')}`);
  }

  if (unexpected.length) {
    warnings.push(`mapping contains Firebase UIDs not referenced by the import plan: ${unexpected.join(', ')}`);
  }

  const resolvedRefs = plan.resolvedLegacyUserRefs || [];
  const unresolvedPlanRefs = resolvedRefs.filter((row) => {
    const firebaseUid = row?.firebase_uid == null ? '' : String(row.firebase_uid).trim();
    return firebaseUid && !firebaseToAuth.has(firebaseUid);
  });

  if (unresolvedPlanRefs.length) {
    fail(`resolved legacy user refs without Auth mapping: ${unresolvedPlanRefs.length}`);
  }

  const profiles = plan.profiles || [];
  const profilesWithoutAuthMapping = profiles.filter((row) => {
    const firebaseUid = row.firebase_uid || row.legacy_uid;
    return firebaseUid && !firebaseToAuth.has(String(firebaseUid));
  });

  if (profilesWithoutAuthMapping.length) {
    fail(`profiles without Auth mapping: ${profilesWithoutAuthMapping.length}`);
  }

  const mappedProfileUuids = new Set();
  for (const profile of profiles) {
    const firebaseUid = profile.firebase_uid || profile.legacy_uid;
    const authUserId = firebaseToAuth.get(String(firebaseUid));
    if (authUserId) mappedProfileUuids.add(authUserId);
  }

  console.log('Supabase Auth mapping audit');
  console.log(`Mapping file: ${path.resolve(mappingFile)}`);
  console.log(`Import plan: ${path.resolve(planFile)}`);
  console.log(`Firebase UIDs expected: ${expectedFirebaseUids.size}`);
  console.log(`Firebase UIDs mapped: ${mappedFirebaseUids.size}`);
  console.log(`Supabase Auth UUIDs mapped: ${authToFirebase.size}`);
  console.log(`Profiles covered: ${mappedProfileUuids.size}/${profiles.length}`);
  console.log(`Resolved legacy user refs covered: ${resolvedRefs.length - unresolvedPlanRefs.length}/${resolvedRefs.length}`);

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
