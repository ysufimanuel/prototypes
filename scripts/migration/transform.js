#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readBackup, collectionEntries } = require('./firebase-backup-reader');

function parseArgs(argv) {
  const args = { input: null, output: path.resolve('.migration-data.json') };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--input') args.input = argv[++i];
    else if (value === '--output') args.output = path.resolve(argv[++i]);
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function asIso(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  return value;
}

function mapRows(backup, collectionName, mapper) {
  return collectionEntries(backup, collectionName).map(({ id, value }) => mapper(id, value || {}));
}

function transform(backup, sourcePath) {
  const churches = mapRows(backup, 'churches', (legacyId, doc) => ({
    legacy_id: legacyId,
    nama: doc.nama ?? '',
    alamat: doc.alamat ?? null,
    kota: doc.kota ?? null,
    email: doc.email ?? null,
    telepon: doc.telepon ?? null,
    superadmin_legacy_uid: doc.superadminUid ?? null,
    subscription: doc.subscription ?? {},
    website: doc.website ?? {},
    created_at: asIso(doc.createdAt),
    updated_at: asIso(doc.updatedAt),
  }));

  const users = mapRows(backup, 'users', (legacyUid, doc) => ({
    legacy_uid: doc.uid ?? legacyUid,
    church_legacy_id: doc.churchId ?? null,
    nama: doc.nama ?? null,
    username: doc.username ?? null,
    email: doc.email ?? null,
    role: doc.role ?? 'user',
    status: doc.status ?? null,
    created_at: asIso(doc.createdAt),
    updated_at: asIso(doc.updatedAt),
    last_login: asIso(doc.lastLogin),
    updated_by_legacy_uid: doc.updatedBy ?? null,
  }));

  const messages = mapRows(backup, 'messages', (legacyId, doc) => ({
    legacy_id: legacyId,
    church_legacy_id: doc.churchId ?? null,
    sender_legacy_uid: doc.senderId ?? null,
    receiver_legacy_uid: doc.receiverId ?? null,
    content: doc.content ?? '',
    timestamp: asIso(doc.timestamp),
    read: Boolean(doc.read),
    created_at: asIso(doc.createdAt ?? doc.timestamp),
    updated_at: asIso(doc.updatedAt ?? doc.timestamp),
  }));

  const siteSlugs = mapRows(backup, 'siteSlugs', (slug, doc) => ({
    slug,
    church_legacy_id: doc.churchId ?? null,
    updated_at: asIso(doc.updatedAt),
  }));

  // publicSites is intentionally empty in the supplied backup. Keep the collection
  // explicit so a future backup can populate it without changing the transformer shape.
  const publicSites = mapRows(backup, 'publicSites', (legacyId, doc) => ({
    legacy_id: legacyId,
    church_legacy_id: doc.churchId ?? legacyId,
    config: doc.config ?? {},
    navigation: doc.navigation ?? {},
    published_at: asIso(doc.publishedAt),
    updated_at: asIso(doc.updatedAt),
  }));

  return {
    meta: {
      source: path.resolve(sourcePath),
      generated_at: new Date().toISOString(),
      transformer_version: 2,
      source_type: 'firebase-firestore-backup',
    },
    collections: { churches, users, messages, siteSlugs, publicSites },
    migration_warnings: [
      'This backup contains only top-level churches, users, messages, siteSlugs, and publicSites collections.',
      'Tenant subcollections such as members, events, finance, and website source documents are not present in this backup and are not fabricated.',
      'Firebase Auth UIDs remain legacy_uid values. They must be mapped to Supabase auth.users UUIDs through firebase_uid_map before importing profiles/messages.',
      'Firestore Timestamp-shaped objects are normalized to ISO-8601 strings.',
    ],
  };
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.input) {
      console.log('Usage: node scripts/migration/transform.js --input /path/to/backup.json [--output /path/to/migration-data.json]');
      process.exit(args.help ? 0 : 1);
    }

    const { backup, sourcePath } = readBackup(args.input);
    const dataset = transform(backup, sourcePath);
    fs.writeFileSync(args.output, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');

    console.log(`Migration dataset written: ${args.output}`);
    for (const [name, rows] of Object.entries(dataset.collections)) {
      console.log(`${name}: ${rows.length}`);
    }
  } catch (error) {
    console.error(`[migration-transform] ${error.message}`);
    process.exit(1);
  }
}

module.exports = { transform, asIso };
