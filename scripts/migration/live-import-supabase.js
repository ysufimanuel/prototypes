#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_PLAN = path.resolve(".migration-import-plan-auth-resolved.json");
const CHUNK = 50;
const argv = process.argv.slice(2);

function value(name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 ? path.resolve(argv[i + 1]) : fallback;
}
function has(name) {
  return argv.includes(name);
}
function rows(t, n) {
  return Array.isArray(t?.[n]) ? t[n] : [];
}
function s(v) {
  return v == null || v === "" ? null : String(v);
}
function churchMap(rows) {
  return new Map(rows.map((r) => [s(r.legacy_id), r.id]));
}
function scopedMap(rows) {
  return new Map(
    rows.map((r) => [`${s(r.church_id)}:${s(r.legacy_id)}`, r.id]),
  );
}

function usage() {
  console.log(
    `Usage: node scripts/migration/live-import-supabase.js [options]\n\n  --plan <file>          Auth-resolved plan\n  --dry-run              Validate only (default)\n  --apply                Write to Supabase\n  --allow-nonempty       Allow import into non-empty CMS tables`,
  );
}

async function api(cfg, table, method, body, query = "") {
  const r = await fetch(`${cfg.url}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${table} ${r.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function upsert(cfg, table, data, conflict) {
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    await api(
      cfg,
      table,
      "POST",
      chunk,
      `?on_conflict=${encodeURIComponent(conflict)}`,
    );
    console.log(
      `  ${table}: ${Math.min(i + CHUNK, data.length)}/${data.length}`,
    );
  }
}

async function select(cfg, table, cols) {
  return api(cfg, table, "GET", null, `?select=${encodeURIComponent(cols)}`);
}
async function patch(cfg, table, filter, body) {
  const q = Object.entries(filter)
    .map(([k, v]) => `${encodeURIComponent(k)}=eq.${encodeURIComponent(v)}`)
    .join("&");
  await api(cfg, table, "PATCH", body, `?${q}`);
}

async function main() {
  if (has("--help") || has("-h")) return usage();
  const planFile = value("--plan", DEFAULT_PLAN);
  const apply = has("--apply");
  if (apply && has("--dry-run"))
    throw new Error("Choose one of --dry-run or --apply.");
  const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
  if (
    plan.mode !== "auth-resolved-dry-run" ||
    plan.validation?.liveSupabaseWrite !== false
  )
    throw new Error("Invalid auth-resolved migration plan.");
  if (
    !plan.validation?.profilesHaveAuthUserId ||
    !plan.validation?.resolvedUserRefsHaveAuthUserId
  )
    throw new Error("Auth UUID validation is incomplete.");
  console.log(`Plan: ${planFile}`);
  console.log(`Mode: ${apply ? "LIVE APPLY" : "DRY-RUN"}`);
  if (!apply) {
    console.log("DRY-RUN PASS: no Supabase write performed.");
    return;
  }

  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || "";
  if (!url || !key)
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SECRET_KEY for --apply. Keep the secret key out of source control.",
    );

  const cfg = { url, key };
  const targetTables = [
    "churches",
    "profiles",
    "members",
    "families",
    "groups",
    "events",
    "attendance",
    "donors",
    "donations",
    "volunteers",
    "assignments",
    "finance_categories",
    "finance_config",
    "income_transactions",
    "expense_transactions",
    "approval_history",
    "announcements",
    "notifications",
    "messages",
    "deaths",
    "websites",
    "website_pages",
    "website_navigation",
    "site_slugs",
  ];
  if (!has("--allow-nonempty")) {
    const inspectColumns = {
      family_members: "family_id",
      group_members: "group_id",
      notification_recipients: "notification_id",
      site_slugs: "slug",
    };

    for (const table of targetTables) {
      // Allow tables that were already successfully imported in a previous
      // interrupted/resumed migration run.
      if (
        [
          "churches",
          "profiles",
          "firebase_uid_map",
          "groups",
          "members",
          "families",
          "family_members",
          "group_members",
          "events",
          "attendance",
          "donations",
          "volunteers",
          "assignments",
          "finance_categories",
          "finance_config",
          "income_transactions",
          "expense_transactions",
          "approval_history",
          "announcements",
          "notifications",
          "messages",
          "websites",
          "website_navigation",
        ].includes(table)
      )
        continue;
      const inspectColumn = inspectColumns[table] || "id";

      const r = await fetch(
        `${url}/rest/v1/${table}?select=${encodeURIComponent(inspectColumn)}&limit=1`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            Prefer: "count=exact",
          },
        },
      );

      if (!r.ok) {
        throw new Error(
          `Cannot inspect ${table}: ${r.status} ${await r.text()}`,
        );
      }

      const n = Number(
        (r.headers.get("content-range") || "*/0").split("/")[1] || 0,
      );

      if (n > 0) {
        throw new Error(
          `Target table ${table} is not empty (${n} rows). Import aborted.`,
        );
      }
    }
  }

  const t = plan.tables;
  await upsert(
    cfg,
    "churches",
    rows(t, "churches").map((r) => ({
      legacy_id: r.legacy_id,
      nama: r.nama,
      alamat: r.alamat,
      kota: r.kota,
      email: r.email,
      telepon: r.telepon,
      superadmin_uid: r.superadmin_auth_user_id || null,
      subscription: r.subscription || {},
      website: r.website || {},
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "legacy_id",
  );
  const churches = churchMap(await select(cfg, "churches", "id,legacy_id"));
  await upsert(
    cfg,
    "profiles",
    rows(t, "profiles").map((r) => ({
      id: r.auth_user_id,
      church_id: r.church_legacy_id
        ? churches.get(s(r.church_legacy_id))
        : null,
      nama: r.nama,
      username: r.username,
      email: r.email,
      role: r.role,
      status: r.status,
      last_login: r.last_login,
      updated_by: r.updated_by_auth_user_id || null,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "id",
  );
  const authMapFile = path.resolve(".auth-mapping-dry-run.json");
  const authRows =
    JSON.parse(fs.readFileSync(authMapFile, "utf8")).mappings || [];
  await upsert(
    cfg,
    "firebase_uid_map",
    authRows.map((r) => ({
      legacy_uid: r.firebase_uid,
      auth_user_id: r.auth_user_id,
    })),
    "legacy_uid",
  );

  await upsert(
    cfg,
    "groups",
    rows(t, "groups").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      nama: r.nama,
      deskripsi: r.deskripsi,
      jadwal: r.jadwal,
      show_phone: r.show_phone,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "church_id,legacy_id",
  );
  await upsert(
    cfg,
    "members",
    rows(t, "members").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      nama: r.nama,
      email: r.email,
      telepon: r.telepon,
      jk: r.jk,
      tempat_lahir: r.tempat_lahir,
      tgl_lahir: r.tgl_lahir || null,
      alamat: r.alamat,
      kota: r.kota,
      kodepos: r.kodepos,
      status: r.status,
      join_date: r.join_date || null,
      avatar: r.avatar,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "church_id,legacy_id",
  );
  const members = scopedMap(
    await select(cfg, "members", "id,church_id,legacy_id"),
  );
  const groups = scopedMap(
    await select(cfg, "groups", "id,church_id,legacy_id"),
  );
  for (const r of rows(t, "members"))
    if (r.group_legacy_id)
      await patch(
        cfg,
        "members",
        {
          church_id: churches.get(s(r.church_legacy_id)),
          legacy_id: r.legacy_id,
        },
        {
          group_id:
            groups.get(
              `${churches.get(s(r.church_legacy_id))}:${s(r.group_legacy_id)}`,
            ) || null,
        },
      );
  for (const r of rows(t, "groups"))
    if (r.leader_legacy_id)
      await patch(
        cfg,
        "groups",
        {
          church_id: churches.get(s(r.church_legacy_id)),
          legacy_id: r.legacy_id,
        },
        {
          leader_id:
            members.get(
              `${churches.get(s(r.church_legacy_id))}:${s(r.leader_legacy_id)}`,
            ) || null,
        },
      );
  await upsert(
    cfg,
    "families",
    rows(t, "families").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      nama: r.nama,
      alamat: r.alamat,
      kota: r.kota,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "church_id,legacy_id",
  );
  const families = scopedMap(
    await select(cfg, "families", "id,church_id,legacy_id"),
  );
  for (const r of rows(t, "families"))
    if (r.kepala_legacy_id)
      await patch(
        cfg,
        "families",
        {
          church_id: churches.get(s(r.church_legacy_id)),
          legacy_id: r.legacy_id,
        },
        {
          kepala_id:
            members.get(
              `${churches.get(s(r.church_legacy_id))}:${s(r.kepala_legacy_id)}`,
            ) || null,
        },
      );
  await upsert(
    cfg,
    "family_members",
    rows(t, "family_members").map((r) => ({
      family_id: families.get(
        `${churches.get(s(r.church_legacy_id))}:${s(r.family_legacy_id)}`,
      ),
      member_id: members.get(
        `${churches.get(s(r.church_legacy_id))}:${s(r.member_legacy_id)}`,
      ),
    })),
    "family_id,member_id",
  );
  await upsert(
    cfg,
    "group_members",
    rows(t, "group_members").map((r) => ({
      group_id: groups.get(
        `${churches.get(s(r.church_legacy_id))}:${s(r.group_legacy_id)}`,
      ),
      member_id: members.get(
        `${churches.get(s(r.church_legacy_id))}:${s(r.member_legacy_id)}`,
      ),
    })),
    "group_id,member_id",
  );

  await upsert(
    cfg,
    "events",
    rows(t, "events").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      nama: r.nama,
      tipe: r.tipe,
      custom_type: r.custom_type,
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      lokasi: r.lokasi,
      deskripsi: r.deskripsi,
      kapasitas: r.kapasitas,
      status: r.status,
      website: r.website || {},
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "church_id,legacy_id",
  );
  const events = scopedMap(
    await select(cfg, "events", "id,church_id,legacy_id"),
  );
  await upsert(
    cfg,
    "event_participants",
    rows(t, "event_participants").map((r) => ({
      event_id: events.get(
        `${churches.get(s(r.church_legacy_id))}:${s(r.event_legacy_id)}`,
      ),
      member_id: r.member_legacy_id
        ? members.get(
            `${churches.get(s(r.church_legacy_id))}:${s(r.member_legacy_id)}`,
          )
        : null,
      legacy_id: r.legacy_id,
      nama: r.nama,
      email: r.email,
      telepon: r.telepon,
      alamat: r.alamat,
      tanggal_daftar: r.tanggal_daftar,
      is_manual: r.is_manual,
    })),
    "legacy_id",
  );
  await upsert(
    cfg,
    "attendance",
    rows(t, "attendance").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      event_id: r.event_legacy_id
        ? events.get(
            `${churches.get(s(r.church_legacy_id))}:${s(r.event_legacy_id)}`,
          )
        : null,
      member_id: r.member_legacy_id
        ? members.get(
            `${churches.get(s(r.church_legacy_id))}:${s(r.member_legacy_id)}`,
          )
        : null,
      tanggal: r.tanggal,
      waktu: r.waktu,
      status: r.status,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "church_id,legacy_id",
  );

  await upsert(
    cfg,
    "donors",
    rows(t, "donors").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      nama: r.nama,
      email: r.email,
      telepon: r.telepon,
      alamat: r.alamat,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "church_id,legacy_id",
  );
  const donors = scopedMap(
    await select(cfg, "donors", "id,church_id,legacy_id"),
  );
  await upsert(
    cfg,
    "donations",
    rows(t, "donations").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      donor_id: r.donor_legacy_id
        ? members.get(
            `${churches.get(s(r.church_legacy_id))}:${s(r.donor_legacy_id)}`,
          )
        : null,
      donor_record_id: r.donor_record_legacy_id
        ? donors.get(
            `${churches.get(s(r.church_legacy_id))}:${s(r.donor_record_legacy_id)}`,
          )
        : null,
      tipe: r.tipe,
      custom_type: r.custom_type,
      jumlah: r.jumlah,
      tanggal: r.tanggal,
      keterangan: r.keterangan,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "church_id,legacy_id",
  );

  await upsert(
    cfg,
    "volunteers",
    rows(t, "volunteers").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      area: r.area,
      custom_area: r.custom_area,
      jadwal: r.jadwal || [],
      service_date: r.service_date,
      service_time: r.service_time,
      status: r.status,
      member_id: r.member_legacy_id
        ? members.get(
            `${churches.get(s(r.church_legacy_id))}:${s(r.member_legacy_id)}`,
          )
        : null,
      external_nama: r.external_nama,
      external_email: r.external_email,
      external_telepon: r.external_telepon,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "church_id,legacy_id",
  );
  const volunteers = scopedMap(
    await select(cfg, "volunteers", "id,church_id,legacy_id"),
  );
  await upsert(
    cfg,
    "assignments",
    rows(t, "assignments").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      volunteer_id: r.volunteer_legacy_id
        ? volunteers.get(
            `${churches.get(s(r.church_legacy_id))}:${s(r.volunteer_legacy_id)}`,
          )
        : null,
      event_id: r.event_legacy_id
        ? events.get(
            `${churches.get(s(r.church_legacy_id))}:${s(r.event_legacy_id)}`,
          )
        : null,
      tanggal: r.tanggal,
      waktu: r.waktu,
      tempat: r.tempat,
      tugas: r.tugas,
      catatan: r.catatan,
      status: r.status,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "church_id,legacy_id",
  );
  await upsert(
    cfg,
    "finance_categories",
    rows(t, "finance_categories").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      nama: r.nama,
      tipe: r.tipe,
      deskripsi: r.deskripsi,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "church_id,legacy_id",
  );
  const categories = scopedMap(
    await select(cfg, "finance_categories", "id,church_id,legacy_id"),
  );
  await upsert(
    cfg,
    "finance_config",
    rows(t, "finance_config").map((r) => ({
      church_id: churches.get(s(r.church_legacy_id)),
      config: r.config || {},
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "church_id",
  );
  await upsert(
    cfg,
    "income_transactions",
    rows(t, "income_transactions").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      kategori_id: r.kategori_legacy_id
        ? categories.get(
            `${churches.get(s(r.church_legacy_id))}:${s(r.kategori_legacy_id)}`,
          )
        : null,
      donatur_member_id: r.donatur_member_legacy_id
        ? members.get(
            `${churches.get(s(r.church_legacy_id))}:${s(r.donatur_member_legacy_id)}`,
          )
        : null,
      jumlah: r.jumlah,
      tanggal: r.tanggal,
      donatur_id: r.donatur_legacy_id
        ? donors.get(
            `${churches.get(s(r.church_legacy_id))}:${s(r.donatur_legacy_id)}`,
          )
        : null,
      keterangan: r.keterangan,
      status: r.status,
      approved_by: r.approved_by_auth_user_id || null,
      approved_at: r.approved_at,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "church_id,legacy_id",
  );
  await upsert(
    cfg,
    "expense_transactions",
    rows(t, "expense_transactions").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      kategori_id: r.kategori_legacy_id
        ? categories.get(
            `${churches.get(s(r.church_legacy_id))}:${s(r.kategori_legacy_id)}`,
          )
        : null,
      jumlah: r.jumlah,
      tanggal: r.tanggal,
      keterangan: r.keterangan,
      status: r.status,
      approved_by: r.approved_by_auth_user_id || null,
      approved_at: r.approved_at,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "church_id,legacy_id",
  );
  await upsert(
    cfg,
    "approval_history",
    rows(t, "approval_history").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      tipe: r.tipe,
      item_id: r.item_id,
      action: r.action,
      by_user_id: r.by_auth_user_id || null,
      occurred_at: r.occurred_at,
    })),
    "church_id,legacy_id",
  );
  await upsert(
    cfg,
    "announcements",
    rows(t, "announcements").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      judul: r.judul,
      konten: r.konten,
      tanggal: r.tanggal,
      expiry: r.expiry,
      important: r.important,
      author_id: r.author_auth_user_id || null,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "church_id,legacy_id",
  );
  await upsert(
    cfg,
    "notifications",
    rows(t, "notifications").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      title: r.title,
      message: r.message,
      type: r.type,
      data: r.data || {},
      created_at: r.created_at,
    })),
    "church_id,legacy_id",
  );
  const notifications = scopedMap(
    await select(cfg, "notifications", "id,church_id,legacy_id"),
  );
  await upsert(
    cfg,
    "notification_recipients",
    rows(t, "notification_recipients").map((r) => ({
      notification_id: notifications.get(
        `${churches.get(s(r.church_legacy_id))}:${s(r.notification_legacy_id)}`,
      ),
      user_id: r.user_auth_user_id,
      read: r.read,
      read_at: r.read_at,
    })),
    "notification_id,user_id",
  );
  await upsert(
    cfg,
    "messages",
    rows(t, "messages").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      sender_id: r.sender_auth_user_id || null,
      receiver_id: r.receiver_auth_user_id || null,
      content: r.content,
      timestamp: r.timestamp,
      read: r.read,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "legacy_id",
  );
  await upsert(
    cfg,
    "deaths",
    rows(t, "deaths").map((r) => ({
      legacy_id: r.legacy_id,
      church_id: churches.get(s(r.church_legacy_id)),
      nama: r.nama,
      tgl_lahir: r.tgl_lahir || null,
      tgl_wafat: r.tgl_wafat,
      riwayat_penyakit: r.riwayat_penyakit,
      penyebab: r.penyebab,
      tempat: r.tempat,
      waktu: r.waktu,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "church_id,legacy_id",
  );

  await upsert(
    cfg,
    "websites",
    rows(t, "websites").map((r) => ({
      church_id: churches.get(s(r.church_legacy_id)),
      enabled: r.enabled,
      template_id: r.template_id,
      site_name: r.site_name,
      tagline: r.tagline,
      logo_url: r.logo_url,
      favicon_url: r.favicon_url,
      theme: r.theme || {},
      seo: r.seo || {},
      contact: r.contact || {},
      social: r.social || {},
      status: r.status,
      published_at: r.published_at,
      published_by: r.published_by_auth_user_id || null,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "church_id",
  );
  const websites = new Map(
    (await select(cfg, "websites", "id,church_id")).map((r) => [
      s(r.church_id),
      r.id,
    ]),
  );
  await upsert(
    cfg,
    "website_pages",
    rows(t, "website_pages").map((r) => ({
      website_id: websites.get(s(churches.get(s(r.church_legacy_id)))),
      legacy_id: r.legacy_id,
      title: r.title,
      slug: r.slug,
      published: r.published,
      sections: r.sections || [],
      updated_by: r.updated_by_auth_user_id || null,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "website_id,slug",
  );
  await upsert(
    cfg,
    "website_navigation",
    rows(t, "website_navigation").map((r) => ({
      website_id: websites.get(s(churches.get(s(r.church_legacy_id)))),
      items: r.items || [],
      updated_by: r.updated_by_auth_user_id || null,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    })),
    "website_id",
  );
  await upsert(
    cfg,
    "site_slugs",
    rows(t, "site_slugs").map((r) => ({
      slug: r.slug,
      church_id: churches.get(s(r.church_legacy_id)),
      updated_at: r.updated_at,
    })),
    "slug",
  );

  console.log("LIVE IMPORT PASS");
  console.log("Firebase remains untouched.");
}

main().catch((error) => {
  console.error(`LIVE IMPORT FAILED: ${error.message}`);
  process.exitCode = 1;
});
