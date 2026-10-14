const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = { input: path.resolve('.migration-data.json'), output: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') args.input = path.resolve(argv[++i] || '');
    else if (arg === '--output') args.output = path.resolve(argv[++i] || '');
    else if (arg === '--help' || arg === '-h') process.exit(0);
    else process.exit(1);
  }
  return args;
}

function isIsoTimestamp(value) {
  if (value == null) return true;
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && value.includes('T');
}

function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function uniqueValues(rows, field) {
  const counts = new Map();
  for (const row of rows) {
    const value = row?.[field];
    if (value == null || value === '') continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

const GLOBAL_IDENTITY = new Set(['churches', 'users', 'messages', 'siteSlugs', 'publicSites']);
const NO_IDENTITY = new Set(['family_members', 'group_members', 'notification_recipients', 'websites', 'website_navigation']);

function identityField(collectionName) {
  if (collectionName === 'users') return 'legacy_uid';
  if (collectionName === 'siteSlugs') return 'slug';
  if (NO_IDENTITY.has(collectionName)) return null;
  return 'legacy_id';
}

function isTenantCollection(collectionName) {
  return !GLOBAL_IDENTITY.has(collectionName) && !NO_IDENTITY.has(collectionName);
}

function tenantIdentityKey(row, field) {
  return `${row?.church_legacy_id ?? ''}::${row?.[field] ?? ''}`;
}

function runValidation(dataset) {
  const errors = [];
  const warnings = [];
  const collections = dataset?.collections;
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) {
    errors.push('Dataset root must be an object.');
    return { errors, warnings };
  }
  if (!collections || typeof collections !== 'object' || Array.isArray(collections)) {
    errors.push('Missing dataset.collections object.');
    return { errors, warnings };
  }

  for (const [name, rows] of Object.entries(collections)) {
    if (!Array.isArray(rows)) {
      errors.push(`${name} must be an array.`);
      continue;
    }
    const identity = identityField(name);
    if (identity) {
      const seen = new Set();
      for (const row of rows) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
          errors.push(`${name}: row must be an object.`);
          continue;
        }
        if (!row[identity]) {
          errors.push(`${name}: row is missing ${identity}.`);
          continue;
        }
        const key = isTenantCollection(name) ? tenantIdentityKey(row, identity) : String(row[identity]);
        if (seen.has(key)) {
          const scope = isTenantCollection(name) ? ` for church '${row.church_legacy_id}'` : '';
          errors.push(`${name}: duplicate ${identity} '${row[identity]}'${scope}.`);
        }
        seen.add(key);
      }
    } else {
      for (const row of rows) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) errors.push(`${name}: row must be an object.`);
      }
    }
  }

  const churches = collections.churches || [];
  const users = collections.users || [];
  const messages = collections.messages || [];
  const siteSlugs = collections.siteSlugs || [];
  const publicSites = collections.publicSites || [];
  const churchIds = new Set(churches.map((row) => row.legacy_id));
  const userIds = new Set(users.map((row) => row.legacy_uid));
  const userById = new Map(users.map((row) => [row.legacy_uid, row]));
  const slugToChurch = new Map();

  for (const church of churches) {
    if (!church.nama || typeof church.nama !== 'string') errors.push(`churches/${church.legacy_id}: nama is required.`);
    if (church.superadmin_legacy_uid) {
      const superadmin = userById.get(church.superadmin_legacy_uid);
      if (!superadmin) errors.push(`churches/${church.legacy_id}: superadmin_legacy_uid '${church.superadmin_legacy_uid}' does not exist in users.`);
      else if (superadmin.church_legacy_id !== church.legacy_id) errors.push(`churches/${church.legacy_id}: superadmin '${church.superadmin_legacy_uid}' belongs to church '${superadmin.church_legacy_id}'.`);
      else if (superadmin.role !== 'superadmin') errors.push(`churches/${church.legacy_id}: superadmin '${church.superadmin_legacy_uid}' has role '${superadmin.role}', expected superadmin.`);
    }
    for (const field of ['created_at', 'updated_at']) if (!isIsoTimestamp(church[field])) errors.push(`churches/${church.legacy_id}: ${field} is not a valid ISO timestamp.`);
    const slug = church.website?.slug;
    if (slug) {
      if (slugToChurch.has(slug) && slugToChurch.get(slug) !== church.legacy_id) errors.push(`churches: duplicate website slug '${slug}'.`);
      slugToChurch.set(slug, church.legacy_id);
    }
  }

  const duplicateEmails = uniqueValues(users, 'email');
  if (duplicateEmails.length) errors.push(`users: duplicate email(s): ${duplicateEmails.join(', ')}.`);
  const duplicateUsernames = uniqueValues(users, 'username');
  if (duplicateUsernames.length) errors.push(`users: duplicate username(s): ${duplicateUsernames.join(', ')}.`);

  for (const user of users) {
    const uid = user.legacy_uid;
    if (!uid) { errors.push('users: row is missing legacy_uid.'); continue; }
    if (!churchIds.has(user.church_legacy_id)) errors.push(`users/${uid}: church_legacy_id '${user.church_legacy_id}' does not exist in churches.`);
    if (!['user', 'admin', 'superadmin'].includes(user.role)) errors.push(`users/${uid}: invalid role '${user.role}'.`);
    if (!isValidEmail(user.email)) errors.push(`users/${uid}: invalid email '${user.email}'.`);
    for (const field of ['created_at', 'updated_at', 'last_login']) if (!isIsoTimestamp(user[field])) errors.push(`users/${uid}: ${field} is not a valid ISO timestamp.`);
    if (user.updated_by_legacy_uid && !userIds.has(user.updated_by_legacy_uid)) errors.push(`users/${uid}: updated_by_legacy_uid '${user.updated_by_legacy_uid}' does not exist in users.`);
  }

  for (const message of messages) {
    const id = message.legacy_id;
    if (!churchIds.has(message.church_legacy_id)) errors.push(`messages/${id}: church_legacy_id '${message.church_legacy_id}' does not exist in churches.`);
    if (!userIds.has(message.sender_legacy_uid)) errors.push(`messages/${id}: sender_legacy_uid '${message.sender_legacy_uid}' does not exist in users.`);
    if (!userIds.has(message.receiver_legacy_uid)) errors.push(`messages/${id}: receiver_legacy_uid '${message.receiver_legacy_uid}' does not exist in users.`);
    for (const field of ['timestamp', 'created_at', 'updated_at']) if (!isIsoTimestamp(message[field])) errors.push(`messages/${id}: ${field} is not a valid ISO timestamp.`);
    const sender = userById.get(message.sender_legacy_uid);
    const receiver = userById.get(message.receiver_legacy_uid);
    if (sender && sender.church_legacy_id !== message.church_legacy_id) errors.push(`messages/${id}: sender belongs to church '${sender.church_legacy_id}', not '${message.church_legacy_id}'.`);
    if (receiver && receiver.church_legacy_id !== message.church_legacy_id) errors.push(`messages/${id}: receiver belongs to church '${receiver.church_legacy_id}', not '${message.church_legacy_id}'.`);
  }

  const seenSlugs = new Set();
  for (const row of siteSlugs) {
    if (!row.slug) { errors.push('siteSlugs: row is missing slug.'); continue; }
    if (seenSlugs.has(row.slug)) errors.push(`siteSlugs: duplicate slug '${row.slug}'.`);
    seenSlugs.add(row.slug);
    if (!churchIds.has(row.church_legacy_id)) errors.push(`siteSlugs/${row.slug}: church_legacy_id '${row.church_legacy_id}' does not exist in churches.`);
    const churchSlug = churches.find((church) => church.legacy_id === row.church_legacy_id)?.website?.slug;
    if (churchSlug && churchSlug !== row.slug) errors.push(`siteSlugs/${row.slug}: does not match church website.slug '${churchSlug}'.`);
  }

  for (const [name, keyFields] of [
    ['family_members', ['church_legacy_id', 'family_legacy_id', 'member_legacy_id']],
    ['group_members', ['church_legacy_id', 'group_legacy_id', 'member_legacy_id']],
    ['notification_recipients', ['church_legacy_id', 'notification_legacy_id', 'user_legacy_uid']],
  ]) {
    const seen = new Set();
    for (const row of collections[name] || []) {
      const key = keyFields.map((field) => row?.[field] ?? '').join('::');
      if (seen.has(key)) errors.push(`${name}: duplicate relationship '${key}'.`);
      seen.add(key);
    }
  }

  for (const [name, rows] of [
    ['finance_config', collections.finance_config || []],
    ['websites', collections.websites || []],
    ['website_navigation', collections.website_navigation || []],
  ]) {
    const seen = new Set();
    for (const row of rows) {
      if (!row.church_legacy_id) { errors.push(`${name}: row is missing church_legacy_id.`); continue; }
      if (seen.has(row.church_legacy_id)) errors.push(`${name}: duplicate church_legacy_id '${row.church_legacy_id}'.`);
      seen.add(row.church_legacy_id);
    }
  }

  if (publicSites.length === 0) warnings.push('publicSites is empty; this is allowed because it is a published projection, not CMS source data.');
  warnings.push('Firebase Auth UIDs must be mapped through firebase_uid_map before profiles and messages are imported.');
  return { errors, warnings };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.input)) { console.error(`[migration-validate] Migration dataset not found: ${args.input}`); process.exit(1); }
  let dataset;
  try { dataset = JSON.parse(fs.readFileSync(args.input, 'utf8')); }
  catch (error) { console.error(`[migration-validate] Invalid migration dataset JSON: ${error.message}`); process.exit(1); }
  const { errors, warnings } = runValidation(dataset);
  const report = { meta: { source: args.input, generated_at: new Date().toISOString(), validator_version: 4 }, result: errors.length ? 'FAIL' : 'PASS', errors, warnings, counts: Object.fromEntries(Object.entries(dataset.collections || {}).map(([name, rows]) => [name, Array.isArray(rows) ? rows.length : null])) };
  if (args.output) { fs.writeFileSync(args.output, JSON.stringify(report, null, 2) + '\n', 'utf8'); console.log(`Validation report written: ${args.output}`); }
  if (errors.length) { console.error(`Migration dataset validation: FAIL (${errors.length} errors)`); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
  console.log('Migration dataset validation: PASS');
  for (const [name, count] of Object.entries(report.counts)) console.log(`${name}: ${count} rows checked`);
  if (warnings.length) { console.log(`Warnings: ${warnings.length}`); for (const warning of warnings) console.log(`- ${warning}`); }
}

main();
