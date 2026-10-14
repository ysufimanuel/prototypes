#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PLAN = path.resolve('.migration-import-plan.json');
const DEFAULT_AUTH_MAPPING = path.resolve('.auth-mapping-dry-run.json');
const DEFAULT_LEGACY_USER_MAP = path.resolve('scripts/migration/legacy-user-map.json');
const DEFAULT_OUTPUT = path.resolve('.migration-import-plan-auth-resolved.json');

function parseArgs(argv) {
  const args = {
    plan: DEFAULT_PLAN,
    authMapping: DEFAULT_AUTH_MAPPING,
    legacyUserMap: DEFAULT_LEGACY_USER_MAP,
    output: DEFAULT_OUTPUT,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--plan') args.plan = path.resolve(argv[++i]);
    else if (value === '--auth-mapping') args.authMapping = path.resolve(argv[++i]);
    else if (value === '--legacy-user-map') args.legacyUserMap = path.resolve(argv[++i]);
    else if (value === '--output') args.output = path.resolve(argv[++i]);
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function usage() {
  console.log(`Usage: node scripts/migration/resolve-auth-import-plan.js [options]\n\nOptions:\n  --plan <file>              Existing migration import plan (default: .migration-import-plan.json)\n  --auth-mapping <file>      Firebase UID -> Supabase Auth UUID mapping (default: .auth-mapping-dry-run.json)\n  --legacy-user-map <file>   Legacy user ref -> Firebase UID mapping (default: scripts/migration/legacy-user-map.json)\n  --output <file>            Write resolved plan (default: .migration-import-plan-auth-resolved.json)`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function asString(value) {
  if (value == null || value === '') return null;
  return String(value);
}

function buildAuthMapping(source) {
  const rows = Array.isArray(source) ? source : source?.mappings;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Supabase Auth mapping is empty.');

  const map = new Map();
  const uuidSet = new Set();
  for (const row of rows) {
    const firebaseUid = asString(row?.firebase_uid);
    const authUserId = asString(row?.auth_user_id);
    if (!firebaseUid || !authUserId) throw new Error('Invalid Auth mapping row. Each row requires firebase_uid and auth_user_id.');
    if (map.has(firebaseUid) && map.get(firebaseUid) !== authUserId) throw new Error(`Conflicting Auth mapping for Firebase UID ${firebaseUid}.`);
    if (uuidSet.has(authUserId) && map.get(firebaseUid) !== authUserId) throw new Error(`Supabase Auth UUID ${authUserId} is mapped more than once.`);
    map.set(firebaseUid, authUserId);
    uuidSet.add(authUserId);
  }
  return map;
}

function buildLegacyUserMapping(source) {
  const rows = Array.isArray(source) ? source : source?.mappings;
  if (!Array.isArray(rows)) throw new Error('Legacy user mapping is invalid. Expected a mappings array.');

  const map = new Map();
  for (const row of rows) {
    const churchLegacyId = asString(row?.church_legacy_id);
    const legacyUserRef = asString(row?.legacy_user_ref);
    const firebaseUid = asString(row?.firebase_uid);
    if (!churchLegacyId || !legacyUserRef || !firebaseUid) {
      throw new Error('Invalid legacy user mapping row. Each row requires church_legacy_id, legacy_user_ref and firebase_uid.');
    }
    const key = `${churchLegacyId}:${legacyUserRef}`;
    if (map.has(key) && map.get(key) !== firebaseUid) throw new Error(`Conflicting legacy user mapping for ${key}.`);
    map.set(key, firebaseUid);
  }
  return map;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function resolveUid(value, churchLegacyId, authMap, legacyUserMap, sourceLabel) {
  const ref = asString(value);
  if (!ref) return null;

  // The resolver can be run repeatedly. If a previous run already materialized
  // a Supabase Auth UUID, keep it instead of treating the UUID as a Firebase UID.
  if (isUuid(ref) && [...authMap.values()].includes(ref)) return { firebaseUid: null, authUserId: ref };

  // Most references are already Firebase UIDs.
  const directAuthUserId = authMap.get(ref);
  if (directAuthUserId) return { firebaseUid: ref, authUserId: directAuthUserId };

  // Some legacy Firestore fields contain a church-local user ref such as "1".
  // Resolve that legacy ref to its Firebase UID first, scoped by church.
  const legacyKey = `${asString(churchLegacyId)}:${ref}`;
  const firebaseUid = legacyUserMap.get(legacyKey);
  if (!firebaseUid) {
    throw new Error(`${sourceLabel} references user ref ${ref} for church ${churchLegacyId}, but neither a Firebase UID nor a scoped legacy-user mapping exists.`);
  }

  const authUserId = authMap.get(firebaseUid);
  if (!authUserId) {
    throw new Error(`${sourceLabel} legacy user ref ${ref} for church ${churchLegacyId} resolves to Firebase UID ${firebaseUid}, but no Supabase Auth UUID mapping exists.`);
  }

  return { firebaseUid, authUserId };
}

function materializeUserFields(plan, authMap, legacyUserMap) {
  const tables = { ...plan.tables };
  const resolvedRefs = [];
  const unresolved = [];

  const specs = {
    churches: [['superadmin_legacy_uid', 'superadmin_auth_user_id']],
    income_transactions: [['approved_by_legacy_ref', 'approved_by_auth_user_id']],
    expense_transactions: [['approved_by_legacy_ref', 'approved_by_auth_user_id']],
    approval_history: [['by_legacy_ref', 'by_auth_user_id']],
    announcements: [['author_legacy_ref', 'author_auth_user_id']],
    websites: [['published_by_legacy_ref', 'published_by_auth_user_id'], ['updated_by_legacy_ref', 'updated_by_auth_user_id']],
    website_pages: [['updated_by_legacy_ref', 'updated_by_auth_user_id']],
    website_navigation: [['updated_by_legacy_ref', 'updated_by_auth_user_id']],
    publicSites: [['published_by_legacy_ref', 'published_by_auth_user_id']],
    notification_recipients: [['user_legacy_uid', 'user_auth_user_id']],
    messages: [['sender_legacy_uid', 'sender_auth_user_id'], ['receiver_legacy_uid', 'receiver_auth_user_id']],
    profiles: [['updated_by_legacy_uid', 'updated_by_auth_user_id']],
  };

  for (const [table, fields] of Object.entries(specs)) {
    const sourceRows = Array.isArray(tables[table]) ? tables[table] : [];
    tables[table] = sourceRows.map((row) => {
      const next = { ...row };
      for (const [sourceField, targetField] of fields) {
        if (next[sourceField] == null) {
          next[targetField] = null;
          continue;
        }
        try {
          const resolved = resolveUid(
            next[sourceField],
            next.church_legacy_id,
            authMap,
            legacyUserMap,
            `${table}/${next.legacy_id ?? next.church_legacy_id ?? 'row'}/${sourceField}`,
          );
          next[targetField] = resolved.authUserId;
          resolvedRefs.push({
            table,
            legacy_id: asString(next.legacy_id),
            church_legacy_id: asString(next.church_legacy_id),
            source_field: sourceField,
            source_ref: asString(next[sourceField]),
            firebase_uid: resolved.firebaseUid,
            auth_user_id: resolved.authUserId,
          });
        } catch (error) {
          unresolved.push(error.message);
        }
      }
      return next;
    });
  }

  return { tables, resolvedRefs, unresolved };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();

  const plan = readJson(args.plan);
  const authMap = buildAuthMapping(readJson(args.authMapping));
  const legacyUserMap = buildLegacyUserMapping(readJson(args.legacyUserMap));
  const profiles = Array.isArray(plan.tables?.profiles) ? plan.tables.profiles : [];

  const resolvedProfiles = profiles.map((profile) => {
    const resolved = resolveUid(
      profile.auth_user_legacy_uid || profile.legacy_uid,
      profile.church_legacy_id,
      authMap,
      legacyUserMap,
      `Profile ${profile.legacy_uid}`,
    );
    return {
      ...profile,
      auth_user_id: resolved.authUserId,
    };
  });

  const materialized = materializeUserFields(
    { ...plan, tables: { ...plan.tables, profiles: resolvedProfiles } },
    authMap,
    legacyUserMap,
  );
  if (materialized.unresolved.length) {
    throw new Error(`${materialized.unresolved.length} user references could not be mapped to Supabase Auth UUIDs. First: ${materialized.unresolved[0]}`);
  }

  const output = {
    ...plan,
    version: 3,
    mode: 'auth-resolved-dry-run',
    tables: materialized.tables,
    resolvedLegacyUserRefs: materialized.resolvedRefs,
    authMapping: {
      firebaseUidsExpected: profiles.length,
      firebaseUidsMapped: authMap.size,
      legacyUserRefsMapped: legacyUserMap.size,
      profilesResolved: resolvedProfiles.length,
      userRefsResolved: materialized.resolvedRefs.length,
      liveSupabaseWrite: false,
    },
    validation: {
      ...(plan.validation || {}),
      firebaseToSupabaseAuthMappingChecked: true,
      legacyUserRefMappingChecked: true,
      profilesHaveAuthUserId: resolvedProfiles.every((row) => Boolean(row.auth_user_id)),
      resolvedUserRefsHaveAuthUserId: materialized.resolvedRefs.every((row) => Boolean(row.auth_user_id)),
      liveSupabaseWrite: false,
    },
  };

  fs.writeFileSync(args.output, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log('Supabase Auth UUID resolution: PASS');
  console.log(`Firebase UIDs mapped: ${authMap.size}`);
  console.log(`Legacy user refs mapped: ${legacyUserMap.size}`);
  console.log(`Profiles resolved: ${resolvedProfiles.length}`);
  console.log(`Resolved legacy user refs: ${materialized.resolvedRefs.length}`);
  console.log(`Resolved plan: ${args.output}`);
  console.log('Live Supabase write: false');
}

try {
  main();
} catch (error) {
  console.error(`Supabase Auth resolution failed: ${error.message}`);
  process.exitCode = 1;
}
