#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = { input: null, output: null };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--input') args.input = argv[++i];
    else if (value === '--output') args.output = path.resolve(argv[++i]);
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function usage() {
  console.log(`Usage: node scripts/migration/audit-identity.js --input .migration-data-v4.json [--output .migration-identity-audit.json]`);
}

function asString(value) {
  if (value == null || value === '') return null;
  return String(value);
}

function add(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function rowsByKey(rows, key) {
  const result = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const value = asString(row?.[key]);
    if (value == null) continue;
    add(result, value, row);
  }
  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  if (!args.input) throw new Error('--input is required');

  const inputPath = path.resolve(args.input);
  const dataset = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const collections = dataset?.collections;
  if (!collections || typeof collections !== 'object' || Array.isArray(collections)) {
    throw new Error('Migration dataset is missing the collections object.');
  }

  const users = Array.isArray(collections.users) ? collections.users : [];
  const userByUid = rowsByKey(users, 'legacy_uid');
  const userUids = new Set(userByUid.keys());

  const report = {
    input: inputPath,
    summary: {
      users: users.length,
      knownFirebaseUids: userUids.size,
      unresolvedFirebaseUidRefs: 0,
      unresolvedLegacyUserRefs: 0,
      crossTenantIdentityRefs: 0,
    },
    firebaseUidReferences: [],
    legacyUserReferences: [],
    crossTenantReferences: [],
    notes: [],
  };

  const uidFields = new Set([
    'legacy_uid',
    'sender_legacy_uid',
    'receiver_legacy_uid',
    'user_legacy_uid',
    'updated_by_legacy_uid',
  ]);

  const legacyUserFields = new Set([
    'author_legacy_ref',
    'approved_by_legacy_ref',
    'by_legacy_ref',
  ]);

  const entityLegacyFields = new Set([
    'member_legacy_id',
    'family_legacy_id',
    'group_legacy_id',
    'event_legacy_id',
    'volunteer_legacy_id',
    'donor_legacy_id',
    'kategori_legacy_id',
    'notification_legacy_id',
  ]);

  const tableTenant = new Map();
  for (const [table, rows] of Object.entries(collections)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const legacyId = asString(row?.legacy_id);
      const churchId = asString(row?.church_legacy_id);
      if (legacyId && churchId) add(tableTenant, `${table}:${legacyId}`, churchId);
    }
  }

  function inspectRows(table, rows) {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      const churchId = asString(row?.church_legacy_id);
      for (const [field, rawValue] of Object.entries(row || {})) {
        const value = asString(rawValue);
        if (value == null) continue;

        if (uidFields.has(field)) {
          if (field === 'legacy_uid') continue;
          const known = userByUid.get(value) || [];
          if (!known.length) {
            report.summary.unresolvedFirebaseUidRefs += 1;
            report.firebaseUidReferences.push({
              table,
              field,
              value,
              church_legacy_id: churchId,
              row_legacy_id: asString(row.legacy_id),
            });
          } else {
            for (const user of known) {
              const userChurch = asString(user.church_legacy_id);
              if (churchId && userChurch && churchId !== userChurch) {
                report.summary.crossTenantIdentityRefs += 1;
                report.crossTenantReferences.push({
                  type: 'firebase_uid',
                  table,
                  field,
                  value,
                  row_legacy_id: asString(row.legacy_id),
                  row_church_legacy_id: churchId,
                  user_church_legacy_id: userChurch,
                });
              }
            }
          }
        }

        if (legacyUserFields.has(field)) {
          const knownUid = userByUid.get(value) || [];
          if (knownUid.length) {
            for (const user of knownUid) {
              const userChurch = asString(user.church_legacy_id);
              if (churchId && userChurch && churchId !== userChurch) {
                report.summary.crossTenantIdentityRefs += 1;
                report.crossTenantReferences.push({
                  type: 'legacy_user_ref',
                  table,
                  field,
                  value,
                  row_legacy_id: asString(row.legacy_id),
                  row_church_legacy_id: churchId,
                  user_church_legacy_id: userChurch,
                });
              }
            }
          } else {
            report.summary.unresolvedLegacyUserRefs += 1;
            report.legacyUserReferences.push({
              table,
              field,
              value,
              church_legacy_id: churchId,
              row_legacy_id: asString(row.legacy_id),
            });
          }
        }

        if (entityLegacyFields.has(field) && field !== 'notification_legacy_id') {
          const targetTable = field.startsWith('member_') || field === 'donor_legacy_id' ? 'members' :
            field.startsWith('family_') ? 'families' :
            field.startsWith('group_') ? 'groups' :
            field.startsWith('event_') ? 'events' :
            field.startsWith('volunteer_') ? 'volunteers' :
            field.startsWith('kategori_') ? 'finance_categories' : null;

          if (targetTable && churchId) {
            const owners = tableTenant.get(`${targetTable}:${value}`) || [];
            if (!owners.length) {
              report.notes.push({
                type: 'unresolved_entity_ref',
                table,
                field,
                value,
                church_legacy_id: churchId,
                target_table: targetTable,
                row_legacy_id: asString(row.legacy_id),
              });
            } else if (!owners.includes(churchId)) {
              report.summary.crossTenantIdentityRefs += 1;
              report.crossTenantReferences.push({
                type: 'entity_ref',
                table,
                field,
                value,
                row_legacy_id: asString(row.legacy_id),
                row_church_legacy_id: churchId,
                target_table: targetTable,
                target_church_legacy_ids: owners,
              });
            }
          }
        }
      }
    }
  }

  for (const [table, rows] of Object.entries(collections)) inspectRows(table, rows);

  report.notes.push({
    type: 'manual_resolution_required',
    fields: [
      'announcements.author_legacy_ref',
      'income_transactions.approved_by_legacy_ref',
      'expense_transactions.approved_by_legacy_ref',
      'approval_history.by_legacy_ref',
    ],
  });
  report.notes.push({
    type: 'firebase_uid_map_required',
    reason: 'Every legacy Firebase Auth UID must map to a real Supabase auth.users.id before profiles/messages/notifications are imported.',
  });

  const outputPath = args.output || path.resolve('.migration-identity-audit.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('Migration identity audit complete.');
  console.log(`Users / Firebase UIDs: ${report.summary.users} / ${report.summary.knownFirebaseUids}`);
  console.log(`Unresolved Firebase UID refs: ${report.summary.unresolvedFirebaseUidRefs}`);
  console.log(`Unresolved legacy user refs: ${report.summary.unresolvedLegacyUserRefs}`);
  console.log(`Cross-tenant identity refs: ${report.summary.crossTenantIdentityRefs}`);
  console.log(`Audit report: ${outputPath}`);
}

try {
  main();
} catch (error) {
  console.error(`Identity audit failed: ${error.message}`);
  process.exitCode = 1;
}
