const fs = require('node:fs');
const path = require('node:path');
const { readBackup, collectionEntries } = require('./firebase-backup-reader');

const inputPath = process.argv[2];
const outputPath = process.argv[3] || path.resolve('.migration-data.json');

if (!inputPath) {
  console.error('Usage: node scripts/migration/transform.js <backup.json> [output.json]');
  process.exit(1);
}

function normalizeTimestamp(value) {
  if (value == null) return null;
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  if (typeof value === 'object') {
    if (typeof value._seconds === 'number') {
      return new Date(value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1e6)).toISOString();
    }
    if (typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6)).toISOString();
    }
  }
  return value;
}

function normalizeRecord(id, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { legacy_id: id, value };
  }

  const row = { legacy_id: id, ...value };
  for (const key of Object.keys(row)) {
    if (/At$|Date$|^timestamp$|^tanggal$|^tgl/i.test(key)) {
      row[key] = normalizeTimestamp(row[key]);
    }
  }
  return row;
}

function transformCollection(backup, name) {
  return collectionEntries(backup, name).map(({ id, value }) => normalizeRecord(id, value));
}

const backup = readBackup(inputPath);

const dataset = {
  meta: {
    source: path.resolve(inputPath),
    generatedAt: new Date().toISOString(),
    transformerVersion: 1,
  },
  collections: {
    churches: transformCollection(backup, 'churches'),
    users: transformCollection(backup, 'users'),
    messages: transformCollection(backup, 'messages'),
    publicSites: transformCollection(backup, 'publicSites'),
    siteSlugs: transformCollection(backup, 'siteSlugs'),
  },
  notes: [
    'Only collections present in the Firebase backup are transformed.',
    'Tenant subcollections absent from the backup are not invented.',
    'legacy_id is preserved so relational mappings can be built explicitly during import.',
  ],
};

fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2) + '\n', 'utf8');

console.log(`Migration dataset written: ${outputPath}`);
for (const [name, rows] of Object.entries(dataset.collections)) {
  console.log(`${name}: ${rows.length}`);
}
