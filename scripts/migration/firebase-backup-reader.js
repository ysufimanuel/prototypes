const fs = require('node:fs');
const path = require('node:path');

function readBackup(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Backup file not found: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, 'utf8');
  if (!raw.trim()) {
    throw new Error(`Backup file is empty: ${resolved}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in backup: ${error.message}`);
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Backup root must be a JSON object containing collections.');
  }

  return data;
}

function collectionEntries(backup, collectionName) {
  const collection = backup[collectionName] ?? {};
  if (!collection || typeof collection !== 'object' || Array.isArray(collection)) {
    throw new Error(`Collection '${collectionName}' must be an object.`);
  }
  return Object.entries(collection).map(([id, value]) => ({ id, value }));
}

module.exports = { readBackup, collectionEntries };

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/migration/firebase-backup-reader.js <backup.json>');
    process.exit(1);
  }

  const backup = readBackup(filePath);
  console.log(`Loaded backup: ${filePath}`);
  console.log(`Collections: ${Object.keys(backup).join(', ')}`);
}
