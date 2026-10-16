#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { supabaseAdmin } = require('../../api/_lib/supabase');

const BATCH_SIZE = 50;

function parseArgs(argv) {
  const args = { input: 'live-website-pages.json', execute: false, verifyOnly: false, report: null };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--input') args.input = argv[++i];
    else if (value === '--execute') args.execute = true;
    else if (value === '--verify-only') args.verifyOnly = true;
    else if (value === '--report') args.report = path.resolve(argv[++i]);
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (args.execute && args.verifyOnly) throw new Error('--execute and --verify-only cannot be used together.');
  return args;
}

function fail(message) {
  throw new Error(message);
}

function normalize(value) {
  return String(value ?? '').trim();
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

function validateSource(source) {
  if (!source || !Array.isArray(source.churches)) fail('Invalid live extraction: churches must be an array.');

  const errors = [];
  const sourceKeys = new Set();
  let pageCount = 0;
  let sectionCount = 0;
  let mediaUrlCount = 0;
  let mediaObjectCount = 0;

  for (const church of source.churches) {
    const churchId = normalize(church.firebaseChurchId);
    if (!churchId) errors.push('Church missing firebaseChurchId.');

    for (const page of church.pages || []) {
      pageCount += 1;
      const pageId = normalize(page.id);
      const slug = normalize(page.slug || page.id);
      if (!pageId) errors.push(`Church ${churchId}: page missing id.`);
      if (!normalize(page.title)) errors.push(`Church ${churchId}/${pageId}: missing title.`);
      if (!slug) errors.push(`Church ${churchId}/${pageId}: missing slug.`);
      if (!Array.isArray(page.sections)) errors.push(`Church ${churchId}/${pageId}: sections is not an array.`);

      const key = `${churchId}:${slug}`;
      if (sourceKeys.has(key)) errors.push(`Duplicate source page: ${key}`);
      sourceKeys.add(key);

      const actualSections = Array.isArray(page.sections) ? page.sections.length : 0;
      const expectedSections = Number(page.sectionCount || 0);
      if (actualSections !== expectedSections) {
        errors.push(`Church ${churchId}/${pageId}: sectionCount mismatch (${expectedSections} != ${actualSections}).`);
      }

      sectionCount += actualSections;
      mediaUrlCount += Number(page.mediaUrlCount || 0);
      mediaObjectCount += Number(page.mediaObjectCount || 0);
    }
  }

  if (Number(source.totalPageCount) !== pageCount) errors.push(`totalPageCount mismatch (${source.totalPageCount} != ${pageCount}).`);
  if (Number(source.totalSections) !== sectionCount) errors.push(`totalSections mismatch (${source.totalSections} != ${sectionCount}).`);
  if (Number(source.totalMediaUrls) !== mediaUrlCount) errors.push(`totalMediaUrls mismatch (${source.totalMediaUrls} != ${mediaUrlCount}).`);
  if (Number(source.totalMediaObjects) !== mediaObjectCount) errors.push(`totalMediaObjects mismatch (${source.totalMediaObjects} != ${mediaObjectCount}).`);

  return { errors, pageCount, sectionCount, mediaUrlCount, mediaObjectCount };
}

async function loadReferences() {
  const [{ data: churches, error: churchError }, { data: websites, error: websiteError }, { data: existingPages, error: pageError }] = await Promise.all([
    supabaseAdmin.from('churches').select('id, legacy_id'),
    supabaseAdmin.from('websites').select('id, church_id'),
    supabaseAdmin.from('website_pages').select('id, website_id, legacy_id, title, slug, published, sections'),
  ]);

  if (churchError) fail(`Supabase churches query failed: ${churchError.message}`);
  if (websiteError) fail(`Supabase websites query failed: ${websiteError.message}`);
  if (pageError) fail(`Supabase website_pages query failed: ${pageError.message}`);
  return { churches: churches || [], websites: websites || [], existingPages: existingPages || [] };
}

function buildPlan(source, refs) {
  const churchByLegacy = new Map();
  for (const church of refs.churches) churchByLegacy.set(normalize(church.legacy_id), church);

  const websitesByChurch = new Map();
  for (const website of refs.websites) {
    const key = String(website.church_id);
    const list = websitesByChurch.get(key) || [];
    list.push(website);
    websitesByChurch.set(key, list);
  }

  const existingByKey = new Map();
  for (const row of refs.existingPages) existingByKey.set(`${row.website_id}:${row.slug}`, row);

  const errors = [];
  const warnings = [];
  const rows = [];

  for (const church of source.churches) {
    const firebaseChurchId = normalize(church.firebaseChurchId);
    const supabaseChurch = churchByLegacy.get(firebaseChurchId);
    if (!supabaseChurch) {
      errors.push(`No Supabase church for Firebase church ${firebaseChurchId}.`);
      continue;
    }

    const websites = websitesByChurch.get(String(supabaseChurch.id)) || [];
    if (websites.length !== 1) {
      errors.push(`Expected exactly one website for Supabase church ${supabaseChurch.id}; found ${websites.length}.`);
      continue;
    }

    const website = websites[0];
    for (const page of church.pages || []) {
      const slug = normalize(page.slug || page.id);
      const key = `${website.id}:${slug}`;
      const existing = existingByKey.get(key);
      if (existing) warnings.push(`Existing page found: website=${website.id}, slug=${slug}, id=${existing.id}.`);

      rows.push({
        website_id: website.id,
        legacy_id: normalize(page.id),
        title: normalize(page.title),
        slug,
        published: page.published === true,
        sections: page.sections,
      });
    }
  }

  const rowKeys = new Set();
  for (const row of rows) {
    const key = `${row.website_id}:${row.slug}`;
    if (rowKeys.has(key)) errors.push(`Duplicate destination key in import plan: ${key}.`);
    rowKeys.add(key);
  }

  return { rows, errors, warnings };
}

async function importRows(rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map((row) => ({
      ...row,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from('website_pages')
      .upsert(batch, { onConflict: 'website_id,slug' });

    if (error) fail(`website_pages upsert failed at batch ${i}: ${error.message}`);
  }
}

async function verify(rows) {
  const websiteIds = [...new Set(rows.map((row) => row.website_id))];
  const { data, error } = await supabaseAdmin
    .from('website_pages')
    .select('id, website_id, legacy_id, title, slug, published, sections')
    .in('website_id', websiteIds);

  if (error) fail(`Post-import verification query failed: ${error.message}`);

  const actual = data || [];
  const expectedByKey = new Map(rows.map((row) => [`${row.website_id}:${row.slug}`, row]));
  const actualByKey = new Map();
  const mismatches = [];

  for (const row of actual) {
    const key = `${row.website_id}:${row.slug}`;
    if (actualByKey.has(key)) mismatches.push({ key, reason: 'duplicate destination key' });
    actualByKey.set(key, row);
  }

  for (const [key, expected] of expectedByKey) {
    const row = actualByKey.get(key);
    if (!row) {
      mismatches.push({ key, reason: 'missing page' });
      continue;
    }
    if (row.legacy_id !== expected.legacy_id) mismatches.push({ key, reason: 'legacy_id mismatch' });
    if (row.title !== expected.title) mismatches.push({ key, reason: 'title mismatch' });
    if (row.published !== expected.published) mismatches.push({ key, reason: 'published mismatch' });
    if (stableJson(row.sections) !== stableJson(expected.sections)) mismatches.push({ key, reason: 'sections mismatch' });
  }

  for (const key of actualByKey.keys()) {
    if (!expectedByKey.has(key)) mismatches.push({ key, reason: 'unexpected destination page' });
  }

  const duplicateKeys = [...actualByKey.values()].length !== actual.length;
  return {
    expected_page_count: rows.length,
    actual_page_count: actual.length,
    page_count_match: actual.length === rows.length,
    sections_match: mismatches.filter((item) => item.reason === 'sections mismatch').length === 0,
    metadata_match: mismatches.every((item) => !['legacy_id mismatch', 'title mismatch', 'published mismatch'].includes(item.reason)),
    no_unexpected_pages: mismatches.filter((item) => item.reason === 'unexpected destination page').length === 0,
    no_duplicate_destination_keys: !duplicateKeys,
    mismatch_count: mismatches.length,
    mismatches,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node --env-file=.env scripts/migration/import-live-website-pages.js [--input live-website-pages.json] [--verify-only] [--execute] [--report report.json]');
    return;
  }

  const inputPath = path.resolve(args.input);
  if (!fs.existsSync(inputPath)) fail(`Input file not found: ${inputPath}`);
  const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const sourceCheck = validateSource(source);
  if (sourceCheck.errors.length) fail(`Source validation failed:\n- ${sourceCheck.errors.join('\n- ')}`);

  const refs = await loadReferences();
  const plan = buildPlan(source, refs);
  if (plan.errors.length) fail(`Import plan validation failed:\n- ${plan.errors.join('\n- ')}`);

  const preview = {
    mode: args.verifyOnly ? 'VERIFY_ONLY' : (args.execute ? 'EXECUTE' : 'DRY_RUN'),
    source_generated_at: source.generatedAt || null,
    expected_pages: plan.rows.length,
    expected_sections: sourceCheck.sectionCount,
    expected_media_urls: sourceCheck.mediaUrlCount,
    expected_media_objects: sourceCheck.mediaObjectCount,
    existing_website_pages: refs.existingPages.length,
    warnings: plan.warnings,
    rows: plan.rows.map((row) => ({ website_id: row.website_id, legacy_id: row.legacy_id, title: row.title, slug: row.slug, published: row.published })),
  };

  if (args.report) fs.writeFileSync(args.report, JSON.stringify(preview, null, 2), 'utf8');

  console.log('[import-live-website-pages] SOURCE + PLAN VALIDATION PASS');
  console.log(JSON.stringify(preview, null, 2));

  if (args.verifyOnly) {
    if (refs.existingPages.length === 0) fail('VERIFY_ONLY found no destination website_pages rows.');
    const verification = await verify(plan.rows);
    console.log('\n[VERIFY-ONLY]');
    console.log(JSON.stringify(verification, null, 2));
    const pass = verification.page_count_match && verification.sections_match && verification.metadata_match && verification.no_unexpected_pages && verification.no_duplicate_destination_keys && verification.mismatch_count === 0;
    console.log(`\n[RESULT] ${pass ? 'PASS — website pages match the live extraction 1:1.' : 'FAIL — verification mismatch detected.'}`);
    if (!pass) process.exitCode = 2;
    return;
  }

  if (!args.execute) {
    console.log('\n[DRY RUN] No Supabase data was changed.');
    return;
  }

  if (refs.existingPages.length > 0) fail('Refusing to execute because website_pages is not empty. Review existing rows before re-running with --execute.');

  await importRows(plan.rows);
  const verification = await verify(plan.rows);
  console.log('\n[POST-IMPORT VERIFICATION]');
  console.log(JSON.stringify(verification, null, 2));

  const pass = verification.page_count_match && verification.sections_match && verification.metadata_match && verification.no_unexpected_pages && verification.no_duplicate_destination_keys && verification.mismatch_count === 0;
  console.log(`\n[RESULT] ${pass ? 'PASS — website pages imported and verified 1:1.' : 'FAIL — verification mismatch detected.'}`);
  if (!pass) process.exitCode = 2;
}

main().catch((error) => {
  console.error(`[import-live-website-pages] ${error.message}`);
  process.exit(1);
});