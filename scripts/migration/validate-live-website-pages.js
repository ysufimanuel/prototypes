#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { supabaseAdmin } = require('../../api/_lib/supabase');

function parseArgs(argv) {
  const args = { input: 'live-website-pages.json', report: null };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--input') args.input = argv[++i];
    else if (value === '--report') args.report = path.resolve(argv[++i]);
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function countSections(churches) {
  return churches.reduce((sum, church) =>
    sum + church.pages.reduce((pageSum, page) => pageSum + Number(page.sectionCount || 0), 0), 0);
}

function countMedia(churches, field) {
  return churches.reduce((sum, church) =>
    sum + church.pages.reduce((pageSum, page) => pageSum + Number(page[field] || 0), 0), 0);
}

function normalizeSlug(value, fallback) {
  return String(value ?? fallback ?? '').trim();
}

async function loadReferences() {
  const [{ data: churches, error: churchError }, { data: websites, error: websiteError }, { data: existingPages, error: pageError }] = await Promise.all([
    supabaseAdmin.from('churches').select('id, legacy_id'),
    supabaseAdmin.from('websites').select('id, church_id, enabled, site_name'),
    supabaseAdmin.from('website_pages').select('id, website_id, legacy_id, title, slug, published'),
  ]);

  if (churchError) throw new Error(`Supabase churches query failed: ${churchError.message}`);
  if (websiteError) throw new Error(`Supabase websites query failed: ${websiteError.message}`);
  if (pageError) throw new Error(`Supabase website_pages query failed: ${pageError.message}`);

  return { churches: churches || [], websites: websites || [], existingPages: existingPages || [] };
}

function validate(source, refs) {
  const errors = [];
  const warnings = [];
  const churchByLegacy = new Map(refs.churches.map((row) => [String(row.legacy_id), row]));
  const websiteByChurch = new Map(refs.websites.map((row) => [String(row.church_id), row]));
  const existingByWebsiteSlug = new Map(refs.existingPages.map((row) => [`${row.website_id}:${row.slug}`, row]));
  const sourceKeys = new Set();
  const resultChurches = [];

  if (!Array.isArray(source.churches)) errors.push('source.churches is not an array');

  for (const church of source.churches || []) {
    const legacyChurchId = String(church.firebaseChurchId || '').trim();
    const mappedChurch = churchByLegacy.get(legacyChurchId);
    const website = mappedChurch ? websiteByChurch.get(String(mappedChurch.id)) : null;

    if (!legacyChurchId) errors.push('church has no firebaseChurchId');
    if (!mappedChurch) errors.push(`missing Supabase church mapping for Firebase church ${legacyChurchId}`);
    if (mappedChurch && !website) errors.push(`missing Supabase website for church ${mappedChurch.id} (${legacyChurchId})`);

    const pageKeys = new Set();
    const pages = [];
    for (const page of church.pages || []) {
      const slug = normalizeSlug(page.slug, page.id);
      const key = `${legacyChurchId}:${slug}`;
      if (sourceKeys.has(key)) errors.push(`duplicate source page: ${key}`);
      sourceKeys.add(key);
      if (pageKeys.has(slug)) errors.push(`duplicate slug within church ${legacyChurchId}: ${slug}`);
      pageKeys.add(slug);

      if (!String(page.id || '').trim()) errors.push(`page in ${legacyChurchId} has no id`);
      if (!String(page.title || '').trim()) errors.push(`page ${legacyChurchId}/${page.id} has no title`);
      if (!slug) errors.push(`page ${legacyChurchId}/${page.id} has no slug`);
      if (!Array.isArray(page.sections)) errors.push(`page ${legacyChurchId}/${page.id} sections is not an array`);

      const existing = website ? existingByWebsiteSlug.get(`${website.id}:${slug}`) : null;
      if (existing) {
        warnings.push(`existing Supabase page will be updated: website ${website.id}, slug ${slug}, id ${existing.id}`);
      }

      pages.push({
        firebase_page_id: page.id,
        title: page.title,
        slug,
        published: page.published === true,
        section_count: Number(page.sectionCount || 0),
        media_url_count: Number(page.mediaUrlCount || 0),
        media_object_count: Number(page.mediaObjectCount || 0),
        supabase_existing_page_id: existing?.id ?? null,
      });
    }

    resultChurches.push({
      firebase_church_id: legacyChurchId,
      church_name: church.churchName,
      website_slug: church.websiteSlug,
      supabase_church_id: mappedChurch?.id ?? null,
      website_id: website?.id ?? null,
      website_enabled: website?.enabled ?? null,
      page_count: pages.length,
      sections: pages.reduce((sum, page) => sum + page.section_count, 0),
      media_urls: pages.reduce((sum, page) => sum + page.media_url_count, 0),
      media_objects: pages.reduce((sum, page) => sum + page.media_object_count, 0),
      pages,
    });
  }

  const summary = {
    source_generated_at: source.generatedAt || null,
    source_church_count: source.churchCount,
    source_page_count: source.totalPageCount,
    source_sections: source.totalSections,
    source_media_urls: source.totalMediaUrls,
    source_media_objects: source.totalMediaObjects,
    calculated_church_count: resultChurches.length,
    calculated_page_count: resultChurches.reduce((sum, church) => sum + church.page_count, 0),
    calculated_sections: countSections(source.churches || []),
    calculated_media_urls: countMedia(source.churches || [], 'mediaUrlCount'),
    calculated_media_objects: countMedia(source.churches || [], 'mediaObjectCount'),
    supabase_church_count: refs.churches.length,
    supabase_website_count: refs.websites.length,
    supabase_existing_website_page_count: refs.existingPages.length,
    mapping_error_count: errors.filter((item) => item.includes('mapping') || item.includes('missing Supabase')).length,
    error_count: errors.length,
    warning_count: warnings.length,
    ready_for_import: errors.length === 0,
  };

  if (summary.source_page_count !== summary.calculated_page_count) errors.push('source totalPageCount does not match page count');
  if (summary.source_sections !== summary.calculated_sections) errors.push('source totalSections does not match calculated sections');
  if (summary.source_media_urls !== summary.calculated_media_urls) errors.push('source totalMediaUrls does not match calculated media URLs');
  if (summary.source_media_objects !== summary.calculated_media_objects) errors.push('source totalMediaObjects does not match calculated media objects');

  summary.error_count = errors.length;
  summary.ready_for_import = errors.length === 0;

  return { summary, errors, warnings, churches: resultChurches };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node --env-file=.env scripts/migration/validate-live-website-pages.js [--input live-website-pages.json] [--report report.json]');
    return;
  }

  const inputPath = path.resolve(args.input);
  if (!fs.existsSync(inputPath)) throw new Error(`Input file not found: ${inputPath}`);
  const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const refs = await loadReferences();
  const report = validate(source, refs);

  if (args.report) fs.writeFileSync(args.report, JSON.stringify(report, null, 2), 'utf8');

  console.log('[validate-live-website-pages] READ-ONLY validation');
  console.log(JSON.stringify(report.summary, null, 2));

  if (report.errors.length) {
    console.log('\n[ERRORS]');
    for (const error of report.errors) console.log(`- ${error}`);
    process.exitCode = 2;
  }

  if (report.warnings.length) {
    console.log('\n[WARNINGS]');
    for (const warning of report.warnings) console.log(`- ${warning}`);
  }

  console.log('\n[DETAILS]');
  console.log(JSON.stringify(report.churches, null, 2));
  console.log(`\n[RESULT] ${report.summary.ready_for_import ? 'PASS — safe to proceed to import review.' : 'FAIL — do not import yet.'}`);
}

main().catch((error) => {
  console.error(`[validate-live-website-pages] ${error.message}`);
  process.exit(1);
});
