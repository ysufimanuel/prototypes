#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readBackup } = require('./firebase-backup-reader');
const { supabaseAdmin } = require('../../api/_lib/supabase');

const DEFAULT_BATCH_SIZE = 100;

function parseArgs(argv) {
  const args = { input: null, execute: false, report: null, church: null };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--input') args.input = argv[++i];
    else if (value === '--execute') args.execute = true;
    else if (value === '--report') args.report = path.resolve(argv[++i]);
    else if (value === '--church') args.church = argv[++i];
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function unwrap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value || {};
  return value._data && typeof value._data === 'object' ? value._data : value;
}

function objectEntries(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value);
}

function getWebsiteContentPages(church) {
  const website = church?._subCollections?.website || {};
  const contentWrapped = website.content;
  if (!contentWrapped) return [];

  const content = unwrap(contentWrapped);
  const pages =
    content?._subCollections?.pages ||
    content?.pages ||
    contentWrapped?._subCollections?.pages ||
    {};

  return objectEntries(pages).map(([id, wrapped]) => ({ id, value: unwrap(wrapped) }));
}

function normalizeString(value, fallback = '') {
  if (value == null) return fallback;
  return String(value);
}

function isUrl(value) {
  if (typeof value !== 'string') return false;
  return /^(https?:)?\/\//i.test(value.trim()) || /^(data:|blob:)/i.test(value.trim());
}

function isMediaKey(key) {
  return /(media|image|video|audio|file|url|src|thumbnail|poster|logo|icon|background|map)/i.test(key);
}

function inspectMedia(value, state, key = '') {
  if (Array.isArray(value)) {
    for (const item of value) inspectMedia(item, state, key);
    return;
  }
  if (!value || typeof value !== 'object') {
    if (isUrl(value) && isMediaKey(key)) state.urls += 1;
    return;
  }

  if (isUrl(value) && isMediaKey(key)) state.urls += 1;
  for (const [childKey, child] of Object.entries(value)) {
    if (child && typeof child === 'object' && !Array.isArray(child) && isMediaKey(childKey)) {
      state.objects += 1;
    }
    inspectMedia(child, state, childKey);
  }
}

function validatePage(churchLegacyId, pageId, raw) {
  const value = unwrap(raw);
  const errors = [];
  const title = value.title ?? value.nama ?? value.name ?? '';
  const slug = value.slug ?? pageId;
  const sections = value.sections ?? [];

  if (!normalizeString(title).trim()) errors.push('missing title');
  if (!normalizeString(slug).trim()) errors.push('missing slug');
  if (!Array.isArray(sections)) errors.push('sections is not an array');

  const media = { urls: 0, objects: 0 };
  if (Array.isArray(sections)) inspectMedia(sections, media);

  try {
    JSON.stringify(sections);
  } catch (error) {
    errors.push(`sections is not JSON serializable: ${error.message}`);
  }

  return {
    church_legacy_id: churchLegacyId,
    legacy_id: normalizeString(value.id ?? pageId),
    title: normalizeString(title),
    slug: normalizeString(slug),
    published: Boolean(value.published),
    sections,
    section_count: Array.isArray(sections) ? sections.length : 0,
    media_url_count: media.urls,
    media_object_count: media.objects,
    errors,
  };
}

function extractPages(backup, selectedChurch = null) {
  const pages = [];
  for (const [churchLegacyId, church] of Object.entries(backup.churches || {})) {
    if (selectedChurch && churchLegacyId !== selectedChurch) continue;
    for (const { id, value } of getWebsiteContentPages(church)) {
      pages.push(validatePage(churchLegacyId, id, value));
    }
  }
  return pages;
}

async function loadSupabaseReferenceData() {
  const [{ data: churches, error: churchError }, { data: websites, error: websiteError }, { data: existingPages, error: pageError }] = await Promise.all([
    supabaseAdmin.from('churches').select('id, legacy_id'),
    supabaseAdmin.from('websites').select('id, church_id, enabled, site_name'),
    supabaseAdmin.from('website_pages').select('id, website_id, legacy_id, slug'),
  ]);

  if (churchError) throw new Error(`Supabase churches query failed: ${churchError.message}`);
  if (websiteError) throw new Error(`Supabase websites query failed: ${websiteError.message}`);
  if (pageError) throw new Error(`Supabase website_pages query failed: ${pageError.message}`);

  return { churches: churches || [], websites: websites || [], existingPages: existingPages || [] };
}

function buildReport(sourcePath, pages, refs) {
  const churchMap = new Map(refs.churches.map((row) => [String(row.legacy_id), row]));
  const websiteByChurch = new Map(refs.websites.map((row) => [String(row.church_id), row]));
  const existingByWebsite = new Map();
  for (const row of refs.existingPages) {
    const key = String(row.website_id);
    if (!existingByWebsite.has(key)) existingByWebsite.set(key, []);
    existingByWebsite.get(key).push(row);
  }

  const enriched = pages.map((page) => {
    const church = churchMap.get(page.church_legacy_id) || null;
    const website = church ? websiteByChurch.get(String(church.id)) || null : null;
    const existing = website ? existingByWebsite.get(String(website.id)) || [] : [];
    const sameSlug = existing.find((row) => row.slug === page.slug) || null;
    return {
      ...page,
      supabase_church_id: church?.id ?? null,
      website_id: website?.id ?? null,
      website_exists: Boolean(website),
      existing_page_id: sameSlug?.id ?? null,
      mapping_ok: Boolean(church && website),
    };
  });

  const byChurch = {};
  for (const row of enriched) {
    if (!byChurch[row.church_legacy_id]) {
      byChurch[row.church_legacy_id] = {
        supabase_church_id: row.supabase_church_id,
        website_id: row.website_id,
        pages: 0,
        sections: 0,
        media_urls: 0,
        media_objects: 0,
        errors: 0,
        existing_pages_before_import: row.website_id ? (existingByWebsite.get(String(row.website_id)) || []).length : 0,
      };
    }
    const item = byChurch[row.church_legacy_id];
    item.pages += 1;
    item.sections += row.section_count;
    item.media_urls += row.media_url_count;
    item.media_objects += row.media_object_count;
    item.errors += row.errors.length;
  }

  const errors = enriched.filter((row) => row.errors.length || !row.mapping_ok);
  const summary = {
    source: sourcePath,
    source_page_count: enriched.length,
    source_church_count: new Set(enriched.map((row) => row.church_legacy_id)).size,
    total_sections: enriched.reduce((sum, row) => sum + row.section_count, 0),
    total_media_urls: enriched.reduce((sum, row) => sum + row.media_url_count, 0),
    total_media_objects: enriched.reduce((sum, row) => sum + row.media_object_count, 0),
    validation_error_count: errors.length,
    mapping_error_count: enriched.filter((row) => !row.mapping_ok).length,
    supabase_existing_page_count: refs.existingPages.length,
    churches_with_pages: byChurch,
  };

  return { summary, pages: enriched };
}

function assertReady(report) {
  if (report.summary.validation_error_count > 0) {
    throw new Error(`Validation failed for ${report.summary.validation_error_count} page(s). Run without --execute to inspect the report.`);
  }
}

async function importPages(report) {
  assertReady(report);
  const rows = report.pages.map((page) => ({
    website_id: page.website_id,
    legacy_id: page.legacy_id,
    title: page.title,
    slug: page.slug,
    published: page.published,
    sections: page.sections,
    updated_at: new Date().toISOString(),
  }));

  for (let i = 0; i < rows.length; i += DEFAULT_BATCH_SIZE) {
    const batch = rows.slice(i, i + DEFAULT_BATCH_SIZE);
    const { error } = await supabaseAdmin
      .from('website_pages')
      .upsert(batch, { onConflict: 'website_id,slug' });
    if (error) throw new Error(`Supabase website_pages upsert failed at batch ${i}: ${error.message}`);
  }
}

async function verifyImport(report) {
  const websiteIds = [...new Set(report.pages.map((page) => page.website_id))];
  const { data, error } = await supabaseAdmin
    .from('website_pages')
    .select('website_id, legacy_id, title, slug, published, sections');
  if (error) throw new Error(`Supabase verification query failed: ${error.message}`);

  const imported = (data || []).filter((row) => websiteIds.includes(row.website_id));
  const expected = new Map(report.pages.map((row) => [`${row.website_id}:${row.slug}`, row]));
  const mismatches = [];

  for (const row of imported) {
    const source = expected.get(`${row.website_id}:${row.slug}`);
    if (!source) continue;
    if (JSON.stringify(row.sections) !== JSON.stringify(source.sections)) {
      mismatches.push({ slug: row.slug, website_id: row.website_id, reason: 'sections mismatch' });
    }
    if (row.title !== source.title || row.published !== source.published) {
      mismatches.push({ slug: row.slug, website_id: row.website_id, reason: 'metadata mismatch' });
    }
  }

  const countMismatch = imported.length !== report.pages.length;
  return {
    expected_pages: report.pages.length,
    imported_pages: imported.length,
    count_match: !countMismatch,
    sections_match: mismatches.filter((row) => row.reason === 'sections mismatch').length === 0,
    metadata_match: mismatches.filter((row) => row.reason === 'metadata mismatch').length === 0,
    mismatches,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    console.log('Usage: node --env-file=.env scripts/migration/migrate-website-pages.js --input /path/to/backup.json [--report report.json] [--church legacyId] [--execute]');
    process.exit(args.help ? 0 : 1);
  }

  const { sourcePath, backup } = readBackup(args.input);
  const pages = extractPages(backup, args.church);
  const refs = await loadSupabaseReferenceData();
  const report = buildReport(sourcePath, pages, refs);

  if (args.report) {
    fs.writeFileSync(args.report, JSON.stringify(report, null, 2), 'utf8');
  }

  console.log(JSON.stringify(report.summary, null, 2));

  if (!args.execute) {
    console.log('\n[PREVIEW ONLY] No Supabase data was changed.');
    return;
  }

  await importPages(report);
  const verification = await verifyImport(report);
  console.log(JSON.stringify({ import: 'completed', verification }, null, 2));

  if (!verification.count_match || !verification.sections_match || !verification.metadata_match) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`[migrate-website-pages] ${error.message}`);
  process.exit(1);
});
