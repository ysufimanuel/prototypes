const { db } = require("../../_lib/firebase-admin");
const { requireChurchAdmin } = require("../../_lib/auth");
const { applyCors } = require("../../_lib/cors");
const { FieldValue } = require("firebase-admin/firestore");

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
    { id: "home", label: "Home", type: "page", target: "/" },
    { id: "new-to-church", label: "New to Church", type: "page", target: "/new-to-church" },
    { id: "connect", label: "Connect", type: "page", target: "/connect" },
    { id: "grow", label: "Grow", type: "page", target: "/grow" },
    { id: "ministries", label: "Ministries", type: "page", target: "/ministries" },
    { id: "resources", label: "Resources", type: "page", target: "/resources" },
  ],
};

const DEFAULT_PAGES = [
  { id: "home", title: "Home", slug: "/", published: true, sections: [{ id: "hero", type: "hero", enabled: true, order: 1, config: {} }, { id: "welcome", type: "welcome", enabled: true, order: 2, config: {} }, { id: "services", type: "serviceSchedule", enabled: true, order: 3, config: {} }, { id: "events", type: "featuredEvents", enabled: true, order: 4, config: { limit: 3 } }, { id: "about", type: "about", enabled: true, order: 5, config: {} }, { id: "ministries", type: "ministries", enabled: true, order: 6, config: {} }, { id: "contact", type: "contact", enabled: true, order: 7, config: {} }] },
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

async function ensureSlug(churchId) {
  const churchRef = db.collection("churches").doc(churchId);
  const churchSnap = await churchRef.get();
  if (!churchSnap.exists) throw new Error("CHURCH_NOT_FOUND");
  const church = churchSnap.data() || {};
  if (church.website?.slug) return church.website.slug;

  const base = slugify(church.nama || church.name || church.churchName || church.namaGereja || "gereja-digital");
  let slug = base;
  let counter = 2;
  while (true) {
    const snap = await db.collection("siteSlugs").doc(slug).get();
    if (!snap.exists || snap.data().churchId === churchId) break;
    slug = `${base}-${counter++}`;
  }

  const batch = db.batch();
  batch.set(db.collection("siteSlugs").doc(slug), { churchId, updatedAt: now() });
  batch.set(churchRef, { website: { enabled: true, slug, status: "draft", templateId: "modern-church", updatedAt: now() } }, { merge: true });
  await batch.commit();
  return slug;
}

async function getDraft(req, res, user) {
  const churchRef = db.collection("churches").doc(user.churchId);
  const base = churchRef.collection("website");
  const pagesRef = base.doc("content").collection("pages");
  const [churchSnap, configSnap, navSnap, pagesSnap] = await Promise.all([
    churchRef.get(), base.doc("config").get(), base.doc("navigation").get(), pagesRef.get(),
  ]);
  const church = churchSnap.exists ? churchSnap.data() : {};
  return res.json({ success: true, data: {
    church: { id: user.churchId, name: cleanString(church.nama || church.name || church.churchName || "Gereja Digital", 120), website: church.website || {} },
    config: configSnap.exists ? configSnap.data() : DEFAULT_CONFIG,
    navigation: navSnap.exists ? navSnap.data() : DEFAULT_NAVIGATION,
    pages: pagesSnap.empty ? DEFAULT_PAGES : pagesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  } });
}

async function provision(req, res, user) {
  const churchId = user.churchId;
  const slug = await ensureSlug(churchId);
  const churchRef = db.collection("churches").doc(churchId);
  const base = churchRef.collection("website");
  const pagesRef = base.doc("content").collection("pages");
  const batch = db.batch();
  const configRef = base.doc("config");
  const navRef = base.doc("navigation");
  const [configSnap, navSnap, pagesSnap] = await Promise.all([configRef.get(), navRef.get(), pagesRef.limit(1).get()]);
  if (!configSnap.exists) batch.set(configRef, { ...DEFAULT_CONFIG, status: "draft", createdAt: now(), updatedAt: now(), updatedBy: user.uid });
  if (!navSnap.exists) batch.set(navRef, { ...DEFAULT_NAVIGATION, createdAt: now(), updatedAt: now(), updatedBy: user.uid });
  if (pagesSnap.empty) DEFAULT_PAGES.forEach((page) => batch.set(pagesRef.doc(page.id), { ...page, createdAt: now(), updatedAt: now(), updatedBy: user.uid }));
  await batch.commit();
  return res.json({ success: true, slug, message: "Website draft siap digunakan" });
}

async function saveDraft(req, res, user) {
  const body = req.body || {};
  const churchRef = db.collection("churches").doc(user.churchId);
  const base = churchRef.collection("website");
  const pagesRef = base.doc("content").collection("pages");
  const config = body.config || {};
  const theme = config.theme || {};
  const contact = config.contact || {};
  const safeConfig = {
    enabled: config.enabled !== false,
    templateId: "modern-church",
    siteName: cleanString(config.siteName, 120),
    tagline: cleanString(config.tagline, 180),
    logoUrl: cleanString(config.logoUrl, 1000),
    faviconUrl: cleanString(config.faviconUrl, 1000),
    theme: { primary: cleanString(theme.primary, 30), secondary: cleanString(theme.secondary, 30), accent: cleanString(theme.accent, 30), headingFont: cleanString(theme.headingFont, 80) || "Poppins", bodyFont: "Poppins" },
    contact: { email: cleanString(contact.email, 160), phone: cleanString(contact.phone, 60), address: cleanString(contact.address, 300), mapsUrl: cleanString(contact.mapsUrl, 1000) },
    updatedAt: now(), updatedBy: user.uid,
  };
  const batch = db.batch();
  batch.set(base.doc("config"), safeConfig, { merge: true });
  if (Array.isArray(body.navigation?.items)) {
    batch.set(base.doc("navigation"), { items: body.navigation.items.map((i) => ({ id: cleanString(i.id, 80), label: cleanString(i.label, 80), type: "page", target: cleanString(i.target, 200), visible: i.visible !== false })), updatedAt: now(), updatedBy: user.uid }, { merge: true });
  }
  if (Array.isArray(body.pages)) {
    body.pages.slice(0, 30).forEach((page) => {
      if (!page?.id) return;
      batch.set(pagesRef.doc(cleanString(page.id, 80)), { title: cleanString(page.title, 120), slug: cleanString(page.slug, 200), published: page.published === true, sections: Array.isArray(page.sections) ? page.sections.slice(0, 30) : [], updatedAt: now(), updatedBy: user.uid }, { merge: true });
    });
  }
  await batch.commit();
  return res.json({ success: true, message: "Draft website berhasil disimpan" });
}

async function publish(req, res, user) {
  const churchId = user.churchId;
  const slug = await ensureSlug(churchId);
  const churchRef = db.collection("churches").doc(churchId);
  const source = churchRef.collection("website");
  const pagesRef = source.doc("content").collection("pages");
  const [configSnap, navSnap, pagesSnap] = await Promise.all([source.doc("config").get(), source.doc("navigation").get(), pagesRef.get()]);
  if (!configSnap.exists) return res.status(400).json({ success: false, message: "Draft website belum tersedia" });

  const publicBase = db.collection("publicSites").doc(churchId);
  const batch = db.batch();
  const config = configSnap.data();
  const safeConfig = {
    enabled: !!config.enabled, templateId: config.templateId || "modern-church", siteName: cleanString(config.siteName, 120), tagline: cleanString(config.tagline, 180), logoUrl: cleanString(config.logoUrl, 1000), faviconUrl: cleanString(config.faviconUrl, 1000), theme: config.theme || DEFAULT_CONFIG.theme, seo: config.seo || DEFAULT_CONFIG.seo, contact: config.contact || DEFAULT_CONFIG.contact, social: config.social || DEFAULT_CONFIG.social, slug, publishedAt: now(), publishedBy: user.uid,
  };
  batch.set(publicBase.collection("config").doc("site"), safeConfig, { merge: true });
  if (navSnap.exists) batch.set(publicBase.collection("navigation").doc("main"), navSnap.data());

  const existingPublicPages = await publicBase.collection("pages").get();
  existingPublicPages.forEach((pageSnap) => batch.delete(pageSnap.ref));
  pagesSnap.forEach((s) => {
    const data = s.data();
    if (data.published !== true) return;
    batch.set(publicBase.collection("pages").doc(s.id), { title: cleanString(data.title, 120), slug: cleanString(data.slug, 200), published: true, sections: Array.isArray(data.sections) ? data.sections : [], publishedAt: now() });
  });
  batch.set(source.doc("config"), { status: "published", publishedAt: now(), publishedBy: user.uid, updatedAt: now(), updatedBy: user.uid }, { merge: true });
  batch.set(churchRef, { website: { enabled: true, slug, status: "published", templateId: config.templateId || "modern-church", publishedAt: now(), updatedAt: now() } }, { merge: true });
  await batch.commit();
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

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (!["GET", "POST", "PUT", "OPTIONS"].includes(req.method)) return res.status(405).json({ success: false, message: "Method tidak diizinkan" });

  const user = await requireChurchAdmin(req, res);
  if (!user) return;

  const path = Array.isArray(req.query.path) ? req.query.path.join("/") : String(req.query.path || "");

  try {
    if (path === "draft" && req.method === "GET") return await getDraft(req, res, user);
    if (path === "provision" && req.method === "POST") return await provision(req, res, user);
    if (path === "draft" && req.method === "PUT") return await saveDraft(req, res, user);
    if (path === "publish" && req.method === "POST") return await publish(req, res, user);
    if (path === "publish-events" && req.method === "POST") return await publishEvents(req, res, user);
    if (path === "publish-groups" && req.method === "POST") return await publishGroups(req, res, user);
    return res.status(404).json({ success: false, message: "Endpoint website tidak ditemukan." });
  } catch (error) {
    console.error("[WEBSITE API] Internal error:", error);
    return res.status(500).json({ success: false, message: "Gagal memproses website." });
  }
};
