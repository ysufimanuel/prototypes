#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PLAN = path.resolve('.migration-import-plan-auth-resolved.json');
const DEFAULT_AUTH_MAPPING = path.resolve('.auth-mapping-dry-run.json');
const BATCH_SIZE = 100;

function parseArgs(argv) {
  const args = { plan: DEFAULT_PLAN, authMapping: DEFAULT_AUTH_MAPPING, dryRun: true, verifyOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--plan') args.plan = path.resolve(argv[++i]);
    else if (value === '--auth-mapping') args.authMapping = path.resolve(argv[++i]);
    else if (value === '--apply') args.dryRun = false;
    else if (value === '--dry-run') args.dryRun = true;
    else if (value === '--verify-only') args.verifyOnly = true;
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function usage() {
  console.log(`Usage: node scripts/migration/apply-supabase-import.js [options]\n\nOptions:\n  --plan <file>          Auth-resolved import plan (default: .migration-import-plan-auth-resolved.json)\n  --auth-mapping <file>  Firebase UID -> Supabase Auth UUID mapping (default: .auth-mapping-dry-run.json)\n  --dry-run              Validate the plan and Supabase connectivity without writing (default)\n  --apply                Write the migration to Supabase\n  --verify-only          Verify counts and identity mapping after an import`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function asString(value) {
  if (value == null || value === '') return null;
  return String(value);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set in the environment.`);
  return value;
}

function chunk(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function unique(rows, keyFn) {
  const map = new Map();
  for (const row of rows) map.set(keyFn(row), row);
  return [...map.values()];
}

class SupabaseRest {
  constructor(url, key) {
    this.base = url.replace(/\/$/, '');
    this.key = key;
  }

  async request(table, options = {}) {
    const headers = {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    const response = await fetch(`${this.base}/rest/v1/${table}${options.query || ''}`, {
      method: options.method || 'GET',
      headers,
      body: options.body == null ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!response.ok) {
      throw new Error(`Supabase ${options.method || 'GET'} ${table} failed (${response.status}): ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    }
    return body;
  }

  async health() {
    await this.request('churches', { query: '?select=id&limit=1' });
  }

  async upsert(table, rows, conflict) {
    if (!rows.length) return;
    for (const batch of chunk(rows, BATCH_SIZE)) {
      await this.request(table, {
        method: 'POST',
        query: `?on_conflict=${encodeURIComponent(conflict)}`,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: batch,
      });
    }
  }

  async select(table, query = '?select=*') {
    return this.request(table, { query });
  }
}

function authMapFromFile(source) {
  const rows = Array.isArray(source) ? source : source?.mappings;
  if (!Array.isArray(rows) || !rows.length) throw new Error('Auth mapping is empty.');
  const map = new Map();
  for (const row of rows) {
    const uid = asString(row.firebase_uid);
    const authId = asString(row.auth_user_id);
    if (!uid || !authId) throw new Error('Invalid Auth mapping row.');
    map.set(uid, authId);
  }
  return map;
}

function indexByLegacy(rows, churchKey = 'church_id') {
  const map = new Map();
  for (const row of rows) {
    if (row.legacy_id == null) continue;
    map.set(`${row[churchKey] ?? ''}:${row.legacy_id}`, row.id);
  }
  return map;
}

function authId(firebaseUid, authMap, label) {
  if (firebaseUid == null) return null;
  const id = authMap.get(String(firebaseUid));
  if (!id) throw new Error(`${label}: Firebase UID ${firebaseUid} has no Supabase Auth UUID.`);
  return id;
}

function dateFields(row, fields) {
  const out = { ...row };
  for (const field of fields) if (out[field] === '') out[field] = null;
  return out;
}

async function buildIndexes(db) {
  const names = [
    'churches', 'members', 'families', 'groups', 'events', 'volunteers', 'finance_categories',
    'donors', 'notifications', 'websites', 'donations', 'assignments', 'attendance',
    'income_transactions', 'expense_transactions', 'announcements', 'deaths', 'website_pages',
    'public_sites', 'public_site_pages', 'public_site_events', 'profiles',
  ];
  const result = {};
  for (const table of names) result[table] = await db.select(table);
  return result;
}

function churchMap(rows) {
  const map = new Map();
  for (const row of rows) if (row.legacy_id != null) map.set(String(row.legacy_id), row.id);
  return map;
}

function tenantLegacyMap(rows) {
  const map = new Map();
  for (const row of rows) if (row.legacy_id != null) map.set(`${row.church_id}:${row.legacy_id}`, row.id);
  return map;
}

function mapTenantId(row, churches) {
  const id = churches.get(String(row.church_legacy_id));
  if (!id) throw new Error(`Missing church mapping for ${row.church_legacy_id}.`);
  return id;
}

async function importPlan(db, plan, authMap) {
  const t = plan.tables;

  const churches = unique(t.churches, (r) => r.legacy_id).map((r) => ({
    legacy_id: r.legacy_id,
    nama: r.nama,
    alamat: r.alamat,
    kota: r.kota,
    email: r.email,
    telepon: r.telepon,
    superadmin_uid: authId(r.superadmin_legacy_uid, authMap, `Church ${r.legacy_id} superadmin`),
    subscription: r.subscription || {},
    website: r.website || {},
    ...(r.created_at ? { created_at: r.created_at } : {}),
    ...(r.updated_at ? { updated_at: r.updated_at } : {}),
  }));
  await db.upsert('churches', churches, 'church_id,legacy_id');
  let idx = await buildIndexes(db);
  const churchesByLegacy = churchMap(idx.churches);

  const firebaseUidMapRows = [...authMap.entries()].map(([legacy_uid, auth_user_id]) => ({ legacy_uid, auth_user_id }));
  await db.upsert('firebase_uid_map', firebaseUidMapRows, 'legacy_uid');

  const profiles = t.profiles.map((r) => ({
    id: authId(r.auth_user_legacy_uid || r.legacy_uid, authMap, `Profile ${r.legacy_uid}`),
    church_id: r.church_legacy_id == null ? null : mapTenantId(r, churchesByLegacy),
    nama: r.nama,
    username: r.username,
    email: r.email,
    role: r.role || 'user',
    status: r.status,
    last_login: r.last_login,
    updated_by: authId(r.updated_by_legacy_uid, authMap, `Profile ${r.legacy_uid} updated_by`),
    ...(r.created_at ? { created_at: r.created_at } : {}),
    ...(r.updated_at ? { updated_at: r.updated_at } : {}),
  }));
  await db.upsert('profiles', profiles, 'id');

  const members = t.members.map((r) => ({ ...dateFields(r, ['tgl_lahir','join_date']), church_id: mapTenantId(r, churchesByLegacy), legacy_id: r.legacy_id, nama: r.nama, email:r.email, telepon:r.telepon, jk:r.jk, tempat_lahir:r.tempat_lahir, tgl_lahir:r.tgl_lahir, alamat:r.alamat, kota:r.kota, kodepos:r.kodepos, status:r.status, join_date:r.join_date, avatar:r.avatar, created_at:r.created_at, updated_at:r.updated_at }));
  await db.upsert('members', members, 'church_id,legacy_id');
  idx = await buildIndexes(db);
  const membersByLegacy = tenantLegacyMap(idx.members);

  const families = t.families.map((r) => ({ legacy_id:r.legacy_id, church_id:mapTenantId(r, churchesByLegacy), nama:r.nama, kepala_id:r.kepala_legacy_id == null ? null : membersByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.kepala_legacy_id}`) || null, alamat:r.alamat, kota:r.kota, created_at:r.created_at, updated_at:r.updated_at }));
  await db.upsert('families', families, 'church_id,legacy_id');
  idx = await buildIndexes(db);
  const familiesByLegacy = tenantLegacyMap(idx.families);

  await db.upsert('family_members', t.family_members.map((r) => ({
    family_id: familiesByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.family_legacy_id}`),
    member_id: membersByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.member_legacy_id}`),
  })).filter((r) => r.family_id && r.member_id), 'family_id,member_id');

  const groups = t.groups.map((r) => ({ legacy_id:r.legacy_id, church_id:mapTenantId(r, churchesByLegacy), nama:r.nama, deskripsi:r.deskripsi, leader_id:r.leader_legacy_id == null ? null : membersByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.leader_legacy_id}`) || null, jadwal:r.jadwal, show_phone:Boolean(r.show_phone), created_at:r.created_at, updated_at:r.updated_at }));
  await db.upsert('groups', groups, 'church_id,legacy_id');
  idx = await buildIndexes(db);
  const groupsByLegacy = tenantLegacyMap(idx.groups);
  await db.upsert('group_members', t.group_members.map((r) => ({ group_id:groupsByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.group_legacy_id}`), member_id:membersByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.member_legacy_id}`) })).filter((r) => r.group_id && r.member_id), 'group_id,member_id');

  // Update members.group_id after groups exist.
  const memberUpdates = t.members.map((r) => ({ id:membersByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.legacy_id}`), group_id:r.group_legacy_id == null ? null : groupsByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.group_legacy_id}`) || null })).filter((r) => r.id);
  for (const row of memberUpdates) await db.request('members', { method:'PATCH', query:`?id=eq.${encodeURIComponent(row.id)}`, headers:{Prefer:'return=minimal'}, body:{group_id:row.group_id} });

  const events = t.events.map((r) => ({ legacy_id:r.legacy_id, church_id:mapTenantId(r, churchesByLegacy), nama:r.nama, tipe:r.tipe, custom_type:r.custom_type, starts_at:r.starts_at, ends_at:r.ends_at, lokasi:r.lokasi, deskripsi:r.deskripsi, kapasitas:r.kapasitas, status:r.status, website:r.website || {}, created_at:r.created_at, updated_at:r.updated_at }));
  await db.upsert('events', events, 'church_id,legacy_id');
  idx = await buildIndexes(db);
  const eventsByLegacy = tenantLegacyMap(idx.events);

  await db.upsert('event_participants', t.event_participants.map((r) => ({ event_id:eventsByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.event_legacy_id}`), member_id:r.member_legacy_id == null ? null : membersByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.member_legacy_id}`) || null, nama:r.nama, email:r.email, telepon:r.telepon, alamat:r.alamat, tanggal_daftar:r.tanggal_daftar, is_manual:Boolean(r.is_manual) })).filter((r) => r.event_id), 'event_id,member_id,nama,email,tanggal_daftar');

  const attendance = t.attendance.map((r) => ({ legacy_id:r.legacy_id, church_id:mapTenantId(r, churchesByLegacy), event_id:r.event_legacy_id == null ? null : eventsByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.event_legacy_id}`) || null, member_id:r.member_legacy_id == null ? null : membersByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.member_legacy_id}`) || null, tanggal:r.tanggal, waktu:r.waktu, status:r.status, created_at:r.created_at, updated_at:r.updated_at }));
  await db.upsert('attendance', attendance, 'church_id,legacy_id');

  const donors = t.donors.map((r) => ({ legacy_id:r.legacy_id, church_id:mapTenantId(r, churchesByLegacy), nama:r.nama, email:r.email, telepon:r.telepon, alamat:r.alamat, created_at:r.created_at, updated_at:r.updated_at }));
  await db.upsert('donors', donors, 'church_id,legacy_id');
  idx = await buildIndexes(db);
  const donorsByLegacy = tenantLegacyMap(idx.donors);

  const donations = t.donations.map((r) => ({ legacy_id:r.legacy_id, church_id:mapTenantId(r, churchesByLegacy), donor_id:r.donor_legacy_id == null ? null : membersByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.donor_legacy_id}`) || null, donor_record_id:r.donor_record_legacy_id == null ? null : donorsByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.donor_record_legacy_id}`) || null, tipe:r.tipe, custom_type:r.custom_type, jumlah:r.jumlah, tanggal:r.tanggal, keterangan:r.keterangan, created_at:r.created_at, updated_at:r.updated_at }));
  await db.upsert('donations', donations, 'church_id,legacy_id');

  const volunteers = t.volunteers.map((r) => ({ legacy_id:r.legacy_id, church_id:mapTenantId(r, churchesByLegacy), area:r.area, custom_area:r.custom_area, jadwal:r.jadwal || [], service_date:r.service_date, service_time:r.service_time, status:r.status, member_id:r.member_legacy_id == null ? null : membersByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.member_legacy_id}`) || null, external_nama:r.external_nama, external_email:r.external_email, external_telepon:r.external_telepon, created_at:r.created_at, updated_at:r.updated_at }));
  await db.upsert('volunteers', volunteers, 'church_id,legacy_id');
  idx = await buildIndexes(db);
  const volunteersByLegacy = tenantLegacyMap(idx.volunteers);
  await db.upsert('assignments', t.assignments.map((r) => ({ legacy_id:r.legacy_id, church_id:mapTenantId(r, churchesByLegacy), volunteer_id:r.volunteer_legacy_id == null ? null : volunteersByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.volunteer_legacy_id}`) || null, event_id:r.event_legacy_id == null ? null : eventsByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.event_legacy_id}`) || null, tanggal:r.tanggal, waktu:r.waktu, tempat:r.tempat, tugas:r.tugas, catatan:r.catatan, status:r.status, created_at:r.created_at, updated_at:r.updated_at })), 'church_id,legacy_id');

  const categories = t.finance_categories.map((r) => ({ legacy_id:r.legacy_id, church_id:mapTenantId(r, churchesByLegacy), nama:r.nama, tipe:r.tipe, deskripsi:r.deskripsi, created_at:r.created_at, updated_at:r.updated_at }));
  await db.upsert('finance_categories', categories, 'church_id,legacy_id');
  idx = await buildIndexes(db);
  const categoriesByLegacy = tenantLegacyMap(idx.finance_categories);

  await db.upsert('finance_config', t.finance_config.map((r) => ({ church_id:mapTenantId(r, churchesByLegacy), config:r.config || {}, created_at:r.created_at, updated_at:r.updated_at })), 'church_id');

  const income = t.income_transactions.map((r) => ({ legacy_id:r.legacy_id, church_id:mapTenantId(r, churchesByLegacy), kategori_id:r.kategori_legacy_id == null ? null : categoriesByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.kategori_legacy_id}`) || null, jumlah:r.jumlah, tanggal:r.tanggal, donatur_id:r.donatur_legacy_id == null ? null : donorsByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.donatur_legacy_id}`) || null, keterangan:r.keterangan, status:r.status || 'pending', approved_by:authId(r.approved_by_auth_user_id, authMap, `Income ${r.legacy_id} approved_by`), approved_at:r.approved_at, created_at:r.created_at, updated_at:r.updated_at }));
  // Migration 0010 keeps the member identity separately from donor records.
  for (let i = 0; i < income.length; i += 1) income[i].donatur_member_id = t.income_transactions[i].donatur_member_legacy_id == null ? null : membersByLegacy.get(`${churchesByLegacy.get(String(t.income_transactions[i].church_legacy_id))}:${t.income_transactions[i].donatur_member_legacy_id}`) || null;
  await db.upsert('income_transactions', income, 'church_id,legacy_id');

  await db.upsert('expense_transactions', t.expense_transactions.map((r) => ({ legacy_id:r.legacy_id, church_id:mapTenantId(r, churchesByLegacy), kategori_id:r.kategori_legacy_id == null ? null : categoriesByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.kategori_legacy_id}`) || null, jumlah:r.jumlah, tanggal:r.tanggal, keterangan:r.keterangan, status:r.status || 'pending', approved_by:authId(r.approved_by_auth_user_id, authMap, `Expense ${r.legacy_id} approved_by`), approved_at:r.approved_at, created_at:r.created_at, updated_at:r.updated_at })), 'church_id,legacy_id');

  await db.upsert('approval_history', t.approval_history.map((r) => ({ legacy_id:r.legacy_id, church_id:mapTenantId(r, churchesByLegacy), tipe:r.tipe, item_id:r.item_id, action:r.action, by_user_id:authId(r.by_auth_user_id, authMap, `Approval ${r.legacy_id} by`), occurred_at:r.occurred_at })), 'church_id,legacy_id');
  await db.upsert('announcements', t.announcements.map((r) => ({ legacy_id:r.legacy_id, church_id:mapTenantId(r, churchesByLegacy), judul:r.judul, konten:r.konten, tanggal:r.tanggal, expiry:r.expiry, important:Boolean(r.important), author_id:authId(r.author_auth_user_id, authMap, `Announcement ${r.legacy_id} author`), created_at:r.created_at, updated_at:r.updated_at })), 'church_id,legacy_id');

  const notifications = t.notifications.map((r) => ({ legacy_id:r.legacy_id, church_id:mapTenantId(r, churchesByLegacy), title:r.title, message:r.message, type:r.type, data:r.data || {}, created_at:r.created_at }));
  await db.upsert('notifications', notifications, 'church_id,legacy_id');
  idx = await buildIndexes(db);
  const notificationsByLegacy = tenantLegacyMap(idx.notifications);
  await db.upsert('notification_recipients', t.notification_recipients.map((r) => ({ notification_id:notificationsByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.notification_legacy_id}`), user_id:authId(r.user_auth_user_id, authMap, `Notification recipient ${r.notification_legacy_id}`), read:Boolean(r.read), read_at:r.read_at })).filter((r) => r.notification_id && r.user_id), 'notification_id,user_id');

  await db.upsert('messages', t.messages.map((r) => ({ legacy_id:r.legacy_id, church_id:mapTenantId(r, churchesByLegacy), sender_id:authId(r.sender_auth_user_id, authMap, `Message ${r.legacy_id} sender`), receiver_id:authId(r.receiver_auth_user_id, authMap, `Message ${r.legacy_id} receiver`), content:r.content || '', timestamp:r.timestamp, read:Boolean(r.read), created_at:r.created_at, updated_at:r.updated_at })), 'church_id,legacy_id');
  await db.upsert('deaths', t.deaths.map((r) => ({ legacy_id:r.legacy_id, church_id:mapTenantId(r, churchesByLegacy), nama:r.nama, tgl_lahir:r.tgl_lahir, tgl_wafat:r.tgl_wafat, riwayat_penyakit:r.riwayat_penyakit, penyebab:r.penyebab, tempat:r.tempat, waktu:r.waktu, created_at:r.created_at, updated_at:r.updated_at })), 'church_id,legacy_id');

  const websites = t.websites.map((r) => ({ church_id:mapTenantId(r, churchesByLegacy), enabled:Boolean(r.enabled), template_id:r.template_id, site_name:r.site_name, tagline:r.tagline, logo_url:r.logo_url, favicon_url:r.favicon_url, theme:r.theme || {}, seo:r.seo || {}, contact:r.contact || {}, social:r.social || {}, status:r.status, published_at:r.published_at, published_by:authId(r.published_by_auth_user_id, authMap, `Website ${r.church_legacy_id} published_by`), created_at:r.created_at, updated_at:r.updated_at }));
  await db.upsert('websites', websites, 'church_id');
  idx = await buildIndexes(db);
  const websitesByChurch = new Map(idx.websites.map((r) => [String(r.church_id), r.id]));
  await db.upsert('website_pages', t.website_pages.map((r) => ({ website_id:websitesByChurch.get(String(churchesByLegacy.get(String(r.church_legacy_id)))), legacy_id:r.legacy_id, title:r.title, slug:r.slug, published:Boolean(r.published), sections:r.sections || [], updated_by:authId(r.updated_by_auth_user_id, authMap, `Website page ${r.legacy_id} updated_by`), created_at:r.created_at, updated_at:r.updated_at })).filter((r) => r.website_id), 'website_id,slug');
  await db.upsert('website_navigation', t.website_navigation.map((r) => ({ website_id:websitesByChurch.get(String(churchesByLegacy.get(String(r.church_legacy_id)))), items:r.items || [], updated_by:authId(r.updated_by_auth_user_id, authMap, `Website navigation ${r.church_legacy_id} updated_by`), created_at:r.created_at, updated_at:r.updated_at })).filter((r) => r.website_id), 'website_id');
  await db.upsert('site_slugs', t.siteSlugs.map((r) => ({ slug:r.slug, church_id:mapTenantId(r, churchesByLegacy), updated_at:r.updated_at || new Date().toISOString() })), 'slug');
  await db.upsert('public_sites', t.publicSites.map((r) => ({ church_id:mapTenantId(r, churchesByLegacy), config:r.config || {}, navigation:r.navigation || {}, published_at:r.published_at, published_by:authId(r.published_by_auth_user_id, authMap, `Public site ${r.church_legacy_id} published_by`), updated_at:r.updated_at })).filter((r) => r.church_id), 'church_id');
  idx = await buildIndexes(db);
  const publicSitesByChurch = new Map(idx.public_sites.map((r) => [String(r.church_id), r.id]));
  await db.upsert('public_site_pages', t.public_site_pages.map((r) => ({ church_id:mapTenantId(r, churchesByLegacy), page_id:r.page_id == null ? null : idx.website_pages.find((p) => String(p.legacy_id) === String(r.page_legacy_id))?.id || null, title:r.title, slug:r.slug, sections:r.sections || [], published_at:r.published_at })).filter((r) => r.church_id), 'church_id,slug');
  await db.upsert('public_site_events', t.public_site_events.map((r) => ({ church_id:mapTenantId(r, churchesByLegacy), event_id:r.event_legacy_id == null ? null : eventsByLegacy.get(`${churchesByLegacy.get(String(r.church_legacy_id))}:${r.event_legacy_id}`) || null, nama:r.nama, tipe:r.tipe, custom_type:r.custom_type, starts_at:r.starts_at, ends_at:r.ends_at, lokasi:r.lokasi, deskripsi:r.deskripsi, kapasitas:r.kapasitas, featured:Boolean(r.featured), published_at:r.published_at })).filter((r) => r.church_id), 'church_id,event_id');

  return buildIndexes(db);
}

async function verify(db, plan, indexes) {
  const expected = plan.counts || {};
  const checks = [];
  for (const table of Object.keys(expected)) {
    if (!Array.isArray(indexes[table])) continue;
    checks.push({ table, expected: expected[table], actual: indexes[table].length });
  }
  const failed = checks.filter((c) => c.expected !== c.actual);
  if (failed.length) {
    console.error('Verification failed:');
    for (const row of failed) console.error(`- ${row.table}: expected=${row.expected}, actual=${row.actual}`);
    throw new Error(`${failed.length} table count mismatches.`);
  }
  console.log('Supabase import verification: PASS');
  for (const row of checks) console.log(`${row.table}: ${row.actual}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();

  const url = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const plan = readJson(args.plan);
  const authMap = authMapFromFile(readJson(args.authMapping));

  if (plan.version !== 3 || plan.mode !== 'auth-resolved-dry-run') {
    throw new Error('Importer requires an auth-resolved dry-run plan (version 3).');
  }
  if (plan.validation?.firebaseToSupabaseAuthMappingChecked !== true) throw new Error('Auth mapping validation flag is missing.');
  if (plan.validation?.liveSupabaseWrite !== false) throw new Error('Plan indicates live Supabase write; refusing to continue.');

  const db = new SupabaseRest(url, serviceRoleKey);
  await db.health();
  console.log('Supabase REST connectivity: PASS');

  if (args.verifyOnly) {
    const indexes = await buildIndexes(db);
    await verify(db, plan, indexes);
    return;
  }

  if (args.dryRun) {
    console.log('Preflight PASS. No Supabase writes performed.');
    console.log('Use --apply only after confirming the target Supabase project is the intended migration target.');
    return;
  }

  console.log('LIVE IMPORT START');
  console.log('Target:', url);
  console.log('Service role key: present (value not displayed)');
  await importPlan(db, plan, authMap);
  const indexes = await buildIndexes(db);
  await verify(db, plan, indexes);
  console.log('LIVE IMPORT COMPLETE');
}

main().catch((error) => {
  console.error(`Supabase import failed: ${error.message}`);
  process.exitCode = 1;
});
