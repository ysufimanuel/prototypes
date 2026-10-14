#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PLAN = path.resolve('.migration-import-plan.json');
const DEFAULT_AUTH_MAPPING = path.resolve('.auth-mapping-dry-run.json');
const DEFAULT_OUTPUT = path.resolve('.migration-import-plan-auth-resolved.json');

function parseArgs(argv) {
  const args = { plan: DEFAULT_PLAN, authMapping: DEFAULT_AUTH_MAPPING, output: DEFAULT_OUTPUT };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--plan') args.plan = path.resolve(argv[++i]);
    else if (value === '--auth-mapping') args.authMapping = path.resolve(argv[++i]);
    else if (value === '--output') args.output = path.resolve(argv[++i]);
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function usage() {
  console.log(`Usage: node scripts/migration/resolve-auth-import-plan.js [options]\n\nOptions:\n  --plan <file>          Existing migration import plan (default: .migration-import-plan.json)\n  --auth-mapping <file>  Firebase UID -> Supabase Auth UUID mapping (default: .auth-mapping-dry-run.json)\n  --output <file>        Write resolved plan (default: .migration-import-plan-auth-resolved.json)`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function asString(value) {
  if (value == null || value === '') return null;
  return String(value);
}

function buildAuthMapping(source) {
  const rows = Array.isArray(source)
    ? source
    : Array.isArray(source?.mappings)
      ? source.mappings
      : [];

  if (rows.length === 0) throw new Error('Supabase Auth mapping is empty.');

  const map = new Map();
  const uuidSet = new Set();

  for (const row of rows) {
    const firebaseUid = asString(row?.firebase_uid);
    const authUserId = asString(row?.auth_user_id);
    if (!firebaseUid || !authUserId) {
      throw new Error('Invalid Auth mapping row. Each row requires firebase_uid and auth_user_id.');
    }
    if (map.has(firebaseUid) && map.get(firebaseUid) !== authUserId) {
      throw new Error(`Conflicting Auth mapping for Firebase UID ${firebaseUid}.`);
    }
    if (uuidSet.has(authUserId) && map.get(firebaseUid) !== authUserId) {
      throw new Error(`Supabase Auth UUID ${authUserId} is mapped more than once.`);
    }
    map.set(firebaseUid, authUserId);
    uuidSet.add(authUserId);
  }

  return map;
}

function resolveUid(firebaseUid, authMap, sourceLabel) {
  const uid = asString(firebaseUid);
  if (!uid) return null;
  const authUserId = authMap.get(uid);
  if (!authUserId) {
    throw new Error(`${sourceLabel} references Firebase UID ${uid}, but no Supabase Auth UUID mapping exists.`);
  }
  return authUserId;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();

  const plan = readJson(args.plan);
  const authMappingSource = readJson(args.authMapping);
  const authMap = buildAuthMapping(authMappingSource);

  const profiles = Array.isArray(plan.tables?.profiles) ? plan.tables.profiles : [];
  const resolvedRefs = Array.isArray(plan.resolvedLegacyUserRefs) ? plan.resolvedLegacyUserRefs : [];

  const unresolved = [];
  const resolvedProfiles = profiles.map((profile) => {
    const firebaseUid = asString(profile.auth_user_legacy_uid || profile.legacy_uid);
    try {
      return {
        ...profile,
        auth_user_id: resolveUid(firebaseUid, authMap, `Profile ${firebaseUid}`),
      };
    } catch (error) {
      unresolved.push(error.message);
      return { ...profile };
    }
  });

  const resolvedUserRefs = resolvedRefs.map((row) => {
    try {
      return {
        ...row,
        auth_user_id: resolveUid(row.firebase_uid, authMap, `${row.table}/${row.legacy_id}`),
      };
    } catch (error) {
      unresolved.push(error.message);
      return { ...row };
    }
  });

  if (unresolved.length > 0) {
    throw new Error(`${unresolved.length} user references could not be mapped to Supabase Auth UUIDs. First: ${unresolved[0]}`);
  }

  const output = {
    ...plan,
    version: 3,
    mode: 'auth-resolved-dry-run',
    tables: {
      ...plan.tables,
      profiles: resolvedProfiles,
    },
    resolvedLegacyUserRefs: resolvedUserRefs,
    authMapping: {
      firebaseUidsExpected: profiles.length,
      firebaseUidsMapped: authMap.size,
      profilesResolved: resolvedProfiles.length,
      userRefsResolved: resolvedUserRefs.length,
      liveSupabaseWrite: false,
    },
    validation: {
      ...(plan.validation || {}),
      firebaseToSupabaseAuthMappingChecked: true,
      profilesHaveAuthUserId: resolvedProfiles.every((row) => Boolean(row.auth_user_id)),
      resolvedUserRefsHaveAuthUserId: resolvedUserRefs.every((row) => Boolean(row.auth_user_id)),
      liveSupabaseWrite: false,
    },
  };

  fs.writeFileSync(args.output, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log('Supabase Auth UUID resolution: PASS');
  console.log(`Firebase UIDs mapped: ${authMap.size}`);
  console.log(`Profiles resolved: ${resolvedProfiles.length}`);
  console.log(`Resolved legacy user refs: ${resolvedUserRefs.length}`);
  console.log(`Resolved plan: ${args.output}`);
  console.log('Live Supabase write: false');
}

try {
  main();
} catch (error) {
  console.error(`Supabase Auth resolution failed: ${error.message}`);
  process.exitCode = 1;
}
