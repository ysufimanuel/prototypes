#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const {
  readJson,
  assertCollectionMaps,
  getCollection,
  EXPECTED_TENANT_COLLECTIONS,
  collectionStats,
} = require('./firebase-backup-reader');

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    const millis = value < 1e12 ? value * 1000 : value;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === 'object' && Number.isFinite(value._seconds)) {
    const nanos = Number.isFinite(value._nanoseconds) ? value._nanoseconds : 0;
    const millis = value._seconds * 1000 + Math.floor(nanos / 1e6);
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function clone(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

function transformBackup(backup) {
  assertCollectionMaps(backup);

  const churches = getCollection(backup, 'churches');
  const users = getCollection(backup, 'users');
  const messages = getCollection(backup, 'messages');
  const siteSlugs = getCollection(backup, 'siteSlugs');
  const publicSites = getCollection(backup, 'publicSites');

  const warnings = [];
  const churchIds = new Set(Object.keys(churches));
  const userIds = new Set(Object.keys(users));

  const churchRows = Object.entries(churches).map(([legacyId, doc]) => ({
    legacy_id: legacyId,
    nama: doc.nama ?? null,
    alamat: doc.alamat ?? null,
    kota: doc.kota ?? null,
    email: doc.email ?? null,
    telepon: doc.telepon ?? null,
    superadmin_firebase_uid: doc.superadminUid ?? null,
    subscription: clone(doc.subscription) ?? {},
    website_summary: doc.website ? {
      template_id: doc.website.templateId ?? null,
      enabled: doc.website.enabled ?? false,
      slug: doc.website.slug ?? null,
      status: doc.website.status ?? null,
      published_at: toIso(doc.website.publishedAt),
      updated_at: toIso(doc.website.updatedAt),
    } : {},
    created_at: toIso(doc.createdAt),
    updated_at: toIso(doc.updatedAt),
  }));

  for (const row of churchRows) {
    if (row.superadmin_firebase_uid && !userIds.has(row.superadmin_firebase_uid)) {
      warnings.push(`churches/${row.legacy_id}: superadminUid ${row.superadmin_firebase_uid} is not present in users backup`);
    }
  }

  const authUsers = Object.entries(users).map(([legacyUid, doc]) => ({
    firebase_uid: legacyUid,
    email: doc.email ?? null,
    username: doc.username ?? null,
    display_name: doc.nama ?? null,
    status: doc.status ?? null,
    firebase_role: doc.role ?? 'user',
    firebase_church_id: doc.churchId ?? null,
    created_at: toIso(doc.createdAt),
    last_login: toIso(doc.lastLogin),
    updated_at: toIso(doc.updatedAt),
  }));

  for (const row of authUsers) {
    if (row.firebase_church_id && !churchIds.has(row.firebase_church_id)) {
      warnings.push(`users/${row.firebase_uid}: churchId ${row.firebase_church_id} is not present in churches backup`);
    }
  }

  const profiles = Object.entries(users).map(([firebaseUid, doc]) => ({
    firebase_uid: firebaseUid,
    church_legacy_id: doc.churchId ?? null,
    nama: doc.nama ?? null,
    username: doc.username ?? null,
    email: doc.email ?? null,
    role: doc.role ?? 'user',
    status: doc.status ?? null,
    last_login: toIso(doc.lastLogin),
    updated_by_firebase_uid: doc.updatedBy ?? null,
    created_at: toIso(doc.createdAt),
    updated_at: toIso(doc.updatedAt),
  }));

  const messageRows = Object.entries(messages).map(([legacyId, doc]) => ({
    legacy_id: legacyId,
    church_legacy_id: doc.churchId ?? null,
    sender_firebase_uid: doc.senderId ?? null,
    receiver_firebase_uid: doc.receiverId ?? null,
    content: doc.content ?? '',
    timestamp: toIso(doc.timestamp),
    read: Boolean(doc.read),
    created_at: toIso(doc.createdAt),
    updated_at: toIso(doc.updatedAt),
  }));

  for (const row of messageRows) {
    if (row.church_legacy_id && !churchIds.has(row.church_legacy_id)) {
      warnings.push(`messages/${row.legacy_id}: churchId ${row.church_legacy_id} is not present in churches backup`);
    }
    if (row.sender_firebase_uid && !userIds.has(row.sender_firebase_uid)) {
      warnings.push(`messages/${row.legacy_id}: senderId ${row.sender_firebase_uid} is not present in users backup`);
    }
    if (row.receiver_firebase_uid && !userIds.has(row.receiver_firebase_uid)) {
      warnings.push(`messages/${row.legacy_id}: receiverId ${row.receiver_firebase_uid} is not present in users backup`);
    }
  }

  const slugRows = Object.entries(siteSlugs).map(([slug, doc]) => ({
    slug,
    church_legacy_id: doc.churchId ?? null,
    updated_at: toIso(doc.updatedAt),
  }));

  for (const row of slugRows) {
    if (!row.church_legacy_id || !churchIds.has(row.church_legacy_id)) {
      warnings.push(`siteSlugs/${row.slug}: churchId ${row.church_legacy_id ?? '(missing)'} is not present in churches backup`);
    }
  }

  const missingTenantCollections = EXPECTED_TENANT_COLLECTIONS.filter((name) => backup[name] === undefined);
  if (missingTenantCollections.length) {
    warnings.push(
      `Backup does not contain tenant subcollections: ${missingTenantCollections.join(', ')}. ` +
      'This transformer will not invent those rows; recover/export them separately before final migration.',
    );
  }

  return {
    format_version: 1,
    generated_at: new Date().toISOString(),
    source: {
      type: 'firebase-firestore-backup',
      root_collection_stats: collectionStats(backup),
      missing_tenant_collections: missingTenantCollections,
    },
    notes: [
      'This is an intermediate migration dataset, not SQL.',
      'Firebase UID values are intentionally preserved until Supabase Auth users are created and mapped to UUIDs.',
      'No tenant subcollection rows are fabricated when they are absent from the backup.',
    ],
    tables: {
      churches: churchRows,
      auth_users: authUsers,
      profiles,
      messages: messageRows,
      site_slugs: slugRows,
      public_sites: Object.entries(publicSites).map(([legacyId, doc]) => ({
        legacy_id: legacyId,
        church_legacy_id: doc.churchId ?? legacyId,
        data: clone(doc) ?? {},
      })),
    },
    warnings,
  };
}

function main() {
  const backupPath = process.argv[2];
  const outputPath = process.argv[3] || path.join('supabase', '.migration-data.json');

  if (!backupPath) {
    console.error('Usage: node scripts/migration/transform.js <backup.json> [output.json]');
    process.exit(2);
  }

  const backup = readJson(backupPath);
  const transformed = transformBackup(backup);
  const absoluteOutput = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  fs.writeFileSync(absoluteOutput, `${JSON.stringify(transformed, null, 2)}\n`, 'utf8');

  console.log(`Wrote migration dataset: ${absoluteOutput}`);
  console.log(`Churches: ${transformed.tables.churches.length}`);
  console.log(`Auth users/profiles: ${transformed.tables.auth_users.length}`);
  console.log(`Messages: ${transformed.tables.messages.length}`);
  console.log(`Site slugs: ${transformed.tables.site_slugs.length}`);
  console.log(`Public sites: ${transformed.tables.public_sites.length}`);
  console.log(`Warnings: ${transformed.warnings.length}`);

  if (transformed.warnings.length) {
    console.log('\nMigration warnings:');
    for (const warning of transformed.warnings) console.log(`- ${warning}`);
  }
}

if (require.main === module) main();

module.exports = { toIso, transformBackup };
