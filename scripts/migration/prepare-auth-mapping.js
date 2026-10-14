#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_INPUT = path.resolve('.migration-data-v4.json');
const DEFAULT_OUTPUT = path.resolve('.auth-mapping-dry-run.json');

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--input') args.input = path.resolve(argv[++i]);
    else if (value === '--output') args.output = path.resolve(argv[++i]);
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function usage() {
  console.log(`Usage:\n  node scripts/migration/prepare-auth-mapping.js [options]\n\nOptions:\n  --input <file>   Migration dataset (default: .migration-data-v4.json)\n  --output <file>  Mapping template (default: .auth-mapping-dry-run.json)\n\nThe generated file contains the six legacy Firebase UIDs and user metadata.\nFill auth_user_id with the real UUID from Supabase auth.users, then run:\n  node scripts/migration/audit-auth-mapping.js --mapping .auth-mapping-dry-run.json\n`);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  usage();
  process.exit(0);
}

function readJson(file) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) throw new Error(`File not found: ${absolute}`);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function asString(value) {
  if (value == null || value === '') return null;
  return String(value);
}

try {
  const args = parseArgs(process.argv.slice(2));
  const dataset = readJson(args.input);
  const users = Array.isArray(dataset?.collections?.users) ? dataset.collections.users : [];

  if (!users.length) throw new Error('Migration dataset contains no users.');

  const seen = new Set();
  const mappings = users.map((user) => {
    const firebaseUid = asString(user?.legacy_uid);
    if (!firebaseUid) throw new Error('A user is missing legacy_uid/Firebase UID.');
    if (seen.has(firebaseUid)) throw new Error(`Duplicate Firebase UID in dataset: ${firebaseUid}`);
    seen.add(firebaseUid);

    return {
      firebase_uid: firebaseUid,
      auth_user_id: null,
      church_legacy_id: asString(user?.church_legacy_id),
      legacy_user_ref: asString(user?.legacy_user_ref),
      nama: asString(user?.nama),
      email: asString(user?.email),
      username: asString(user?.username),
      role: asString(user?.role),
    };
  });

  const output = {
    version: 1,
    generated_at: new Date().toISOString(),
    source: path.relative(process.cwd(), path.resolve(args.input)),
    mappings,
  };

  fs.writeFileSync(args.output, JSON.stringify(output, null, 2) + '\n');

  console.log('Supabase Auth mapping template generated.');
  console.log(`Users: ${mappings.length}`);
  console.log(`Output: ${path.resolve(args.output)}`);
  console.log('Next: fill auth_user_id with the real Supabase auth.users UUID for every user.');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}
