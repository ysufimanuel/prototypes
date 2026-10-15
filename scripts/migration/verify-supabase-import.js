#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const planFile = path.resolve(process.argv.includes('--plan') ? process.argv[process.argv.indexOf('--plan') + 1] : '.migration-import-plan-auth-resolved.json');
const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SECRET_KEY || '';

const tables = [
  'churches','profiles','members','families','family_members','groups','group_members','events','event_participants','attendance',
  'donors','donations','volunteers','assignments','finance_categories','finance_config','income_transactions','expense_transactions',
  'approval_history','announcements','notifications','notification_recipients','messages','deaths','websites','website_pages',
  'website_navigation','site_slugs','public_sites','public_site_pages','public_site_events'
];

async function count(table) {
  const r = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, { headers: { apikey:key, Authorization:`Bearer ${key}`, Prefer:'count=exact' } });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
  return Number((r.headers.get('content-range') || '*/0').split('/')[1] || 0);
}

async function main() {
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY.');
  const plan = JSON.parse(fs.readFileSync(planFile,'utf8'));
  const expected = plan.counts || {};
  let failed = false;
  console.log(`Plan: ${planFile}`);
  console.log('Supabase import verification');
  for (const table of tables) {
    const actual = await count(table);
    const want = Number(expected[table] || 0);
    const ok = actual === want;
    if (!ok) failed = true;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${table}: expected=${want} actual=${actual}`);
  }
  if (failed) throw new Error('Count verification failed. Do not switch the application to Supabase yet.');
  console.log('PASS: all 31 migration table counts match the audited plan.');
}

main().catch(error => { console.error(`VERIFICATION FAILED: ${error.message}`); process.exitCode = 1; });
