#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_INPUT = path.resolve('.migration-data-v4.json');
const DEFAULT_MAPPING = path.resolve('scripts/migration/legacy-user-map.json');

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, mapping: DEFAULT_MAPPING, dryRun: true, output: null };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--input') args.input = path.resolve(argv[++i]);
    else if (value === '--mapping') args.mapping = path.resolve(argv[++i]);
    else if (value === '--dry-run') args.dryRun = true;
    else if (value === '--apply') args.dryRun = false;
    else if (value === '--output') args.output = path.resolve(argv[++i]);
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function usage() {
  console.log(`Usage: node scripts/migration/import-supabase.js [options]\n\nOptions:\n  --input <file>    Migration dataset (default: .migration-data-v4.json)\n  --mapping <file>  Legacy user mapping (default: scripts/migration/legacy-user-map.json)\n  --dry-run         Build/validate import plan without writing (default)\n  --apply           Reserved for the live Supabase importer; currently rejected\n  --output <file>   Write import plan JSON`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function asString(value) {
  if (value == null || value === '') return null;
  return String(value);
}

function rows(collections, name) {
  return Array.isArray(collections?.[name]) ? collections[name] : [];
}

function buildMapping(mappingRows) {
  const map = new Map();
  for (const row of Array.isArray(mappingRows) ? mappingRows : []) {
    const church = asString(row?.church_legacy_id);
    const legacy = asString(row?.legacy_user_ref);
    const uid = asString(row?.firebase_uid);
    if (!church || !legacy || !uid) throw new Error('Invalid legacy user mapping row.');
    const key = `${church}:${legacy}`;
    if (map.has(key) && map.get(key) !== uid) throw new Error(`Conflicting mapping for ${key}.`);
    map.set(key, uid);
  }
  return map;
}

function resolveLegacyUser(value, churchId, mapping) {
  const ref = asString(value);
  if (!ref) return null;
  const uid = mapping.get(`${asString(churchId)}:${ref}`);
  if (!uid) throw new Error(`Unresolved legacy user ref ${ref} for church ${churchId}.`);
  return uid;
}

function makePlan(dataset, mappingRows) {
  const collections = dataset?.collections;
  if (!collections || typeof collections !== 'object' || Array.isArray(collections)) {
    throw new Error('Migration dataset is missing collections.');
  }

  const mapping = buildMapping(mappingRows);
  const users = rows(collections, 'users');
  const knownUids = new Set(users.map((row) => asString(row?.legacy_uid)).filter(Boolean));

  const profiles = users.map((row) => ({
    legacy_uid: asString(row.legacy_uid),
    church_legacy_id: asString(row.church_legacy_id),
    nama: row.nama ?? null,
    username: row.username ?? null,
    email: row.email ?? null,
    role: row.role ?? 'user',
    status: row.status ?? null,
  }));

  for (const profile of profiles) {
    if (!knownUids.has(profile.legacy_uid)) throw new Error(`Profile references unknown Firebase UID ${profile.legacy_uid}.`);
  }

  const churches = rows(collections, 'churches').map((row) => ({
    legacy_id: asString(row.legacy_id),
    nama: row.nama ?? '',
    alamat: row.alamat ?? null,
    kota: row.kota ?? null,
    email: row.email ?? null,
    telepon: row.telepon ?? null,
    superadmin_legacy_uid: asString(row.superadmin_legacy_uid),
  }));

  for (const church of churches) {
    if (church.superadmin_legacy_uid && !knownUids.has(church.superadmin_legacy_uid)) {
      throw new Error(`Church ${church.legacy_id} references unknown superadmin UID ${church.superadmin_legacy_uid}.`);
    }
  }

  const resolved = [];
  for (const table of ['announcements', 'income_transactions', 'expense_transactions', 'approval_history']) {
    for (const row of rows(collections, table)) {
      const field = table === 'announcements' ? 'author_legacy_ref' : table === 'approval_history' ? 'by_legacy_ref' : 'approved_by_legacy_ref';
      if (row[field] == null) continue;
      resolved.push({
        table,
        legacy_id: asString(row.legacy_id),
        church_legacy_id: asString(row.church_legacy_id),
        source_ref: asString(row[field]),
        firebase_uid: resolveLegacyUser(row[field], row.church_legacy_id, mapping),
      });
    }
  }

  return {
    version: 1,
    mode: 'dry-run',
    source: dataset.source ?? null,
    counts: {
      churches: churches.length,
      profiles: profiles.length,
      resolvedLegacyUserRefs: resolved.length,
    },
    churches,
    profiles,
    resolvedLegacyUserRefs: resolved,
    assumptions: [
      'Supabase auth.users records are not created by this dry-run script.',
      'Firebase UID to Supabase auth UUID mapping must be supplied before live profile/message/notification import.',
      'Legacy numeric user refs are resolved only through the explicit tenant-scoped mapping file.',
    ],
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();
  if (!args.dryRun) throw new Error('--apply is intentionally disabled until Supabase auth.users mapping and live connection are configured.');

  const dataset = readJson(args.input);
  const mapping = readJson(args.mapping);
  const plan = makePlan(dataset, mapping);
  const output = args.output || path.resolve('.migration-import-plan.json');
  fs.writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');

  console.log('Supabase migration import plan generated.');
  console.log(`Mode: ${plan.mode}`);
  console.log(`Churches: ${plan.counts.churches}`);
  console.log(`Profiles: ${plan.counts.profiles}`);
  console.log(`Resolved legacy user refs: ${plan.counts.resolvedLegacyUserRefs}`);
  console.log(`Plan: ${output}`);
}

try {
  main();
} catch (error) {
  console.error(`Supabase import plan failed: ${error.message}`);
  process.exitCode = 1;
}
