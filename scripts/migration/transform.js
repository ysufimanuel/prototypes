#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readBackup, collectionEntries } = require('./firebase-backup-reader');

function parseArgs(argv) {
  const args = { input: null, output: path.resolve('.migration-data-v4.json') };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--input') args.input = argv[++i];
    else if (value === '--output') args.output = path.resolve(argv[++i]);
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function asIso(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

function asDate(value) {
  if (value == null) return null;
  const iso = asIso(value);
  return typeof iso === 'string' ? iso.slice(0, 10) : iso;
}

function unwrap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value || {};
  return value._data && typeof value._data === 'object' ? value._data : value;
}

function nestedEntries(backup, churchId, collectionName) {
  const church = backup.churches?.[churchId] || {};
  const collection = church._subCollections?.[collectionName] || {};
  return Object.entries(collection).map(([id, wrapped]) => ({ id, value: unwrap(wrapped) }));
}

function mapRows(backup, collectionName, mapper) {
  return collectionEntries(backup, collectionName).map(({ id, value }) => mapper(id, unwrap(value)));
}

function mapChurchRows(backup, collectionName, mapper) {
  const rows = [];
  for (const churchId of Object.keys(backup.churches || {})) {
    for (const { id, value } of nestedEntries(backup, churchId, collectionName)) rows.push(mapper(churchId, id, value));
  }
  return rows;
}

function ref(value) {
  if (value == null) return null;
  return String(value);
}

function participantRows(churchId, eventId, participants) {
  if (!Array.isArray(participants)) return [];
  return participants.map((participant, index) => {
    const p = participant && typeof participant === 'object' ? participant : {};
    const memberId = p.memberId ?? p.memberID ?? null;
    return {
      legacy_id: `${eventId}:participant:${index + 1}`,
      church_legacy_id: churchId,
      event_legacy_id: ref(eventId),
      member_legacy_id: memberId == null ? null : ref(memberId),
      nama: p.nama ?? null,
      email: p.email ?? null,
      telepon: p.telepon ?? null,
      alamat: p.alamat ?? null,
      tanggal_daftar: asIso(p.tanggalDaftar),
      is_manual: Boolean(p.isManual),
    };
  });
}

function transform(backup, sourcePath) {
  const churches = mapRows(backup, 'churches', (legacyId, doc) => ({ legacy_id: legacyId, nama: doc.nama ?? '', alamat: doc.alamat ?? null, kota: doc.kota ?? null, email: doc.email ?? null, telepon: doc.telepon ?? null, superadmin_legacy_uid: doc.superadminUid ?? null, subscription: doc.subscription ?? {}, website: doc.website ?? {}, created_at: asIso(doc.createdAt), updated_at: asIso(doc.updatedAt) }));
  const users = mapRows(backup, 'users', (legacyUid, doc) => ({ legacy_uid: doc.uid ?? legacyUid, church_legacy_id: doc.churchId ?? null, nama: doc.nama ?? null, username: doc.username ?? null, email: doc.email ?? null, role: doc.role ?? 'user', status: doc.status ?? null, created_at: asIso(doc.createdAt), updated_at: asIso(doc.updatedAt), last_login: asIso(doc.lastLogin), updated_by_legacy_uid: doc.updatedBy ?? null }));
  const messages = mapRows(backup, 'messages', (legacyId, doc) => ({ legacy_id: legacyId, church_legacy_id: doc.churchId ?? null, sender_legacy_uid: doc.senderId ?? null, receiver_legacy_uid: doc.receiverId ?? null, content: doc.content ?? '', timestamp: asIso(doc.timestamp), read: Boolean(doc.read), created_at: asIso(doc.createdAt ?? doc.timestamp), updated_at: asIso(doc.updatedAt ?? doc.timestamp) }));

  const members = mapChurchRows(backup, 'members', (churchId, legacyId, doc) => ({ legacy_id: ref(doc.id ?? legacyId), church_legacy_id: churchId, nama: doc.nama ?? '', email: doc.email ?? null, telepon: doc.telepon ?? null, jk: doc.jk ?? null, tempat_lahir: doc.tempatLahir ?? null, tgl_lahir: asDate(doc.tglLahir), alamat: doc.alamat ?? null, kota: doc.kota ?? null, kodepos: doc.kodepos ?? null, status: doc.status ?? null, group_legacy_id: doc.groupId == null ? null : ref(doc.groupId), join_date: asDate(doc.joinDate), avatar: doc.avatar ?? null, created_at: asIso(doc.createdAt ?? doc.joinDate), updated_at: asIso(doc.updatedAt ?? doc.createdAt ?? doc.joinDate) }));
  const families = mapChurchRows(backup, 'families', (churchId, legacyId, doc) => ({ legacy_id: ref(doc.id ?? legacyId), church_legacy_id: churchId, nama: doc.nama ?? '', kepala_legacy_id: doc.kepalaId == null ? null : ref(doc.kepalaId), alamat: doc.alamat ?? null, kota: doc.kota ?? null, created_at: asIso(doc.createdAt ?? doc.updatedAt), updated_at: asIso(doc.updatedAt ?? doc.createdAt) }));
  const family_members = [];
  for (const churchId of Object.keys(backup.churches || {})) for (const { id, value } of nestedEntries(backup, churchId, 'families')) for (const memberId of Array.isArray(value.anggota) ? value.anggota : []) family_members.push({ family_legacy_id: ref(value.id ?? id), member_legacy_id: ref(memberId), church_legacy_id: churchId });

  const groups = mapChurchRows(backup, 'groups', (churchId, legacyId, doc) => ({ legacy_id: ref(doc.id ?? legacyId), church_legacy_id: churchId, nama: doc.nama ?? '', deskripsi: doc.deskripsi ?? null, leader_legacy_id: doc.leaderId == null ? null : ref(doc.leaderId), jadwal: doc.jadwal ?? null, show_phone: Boolean(doc.showPhone), created_at: asIso(doc.createdAt ?? doc.updatedAt), updated_at: asIso(doc.updatedAt ?? doc.createdAt) }));
  const group_members = [];
  for (const churchId of Object.keys(backup.churches || {})) for (const { id, value } of nestedEntries(backup, churchId, 'groups')) for (const memberId of Array.isArray(value.anggota) ? value.anggota : []) group_members.push({ group_legacy_id: ref(value.id ?? id), member_legacy_id: ref(memberId), church_legacy_id: churchId });

  const events = mapChurchRows(backup, 'events', (churchId, legacyId, doc) => ({ legacy_id: ref(doc.id ?? legacyId), church_legacy_id: churchId, nama: doc.nama ?? '', tipe: doc.tipe ?? null, custom_type: doc.customType ?? null, starts_at: asIso(doc.start), ends_at: asIso(doc.end), lokasi: doc.lokasi ?? null, deskripsi: doc.deskripsi ?? null, kapasitas: doc.kapasitas == null ? null : Number(doc.kapasitas), status: doc.status ?? null, website: doc.website ?? {}, created_at: asIso(doc.createdAt ?? doc.updatedAt), updated_at: asIso(doc.updatedAt ?? doc.createdAt) }));
  const event_participants = [];
  for (const churchId of Object.keys(backup.churches || {})) for (const { id, value } of nestedEntries(backup, churchId, 'events')) event_participants.push(...participantRows(churchId, ref(value.id ?? id), value.participants));
  const attendance = mapChurchRows(backup, 'attendance', (churchId, legacyId, doc) => ({ legacy_id: ref(doc.id ?? legacyId), church_legacy_id: churchId, event_legacy_id: doc.eventId == null ? null : ref(doc.eventId), member_legacy_id: doc.memberId == null ? null : ref(doc.memberId), tanggal: asDate(doc.tanggal), waktu: doc.waktu ?? null, status: doc.status ?? null, created_at: asIso(doc.createdAt ?? doc.updatedAt), updated_at: asIso(doc.updatedAt ?? doc.createdAt) }));

  const donors = [];
  const donations = mapChurchRows(backup, 'donations', (churchId, legacyId, doc) => ({ legacy_id: ref(doc.id ?? legacyId), church_legacy_id: churchId, donor_legacy_id: doc.donorId == null ? null : ref(doc.donorId), donor_record_legacy_id: null, tipe: doc.tipe ?? null, custom_type: doc.customType ?? null, jumlah: Number(doc.jumlah ?? 0), tanggal: asDate(doc.tanggal), keterangan: doc.keterangan ?? null, created_at: asIso(doc.createdAt ?? doc.updatedAt), updated_at: asIso(doc.updatedAt ?? doc.createdAt) }));
  const volunteers = mapChurchRows(backup, 'volunteers', (churchId, legacyId, doc) => ({ legacy_id: ref(doc.id ?? legacyId), church_legacy_id: churchId, area: doc.area ?? null, custom_area: doc.customArea ?? null, jadwal: Array.isArray(doc.jadwal) ? doc.jadwal : [], service_date: asDate(doc.serviceDate), service_time: doc.serviceTime ?? null, status: doc.status ?? null, member_legacy_id: doc.memberId == null ? null : ref(doc.memberId), external_nama: doc.externalNama ?? null, external_email: doc.externalEmail ?? null, external_telepon: doc.externalTelepon ?? null, created_at: asIso(doc.createdAt ?? doc.updatedAt), updated_at: asIso(doc.updatedAt ?? doc.createdAt) }));
  const assignments = mapChurchRows(backup, 'assignments', (churchId, legacyId, doc) => ({ legacy_id: ref(doc.id ?? legacyId), church_legacy_id: churchId, volunteer_legacy_id: doc.volunteerId == null ? null : ref(doc.volunteerId), event_legacy_id: doc.eventId == null ? null : ref(doc.eventId), tanggal: asDate(doc.tanggal), waktu: doc.waktu ?? null, tempat: doc.tempat ?? null, tugas: doc.tugas ?? null, catatan: doc.catatan ?? null, status: doc.status ?? null, created_at: asIso(doc.createdAt ?? doc.updatedAt), updated_at: asIso(doc.updatedAt ?? doc.createdAt) }));

  const finance_categories = mapChurchRows(backup, 'financeCategories', (churchId, legacyId, doc) => ({ legacy_id: ref(doc.id ?? legacyId), church_legacy_id: churchId, nama: doc.nama ?? '', tipe: doc.tipe ?? '', deskripsi: doc.deskripsi ?? null, created_at: asIso(doc.createdAt ?? doc.updatedAt), updated_at: asIso(doc.updatedAt ?? doc.createdAt) }));
  const finance_config = mapChurchRows(backup, 'financeConfig', (churchId, legacyId, doc) => ({ legacy_id: ref(doc.id ?? legacyId), church_legacy_id: churchId, config: doc, created_at: asIso(doc.createdAt ?? doc.updatedAt), updated_at: asIso(doc.updatedAt ?? doc.createdAt) }));
  const income_transactions = mapChurchRows(backup, 'pemasukan', (churchId, legacyId, doc) => ({ legacy_id: ref(doc.id ?? legacyId), church_legacy_id: churchId, kategori_legacy_id: doc.kategoriId == null ? null : ref(doc.kategoriId), jumlah: Number(doc.jumlah ?? 0), tanggal: asDate(doc.tanggal), donatur_member_legacy_id: doc.donaturId == null ? null : ref(doc.donaturId), keterangan: doc.keterangan ?? null, status: doc.status ?? 'pending', approved_by_legacy_ref: doc.approvedBy == null ? null : ref(doc.approvedBy), approved_at: asIso(doc.approvedAt), created_at: asIso(doc.createdAt ?? doc.updatedAt), updated_at: asIso(doc.updatedAt ?? doc.createdAt) }));
  const expense_transactions = mapChurchRows(backup, 'pengeluaran', (churchId, legacyId, doc) => ({ legacy_id: ref(doc.id ?? legacyId), church_legacy_id: churchId, kategori_legacy_id: doc.kategoriId == null ? null : ref(doc.kategoriId), jumlah: Number(doc.jumlah ?? 0), tanggal: asDate(doc.tanggal), keterangan: doc.keterangan ?? null, status: doc.status ?? 'pending', approved_by_legacy_ref: doc.approvedBy == null ? null : ref(doc.approvedBy), approved_at: asIso(doc.approvedAt), created_at: asIso(doc.createdAt ?? doc.updatedAt), updated_at: asIso(doc.updatedAt ?? doc.createdAt) }));
  const approval_history = mapChurchRows(backup, 'approvalHistory', (churchId, legacyId, doc) => ({ legacy_id: ref(doc.id ?? legacyId), church_legacy_id: churchId, tipe: doc.tipe ?? null, item_id: doc.itemId == null ? null : ref(doc.itemId), action: doc.action ?? null, by_legacy_ref: doc.by == null ? null : ref(doc.by), occurred_at: asIso(doc.timestamp ?? doc.createdAt ?? doc.updatedAt) }));
  const announcements = mapChurchRows(backup, 'announcements', (churchId, legacyId, doc) => ({ legacy_id: ref(doc.id ?? legacyId), church_legacy_id: churchId, judul: doc.judul ?? '', konten: doc.konten ?? null, tanggal: asIso(doc.tanggal), expiry: asIso(doc.expiry), important: Boolean(doc.important), author_legacy_ref: doc.authorId == null ? null : ref(doc.authorId), created_at: asIso(doc.createdAt ?? doc.updatedAt ?? doc.tanggal), updated_at: asIso(doc.updatedAt ?? doc.createdAt ?? doc.tanggal) }));

  const notifications = mapChurchRows(backup, 'notifications', (churchId, legacyId, doc) => ({ legacy_id: legacyId, church_legacy_id: churchId, title: doc.title ?? null, message: doc.message ?? null, type: doc.type ?? null, data: { senderId: doc.senderId ?? null, actorId: doc.actorId ?? null, messageId: doc.messageId ?? null, collection: doc.collection ?? null, action: doc.action ?? null }, created_at: asIso(doc.createdAt ?? doc.timestamp) }));
  const notification_recipients = mapChurchRows(backup, 'notifications', (churchId, legacyId, doc) => ({ notification_legacy_id: legacyId, church_legacy_id: churchId, user_legacy_uid: doc.userId ?? null, read: Boolean(doc.read), read_at: doc.read ? asIso(doc.updatedAt ?? doc.createdAt ?? doc.timestamp) : null })).filter((row) => row.user_legacy_uid);
  const deaths = mapChurchRows(backup, 'deaths', (churchId, legacyId, doc) => ({ legacy_id: ref(doc.id ?? legacyId), church_legacy_id: churchId, nama: doc.nama ?? '', tgl_lahir: asDate(doc.tglLahir), tgl_wafat: asDate(doc.tglWafat), riwayat_penyakit: doc.riwayatPenyakit ?? null, penyebab: doc.penyebab ?? null, tempat: doc.tempat ?? null, waktu: doc.waktu ?? null, created_at: asIso(doc.createdAt ?? doc.updatedAt), updated_at: asIso(doc.updatedAt ?? doc.createdAt) }));

  const websites = [];
  const website_navigation = [];
  const website_pages = [];
  for (const churchId of Object.keys(backup.churches || {})) {
    const config = nestedEntries(backup, churchId, 'website').find((row) => row.id === 'config');
    const navigation = nestedEntries(backup, churchId, 'website').find((row) => row.id === 'navigation');
    if (config) {
      const doc = config.value;
      websites.push({ church_legacy_id: churchId, enabled: Boolean(doc.enabled), template_id: doc.templateId ?? null, site_name: doc.siteName ?? null, tagline: doc.tagline ?? null, logo_url: doc.logoUrl ?? null, favicon_url: doc.faviconUrl ?? null, theme: doc.theme ?? {}, seo: doc.seo ?? {}, contact: doc.contact ?? {}, social: doc.social ?? {}, status: doc.status ?? null, published_at: asIso(doc.publishedAt), published_by_legacy_ref: doc.publishedBy ?? null, created_at: asIso(doc.createdAt ?? doc.updatedAt), updated_at: asIso(doc.updatedAt ?? doc.createdAt), updated_by_legacy_ref: doc.updatedBy ?? null });
    }
    if (navigation) {
      const doc = navigation.value;
      website_navigation.push({ church_legacy_id: churchId, items: Array.isArray(doc.items) ? doc.items : [], updated_by_legacy_ref: doc.updatedBy ?? null, created_at: asIso(doc.createdAt ?? doc.updatedAt), updated_at: asIso(doc.updatedAt ?? doc.createdAt) });
    }
    const websiteSub = backup.churches?.[churchId]?._subCollections?.website?.content?.pages;
    if (websiteSub && typeof websiteSub === 'object') {
      for (const [pageId, wrapped] of Object.entries(websiteSub)) {
        const doc = unwrap(wrapped);
        website_pages.push({ legacy_id: pageId, church_legacy_id: churchId, title: doc.title ?? '', slug: doc.slug ?? pageId, published: Boolean(doc.published), sections: Array.isArray(doc.sections) ? doc.sections : [], updated_by_legacy_ref: doc.updatedBy ?? null, created_at: asIso(doc.createdAt ?? doc.updatedAt), updated_at: asIso(doc.updatedAt ?? doc.createdAt) });
      }
    }
  }

  const siteSlugs = mapRows(backup, 'siteSlugs', (slug, doc) => ({ slug, church_legacy_id: doc.churchId ?? null, updated_at: asIso(doc.updatedAt) }));
  const publicSites = mapRows(backup, 'publicSites', (legacyId, doc) => ({ legacy_id: legacyId, church_legacy_id: doc.churchId ?? legacyId, config: doc.config ?? {}, navigation: doc.navigation ?? {}, published_at: asIso(doc.publishedAt), published_by_legacy_ref: doc.publishedBy ?? null, updated_at: asIso(doc.updatedAt) }));

  return {
    meta: { source: path.resolve(sourcePath), generated_at: new Date().toISOString(), transformer_version: 4, source_type: 'firebase-firestore-backup', source_format: 'churches/{churchId}/_subCollections/{collection}' },
    collections: { churches, users, messages, members, families, family_members, groups, group_members, events, event_participants, attendance, donors, donations, volunteers, assignments, finance_categories, finance_config, income_transactions, expense_transactions, approval_history, announcements, notifications, notification_recipients, deaths, websites, website_pages, website_navigation, siteSlugs, publicSites, public_site_pages: [], public_site_events: [] },
    migration_warnings: [
      'This transformer reads the complete nested church backup and unwraps Firestore scraper _data wrappers.',
      'No donor documents were present in the supplied backup; donation donorId values are preserved as member references and donor_record_legacy_id remains null.',
      'Legacy numeric user references are preserved as *_legacy_ref fields and must be resolved before UUID columns are populated.',
      'Firebase Auth UIDs remain legacy_uid values and must be mapped to Supabase auth.users UUIDs through firebase_uid_map.',
      'The supplied backup contains website config/navigation but no website content/pages documents, so website_pages remains empty.',
      'publicSites is empty; this is allowed because it is a published projection, not CMS source data.',
      'Firestore Timestamp-shaped objects are normalized to ISO-8601 strings.'
    ]
  };
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.input) {
      console.log('Usage: node scripts/migration/transform.js --input /path/to/backup.json [--output /path/to/migration-data-v4.json]');
      process.exit(args.help ? 0 : 1);
    }
    const { backup, sourcePath } = readBackup(args.input);
    const dataset = transform(backup, sourcePath);
    fs.writeFileSync(args.output, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
    console.log(`Migration dataset written: ${args.output}`);
    for (const [name, rows] of Object.entries(dataset.collections)) console.log(`${name}: ${rows.length}`);
  } catch (error) {
    console.error(`[migration-transform] ${error.message}`);
    process.exit(1);
  }
}

module.exports = { transform, asIso };
