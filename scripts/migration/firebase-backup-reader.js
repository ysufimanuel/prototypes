#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = { input: null };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--input') args.input = argv[++i];
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function reviveFirestoreTimestamps(value) {
  if (Array.isArray(value)) return value.map(reviveFirestoreTimestamps);
  if (!value || typeof value !== 'object') return value;

  if (Number.isInteger(value._seconds) && Number.isInteger(value._nanoseconds)) {
    const millis = value._seconds * 1000 + Math.floor(value._nanoseconds / 1e6);
    return new Date(millis).toISOString();
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, reviveFirestoreTimestamps(child)])
  );
}

function assertBackupShape(backup) {
  const required = ['churches', 'users', 'messages', 'publicSites', 'siteSlugs'];
  for (const key of required) {
    if (!backup || typeof backup[key] !== 'object' || Array.isArray(backup[key])) {
      throw new Error(`Invalid backup: '${key}' must be an object/map.`);
    }
  }
}

function readBackup(inputPath) {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) throw new Error(`Backup file not found: ${resolved}`);

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid JSON in ${resolved}: ${error.message}`);
  }

  assertBackupShape(parsed);
  return {
    sourcePath: resolved,
    backup: reviveFirestoreTimestamps(parsed),
  };
}

function collectionEntries(backup, collectionName) {
  const collection = backup[collectionName] ?? {};
  if (!collection || typeof collection !== 'object' || Array.isArray(collection)) {
    throw new Error(`Collection '${collectionName}' must be an object.`);
  }
  return Object.entries(collection).map(([id, value]) => ({ id, value }));
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.input) {
      console.log('Usage: node scripts/migration/firebase-backup-reader.js --input /path/to/backup.json');
      process.exit(args.help ? 0 : 1);
    }

    const { sourcePath, backup } = readBackup(args.input);
    console.log(JSON.stringify({
      sourcePath,
      collections: Object.fromEntries(
        Object.entries(backup).map(([name, docs]) => [name, Object.keys(docs).length])
      ),
    }, null, 2));
  } catch (error) {
    console.error(`[firebase-backup-reader] ${error.message}`);
    process.exit(1);
  }
}

module.exports = { readBackup, collectionEntries, reviveFirestoreTimestamps };
