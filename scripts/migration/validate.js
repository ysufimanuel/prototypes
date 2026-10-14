#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function readJson(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) throw new Error(`File not found: ${absolutePath}`);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function validateDataset(dataset) {
  const errors = [];
  const warnings = [...(Array.isArray(dataset.warnings) ? dataset.warnings : [])];
  const tables = dataset.tables || {};

  if (dataset.format_version !== 1) errors.push(`Unsupported format_version: ${dataset.format_version}`);

  const churches = Array.isArray(tables.churches) ? tables.churches : [];
  const authUsers = Array.isArray(tables.auth_users) ? tables.auth_users : [];
  const profiles = Array.isArray(tables.profiles) ? tables.profiles : [];
  const messages = Array.isArray(tables.messages) ? tables.messages : [];
  const siteSlugs = Array.isArray(tables.site_slugs) ? tables.site_slugs : [];

  const unique = (rows, key, label) => {
    const seen = new Set();
    for (const row of rows) {
      const value = row[key];
      if (value === null || value === undefined || value === '') {
        errors.push(`${label}: missing ${key}`);
        continue;
      }
      if (seen.has(value)) errors.push(`${label}: duplicate ${key} ${value}`);
      seen.add(value);
    }
  };

  unique(churches, 'legacy_id', 'churches');
  unique(authUsers, 'firebase_uid', 'auth_users');
  unique(profiles, 'firebase_uid', 'profiles');
  unique(messages, 'legacy_id', 'messages');
  unique(siteSlugs, 'slug', 'site_slugs');

  const churchIds = new Set(churches.map((row) => row.legacy_id));
  const userIds = new Set(authUsers.map((row) => row.firebase_uid));

  for (const row of profiles) {
    if (row.church_legacy_id && !churchIds.has(row.church_legacy_id)) {
      errors.push(`profiles/${row.firebase_uid}: unknown church_legacy_id ${row.church_legacy_id}`);
    }
    if (!userIds.has(row.firebase_uid)) {
      errors.push(`profiles/${row.firebase_uid}: no matching auth_users row`);
    }
  }

  for (const row of authUsers) {
    if (row.firebase_church_id && !churchIds.has(row.firebase_church_id)) {
      errors.push(`auth_users/${row.firebase_uid}: unknown firebase_church_id ${row.firebase_church_id}`);
    }
  }

  for (const row of messages) {
    if (!row.church_legacy_id || !churchIds.has(row.church_legacy_id)) {
      errors.push(`messages/${row.legacy_id}: unknown church_legacy_id ${row.church_legacy_id ?? '(missing)'}`);
    }
    if (!row.sender_firebase_uid || !userIds.has(row.sender_firebase_uid)) {
      errors.push(`messages/${row.legacy_id}: unknown sender_firebase_uid ${row.sender_firebase_uid ?? '(missing)'}`);
    }
    if (!row.receiver_firebase_uid || !userIds.has(row.receiver_firebase_uid)) {
      errors.push(`messages/${row.legacy_id}: unknown receiver_firebase_uid ${row.receiver_firebase_uid ?? '(missing)'}`);
    }
  }

  for (const row of siteSlugs) {
    if (!row.church_legacy_id || !churchIds.has(row.church_legacy_id)) {
      errors.push(`site_slugs/${row.slug}: unknown church_legacy_id ${row.church_legacy_id ?? '(missing)'}`);
    }
  }

  const slugByChurch = new Map();
  for (const row of siteSlugs) {
    if (!row.church_legacy_id) continue;
    if (slugByChurch.has(row.church_legacy_id)) {
      errors.push(`site_slugs: church ${row.church_legacy_id} has multiple slugs: ${slugByChurch.get(row.church_legacy_id)}, ${row.slug}`);
    } else {
      slugByChurch.set(row.church_legacy_id, row.slug);
    }
  }

  for (const church of churches) {
    const website = church.website_summary || {};
    if (website.slug && !slugByChurch.has(church.legacy_id)) {
      warnings.push(`churches/${church.legacy_id}: website slug ${website.slug} exists in church doc but not in site_slugs backup`);
    }
    if (website.slug && slugByChurch.has(church.legacy_id) && slugByChurch.get(church.legacy_id) !== website.slug) {
      errors.push(`churches/${church.legacy_id}: website slug ${website.slug} does not match site_slugs ${slugByChurch.get(church.legacy_id)}`);
    }
    if (church.superadmin_firebase_uid && !userIds.has(church.superadmin_firebase_uid)) {
      errors.push(`churches/${church.legacy_id}: unknown superadmin_firebase_uid ${church.superadmin_firebase_uid}`);
    }
  }

  return { errors, warnings };
}

function main() {
  const inputPath = process.argv[2] || path.join('supabase', '.migration-data.json');
  let dataset;
  try {
    dataset = readJson(inputPath);
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }

  const result = validateDataset(dataset);
  console.log(`Validation errors: ${result.errors.length}`);
  console.log(`Validation warnings: ${result.warnings.length}`);

  if (result.errors.length) {
    console.error('\nErrors:');
    for (const error of result.errors) console.error(`- ${error}`);
  }

  if (result.warnings.length) {
    console.log('\nWarnings:');
    for (const warning of result.warnings) console.log(`- ${warning}`);
  }

  if (result.errors.length) process.exit(1);
  console.log('\nMigration dataset validation: PASS');
}

if (require.main === module) main();

module.exports = { validateDataset };
