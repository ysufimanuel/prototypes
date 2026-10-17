const { db } = require("../../_lib/firebase-admin");
const { requireChurchAdmin } = require("../../_lib/auth");
const { applyCors } = require("../../_lib/cors");
const { FieldValue } = require("firebase-admin/firestore");
const { supabaseAdmin } = require("../../_lib/supabase");

const DEFAULT_CONFIG = {
  enabled: true,
  templateId: "modern-church",
  siteName: "Gereja Digital",
  tagline: "Selamat datang di website gereja kami",
  logoUrl: "",
  faviconUrl: "",
  theme: { primary: "#ff6b00", secondary: "#1f2937", accent: "#f59e0b", headingFont: "Poppins", bodyFont: "Poppins" },
  seo: { title: "", description: "", ogImageUrl: "" },
  contact: { email: "", phone: "", address: "", mapsUrl: "" },
  social: { facebook: "", instagram: "", youtube: "" },
};

const DEFAULT_NAVIGATION = {
  items: [
    { id: "home", label: "Home", type: "page", target: "/", visible: true },
    { id: "new-to-church", label: "New to Church", type: "page", target: "/new-to-church", visible: true },
    { id: "connect", label: "Connect", type: "page", target: "/connect", visible: true },
    { id: "grow", label: "Grow", type: "page", target: "/grow", visible: true },
    { id: "ministries", label: "Ministries", type: "page", target: "/ministries", visible: true },
    { id: "resources", label: "Resources", type: "page", target: "/resources", visible: true },
  ],
};

const DEFAULT_PAGES = [
  { id: "home", title: "Home", slug: "/", published: true, sections: [{ id: "hero", type: "hero", enabled: true, order: 1, config: {} }] },
  { id: "new-to-church", title: "New to Church", slug: "/new-to-church", published: true, sections: [{ id: "welcome", type: "welcome", enabled: true, order: 1, config: {} }] },
  { id: "connect", title: "Connect", slug: "/connect", published: true, sections: [{ id: "connect", type: "cta", enabled: true, order: 1, config: {} }] },
  { id: "grow", title: "Grow", slug: "/grow", published: true, sections: [{ id: "grow", type: "about", enabled: true, order: 1, config: {} }] },
  { id: "ministries", title: "Ministries", slug: "/ministries", published: true, sections: [{ id: "ministries", type: "ministries", enabled: true, order: 1, config: {} }] },
  { id: "resources", title: "Resources", slug: "/resources", published: true, sections: [{ id: "resources", type: "sermons", enabled: true, order: 1, config: {} }] },
];

function now() {
  return FieldValue.serverTimestamp();
}

function cleanString(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function slugify(value) {
  return cleanString(value, 120).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "gereja-digital";
}

async function loadSupabaseWebsite(user) {
  const { data: church, error: churchError } = await supabaseAdmin
    .from("churches")
    .select("id, legacy_id, nama")
    .eq("legacy_id", user.churchId)
    .maybeSingle();
  if (churchError) throw new Error(`SUPABASE_CHURCH_LOOKUP_FAILED: ${churchError.message}`);
  if (!church) throw new Error("CHURCH_NOT_FOUND");

  const { data: website, error: websiteError } = await supabaseAdmin
    .from("websites")
    .select("id, church_id, enabled, template_id, site_name, tagline, logo_url, favicon_url, theme, seo, contact, social, status, published_at, published_by, created_at, updated_at")
    .eq("church_id", church.id)
    .maybeSingle();
  if (websiteError) throw new Error(`SUPABASE_WEBSITE_LOOKUP_FAILED: ${websiteError.message}`);
  if (!website) throw new Error("WEBSITE_NOT_FOUND");

  const [slugResult, navigationResult, pagesResult] = await Promise.all([
    supabaseAdmin.from("site_slugs").select("slug").eq("church_id", church.id).maybeSingle(),
    supabaseAdmin.from("website_navigation").select("items").eq("website_id", website.id).maybeSingle(),
    supabaseAdmin.from("website_pages").select("id, legacy_id, title, slug, published, sections").eq("website_id", website.id).order("id", { ascending: true }),
  ]);
  if (slugResult.error) throw new Error(`SUPABASE_SLUG_LOOKUP_FAILED: ${slugResult.error.message}`);
  if (navigationResult.error) throw new Error(`SUPABASE_NAVIGATION_LOOKUP_FAILED: ${navigationResult.error.message}`);
  if (pagesResult.error) throw new Error(`SUPABASE_PAGES_LOOKUP_FAILED: ${pagesResult.error.message}`);

  return { church, website, slug: slugResult.data?.slug || null, navigation: navigationResult.data || { items: [] }, pages: pagesResult.data || [] };
}

function normalizeConfig(config = {}) {
  const theme = config.theme || {};
  const contact = config.contact || {};
  return {
    enabled: config.enabled !== false,
    template_id: "modern-church",
    site_name: cleanString(config.siteName || "Gereja Digital", 120),
    tagline: cleanString(config.tagline, 180),
    logo_url: cleanString(config.logoUrl, 1000),
    favicon_url: cleanString(config.faviconUrl, 1000),
    theme: { primary: cleanString(theme.primary, 30), secondary: cleanString(theme.secondary, 30), accent: cleanString(theme.accent, 30), headingFont: cleanString(theme.headingFont, 80) || "Poppins", bodyFont: "Poppins" },
    seo: config.seo || DEFAULT_CONFIG.seo,
    contact: { email: cleanString(contact.email, 160), phone: cleanString(contact.phone, 60), address: cleanString(contact.address, 300), mapsUrl: cleanString(contact.mapsUrl, 1000) },
    social: config.social || DEFAULT_CONFIG.social,
  };
}

function toClientDraft(record) {
  const website = record.website;
  return {
    church: {
      id: record.church.legacy_id,
      name: cleanString(record.church.nama || "Gereja Digital", 120),
      website: {
        enabled: website.enabled !== false,
        slug: record.slug,
        status: website.status || "draft",
        templateId: website.template_id || "modern-church",
        publishedAt: website.published_at || null,
        updatedAt: website.updated_at || null,
      },
    },
    config: {
      enabled: website.enabled !== false,
      templateId: website.template_id || "modern-church",
      siteName: cleanString(website.site_name || "Gereja Digital", 120),
      tagline: cleanString(website.tagline || "", 180),
      logoUrl: cleanString(website.logo_url || "", 1000),
      faviconUrl: cleanString(website.favicon_url || "", 1000),
      theme: website.theme || DEFAULT_CONFIG.theme,
      seo: website.seo || DEFAULT_CONFIG.seo,
      contact: website.contact || DEFAULT_CONFIG.contact,
      social: website.social || DEFAULT_CONFIG.social,
    },
    navigation: record.navigation?.items ? { items: record.navigation.items } : DEFAULT_NAVIGATION,
    pages: record.pages.map((page) => ({
      id: page.legacy_id || String(page.id),
      title: cleanString(page.title, 120),
      slug: cleanString(page.slug, 200),
      published: page.published === true,
      sections: Array.isArray(page.sections) ? page.sections : [],
    })),
  };
}

async function getDraft(req, res, user) {
  const record = await loadSupabaseWebsite(user);
  return res.json({ success: true, data: toClientDraft(record) });
}

async function provision(req, res, user) {
  const { data: church, error: churchError } = await supabaseAdmin
    .from("churches").select("id, legacy_id, nama").eq("legacy_id", user.churchId).maybeSingle();
  if (churchError) throw churchError;
  if (!church) throw new Error("CHURCH_NOT_FOUND");

  let { data: website, error: websiteError } = await supabaseAdmin.from("websites").select("*").eq("church_id", church.id).maybeSingle();
  if (websiteError) throw websiteError;
  if (!website) {
    const { data, error } = await supabaseAdmin.from("websites").insert({
      church_id: church.id,
      enabled: true,
      template_id: "modern-church",
      site_name: cleanString(church.nama || "Gereja Digital", 120),
      tagline: DEFAULT_CONFIG.tagline,
      theme: DEFAULT_CONFIG.theme,
      seo: DEFAULT_CONFIG.seo,
      contact: DEFAULT_CONFIG.contact,
      social: DEFAULT_CONFIG.social,
      status: "draft",
    }).select("*").single();
    if (error) throw error;
    website = data;
  }

  let { data: slugRow, error: slugError } = await supabaseAdmin.from("site_slugs").select("slug").eq("church_id", church.id).maybeSingle();
  if (slugError) throw slugError;
  if (!slugRow) {
    const base = slugify(church.nama || "gereja-digital");
    let slug = base;
    let counter = 2;
    while (true) {
      const { data: collision } = await supabaseAdmin.from("site_slugs").select("church_id").eq("slug", slug).maybeSingle();
      if (!collision || collision.church_id === church.id) break;
      slug = `${base}-${counter++}`;
    }
    const { data, error } = await supabaseAdmin.from("site_slugs").insert({ church_id: church.id, slug }).select("slug").single();
    if (error) throw error;
    slugRow = data;
  }

  const { data: pages, error: pagesError } = await supabaseAdmin.from("website_pages").select("id").eq("website_id", website.id).limit(1);
  if (pagesError) throw pagesError;
  if (!pages?.length) {
    const rows = DEFAULT_PAGES.map((page) => ({ website_id: website.id, legacy_id: page.id, title: page.title, slug: page.slug, published: page.published, sections: page.sections }));
    const { error } = await supabaseAdmin.from("website_pages").insert(rows);
    if (error) throw error;
  }
  return res.json({ success: true, slug: slugRow.slug, message: "Website draft siap digunakan" });
}

async function saveDraft(req, res, user) {
  const body = req.body || {};
  const record = await loadSupabaseWebsite(user);
  const config = normalizeConfig(body.config || {});

  const { error: websiteError } = await supabaseAdmin.from("websites").update({
    enabled: config.enabled,
    template_id: config.template_id,
    site_name: config.site_name,
    tagline: config.tagline,
    logo_url: config.logo_url,
    favicon_url: config.favicon_url,
    theme: config.theme,
    seo: config.seo,
    contact: config.contact,
    social: config.social,
    updated_at: new Date().toISOString(),
  }).eq("id", record.website.id);
  if (websiteError) throw new Error(`SUPABASE_WEBSITE_SAVE_FAILED: ${websiteError.message}`);

  if (Array.isArray(body.navigation?.items)) {
    const items = body.navigation.items.slice(0, 30).map((item) => ({
      id: cleanString(item.id, 80),
      label: cleanString(item.label, 80),
      type: "page",
      target: cleanString(item.target, 200),
      visible: item.visible !== false,
    }));
    const { data: existingNav, error: navReadError } = await supabaseAdmin.from("website_navigation").select("id").eq("website_id", record.website.id).maybeSingle();
    if (navReadError) throw navReadError;
    if (existingNav) {
      const { error } = await supabaseAdmin.from("website_navigation").update({ items, updated_at: new Date().toISOString() }).eq("id", existingNav.id);
      if (error) throw new Error(`SUPABASE_NAVIGATION_SAVE_FAILED: ${error.message}`);
    } else {
      const { error } = await supabaseAdmin.from("website_navigation").insert({ website_id: record.website.id, items });
      if (error) throw new Error(`SUPABASE_NAVIGATION_SAVE_FAILED: ${error.message}`);
    }
  }

  if (Array.isArray(body.pages)) {
    const pages = body.pages.filter((page) => page?.id).slice(0, 30).map((page) => ({
      website_id: record.website.id,
      legacy_id: cleanString(page.id, 80),
      title: cleanString(page.title, 120),
      slug: cleanString(page.slug || "/", 200),
      published: page.published === true,
      sections: Array.isArray(page.sections) ? page.sections.slice(0, 30) : [],
    }));
    const { error: deleteError } = await supabaseAdmin.from("website_pages").delete().eq("website_id", record.website.id);
    if (deleteError) throw new Error(`SUPABASE_PAGES_CLEAR_FAILED: ${deleteError.message}`);
    if (pages.length) {
      const { error: insertError } = await supabaseAdmin.from("website_pages").insert(pages);
      if (insertError) throw new Error(`SUPABASE_PAGES_SAVE_FAILED: ${insertError.message}`);
    }
  }

  return res.json({ success: true, message: "Draft website berhasil disimpan" });
}

async function publish(req, res, user) {
  const record = await loadSupabaseWebsite(user);
  const slug = record.slug;
  if (!slug) throw new Error("SITE_SLUG_NOT_FOUND");

  const publicBase = db.collection("publicSites").doc(user.churchId);
  const config = record.website;
  const batch = db.batch();
  const safeConfig = {
    enabled: config.enabled !== false,
    templateId: config.template_id || "modern-church",
    siteName: cleanString(config.site_name || "Gereja Digital", 120),
    tagline: cleanString(config.tagline || "", 180),
    logoUrl: cleanString(config.logo_url || "", 1000),
    faviconUrl: cleanString(config.favicon_url || "", 1000),
    theme: config.theme || DEFAULT_CONFIG.theme,
    seo: config.seo || DEFAULT_CONFIG.seo,
    contact: config.contact || DEFAULT_CONFIG.contact,
    social: config.social || DEFAULT_CONFIG.social,
    slug,
    publishedAt: now(),
    publishedBy: user.uid,
  };
  batch.set(publicBase.collection("config").doc("site"), safeConfig, { merge: true });
  batch.set(publicBase.collection("navigation").doc("main"), record.navigation || DEFAULT_NAVIGATION, { merge: true });

  const existingPublicPages = await publicBase.collection("pages").get();
  existingPublicPages.forEach((pageSnap) => batch.delete(pageSnap.ref));
  record.pages.filter((page) => page.published === true).forEach((page) => {
    batch.set(publicBase.collection("pages").doc(page.legacy_id || String(page.id)), {
      title: cleanString(page.title, 120),
      slug: cleanString(page.slug, 200),
      published: true,
      sections: Array.isArray(page.sections) ? page.sections : [],
      publishedAt: now(),
    });
  });
  await batch.commit();

  const { error: statusError } = await supabaseAdmin.from("websites").update({ status: "published", published_at: new Date().toISOString(), published_by: user.uid, updated_at: new Date().toISOString() }).eq("id", record.website.id);
  if (statusError) throw new Error(`SUPABASE_PUBLISH_STATUS_FAILED: ${statusError.message}`);

  return res.json({ success: true, slug, message: "Website berhasil dipublikasikan" });
}

async function publishEvents(req, res, user) {
  const churchId = user.churchId;
  const source = await db.collection("churches").doc(churchId).collection("events").get();
  const publicRef = db.collection("publicSites").doc(churchId).collection("events");
  const existing = await publicRef.get();
  const publicEvents = source.docs.filter((snap) => snap.data()?.website?.published !== false).slice(0, 300);
  const operations = [];
  existing.docs.forEach((snap) => operations.push({ type: "delete", ref: snap.ref }));
  publicEvents.forEach((snap) => {
    const event = snap.data() || {};
    const website = event.website && typeof event.website === "object" ? event.website : {};
    operations.push({ type: "set", ref: publicRef.doc(snap.id), data: { nama: cleanString(event.nama, 160), tipe: cleanString(event.tipe, 80), customType: cleanString(event.customType, 120), start: cleanString(event.start, 80), end: cleanString(event.end, 80), lokasi: cleanString(event.lokasi, 240), deskripsi: cleanString(event.deskripsi, 1000), kapasitas: Number.isFinite(Number(event.kapasitas)) ? Number(event.kapasitas) : 0, status: cleanString(event.status, 40), featured: website.featured === true, publishedAt: now() } });
  });
  for (let i = 0; i < operations.length; i += 450) {
    const batch = db.batch();
    operations.slice(i, i + 450).forEach((operation) => operation.type === "delete" ? batch.delete(operation.ref) : batch.set(operation.ref, operation.data));
    await batch.commit();
  }
  return res.json({ success: true, eventCount: publicEvents.length });
}

async function publishGroups(req, res, user) {
  const churchId = user.churchId;
  const groupsSnap = await db.collection(`churches/${churchId}/groups`).limit(300).get();
  const membersSnap = await db.collection(`churches/${churchId}/members`).limit(1000).get();
  const members = new Map(membersSnap.docs.map((doc) => [String(doc.id), doc.data()]));
  const publicGroups = groupsSnap.docs.map((doc) => {
    const group = doc.data() || {};
    const leader = group.leaderId != null ? members.get(String(group.leaderId)) : null;
    const leaderData = leader ? { name: cleanString(leader.nama, 120) } : null;
    if (leader && group.showPhone === true && leader.telepon) leaderData.phone = cleanString(leader.telepon, 50);
    return { id: doc.id, name: cleanString(group.nama, 120), description: cleanString(group.deskripsi, 1000), schedule: cleanString(group.jadwal, 300), leader: leaderData, updatedAt: now() };
  });
  const writer = db.bulkWriter();
  const existingSnap = await db.collection(`publicSites/${churchId}/ministries`).get();
  existingSnap.docs.forEach((doc) => writer.delete(doc.ref));
  publicGroups.forEach((group) => writer.set(db.doc(`publicSites/${churchId}/ministries/${group.id}`), group));
  await writer.close();
  return res.json({ success: true, ministryCount: publicGroups.length });
}

function getRoutePath(req) {
  const queryPath = req.query?.path;
  if (Array.isArray(queryPath)) return queryPath.join("/");
  if (typeof queryPath === "string" && queryPath) return queryPath.replace(/^\/+|\/+$/g, "");
  const rawUrl = String(req.url || "").split("?", 1)[0];
  const prefix = "/api/admin/website/";
  if (!rawUrl.startsWith(prefix)) return "";
  return decodeURIComponent(rawUrl.slice(prefix.length)).replace(/^\/+|\/+$/g, "");
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (!["GET", "POST", "PUT", "OPTIONS"].includes(req.method)) return res.status(405).json({ success: false, message: "Method tidak diizinkan" });
  if (req.method === "OPTIONS") return res.status(204).end();

  const path = getRoutePath(req);
  const user = await requireChurchAdmin(req, res);
  if (!user) return;

  try {
    if (path === "draft" && req.method === "GET") return await getDraft(req, res, user);
    if (path === "provision" && req.method === "POST") return await provision(req, res, user);
    if (path === "draft" && req.method === "PUT") return await saveDraft(req, res, user);
    if (path === "publish" && req.method === "POST") return await publish(req, res, user);
    if (path === "publish-events" && req.method === "POST") return await publishEvents(req, res, user);
    if (path === "publish-groups" && req.method === "POST") return await publishGroups(req, res, user);
    return res.status(404).json({ success: false, message: "Endpoint website tidak ditemukan." });
  } catch (error) {
    console.error("[WEBSITE API] Internal error:", { path, name: error?.name || null, message: error?.message || String(error) });
    return res.status(500).json({ success: false, message: error?.message || "Gagal memproses website." });
  }
};