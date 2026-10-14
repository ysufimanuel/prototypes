const fs = require('node:fs');
const path = require('node:path');

const EXPECTED_ROOT_COLLECTIONS = [
  'churches',
  'messages',
  'publicSites',
  'siteSlugs',
  'users',
];

const EXPECTED_TENANT_COLLECTIONS = [
  'members',
  'families',
  'groups',
  'events',
  'attendance',
  'donations',
  'donors',
  'volunteers',
  'assignments',
  'announcements',
  'pemasukan',
  'pengeluaran',
  'financeCategories',
  'financeConfig',
  'approvalHistory',
  'notifications',
  'deaths',
];

function readJson(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Backup file not found: ${absolutePath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid JSON backup: ${error.message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Backup root must be a JSON object keyed by collection name.');
  }

  return parsed;
}

function assertCollectionMaps(backup) {
  for (const collection of EXPECTED_ROOT_COLLECTIONS) {
    if (backup[collection] === undefined) continue;
    if (!backup[collection] || typeof backup[collection] !== 'object' || Array.isArray(backup[collection])) {
      throw new Error(`Collection ${collection} must be an object keyed by document ID.`);
    }
  }
}

function getCollection(backup, name) {
  const value = backup[name];
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Collection ${name} must be an object keyed by document ID.`);
  }
  return value;
}

function collectionStats(backup) {
  return Object.fromEntries(
    EXPECTED_ROOT_COLLECTIONS.map((name) => [name, Object.keys(getCollection(backup, name)).length]),
  );
}

module.exports = {
  EXPECTED_ROOT_COLLECTIONS,
  EXPECTED_TENANT_COLLECTIONS,
  readJson,
  assertCollectionMaps,
  getCollection,
  collectionStats,
};
