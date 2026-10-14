#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_INPUT = path.resolve('.migration-data-v4.json');
const DEFAULT_MAPPING = path.resolve('scripts/migration/legacy-user-map.json');
const DEFAULT_OUTPUT = path.resolve('.migration-import-plan.json');

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, mapping: DEFAULT_MAPPING, dryRun: true, output: DEFAULT_OUTPUT };
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
  console.log(`Usage: node scripts/migration/import-supabase.js [options]\n\nOptions:\n  --input <file>    Migration dataset (default: .migration-data-v4.json)\n  --mapping <file>  Legacy user mapping (default: scripts/migration/legacy-user-map.json)\n  --dry-run         Build/validate full import plan without writing (default)\n  --apply           Reserved for the live Supabase importer; currently rejected\n  --output <file>   Write import plan JSON`);
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

function buildMapping(mappingSource) {
  const mappingRows = Array.isArray(mappingSource)
    ? mappingSource
    : Array.isArray(mappingSource?.mappings)
      ? mappingSource.mappings
      : [];

  const map = new Map();
  for (const row of mappingRows) {
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

function resolveLegacyUser(value, churchId, mapping, knownUids) {
  const ref = asString(value);
  if (!ref) return null;
  if (knownUids.has(ref)) return ref;

  const uid = mapping.get(`${asString(churchId)}:${ref}`);
  if (!uid) throw new Error(`Unresolved legacy user ref ${ref} for church ${churchId}.`);
  if (!knownUids.has(uid)) {
    throw new Error(`Legacy user mapping resolves ${ref} for church ${churchId} to unknown Firebase UID ${uid}.`);
  }
  return uid;
}

function indexByChurchAndLegacy(rowsList, label) {
  const index = new Map();
  for (const row of rowsList) {
    const church = asString(row?.church_legacy_id);
    const legacy = asString(row?.legacy_id);
    if (!church || !legacy) continue;
    const key = `${church}:${legacy}`;
    if (index.has(key)) throw new Error(`Duplicate ${label} legacy identity ${key}.`);
    index.set(key, row);
  }
  return index;
}

function requireRef(index, churchId, legacyId, label, sourceLabel) {
  if (legacyId == null || legacyId === '') return null;
  const key = `${asString(churchId)}:${asString(legacyId)}`;
  if (!index.has(key)) throw new Error(`${sourceLabel} references missing ${label} ${key}.`);
  return key;
}

function validateUniqueJunction(rowsList, keys, label) {
  const seen = new Set();
  for (const row of rowsList) {
    const key = keys.map((field) => asString(row?.[field])).join('|');
    if (seen.has(key)) throw new Error(`Duplicate ${label} relationship ${key}.`);
    seen.add(key);
  }
}

function makePlan(dataset, mappingSource) {
  const collections = dataset?.collections;
  if (!collections || typeof collections !== 'object' || Array.isArray(collections)) {
    throw new Error('Migration dataset is missing collections.');
  }

  const mapping = buildMapping(mappingSource);
  const users = rows(collections, 'users');
  const knownUids = new Set(users.map((row) => asString(row?.legacy_uid)).filter(Boolean));

  const churches = rows(collections, 'churches').map((row) => ({ ...row }));
  const profiles = users.map((row) => ({
    ...row,
    auth_user_legacy_uid: asString(row.legacy_uid),
  }));

  const members = rows(collections, 'members');
  const families = rows(collections, 'families');
  const familyMembers = rows(collections, 'family_members');
  const groups = rows(collections, 'groups');
  const groupMembers = rows(collections, 'group_members');
  const events = rows(collections, 'events');
  const eventParticipants = rows(collections, 'event_participants');
  const attendance = rows(collections, 'attendance');
  const donors = rows(collections, 'donors');
  const donations = rows(collections, 'donations');
  const volunteers = rows(collections, 'volunteers');
  const assignments = rows(collections, 'assignments');
  const financeCategories = rows(collections, 'finance_categories');
  const financeConfig = rows(collections, 'finance_config');
  const income = rows(collections, 'income_transactions');
  const expense = rows(collections, 'expense_transactions');
  const approvalHistory = rows(collections, 'approval_history');
  const announcements = rows(collections, 'announcements');
  const notifications = rows(collections, 'notifications');
  const notificationRecipients = rows(collections, 'notification_recipients');
  const messages = rows(collections, 'messages');
  const deaths = rows(collections, 'deaths');
  const websites = rows(collections, 'websites');
  const websitePages = rows(collections, 'website_pages');
  const websiteNavigation = rows(collections, 'website_navigation');
  const siteSlugs = rows(collections, 'siteSlugs');
  const publicSites = rows(collections, 'publicSites');
  const publicSitePages = rows(collections, 'public_site_pages');
  const publicSiteEvents = rows(collections, 'public_site_events');

  const churchIds = new Set(churches.map((row) => asString(row.legacy_id)).filter(Boolean));
  for (const row of profiles) {
    if (row.church_legacy_id != null && !churchIds.has(asString(row.church_legacy_id))) {
      throw new Error(`Profile ${row.legacy_uid} references missing church ${row.church_legacy_id}.`);
    }
  }
  for (const church of churches) {
    if (church.superadmin_legacy_uid && !knownUids.has(asString(church.superadmin_legacy_uid))) {
      throw new Error(`Church ${church.legacy_id} references unknown superadmin UID ${church.superadmin_legacy_uid}.`);
    }
  }

  const memberIndex = indexByChurchAndLegacy(members, 'member');
  const familyIndex = indexByChurchAndLegacy(families, 'family');
  const groupIndex = indexByChurchAndLegacy(groups, 'group');
  const eventIndex = indexByChurchAndLegacy(events, 'event');
  const volunteerIndex = indexByChurchAndLegacy(volunteers, 'volunteer');
  const categoryIndex = indexByChurchAndLegacy(financeCategories, 'finance category');
  const donorIndex = indexByChurchAndLegacy(donors, 'donor');
  const notificationIndex = indexByChurchAndLegacy(notifications, 'notification');

  validateUniqueJunction(familyMembers, ['church_legacy_id', 'family_legacy_id', 'member_legacy_id'], 'family member');
  validateUniqueJunction(groupMembers, ['church_legacy_id', 'group_legacy_id', 'member_legacy_id'], 'group member');
  validateUniqueJunction(notificationRecipients, ['church_legacy_id', 'notification_legacy_id', 'user_legacy_uid'], 'notification recipient');

  for (const row of members) {
    requireRef(groupIndex, row.church_legacy_id, row.group_legacy_id, 'group', `Member ${row.legacy_id}`);
  }
  for (const row of families) {
    requireRef(memberIndex, row.church_legacy_id, row.kepala_legacy_id, 'member', `Family ${row.legacy_id}`);
  }
  for (const row of familyMembers) {
    requireRef(familyIndex, row.church_legacy_id, row.family_legacy_id, 'family', 'family_members');
    requireRef(memberIndex, row.church_legacy_id, row.member_legacy_id, 'member', 'family_members');
  }
  for (const row of groups) {
    requireRef(memberIndex, row.church_legacy_id, row.leader_legacy_id, 'member', `Group ${row.legacy_id}`);
  }
  for (const row of groupMembers) {
    requireRef(groupIndex, row.church_legacy_id, row.group_legacy_id, 'group', 'group_members');
    requireRef(memberIndex, row.church_legacy_id, row.member_legacy_id, 'member', 'group_members');
  }
  for (const row of events) {
    if (row.church_legacy_id == null || !churchIds.has(asString(row.church_legacy_id))) throw new Error(`Event ${row.legacy_id} references missing church ${row.church_legacy_id}.`);
  }
  for (const row of eventParticipants) {
    requireRef(eventIndex, row.church_legacy_id, row.event_legacy_id, 'event', 'event_participants');
    requireRef(memberIndex, row.church_legacy_id, row.member_legacy_id, 'member', 'event_participants');
  }
  for (const row of attendance) {
    requireRef(eventIndex, row.church_legacy_id, row.event_legacy_id, 'event', `Attendance ${row.legacy_id}`);
    requireRef(memberIndex, row.church_legacy_id, row.member_legacy_id, 'member', `Attendance ${row.legacy_id}`);
  }
  for (const row of donations) {
    requireRef(memberIndex, row.church_legacy_id, row.donor_legacy_id, 'member', `Donation ${row.legacy_id}`);
    requireRef(donorIndex, row.church_legacy_id, row.donor_record_legacy_id, 'donor', `Donation ${row.legacy_id}`);
  }
  for (const row of volunteers) {
    requireRef(memberIndex, row.church_legacy_id, row.member_legacy_id, 'member', `Volunteer ${row.legacy_id}`);
  }
  for (const row of assignments) {
    requireRef(volunteerIndex, row.church_legacy_id, row.volunteer_legacy_id, 'volunteer', `Assignment ${row.legacy_id}`);
    requireRef(eventIndex, row.church_legacy_id, row.event_legacy_id, 'event', `Assignment ${row.legacy_id}`);
  }
  for (const row of income) {
    requireRef(categoryIndex, row.church_legacy_id, row.kategori_legacy_id, 'finance category', `Income ${row.legacy_id}`);
    requireRef(memberIndex, row.church_legacy_id, row.donatur_member_legacy_id, 'member', `Income ${row.legacy_id}`);
    requireRef(donorIndex, row.church_legacy_id, row.donatur_legacy_id, 'donor', `Income ${row.legacy_id}`);
  }
  for (const row of expense) {
    requireRef(categoryIndex, row.church_legacy_id, row.kategori_legacy_id, 'finance category', `Expense ${row.legacy_id}`);
  }

  const resolvedLegacyUserRefs = [];
  const resolveUserField = (table, row, field) => {
    if (row[field] == null) return null;
    const firebaseUid = resolveLegacyUser(row[field], row.church_legacy_id, mapping, knownUids);
    resolvedLegacyUserRefs.push({ table, legacy_id: asString(row.legacy_id), church_legacy_id: asString(row.church_legacy_id), source_field: field, source_ref: asString(row[field]), firebase_uid: firebaseUid });
    return firebaseUid;
  };

  for (const row of income) resolveUserField('income_transactions', row, 'approved_by_legacy_ref');
  for (const row of expense) resolveUserField('expense_transactions', row, 'approved_by_legacy_ref');
  for (const row of approvalHistory) resolveUserField('approval_history', row, 'by_legacy_ref');
  for (const row of announcements) resolveUserField('announcements', row, 'author_legacy_ref');
  for (const row of websites) {
    resolveUserField('websites', row, 'published_by_legacy_ref');
    resolveUserField('websites', row, 'updated_by_legacy_ref');
  }
  for (const row of websitePages) resolveUserField('website_pages', row, 'updated_by_legacy_ref');
  for (const row of websiteNavigation) resolveUserField('website_navigation', row, 'updated_by_legacy_ref');
  for (const row of publicSites) resolveUserField('publicSites', row, 'published_by_legacy_ref');
  for (const row of notificationRecipients) {
    if (row.user_legacy_uid != null) {
      resolveUserField('notification_recipients', row, 'user_legacy_uid');
    }
  }
  for (const row of messages) {
    resolveUserField('messages', row, 'sender_legacy_uid');
    resolveUserField('messages', row, 'receiver_legacy_uid');
  }
  for (const row of profiles) resolveUserField('profiles', row, 'updated_by_legacy_uid');

  const counts = Object.fromEntries([
    ['churches', churches], ['profiles', profiles], ['messages', messages], ['members', members], ['families', families],
    ['family_members', familyMembers], ['groups', groups], ['group_members', groupMembers], ['events', events],
    ['event_participants', eventParticipants], ['attendance', attendance], ['donors', donors], ['donations', donations],
    ['volunteers', volunteers], ['assignments', assignments], ['finance_categories', financeCategories], ['finance_config', financeConfig],
    ['income_transactions', income], ['expense_transactions', expense], ['approval_history', approvalHistory], ['announcements', announcements],
    ['notifications', notifications], ['notification_recipients', notificationRecipients], ['deaths', deaths], ['websites', websites],
    ['website_pages', websitePages], ['website_navigation', websiteNavigation], ['siteSlugs', siteSlugs], ['publicSites', publicSites],
    ['public_site_pages', publicSitePages], ['public_site_events', publicSiteEvents],
  ].map(([name, value]) => [name, value.length]));

  return {
    version: 2,
    mode: 'dry-run',
    source: dataset.meta ?? dataset.source ?? null,
    counts,
    tables: {
      churches, profiles, messages, members, families, family_members: familyMembers, groups, group_members: groupMembers,
      events, event_participants: eventParticipants, attendance, donors, donations, volunteers, assignments,
      finance_categories: financeCategories, finance_config: financeConfig, income_transactions: income, expense_transactions: expense,
      approval_history: approvalHistory, announcements, notifications, notification_recipients: notificationRecipients, deaths,
      websites, website_pages: websitePages, website_navigation: websiteNavigation, siteSlugs, publicSites,
      public_site_pages: publicSitePages, public_site_events: publicSiteEvents,
    },
    resolvedLegacyUserRefs,
    validation: {
      tenantScopedLegacyReferences: true,
      junctionDuplicatesChecked: true,
      foreignKeysChecked: true,
      userReferencesResolved: true,
      authUsersCreated: false,
      liveSupabaseWrite: false,
    },
    warnings: [
      'Supabase auth.users records are not created by this dry-run script.',
      'Firebase UID to Supabase auth UUID mapping must be supplied before live profile/message/notification import.',
      'Donor documents were absent in the source backup; donation donorId values are treated as member references and donor_record_legacy_id remains null.',
      'publicSites/public_site_pages/public_site_events are published projections and may legitimately be empty in the source backup.',
      'website_pages remains empty when the source backup contains no website content/pages documents.',
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
  fs.writeFileSync(args.output, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');

  console.log('Supabase migration import plan generated.');
  console.log('Mode: dry-run');
  console.log(`Churches: ${plan.counts.churches}`);
  console.log(`Profiles: ${plan.counts.profiles}`);
  console.log(`Resolved legacy user refs: ${plan.resolvedLegacyUserRefs.length}`);
  for (const [name, count] of Object.entries(plan.counts)) console.log(`${name}: ${count}`);
  console.log(`Plan: ${args.output}`);
}

try {
  main();
} catch (error) {
  console.error(`Supabase import plan failed: ${error.message}`);
  process.exitCode = 1;
}
