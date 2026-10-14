const fs = require('node:fs');
const path = require('node:path');

const inputPath = process.argv[2] || path.resolve('.migration-data.json');

if (!fs.existsSync(inputPath)) {
  console.error(`Migration dataset not found: ${inputPath}`);
  console.error('Run transform.js first.');
  process.exit(1);
}

let dataset;
try {
  dataset = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (error) {
  console.error(`Invalid migration dataset JSON: ${error.message}`);
  process.exit(1);
}

const errors = [];
const collections = dataset?.collections;

if (!dataset || typeof dataset !== 'object' || !collections || typeof collections !== 'object') {
  errors.push('Missing dataset.collections object.');
}

for (const [name, rows] of Object.entries(collections || {})) {
  if (!Array.isArray(rows)) {
    errors.push(`${name} must be an array.`);
    continue;
  }

  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      errors.push(`${name}: row must be an object.`);
      continue;
    }
    if (!row.legacy_id) {
      errors.push(`${name}: row is missing legacy_id.`);
      continue;
    }
    if (seen.has(row.legacy_id)) {
      errors.push(`${name}: duplicate legacy_id '${row.legacy_id}'.`);
    }
    seen.add(row.legacy_id);
  }
}

if (errors.length) {
  console.error(`Validation errors: ${errors.length}`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Migration dataset validation: PASS');
for (const [name, rows] of Object.entries(collections)) {
  console.log(`${name}: ${rows.length} valid rows`);
}
