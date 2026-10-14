#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_DATASET = path.resolve('.migration-data-v4.json');
const DEFAULT_PLAN = path.resolve('.migration-import-plan.json');

function parseArgs(argv) {
  const args = { dataset: DEFAULT_DATASET, plan: DEFAULT_PLAN };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--dataset') args.dataset = path.resolve(argv[++i]);
    else if (value === '--plan') args.plan = path.resolve(argv[++i]);
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function usage() {
  console.log(`Usage: node scripts/migration/audit-import-plan.js [options]\n\nOptions:\n  --dataset <file>  Source migration dataset (default: .migration-data-v4.json)\n  --plan <file>     Import plan (default: .migration-import-plan.json)`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function rows(collections, name) {
  return Array.isArray(collections?.[name]) ? collections[name] : [];
}

function asString(value) {
  if (value == null || value === '') return null;
  return String(value);
}

function key(church, legacy) {
  return `${asString(church)}:${asString(legacy)}`;
}

const TABLES = [
  'churches', 'profiles', 'messages', 'members', 'families', 'family_members', 'groups', 'group_members',
  'events', 'event_participants', 'attendance', 'donors', 'donations', 'volunteers', 'assignments',
  'finance_categories', 'finance_config', 'income_transactions', 'expense_transactions', 'approval_history',
  'announcements', 'notifications', 'notification_recipients', 'deaths', 'websites', 'website_pages',
  'website_navigation', 'siteSlugs', 'publicSites', 'public_site_pages', 'public_site_events',
];

const TENANT_ID_TABLES = new Set([
  'members', 'families', 'groups', 'events', 'attendance', 'donors', 'donations', 'volunteers', 'assignments',
  'finance_categories', 'income_transactions', 'expense_transactions', 'approval_history', 'announcements',
  'notifications', 'deaths', 'website_pages', 'public_site_pages', 'public_site_events',
]);

const JUNCTION_KEYS = {
  family_members: ['church_legacy_id', 'family_legacy_id', 'member_legacy_id'],
  group_members: ['church_legacy_id', 'group_legacy_id', 'member_legacy_id'],
  event_participants: ['church_legacy_id', 'event_legacy_id', 'member_legacy_id'],
  attendance: ['church_legacy_id', 'event_legacy_id', 'member_legacy_id'],
  assignments: ['church_legacy_id', 'volunteer_legacy_id', 'event_legacy_id'],
  notification_recipients: ['church_legacy_id', 'notification_legacy_id', 'user_legacy_uid'],
};

function countRows(sourceCollections, planTables, name) {
  const source = rows(sourceCollections, name).length;
  const planned = Array.isArray(planTables?.[name]) ? planTables[name].length : 0;
  return { source, planned };
}

function assertCountParity(sourceCollections, planTables, errors) {
  for (const table of TABLES) {
    const { source, planned } = countRows(sourceCollections, planTables, table);
    if (source !== planned) {
      errors.push(`${table}: source=${source}, plan=${planned}`);
    }
  }
}

function assertLegacyIdentityParity(sourceCollections, planTables, errors) {
  for (const table of TENANT_ID_TABLES) {
    const sourceRows = rows(sourceCollections, table);
    const planRows = Array.isArray(planTables?.[table]) ? planTables[table] : [];
    const sourceKeys = new Set();
    const planKeys = new Set();

    for (const row of sourceRows) {
      const k = key(row.church_legacy_id, row.legacy_id);
      if (!row.church_legacy_id || !row.legacy_id) continue;
      sourceKeys.add(k);
    }
    for (const row of planRows) {
      const k = key(row.church_legacy_id, row.legacy_id);
      if (!row.church_legacy_id || !row.legacy_id) continue;
      planKeys.add(k);
    }

    for (const k of sourceKeys) if (!planKeys.has(k)) errors.push(`${table}: missing identity ${k}`);
    for (const k of planKeys) if (!sourceKeys.has(k)) errors.push(`${table}: unexpected identity ${k}`);
  }
}

function assertNoDuplicateJunctions(planTables, errors) {
  for (const [table, fields] of Object.entries(JUNCTION_KEYS)) {
    const seen = new Set();
    for (const row of Array.isArray(planTables?.[table]) ? planTables[table] : []) {
      const k = fields.map((field) => asString(row?.[field])).join('|');
      if (seen.has(k)) errors.push(`${table}: duplicate relationship ${k}`);
      seen.add(k);
    }
  }
}

function assertTenantConsistency(planTables, errors) {
  const churchIds = new Set((planTables.churches || []).map((row) => asString(row.legacy_id)).filter(Boolean));

  for (const table of TABLES) {
    if (table === 'churches' || table === 'profiles' || table === 'messages' || table === 'family_members' ||
        table === 'group_members' || table === 'event_participants' || table === 'notification_recipients' ||
        table === 'finance_config' || table === 'websites' || table === 'website_navigation' || table === 'siteSlugs' || table === 'publicSites') {
      continue;
    }
    for (const row of Array.isArray(planTables?.[table]) ? planTables[table] : []) {
      const church = asString(row?.church_legacy_id);
      if (church && !churchIds.has(church)) errors.push(`${table}: unknown church ${church}`);
    }
  }
}

function assertUserResolution(plan, errors) {
  if (plan?.validation?.userReferencesResolved !== true) {
    errors.push('plan validation.userReferencesResolved is not true');
  }
  const refs = Array.isArray(plan?.resolvedLegacyUserRefs) ? plan.resolvedLegacyUserRefs : [];
  const unresolved = refs.filter((row) => !row.firebase_uid);
  if (unresolved.length) errors.push(`unresolved user references: ${unresolved.length}`);
}

function assertPlanShape(plan, errors) {
  if (!plan || plan.version !== 2) errors.push(`unexpected plan version: ${plan?.version}`);
  if (plan?.mode !== 'dry-run') errors.push(`unexpected plan mode: ${plan?.mode}`);
  if (!plan?.tables || typeof plan.tables !== 'object') errors.push('plan.tables is missing');
  if (!plan?.counts || typeof plan.counts !== 'object') errors.push('plan.counts is missing');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const dataset = readJson(args.dataset);
  const plan = readJson(args.plan);
  const sourceCollections = dataset?.collections;
  if (!sourceCollections || typeof sourceCollections !== 'object') throw new Error('Dataset collections are missing.');

  const errors = [];
  const warnings = [];

  assertPlanShape(plan, errors);
  if (!errors.length) {
    assertCountParity(sourceCollections, plan.tables, errors);
    assertLegacyIdentityParity(sourceCollections, plan.tables, errors);
    assertNoDuplicateJunctions(plan.tables, errors);
    assertTenantConsistency(plan.tables, errors);
    assertUserResolution(plan, errors);
  }

  if (plan?.counts?.donors === 0) warnings.push('donors is empty; this matches the audited source backup.');
  if (plan?.counts?.website_pages === 0) warnings.push('website_pages is empty; this matches the audited source backup.');
  if (plan?.counts?.publicSites === 0) warnings.push('publicSites is empty; it is a published projection rather than CMS source data.');
  if (plan?.counts?.deaths === 0) warnings.push('deaths is empty; this matches the audited source backup.');

  console.log('Migration import plan audit');
  console.log(`Dataset: ${args.dataset}`);
  console.log(`Plan: ${args.plan}`);
  console.log(`Tables checked: ${TABLES.length}`);
  console.log(`Resolved legacy user refs: ${Array.isArray(plan?.resolvedLegacyUserRefs) ? plan.resolvedLegacyUserRefs.length : 0}`);

  if (errors.length) {
    console.error(`FAIL: ${errors.length} error(s)`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log('PASS');
  if (warnings.length) {
    console.log(`Warnings: ${warnings.length}`);
    for (const warning of warnings) console.log(`- ${warning}`);
  }
}

main();
